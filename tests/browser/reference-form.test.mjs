import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {enlargeText,reflow} from './ground-view-assertions.mjs';
import {referenceNoiseAt} from '../../web/reference-form-model.mjs';

test('native reference lattice samples preserve coordinates, periodic seams and declared precision',async t=>{
  const page=await fixture(t);await page.goto(base+'/study.html');
  const points=[[0,0,0],[1,2,3],[31,31,31],[32,0,0],[-1,2,3],[.25,.5,.75],[-.001,31.5,32.25],[-32.25,-1.3,63.7],[7.72,12.23,29.91],[31,2,3]];
  const result=await page.evaluate(async points=>{
    const {REFERENCE_FIELD_GLSL,referenceNoiseLattice}=await import('./reference-form-model.mjs');
    const canvas=new OffscreenCanvas(1,1),gl=canvas.getContext('webgl2');if(!gl)return {available:false};
    const shaders=[],buffers=[],textures=[],vaos=[];let program=null,feedback=null;
    try{
      const compile=(type,source)=>{const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
      program=gl.createProgram();
      gl.attachShader(program,compile(gl.VERTEX_SHADER,`#version 300 es\n#define REFERENCE_FORM 1\nprecision highp float;\nuniform float formationProgress;uniform vec4 formationState;in vec3 point;out float sampled;\n${REFERENCE_FIELD_GLSL}\nvoid main(){sampled=referenceNoise(point);gl_Position=vec4(0,0,0,1);gl_PointSize=1.0;}`));
      gl.attachShader(program,compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1);}'));
      gl.transformFeedbackVaryings(program,['sampled'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);const vao=gl.createVertexArray();vaos.push(vao);gl.bindVertexArray(vao);
      const input=gl.createBuffer();buffers.push(input);gl.bindBuffer(gl.ARRAY_BUFFER,input);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.flat()),gl.STATIC_DRAW);
      const location=gl.getAttribLocation(program,'point');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
      const texture=gl.createTexture();textures.push(texture);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,texture);
      for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,axis,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texStorage3D(gl.TEXTURE_3D,1,gl.R8,32,32,32);gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,32,32,32,gl.RED,gl.UNSIGNED_BYTE,referenceNoiseLattice());
      gl.uniform1i(gl.getUniformLocation(program,'referenceNoiseTexture'),0);
      const output=gl.createBuffer();buffers.push(output);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,points.length*4,gl.STREAM_READ);
      feedback=gl.createTransformFeedback();gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
      gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,points.length);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
      const values=new Float32Array(points.length);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);
      return {available:true,values:Array.from(values),error:gl.getError(),lost:gl.isContextLost()};
    }finally{
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);if(feedback)gl.deleteTransformFeedback(feedback);
      for(const buffer of buffers)gl.deleteBuffer(buffer);for(const texture of textures)gl.deleteTexture(texture);for(const vao of vaos)gl.deleteVertexArray(vao);
      if(program)gl.deleteProgram(program);for(const shader of shaders)gl.deleteShader(shader);gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  },points);
  if(!result.available){assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium');t.skip('No native WebGL2 field sample in this engine');return;}
  assert.equal(result.error,0);assert.equal(result.lost,false);
  const errors=result.values.map((value,i)=>Math.abs(value-referenceNoiseAt(...points[i])));
  errors.forEach((error,i)=>assert.ok(error<=(points[i].every(Number.isInteger)?.5/255+1e-6:.008),'Declared R8 and interpolation precision at '+points[i]));
  assert.equal(result.values[0],result.values[3]);assert.equal(result.values[4],result.values[9]);
  console.info('REFERENCE_FIELD_PRECISION '+JSON.stringify({samples:points.length,maxError:Math.max(...errors),scope:'Actual isolated R8 sampler and coordinates, not historical appearance or GPU memory'}));
});

