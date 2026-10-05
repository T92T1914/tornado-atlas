import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const blocks=['warning1-source-text','warning2-source-text','warning2-caption-text'];
async function openReadings(page){
  for(const id of ['warning1-reading','warning2-reading']){
    const summary=page.locator('#'+id+' > summary');
    await summary.focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#'+id).evaluate(node=>node.open),true);
  }
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']])test(`marked Blackwell source text wraps, grows and keeps its evidence layers at ${width}px ${appearance}`,async t=>{
  const page=await fixture(t,{viewport:{width,height:844},hasTouch:width===320});
  if(process.env.ATLAS_SOURCE_TEXT_FONT_FAULT){
    const original=await readFile(new URL('../../web/documentary-page.css',import.meta.url),'utf8');
    const marker='.documentary-source-reading .documentary-source-text {font:inherit;';
    assert.equal(original.split(marker).length,2);
    const body=original.replace(marker,'.documentary-source-reading .documentary-source-text {font:13px monospace;');
    await page.route('**/documentary-page.css',route=>route.fulfill({contentType:'text/css',body}));
  }
  await page.goto(base+'/blackwell.html#warning-context');
  await page.locator('#reading-appearance').selectOption(appearance);
  await openReadings(page);
  const first=await page.locator('#warning1-source-text').textContent();
  const second=await page.locator('#warning2-source-text').textContent();
  const caption=await page.locator('#warning2-caption-text').textContent();
  assert.match(first,/IN ADDITION TO SEVERE ADD AREA BLACKWELL TO WINFIELD AND EASTWARD/);
  assert.match(first,/\[unclear (word|text|character)\]/);
  assert.match(second,/IMMEDIATE BROADCAST IS DESIRABLE/);
  assert.match(second,/\[overtyped text\]/);
  assert.doesNotMatch(second,/1955|5:00 News/,'Later caption wording is not attributed to the forecast');
  assert.match(caption,/May 25, 1955/);
  assert.match(caption,/broadcast by local media on the 5:00 News/);
  for(const id of blocks){
    const block=page.locator('#'+id);
    assert.equal(await block.isVisible(),true);
    const key=await block.getAttribute('aria-describedby');
    assert.match(await page.locator('#'+key).textContent(),/Square brackets/);
    assert.equal(await block.evaluate(node=>node.scrollWidth<=node.clientWidth),true,'Original long lines wrap');
  }
  const sourceFonts=await page.evaluate(ids=>ids.map(id=>parseFloat(getComputedStyle(document.getElementById(id)).fontSize)),blocks);
  const bodyFont=await page.evaluate(()=>parseFloat(getComputedStyle(document.body).fontSize));
  await page.addStyleTag({content:`body {font-size:${bodyFont*2}px !important}`});
  for(const [index,id] of blocks.entries()){
    const block=page.locator('#'+id);
    assert.equal(await block.evaluate(node=>parseFloat(getComputedStyle(node).fontSize)),sourceFonts[index]*2,'Actual source text doubles, not just the surrounding body');
    assert.equal(await block.evaluate(node=>node.scrollWidth<=node.clientWidth),true,'Enlarged long source lines wrap');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR){
    await mkdir(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR,{recursive:true});
    for(const number of [1,2])await page.locator(`#warning${number}-reading`).screenshot({path:path.join(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR,`blackwell-source-text-${number}-${width}-${appearance}-double.png`)});
  }
  const summary=page.locator('#warning1-reading > summary');
  await summary.click();
  assert.equal(await page.locator('#warning1-reading').evaluate(node=>node.open),false);
  await summary.focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#warning1-reading').evaluate(node=>node.open),true);
});

test('Blackwell source readings work without JavaScript or images and retain ordinary keyboard source routes',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844},javaScriptEnabled:false});
  await page.route('**/assets/blackwell-1955/nws-warning*.jpg',route=>route.abort());
  await page.goto(base+'/blackwell.html#warning-context');
  await openReadings(page);
  assert.match(await page.locator('#warning1-source-text').textContent(),/BLACKWELL TO WINFIELD/);
  assert.match(await page.locator('#warning2-source-text').textContent(),/IMMEDIATE BROADCAST/);
  assert.match(await page.locator('#warning2-caption-text').textContent(),/5:00 News/);
  assert.equal(await page.locator('#warning2-reading').getByRole('heading',{name:'Later archive caption',exact:true}).count(),1);
  const source=page.locator('#warning1-reading-key').getByRole('link',{name:'original first bulletin scan',exact:true});
  assert.equal(await source.getAttribute('href'),'assets/blackwell-1955/nws-warning1.jpg');
  assert.equal(await page.locator('#source-warnings a[href="https://www.weather.gov/ict/udall"]').count(),1);
  const review=page.locator('#source-warnings a[href*="blackwell-source-text-2026-10-05.md"]');
  assert.equal(await review.count(),1);
  const dossier=page.locator('#warning-context a[href*="media=nws-blackwell-warning1"]');
  await dossier.focus();await page.keyboard.press('Enter');
  await page.waitForURL('**/dossier.html?event=blackwell-1955&media=nws-blackwell-warning1#media-nws-blackwell-warning1');
  await page.goBack();
  await page.locator('#warning-context').waitFor();
  assert.equal(await page.locator('#warning1-source-text').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});
