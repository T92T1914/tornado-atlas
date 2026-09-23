import {validateChronology} from './chronology-model.mjs';
// The build validates the historical contract. The loader rejects mixed or
// incomplete publications before any bundle reaches the shared renderer.
const idPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const assetPattern=/^(?:[a-z0-9][a-z0-9-]*\/)*[a-z0-9][a-z0-9-]*\.(json|html)$/;
function requireValue(condition,message){if(!condition)throw new Error(message);}
function keys(value,names,label){requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===names.sort().join('|'),`Unsupported ${label} fields.`);}
export function selectEvent(index,requested=null){
  keys(index,['schema_version','default_event','events'],'event index');
  requireValue([1,2].includes(index.schema_version)&&Array.isArray(index.events)&&index.events.length,'Unsupported event index.');
  const seen=new Set();
  for(const row of index.events){
    keys(row,['id','title','documentary','replay',...(index.schema_version===2?['chronology']:[])],'event');
    requireValue(typeof row.id==='string'&&idPattern.test(row.id)&&!seen.has(row.id),'Invalid or duplicate event identity.');
    requireValue(typeof row.title==='string'&&row.title.trim()&&typeof row.documentary==='string'&&assetPattern.test(row.documentary)&&row.documentary.endsWith('.html'),'Invalid event description.');
    requireValue(row.replay===null||row.replay===`events/${row.id}.json`,'Replay path does not match the event.');
    requireValue(row.chronology==null||row.chronology===`events/${row.id}-chronology.json`,'Chronology path does not match the event.');
    requireValue(row.chronology==null||row.replay===null,'Combined chronology and replay synchronization is not supported yet.');
    seen.add(row.id);
  }
  requireValue(seen.has(index.default_event),'Default event is absent.');
  const event=index.events.find(row=>row.id===(requested===null?index.default_event:requested));
  requireValue(event,'This event is not in the reviewed replay index. Open the atlas to find its source records.');
  return event;
}
export function displayClock(timeZone){
  const formatter=new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'});
  return utc=>formatter.format(new Date(utc));
}
export function validatePackage(config,event){
  keys(config,['schema_version','event_id','bundle','bundle_sha256','clock','geography_source','coverage'],'replay');
  requireValue(config.schema_version===1&&config.event_id===event.id,'Replay identity or schema differs from the selected event.');
  requireValue(typeof config.bundle==='string'&&assetPattern.test(config.bundle)&&config.bundle.endsWith('.json'),'Invalid bundle path.');
  requireValue(typeof config.bundle_sha256==='string'&&/^[a-f0-9]{64}$/.test(config.bundle_sha256),'Missing bundle integrity record.');
  keys(config.clock,['start_utc','end_utc','time_zone','precision','basis'],'clock');
  const {start_utc:start,end_utc:end,time_zone:zone,precision,basis}=config.clock;
  const utc=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|\+00:00)$/.test(value)&&Number.isFinite(Date.parse(value));
  requireValue(utc(start)&&utc(end)&&Date.parse(start)<Date.parse(end)&&precision==='minute'&&typeof basis==='string'&&basis.trim(),'Unsupported historical clock coverage.');
  requireValue(typeof zone==='string'&&/^[A-Za-z_]+(?:\/[A-Za-z_+-]+)*$/.test(zone),'Invalid display time zone.');
  displayClock(zone); // Unknown IANA names fail here, including in CI's Node tests.
  keys(config.coverage,['positions','between_positions','camera','appearance'],'coverage');
  const coverage=config.coverage;
  requireValue(coverage.positions==='published_minute_samples'&&coverage.between_positions==='linear_longitude_latitude'&&coverage.camera==='free_orbit'&&coverage.appearance==='illustrative_symbol','Unsupported reconstruction coverage.');
  keys(config.geography_source,['url','sha256'],'geography source');
  requireValue(/^https:\/\//.test(config.geography_source.url)&&/^[a-f0-9]{64}$/.test(config.geography_source.sha256),'Missing geography provenance.');
  return config;
}
export async function loadEventPackage(requested=null,{fetcher=globalThis.fetch,subtle=globalThis.crypto?.subtle}={}){
  async function retrieve(path){
    let response;
    try{response=await fetcher(path,{cache:'no-cache'});}catch{throw new Error(`Could not load ${path}. Check the connection or open the documentary from the atlas.`);}
    requireValue(response.ok,`Could not load ${path}. The documentary remains available from the atlas.`);
    return response;
  }
  const index=await (await retrieve('events.json')).json(),event=selectEvent(index,requested);
  const chronology=event.chronology?validateChronology(await (await retrieve(event.chronology)).json(),event.id):null;
  if(event.replay===null)return {index,event,config:null,data:null,chronology};
  const config=validatePackage(await (await retrieve(event.replay)).json(),event);
  requireValue(subtle,'Bundle verification requires HTTPS or a localhost preview. The documentary remains available.');
  const bytes=await (await retrieve(config.bundle)).arrayBuffer();
  const hash=Array.from(new Uint8Array(await subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  requireValue(hash===config.bundle_sha256,'The replay and its evidence bundle are from different revisions. Reload after publication finishes.');
  const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  requireValue(data.exhibit?.id===event.id&&data.timeline_media?.event===event.id&&data.footage?.event===event.id,'Evidence identity differs from the selected event.');
  requireValue(Object.entries(config.geography_source).every(([key,value])=>data.geometry?.source?.[key]===value),'Geography provenance differs from the reviewed package.');
  const points=data.geometry.features.filter(f=>f.geometry.type==='Point');
  requireValue(points.length>=2&&Date.parse(points[0].properties.utc)===Date.parse(config.clock.start_utc)&&Date.parse(points.at(-1).properties.utc)===Date.parse(config.clock.end_utc),'Historical positions differ from the declared coverage.');
  return {index,event,config,data,chronology};
}
