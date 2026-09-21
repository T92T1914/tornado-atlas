import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterSurvey, surveyProjection, surveyLink, surveyState, surveyViewBox} from '../web/survey-model.mjs';

const data = JSON.parse(readFileSync(new URL('../web/data.json', import.meta.url)));

test('rating and description filters preserve the original observation records', () => {
  const points=data.survey.points;
  assert.equal(filterSurvey(points, 'EF3').length, 12);
  const result=filterSurvey(points, 'EF3', '  RIGID FRAMES ');
  assert.ok(result.length>0);
  assert.ok(result.every(p=>p.rating==='EF3' && /rigid frames/i.test(p.degree)));
  assert.ok(result.every(p=>points.includes(p)));
  assert.equal(filterSurvey(points,'','not-a-survey-observation').length,0);
  assert.equal(filterSurvey(points,'',String(points[0].id))[0],points[0]);
});

test('projected included points fit the displayed map without changing geography', () => {
  const rings=data.geometry.features.find(f=>f.geometry.type==='Polygon').geometry.coordinates;
  const before=JSON.stringify(data.survey.points);
  const {project, scale}=surveyProjection(rings);
  assert.ok(scale>0 && Number.isFinite(scale));
  for(const p of data.survey.points){const [x,y]=project(p.coordinates);assert.ok(x>=0 && x<=960 && y>=0 && y<=430);}
  assert.equal(JSON.stringify(data.survey.points),before);
});

test('photo availability combines with rating and text, without inventing coverage', () => {
  const {points}=data.survey, {photos}=data.survey_media;
  assert.equal(filterSurvey(points,'','',photos).length,45);
  const found=filterSurvey(points,'EF3','rigid',photos);
  assert.ok(found.length>0);
  assert.ok(found.every(p=>p.rating==='EF3' && photos[p.id]?.length));
  assert.equal(filterSurvey(points,'','',{}).length,0);
  assert.equal(filterSurvey(points).length,336);
});

test('shared links restore the observation and all filters while keeping unrelated parameters', () => {
  const state={id:165486,rating:'EF3',query:'rigid frames & roof',photosOnly:false};
  const url=surveyLink('https://example.org/exhibit/?time=9&survey=123#path',state);
  assert.deepEqual(surveyState(url),state);
  assert.equal(new URL(url).searchParams.get('time'),'9');
  assert.equal(new URL(url).hash,'#survey-explorer');
  for(const id of ['-1','1.5','Infinity','9007199254740993','']) assert.equal(surveyState('?survey='+id).id,null);
  assert.equal(surveyState('https://example.org').photosOnly,true);
});

test('zoom stays within the map and preserves the chosen location near boundaries', () => {
  assert.deepEqual(surveyViewBox(1,[0,0]),[0,0,960,430]);
  assert.deepEqual(surveyViewBox(4,[960,430]),[720,322.5,240,107.5]);
  for(const center of [[0,0],[480,215],[960,430]]) {
    const [x,y,w,h]=surveyViewBox(2,center);
    assert.ok(x>=0 && y>=0 && x+w<=960 && y+h<=430);
    assert.ok(center[0]>=x && center[0]<=x+w && center[1]>=y && center[1]<=y+h);
  }
  assert.throws(()=>surveyViewBox(0),RangeError);
  assert.throws(()=>surveyViewBox(2,[NaN,3]),RangeError);
});
