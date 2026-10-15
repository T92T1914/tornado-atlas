import test from 'node:test';
import assert from 'node:assert/strict';
import {settledFragment} from './fragment-ready.mjs';

// Controlled protocol observations, separate from the actual no-script browser
// journeys. These verify the helper's allowance, not native page rendering.
const visible={scrollY:10,viewport:{width:390,height:844},
  fragment:{x:0,y:20,width:390,height:400},
  opener:{x:0,y:30,width:300,height:200},fragmentInView:true};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('fragment readiness accepts a stable visible section',async()=>{
  await settledFragment({evaluate:async()=>visible},'section','photo');
});

test('fragment readiness allows a 300 ms protocol sample within its three-second total',async()=>{
  await settledFragment({evaluate:async()=>{await delay(300);return visible;}},'section','photo');
});

test('fragment readiness preserves an actual protocol rejection',async()=>{
  const original=Error('controlled protocol rejection');
  await assert.rejects(settledFragment({evaluate:()=>Promise.reject(original)},'section','photo'),
    error=>error===original);
});

test('fragment readiness refuses a section that never becomes visible',{timeout:5000},async()=>{
  await assert.rejects(settledFragment({evaluate:async()=>({...visible,fragmentInView:false})},'section','photo'),
    /Initial fragment did not remain visible and steady/);
});

test('fragment readiness refuses continuously moving observations',{timeout:5000},async()=>{
  let sample=0;
  await assert.rejects(settledFragment({evaluate:async()=>({...visible,scrollY:sample++})},'section','photo'),
    /Initial fragment did not remain visible and steady/);
});

test('fragment readiness keeps its three-second total for a stalled protocol',{timeout:5000},async()=>{
  const started=performance.now();
  await assert.rejects(settledFragment({evaluate:()=>new Promise(()=>{})},'section','photo'),
    /Fragment snapshot exceeded its remaining bound/);
  assert.ok(performance.now()-started>=2900,'The shared allowance must not reject after a 200 ms subdeadline.');
});
