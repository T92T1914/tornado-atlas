// Passive observations around an original control activation. These do not
// perform input, wait for an outcome or replace acceptance assertions.
const smallError=error=>({name:String(error?.name??'Error').slice(0,64),
  message:String(error?.message??error).slice(0,240)});
async function boundedDiagnosticRead(read,label){
  let timer;
  try{return await Promise.race([read(),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(label+' exceeded500ms')),500);
  })]);}finally{clearTimeout(timer);}
}

export async function beginSurveyActivation(page,{controlId='survey-next'}={}){
  if(!['survey-next','play'].includes(controlId))throw new TypeError('Unsupported activation control');
  await page.evaluate(controlId=>{
    if(!['survey-next','play'].includes(controlId))throw new TypeError('Unsupported activation control');
    window.__atlasSurveyActivation?.stop?.();
    const next=document.getElementById('survey-next'),control=document.getElementById(controlId);
    const identify=node=>node instanceof Element?{tag:node.tagName,id:node.id,
      class:node.getAttribute('class')?.slice(0,160)??null}:null;
    const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height};};
    const state=()=>{
      const controlRect=rect(control),center=controlRect?
        document.elementFromPoint(controlRect.x+controlRect.width/2,controlRect.y+controlRect.height/2):null;
      return {url:location.href,selection:document.getElementById('survey-observation')?.value,
        timeline:(document.getElementById('timeline')??document.getElementById('replay-time'))?.value,
        play:(document.getElementById('play')??document.getElementById('replay-play'))?.textContent,
        history:history.length,ready:document.body?.dataset.exhibitReady??null,
        dialogOpen:document.getElementById('photo-dialog')?.open??null,
        nextConnected:next?.isConnected??false,nextDisabled:next?.disabled??null,
        nextRect:rect(next),scroll:{x:scrollX,y:scrollY},viewport:{width:innerWidth,height:innerHeight},
        visibility:document.visibilityState,documentReady:document.readyState,
        focus:identify(document.activeElement),controlId,controlConnected:control?.isConnected??false,
        controlDisabled:control?.disabled??null,controlRect,controlCenterHit:identify(center),
        controlCenterOnTarget:Boolean(control&&center&&(center===control||control.contains(center)))};
    };
    const evidence={events:[],initial:state(),state,active:true,seen:0,omitted:0,eventBytes:0,
      types:['pointerdown','pointerup','mousedown','mouseup','click'],frames:new Set(),scheduledFrames:false,
      limits:{events:32,event_bytes:11264,output_bytes:16384,frame_snapshots:2}};
    const retain=event=>{
      if(!evidence.active)return;
      evidence.seen++;
      const bytes=new TextEncoder().encode(JSON.stringify(event)).length;
      if(evidence.events.length>=32||evidence.eventBytes+bytes>11264){evidence.omitted++;return;}
      evidence.eventBytes+=bytes;evidence.events.push(event);
    };
    const frameSnapshots=()=>{
      if(evidence.scheduledFrames)return;
      evidence.scheduledFrames=true;let count=0;
      const schedule=()=>{
        if(!evidence.active)return;
        const handle=requestAnimationFrame(()=>{
          evidence.frames.delete(handle);if(!evidence.active)return;
          retain({phase:'after native click animation frame',frame:++count,at:performance.now(),state:state()});
          if(count<2)schedule();
        });
        evidence.frames.add(handle);
      };schedule();
    };
    const listener=event=>{
      if(!evidence.active)return;
      retain({phase:'document capture before target/default completion',type:event.type,
        trusted:event.isTrusted,cancelledAtCapture:event.defaultPrevented,
        pointerType:event.pointerType??null,button:event.button,clientX:event.clientX,clientY:event.clientY,
        target:identify(event.target),targetRect:rect(event.target instanceof Element?event.target:null),
        intendedNextInPath:event.composedPath().includes(next),
        intendedControlInPath:event.composedPath().includes(control),
        hitAtEventPoint:identify(document.elementFromPoint(event.clientX,event.clientY)),state:state()});
      if(controlId==='play'&&event.type==='click'){
        queueMicrotask(()=>{if(evidence.active)retain({phase:'after native click dispatch',
          type:event.type,trusted:event.isTrusted,defaultPrevented:event.defaultPrevented,
          at:performance.now(),state:state()});});
        frameSnapshots();
      }
    };
    evidence.listener=listener;
    const visibility=event=>retain({phase:'document visibility change',type:event.type,
      trusted:event.isTrusted,at:performance.now(),state:state()});
    const ready=controlId==='play'?new MutationObserver(()=>retain({
      phase:'exhibit readiness attribute',at:performance.now(),state:state()})):null;
    for(const type of evidence.types)document.addEventListener(type,listener,{capture:true,passive:true});
    if(controlId==='play'){
      document.addEventListener('visibilitychange',visibility,{capture:true,passive:true});
      ready.observe(document,{attributes:true,subtree:true,attributeFilter:['data-exhibit-ready']});
    }
    evidence.stop=()=>{
      let after;
      try{after=state();}
      finally{
        evidence.active=false;
        for(const type of evidence.types)document.removeEventListener(type,listener,true);
        document.removeEventListener('visibilitychange',visibility,true);ready?.disconnect();
        for(const handle of evidence.frames)cancelAnimationFrame(handle);
        evidence.frames.clear();
      }
      return {initial:evidence.initial,events:evidence.events,after,
        controlId,seen:evidence.seen,omitted:evidence.omitted,eventBytes:evidence.eventBytes,
        activeFrameCallbacksAfterStop:evidence.frames.size,limits:evidence.limits};
    };
    window.__atlasSurveyActivation=evidence;
  },controlId);
}

export async function finishSurveyActivation(t,page,label){
  const evidence=await boundedDiagnosticRead(()=>page.evaluate(()=>{
    const evidence=window.__atlasSurveyActivation;
    if(!evidence?.stop)throw new Error('The activation diagnostic owner is unavailable');
    try{return evidence.stop();}finally{delete window.__atlasSurveyActivation;}
  }),'Activation diagnostic collection');
  const text=JSON.stringify({label,...evidence});
  if(Buffer.byteLength(text,'utf8')>16384)throw new Error('Activation diagnostic exceeded16384bytes');
  t.diagnostic('SURVEY_NATIVE_ACTIVATION '+text);
  return evidence;
}

// Observe the original Play call and clock assertion even if preparation fails.
// A collection error remains separate and cannot replace the original error.
export async function withPlaybackStartDiagnostics(t,page,action){
  let original=null,collectionError=null,result,failed=false,collectionFailed=false;
  try{await boundedDiagnosticRead(()=>beginSurveyActivation(page,{controlId:'play'}),
    'Playback diagnostic preparation');}
  catch(error){collectionFailed=true;collectionError=error;}
  try{result=await action();}
  catch(error){failed=true;original=error;}
  try{await finishSurveyActivation(t,page,'original replay playback start');}
  catch(error){if(!collectionFailed)collectionError=error;collectionFailed=true;}
  try{
    if(collectionFailed)t.diagnostic('SURVEY_PLAYBACK_START_COLLECTION_FAILURE '+JSON.stringify({
      original:failed?smallError(original):null,collection:smallError(collectionError),
      scope:'The original action ran once. Diagnostic collection is not a replacement clock observation.'}));
  }finally{
    if(failed)throw original;
    if(collectionFailed)throw collectionError;
  }
  return result;
}
