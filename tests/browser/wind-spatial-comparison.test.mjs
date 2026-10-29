import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

// These are independent cardinal-point and squared-speed expectations from
// the predeclared acceptance contract. No production model supplies them.
const defaults={
  east:'0.0 mph · 0.0 m/s',north:'100.0 mph · 44.7 m/s',
  northPoint:'100.0 mph · 44.7 m/s · 1.47 kN drag',
  southPoint:'100.0 mph · 44.7 m/s · 1.47 kN drag',ratio:'1.000 ×',
};
const settings=['peak','radius','background','area','coefficient','travel','offset','threshold','capacity'];
const viewports=[
  {width:320,height:900,deviceScaleFactor:2,hasTouch:true,isMobile:true},
  {width:1280,height:900,deviceScaleFactor:1},
  {width:3840,height:2160,deviceScaleFactor:1},
];

async function readings(page){
  return page.evaluate(()=>Object.fromEntries(Object.entries({
    east:'probe-east-component',north:'probe-north-component',northPoint:'wind-north-point',
    southPoint:'wind-south-point',ratio:'wind-side-ratio',
  }).map(([key,id])=>[key,document.getElementById(id).textContent])));
}
async function capture(page,width,appearance,enlargement){
  if(!process.env.ATLAS_WIND_SPATIAL_CAPTURE)return;
  await mkdir(process.env.ATLAS_WIND_SPATIAL_CAPTURE,{recursive:true});
  await page.locator('#wind-spatial-reading').screenshot({path:path.join(process.env.ATLAS_WIND_SPATIAL_CAPTURE,
    `wind-spatial-${width}-${appearance}-${enlargement}x.png`)});
}
async function pausedState(page){
  return page.evaluate(ids=>({
    settings:Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value])),
    clocks:['passage-time','component-time'].map(id=>document.getElementById(id).value),
    selected:[...document.querySelectorAll('#sampled-values-body tr[aria-current="true"]')].map(node=>node.id),
    buttons:['wind-motion','passage-play','component-play'].map(id=>document.getElementById(id).textContent),
    reference:document.getElementById('lab-event').value,
  }),settings);
}
function assertPaused(state){
  assert.deepEqual(state.clocks,['137','137']);
  assert.deepEqual(state.selected,['passage-sample-137']);
  assert.deepEqual(state.buttons,['Play tracers','Play passage','Play passage']);
}
async function nativeRange(page,id,{home=false,rights=0,end=false,value}){
  const control=page.locator('#'+id);await control.focus();
  if(home)await page.keyboard.press('Home');
  if(end)await page.keyboard.press('End');
  for(let i=0;i<rights;i++)await page.keyboard.press('ArrowRight');
  assert.equal(Number(await control.inputValue()),value,id+' native range value');
}
async function activate(page,id,key,y){
  const before=await pausedState(page);assertPaused(before);
  await page.locator('#'+id).focus();await page.keyboard.press(key);
  assert.equal(await page.evaluate(()=>document.activeElement.id),id,'Native button retains keyboard focus');
  assert.equal(await page.locator('#probe-x').inputValue(),'0');
  assert.equal(await page.locator('#probe-y').inputValue(),String(y));
  assert.deepEqual(await pausedState(page),before,'Comparison moves only the probe and preserves the paused sample, settings and reference');
  await page.clock.runFor(1000);
  assert.deepEqual(await pausedState(page),before,'Neither motion owner starts after a comparison');
}
async function fit(page){
  const geometry=await page.evaluate(()=>{
    const ids=['wind-spatial-reading','wind-probe-north','wind-probe-south'];
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,
      boxes:Object.fromEntries(ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();
        return [id,{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}];}))};
  });
  assert.equal(geometry.overflow,false,'The document does not overflow horizontally');
  for(const [id,box] of Object.entries(geometry.boxes)){
    assert.ok(box.width>0&&box.height>0&&box.left>=-1&&box.right<=await page.evaluate(()=>innerWidth)+1,id+' fits the CSS viewport');
  }
  const north=geometry.boxes['wind-probe-north'],south=geometry.boxes['wind-probe-south'];
  assert.ok(north.right<=south.left+1||south.right<=north.left+1||north.bottom<=south.top+1||south.bottom<=north.top+1,'Comparison buttons do not overlap');
}

