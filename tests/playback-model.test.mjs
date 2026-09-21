import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PlaybackClock, preparePositions, positionAt, bearingOffset} from '../web/playback-model.mjs';
import {frameAt} from '../web/timeline-media-model.mjs';

const bundle = JSON.parse(fs.readFileSync(new URL('../web/data.json', import.meta.url)));
const points = preparePositions(bundle.geometry.features.filter(f => f.geometry.type === 'Point'));

test('playback preserves elapsed time at different display refresh rates', () => {
  for (const hz of [30,60,144,240]) {
    const clock = new PlaybackClock(2280); clock.play(0);
    for (let i=1; i<=hz*10; i++) clock.tick(i*1000/hz);
    assert.ok(Math.abs(clock.seconds-600)<1e-8);
  }
});
test('rate changes account for the old rate before applying the new one', () => {
  const clock = new PlaybackClock(2280); clock.play(0); clock.tick(1000);
  clock.setRate(1); clock.tick(3000); assert.equal(clock.seconds,62);
});
test('pause discards hidden time; seek pauses and clamps without resuming', () => {
  const clock = new PlaybackClock(2280); clock.play(0); clock.tick(1000); clock.pause();
  clock.tick(999999); assert.equal(clock.seconds,60);
  clock.play(1000000); clock.tick(1001000); assert.equal(clock.seconds,120);
  clock.seek(5000); assert.equal(clock.seconds,2280); assert.equal(clock.playing,false);
  clock.seek(-1); assert.equal(clock.seconds,0);
});
test('end stops exactly; replay starts from the beginning', () => {
  const clock = new PlaybackClock(2280); clock.play(0); clock.tick(50000);
  assert.equal(clock.seconds,2280); assert.equal(clock.playing,false);
  clock.play(60000); clock.tick(61000); assert.equal(clock.seconds,60);
});
test('invalid rates, times and reversed wall clock fail explicitly', () => {
  const clock = new PlaybackClock(100); clock.play(10);
  assert.throws(()=>clock.tick(9),RangeError);
  assert.throws(()=>clock.seek(NaN),RangeError);
  assert.throws(()=>clock.setRate(0),RangeError);
  assert.throws(()=>new PlaybackClock(Infinity),RangeError);
});
test('all published positions are preserved exactly with no source mutation', () => {
  const before = JSON.stringify(points);
  for (const p of points) {
    const sample = positionAt(points,(p.stamp-points[0].stamp)/1000);
    assert.deepEqual(sample.coordinates,p.geometry.coordinates); assert.equal(sample.published,true);
  }
  positionAt(points,30); assert.equal(JSON.stringify(points),before);
});
test('interpolation is labeled and bounded, never extrapolated', () => {
  const middle = positionAt(points,30); assert.equal(middle.published,false);
  middle.coordinates.forEach((v,i)=>assert.ok(Math.abs(v-(points[0].geometry.coordinates[i]+points[1].geometry.coordinates[i])/2)<1e-10));
  assert.equal(positionAt(points,-1),null); assert.equal(positionAt(points,2281),null);
  assert.throws(()=>preparePositions([points[1],points[0]]),RangeError);
});
test('camera samples never come from the future or bridge the 6:26 gap', () => {
  const {samples,display_max_age_seconds:age} = bundle.cameras;
  assert.equal(frameAt(samples,'2013-05-31T23:09:37Z',age),null);
  assert.equal(frameAt(samples,'2013-05-31T23:09:38Z',age).ageSeconds,0);
  assert.equal(frameAt(samples,'2013-05-31T23:26:00Z',age),null);
  assert.equal(frameAt(samples,'2013-05-31T23:29:26Z',age).ageSeconds,90);
  assert.equal(frameAt(samples,'2013-05-31T23:29:26.001Z',age),null);
});
test('all 17 in-window camera observations seek to the same historical UTC', () => {
  const start=points[0].stamp, end=points.at(-1).stamp;
  const samples=bundle.cameras.samples.filter(s=>Date.parse(s.utc)>=start && Date.parse(s.utc)<=end);
  assert.equal(samples.length,17);
  for (const s of samples) {
    const p=positionAt(points,(Date.parse(s.utc)-start)/1000);
    assert.equal(Date.parse(p.utc),Date.parse(s.utc));
    assert.equal(frameAt(samples,p.utc,90).frame,s);
  }
});
test('azimuth arrows use clockwise north bearings, including zero', () => {
  for (const [angle, expected] of [[0,[0,-34]],[90,[34,0]],[180,[0,34]],[270,[-34,0]],[360,[0,-34]]]) {
    bearingOffset(angle).forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-10));
  }
});
