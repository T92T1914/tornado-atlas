import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {enlargeText,reflow} from './ground-view-assertions.mjs';
import {sceneFrame,sameScenario,readingState} from './storm-scene-assertions.mjs';

// Full submitted shader identities from the retained, reviewed private controls.
const shaderHashes={
  'storm-v2':'c125b0cc8f42aa53e13925595809037a3d0dbc4b4ea96ccedf8623d3c9306e2a',
  'storm-v4':'e0c316773e6f5339b2e83cac1d198465cda86b019339335b6d1e12e72a072b29'
};
for(const [quality,raster]of [[7200,[512,288]],[1600,[320,180]]])test('filtered native program preserves accepted geometry and reversible cache selection '+quality,{timeout:60000},async t=>{
  const page=await fixture(t,{deviceScaleFactor:1,reducedMotion:'reduce'});await page.goto(base+'/study.html');
  const result=await page.evaluate(async({quality})=>{
    const canvas=document.createElement('canvas');canvas.style.cssText='display:block;width:512px;height:288px';document.body.prepend(canvas);
    let renderer=null,original=null;
    try{
      const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,powerPreference:'low-power'});
      if(!gl)return {available:false};
      const {createFormRenderer}=await import('/form-renderer.mjs'),{GROUND_CAMERAS}=await import('/ground-view-model.mjs');
      renderer=createFormRenderer(canvas,quality);
      const frames=[],programs=new Set(),retained=new Map();
      const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
      for(const style of ['storm-v2','storm-v4','storm-v2','storm-v4']){
        renderer.render({shape:{base:.4,flare:.5,bend:.1},extent:1,time:15,dust:true,azimuth:25,elevation:12,distance:7,
          motionModel:'genesis-v1',formationTime:15,flow:true,readingAppearance:'dark',lightingStyle:style,sourceCamera:GROUND_CAMERAS[0].camera});
        const program=gl.getParameter(gl.CURRENT_PROGRAM);programs.add(program);
        const uniform=name=>{const location=gl.getUniformLocation(program,name);return location===null?null:gl.getUniform(program,location);};
        const array=name=>{const value=uniform(name);return value===null?null:Array.from(value);};
        const shaders=gl.getAttachedShaders(program)||[],fragments=shaders.filter(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER);
        if(fragments.length!==1)throw Error('Exactly one submitted fragment is required');
        const source=gl.getShaderSource(fragments[0]),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let minimum=255,maximum=0;for(let i=0;i<pixels.length;i++)if(i%4!==3){minimum=Math.min(minimum,pixels[i]);maximum=Math.max(maximum,pixels[i]);}
        const previous=retained.get(style),equal=previous===undefined?null:previous.length===pixels.length&&previous.every((v,i)=>v===pixels[i]);
        if(previous===undefined)retained.set(style,pixels.slice());
        frames.push({style,shaderHash:await digest(new TextEncoder().encode(source)),pixelHash:await digest(pixels),
          compiled:shaders.length===2&&shaders.every(s=>gl.getShaderParameter(s,gl.COMPILE_STATUS)),linked:gl.getProgramParameter(program,gl.LINK_STATUS),
          buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],viewport:array('viewportBox'),time:uniform('time'),state:array('formationState'),
          pullback:array('stormPullback'),inverse:array('inverseCamera'),surface:uniform('surfacePass'),equal,range:maximum-minimum,
          opaque:pixels.every((v,i)=>i%4!==3||v===255),error:gl.getError(),lost:gl.isContextLost()});
      }
      return {available:true,programs:programs.size,frames};
    }catch(error){original=error;throw error;}
    finally{
      try{renderer?.dispose();}catch(error){if(!original)throw error;console.error('FILTERED_STORM_CLEANUP_FAILURE '+String(error).slice(0,500));}
      finally{canvas.remove();}
    }
  },{quality});
  if(!result.available){
    assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium','Chromium must compile the actual filtered storm program');
    t.skip('FILTERED_STORM_UNAVAILABLE No native shader or framebuffer evidence in this engine.');return;
  }
  assert.equal(result.programs,2);assert.equal(result.frames.length,4);
  for(const frame of result.frames){
    assert.equal(frame.shaderHash,shaderHashes[frame.style]);assert.equal(frame.compiled,true);assert.equal(frame.linked,true);
    assert.equal(frame.error,0);assert.equal(frame.lost,false);assert.equal(frame.opaque,true);assert.ok(frame.range>0);
    assert.deepEqual(frame.buffer,raster);assert.deepEqual(frame.viewport,[0,0,...raster]);assert.equal(frame.time,15);assert.equal(frame.surface,false);
    assert.deepEqual(frame.state,[1,0,1,1]);
    for(const key of ['time','state','pullback','inverse','viewport'])assert.deepEqual(frame[key],result.frames[0][key],'Matched settings '+key);
  }
  assert.notEqual(result.frames[0].pixelHash,result.frames[1].pixelHash,'The selected filter changes the actual matched native image');
  assert.equal(result.frames[2].equal,true);assert.equal(result.frames[3].equal,true);
});

