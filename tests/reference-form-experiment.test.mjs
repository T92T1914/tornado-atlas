import test from 'node:test';
import assert from 'node:assert/strict';
import {readExperiment,experimentURL,validateExperimentState} from '../web/experiment-state.mjs';

// Literal contract independent of the production serializer and page defaults.
const literal='experiment=form-5&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=1&coverage=reference&rate=1&position=0.5&phase=15&model=genesis-v1&visibility=limited&flow=1&presentation=reference-v1';
const expected={shape:'cone',condensation:100,azimuth:25,elevation:12,distance:7,dust:true,quality:7200,
  sequence:true,coverage:'reference',rate:1,position:.5,phase:15,model:'genesis-v1',visibility:'limited',flow:true,presentation:'reference-v1'};
function refused(query){const result=readExperiment(query,'form');assert.equal(result.status,'invalid',query);assert.equal(result.state,null,query);assert.equal(result.event,null,query);}

test('literal form-5 restores the complete reference assumptions without historical assignment',()=>{
  const result=readExperiment(literal,'form');
  assert.equal(result.status,'restored');assert.equal(result.event,null);assert.deepEqual(result.state,expected);
  assert.equal(Object.hasOwn(result.state,'lighting'),false);
});
test('form-5 serialization keeps its exact version, documentary context and fragment',()=>{
  const url=experimentURL('https://example.test/study.html?obsolete=1#form-experiment','form','el-reno-2013',expected);
  assert.equal(url.pathname,'/study.html');assert.equal(url.hash,'#form-experiment');
  assert.deepEqual(Object.fromEntries(url.searchParams),Object.fromEntries(new URLSearchParams(literal+'&event=el-reno-2013')));
  const restored=readExperiment(url.search,'form');assert.equal(restored.event,'el-reno-2013');assert.deepEqual(restored.state,expected);
});
test('missing, repeated and unknown reference presentations refuse every linked value',()=>{
  for(const query of [literal.replace('&presentation=reference-v1',''),literal+'&presentation=reference-v1',literal.replace('reference-v1','invented')])refused(query);
});
test('reference fields cannot silently attach to any earlier form version',()=>{
  for(const version of ['form-1','form-2','form-3','form-4'])refused(literal.replace('form-5',version));
  const earlier=literal.replace('form-5','form-4').replace('coverage=reference','coverage=formation').replace('presentation=reference-v1','lighting=world-v1');
  assert.equal(readExperiment(earlier,'form').status,'restored');
  refused(earlier+'&presentation=reference-v1');
});
test('form-5 refuses borrowed coverage, motion and legacy lighting assumptions',()=>{
  for(const query of [literal.replace('coverage=reference','coverage=formation'),literal.replace('genesis-v1','kinematic-v1'),literal+'&lighting=world-v1'])refused(query);
  assert.throws(()=>validateExperimentState('form',{...expected,coverage:'formation'}));
  assert.throws(()=>validateExperimentState('form',{...expected,lighting:'world-v1'}));
});
test('reference experiments require the authored sequence and exact phase-position agreement',()=>{
  for(const query of [literal.replace('sequence=1','sequence=0'),literal.replace('phase=15','phase=15.1'),literal.replace('position=0.5','position=0.5001'),literal.replace('phase=15','phase=31')])refused(query);
  assert.throws(()=>validateExperimentState('form',{...expected,sequence:false}));
  assert.throws(()=>validateExperimentState('form',{...expected,phase:15.1}));
});
