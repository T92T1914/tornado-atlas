// A later assessment supplies reading context, not an observation on this clock.
import {validateDossierReference} from './dossier-file-model.mjs';
const text=value=>typeof value==='string'&&value.trim();
const id=value=>typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const requireValue=(value,message)=>{if(!value)throw Error(message);};
function keys(value,expected){requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===expected.sort().join('|'),'Unsupported chronology reading context fields.');}
export function validateReadingContext(data,eventId){
  const context=data.reading_context;
  keys(context,['event_id','reference','observations','associations','navigation_basis']);
  keys(context.reference,['file','dossier_sha256','file_sha256']);
  validateDossierReference(context.reference,eventId);
  requireValue(context.event_id===eventId&&text(context.navigation_basis),'Invalid reading event association.');
  requireValue(['file','dossier_sha256','file_sha256'].every(key=>context.reference[key]===data.radar_context?.reference[key]),'Reading context must reuse the retained radar dossier.');
  const entries=new Set(data.entries.map(row=>row.id)),sources=new Set(data.sources.map(row=>row.id));
  requireValue(Array.isArray(context.observations)&&context.observations.length>0&&context.observations.length<=32,'Reading context needs bounded declared observations.');
  const observations=new Set();
  for(const row of context.observations){
    keys(row,['id','source_id','report_page','documentary_anchor']);
    requireValue(id(row.id)&&!observations.has(row.id)&&sources.has(row.source_id)&&Number.isInteger(row.report_page)&&row.report_page>0&&id(row.documentary_anchor),'Invalid reading observation route.');
    observations.add(row.id);
  }
  requireValue(Array.isArray(context.associations)&&context.associations.length>0&&context.associations.length<=data.entries.length,'Invalid reading associations.');
  const seen=new Set(),used=new Set();
  for(const row of context.associations){
    keys(row,['entry_id','observation_ids']);
    requireValue(entries.has(row.entry_id)&&!seen.has(row.entry_id)&&Array.isArray(row.observation_ids)&&row.observation_ids.length>0&&new Set(row.observation_ids).size===row.observation_ids.length&&row.observation_ids.every(value=>observations.has(value)),'Reading context needs distinct known entry and observation IDs.');
    seen.add(row.entry_id);row.observation_ids.forEach(value=>used.add(value));
  }
  requireValue(used.size===observations.size,'Reading observations must have declared entry associations.');
  return context;
}
export function resolveReadingContext(data,verified){
  const context=validateReadingContext(data,data.event_id),doc=verified.dossier;
  requireValue(doc.id===data.event_id&&['file','dossier_sha256','file_sha256'].every(key=>verified.reference[key]===context.reference[key]),'Reading dossier association differs.');
  const expected={intake:'published',assertion:'source_reported',temporal:'unregistered',spatial:'unregistered',availability:'reviewed_available',rights:'links_only'};
  const records=context.observations.map(route=>{
    const observation=doc.observations.find(row=>row.id===route.id),source=doc.sources.find(row=>row.id===route.source_id),chronologySource=data.sources.find(row=>row.id===route.source_id);
    requireValue(observation?.source_id===route.source_id&&source&&source.url===chronologySource.url&&Object.keys(expected).every(key=>observation.status[key]===expected[key])&&['event','capture','video','alignment'].every(key=>observation.time[key]===null)&&observation.place.coordinates===null,'The retained reading record must remain qualified and unregistered.');
    requireValue(text(observation.title)&&text(observation.account)&&text(observation.limits),'The retained reading account and limits are required.');
    return Object.freeze({route,observation,source});
  });
  return Object.freeze({state:'available',reference:verified.reference,records,associations:context.associations,navigation_basis:context.navigation_basis});
}
export function readingForEntry(resolved,entryId){
  if(resolved?.state!=='available')return [];
  const association=resolved.associations.find(row=>row.entry_id===entryId);
  return association?association.observation_ids.map(id=>resolved.records.find(row=>row.observation.id===id)):[];
}
