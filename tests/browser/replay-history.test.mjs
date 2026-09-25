import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base,open} from './harness.mjs';

const moment='robinson-01',sample='2013-05-31T23:09:38Z';
async function time(page,seconds){
  await page.waitForFunction(seconds=>document.querySelector('#replay-time')?.value===String(seconds),seconds);
}
async function ready(page,path='/reconstruction.html?event=el-reno-2013'){
  await page.goto(base+path);
  await page.locator('#replay-camera-sample:not([disabled])').waitFor();
}
async function chooseMoment(page){
  await page.locator(`[data-anchor="${moment}"]`).click();
  await time(page,783);
}

test('reloading after a footage moment and a camera selection keeps the newer time',async t=>{
  const page=await fixture(t);
  await ready(page);
  await chooseMoment(page);
  await page.locator('#replay-camera-sample').selectOption(sample);
  await time(page,338);
  await page.reload();
  await page.locator('#replay-camera-sample:not([disabled])').waitFor();
  // Let the initial footage restore run before inspecting the final clock.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#replay-time').inputValue(),'338');
});

test('Back returns to the prior evidence moment before leaving the replay',async t=>{
  const page=await fixture(t);
  await open(page);
  await ready(page);
  await chooseMoment(page);
  await page.locator('#replay-camera-sample').selectOption(sample);
  await time(page,338);
  await page.goBack();
  assert.equal(new URL(page.url()).pathname,'/reconstruction.html');
  await time(page,783);
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
});

test('existing direct footage links retain their checked source moment',async t=>{
  const page=await fixture(t);
  await ready(page,`/reconstruction.html?event=el-reno-2013&t=338&footage=${moment}#registered-footage`);
  await time(page,783);
  assert.match(await page.locator('#footage-status').textContent(),/Dan Robinson.*video 0:05/);
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
});

for(const appearance of ['dark','light'])for(const width of [1280,390]){
  test(`replay history keeps source and scrubbed time in ${appearance} at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await ready(page,'/reconstruction.html?event=el-reno-2013&t=120');
    await page.locator('#reading-appearance').selectOption(appearance);
    await chooseMoment(page);
    assert.equal(new URL(page.url()).searchParams.get('footage'),moment);
    await page.locator('#replay-camera-sample').selectOption(sample);
    await time(page,338);
    await page.locator('#replay-time').fill('339');
    const url=new URL(page.url());
    assert.equal(url.searchParams.get('t'),'339');
    assert.equal(url.searchParams.has('footage'),false);
    assert.equal(url.hash,'');
    await page.reload();
    await time(page,339);
    assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
    await page.goBack();
    await time(page,783);
    assert.equal(await page.locator(`[data-anchor="${moment}"]`).getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('#footage-status').textContent(),/Dan Robinson.*video 0:05/);
    await page.goForward();
    await time(page,339);
    assert.match(await page.locator('#footage-status').textContent(),/No checked video frame/);
    const share=new URL(await page.locator('#replay-link').getAttribute('href'),page.url());
    assert.equal(share.searchParams.get('event'),'el-reno-2013');
    assert.equal(share.searchParams.get('t'),'339');
    assert.equal(share.searchParams.has('footage'),false);
    assert.equal(await page.locator('#registered-footage iframe').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  });
}

test('Back during playback restores a paused evidence moment and Forward restores its choice',async t=>{
  const page=await fixture(t);
  await ready(page);
  await chooseMoment(page);
  await page.locator('#replay-camera-sample').selectOption(sample);
  await page.locator('#replay-rate').selectOption('120');
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>338);
  await page.goBack();
  await time(page,783);
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  await page.goForward();
  await time(page,338);
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
});

test('pausing saves the current playback time without adding frame history',async t=>{
  const page=await fixture(t);
  await ready(page,'/reconstruction.html?event=el-reno-2013&t=120');
  const count=await page.evaluate(()=>history.length);
  await page.locator('#replay-rate').selectOption('120');
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>121);
  await page.locator('#replay-play').click();
  const saved=new URL(page.url()).searchParams.get('t');
  assert.ok(Number(saved)>120);
  assert.equal(await page.evaluate(()=>history.length),count);
  await page.reload();
  await page.locator('#replay-camera-sample:not([disabled])').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('t'),saved);
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
});

test('fractional URL times survive reload including inside a checked footage second',async t=>{
  const page=await fixture(t);
  for(const seconds of [58.25,783.25]){
    await ready(page,`/reconstruction.html?event=el-reno-2013&t=${seconds}`);
    assert.equal(new URL(page.url()).searchParams.get('t'),String(seconds));
    assert.equal(new URL(page.url()).searchParams.has('footage'),false);
    await page.reload();
    await page.locator('#replay-camera-sample:not([disabled])').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('t'),String(seconds));
    assert.equal(new URL(page.url()).searchParams.has('footage'),false);
    if(seconds===783.25)assert.match(await page.locator('#footage-status').textContent(),/Dan Robinson/);
  }
});

test('the documentary retains its original direct footage link behavior',async t=>{
  const page=await fixture(t);
  await page.goto(base+`/index.html?footage=${moment}#registered-footage`);
  await page.waitForFunction(()=>document.querySelector('#timeline')?.value==='783');
  assert.match(await page.locator('#footage-status').textContent(),/Dan Robinson.*video 0:05/);
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
});
