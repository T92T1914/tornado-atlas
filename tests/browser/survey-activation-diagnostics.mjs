// Passive observations around one real Next activation. These do not perform
// input, wait for an outcome, change the page or replace acceptance assertions.
export async function beginSurveyActivation(page){
  await page.evaluate(()=>{
    const next=document.getElementById('survey-next');
    const identify=node=>node instanceof Element?{tag:node.tagName,id:node.id,
      class:node.getAttribute('class')?.slice(0,160)??null}:null;
    const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height};};
    const state=()=>({url:location.href,selection:document.getElementById('survey-observation')?.value,
      timeline:(document.getElementById('timeline')??document.getElementById('replay-time'))?.value,
      play:(document.getElementById('play')??document.getElementById('replay-play'))?.textContent,
      history:history.length,ready:document.body.dataset.exhibitReady??null,
      dialogOpen:document.getElementById('photo-dialog')?.open??null,
      nextConnected:next?.isConnected??false,nextDisabled:next?.disabled??null,
      nextRect:rect(next),scroll:{x:scrollX,y:scrollY},viewport:{width:innerWidth,height:innerHeight}});
    const evidence={events:[],initial:state(),state};
    const listener=event=>{
      if(evidence.events.length>=32)return;
      evidence.events.push({phase:'document capture before target/default completion',type:event.type,
        trusted:event.isTrusted,cancelledAtCapture:event.defaultPrevented,
        pointerType:event.pointerType??null,button:event.button,clientX:event.clientX,clientY:event.clientY,
        target:identify(event.target),targetRect:rect(event.target instanceof Element?event.target:null),
        intendedNextInPath:event.composedPath().includes(next),
        hitAtEventPoint:identify(document.elementFromPoint(event.clientX,event.clientY)),state:state()});
    };
    evidence.listener=listener;
    evidence.types=['pointerdown','pointerup','mousedown','mouseup','click'];
    for(const type of evidence.types)document.addEventListener(type,listener,{capture:true,passive:true});
    window.__atlasSurveyActivation=evidence;
  });
}

export async function finishSurveyActivation(t,page,label){
  const evidence=await page.evaluate(()=>{
    const evidence=window.__atlasSurveyActivation;
    for(const type of evidence.types)document.removeEventListener(type,evidence.listener,true);
    const result={initial:evidence.initial,events:evidence.events,after:evidence.state()};
    delete window.__atlasSurveyActivation;
    return result;
  });
  t.diagnostic('SURVEY_NATIVE_ACTIVATION '+JSON.stringify({label,...evidence}));
}
