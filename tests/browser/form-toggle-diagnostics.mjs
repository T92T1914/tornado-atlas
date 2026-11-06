const FAILURE_PREFIX='ATLAS_FORM_TOGGLE_FAILURE ';
const MAX_JSON_BYTES=8192-Buffer.byteLength(FAILURE_PREFIX,'utf8')-1;

// Bound the encoded JSON, including escaping, without altering the Error that
// the maintained native action rethrows. This is diagnostic output only.
export function boundedFormToggleFailure(record){
 const encode=()=>{
  try{return JSON.stringify(record);}
  catch{record.observed=null;record.observation_omitted='The DOM observation could not be encoded';return JSON.stringify(record);}
 };
 let json=encode();
 while(Buffer.byteLength(json,'utf8')>MAX_JSON_BYTES&&record.observed?.rows?.length){
  record.observed.rows.splice(record.observed.rows.length>2?1:0,1);record.observed.omitted++;json=encode();
 }
 if(Buffer.byteLength(json,'utf8')>MAX_JSON_BYTES){record.observed=null;record.observation_omitted='The bounded final record could not retain the DOM payload';json=encode();}
 for(const [owner,key] of [[record.original_error,'stack'],[record,'diagnostic_error'],[record.original_error,'message'],[record,'phase'],[record,'scope'],[record.original_error,'name']]){
  while(Buffer.byteLength(json,'utf8')>MAX_JSON_BYTES&&typeof owner?.[key]==='string'&&owner[key].length){owner[key]=owner[key].slice(0,Math.floor(owner[key].length/2));json=encode();}
 }
 if(Buffer.byteLength(json,'utf8')>MAX_JSON_BYTES)return JSON.stringify({schema:'atlas-first-form-toggle-observation-v1',cleanup:record.cleanup==='listeners-retired'?'listeners-retired':'unconfirmed',observation_omitted:'The encoded diagnostic exceeded its limit. The original failure remains in TAP.'});
 return json;
}

export function observeFirstFormToggle(page){
 return {async install(){
 await page.evaluate(()=>{
  const key='__atlasFirstFormToggleObservation',rows=[],listeners=[];let omitted=0;
  const short=(value,max=48)=>String(value??'').slice(0,max);
  const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*1000)/1000);};
  const identity=node=>node instanceof Element?[short(node.tagName,16),short(node.id)]:null;
  const reference=()=>{
   const host=document.getElementById('lab-reference-evidence'),image=document.getElementById('lab-reference-image');
   return {stage:short(host?.dataset.state,24),event:short(host?.dataset.event),media:short(host?.dataset.mediaId),hidden:host?.hidden??null,busy:host?.getAttribute('aria-busy')??null,
    image:image?{hidden:image.hidden,complete:image.complete,width:image.naturalWidth,height:image.naturalHeight,rect:rect(image),source:image.currentSrc?.startsWith('blob:')?'blob':image.currentSrc?'other':'none'}:null};
  };
  const state=()=>{const box=document.getElementById('sequence-enabled');return {checked:box?.checked??null,rect:rect(box),active:short(document.activeElement?.id),scroll:[scrollX,scrollY],reference:reference()};};
  const observe=(phase,event)=>{
   if(rows.length>=12){omitted++;return;}
   try{
    const point=Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)?[event.clientX,event.clientY]:null;
    rows.push({phase,type:event.type,ms:Math.round(performance.now()*1000)/1000,target:identity(event.target),targetRect:rect(event.target instanceof Element?event.target:null),trusted:event.isTrusted,defaultPrevented:event.defaultPrevented,
     point,hit:point?identity(document.elementFromPoint(...point)):null,...state()});
   }catch(error){rows.push({phase,type:event.type,observationError:short(error.message,160)});}
  };
  for(const type of ['pointerdown','pointerup','click','input','change'])for(const capture of [true,false]){
   const callback=event=>observe(capture?'window-capture':'window-bubble',event);
   window.addEventListener(type,callback,{capture,passive:true});listeners.push([type,callback,capture]);
  }
  window[key]={read(){return {rows:rows.map(row=>({...row})),omitted,final:state(),viewport:[innerWidth,innerHeight],route:(location.pathname+location.search+location.hash).slice(0,256)};},retire(){for(const[type,callback,capture]of listeners)window.removeEventListener(type,callback,capture);listeners.length=0;}};
 });
 },async finish(original,phase){
  let observed=null,diagnosticError=null,timer;
  try{
   observed=await Promise.race([
    page.evaluate(failed=>{
     const key='__atlasFirstFormToggleObservation',observer=window[key];
     if(!observer)throw Error('First-toggle observer is unavailable');
     try{return failed?observer.read():null;}
     finally{observer.retire();delete window[key];}
    },Boolean(original)),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('First-toggle observation or cleanup was not confirmed within750ms')),750);})
   ]);
  }catch(error){diagnosticError=error;}
  finally{clearTimeout(timer);}
  if(original||diagnosticError){
   const error=original??diagnosticError;
   const prefix='ATLAS_FORM_TOGGLE_FAILURE ',maxJSON=8192-Buffer.byteLength(prefix,'utf8')-1;
   const record={schema:'atlas-first-form-toggle-observation-v1',phase,original_error:{name:String(error.name).slice(0,64),message:String(error.message).slice(0,768),stack:String(error.stack??'').slice(0,768)},
    observed,cleanup:diagnosticError?'unconfirmed':'listeners-retired',diagnostic_error:diagnosticError?String(diagnosticError.message).slice(0,256):null,
    limits:{event_rows:12,total_record_bytes:8192,json_bytes:maxJSON,read_and_cleanup_ms:750},scope:'Passive capture/bubble event and DOM observations around the original native uncheck. A bubble observation is not a universal end-of-dispatch claim. Reads may affect scheduling. No retry, source change, image-ready wait, synthetic setter or causal repair is implied.'};
   console.error(prefix+boundedFormToggleFailure(record));
   if(!original)throw diagnosticError;
  }
 }};
}
