import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {loadEventPackage,selectEvent,validatePackage,displayClock} from '../web/event-package-model.mjs';
import {preparePositions} from '../web/playback-model.mjs';
import {anchorAt} from '../web/footage-model.mjs';
const root=new URL('../web/',import.meta.url);
const index=JSON.parse(await readFile(new URL('events.json',root),'utf8'));
const config=JSON.parse(await readFile(new URL('events/el-reno-2013.json',root),'utf8'));
const chronology=await readFile(new URL('events/joplin-2011-chronology.json',root));
const bundle=await readFile(new URL('data.json',root));
function fixture(overrides={}){
  const calls=[],assets={'events.json':JSON.stringify(index),'events/el-reno-2013.json':JSON.stringify(config),'data.json':bundle,'events/joplin-2011-chronology.json':chronology,...overrides};
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
  assert.equal(result.event.documentary,'joplin.html');assert.deepEqual(env.calls,['events.json','events/joplin-2011-chronology.json']);assert.equal(result.chronology.event_id,'joplin-2011');
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
test('clock bounds share the publication validator UTC string contract',()=>{
  for(const suffix of ['Z','+00:00']){
    const copy=structuredClone(config);
    for(const bound of ['start_utc','end_utc'])copy.clock[bound]=copy.clock[bound].replace('+00:00',suffix);
    assert.doesNotThrow(()=>validatePackage(copy,index.events[0]));
  }
  for(const value of ['20130531T230400Z','2013-05-31 23:04:00+00:00','2013-05-31T23:04+00:00','2013-05-31T23:04:00+0000','2013-05-31T23:04:00-00:00']){
    const copy=structuredClone(config);copy.clock.start_utc=value;
    assert.throws(()=>validatePackage(copy,index.events[0]),/historical clock/);
  }
});
test('normalized evidence UTC forms preserve geographic minutes and footage seconds',()=>{
  for(const suffix of ['Z','+00:00']){
    const data=JSON.parse(bundle);
    const points=data.geometry.features.filter(feature=>feature.geometry.type==='Point');
    for(const point of points)point.properties.utc=point.properties.utc.replace(/(?:Z|\+00:00)$/,suffix);
    const positions=preparePositions(points);
    assert.equal(positions[1].stamp,Date.parse('2013-05-31T23:05:00Z'));
    for(const anchor of data.footage.anchors){
      anchor.utc=anchor.utc.replace(/(?:Z|\+00:00)$/,suffix);
      assert.equal(anchorAt(data.footage.anchors,new Date(Date.parse(anchor.utc)).toISOString()),anchor);
    }
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
  next.schema_version=1;next.default_event='synthetic-test';next.events=[{id:'synthetic-test',title:'Synthetic fixture',documentary:'fixture.html',replay:'events/synthetic-test.json'}];
  manifest.event_id='synthetic-test';manifest.clock.time_zone='UTC';
  data.exhibit.id='synthetic-test';data.timeline_media.event='synthetic-test';data.footage.event='synthetic-test';
  const bytes=Buffer.from(JSON.stringify(data));
  manifest.bundle_sha256=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
  const result=await loadEventPackage(null,fixture({'events.json':JSON.stringify(next),'events/synthetic-test.json':JSON.stringify(manifest),'data.json':bytes}));
  assert.equal(result.event.id,'synthetic-test');assert.match(displayClock('UTC')(manifest.clock.start_utc),/11:04:00 PM UTC/);
});


test('chronology failure leaves no borrowed replay or partially accepted documentary data',async()=>{
  await assert.rejects(loadEventPackage('joplin-2011',fixture({'events/joplin-2011-chronology.json':null})),/Could not load/);
  const invalid=JSON.parse(chronology);invalid.event_id='blackwell-1955';
  await assert.rejects(loadEventPackage('joplin-2011',fixture({'events/joplin-2011-chronology.json':JSON.stringify(invalid)})),/identity/);
  const env=fixture(),result=await loadEventPackage('blackwell-1955',env);
  assert.equal(result.chronology,null);assert.deepEqual(env.calls,['events.json']);
});

test('combined modes require a reviewed synchronization contract',()=>{
  const copy=structuredClone(index);copy.events[1].replay='events/joplin-2011.json';
  assert.throws(()=>selectEvent(copy,'joplin-2011'),/synchronization/);
});
