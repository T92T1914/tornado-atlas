import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const sample='2013-05-31T23:09:38Z';
async function observer(page,state,visible){
  await page.waitForFunction(({state,visible})=>
    document.querySelector('#replay-camera').dataset.state===state&&
    document.querySelector('#replay-scene').dataset.observerVisible===String(visible),{state,visible});
}

for(const appearance of ['dark','light'])for(const width of [1280,390]){
  test(`observer context uses the historical clock in ${appearance} at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await page.goto(base+'/reconstruction.html?event=el-reno-2013');
    await page.locator('#replay-camera:visible').waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.equal(await page.locator('#replay-camera-enabled').isChecked(),false);
    await observer(page,'disabled',false);
    assert.match(await page.locator('#replay-camera-separation').textContent(),/Tim Marshall.*separate from Dan Robinson/);
    assert.equal(await page.locator('#replay-camera-sample option').count(),18);
    assert.equal(await page.locator('#replay-camera-sample').getAttribute('aria-describedby'),'replay-camera-status');
    // Selecting a source sample enables the optional layer and pauses at its
    // exact historical second, independently of original-host media playback.
    await page.locator('#replay-camera-sample').selectOption(sample);
    await page.locator('#replay-reset').click();
    await observer(page,'recorded',true);
    assert.equal(await page.locator('#replay-camera-key').isVisible(),width===390);
    assert.equal(await page.locator('#replay-time').inputValue(),'338');
    assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
    assert.match(await page.locator('#replay-camera-status').textContent(),/250°.*6:09:38 PM CDT.*exact sample time/);
    assert.equal(await page.locator('#replay-camera-enabled').isChecked(),true);
    await page.locator('#replay-camera summary').click();
    assert.match(await page.locator('#replay-camera-method').textContent(),/90 seconds/);
    assert.match(await page.locator('#replay-camera-source').getAttribute('href'),/^https:\/\/el-reno-survey\.net\//);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#replay-camera-sample').focus();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'replay-camera-sample');
    // Optional evidence captures are of this owned test page, never the desktop.
    if(process.env.ATLAS_SCREENSHOT_DIR){
      await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});
      const file=path.join(process.env.ATLAS_SCREENSHOT_DIR,`observer-${appearance}-${width}.png`);
      await page.locator('.replay-layout').screenshot({path:file});
      console.log(`Observer screenshot: ${file}`);
    }
    await page.locator('#replay-time').fill('339');
    await observer(page,'held',true);
    assert.equal(await page.locator('#replay-camera-sample').inputValue(),'');
    assert.match(await page.locator('#replay-camera-status').textContent(),/6:09:38 PM CDT.*1 second old/);
    await page.locator('#replay-time').fill('1310'); // 6:25:50, exactly 90 s after 6:24:20.
    await observer(page,'held',true);
    assert.match(await page.locator('#replay-camera-status').textContent(),/90 seconds old/);
    await page.locator('#replay-time').fill('1311');
    await observer(page,'stale',false);
    assert.match(await page.locator('#replay-camera-status').textContent(),/6:24:20 PM CDT.*91 seconds old.*hidden/);
    assert.equal(await page.locator('#replay-camera-offscreen').isVisible(),false);
    await page.locator('#replay-camera-sample').selectOption(sample);
    await observer(page,'recorded',true);
    await page.locator('#replay-rate').selectOption('120');
    await page.locator('#replay-play').click();
    await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>338);
    await page.locator('#replay-camera-sample').selectOption(sample);
    await observer(page,'recorded',true);
    assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
    assert.equal(await page.locator('#replay-time').inputValue(),'338');
    await page.locator('#replay-camera-enabled').uncheck();
    await observer(page,'disabled',false);
    assert.equal(await page.locator('#replay-time').inputValue(),'338');
    await page.locator('#replay-camera-enabled').check();
    await observer(page,'recorded',true);
    await page.locator('.footage-moments button').first().click();
    assert.match(await page.locator('#footage-status').textContent(),/Dan Robinson/);
    assert.match(await page.locator('#replay-camera-separation').textContent(),/matching clock does not connect/);
    assert.equal(await page.locator('#registered-footage iframe').count(),0);
  });
}

test('optional observer evidence does not prevent an otherwise valid replay',async t=>{
  const page=await fixture(t),root=new URL('../../web/',import.meta.url);
  const data=JSON.parse(await readFile(new URL('data.json',root),'utf8'));
  const config=JSON.parse(await readFile(new URL('events/el-reno-2013.json',root),'utf8'));
  delete data.cameras;
  const body=JSON.stringify(data);
  config.bundle_sha256=createHash('sha256').update(body).digest('hex');
  await page.route('**/data.json',route=>route.fulfill({contentType:'application/json',body}));
  await page.route('**/events/el-reno-2013.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(config)}));
  await page.goto(base+'/reconstruction.html?event=el-reno-2013');
  await page.locator('#replay-play:not([disabled])').waitFor();
  assert.equal(await page.locator('#replay-camera').isVisible(),false);
  await page.locator('#replay-time').fill('338');
  assert.match(await page.locator('#replay-clock').textContent(),/6:09:38 PM CDT/);
  assert.equal(await page.locator('#replay-error').isVisible(),false);
});

test('documentary map shares recorded, held and expired observer semantics',async t=>{
  const page=await fixture(t);
  await page.goto(base+'/index.html');
  await page.locator('#camera-sample:not([disabled])').waitFor();
  await page.locator('#camera-sample').selectOption('2013-05-31T23:24:20Z');
  assert.match(await page.locator('#camera-status').textContent(),/6:24:20 PM CDT.*exact sample time/);
  await page.locator('#timeline').fill('1310');
  assert.match(await page.locator('#camera-status').textContent(),/90 seconds old/);
  assert.equal(await page.locator('#camera-sample').inputValue(),'');
  await page.locator('#timeline').fill('1311');
  assert.match(await page.locator('#camera-status').textContent(),/91 seconds old.*hidden/);
  assert.equal(await page.locator('.camera-marker').getAttribute('display'),'none');
  await page.locator('#camera-sample').selectOption(sample);
  assert.match(await page.locator('#camera-status').textContent(),/exact sample time/);
  assert.equal(await page.locator('.camera-marker').getAttribute('display'),'inline');
});
