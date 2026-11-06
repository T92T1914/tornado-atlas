import {createHash} from 'node:crypto';

const PREFIX='ATLAS_MAP_RASTER_FAILURE ',MAX_BYTES=16384;
const short=value=>typeof value==='string'?value.slice(0,256):null;
const finite=value=>Number.isFinite(value)?value:null;
const tuple=(value,n)=>Array.isArray(value)?Array.from({length:n},(_,i)=>finite(value[i])):null;
const rect=value=>value&&typeof value==='object'?Object.fromEntries(['x','y','width','height','top','right','bottom','left'].map(k=>[k,finite(value[k])])):null;
const errorRecord=error=>{try{return {name:short(error?.name)??typeof error,message:short(error?.message)??short(String(error))};}catch{return {name:'unreadable',message:'Error details unavailable'};}};
const digest=text=>createHash('sha256').update(text).digest('hex');
const cleanupRecord=value=>value==='closed'||value==='not-needed'?value:value&&typeof value==='object'?{status:'unconfirmed',error:errorRecord(value.error)}:null;
const nodeRecord=value=>value&&typeof value==='object'?{
 present:value.present===true,rect:rect(value.rect),client:tuple(value.client,2),viewBox:short(value.viewBox),class:short(value.class),
 display:short(value.display),visibility:short(value.visibility),hidden:typeof value.hidden==='boolean'?value.hidden:null,
 details:Array.isArray(value.details)?value.details.slice(0,8).map(v=>({id:short(v?.id),open:v?.open===true})):[],
 details_omitted:Math.max(0,(Array.isArray(value.details)?value.details.length:0)-8)
}:null;

function providerRecord(provider){
 const exports=Array.isArray(provider?.exports)?provider.exports:[],images=Array.isArray(provider?.images)?provider.images:[];
 const rows=[];
 for(const row of exports.slice(0,8)){
  if(!row||typeof row!=='object'){rows.push({invalid:true});continue;}
  rows.push({url:short(row.url),url_truncated:typeof row.url==='string'&&row.url.length>256,
   url_sha256:typeof row.url==='string'?digest(row.url):null,href:short(row.href),size:tuple(row.size,2),bbox:tuple(row.bbox,4),
   status:finite(row.status),extent:row.extent&&typeof row.extent==='object'?Object.fromEntries(['xmin','ymin','xmax','ymax'].map(k=>[k,finite(row.extent[k])])):null});
 }
 return {exports:{count:exports.length,rows,omitted:Math.max(0,exports.length-rows.length)},
  images:{count:images.length,rows:images.slice(0,8).map(v=>({href:short(v),truncated:typeof v==='string'&&v.length>256,sha256:typeof v==='string'?digest(v):null})),omitted:Math.max(0,images.length-8)}};
}
function observedRecord(value){
 if(!value||typeof value!=='object')return null;
 const images=Array.isArray(value.images)?value.images:[];
 return {
  ready:short(value.ready),exhibitReady:short(value.exhibitReady),readyState:short(value.readyState),path:short(value.path),hash:short(value.hash),
  scroll:tuple(value.scroll,2),viewport:tuple(value.viewport,2),dpr:finite(value.dpr),
  path_node:nodeRecord(value.path_node),map:nodeRecord(value.map),select:nodeRecord(value.select),selected_mode:short(value.selected_mode),
  image_count:finite(value.image_count),images:images.slice(0,2).map(v=>({href:short(v?.href),style:short(v?.style),visibility:short(v?.visibility),
   display:short(v?.display),x:short(v?.x),y:short(v?.y),width:short(v?.width),height:short(v?.height),rect:rect(v?.rect)})),
  images_omitted:Math.max(0,(finite(value.image_count)??images.length)-Math.min(images.length,2)),
  status:short(value.status),source_text:short(value.source_text),source_href:short(value.source_href),
  source_hidden:typeof value.source_hidden==='boolean'?value.source_hidden:null,enhancement_error:short(value.enhancement_error)
 };
}

