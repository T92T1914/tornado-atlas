import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fatalityLabel, nearbyFatalities, nearbySurveyPhotos, fatalityLink} from '../web/impact-model.mjs';
import {surveyLink} from '../web/survey-model.mjs';

const history=JSON.parse(readFileSync(new URL('../exhibits/el-reno-2013/history.json',import.meta.url)));
const places=history.remembrance.places;

test('fatality counts cannot be confused with unrated survey observations',()=>{
  assert.equal(fatalityLabel(places[0]),'3 deaths');
  assert.equal(fatalityLabel({...places[0],deaths:1}),'1 death');
  for(const p of [{rating:'N/A'}, {...places[0],deaths:0}, {...places[0],category:'EF3'}])
    assert.throws(()=>fatalityLabel(p),RangeError);
});

test('nearby accounts are spatial references without modifying survey identity',()=>{
  const point={id:165661,coordinates:[-97.90037985,35.47907251],indicator:'Other (O)'};
  const before=JSON.stringify(point);
  assert.equal(nearbyFatalities(point,places)[0].id,'twistex-recovery');
  assert.deepEqual(nearbyFatalities(point,places,.01),[]);
  assert.deepEqual(nearbyFatalities({coordinates:[0,0]},places),[]);
  assert.equal(JSON.stringify(point),before);
});

test('sharing a fatality or damage observation cannot reopen the opposite selection',()=>{
  const link=fatalityLink('https://example.org/?survey=165661&surveyRating=EF3&surveyPhotos=1&time=9','twistex-recovery');
  const url=new URL(link);
  assert.equal(url.searchParams.get('fatality'),'twistex-recovery');
  assert.equal(url.searchParams.get('time'),'9');
  assert.equal(url.searchParams.has('survey'),false);
  assert.equal(url.searchParams.has('surveyRating'),false);
  assert.equal(url.hash,'#survey-explorer');
  const damage=surveyLink(link,{id:165661,photosOnly:true});
  assert.equal(new URL(damage).searchParams.has('fatality'),false);
  assert.throws(()=>fatalityLink(link,'../invalid'),RangeError);
});

test('fatality photo context includes only nearby photographed records, without identifying them',()=>{
  const points=[
    {id:1,coordinates:[-97.90037985,35.47907251],indicator:'Other (O)'},
    {id:2,coordinates:[0,0]},
    {id:3,coordinates:[...places[0].coordinates]},
    {id:4,coordinates:[...places[0].coordinates]}
  ];
  const media={1:[{url:'first'}],2:[{url:'far'}],3:[],4:[{url:'nearest'}]};
  const original=JSON.stringify({points,media,places});
  const matches=nearbySurveyPhotos(places[0],points,media);
  assert.deepEqual(matches.map(row=>row.point.id),[4,1]);
  assert.equal(matches[1].point.indicator,'Other (O)');
  assert.equal(matches[1].point.people,undefined);
  assert.deepEqual(nearbySurveyPhotos(places[0],points,{},.25),[]);
  assert.deepEqual(nearbySurveyPhotos(places[0],points,media,.01).map(row=>row.point.id),[4]);
  assert.equal(JSON.stringify({points,media,places}),original);
});
