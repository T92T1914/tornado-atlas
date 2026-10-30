import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_EXPERIMENTS,experimentURL,readExperiment,validateExperimentState} from '../web/experiment-state.mjs';
const state=(presentation,coverage)=>({...DEFAULT_EXPERIMENTS.form,model:'genesis-v1',sequence:true,coverage,visibility:'ordinary',flow:true,presentation,position:.5,phase:15});
test('integrated cloud experiments preserve complete v8 and earlier v7 identities',()=>{
  for(const [presentation,coverage,version] of [['storm-v3','storm-integrated','form-8'],['storm-v2','storm-detail','form-7']]){
    const wanted=state(presentation,coverage),url=experimentURL('https://atlas.invalid/study.html','form','el-reno-2013',wanted);
    assert.equal(url.searchParams.get('experiment'),version);
    const result=readExperiment(url.search,'form');assert.equal(result.status,'restored');assert.equal(result.event,'el-reno-2013');assert.deepEqual(result.state,wanted);
    for(const position of [0,.2,.8,1]){const point={...wanted,position,phase:position*30};assert.deepEqual(readExperiment(experimentURL(url.href,'form',null,point).search,'form').state,point);}
  }
});
test('v8 links refuse cross-version fields, duplicates and partial restoration',()=>{
  const wanted=state('storm-v3','storm-integrated'),url=experimentURL('https://atlas.invalid/study.html','form',null,wanted);
  for(const [key,value] of [['experiment','form-7'],['presentation','storm-v2'],['coverage','storm-detail'],['phase','14'],['model','kinematic-v1']]){const changed=new URL(url);changed.searchParams.set(key,value);assert.equal(readExperiment(changed.search,'form').status,'invalid',key);}
  const duplicate=new URL(url);duplicate.searchParams.append('presentation','storm-v3');assert.equal(readExperiment(duplicate.search,'form').status,'invalid');
  const partial=new URL(url);partial.searchParams.delete('phase');assert.equal(readExperiment(partial.search,'form').status,'invalid');
  assert.throws(()=>validateExperimentState('form',{...wanted,coverage:'storm-detail'}));
});
