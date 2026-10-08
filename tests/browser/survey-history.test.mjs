import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,base} from './harness.mjs';

const data=JSON.parse(readFileSync(new URL('../../web/data.json',import.meta.url)));
const fatality=data.history.remembrance.places[0];

for(const [width,appearance] of [[390,'dark'],[1280,'light']]){
  test(`survey choices restore through URL, history and reload at ${width}px ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
    await page.goto(base+'/survey.html?survey=270271&surveyPhotos=0');
    await page.locator('#survey-observation').waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    const state=()=>page.evaluate(()=>({url:location.href,length:history.length}));
    const starting=await state();
    await page.locator('#survey-next').click();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
    assert.equal(new URL(page.url()).searchParams.get('survey'),'270275');
    assert.equal((await state()).length,starting.length+1);
    await page.goBack();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
    await page.goForward();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270275');

    await page.locator('#survey-order').selectOption('path');
    await page.locator('#survey-rating').selectOption('EF2');
    const beforeSearch=await state();
    const search=page.locator('#survey-search');
    await search.fill('R');await search.fill('Re');await search.fill('Residences');
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('surveySearch')==='Residences'&&document.querySelector('#survey-search').value==='Residences');
    const searched=new URL(page.url());
    assert.equal(searched.searchParams.get('surveyOrder'),'path');
    assert.equal(searched.searchParams.get('surveyRating'),'EF2');
    assert.equal(searched.searchParams.get('surveySearch'),'Residences');
    assert.equal((await state()).length,beforeSearch.length+1,'One search edit sequence adds one history entry');
    const searchedId=await page.locator('#survey-observation').inputValue();
    assert.equal(searched.searchParams.get('survey'),searchedId);
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-search').inputValue(),'Residences');
    assert.equal(await page.locator('#survey-rating').inputValue(),'EF2');
    assert.equal(await page.locator('#survey-order').inputValue(),'path');
    assert.equal(await page.locator('#survey-observation').inputValue(),searchedId);
    assert.equal(await page.locator('#survey-line-selection').getAttribute('data-record'),searchedId);
    await page.goBack();
    assert.equal(await page.locator('#survey-search').inputValue(),'');
    assert.equal(await page.locator('#survey-rating').inputValue(),'EF2');
    await page.goForward();
    assert.equal(await page.locator('#survey-search').inputValue(),'Residences');

    await page.locator('#survey-search').fill('no-matching-observation');
    assert.equal(await page.locator('#survey-count').textContent(),'0 of 336 survey locations');
    assert.equal(new URL(page.url()).searchParams.has('survey'),false);
    assert.equal(await page.locator('#survey-line-selection').getAttribute('visibility'),'hidden');
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-search').inputValue(),'no-matching-observation');
    assert.equal(await page.locator('#survey-line-selection').getAttribute('visibility'),'hidden');
    await page.locator('#survey-photos-only').check();
    assert.equal(new URL(page.url()).searchParams.get('surveyPhotos'),'1');
    await page.goBack();
    assert.equal(await page.locator('#survey-photos-only').isChecked(),false);
    await page.goForward();
    assert.equal(await page.locator('#survey-photos-only').isChecked(),true);
    await page.locator('#survey-observation').selectOption('fatality:'+fatality.id);
    assert.equal(new URL(page.url()).searchParams.get('fatality'),fatality.id);
    assert.equal(new URL(page.url()).searchParams.has('survey'),false);
    const alternate=new URL(await page.locator('#survey-alternate').getAttribute('href'));
    assert.equal(alternate.searchParams.get('fatality'),fatality.id);
    assert.equal(alternate.searchParams.get('surveyRating'),'EF2');
    assert.equal(alternate.searchParams.get('surveySearch'),'no-matching-observation');
    assert.equal(alternate.searchParams.get('surveyPhotos'),'1');
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-observation').inputValue(),'fatality:'+fatality.id);
    assert.equal(await page.locator('#survey-search').inputValue(),'no-matching-observation');
    assert.equal(await page.locator('#survey-photos-only').isChecked(),true);
    await page.goBack();
    assert.equal(await page.locator('#survey-line-selection').getAttribute('visibility'),'hidden');
    assert.equal(new URL(page.url()).searchParams.has('fatality'),false);
    await page.goForward();
    assert.equal(await page.locator('#survey-observation').inputValue(),'fatality:'+fatality.id);
    await page.locator('#survey-reset').click();
    const reset=new URL(page.url());
    assert.equal(reset.searchParams.get('fatality'),fatality.id);
    assert.equal(reset.searchParams.get('surveySearch'),null);
    assert.equal(reset.searchParams.get('surveyRating'),null);
    assert.equal(reset.searchParams.get('surveyOrder'),null);
    assert.equal(reset.searchParams.get('surveyPhotos'),'1');
    await page.goBack();
    assert.equal(await page.locator('#survey-search').inputValue(),'no-matching-observation');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  });
}

test('full report survey history keeps replay time and footage source',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(base+'/index.html?t=780&footage_source=robinson-dashcam&survey=270271&surveyPhotos=0#survey-explorer');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#timeline:not([disabled])').waitFor();
  await page.locator('#survey-next').click();
  const selected=new URL(page.url());
  assert.equal(selected.searchParams.get('survey'),'270275');
  assert.equal(selected.searchParams.get('t'),'780');
  assert.equal(selected.searchParams.get('footage_source'),'robinson-dashcam');
  await page.goBack();
  assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
  assert.equal(await page.locator('#timeline').inputValue(),'780');
  await page.goForward();
  assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
  assert.equal(new URL(page.url()).searchParams.get('footage_source'),'robinson-dashcam');
});

test('survey choice during playback stores the current replay time before pausing',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(base+'/index.html?t=780&footage_source=robinson-dashcam&survey=270271&surveyPhotos=0#survey-explorer');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#timeline:not([disabled])').waitFor();
  await page.locator('#play').click();
  await page.waitForFunction(()=>Number(document.getElementById('timeline').value)>780);
  await page.locator('#survey-next').click();
  const selected=new URL(page.url()),savedTime=Number(selected.searchParams.get('t'));
  assert.ok(savedTime>780);
  assert.equal(Math.floor(savedTime),Number(await page.locator('#timeline').inputValue()));
  assert.equal(selected.searchParams.get('survey'),'270275');
  assert.equal(selected.searchParams.get('footage_source'),'robinson-dashcam');
  assert.equal(await page.locator('#play').textContent(),'Play timeline');
  assert.equal(Number(new URL(await page.locator('#survey-share').getAttribute('href')).searchParams.get('t')),savedTime);
  assert.equal(new URL(await page.locator('#survey-alternate').getAttribute('href')).searchParams.get('survey'),'270275');
  await page.reload();
  await page.locator('#survey-observation').waitFor();
  assert.equal(Math.floor(savedTime),Number(await page.locator('#timeline').inputValue()));
  assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
  await page.goBack();
  assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
  assert.equal(Math.floor(savedTime),Number(await page.locator('#timeline').inputValue()));
  await page.goForward();
  assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
  assert.equal(Math.floor(savedTime),Number(await page.locator('#timeline').inputValue()));
  await page.locator('#play').click();
  await page.waitForFunction(time=>Number(document.getElementById('timeline').value)>Math.floor(time),savedTime);
  await page.locator('#survey-observation').selectOption('fatality:'+fatality.id);
  const fatalityTime=Number(new URL(page.url()).searchParams.get('t'));
  assert.ok(fatalityTime>savedTime);
  assert.equal(Number(new URL(await page.locator('#fatality-share').getAttribute('href')).searchParams.get('t')),fatalityTime);
  assert.equal(new URL(await page.locator('#survey-alternate').getAttribute('href')).searchParams.get('fatality'),fatality.id);
});

test('filtering during replay playback refreshes the current observation share time',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(base+'/index.html?t=780&survey=270271&surveyPhotos=0#survey-explorer');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#timeline:not([disabled])').waitFor();
  await page.locator('#play').click();
  await page.waitForFunction(()=>Number(document.getElementById('timeline').value)>780);
  await page.locator('#survey-rating').selectOption('EF2');
  const saved=new URL(page.url()),time=Number(saved.searchParams.get('t'));
  assert.ok(time>780);
  assert.equal(saved.searchParams.get('surveyRating'),'EF2');
  assert.equal(await page.locator('#play').textContent(),'Play timeline');
  const share=new URL(await page.locator('#survey-share').getAttribute('href'));
  assert.equal(Number(share.searchParams.get('t')),time);
  assert.equal(share.searchParams.get('survey'),saved.searchParams.get('survey'));
  assert.equal(share.searchParams.get('surveyRating'),'EF2');
});

const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qU0AAAAASUVORK5CYII=','base64');
async function syntheticSurveyImage(page) {
  // The source image is replaced only inside this isolated browser fixture.
  await page.route('https://services.dat.noaa.gov/**',route=>route.fulfill({status:200,contentType:'image/png',body:tinyPng}));
}

test('survey Back closes a photo before replacing its opener and focuses a connected control',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await syntheticSurveyImage(page);
  await page.goto(base+'/survey.html?survey=270271&surveyPhotos=1');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#survey-next').click();
  const opener=page.locator('#survey-detail .survey-photo-open').first();
  await opener.click();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  const oldOpener=await opener.elementHandle();
  await page.goBack();
  await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
  assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
  assert.equal(await oldOpener.evaluate(node=>node.isConnected),false);
  await page.waitForFunction(()=>document.activeElement===document.getElementById('survey-observation'));
});

test('replay Back keeps an unchanged survey photo opener connected',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await syntheticSurveyImage(page);
  await page.goto(base+'/index.html?t=780&survey=270271&surveyPhotos=1#survey-explorer');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#timeline:not([disabled])').waitFor();
  await page.locator('#next').click();
  const nextTime=new URL(page.url()).searchParams.get('t');
  assert.equal(new URL(await page.locator('#survey-share').getAttribute('href')).searchParams.get('t'),nextTime);
  const opener=page.locator('#survey-detail .survey-photo-open').first();
  const oldOpener=await opener.elementHandle();
  await opener.click();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  await page.goBack();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  assert.equal(await oldOpener.evaluate(node=>node.isConnected),true);
  assert.equal(new URL(await page.locator('#survey-share').getAttribute('href')).searchParams.get('t'),'780');
  await page.goForward();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  assert.equal(await oldOpener.evaluate(node=>node.isConnected),true);
  assert.equal(new URL(await page.locator('#survey-share').getAttribute('href')).searchParams.get('t'),nextTime);
  await page.locator('#photo-close').click();
  await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
  assert.equal(await page.evaluate(()=>document.activeElement?.isConnected),true);
});
