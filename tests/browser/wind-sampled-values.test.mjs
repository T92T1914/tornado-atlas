import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,base} from './harness.mjs';
import {defaultExperiment} from '../../tools/build_wind_sample_table.mjs';
import {samplePassage,loadAt,MPH,FOOT} from '../../web/wind-model.mjs';
import {componentHistory} from '../../web/component-model.mjs';
import {assertSampledWindNumbers} from '../wind-numeric-acceptance.mjs';

const html=await readFile(new URL('../../web/wind.html',import.meta.url),'utf8');
const defaults=defaultExperiment(html);
async function ready(page) {
  await page.waitForFunction(()=>document.body.dataset.windSamples==='ready');
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  assert.match(await page.locator('#sampled-values-assumptions').textContent(),/Nominal spacing is approximately 0\.284 model seconds between samples/);
}
async function expectedRows(page,field=defaults.field,capacity=defaults.capacity,realm='browser') {
  let expected;
  if(realm==='browser') {
    // Compute the pure model separately from the table adapter in the actual
    // tested engine. Expected settings come from this test, not table cells.
    const reference=await page.evaluate(async ({field,capacity,threshold})=>{
      const [{samplePassage,loadAt,MPH,FOOT},{componentHistory}]=await Promise.all([
        import(new URL('./wind-model.mjs',location.href).href),
        import(new URL('./component-model.mjs',location.href).href),
      ]);
      const number=id=>Number(document.getElementById(id).value);
      const samples=samplePassage(field,{threshold}).samples;
      const states=componentHistory(samples,{...field,capacity}).states;
      return {MPH,FOOT,field:{peak:number('peak')*MPH,radius:number('radius')*FOOT,
        background:number('background')*MPH,travel:number('travel')*MPH,
        offset:number('offset'),area:number('area'),coefficient:number('coefficient')},
        threshold:number('threshold')*MPH,capacity:number('capacity')*1000,
        rows:samples.map((sample,index)=>({values:[sample.time,sample.speed/MPH,sample.speed,
          loadAt(sample.speed,field).pressure/1000,states[index].force/1000,states[index].ratio],
          failed:states[index].failed}))};
    },{field,capacity,threshold:defaults.threshold});
    assert.equal(reference.MPH,MPH);assert.equal(reference.FOOT,FOOT);
    assert.deepEqual(reference.field,field,'Actual controls must match independently expected settings');
    assert.equal(reference.threshold,defaults.threshold);assert.equal(reference.capacity,capacity);
    expected=reference.rows;
  } else {
    assert.equal(realm,'node-static','Known calculation realm required');
    // Unavailable-script rows are the unchanged, Node-generated default table.
    const samples=samplePassage(field,{threshold:defaults.threshold}).samples;
    const states=componentHistory(samples,{...field,capacity}).states;
    expected=samples.map((sample,index)=>({values:[sample.time,sample.speed/MPH,sample.speed,
      loadAt(sample.speed,field).pressure/1000,states[index].force/1000,states[index].ratio],
      failed:states[index].failed}));
  }
  const observed=await page.locator('#sampled-values-body tr').evaluateAll(rows=>rows.map(row=>({
    values:[...row.querySelectorAll('td[data-value]')].map(cell=>Number(cell.dataset.value)),
    display:[...row.querySelectorAll('td[data-value]')].map(cell=>cell.textContent),
    state:row.cells[7].textContent,
  })));
  assert.equal(expected.length,481);
  assert.equal(observed.length,481);
  for(const [index,row] of observed.entries()) {
    assertSampledWindNumbers(row.values,expected[index].values,`Wind sample ${index+1}`);
    assert.deepEqual(row.display,row.values.map((value,column)=>value.toFixed([2,2,2,3,3,3][column])));
    assert.equal(row.state,expected[index].failed?'Failed under this rule':'Capacity not exceeded so far');
  }
}
async function nativeHorizontalScroll(page) {
  const deadline=performance.now()+10000;
  let stopped=false,timer;
  const poll=(async()=>{
    while(!stopped && performance.now()<deadline) {
      const left=await page.evaluate(()=>document.getElementById('sampled-values-region').scrollLeft);
      if(left>0 && performance.now()<deadline)return true;
      const remaining=deadline-performance.now();
      if(remaining>0)await delay(Math.min(25,remaining));
    }
    return false;
  })();
  try {
    const observed=await Promise.race([poll,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),10000);})]);
    assert.equal(observed,true,'Native region scrollLeft must become positive within 10000ms');
  } finally {stopped=true;clearTimeout(timer);}
}

