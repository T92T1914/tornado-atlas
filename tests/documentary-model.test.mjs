import test from 'node:test';
import assert from 'node:assert/strict';
import {issuedAt,activeWarnings,splitPercent} from '../web/documentary-model.mjs';
import {inverseProjection,geographicBounds,basemapRequest} from '../web/geography-model.mjs';
const rows=[{id:'first',event_id:'57',issued:'2013-05-31T22:36:00Z',expires:'2013-05-31T23:15:00Z',polygon:[1]},
 {id:'update',event_id:'57',issued:'2013-05-31T22:50:00Z',expires:'2013-05-31T23:15:00Z',polygon:[2]},
 {id:'second',event_id:'58',issued:'2013-05-31T23:08:00Z',expires:'2013-06-01T00:00:00Z',polygon:[3]}];
test('clock never exposes future bulletins, including one millisecond early',()=>{
 assert.deepEqual(issuedAt(rows,'2013-05-31T23:07:59.999Z').map(r=>r.id),['first','update']);
 assert.equal(issuedAt(rows,'2013-05-31T23:08:00Z').at(-1).id,'second');
 assert.deepEqual(issuedAt(rows,'2013-05-31T20:00:00Z'),[]);
});
test('updates supersede their own event while overlapping warnings remain',()=>{
 assert.deepEqual(activeWarnings(rows,'2013-05-31T23:10:00Z').map(r=>r.id),['update','second']);
 assert.deepEqual(activeWarnings(rows,'2013-05-31T23:15:00Z').map(r=>r.id),['second']);
 assert.deepEqual(activeWarnings(rows,'2013-06-01T00:00:00Z'),[]);
});
test('comparison boundaries reveal one complete frame',()=>{assert.equal(splitPercent(-10),0);assert.equal(splitPercent(101),100);assert.equal(splitPercent(NaN),50);});
test('basemap bounds round trip the local projection, including panned views',()=>{
 const project=([lon,lat])=>[(lon+98)*2000,500-(lat-35)*2500];const inverse=inverseProjection(project);
 for(const p of [[-97.9,35.4],[-98.05,35.6]]){const actual=inverse(project(p));actual.forEach((v,i)=>assert.ok(Math.abs(v-p[i])<1e-9));}
 const bounds=geographicBounds([100,0,500,400],inverse);assert.ok(bounds[0]<bounds[2]&&bounds[1]<bounds[3]);
 const request=new URL(basemapRequest('streets',bounds));assert.equal(request.searchParams.get('imageSR'),'4326');assert.equal(request.searchParams.get('f'),'json');
 assert.throws(()=>basemapRequest('untrusted',bounds));
});
