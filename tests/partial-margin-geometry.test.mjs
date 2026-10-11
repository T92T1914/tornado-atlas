import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildMarginGeometry} from '../web/form-renderer.mjs';
test('open margin uses one isotropic reference plane across aspect ratios',()=>{
 const a=buildMarginGeometry([[0,0],[1,1]],800,600),b=buildMarginGeometry([[0,0],[1,1]],1000,600);
 assert.deepEqual(Array.from(a.points).slice(0,2),[120,20]);
 assert.deepEqual(Array.from(a.points).slice(3,5),[680,580]);
 assert.equal(b.points[3]-b.points[0],a.points[3]-a.points[0]);assert.equal(b.points[4]-b.points[1],a.points[4]-a.points[1]);
 assert.equal(a.vertices.length,12);assert.ok(Math.abs(a.totalLength-Math.hypot(560,560))<.0001);
});
test('margin rejects missing, nonfinite, duplicate, closed and unbounded coordinates',()=>{
 for(const points of [[],[[0,0]],Array(65).fill([0,0]),[[0,0],[0,0]],[[0,0],[1,1],[0,0]],[[0,0],[NaN,1]],[[0,0],[Infinity,1]],[[0,0],[1.1,1]],[[0,0],new Array(2)],[[0,0],[1]]])assert.throws(()=>buildMarginGeometry(points,800,600),TypeError);
});
test('margin cannot publish nonfinite packed coordinates or empty display geometry',()=>{
 assert.equal(buildMarginGeometry([[0,0],[1,1]],40,40),null);
 assert.throws(()=>buildMarginGeometry([[0,0],[1,1]],1e40,1e40),TypeError);
 assert.throws(()=>buildMarginGeometry([[0,0],[1,1]],0,600),TypeError);
});
