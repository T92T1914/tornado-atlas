import test from 'node:test';
import assert from 'node:assert/strict';
import {windAt,loadAt,MPH,FOOT} from '../web/wind-model.mjs';
const settings={peak:50,radius:100};
test('center, core peak and inverse outer radius have analytic values',()=>{
  assert.equal(windAt(0,0,settings).speed,0);
  assert.equal(windAt(50,0,settings).speed,25);
  assert.equal(windAt(100,0,settings).speed,50);
  assert.equal(windAt(200,0,settings).speed,25);
});
test('background flow reinforces one side and opposes the other',()=>{
  const s={...settings,background:10};
  assert.equal(windAt(0,100,s).speed,40);
  assert.equal(windAt(0,-100,s).speed,60);
  assert.equal(windAt(0,0,s).speed,10);
});
test('force quadruples with doubled speed, doubles with area',()=>{
  assert.equal(loadAt(20).force/loadAt(10).force,4);
  assert.equal(loadAt(10,{area:2}).force/loadAt(10).force,2);
  assert.ok(Math.abs(loadAt(10).pressure-61.25)<1e-10);
  assert.equal(loadAt(0).force,0);
});
test('units and radius continuity remain consistent',()=>{
  assert.equal(MPH,0.44704);assert.equal(FOOT,0.3048);
  assert.ok(Math.abs(windAt(100-1e-6,0,settings).speed-windAt(100+1e-6,0,settings).speed)<1e-5);
});
test('invalid physical inputs fail rather than produce plausible readouts',()=>{
  assert.throws(()=>windAt(NaN,0,settings),RangeError);
  assert.throws(()=>windAt(0,0,{peak:50,radius:0}),RangeError);
  assert.throws(()=>loadAt(-1),RangeError);
  assert.throws(()=>loadAt(10,{area:0}),RangeError);
});
