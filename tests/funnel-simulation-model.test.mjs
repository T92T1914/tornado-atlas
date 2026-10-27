import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationTime,simulationBackingSize,simulationParticles,inverseCameraMatrix} from '../web/funnel-simulation-model.mjs';
import {GROUND_CAMERAS,groundViewAt,funnelSimulationAt} from '../web/ground-view-model.mjs';
import {sourceCameraProjection} from '../web/source-camera-model.mjs';

test('the procedural time domain is explicit and cannot silently wrap or coerce',()=>{
  for(const t of [0,120,140,86400])assert.equal(simulationTime(t),t);
  for(const t of [-1,86400.001,Infinity,NaN,'120',null])assert.throws(()=>simulationTime(t),RangeError);
});

test('particle quality retains the same seeded trajectories and roles in its common prefix',()=>{
  const small=simulationParticles(100,17),large=simulationParticles(12000,17);
  assert.deepEqual(small,large.slice(0,small.length));assert.deepEqual(small,simulationParticles(100,17));
  assert.notDeepEqual(small,simulationParticles(100,18));
  for(let i=0;i<large.length;i+=4){for(let k=0;k<3;k++)assert.ok(large[i+k]>=0&&large[i+k]<1);assert.ok([0,1,2].includes(large[i+3]));}
});

test('the simulation fragment budget uses one frame-preserving scale at narrow and large sizes',()=>{
  assert.deepEqual(simulationBackingSize(826,428,1),{width:512,height:265});
  assert.deepEqual(simulationBackingSize(280,430,2),{width:208,height:320});
  assert.deepEqual(simulationBackingSize(1920,1080,2),{width:512,height:288});
  assert.deepEqual(simulationBackingSize(200,100,1),{width:200,height:100});
  assert.deepEqual(simulationBackingSize(826,428,1,'lighter'),{width:320,height:166});
  assert.deepEqual(simulationBackingSize(280,430,2,'lighter'),{width:130,height:200});
  assert.throws(()=>simulationBackingSize(826,428,1,'unbounded'),RangeError);
  for(const dimensions of [[0,1,1],[1,-1,1],[1,1,NaN],[Infinity,1,1]])assert.throws(()=>simulationBackingSize(...dimensions));
});

test('invalid sample budgets and seeds fail before allocating an unbounded field',()=>{
  for(const [count,seed]of [[99,1],[12001,1],[100.5,1],[100,NaN],[100,1.5]])assert.throws(()=>simulationParticles(count,seed),RangeError);
});

test('a known identity has its exact inverse and singular/nonfinite matrices fail',()=>{
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];assert.deepEqual([...inverseCameraMatrix(identity)],identity);
  for(const value of [null,[],Array(16).fill(0),[NaN,...identity.slice(1)]])assert.throws(()=>inverseCameraMatrix(value));
});

test('the actual inverse reconstructs an independently declared off-center front-camera ray',()=>{
  const matrix=sourceCameraProjection(GROUND_CAMERAS[0].camera,1280,720).matrix,inv=inverseCameraMatrix(matrix);
  const point=z=>{const v=[.125,1/6,z,1],r=[0,0,0,0];for(let row=0;row<4;row++)for(let c=0;c<4;c++)r[row]+=inv[c*4+row]*v[c];return r.slice(0,3).map(x=>x/r[3]);};
  const near=point(-1),far=point(1),d=far.map((x,i)=>x-near[i]),norm=Math.hypot(...d),ray=d.map(x=>x/norm);
  const expectedNear=[.008888888888889,.182653928101077,6.90237190985154];
  const expectedRay=[.088345220859877,.225153706661261,-.970309708458034];
  near.forEach((x,i)=>assert.ok(Math.abs(x-expectedNear[i])<3e-5));ray.forEach((x,i)=>assert.ok(Math.abs(x-expectedRay[i])<3e-5));
});

test('the original six references and geometry remain separate from the new procedural profile',()=>{
  for(const c of GROUND_CAMERAS)for(const t of [120,130,140]){
    const old=groundViewAt(t,c.id),current=funnelSimulationAt(t,c.id);
    assert.equal(old.reference,`assets/ground-view-demo/${c.id}-${t}.svg`);
    assert.equal(current.reference,null);assert.equal(current.motionModel,'kinematic-v1');
    assert.deepEqual(current.camera,old.camera);assert.notDeepEqual(current.shape,old.shape);
    assert.equal(current.time,t);assert.equal(current.extent,1);
  }
  assert.deepEqual(funnelSimulationAt(120,'synthetic-front').shape,{base:.42,flare:.70,bend:.10});
});

test('neither missing cameras nor neighboring unsupported instants acquire a procedural form',()=>{
  for(const t of [0,119.999,140.001,2280])assert.equal(funnelSimulationAt(t,'synthetic-front').shape,null);
  assert.equal(funnelSimulationAt(130,'unassigned-camera').shape,null);
  assert.throws(()=>funnelSimulationAt(NaN,'synthetic-front'));
});
