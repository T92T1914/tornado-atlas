import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

async function ready(page) {
  await page.waitForFunction(()=>document.body.dataset.windSamples==='ready' && document.querySelector('#lab-context').dataset.experimentReady==='true');
}
async function input(page,id,value) {
  const control=page.locator('#'+id);
  const assigned=await control.evaluate((node,value)=>{node.value=String(value);return Number(node.value);},value);
  assert.equal(assigned,Number(value),'Native input #'+id+' must retain the requested value');
  await control.evaluate(node=>node.dispatchEvent(new Event('input',{bubbles:true})));
}
async function cardinal(page,east,index=240) {
  const state=await page.evaluate(()=>({
    indices:['passage-time','component-time'].map(id=>Number(document.getElementById(id).value)),
    east:Number(document.getElementById('passage-east-component').dataset.value),north:Number(document.getElementById('passage-north-component').dataset.value),
    speed:document.getElementById('passage-now').textContent,
    arrow:document.getElementById('passage-direction-arrow').getAttribute('d'),
    visibility:document.getElementById('passage-direction-arrow').getAttribute('visibility'),
    buttons:['passage-play','component-play'].map(id=>document.getElementById(id).textContent),
    selected:document.querySelector('#sampled-values-body tr[aria-current=true]').id
  }));
  assert.deepEqual(state.indices,[index,index]);assert.equal(state.selected,'passage-sample-'+index);
  assert.ok(Math.abs(state.east-east)<1e-10);assert.equal(Math.abs(state.north),0);
  assert.equal(state.speed,Math.abs(east).toFixed(1)+' mph');
  assert.equal(state.visibility,east===0?'hidden':'visible');
  assert.deepEqual(state.buttons,['Play passage','Play passage']);
  return state;
}