for(const [width,theme]of [[320,'light'],[1280,'dark']])test('opt-in filtered Form shares its phase with Replay and returns its saved state '+width,{timeout:60000},async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  await page.goto(base+'/study.html');await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(await page.locator('#sequence-coverage').inputValue(),'storm-detail');
  assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'storm-v2','The existing default is preserved');
  await page.locator('#reading-appearance').selectOption(theme);
  const baseline=await sceneFrame(page,{study:true,style:'storm-v2',retain:'filtered-baseline'});
  const filtered=await sceneFrame(page,{study:true,style:'storm-v4',trigger:'#sequence-coverage',event:'change',retain:'filtered-new',
    action:()=>page.locator('#sequence-coverage').selectOption('storm-filtered')});
  if(baseline){sameScenario(filtered,baseline);assert.notEqual(filtered.hash,baseline.hash);}
  assert.equal(await page.locator('#motion').textContent(),'Play motion');
  assert.match(await page.locator('#lighting-note').textContent(),/geometry|no matched El Reno camera/);
  const old=await sceneFrame(page,{study:true,style:'storm-v2',trigger:'#sequence-coverage',event:'change',compare:'filtered-baseline',
    action:()=>page.locator('#sequence-coverage').selectOption('storm-detail')});
  if(baseline)assert.equal(old.rawEqual,true);
  const back=await sceneFrame(page,{study:true,style:'storm-v4',trigger:'#sequence-coverage',event:'change',compare:'filtered-new',
    action:()=>page.locator('#sequence-coverage').selectOption('storm-filtered')});
  if(filtered)assert.equal(back.rawEqual,true);
  const priorUI=await readingState(page),changed=await sceneFrame(page,{study:true,style:'storm-v4',trigger:'#reading-appearance',event:'change',compare:'filtered-new',
    action:()=>page.locator('#reading-appearance').selectOption(theme==='light'?'dark':'light')});
  assert.notEqual((await readingState(page)).background,priorUI.background);if(filtered)assert.equal(changed.rawEqual,true);
  await page.locator('#lab-share').click();
  const saved=page.url(),params=new URL(saved).searchParams;
  assert.equal(params.get('experiment'),'form-9');assert.equal(params.get('coverage'),'storm-filtered');assert.equal(params.get('presentation'),'storm-v4');
  assert.equal(params.get('position'),'0.5');assert.equal(params.get('phase'),'15');
  await page.reload();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  const restored=await sceneFrame(page,{study:true,style:'storm-v4'});if(filtered)assert.equal(restored.hash,filtered.hash);
  await page.locator('#form-ground-link').focus();
  const destination=new URL(await page.locator('#form-ground-link').getAttribute('href'));
  assert.equal(destination.searchParams.get('t'),'130');assert.equal(destination.searchParams.get('appearance_style'),'storm-v4');
  await Promise.all([page.waitForURL(destination.href,{timeout:10000}),page.keyboard.press('Enter')]);
  await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#replay-time').inputValue(),'130');assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-front');
  assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-scene-frame'),'complete-synthetic');
  assert.match(await page.locator('#ground-render-caption').textContent(),/filtered lighting/);
  assert.match(await page.locator('#ground-model-note').textContent(),/no historical|without measured El Reno/);
  await sceneFrame(page,{style:'storm-v4'});
  await enlargeText(page);await reflow(page);
  await page.goBack();await page.waitForURL(saved,{timeout:10000});
  await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(await page.locator('#sequence-coverage').inputValue(),'storm-filtered');assert.equal(await page.locator('#sequence-time').inputValue(),'0.5');
  assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'storm-v4');assert.equal(await page.locator('#motion').textContent(),'Play motion');
  await enlargeText(page);await reflow(page);
});
