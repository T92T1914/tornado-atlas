import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, HEIGHT, radiusAt, particles, advanceTime, cameraMatrix } from '../web/vortex-model.mjs';

test('particle layout is repeatable, bounded and changes with seed', () => {
  const a=particles(7200,42),b=particles(7200,42),c=particles(7200,43);
  assert.deepEqual(a,b);assert.notDeepEqual(a,c);
  for(let i=0;i<a.length;i++) assert.ok(Number.isFinite(a[i]) && a[i]>=0 && (i%4===3?a[i]<=2:a[i]<1));
});
test('particle budget rejects unbounded and invalid allocations', () => {
  for(const count of [0,-1,12001,Infinity,NaN,3.2]) assert.throws(()=>particles(count),RangeError);
});
test('forms have positive continuous radii and wedge preset is wider than height at base', () => {
  for(const shape of Object.keys(PRESETS)) {
    let previous=0;
    for(let i=0;i<=100;i++) {const r=radiusAt(shape,i/100);assert.ok(r>0 && r>=previous);previous=r;}
  }
  assert.ok(2*radiusAt('wedge',0)>=HEIGHT);
  assert.throws(()=>radiusAt('EF5',.5),RangeError);
  assert.throws(()=>radiusAt('cone',1.1),RangeError);
});
test('normal animation timing is refresh-rate independent and hidden gaps do not catch up', () => {
  let a=0,b=0;
  for(let i=0;i<60;i++) a=advanceTime(a,1/60,true);
  for(let i=0;i<144;i++) b=advanceTime(b,1/144,true);
  assert.ok(Math.abs(a-b)<1e-10);
  assert.equal(advanceTime(3,20,false),3);
  assert.equal(advanceTime(3,20,true),3.05);
  assert.throws(()=>advanceTime(0,-1,true),RangeError);
});
test('camera remains finite throughout permitted orbit and aspect ranges', () => {
  for(const a of [-180,0,180]) for(const e of [3,12,60]) for(const ratio of [.3,1,3]) {
    const m=cameraMatrix(a,e,7,ratio);assert.equal(m.length,16);assert.ok([...m].every(Number.isFinite));
  }
  for(const args of [[0,90,7,1],[0,12,7,0],[NaN,12,7,1]]) assert.throws(()=>cameraMatrix(...args),RangeError);
});
test('camera points the target toward the center and keeps ground in front', () => {
  const m=cameraMatrix(25,12,7,1.5);
  const transform=p=>[0,1,2,3].map(row=>p.reduce((sum,v,col)=>sum+m[col*4+row]*v,0));
  const target=transform([0,1.15,0,1]);
  assert.ok(Math.abs(target[0])<1e-6 && Math.abs(target[1])<1e-6 && target[3]>0);
  const ground=transform([0,0,0,1]);assert.ok(ground[1]<0 && ground[3]>0);
});
