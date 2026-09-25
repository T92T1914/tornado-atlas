import { PRESETS, particles, advanceTime, cameraMatrix } from './vortex-model.mjs';
import { formAt } from './evolution-model.mjs';

const byId = id => document.getElementById(id);
const canvas = byId('scene');
const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let gpu = null, frame = 0, time = 0, last = null, running = false, inView = true;

const particleVertex = `#version 300 es
precision highp float;
in vec4 seed;
uniform mat4 camera;
uniform vec3 shape;
uniform float time;
uniform float extent;
uniform float viewportHeight;
uniform float maxPoint;
uniform bool dust;
out vec4 color;
void main() {
  float h = seed.x;
  float angle = seed.y * 6.2831853 + time * (0.5 + 0.9 * (1.0-h));
  float r = (shape.x + shape.y * pow(h,1.6)) * sqrt(seed.z);
  float wave = sin(h * 5.5 - time * 0.25);
  vec3 center = vec3(shape.z * wave * h, 2.6*h, shape.z * cos(h*4.0+time*.19) * h);
  vec3 position = center + vec3(cos(angle)*r,0.0,sin(angle)*r);
  float opacity = 0.12 * smoothstep(1.0-extent-0.03,1.0-extent+0.06,h);
  float size = .14 + .16*seed.z;
  vec3 tint = vec3(.52,.59,.55) * (.76 + .24*cos(angle-.8));
  if(seed.w > 1.5) {
    angle = seed.y*6.2831853 + time*.06;
    r = .3 + 2.35*sqrt(seed.x);
    position = vec3(cos(angle)*r,2.64 + seed.z*.40 + sin(angle*3.0)*.08,sin(angle)*r*.72);
    opacity = .20 * (1.0-smoothstep(1.9,2.7,r));
    size = .28 + seed.z*.15;
    tint = vec3(.38,.45,.41);
  } else if(seed.w > .5) {
    r = shape.x*.6 + 1.10*sqrt(seed.z);
    position = vec3(cos(angle)*r,.025+seed.x*.17,sin(angle)*r);
    opacity = dust ? .09*(1.0-seed.x)*(1.0-seed.z*.65) : 0.0;
    size = .23 + seed.z*.18;
    tint = vec3(.52,.45,.32);
  }
  gl_Position = camera * vec4(position,1.0);
  gl_PointSize = clamp(viewportHeight * size / max(.2,gl_Position.w),1.0,maxPoint);
  color = vec4(tint, opacity);
}`;
const particleFragment = `#version 300 es
precision mediump float;
in vec4 color;
out vec4 outputColor;
void main() {
  float d = length(gl_PointCoord*2.0-1.0);
  float alpha = color.a * pow(max(0.0,1.0-d*d),2.0);
  if(alpha < .002) discard;
  outputColor = vec4(color.rgb,alpha);
}`;
const gridVertex = `#version 300 es
in vec3 position;
uniform mat4 camera;
out float fade;
void main() {gl_Position=camera*vec4(position,1.0);fade=1.0-min(1.0,length(position.xz)/8.0);}`;
const gridFragment = `#version 300 es
precision mediump float;
in float fade;
out vec4 outputColor;
void main(){outputColor=vec4(.47,.58,.47,.22*fade);}`;

