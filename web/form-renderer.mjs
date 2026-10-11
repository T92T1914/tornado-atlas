import {particles, cameraMatrix} from './vortex-model.mjs';
import {validateCondensationSupport} from './partial-form-geometry.mjs';

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

// Authored planar display geometry. It carries no camera or physical units.
const marginVertex = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;
const marginFragment = `#version 300 es
precision highp float;
uniform vec3 points[64];
uniform int pointCount;
uniform vec2 cssPerPixel;
uniform float totalLength;
uniform vec3 marginColor;
out vec4 outputColor;
void main(){
  vec2 p=gl_FragCoord.xy*cssPerPixel;
  float nearestSquared=1e30,nearestArc=0.0;
  for(int i=0;i<63;i++){
    if(i>=pointCount-1)break;
    vec3 a=points[i],b=points[i+1];
    vec2 segment=b.xy-a.xy;
    float t=clamp(dot(p-a.xy,segment)/dot(segment,segment),0.0,1.0);
    vec2 delta=p-mix(a.xy,b.xy,t);
    float squared=dot(delta,delta);
    if(squared<nearestSquared){nearestSquared=squared;nearestArc=mix(a.z,b.z,t);}
  }
  // Fixed presentation styling, not measured boundary uncertainty.
  float alpha=1.0-smoothstep(2.0,6.0,sqrt(nearestSquared));
  alpha*=smoothstep(0.0,14.0,nearestArc)*smoothstep(0.0,14.0,totalLength-nearestArc)*0.82;
  if(alpha<0.002)discard;
  outputColor=vec4(marginColor,alpha);
}`;

export function buildMarginGeometry(points,cssWidth,cssHeight){
  if(!Array.isArray(points)||points.length<2||points.length>64)throw new TypeError('A margin requires 2 through 64 points');
  for(let i=0;i<points.length;i++){
    const point=points[i];
    if(!Array.isArray(point)||point.length!==2||![point[0],point[1]].every(value=>Number.isFinite(value)&&value>=0&&value<=1))throw new TypeError('Margin coordinates must be finite normalized pairs');
    if(i && point[0]===points[i-1][0] && point[1]===points[i-1][1])throw new TypeError('Adjacent margin points must differ');
  }
  if(points[0][0]===points.at(-1)[0] && points[0][1]===points.at(-1)[1])throw new TypeError('A margin path must remain open');
  if(!Number.isFinite(cssWidth)||!Number.isFinite(cssHeight)||cssWidth<=0||cssHeight<=0)throw new TypeError('Invalid display bounds');
  const side=Math.min(cssWidth,cssHeight)-40;
  if(side<=0)return null;
  const left=(cssWidth-side)/2,bottom=(cssHeight-side)/2;
  const packed=new Float32Array(points.length*3);
  let length=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=0;i<points.length;i++){
    const k=i*3;packed[k]=left+points[i][0]*side;packed[k+1]=bottom+points[i][1]*side;
    if(!Number.isFinite(packed[k])||!Number.isFinite(packed[k+1]))throw new TypeError('Display coordinates exceed finite buffer range');
    if(i){const segment=Math.hypot(packed[k]-packed[k-3],packed[k+1]-packed[k-2]);if(segment===0)throw new TypeError('Display margin segment collapsed');length+=segment;}
    packed[k+2]=length;
    if(!Number.isFinite(packed[k+2])||(i && packed[k+2]<=packed[k-1]))throw new TypeError('Display path length must remain finite and increasing');
    minX=Math.min(minX,packed[k]);maxX=Math.max(maxX,packed[k]);minY=Math.min(minY,packed[k+1]);maxY=Math.max(maxY,packed[k+1]);
  }
  const x0=Math.max(0,minX-6)/cssWidth*2-1,x1=Math.min(cssWidth,maxX+6)/cssWidth*2-1;
  const y0=Math.max(0,minY-6)/cssHeight*2-1,y1=Math.min(cssHeight,maxY+6)/cssHeight*2-1;
  return {vertices:new Float32Array([x0,y0,x1,y0,x0,y1,x0,y1,x1,y0,x1,y1]),points:packed,pointCount:points.length,totalLength:packed[packed.length-1]};
}


// Independently authored planar support polygon. Closing its display container
// does not close the unseen optical silhouette or assign physical geometry.
const condensationFragment = `#version 300 es
precision highp float;
uniform vec2 points[64];
uniform int pointCount;
uniform vec2 cssPerPixel;
uniform vec4 plane;
out vec4 outputColor;
void main(){
  vec2 p=(gl_FragCoord.xy*cssPerPixel-plane.xy)/plane.zw;
  bool inside=false;
  float nearest=1e30;
  for(int i=0;i<64;i++){
    if(i>=pointCount)break;
    vec2 a=points[i],b=points[i==pointCount-1?0:i+1];
    if((a.y>p.y)!=(b.y>p.y)){
      if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    // Top/right edges on the display frame are view cutoffs, not optical edges.
    if((a.y==1.0&&b.y==1.0)||(a.x==1.0&&b.x==1.0))continue;
    vec2 segment=b-a;
    float t=clamp(dot(p-a,segment)/dot(segment,segment),0.0,1.0);
    nearest=min(nearest,length(p-mix(a,b,t)));
  }
  float signedDistance=inside?-nearest:nearest;
  // A wider northward transition is an authored display cue for the source's
  // difficult northern margin. It is not a numerical uncertainty estimate.
  float feather=mix(.045,.14,smoothstep(.55,.82,p.x));
  float density=(1.0-smoothstep(-feather,feather,signedDistance))*.91;
  vec2 opening=(p-vec2(.18,.22))/vec2(.22,.34);
  float lightOpening=exp(-2.2*dot(opening,opening))*.72;
  vec3 background=vec3(.66,.66,.61);
  vec3 body=mix(vec3(.18,.22,.20),vec3(.24,.27,.25),smoothstep(.15,1.0,p.y));
  vec3 color=mix(background,body,density);
  color=mix(color,vec3(.90,.87,.76),lightOpening);
  // Omit the foreground-obscured lower band. Its fade is a display convention,
  // not observed cloud dissipation or a ground-contact boundary.
  float alpha=smoothstep(.06,.18,p.y);
  if(alpha<.002)discard;
  outputColor=vec4(color,alpha);
}`;

