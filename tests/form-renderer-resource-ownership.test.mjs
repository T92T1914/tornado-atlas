import test from 'node:test';
import assert from 'node:assert/strict';
import {createFormRenderer} from '../web/form-renderer.mjs';
import {GROUND_CAMERAS,GROUND_MARKS} from '../web/ground-view-model.mjs';

// Controlled explicit GL calls. This ledger does not measure native GPU memory.
function accountingGraphics() {
  const live=new Map(['program','shader','vao','buffer'].map(kind=>[kind,new Set()]));
  const created=[],deleted=[],foreign=[],duplicates=[],calls=new Map(),draws=[];
  let next=0,failure=null,compileFailure=null,linkFailure=null;
  const invoke=(name,fn)=>(...args)=>{
    const count=(calls.get(name)||0)+1;calls.set(name,count);
    if(failure?.method===name&&failure.at===count)throw failure.error;
    return fn(...args);
  };
  const create=(kind,metadata={})=>{
    const handle={kind,id:++next,...metadata};live.get(kind).add(handle);created.push(handle);return handle;
  };
  const remove=(kind,handle)=>{
    deleted.push(handle);
    if(handle?.kind!==kind||!created.includes(handle)){foreign.push(handle);return;}
    if(!live.get(kind).delete(handle))duplicates.push(handle);
  };
  const gl={};
  for(const [index,name] of ['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','STATIC_DRAW','FLOAT','ALIASED_POINT_SIZE_RANGE','BLEND','SRC_ALPHA','ONE_MINUS_SRC_ALPHA','ONE','DEPTH_TEST','SCISSOR_TEST','COLOR_BUFFER_BIT','TRIANGLES','LINES','POINTS'].entries())gl[name]=index+1;
  let programOrdinal=0,shaderOrdinal=0;
  gl.createProgram=invoke('createProgram',()=>create('program',{ordinal:++programOrdinal}));
  gl.createShader=invoke('createShader',type=>create('shader',{ordinal:++shaderOrdinal,type}));
  gl.createVertexArray=invoke('createVertexArray',()=>create('vao'));
  gl.createBuffer=invoke('createBuffer',()=>create('buffer'));
  gl.deleteProgram=invoke('deleteProgram',handle=>remove('program',handle));
  gl.deleteShader=invoke('deleteShader',handle=>remove('shader',handle));
  gl.deleteVertexArray=invoke('deleteVertexArray',handle=>remove('vao',handle));
  gl.deleteBuffer=invoke('deleteBuffer',handle=>remove('buffer',handle));
  gl.getShaderParameter=invoke('getShaderParameter',shader=>shader.ordinal!==compileFailure);
  gl.getShaderInfoLog=invoke('getShaderInfoLog',()=> 'controlled shader compile failure');
  gl.getProgramParameter=invoke('getProgramParameter',program=>program.ordinal!==linkFailure);
  gl.getProgramInfoLog=invoke('getProgramInfoLog',()=> 'controlled program link failure');
  gl.getParameter=invoke('getParameter',()=>[1,64]);
  gl.getAttribLocation=invoke('getAttribLocation',()=>0);
  gl.getUniformLocation=invoke('getUniformLocation',(program,name)=>({program,name}));
  gl.drawArrays=invoke('drawArrays',(mode,first,count)=>draws.push({mode,first,count}));
  for(const name of ['shaderSource','compileShader','attachShader','linkProgram','bindVertexArray','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','enable','blendFuncSeparate','disable','clearColor','viewport','clear','useProgram','bufferSubData','uniform2fv','uniform1i','uniform2f','uniform4f','uniform4fv','scissor','uniform3fv','uniform1f','uniform3f','uniformMatrix4fv'])gl[name]=invoke(name,()=>{});
  return {
    gl,created,deleted,foreign,duplicates,draws,
    canvas:{width:0,height:0,clientWidth:320,clientHeight:480,getContext:(kind)=>{if(kind!=='webgl2')throw new Error('Unexpected graphics context');return gl;},getBoundingClientRect:()=>({width:320,height:480})},
    counts:()=>Object.fromEntries([...live].map(([kind,handles])=>[kind,handles.size])),
    failCompile:ordinal=>{compileFailure=ordinal;},
    failLink:ordinal=>{linkFailure=ordinal;},
    failNext:(method,error,offset=1)=>{failure={method,at:(calls.get(method)||0)+offset,error};},
    clearFailure:()=>{failure=null;compileFailure=null;linkFailure=null;},
    callCount:method=>calls.get(method)||0
  };
}

