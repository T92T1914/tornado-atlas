import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {surveyRoute, orderSurvey} from '../web/survey-route.mjs';
import {surveyState, surveyLink, surveyPageLink} from '../web/survey-model.mjs';

const geometry = coordinates => ({features:[{geometry:{type:'LineString',coordinates},properties:{role:'published_center_path',source_url:'https://example.org/line'}}]});
test('independent equatorial right-angle fixture has expected distances and clamped endpoints',()=>{
  const points=[{id:1,coordinates:[.5,.1]},{id:2,coordinates:[1,.5]},{id:3,coordinates:[-.1,0]}];
  const shape=geometry([[0,0],[1,0],[1,1]]), before=JSON.stringify({points,shape});
  const route=surveyRoute(points,shape), factor=111.195*Math.cos(Math.PI/540);
  assert.ok(Math.abs(route.lengthKm-(factor+111.195))<1e-9);
  assert.ok(Math.abs(route.positions.get(1).alongKm-.5*factor)<1e-9);
  assert.ok(Math.abs(route.positions.get(1).offsetKm-11.1195)<1e-9);
  assert.deepEqual(route.positions.get(1).coordinates,[.5,0]);
  assert.equal(route.positions.get(1).segmentIndex,0);
  assert.deepEqual(route.positions.get(1).segment,[[0,0],[1,0]]);
  assert.ok(Math.abs(route.positions.get(2).alongKm-(factor+55.5975))<1e-9);
  assert.deepEqual(route.positions.get(2).coordinates,[1,.5]);
  assert.equal(route.positions.get(2).segmentIndex,1);
  assert.equal(route.positions.get(3).alongKm,0);
  assert.deepEqual(route.positions.get(3).coordinates,[0,0]);
  assert.equal(JSON.stringify({points,shape}),before);
  assert.deepEqual(orderSurvey([points[1],points[0],points[2]],route,'path').map(p=>p.id),[3,1,2]);
});

test('nearest mapped point retains the earlier original segment at a loop and skips zero-length segments',()=>{
  const point={id:1,coordinates:[.5,.1]};
  const shape=geometry([[0,0],[0,0],[1,0],[0,0]]),before=JSON.stringify({point,shape});
  const position=surveyRoute([point],shape).positions.get(1);
  assert.equal(position.segmentIndex,1);
  assert.deepEqual(position.coordinates,[.5,0]);
  assert.deepEqual(position.segment,[[0,0],[1,0]]);
  position.segment[0][0]=99;
  assert.equal(JSON.stringify({point,shape}),before);
});
test('ambiguous/missing paths and repeated vertices do not manufacture a route',()=>{
  const shape=geometry([[0,0],[0,0],[1,0]]);
  assert.ok(surveyRoute([],shape));
  assert.equal(surveyRoute([],geometry([[0,0],[0,0]])),null);
  assert.equal(surveyRoute([],{features:[]}),null);
  shape.features.push(shape.features[0]);assert.equal(surveyRoute([],shape),null);
});
test('path order is carried through share links and focused/full report routes',()=>{
  const state={id:42,rating:'EF3',query:'roof',photosOnly:false,order:'path'};
  const shared=surveyLink('https://example.org/index.html?time=12&surveyOrder=records',state);
  assert.deepEqual(surveyState(shared),state);
  const focused=surveyPageLink(shared,'survey.html');
  assert.deepEqual(surveyState(focused),state);assert.equal(new URL(focused).searchParams.has('time'),false);
  assert.equal(surveyState('?surveyOrder=made-up').order,'records');
  assert.equal(new URL(surveyLink(shared,{...state,order:'records'})).searchParams.has('surveyOrder'),false);
});
test('retained survey geometry and record order remain unchanged after spatial browsing',()=>{
  const data=JSON.parse(readFileSync(new URL('../web/data.json',import.meta.url)));
  const before=JSON.stringify(data),route=surveyRoute(data.survey.points,data.geometry);
  assert.ok(route.lengthKm>20 && route.lengthKm<40);
  const sorted=orderSurvey(data.survey.points,route,'path');
  assert.equal(sorted.length,336);assert.ok(sorted.every(p=>data.survey.points.includes(p)));
  assert.equal(new Set(sorted.map(p=>p.id)).size,336);
  assert.ok([...route.positions.values()].every(p=>p.alongKm>=0&&p.alongKm<=route.lengthKm&&p.offsetKm>=0));
  assert.equal(orderSurvey(data.survey.points,route),data.survey.points);
  assert.equal(JSON.stringify(data),before);
});
