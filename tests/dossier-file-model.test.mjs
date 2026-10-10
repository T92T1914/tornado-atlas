import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {validateArchiveReferences,validateDossierHistory,validateDossierReference,loadVerifiedDossier,boundedResponseBytes,boundedJSON,DOSSIER_FILE_LIMIT} from '../web/dossier-file-model.mjs';

const index=JSON.parse(await readFile(new URL('../web/archive/index.json',import.meta.url),'utf8'));
const wire=bytes=>createHash('sha256').update(bytes).digest('hex');
const entry=index.events.find(e=>e.id==='joplin-2011');
const history=JSON.parse(await readFile(new URL('../web/'+entry.history_file,import.meta.url),'utf8'));
const current=await readFile(new URL('../web/'+entry.file,import.meta.url));
const validDoc=JSON.parse(current);
const options=bytes=>({fetcher:async()=>new Response(bytes),subtle:webcrypto.subtle});

test('all published current and retained references verify exact bytes without another fetch',async()=>{
  assert.equal(validateArchiveReferences(index),index);
  const files=new Set();
  for(const event of index.events){
    const versions=JSON.parse(await readFile(new URL('../web/'+event.history_file,import.meta.url),'utf8'));
    assert.equal(validateDossierHistory(versions,event),versions);
    for(const version of versions.versions){
      const bytes=await readFile(new URL('../web/'+version.file,import.meta.url));let requests=0;
      const checked=await loadVerifiedDossier(version,event.id,{subtle:webcrypto.subtle,fetcher:async file=>{
        requests++;assert.equal(file,version.file);return new Response(bytes);
      }});
      assert.equal(requests,1);assert.deepEqual(Buffer.from(checked.bytes),bytes);
      assert.equal(checked.dossier.id,event.id);assert.equal(checked.rawText,bytes.toString('utf8'));
      files.add(version.file);
    }
  }
  assert.equal(files.size,38);
});

test('missing or malformed reference hashes and paths fail before any dossier fetch',async()=>{
  for(const change of [
    r=>delete r.file_sha256,r=>r.file_sha256=[],r=>r.file_sha256='A'.repeat(64),
    r=>delete r.dossier_sha256,r=>r.dossier_sha256='a'.repeat(63),
    r=>r.file='../'+r.file,r=>r.file+='?raw=1',r=>r.file='archive/foreign-'+r.dossier_sha256.slice(0,20)+'.json'
  ]){
    const r=structuredClone(entry);change(r);let requests=0;
    await assert.rejects(loadVerifiedDossier(r,entry.id,{subtle:webcrypto.subtle,fetcher:async()=>{requests++;return new Response(current);}}),/reference/);
    assert.equal(requests,0);
  }
  assert.throws(()=>validateDossierReference(entry,'wrong-event'),/reference/);
});

test('mixed current tuples, duplicates, foreign histories, cycles and missing history fail admission',()=>{
  for(const change of [
    h=>h.event_id='foreign',h=>h.versions=[],h=>h.versions.push(structuredClone(h.versions[0])),
    h=>h.current_dossier_sha256='f'.repeat(64),h=>h.versions[0].file_sha256='0'.repeat(64),
    h=>delete h.versions[0].file_sha256,h=>h.versions[0].dossier_sha256=entry.dossier_sha256.slice(0,20)+'0'.repeat(44),
    h=>h.versions[0].predecessor_available=false,
    h=>{h.versions[0].review.previous_dossier_sha256=h.versions[0].dossier_sha256;}
  ]){
    const h=structuredClone(history);change(h);assert.throws(()=>validateDossierHistory(h,entry),/reference|revision list/);
  }
  assert.throws(()=>validateDossierHistory(null,entry),/revision list/);
  const broken=structuredClone(index);delete broken.events[0].history_file;
  assert.throws(()=>validateArchiveReferences(broken),/reference/);
});

test('a changed same-event account is rejected before parsing or returning evidence',async()=>{
  const altered=structuredClone(validDoc);altered.media[0].account='Synthetic replacement, not historical evidence.';
  await assert.rejects(loadVerifiedDossier(entry,entry.id,options(JSON.stringify(altered))),/file bytes do not match/);
});

