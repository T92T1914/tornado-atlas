import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedFormAt,EXAMPLE_WINDOWS} from '../web/evolution-model.mjs';
import {PlaybackClock} from '../web/playback-model.mjs';

test('a bounded drawing does not fill or hold across a coverage gap',()=>{
  for(const second of [-1,10.001,16,21.999,30.001])assert.equal(boundedFormAt(second),null);
  for(const second of [0,5,10,22,26,30])assert.ok(boundedFormAt(second));
  const late=boundedFormAt(26);
  assert.equal(late.window,'late');
  assert.deepEqual(boundedFormAt(5),boundedFormAt(5));
  assert.notDeepEqual(boundedFormAt(5).shape,late.shape);
});

test('equal elapsed time gives equal shape under slow and fast frame schedules',()=>{
  for(const rate of [1,15]){
    const clocks=[new PlaybackClock(30,rate),new PlaybackClock(30,rate)];
    clocks.forEach(clock=>clock.play(100));
    for(const wall of [150,200,250,500,900,1700])clocks[0].tick(wall);
    clocks[1].tick(1700);
    assert.equal(clocks[0].seconds,clocks[1].seconds);
    assert.deepEqual(boundedFormAt(clocks[0].seconds),boundedFormAt(clocks[1].seconds));
    clocks[0].seek(26);clocks[0].seek(16);
    assert.equal(boundedFormAt(clocks[0].seconds),null);
    clocks[0].seek(5);
    assert.deepEqual(boundedFormAt(clocks[0].seconds),boundedFormAt(5));
  }
});

test('overlap, ambiguous boundary, duplicate identity and malformed keys are rejected',()=>{
  for(const mutate of [
    windows=>windows[1].start=10,
    windows=>windows[1].start=9,
    windows=>windows[1].id=windows[0].id,
    windows=>windows[0].end=NaN,
    windows=>windows[0].keys[0].at=.1,
    windows=>windows[0].keys[0].shape='unregistered-storm',
  ]){
    const windows=structuredClone(EXAMPLE_WINDOWS);mutate(windows);
    assert.throws(()=>boundedFormAt(16,windows),RangeError);
  }
  assert.throws(()=>boundedFormAt(Infinity),RangeError);
  assert.throws(()=>boundedFormAt(5,[]),RangeError);
});
