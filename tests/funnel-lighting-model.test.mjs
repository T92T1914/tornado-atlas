import test from 'node:test';
import assert from 'node:assert/strict';
import {opticalTransmission,FUNNEL_LIGHTING} from '../web/funnel-lighting-model.mjs';
import {DEFAULT_EXPERIMENTS,readExperiment,experimentURL} from '../web/experiment-state.mjs';

test('vacuum and zero-length optical paths transmit all light, including zero extinction after overflow-scale input',()=>{
  assert.equal(opticalTransmission([],[]),1);
  assert.equal(opticalTransmission([0,0],[.2,.44]),1);
  assert.equal(opticalTransmission([10,20],[0,0]),1);
  assert.equal(opticalTransmission([Number.MAX_VALUE],[Number.MAX_VALUE],0),1);
});
test('one optical-depth unit and unequal layered slabs agree with independent exponential references',()=>{
  assert.ok(Math.abs(opticalTransmission([2],[.5],1)-1/Math.E)<1e-15);
  assert.ok(Math.abs(opticalTransmission([1,3],[.2,.4],1)-.24659696394160643)<1e-15);
});
test('nonnegative attenuation is bounded, composes across slabs and cannot brighten with increased extinction',()=>{
  for(const density of [0,.1,1,100,1e308])for(const length of [0,.2,10]){
    const value=opticalTransmission([density],[length],1);
    assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
    assert.ok(opticalTransmission([density],[length],2)<=value);
    assert.ok(opticalTransmission([density],[length+1],1)<=value);
  }
  const whole=opticalTransmission([.7,.7],[.2,.44]);
  assert.ok(Math.abs(whole-opticalTransmission([.7],[.2])*opticalTransmission([.7],[.44]))<1e-15);
});
test('invalid densities, paths, extinction and extra probes are refused',()=>{
  for(const args of [[null,[]],[[],null],[[1],[]],[[1,1,1],[1,1,1]],
    [[-1],[1]],[[NaN],[1]],[[Infinity],[1]],[[1],[-1]],[[1],[NaN]],[[1],[1],Infinity],[[1],[1],-1]]){
    assert.throws(()=>opticalTransmission(...args),RangeError);
  }
  assert.equal(FUNNEL_LIGHTING.probes,2);
});
const formation={...DEFAULT_EXPERIMENTS.form,model:'genesis-v1',sequence:true,coverage:'formation',
  position:.5,phase:15,visibility:'limited',flow:true};
test('four saved form versions preserve their distinct complete state and presentation',()=>{
  for(const [version,state]of [['form-1',{...DEFAULT_EXPERIMENTS.form,phase:1000000000}],
    ['form-2',{...DEFAULT_EXPERIMENTS.form,model:'kinematic-v1',phase:15}],
    ['form-3',formation],['form-4',{...formation,lighting:'world-v1'}]]){
    const url=experimentURL('https://example.test/study.html#form-experiment','form','el-reno-2013',state);
    assert.equal(url.searchParams.get('experiment'),version);
    assert.deepEqual(readExperiment(url.search,'form').state,state);
    assert.equal(url.hash,'#form-experiment');
  }
});
test('a new material cannot silently attach to an older form or fall back from an invalid style',()=>{
  const url=experimentURL('https://example.test/study.html','form',null,{...formation,lighting:'world-v1'});
  for(const search of [url.search.replace('form-4','form-3'),url.search.replace('world-v1','invented'),
    url.search.replace('&lighting=world-v1',''),url.search+'&lighting=world-v1',url.search.replace('genesis-v1','kinematic-v1')]){
    const result=readExperiment(search,'form');assert.equal(result.status,'invalid');assert.equal(result.state,null);
  }
});
