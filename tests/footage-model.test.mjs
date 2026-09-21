import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {anchorAt,sourceLink,sourceTime,matchPassages} from '../web/footage-model.mjs';
const data=JSON.parse(readFileSync(new URL('../exhibits/el-reno-2013/footage.json',import.meta.url)));
test('checked clock maps to the reviewed upload position',()=>{
  for(const anchor of data.anchors)assert.equal(anchorAt(data.anchors,anchor.utc),anchor);
});
test('gaps and later frames do not inherit a registration',()=>{
  const first=Date.parse(data.anchors[0].utc);
  for(const delta of [-60000,-500,-1,1000,30000,60000])assert.equal(anchorAt(data.anchors,new Date(first+delta).toISOString()),null);
  assert.equal(anchorAt(data.anchors,new Date(first+999).toISOString()),data.anchors[0]);
  assert.equal(anchorAt(data.anchors,'not a date'),null);
});
test('original source links retain identity and a bounded integer seek',()=>{
  assert.equal(sourceLink(data.sources[0],data.anchors[0]),'https://www.youtube.com/watch?v=MxgU1QcFMJM&t=5s');
  assert.equal(sourceTime(86.81),'1:26');
});
test('report search requires all terms and treats punctuation literally',()=>{
  const rows=[{title:'Camera clocks',text:'UTC source timing'},{title:'Remembrance',text:'Vehicle recovery location'}];
  assert.deepEqual(matchPassages(rows,' camera UTC '),[rows[0]]);
  assert.deepEqual(matchPassages(rows,'recovery camera'),[]);
  assert.deepEqual(matchPassages(rows,'[.*]'),[]);
  assert.deepEqual(matchPassages(rows,''),[]);
  assert.equal(matchPassages([...rows,...rows],'camera',1).length,1);
});
