import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {appearanceAt,validateAppearanceTimeline} from '../web/appearance-timeline-model.mjs';
import {loadEventPackage} from '../web/event-package-model.mjs';
import {PlaybackClock} from '../web/playback-model.mjs';

const web=new URL('../web/',import.meta.url);
const legacy=JSON.parse(await readFile(new URL('events/el-reno-2013.json',web),'utf8'));
const original=JSON.parse(await readFile(new URL('data.json',web),'utf8'));
function fixture(){
  const config=structuredClone(legacy),bundle=structuredClone(original);
  config.schema_version=2;config.coverage.appearance='bounded_timeline';
  const first={id:'early',start_utc:'2013-05-31T23:05:00Z',end_utc:'2013-05-31T23:05:10Z',
    source_id:null,kind:'illustrative',basis:'Synthetic authored form; no historical observation.',
    registration:null,keys:[{at:0,shape:'cone',extent:.4,label:'Authored short form'},{at:1,shape:'wedge',extent:1,label:'Authored broad form'}]};
  const late={...structuredClone(first),id:'late',start_utc:'2013-05-31T23:05:22Z',end_utc:'2013-05-31T23:05:30Z'};
  bundle.appearance_timeline={schema_version:1,event:'el-reno-2013',windows:[first,late]};
  return {config,bundle};
}
function registered(){
  const {config,bundle}=fixture();
  const source=bundle.footage.sources[0],window=bundle.appearance_timeline.windows[0];
  window.kind='registered';window.source_id=source.id;
  window.registration={
    source:{url:source.url,video_id:source.video_id,original_locator:source.url,
      edit_identity:'Synthetic edit A',sha256:null,identity_basis:'Authored software fixture.'},
    inspection:{status:'continuous_video_inspected',start_video_seconds:10,end_video_seconds:20,
      reviewed_on:'2026-10-07',discontinuities:'none_observed',basis:'Synthetic inspection declaration.'},
    timing:{method:'linear_verified',anchors:[
      {video_seconds:10,utc:window.start_utc},
      {video_seconds:15,utc:'2013-05-31T23:05:05Z'},
      {video_seconds:20,utc:window.end_utc}],
      uncertainty_seconds:.5,basis:'Synthetic clock alignment.'},
    camera:{mode:'fixed_view',coordinates:[0,0],bearing_degrees:90,pitch_degrees:0,roll_degrees:0,
      position_uncertainty_m:10,orientation_uncertainty_degrees:2,
      lens_calibration:'Synthetic lens record',basis:'Synthetic fixed-camera record.'},
    rights:{reuse:'external_links_only',creator:source.creator,uploader:'Fixture uploader',
      rights_holder:'Fixture owner',basis:'Original link only.'},
    uncertainty:'All observations and calibration in this record are synthetic.'
  };
  return {config,bundle};
}
const timeline=({config,bundle})=>validateAppearanceTimeline(bundle.appearance_timeline,config.event_id,config.clock,bundle.footage);

test('one existing clock resolves assigned form, explicit gap and reverse seek without holding a form',()=>{
  const data=fixture(),appearance=timeline(data),clock=new PlaybackClock(2280,1);
  clock.seek(60);assert.equal(appearanceAt(appearance,clock.seconds,data.config.clock.start_utc,null).state,'illustrative');
  clock.play(100);clock.tick(5100);
  const forward=appearanceAt(appearance,clock.seconds,data.config.clock.start_utc,null);
  assert.equal(forward.state,'illustrative');
  clock.pause(5100);assert.equal(clock.seconds,65);
  clock.seek(75);assert.equal(appearanceAt(appearance,clock.seconds,data.config.clock.start_utc,null).state,'unknown');
  clock.seek(65);assert.deepEqual(appearanceAt(appearance,clock.seconds,data.config.clock.start_utc,null),forward);
  clock.setRate(15,5100);clock.play(5100);clock.tick(5500);
  assert.equal(clock.seconds,71);
  assert.equal(appearanceAt(appearance,clock.seconds,data.config.clock.start_utc,null).state,'unknown');
  clock.seek(85);assert.equal(appearanceAt(appearance,clock.seconds,data.config.clock.start_utc,null).window,'late');
});