test('reader preserves verified Unicode, whitespace and CRLF rather than reserializing JSON',async()=>{
  const raw=Buffer.from('\r\n '+JSON.stringify(validDoc,null,2).replaceAll('\n','\r\n')+'\r\n');
  const ref={...entry,file_sha256:wire(raw)};
  const result=await loadVerifiedDossier(ref,entry.id,options(raw));
  assert.deepEqual(Buffer.from(result.bytes),raw);assert.equal(result.rawText,raw.toString('utf8'));
  assert.equal(result.dossier.summary,validDoc.summary);
});

test('HTTP, readable-body, read, crypto and hashing failures cannot return a dossier',async()=>{
  await assert.rejects(loadVerifiedDossier(entry,entry.id,{...options(current),fetcher:async()=>new Response('no',{status:503})}),/could not load/);
  await assert.rejects(loadVerifiedDossier(entry,entry.id,{...options(current),fetcher:async()=>({ok:true,body:null})}),/bounded metadata/);
  let releases=0,cancels=0;
  const response={ok:true,body:{getReader:()=>({read:async()=>{throw Error('Synthetic read failure');},cancel:async()=>{cancels++;},releaseLock:()=>{releases++;}})}};
  await assert.rejects(loadVerifiedDossier(entry,entry.id,{...options(current),fetcher:async()=>response}),/Synthetic read failure/);
  assert.equal(cancels,1);assert.equal(releases,1);
  await assert.rejects(loadVerifiedDossier(entry,entry.id,{...options(current),subtle:null}),/cannot verify/);
  await assert.rejects(loadVerifiedDossier(entry,entry.id,{...options(current),subtle:{digest:async()=>{throw Error('Synthetic crypto failure');}}}),/hash could not be checked/);
});

test('overshooting chunks are cancelled before accumulation regardless of Content-Length',async()=>{
  for(const headers of [{},{'Content-Length':'1'}]){
    let cancelled=0,reads=0;
    const response={ok:true,headers:new Headers(headers),body:{getReader:()=>({
      read:async()=>{reads++;return {done:false,value:new Uint8Array(reads===1?100:DOSSIER_FILE_LIMIT)};},
      cancel:async()=>{cancelled++;},releaseLock:()=>{}
    })}};
    await assert.rejects(boundedResponseBytes(response,DOSSIER_FILE_LIMIT),/reading limit/);
    assert.equal(reads,2);assert.equal(cancelled,1);
  }
});

test('HTTP rejection cancels an unused error body without reading it',async()=>{
  let cancels=0,reads=0;
  const response={ok:false,body:{cancel:async()=>{cancels++;},getReader:()=>{reads++;throw Error('Must not read');}}};
  await assert.rejects(boundedResponseBytes(response,DOSSIER_FILE_LIMIT),/could not load/);
  assert.equal(cancels,1);assert.equal(reads,0);
  response.body.cancel=async()=>{throw Error('Cancellation unavailable');};
  await assert.rejects(boundedResponseBytes(response,DOSSIER_FILE_LIMIT),/could not load/);
});

test('verified bytes with invalid UTF8, JSON, wrong event or incompatible structure fail after hashing',async()=>{
  const malformed=[Buffer.from([255]),Buffer.from('{'),Buffer.from(JSON.stringify({...validDoc,id:'foreign'})),
    Buffer.from(JSON.stringify({...validDoc,media:null})),Buffer.from(JSON.stringify({...validDoc,sources:[]})),
    Buffer.from(JSON.stringify({...validDoc,reconstruction:{...validDoc.reconstruction,intervals:[{}]}}))];
  for(const raw of malformed){
    const ref={...entry,file_sha256:wire(raw)};
    await assert.rejects(loadVerifiedDossier(ref,entry.id,options(raw)),/valid UTF8|valid JSON|incompatible reading structure/);
  }
});

test('history reading uses the bounded fatal-decode path',async()=>{
  const raw=Buffer.from(JSON.stringify(history));
  assert.deepEqual(await boundedJSON(entry.history_file,100000,{fetcher:async()=>new Response(raw)}),history);
  await assert.rejects(boundedJSON(entry.history_file,2,{fetcher:async()=>new Response(raw)}),/reading limit/);
});
