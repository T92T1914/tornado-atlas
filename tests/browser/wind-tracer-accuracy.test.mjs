import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const fields=['peak','radius','background','probe-x','probe-y','area','coefficient','travel','offset','threshold','capacity'];
async function input(page,id,value){
  await page.locator('#'+id).evaluate((node,value)=>{node.value=String(value);node.dispatchEvent(new Event('input',{bubbles:true}));},value);
}
async function ready(page){await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();}
async function paused(page){
  for(const id of ['wind-motion','passage-play','component-play'])assert.match(await page.locator('#'+id).textContent(),/^Play/);
}
async function state(page){
  return page.evaluate(fields=>({
    values:Object.fromEntries(fields.map(id=>[id,document.getElementById(id).value])),
    sample:document.getElementById('passage-time').value,paired:document.getElementById('component-time').value,
    selected:[...document.querySelectorAll('#sampled-values-body tr[aria-current="true"]')].map(node=>node.id),
    readouts:Object.fromEntries(['probe-speed','probe-pressure','probe-force','passage-now','passage-force','component-now','component-first','component-state','reference-maximum-wind','reference-maximum-drag'].map(id=>[id,document.getElementById(id).textContent])),
    rows:[205,206].map(index=>[...document.getElementById('passage-sample-'+index).cells].map(cell=>[cell.textContent,cell.dataset.value??null])),
    rowCount:document.querySelectorAll('#sampled-values-body tr').length,
    source:document.getElementById('lab-event').value,
    share:document.getElementById('lab-share').getAttribute('href')
  }),fields);
}

async function controlledDrawing(page){
  await page.addInitScript(()=>{
    // A deterministic test clock owns only this isolated page's rAF queue.
    // The production module/helper and native Canvas drawing remain unchanged.
    const nativeRAF=window.requestAnimationFrame,nativeCancel=window.cancelAnimationFrame;
    let next=0;const queue=new Map();
    window.requestAnimationFrame=callback=>{queue.set(++next,callback);return next;};
    window.cancelAnimationFrame=id=>queue.delete(id);
    const observed={points:[],frames:0};
    const clear=CanvasRenderingContext2D.prototype.clearRect,arc=CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.clearRect=function(...args){
      if(this.canvas.id==='wind-field'){observed.points=[];observed.frames++;}
      return clear.apply(this,args);
    };
    CanvasRenderingContext2D.prototype.arc=function(x,y,r,...args){
      if(this.canvas.id==='wind-field'&&r===1.15)observed.points.push([x,y]);
      return arc.call(this,x,y,r,...args);
    };
    window.windAccuracyTest={observed,step(now){const batch=[...queue.values()];queue.clear();for(const callback of batch)callback(now);},restore(){queue.clear();window.requestAnimationFrame=nativeRAF;window.cancelAnimationFrame=nativeCancel;}};
  });
}
async function drawing(page){
  return page.evaluate(()=>{
    const canvas=document.getElementById('wind-field'),width=canvas.clientWidth,height=width/1.4,scale=height/5.5;
    return {width,height,scale,frames:window.windAccuracyTest.observed.frames,
      points:window.windAccuracyTest.observed.points.map(([x,y])=>({x:(x-width/2)/scale,y:-(y-height/2)/scale}))};
  });
}
async function visibleField(page){
  await page.locator('#wind-field').scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise(resolve=>{
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();resolve();}},{threshold:.1});
    observer.observe(document.getElementById('wind-field'));
  }));
}