// Only named, bounded diagnostic fields survive. Cycles and unrelated page data
// cannot become a general DOM, account, response-body or environment dump.
export function boundedMapFailureRecord({caseName,mapId,original,observed,provider,snapshotFailure=null,cleanup=null}){
 const record={schema:'atlas-map-raster-failure-v1',phase:'original-displayed-wait',case:short(caseName),map_id:short(mapId),
  original_error:errorRecord(original),observed:observedRecord(observed),provider:providerRecord(provider),
  snapshot_failure:snapshotFailure?errorRecord(snapshotFailure):null,owned_context_cleanup:cleanupRecord(cleanup),
  limits:{snapshot_ms:500,cleanup_ms:500,json_record_bytes:MAX_BYTES,provider_rows:8,image_rows:2,field_characters:256},
  scope:'One failure-time observation after the unchanged original assertion. No retry, forced refresh, extra scroll, readiness change or causal repair.'};
 const encode=()=>JSON.stringify(record);
 let json=encode();
 for(const key of ['exports','images']){
  while(Buffer.byteLength(PREFIX+json+'\n','utf8')>MAX_BYTES&&record.provider[key].rows.length){
   record.provider[key].rows.pop();record.provider[key].omitted++;json=encode();
  }
 }
 while(Buffer.byteLength(PREFIX+json+'\n','utf8')>MAX_BYTES&&record.observed?.images?.length){
  record.observed.images.pop();record.observed.images_omitted++;json=encode();
 }
 if(Buffer.byteLength(PREFIX+json+'\n','utf8')>MAX_BYTES){record.observed=null;record.observation_omitted='Encoded observation exceeded the fixed limit';json=encode();}
 if(Buffer.byteLength(PREFIX+json+'\n','utf8')>MAX_BYTES)throw Error('Map diagnostic exceeds16KiB');
 return json;
}
async function bounded(call,label,clock){
 let timer;
 try{return await Promise.race([Promise.resolve().then(call),new Promise((_,reject)=>{timer=clock.set(()=>reject(Error(label)),500);})]);}
 finally{clock.clear(timer);}
}

// Called only by the catch around the original displayed() wait. Diagnostic
// failures are separately reported and never escape to replace that Error.
export async function reportMapRasterFailure(t,page,{mapId,provider},original,dependencies={}){
 const clock={set:dependencies.setTimer??setTimeout,clear:dependencies.clearTimer??clearTimeout};
 let observed=null,snapshotFailure=null,cleanup='not-needed',json,emissionAttempted=false;
 try{
  if(!['map','survey-map'].includes(mapId))throw Error('Undeclared map diagnostic target');
  try{
   observed=await bounded(()=>page.evaluate(({mapId})=>{
    const short=value=>String(value??'').slice(0,256);
    const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return Object.fromEntries(['x','y','width','height','top','right','bottom','left'].map(k=>[k,r[k]]));};
    const describe=node=>{
     if(!node)return {present:false};
     const style=getComputedStyle(node),details=[];let ancestor=node.parentElement;
     while(ancestor&&details.length<9){if(ancestor.tagName==='DETAILS')details.push({id:short(ancestor.id),open:ancestor.open});ancestor=ancestor.parentElement;}
     return {present:true,rect:rect(node),client:[node.clientWidth,node.clientHeight],viewBox:node.getAttribute('viewBox'),class:node.getAttribute('class'),
      display:style.display,visibility:style.visibility,hidden:node.hidden??false,details};
    };
    const map=document.getElementById(mapId),select=document.getElementById(mapId+'-geography'),host=select?.closest('.geography-controls');
    const images=[...(map?.querySelectorAll('.basemap-layer image')??[])],source=host?[...host.querySelectorAll('a')].find(a=>a.textContent==='Open displayed reference image'):null;
    return {ready:document.body?.dataset.ready??null,exhibitReady:document.body?.dataset.exhibitReady??null,readyState:document.readyState,
     path:location.pathname,hash:location.hash,scroll:[scrollX,scrollY],viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,
     path_node:describe(document.getElementById('path')),map:describe(map),select:describe(select),selected_mode:select?.value??null,
     image_count:images.length,images:images.slice(0,2).map(img=>({href:short(img.getAttribute('href')),style:short(img.getAttribute('style')),visibility:getComputedStyle(img).visibility,
      display:getComputedStyle(img).display,x:img.getAttribute('x'),y:img.getAttribute('y'),width:img.getAttribute('width'),height:img.getAttribute('height'),rect:rect(img)})),
     status:short(host?.querySelector('[role="status"]')?.textContent),source_text:short(source?.textContent),source_href:short(source?.getAttribute('href')),
     source_hidden:source?.hidden??null,enhancement_error:short(document.getElementById('error')?.textContent)};
   },{mapId}),'Map DOM diagnostic exceeded500ms',clock);
  }catch(error){
   snapshotFailure=error;
   if(error?.message==='Map DOM diagnostic exceeded500ms'){
    try{await bounded(()=>page.context().close(),'Map diagnostic owned context closure unconfirmed after500ms',clock);cleanup='closed';}
    catch(closeError){cleanup={status:'unconfirmed',error:errorRecord(closeError)};}
   }
  }
  const input={caseName:t.name,mapId,original,observed,provider,snapshotFailure,cleanup};
  json=boundedMapFailureRecord(input);
  emissionAttempted=true;
  t.diagnostic(PREFIX+json);
 }catch(error){
  try{
   const fallback=JSON.stringify({schema:'atlas-map-raster-failure-v1',original_failure_retained:true,diagnostic_failure:errorRecord(error)});
   if(!emissionAttempted&&Buffer.byteLength(PREFIX+fallback+'\n','utf8')<=MAX_BYTES)t.diagnostic(PREFIX+fallback);
  }catch{}
 }
}
