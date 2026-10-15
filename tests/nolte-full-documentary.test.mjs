import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateAppearanceTimeline,appearanceAt} from '../web/appearance-timeline-model.mjs';
import {documentaryPhoto} from '../web/photo-view.mjs';
const timeline=JSON.parse(await readFile(new URL('../exhibits/el-reno-2013/appearance-timeline.json',import.meta.url)));
const config=JSON.parse(await readFile(new URL('../exhibits/el-reno-2013/replay.json',import.meta.url)));
const footage=JSON.parse(await readFile(new URL('../exhibits/el-reno-2013/footage.json',import.meta.url)));
const validate=t=>validateAppearanceTimeline(t,t.event,config.clock,footage);
test('v5 admits three full documentary copies and retains accepted forms and unknown intervals',()=>{
 assert.equal(validate(timeline),timeline);const samples=timeline.photo_sequences[0].samples;
 assert.deepEqual(samples.map(s=>Boolean(s.hosted_image)),[true,true,true,false]);
 assert.deepEqual(samples.slice(0,3).map(s=>s.hosted_image.creator_report.movie_seconds),[1241,1262,1327]);
 assert.equal(samples[1].source_comparison.requested_seconds,1263.223333);
 for(const [index,at]of [397,419,482,535].entries()){
  const state=appearanceAt(timeline,at,config.clock.start_utc,{kind:'photo',id:'nolte-reported-stills'});
  assert.equal(state.sample.id,samples[index].id);assert.equal(state.shape,null);assert.equal(state.extent,null);
 }
 for(const at of [397.01,408,419.01,450,482.01])assert.equal(appearanceAt(timeline,at,config.clock.start_utc,{kind:'photo',id:'nolte-reported-stills'}).state,'unknown');
 for(const s of samples.slice(0,3)){
  const p=documentaryPhoto(s);assert.equal(p.expectedSha256,s.hosted_image.sha256);assert.notEqual(p.expectedSha256,s.image.sha256);
  assert.equal(p.asset,s.hosted_image.asset);assert.equal(p.source,s.hosted_image.original_url);assert.equal(p.selectionKey,'appearance:'+s.id);
 }
 assert.throws(()=>documentaryPhoto(samples[3]));
});
test('full references do not weaken older versions, size bounds or creator context semantics',()=>{
 for(const version of [1,2,3,4]){const t=structuredClone(timeline);t.schema_version=version;assert.throws(()=>validate(t));}
 for(const [key,value]of [['asset','../private.jpg'],['sha256',null],['sha256',timeline.photo_sequences[0].samples[0].image.sha256],['bytes',true],['bytes',2097153],['width',0]]){
  const t=structuredClone(timeline);t.photo_sequences[0].samples[0].hosted_image[key]=value;assert.throws(()=>validate(t));
 }
 for(const [key,value]of [['movie_locator','20:61'],['movie_seconds',1262.5],['kind','calibrated_registration'],['callback_seconds',1241.24],['utc','2013-05-31T23:10:37Z']]){
  const t=structuredClone(timeline);t.photo_sequences[0].samples[0].hosted_image.creator_report[key]=value;assert.throws(()=>validate(t));
 }
});
