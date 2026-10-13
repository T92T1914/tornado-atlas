import test from 'node:test';
import assert from 'node:assert/strict';
import {componentHistory} from '../web/component-model.mjs';
import {samplePassage,MPH,FOOT} from '../web/wind-model.mjs';
const samples=[0,10,20,10,0].map((speed,time)=>({speed,time}));
const settings={capacity:100,density:2,area:1,coefficient:1};
test('failure persists when wind falls and rewinding recovers the prior state',()=>{
  const history=componentHistory(samples,settings);
  assert.deepEqual(history.states.map(s=>s.failed),[false,false,true,true,true]);
  assert.equal(history.firstFailureTime,2);
  assert.equal(history.states[4].force,0);
  assert.equal(history.states[1].failed,false);
  assert.equal(history.states[4].peak,400);
});
test('capacity equality, increased capacity, changed area and changed wind are explicit',()=>{
  assert.equal(componentHistory(samples,{...settings,capacity:400}).firstFailureTime,null);
  assert.equal(componentHistory(samples,{...settings,area:2}).peak,800);
  assert.equal(componentHistory(samples.map(s=>({...s,speed:s.speed*2})),settings).peak,1600);
  assert.equal(componentHistory([{speed:20,time:0}],settings).firstFailureIndex,0);
});
test('invalid resistance and unordered samples are rejected',()=>{
  for(const capacity of [0,-1,NaN,Infinity]) assert.throws(()=>componentHistory(samples,{...settings,capacity}),RangeError);
  assert.throws(()=>componentHistory([],settings),RangeError);
  assert.throws(()=>componentHistory([...samples,samples[0]],settings),RangeError);
});
test('off-grid sampling can change the illustrative capacity outcome',()=>{
  const field={peak:105*MPH,radius:500*FOOT,travel:30*MPH,
    offset:.7,background:0};
  const component={density:1.225,area:1,coefficient:1.2,capacity:1600};
  // Independent drag expression at the continuous zero-background peak.
  const exactPeak=.5*1.225*(105*.44704)**2*1*1.2;
  assert.ok(Math.abs(exactPeak-1619.4170450304002)<1e-8);
  assert.ok(exactPeak>component.capacity);
  const coarse=componentHistory(samplePassage(field,{steps:480}).samples,component);
  const finer=componentHistory(samplePassage(field,{steps:960}).samples,component);
  assert.ok(coarse.peak<component.capacity);
  assert.equal(coarse.firstFailureTime,null);
  assert.ok(finer.peak>component.capacity);
  assert.notEqual(finer.firstFailureTime,null);
  assert.ok(coarse.peak<exactPeak && finer.peak<exactPeak);
});

