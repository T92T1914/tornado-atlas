import test from 'node:test';
import assert from 'node:assert/strict';
import {stormTransportParameters,stormAdvect} from '../web/storm-scene-model.mjs';
import {DEFAULT_EXPERIMENTS,experimentURL,readExperiment,validateExperimentState} from '../web/experiment-state.mjs';

test('per-draw pullback factors agree with independently stated analytic values',()=>{
  for(const [seconds,wanted] of [[0,[1,1,0,0]],[10,[.697676326071031,1.1972173631218102,-.6718303865088199,0]],[30,[.3395955256449391,1.7160068621848585,-1.467565498566802,0]]]){
    const actual=stormTransportParameters(seconds);assert.ok(actual instanceof Float32Array);
    actual.forEach((value,index)=>assert.ok(Math.abs(value-wanted[index])<1e-7,`${seconds}/${index}: ${value}`));
  }
  for(const value of [-1,31,NaN,Infinity,'10',null])assert.throws(()=>stormTransportParameters(value),RangeError);
});
test('cached factors retain the declared backward flow for multiple points and times',()=>{
  for(const time of [0,6,15,24,30])for(const point of [[0,0,0],[.3,.2,-.7],[-2,3,1.4],[4,5.5,-3]]){
    const [e,scale,offset]=stormTransportParameters(time),r2=(point[0]**2+point[2]**2)/(.95**2);
    const angle=(.24/.036)*Math.log((e+r2)/(1+r2)),c=Math.cos(angle),s=Math.sin(angle);
    const cached=[scale*(c*point[0]-s*point[2]),point[1]*e+offset,scale*(s*point[0]+c*point[2])];
    const reference=stormAdvect(point,-time);
    cached.forEach((v,i)=>assert.ok(Math.abs(v-reference[i])<8e-7,`${time}/${point}/${i}`));
  }
});
const state=(presentation,coverage)=>({...DEFAULT_EXPERIMENTS.form,model:'genesis-v1',sequence:true,coverage,visibility:'ordinary',flow:true,presentation,position:.5,phase:15});
test('new complete experiments and the retained storm comparison have distinct round trips',()=>{
  for(const [presentation,coverage,version] of [['storm-v2','storm-detail','form-7'],['storm-v1','storm','form-6'],['reference-v1','reference','form-5']]){
    const wanted=state(presentation,coverage),url=experimentURL('https://atlas.invalid/study.html','form',null,wanted);
    assert.equal(new URL(url).searchParams.get('experiment'),version);
    const restored=readExperiment(new URL(url).search,'form');assert.equal(restored.status,'restored');assert.deepEqual(restored.state,wanted);
  }
});
test('cross-version, mismatched coverage and repeated new experiment fields are refused',()=>{
  const wanted=state('storm-v2','storm-detail'),url=new URL(experimentURL('https://atlas.invalid/study.html','form',null,wanted));
  url.searchParams.set('experiment','form-6');assert.equal(readExperiment(url.search,'form').status,'invalid');
  url.searchParams.set('experiment','form-7');url.searchParams.append('presentation','storm-v2');assert.equal(readExperiment(url.search,'form').status,'invalid');
  assert.throws(()=>validateExperimentState('form',{...wanted,coverage:'storm'}));
});