const none={program:0,shader:0,vao:0,buffer:0};
const base={program:2,shader:0,vao:2,buffer:2};
const margin={points:[[0,0],[1,1]]};
const condensation={kind:'visible_condensation_region',points:[[.2,.1],[.2,1],[1,1],[1,.3],[.7,.1]]};
function renderGlobals(t){
  const previousWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  const previousStyle=Object.getOwnPropertyDescriptor(globalThis,'getComputedStyle');
  t.after(()=>{
    if(previousWindow)Object.defineProperty(globalThis,'window',previousWindow);else delete globalThis.window;
    if(previousStyle)Object.defineProperty(globalThis,'getComputedStyle',previousStyle);else delete globalThis.getComputedStyle;
  });
  globalThis.window={devicePixelRatio:1};globalThis.getComputedStyle=()=>({colorScheme:'dark'});
}
function owned(f,expected){
  assert.deepEqual(f.counts(),expected);
  assert.deepEqual(f.foreign,[]);assert.deepEqual(f.duplicates,[]);
}
for(const [name,configure,message] of [
  ['first program compile',f=>f.failCompile(2),'controlled shader compile failure'],
  ['second program compile',f=>f.failCompile(4),'controlled shader compile failure'],
  ['first program link',f=>f.failLink(1),'controlled program link failure'],
  ['second program link',f=>f.failLink(2),'controlled program link failure']
])test(name+' failure retires every created handle',()=>{
  const f=accountingGraphics();configure(f);
  assert.throws(()=>createFormRenderer(f.canvas,100),error=>error.constructor===Error&&error.message===message);
  owned(f,none);
});
for(const quality of [99,NaN])test('real invalid quality '+String(quality)+' retains its RangeError and retires handles',()=>{
  const f=accountingGraphics();
  assert.throws(()=>createFormRenderer(f.canvas,quality),error=>error instanceof RangeError&&error.message==='Particle budget or seed is invalid');
  owned(f,none);
});
for(const [name,method,offset] of [
  ['buffer creation','createBuffer',1],
  ['first attribute setup','bufferData',1],
  ['second attribute setup','bufferData',2],
  ['point-size metadata','getParameter',1],
  ['uniform metadata','getUniformLocation',1],
  ['final state setup','blendFuncSeparate',1]
])test('controlled dependency throw during '+name+' preserves the error and retires handles',()=>{
  const f=accountingGraphics(),original=new Error('controlled dependency: '+name);f.failNext(method,original,offset);
  assert.throws(()=>createFormRenderer(f.canvas,100),error=>error===original);
  owned(f,none);
});
test('success renders, disposes exactly once and ignores drawing after disposal',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100);owned(f,base);
  renderer.render({shape:{base:.4,flare:.2,bend:0},extent:1,time:0});
  assert.deepEqual(f.draws.map(d=>d.mode),[f.gl.LINES,f.gl.POINTS]);assert.equal(f.draws[1].count,100);
  renderer.setQuality(200);renderer.render({shape:{base:.4,flare:.2,bend:0},extent:1});
  assert.equal(f.draws.at(-1).count,200);
  renderer.dispose();owned(f,none);const retired=f.deleted.length,drawn=f.draws.length;
  renderer.dispose();renderer.render({shape:{base:.4,flare:.2,bend:0},extent:1});
  assert.equal(f.deleted.length,retired);assert.equal(f.draws.length,drawn);
});
test('explicit source camera owns lazy marks, preserves its errors and can retry',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100);
  const input={sourceCamera:GROUND_CAMERAS[0].camera,referencePoints:GROUND_MARKS,
    shape:{base:.5,flare:.4,bend:0},extent:1,time:130,azimuth:NaN};
  const original=new Error('controlled camera mark buffer failure');f.failNext('bufferData',original);
  assert.throws(()=>renderer.render(input),error=>error===original);owned(f,base);
  f.clearFailure();renderer.render(input);owned(f,{program:2,shader:0,vao:3,buffer:3});
  assert.deepEqual(f.draws.slice(-3).map(draw=>draw.mode),[f.gl.LINES,f.gl.LINES,f.gl.POINTS]);
  renderer.dispose();owned(f,none);
});
test('invalid source camera and incompatible schematic clear rather than reuse an old image',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100);
  renderer.render({shape:{base:.5,flare:.4,bend:0},extent:1});
  const drawn=f.draws.length,clears=f.callCount('clear');
  assert.throws(()=>renderer.render({sourceCamera:{id:'incomplete'},shape:{base:.5,flare:.4,bend:0}}));
  assert.equal(f.draws.length,drawn);assert.equal(f.callCount('clear'),clears+1);
  assert.throws(()=>renderer.render({sourceCamera:GROUND_CAMERAS[0].camera,partialForm:margin}),/schematic/);
  assert.equal(f.draws.length,drawn);renderer.dispose();owned(f,none);
});
test('successful reinitialize retires the previous bundle and preserves drawing',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100);
  const old=f.created.filter(h=>h.kind!=='shader');renderer.initialize();owned(f,base);
  assert.ok(old.every(h=>f.deleted.includes(h)));
  renderer.render({shape:{base:.4,flare:.2,bend:0},extent:1});assert.equal(f.draws.at(-1).count,100);
  renderer.dispose();owned(f,none);
});
test('failed reinitialize, dispose and retry leave no abandoned bundle',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100),original=new Error('controlled reinitialize failure');
  f.failNext('bufferData',original,2);assert.throws(()=>renderer.initialize(),error=>error===original);owned(f,none);
  const drawn=f.draws.length;renderer.render({shape:{base:.4,flare:.2,bend:0},extent:1});assert.equal(f.draws.length,drawn);
  renderer.dispose();owned(f,none);f.clearFailure();renderer.initialize();owned(f,base);
  renderer.render({shape:{base:.4,flare:.2,bend:0},extent:1});assert.equal(f.draws.at(-1).count,100);
  renderer.dispose();owned(f,none);
});
for(const [name,form] of [['margin',margin],['condensation',condensation]])test('lazy '+name+' attribute failure preserves base ownership, retries and disposes',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100),original=new Error('controlled lazy '+name+' attribute failure');
  const baseHandles=f.created.filter(handle=>handle.kind!=='shader');
  f.failNext('bufferData',original);assert.throws(()=>renderer.render({partialForm:form}),error=>error===original);owned(f,base);
  assert.ok(baseHandles.every(handle=>!f.deleted.includes(handle)),'Committed base handles survive lazy failure');
  assert.equal(f.draws.length,0);
  renderer.render({shape:{base:.4,flare:.2,bend:0},extent:1});assert.equal(f.draws.at(-1).count,100);owned(f,base);
  f.clearFailure();renderer.render({partialForm:form});
  owned(f,{program:3,shader:0,vao:3,buffer:3});assert.equal(f.draws.at(-1).mode,f.gl.TRIANGLES);
  renderer.dispose();owned(f,none);
});
test('both lazy consumers reuse complete bundles and retire each handle once',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100);
  for(const form of [margin,condensation])renderer.render({partialForm:form});
  owned(f,{program:4,shader:0,vao:4,buffer:4});const created=f.created.length;
  for(const form of [condensation,margin])renderer.render({partialForm:form});
  assert.equal(f.created.length,created);assert.equal(f.draws.length,4);renderer.dispose();owned(f,none);
  assert.equal(f.created.length,f.deleted.length);
});

