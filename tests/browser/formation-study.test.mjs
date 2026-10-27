import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {enlargeText,reflow} from './ground-view-assertions.mjs';

const replay='reconstruction.html?event=el-reno-2013&appearance_view=formation&ground_view=synthetic-front&t=120';
const oldForm2='study.html?experiment=form-2&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=0&coverage=continuous&rate=1&position=0&phase=15&model=kinematic-v1';
const oldForm1='study.html?experiment=form-1&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=0&coverage=continuous&rate=1&position=0&phase=1000000000';

async function openReplay(page){
  await page.goto(base+'/'+replay);
  await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'formation');
}

// Read the actual submitted programs and framebuffer. A caller's model object
// alone cannot establish that the native renderer used the selected scenario.
async function nativeState(page,{study=false,value,seconds,genesis=true,trigger=null}={}){
  const canvas=study?'#scene':'#replay-appearance-canvas',input=trigger??(study?'#sequence-time':'#replay-time');
  const available=await page.locator(canvas).evaluate(c=>Boolean(c.getContext('webgl2')));
  if(!available){
    assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium','Chromium must render the formation scenario');
    return {available:false};
  }
  await page.locator(canvas).scrollIntoViewIfNeeded();
  await page.evaluate(({canvas,input})=>{
    const c=document.querySelector(canvas),gl=c.getContext('webgl2'),control=document.querySelector(input),draw=gl.drawArrays;
    let armed=false,volume=null;
    const arm=()=>{armed=true;};control.addEventListener('input',arm,{capture:true,once:true});
    window.formationNative=null;
    const intercept=function(...args){
      const result=draw.apply(this,args);if(!armed)return result;
      const p=gl.getParameter(gl.CURRENT_PROGRAM),uniform=name=>{
        const location=gl.getUniformLocation(p,name);return location===null?null:gl.getUniform(p,location);
      };
      if(args[0]===gl.TRIANGLES&&uniform('inverseCamera')!==null){
        volume={time:uniform('time'),genesis:uniform('genesis'),progress:uniform('formationProgress'),state:Array.from(uniform('formationState'))};
      }
      if(args[0]!==gl.POINTS)return result;
      gl.drawArrays=draw;
      const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      window.formationPixels=pixels;
      window.formationNative={available:true,time:uniform('time'),genesis:uniform('genesis'),kinematic:uniform('kinematic'),
        progress:uniform('formationProgress'),state:Array.from(uniform('formationState')),volume,
        shape:Array.from(uniform('shape')),matrix:Array.from(uniform('camera')),count:args[2],
        buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],error:gl.getError(),lost:gl.isContextLost()};
      return result;
    };
    gl.drawArrays=intercept;
    window.formationNativeCleanup=()=>{control.removeEventListener('input',arm,true);if(gl.drawArrays===intercept)gl.drawArrays=draw;};
  },{canvas,input});
  try{
    await page.locator(input).fill(String(value));
    // Native range controls can move focus and scroll the scene out of view.
    // Its intended offscreen pause must not be mistaken for a missing draw.
    await page.locator(canvas).scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>window.formationNative!==null);
    const result=await page.evaluate(async()=>({...window.formationNative,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',window.formationPixels))).map(v=>v.toString(16).padStart(2,'0')).join('')}));
    assert.equal(result.error,0);assert.equal(result.lost,false);
    assert.equal(result.genesis,genesis);assert.equal(result.kinematic,true);
    assert.ok(Math.abs(result.time-seconds)<3e-5,'Native motion time follows the declared scenario mapping');
    assert.ok(result.buffer[0]<=512&&result.buffer[1]<=320,'Formation retains the accepted raster budget');
    assert.equal(result.volume?.genesis,genesis);assert.equal(result.volume?.time,result.time);
    assert.deepEqual(result.volume.state,result.state);assert.equal(result.volume.progress,result.progress);
    return result;
  }finally{
    await page.evaluate(()=>{window.formationNativeCleanup?.();window.formationNativeCleanup=null;window.formationPixels=null;});
  }
}

for(const [width,theme]of [[320,'light'],[1280,'dark']]){
  test(`formation scene and declared cameras retain enlarged reading at ${width} ${theme}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});await openReplay(page);
    await page.locator('#reading-appearance').selectOption(theme);
    const early=await nativeState(page,{value:120,seconds:0});
    if(early.available){assert.deepEqual(early.state,[0,0,0,0]);assert.equal(early.progress,0);}
    const developed=await nativeState(page,{value:130,seconds:15});
    if(developed.available){assert.deepEqual(developed.state,[1,0,1,1]);assert.equal(developed.progress,.5);}
    assert.match(await page.locator('#replay-ground-controls').textContent(),/no historical El Reno correspondence/);
    assert.equal(await page.locator('#ground-reference-image').count(),0);
    await enlargeText(page);await reflow(page);
    const stage=page.locator('[data-ground-second="130"]');await stage.focus();await page.keyboard.press('Enter');
    assert.equal(await stage.evaluate(n=>n===document.activeElement&&n.matches(':focus-visible')),true);
    await page.locator('#ground-camera').selectOption('synthetic-oblique');
    const oblique=await nativeState(page,{value:130,seconds:15});
    if(developed.available){assert.notDeepEqual(oblique.matrix,developed.matrix);assert.deepEqual(oblique.state,developed.state);}
    assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  });
}

test('formation replay restores native state across reverse seek, quality, history and old simulation',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce'});await openReplay(page);
  const mature=await nativeState(page,{value:130,seconds:15});
  const end=await nativeState(page,{value:140,seconds:30});
  if(end.available)assert.deepEqual(end.state,[0,1,0,0]);
  const reverse=await nativeState(page,{value:130,seconds:15});
  if(mature.available)assert.equal(reverse.hash,mature.hash);
  await page.locator('#ground-quality').selectOption('1600');
  const low=await nativeState(page,{value:130,seconds:15});
  if(mature.available){assert.equal(low.count,1600);assert.deepEqual(low.state,mature.state);assert.deepEqual(low.shape,mature.shape);}
  await page.locator('#ground-camera').selectOption('synthetic-oblique');
  await nativeState(page,{value:130,seconds:15});
  await page.goBack();assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-front');
  await page.goForward();assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-oblique');
  await page.reload();await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'formation');
  assert.equal(await page.locator('#replay-time').inputValue(),'130');
  await page.locator('#replay-appearance-mode').selectOption('simulation');
  await nativeState(page,{value:130,seconds:130,genesis:false});
  await page.locator('#replay-appearance-mode').selectOption('formation');
  await nativeState(page,{value:130,seconds:15});
  await page.locator('#replay-time').fill('145');
  assert.match(await page.locator('#replay-appearance-state').textContent(),/Outside/);
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
});

test('Form Study compares condensation at unchanged circulation and preserves three experiment versions',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:1000},reducedMotion:'reduce'});
  await page.goto(base+'/study.html');await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(await page.locator('#sequence-coverage').inputValue(),'formation');
  const normal=await nativeState(page,{study:true,value:.5,seconds:15});
  if(normal.available)assert.deepEqual(normal.state,[1,0,1,1]);
  await page.locator('#condensation-visibility').selectOption('limited');
  const limited=await nativeState(page,{study:true,value:.5,seconds:15});
  if(limited.available){assert.ok(Math.abs(limited.state[0]-.22)<1e-6);assert.deepEqual(limited.state.slice(1),[0,1,1]);assert.deepEqual(limited.shape,normal.shape);assert.deepEqual(limited.matrix,normal.matrix);}
  await page.locator('#flow-cues').uncheck();
  await page.locator('#lab-share').click();
  const saved=page.url(),params=new URL(saved).searchParams;
  assert.equal(params.get('experiment'),'form-3');assert.equal(params.get('model'),'genesis-v1');
  assert.equal(params.get('visibility'),'limited');assert.equal(params.get('flow'),'0');assert.equal(params.get('position'),'0.5');
  await page.reload();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(await page.locator('#condensation-visibility').inputValue(),'limited');assert.equal(await page.locator('#flow-cues').isChecked(),false);
  assert.equal(await page.locator('#motion').textContent(),'Play motion');
  await page.goto(base+'/'+oldForm2);await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  await nativeState(page,{study:true,trigger:'#azimuth',value:25,seconds:15,genesis:false});
  await page.locator('#lab-share').click();assert.equal(new URL(page.url()).searchParams.get('experiment'),'form-2');
  await page.goto(base+'/'+oldForm2.replace('phase=15','phase=1000'));await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  await page.locator('#sequence-coverage').selectOption('formation');
  assert.equal(await page.locator('#sequence-enabled').isChecked(),true);
  assert.equal(await page.locator('#sequence-time').inputValue(),'0');
  const restoredFormation=await nativeState(page,{study:true,value:0,seconds:0});
  if(restoredFormation.available)assert.deepEqual(restoredFormation.state,[0,0,0,0]);
  if(restoredFormation.available)assert.equal(await page.locator('#scene-failure').isVisible(),false);
  await page.goto(base+'/'+oldForm1);await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(await page.locator('#sequence-enabled').isChecked(),false);
  await page.locator('#lab-share').click();assert.equal(new URL(page.url()).searchParams.get('experiment'),'form-1');
  assert.equal(new URL(page.url()).searchParams.get('phase'),'1000000000');
});

test('formation motion respects reduced motion and refuses unavailable graphics without stale success',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:1000}});await openReplay(page);
  await page.locator('#replay-play').click();await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>120);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('#replay-play').textContent==='Play timeline');
  const paused=await page.locator('#replay-time').inputValue();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#replay-time').inputValue(),paused);
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:get.call(this,kind,...args);};
  });
  await page.goto(base+'/'+replay);await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
  assert.match(await page.locator('#replay-appearance-renderer-status').textContent(),/could not start/);
  assert.match(await page.locator('#ground-model-note').textContent(),/not a universal life cycle/);
  await page.goto(base+'/'+replay.replace('synthetic-front','unavailable-camera'));
  await page.locator('#replay-time:not([disabled])').waitFor();
  assert.match(await page.locator('#replay-appearance-state').textContent(),/unavailable/);
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
});
