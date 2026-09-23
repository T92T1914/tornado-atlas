import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateChronology,chronologyAt} from '../web/chronology-model.mjs';
import {PlaybackClock} from '../web/playback-model.mjs';
const data=JSON.parse(await readFile(new URL('../web/events/joplin-2011-chronology.json',import.meta.url),'utf8'));
test('curated chronology preserves approximate time and has no positions',()=>{
  assert.equal(validateChronology(data,'joplin-2011'),data);
  assert.equal(chronologyAt(data,14640).entry.precision,'approximate_minute');
  assert.equal(chronologyAt(data,14640).entry.source_time,'534 pm CDT');
});
test('gaps retain an earlier record, rewinds and boundaries choose without interpolation',()=>{
  assert.equal(chronologyAt(data,13139).entry.id,'watch');
  assert.equal(chronologyAt(data,13140).entry.id,'warning-30');
  assert.equal(chronologyAt(data,13199).elapsedSeconds,59);
  assert.equal(chronologyAt(data,0).entry.id,'watch');
  assert.equal(chronologyAt(data,15480).entry.id,'warning-32');
  for(const bad of [-1,15481,NaN,Infinity])assert.equal(chronologyAt(data,bad),null);
});
test('clock selection survives frame rate changes, stalls, pause, rewind and rate changes',()=>{
  for(const frames of [[0,1,2,10000],[0,10000]]){
    const clock=new PlaybackClock(15480);clock.seek(13140);clock.play(0);
    frames.forEach(now=>clock.tick(now));assert.equal(clock.seconds,13740);
    assert.equal(chronologyAt(data,clock.seconds).entry.id,'warning-31');
    clock.pause(10000);clock.tick(99999);assert.equal(clock.seconds,13740);
    clock.seek(13140);clock.setRate(120);clock.play(100000);clock.tick(101000);
    assert.equal(chronologyAt(data,clock.seconds).entry.id,'first-siren');
  }
});
test('malformed, unregistered and more precise evidence fails closed',()=>{
  for(const mutate of [d=>d.event_id='other',d=>d.entries[0].utc=null,d=>d.entries[0].utc='2011-02-30T18:30:00Z',d=>d.entries[0].utc='2011-05-22T18:30:01Z',d=>d.entries.reverse(),d=>d.entries[0].precision='exact',d=>d.entries[0].coordinates=[0,0],d=>d.entries[0].limits='',d=>d.entries[0].source_id='absent',d=>d.entries[0].page=true,d=>d.clock.time_zone='Mars/Olympus',d=>d.clock.time_zone=null,d=>d.sources[0].url='https://user:password@example.test/report.pdf',d=>d.sources[0].url='javascript:alert(1)',d=>d.sources[0].archive='../private.pdf']){
    const copy=structuredClone(data);mutate(copy);assert.throws(()=>validateChronology(copy,'joplin-2011'));
  }
});
