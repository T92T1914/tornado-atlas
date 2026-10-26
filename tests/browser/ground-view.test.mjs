import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {referenceReady,reflow,enlargeText,nativeSnapshot,observeReferenceRetry,saveCapture} from './ground-view-assertions.mjs';

const demo='reconstruction.html?event=el-reno-2013&appearance_view=ground&ground_view=synthetic-front&t=120';
async function open(page){await page.goto(base+'/'+demo);await page.locator('#replay-time:not([disabled])').waitFor();await referenceReady(page,'synthetic-front',120);}
for(const [width,theme,large]of [[320,'dark',false],[320,'light',true],[1280,'dark',true],[1280,'light',false]]){
  test(`ground-view source lock and comparison ${width} ${theme} ${large?'enlarged':'normal'}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});await open(page);
    await page.locator('#reading-appearance').selectOption(theme);
    assert.match(await page.locator('#replay-appearance-state').textContent(),/Synthetic.*No El Reno/);
    assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'ground');
    assert.equal(await page.locator('#ground-time').getAttribute('role'),'timer');
    assert.equal(await page.locator('#ground-time').getAttribute('aria-live'),'off');
    assert.equal(await page.locator('#replay-rate').inputValue(),'1');
    const before=await nativeSnapshot(page,130,'synthetic-front');await referenceReady(page,'synthetic-front',130);
    await page.locator('#replay-azimuth').fill('80');await page.locator('#replay-elevation').fill('25');
    const after=await nativeSnapshot(page,130,'synthetic-front');
    if(before.available)assert.deepEqual(after.matrix,before.matrix,'Geographic orbit cannot rotate a source camera');
    if(large)await enlargeText(page);
    await reflow(page);
    await page.keyboard.press('Tab');const key=page.locator('[data-ground-second="130"]');await key.focus();await page.keyboard.press('Enter');
    assert.equal(await key.evaluate(n=>n===document.activeElement&&n.matches(':focus-visible')),true);
    assert.equal(await page.locator('#replay-time').inputValue(),'130');
    assert.match(await page.locator('#ground-reference-original').getAttribute('href'),/synthetic-front-130\.svg$/);
    await saveCapture(page,`layout-${width}-${theme}.png`);
    assert.equal(await page.locator('#registered-footage iframe').count(),0);
  });
}
test('ground-view both known cameras retain all six independent reference instants',async t=>{
  const page=await fixture(t,{viewport:{width:1600,height:1000},deviceScaleFactor:2,reducedMotion:'reduce'});await open(page);
  for(const id of ['synthetic-front','synthetic-oblique']){
    await page.locator('#ground-camera').selectOption(id);
    for(const seconds of [120,130,140]){
      await nativeSnapshot(page,seconds,id);await referenceReady(page,id,seconds);
      assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-source-camera'),id);
      await saveCapture(page,`${id}-${seconds}.png`);
    }
  }
  await page.locator('#replay-appearance-canvas').evaluate(c=>{c.style.border='0';c.style.width='1280px';c.style.height='720px';});
  const capped=await nativeSnapshot(page,130,'synthetic-oblique');if(capped.available)assert.deepEqual(capped.buffer,[2048,1152]);
});
test('ground-view uses one clock across normal playback, quality, gaps and history',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900}});await open(page);
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>121);
  await saveCapture(page,'normal-play-1.png');
  await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>122);
  await saveCapture(page,'normal-play-2.png');
  await page.locator('#replay-play').click();const paused=await page.locator('#replay-time').inputValue();
  await page.waitForTimeout(100);assert.equal(await page.locator('#replay-time').inputValue(),paused);
  const full=await nativeSnapshot(page,130,'synthetic-front');await page.locator('#ground-quality').selectOption('1600');
  const low=await nativeSnapshot(page,130,'synthetic-front');
  if(full.available){assert.deepEqual(low.matrix,full.matrix);assert.deepEqual(low.shape,full.shape);assert.equal(low.time,full.time);assert.equal(low.pointCount,1600);}
  await page.locator('#replay-rate').selectOption('15');await page.locator('#replay-time').fill('120');
  await page.locator('#replay-play').click();await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>123);
  await page.locator('#replay-play').click();await page.locator('#replay-time').fill('130');
  await page.locator('#ground-camera').selectOption('synthetic-oblique');await referenceReady(page,'synthetic-oblique',130);
  await page.goBack();assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-front');
  await page.goForward();assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-oblique');
  await page.reload();await page.locator('#replay-time:not([disabled])').waitFor();await referenceReady(page,'synthetic-oblique',130);
  await page.locator('#replay-time').fill('145');assert.match(await page.locator('#replay-appearance-state').textContent(),/Outside/);
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);assert.equal(await page.locator('#ground-reference-image').count(),0);
  await page.locator('#replay-time').fill('125');assert.equal(await page.locator('#ground-reference-image').count(),0);
  await page.locator('#replay-appearance-mode').selectOption('photo:wakimoto-early-extension');await page.locator('#replay-time').fill('70');
  assert.equal(await page.locator('#replay-ground-controls').isVisible(),false);assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-source-camera'),'');
  assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-evidence-state'),'photo_observed');
  await page.goto(base+'/'+demo.replace('synthetic-front','unavailable-camera'));await page.locator('#replay-time:not([disabled])').waitFor();
  assert.match(await page.locator('#replay-appearance-state').textContent(),/unavailable/);assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
});
test('ground-view WebGL refusal preserves camera, reference and source explanation',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900}});
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:original.call(this,kind,...args);};});
  await open(page);assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
  assert.match(await page.locator('#replay-appearance-renderer-status').textContent(),/could not start/);
  assert.match(await page.locator('#ground-camera-details').textContent(),/synthetic-front/);
  assert.equal(await page.locator('#ground-reference-image').isVisible(),true);await saveCapture(page,'webgl-unavailable.png');
});
test('ground-view failed reference retries and detached callbacks cannot transfer source identity',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900}});let attempts=0;
  const diagnostic=await observeReferenceRetry(page);
  let originalFailure=null;
  try{
  await page.route('**/assets/ground-view-demo/synthetic-front-120.svg',route=>++attempts===1?route.abort():route.continue());
  await page.goto(base+'/'+demo);await page.locator('#replay-time:not([disabled])').waitFor();await page.locator('#ground-reference-retry').waitFor();
  assert.match(await page.locator('#ground-reference-status').textContent(),/could not load/);await saveCapture(page,'reference-unavailable.png');
  const retry=page.locator('#ground-reference-retry');await page.keyboard.press('Tab');await retry.focus();await page.keyboard.press('Enter');
  await referenceReady(page,'synthetic-front',120);assert.equal(attempts,2);assert.equal(await page.locator('#ground-reference-original').evaluate(n=>n===document.activeElement),true);
  const old=await page.locator('#ground-reference-image').elementHandle();await page.locator('#ground-camera').selectOption('synthetic-oblique');await referenceReady(page,'synthetic-oblique',120);
  await old.evaluate(n=>{n.dispatchEvent(new Event('error'));n.dispatchEvent(new Event('load'));});
  assert.match(await page.locator('#ground-reference-status').textContent(),/Complete.*synthetic-oblique/);
  assert.equal(await page.locator('#ground-reference-retry').isVisible(),false);
  assert.match(await page.locator('#ground-reference-original').getAttribute('href'),/synthetic-oblique-120\.svg$/);
  }catch(error){
    originalFailure=error;
    try{await diagnostic.report(error,attempts);}catch(diagnosticError){console.error('GROUND_RETRY_DIAGNOSTIC_FAILURE '+String(diagnosticError).slice(0,500));}
    throw error;
  }finally{
    try{diagnostic.stop();}catch(error){if(!originalFailure)throw error;console.error('GROUND_RETRY_CLEANUP_FAILURE '+String(error).slice(0,500));}
  }
});
