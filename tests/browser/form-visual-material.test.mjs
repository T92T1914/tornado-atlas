import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
for(const width of [320,1280])for(const scheme of ['light','dark'])test('Illustrative cloud material preserves controls '+width+' '+scheme,{timeout:30000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},colorScheme:scheme,reducedMotion:'reduce',serviceWorkers:'block'});
 await page.addInitScript(()=>localStorage.setItem('tornado-atlas-appearance','system'));
 await page.goto(base+'/study.html?event=el-reno-2013');
 await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();await page.locator('#sequence-enabled').uncheck();
 await page.waitForFunction(()=>!document.getElementById('motion').disabled||!document.getElementById('scene-failure').hidden);
 const available=await page.locator('#scene').evaluate(canvas=>Boolean(canvas.getContext('webgl2')));
 if(!available){
  assert.equal(await page.locator('#motion').isDisabled(),true);
  assert.equal(await page.locator('#scene-failure').isVisible(),true);
  assert.equal(await page.locator('#motion-status').textContent(),'WebGL 2 is unavailable');
  assert.equal(await page.locator('#scene-failure-return').getAttribute('href'),'index.html#photos');
  assert.equal(await page.locator('#scene-failure-return').isVisible(),true);
  t.skip('Actual WebGL2 material is unverified in this engine. Exact unavailable diagnosis and documentary return remain available.');return;
 }
 assert.equal(await page.locator('#motion').isEnabled(),true);
 assert.equal(await page.locator('#scene-failure').isVisible(),false);
 await page.locator('#scene').scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
 const initial=await page.evaluate(()=>({event:new URL(location.href).searchParams.get('event'),history:history.length,time:document.getElementById('sequence-time').value,coverage:document.getElementById('scene').dataset.appearanceCoverage}));
 await page.locator('#scene').evaluate(canvas=>{
  const gl=canvas.getContext('webgl2');if(!gl)throw Error('Actual WebGL2 required');
  const draw=gl.drawArrays;window.cloudMaterialObservation={draws:0};
  gl.drawArrays=function(...args){const result=draw.apply(this,args);if(args[0]===gl.POINTS){
   const rgba=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
   let painted=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i]>0)painted++;
   window.cloudMaterialObservation={draws:window.cloudMaterialObservation.draws+1,error:gl.getError(),lost:gl.isContextLost(),painted,width:canvas.width,height:canvas.height};
  }return result;};
 });
 for(const shape of ['wedge','rope','cone']){
  const before=await page.evaluate(()=>window.cloudMaterialObservation.draws);await page.locator('#shape').selectOption(shape);
  await page.waitForFunction(before=>window.cloudMaterialObservation.draws>before,before);
  await page.waitForFunction(shape=>new URL(location.href).searchParams.get('shape')===shape,shape);
  const actual=await page.evaluate(()=>window.cloudMaterialObservation);assert.equal(actual.error,0);assert.equal(actual.lost,false);assert.ok(actual.painted>0);
  assert.equal(await page.locator('#shape').inputValue(),shape);assert.equal(await page.locator('#motion').textContent(),'Play motion');
  if(process.env.ATLAS_FORM_CAPTURE&&shape==='wedge'){await mkdir(process.env.ATLAS_FORM_CAPTURE,{recursive:true});await page.locator('#scene').screenshot({path:path.join(process.env.ATLAS_FORM_CAPTURE,'form-wedge-'+width+'-'+scheme+'.png')});}
 }
 const after=await page.evaluate(()=>({event:new URL(location.href).searchParams.get('event'),history:history.length,time:document.getElementById('sequence-time').value,coverage:document.getElementById('scene').dataset.appearanceCoverage}));assert.deepEqual(after,initial);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 t.diagnostic(JSON.stringify({width,scheme,actual:await page.evaluate(()=>window.cloudMaterialObservation),scope:'Native isolated rendering of three illustrative forms. No historical fit or native GPU measurement.'}));
});
