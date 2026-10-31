// A reduced authored scene, not an atmospheric or historical reconstruction.
// Lengths are scene units and time is the existing authored study second.
export const STORM_SCENE=Object.freeze({id:'storm-v1',inflow:.018,rotation:.24,core:.95,lift:.08,
  verticalStrain:.036,cloudLower:1.8,cloudUpper:5.6,tailDensity:1124893/6075000,
  tailProfile:Object.freeze([2.84,3.58,4.9,5.6]),horizonRadiance:Object.freeze([.48,.51,.52])});

// The new presentation keeps the same flow and schedule. Constant pullback
// factors are evaluated once per draw instead of inside every density probe.
export function stormTransportParameters(seconds){
  if(!Number.isFinite(seconds)||seconds<0||seconds>30)throw new RangeError('Storm presentation requires zero through thirty authored seconds');
  const vertical=Math.exp(-STORM_SCENE.verticalStrain*seconds);
  return new Float32Array([vertical,Math.exp(STORM_SCENE.inflow*seconds),
    STORM_SCENE.lift/STORM_SCENE.verticalStrain*(vertical-1),0]);
}


// The local cloud lowering follows the declared upper-body ellipse. It carries
// no measured cloud base, camera calibration or physical length.
export function stormAttachmentParameters(shape,seconds){
  if(!shape||!Number.isFinite(shape.base)||shape.base<.02||shape.base>1.6||!Number.isFinite(shape.bend)||Math.abs(shape.bend)>.7||!Number.isFinite(seconds)||seconds<0||seconds>30)throw new RangeError('Invalid storm attachment frame');
  const radius=1.24*(.96+.95*shape.base);
  return new Float32Array([.09+.55*shape.bend,-.10,
    radius*(1.10+.06*Math.sin(2-.13*seconds)),radius*(.88+.05*Math.cos(2.7+.11*seconds))]);
}
function pointInDomain(point,seconds){
  if(!Array.isArray(point)||point.length!==3||!point.every(v=>Number.isFinite(v)&&Math.abs(v)<=1024)||
    !Number.isFinite(seconds)||Math.abs(seconds)>30)throw new RangeError('Storm transport requires a finite scene point and at most thirty authored seconds');
}

// Exact characteristics of radial inflow, bounded differential rotation and
// vertical strain. The velocity has zero divergence; visible density is still
// authored and is not conserved moisture, debris mass or a solved pressure field.
export function stormAdvect(point,seconds){
  pointInDomain(point,seconds);
  const {inflow:a,rotation:omega,core,lift,verticalStrain:b}=STORM_SCENE;
  const [x,y,z]=point,s=(x*x+z*z)/(core*core),e=Math.exp(2*a*seconds);
  const angle=omega/(2*a)*Math.log((e+s)/(1+s)),scale=Math.exp(-a*seconds);
  const c=Math.cos(angle),v=Math.sin(angle);
  return [scale*(c*x-v*z),(y+lift/b)*Math.exp(b*seconds)-lift/b,scale*(v*x+c*z)];
}
export function stormCoordinates(point,seconds){return stormAdvect(point,-seconds);}
export function stormVelocity(point){
  pointInDomain(point,0);
  const [x,y,z]=point,{inflow:a,rotation,core,lift,verticalStrain:b}=STORM_SCENE;
  const omega=rotation/(1+(x*x+z*z)/(core*core));
  return [-a*x-omega*z,lift+b*y,omega*x-a*z];
}
export function stormFlow(seconds,strength){
  if(!Number.isFinite(seconds)||seconds<0||seconds>30||!Number.isFinite(strength)||strength<0||strength>1)throw new RangeError('Invalid storm circulation cue');
  const lines=[];
  for(let ring=0;ring<2;ring++)for(let i=0;i<12;i++){
    const angle=i*Math.PI/6+seconds*.20,r=.65+ring*.55,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
    const [vx,,vz]=stormVelocity([x,.025,z]),scale=.15/Math.hypot(vx,vz),dx=vx*scale,dz=vz*scale,y=.025;
    lines.push(x,y,z,x+dx,y,z+dz,x+dx,y,z+dz,x+dx*.6+dz*.3,y,z+dz*.6-dx*.3,x+dx,y,z+dz,x+dx*.6-dz*.3,y,z+dz*.6+dx*.3);
  }
  return new Float32Array(lines);
}

