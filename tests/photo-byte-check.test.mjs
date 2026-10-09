import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto,createHash} from 'node:crypto';
import {checkedPhotoBytes} from '../web/photo-view.mjs';

const original=await readFile(new URL('../web/assets/joplin-2011/nist-radar-sequence.png',import.meta.url));
const data=JSON.parse(await readFile(new URL('../web/events/joplin-2011-chronology.json',import.meta.url),'utf8'));
const doc=JSON.parse(await readFile(new URL('../web/'+data.radar_context.reference.file,import.meta.url),'utf8'));
const transform=doc.media.find(row=>row.id===data.radar_context.media_id).transformation;
const photo={asset:transform.asset,expectedSha256:transform.sha256};
const options=fetcher=>({fetcher,subtle:webcrypto.subtle,signal:new AbortController().signal});

test('the complete retained figure fits the bound and returns precisely its hashed bytes',async()=>{
  assert.ok(original.length>1024*1024 && original.length<2*1024*1024);
  let request;
  const checked=await checkedPhotoBytes(photo,options(async(url,init)=>{
    request={url,init};return new Response(original,{headers:{'Content-Length':String(original.length),'Content-Type':'image/png'}});
  }));
  assert.deepEqual(Buffer.from(checked.bytes),original);
  assert.equal(createHash('sha256').update(checked.bytes).digest('hex'),transform.sha256);
  assert.equal(checked.type,'image/png');assert.equal(request.url,transform.asset);
  assert.equal(request.init.redirect,'error');assert.equal(request.init.credentials,'omit');
  assert.equal(request.init.referrerPolicy,'no-referrer');assert.equal(request.init.cache,'no-store');
});

test('changed complete bytes cannot be certified by their dimensions or HTTP success',async()=>{
  const changed=Buffer.from(original);changed[changed.length-1]^=1;
  await assert.rejects(checkedPhotoBytes(photo,options(async()=>new Response(changed))),/does not match/);
});

test('an excessive declared length cancels before reading or hashing',async()=>{
  let cancelled=false,hashed=false;
  const body=new ReadableStream({cancel(){cancelled=true;}});
  await assert.rejects(checkedPhotoBytes(photo,{...options(async()=>new Response(body,{headers:{'Content-Length':String(2*1024*1024+1)}})),
    subtle:{digest(){hashed=true;throw Error('Unexpected digest');}}}),/reading limit/);
  assert.equal(cancelled,true);assert.equal(hashed,false);
});

test('undeclared chunked bytes exceeding the bound cancel rather than hashing a prefix',async()=>{
  let cancelled=false,hashed=false;
  const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(1024*1024));c.enqueue(new Uint8Array(1024*1024+1));},cancel(){cancelled=true;}});
  await assert.rejects(checkedPhotoBytes(photo,{...options(async()=>new Response(body)),
    subtle:{digest(){hashed=true;throw Error('Unexpected digest');}}}),/reading limit/);
  assert.equal(cancelled,true);assert.equal(hashed,false);assert.equal(body.locked,false);
});

test('a rejected original response is cancelled and never replaced by another fetch',async()=>{
  let requests=0,cancelled=false;
  const body=new ReadableStream({cancel(){cancelled=true;}});
  await assert.rejects(checkedPhotoBytes(photo,options(async()=>{requests++;return new Response(body,{status:503});})),/could not load/);
  assert.equal(requests,1);assert.equal(cancelled,true);
});

test('malformed expected identity or unavailable hashing fails before requesting the image',async()=>{
  let requests=0;const fetcher=async()=>{requests++;return new Response(original);};
  for(const expectedSha256 of [null,undefined,'ABC','0'.repeat(63)])
    await assert.rejects(checkedPhotoBytes({...photo,expectedSha256},options(fetcher)),/fingerprint/);
  await assert.rejects(checkedPhotoBytes(photo,{...options(fetcher),subtle:null}),/cannot check/);
  assert.equal(requests,0);
});

test('an abort arriving during an unabortable digest invalidates its eventual result',async()=>{
  let finish,started;const waiting=new Promise(resolve=>{started=resolve;});
  const controller=new AbortController();
  const pending=checkedPhotoBytes(photo,{fetcher:async()=>new Response(original),signal:controller.signal,
    subtle:{digest(){started();return new Promise(resolve=>{finish=resolve;});}}});
  await waiting;controller.abort();finish(await webcrypto.subtle.digest('SHA-256',original));
  await assert.rejects(pending,error=>error.name==='AbortError');
});
