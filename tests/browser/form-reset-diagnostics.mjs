// Bounded passive input evidence for the existing Form reset journey.
export async function observeFormResetPassively(t,page,{width}){
 const prefix='ATLAS_FORM_RESET_EVENT ',output='ATLAS_FORM_RESET_DIAGNOSTIC ';
 const rows=[];let seen=0,evicted=0,invalid=0,bytes=0;
 const keep=row=>{
  seen++;const value={received_ms:Date.now(),...row},size=Buffer.byteLength(JSON.stringify(value),'utf8');
  if(size>8192){invalid++;return;}
  rows.push(value);bytes+=size;
  while(rows.length>24||bytes>49152){bytes-=Buffer.byteLength(JSON.stringify(rows.shift()),'utf8');evicted++;}
 };
 const consoleRow=entry=>{const text=entry.text();if(!text.startsWith(prefix))return;
  if(Buffer.byteLength(text,'utf8')>8192){invalid++;return;}
  try{keep(JSON.parse(text.slice(prefix.length)));}catch{invalid++;}
 };
 const pageError=error=>keep({kind:'pageerror',name:String(error.name).slice(0,64),message:String(error.message).slice(0,1024)});
 page.on('console',consoleRow);page.on('pageerror',pageError);
 await page.addInitScript(({prefix})=>{
  const log=console.debug.bind(console),controlIds=['condensation','azimuth','elevation','distance'];
  const inputIds=new Set([...controlIds,'shape','quality','dust','sequence-enabled','sequence-coverage','sequence-rate','sequence-time','lab-event']);
  const describe=node=>node===window?{tag:'WINDOW'}:node===document?{tag:'DOCUMENT'}:node?.nodeType===1?
   {tag:node.tagName,id:String(node.id||'').slice(0,80),class:String(node.getAttribute('class')||'').slice(0,80),type:String(node.getAttribute('type')||'').slice(0,32)}:null;
  const rect=node=>{if(!node?.getBoundingClientRect)return null;const r=node.getBoundingClientRect(),round=value=>Math.round(value*1000)/1000;return {x:round(r.x),y:round(r.y),width:round(r.width),height:round(r.height)};};
  const value=id=>{const node=document.getElementById(id);return node?{value:node.value,checked:typeof node.checked==='boolean'?node.checked:null,disabled:node.disabled??null}:null;};
  const text=id=>document.getElementById(id)?.textContent?.slice(0,240)??null;
  const state=()=>{
   const reset=document.getElementById('reset-view'),image=document.getElementById('lab-reference-image'),reference=document.getElementById('lab-reference-evidence');
   let historyState;try{const raw=JSON.stringify(history.state);historyState={json:raw?.slice(0,1024)??null,truncated:raw?.length>1024};}catch{historyState={unavailable:true};}
   const motion=text('motion'),style=reset?getComputedStyle(reset):null;
   return {time_origin:performance.timeOrigin,at:performance.now(),path:location.pathname,search:location.search.slice(0,1536),hash:location.hash.slice(0,160),
    params:[...new URLSearchParams(location.search)].slice(0,24).map(([key,v])=>[key.slice(0,64),v.slice(0,128)]),history:{length:history.length,state:historyState},
    viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY},visibility:document.visibilityState,hidden:document.hidden,focus:describe(document.activeElement),
    views:Object.fromEntries(controlIds.map(id=>[id,value(id)])),shape:value('shape'),quality:value('quality'),dust:value('dust'),
    sequence:{position:value('sequence-time'),enabled:value('sequence-enabled'),coverage:value('sequence-coverage'),rate:value('sequence-rate'),progress:text('sequence-progress'),stage:text('sequence-stage'),
     motion,displayed_running:motion==='Pause motion',motion_disabled:document.getElementById('motion')?.disabled??null,status:text('motion-status')},
    event:document.getElementById('lab-event')?.value??null,experiment_ready:document.getElementById('lab-context')?.dataset.experimentReady??null,
    geometry:{reset:rect(reset),scene:rect(document.getElementById('scene')),reference:rect(document.getElementById('lab-context')),evidence:rect(reference),image:rect(image)},
    font:{status:document.fonts?.status??null,reset_family:style?.fontFamily?.slice(0,160)??null,reset_size:style?.fontSize??null},
    reference:{state:reference?.dataset.state??null,event:reference?.dataset.event??null,busy:reference?.getAttribute('aria-busy')??null,
     image_present:Boolean(image),image_complete:image?.complete??null,width:image?.naturalWidth??null,height:image?.naturalHeight??null,hidden:image?.hidden??null,src:image?.currentSrc?.slice(0,192)??null}};
  };
  const emit=(kind,event,phase)=>{
   try{
    const x=Number.isFinite(event?.clientX)?event.clientX:null,y=Number.isFinite(event?.clientY)?event.clientY:null;
    log(prefix+JSON.stringify({kind,phase,event_phase:event?.eventPhase??null,trusted:event?.isTrusted??null,default_prevented:event?.defaultPrevented??null,
     button:event?.button??null,buttons:event?.buttons??null,pointer_type:event?.pointerType??null,pointer_id:event?.pointerId??null,detail:event?.detail??null,
     persisted:event?.persisted??null,point:x===null?null:{x,y},target:describe(event?.target),target_geometry:rect(event?.target),
     path:event?.composedPath?.().slice(0,7).map(describe)??[],hit:x===null?null:describe(document.elementFromPoint(x,y)),state:state()}));
   }catch(error){log(prefix+JSON.stringify({kind:'observer_error',message:String(error.message).slice(0,512)}));}
  };
  for(const type of ['pointerdown','pointerup','mousedown','mouseup','click']){
   document.addEventListener(type,event=>emit(type,event,'document-capture-before-target'),{capture:true,passive:true});
   document.addEventListener(type,event=>emit(type,event,'document-bubble-after-target'),{passive:true});
  }
  for(const type of ['input','change']){
   document.addEventListener(type,event=>{if(inputIds.has(event.target?.id))emit(type,event,'document-capture-before-target');},{capture:true,passive:true});
   document.addEventListener(type,event=>{if(inputIds.has(event.target?.id))emit(type,event,'document-bubble-after-target');},{passive:true});
  }
  for(const type of ['popstate','pageshow','pagehide'])window.addEventListener(type,event=>emit(type,event,'window-listener'),{passive:true});
  document.addEventListener('visibilitychange',event=>emit('visibilitychange',event,'document-listener'),{passive:true});
  for(const type of ['loading','loadingdone','loadingerror'])document.fonts?.addEventListener(type,event=>emit('fonts-'+type,event,'font-listener'),{passive:true});
  Object.defineProperty(window,'__atlasFormResetPassiveState',{value:state,configurable:true});
 },{prefix});
 return {async report(originalFailed,originalError){
  try{
   if(!originalFailed)return;
   let timer,final;
   try{final=await Promise.race([page.evaluate(()=>window.__atlasFormResetPassiveState?.()??{observer_unavailable:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Post-assertion diagnostic snapshot exceeded500ms')),500);})]);}
   finally{clearTimeout(timer);}
   const payload={schema:'atlas-form-reset-passive-diagnostic-v1',width,original_body:originalFailed?'failed':'completed',
    original_error:originalFailed?{name:String(originalError?.name??typeof originalError).slice(0,64),message:String(originalError?.message??originalError).slice(0,2048)}:null,
    limits:{events:24,ring_bytes:49152,row_bytes:8192,diagnostic_bytes:65536},seen,evicted,invalid,rows,final,
    scope:'Passive document capture and document bubble observations, not post-dispatch microtasks. displayed_running is a button-text observation, not access to private module clock state. Layout reads may affect timing. Original assertions and immediate reset-click checks are unchanged.'};
   let encoded=output+JSON.stringify(payload);
   while(Buffer.byteLength(encoded,'utf8')+1>65536&&rows.length){rows.shift();payload.evicted=++evicted;encoded=output+JSON.stringify(payload);}
   if(Buffer.byteLength(encoded,'utf8')+1>65536)throw Error('The bounded diagnostic cannot fit its fixed65536byte limit');
   t.diagnostic(encoded);
  }catch(error){
   try{t.diagnostic(output+JSON.stringify({width,diagnostic_failure:String(error.message).slice(0,1024),original_body:originalFailed?'failed':'completed'}));}catch{}
   if(!originalFailed)throw error;
  }finally{page.off('console',consoleRow);page.off('pageerror',pageError);}
 }};
}
