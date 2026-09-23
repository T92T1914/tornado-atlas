// Source entries are discrete documentary records, never interpolated positions.
function requireValue(value, message){if(!value)throw new Error(message);}
function keys(value, expected){requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===expected.sort().join('|'),'Unsupported chronology fields.');}
const text=value=>typeof value==='string'&&value.trim();
export function validateChronology(data,eventId){
  keys(data,['schema_version','event_id','title','clock','sources','entries']);
  requireValue(data.schema_version===1&&data.event_id===eventId&&text(data.title),'Chronology schema or event identity differs.');
  keys(data.clock,['time_zone','precision','basis']);
  requireValue(data.clock.precision==='minute'&&text(data.clock.basis)&&typeof data.clock.time_zone==='string'&&/^[A-Za-z_]+(?:\/[A-Za-z_+-]+)*$/.test(data.clock.time_zone),'Unsupported documentary clock.');
  new Intl.DateTimeFormat('en-US',{timeZone:data.clock.time_zone});
  requireValue(Array.isArray(data.sources)&&data.sources.length,'Chronology needs sources.');
  const sources=new Set();
  for(const source of data.sources){
    keys(source,['id','title','url','archive','sha256']);
    requireValue(text(source.id)&&!sources.has(source.id)&&text(source.title),'Invalid chronology source.');
    let url;try{url=new URL(source.url);}catch{throw new Error('Invalid chronology source URL.');}
    requireValue(url.protocol==='https:'&&!url.username&&!url.password,'Invalid chronology source URL.');
    requireValue(typeof source.archive==='string'&&source.archive.startsWith(`exhibits/${eventId}/`)&&/^(?:[a-z0-9][a-z0-9-]*\/)+[a-z0-9][a-z0-9-]*\.pdf$/.test(source.archive)&&/^[a-f0-9]{64}$/.test(source.sha256),'Invalid chronology provenance.');
    sources.add(source.id);
  }
  requireValue(Array.isArray(data.entries)&&data.entries.length>=2,'Chronology needs two reviewed entries.');
  const seen=new Set();let previous=-Infinity;
  for(const entry of data.entries){
    keys(entry,['id','utc','source_time','precision','title','account','limits','source_id','page','locator']);
    requireValue(['id','source_time','title','account','limits','locator'].every(k=>text(entry[k]))&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)&&!seen.has(entry.id),'Invalid chronology entry.');
    const stamp=Date.parse(entry.utc);
    requireValue(typeof entry.utc==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|\+00:00)$/.test(entry.utc)&&Number.isFinite(stamp)&&new Date(stamp).toISOString().replace('.000Z','Z')===entry.utc.replace('+00:00','Z')&&stamp>previous,'Chronology entries require increasing minute timestamps.');
    requireValue(['reported_minute','approximate_minute'].includes(entry.precision)&&sources.has(entry.source_id)&&Number.isInteger(entry.page)&&entry.page>0,'Chronology entry lacks precision or source.');
    seen.add(entry.id);previous=stamp;
  }
  return data;
}
export function chronologyAt(data,seconds){
  const start=Date.parse(data.entries[0].utc),stamp=start+seconds*1000;
  if(!Number.isFinite(seconds)||seconds<0||stamp>Date.parse(data.entries.at(-1).utc))return null;
  const index=data.entries.findLastIndex(entry=>Date.parse(entry.utc)<=stamp);
  return {index,entry:data.entries[index],elapsedSeconds:(stamp-Date.parse(data.entries[index].utc))/1000};
}
