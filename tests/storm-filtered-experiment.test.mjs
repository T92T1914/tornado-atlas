import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_EXPERIMENTS,readExperiment,experimentURL,validateExperimentState} from '../web/experiment-state.mjs';

// Literal links and complete states are independent of the URL writer.
const link='?experiment=form-9&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=1&coverage=storm-filtered&rate=1&position=0.5&phase=15&model=genesis-v1&visibility=ordinary&flow=1&presentation=storm-v4';
const state={...DEFAULT_EXPERIMENTS.form,sequence:true,coverage:'storm-filtered',position:.5,phase:15,model:'genesis-v1',visibility:'ordinary',flow:true,presentation:'storm-v4'};
test('Form9 restores its literal complete filtered state and preserves its anchor when sharing',()=>{
  const restored=readExperiment(link,'form');assert.equal(restored.status,'restored');assert.deepEqual(restored.state,state);
  const saved=experimentURL('https://atlas.invalid/study.html#form-experiment','form',null,state);
  assert.equal(saved.search,link);assert.equal(saved.hash,'#form-experiment');
});
test('Form7 and Form6 remain distinct literal predecessors rather than adopting filtered light',()=>{
  for(const [version,coverage,presentation]of [['form-7','storm-detail','storm-v2'],['form-6','storm','storm-v1']]){
    const old=link.replace('form-9',version).replace('storm-filtered',coverage).replace('storm-v4',presentation),wanted={...state,coverage,presentation};
    const restored=readExperiment(old,'form');assert.equal(restored.status,'restored');assert.deepEqual(restored.state,wanted);
    assert.equal(experimentURL('https://atlas.invalid/study.html','form',null,wanted).search,old);
  }
});
test('cross-version, reserved, missing, repeated and inconsistent filtered experiments are refused',()=>{
  for(const bad of [link.replace('form-9','form-8'),link.replace('form-9','form-7'),link.replace('storm-v4','storm-v3'),
    link.replace('storm-v4','storm-v2'),link.replace('storm-filtered','storm-detail'),link.replace('&presentation=storm-v4',''),
    link+'&presentation=storm-v4',link.replace('phase=15','phase=14.99'),link.replace('sequence=1','sequence=0')]){
    const parsed=readExperiment(bad,'form');assert.equal(parsed.status,'invalid',bad);assert.equal(parsed.state,null);
  }
  for(const bad of [{...state,coverage:'storm-detail'},{...state,presentation:'storm-v3'},{...state,model:'kinematic-v1'}])assert.throws(()=>validateExperimentState('form',bad));
});
