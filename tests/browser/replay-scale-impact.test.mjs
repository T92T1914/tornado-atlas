import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
const url=()=>base+'/reconstruction.html?event=el-reno-2013&t=1261&appearance_view=photo&appearance_photo=wakimoto-visible-margin';
async function ready(page){await page.goto(url());await page.locator('#replay-time:not([disabled])').waitFor();await page.locator('#replay-scale-impact').waitFor();}
async function capture(page,name){if(!process.env.ATLAS_SCALE_IMPACT_CAPTURE)return;await mkdir(process.env.ATLAS_SCALE_IMPACT_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_SCALE_IMPACT_CAPTURE,name+'.png'),fullPage:false});}
for(const [width,theme] of [[320,'dark'],[1280,'light']])test('source-defined scale and original damage remain connected to the replay at '+width,async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.addInitScript(theme=>localStorage.setItem('tornado-atlas-appearance',theme),theme);await ready(page);
  await page.locator('#replay-scale-jump').click();assert.equal(await page.locator('#replay-time').inputValue(),'1261');
  const section=page.locator('#replay-scale-impact');
  const sourceText=await section.textContent();
  for(const text of ['500 m','800 m','2.6 miles','2° elevation','does not repeat','not assigned to every replay instant','No width is assigned to its final 23:25:09 photograph','not a simulated collapse','does not establish event membership'])assert.ok(sourceText.includes(text),text);
  const bars=await page.locator('.replay-width-reference span').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().width/node.parentElement.getBoundingClientRect().width));
  assert.ok(Math.abs(bars[1]/bars[0]-1.6)<.025);assert.ok(Math.abs(bars[2]/bars[0]-8.3685888)<.035);
  const enlargement=await section.evaluate(section=>{const rows=[section,...section.querySelectorAll('*')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);for(const [node,size] of rows)node.style.fontSize=size*2+'px';return {count:rows.length,doubled:rows.every(([node,size])=>Math.abs(parseFloat(getComputedStyle(node).fontSize)-size*2)<.1)};});
  assert.equal(enlargement.doubled,true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  t.diagnostic('REPLAY_SCALE_IMPACT_READING '+JSON.stringify({width,theme,enlargement,bars}));
  await page.locator('#replay-scale-impact-heading').scrollIntoViewIfNeeded();await capture(page,width+'-scale');
  await page.locator('#replay-impact-photo').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const image=document.getElementById('replay-impact-image');return image.complete&&image.naturalWidth===1280&&image.naturalHeight===960;});
  await capture(page,width+'-damage');await page.locator('#replay-impact-photo').click();
  await page.waitForFunction(()=>document.getElementById('photo-status')?.textContent==='The displayed image matches the reviewed file.');
  assert.equal(await page.locator('#photo-full').evaluate(image=>image.naturalWidth),1280);
  assert.equal(await page.evaluate(()=>['photo-caption','photo-location','photo-credit'].every(id=>Boolean(document.getElementById(id).compareDocumentPosition(document.getElementById('photo-status'))&Node.DOCUMENT_POSITION_FOLLOWING))),true,'Historical account and credit precede file verification');
  assert.match(await page.locator('#photo-caption').textContent(),/EF2.*not been established/);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),'https://www.weather.gov/oun/events-20130531');
  assert.equal(await page.locator('#replay-time').inputValue(),'1261');await capture(page,width+'-damage-enlarged');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'replay-impact-photo');
  await page.locator('#replay-survey-jump').click();await page.locator('#survey-observation').waitFor();
  assert.equal(await page.locator('#replay-time').inputValue(),'1261');assert.equal(await page.locator('#photo-status').count(),1);assert.equal(await page.locator('#photo-retry').count(),1);
  await page.locator('#replay-impact-dossier').click();await page.locator('#media-nws-el-reno-roof-loss-04').waitFor();
  assert.match(await page.locator('#media-nws-el-reno-roof-loss-04').textContent(),/Exact camera coordinates and capture time remain unregistered/);
  await page.goBack();await page.locator('#replay-time:not([disabled])').waitFor();assert.equal(await page.locator('#replay-time').inputValue(),'1261');
  await page.locator('#replay-time').fill('1269');assert.equal(await section.isVisible(),true);assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-partial-form'),'true');
});

test('failed aftermath image preserves its account and checked retry without changing event time',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:1000}});
  const imagePattern='**/assets/el-reno-2013/damage04.jpg';await page.route(imagePattern,route=>route.fulfill({status:404,body:'Unavailable fixture image'}));
  await ready(page);await page.locator('#replay-impact-photo').scrollIntoViewIfNeeded();await page.locator('#replay-impact-image-failure').waitFor();
  assert.match(await page.locator('#replay-impact-example').textContent(),/EF2/);
  const target=await page.locator('#replay-impact-photo').boundingBox();assert.ok(target.height>=44&&target.width>=44);
  assert.equal(await page.locator('#replay-impact-photo span').isVisible(),true);assert.equal(await page.locator('#replay-impact-photo span').textContent(),'Enlarge original photograph');
  t.diagnostic('FAILED_DAMAGE_TARGET '+JSON.stringify(target));await page.locator('#replay-impact-photo').click();
  await page.locator('#photo-retry').waitFor();assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.match(await page.locator('#photo-caption').textContent(),/Capture time and the order of structural failures have not been established/);
  await page.unroute(imagePattern);await page.locator('#photo-retry').click();await page.waitForFunction(()=>document.getElementById('photo-status').textContent==='The displayed image matches the reviewed file.');
  assert.equal(await page.locator('#replay-time').inputValue(),'1261');await page.keyboard.press('Escape');
});