test('second-program compile failure during reinitialize retires the old and pending bundles before retry',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100);f.failCompile(8);
  assert.throws(()=>renderer.initialize(),error=>error.constructor===Error&&error.message==='controlled shader compile failure');owned(f,none);
  renderer.dispose();owned(f,none);f.clearFailure();renderer.initialize();owned(f,base);
  renderer.render({shape:{base:.4,flare:.2,bend:0},extent:1});assert.equal(f.draws.at(-1).count,100);renderer.dispose();owned(f,none);
});

const simulationInput={motionModel:'kinematic-v1',shape:{base:.13,flare:.83,bend:.12},extent:1,time:2,dust:true};
for(const kind of ['compile','link','attribute'])test('procedural volume '+kind+' failure preserves ownership and supports retry/dispose',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100);
  const original=new Error('controlled volume attribute failure');
  if(kind==='compile')f.failCompile(6);
  if(kind==='link')f.failLink(3);
  if(kind==='attribute')f.failNext('bufferData',original,2);
  assert.throws(()=>renderer.render(simulationInput),error=>kind==='attribute'?error===original:error.message==='controlled '+(kind==='compile'?'shader compile':'program link')+' failure');
  owned(f,base);f.clearFailure();renderer.render(simulationInput);
  owned(f,{program:3,shader:0,vao:3,buffer:3});
  assert.deepEqual(f.draws.slice(-3).map(d=>d.mode),[f.gl.LINES,f.gl.TRIANGLES,f.gl.POINTS]);
  const created=f.created.length;renderer.render({...simulationInput,time:5});assert.equal(f.created.length,created);
  renderer.dispose();owned(f,none);
});