for(const viewport of viewports)test(`Wind signed comparison, keyboard and paused sample ${viewport.width} CSS px DPR ${viewport.deviceScaleFactor}`,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width:viewport.width,height:viewport.height},
    deviceScaleFactor:viewport.deviceScaleFactor,hasTouch:viewport.hasTouch??false,
    isMobile:viewport.isMobile??false,reducedMotion:'reduce',serviceWorkers:'block'});
  await page.clock.install();
  await page.goto(base+'/wind.html#wind-spatial-reading');
  await page.waitForFunction(()=>document.body.dataset.windSamples==='ready');
  await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>innerWidth),viewport.width);
  assert.equal(await page.evaluate(()=>devicePixelRatio),viewport.deviceScaleFactor);
  assert.deepEqual(await readings(page),defaults);
  assert.match(await page.locator('#wind-spatial-assumptions').textContent(),/Peak swirl 100\.0 mph, eastward background 0\.0 mph, core radius 500 ft, area 1\.0 m², coefficient 1\.2 and density 1\.225 kg\/m³/);
  // Seek the existing sample owner only. Comparison buttons must leave it here.
  await page.locator('#passage-time').evaluate(node=>{node.value='137';node.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+50));
  assertPaused(await pausedState(page));
  await nativeRange(page,'background',{home:true,rights:4,value:20});
  assert.deepEqual(await readings(page),{...defaults,east:'20.0 mph · 8.9 m/s',
    northPoint:'80.0 mph · 35.8 m/s · 0.94 kN drag',
    southPoint:'120.0 mph · 53.6 m/s · 2.12 kN drag',ratio:'2.250 ×'});
  await activate(page,'wind-probe-north','Enter',1);
  assert.equal((await readings(page)).east,'-80.0 mph · -35.8 m/s');
  assert.equal((await readings(page)).north,'0.0 mph · 0.0 m/s');
  await activate(page,'wind-probe-south','Space',-1);
  assert.equal((await readings(page)).east,'120.0 mph · 53.6 m/s');
  assert.equal((await readings(page)).north,'0.0 mph · 0.0 m/s');
  await nativeRange(page,'peak',{home:true,value:10});
  await nativeRange(page,'background',{end:true,value:50});
  await activate(page,'wind-probe-north','Space',1);
  assert.equal((await readings(page)).east,'40.0 mph · 17.9 m/s');
  assert.equal((await readings(page)).north,'0.0 mph · 0.0 m/s');
  assert.match((await readings(page)).northPoint,/^40\.0 mph/);
  assert.match((await readings(page)).southPoint,/^60\.0 mph/);
  assert.match(await page.locator('#wind-spatial-note').textContent(),/net wind at the north point still points east/);
  const stable=await pausedState(page),numbers=await readings(page);
  for(const appearance of ['light','dark']){
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.equal(await page.locator('html').getAttribute('data-appearance'),appearance);
    assert.deepEqual(await readings(page),numbers);
    assert.deepEqual(await pausedState(page),stable);
    await fit(page);
    await capture(page,viewport.width,appearance,1);
  }
  // Absolute text doubling, rather than compounding sizes down the DOM tree.
  await page.locator('#wind-spatial-reading').evaluate(section=>{
    const nodes=[...section.querySelectorAll('h3,p,dt,dd,button')];
    const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node,index)=>{node.style.fontSize=sizes[index]*2+'px';});
  });
  for(const appearance of ['dark','light']){
    await page.locator('#reading-appearance').selectOption(appearance);await fit(page);
    await activate(page,'wind-probe-south','Enter',-1);
    assert.equal((await readings(page)).east,'60.0 mph · 26.8 m/s');
    await activate(page,'wind-probe-north','Space',1);
    assert.deepEqual(await readings(page),numbers);
    await capture(page,viewport.width,appearance,2);
  }
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  t.diagnostic(JSON.stringify({kind:'isolated-actual-wind-consumer',...viewport,
    appearances:['light','dark'],textEnlargement:2,sample:137,
    scope:'Independent cardinal readings and native keyboard comparison. No physical phone, screen reader, comprehension, historical wind or rendering benchmark claim.'}));
});

