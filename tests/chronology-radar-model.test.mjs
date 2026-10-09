import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {validateChronology,chronologyAt} from '../web/chronology-model.mjs';
import {radarAt,resolveRadarContext} from '../web/chronology-radar-model.mjs';
import {loadVerifiedDossier} from '../web/dossier-file-model.mjs';
import {loadEventPackage} from '../web/event-package-model.mjs';
const data=JSON.parse(await readFile(new URL('../exhibits/joplin-2011/chronology.json',import.meta.url),'utf8'));
const reference=data.radar_context.reference;
const bytes=await readFile(new URL('../web/'+reference.file,import.meta.url));
const verified=await loadVerifiedDossier(reference,data.event_id,{fetcher:async()=>new Response(bytes),subtle:webcrypto.subtle});
const index=JSON.parse(await readFile(new URL('../web/events.json',import.meta.url),'utf8'));

test('actual complete radar record retains attribution, inspection and unregistered clocks',()=>{
  assert.equal(validateChronology(data,data.event_id),data);
  const resolved=resolveRadarContext(data,verified);
  assert.equal(resolved.state,'available');assert.equal(resolved.media.time.alignment,null);
  assert.equal(resolved.media.place.coordinates,null);assert.equal(resolved.creator.id,'noaa-radar');
  assert.match(resolved.source.access,/Not a full report review/);
  assert.equal(resolved.media.transformation.width,947);assert.equal(resolved.media.transformation.height,1326);
});

test('every source boundary selects earlier context and retains the outside final panel',()=>{
  const start=Date.parse(data.entries[0].utc);
  for(const [i,row] of data.radar_context.snapshots.entries()){
    const seconds=(Date.parse(row.utc)-start)/1000;
    if(seconds>15480){assert.equal(radarAt(data,seconds),null);continue;}
    assert.equal(radarAt(data,seconds).snapshot,row);assert.equal(radarAt(data,seconds).elapsedSeconds,0);
    assert.equal(radarAt(data,seconds-.25).snapshot,i?data.radar_context.snapshots[i-1]:null);
    if(seconds<15480)assert.equal(radarAt(data,seconds+.25).elapsedSeconds,.25);
  }
  assert.equal(radarAt(data,0).snapshot,null);assert.equal(radarAt(data,15480).snapshot.id,'radar-2248');
  for(const value of [-1,15480.1,NaN,Infinity])assert.equal(radarAt(data,value),null);
  assert.equal(chronologyAt(data,14940).entry.id,chronologyAt(data,15180).entry.id);
  assert.equal(radarAt(data,14940).snapshot.id,'radar-2239');assert.equal(radarAt(data,15180).snapshot.id,'radar-2243');
  assert.equal(radarAt(data,15179.75).elapsedSeconds,239.75);
});

test('malformed mixed metadata fails the chronology boundary',()=>{
  for(const mutate of [c=>c.event_id='other',c=>c.reference.event_id='other',c=>c.reference.file_sha256='short',c=>c.snapshots.pop(),c=>c.snapshots.reverse(),c=>c.snapshots[1].utc='2011-05-22T22:29:01Z',c=>c.snapshots[1].source_label='2230 UTC',c=>c.snapshots[1].id='radar-2224',c=>c.alignment={utc:'2011-05-22T22:24:00Z'}]){
    const copy=structuredClone(data);mutate(copy.radar_context);assert.throws(()=>validateChronology(copy,copy.event_id));
  }
});

test('a verified dossier still requires the actual selected radar and source-minute contract',()=>{
  for(const mutate of [m=>m.kind='photograph',m=>m.status.rights='links_only',m=>m.status.temporal='discrete_anchor',m=>m.time.alignment={utc:'2011-05-22T22:24:00Z'},m=>m.time.event.reported[1]='2230 UTC',m=>m.place.coordinates=[0,0],m=>m.roles.creator=null,m=>m.transformation.asset='assets/other/figure.png',m=>m.transformation.width=0,m=>m.transformation.overlay=true]){
    const copy=structuredClone(verified);mutate(copy.dossier.media.find(row=>row.id===data.radar_context.media_id));
    assert.throws(()=>resolveRadarContext(data,copy));
  }
});

function environment(radarResponse=()=>new Response(bytes)){
  const calls=[];
  const fetcher=async(path,options)=>{calls.push({path,options});if(path==='events.json')return new Response(JSON.stringify(index));if(path==='events/joplin-2011-chronology.json')return new Response(JSON.stringify(data));if(path===reference.file)return radarResponse(options);throw Error('Unexpected borrowed package '+path);};
  return {fetcher,calls,subtle:webcrypto.subtle};
}

test('actual package resolves the retained dossier exactly once through the shared byte loader',async()=>{
  const env=environment(),result=await loadEventPackage(data.event_id,env);
  assert.equal(result.config,null);assert.equal(result.data,null);assert.equal(result.radarContext.state,'available');
  assert.deepEqual(env.calls.map(row=>row.path),['events.json','events/joplin-2011-chronology.json',reference.file]);
  assert.equal(env.calls.at(-1).options.cache,'no-store');assert.ok(env.calls.at(-1).options.signal instanceof AbortSignal);
  assert.equal(result.radarContext.reference.dossier_sha256,reference.dossier_sha256);
});

test('late failed or altered radar responses keep the valid documentary chronology without partial context',async()=>{
  for(const response of [()=>new Response(bytes.toString('utf8')+' '),()=>new Response('',{status:404}),async()=>{await new Promise(resolve=>setTimeout(resolve,5));throw Error('late transport failure');}]){
    const result=await loadEventPackage(data.event_id,environment(response));
    assert.equal(result.chronology.entries.length,7);assert.equal(result.radarContext.state,'unavailable');
    assert.deepEqual(Object.keys(result.radarContext).sort(),['message','state']);assert.match(result.radarContext.message,/clock remains usable/);
  }
  const bad=structuredClone(data);bad.radar_context.reference.file_sha256='bad';
  const env=environment();await assert.rejects(loadEventPackage(data.event_id,{...env,fetcher:async(path,opts)=>path.endsWith('-chronology.json')?new Response(JSON.stringify(bad)):env.fetcher(path,opts)}));
  assert.equal(env.calls.some(row=>row.path===reference.file),false);
});

test('a stalled radar body is aborted at its bounded deadline and does not hold the documentary clock',async()=>{
  let aborted=false;
  const env=environment(options=>new Response(new ReadableStream({start(controller){options.signal.addEventListener('abort',()=>{aborted=true;controller.error(new Error('aborted'));},{once:true});}})));
  const result=await loadEventPackage(data.event_id,{...env,radarTimeoutMs:20});
  assert.equal(aborted,true);assert.equal(result.radarContext.state,'unavailable');assert.equal(result.chronology.event_id,data.event_id);
});
