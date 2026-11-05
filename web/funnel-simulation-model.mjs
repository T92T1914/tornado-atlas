import {FUNNEL_LIGHTING_GLSL} from './funnel-lighting-model.mjs';
import {REFERENCE_FIELD_GLSL} from './reference-form-model.mjs';
import {STORM_FIELD_GLSL} from './storm-scene-model.mjs';
// Authored kinematics and optical density in normalized scene units.
// None of these parameters is a measured wind, condensation or debris quantity.
export const FUNNEL_SIMULATION = Object.freeze({id:'kinematic-v1',seed:20130531,maxSeconds:86400});

export function simulationTime(seconds){
  if(!Number.isFinite(seconds)||seconds<0||seconds>FUNNEL_SIMULATION.maxSeconds)throw new RangeError('Simulation time must be between 0 and 86400 seconds');
  return seconds;
}

export function simulationBackingSize(width,height,pixelRatio,detail='standard'){
  if(![width,height,pixelRatio].every(x=>Number.isFinite(x)&&x>0))throw new RangeError('Invalid simulation raster bounds');
  if(!['standard','lighter'].includes(detail))throw new RangeError('Unknown simulation drawing detail');
  // A fixed fragment budget keeps the density pass useful on software graphics.
  // One scale preserves the full camera frame while CSS retains the reading size.
  const scale=Math.min(pixelRatio,2,(detail==='lighter'?320:512)/width,(detail==='lighter'?200:320)/height);
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

export function simulationParticles(count=7200,seed=FUNNEL_SIMULATION.seed){
  if(!Number.isInteger(count)||count<100||count>12000||!Number.isInteger(seed))throw new RangeError('Particle budget or seed is invalid');
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const result=new Float32Array(count*4);
  for(let i=0;i<count;i++){
    const role=random();
    // Stable prefixes retain the same trajectories when drawing quality changes.
    result.set([random(),random(),random(),role<.72?0:role<.85?1:2],i*4);
  }
  return result;
}

export function inverseCameraMatrix(matrix){
  if(!matrix||matrix.length!==16||!Array.from(matrix).every(Number.isFinite))throw new TypeError('A finite camera matrix is required');
  const rows=Array.from({length:4},(_,r)=>[...Array.from({length:4},(_,c)=>matrix[c*4+r]),...Array.from({length:4},(_,c)=>r===c?1:0)]);
  for(let c=0;c<4;c++){
    let pivot=c;
    for(let r=c+1;r<4;r++)if(Math.abs(rows[r][c])>Math.abs(rows[pivot][c]))pivot=r;
    if(Math.abs(rows[pivot][c])<1e-12)throw new RangeError('Camera matrix is singular');
    [rows[c],rows[pivot]]=[rows[pivot],rows[c]];
    const scale=rows[c][c];for(let k=0;k<8;k++)rows[c][k]/=scale;
    for(let r=0;r<4;r++)if(r!==c){const f=rows[r][c];for(let k=0;k<8;k++)rows[r][k]-=f*rows[c][k];}
  }
  const result=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)result[c*4+r]=rows[r][c+4];
  if(!Array.from(result).every(Number.isFinite))throw new RangeError('Camera inverse exceeds finite range');
  return result;
}

