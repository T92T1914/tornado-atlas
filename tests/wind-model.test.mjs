import test from 'node:test';
import assert from 'node:assert/strict';
import {windAt,loadAt,passageAt,samplePassage,MPH,FOOT} from '../web/wind-model.mjs';
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
test('central passage has two core peaks with calm at the center',()=>{
  const s={...settings,travel:10,offset:0};
  assert.equal(passageAt(-10,s).speed,50);
  assert.equal(passageAt(0,s).speed,0);
  assert.equal(passageAt(10,s).speed,50);
  const r=samplePassage(s,{threshold:25});
  assert.ok(Math.abs(r.aboveSeconds-30)<1e-8);
});
test('doubling travel halves time and exposure without changing sampled wind',()=>{
  const a=samplePassage({...settings,travel:10,offset:.7},{threshold:30});
  const b=samplePassage({...settings,travel:20,offset:.7},{threshold:30});
  assert.equal(a.halfTime,2*b.halfTime);
  assert.equal(a.aboveSeconds,2*b.aboveSeconds);
  assert.equal(a.peak,b.peak);
  assert.deepEqual(a.samples.map(s=>s.speed),b.samples.map(s=>s.speed));
});
test('offset is symmetric without background and asymmetric with it',()=>{
  const a={...settings,travel:10};
  assert.equal(passageAt(5,{...a,offset:1}).speed,passageAt(5,{...a,offset:-1}).speed);
  assert.ok(passageAt(0,{...a,offset:-1,background:10}).speed>passageAt(0,{...a,offset:1,background:10}).speed);
});
test('exposure is clipped to the declared window and cannot exceed it',()=>{
  const s={...settings,travel:10,offset:0};
  const all=samplePassage(s,{threshold:0});
  assert.ok(Math.abs(all.aboveSeconds-2*all.halfTime)<1e-8);
  assert.equal(samplePassage(s,{threshold:100}).aboveSeconds,0);
});
test('invalid passage speeds and sampling fail explicitly',()=>{
  for (const travel of [0,-1,NaN,Infinity]) assert.throws(()=>samplePassage({...settings,travel}),RangeError);
  assert.throws(()=>passageAt(Infinity,{...settings,travel:10}),RangeError);
  assert.throws(()=>samplePassage({...settings,travel:10},{steps:Infinity}),RangeError);
  assert.throws(()=>samplePassage({...settings,travel:10},{threshold:-1}),RangeError);
});