for(const [width,appearance] of [[320,'dark'],[320,'light'],[1280,'dark'],[1280,'light']])test('Selected passage direction '+width+' '+appearance,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await page.goto(base+'/wind.html');await ready(page);
  await page.locator('#reading-appearance').selectOption(appearance);
  await input(page,'background',20);
  await page.locator('#component-inspect-peak').focus();await page.keyboard.press('Enter');
  let state=await cardinal(page,-80);
  assert.match(state.arrow,/^M352\.000 160\.000 L310\.000 160\.000 /);
  assert.match(await page.locator('#passage-direction-reading').textContent(),/westward/);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'passage-sample-240');
  const retained=await page.locator('#sampled-values-body').evaluate(body=>{
    window.directionRows=[...body.rows];return [...body.rows].map(row=>[...row.cells].slice(1).map(cell=>[cell.textContent,cell.dataset.value??null]));
  });
  await page.locator('#passage-time').focus();await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#passage-time').inputValue(),'239');
  assert.ok(Number(await page.locator('#passage-north-component').getAttribute('data-value'))>0);
  await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#component-time').inputValue(),'241');
  assert.ok(Number(await page.locator('#passage-north-component').getAttribute('data-value'))<0);
  const after=await page.locator('#sampled-values-body').evaluate(body=>({
    sameRows:[...body.rows].every((row,i)=>row===window.directionRows[i]),
    cells:[...body.rows].map(row=>[...row.cells].slice(1).map(cell=>[cell.textContent,cell.dataset.value??null]))
  }));
  assert.equal(after.sameRows,true);assert.deepEqual(after.cells,retained);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'passage-time');
  await page.locator('#component-inspect-peak').focus();await page.keyboard.press('Enter');
  await page.locator('#lab-share').click();const northURL=page.url();
  assert.equal(new URL(northURL).searchParams.get('sample'),'240');
  const southURL=new URL(northURL);southURL.searchParams.set('offset','-1');
  await page.goto(southURL.href);await ready(page);state=await cardinal(page,120);
  assert.match(state.arrow,/^M368\.000 260\.000 L410\.000 260\.000 /);
  await page.goBack();await ready(page);await cardinal(page,-80);
  await page.goForward();await ready(page);await cardinal(page,120);
  await page.reload();await ready(page);await cardinal(page,120);
  await input(page,'probe-x',-2);await input(page,'probe-y',2);
  await cardinal(page,120); // Separate stationary coordinates do not relocate this probe.
  await input(page,'peak',50);await input(page,'background',50);await input(page,'offset',1);
  await cardinal(page,0);
  assert.match(await page.locator('#passage-direction-reading').textContent(),/no direction/);
  assert.equal(await page.locator('#passage-direction-arrow').getAttribute('d'),'');
  await page.locator('#wind-reset').click();
  await page.waitForFunction(()=>document.getElementById('passage-time').value==='0' && document.getElementById('background').value==='0');
  assert.equal(await page.locator('#passage-east-component').textContent(),'-2.7 mph');
  assert.equal(await page.locator('#passage-north-component').textContent(),'+16.2 mph');
  await input(page,'background',20);await input(page,'offset',3);await input(page,'passage-time',0);
  await page.evaluate(async()=>{await document.fonts.ready;});
  assert.ok(Math.abs(Number(await page.locator('#passage-east-component').getAttribute('data-value'))-40/3)<1e-10);
  assert.ok(Math.abs(Number(await page.locator('#passage-north-component').getAttribute('data-value'))-40/3)<1e-10);
  const legend=page.locator('#passage-probe-legend');
  assert.equal(await legend.count(),1,'Exactly one complete probe legend');
  assert.equal(await legend.textContent(),'FIXED PROBE: GOLD DOT');
  assert.equal(await page.locator('#passage-direction-arrow').getAttribute('visibility'),'visible');
  const geometry=await page.locator('#passage-plan').evaluate(plan=>{
    const rect=node=>{const b=node.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
    return {plan:rect(plan),arrow:rect(plan.querySelector('#passage-direction-arrow')),legend:rect(plan.querySelector('#passage-probe-legend'))};
  });
  assert.ok(geometry.arrow.right>geometry.arrow.left && geometry.arrow.bottom>geometry.arrow.top,'The direction arrow must have a visible extent');
  assert.ok(geometry.arrow.right+4<=geometry.legend.left,'Direction arrow and complete legend need a 4 CSS pixel gap: '+JSON.stringify(geometry));
  assert.ok(geometry.legend.left>=geometry.plan.left && geometry.legend.right<=geometry.plan.right && geometry.legend.top>=geometry.plan.top && geometry.legend.bottom<=geometry.plan.bottom,'Complete probe legend must fit the plan: '+JSON.stringify(geometry));
  await page.locator('#wind-reset').click();
  await page.waitForFunction(()=>document.getElementById('passage-time').value==='0' && document.getElementById('background').value==='0' && document.getElementById('offset').value==='1');
  const passageControls=page.locator('#passage .study-controls').filter({has:page.locator('#passage-east-component')});
  assert.equal(await passageControls.count(),1,'Exactly one passage control panel contains the selected east component');
  await passageControls.evaluate(host=>{
    for(const node of host.querySelectorAll('dt,dd,p'))node.style.fontSize=(parseFloat(getComputedStyle(node).fontSize)*2)+'px';
  });
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  for(const id of ['passage-east-component','passage-north-component','passage-direction-reading']){
    const boxes=await page.locator('#'+id).evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);return [...range.getClientRects()].map(r=>({left:r.left,right:r.right}));});
    for(const box of boxes)assert.ok(box.left>=-1&&box.right<=width+1,JSON.stringify(box));
  }
  t.diagnostic(JSON.stringify({width,appearance,closest_approach_mph:[-80,120],zero_direction:true,restores:['Back','Forward','reload'],physical_phone:false}));
});

for(const mode of ['no-script','unavailable-direction-module'])test('Passage direction default reading '+mode,{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:800},javaScriptEnabled:mode!=='no-script',serviceWorkers:'block'});
  if(mode==='unavailable-direction-module')await page.route('**/passage-direction.mjs',route=>route.abort());
  await page.goto(base+'/wind.html');
  assert.equal(await page.locator('#passage-east-component').textContent(),'-2.7 mph');
  assert.equal(await page.locator('#passage-north-component').textContent(),'+16.2 mph');
  assert.equal(await page.locator('#passage-direction-defaults').isVisible(),true);
  assert.match(await page.locator('#passage-direction-defaults').textContent(),/first|sample 1/i);
  assert.equal(await page.locator('#passage-direction-arrow').getAttribute('visibility'),'hidden');
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  assert.match(await page.locator('#sampled-values-static').textContent(),/default experiment/);
});
