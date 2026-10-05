import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,base} from './harness.mjs';
import {surveyRoute,orderSurvey} from '../../web/survey-route.mjs';
import {surveyProjection} from '../../web/survey-model.mjs';

const data=JSON.parse(readFileSync(new URL('../../web/data.json',import.meta.url)));
const expected=orderSurvey(data.survey.points,surveyRoute(data.survey.points,data.geometry),'path');
const project=surveyProjection(data.geometry.features.find(f=>f.geometry.type==='Polygon').geometry.coordinates).project;
for(const [width,appearance] of [[390,'dark'],[1280,'light']]) {
  test(`survey path order, source and non-map selection ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
    await page.goto(base+'/survey.html?surveyPhotos=0');
    await page.locator('#survey-order').waitFor();await page.locator('#reading-appearance').selectOption(appearance);
    await page.locator('#survey-order').selectOption('path');
    const options=page.locator('#survey-observation optgroup').last().locator('option');
    assert.deepEqual(await options.evaluateAll(rows=>rows.map(row=>Number(row.value))),expected.map(p=>p.id));
    const middle=expected[Math.floor(expected.length/2)];
    await page.locator('#survey-observation').selectOption(String(middle.id));
    assert.ok((await page.locator('#survey-detail').textContent()).includes('not an impact time'));
    await page.locator('#survey-next').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#survey-observation').inputValue(),String(expected[Math.floor(expected.length/2)+1].id));
    await page.locator('#survey-previous').click();
    const shared=await page.locator('#survey-share').getAttribute('href');
    assert.equal(new URL(shared).searchParams.get('surveyOrder'),'path');
    await page.goto(shared);
    assert.equal(await page.locator('#survey-order').inputValue(),'path');
    assert.equal(await page.locator('#survey-observation').inputValue(),String(middle.id));
    await page.locator('#survey-alternate').click();
    await page.locator('#survey-order').waitFor();
    assert.equal(await page.locator('#survey-order').inputValue(),'path');
    assert.equal(await page.locator('#survey-observation').inputValue(),String(middle.id));
    await page.goBack();await page.locator('#survey-order').waitFor();
    assert.equal(await page.locator('#survey-observation').inputValue(),String(middle.id));
    assert.equal(await page.locator('a').filter({hasText:'Inspect the original NWS center line and outline'}).getAttribute('href'),
      data.geometry.features.find(f=>f.properties.role==='published_center_path').properties.source_url);
    // Map interaction is not needed to read the same assessment and derived distance.
    await page.locator('#survey-map').evaluate(node=>node.remove());
    await page.locator('#survey-next').click();
    assert.ok((await page.locator('#survey-detail').textContent()).includes('Nearest mapped segment'));
    await page.locator('#survey-reset').click();
    assert.equal(await page.locator('#survey-order').inputValue(),'records');
    assert.equal(new URL(await page.locator('#survey-share').getAttribute('href')).searchParams.has('surveyOrder'),false);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false);
    const fatality=data.history.remembrance.places[0];
    await page.locator('#survey-order').selectOption('path');
    await page.locator('#survey-observation').selectOption('fatality:'+fatality.id);
    assert.equal(new URL(await page.locator('#fatality-share').getAttribute('href')).searchParams.get('surveyOrder'),'path');
    await page.locator('#survey-reset').click();
    assert.equal(new URL(await page.locator('#fatality-share').getAttribute('href')).searchParams.has('surveyOrder'),false);
  });
}

for(const [width,appearance] of [[390,'dark'],[1280,'light']]) {
  test(`selected survey feature is visibly associated with its nearest mapped line ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
    await page.goto(base+'/survey.html?survey=270271&surveyPhotos=0');
    await page.locator('#survey-observation').waitFor();await page.locator('#reading-appearance').selectOption(appearance);
    const point=data.survey.points.find(p=>p.id===270271),position=surveyRoute([point],data.geometry).positions.get(point.id);
    const drawing=coordinates=>coordinates.map((coordinate,i)=>(i?'L':'M')+project(coordinate).join(',')).join(' ');
    const selection=page.locator('#survey-line-selection'),connector=page.locator('#survey-line-connector');
    assert.equal(await selection.getAttribute('visibility'),'visible');
    assert.equal(await selection.getAttribute('data-record'),String(point.id));
    assert.equal(await connector.getAttribute('d'),drawing([point.coordinates,position.coordinates]));
    assert.equal(await page.locator('#survey-line-segment').getAttribute('d'),drawing(position.segment));
    const marker=page.locator('#survey-line-point');
    const square=await marker.evaluate(node=>({x:Number(node.getAttribute('x')),y:Number(node.getAttribute('y')),size:Number(node.getAttribute('width'))}));
    const nearest=project(position.coordinates);
    assert.ok(Math.abs(square.x+square.size/2-nearest[0])<1e-9);
    assert.ok(Math.abs(square.y+square.size/2-nearest[1])<1e-9);
    const initialMarkerBox=await marker.boundingBox();
    assert.ok(Math.abs(initialMarkerBox.width-12)<.1,'Nearest point has a 10 CSS px square with a 2 px border');
    assert.ok((await page.locator('#survey-line-context').textContent()).includes('2.5 km from it'));
    assert.ok((await page.locator('#survey-line-context').textContent()).includes('does not establish when damage occurred'));
    const readableComparison=await page.locator('#survey-line-detail').textContent();
    assert.ok(readableComparison.includes(`${position.coordinates[1].toFixed(3)}°N`));
    assert.ok(readableComparison.includes('2.5 km from this surveyed feature'));
    assert.equal(await connector.evaluate(node=>getComputedStyle(node).stroke),appearance==='dark'?'rgb(244, 244, 244)':'rgb(36, 36, 36)');
    await page.locator('#survey-zoom-in').click();
    const markerBox=await marker.boundingBox();
    assert.ok(Math.abs(markerBox.width-initialMarkerBox.width)<.1,`Nearest-point marker keeps its rendered size after zoom: ${markerBox.width} CSS px`);
    await page.locator('#survey-order').selectOption('path');
    await page.locator('#survey-next').focus();await page.keyboard.press('Enter');
    assert.equal(await selection.getAttribute('data-record'),await page.locator('#survey-observation').inputValue());
    assert.notEqual(await connector.getAttribute('d'),drawing([point.coordinates,position.coordinates]));
    await page.locator('#survey-observation').selectOption('fatality:'+data.history.remembrance.places[0].id);
    assert.equal(await selection.getAttribute('visibility'),'hidden');
    assert.equal(await selection.getAttribute('data-record'),null);
    assert.equal(await page.locator('#survey-line-context').isVisible(),false);
    // An empty damage result has no stale spatial annotation.
    await page.locator('#survey-observation').selectOption(String(point.id));
    await page.locator('#survey-search').fill('not-a-survey-observation');
    assert.equal(await selection.getAttribute('visibility'),'hidden');
    await page.locator('#survey-reset').click();
    assert.equal(await selection.getAttribute('visibility'),'visible');
    assert.equal(await selection.getAttribute('data-record'),await page.locator('#survey-observation').inputValue());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  });
}
