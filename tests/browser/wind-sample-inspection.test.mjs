import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

async function ready(page) {
  await page.waitForFunction(()=>document.body.dataset.windSamples==='ready' && document.querySelector('#lab-context').dataset.experimentReady==='true');
}
async function setInputs(page,values) {
  for(const [id,value] of Object.entries(values))await page.locator('#'+id).evaluate((node,value)=>{
    node.value=String(value);node.dispatchEvent(new Event('input',{bubbles:true}));
  },value);
}
async function selected(page,index,{focused=true}={}) {
  assert.deepEqual(await page.locator('#passage-time,#component-time').evaluateAll(nodes=>nodes.map(n=>Number(n.value))),[index,index]);
  assert.equal(await page.locator('#sampled-values-body tr[aria-current=true]').getAttribute('id'),'passage-sample-'+index);
  assert.equal(await page.locator('#sampled-values-details').getAttribute('open'),'');
  if(focused)assert.equal(await page.evaluate(()=>document.activeElement.id),'passage-sample-'+index);
  assert.equal(Number(await page.locator('#passage-cursor').getAttribute('x1')),52+index/480*636);
  assert.equal(await page.locator('#passage-play').textContent(),'Play passage');
  assert.equal(await page.locator('#component-play').textContent(),'Play passage');
  assert.equal(new URL(await page.locator('#lab-share').getAttribute('href')).searchParams.get('sample'),String(index));
}
async function capture(page,name) {
  if(process.env.ATLAS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,name+'.png')});
}
for(const [width,appearance] of [[320,'dark'],[1280,'light']])test('Wind decisive sample inspection '+width+' '+appearance,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await page.goto(base+'/wind.html');await ready(page);
  await page.locator('#reading-appearance').selectOption(appearance);
  await page.locator('#component-inspect-peak').focus();await page.keyboard.press('Enter');
  await selected(page,240);
  assert.equal(Number(await page.locator('#passage-sample-240 td').nth(0).getAttribute('data-value')),0);
  const force=Number(await page.locator('#passage-sample-240 td').nth(4).getAttribute('data-value'));
  assert.ok(Math.abs(force-(.5*1.225*(100*.44704)**2*1.2/1000))<1e-10);
  await setInputs(page,{background:20,offset:-.7,capacity:1.6});
  await page.locator('#component-inspect-first').focus();await page.keyboard.press('Enter');
  await selected(page,206);
  assert.equal(await page.locator('#passage-sample-205 td').last().textContent(),'Capacity not exceeded so far');
  assert.equal(await page.locator('#passage-sample-206 td').last().textContent(),'Failed under this rule');
  assert.ok(Number(await page.locator('#passage-sample-205 td').nth(4).getAttribute('data-value'))<=1.6);
  assert.ok(Number(await page.locator('#passage-sample-206 td').nth(4).getAttribute('data-value'))>1.6);
  await capture(page,'wind-inspection-row-'+width);
  await page.locator('#lab-share').click();
  const saved=page.url();assert.equal(new URL(saved).searchParams.get('sample'),'206');
  await page.reload();await ready(page);
  assert.equal(await page.locator('#passage-time').inputValue(),'206');
  assert.equal(await page.locator('#component-time').inputValue(),'206');
  await page.locator('#component-inspect-first').focus();await page.keyboard.press('Enter');await selected(page,206);
  await setInputs(page,{offset:.7});
  assert.equal(await page.locator('#component-inspect-first').isDisabled(),true);
  assert.equal(await page.locator('#component-first').textContent(),'Not exceeded in this sampled window');
  await page.locator('#wind-reference-example').click();
  assert.equal(await page.locator('#component-inspect-first').isDisabled(),true,'A continuous exceedance cannot select a nonexistent sampled exceedance');
  assert.ok(Number(await page.locator('#grid-961-peak').textContent())>1600);
  await page.locator('#wind-reset').click();
  await page.waitForFunction(()=>document.getElementById('peak').value==='100' && document.getElementById('capacity').value==='1');
  assert.equal(await page.locator('#passage-time').inputValue(),'0');
  assert.equal(await page.locator('#component-inspect-first').isDisabled(),false);
  await page.locator('#component-inspect-peak').focus();await page.keyboard.press('Enter');await selected(page,240);
  await page.locator('#component-inspection-controls').evaluate(host=>{
    const nodes=[...host.querySelectorAll('button,p')],sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));
    nodes.forEach((n,i)=>n.style.fontSize=(sizes[i]*2)+'px');
  });
  await page.locator('#component-inspect-peak').focus();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const geometry=await page.locator('#component-inspection-controls button').evaluateAll(nodes=>nodes.map(n=>{
    const b=n.getBoundingClientRect();return {left:b.left,right:b.right,height:b.height,client:n.clientWidth,scroll:n.scrollWidth};
  }));
  for(const box of geometry)assert.ok(box.left>=-1 && box.right<=width+1 && box.height>=44 && box.scroll<=box.client+1,JSON.stringify(box));
  await capture(page,'wind-inspection-controls-'+width);
  t.diagnostic(JSON.stringify({width,appearance,selected:[240,206],first_exceedance:206,raw_force_checks:true,normal_speed_observation:false}));
});