for(const viewport of viewports)for(const failure of ['no-script','module-refusal'])test(`Wind fixed comparison ${failure} ${viewport.width} CSS px DPR ${viewport.deviceScaleFactor}`,{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width:viewport.width,height:viewport.height},
    deviceScaleFactor:viewport.deviceScaleFactor,hasTouch:viewport.hasTouch??false,
    isMobile:viewport.isMobile??false,javaScriptEnabled:failure!=='no-script',
    reducedMotion:'reduce',serviceWorkers:'block'});
  let refused=0;
  if(failure==='module-refusal')await page.route('**/wind.js',route=>{refused++;return route.abort('failed');});
  await page.goto(base+'/wind.html#wind-spatial-reading');
  if(failure==='no-script'){
    // Read the actual static layout without awaiting a page Promise while scripts are disabled.
    const staticLayout=await page.evaluate(()=>{
      const box=document.getElementById('wind-spatial-reading').getBoundingClientRect();
      return {ready:document.readyState,fonts:document.fonts.status,width:box.width,height:box.height};
    });
    console.info('WIND_NOSCRIPT_STATIC_LAYOUT '+JSON.stringify({viewport_width:viewport.width,dpr:viewport.deviceScaleFactor,layout:staticLayout}));
    assert.equal(staticLayout.ready,'complete');assert.equal(staticLayout.fonts,'loaded');
    assert.ok(Number.isFinite(staticLayout.width)&&Number.isFinite(staticLayout.height)&&staticLayout.width>0&&staticLayout.height>0,'The complete static comparison has actual layout');
  }else await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>innerWidth),viewport.width);
  assert.equal(await page.evaluate(()=>devicePixelRatio),viewport.deviceScaleFactor);
  if(failure==='module-refusal'){
    await page.waitForFunction(()=>document.readyState==='complete');
    assert.equal(refused,1,'The actual wind module request was refused once');
  }
  assert.equal(await page.evaluate(()=>document.body.dataset.windSamples??null),null);
  assert.deepEqual(await readings(page),defaults);
  for(const id of ['wind-probe-north','wind-probe-south'])assert.equal(await page.locator('#'+id).isDisabled(),true);
  assert.match(await page.locator('#wind-spatial-reading .control-note').textContent(),/Without scripts, they remain this default example/);
  assert.match(await page.locator('#wind-spatial-reading .control-note').textContent(),/do not describe measured winds, damage or a real object's resistance/);
  assert.equal(await page.locator('#wind-spatial-reading a').first().getAttribute('href'),'https://glossary.ametsoc.org/wiki/rankine-vortex/');
  assert.equal(await page.locator('#wind-spatial-reading a').nth(1).getAttribute('href'),'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/');
  const links=await page.locator('#lab-documentary-fallback a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
  assert.deepEqual(links,['index.html','joplin.html','blackwell.html','tuscaloosa.html','moore.html','udall.html']);
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  assert.ok(await page.locator('#sampled-values-static').isVisible());
  assert.match(await page.locator('#sampled-values-static').textContent(),/controls cannot recalculate it/);
  // A native slider remains operable, but the printed fallback is explicitly
  // fixed. Its readouts must not masquerade as a fresh 20 mph calculation.
  await nativeRange(page,'background',{home:true,rights:4,value:20});
  assert.deepEqual(await readings(page),defaults);
  assert.match(await page.locator('#wind-spatial-assumptions').textContent(),/eastward background 0\.0 mph/);
  await fit(page);
  t.diagnostic(JSON.stringify({kind:'isolated-fixed-wind-fallback',failure,...viewport,refused,
    scope:'Static default disclosure, disabled comparison and retained documentary/table reading. No provider request or physical-device acceptance.'}));
});
