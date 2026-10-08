import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,base} from './harness.mjs';

const data=JSON.parse(readFileSync(new URL('../../web/data.json',import.meta.url)));
const params=page=>new URL(page.url()).searchParams;

for(const [width,appearance] of [[390,'dark'],[1280,'light']]){
  test(`selected surveyed outcome stays with the replay clock at ${width}px ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=783&footage_source=robinson-dashcam&survey=270271&surveyPhotos=0#survey-explorer');
    await page.locator('#survey-observation').waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.equal(await page.locator('#replay-damage').getAttribute('open'),'');
    assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
    await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord==='270271');
    assert.match(await page.locator('#replay-damage-status').textContent(),/270271.*no assigned impact time/);
    assert.match(await page.locator('#replay-appearance-state').textContent(),/Checked original frame/);
    const source=data.survey.points.find(point=>point.id===270271).source_url;
    assert.equal(await page.locator('#survey-detail a').filter({hasText:'Open this NWS record'}).getAttribute('href'),source);
    await page.locator('#survey-next').click();
    assert.equal(params(page).get('survey'),'270275');
    assert.equal(params(page).get('t'),'783');
    assert.equal(params(page).get('footage_source'),'robinson-dashcam');
    assert.equal(new URL(await page.locator('#replay-link').getAttribute('href')).searchParams.get('survey'),'270275');
    await page.locator('#replay-time').fill('782');
    assert.match(await page.locator('#replay-appearance-state').textContent(),/Appearance unknown/);
    assert.equal(new URL(await page.locator('#survey-share').getAttribute('href')).searchParams.get('t'),'782');
    await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord==='270275');
    await page.goBack();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
    assert.equal(await page.locator('#replay-time').inputValue(),'783');
    await page.goForward();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
    assert.equal(await page.locator('#replay-time').inputValue(),'782');
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
    assert.equal(await page.locator('#replay-time').inputValue(),'782');
    await page.locator('#survey-search').fill('no-matching-observation');
    assert.equal(await page.locator('#survey-count').textContent(),'0 of 336 survey locations');
    await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord==='');
    assert.equal(await page.locator('#replay-damage-status').isVisible(),false);
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-count').textContent(),'0 of 336 survey locations');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.equal(await page.locator('#registered-footage iframe').count(),0);
  });
}

test('opening damage is lazy and a survey choice captures the running replay',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(base+'/reconstruction.html?t=780&footage_source=robinson-dashcam');
  await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#survey-observation').count(),0);
  await page.locator('#replay-damage summary').focus();
  await page.keyboard.press('Enter');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#survey-photos-only').uncheck();
  await page.locator('#survey-observation').selectOption('270271');
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>785);
  await page.locator('#survey-next').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  assert.ok(Number(params(page).get('t'))>785);
  assert.ok(Math.abs(Number(params(page).get('t'))-Number(await page.locator('#replay-time').inputValue()))<=0.5,'The one-second slider displays the retained fractional clock');
  assert.equal(params(page).get('survey'),'270275');
  assert.equal(params(page).get('footage_source'),'robinson-dashcam');
  const pausedSecond=await page.locator('#replay-time').inputValue();
  await page.goBack();
  assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
  assert.equal(await page.locator('#replay-time').inputValue(),pausedSecond);
});

test('unavailable survey photograph and fatality selection retain their distinct sources and clock',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844}});
  const point=data.survey.points.find(row=>data.survey_media.photos[String(row.id)]?.length);
  await page.goto(base+`/reconstruction.html?t=900&survey=${point.id}&surveyPhotos=0`);
  await page.locator('#survey-observation').waitFor();
  await page.locator('.survey-photo-open:disabled').first().waitFor();
  assert.match(await page.locator('.survey-photo-open:disabled').first().textContent(),/Photograph unavailable from the source/);
  assert.equal(await page.locator('#survey-detail a').filter({hasText:'Open this NWS record'}).getAttribute('href'),point.source_url);
  assert.equal(await page.locator('#replay-time').inputValue(),'900');
  const fatality=data.history.remembrance.places[0];
  await page.locator('#survey-observation').selectOption('fatality:'+fatality.id);
  assert.equal(params(page).get('fatality'),fatality.id);
  assert.equal(params(page).get('t'),'900');
  await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord==='');
  assert.equal(await page.locator('#replay-damage-status').isVisible(),false);
  await page.reload();
  await page.locator('#survey-observation').waitFor();
  assert.equal(await page.locator('#survey-observation').inputValue(),'fatality:'+fatality.id);
  assert.equal(await page.locator('#replay-time').inputValue(),'900');
});

test('an unavailable survey target retains the clock and explains the replacement at enlarged text',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844}});
  await page.goto(base+'/reconstruction.html?t=783&survey=999999&surveyPhotos=0');
  await page.locator('#survey-observation').waitFor();
  await page.addStyleTag({content:'html {font-size:200%}'});
  assert.match(await page.locator('#survey-link-status').textContent(),/999999 is unavailable/);
  assert.equal(await page.locator('#replay-time').inputValue(),'783');
  assert.match(await page.locator('#replay-damage-status').textContent(),/no assigned impact time/);
  const selected=Number(await page.locator('#survey-observation').inputValue());
  assert.equal(await page.locator('#survey-detail a').filter({hasText:'Open this NWS record'}).getAttribute('href'),data.survey.points.find(point=>point.id===selected).source_url);
  await page.locator('#survey-order').selectOption('path');
  assert.match(await page.locator('#survey-line-context').textContent(),/does not establish when damage occurred/);
  assert.equal(params(page).get('t'),'783');
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
    overflow:[...document.querySelectorAll('body *')].filter(e=>{
      const r=e.getBoundingClientRect();return r.right>innerWidth+1 &&
        !e.closest('.survey-photo-strip,.timeline-table-wrap');
    }).map(e=>({tag:e.tagName,id:e.id,class:String(e.className),right:e.getBoundingClientRect().right}))}));
  assert.ok(layout.scroll<=layout.width+1,JSON.stringify(layout));
});

test('a browser without the geographic canvas keeps the documentary and survey source route',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844}});
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='2d'?null:original.call(this,type,...args);};
  });
  await page.goto(base+'/reconstruction.html?t=783&survey=270271');
  await page.locator('#replay-error:not([hidden])').waitFor();
  assert.match(await page.locator('#replay-error').textContent(),/source map and historical account remain available/);
  assert.equal(await page.locator('#replay-content').isVisible(),false);
  assert.equal(await page.locator('#replay-documentary').getAttribute('href'),'index.html');
  assert.equal(await page.locator('#survey-observation').count(),0);
  await page.locator('#replay-documentary').click();
  await page.locator('#survey-observation').waitFor();
  assert.ok(await page.locator('#survey-detail a').filter({hasText:'Open this NWS record'}).getAttribute('href'));
});
