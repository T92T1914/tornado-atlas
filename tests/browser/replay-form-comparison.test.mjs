import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture,base} from './harness.mjs';
import {enlargeText,reflow,exactPlayingComparisonSeconds} from './ground-view-assertions.mjs';

const replay='reconstruction.html?event=el-reno-2013&appearance_view=formation&appearance_style=storm-v2&ground_view=synthetic-oblique&t=130.011&footage_source=robinson-dashcam';
async function ready(page){await page.locator('#replay-time:not([disabled])').waitFor();}
async function studyReady(page){await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();}
async function capture(page,name){
  if(!process.env.ATLAS_SCREENSHOT_DIR)return;
  const bytes=await page.screenshot({fullPage:false,animations:'allow',timeout:10000});
  assert.ok(bytes.length<=2097152,'Each whole viewport capture retains its 2 MiB cap');
  await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});
  await writeFile(join(process.env.ATLAS_SCREENSHOT_DIR,name),bytes,{flag:'wx'});
}

for(const [width,appearance,keyboard] of [[320,'dark',false],[1280,'light',true]])test(`Replay phase comparison opens paused and retains native return at ${width}`,{timeout:60000},async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.goto(base+'/'+replay);await ready(page);await page.locator('#reading-appearance').selectOption(appearance);
  const link=page.locator('#ground-study-link');await link.waitFor({state:'visible'});
  const destination=await link.getAttribute('href'),target=new URL(destination),origin=page.url();
  assert.equal(target.pathname,new URL(base+'/study.html').pathname);assert.equal(target.hash,'#form-experiment');
  assert.equal(target.searchParams.get('experiment'),'form-7');assert.equal(target.searchParams.get('presentation'),'storm-v2');
  assert.equal(target.searchParams.get('position'),'0.501');assert.equal(Number(target.searchParams.get('phase')),.501*30);
  assert.equal(target.searchParams.get('visibility'),'ordinary');assert.equal(target.searchParams.get('rate'),'1');
  assert.match(await page.locator('#ground-study-note').textContent(),/15.0165.*15.03/);
  assert.match(await page.locator('#ground-study-note').textContent(),/own camera, quality and playback defaults/);
  assert.match(await page.locator('#ground-study-note').textContent(),/not a historical time or camera match/);
  await enlargeText(page);await reflow(page);await link.focus();
  assert.equal(await link.evaluate(node=>node===document.activeElement),true);
  await capture(page,`comparison-link-${width}.png`);
  await Promise.all([page.waitForURL(destination),keyboard?page.keyboard.press('Enter'):link.click()]);await studyReady(page);
  assert.equal(await page.locator('#sequence-time').inputValue(),'0.501');assert.equal(await page.locator('#sequence-rate').inputValue(),'1');
  assert.equal(await page.locator('#motion').textContent(),'Play motion');assert.equal(await page.locator('#lab-event').inputValue(),'el-reno-2013');
  for(const [id,value] of [['azimuth','25'],['elevation','12'],['distance','7'],['quality','7200']])assert.equal(await page.locator('#'+id).inputValue(),value);
  assert.equal(await page.locator('#dust').isChecked(),true);assert.equal(await page.locator('#flow-cues').isChecked(),true);
  assert.equal(await page.locator('#form-experiment').evaluate(node=>node===document.activeElement),true);
  await page.locator('#form-experiment').scrollIntoViewIfNeeded();await capture(page,`comparison-form-${width}.png`);
  const phaseBefore=await page.locator('#sequence-time').inputValue();await page.locator('#condensation-visibility').selectOption('limited');
  assert.equal(await page.locator('#sequence-time').inputValue(),phaseBefore);assert.equal(await page.locator('#motion').textContent(),'Play motion');
  await page.goBack();await ready(page);
  assert.equal(page.url(),origin);assert.equal(await page.locator('#replay-time').inputValue(),'130.011');
  assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-oblique');assert.equal(await page.locator('#footage-source').inputValue(),'robinson-dashcam');
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  await page.waitForFunction(()=>document.activeElement?.id==='ground-study-link');
  console.info('REPLAY_FORM_RETURN_FOCUS '+JSON.stringify(await page.evaluate(()=>({activeId:document.activeElement?.id??null,activeTag:document.activeElement?.tagName??null,navigation:performance.getEntriesByType('navigation')[0]?.type??null,returnIntent:history.state?.atlasGroundStudyReturn??null}))));
  assert.equal(await page.locator('#ground-study-link').evaluate(node=>node===document.activeElement),true);
  await page.goForward();await studyReady(page);assert.equal(await page.locator('#sequence-time').inputValue(),'0.501');assert.equal(await page.locator('#motion').textContent(),'Play motion');
  assert.equal(await page.locator('#condensation-visibility').inputValue(),'limited');
  await page.goBack();await ready(page);await page.reload();await ready(page);
  assert.equal(await page.locator('#replay-time').inputValue(),'130.011');assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-oblique');
  if(keyboard){
    const before=page.url(),history=await page.evaluate(()=>window.history.length);
    const popupPromise=page.context().waitForEvent('page');await page.locator('#ground-study-link').click({modifiers:['Control']});
    const popup=await popupPromise;try{await studyReady(popup);assert.equal(popup.url(),destination);assert.equal(await popup.locator('#motion').textContent(),'Play motion');}finally{await popup.close();}
    assert.equal(page.url(),before);assert.equal(await page.evaluate(()=>window.history.length),history);
  }
});

