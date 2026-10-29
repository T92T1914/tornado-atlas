import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';
import {stormCoordinates} from '../../web/storm-scene-model.mjs';
import {FUNNEL_DENSITY_GLSL} from '../../web/funnel-simulation-model.mjs';
import {FUNNEL_LIGHTING_GLSL} from '../../web/funnel-lighting-model.mjs';
import {retainedTailInputs,additionalTailInputs,literalColumnControls,numericalVerticalColumn,numericalTailRGB,numericalTailTransmission} from './storm-tail-oracle.mjs';

// Columns of the fixed, declared orthonormal texture basis. This is the CPU
// comparison basis, not a copied shader implementation of the characteristic.
const basis=([x,y,z])=>[.8*x-.36*y+.48*z,.6*x+.48*y-.64*z,.8*y+.6*z];
const normalize=ray=>{const length=Math.hypot(...ray);return ray.map(value=>value/length);};
const nativeRow=({name,point,ray,time=0,span=0,clipLength=0})=>({name,point:point.map(Math.fround),ray:normalize(ray).map(Math.fround),time:Math.fround(time),span:Math.fround(span),clipLength:Math.fround(clipLength)});
const materialRows=[
  {name:'origin time zero vertical ray',point:[0,0,0],ray:[0,1,0],time:0,span:.1},
  {name:'off axis time zero oblique ray',point:[.3,.1,-.7],ray:[.2,.9,-.1],time:0,span:.045},
  {name:'core time thirty radial ray',point:[.95,1,0],ray:[1,0,0],time:30,span:.09},
  {name:'core time thirty oblique ray',point:[.95,1,0],ray:[.3,-.7,.6],time:30,span:.09},
  {name:'near axis time thirty oblique ray',point:[1e-7,.05,-2e-7],ray:[1,1,1],time:30,span:.05},
  {name:'exact axis time thirty vertical ray',point:[0,0,0],ray:[0,1,0],time:30,span:.05},
  {name:'outer time fifteen oblique ray',point:[3,3,-4],ray:[-.4,.2,.9],time:15,span:.12},
  {name:'lower time six reversed oblique ray',point:[-1.2,.1,.7],ray:[-.7,-.4,.2],time:6,span:.03},
].map(nativeRow);

// Preserve all nine earlier points/rays/clips, with the new profile's
// independently integrated expectations and additional boundary controls.
const tailRows=[...retainedTailInputs,...additionalTailInputs].map(nativeRow);

const materialExpected=row=>basis(stormCoordinates(row.point,row.time));
function spanExpected(row,step){
  const plus=row.point.map((value,index)=>value+step*row.ray[index]);
  const minus=row.point.map((value,index)=>value-step*row.ray[index]);
  const a=basis(stormCoordinates(plus,row.time)),b=basis(stormCoordinates(minus,row.time));
  return a.map((value,index)=>Math.abs((value-b[index])/(2*step))*row.span);
}
const tailExpected=numericalTailRGB;
function vectorNear(actual,expected,label,absolute,relative=0){
  assert.equal(actual.length,expected.length,label+' length');
  actual.forEach((value,index)=>{
    assert.ok(Number.isFinite(value),label+' finite component '+index);
    assert.ok(Math.abs(value-expected[index])<=absolute+relative*Math.abs(expected[index]),label+' component '+index+': '+value+' versus '+expected[index]);
  });
}

