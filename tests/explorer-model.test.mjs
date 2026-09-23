import test from 'node:test';
import assert from 'node:assert/strict';
import {filterRecords} from '../web/atlas-model.mjs';
import {positionStatus,usablePoints,inside,screenGroups,readExplorerLink,writeExplorerLink} from '../web/explorer-model.mjs';
const row=(id,point,extra={})=>({id,title:'Place',state:'CALIFORNIA',aliases:[],year:1997,date:'1997-05-18',point,...extra});
const rows=[row('reported',[-117,34]),row('coincident',[-117,34]),row('missing',null),row('disputed',[-12.18,34.6],{location_quality:'disputed'})];
test('disputed and missing are distinct and remain searchable without moving coordinates',()=>{
  assert.equal(positionStatus(rows[2]),'missing');assert.equal(positionStatus(rows[3]),'disputed');
  assert.equal(filterRecords(rows,{query:'1997-05-18'}).length,4);
  assert.deepEqual(usablePoints(rows).map(r=>r.id),['reported','coincident']);
  assert.deepEqual(rows[3].point,[-12.18,34.6]);
});
test('visible aggregation conserves counts and leaves coincident records selectable',()=>{
  const summary=screenGroups(rows,p=>p,[ -180,0,180,90]);
  assert.equal(summary.visible,2);assert.equal(summary.missing,1);assert.equal(summary.disputed,1);
  assert.equal(summary.groups.length,1);assert.equal(summary.groups[0].records.length,2);
  assert.deepEqual(summary.groups[0].point,[-117,34]);
  assert.equal(screenGroups(rows,p=>p,[0,0,180,90]).visible,0);
});
test('screen aggregation has bounded bins at the actual collection scale',()=>{
  const many=Array.from({length:80318},(_,i)=>row(String(i),[-120+i%60,20+i%25]));
  const summary=screenGroups(many,p=>[(p[0]+180)*8,(90-p[1])*8],[0,0,2880,1440]);
  assert.equal(summary.visible,many.length);assert.ok(summary.groups.length<=40*20);
  assert.equal(summary.groups.reduce((sum,g)=>sum+g.records.length,0),many.length);
});
test('area boundaries retain exact points without world wrapping or guessing missing values',()=>{
  assert.ok(inside([-117,34],[-117,34,-116,35]));assert.equal(inside(null,[-180,-85,180,85]),false);
  assert.equal(inside([181,0],[-180,-85,180,85]),false);
});
test('view, area, layer, attachment and stable identity round trip independently of clusters',()=>{
  const state={filters:{query:'El Reno',year:'2013',rating:'EF3',state:'OKLAHOMA',exhibits:true},recordId:'ncei:453682',view:[35,-98,12],area:[-99,34,-97,36],layer:'local',media:'storm-2',quality:'reported',hasMedia:true};
  const url=new URL(writeExplorerLink(state),'https://example.com/atlas.html');assert.deepEqual(readExplorerLink(url.search,url.hash),state);
  assert.ok(!url.href.includes('cluster'));
});
test('malformed views and areas cannot become guessed map positions',()=>{
  for(const query of ['?view=,0,4','?view=NaN,0,4','?view=86,0,4','?view=0,181,4','?view=0,0,30'])assert.equal(readExplorerLink(query).view,null);
  for(const query of ['?area=1,0,-1,1','?area=0,0,1,','?area=-181,-1,1,1'])assert.equal(readExplorerLink(query).area,null);
  assert.equal(readExplorerLink('?layer=unknown').layer,'topo');
  assert.equal(readExplorerLink('','#record=ncei%3A1').recordId,'ncei:1');
});
test('sharing an area preserves records on sub-meter boundaries',()=>{
  const area=[-97.123456789,35.123456789,-96.987654321,36.987654321];
  const url=new URL(writeExplorerLink({filters:{},area}),'https://example.com/atlas.html');
  const restored=readExplorerLink(url.search).area;
  assert.deepEqual(restored,area);
  for(const point of [[area[0],area[1]],[area[2],area[3]],[area[0]-1e-8,area[1]]])
    assert.equal(inside(point,restored),inside(point,area));
});