test('independent nonzero-background capacity intervals and convergence separate opposite sides',()=>{
const V=100*.44704,R=500*.3048,U=30*.44704,alpha=R/U;
const K=.5*1.225*1*1.2,extent=6,capacity=1600,background=20*.44704;
function algebra(beta,B,C) {
  assert.ok(Math.abs(beta)<1 && B>=0 && C>0);
  const D=(B-V*beta)**2,E=V**2-2*B*V*beta,H2=C/K;
  assert.ok(E>0,'This bounded reference requires a decreasing exterior branch');
  const core=Math.sqrt(1-beta**2),peak2=D+V**2*core**2;
  const speed2=s=>Math.abs(s)<=core?D+V**2*s**2:B**2+E/(s**2+beta**2);
  let inner=null,outer=null;
  if(H2<peak2)inner=[Math.sqrt(Math.max(0,(H2-D)/V**2)),Math.min(core,extent)];
  if(H2<=B**2)outer=[core,extent];
  else {
    const outer2=E/(H2-B**2)-beta**2;
    if(outer2>core**2)outer=[core,Math.min(extent,Math.sqrt(outer2))];
  }
  const positives=[inner,outer].filter(a=>a&&a[1]>a[0]&&a[0]<extent);
  const merged=[];
  for(const pair of positives) {
    if(merged.length&&merged.at(-1)[1]===pair[0])merged.at(-1)[1]=pair[1];
    else merged.push([...pair]);
  }
  const intervals=merged.flatMap(([a,b])=>[[-b*alpha,-a*alpha],[a*alpha,b*alpha]]).sort((a,b)=>a[0]-b[0]);
  return {beta,B,C,D,E,core,peak2,speed2,threshold:Math.sqrt(H2),intervals,duration:intervals.reduce((a,[x,y])=>a+y-x,0)};
}
const refs=[-.7,.7].map(beta=>algebra(beta,background,capacity));
assert.ok(Math.abs(K*refs[0].peak2-1938.8938770432)<1e-9);
assert.ok(Math.abs(K*refs[1].peak2-1116.3328382976)<1e-9);
assert.ok(Math.abs(refs[0].duration-7.4059467579)<1e-9);
assert.equal(refs[1].duration,0);
function durationBound(ref,steps) {
 const ds=2*extent/steps;
 let bound=0;
 for(const [start,end] of ref.intervals)for(const time of [start,end]) {
   const s=Math.abs(time)/alpha,i=Math.floor(s/ds);
   const lo=i*ds,hi=(i+1)*ds,mid=(lo+hi)/2;
   // A bracket crossing the core kink has only the explicit one-cell bound.
   if(lo<=ref.core&&hi>=ref.core){bound+=alpha*ds;continue;}
   const gmin=Math.sqrt(Math.min(ref.speed2(lo),ref.speed2(hi)));
   const gmax=Math.sqrt(Math.max(ref.speed2(lo),ref.speed2(hi)));
   let m,M;
   if(mid<ref.core) {
     m=V**2*lo/gmax;M=V**2*ref.D/gmin**3;
   } else {
     const qlo=lo**2+ref.beta**2,qhi=hi**2+ref.beta**2;
     m=ref.E*lo/(gmax*qhi**2);
     M=ref.E/(gmin*qlo**2)+4*ref.E*hi**2/(gmin*qlo**3)+ref.E**2*hi**2/(gmin**3*qlo**4);
   }
   assert.ok(m>0 && Number.isFinite(M));
   bound+=alpha*M*ds**2/(8*m);
 }
 return bound;
}
const convergence=[];
for(const steps of [480,960,1920,3840])for(const ref of refs) {
 const field={peak:V,radius:R,travel:U,offset:ref.beta,background};
 const actual=samplePassage(field,{steps,extent,threshold:ref.threshold});
 const history=componentHistory(actual.samples,{density:1.225,area:1,coefficient:1.2,capacity});
 const dt=2*extent*alpha/steps;
 let speedError=0,forceError=0,expectedFirst=null,expectedPeak=0;
 for(let i=0;i<=steps;i++) {
  const t=(2*i/steps-1)*extent*alpha,s=-t/alpha;
  const expectedSpeed=Math.sqrt(ref.speed2(s)),expectedForce=K*ref.speed2(s);
  speedError=Math.max(speedError,Math.abs(expectedSpeed-actual.samples[i].speed));
  forceError=Math.max(forceError,Math.abs(expectedForce-history.states[i].force));
  expectedPeak=Math.max(expectedPeak,expectedForce);
  if(expectedForce>capacity&&expectedFirst===null)expectedFirst=i;
  assert.ok(Math.abs(actual.samples[i].time-t)<1e-12);
  assert.equal(history.states[i].failed,expectedFirst!==null);
 }
 assert.ok(speedError<1e-10 && forceError<1e-8);
 assert.equal(history.firstFailureIndex,expectedFirst);
 assert.ok(Math.abs(history.peak-expectedPeak)<1e-8);
 const onset=ref.intervals[0]?.[0]??null;
 const lag=onset===null?null:history.firstFailureTime-onset;
 if(onset===null)assert.equal(history.firstFailureTime,null);
 else assert.ok(lag>=-1e-12&&lag<=dt+1e-12);
 const bound=durationBound(ref,steps)+1e-8;
 const durationError=Math.abs(actual.aboveSeconds-ref.duration);
 assert.ok(durationError<=bound);
 convergence.push({steps,beta:ref.beta,samples:actual.samples.length,dt_seconds:dt,
  independent_first_index:expectedFirst,actual_first_index:history.firstFailureIndex,
  first_sample_seconds:history.firstFailureTime,onset_lag_seconds:lag,
  continuous_peak_N:K*ref.peak2,sampled_peak_N:history.peak,
  maximum_speed_error_m_s:speedError,maximum_force_error_N:forceError,
  continuous_duration_seconds:ref.duration,interpolated_duration_seconds:actual.aboveSeconds,
  duration_error_seconds:durationError,analytic_duration_error_bound_seconds:bound});
}

});