test('registered keys are source-linked observations, interiors interpolated, and other sources unknown',()=>{
  const data=registered(),appearance=timeline(data),start=data.config.clock.start_utc,source=data.bundle.footage.sources[0].id;
  assert.equal(appearanceAt(appearance,60,start,source).state,'observed');
  assert.equal(appearanceAt(appearance,65,start,source).state,'interpolated');
  assert.equal(appearanceAt(appearance,65,start,source).videoSeconds,15);
  assert.equal(appearanceAt(appearance,70,start,source).state,'observed');
  assert.equal(appearanceAt(appearance,65,start,'other-upload').state,'unknown');
  assert.equal(appearanceAt(appearance,65,start,null).state,'unknown');
  assert.equal(appearanceAt(appearance,76,start,source).state,'unknown');
  assert.equal(appearanceAt(appearance,85,start,null).state,'illustrative');
});

test('overlapping historical source lanes compare independently without mixing registrations',()=>{
  const data=registered(),first=data.bundle.appearance_timeline.windows[0];
  const alternate=structuredClone(first),source={...data.bundle.footage.sources[0],
    id:'illustrative',url:'https://www.youtube.com/watch?v=zyxwvutsrqp',video_id:'zyxwvutsrqp',creator:'Synthetic second creator'};
  data.bundle.footage.sources.push(source);
  alternate.id='alternate-view';alternate.source_id=source.id;
  alternate.registration.source={...alternate.registration.source,url:source.url,video_id:source.video_id,original_locator:source.url};
  alternate.registration.rights.creator=source.creator;
  alternate.keys[0].shape='rope';
  data.bundle.appearance_timeline.windows.splice(1,0,alternate);
  const authored=structuredClone(first);
  authored.id='authored-overlap';authored.source_id=null;authored.kind='illustrative';authored.registration=null;
  data.bundle.appearance_timeline.windows.splice(2,0,authored);
  const validated=timeline(data);
  const a=appearanceAt(validated,60,data.config.clock.start_utc,first.source_id);
  const b=appearanceAt(validated,60,data.config.clock.start_utc,alternate.source_id);
  assert.equal(a.state,'observed');assert.equal(b.state,'observed');
  assert.notDeepEqual(a.shape,b.shape);
  alternate.source_id=first.source_id;
  assert.throws(()=>timeline(data),/overlap/);
});

test('a paused-only or mismatched historical registration is rejected even with plausible form keys',()=>{
  for(const mutation of [
    window=>window.registration.inspection.status='paused_samples_inspected',
    window=>window.registration.inspection.discontinuities='cut_observed',
    window=>window.registration.source.video_id='different-edit',
    window=>window.registration.camera.mode='sparse_moving_samples',
    window=>window.registration.inspection.reviewed_on='2026-02-30',
    (window,bundle)=>{bundle.footage.sources[0].url='javascript:alert(1)';window.registration.source.url=bundle.footage.sources[0].url;},
    (window,bundle)=>{bundle.footage.sources[0].video_id='';window.registration.source.video_id='';},
    (window,bundle)=>{bundle.footage.sources[0].creator='';window.registration.rights.creator='';},
    (window,bundle)=>{bundle.footage.sources[0].duration_seconds='60';},
    window=>{window.keys[0].shape=['cone'];},
    window=>window.registration.timing.anchors[1].utc='2013-05-31T23:05:08Z',
    window=>window.registration.rights.reuse='mirrored_video',
    window=>window.registration.timing.anchors[0].video_seconds=11,
    window=>window.keys.splice(1,0,{at:.3,shape:'cone',extent:.6,label:'Unanchored form claim'}),
  ]){
    const data=registered();mutation(data.bundle.appearance_timeline.windows[0],data.bundle);
    assert.throws(()=>timeline(data));
  }
});

test('version two loader binds the timeline to exact bundle bytes and rejects unsupported registration',async()=>{
  const index=JSON.parse(await readFile(new URL('events.json',web),'utf8'));
  for(const bad of [false,true]){
    const data=registered();
    if(bad)data.bundle.appearance_timeline.windows[0].registration.inspection.status='paused_samples_inspected';
    const bytes=Buffer.from(JSON.stringify(data.bundle));
    data.config.bundle_sha256=createHash('sha256').update(bytes).digest('hex');
    const assets={'events.json':JSON.stringify(index),'events/el-reno-2013.json':JSON.stringify(data.config),'data.json':bytes};
    const fetcher=async path=>new Response(assets[path]);
    if(bad)await assert.rejects(loadEventPackage(null,{fetcher,subtle:webcrypto.subtle}),/inspection/);
    else assert.equal((await loadEventPackage(null,{fetcher,subtle:webcrypto.subtle})).data.appearance_timeline.windows.length,2);
  }
});