test('comparison refuses unavailable or unrelated states and preserves the displayed playing snapshot',{timeout:60000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:1000}});
  for(const route of [replay.replace('synthetic-oblique','missing-camera'),replay.replace('&ground_view=synthetic-oblique',''),replay.replace('storm-v2','storm-v3'),replay+'&appearance_style=storm-v2',replay.replace('t=130.011','t=145'),replay.replace('appearance_view=formation','appearance_view=simulation')]){
    await page.goto(base+'/'+route);await ready(page);
    assert.equal(await page.locator('#ground-study-comparison').isVisible(),false);
    assert.equal(await page.locator('#ground-study-link').getAttribute('href'),null);
  }
  await page.goto(base+'/'+replay);await ready(page);await page.locator('#replay-play').click();
  await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>130.011);
  // This is an instrumented same-task activation. No wall-time tick may replace
  // the already displayed snapshot between reading the link and its handler.
  const chosen=await page.evaluate(()=>{
    const link=document.getElementById('ground-study-link'),input=document.getElementById('replay-time'),permalink=document.getElementById('replay-link');
    const href=link.href,sourceHref=permalink.href,rawBefore=input.value,requested=Number(rawBefore),length=history.length;
    const probe=input.cloneNode(false);probe.value=Number(new URL(sourceHref).searchParams.get('t'));
    const serializedSource=probe.value,nativeType=input.type,nativeStep=input.step;
    link.addEventListener('click',event=>event.preventDefault(),{once:true});link.click();
    return {href,requested,rawBefore,rawAfter:input.value,after:Number(input.value),sourceHref,sourceHrefAfter:permalink.href,serializedSource,nativeType,nativeStep,
      url:location.href,length,afterLength:history.length,play:document.getElementById('replay-play').textContent};
  });
  assert.equal(chosen.after,chosen.requested);const exactSeconds=exactPlayingComparisonSeconds(chosen);
  const opened=new URL(chosen.href).searchParams;
  assert.equal(Number(opened.get('position')),Math.round((exactSeconds-120)*50)/1000);
  assert.equal(Number(opened.get('phase')),Number(opened.get('position'))*30);
  assert.ok(Math.abs(Number(opened.get('phase'))-(exactSeconds-120)*1.5)<=.015+1e-10);
  assert.equal(chosen.afterLength,chosen.length);assert.equal(chosen.play,'Play timeline');
  await page.emulateMedia({reducedMotion:'reduce'});await enlargeText(page);await reflow(page);
  await page.locator('#ground-camera').selectOption('synthetic-front');assert.equal(await page.locator('#ground-study-comparison').isVisible(),true);
  await page.locator('#replay-time').fill('145');assert.equal(await page.locator('#ground-study-link').getAttribute('href'),null);
});

test('script-free Replay retains the ordinary Form route without claiming phase restoration',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:1000},javaScriptEnabled:false});
  await page.goto(base+'/'+replay);
  assert.match(await page.locator('noscript').textContent(),/requires JavaScript/);
  assert.equal(await page.locator('#ground-study-link').count(),0);
  const form=page.locator('.museum-nav a[href="study.html"]');assert.equal(await form.count(),1);
  await page.locator('.museum-nav summary').filter({hasText:'Explore'}).click();
  await Promise.all([page.waitForURL(new URL('study.html',base+'/').href),form.click()]);
  assert.equal(new URL(page.url()).search,'');assert.equal(await page.locator('#form-experiment').count(),1);
});
