import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cameraAt,cameraStatus,validateCamera} from '../web/camera-model.mjs';
import {PlaybackClock} from '../web/playback-model.mjs';
import {observerGlyph} from '../web/reconstruction-model.mjs';

const source=JSON.parse(readFileSync(new URL('../web/data.json',import.meta.url),'utf8')).cameras;
const start=Date.parse('2013-05-31T23:00:00Z'),at=seconds=>new Date(start+seconds*1000).toISOString();
const fixture={...source,samples:[
  {utc:at(10).replace('.000Z','Z'),coordinates:[-98,35],azimuth:90},
  {utc:at(140).replace('.000Z','Z'),coordinates:[-97.9,35.1],azimuth:0},
]};

test('observer model distinguishes absent, recorded, held, stale and disabled without interpolation',()=>{
  validateCamera(fixture,'el-reno-2013');
  assert.equal(cameraAt(fixture,at(9.999)).status,'unavailable');
  const exact=cameraAt(fixture,at(10));
  assert.equal(exact.status,'recorded');assert.equal(exact.ageSeconds,0);
  for(const seconds of [10.001,40,100]){
    const state=cameraAt(fixture,at(seconds));
    assert.equal(state.status,'held');assert.equal(state.visible,true);
    assert.equal(state.sample,fixture.samples[0]);
    assert.deepEqual(state.sample.coordinates,[-98,35]);
  }
  const stale=cameraAt(fixture,at(100.001));
  assert.equal(stale.status,'stale');assert.equal(stale.visible,false);
  assert.equal(cameraAt(fixture,at(139.999)).sample,fixture.samples[0]);
  assert.equal(cameraAt(fixture,at(140)).sample,fixture.samples[1]);
  assert.equal(cameraAt(fixture,at(10),false).status,'disabled');
  assert.throws(()=>cameraAt(fixture,'invalid'));
  assert.match(cameraStatus(fixture,stale,utc=>utc),/Older than the 90-second display limit.*hidden/);
  assert.match(cameraStatus(fixture,exact,utc=>utc),/exact sample time/);
});

test('replay rate, long gaps and rewinding change selection only through the historical clock',()=>{
  const run=frames=>{
    const clock=new PlaybackClock(300,1);clock.seek(10);clock.play(0);
    for(const stamp of frames)clock.tick(stamp);
    return cameraAt(fixture,at(clock.seconds));
  };
  assert.deepEqual(run([30000]),run([1000,8000,30000]));
  const clock=new PlaybackClock(300,1);clock.seek(10);clock.play(0);
  clock.setRate(60,1000);clock.tick(3000);
  assert.equal(clock.seconds,131);assert.equal(cameraAt(fixture,at(clock.seconds)).status,'stale');
  clock.seek(10);assert.equal(clock.playing,false);
  assert.equal(cameraAt(fixture,at(clock.seconds)).status,'recorded');
  clock.play(5000);clock.tick(6000);
  assert.equal(cameraAt(fixture,at(clock.seconds)).status,'held');
});

test('camera validation rejects mixed identity, unsupported pose and malformed provenance',()=>{
  for(const mutate of [m=>m.event='joplin-2011',m=>m.schema=2,m=>m.display_max_age_seconds=900,
    m=>m.source='http://example.test',m=>m.source='https://user:pass@example.test/source',
    m=>m.excerpt_sha256='',m=>m.observer='',m=>m.samples=[],
    m=>m.samples.reverse(),m=>m.samples[0].utc='2013-02-30T23:00:00Z',
    m=>m.samples[0].utc='2013-05-31T18:00:00-05:00',m=>m.samples[0].azimuth=-1,
    m=>m.samples[0].coordinates=[0,91],m=>m.samples[0].field_of_view=90]){
    const data=structuredClone(fixture);mutate(data);assert.throws(()=>validateCamera(data,'el-reno-2013'));
  }
});

test('recorded bearings turn with the scene and retain fixed screen length without a view cone',()=>{
  const sample={coordinates:[-98,35],azimuth:0},origin=[-98,35];
  const camera={azimuth:0,elevation:45,distance:20,focus:[0,0,0]};
  const north=observerGlyph(sample,origin,camera,800,500);
  const east=observerGlyph({...sample,azimuth:90},origin,camera,800,500);
  assert.ok(north.dy<0);assert.ok(Math.abs(north.dx)<1e-10);assert.ok(east.dx>0);
  const turned=observerGlyph(sample,origin,{...camera,azimuth:90},800,500);
  assert.ok(turned.dx>0);assert.ok(Math.abs(turned.dy)<1e-10);
  for(const view of [camera,{...camera,distance:50},{...camera,elevation:15}]){
    const glyph=observerGlyph(sample,origin,view,800,500);
    assert.ok(Math.abs(Math.hypot(glyph.dx,glyph.dy)-30)<1e-8);
  }
  assert.equal(observerGlyph({...sample,coordinates:[-120,35]},origin,camera,800,500),null);
  const close=observerGlyph({coordinates:[-98,35-2/111.195],azimuth:180},origin,
    {...camera,elevation:10,distance:3},800,500);
  assert.ok(close,'Visible observer survives a direction whose distant endpoint crosses the near plane');
  assert.ok(close.dy>0);assert.ok(Math.abs(Math.hypot(close.dx,close.dy)-30)<1e-8);
});

test('retained source keeps all 22 samples while only 17 fall inside the replay clock',()=>{
  validateCamera(source,'el-reno-2013');
  assert.equal(source.samples.length,22);
  const first=Date.parse('2013-05-31T23:04:00Z'),last=Date.parse('2013-05-31T23:42:00Z');
  assert.equal(source.samples.filter(s=>Date.parse(s.utc)>=first&&Date.parse(s.utc)<=last).length,17);
  for(let stamp=first;stamp<=last;stamp+=1000){
    const state=cameraAt(source,new Date(stamp).toISOString());
    if(state.visible){assert.ok(state.ageSeconds>=0&&state.ageSeconds<=90);assert.ok(source.samples.includes(state.sample));}
  }
  assert.equal(cameraAt(source,'2013-05-31T23:26:00Z').status,'stale');
});
