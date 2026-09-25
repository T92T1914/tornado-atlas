import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preparePositions,positionAt} from '../web/playback-model.mjs';
import {frameAt} from '../web/timeline-media-model.mjs';
import {localPoint,sceneProject,initialSeconds,replaySeconds,replayURL,funnelGlyph} from '../web/reconstruction-model.mjs';

test('geographic stage keeps longitude east and latitude north, in kilometers',()=>{
  assert.deepEqual(localPoint([-98,35],[-98,35]),[0,0,0]);
  const east=localPoint([-97,35],[-98,35]),north=localPoint([-98,36],[-98,35]);
  assert.ok(east[0]>90&&east[0]<92);assert.equal(east[1],0);
  assert.equal(north[0],0);assert.equal(north[1],111.195);
});
test('perspective places the focus centrally and turns east and north consistently',()=>{
  const camera={azimuth:0,elevation:45,distance:20,focus:[0,0,0]};
  const center=sceneProject([0,0,0],camera,800,500);
  assert.equal(center.x,400);assert.equal(center.y,250);
  assert.ok(sceneProject([1,0,0],camera,800,500).x>400);
  assert.ok(sceneProject([0,1,0],camera,800,500).y<250);
  assert.equal(sceneProject([0,-100,100],camera,800,500),null);
  assert.throws(()=>sceneProject([0,0,0],{...camera,distance:0},800,500));
});
test('shared links cannot seek outside the documented historical window',()=>{
  for(const q of ['','?t=bad','?t=Infinity','?t=-1','?t='])assert.equal(initialSeconds(q,2280),0);
  assert.equal(initialSeconds('?t=58',2280),58);
  assert.equal(initialSeconds('?t=999999',2280),2280);
});

const historyStart=Date.parse('2013-05-31T23:04:00Z');
const historyAnchors=[{id:'source-moment',utc:'2013-05-31T23:17:03Z'}];
test('replay URL preserves supported fractional historical times',()=>{
  const url=replayURL('https://example.test/reconstruction.html','el-reno-2013',58.25,historyAnchors,historyStart);
  assert.equal(replaySeconds(url.search,2280,historyAnchors,historyStart),58.25);
});
test('a fractional time within a printed source second is not rewritten as its exact anchor',()=>{
  const url=replayURL('https://example.test/reconstruction.html?footage=source-moment#registered-footage','el-reno-2013',783.25,historyAnchors,historyStart);
  assert.equal(url.searchParams.has('footage'),false);
  assert.equal(replaySeconds(url.search,2280,historyAnchors,historyStart),783.25);
});
test('legacy footage links retain precedence without letting unknown IDs assign a time',()=>{
  assert.equal(replaySeconds('?t=338&footage=source-moment',2280,historyAnchors,historyStart),783);
  assert.equal(replaySeconds('?t=58.25&footage=unknown',2280,historyAnchors,historyStart),58.25);
  for(const [query,expected] of [['?t=-8',0],['?t=Infinity',0],['?t=9000',2280]]){
    assert.equal(replaySeconds(query,2280,historyAnchors,historyStart),expected);
  }
});
test('new replay URLs only identify exact checked moments and preserve unrelated context',()=>{
  const href='https://example.test/reconstruction.html?event=old&footage=source-moment&context=kept#registered-footage';
  for(const seconds of [0,58.25,782.999,783,783.25,784,2280]){
    const url=replayURL(href,'el-reno-2013',seconds,historyAnchors,historyStart);
    assert.equal(url.searchParams.get('event'),'el-reno-2013');
    assert.equal(url.searchParams.get('context'),'kept');
    assert.equal(url.searchParams.get('footage'),seconds===783?'source-moment':null);
    assert.equal(url.hash,seconds===783?'#registered-footage':'');
    assert.equal(replaySeconds(url.search,2280,historyAnchors,historyStart),seconds);
  }
  assert.equal(replayURL(href,'el-reno-2013',783,[],historyStart).searchParams.has('footage'),false);
});
test('illustrative geometry is deterministic and reversible, with bounded work',()=>{
  const before=funnelGlyph(12);funnelGlyph(99);
  assert.deepEqual(funnelGlyph(12),before);assert.equal(before.length,480);
  assert.ok(before.flat().every(Number.isFinite));
  assert.throws(()=>funnelGlyph(0,1000000));assert.throws(()=>funnelGlyph(NaN));
});

test('checked-in exhibit supplies the documented scene and bounded radar interval',()=>{
  const data=JSON.parse(readFileSync(new URL('../web/data.json',import.meta.url),'utf8'));
  const points=preparePositions(data.geometry.features.filter(f=>f.geometry.type==='Point'));
  assert.equal(points.length,39);
  const duration=(points.at(-1).stamp-points[0].stamp)/1000;
  assert.equal(duration,2280);
  assert.equal(positionAt(points,960).published,true);
  assert.equal(positionAt(points,960.5).published,false);
  for(let seconds=0;seconds<=duration;seconds+=30){
    const position=positionAt(points,seconds);
    const radar=frameAt(data.timeline_media.frames,position.utc,data.timeline_media.max_age_seconds);
    if(radar)assert.ok(radar.ageSeconds>=0&&radar.ageSeconds<=data.timeline_media.max_age_seconds);
    const local=localPoint(position.coordinates,points[0].geometry.coordinates);
    assert.ok(local.every(Number.isFinite));
  }
});
