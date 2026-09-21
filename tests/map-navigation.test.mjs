import test from 'node:test';
import assert from 'node:assert/strict';
import {constrainView,zoomView,panView,wheelFactor} from '../web/map-navigation-model.mjs';
const extent=[0,0,960,430];
test('cursor stays at the same relative position during zoom away from boundaries',()=>{
  const v=[100,60,480,215],anchor=[280,150],z=zoomView(v,.6,anchor,extent,60);
  for(let i=0;i<2;i++)assert.ok(Math.abs((anchor[i]-v[i])/v[i+2]-(anchor[i]-z[i])/z[i+2])<1e-12);
});
test('zoom limits use the actual clamped scale instead of the requested scale',()=>{
  assert.deepEqual(zoomView([0,0,960,430],.0001,[480,215],extent,60),[450,201.5625,60,26.875]);
  assert.deepEqual(zoomView([450,201.5625,60,26.875],100,[480,215],extent,60),extent);
});
test('dragging stays bounded on every edge and retains the map aspect ratio',()=>{
  assert.deepEqual(panView([100,100,480,215],[500,500],extent,60),[0,0,480,215]);
  assert.deepEqual(panView([100,100,480,215],[-1000,-1000],extent,60),[480,215,480,215]);
});
test('map extents with a nonzero origin are supported',()=>{
  assert.deepEqual(constrainView([-100,-100,10,1],[20,30,100,50],10),[20,30,10,5]);
});
test('wheel devices normalize pixel line and page units and bound large deltas',()=>{
  assert.equal(wheelFactor(16),wheelFactor(1,1));
  assert.equal(wheelFactor(120),wheelFactor(.2,2,600));
  assert.equal(wheelFactor(10000),wheelFactor(200));
  assert.equal(wheelFactor(0),1);
});
test('invalid numerical inputs cannot poison the SVG viewBox',()=>{
  assert.throws(()=>constrainView([NaN,0,10,5],extent),RangeError);
  assert.throws(()=>zoomView(extent,0,[0,0],extent),RangeError);
  assert.throws(()=>zoomView(extent,Infinity,[0,0],extent),RangeError);
});
