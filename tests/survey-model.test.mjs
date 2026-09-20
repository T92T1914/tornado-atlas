import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterSurvey, surveyProjection} from '../web/survey-model.mjs';

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