// Authored harmonics and a smooth hashed value field, not curl noise or a fluid solve.
export const FUNNEL_DENSITY_GLSL = `
#ifndef REFERENCE_FORM
#define REFERENCE_FORM 0
#endif
#ifndef STORM_SCENE
#define STORM_SCENE 0
#endif
float materialCell(ivec3 cell){
  uvec3 q=uvec3(cell+ivec3(4096));
  uint value=q.x*1664525u+q.y*1013904223u+q.z*69069u+20130531u;
  value^=value>>13;value*=1274126177u;value^=value>>16;
  return float(value&65535u)/65535.0;
}
${REFERENCE_FIELD_GLSL}
${STORM_FIELD_GLSL}
float materialNoise(vec3 p){
#if REFERENCE_FORM
  return referenceNoise(p);
#else
  ivec3 cell=ivec3(floor(p));vec3 u=fract(p);u=u*u*(3.0-2.0*u);
  float lower=mix(mix(materialCell(cell),materialCell(cell+ivec3(1,0,0)),u.x),
    mix(materialCell(cell+ivec3(0,1,0)),materialCell(cell+ivec3(1,1,0)),u.x),u.y);
  float upper=mix(mix(materialCell(cell+ivec3(0,0,1)),materialCell(cell+ivec3(1,0,1)),u.x),
    mix(materialCell(cell+ivec3(0,1,1)),materialCell(cell+ivec3(1,1,1)),u.x),u.y);
  return mix(lower,upper,u.z);
#endif
}
float formationMask(float h,float theta,float t){
  float onset=smoothstep(.16,.40,formationProgress+.055*cos(9.0*h+1.0));
  float clearing=1.0-smoothstep(.73,.97,formationProgress+.045*sin(11.0*h));
  float erosion=1.0-formationState.y*smoothstep(.20,.80,.5+.5*sin(13.0*h+3.0*theta-.4*t));
  return onset*clearing*erosion;
}
vec2 funnelCenter(float h,vec3 s,float t){
#if REFERENCE_FORM
  return referenceAxis(h,s,t);
#endif
  if(genesis)return s.z*h*vec2(.55*sin(3.1*h-.16*t)+.45*h,.55*cos(2.4*h+.11*t));
  return s.z*h*vec2(sin(5.5*h-.25*t),cos(4.0*h+.19*t));
}
float funnelRadius(float h,vec3 s,float t){
#if REFERENCE_FORM
  return referenceRadius(h,s);
#endif
  if(genesis)return (s.x+s.y*pow(clamp(h,0.0,1.0),1.7))*(1.0+.10*sin(4.1*h-.24*t)+.045*sin(10.3*h-.48*t));
  float profile=s.x+s.y*pow(clamp(h,0.0,1.0),1.35);
  return profile*(1.0+.035*sin(8.0*h-.7*t)+.025*sin(13.0*h-1.1*t));
}
float condensationDensity(vec3 p,vec3 s,float t,float ex){
#if STORM_SCENE
  return stormBody(p,s,t,ex);
#endif
#if REFERENCE_FORM
  return referenceBody(p,s,t,ex);
#endif
  float h=p.y/2.6;
  if(ex<=0.0||h<0.0||h>1.04)return 0.0;
  vec2 q=p.xz-funnelCenter(h,s,t);
  float r=length(q),radius=funnelRadius(h,s,t);
  if(r>radius*1.22+.075)return 0.0;
  float theta=r>.00001?atan(q.y,q.x):0.0;
  float transported=12.0*(h-.095*t);
  float turning=theta-.65*t;
  float angular=smoothstep(0.0,.2*max(radius,.01),r);
  float ridges=angular*(.12*sin(3.0*turning+transported)+.07*sin(5.0*turning+1.8*transported));
  if(genesis)ridges=angular*(.085*sin(2.0*theta+4.0*h-.22*t)+.045*cos(5.0*theta-7.0*h+.37*t));
  float edge=radius*(1.0+ridges);
  float envelope=1.0-smoothstep(edge-(worldLighting?.035:.065),edge+(worldLighting?.05:.075),r);
  vec2 moving=mat2(cos(.65*t),-sin(.65*t),sin(.65*t),cos(.65*t))*q;
  float interior=.78+.12*sin(19.0*moving.x+7.0*moving.y+transported*2.0)
    +.08*cos(11.0*moving.y-5.0*moving.x+transported*1.3);
  float ends=smoothstep(1.0-ex-.02,1.0-ex+.045,h)*(1.0-smoothstep(.96,1.04,h));
  if(genesis){
    // Different heights become visible at different authored thresholds. No
    // descending or ascending tube is used as a definition of tornado onset.
    float eddies=worldLighting?.25+.80*materialNoise(vec3(moving.x*7.5,11.0*h-.8*t,moving.y*7.5)):
      .62+.22*sin(8.0*moving.x+6.0*moving.y+9.0*h-.8*t)+.13*cos(17.0*moving.y-4.0*moving.x+15.0*h-1.3*t);
    return max(0.0,envelope*eddies*ends*formationMask(h,theta,t)*formationState.x);
  }
  return max(0.0,envelope*interior*ends);
}
float cloudBaseDensity(vec3 p,float t){
#if STORM_SCENE
  return stormCloud(p,t);
#endif
#if REFERENCE_FORM
  return referenceCloud(p,t);
#endif
  vec2 q=p.xz-vec2(.12*sin(.11*t),.12*cos(.09*t));
  if(genesis)q*=1.18;
  float r=length(q);
  if(r>2.8||p.y<2.05||p.y>3.5)return 0.0;
  float billow=sin(2.1*q.x-.13*t)*cos(2.6*q.y+.09*t);
  float height=2.78+.16*billow+.10*sin(3.7*q.y+1.2*q.x-.18*t);
  float thickness=.27+.06*cos(2.9*q.x-1.7*q.y+.11*t);
  if(genesis){
    // An irregular lowered center connects to the condensation body. The
    // surrounding cloud stays separate from the assumed surface circulation.
    height=2.83-.20*exp(-dot(q,q)/.85)+.10*billow+.045*sin(6.2*q.y+3.1*q.x-.24*t);
    thickness=.19+.04*cos(4.1*q.x-2.8*q.y+.14*t);
  }
  float vertical=exp(-pow((p.y-height)/thickness,2.0));
  float edge=2.28+.22*sin(1.8*q.x+.7*q.y-.09*t)+.16*cos(2.2*q.y-1.1*q.x+.07*t);
  float rim=1.0-smoothstep(edge-.55,edge+.25,r);
  float texture=.55+.25*billow+.15*sin(5.1*q.y+2.4*q.x-.27*t);
  if(genesis)texture=worldLighting?.30+.35*materialNoise(vec3(q.x*2.8,p.y*3.2-.08*t,q.y*2.8))+.10*billow:
    .46+.16*billow+.15*sin(7.1*q.x+3.8*q.y-.29*t)*cos(5.3*q.y-2.1*q.x+.19*t);
  float cutoff=smoothstep(2.05,2.22,p.y)*(1.0-smoothstep(3.25,3.5,p.y))*(1.0-smoothstep(2.6,2.8,r));
  return vertical*rim*max(.12,texture)*cutoff;
}
float dustDensity(vec3 p,float t){
#if STORM_SCENE
  return stormDust(p,t);
#endif
#if REFERENCE_FORM
  return referenceDust(p,t);
#endif
  if(p.y<0.0||p.y>.45)return 0.0;
  vec2 q=p.xz-vec2(.08*sin(.31*t),.10*cos(.27*t));
  float width=.26+1.2*p.y;
  float plume=exp(-dot(q,q)/(width*width))*exp(-p.y*8.0);
  float skirt=exp(-dot(q,q)/.65)*exp(-p.y*22.0);
  float patches=.65+.25*sin(6.0*q.x+3.0*q.y-.7*t)*cos(5.0*q.y-.4*t);
  return (plume*.7+skirt*.4)*patches*(1.0-smoothstep(.9,1.3,length(q)));
}
`;

