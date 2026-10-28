import test from 'node:test';
import assert from 'node:assert/strict';
import {readExperiment,experimentURL,validateExperimentState} from '../web/experiment-state.mjs';
const literal='experiment=form-6&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=1&coverage=storm&rate=1&position=0.5&phase=15&model=genesis-v1&visibility=ordinary&flow=1&presentation=storm-v1';
const state={shape:'cone',condensation:100,azimuth:25,elevation:12,distance:7,dust:true,quality:7200,sequence:true,coverage:'storm',rate:1,position:.5,phase:15,model:'genesis-v1',visibility:'ordinary',flow:true,presentation:'storm-v1'};
test('the literal form-6 contract retains every declared assumption and source-independent time',()=>{
  assert.deepEqual(readExperiment(literal,'form').state,state);
  const url=experimentURL('https://example.test/study.html#form-experiment','form','el-reno-2013',state);
  assert.equal(url.searchParams.get('experiment'),'form-6');assert.equal(url.hash,'#form-experiment');
  assert.deepEqual(readExperiment(url.search,'form').state,state);
});
test('storm fields cannot borrow an earlier version or a different presentation',()=>{
  for(const query of [literal.replace('form-6','form-5'),literal.replace('coverage=storm','coverage=reference'),literal.replace('storm-v1','reference-v1'),literal+'&lighting=world-v1',literal+'&presentation=storm-v1',literal.replace('&presentation=storm-v1','')]){
    const result=readExperiment(query,'form');assert.equal(result.status,'invalid',query);assert.equal(result.state,null);
  }
  assert.throws(()=>validateExperimentState('form',{...state,presentation:'storm-v2'}));
});
test('storm position, phase and sequence keep the existing strict replay contract',()=>{
  for(const change of [{phase:15.1},{position:.5001},{sequence:false},{phase:31}])assert.throws(()=>validateExperimentState('form',{...state,...change}));
  const old=literal.replace('form-6','form-5').replace('coverage=storm','coverage=reference').replace('storm-v1','reference-v1');
  assert.equal(readExperiment(old,'form').status,'restored');assert.equal(readExperiment(old,'form').state.presentation,'reference-v1');
});