test('native storm characteristic and tail controls preserve primary material state through actual lighting',async t=>{
  for(const row of literalColumnControls)assert.ok(Math.abs(numericalVerticalColumn(row.from,row.to)-row.expected)<=2e-12,row.name+' independent quadrature control');
  const page=await fixture(t);await page.goto(base+'/study.html');
  const rows=[...materialRows,...tailRows];
  const result=await page.evaluate(async rows=>{
    const {FUNNEL_DENSITY_GLSL}=await import('./funnel-simulation-model.mjs');
    const {FUNNEL_LIGHTING_GLSL}=await import('./funnel-lighting-model.mjs');
    const {referenceNoiseLattice}=await import('./reference-form-model.mjs');
    if(typeof OffscreenCanvas!=='function')return {available:false,reason:'OffscreenCanvas is unavailable'};
    const canvas=new OffscreenCanvas(1,1),gl=canvas.getContext('webgl2');
    if(!gl)return {available:false,reason:'Isolated native WebGL2 context is unavailable'};
    const shaders=[],buffers=[],textures=[],vaos=[],feedbacks=[],programs=[],cleanupFailures=[];
    let activeFeedback=false,result=null,originalFailure=null;
    const serial=error=>({name:String(error?.name??'Error'),message:String(error?.message??error).slice(0,4096),stack:String(error?.stack??'').slice(0,4096)});
    const clean=(label,callback)=>{try{callback();}catch(error){cleanupFailures.push({label,...serial(error)});}};
    const allocated={shader:0,buffer:0,texture:0,vao:0,feedback:0,program:0};
    try{
      const compile=(type,source)=>{
        const shader=gl.createShader(type);if(!shader)throw Error('Native shader allocation failed');shaders.push(shader);allocated.shader++;
        gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)||'Native shader compilation failed without a log');
        return shader;
      };
      const vertex=`#version 300 es
#define REFERENCE_FORM 1
#define STORM_SCENE 1
precision highp float;
precision highp int;
uniform bool genesis;
uniform bool worldLighting;
uniform float formationProgress;
uniform vec4 formationState;
uniform float time;
uniform vec3 shape;
uniform float extent;
uniform bool dust;
uniform int readingPalette;
in vec3 samplePoint;
in vec3 sampleRay;
in float sampleTime;
in float sampleWidth;
in float sampleClip;
out vec3 sampledMaterial;
out vec3 sampledSpan;
out vec3 sampledSky;
out vec3 materialAfterLight;
out vec3 spanAfterLight;
out vec3 sampledLight;
out float sampledTransmission;
${FUNNEL_DENSITY_GLSL}
${FUNNEL_LIGHTING_GLSL}
void main(){
  stormSample(samplePoint,sampleRay,sampleTime,sampleWidth);
  sampledMaterial=stormMaterialPoint;
  sampledSpan=stormSampleSpan;
  sampledSky=stormDistantSky(samplePoint,sampleRay,sampleClip);
  sampledTransmission=stormDistantTransmission(samplePoint,sampleRay,sampleClip);
  sampledLight=worldMaterial(samplePoint,.3);
  materialAfterLight=stormMaterialPoint;
  spanAfterLight=stormSampleSpan;
  gl_Position=vec4(0,0,0,1);
  gl_PointSize=1.0;
}`;
      const program=gl.createProgram();if(!program)throw Error('Native program allocation failed');programs.push(program);allocated.program++;
      gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
      gl.attachShader(program,compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1);}'));
      gl.transformFeedbackVaryings(program,['sampledMaterial','sampledSpan','sampledSky','materialAfterLight','spanAfterLight','sampledLight','sampledTransmission'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'Native program link failed without a log');
      gl.useProgram(program);
      // The primary characteristic uses each row's sampleTime. The two actual
      // light probes use the common production time uniform, deliberately set
      // to 15 even when the saved primary sample was constructed at 0 or 30.
      // Restoring both primary globals must not depend on those times matching.
      gl.uniform1i(gl.getUniformLocation(program,'genesis'),1);gl.uniform1i(gl.getUniformLocation(program,'worldLighting'),1);
      gl.uniform1f(gl.getUniformLocation(program,'formationProgress'),.5);gl.uniform4f(gl.getUniformLocation(program,'formationState'),1,0,1,1);
      const uniform=name=>{const location=gl.getUniformLocation(program,name);if(location===null)throw Error('Actual lighting input is inactive: '+name);return location;};
      gl.uniform1f(uniform('time'),15);gl.uniform3f(uniform('shape'),.46,.6,.07);gl.uniform1f(uniform('extent'),1);
      gl.uniform1i(uniform('dust'),1);const paletteLocation=gl.getUniformLocation(program,'readingPalette');gl.uniform1i(paletteLocation,2);
      const texture=gl.createTexture();if(!texture)throw Error('Native R8 texture allocation failed');textures.push(texture);allocated.texture++;
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,texture);
      for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,axis,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texStorage3D(gl.TEXTURE_3D,1,gl.R8,32,32,32);gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,32,32,32,gl.RED,gl.UNSIGNED_BYTE,referenceNoiseLattice());
      gl.uniform1i(uniform('referenceNoiseTexture'),0);
      const vao=gl.createVertexArray();if(!vao)throw Error('Native VAO allocation failed');vaos.push(vao);allocated.vao++;gl.bindVertexArray(vao);
      const input=gl.createBuffer();if(!input)throw Error('Native input buffer allocation failed');buffers.push(input);allocated.buffer++;gl.bindBuffer(gl.ARRAY_BUFFER,input);
      const values=new Float32Array(rows.flatMap(row=>[...row.point,...row.ray,row.time,row.span,row.clipLength]));
      gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
      for(const [name,size,offset]of [['samplePoint',3,0],['sampleRay',3,3],['sampleTime',1,6],['sampleWidth',1,7],['sampleClip',1,8]]){
        const location=gl.getAttribLocation(program,name);if(location<0)throw Error('Actual component input is inactive: '+name);
        gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,36,offset*4);
      }
      const output=gl.createBuffer();if(!output)throw Error('Native output buffer allocation failed');buffers.push(output);allocated.buffer++;
      gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,rows.length*76,gl.STREAM_READ);
      const feedback=gl.createTransformFeedback();if(!feedback)throw Error('Native transform feedback allocation failed');feedbacks.push(feedback);allocated.feedback++;
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
      gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);activeFeedback=true;
      gl.drawArrays(gl.POINTS,0,rows.length);gl.endTransformFeedback();activeFeedback=false;gl.disable(gl.RASTERIZER_DISCARD);
      const sampled=new Float32Array(rows.length*19);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,sampled);
      const digest=async source=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))).map(value=>value.toString(16).padStart(2,'0')).join('');
      result={densitySHA256:await digest(FUNNEL_DENSITY_GLSL),lightingSHA256:await digest(FUNNEL_LIGHTING_GLSL),vertexSHA256:await digest(vertex),linkStatus:gl.getProgramParameter(program,gl.LINK_STATUS),lightingUniforms:{time:gl.getUniform(program,uniform('time')),shape:Array.from(gl.getUniform(program,uniform('shape'))),extent:gl.getUniform(program,uniform('extent')),dust:gl.getUniform(program,uniform('dust')),sampler:gl.getUniform(program,uniform('referenceNoiseTexture')),readingPaletteRequested:2,readingPalette:paletteLocation===null?null:gl.getUniform(program,paletteLocation)},samples:rows.map((row,index)=>({name:row.name,material:Array.from(sampled.subarray(index*19,index*19+3)),span:Array.from(sampled.subarray(index*19+3,index*19+6)),sky:Array.from(sampled.subarray(index*19+6,index*19+9)),materialAfterLight:Array.from(sampled.subarray(index*19+9,index*19+12)),spanAfterLight:Array.from(sampled.subarray(index*19+12,index*19+15)),light:Array.from(sampled.subarray(index*19+15,index*19+18)),transmission:sampled[index*19+18]})),error:gl.getError(),lost:gl.isContextLost()};
    }catch(error){originalFailure=serial(error);}
    finally{
      if(activeFeedback)clean('end active feedback',()=>{gl.endTransformFeedback();activeFeedback=false;});
      clean('disable rasterizer discard',()=>gl.disable(gl.RASTERIZER_DISCARD));
      clean('unbind feedback buffer base',()=>gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null));
      clean('unbind feedback object',()=>gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null));
      clean('unbind feedback buffer',()=>gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,null));
      clean('unbind input buffer',()=>gl.bindBuffer(gl.ARRAY_BUFFER,null));
      clean('unbind VAO',()=>gl.bindVertexArray(null));
      clean('unbind program',()=>gl.useProgram(null));
      clean('unbind R8 texture',()=>{gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,null);});
      for(const handle of feedbacks)clean('delete feedback',()=>gl.deleteTransformFeedback(handle));
      for(const handle of buffers)clean('delete buffer',()=>gl.deleteBuffer(handle));
      for(const handle of textures)clean('delete texture',()=>gl.deleteTexture(handle));
      for(const handle of vaos)clean('delete VAO',()=>gl.deleteVertexArray(handle));
      for(const handle of programs)clean('delete program',()=>gl.deleteProgram(handle));
      for(const handle of shaders)clean('delete shader',()=>gl.deleteShader(handle));
    }
    const live={};
    for(const [name,handles,check]of [['shader',shaders,handle=>gl.isShader(handle)],['buffer',buffers,handle=>gl.isBuffer(handle)],['texture',textures,handle=>gl.isTexture(handle)],['vao',vaos,handle=>gl.isVertexArray(handle)],['feedback',feedbacks,handle=>gl.isTransformFeedback(handle)],['program',programs,handle=>gl.isProgram(handle)]]){
      try{live[name]=handles.filter(check).length;}catch(error){live[name]=null;cleanupFailures.push({label:'verify retired '+name,...serial(error)});}
    }
    let cleanupError=null,contextLostBeforeRetirement=null;
    try{cleanupError=gl.getError();contextLostBeforeRetirement=gl.isContextLost();}catch(error){cleanupFailures.push({label:'cleanup graphics state',...serial(error)});}
    let contextRetirementRequested=false;
    clean('retire isolated component context',()=>{const extension=gl.getExtension('WEBGL_lose_context');if(!extension)throw Error('Native isolated context retirement extension unavailable');extension.loseContext();contextRetirementRequested=true;});
    return {available:true,...result,originalFailure,cleanupFailures,allocated,live,cleanupError,contextLostBeforeRetirement,contextRetirementRequested};
  },rows);
  if(!result.available){
    assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium',result.reason);
    t.skip('Native storm GLSL component unavailable in this engine: '+result.reason);return;
  }
  // Preserve an original native compile/draw error alongside cleanup evidence.
  if(result.originalFailure)console.info('STORM_FIELD_NATIVE_FAILURE '+JSON.stringify(result));
  assert.equal(result.originalFailure,null,JSON.stringify({original:result.originalFailure,cleanup:result.cleanupFailures}));
  assert.deepEqual(result.cleanupFailures,[]);assert.equal(result.cleanupError,0);assert.equal(result.contextLostBeforeRetirement,false);
  assert.deepEqual(result.allocated,{shader:2,buffer:2,texture:1,vao:1,feedback:1,program:1});
  assert.deepEqual(result.live,{shader:0,buffer:0,texture:0,vao:0,feedback:0,program:0});assert.equal(result.contextRetirementRequested,true);
  assert.equal(result.densitySHA256,createHash('sha256').update(FUNNEL_DENSITY_GLSL).digest('hex'),'Browser compiles the exact production density composition');
  assert.equal(result.lightingSHA256,createHash('sha256').update(FUNNEL_LIGHTING_GLSL).digest('hex'),'Browser compiles the exact production lighting composition');
  assert.equal(result.linkStatus,true);assert.equal(result.error,0);assert.equal(result.lost,false);assert.equal(result.samples.length,rows.length);
  assert.equal(result.lightingUniforms.time,15);vectorNear(result.lightingUniforms.shape,[.46,.6,.07],'Actual common lighting shape',3e-8);
  assert.equal(result.lightingUniforms.extent,1);assert.equal(result.lightingUniforms.dust,true);assert.equal(result.lightingUniforms.sampler,0);
  assert.equal(result.lightingUniforms.readingPaletteRequested,2);
  if(result.lightingUniforms.readingPalette!==null)assert.equal(result.lightingUniforms.readingPalette,2);
  console.info('STORM_FIELD_NATIVE_SAMPLES '+JSON.stringify({densitySHA256:result.densitySHA256,lightingSHA256:result.lightingSHA256,vertexSHA256:result.vertexSHA256,lightingUniforms:result.lightingUniforms,samples:result.samples}));
  for(const sample of result.samples){
    assert.deepEqual(sample.materialAfterLight,sample.material,sample.name+' actual primary point restored exactly');
    assert.deepEqual(sample.spanAfterLight,sample.span,sample.name+' actual primary span restored exactly');
    assert.equal(sample.light.length,3);assert.ok(sample.light.every(value=>Number.isFinite(value)&&value>=0&&value<=1),sample.name+' actual finite bounded light');
  }
  const materialErrors=[],spanErrors=[],tailErrors=[],transmissionErrors=[];
  for(let index=0;index<materialRows.length;index++){
    const row=materialRows[index],actual=result.samples[index];assert.equal(actual.name,row.name);
    const expected=materialExpected(row),span=spanExpected(row,1e-4),refined=spanExpected(row,5e-5);
    vectorNear(span,refined,row.name+' converged independent central difference',1e-7,1e-7);
    vectorNear(actual.material,expected,row.name+' actual GLSL material point',7e-5,2e-5);
    const [mx,my,mz]=actual.material;
    const radial=Math.hypot(.8*mx+.6*my,.48*mx-.64*my+.6*mz);
    const radialExpected=Math.hypot(row.point[0],row.point[2])*Math.exp(.018*row.time);
    vectorNear([radial],[radialExpected],row.name+' declared radial strain is separate from rotation',7e-5,2e-5);
    vectorNear(actual.span,refined,row.name+' actual GLSL directional span',3e-5,3e-5);
    materialErrors.push(...actual.material.map((value,axis)=>Math.abs(value-expected[axis])));
    spanErrors.push(...actual.span.map((value,axis)=>Math.abs(value-refined[axis])));
  }
  vectorNear(result.samples[0].material,[0,0,0],'literal time zero origin',1e-7);
  vectorNear(result.samples[0].span,[.036,.048,.08],'literal time zero vertical basis span',1e-7);
  for(let index=0;index<tailRows.length;index++){
    const row=tailRows[index],actual=result.samples[materialRows.length+index],expected=tailExpected(row);assert.equal(actual.name,row.name);
    vectorNear(actual.sky,expected,row.name+' analytic tail RGB',3e-6);
    if(row.name.startsWith('default orbit'))vectorNear(actual.sky,[.48,.51,.52],row.name+' shared horizontal radiance',3e-6);
    const expectedTransmission=numericalTailTransmission(row),transmissionError=Math.abs(actual.transmission-expectedTransmission);
    assert.ok(Number.isFinite(actual.transmission)&&transmissionError<=3e-6,row.name+' actual mean-tail transmittance: '+actual.transmission+' versus '+expectedTransmission);
    transmissionErrors.push(transmissionError);
    tailErrors.push(...actual.sky.map((value,axis)=>Math.abs(value-expected[axis])));
  }
  console.info('STORM_FIELD_NATIVE_LIGHT_PRECISION '+JSON.stringify({materialSamples:materialRows.length,tailSamples:tailRows.length,primaryStateRestorationSamples:result.samples.length,materialMaxAbsoluteError:Math.max(...materialErrors),spanMaxAbsoluteError:Math.max(...spanErrors),tailRGBMaxAbsoluteError:Math.max(...tailErrors),tailTransmissionMaxAbsoluteError:Math.max(...transmissionErrors),densitySHA256:result.densitySHA256,lightingSHA256:result.lightingSHA256,vertexSHA256:result.vertexSHA256,lightingUniforms:result.lightingUniforms,allocated:result.allocated,liveAfterExplicitDelete:result.live,scope:'Actual isolated production GLSL characteristic, local ray-bin derivative, analytic mean cloud profile continuation and primary state restoration after actual shared-material lighting. Not a lighting-value oracle, native GPU memory measurement, rendered scene, real time performance, fluid simulation validation or historical qualification.'}));
});