function program(vertex, fragment) {
  const shaders = [];
  const p = gl.createProgram();
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader,source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(p,shader);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  } catch (error) { gl.deleteProgram(p); throw error; }
  finally { for(const shader of shaders) gl.deleteShader(shader); }
}
function attribute(p, name, values, width) {
  const vao = gl.createVertexArray(), buffer = gl.createBuffer();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
  const location = gl.getAttribLocation(p,name);
  gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,width,gl.FLOAT,false,0,0);
  return { vao, buffer };
}
function initialize() {
  if (!gl) { fail('WebGL 2 is unavailable'); return; }
  try {
    const cloud = program(particleVertex,particleFragment), grid = program(gridVertex,gridFragment);
    const points = particles(Number(byId('quality').value));
    const cloudAttribute = attribute(cloud,'seed',points,4);
    const lines = [];
    for (let i=-6;i<=6;i++) lines.push(i,0,-6,i,0,6,-6,0,i,6,0,i);
    const gridAttribute = attribute(grid,'position',new Float32Array(lines),3);
    gpu = { cloud, grid, cloudAttribute, gridAttribute, count:points.length/4,
      gridCount:lines.length/3, maxPoint:gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1],
      uniforms:Object.fromEntries(['camera','shape','time','extent','viewportHeight','maxPoint','dust'].map(name => [name,gl.getUniformLocation(cloud,name)])),
      gridCamera:gl.getUniformLocation(grid,'camera') };
    gl.enable(gl.BLEND);
    // Canvas composition expects premultiplied RGB with correctly accumulated alpha.
    gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST); gl.clearColor(0,0,0,0);
    byId('scene-failure').hidden = true;
    byId('motion').disabled = false;
    status(motionPreference.matches ? 'Paused · reduced motion preference' : 'Paused · drag to explore');
    requestFrame();
  } catch (error) { console.error('Form study initialization failed:',error); fail('The renderer could not start'); }
}
function status(message) { byId('motion-status').textContent=message; }
function fail(message) {
  running = false; gpu = null; last = null;
  if(frame) cancelAnimationFrame(frame);
  frame=0; byId('motion').disabled=true; byId('motion').textContent='Play motion';
  byId('scene-failure').hidden=false; status(message);
}
function stop(message = 'Paused') {
  running=false;last=null;
  if(frame) cancelAnimationFrame(frame);
  frame=0;byId('motion').textContent='Play motion';
  // View and accessibility controls must not replace a renderer failure diagnosis.
  if(gpu) status(message);
  requestFrame();
}
function requestFrame() { if (!frame && gpu && !document.hidden && inView) frame=requestAnimationFrame(draw); }
function draw(now) {
  frame=0;
  if (!gpu || document.hidden || !inView) return;
  if(last !== null) time=advanceTime(time,(now-last)/1000,running);
  const evolving=byId('sequence-enabled').checked;
  if(evolving && running) {
    byId('sequence-time').value=Math.min(1,time/30);
    sequenceReadout();
    if(time>=30) stop('Sequence complete');
  }
  last=now;
  const rect=canvas.getBoundingClientRect(), ratio=Math.min(window.devicePixelRatio || 1,2);
  const width=Math.max(1,Math.min(2048,Math.round(rect.width*ratio)));
  const height=Math.max(1,Math.min(1600,Math.round(rect.height*ratio)));
  if(canvas.width!==width || canvas.height!==height) {canvas.width=width;canvas.height=height;}
  gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT);
  const camera=cameraMatrix(Number(byId('azimuth').value),Number(byId('elevation').value),Number(byId('distance').value),rect.width/rect.height);
  gl.useProgram(gpu.grid);gl.bindVertexArray(gpu.gridAttribute.vao);
  gl.uniformMatrix4fv(gpu.gridCamera,false,camera);gl.drawArrays(gl.LINES,0,gpu.gridCount);
  gl.useProgram(gpu.cloud);gl.bindVertexArray(gpu.cloudAttribute.vao);
  const sequence=evolving?formAt(Number(byId('sequence-time').value)):null;
  const u=gpu.uniforms, shape=sequence?.shape || PRESETS[byId('shape').value];
  gl.uniformMatrix4fv(u.camera,false,camera);gl.uniform3f(u.shape,shape.base,shape.flare,shape.bend);
  gl.uniform1f(u.time,time);gl.uniform1f(u.extent,sequence?.extent ?? Number(byId('condensation').value)/100);
  gl.uniform1f(u.viewportHeight,height);gl.uniform1f(u.maxPoint,gpu.maxPoint);
  gl.uniform1i(u.dust,byId('dust').checked?1:0);gl.drawArrays(gl.POINTS,0,gpu.count);
  if(running) requestFrame();
}
function syncControls() {
  for (const id of ['condensation','azimuth','elevation','distance']) {
    const suffix=id==='condensation'?'%':id==='distance'?'':'°';
    byId(id+'-value').textContent=(id==='distance'?Number(byId(id).value).toFixed(1):byId(id).value)+suffix;
  }
  byId('scene-form').textContent=byId('sequence-enabled').checked?'AUTHORED FORM SEQUENCE':PRESETS[byId('shape').value].label.toUpperCase()+' FORM';
  requestFrame();
}
for (const id of ['shape','condensation','azimuth','elevation','distance','dust']) byId(id).addEventListener('input',syncControls);
byId('quality').addEventListener('change',() => {
  if(!gpu) return;
  const values=particles(Number(byId('quality').value));
  gl.bindBuffer(gl.ARRAY_BUFFER,gpu.cloudAttribute.buffer);gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
  gpu.count=values.length/4;requestFrame();
});
byId('motion').addEventListener('click',() => {
  if(running) {stop();return;}
  if(byId('sequence-enabled').checked && time>=30) time=0;
  running=true;last=null;byId('motion').textContent='Pause motion';status('Illustrative motion playing');requestFrame();
});
byId('reset-view').addEventListener('click',() => {
  stop();time=0;byId('sequence-time').value=0;sequenceReadout();
  for(const [id,value] of Object.entries({azimuth:25,elevation:12,distance:7})) byId(id).value=value;
  syncControls();
});
let drag=null;
canvas.addEventListener('pointerdown',event => {
  if(event.button!==0 || !gpu) return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);
});
function orbit(dx,dy) {
  const wrap=a=>((a+180)%360+360)%360-180;
  byId('azimuth').value=Math.round(wrap(Number(byId('azimuth').value)+dx));
  byId('elevation').value=Math.round(Math.max(3,Math.min(60,Number(byId('elevation').value)+dy)));
  syncControls();
}
canvas.addEventListener('pointermove',event => {
  if(!drag || drag.id!==event.pointerId) return;
  orbit((event.clientX-drag.x)*.5,(event.clientY-drag.y)*.3);drag.x=event.clientX;drag.y=event.clientY;
});
for(const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name,() => {drag=null;});
canvas.addEventListener('keydown',event => {
  const directions={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,3],ArrowDown:[0,-3]};
  if(directions[event.key]) {event.preventDefault();orbit(...directions[event.key]);}
});
document.addEventListener('visibilitychange',() => {if(document.hidden) stop('Paused while page hidden');else requestFrame();});
motionPreference.addEventListener('change',event => {if(event.matches) stop('Paused · reduced motion preference');});
new ResizeObserver(requestFrame).observe(canvas);
new IntersectionObserver(entries => {
  inView=entries[0].isIntersecting && entries[0].intersectionRatio>=.4;
  if(!inView) stop('Paused while most of the scene is out of view');else requestFrame();
}, {threshold:[0,.4]}).observe(canvas);
canvas.addEventListener('webglcontextlost',event => {event.preventDefault();fail('Graphics context lost; waiting for recovery');});
canvas.addEventListener('webglcontextrestored',initialize);
function sequenceReadout() {
  const value=Number(byId('sequence-time').value);
  byId('sequence-progress').textContent=`${Math.round(value*100)}% of authored sequence`;
  byId('sequence-stage').textContent=formAt(value).label;
}
byId('sequence-enabled').addEventListener('change',()=>{
  stop();time=Number(byId('sequence-time').value)*30;
  for(const id of ['shape','condensation']) byId(id).disabled=byId('sequence-enabled').checked;
  byId('sequence-time').disabled=!byId('sequence-enabled').checked;
  syncControls();sequenceReadout();
});
byId('sequence-time').addEventListener('input',()=>{stop();time=Number(byId('sequence-time').value)*30;sequenceReadout();requestFrame();});
sequenceReadout();syncControls();initialize();
