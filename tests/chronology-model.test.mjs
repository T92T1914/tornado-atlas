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

import {validateReadingContext,resolveReadingContext,readingForEntry} from '../web/chronology-reading-model.mjs';
import {loadVerifiedDossier} from '../web/dossier-file-model.mjs';
import {webcrypto} from 'node:crypto';
const readingReference=data.reading_context.reference;
const readingVerified=await loadVerifiedDossier(readingReference,data.event_id,{fetcher:async()=>new Response(await readFile(new URL('../web/'+readingReference.file,import.meta.url))),subtle:webcrypto.subtle});

test('later assessment context uses exact entry IDs and keeps unclocked observations separate',()=>{
  const resolved=resolveReadingContext(data,readingVerified);
  const distinction='intake-nws-local-siren-warning-distinction-2011',cessation='intake-nws-siren-cessation-2011';
  assert.deepEqual(readingForEntry(resolved,'warning-30').map(row=>row.observation.id),[distinction]);
  assert.deepEqual(readingForEntry(resolved,'first-siren').map(row=>row.observation.id),[distinction,cessation]);
  for(const entry of data.entries.filter(row=>!['warning-30','first-siren'].includes(row.id)))assert.deepEqual(readingForEntry(resolved,entry.id),[]);
  assert.deepEqual(readingForEntry(resolved,'unknown'),[]);assert.deepEqual(readingForEntry(null,'first-siren'),[]);
  assert.equal(chronologyAt(data,13440).entry.id,'first-siren');
  for(const {observation} of readingForEntry(resolved,'first-siren')){
    assert.equal(observation.status.temporal,'unregistered');assert.equal(observation.status.spatial,'unregistered');assert.equal(observation.status.rights,'links_only');
    for(const key of ['event','capture','video','alignment'])assert.equal(observation.time[key],null);
    assert.equal(observation.place.coordinates,null);
  }
  assert.match(resolved.navigation_basis,/different scope/);
  assert.match(readingForEntry(resolved,'first-siren')[1].observation.limits,/54 residents.*63 interviews.*nine excluded/);
});

test('both earlier chronology versions retain their existing clock and radar contract',()=>{
  for(const version of [1,2]){
    const old=structuredClone(data);old.schema_version=version;delete old.reading_context;if(version===1)delete old.radar_context;
    assert.equal(validateChronology(old,data.event_id),old);assert.equal(chronologyAt(old,13260).entry.id,'first-siren');
  }
});

test('reading metadata rejects missing, duplicate, unsafe or unassociated declarations',()=>{
  for(const mutate of [
    c=>c.event_id='other',c=>c.reference.file_sha256='0'.repeat(64),c=>c.navigation_basis='',
    c=>c.observations[0].id='absent-but-valid',c=>c.observations[0].source_id='absent',
    c=>c.observations[0].report_page=true,c=>c.observations[0].documentary_anchor='../unsafe',
    c=>c.observations.push(c.observations[0]),c=>c.associations[0].entry_id='missing',
    c=>c.associations.push(c.associations[0]),c=>c.associations[0].observation_ids.push(c.associations[0].observation_ids[0]),
    c=>c.associations[0].observation_ids=['absent'],c=>c.associations.pop(),c=>c.alignment={utc:data.entries[2].utc}
  ]){
    const changed=structuredClone(data);mutate(changed.reading_context);
    assert.throws(()=>validateReadingContext(changed,data.event_id));
  }
  const absent=structuredClone(data);delete absent.reading_context;
  assert.throws(()=>validateChronology(absent,data.event_id));
});

test('verified bytes cannot substitute a missing, differently sourced or registered reading record',()=>{
  for(const mutate of [
    d=>d.observations=d.observations.filter(row=>row.id!==data.reading_context.observations[0].id),
    d=>d.sources=d.sources.filter(row=>row.id!=='nws-assessment'),
    d=>d.sources.find(row=>row.id==='nws-assessment').url='https://example.test/different.pdf',
    d=>d.observations.find(row=>row.id===data.reading_context.observations[0].id).source_id='different'
  ]){
    const changed=structuredClone(readingVerified);mutate(changed.dossier);assert.throws(()=>resolveReadingContext(data,changed));
  }
  for(const dimension of ['intake','assertion','temporal','spatial','availability','rights']){
    const changed=structuredClone(readingVerified);changed.dossier.observations.find(row=>row.id===data.reading_context.observations[0].id).status[dimension]='different';
    assert.throws(()=>resolveReadingContext(data,changed));
  }
  for(const clock of ['event','capture','video','alignment']){
    const changed=structuredClone(readingVerified);changed.dossier.observations.find(row=>row.id===data.reading_context.observations[0].id).time[clock]={utc:data.entries[2].utc};
    assert.throws(()=>resolveReadingContext(data,changed));
  }
  const placed=structuredClone(readingVerified);placed.dossier.observations.find(row=>row.id===data.reading_context.observations[0].id).place.coordinates=[0,0];
  assert.throws(()=>resolveReadingContext(data,placed));
});
