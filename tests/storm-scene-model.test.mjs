import test from 'node:test';
import assert from 'node:assert/strict';
import {STORM_SCENE,stormAdvect,stormCoordinates,stormVelocity,stormFlow} from '../web/storm-scene-model.mjs';
const near=(a,b,e=1e-10)=>assert.ok(Math.abs(a-b)<=e,`${a} differs from ${b}`);
const vectorNear=(a,b,e)=>a.forEach((v,i)=>near(v,b[i],e));

test('the declared flow has independently calculated velocity and a nontrivial exact characteristic',()=>{
  assert.equal(STORM_SCENE.id,'storm-v1');
  vectorNear(stormVelocity([.95,1,0]),[-.0171,.116,.114]);
  const dt=Math.log(2)/.036,r=.95/Math.sqrt(2),angle=(.24/.036)*Math.log(3/2);
  vectorNear(stormAdvect([.95,1,0],dt),[r*Math.cos(angle),38/9,r*Math.sin(angle)]);
});
for(const t of [0,.09,6,15,24,30])test('analytic transport and its inverse agree at authored second '+t,()=>{
  for(const point of [[0,0,0],[.95,1,0],[-1.2,.1,.7],[3,3,-4]]){
    vectorNear(stormCoordinates(stormAdvect(point,t),t),point);
    vectorNear(stormAdvect(stormCoordinates(point,t),t),point);
  }
});
test('seeking and subdivision use the same autonomous characteristic rather than accumulated frames',()=>{
  for(const point of [[.3,.2,-.8],[-2,3,1],[0,1,0]]){
    vectorNear(stormAdvect(stormAdvect(point,7),11),stormAdvect(point,18));
    vectorNear(stormAdvect(stormAdvect(point,20),-14),stormAdvect(point,6));
    assert.deepEqual(stormCoordinates(point,12),stormCoordinates(point,12));
  }
});
test('radial inflow and vertical strain have a unit volume Jacobian on the inspected domain',()=>{
  const determinant=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  for(const point of [[0,.2,0],[.95,1,0],[-1,3,2]])for(const t of [6,15,30]){
    const matrix=Array.from({length:3},()=>[]),h=1e-5;
    for(let axis=0;axis<3;axis++){
      const a=point.slice(),b=point.slice();a[axis]+=h;b[axis]-=h;
      const forward=stormAdvect(a,t),backward=stormAdvect(b,t);
      for(let row=0;row<3;row++)matrix[row][axis]=(forward[row]-backward[row])/(2*h);
    }
    near(determinant(matrix),1,2e-8);
  }
});
test('inner and outer angular motion and vertical lift follow the declared field',()=>{
  for(const radius of [.2,.95,3]){
    const [vx,vy,vz]=stormVelocity([radius,.1,0]);
    assert.ok(vx<0&&vy>0&&vz>0);near(vx/radius,-.018);
  }
  assert.ok(stormVelocity([.2,0,0])[2]/.2>stormVelocity([3,0,0])[2]/3);
  const h=1e-6,p=[.7,.4,-.3],plus=stormAdvect(p,h),minus=stormAdvect(p,-h);
  vectorNear(plus.map((v,i)=>(v-minus[i])/(2*h)),stormVelocity(p),2e-9);
});
test('projected circulation arrows agree with the flow and keep a normalized display length',()=>{
  const lines=stormFlow(15,.7);assert.equal(lines.length,432);
  for(let i=0;i<lines.length;i+=18){
    const point=[lines[i],lines[i+1],lines[i+2]],dx=lines[i+3]-point[0],dz=lines[i+5]-point[2];
    near(Math.hypot(dx,dz),.15,1e-7);
    const [vx,,vz]=stormVelocity(point);assert.ok(dx*vx+dz*vz>0);
  }
});
test('invalid or excessive transport inputs fail without a silent clamp',()=>{
  for(const point of [null,[0,0],[Infinity,0,0],[0,NaN,0],[1025,0,0]])assert.throws(()=>stormAdvect(point,1),RangeError);
  for(const seconds of [NaN,Infinity,-30.1,30.1])assert.throws(()=>stormAdvect([0,0,0],seconds),RangeError);
  for(const [seconds,strength] of [[-1,1],[31,1],[0,-.1],[0,NaN]])assert.throws(()=>stormFlow(seconds,strength),RangeError);
});
