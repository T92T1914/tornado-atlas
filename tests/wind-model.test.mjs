import test from 'node:test';
import assert from 'node:assert/strict';
import {windAt,loadAt,passageAt,samplePassage,MPH,FOOT} from '../web/wind-model.mjs';
const settings={peak:50,radius:100};
// Independent finite-annulus geometry for zero background only.
// Expected duration does not use the sampled speeds or production model.
function zeroBackgroundExposure({peak,radius,travel,offset=0,background=0},
    {threshold,extent=6}) {
  assert.equal(background,0,'The annulus reference requires zero background');
  assert.ok([peak,radius,travel,offset,threshold,extent].every(Number.isFinite));
  assert.ok(peak>=0 && radius>0 && travel>0 && threshold>=0 && extent>0);
  if (threshold===0) return 2*extent*radius/travel;
  if (peak===0 || threshold>peak) return 0;
  const q=threshold/peak,b=Math.abs(offset),outerRadius=1/q;
  if (b>outerRadius) return 0;
  const outer=Math.sqrt(Math.max(0,outerRadius*outerRadius-b*b));
  const inner=Math.sqrt(Math.max(0,q*q-b*b));
  return 2*radius/travel*Math.max(0,
    Math.min(extent,outer)-Math.min(extent,inner));
}
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
test('independent zero-background annulus reference preserves boundary cases',()=>{
  const base={...settings,travel:10,offset:0};
  const cases=[
    ['positive off-axis interval',{offset:1},{threshold:25},20*Math.sqrt(3)],
    ['zero comparison',{offset:3},{threshold:0},120],
    ['zero field and zero comparison',{peak:0},{threshold:0},120],
    ['zero field and positive comparison',{peak:0},{threshold:1},0],
    ['comparison above peak',{},{threshold:51},0],
    ['no radial intersection',{offset:3},{threshold:25},0],
    ['outer tangency',{offset:2},{threshold:25},0],
    ['peak equality at isolated crossings',{offset:.7},{threshold:50},0],
    ['window ends inside the core',{},{threshold:25,extent:.25},0],
    ['window clips the outer interval',{},{threshold:25,extent:1},10],
    ['window includes the full central annulus',{},{threshold:25},30]
  ];
  for (const [label,field,options,expected] of cases) {
    const actual=zeroBackgroundExposure({...base,...field},options);
    assert.ok(Math.abs(actual-expected)<1e-10,label);
  }
});
test('a near-peak off-grid interval exposes the finite sampling limit',()=>{
  const field={...settings,travel:10,offset:.7,background:0};
  const options={threshold:49.75,extent:6};
  const exact=zeroBackgroundExposure(field,options);
  assert.ok(Math.abs(exact-.28076293136721553)<1e-10);
  const coarse=samplePassage(field,{...options,steps:480});
  const finer=samplePassage(field,{...options,steps:1920});
  assert.equal(coarse.samples.length,481);
  assert.ok(coarse.peak<options.threshold);
  assert.equal(coarse.aboveSeconds,0);
  assert.ok(exact>0);
  assert.ok(finer.aboveSeconds>0);
  // This tolerance qualifies this case, not every field or sampling grid.
  assert.ok(Math.abs(finer.aboveSeconds-exact)<2e-4);
});
