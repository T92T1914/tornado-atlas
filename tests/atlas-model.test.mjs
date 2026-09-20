import test from 'node:test';
import assert from 'node:assert/strict';
import {filterRecords, project, fitBounds, clampBounds, color, mapGroups, yearCoverage} from '../web/atlas-model.mjs';

const records = [
  {id:'ncei:1',title:'A, Oklahoma',state:'OKLAHOMA',area:'CANADIAN',aliases:['El Reno'],rating:'EF3',year:2013,date:'2013-05-31',point:[-98,35],exhibit:'index.html'},
  {id:'ncei:2',title:'B, Oklahoma',state:'OKLAHOMA',area:'CANADIAN',aliases:[],rating:'F3',year:1950,date:'1950-05-31',point:[-98,35],exhibit:null},
  {id:'ncei:3',title:'C, Missouri',state:'MISSOURI',area:'JASPER',aliases:['Joplin'],rating:null,year:2011,date:'2011-05-22',point:null,exhibit:null},
];
test('F3 and EF3 do not collapse into the same filter',() => {
  assert.deepEqual(filterRecords(records,{rating:'F3'}).map(r=>r.id),['ncei:2']);
  assert.deepEqual(filterRecords(records,{rating:'EF3'}).map(r=>r.id),['ncei:1']);
});
test('aliases and multiple literal terms search without replacing published titles',() => {
  assert.equal(filterRecords(records,{query:'EL RENO oklahoma'})[0].title,'A, Oklahoma');
  assert.equal(filterRecords(records,{query:'%'}).length,0);
});
test('combined filters, no matches, and exhibit availability remain separate',() => {
  assert.equal(filterRecords(records,{query:'Oklahoma',year:'2011'}).length,0);
  assert.deepEqual(filterRecords(records,{exhibits:true}).map(r=>r.id),['ncei:1']);
  assert.deepEqual(filterRecords(records,{rating:'unrated'}).map(r=>r.id),['ncei:3']);
});
test('missing coordinates remain searchable and cannot create a map marker',() => {
  assert.equal(filterRecords(records,{query:'Joplin'}).length,1);
  assert.equal(project(null),null);
  assert.equal(fitBounds([records[2]]),null);
});
test('projection preserves coordinate order and orientation',() => {
  assert.deepEqual(project([-180,90]),[0,0]);
  assert.deepEqual(project([180,-90]),[1080,540]);
  assert.equal(project([200,35]),null);
  assert.equal(project([NaN,35]),null);
  assert.equal(project([0,91]),null);
});
test('single and coincident positions retain a useful view extent',() => {
  const a = fitBounds([records[0]]),b = fitBounds([records[0],records[1]]);
  assert.deepEqual(a,b);
  assert.ok(a[2]>0 && a[3]>0);
  assert.equal(a[2]/a[3],2);
});
test('zoom and pan cannot move the entire map out of view',() => {
  assert.deepEqual(clampBounds([-999,-999,2000,1000]),[0,0,1080,540]);
  assert.deepEqual(clampBounds([2000,2000,12,6]),[1068,534,12,6]);
});
test('unrated is visually distinct from category zero',() => {
  assert.notEqual(color(null),color('EF0'));
  assert.notEqual(color('EFU'),color('F0'));
});

test('map groups conserve visible records and retain unlocated results',()=>{
  const summary=mapGroups(records,[0,0,1080,540]);
  assert.equal(summary.located,2);
  assert.equal(summary.visible,2);
  assert.equal(summary.unlocated,1);
  assert.equal(summary.groups.length,1);
  assert.deepEqual(summary.groups[0].records.map(r=>r.id),['ncei:1','ncei:2']);
  assert.equal(mapGroups(records,[0,0,12,6]).visible,0);
});

test('a large catalogue has a bounded number of rendered groups',()=>{
  const large=Array.from({length:150000},(_,i)=>({...records[0],id:String(i),point:[-180+(i%3600)/10,-90+Math.floor(i/3600)]}));
  const summary=mapGroups(large,[0,0,1080,540]);
  assert.ok(summary.groups.length<=48*24);
  assert.equal(summary.groups.reduce((n,g)=>n+g.records.length,0),large.length);
  assert.equal(summary.visible,large.length);
  assert.ok(fitBounds(large).every(Number.isFinite));
});

test('right and bottom boundary points remain inside the bounded grid',()=>{
  const summary=mapGroups([{...records[0],point:[180,-90]}],[0,0,1080,540]);
  assert.equal(summary.groups[0].key,'47:23');
  assert.throws(()=>mapGroups(records,[0,0,0,1]),RangeError);
});

test('coverage never joins missing years into an apparent continuous range',()=>{
  assert.equal(yearCoverage(['1950','2011','2013']),'1950, 2011, 2013');
  assert.equal(yearCoverage([1950,1952,1951,1955]),'1950–1952, 1955');
});
