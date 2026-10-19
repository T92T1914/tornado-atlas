import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

async function capture(page,name){
  if(process.env.ATLAS_REALISM_CAPTURE){await mkdir(process.env.ATLAS_REALISM_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_REALISM_CAPTURE,name+'.png')});}
}
for(const [width,appearance] of [[320,'dark'],[1280,'light']])test('Wind continuous reference exposes a missed sampled peak '+width,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
  await page.goto(base+'/wind.html?event=moore-2013');
  await page.waitForFunction(()=>document.querySelector('#wind-reference-status').dataset.state==='available');
  await page.locator('#reading-appearance').selectOption(appearance);
  await page.locator('#wind-reference-example').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#lab-event').inputValue(),'moore-2013');
  assert.equal(await page.locator('#reference-maximum-wind').textContent(),'105.000 mph');
  assert.equal(await page.locator('#reference-maximum-drag').textContent(),'1.619 kN');
  assert.equal(await page.locator('#wind-reference-status').getAttribute('data-state'),'missed-exceedance');
  assert.match(await page.locator('#wind-reference-status').textContent(),/none of the 481 samples/);
  assert.equal(await page.locator('#component-first').textContent(),'Not exceeded in this sampled window');
  assert.equal(await page.locator('#component-peak').textContent(),'1.59 kN');
  assert.ok(parseFloat(await page.locator('#reference-capacity-duration').textContent())>0);
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  assert.equal(await page.locator('#passage-time').inputValue(),'0');
  assert.equal(await page.locator('#component-time').inputValue(),'0');
  assert.equal(await page.locator('#passage-play').textContent(),'Play passage');
  await page.locator('#wind-reference-status').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await capture(page,'wind-reference-'+width+'-'+appearance);
  const retained=await page.locator('#lab-share').getAttribute('href');
  assert.equal(new URL(retained).searchParams.get('capacity'),'1.6');
  await page.goto(retained);
  await page.waitForFunction(()=>document.querySelector('#wind-reference-status').dataset.state==='missed-exceedance');
  assert.equal(await page.locator('#passage-play').textContent(),'Play passage');
  await page.locator('#background').evaluate(n=>{n.value=5;n.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('#wind-reference-status').getAttribute('data-state'),'unavailable');
  assert.equal(await page.locator('#wind-reference-values').isVisible(),false);
  for(const id of ['maximum-wind','maximum-drag','comparison-duration','capacity-duration'])assert.equal(await page.locator('#reference-'+id).textContent(),'');
  assert.equal(await page.locator('#capacity').inputValue(),'1.6');
  await page.locator('#background').evaluate(n=>{n.value=0;n.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('#wind-reference-status').getAttribute('data-state'),'missed-exceedance');
  await page.locator('#wind-reset').click();
  assert.equal(await page.locator('#wind-reference-status').getAttribute('data-state'),'available');
  assert.equal(await page.locator('#peak').inputValue(),'100');
  assert.equal(await page.locator('#lab-event').inputValue(),'moore-2013');
});

test('Wind continuous comparison retains static assumptions without scripts',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900}});
  await page.goto(base+'/wind.html?event=moore-2013');
  assert.match(await page.locator('#wind-reference-status').textContent(),/requires JavaScript/);
  assert.equal(await page.locator('#wind-reference-example').isVisible(),false);
  assert.equal(await page.locator('#wind-reference-values').isVisible(),false);
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  assert.match(await page.locator('#sampled-values-assumptions').textContent(),/Peak swirl 100.0 mph/);
  assert.equal(await page.locator('#lab-documentary-fallback a[href="moore.html"]').count(),1);
});