export function buildCondensationGeometry(points,cssWidth,cssHeight){
  const packed=validateCondensationSupport(points);
  if(!Number.isFinite(cssWidth)||!Number.isFinite(cssHeight)||cssWidth<=0||cssHeight<=0)throw new TypeError('Invalid display bounds');
  // Authored landscape layout. This ratio is not recovered camera geometry.
  const width=Math.min(cssWidth-40,(cssHeight-40)*2),height=width/2;
  if(width<=0)return null;
  const plane=new Float32Array([(cssWidth-width)/2,(cssHeight-height)/2,width,height]);
  if(![...plane].every(Number.isFinite)||plane[2]<=0||plane[3]<=0)throw new TypeError('Condensation display bounds exceed finite buffer range');
  for(let i=0;i<points.length;i++){const next=(i+1)%points.length;if(packed[i*2]===packed[next*2]&&packed[i*2+1]===packed[next*2+1])throw new TypeError('Condensation support collapsed in display buffer');}
  const x0=plane[0]/cssWidth*2-1,x1=(plane[0]+width)/cssWidth*2-1,y0=plane[1]/cssHeight*2-1,y1=(plane[1]+height)/cssHeight*2-1;
  return {vertices:new Float32Array([x0,y0,x1,y0,x0,y1,x0,y1,x1,y0,x1,y1]),points:packed,pointCount:points.length,plane};
}

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
    if(gpu.margin){gl.deleteVertexArray(gpu.margin.attribute.vao);gl.deleteBuffer(gpu.margin.attribute.buffer);gl.deleteProgram(gpu.margin.program);}
    if(gpu.condensation){gl.deleteVertexArray(gpu.condensation.attribute.vao);gl.deleteBuffer(gpu.condensation.attribute.buffer);gl.deleteProgram(gpu.condensation.program);}
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
  function marginResources(){
    if(gpu.margin)return gpu.margin;
    let p=null,a=null;
    try{
      p=program(marginVertex,marginFragment);a=attribute(p,'position',new Float32Array(12),2);
      const resource={program:p,attribute:a,uniforms:Object.fromEntries(['points[0]','pointCount','cssPerPixel','totalLength','marginColor'].map(name=>[name,gl.getUniformLocation(p,name)]))};
      gpu.margin=resource;return resource;
    }catch(error){if(a){gl.deleteVertexArray(a.vao);gl.deleteBuffer(a.buffer);}if(p)gl.deleteProgram(p);throw error;}
  }
  function condensationResources(){
    if(gpu.condensation)return gpu.condensation;
    let p=null,a=null;
    try{
      p=program(marginVertex,condensationFragment);a=attribute(p,'position',new Float32Array(12),2);
      const resource={program:p,attribute:a,uniforms:Object.fromEntries(['points[0]','pointCount','cssPerPixel','plane'].map(name=>[name,gl.getUniformLocation(p,name)]))};
      gpu.condensation=resource;return resource;
    }catch(error){if(a){gl.deleteVertexArray(a.vao);gl.deleteBuffer(a.buffer);}if(p)gl.deleteProgram(p);throw error;}
  }
  function render({partialForm=null,shape=null,extent=0,time=0,dust=false,azimuth=25,elevation=12,distance=7}={}){
    if(!gpu)return;
    const rect=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);
    const width=Math.max(1,Math.min(2048,Math.round(rect.width*ratio)));
    const height=Math.max(1,Math.min(1600,Math.round(rect.height*ratio)));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT);
    if(partialForm?.kind==='visible_condensation_region'){
      const geometry=buildCondensationGeometry(partialForm.points,rect.width,rect.height);
      if(!geometry)return;
      const body=condensationResources();gl.useProgram(body.program);gl.bindVertexArray(body.attribute.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER,body.attribute.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,geometry.vertices);
      gl.uniform2fv(body.uniforms['points[0]'],geometry.points);gl.uniform1i(body.uniforms.pointCount,geometry.pointCount);gl.uniform2f(body.uniforms.cssPerPixel,rect.width/width,rect.height/height);
      gl.uniform4fv(body.uniforms.plane,geometry.plane);gl.drawArrays(gl.TRIANGLES,0,6);return;
    }
    if(partialForm!==null){
      const geometry=buildMarginGeometry(partialForm.points,rect.width,rect.height);
      if(!geometry)return;
      const margin=marginResources();gl.useProgram(margin.program);gl.bindVertexArray(margin.attribute.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER,margin.attribute.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,geometry.vertices);
      gl.uniform3fv(margin.uniforms['points[0]'],geometry.points);gl.uniform1i(margin.uniforms.pointCount,geometry.pointCount);
      gl.uniform2f(margin.uniforms.cssPerPixel,rect.width/width,rect.height/height);gl.uniform1f(margin.uniforms.totalLength,geometry.totalLength);
      // Palette follows reading contrast; the authored source geometry is unchanged.
      const light=getComputedStyle(canvas).colorScheme==='light';
      gl.uniform3f(margin.uniforms.marginColor,light ? .22 : .52,light ? .29 : .59,light ? .25 : .55);
      gl.drawArrays(gl.TRIANGLES,0,6);return;
    }
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