test('a committed procedural volume remains owned through a uniform failure until explicit disposal',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100),original=new Error('controlled volume viewport failure');
  f.failNext('uniform4f',original);assert.throws(()=>renderer.render(simulationInput),error=>error===original);
  owned(f,{program:3,shader:0,vao:3,buffer:3});renderer.dispose();owned(f,none);
});

test('procedural and legacy selections reuse the owned buffers and partial forms keep their legacy path',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100);
  renderer.render(simulationInput);renderer.setQuality(200);renderer.render({...simulationInput,time:0});
  assert.equal(f.draws.at(-1).count,200);
  renderer.render({shape:simulationInput.shape,extent:1,time:0});
  assert.deepEqual(f.draws.slice(-2).map(d=>d.mode),[f.gl.LINES,f.gl.POINTS]);
  renderer.render({partialForm:condensation});assert.equal(f.draws.at(-1).mode,f.gl.TRIANGLES);
  renderer.dispose();owned(f,none);
});

test('invalid procedural time/shape and incompatible partial forms clear without substituting a drawing',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100);
  for(const input of [{...simulationInput,time:86401},{...simulationInput,shape:{base:NaN,flare:.1,bend:0}}, {...simulationInput,partialForm:condensation}]){
    const before=f.callCount('clear'),drawn=f.draws.length;assert.throws(()=>renderer.render(input));
    assert.equal(f.callCount('clear'),before+1);assert.equal(f.draws.length,drawn);owned(f,base);
  }
  renderer.dispose();owned(f,none);
});

test('formation flow and density retain partial ownership across failure, retry, quality and disposal',t=>{
  renderGlobals(t);const f=accountingGraphics(),renderer=createFormRenderer(f.canvas,100),original=new Error('controlled flow attribute failure');
  const input={...simulationInput,motionModel:'genesis-v1',formationTime:15,flow:true};
  // Particle model upload succeeds, then the new lazy flow attribute fails.
  f.failNext('bufferData',original,2);assert.throws(()=>renderer.render(input),error=>error===original);owned(f,base);
  f.clearFailure();renderer.render(input);owned(f,{program:3,shader:0,vao:4,buffer:4});
  const created=f.created.length;renderer.setQuality(200);renderer.render({...input,formationTime:24});
  assert.equal(f.created.length,created);assert.equal(f.draws.at(-1).count,200);
  renderer.render({...input,formationTime:0});renderer.render({...input,formationTime:30});
  renderer.dispose();owned(f,none);assert.equal(f.created.length,f.deleted.length);
});