for(const [width,appearance] of [[390,'dark'],[1280,'light']]) {
  test(`Wind sampled values ${width} ${appearance}: actual settings, selected row and numeric reading`,{timeout:45000},async t=>{
    const page=await fixture(t,{viewport:{width,height:844},hasTouch:width<600,
      isMobile:width<600,reducedMotion:'reduce',serviceWorkers:'block'});
    await page.goto(base+'/wind.html#sampled-values');await ready(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    await expectedRows(page);
    await page.evaluate(()=>window.originalSampleRows=[...document.querySelectorAll('#sampled-values-body tr')]);
    await page.locator('#travel').focus();await page.keyboard.press('End');
    assert.equal(await page.locator('#travel').inputValue(),'80');
    await expectedRows(page,{...defaults.field,travel:80*MPH});
    assert.match(await page.locator('#sampled-values-assumptions').textContent(),/Nominal spacing is approximately 0\.107 model seconds between samples/);
    assert.equal(await page.evaluate(()=>window.originalSampleRows.every((row,index)=>row===document.querySelectorAll('#sampled-values-body tr')[index])),true);
    await page.locator('#passage-time').focus();await page.keyboard.press('End');
    assert.equal(await page.locator('#sampled-values-selection').textContent(),'Sample 481 of 481 selected.');
    await page.locator('#sampled-values-show').click();
    assert.equal(await page.locator('#sampled-values-details').getAttribute('open'),'');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'passage-sample-480');
    assert.equal(await page.locator('#passage-sample-480').getAttribute('aria-current'),'true');
    const region=page.locator('#sampled-values-region');
    assert.equal(await region.evaluate(node=>node.scrollTop>0),true);
    if(process.env.ATLAS_SCREENSHOT_DIR) await page.screenshot({
      path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`wind-samples-${width}-${appearance}.png`)});
    await region.focus();
    if(width<600) {
      await region.evaluate(node=>{node.scrollLeft=0;});
      await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
      await page.waitForFunction(()=>document.getElementById('sampled-values-region').scrollLeft>0);
    }
    await page.locator('#reading-appearance').selectOption(appearance==='dark'?'light':'dark');
    await expectedRows(page,{...defaults.field,travel:80*MPH});
    assert.match(await page.locator('#sampled-values-assumptions').textContent(),/Nominal spacing is approximately 0\.107 model seconds between samples/);
    // Apply one absolute 2x text override, without compounding nested nodes.
    await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll('#sampled-values h3,#sampled-values p,#sampled-values summary,#sampled-values span,#sampled-values button,#sampled-values th,#sampled-values td,#sampled-values caption')];
      const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node,index)=>{node.style.fontSize=sizes[index]*2+'px';});
    });
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.ok(await page.locator('#sampled-values-help').isVisible());
    assert.match(await page.locator('#sampled-values-help').textContent(),/State uses unrounded force/);
    await page.locator('#wind-reset').click();
    assert.equal(await page.locator('#travel').inputValue(),'30');
    await expectedRows(page);
    assert.match(await page.locator('#sampled-values-assumptions').textContent(),/Nominal spacing is approximately 0\.284 model seconds between samples/);
    assert.equal(await page.locator('#sampled-values-body tr[aria-current=true]').getAttribute('id'),'passage-sample-0');
  });
}

