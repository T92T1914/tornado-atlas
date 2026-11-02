import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

const gridIds=[481,961].flatMap(count=>['spacing','peak','exceeded','shortfall'].map(key=>'grid-'+count+'-'+key));
async function gridText(page){return page.evaluate(ids=>Object.fromEntries(ids.map(id=>[id,document.getElementById(id).textContent])),gridIds);}
async function witness(page){
  assert.equal(await page.locator('#wind-grid-values').isVisible(),true);
  assert.deepEqual(await page.locator('.wind-grid-table thead th').allTextContents(),['Quantity','481 samples','961 samples']);
  assert.deepEqual(await gridText(page),{
    'grid-481-spacing':'0.284091','grid-481-peak':'1594.503','grid-481-exceeded':'No','grid-481-shortfall':'24.914',
    'grid-961-spacing':'0.142045','grid-961-peak':'1615.622','grid-961-exceeded':'Yes','grid-961-shortfall':'3.796',
  });
  assert.match(await page.locator('#wind-grid-status').textContent(),/different strict capacity outcomes/);
}

async function capture(page,name){
  if(process.env.ATLAS_REALISM_CAPTURE){await mkdir(process.env.ATLAS_REALISM_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_REALISM_CAPTURE,name+'.png')});}
}
for(const [width,appearance] of [[320,'dark'],[1280,'light']])test('Wind continuous reference exposes a missed sampled peak '+width,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
  await page.goto(base+'/wind.html?event=moore-2013');
  await page.waitForFunction(()=>document.querySelector('#wind-reference-status').dataset.state==='available');
  await page.locator('#reading-appearance').selectOption(appearance);
  await page.locator('#wind-reference-example').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'wind-reference-example');
  await witness(page);
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
  const initialGrid=await gridText(page);
  await page.locator('#passage-time').focus();await page.keyboard.press('End');
  assert.equal(await page.locator('#passage-time').inputValue(),'480');assert.equal(await page.locator('#component-time').inputValue(),'480');
  assert.deepEqual(await gridText(page),initialGrid);
  assert.equal(new URL(await page.locator('#lab-share').getAttribute('href')).searchParams.get('sample'),'480');
  await page.keyboard.press('Home');assert.equal(await page.locator('#passage-time').inputValue(),'0');
  assert.deepEqual(await gridText(page),initialGrid);
  await page.locator('#wind-reference-status').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await capture(page,'wind-reference-'+width+'-'+appearance);
  const retained=await page.locator('#lab-share').getAttribute('href');
  assert.equal(new URL(retained).searchParams.get('capacity'),'1.6');
  await page.goto(retained);
  await page.waitForFunction(()=>document.querySelector('#wind-reference-status').dataset.state==='missed-exceedance');
  await witness(page);
  assert.equal(await page.locator('#passage-play').textContent(),'Play passage');
  await page.locator('#background').evaluate(n=>{n.value=5;n.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('#wind-reference-status').getAttribute('data-state'),'available');
  assert.equal(await page.locator('#wind-reference-values').isVisible(),true);
  assert.equal(await page.locator('#reference-capacity-duration').textContent(),'0.000 model s strictly above capacity');
  assert.match(await page.locator('#wind-reference-status').textContent(),/does not strictly exceed capacity/);
  assert.equal(await page.locator('#capacity').inputValue(),'1.6');
  assert.equal(await page.locator('#grid-481-exceeded').textContent(),'No');assert.equal(await page.locator('#grid-961-exceeded').textContent(),'No');
  await page.locator('#background').evaluate(n=>{n.value=0;n.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('#wind-reference-status').getAttribute('data-state'),'missed-exceedance');
  await witness(page);
  await page.locator('#wind-reset').click();
  assert.equal(await page.locator('#wind-reference-status').getAttribute('data-state'),'available');
  assert.equal(await page.locator('#peak').inputValue(),'100');
  assert.equal(await page.locator('#lab-event').inputValue(),'moore-2013');
  assert.equal(await page.locator('#grid-481-exceeded').textContent(),'Yes');assert.equal(await page.locator('#grid-961-exceeded').textContent(),'Yes');
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  const resetGrid=await gridText(page),saved=await page.locator('#lab-share').getAttribute('href');
  await page.locator('#reading-appearance').selectOption(appearance==='dark'?'light':'dark');
  assert.deepEqual(await gridText(page),resetGrid);assert.equal(await page.locator('#lab-share').getAttribute('href'),saved);
  await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')].filter(n=>n instanceof HTMLElement);const sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});
  await page.locator('#wind-grid-values').scrollIntoViewIfNeeded();await page.locator('#wind-grid-values').focus();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'wind-grid-values');
  const region=await page.locator('#wind-grid-values').evaluate(node=>({width:node.clientWidth,scrollWidth:node.scrollWidth}));
  if(region.scrollWidth>region.width+1){await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.getElementById('wind-grid-values').scrollLeft>0,null,{timeout:1000});}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(await gridText(page),resetGrid);assert.equal(await page.locator('#passage-play').textContent(),'Play passage');
});

test('Wind continuous comparison retains static assumptions without scripts',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900}});
  await page.goto(base+'/wind.html?event=moore-2013');
  assert.match(await page.locator('#wind-reference-status').textContent(),/requires JavaScript/);
  assert.equal(await page.locator('#wind-reference-example').isVisible(),false);
  assert.equal(await page.locator('#wind-reference-values').isVisible(),false);
  assert.equal(await page.locator('#wind-grid-values').isVisible(),false);
  assert.match(await page.locator('#wind-reference-status').textContent(),/comparison of continuous and sampled results requires JavaScript/);
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  assert.match(await page.locator('#sampled-values-assumptions').textContent(),/Peak swirl 100.0 mph/);
  assert.equal(await page.locator('#lab-documentary-fallback a[href="moore.html"]').count(),1);
});
