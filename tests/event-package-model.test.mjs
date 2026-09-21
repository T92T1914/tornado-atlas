import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {loadEventPackage,selectEvent,validatePackage,displayClock} from '../web/event-package-model.mjs';
const root=new URL('../web/',import.meta.url);
const index=JSON.parse(await readFile(new URL('events.json',root),'utf8'));
const config=JSON.parse(await readFile(new URL('events/el-reno-2013.json',root),'utf8'));
const bundle=await readFile(new URL('data.json',root));
function fixture(overrides={}){
  const calls=[],assets={'events.json':JSON.stringify(index),'events/el-reno-2013.json':JSON.stringify(config),'data.json':bundle,...overrides};
  return {calls,fetcher:async(path)=>{calls.push(path);return assets[path]===null?new Response('',{status:404}):new Response(assets[path]);},subtle:webcrypto.subtle};
}
test('published package loads its exact event, source and clock',async()=>{
  const result=await loadEventPackage(null,fixture());
  assert.equal(result.event.id,'el-reno-2013');
  assert.equal(result.data.exhibit.id,result.event.id);
  assert.equal(result.config.clock.start_utc,'2013-05-31T23:04:00+00:00');
  assert.match(displayClock(result.config.clock.time_zone)(result.config.clock.start_utc),/6:04:00 PM CDT/);
});
test('documentary-only event does not fetch or borrow another event evidence',async()=>{
  const env=fixture(),result=await loadEventPackage('joplin-2011',env);
  assert.equal(result.data,null);assert.equal(result.config,null);
  assert.equal(result.event.documentary,'joplin.html');assert.deepEqual(env.calls,['events.json']);
});
test('explicit unknown and empty event do not silently default',()=>{
  for(const id of ['unknown','', '../el-reno-2013'])assert.throws(()=>selectEvent(index,id),/not in/);
});
test('mixed deployment and missing assets fail before rendering',async()=>{
  await assert.rejects(loadEventPackage(null,fixture({'data.json':Buffer.concat([bundle,Buffer.from(' ')] )})),/different revisions/);
  for(const path of ['events.json','events/el-reno-2013.json','data.json'])await assert.rejects(loadEventPackage(null,fixture({[path]:null})),/Could not load/);
  await assert.rejects(loadEventPackage(null,{...fixture(),subtle:null}),/HTTPS/);
  await assert.rejects(loadEventPackage(null,{...fixture(),fetcher:async()=>{throw new TypeError('Failed to fetch');}}),/Check the connection or open the documentary/);
});
test('unsupported schema, historical appearance, zone and mixed identity fail',()=>{
  for(const mutate of [c=>c.schema_version=2,c=>c.coverage.appearance='observed',c=>c.event_id='joplin-2011',c=>c.clock.time_zone='Mars/Olympus',c=>c.bundle='../private.json',c=>c.clock.precision='second',c=>c.clock.end_utc=c.clock.start_utc]){
    const copy=structuredClone(config);mutate(copy);assert.throws(()=>validatePackage(copy,index.events[0]));
  }
});
test('index rejects duplicate IDs and unsafe documentary links',()=>{
  const duplicate=structuredClone(index);duplicate.events.push(duplicate.events[0]);assert.throws(()=>selectEvent(duplicate),/duplicate/);
  for(const path of ['https://example.test/','../private.html','//example.test/a.html']){
    const unsafe=structuredClone(index);unsafe.events[0].documentary=path;assert.throws(()=>selectEvent(unsafe),/description/);
  }
});
test('synthetic second event uses the shared loader without historical claims',async()=>{
  const next=structuredClone(index),manifest=structuredClone(config),data=JSON.parse(bundle);
  next.default_event='synthetic-test';next.events=[{id:'synthetic-test',title:'Synthetic fixture',documentary:'fixture.html',replay:'events/synthetic-test.json'}];
  manifest.event_id='synthetic-test';manifest.clock.time_zone='UTC';
  data.exhibit.id='synthetic-test';data.timeline_media.event='synthetic-test';data.footage.event='synthetic-test';
  const bytes=Buffer.from(JSON.stringify(data));
  manifest.bundle_sha256=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
  const result=await loadEventPackage(null,fixture({'events.json':JSON.stringify(next),'events/synthetic-test.json':JSON.stringify(manifest),'data.json':bytes}));
  assert.equal(result.event.id,'synthetic-test');assert.match(displayClock('UTC')(manifest.clock.start_utc),/11:04:00 PM UTC/);
});
