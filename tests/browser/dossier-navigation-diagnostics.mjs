import {createHash} from 'node:crypto';

// Observe the original native hop without changing its click or wait deadline.
export async function inspectDossierHop(page,journey,{eventId='el-reno-2013',elementId='media-bohac-opening-film-still',expectedHref=null}={}){
 if(!['el-reno-2013','joplin-2011','blackwell-1955','tuscaloosa-birmingham-2011'].includes(eventId)||!/^[-a-z0-9]+$/.test(elementId))throw Error('Unknown owned diagnostic target');
 const archivePath=new RegExp('^/archive/(index\\.json|'+eventId+'-(?:history-)?[a-f0-9]+\\.json)$');
 const resources=[],events=[],tasks=new Set(),states=new WeakMap(),diagnosticErrors=[];
 let omitted=0,stopped=false,admissionFrozen=false;const started=Date.now(),elapsed=()=>Date.now()-started;
 const small=value=>String(value??'').slice(0,256);
 const route=value=>{const u=new URL(value);return small(u.pathname+u.search+u.hash);};
 const bounded=async action=>{let timer;try{return await Promise.race([action(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Diagnostic exceeded 500ms')),500);})]);}finally{clearTimeout(timer);}};
 const selected=req=>{const u=new URL(req.url());return u.origin===new URL(page.url()).origin&&archivePath.test(u.pathname);};
 const request=req=>{if(stopped||admissionFrozen||!selected(req))return;if(resources.length>=8){omitted++;return;}
  const row={path:small(new URL(req.url()).pathname),state:'requested',requested_ms:elapsed(),status:null,bytes:null,sha256:null,error:null};resources.push(row);states.set(req,row);};
 const failed=req=>{const row=states.get(req);if(!stopped&&row){row.state='failed';row.terminal_ms=elapsed();row.error=small(req.failure()?.errorText);}};
 const finished=req=>{const row=states.get(req);if(!stopped&&row){row.state='finished';row.terminal_ms=elapsed();}};
 const response=res=>{const row=states.get(res.request());if(!row||stopped)return;row.status=res.status();row.response_ms=elapsed();row.state='responded';
  const task=(async()=>{try{const body=await res.body();if(stopped)return;row.bytes=body.length;
   if(body.length<=262144){row.sha256=createHash('sha256').update(body).digest('hex');
    try{const value=JSON.parse(body.toString('utf8'));row.identity={id:small(value.id),schema:small(value.schema),current_dossier_sha256:small(value.current_dossier_sha256),events:Array.isArray(value.events)?value.events.map(e=>small(e.id)).slice(0,8):null};}
    catch{row.preview=body.toString('utf8').slice(0,256);}
   }else row.error='Body exceeds diagnostic hash bound';
   row.body_completed_ms=elapsed();
  }catch(error){if(!stopped){row.error=small(error.message);row.body_completed_ms=elapsed();}}})();tasks.add(task);task.finally(()=>tasks.delete(task));};
 const navigation=frame=>{if(!admissionFrozen&&frame===page.mainFrame()&&events.length<12)events.push({type:'commit',elapsed_ms:elapsed(),route:route(frame.url())});};
 const message=m=>{if(!admissionFrozen&&m.text().startsWith('ATLAS_DOSSIER_CLICK ')&&events.length<12){try{const text=m.text().slice(20);if(text.length>2048)throw Error('Click observation too large');events.push({...JSON.parse(text),elapsed_ms:elapsed()});}catch{omitted++;}}};
 page.on('request',request);page.on('requestfailed',failed);page.on('requestfinished',finished);page.on('response',response);page.on('framenavigated',navigation);page.on('console',message);
 let original=null,result,dom,journeyEndedMs,resourcesAtJourneyEnd;
 try{
  try{await bounded(()=>page.evaluate(()=>{
   const observe=event=>{const a=event.target instanceof Element?event.target.closest('a'):null;if(!a)return;const r=a.getBoundingClientRect();
    console.debug('ATLAS_DOSSIER_CLICK '+JSON.stringify({type:event.type,trusted:event.isTrusted,href:a.getAttribute('href')?.slice(0,256),text:a.textContent.slice(0,160),
     capture_phase_default_prevented:event.defaultPrevented,x:event.clientX,y:event.clientY,rect:[r.x,r.y,r.width,r.height],exhibit_ready:document.body.dataset.exhibitReady??null}));};
   document.addEventListener('click',observe,{capture:true,passive:true,once:true});
  }));}catch(error){diagnosticErrors.push({stage:'click_observer_setup',error:small(error.message)});}
  try{result=await journey();}catch(error){original=error;}
  admissionFrozen=true;journeyEndedMs=elapsed();resourcesAtJourneyEnd=resources.map(row=>({...row}));
  try{dom=await bounded(()=>page.evaluate(elementId=>{const node=document.getElementById(elementId),r=node?.getBoundingClientRect(),style=node?getComputedStyle(node):null;
   return {path:(location.pathname+location.search+location.hash).slice(0,256),title:document.title.slice(0,160),ready:document.readyState,
    body_ready:document.body.dataset.ready??null,exhibit_ready:document.body.dataset.exhibitReady??null,photo_viewer:document.body.dataset.photoViewer??null,photo_dialog_open:document.getElementById('photo-dialog')?.open??null,content:document.getElementById('content')?.textContent.slice(0,512)??null,
    target:node?{text:node.textContent.slice(0,256),hidden:node.hidden,display:style.display,visibility:style.visibility,rect:[r.x,r.y,r.width,r.height]}:null};},elementId));}
  catch(error){dom={unavailable:small(error.message)};}
  try{await bounded(()=>Promise.allSettled([...tasks]));}catch(error){diagnosticErrors.push({stage:'body_settle',error:small(error.message)});}
 }finally{
  stopped=true;page.off('request',request);page.off('requestfailed',failed);page.off('requestfinished',finished);page.off('response',response);page.off('framenavigated',navigation);page.off('console',message);
 }
 const diagnostic={expected:{event:eventId,element_id:elementId,route:expectedHref?route(expectedHref):null},original_error:original?{name:original.name,message:small(original.message)}:null,journey_ended_ms:journeyEndedMs,resources_at_journey_end:resourcesAtJourneyEnd,resources_after_diagnostic_settle:resources,events,omitted,pending_body_reads:tasks.size,dom,diagnostic_finished_ms:elapsed(),diagnostic_errors:diagnosticErrors,
  limits:{resource_rows:8,event_rows:12,body_hash_bytes:262144,diagnostic_operation_ms:500},body_limit_kind:'post-buffer diagnostic hash bound',cleanup:'Node listeners removed; document observer and pending reads retire with the owned fixture context'};
 console.log('ATLAS_DOSSIER_HOP '+JSON.stringify(diagnostic));
 if(original){
  // Keep the deciding state with node:test's final failure summary as well as
  // the live log. The original error and its deadline remain unchanged.
  try{original.atlasDossierHop=diagnostic;}catch{}
  throw original;
 }
 return result;
}
