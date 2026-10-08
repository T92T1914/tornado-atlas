import {particles, cameraMatrix} from './vortex-model.mjs';

// The form study and historical replay share these drawing resources. Time,
// coverage and source selection belong to their existing page controllers.
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

export function createFormRenderer(canvas, quality) {
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,powerPreference:'low-power'});
  if(!gl)throw new Error('WebGL 2 is unavailable');
  let gpu=null;
  function program(vertex,fragment){
    const shaders=[],p=gl.createProgram();
    try{
      for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
        const shader=gl.createShader(type);shaders.push(shader);
        gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
        gl.attachShader(p,shader);
      }
      gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
      return p;
    }catch(error){gl.deleteProgram(p);throw error;}
    finally{for(const shader of shaders)gl.deleteShader(shader);}
  }
  function attribute(p,name,values,width){
    const vao=gl.createVertexArray(),buffer=gl.createBuffer();
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
    const location=gl.getAttribLocation(p,name);
    gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,width,gl.FLOAT,false,0,0);
    return {vao,buffer};
  }
  function dispose(){
    if(!gpu)return;
    for(const key of ['cloudAttribute','gridAttribute']){
      gl.deleteVertexArray(gpu[key].vao);gl.deleteBuffer(gpu[key].buffer);
    }
    gl.deleteProgram(gpu.cloud);gl.deleteProgram(gpu.grid);gpu=null;
  }
  function initialize(){
    dispose();
    const cloud=program(particleVertex,particleFragment),grid=program(gridVertex,gridFragment);
    const values=particles(Number(quality));
    const cloudAttribute=attribute(cloud,'seed',values,4),lines=[];
    for(let i=-6;i<=6;i++)lines.push(i,0,-6,i,0,6,-6,0,i,6,0,i);
    const gridAttribute=attribute(grid,'position',new Float32Array(lines),3);
    gpu={cloud,grid,cloudAttribute,gridAttribute,count:values.length/4,
      gridCount:lines.length/3,maxPoint:gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1],
      uniforms:Object.fromEntries(['camera','shape','time','extent','viewportHeight','maxPoint','dust'].map(name=>[name,gl.getUniformLocation(cloud,name)])),
      gridCamera:gl.getUniformLocation(grid,'camera')};
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
  }
  function setQuality(next){
    quality=next;
    if(!gpu)return;
    const values=particles(Number(quality));
    gl.bindBuffer(gl.ARRAY_BUFFER,gpu.cloudAttribute.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
    gpu.count=values.length/4;
  }
  function render({shape=null,extent=0,time=0,dust=false,azimuth=25,elevation=12,distance=7}={}){
    if(!gpu)return;
    const rect=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);
    const width=Math.max(1,Math.min(2048,Math.round(rect.width*ratio)));
    const height=Math.max(1,Math.min(1600,Math.round(rect.height*ratio)));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT);
    const camera=cameraMatrix(azimuth,elevation,distance,rect.width/rect.height);
    gl.useProgram(gpu.grid);gl.bindVertexArray(gpu.gridAttribute.vao);
    gl.uniformMatrix4fv(gpu.gridCamera,false,camera);gl.drawArrays(gl.LINES,0,gpu.gridCount);
    if(!shape)return;
    gl.useProgram(gpu.cloud);gl.bindVertexArray(gpu.cloudAttribute.vao);
    const u=gpu.uniforms;
    gl.uniformMatrix4fv(u.camera,false,camera);gl.uniform3f(u.shape,shape.base,shape.flare,shape.bend);
    gl.uniform1f(u.time,time);gl.uniform1f(u.extent,extent);
    gl.uniform1f(u.viewportHeight,height);gl.uniform1f(u.maxPoint,gpu.maxPoint);
    gl.uniform1i(u.dust,dust?1:0);gl.drawArrays(gl.POINTS,0,gpu.count);
  }
  initialize();
  return {render,setQuality,initialize,dispose};
}
