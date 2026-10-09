import {validateDossierReference} from './dossier-file-model.mjs';
const text=value=>typeof value==='string'&&value.trim();
const requireValue=(value,message)=>{if(!value)throw Error(message);};
function keys(value,expected){requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===expected.sort().join('|'),'Unsupported radar context fields.');}
export function validateRadarContext(data,eventId){
  const context=data.radar_context;
  keys(context,['event_id','reference','media_id','snapshots','navigation_basis']);
  keys(context.reference,['file','dossier_sha256','file_sha256']);
  requireValue(context.event_id===eventId&&typeof context.media_id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(context.media_id)&&text(context.navigation_basis),'Invalid radar event association.');
  validateDossierReference(context.reference,eventId);
  requireValue(Array.isArray(context.snapshots)&&context.snapshots.length===7,'Radar context needs the seven complete figure labels.');
  const seen=new Set(),day=data.entries[0].utc.slice(0,10);let previous=-Infinity;
  for(const snapshot of context.snapshots){
    keys(snapshot,['id','utc','source_label']);
    const stamp=Date.parse(snapshot.utc),date=new Date(stamp);
    requireValue(typeof snapshot.utc==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|\+00:00)$/.test(snapshot.utc)&&Number.isFinite(stamp)&&date.toISOString().replace('.000Z','Z')===snapshot.utc.replace('+00:00','Z')&&snapshot.utc.slice(0,10)===day&&stamp>previous,'Radar labels require increasing source minutes.');
    const prefix=seen.size===0?new Intl.DateTimeFormat('en-US',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric'}).format(date)+': ':'';
    requireValue(snapshot.id==='radar-'+snapshot.utc.slice(11,16).replace(':','')&&!seen.has(snapshot.id)&&snapshot.source_label===prefix+snapshot.utc.slice(11,16).replace(':','')+' UTC','Invalid or duplicate radar source label.');
    seen.add(snapshot.id);previous=stamp;
  }
  return context;
}

export function resolveRadarContext(data,verified){
  const context=validateRadarContext(data,data.event_id),doc=verified.dossier;
  requireValue(doc.id===data.event_id&&['file','dossier_sha256','file_sha256'].every(key=>verified.reference[key]===context.reference[key]),'Radar dossier association differs.');
  const media=doc.media.find(row=>row.id===context.media_id);
  const expected={intake:'published',assertion:'source_reported',temporal:'source_label',spatial:'unregistered',availability:'reviewed_available',rights:'permitted_hosting'};
  requireValue(media?.kind==='radar'&&Object.keys(expected).every(key=>media.status[key]===expected[key])&&media.time.alignment===null&&media.time.video===null&&media.place.coordinates===null&&JSON.stringify(media.time.event)===JSON.stringify({reported:context.snapshots.map(row=>row.source_label)}),'The retained radar record does not support these source labels.');
  const transform=media.transformation;
  keys(transform,['recipe','asset','sha256','width','height','alt']);
  requireValue(text(transform.recipe)&&text(transform.alt)&&typeof transform.asset==='string'&&new RegExp(`^assets/${data.event_id}/[a-z0-9-]+\\.png$`).test(transform.asset)&&/^[a-f0-9]{64}$/.test(transform.sha256)&&['width','height'].every(key=>Number.isInteger(transform[key])&&transform[key]>0&&transform[key]<=4096),'Invalid complete radar figure identity.');
  const source=doc.sources.find(row=>row.id===media.source_id),creator=doc.creators.find(row=>row.id===media.roles.creator);
  requireValue(source&&creator,'Radar source and creator credit are required.');
  return Object.freeze({state:'available',reference:verified.reference,media,source,creator});
}

export function radarAt(data,seconds){
  const start=Date.parse(data.entries[0].utc),end=Date.parse(data.entries.at(-1).utc),stamp=start+seconds*1000;
  if(!Number.isFinite(seconds)||seconds<0||stamp>end)return null;
  const index=data.radar_context.snapshots.findLastIndex(row=>Date.parse(row.utc)<=stamp);
  return index<0?{index,snapshot:null,elapsedSeconds:null}:{index,snapshot:data.radar_context.snapshots[index],elapsedSeconds:(stamp-Date.parse(data.radar_context.snapshots[index].utc))/1000};
}
