import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {filterRecords,readSearchLink,writeSearchLink} from '../web/atlas-model.mjs';

const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const frozen=await read('./fixtures/catalogue-dossier-discovery.json');
const catalogue=await read('../web/catalogue/index.json');
const expected=new Map(frozen.groups.flatMap(group=>group.records.map(id=>[id,group.route])));
const byId=new Map(catalogue.records.map(row=>[row.id,row]));

test('the published reviewed-account filter includes all fifteen accepted source records',()=>{
  assert.equal(expected.size,15);
  const actual=filterRecords(catalogue.records,{exhibits:true});
  assert.deepEqual(actual.map(row=>row.id).sort(),[...expected.keys()].sort());
  for(const row of actual){
    assert.equal(row.exhibit,expected.get(row.id));
    assert.ok(row.aliases.length);
  }
  assert.equal(expected.has(frozen.unrelated_record),false);
  assert.equal(byId.get(frozen.unrelated_record).exhibit,null);
  assert.equal(actual.some(row=>row.id===frozen.unrelated_record),false);
});

test('known-name queries retain each separately recorded county segment',()=>{
  for(const group of frozen.groups){
    const actual=filterRecords(catalogue.records,{query:group.query,exhibits:true});
    assert.deepEqual(actual.map(row=>row.id).sort(),[...group.records].sort(),group.query);
    assert.ok(actual.every(row=>row.exhibit===group.route));
  }
  assert.deepEqual(filterRecords(catalogue.records,{query:'Udall 1955',state:'KANSAS',exhibits:true})
    .map(row=>row.id).sort(),['ncei:10027629','ncei:10027630','ncei:10027631','ncei:10027632']);
  assert.deepEqual(filterRecords(catalogue.records,{query:'Udall 1955',year:'2013',exhibits:true}),[]);
});

test('the existing query, filter and selected-record syntax round trips for every accepted association',()=>{
  for(const group of frozen.groups){
    for(const id of group.records){
      const filters={query:group.query,year:'',rating:'',state:'',exhibits:true};
      const url=new URL(writeSearchLink(filters,id),'https://example.invalid/atlas.html');
      const restored=readSearchLink(url.search,url.hash);
      assert.deepEqual(restored,{filters,recordId:id});
      assert.ok(filterRecords(catalogue.records,restored.filters).some(row=>row.id===id));
    }
  }
});
