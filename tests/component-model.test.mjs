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
