import test from 'node:test';
import assert from 'node:assert/strict';
import {formationAt,formationFlow} from '../web/formation-model.mjs';
import {formationSimulationAt} from '../web/ground-view-model.mjs';
import {readExperiment,experimentURL} from '../web/experiment-state.mjs';

test('circulation precedes continuous condensation without requiring dust as its definition',()=>{
  const initial=formationAt(0),early=formationAt(4),mature=formationAt(15),end=formationAt(30);
  assert.equal(initial.circulation,0);assert.equal(initial.condensation,0);
  assert.ok(early.circulation>.6);assert.equal(early.condensation,0);assert.ok(early.dust<early.circulation);
  assert.deepEqual([mature.circulation,mature.condensation,mature.dust,mature.erosion],[1,1,1,0]);
  assert.deepEqual([end.circulation,end.condensation,end.dust,end.erosion],[0,0,0,1]);
});
test('condensation comparison changes opacity without changing geometry, circulation, dust or time',()=>{
  const ordinary=formationAt(15),limited=formationAt(15,{visibility:'limited'});
  assert.equal(limited.condensation,.22);
  for(const field of ['seconds','progress','circulation','dust','erosion','extent','stage'])assert.equal(limited[field],ordinary[field]);
  assert.deepEqual(limited.shape,ordinary.shape);
  assert.deepEqual(formationAt(15,{flow:false}),{...ordinary,flow:false});
});
test('closed form evaluation is bounded and repeatable across shuffled time schedules',()=>{
  const times=[0,1,4,4.8,6.6,12.6,15,19.5,21.6,29.1,30],expected=times.map(t=>formationAt(t));
  for(const t of times.slice().reverse())assert.deepEqual(formationAt(t),expected[times.indexOf(t)]);
  for(let i=0;i<=3000;i++){
    const s=formationAt(i/100);
    for(const field of ['progress','circulation','condensation','dust','erosion'])assert.ok(s[field]>=0&&s[field]<=1);
    assert.ok(s.shape.base>=.02&&s.shape.base<=1.6&&s.shape.flare>=0&&s.shape.flare<=1.2&&Math.abs(s.shape.bend)<=.7);
    if(i){const before=formationAt((i-1)/100);for(const field of ['circulation','condensation','dust','erosion'])assert.ok(Math.abs(s[field]-before[field])<.005);}
  }
  for(const t of [-.001,30.001,Infinity,NaN,'15'])assert.throws(()=>formationAt(t));
  for(const options of [{visibility:'measured'},{flow:1}])assert.throws(()=>formationAt(15,options));
});
test('the shared replay uses a declared linear scenario mapping and does not populate gaps',()=>{
  for(const [player,scenario]of [[120,0],[124,6],[130,15],[136,24],[140,30]]){
    const s=formationSimulationAt(player,'synthetic-front');assert.equal(s.formationTime,scenario);assert.equal(s.motionModel,'genesis-v1');
    assert.deepEqual(s.shape,formationAt(scenario).shape);assert.equal(s.reference,null);assert.equal(s.time,player);
  }
  for(const t of [0,119.99,140.01])assert.equal(formationSimulationAt(t,'synthetic-front').shape,null);
  assert.equal(formationSimulationAt(130,'unknown').shape,null);
});
test('modeled flow is finite fixed-size display geometry and does not claim wind magnitudes',()=>{
  const lines=formationFlow(15,1);assert.equal(lines.length,432);assert.ok([...lines].every(Number.isFinite));
  assert.deepEqual(lines,formationFlow(15,1));assert.notDeepEqual(lines,formationFlow(16,1));
  assert.deepEqual(lines,formationFlow(15,.1));
  for(const input of [[NaN,1],[31,1],[0,-1],[0,1.01]])assert.throws(()=>formationFlow(...input));
});
const literal='experiment=form-3&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=1&coverage=formation&rate=1&position=0.5&phase=15&model=genesis-v1&visibility=limited&flow=1';
test('literal formation links version all assumptions while preserving old model contracts',()=>{
  const result=readExperiment(literal,'form');assert.equal(result.status,'restored');assert.equal(result.state.phase,15);assert.equal(result.state.visibility,'limited');
  const url=experimentURL('https://example.test/study.html','form',null,result.state);
  assert.equal(url.searchParams.get('experiment'),'form-3');assert.deepEqual(readExperiment(url.search,'form').state,result.state);
  for(const query of [literal.replace('form-3','form-2'),literal.replace('phase=15','phase=15.1'),literal.replace('sequence=1','sequence=0'),literal.replace('&flow=1',''),literal+'&flow=0',literal.replace('genesis-v1','kinematic-v1'),literal.replace('coverage=formation','coverage=continuous')])assert.equal(readExperiment(query,'form').status,'invalid',query);
});