export const STORM_FIELD_GLSL=`
#if STORM_SCENE
const vec3 STORM_FAR_RADIANCE=vec3(.48,.51,.52);
#if STORM_SCENE >= 2
uniform vec4 stormPullback;
#endif
#if STORM_SCENE >= 3
uniform vec4 stormAttachment;
#endif
vec3 stormMaterialPoint;
vec3 stormSampleSpan;
void stormSample(vec3 p,vec3 ray,float t,float span){
  float dt=-t,a=.018,b=.036,r2=dot(p.xz,p.xz)/(.95*.95);
#if STORM_SCENE >= 2
  float e=stormPullback.x,scale=stormPullback.y;
#else
  float e=exp(2.0*a*dt),scale=exp(-a*dt);
#endif
  float angle=.24/(2.0*a)*log((e+r2)/(1.0+r2));
  // Native trigonometric approximations need not preserve unit length.
  // Keep rotation separate from the declared radial strain in both maps.
  vec2 rotation=normalize(vec2(cos(angle),sin(angle)));
  float c=rotation.x,s=rotation.y;
  mat2 turn=mat2(c,s,-s,c);
  vec2 q=scale*turn*p.xz;
  // One fixed orthonormal texture basis follows the common material pullback.
  mat3 basis=mat3(.8,.6,0,-.36,.48,.8,.48,-.64,.6);
#if STORM_SCENE >= 2
  stormMaterialPoint=basis*vec3(q.x,p.y*stormPullback.x+stormPullback.z,q.y);
#else
  stormMaterialPoint=basis*vec3(q.x,(p.y+.08/b)*exp(b*dt)-.08/b,q.y);
#endif
  // Directional derivative of that same analytic map along this ray bin.
  float angularSlope=.24/a*dot(p.xz,ray.xz)/(.95*.95)*(1.0/(e+r2)-1.0/(1.0+r2));
  vec2 tangent=scale*turn*ray.xz+vec2(-q.y,q.x)*angularSlope;
#if STORM_SCENE >= 2
  stormSampleSpan=abs(basis*vec3(tangent.x,stormPullback.x*ray.y,tangent.y))*span;
#else
  stormSampleSpan=abs(basis*vec3(tangent.x,exp(b*dt)*ray.y,tangent.y))*span;
#endif
}
float stormNoise(vec3 frequency,vec3 offset){
  float footprint=length(stormSampleSpan*frequency);
  return mix(referenceNoise(stormMaterialPoint*frequency+offset),.5,smoothstep(.6,1.6,footprint));
}
float stormCloudHeight(vec2 q){
  vec2 local=q/vec2(1.55,1.25);
#if STORM_SCENE >= 2
  float broad=stormNoise(vec3(.34,.42,.34),vec3(0));
  float folded=stormNoise(vec3(.92,.58,.92),vec3(5.2,1.1,8.4));
#else
  float broad=stormNoise(vec3(.60,.75,.60),vec3(0));
  float folded=stormNoise(vec3(1.35,.65,1.35),vec3(5.2,1.1,8.4));
#endif
  float base=3.10-.70*exp(-dot(local,local))+.64*(broad-.5)+.28*(folded-.5);
#if STORM_SCENE >= 3
  // A local cloud-base ceiling meets the existing upper condensation support.
  // Reuse the same material inputs and keep the outer cloud/tail unchanged.
  vec2 upper=(q-stormAttachment.xy)/stormAttachment.zw;
  float attachment=1.0-smoothstep(1.0,1.8,length(upper));
  float ceiling=1.98+.04*(broad-.5)+.02*(folded-.5);
  base=mix(base,min(base,ceiling),attachment);
#endif
  return base;
}
float stormBody(vec3 p,vec3 shape,float t,float ex){
  float h=p.y/2.6;
  if(ex<=0.0||h<0.0||h>1.04)return 0.0;
  vec2 q=(p.xz-referenceAxis(h,shape,t))/referenceSection(h,t);
  float radius=referenceRadius(h,shape)*(.64+.56*h*h),r=length(q);
#if STORM_SCENE >= 2
  radius=referenceRadius(h,shape)*(.82+.42*h*h);
#endif
  if(r>radius*1.45+.08)return 0.0;
  vec3 w=stormMaterialPoint;
#if STORM_SCENE >= 2
  float bulk=stormNoise(vec3(2.2,2.6,2.2),vec3(0));
  float detail=stormNoise(vec3(5.8,6.4,5.8),vec3(3.1,7.7,2.4));
#else
  float bulk=stormNoise(vec3(3.4,4.2,3.4),vec3(0));
  float detail=stormNoise(vec3(8.1,9.2,8.1),vec3(3.1,7.7,2.4));
#endif
  float theta=atan(w.z+.000001,w.x+.000001);
  float lobe=1.0+.14*sin(2.0*theta+.9*h)+.12*(bulk-.5);
  float relative=r/(radius*lobe),edge=mix(.18,.09,smoothstep(.25,.72,bulk));
#if STORM_SCENE >= 2
  edge=mix(.14,.055,smoothstep(.25,.72,bulk));
#endif
  float envelope=1.0-smoothstep(.94-edge,1.02+edge,relative);
  float mixed=.12+.85*smoothstep(.28,.74,bulk)+.26*detail;
  float onset=smoothstep(.16,.40,formationProgress+.065*(bulk-.5));
  float clearing=1.0-smoothstep(.73,.97,formationProgress+.08*(.5-bulk));
  float erosion=1.0-formationState.y*smoothstep(.22,.78,bulk);
  float ends=smoothstep(1.0-ex-.02,1.0-ex+.045,h)*(1.0-smoothstep(.96,1.04,h));
  return .65*envelope*mixed*onset*clearing*erosion*ends*formationState.x;
}
float stormCloud(vec3 p,float t){
  if(p.y<1.8||p.y>5.6)return 0.0;
#if STORM_SCENE >= 2
  float n=stormNoise(vec3(.42,.72,.42),vec3(0));
  float detail=stormNoise(vec3(1.25,1.55,1.25),vec3(7.2,2.4,3.8));
#else
  float n=stormNoise(vec3(.75,1.1,.75),vec3(0));
  float detail=stormNoise(vec3(1.75,2.3,1.75),vec3(7.2,2.4,3.8));
#endif
  float base=stormCloudHeight(p.xz);
  float vertical=smoothstep(base-.26,base+.48,p.y)*smoothstep(1.8,1.95,p.y)*(1.0-smoothstep(4.9,5.6,p.y));
  // No radial rim. The bounded camera sees a continuing storm-base layer.
  return .44*vertical*(.06+.80*smoothstep(.25,.70,n)+.35*detail);
}

float stormDust(vec3 p,float t){
  if(p.y<0.0||p.y>.52)return 0.0;
  float r=length(p.xz);
  if(r>1.65)return 0.0;
#if STORM_SCENE >= 2
  float dustPatch=stormNoise(vec3(4.2,3.2,4.2),vec3(2.3,9.1,5.4));
#else
  float dustPatch=stormNoise(vec3(5.2,6.5,5.2),vec3(2.3,9.1,5.4));
#endif
  float low=exp(-dot(p.xz,p.xz)/.88-p.y*12.0);
  float lift=exp(-dot(p.xz,p.xz)/.38-p.y*3.5);
  float ends=(1.0-smoothstep(.34,.52,p.y))*(1.0-smoothstep(1.18,1.65,r));
  return (.95*low+1.25*lift)*smoothstep(.18,.76,dustPatch)*ends;
}
vec3 stormSky(vec3 ray){
  // Clear and cloud-filled horizontal rays meet at the same radiance limit.
  return mix(STORM_FAR_RADIANCE,vec3(.27,.31,.34),smoothstep(0.0,.75,ray.y));
}
float stormMeanCloudPrimitive(float y){
  // The far footprint filter tends to .5 and the central lowering tends to
  // zero. Integrate that same mean vertical profile, rather than the slab box.
  if(y<=2.84)return 0.0;
  if(y<3.58){
    float u=(y-2.84)/.74;
    return .74*(u*u*u-.5*u*u*u*u);
  }
  if(y<=4.9)return .37+y-3.58;
  if(y<5.6){
    float v=(y-4.9)/.7;
    return 1.69+.7*(v-v*v*v+.5*v*v*v*v);
  }
  return 2.04;
}
float stormDistantTransmission(vec3 origin,vec3 ray,float clipLength){
  // Continue only beyond the local segment, with the same filtered cloud
  // onset and upper fade. This adds no fog volume or texture/ray samples.
  float meanLength=0.0;
  if(ray.y==0.0){
    float profile=smoothstep(2.84,3.58,origin.y)*(1.0-smoothstep(4.9,5.6,origin.y));
    if(profile>0.0)meanLength=1000000.0;
  }else{
    float partial=stormMeanCloudPrimitive(origin.y+ray.y*clipLength);
    float column=ray.y>0.0?2.04-partial:partial;
    meanLength=min(1000000.0,max(0.0,column)/abs(ray.y));
  }
  // Include the .6 cloud optical weight used by the local integration.
  float meanDensity=.6*.44*(.06+.80*smoothstep(.25,.70,.5)+.35*.5);
  return exp(-3.6*meanDensity*meanLength);
}
vec3 stormDistantSky(vec3 origin,vec3 ray,float clipLength){
  float opacity=1.0-stormDistantTransmission(origin,ray,clipLength);
  return mix(stormSky(ray),STORM_FAR_RADIANCE,opacity);
}
#endif
`;