test('Wind sampled table preserves numeric cells, row identity and focus during the shared clock', {timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await page.clock.install();
  await page.addInitScript(()=>{
    const Native=window.IntersectionObserver;
    window.IntersectionObserver=class extends Native {
      constructor(callback,options){super((entries,observer)=>{
        if(entries[0]?.target.id==='passage')window.samplePassageVisible=entries[0].isIntersecting;
        callback(entries,observer);
      },options);}
    };
  });
  await page.route('**/passage.js',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:`window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),200);window.cancelAnimationFrame=id=>clearTimeout(id);${await response.text()}`});
  });
  await page.goto(base+'/wind.html');await ready(page);
  await page.locator('#sampled-values-show').click();
  await page.locator('#passage-play').scrollIntoViewIfNeeded();
  for(let attempt=0;attempt<20 && !await page.evaluate(()=>window.samplePassageVisible);attempt++)await delay(25);
  assert.equal(await page.evaluate(()=>window.samplePassageVisible),true);
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+200));
  await page.evaluate(()=>{
    window.originalSampleRows=[...document.querySelectorAll('#sampled-values-body tr')];
    window.numericMutations=0;
    const observer=new MutationObserver(records=>{window.numericMutations+=records.length;});
    for(const cell of document.querySelectorAll('#sampled-values-body td'))observer.observe(cell,{attributes:true,childList:true,subtree:true,characterData:true});
    window.savedTableScroll=document.getElementById('sampled-values-region').scrollTop;
  });
  await page.locator('#passage-play').focus();await page.keyboard.press('Enter');
  await page.clock.runFor(1000);
  assert.equal(await page.locator('#sampled-values-selection').textContent(),'Sample 21 of 481 selected.');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'passage-play');
  assert.equal(await page.evaluate(()=>window.originalSampleRows.every((row,index)=>row===document.querySelectorAll('#sampled-values-body tr')[index])),true);
  assert.equal(await page.evaluate(()=>window.numericMutations),0);
  assert.equal(await page.locator('#sampled-values-region').evaluate(node=>node.scrollTop),await page.evaluate(()=>window.savedTableScroll));
  await expectedRows(page);
  await page.keyboard.press('Enter');
  await page.locator('#component-time').focus();await page.keyboard.press('Home');
  assert.equal(await page.locator('#sampled-values-body tr[aria-current=true]').getAttribute('id'),'passage-sample-0');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'component-time');
});

test('Complete default wind samples remain keyboard-readable without scripts', {timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},javaScriptEnabled:false,
    hasTouch:true,isMobile:true,serviceWorkers:'block'});
  await page.goto(base+'/wind.html#sampled-values');
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  assert.ok(await page.locator('#sampled-values-static').isVisible());
  assert.equal(await page.locator('#sampled-values-controls').isVisible(),false);
  await expectedRows(page,defaults.field,defaults.capacity,'node-static');
  await page.locator('#sampled-values-details summary').focus();await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'sampled-values-region');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  await nativeHorizontalScroll(page);
  await page.locator('#travel').focus();await page.keyboard.press('End');
  await expectedRows(page,defaults.field,defaults.capacity,'node-static'); // The fallback retains declared defaults.
  assert.match(await page.locator('#sampled-values-assumptions').textContent(),/travel 30.0 mph/);
  assert.match(await page.locator('#sampled-values-assumptions').textContent(),/Nominal spacing is approximately 0\.284 model seconds between samples/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});

test('Unavailable passage module retains the complete declared default calculation', {timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},serviceWorkers:'block'});
  await page.route('**/passage-values.mjs',route=>route.abort());
  await page.goto(base+'/wind.html#sampled-values');
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  assert.equal(await page.evaluate(()=>document.body.dataset.windSamples ?? null),null);
  assert.ok(await page.locator('#sampled-values-static').isVisible());
  assert.equal(await page.locator('#sampled-values-controls').isVisible(),false);
  await page.locator('#sampled-values-details summary').click();
  await expectedRows(page,defaults.field,defaults.capacity,'node-static');
  assert.match(await page.locator('#sampled-values-static').textContent(),/controls cannot recalculate it/);
  assert.match(await page.locator('#sampled-values-assumptions').textContent(),/Nominal spacing is approximately 0\.284 model seconds between samples/);
});

