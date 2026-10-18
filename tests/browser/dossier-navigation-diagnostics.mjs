import {createHash} from 'node:crypto';

// Start before the first document so Back restoration and non-anchor inputs
// remain observable. These listeners neither perform input nor await readiness.
export async function beginBohacSourceDiagnostics(page,t){
 const rows=[],inputs=new Map();let omitted=0,stopped=false,setupError=null;
 const prefix='ATLAS_DOSSIER_NATIVE ';
 const message=message=>{
  if(stopped||!message.text().startsWith(prefix))return;
  const text=message.text().slice(prefix.length);if(text.length>6144){omitted++;return;}
  try{
   const row=JSON.parse(text);
   if(!row||!['input','after_dispatch','lifecycle','geometry'].includes(row.kind)||!Number.isInteger(row.sequence)||row.sequence<0
    ||!Number.isFinite(row.document_time_origin)||!Number.isFinite(row.document_ms)||typeof row.route!=='string'||row.route.length>256
    ||!Number.isFinite(row.scroll_y)||(row.exhibit_ready!==null&&(typeof row.exhibit_ready!=='string'||row.exhibit_ready.length>256)))throw Error('Unexpected native diagnostic shape');
   const key=row.document_time_origin+':'+row.sequence;
   if(row.kind==='after_dispatch'){
    const input=inputs.get(key);if(input)input.post_dispatch={...row,status:'observed'};else omitted++;
    return;
   }
   if(rows.length>=64){const [old]=rows.splice(32,1);if(old.kind==='input')inputs.delete(old.document_time_origin+':'+old.sequence);omitted++;}
   if(row.kind==='input'){row.post_dispatch={status:'unobserved'};inputs.set(key,row);}
   rows.push(row);
  }catch{omitted++;}
 };
 const dispose=()=>{if(stopped)return;stopped=true;page.off('console',message);page.off('close',dispose);};
 page.on('console',message);page.once('close',dispose);t.after(dispose);
 try{await page.addInitScript(()=>{
  const prefix='ATLAS_DOSSIER_NATIVE ',small=value=>String(value??'').slice(0,256);
  const identify=node=>node instanceof Element?{tag:node.tagName.slice(0,32),id:node.id.slice(0,96)}:null;
  const state=()=>({document_time_origin:performance.timeOrigin,document_ms:performance.now(),
   route:small(location.pathname+location.search+location.hash),scroll_y:scrollY,
   ready_state:document.readyState,exhibit_ready:document.body?.dataset.exhibitReady?.slice(0,256)??null});
  let sequence=0,inputLifecycleRows=0,geometryRows=0,lastReady=null;
  const emit=row=>console.debug(prefix+JSON.stringify(row));
  const lifecycle=(type,event=null)=>{
   if(inputLifecycleRows>=16)return;inputLifecycleRows++;
   emit({kind:'lifecycle',sequence:sequence++,type,trusted:event?.isTrusted??null,
    persisted:typeof event?.persisted==='boolean'?event.persisted:null,...state()});
  };
  const geometry=(type,inputSequence,x=null,y=null)=>{
   if(geometryRows>=8)return;geometryRows++;
   const intended=document.querySelector('#bohac-film-reading .source-record-link'),r=intended?.getBoundingClientRect();
   const hit=Number.isFinite(x)&&Number.isFinite(y)?document.elementFromPoint(x,y):null;
   const center=r?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2):null;
   emit({kind:'geometry',sequence:sequence++,type,input_sequence:inputSequence,
    intended_href:intended?.getAttribute('href')?.slice(0,256)??null,
    intended_rects:intended?[...intended.getClientRects()].slice(0,4).map(r=>[r.x,r.y,r.width,r.height]):[],
    intended_bounds:r?[r.x,r.y,r.width,r.height]:null,
    point:[x,y],hit:identify(hit),hit_is_intended:Boolean(intended&&(hit===intended||intended.contains(hit))),
    center_hit:identify(center),center_is_intended:Boolean(intended&&(center===intended||intended.contains(center))),...state()});
  };
  const input=event=>{
   if(inputLifecycleRows>=16)return;inputLifecycleRows++;
   const id=sequence++,target=event.target instanceof Element?event.target:null,anchor=target?.closest('a');
   emit({kind:'input',sequence:id,type:event.type,trusted:event.isTrusted,
    point:[event.clientX,event.clientY],target:identify(target),anchor_href:anchor?.getAttribute('href')?.slice(0,256)??null,
    capture_default_prevented:event.defaultPrevented,...state()});
   geometry(event.type,id,event.clientX,event.clientY);
   // A separate task reads cancellation after propagation. Navigation may
   // retire it first, leaving the capture row's after-state unobserved.
   setTimeout(()=>emit({kind:'after_dispatch',sequence:id,type:event.type,
    default_prevented:event.defaultPrevented,...state()}),0);
  };
  for(const type of ['pointerdown','pointerup','click'])window.addEventListener(type,input,{capture:true,passive:true});
  for(const type of ['pageshow','pagehide','hashchange','popstate'])window.addEventListener(type,event=>lifecycle(type,event),{capture:true,passive:true});
  document.addEventListener('DOMContentLoaded',event=>lifecycle(event.type,event),{capture:true,passive:true,once:true});
  const ready=new MutationObserver(()=>{
   const value=document.body?.dataset.exhibitReady??null;
   if(value!==lastReady){lastReady=value;lifecycle('exhibit_ready_transition');}
   if(inputLifecycleRows>=16)ready.disconnect();
  });
  const body=new MutationObserver(()=>{if(document.body){body.disconnect();ready.observe(document.body,{attributes:true,attributeFilter:['data-exhibit-ready']});}});
  if(document.body)ready.observe(document.body,{attributes:true,attributeFilter:['data-exhibit-ready']});
  else body.observe(document,{childList:true,subtree:true});
  lifecycle('observer_initialized');
 });}catch(error){setupError=String(error.message).slice(0,256);}
 return {dispose,snapshot:()=>({rows:JSON.parse(JSON.stringify(rows)),omitted,setup_error:setupError,
  limits:{node_history_rows:64,document_input_lifecycle_rows:16,document_geometry_rows:8,intended_client_rects:4,payload_characters:6144},
  cleanup:'Node listeners retire on fixture page closure; passive document listeners and diagnostic tasks retire with the owned context',
  unobserved:'An absent after-state or scroll record does not establish that cancellation or scrolling did not occur'})};
}

// Observe the original native hop without changing its click or wait deadline.
export async function inspectDossierHop(page,journey,{eventId='el-reno-2013',elementId='media-bohac-opening-film-still',expectedHref=null,navigationObserver=null}={}){
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
 const diagnostic={expected:{event:eventId,element_id:elementId,route:expectedHref?route(expectedHref):null},original_error:original?{name:original.name,message:small(original.message)}:null,journey_ended_ms:journeyEndedMs,resources_at_journey_end:resourcesAtJourneyEnd,resources_after_diagnostic_settle:resources,events,native_history:navigationObserver?.snapshot()??null,omitted,pending_body_reads:tasks.size,dom,diagnostic_finished_ms:elapsed(),diagnostic_errors:diagnosticErrors,
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
