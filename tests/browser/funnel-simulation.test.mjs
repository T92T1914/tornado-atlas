import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {reflow,enlargeText} from './ground-view-assertions.mjs';

const route='reconstruction.html?event=el-reno-2013&appearance_view=simulation&ground_view=synthetic-front&t=120';
async function open(page){
  await page.goto(base+'/'+route);
  await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'simulation');
  assert.match(await page.locator('#replay-appearance-state').textContent(),/No El Reno appearance is registered/);
  assert.equal(await page.locator('#replay-clock-controls').evaluate(n=>n.nextElementSibling?.id),'replay-ground-comparison');
}
async function snapshot(page,seconds){
  const available=await page.locator('#replay-appearance-canvas').evaluate(c=>Boolean(c.getContext('webgl2')));
  if(!available){
    assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium','Chromium must render the new body');
    assert.match(await page.locator('#replay-appearance-renderer-status').textContent(),/could not start|lost/);
    return {available:false};
  }
  await page.evaluate(()=>{
    const canvas=document.querySelector('#replay-appearance-canvas'),gl=canvas.getContext('webgl2');
    const input=document.querySelector('#replay-time'),draw=gl.drawArrays;
    let armed=false,volume=null;
    const arm=()=>{armed=true;};input.addEventListener('input',arm,{capture:true,once:true});
    window.funnelSnapshot=null;
    const intercept=function(...args){
      const result=draw.apply(this,args);if(!armed)return result;
      const program=gl.getParameter(gl.CURRENT_PROGRAM),uniform=name=>{
        const location=gl.getUniformLocation(program,name);return location===null?null:gl.getUniform(program,location);
      };
      if(args[0]===gl.TRIANGLES&&uniform('inverseCamera')!==null){
        const viewport=gl.getParameter(gl.VIEWPORT),pixel=new Uint8Array(4);
        // Independent front-camera ray [640,390] crosses the lower body and
        // misses ground and cloud. Read before wisps can hide a missing volume.
        gl.readPixels(Math.floor(viewport[0]+640/1280*viewport[2]),Math.floor(viewport[1]+(1-390/720)*viewport[3]),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        volume={matrix:Array.from(uniform('inverseCamera')),time:uniform('time'),extent:uniform('extent'),shape:Array.from(uniform('shape')),bodyAlpha:pixel[3]};
      }
      if(args[0]!==gl.POINTS)return result;
      gl.drawArrays=draw;window.funnelPointProgram=program;
      const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      window.funnelPixels=pixels;
      window.funnelSnapshot={available:true,volume,time:uniform('time'),matrix:Array.from(uniform('camera')),shape:Array.from(uniform('shape')),
        kinematic:uniform('kinematic'),palette:uniform('readingPalette'),pointCount:args[2],error:gl.getError(),lost:gl.isContextLost(),
        viewport:Array.from(gl.getParameter(gl.VIEWPORT)),buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight]};
      return result;
    };
    gl.drawArrays=intercept;window.funnelSnapshotCleanup=()=>{input.removeEventListener('input',arm,true);if(gl.drawArrays===intercept)gl.drawArrays=draw;};
  });
  try{
    await page.locator('#replay-time').fill(String(seconds));
    await page.waitForFunction(()=>window.funnelSnapshot!==null);
    const result=await page.evaluate(async()=>({...window.funnelSnapshot,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',window.funnelPixels))).map(v=>v.toString(16).padStart(2,'0')).join('')}));
    assert.equal(result.error,0);assert.equal(result.lost,false);assert.equal(result.time,seconds);assert.equal(result.kinematic,true);
    assert.ok(result.buffer[0]<=512&&result.buffer[1]<=320,'The new density pass stays inside its fragment budget');
    assert.equal(result.volume?.time,seconds);assert.equal(result.volume?.extent,1);assert.deepEqual(result.volume.shape,result.shape);
    return result;
  }finally{await page.evaluate(()=>{window.funnelSnapshotCleanup?.();window.funnelSnapshotCleanup=null;window.funnelPixels=null;});}
}

for(const [width,theme,large]of [[320,'dark',false],[320,'light',true],[1280,'dark',true],[1280,'light',false]]){
  test(`procedural body camera and reading layout ${width} ${theme} ${large?'enlarged':'normal'}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});await open(page);
    await page.locator('#reading-appearance').selectOption(theme);
    const result=await snapshot(page,130);
    if(result.available){assert.equal(result.palette,theme==='light'?1:2);assert.equal(result.pointCount,3200);}
    assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
    assert.equal(await page.locator('#ground-reference-image').count(),0);
    assert.equal(await page.locator('#replay-ground-reference').isVisible(),false);
    assert.match(await page.locator('#replay-ground-controls').textContent(),/no historical El Reno correspondence/);
    if(large)await enlargeText(page);await reflow(page);
    const button=page.locator('[data-ground-second="130"]');await button.focus();await page.keyboard.press('Enter');
    assert.equal(await button.evaluate(n=>n===document.activeElement&&n.matches(':focus-visible')),true);
    assert.equal(await page.locator('#replay-time').inputValue(),'130');
    assert.equal(await page.locator('#registered-footage iframe').count(),0);
  });
}

test('procedural seeking and quality restore the same exact paused pixels without changing the camera',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce'});await open(page);
  const original=await snapshot(page,130);if(!original.available){t.skip('No native WebGL in this engine; no deterministic pixel claim');return;}
  assert.ok(original.volume.bodyAlpha>180,'The independently specified lower-body ray contains condensation before POINTS');
  await snapshot(page,135);const reverse=await snapshot(page,130);assert.equal(reverse.hash,original.hash);
  await page.locator('#ground-quality').selectOption('1600');const low=await snapshot(page,130);
  assert.equal(low.pointCount,1600);assert.deepEqual(low.matrix,original.matrix);assert.deepEqual(low.shape,original.shape);assert.deepEqual(low.volume,original.volume);
  await page.locator('#ground-quality').selectOption('3200');assert.equal((await snapshot(page,130)).hash,original.hash);
  await page.locator('#ground-camera').selectOption('synthetic-oblique');const oblique=await snapshot(page,130);assert.notDeepEqual(oblique.matrix,original.matrix);
  await page.goBack();assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-front');assert.equal((await snapshot(page,130)).hash,original.hash);
  await page.reload();await page.locator('#replay-time:not([disabled])').waitFor();assert.equal((await snapshot(page,130)).hash,original.hash);
});

test('actual GPU trajectories agree with independent position and recycling controls',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce'});await open(page);
  if(!(await snapshot(page,130)).available){t.skip('No native WebGL in this engine; no executed shader trajectory claim');return;}
  const result=await page.evaluate(()=>{
    const gl=document.querySelector('#replay-appearance-canvas').getContext('webgl2'),originalProgram=gl.getParameter(gl.CURRENT_PROGRAM);
    const originalVAO=gl.getParameter(gl.VERTEX_ARRAY_BINDING),originalBuffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING),originalTF=gl.getParameter(gl.TRANSFORM_FEEDBACK_BINDING),originalTFBuffer=gl.getParameter(gl.TRANSFORM_FEEDBACK_BUFFER_BINDING),originalDiscard=gl.isEnabled(gl.RASTERIZER_DISCARD);
    const source=gl.getShaderSource(gl.getAttachedShaders(window.funnelPointProgram).find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.VERTEX_SHADER));
    let program=null,vao=null,input=null,output=null,tf=null;const shaders=[];
    try{
      program=gl.createProgram();
      for(const [kind,text]of [[gl.VERTEX_SHADER,source],[gl.FRAGMENT_SHADER,'#version 300 es\nprecision mediump float;out vec4 result;void main(){result=vec4(1.0);}']]){
        const shader=gl.createShader(kind);shaders.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);
      }
      gl.transformFeedbackVaryings(program,['kinematicProbe'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      vao=gl.createVertexArray();gl.bindVertexArray(vao);input=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,input);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([.25,.5,.4,0,.25,.5,.4,1]),gl.STATIC_DRAW);
      const attribute=gl.getAttribLocation(program,'seed');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,4,gl.FLOAT,false,0,0);
      tf=gl.createTransformFeedback();gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,tf);output=gl.createBuffer();gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,32,gl.DYNAMIC_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
      gl.useProgram(program);const uniform=name=>gl.getUniformLocation(program,name);
      gl.uniformMatrix4fv(uniform('camera'),false,new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));
      gl.uniform3f(uniform('shape'),.13,.83,.12);gl.uniform1f(uniform('extent'),1);gl.uniform1f(uniform('viewportHeight'),550);gl.uniform1f(uniform('maxPoint'),64);
      gl.uniform1i(uniform('dust'),1);gl.uniform1i(uniform('kinematic'),1);gl.uniform1i(uniform('readingPalette'),2);gl.uniform2f(uniform('spriteAspect'),1,1);gl.enable(gl.RASTERIZER_DISCARD);
      const rows=[];
      for(const seconds of [0,2,150/19-.001,150/19+.001,375/94-.001,375/94+.001]){
        gl.uniform1f(uniform('time'),seconds);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,2);gl.endTransformFeedback();
        const values=new Float32Array(8);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);rows.push({seconds,values:[...values]});
      }
      return {rows,error:gl.getError(),sourceUnchanged:source===gl.getShaderSource(shaders[0])};
    }finally{
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,originalTF);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,originalTFBuffer);gl.bindVertexArray(originalVAO);gl.bindBuffer(gl.ARRAY_BUFFER,originalBuffer);gl.useProgram(originalProgram);
      if(!originalDiscard)gl.disable(gl.RASTERIZER_DISCARD);
      if(tf)gl.deleteTransformFeedback(tf);if(output)gl.deleteBuffer(output);if(input)gl.deleteBuffer(input);if(vao)gl.deleteVertexArray(vao);if(program)gl.deleteProgram(program);for(const shader of shaders)gl.deleteShader(shader);
    }
  });
  assert.equal(result.error,0);assert.equal(result.sourceUnchanged,true);
  const expected=[
    [.01197804896,.65,-.22984296739,.018,-.10580590455,.0515,-.16478293176,.02897995958],
    [.15277654870,1.144,.34086442260,.018,-.37780877553,.084936928,.10017576555,.03311387762],
  ];
  expected.forEach((values,i)=>values.forEach((value,k)=>assert.ok(Math.abs(result.rows[i].values[k]-value)<3e-5,`Independent GPU trajectory row ${i}, component ${k}`)));
  assert.ok(result.rows[2].values[1]>2.59&&result.rows[3].values[1]<.001);
  assert.ok(result.rows[2].values[3]<1e-7&&result.rows[3].values[3]<1e-7,'Body recycling stays invisible on both sides');
  assert.ok(result.rows[4].values[7]<1e-7&&result.rows[5].values[7]<1e-7,'Dust uses its own invisible recycling boundary');
});

test('procedural playback stops at its last authored instant and does not fill neighboring gaps',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900}});await open(page);
  await page.locator('#replay-time').fill('139');await page.locator('#replay-rate').selectOption('15');await page.locator('#replay-play').click();
  await page.waitForFunction(()=>document.querySelector('#replay-time').value==='140'&&document.querySelector('#replay-play').textContent==='Play timeline');
  await page.locator('#replay-time').fill('145');assert.match(await page.locator('#replay-appearance-state').textContent(),/Outside/);
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);assert.equal(await page.locator('#ground-reference-image').count(),0);
  await page.locator('#replay-play').click();await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>=120&&Number(document.querySelector('#replay-time').value)<139);
  await page.locator('#replay-play').click();
  await page.locator('#replay-appearance-mode').selectOption('ground');
  assert.equal(await page.locator('#replay-clock-controls').evaluate(n=>n.nextElementSibling?.id),'replay-appearance-drawing');
  await page.locator('[data-ground-second="130"]').click();await page.locator('#ground-reference-image').waitFor();
  assert.match(await page.locator('#ground-reference-image').getAttribute('src'),/synthetic-front-130\.svg$/);
  await page.locator('#replay-appearance-mode').selectOption('simulation');assert.equal(await page.locator('#ground-reference-image').count(),0);
});

test('procedural graphics refusal retains the explanation and existing documentary routes',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900}});
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:get.call(this,kind,...args);};});
  await open(page);assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
  assert.match(await page.locator('#replay-appearance-renderer-status').textContent(),/could not start/);
  assert.match(await page.locator('#ground-camera-details').textContent(),/synthetic-front/);
  assert.match(await page.locator('#replay-ground-controls').textContent(),/authored|Authored/);
});

test('Form Study saves the new model and retains old form-1 experiments as legacy',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      const gl=get.call(this,kind,...args);if(kind!=='webgl2'||!gl||this.id!=='scene'||gl.funnelObserved)return gl;
      gl.funnelObserved=true;const draw=gl.drawArrays;
      gl.drawArrays=function(...values){const result=draw.apply(this,values);if(values[0]===gl.POINTS){const p=gl.getParameter(gl.CURRENT_PROGRAM);window.funnelStudyDraw={time:gl.getUniform(p,gl.getUniformLocation(p,'time')),kinematic:gl.getUniform(p,gl.getUniformLocation(p,'kinematic'))};}return result;};return gl;
    };
  });
  await page.goto(base+'/study.html');await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  await page.locator('#scene').scrollIntoViewIfNeeded();
  const available=await page.locator('#scene').evaluate(c=>Boolean(c.getContext('webgl2')));
  if(available){await page.waitForFunction(()=>window.funnelStudyDraw?.kinematic===true);assert.equal(await page.locator('#scene-failure').isVisible(),false);}
  else assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium');
  await page.locator('#lab-share').click();assert.equal(new URL(page.url()).searchParams.get('experiment'),'form-2');assert.equal(new URL(page.url()).searchParams.get('model'),'kinematic-v1');
  await page.reload();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();await page.locator('#scene').scrollIntoViewIfNeeded();
  if(available)await page.waitForFunction(()=>window.funnelStudyDraw?.kinematic===true);
  const old='study.html?experiment=form-1&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=0&coverage=continuous&rate=1&position=0&phase=1000000000';
  await page.goto(base+'/'+old);await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();await page.locator('#scene').scrollIntoViewIfNeeded();
  if(available){await page.waitForFunction(()=>window.funnelStudyDraw?.kinematic===false&&window.funnelStudyDraw?.time===1000000000);assert.equal(await page.locator('#scene-failure').isVisible(),false);}
  await page.locator('#lab-share').click();assert.equal(new URL(page.url()).searchParams.get('experiment'),'form-1');assert.equal(new URL(page.url()).searchParams.get('model'),null);
});
