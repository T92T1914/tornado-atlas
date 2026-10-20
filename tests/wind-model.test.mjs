// Keep tracer controls in the configured wind suite without changing CI workflows.
import './wind-tracer.test.mjs';
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
test('positive background preserves validation before its independent comparison',()=>{
 assert.equal(continuousRankineReference({...field,background:1},options).status,'available');
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


// Fixed closed-form cases were derived before this implementation. Their
// expected values do not call windAt, samplePassage or componentHistory.
const backgroundField={peak:2,radius:1,background:1,travel:1,offset:0,
  area:1,coefficient:1,density:2};
const backgroundOptions={threshold:2,capacity:4,extent:2};
const backgroundCases=[
 ['cross-core interval',{},{},Math.sqrt(5),5,1/Math.sqrt(3),1/Math.sqrt(3),true],
 ['inside-only cancellation',{offset:.5},{threshold:.5,capacity:.25,extent:.5},1,1,.5,.5,true],
 ['outside decreasing branch',{peak:1,background:2,offset:-2},{threshold:Math.sqrt(6),capacity:6},2.5,6.25,Math.sqrt(2),Math.sqrt(2),true],
 ['outside increasing branch',{peak:1,background:2,offset:2},{threshold:Math.sqrt(3),capacity:3},5/(2*Math.sqrt(2)),25/8,4-2*Math.sqrt(3),4-2*Math.sqrt(3),true],
 ['outside constant equality',{peak:4,offset:2},{threshold:1,capacity:1},1,1,4,0,false],
 ['core-touch constant equality',{offset:1},{threshold:1,capacity:1},1,1,4,0,false],
 ['core-touch cancellation',{peak:1,offset:1},{threshold:1/Math.sqrt(2),capacity:.5},2/Math.sqrt(5),4/5,2,2,true],
 ['uniform background equality',{peak:0,background:3},{threshold:3,capacity:9},3,9,4,0,false],
 ['zero drag',{coefficient:0},{capacity:1},Math.sqrt(5),0,1/Math.sqrt(3),0,false],
 ['clipped window',{},{extent:.25},Math.sqrt(5)/2,5/4,0,0,false]
];
for(const [label,changes,limits,speed,drag,comparison,exposure,exceeded] of backgroundCases)
 test('positive-background continuous reference: '+label,()=>{
  const result=continuousRankineReference({...backgroundField,...changes},{...backgroundOptions,...limits});
  assert.equal(result.status,'available');
  // Irrational thresholds and square roots use this fixed absolute allowance.
  // Strict capacity flags and all literal equality decisions remain exact.
  near(result.maximumSpeed,speed,1e-12);near(result.maximumDrag,drag,1e-12);
  near(result.comparisonDuration,comparison,1e-12);near(result.capacityExceedanceDuration,exposure,1e-12);
  assert.equal(result.capacityExceeded,exceeded);
 });

test('constant fields distinguish inclusive comparison from strict capacity over the whole window',()=>{
 const constant={...backgroundField,peak:4,offset:2};
 for(const [capacity,exceeded,duration] of [[.5,true,4],[1,false,0],[2,false,0]]){
  const result=continuousRankineReference(constant,{...backgroundOptions,threshold:1,capacity});
  assert.equal(result.maximumDrag,1);assert.equal(result.capacityExceeded,exceeded);
  assert.equal(result.capacityExceedanceDuration,duration);assert.equal(result.comparisonDuration,4);
 }
 for(const [threshold,duration] of [[0,4],[1,4],[2,0]])
  assert.equal(continuousRankineReference(constant,{...backgroundOptions,threshold,capacity:1}).comparisonDuration,duration);
 for(const [capacity,exceeded,duration] of [[8,true,4],[9,false,0],[10,false,0]]){
  const result=continuousRankineReference({...backgroundField,peak:0,background:3},{...backgroundOptions,threshold:3,capacity});
  assert.equal(result.maximumDrag,9);assert.equal(result.capacityExceeded,exceeded);
  assert.equal(result.capacityExceedanceDuration,duration);assert.equal(result.comparisonDuration,4);
 }
});

test('a core-edge maximum and adjacent capacities retain unrounded strict decisions',()=>{
 const equal=continuousRankineReference(backgroundField,{...backgroundOptions,threshold:Math.sqrt(5),capacity:5});
 assert.equal(equal.maximumDrag,5);assert.equal(equal.capacityExceeded,false);
 assert.equal(equal.capacityExceedanceDuration,0);assert.equal(equal.comparisonDuration,0);
 const below=continuousRankineReference(backgroundField,{...backgroundOptions,capacity:5-2**-40});
 assert.equal(below.capacityExceeded,true);assert.ok(below.capacityExceedanceDuration>0);
 const above=continuousRankineReference(backgroundField,{...backgroundOptions,capacity:5+2**-40});
 assert.equal(above.capacityExceeded,false);assert.equal(above.capacityExceedanceDuration,0);
});

test('the outer derivative sign is not replaced by a tolerance around zero',()=>{
 const delta=2**-20,limits={...backgroundOptions,threshold:1,capacity:1};
 const positive=continuousRankineReference({...backgroundField,offset:1-delta},limits);
 near(positive.maximumDrag,1+2**-18,1e-12);assert.equal(positive.capacityExceeded,true);
 near(positive.capacityExceedanceDuration,2*(2-Math.sqrt(2**-20-2**-40)),1e-12);
 const constant=continuousRankineReference({...backgroundField,offset:1},limits);
 assert.equal(constant.maximumDrag,1);assert.equal(constant.capacityExceeded,false);
 assert.equal(constant.comparisonDuration,4);assert.equal(constant.capacityExceedanceDuration,0);
 const negative=continuousRankineReference({...backgroundField,offset:1+delta},limits);
 near(negative.maximumDrag,1-2**-18/(4+(1+delta)**2),1e-12);
 assert.equal(negative.capacityExceeded,false);assert.equal(negative.capacityExceedanceDuration,0);
 assert.equal(negative.comparisonDuration,0);
});

test('background reference scale changes preserve independent maxima and duration relations',()=>{
 const base=continuousRankineReference(backgroundField,backgroundOptions);
 const larger=continuousRankineReference({...backgroundField,radius:2},backgroundOptions);
 const faster=continuousRankineReference({...backgroundField,travel:2},backgroundOptions);
 for(const result of [larger,faster]){
  assert.equal(result.maximumSpeed,base.maximumSpeed);assert.equal(result.maximumDrag,base.maximumDrag);
 }
 assert.equal(larger.halfTime,2*base.halfTime);assert.equal(faster.halfTime,base.halfTime/2);
 assert.equal(larger.comparisonDuration,2*base.comparisonDuration);
 assert.equal(faster.comparisonDuration,base.comparisonDuration/2);
 assert.equal(larger.capacityExceedanceDuration,2*base.capacityExceedanceDuration);
 assert.equal(faster.capacityExceedanceDuration,base.capacityExceedanceDuration/2);
 const loaded=continuousRankineReference({...backgroundField,density:4},{...backgroundOptions,capacity:8});
 assert.equal(loaded.maximumDrag,10);assert.equal(loaded.maximumSpeed,base.maximumSpeed);
 assert.equal(loaded.comparisonDuration,base.comparisonDuration);
 assert.equal(loaded.capacityExceedanceDuration,base.capacityExceedanceDuration);
});

test('the retained signed 0.7 R benchmark has independent background maxima and strict exposure',()=>{
 const mph=.44704,foot=.3048,settings={peak:100*mph,radius:500*foot,background:20*mph,
  travel:30*mph,offset:-.7,area:1,coefficient:1.2};
 const limits={threshold:50*mph,capacity:1600,extent:6};
 const south=continuousRankineReference(settings,limits);
 near(south.maximumDrag,1938.8938770432,1e-9);near(south.capacityExceedanceDuration,7.4059467579,1e-9);
 assert.equal(south.capacityExceeded,true);
 const north=continuousRankineReference({...settings,offset:.7},limits);
 near(north.maximumDrag,1116.3328382976,1e-9);
 assert.equal(north.capacityExceeded,false);assert.equal(north.capacityExceedanceDuration,0);
});

test('positive background rejects malformed and unrepresentable arithmetic explicitly',()=>{
 for(const key of ['peak','radius','background','travel','offset','area','coefficient','density'])
  for(const value of [NaN,Infinity,-Infinity,'1'])
   assert.throws(()=>continuousRankineReference({...backgroundField,[key]:value},backgroundOptions),RangeError,key);
 for(const key of ['threshold','capacity','extent'])for(const value of [NaN,Infinity,-Infinity,'1'])
  assert.throws(()=>continuousRankineReference(backgroundField,{...backgroundOptions,[key]:value}),RangeError,key);
 for(const changes of [{peak:1e200},{radius:1e308,travel:1e-308},{peak:1e308,background:1e308,offset:-1},
  {offset:1e200},{density:Number.MIN_VALUE,area:Number.MIN_VALUE}])
  assert.throws(()=>continuousRankineReference({...backgroundField,...changes},backgroundOptions),RangeError);
 assert.throws(()=>continuousRankineReference(backgroundField,{...backgroundOptions,extent:1e200}),RangeError);
 assert.throws(()=>continuousRankineReference(backgroundField,{...backgroundOptions,threshold:Number.MIN_VALUE}),RangeError);
 assert.throws(()=>continuousRankineReference({...backgroundField,density:4},{...backgroundOptions,capacity:Number.MIN_VALUE}),RangeError);
 const tinyCapacity=continuousRankineReference(backgroundField,{...backgroundOptions,capacity:Number.MIN_VALUE});
 assert.equal(tinyCapacity.capacityExceeded,true);assert.equal(tinyCapacity.capacityExceedanceDuration,4);
});