const capacityCapture=process.env.ATLAS_CAPACITY_CAPTURE;
const V=100*.44704,B=20*.44704,R=500*.3048,U=30*.44704,C=1600,K=.5*1.225*1*1.2;
function capacityReference(beta) {
 let first=null,peak=0;
 const rows=Array.from({length:481},(_,i)=>{
  const t=(i/480*2-1)*6*R/U,s=-U*t/R,q=s*s+beta*beta;
  const square=q<=1?(B-V*beta)**2+V**2*s*s:B**2+(V**2-2*B*V*beta)/q;
  const speed=Math.sqrt(square),force=K*square;
  peak=Math.max(peak,force);
  if(force>C&&first===null)first=i;
  return {values:[t,speed/.44704,speed,.5*1.225*square/1000,force/1000,force/C],failed:first!==null};
 });
 return {rows,first,peak};
}
async function capacityRange(page,id,rights,value) {
 const input=page.locator('#'+id);await input.focus();await page.keyboard.press('Home');
 for(let i=0;i<rights;i++)await page.keyboard.press('ArrowRight');
 assert.equal(Number(await input.inputValue()),value,id+' exact native control value');
}
for(const width of [320,1280])for(const beta of [-.7,.7])test('Independent assumed capacity consumer '+width+' '+beta,async t=>{
 const reference=capacityReference(beta);
 assert.equal(reference.first,beta<0?206:null);
 const page=await fixture(t,{viewport:{width,height:900},serviceWorkers:'block'});
 await page.emulateMedia({colorScheme:width===320?'dark':'light',reducedMotion:'reduce'});
 await page.goto(base+'/wind.html');
 await page.waitForFunction(()=>document.body.dataset.windSamples==='ready');
 await capacityRange(page,'background',4,20);await capacityRange(page,'offset',beta<0?23:37,beta);
 await capacityRange(page,'capacity',15,1.6);
 for(const [id,value] of [['peak',100],['radius',500],['travel',30],['area',1],['coefficient',1.2]])assert.equal(Number(await page.locator('#'+id).inputValue()),value);
 await expectedRows(page,{...defaults.field,background:20*MPH,offset:beta},1600);
 assert.match(await page.locator('#sampled-values-assumptions').innerText(),/eastward background 20.0 mph/);
 assert.match(await page.locator('#sampled-values-assumptions').innerText(),/assumed capacity 1.6 kN/);
 const actual=await page.locator('#sampled-values-body tr').evaluateAll(rows=>rows.map(row=>({values:[...row.querySelectorAll('td[data-value]')].map(c=>Number(c.dataset.value)),state:row.cells[7].textContent})));
 assert.equal(actual.length,481);
 let maxError=0;
 for(let i=0;i<481;i++) {
  assert.equal(actual[i].values.length,6);
  for(let c=0;c<6;c++){assert.ok(Number.isFinite(actual[i].values[c]));const error=Math.abs(actual[i].values[c]-reference.rows[i].values[c]);maxError=Math.max(maxError,error);assert.ok(error<1e-10,'Independent SI value row'+i+' column'+c);}
  assert.equal(actual[i].state,reference.rows[i].failed?'Failed under this rule':'Capacity not exceeded so far');
 }
 assert.equal(await page.locator('#component-peak').innerText(),(reference.peak/1000).toFixed(2)+' kN');
 if(beta<0) {
  assert.equal(await page.locator('#component-first').innerText(),'-9.7 s from closest approach (first failing sample)');
  await capacityRange(page,'passage-time',205,205);assert.equal(await page.locator('#component-state').innerText(),'Capacity not exceeded so far');
  await page.keyboard.press('ArrowRight');assert.equal(Number(await page.locator('#passage-time').inputValue()),206);
  assert.equal(await page.locator('#component-state').innerText(),'Failed under this rule');
  assert.equal(await page.locator('#component-panel').evaluate(n=>n.classList.contains('failed')),true);
  assert.equal(await page.locator('#component-time').inputValue(),'206');
  await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#component-state').innerText(),'Capacity not exceeded so far');
  await page.keyboard.press('ArrowRight');
 } else {
  assert.equal(await page.locator('#component-first').innerText(),'Not exceeded in this sampled window');
  await capacityRange(page,'component-time',300,300);
  assert.equal(await page.locator('#component-state').innerText(),'Capacity not exceeded so far');
  assert.equal(await page.locator('#passage-time').inputValue(),'300');
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(capacityCapture){await mkdir(capacityCapture,{recursive:true});await page.locator('#component-diagram').screenshot({path:capacityCapture+'/component-'+width+'-'+beta+'.png'});}
 t.diagnostic(JSON.stringify({case:'independent_capacity_consumer',width,beta,samples:actual.length,max_numeric_error:maxError,first:reference.first,peak_kN:reference.peak/1000,scope:'Isolated actual native keyboard controls and unrounded DOM values versus independent assumed-model algebra, no historical or physical-device acceptance'}));
});
