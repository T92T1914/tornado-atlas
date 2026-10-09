// Check the publisher's logical-to-file association, not source truth or authentication.
export const DOSSIER_FILE_LIMIT=200000,HISTORY_FILE_LIMIT=100000;
const hash=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const text=value=>typeof value==='string'&&value.length>0;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value);
const fail=message=>{throw Error(message+' No dossier evidence has been substituted.');};
const referenceError=()=>fail('The dossier file reference does not match this publication.');

export function validateDossierReference(reference,eventId){
  if(!object(reference)||typeof eventId!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eventId)||
    !hash(reference.dossier_sha256)||!hash(reference.file_sha256)||
    reference.file!==`archive/${eventId}-${reference.dossier_sha256.slice(0,20)}.json`)referenceError();
  return Object.freeze({event_id:eventId,file:reference.file,dossier_sha256:reference.dossier_sha256,file_sha256:reference.file_sha256});
}

export function validateArchiveReferences(index){
  if(!object(index)||index.schema_version!==1||!Array.isArray(index.events))referenceError();
  const seen=new Set();
  for(const event of index.events){
    validateDossierReference(event,event?.id);
    if(seen.has(event.id)||typeof event.history_file!=='string'||
      !new RegExp(`^archive/${event.id}-history-[0-9a-f]{20}\\.json$`).test(event.history_file))referenceError();
    seen.add(event.id);
  }
  return index;
}

export function validateDossierHistory(history,event){
  const current=validateDossierReference(event,event.id);
  const invalid=()=>fail('The dossier revision list does not match this publication.');
  if(!object(history)||history.schema_version!==1||history.event_id!==event.id||
    !text(history.scope)||
    !Array.isArray(history.versions)||!history.versions.length||history.versions.length>64)invalid();
  const currentMismatch=()=>{throw Error('The current dossier and its revision list do not agree. No earlier account has been substituted.');};
  if(history.current_dossier_sha256!==current.dossier_sha256)currentMismatch();
  const versions=new Map(),paths=new Set();
  for(const version of history.versions){
    validateDossierReference(version,event.id);
    if(versions.has(version.dossier_sha256)||paths.has(version.file)||typeof version.predecessor_available!=='boolean')invalid();
    versions.set(version.dossier_sha256,version);paths.add(version.file);
    const review=version.review;
    if(review!==null&&(!object(review)||review.reviewer_kind!=='agent'||
      !['reviewed_at','basis','candidate_sha256','previous_dossier_sha256'].every(key=>text(review[key]))||
      !hash(review.candidate_sha256)||!hash(review.previous_dossier_sha256)||
      review.previous_dossier_sha256===version.dossier_sha256||
      !/(?:Z|\+00:00)$/.test(review.reviewed_at)||!Number.isFinite(Date.parse(review.reviewed_at))))invalid();
    if(version.changes!==null&&(!Array.isArray(version.changes)||version.changes.some(change=>
      !object(change)||!['sources','observations','media','creators','records','dossier'].includes(change.kind)||
      !text(change.id)||!['added','removed','updated'].includes(change.change)||!Array.isArray(change.fields)||
      !change.fields.every(id)||new Set(change.fields).size!==change.fields.length||
      (change.change!=='updated'&&change.fields.length))))invalid();
  }
  const selected=versions.get(current.dossier_sha256);
  if(!selected||['file','dossier_sha256','file_sha256'].some(key=>selected[key]!==current[key]))currentMismatch();
  for(const version of versions.values()){
    const previous=version.review?.previous_dossier_sha256;
    const available=Boolean(previous&&versions.has(previous));
    if(version.predecessor_available!==available||(version.changes!==null)!==available)invalid();
    const visited=new Set();let cursor=version;
    while(cursor){
      if(visited.has(cursor.dossier_sha256))invalid();
      visited.add(cursor.dossier_sha256);cursor=versions.get(cursor.review?.previous_dossier_sha256);
    }
  }
  return history;
}

