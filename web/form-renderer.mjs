import {particles, cameraMatrix} from './vortex-model.mjs';
import {validateCondensationSupport} from './partial-form-geometry.mjs';
import {sourceCameraProjection,sourceBackingSize} from './source-camera-model.mjs';
import {simulationTime,simulationBackingSize,simulationParticles,inverseCameraMatrix,FUNNEL_DENSITY_GLSL,funnelVolumeVertex,funnelVolumeFragment} from './funnel-simulation-model.mjs';
import {formationAt,formationFlow} from './formation-model.mjs';
import {FUNNEL_LIGHTING_GLSL} from './funnel-lighting-model.mjs';
import {referenceNoiseLattice} from './reference-form-model.mjs';
import {stormFlow} from './storm-scene-model.mjs';

// The form study and historical replay share these drawing resources. Time,
// coverage and source selection belong to their existing page controllers.
const particleVertex = `#version 300 es
precision highp float;
precision highp int;
in vec4 seed;
uniform mat4 camera;
uniform vec3 shape;
uniform float time;
uniform float extent;
uniform float viewportHeight;
uniform float maxPoint;
uniform bool dust;
uniform bool kinematic;
uniform bool genesis;
uniform float formationProgress;
uniform vec4 formationState;
uniform int readingPalette;
uniform vec2 spriteAspect;
uniform bool worldLighting;
uniform vec3 worldEye;
out vec4 color;
out vec2 cloudSeed;
out vec2 particleAspect;
out vec4 kinematicProbe;
${FUNNEL_DENSITY_GLSL}
${FUNNEL_LIGHTING_GLSL}
float birthFade(float x){x=clamp(x,0.0,1.0);return x*x*x*(x*(x*6.0-15.0)+10.0);}
void main() {
#if REFERENCE_FORM
  // Condensation and cloud belong to the integrated volume in this version.
  // Only restrained low dust sprites remain as a separate moving cue.
  if(seed.w<.5||seed.w>1.5){
    gl_Position=vec4(2.0,2.0,2.0,1.0);gl_PointSize=1.0;
    color=vec4(0.0);cloudSeed=vec2(0.0);particleAspect=vec2(1.0);kinematicProbe=vec4(0.0);return;
  }
#endif
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
  if(kinematic){
    // Analytic ages have no accumulated integration state. Both recycling ends
    // are invisible, including when seeking directly across a cycle boundary.
    float age=fract(seed.x+time*(.085+.025*seed.z));
    float life=birthFade(age/.12)*birthFade((1.0-age)/.17);
    h=age;
    angle=seed.y*6.2831853+time*.9+6.0*h;
    r=funnelRadius(h,shape,time)*(.85+.20*seed.z);
    vec2 axis=funnelCenter(h,shape,time);
    position=vec3(axis.x+cos(angle)*r,2.6*h,axis.y+sin(angle)*r);
    opacity=.018*life*smoothstep(1.0-extent-.02,1.0-extent+.045,h);
    if(genesis)opacity*=formationState.x*formationMask(h,angle,time);
    size=.17+.10*seed.z;
    if(seed.w>1.5){
      // The slow cloud-base density is integrated by the volume pass.
      opacity=0.0;
    }else if(seed.w>.5){
      age=fract(seed.x+time*(.17+.045*seed.z));
      life=birthFade(age/.10)*birthFade((1.0-age)/.28);
      r=(.12+age*(shape.x*.7+.85))*pow(seed.z,.65);
      angle=seed.y*6.2831853+time*(1.4+.9*seed.z)+age*4.0;
      position=vec3(cos(angle)*r,.018+.08*age+.18*seed.z*age*(1.0-age),sin(angle)*r);
      float sector=.30+.70*pow(.5+.5*cos(angle-.3*time-.6),2.0);
      opacity=dust?.11*life*(1.0-.5*age)*sector:0.0;
      if(genesis)opacity*=formationState.z;
      size=.20+.18*age;
    }
  }
  // Optional neutral laboratory palette. Source-informed replay colors retain
  // their separate existing contract when this option is not selected.
  if(readingPalette > 0) {
    float value = readingPalette == 1 ? .27 : .72;
    tint = vec3(value) * (.76 + .24*cos(angle-.8));
  }
#if REFERENCE_FORM
  opacity*=.30;size*=.75;
#endif
  if(worldLighting&&opacity>0.0){
    tint=worldMaterial(position,sceneDensity(position));
    // Dust behind dense condensation has a bounded two-probe view attenuation.
    // This is not a complete depth buffer or a full camera-path integral.
    if(seed.w>.5&&seed.w<1.5)opacity*=nearbyTransmission(position,normalize(worldEye-position));
    if(seed.w<.5){opacity*=.30;size*=.65;}
  }
  gl_Position = camera * vec4(position,1.0);
  gl_PointSize = clamp(viewportHeight * size / max(.2,gl_Position.w),1.0,maxPoint);
  color = vec4(tint, opacity);
  cloudSeed = seed.xy*vec2(17.3,23.7)+seed.z*11.1;
  particleAspect = spriteAspect;
  kinematicProbe = vec4(position,opacity);
}`;
const particleFragment = `#version 300 es
precision mediump float;
in vec4 color;
in vec2 cloudSeed;
in vec2 particleAspect;
uniform bool worldLighting;
out vec4 outputColor;
void main() {
  vec2 p = (gl_PointCoord*2.0-1.0)/particleAspect;
  float radius2 = dot(p,p), d = sqrt(radius2);
  // Fixed cloud texture and lighting are artistic display choices.
  float edge = 1.0-smoothstep(.70,1.0,d);
  float texture = .93 + .07*sin(p.x*2.1+cloudSeed.x)*cos(p.y*2.4+cloudSeed.y);
  float alpha = color.a * exp(-1.8*radius2) * edge * texture;
  if(alpha < .002) discard;
  float light = .88 + .12*clamp(.5+.5*p.y-.2*p.x,0.0,1.0);
  outputColor = vec4(color.rgb*(worldLighting?1.0:light),alpha);
}`;
const gridVertex = `#version 300 es
in vec3 position;
uniform mat4 camera;
out float fade;
void main() {gl_Position=camera*vec4(position,1.0);fade=1.0-min(1.0,length(position.xz)/8.0);}`;
const gridFragment = `#version 300 es
precision mediump float;
in float fade;
uniform int readingPalette;
uniform bool referenceMarks;
uniform float markAlpha;
out vec4 outputColor;
void main(){vec3 tint=readingPalette==0?vec3(.47,.58,.47):vec3(readingPalette==1?.32:.72);outputColor=vec4(tint,(referenceMarks ? .95 : .22)*fade*markAlpha);}`;

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
uniform bool lightTaper;
uniform bool darkExtension;
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
  if(darkExtension){
    // Independent partial extension, without the later view's opening or north context.
    float feather=mix(.12,.055,smoothstep(.40,.60,p.x));
    float density=(1.0-smoothstep(-feather,feather,signedDistance))*.88;
    // Dark image-left context leaves the opposite boundary unassigned.
    vec3 background=mix(vec3(.22,.25,.24),vec3(.67,.68,.65),smoothstep(.42,.75,p.x));
    vec3 color=mix(background,vec3(.22,.25,.24),density);
    // Both continuations are unobserved. Fades omit them rather than close a cone.
    float alpha=smoothstep(.12,.30,p.y)*(1.0-smoothstep(.76,.96,p.y));
    if(alpha<.002)discard;
    outputColor=vec4(color,alpha);return;
  }
  if(lightTaper){
    // Independent bright descending support. Display tones and softness carry no photometry.
    float density=(1.0-smoothstep(-.045,.045,signedDistance))*.92;
    vec3 color=mix(vec3(.18,.22,.22),vec3(.84,.82,.74),density);
    // Omit and soften the lowest region. Upper continuation ends at a display cutoff.
    float alpha=smoothstep(.10,.25,p.y);
    if(alpha<.002)discard;
    outputColor=vec4(color,alpha);return;
  }
  // A wider northward transition is an authored display cue for the source's
  // difficult northern margin. It is not a numerical uncertainty estimate.
  float feather=mix(.045,.14,smoothstep(.55,.82,p.x));
  float density=(1.0-smoothstep(-feather,feather,signedDistance))*.91;
  vec2 opening=(p-vec2(.18,.22))/vec2(.22,.34);
  float lightOpening=exp(-2.2*dot(opening,opening))*.72;
  // Authored dark context where the source does not resolve a northern outline.
  float northContext=smoothstep(.55,.82,p.x);
  vec3 background=mix(vec3(.66,.66,.61),vec3(.22,.25,.23),northContext);
  vec3 body=mix(vec3(.18,.22,.20),vec3(.24,.27,.25),smoothstep(.15,1.0,p.y));
  vec3 color=mix(background,body,density);
  color=mix(color,vec3(.90,.87,.76),lightOpening);
  // Omit the foreground-obscured lower band. Its fade is a display convention,
  // not observed cloud dissipation or a ground-contact boundary.
  float alpha=smoothstep(.06,.18,p.y);
  if(alpha<.002)discard;
  outputColor=vec4(color,alpha);
}`;

// Source-compared display proportions and clipping, without a camera solution.
const condensationDisplayLayout=Object.freeze({frameAspect:2.37,planeWidthRatio:8/7,leftOffsetRatio:-1/7});

export function buildCondensationGeometry(points,cssWidth,cssHeight,preset=null){
  const packed=validateCondensationSupport(points);
  if(!Number.isFinite(cssWidth)||!Number.isFinite(cssHeight)||cssWidth<=0||cssHeight<=0)throw new TypeError('Invalid display bounds');
  // The complete construction moves together inside a responsive authored frame.
  if(preset!==null && preset!==undefined && !['light_tapered_region','dark_downward_region'].includes(preset))throw new TypeError('Unknown independent display preset');
  const layout=preset==='light_tapered_region'?{frameAspect:1.40,planeWidthRatio:1,leftOffsetRatio:0}:preset==='dark_downward_region'?{frameAspect:2,planeWidthRatio:1,leftOffsetRatio:0}:condensationDisplayLayout;
  const frameWidth=Math.min(cssWidth-40,(cssHeight-40)*layout.frameAspect),height=frameWidth/layout.frameAspect;
  if(frameWidth<=0)return null;
  const frame=new Float32Array([(cssWidth-frameWidth)/2,(cssHeight-height)/2,frameWidth,height]);
  const width=frameWidth*layout.planeWidthRatio;
  const plane=new Float32Array([frame[0]+frameWidth*layout.leftOffsetRatio,frame[1],width,height]);
  if(![...frame,...plane].every(Number.isFinite)||plane[2]<=0||plane[3]<=0)throw new TypeError('Condensation display bounds exceed finite buffer range');
  for(let i=0;i<points.length;i++){const next=(i+1)%points.length;if(packed[i*2]===packed[next*2]&&packed[i*2+1]===packed[next*2+1])throw new TypeError('Condensation support collapsed in display buffer');}
  const x0=plane[0]/cssWidth*2-1,x1=(plane[0]+width)/cssWidth*2-1,y0=plane[1]/cssHeight*2-1,y1=(plane[1]+height)/cssHeight*2-1;
  return {vertices:new Float32Array([x0,y0,x1,y0,x0,y1,x0,y1,x1,y0,x1,y1]),points:packed,pointCount:points.length,plane,frame};
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
    let vao=null,buffer=null;
    try{
      vao=gl.createVertexArray();buffer=gl.createBuffer();
      gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
      const location=gl.getAttribLocation(p,name);
      gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,width,gl.FLOAT,false,0,0);
      return {vao,buffer};
    }catch(error){
      if(vao)gl.deleteVertexArray(vao);
      if(buffer)gl.deleteBuffer(buffer);
      throw error;
    }
  }
  function retire(resources){
    if(!resources)return;
    for(const key of ['cloudAttribute','gridAttribute','referenceAttribute','flowAttribute']){
      const item=resources[key];
      if(item){gl.deleteVertexArray(item.vao);gl.deleteBuffer(item.buffer);}
    }
    if(resources.margin){gl.deleteVertexArray(resources.margin.attribute.vao);gl.deleteBuffer(resources.margin.attribute.buffer);gl.deleteProgram(resources.margin.program);}
    if(resources.condensation){gl.deleteVertexArray(resources.condensation.attribute.vao);gl.deleteBuffer(resources.condensation.attribute.buffer);gl.deleteProgram(resources.condensation.program);}
    if(resources.cloud)gl.deleteProgram(resources.cloud);
    if(resources.grid)gl.deleteProgram(resources.grid);
    if(resources.referenceTexture)gl.deleteTexture(resources.referenceTexture);
    if(resources.volume){gl.deleteVertexArray(resources.volume.attribute.vao);gl.deleteBuffer(resources.volume.attribute.buffer);gl.deleteProgram(resources.volume.program);}
    for(const key of ['referenceCloud','referenceVolume','stormVolume']){
      const item=resources[key];
      if(item){gl.deleteVertexArray(item.attribute.vao);gl.deleteBuffer(item.attribute.buffer);gl.deleteProgram(item.program);}
    }
  }
  function dispose(){
    const owned=gpu;gpu=null;retire(owned);
  }
  function initialize(){
    dispose();
    const pending={};
    try{
      pending.cloud=program(particleVertex,particleFragment);
      pending.grid=program(gridVertex,gridFragment);
      const values=particles(Number(quality));
      pending.cloudAttribute=attribute(pending.cloud,'seed',values,4);
      const lines=[];
      for(let i=-6;i<=6;i++)lines.push(i,0,-6,i,0,6,-6,0,i,6,0,i);
      pending.gridAttribute=attribute(pending.grid,'position',new Float32Array(lines),3);
      Object.assign(pending,{count:values.length/4,
        gridCount:lines.length/3,maxPoint:gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1],
        particleModel:'legacy',
        uniforms:Object.fromEntries(['camera','shape','time','extent','viewportHeight','maxPoint','dust','kinematic','genesis','formationProgress','formationState','readingPalette','spriteAspect','worldLighting','worldEye'].map(name=>[name,gl.getUniformLocation(pending.cloud,name)])),
        gridCamera:gl.getUniformLocation(pending.grid,'camera'),gridPalette:gl.getUniformLocation(pending.grid,'readingPalette'),
        gridMarks:gl.getUniformLocation(pending.grid,'referenceMarks'),gridAlpha:gl.getUniformLocation(pending.grid,'markAlpha')});
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
      gpu=pending;
    }catch(error){retire(pending);throw error;}
  }
  function setQuality(next){
    quality=next;
    if(!gpu)return;
    const values=(gpu.particleModel!=='legacy'?simulationParticles:particles)(Number(quality));
    gl.bindBuffer(gl.ARRAY_BUFFER,gpu.cloudAttribute.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
    if(gpu.referenceCloud){gl.bindBuffer(gl.ARRAY_BUFFER,gpu.referenceCloud.attribute.buffer);gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);}
    gpu.count=values.length/4;
  }
  const referenceShader=source=>source.replace('#version 300 es','#version 300 es\n#define REFERENCE_FORM 1');
  const stormShader=source=>source.replace('#version 300 es','#version 300 es\n#define REFERENCE_FORM 1\n#define STORM_SCENE 1');
  function referenceTexture(){
    if(gpu.referenceTexture)return gpu.referenceTexture;
    const texture=gl.createTexture();
    if(!texture)throw new Error('Reference material texture is unavailable');
    try{
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,texture);
      for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,axis,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_BASE_LEVEL,0);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAX_LEVEL,0);
      gl.texStorage3D(gl.TEXTURE_3D,1,gl.R8,32,32,32);
      gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,32,32,32,gl.RED,gl.UNSIGNED_BYTE,referenceNoiseLattice());
      const error=gl.getError();if(error!==gl.NO_ERROR)throw new Error('Reference material upload failed: '+error);
      gpu.referenceTexture=texture;return texture;
    }catch(error){gl.deleteTexture(texture);throw error;}
  }
  function referenceParticleResources(){
    if(gpu.referenceCloud)return gpu.referenceCloud;
    let p=null,a=null;
    try{
      p=program(referenceShader(particleVertex),particleFragment);
      a=attribute(p,'seed',simulationParticles(Number(quality)),4);
      const uniforms=Object.fromEntries([...Object.keys(gpu.uniforms),'referenceNoiseTexture'].map(name=>[name,gl.getUniformLocation(p,name)]));
      const resource={program:p,attribute:a,uniforms};gpu.referenceCloud=resource;return resource;
    }catch(error){if(a){gl.deleteVertexArray(a.vao);gl.deleteBuffer(a.buffer);}if(p)gl.deleteProgram(p);throw error;}
  }
  function volumeResources(reference=false,storm=false){
    const key=storm?'stormVolume':reference?'referenceVolume':'volume';
    if(gpu[key])return gpu[key];
    let p=null,a=null;
    try{
      p=program(funnelVolumeVertex,storm?stormShader(funnelVolumeFragment):reference?referenceShader(funnelVolumeFragment):funnelVolumeFragment);
      a=attribute(p,'position',new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),2);
      const resource={program:p,attribute:a,uniforms:Object.fromEntries(['inverseCamera','viewportBox','shape','time','extent','readingPalette','dust','genesis','formationProgress','formationState','worldLighting','surfacePass','referenceNoiseTexture'].map(name=>[name,gl.getUniformLocation(p,name)]))};
      gpu[key]=resource;return resource;
    }catch(error){if(a){gl.deleteVertexArray(a.vao);gl.deleteBuffer(a.buffer);}if(p)gl.deleteProgram(p);throw error;}
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
      const resource={program:p,attribute:a,uniforms:Object.fromEntries(['points[0]','pointCount','cssPerPixel','plane','lightTaper','darkExtension'].map(name=>[name,gl.getUniformLocation(p,name)]))};
      gpu.condensation=resource;return resource;
    }catch(error){if(a){gl.deleteVertexArray(a.vao);gl.deleteBuffer(a.buffer);}if(p)gl.deleteProgram(p);throw error;}
  }
  function referenceResources(points){
    const lines=[];
    for(const [x,y,z] of points)lines.push(x-.08,y,z,x+.08,y,z,x,y-.08,z,x,y+.08,z);
    if(gpu.referenceAttribute){
      gl.bindBuffer(gl.ARRAY_BUFFER,gpu.referenceAttribute.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lines),gl.STATIC_DRAW);
      return gpu.referenceAttribute;
    }
    // attribute() retains partial ownership until it can commit the pair.
    gpu.referenceAttribute=attribute(gpu.grid,'position',new Float32Array(lines),3);
    return gpu.referenceAttribute;
  }
  function render({partialForm=null,shape=null,extent=0,time=0,dust=false,azimuth=25,elevation=12,distance=7,readingAppearance=null,sourceCamera=null,referencePoints=null,motionModel='legacy',formationTime=null,formationVisibility='ordinary',flow=false,lightingStyle='legacy'}={}){
    if(!gpu)return;
    // An unavailable selection hides the canvas. Clear its existing backing
    // surface without asking a zero-size hidden layout to define a camera.
    // Validation below still rejects unsupported styles and camera contracts.
    const empty=shape===null&&partialForm===null;
    const rect=empty?{width:Math.max(1,canvas.width),height:Math.max(1,canvas.height)}:canvas.getBoundingClientRect(),ratio=empty?1:Math.min(window.devicePixelRatio||1,2);
    const lighter=lightingStyle!=='legacy'&&Number(quality)<=(sourceCamera?1600:3600);
    const frameWidth=sourceCamera&&!empty?canvas.clientWidth:rect.width,frameHeight=sourceCamera&&!empty?canvas.clientHeight:rect.height;
    const raster=motionModel!=='legacy'?simulationBackingSize(frameWidth,frameHeight,ratio,lighter?'lighter':'standard'):sourceCamera===null?null:sourceBackingSize(frameWidth,frameHeight,ratio);
    const width=raster?.width??Math.max(1,Math.min(2048,Math.round(rect.width*ratio)));
    const height=raster?.height??Math.max(1,Math.min(1600,Math.round(rect.height*ratio)));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    // Every selection clears the complete canvas, including an unknown instant.
    gl.viewport(0,0,width,height);gl.disable(gl.SCISSOR_TEST);
    // The new scene has its own opaque exposure, including letterbox pixels.
    // Reset explicitly when returning to an earlier transparent presentation.
    if(lightingStyle==='storm-v1')gl.clearColor(.52,.55,.56,1);else gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Validate even an empty source state, after clearing any previous image.
    const source=sourceCamera===null?null:sourceCameraProjection(sourceCamera,width,height);
    if(!['legacy','kinematic-v1','genesis-v1'].includes(motionModel))throw new TypeError('Unknown funnel motion model');
    if(!['legacy','world-v1','reference-v1','storm-v1'].includes(lightingStyle)||lightingStyle!=='legacy'&&motionModel!=='genesis-v1')throw new TypeError('Unsupported funnel lighting presentation');
    const worldLighting=lightingStyle!=='legacy',storm=lightingStyle==='storm-v1',reference=storm||lightingStyle==='reference-v1';
    const kinematic=motionModel!=='legacy',genesis=motionModel==='genesis-v1';
    const formation=genesis&&shape?formationAt(formationTime??time,{visibility:formationVisibility,flow}):null;
    if(formation){shape=formation.shape;extent=formation.extent;time=formation.seconds;}
    const state=formation?[formation.condensation,formation.erosion,formation.dust,formation.circulation]:[1,0,1,1];
    if(kinematic){
      simulationTime(time);
      if(partialForm!==null)throw new TypeError('A partial historical form cannot inherit the procedural simulation');
      if(shape&&(![shape.base,shape.flare,shape.bend].every(Number.isFinite)||shape.base<.02||shape.base>1.6||shape.flare<0||shape.flare>1.2||Math.abs(shape.bend)>.7||!Number.isFinite(extent)||extent<0||extent>1))throw new RangeError('Simulation shape exceeds its authored domain');
    }
    if(source&&partialForm!==null)throw new TypeError('A schematic display plane cannot inherit a source camera');
    if(referencePoints!==null&&(!source||!Array.isArray(referencePoints)||referencePoints.length>16||
      referencePoints.some(p=>!Array.isArray(p)||p.length!==3||!p.every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6))))
      throw new TypeError('Reference marks require a source camera and bounded scene points');
    if(partialForm?.kind==='visible_condensation_region'){
      const geometry=buildCondensationGeometry(partialForm.points,rect.width,rect.height,partialForm.display_preset);
      if(!geometry)return;
      const body=condensationResources();gl.useProgram(body.program);gl.bindVertexArray(body.attribute.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER,body.attribute.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,geometry.vertices);
      gl.uniform2fv(body.uniforms['points[0]'],geometry.points);gl.uniform1i(body.uniforms.pointCount,geometry.pointCount);gl.uniform2f(body.uniforms.cssPerPixel,rect.width/width,rect.height/height);
      gl.uniform4fv(body.uniforms.plane,geometry.plane);
      gl.uniform1i(body.uniforms.lightTaper,partialForm.display_preset==='light_tapered_region'?1:0);
      gl.uniform1i(body.uniforms.darkExtension,partialForm.display_preset==='dark_downward_region'?1:0);
      const [left,bottom,frameWidth,frameHeight]=geometry.frame;
      const x0=Math.floor(left/rect.width*width),y0=Math.floor(bottom/rect.height*height);
      const x1=Math.ceil((left+frameWidth)/rect.width*width),y1=Math.ceil((bottom+frameHeight)/rect.height*height);
      gl.enable(gl.SCISSOR_TEST);
      try{gl.scissor(x0,y0,x1-x0,y1-y0);gl.drawArrays(gl.TRIANGLES,0,6);}
      finally{gl.disable(gl.SCISSOR_TEST);}
      return;
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
    if(!shape)return;
    if(gpu.particleModel!==motionModel){
      const values=(kinematic?simulationParticles:particles)(Number(quality));
      gl.bindBuffer(gl.ARRAY_BUFFER,gpu.cloudAttribute.buffer);gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
      if(gpu.referenceCloud){gl.bindBuffer(gl.ARRAY_BUFFER,gpu.referenceCloud.attribute.buffer);gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);}
      gpu.count=values.length/4;gpu.particleModel=motionModel;
    }
    const camera=source?.matrix??cameraMatrix(azimuth,elevation,distance,rect.width/rect.height);
    if(source){const v=source.viewport;gl.viewport(v.x,v.y,v.width,v.height);gl.enable(gl.SCISSOR_TEST);gl.scissor(v.x,v.y,v.width,v.height);}
    try{
    const palette=storm?2:readingAppearance==='light'?1:readingAppearance==='dark'?2:0;
    function volumeState(surfacePass){
      const volume=volumeResources(reference,storm),v=source?.viewport??{x:0,y:0,width,height};
      gl.useProgram(volume.program);gl.bindVertexArray(volume.attribute.vao);
      if(reference){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,referenceTexture());gl.uniform1i(volume.uniforms.referenceNoiseTexture,0);}
      gl.uniformMatrix4fv(volume.uniforms.inverseCamera,false,inverseCameraMatrix(camera));
      gl.uniform4f(volume.uniforms.viewportBox,v.x,v.y,v.width,v.height);
      gl.uniform3f(volume.uniforms.shape,shape.base,shape.flare,shape.bend);
      gl.uniform1f(volume.uniforms.time,time);gl.uniform1f(volume.uniforms.extent,extent);
      gl.uniform1i(volume.uniforms.dust,dust?1:0);gl.uniform1i(volume.uniforms.genesis,genesis?1:0);
      gl.uniform1f(volume.uniforms.formationProgress,formation?.progress??0);gl.uniform4f(volume.uniforms.formationState,...state);
      gl.uniform1i(volume.uniforms.readingPalette,palette);gl.uniform1i(volume.uniforms.worldLighting,worldLighting?1:0);gl.uniform1i(volume.uniforms.surfacePass,surfacePass?1:0);
      gl.drawArrays(gl.TRIANGLES,0,6);
    }
    // Synthetic floor is beneath grid and circulation marks, then cloud/dust.
    if(worldLighting)volumeState(true);
    gl.useProgram(gpu.grid);gl.bindVertexArray(gpu.gridAttribute.vao);
    gl.uniform1i(gpu.gridPalette,palette);
    gl.uniform1i(gpu.gridMarks,0);
    gl.uniform1f(gpu.gridAlpha,storm?.25:1);
    gl.uniformMatrix4fv(gpu.gridCamera,false,camera);gl.drawArrays(gl.LINES,0,gpu.gridCount);
    if(formation?.flow&&formation.circulation>0){
      const lines=(storm?stormFlow:formationFlow)(formation.seconds,formation.circulation);
      if(!gpu.flowAttribute)gpu.flowAttribute=attribute(gpu.grid,'position',lines,3);
      else{gl.bindBuffer(gl.ARRAY_BUFFER,gpu.flowAttribute.buffer);gl.bufferData(gl.ARRAY_BUFFER,lines,gl.DYNAMIC_DRAW);}
      gl.bindVertexArray(gpu.flowAttribute.vao);gl.uniform1i(gpu.gridMarks,1);gl.uniform1f(gpu.gridAlpha,formation.circulation*(storm?.15:reference?.28:.7));gl.drawArrays(gl.LINES,0,lines.length/3);gl.uniform1i(gpu.gridMarks,0);gl.uniform1f(gpu.gridAlpha,1);
    }
    if(source&&referencePoints?.length){
      gl.bindVertexArray(referenceResources(referencePoints).vao);gl.uniform1i(gpu.gridMarks,1);
      gl.drawArrays(gl.LINES,0,referencePoints.length*4);
    }
    if(kinematic){
      volumeState(false);
    }
    // This version integrates condensation, cloud and dust together. It has no
    // separate sprite draw with unrelated lifetimes or transport.
    if(storm)return;
    const particleResources=reference?referenceParticleResources():{program:gpu.cloud,attribute:gpu.cloudAttribute,uniforms:gpu.uniforms};
    gl.useProgram(particleResources.program);gl.bindVertexArray(particleResources.attribute.vao);
    const u=particleResources.uniforms;
    if(reference){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,referenceTexture());gl.uniform1i(u.referenceNoiseTexture,0);}
    gl.uniformMatrix4fv(u.camera,false,camera);gl.uniform3f(u.shape,shape.base,shape.flare,shape.bend);
    gl.uniform1f(u.time,time);gl.uniform1f(u.extent,extent);
    gl.uniform1f(u.viewportHeight,source?.pointScale??height);gl.uniform1f(u.maxPoint,gpu.maxPoint);
    gl.uniform2f(u.spriteAspect,...(source?.spriteAspect??[1,1]));
    gl.uniform1i(u.readingPalette,palette);
    gl.uniform1i(u.worldLighting,worldLighting?1:0);
    const a=azimuth*Math.PI/180,e=elevation*Math.PI/180;
    gl.uniform3fv(u.worldEye,sourceCamera?.position??[distance*Math.sin(a)*Math.cos(e),1.15+distance*Math.sin(e),distance*Math.cos(a)*Math.cos(e)]);
    gl.uniform1i(u.kinematic,kinematic?1:0);
    gl.uniform1i(u.genesis,genesis?1:0);gl.uniform1f(u.formationProgress,formation?.progress??0);gl.uniform4f(u.formationState,...state);
    gl.uniform1i(u.dust,dust?1:0);gl.drawArrays(gl.POINTS,0,gpu.count);
    }finally{if(source)gl.disable(gl.SCISSOR_TEST);}
  }
  initialize();
  return {render,setQuality,initialize,dispose};
}
