import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,base} from './harness.mjs';
import {surveyRoute,orderSurvey} from '../../web/survey-route.mjs';

const data=JSON.parse(readFileSync(new URL('../../web/data.json',import.meta.url)));
const expected=orderSurvey(data.survey.points,surveyRoute(data.survey.points,data.geometry),'path');
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