async function frame(page){
  await page.locator('#scene').scrollIntoViewIfNeeded();
  await page.evaluate(()=>{
    const c=document.getElementById('scene'),gl=c.getContext('webgl2');if(!gl){window.referenceFrame={available:false};return;}
    const draw=gl.drawArrays;let armed=false,lines=0,volume=null;
    const input=document.getElementById('sequence-time'),arm=()=>{armed=true;};input.addEventListener('input',arm,{once:true,capture:true});window.referenceFrame=null;
    const intercept=function(...args){const result=draw.apply(this,args);if(!armed)return result;
      const program=gl.getParameter(gl.CURRENT_PROGRAM),uniform=name=>{const loc=gl.getUniformLocation(program,name);return loc===null?null:gl.getUniform(program,loc);};
      if(args[0]===gl.LINES)lines++;
      if(args[0]===gl.TRIANGLES&&uniform('surfacePass')===false)volume={time:uniform('time'),dust:uniform('dust'),progress:uniform('formationProgress'),state:Array.from(uniform('formationState'))};
      if(args[0]!==gl.POINTS)return result;
      const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      window.referencePixels=pixels;window.referenceFrame={available:true,lines,volume,matrix:Array.from(uniform('camera')),error:gl.getError(),lost:gl.isContextLost()};gl.drawArrays=draw;return result;
    };gl.drawArrays=intercept;window.referenceCleanup=()=>{input.removeEventListener('input',arm,true);if(gl.drawArrays===intercept)gl.drawArrays=draw;};
  });
  try{
    await page.locator('#sequence-time').fill('0.5');await page.locator('#scene').scrollIntoViewIfNeeded();await page.waitForFunction(()=>window.referenceFrame!==null);
    const value=await page.evaluate(async()=>window.referenceFrame.available?{...window.referenceFrame,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',window.referencePixels))).map(v=>v.toString(16).padStart(2,'0')).join('')}:window.referenceFrame);
    if(value.available){assert.equal(value.error,0);assert.equal(value.lost,false);assert.equal(value.volume.time,15);assert.equal(value.volume.progress,.5);assert.deepEqual(value.volume.state,[1,0,1,1]);}
    else assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium');
    return value;
  }finally{await page.evaluate(()=>{window.referenceCleanup?.();window.referencePixels=null;});}
}

for(const [width,theme]of [[320,'light'],[1280,'dark']])test(`reference form separates ground cues and retains source return at ${width} ${theme}`,async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});await page.goto(base+'/study.html');
  await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();await page.locator('#reading-appearance').selectOption(theme);
  assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'reference-v1');assert.equal(await page.locator('#reference-form-sources').isVisible(),true);
  const both=await frame(page);await page.locator('#flow-cues').uncheck();const dust=await frame(page);
  await page.locator('#dust').uncheck();const neither=await frame(page);
  if(both.available){
    assert.equal(both.lines,2);assert.equal(dust.lines,1);assert.equal(neither.lines,1);
    assert.equal(both.volume.dust,true);assert.equal(dust.volume.dust,true);assert.equal(neither.volume.dust,false);
    assert.deepEqual(both.matrix,dust.matrix);assert.deepEqual(dust.matrix,neither.matrix);
    assert.notEqual(both.hash,dust.hash,'Assumed circulation marks are an independently removable drawing');
    assert.notEqual(dust.hash,neither.hash,'Dust has a separate visible drawing at unchanged condensation and time');
  }
  await page.locator('#flow-cues').check();await page.locator('#dust').check();const restored=await frame(page);
  if(both.available)assert.equal(restored.hash,both.hash);
  const source=page.locator('#reference-form-sources a[href="index.html#storm-photographs"]');await source.focus();await page.keyboard.press('Enter');
  await page.waitForURL(base+'/index.html?t=0#storm-photographs');await page.goBack();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('experiment'),'form-5');assert.equal(await page.locator('#sequence-time').inputValue(),'0.5');
  assert.equal(await page.locator('#motion').textContent(),'Play motion');assert.equal(await page.locator('#flow-cues').isChecked(),true);assert.equal(await page.locator('#dust').isChecked(),true);
  await enlargeText(page);await reflow(page);
});