for(const width of [320,1280])for(const appearance of ['light','dark'])test('Wind tracer accuracy preserves paused '+width+' '+appearance,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await controlledDrawing(page);
  await page.emulateMedia({colorScheme:appearance,reducedMotion:'reduce'});
  await page.addInitScript(()=>{if(localStorage.getItem('tornado-atlas-appearance')===null)localStorage.setItem('tornado-atlas-appearance','system');});
  await page.goto(base+'/wind.html?event=moore-2013');await ready(page);await paused(page);
  assert.equal(await page.locator('#reading-appearance').inputValue(),'system');
  assert.equal(await page.locator('html').getAttribute('data-appearance'),null);
  for(const [id,value] of [['peak',250],['radius',50],['background',20]])await input(page,id,value);
  await input(page,'passage-time',205);
  assert.equal(await page.locator('#component-time').inputValue(),'205');
  assert.equal(await page.locator('#passage-sample-205').getAttribute('aria-current'),'true');
  await input(page,'passage-time',206);await page.locator('#lab-share').click();await paused(page);
  assert.equal(new URL(page.url()).searchParams.get('sample'),'206');
  const baseline=await state(page),url=page.url(),history=await page.evaluate(()=>history.length);
  assert.equal(baseline.rowCount,481);assert.equal(baseline.sample,'206');assert.equal(baseline.paired,'206');
  await page.locator('#reading-appearance').selectOption(appearance);
  assert.equal(await page.locator('html').getAttribute('data-appearance'),appearance);
  assert.deepEqual(await state(page),baseline);await paused(page);
  await page.locator('#reading-appearance').selectOption('system');
  const oldColor=await page.locator('body').evaluate(node=>getComputedStyle(node).backgroundColor);
  await page.emulateMedia({colorScheme:appearance==='light'?'dark':'light'});
  await page.waitForFunction(old=>getComputedStyle(document.body).backgroundColor!==old,oldColor,{polling:20});
  assert.equal(await page.locator('html').getAttribute('data-appearance'),null);
  assert.equal(await page.locator('#reading-appearance').inputValue(),'system');
  assert.equal(await page.evaluate(()=>localStorage.getItem('tornado-atlas-appearance')),'system');
  assert.equal(page.url(),url);assert.equal(await page.evaluate(()=>history.length),history);
  assert.deepEqual(await state(page),baseline);await paused(page);
  await page.locator('#reading-appearance').selectOption(appearance);
  await visibleField(page);
  const start=await drawing(page);assert.equal(start.points.length,260,'The native canvas drew every passive marker');
  await page.locator('#wind-motion').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#wind-motion').textContent(),'Pause tracers');
  const longWitness=width===320&&appearance==='dark',steps=longWitness?600:2;
  await page.evaluate(steps=>{window.windAccuracyTest.step(0);for(let i=1;i<=steps;i++)window.windAccuracyTest.step(i*40);},steps);
  const advanced=await drawing(page);assert.equal(advanced.points.length,260);
  assert.ok(advanced.frames>start.frames);assert.notDeepEqual(advanced.points,start.points);
  if(longWitness){
    // Marker 36 is a literal member of the accepted deterministic distribution.
    // Its entire exact orbit is inside the core. This is controlled model time,
    // not observed 24-second browser frame cadence or a historical wind claim.
    const initial={x:((36*137)%521)/100-2.6,y:((36*211)%523)/100-2.6};
    assert.ok(Math.hypot(start.points[36].x-initial.x,start.points[36].y-initial.y)<1e-12);
    const omega=250*.44704/(50*.3048),c=20/250,angle=omega*24,rho=Math.hypot(initial.x,initial.y-c);
    assert.ok(c+rho<1);
    const exact={x:initial.x*Math.cos(angle)-(initial.y-c)*Math.sin(angle),y:c+initial.x*Math.sin(angle)+(initial.y-c)*Math.cos(angle)};
    const actual=advanced.points[36],error=Math.hypot(actual.x-exact.x,actual.y-exact.y);
    assert.ok(error*advanced.scale<=1,'Actual production helper/drawing must stay within the declared one-pixel geometric criterion: '+error*advanced.scale);
    const a=omega*.04,g=Math.sqrt(1+a**4/4),phase=600*Math.atan2(a,1-a*a/2),growth=g**600;
    const old={x:growth*(initial.x*Math.cos(phase)-(initial.y-c)*Math.sin(phase)),y:c+growth*(initial.x*Math.sin(phase)+(initial.y-c)*Math.cos(phase))};
    assert.ok((c+rho*g**599*Math.sqrt(1+a*a/4))<1,'The retained midpoint witness also stays in the core');
    assert.ok(Math.hypot(old.x-exact.x,old.y-exact.y)*advanced.scale>1,'The original approximation fails this same native-drawing witness');
  }
  await page.keyboard.press('Enter');await paused(page);
  const stopped=await drawing(page);await page.evaluate(()=>window.windAccuracyTest.step(50000));
  assert.deepEqual((await drawing(page)).points,stopped.points,'Paused tracers do not advance');
  assert.deepEqual(await state(page),baseline,'Tracer motion does not change measured-model readouts or the selected sample');
  await page.evaluate(()=>window.windAccuracyTest.restore());
  if(process.env.ATLAS_WIND_CAPTURE){
    await mkdir(process.env.ATLAS_WIND_CAPTURE,{recursive:true});
    await page.screenshot({path:path.join(process.env.ATLAS_WIND_CAPTURE,'wind-accuracy-'+width+'-'+appearance+'.png')});
  }
  await page.reload();await ready(page);await paused(page);
  assert.equal(page.url(),url);assert.deepEqual(await state(page),baseline);
  assert.equal(await page.locator('#reading-appearance').inputValue(),appearance);
  await page.locator('#wind-reset').focus();await page.keyboard.press('Enter');await paused(page);
  assert.equal(await page.locator('#peak').inputValue(),'100');assert.equal(await page.locator('#background').inputValue(),'0');
  assert.equal(await page.locator('#lab-event').inputValue(),'moore-2013');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});

test('Wind tracer change retains static reading without JavaScript',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900}});
  await page.goto(base+'/wind.html?event=moore-2013');
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  assert.match(await page.locator('#sampled-values-assumptions').textContent(),/Peak swirl 100.0 mph/);
  assert.match(await page.locator('#wind-reference-status').textContent(),/requires JavaScript/);
  assert.equal(await page.locator('#lab-documentary-fallback a[href="moore.html"]').count(),1);
});

test('Wind tracer change preserves unavailable drawing and reload',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return this.id==='wind-field'&&type==='2d'?null:original.call(this,type,...args);};});
  const query='experiment=wind-1&event=moore-2013&peak=100&radius=500&background=20&probe-x=1&probe-y=0&area=1&coefficient=1.2&travel=30&offset=-0.7&threshold=50&capacity=1.6&sample=206';
  await page.goto(base+'/wind.html?'+query);await ready(page);await paused(page);
  assert.equal(await page.locator('#wind-field-failure').isVisible(),true);
  assert.equal(await page.locator('#wind-motion').isDisabled(),true);
  assert.equal(await page.locator('#probe-speed').textContent(),'102.0 mph');
  assert.equal(await page.locator('#passage-time').inputValue(),'206');
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  const baseline=await state(page);await page.reload();await ready(page);await paused(page);
  assert.deepEqual(await state(page),baseline);assert.equal(await page.locator('#wind-field-failure').isVisible(),true);
  assert.equal(await page.locator('#wind-motion').isDisabled(),true);
});