export async function boundedResponseBytes(response,limit){
  if(!Number.isSafeInteger(limit)||limit<=0)throw Error('Invalid response bound.');
  if(!response?.ok){
    try{await response?.body?.cancel?.();}catch{}
    fail('This metadata response could not load.');
  }
  if(typeof response.body?.getReader!=='function')fail('This browser cannot read a bounded metadata response.');
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{
    for(;;){
      const {value,done}=await reader.read();if(done)break;
      if(!(value instanceof Uint8Array))fail('This metadata response supplied an incompatible byte chunk.');
      if(value.byteLength>limit-length)fail('This metadata response exceeds its reading limit.');
      length+=value.byteLength;chunks.push(value);
    }
  }catch(error){
    try{await reader.cancel();}catch{}
    throw error;
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return bytes;
}

function decode(bytes){
  try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}
  catch{fail('This metadata response is not valid UTF8.');}
}
function parse(value){
  try{return JSON.parse(value);}
  catch{fail('This metadata response is not valid JSON.');}
}
export async function boundedJSON(file,limit,{fetcher=globalThis.fetch}={}){
  return parse(decode(await boundedResponseBytes(await fetcher(file,{cache:'no-store'}),limit)));
}

export function validateDossierForReader(doc,eventId){
  const invalid=()=>fail('The checked dossier has an incompatible reading structure.');
  const keys=(value,expected)=>object(value)&&Object.keys(value).length===expected.length&&expected.every(key=>Object.hasOwn(value,key));
  if(!keys(doc,['schema_version','id','title','coverage','summary','records','routes','creators','sources','observations','media','reconstruction','provenance'])||
    doc.schema_version!==1||doc.id!==eventId||!['title','coverage','summary'].every(key=>text(doc[key]))||
    !['records','routes','creators','sources','observations','media'].every(key=>Array.isArray(doc[key]))||
    !object(doc.provenance)||!keys(doc.reconstruction,['appearance','intervals','limits'])||
    doc.reconstruction.appearance!=='unregistered'||!Array.isArray(doc.reconstruction.intervals)||
    doc.reconstruction.intervals.length||!text(doc.reconstruction.limits))invalid();
  const identities={};
  for(const kind of ['creators','sources','observations','media']){
    identities[kind]=new Set();
    for(const row of doc[kind]){
      if(!object(row)||!id(row.id)||identities[kind].has(row.id))invalid();
      identities[kind].add(row.id);
    }
  }
  const original=value=>{try{return typeof value==='string'&&new URL(value).protocol==='https:';}catch{return false;}};
  for(const source of doc.sources)if(!['title','url','locator','access','revision','rights','agent_processing'].every(key=>text(source[key]))||!original(source.url))invalid();
  for(const creator of doc.creators)if(!text(creator.name)||!text(creator.basis))invalid();
  const dimensions=['intake','assertion','temporal','spatial','availability','rights'];
  for(const kind of ['observations','media'])for(const item of doc[kind]){
    if(!['title','source_id','locator','account','limits'].every(key=>text(item[key]))||
      !identities.sources.has(item.source_id)||!keys(item.status,dimensions)||!dimensions.every(key=>text(item.status[key]))||
      !keys(item.time,['event','capture','publication','retrieval','video','alignment'])||
      !keys(item.place,['role','reported','coordinates','basis'])||
      !(text(item.review)||object(item.review)))invalid();
    if(kind==='media'&&(!text(item.kind)||!original(item.url)||!keys(item.roles,['creator','uploader','rights_holder'])||
      Object.values(item.roles).some(value=>value!==null&&!identities.creators.has(value))||
      (item.parent!==null&&!identities.media.has(item.parent))||!Object.hasOwn(item,'transformation')))invalid();
  }
  const records=new Set();
  for(const record of doc.records){
    if(!object(record)||typeof record.id!=='string'||!/^ncei:\d+$/.test(record.id)||records.has(record.id)||
      !text(record.basis)||record.status!=='reviewed_association'||!Array.isArray(record.alternatives))invalid();
    records.add(record.id);
  }
  for(const route of doc.routes)if(!object(route)||!text(route.label)||typeof route.href!=='string'||
    !/^[a-z0-9-]+\.html(?:[?#][a-zA-Z0-9=&#%:._-]+)?$/.test(route.href))invalid();
  return doc;
}

export async function loadVerifiedDossier(reference,eventId,{fetcher=globalThis.fetch,subtle=globalThis.crypto?.subtle}={}){
  const checked=validateDossierReference(reference,eventId);
  if(typeof subtle?.digest!=='function')fail('This browser cannot verify dossier file bytes.');
  const bytes=await boundedResponseBytes(await fetcher(checked.file,{cache:'no-store'}),DOSSIER_FILE_LIMIT);
  let actual;
  try{actual=[...new Uint8Array(await subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');}
  catch{fail('The dossier file hash could not be checked.');}
  if(actual!==checked.file_sha256)fail('The dossier file bytes do not match this publication.');
  const rawText=decode(bytes),dossier=validateDossierForReader(parse(rawText),eventId);
  return Object.freeze({dossier,bytes,rawText,reference:checked});
}
