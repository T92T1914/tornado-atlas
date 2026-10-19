import test from 'node:test';
import assert from 'node:assert/strict';
import {windAt,loadAt,passageAt,samplePassage,MPH,FOOT} from '../web/wind-model.mjs';
import {continuousRankineReference} from '../web/wind-continuous-reference.mjs';
import {componentHistory} from '../web/component-model.mjs';
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

const field={peak:50,radius:100,background:0,travel:10,offset:0,area:1,coefficient:1.2};
const options={threshold:25,capacity:1000};
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,actual+' versus '+expected);

test('continuous central passage has an independently known peak, annulus duration and SI load',()=>{
 const result=continuousRankineReference(field,options);
 assert.equal(result.status,'available');assert.equal(result.halfTime,60);
 assert.equal(result.maximumSpeed,50);assert.equal(result.maximumDrag,1837.5);
 assert.equal(result.comparisonDuration,30);assert.equal(result.capacityExceeded,true);
 assert.ok(result.capacityExceedanceDuration>0&&result.capacityExceedanceDuration<120);
});
test('annulus reference preserves zero field, zero comparison and whole finite window',()=>{
 const calm=continuousRankineReference({...field,peak:0},{...options,threshold:0});
 assert.equal(calm.maximumSpeed,0);assert.equal(calm.maximumDrag,0);assert.equal(calm.comparisonDuration,120);
 assert.equal(calm.capacityExceeded,false);assert.equal(calm.capacityExceedanceDuration,0);
 assert.equal(continuousRankineReference({...field,peak:0},options).comparisonDuration,0);
 assert.equal(continuousRankineReference({...field,offset:3},{...options,threshold:0}).comparisonDuration,120);
});
test('comparison boundaries distinguish a missed outer intersection, tangency and isolated peak equality',()=>{
 assert.equal(continuousRankineReference({...field,offset:3},options).comparisonDuration,0);
 assert.equal(continuousRankineReference({...field,offset:2},options).comparisonDuration,0);
 assert.equal(continuousRankineReference({...field,offset:.7},{...options,threshold:50}).comparisonDuration,0);
 assert.equal(continuousRankineReference(field,{...options,threshold:51}).comparisonDuration,0);
 near(continuousRankineReference({...field,offset:1},options).comparisonDuration,20*Math.sqrt(3));
});
test('finite window clipping controls both maximum and duration',()=>{
 const inner=continuousRankineReference(field,{threshold:5,capacity:100,extent:.25});
 assert.equal(inner.halfTime,2.5);assert.equal(inner.maximumSpeed,12.5);assert.equal(inner.maximumDrag,114.84375);
 assert.equal(inner.comparisonDuration,3);assert.equal(inner.capacityExceeded,true);
 assert.equal(continuousRankineReference(field,{...options,extent:.25}).comparisonDuration,0);
 assert.equal(continuousRankineReference(field,{...options,extent:1}).comparisonDuration,10);
});
test('a path outside the core has its maximum at closest approach',()=>{
 const result=continuousRankineReference({...field,offset:2},options);
 assert.equal(result.maximumSpeed,25);assert.equal(result.maximumDrag,459.375);
 assert.equal(result.comparisonDuration,0);assert.equal(result.capacityExceeded,false);
 const all=continuousRankineReference({...field,offset:2},{...options,capacity:1});
 assert.equal(all.capacityExceeded,true);assert.equal(all.capacityExceedanceDuration,120,'The whole finite window may exceed capacity, including its first instant');
});
test('signed offset symmetry, time scaling and unchanged maxima are independent invariants',()=>{
 const first=continuousRankineReference({...field,offset:.7},options);
 assert.deepEqual(continuousRankineReference({...field,offset:-.7},options),first);
 const faster=continuousRankineReference({...field,offset:.7,travel:20},options);
 assert.equal(first.halfTime,2*faster.halfTime);assert.equal(first.comparisonDuration,2*faster.comparisonDuration);
 assert.equal(first.capacityExceedanceDuration,2*faster.capacityExceedanceDuration);
 assert.equal(first.maximumSpeed,faster.maximumSpeed);assert.equal(first.maximumDrag,faster.maximumDrag);
 const larger=continuousRankineReference({...field,offset:.7,radius:200},options);
 assert.equal(larger.comparisonDuration,2*first.comparisonDuration);assert.equal(larger.maximumDrag,first.maximumDrag);
});
test('strict capacity equality and adjacent capacities do not become rounded failure claims',()=>{
 const exact={...field,peak:4,density:1,coefficient:2};
 const equal=continuousRankineReference(exact,{threshold:2,capacity:16});
 assert.equal(equal.maximumDrag,16);assert.equal(equal.capacityExceeded,false);assert.equal(equal.capacityExceedanceDuration,0);
 const below=continuousRankineReference(exact,{threshold:2,capacity:16-2**-49});
 assert.equal(below.capacityExceeded,true);assert.ok(below.capacityExceedanceDuration>0);
 const above=continuousRankineReference(exact,{threshold:2,capacity:16+2**-48});
 assert.equal(above.capacityExceeded,false);assert.equal(above.capacityExceedanceDuration,0);
});
test('zero drag coefficient preserves wind duration while refusing capacity exceedance',()=>{
 const result=continuousRankineReference({...field,coefficient:0},options);
 assert.equal(result.maximumSpeed,50);assert.equal(result.comparisonDuration,30);assert.equal(result.maximumDrag,0);
 assert.equal(result.capacityExceeded,false);assert.equal(result.capacityExceedanceDuration,0);
});
test('a narrow off-grid comparison interval is positive independently of the 481 samples',()=>{
 const settings={...field,offset:.7},threshold=49.75;
 const reference=continuousRankineReference(settings,{threshold,capacity:1000});
 near(reference.comparisonDuration,.28076293136721553);
 const coarse=samplePassage(settings,{threshold});
 assert.equal(coarse.samples.length,481);assert.equal(coarse.aboveSeconds,0);assert.ok(coarse.peak<threshold);
 assert.ok(reference.maximumSpeed>coarse.peak);assert.ok(reference.comparisonDuration>0);
});
test('the documented 105 mph case exposes missed sampled capacity without rewriting the sampled result',()=>{
 const mph=.44704,foot=.3048,settings={peak:105*mph,radius:500*foot,background:0,travel:30*mph,offset:.7,area:1,coefficient:1.2};
 const reference=continuousRankineReference(settings,{threshold:100*mph,capacity:1600});
 near(reference.maximumDrag,1619.4170450304,1e-9);assert.equal(reference.capacityExceeded,true);assert.ok(reference.capacityExceedanceDuration>0);
 const coarse=samplePassage(settings,{threshold:100*mph}),component=componentHistory(coarse.samples,{...settings,capacity:1600});
 assert.equal(coarse.samples.length,481);assert.ok(component.peak<1600);assert.equal(component.firstFailureIndex,null);
 const finer=samplePassage(settings,{steps:960,threshold:100*mph}),fineComponent=componentHistory(finer.samples,{...settings,capacity:1600});
 assert.ok(fineComponent.peak>1600);assert.notEqual(fineComponent.firstFailureIndex,null);
 // Two retained grids illustrate this case. They do not prove general convergence.
});
test('nonzero background is explicitly unavailable rather than treated as symmetric',()=>{
 assert.deepEqual(continuousRankineReference({...field,background:1},options),{status:'unavailable',reason:'nonzero-background'});
 assert.throws(()=>continuousRankineReference({...field,background:1},{...options,capacity:0}),RangeError);
});
test('invalid and unrepresentable inputs fail rather than emit plausible reference numbers',()=>{
 for(const key of ['peak','radius','background','travel','offset','area','coefficient']){
  for(const value of [NaN,Infinity,-Infinity,'1',undefined])assert.throws(()=>continuousRankineReference({...field,[key]:value},options),RangeError,key);
 }
 for(const value of [NaN,Infinity,-Infinity,'1',0])assert.throws(()=>continuousRankineReference({...field,density:value},options),RangeError);
 assert.deepEqual(continuousRankineReference({...field,density:undefined},options),continuousRankineReference(field,options),'Omitted density uses the stated1.225kg/m³ assumption');
 for(const [key,value] of [['peak',-1],['radius',0],['background',-1],['travel',0],['area',0],['coefficient',-1],['density',0]])assert.throws(()=>continuousRankineReference({...field,[key]:value},options),RangeError);
 for(const key of ['threshold','capacity','extent'])for(const value of [NaN,Infinity,-Infinity,'1'])assert.throws(()=>continuousRankineReference(field,{...options,[key]:value}),RangeError,key);
 for(const [key,value] of [['threshold',-1],['capacity',0],['extent',0]])assert.throws(()=>continuousRankineReference(field,{...options,[key]:value}),RangeError);
 assert.throws(()=>continuousRankineReference(null,options),RangeError);
 assert.throws(()=>continuousRankineReference(field),RangeError);
 assert.throws(()=>continuousRankineReference({...field,peak:1e200},options),RangeError);
 assert.throws(()=>continuousRankineReference({...field,radius:1e308,travel:1e-308},options),RangeError);
});

test('scaled circle intersection retains the independently known 1.5 s duration at extreme finite radii',()=>{
 const reference=continuousRankineReference({peak:2**500,radius:1,travel:2**1023,offset:2**1023,density:1,area:1,coefficient:1,background:0},{threshold:.8*2**-523,capacity:1,extent:2**1023});
 assert.equal(reference.status,'available');assert.equal(reference.halfTime,1);
 // The outer radius is 1.25b, giving a 0.75b half width and 1.5 s in a 2 s window.
 near(reference.comparisonDuration,1.5,1e-14);assert.notEqual(reference.comparisonDuration,2);
 assert.equal(reference.capacityExceeded,false);assert.equal(reference.capacityExceedanceDuration,0);
});
test('underflowed positive ratios are refused instead of becoming a false full-window duration',()=>{
 const extreme={...field,peak:2**500,density:1,coefficient:1};
 assert.throws(()=>continuousRankineReference(extreme,{threshold:0,capacity:Number.MIN_VALUE}),{name:'RangeError',message:/capacity ratio is below representable range/});
 assert.throws(()=>continuousRankineReference(extreme,{threshold:Number.MIN_VALUE,capacity:1}),{name:'RangeError',message:/comparison ratio is below representable range/});
});