export const funnelVolumeVertex=`#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;

export const funnelVolumeFragment=`#version 300 es
precision highp float;
precision highp int;
uniform mat4 inverseCamera;
uniform vec4 viewportBox;
uniform vec3 shape;
uniform float time;
uniform float extent;
uniform int readingPalette;
uniform bool dust;
uniform bool genesis;
uniform float formationProgress;
uniform vec4 formationState;
uniform bool worldLighting;
uniform bool surfacePass;
${FUNNEL_DENSITY_GLSL}
${FUNNEL_LIGHTING_GLSL}
out vec4 outputColor;
vec2 intersectBox(vec3 origin,vec3 ray,float clipLength,vec3 lower,vec3 upper){
  vec3 safeRay=vec3(abs(ray.x)<.000001?(ray.x<0.0?-.000001:.000001):ray.x,abs(ray.y)<.000001?(ray.y<0.0?-.000001:.000001):ray.y,abs(ray.z)<.000001?(ray.z<0.0?-.000001:.000001):ray.z);
  vec3 nearT=(lower-origin)/safeRay,farT=(upper-origin)/safeRay;
  vec3 lo=min(nearT,farT),hi=max(nearT,farT);
  return vec2(max(0.0,max(lo.x,max(lo.y,lo.z))),min(clipLength,min(hi.x,min(hi.y,hi.z))));
}
vec4 integrateRegion(vec3 origin,vec3 ray,vec2 interval,bool cloudRegion,int samples){
  if(interval.y<=interval.x||samples<=0)return vec4(0.0);
  float stepLength=(interval.y-interval.x)/float(samples);
  vec4 accumulated=vec4(0.0);
  for(int i=0;i<48;i++){
    if(i>=samples)break;
    float position=interval.x+(float(i)+.5)*stepLength;
#if STORM_SCENE
    if(cloudRegion){
      float u0=float(i)/float(samples),u1=float(i+1)/float(samples);
      float a=u0*u0,b=u1*u1;
      stepLength=(interval.y-interval.x)*(b-a);
      position=interval.x+(interval.y-interval.x)*.5*(a+b);
    }
#endif
    vec3 p=origin+ray*position;
#if STORM_SCENE
    stormSample(p,ray,time,stepLength);
#endif
    float body=cloudRegion?0.0:condensationDensity(p,shape,time,extent);
    // Inside the shared segment, sample both fields at the same depth. Sorting
    // whole overlapping volumes by their box entry creates an artificial seam.
    float cloud=cloudBaseDensity(p,time);
    float haze=!cloudRegion&&dust?dustDensity(p,time)*(genesis?formationState.z:1.0):0.0;
    float density=body+cloud*.6+haze*.5;
    if(density<.002)continue;
    float h=clamp(p.y/2.6,0.0,1.0);
    vec2 radial=p.xz-funnelCenter(h,shape,time);
    float side=clamp(.5+.5*dot(normalize(vec3(radial.x,.15,radial.y)),normalize(vec3(-.7,.5,.5))),0.0,1.0);
    float theta=length(radial)>.00001?atan(radial.y,radial.x):0.0;
    float angular=smoothstep(0.0,.25*max(.01,funnelRadius(h,shape,time)),length(radial));
    float strands=angular*(.13*sin(3.0*(theta-.65*time)+12.0*(h-.095*time))+.08*cos(5.0*(theta-.65*time)+21.6*(h-.095*time)));
    float cloudRelief=.19*sin(2.1*p.x-.13*time)*cos(2.6*p.z+.09*time)+.12*sin(3.7*p.z+1.2*p.x-.18*time);
    float relief=(body*strands+cloud*cloudRelief)/max(.01,body+cloud);
    float broadLight=clamp(.32+.48*side+relief,0.0,1.0);
    if(genesis)broadLight=clamp(.18+.57*side+relief*.75-.14*body,0.0,1.0);
    float value=readingPalette==1?mix(.19,.52,broadLight):mix(.34,.83,broadLight);
    if(genesis)value=readingPalette==1?mix(.15,.48,broadLight):mix(.25,.77,broadLight);
    // A soft side-light cue supplies depth without a calibrated sun or photometry.
    vec3 tint=readingPalette>0?vec3(value):vec3(value*.94,value,value*.97);
    if(worldLighting)tint=worldMaterial(p,density);
#if STORM_SCENE
    tint=mix(tint,vec3(.45,.39,.29),.80*haze/max(.001,body+cloud+haze));
    // The far local medium and its analytic tail share a radiance limit.
    // This changes color resolution with distance, without added fog opacity.
    tint=mix(tint,STORM_FAR_RADIANCE,smoothstep(18.0,45.0,length(p-origin)));
#endif
    float alpha=1.0-exp(-density*stepLength*3.6);
    accumulated.rgb+=(1.0-accumulated.a)*alpha*tint;
    accumulated.a+=(1.0-accumulated.a)*alpha;
    if(accumulated.a>.985)break;
  }
  return accumulated;
}
void main(){
  vec2 ndc=(gl_FragCoord.xy-viewportBox.xy)/viewportBox.zw*2.0-1.0;
  vec4 a=inverseCamera*vec4(ndc,-1.0,1.0),b=inverseCamera*vec4(ndc,1.0,1.0);
  vec3 origin=a.xyz/a.w,segment=b.xyz/b.w-origin,ray=normalize(segment);
  if(surfacePass){
    if(!worldLighting)discard;
#if STORM_SCENE
#if STORM_SCENE >= 2
    // Evaluate derivatives before the sky/ground branch. Every fragment in a
    // quad participates, including sky rays beside the horizon.
    vec3 filterPoint=origin+ray*(-origin.y/min(-.00001,ray.y));
    vec2 groundFilter=max(fwidth((mat2(.94,.34,-.34,.94)*filterPoint.xz)/vec2(1.8,2.4)),vec2(.008));
#endif
    vec3 skyColor=stormDistantSky(origin,ray,length(segment));
    if(ray.y>=-.00001){outputColor=vec4(skyColor,1.0);return;}
    float groundDistance=-origin.y/ray.y;
    // Opaque ground is an analytic forward boundary. The local volume's far
    // clip must not replace more distant ground with a visible strip of sky.
    if(groundDistance<0.0){outputColor=vec4(skyColor,1.0);return;}
    vec3 groundPoint=origin+ray*groundDistance;
    float groundLight=nearbyTransmission(groundPoint+vec3(0,.01,0),worldLight());
    float grain=.008*(materialNoise(groundPoint*1.5)-.5);
    vec3 groundColor=vec3(.19,.22,.18)*(.72+.28*groundLight)+grain;
#if STORM_SCENE >= 2
    // Illustrative parcels supply perspective scale, not historical geography.
    // Reuse the existing ground texture sample; this adds no texture probe.
    vec2 field=mat2(.94,.34,-.34,.94)*groundPoint.xz+vec2(.18,-.12)*(grain/.008);
    vec2 cell=floor(field/vec2(1.8,2.4));
    float parcelValue=materialCell(ivec3(int(cell.x),0,int(cell.y)));
    vec2 edge=min(fract(field/vec2(1.8,2.4)),1.0-fract(field/vec2(1.8,2.4)));
    vec2 filterWidth=groundFilter;
    float interior=smoothstep(0.0,filterWidth.x*1.2,edge.x)*smoothstep(0.0,filterWidth.y*1.2,edge.y);
    vec3 terrain=mix(vec3(.17,.205,.135),vec3(.235,.215,.16),parcelValue);
    groundColor=terrain*(.72+.28*groundLight)*mix(.84,1.0,interior)+grain;
#endif
    outputColor=vec4(mix(skyColor,groundColor,exp(-.0007*dot(groundPoint.xz,groundPoint.xz))),1.0);return;
#else
    float sky=readingPalette==1?.95-.035*exp(-max(0.0,ray.y)*7.0):.035+.035*exp(-max(0.0,ray.y)*7.0);
    if(ray.y>=-.00001){
      outputColor=vec4(vec3(sky),.92);return;
    }
    float distance=-origin.y/ray.y;
    if(distance<0.0||distance>length(segment)){outputColor=vec4(vec3(sky),.92);return;}
    vec3 point=origin+ray*distance;
    float reach=exp(-.012*dot(point.xz,point.xz));
    float shadow=nearbyTransmission(point+vec3(0,.01,0),worldLight());
    float grain=.006*(materialNoise(point*1.5)-.5);
    float value=readingPalette==1?.85-.16*(1.0-shadow)+grain:.10-.045*(1.0-shadow)+grain*.4;
    outputColor=vec4(vec3(mix(sky,value,reach)),.92);return;
#endif
  }
  // Separate bounds keep the thin body sampled independently of the wide cloud.
  float radius=max(dust?1.45:.05,1.31*(shape.x+shape.y*1.06)+1.04*abs(shape.z)+.08);
#if REFERENCE_FORM
  radius=2.75;
#endif
#if STORM_SCENE
  radius=3.3;
#endif
  vec2 bodyRange=intersectBox(origin,ray,length(segment),vec3(-radius,0.0,-radius),vec3(radius,2.71,radius));
  vec2 cloudOffset=vec2(.12*sin(.11*time),.12*cos(.09*time));
  vec2 cloudRange=intersectBox(origin,ray,length(segment),vec3(cloudOffset.x-2.8,2.05,cloudOffset.y-2.8),vec3(cloudOffset.x+2.8,3.5,cloudOffset.y+2.8));
#if STORM_SCENE
  // Clip only vertically and at the existing camera's far segment. Perspective
  // far depth is not radial distance, so an arbitrary wide box can still bind.
  if(ray.y==0.0){
    cloudRange=origin.y>=1.8&&origin.y<=5.6?vec2(0.0,length(segment)):vec2(1.0,0.0);
  }else{
    float lower=(1.8-origin.y)/ray.y,upper=(5.6-origin.y)/ray.y;
    cloudRange=vec2(max(0.0,min(lower,upper)),min(length(segment),max(lower,upper)));
  }
#endif
#if STORM_SCENE >= 3
  const int exteriorCloudSamples=32;
#else
  const int exteriorCloudSamples=16;
#endif
  vec4 combined;
  if(bodyRange.y<=bodyRange.x){
    combined=integrateRegion(origin,ray,cloudRange,true,exteriorCloudSamples);
  }else{
    // Keep 48 shared body samples and the versioned exterior budget. Split
    // the cloud at the body interval so composition always follows ray depth.
    vec2 before=vec2(cloudRange.x,min(cloudRange.y,bodyRange.x));
    vec2 after=vec2(max(cloudRange.x,bodyRange.y),cloudRange.y);
    float frontLength=max(0.0,before.y-before.x),backLength=max(0.0,after.y-after.x);
    int frontSamples=frontLength<=0.0?0:backLength<=0.0?exteriorCloudSamples:int(clamp(floor(float(exteriorCloudSamples)*frontLength/(frontLength+backLength)),1.0,float(exteriorCloudSamples-1)));
    int backSamples=backLength<=0.0?0:exteriorCloudSamples-frontSamples;
    vec4 front=integrateRegion(origin,ray,before,true,frontSamples);
    vec4 body=integrateRegion(origin,ray,bodyRange,false,48);
    vec4 back=integrateRegion(origin,ray,after,true,backSamples);
    combined=front+(1.0-front.a)*(body+(1.0-body.a)*back);
  }
  if(combined.a<.002)discard;
  outputColor=vec4(combined.rgb/combined.a,combined.a);
}`;
