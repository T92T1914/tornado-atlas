import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceMatches} from '../web/source-filter.mjs';
import {surveyPageLink} from '../web/survey-model.mjs';

test('source search combines terms across fields and respects collection', () => {
  const source = {title:'Vehicle account',publisher:'NOAA',use:'Approximate recovery location',group:'Research'};
  assert.equal(sourceMatches(source,'  NOAA recovery  ','Research'),true);
  assert.equal(sourceMatches(source,'recovery invented'),false);
  assert.equal(sourceMatches(source,'recovery','Official records'),false);
  assert.equal(sourceMatches(source,''),true);
});
test('focused view preserves selected survey state but excludes unrelated page state', () => {
  const out = new URL(surveyPageLink('https://example.test/index.html?survey=165661&surveyPhotos=0&surveySearch=tree&footage=robinson-03&surveyRating=EF2','survey.html'));
  assert.equal(out.pathname,'/survey.html');
  assert.equal(out.searchParams.get('survey'),'165661');
  assert.equal(out.searchParams.get('surveyPhotos'),'0');
  assert.equal(out.searchParams.get('surveySearch'),'tree');
  assert.equal(out.searchParams.has('footage'),false);
  assert.equal(out.hash,'#survey-explorer');
});
test('fatality selection survives the return to the full report', () => {
  const out = new URL(surveyPageLink('https://example.test/survey.html?fatality=twistex-recovery','index.html'));
  assert.equal(out.searchParams.get('fatality'),'twistex-recovery');
  assert.equal(out.pathname,'/index.html');
});
