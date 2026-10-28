// A broad authored presentation informed by visible documentary features.
// No source clock, camera, physical scale or hidden silhouette is assigned.
export const REFERENCE_FORM=Object.freeze({id:'reference-v1',noisePeriod:32,bodyBound:2.75,cloudBound:2.8});

const smooth=value=>value*value*(3-2*value);
function cell(x,y,z){
  const wrap=value=>((value%32)+32)%32;
  let value=(Math.imul(wrap(x)+4096,1664525)+Math.imul(wrap(y)+4096,1013904223)+Math.imul(wrap(z)+4096,69069)+20130531)>>>0;
  value^=value>>>13;value=Math.imul(value,1274126177);value^=value>>>16;
  return (value&65535)/65535;
}
export function referenceNoiseAt(x,y,z){
  if(![x,y,z].every(v=>Number.isFinite(v)&&Math.abs(v)<=1e6))throw new RangeError('Reference coordinates exceed their finite study domain');
  const a=[x,y,z].map(Math.floor),u=[x,y,z].map((v,i)=>smooth(v-a[i]));
  let value=0;
  for(let k=0;k<2;k++)for(let j=0;j<2;j++)for(let i=0;i<2;i++)value+=cell(a[0]+i,a[1]+j,a[2]+k)*(i?u[0]:1-u[0])*(j?u[1]:1-u[1])*(k?u[2]:1-u[2]);
  return value;
}

// One periodic lattice, quantized to normalized R8. Trilinear interpolation of
// the cubic coordinates bounds value error by 0.5/255 before GPU precision.
export function referenceNoiseLattice(){
  const values=new Uint8Array(32*32*32);
  for(let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=0;x<32;x++)values[x+32*(y+32*z)]=Math.round(cell(x,y,z)*255);
  return values;
}

export const REFERENCE_FIELD_GLSL=`
#if REFERENCE_FORM
uniform highp sampler3D referenceNoiseTexture;
float referenceNoise(vec3 p){
  vec3 c=floor(p),u=fract(p);u=u*u*(3.0-2.0*u);
  return texture(referenceNoiseTexture,(mod(c,32.0)+u+.5)/32.0).r;
}
vec2 referenceAxis(float h,vec3 s,float t){
  return vec2(.09*h+.11*h*(1.0-h)*sin(.21*t)+.55*s.z*h*h,
    -.10*h+.13*h*(1.0-h)*cos(.17*t));
}
vec2 referenceSection(float h,float t){return vec2(1.10+.06*sin(2.0*h-.13*t),.88+.05*cos(2.7*h+.11*t));}
float referenceRadius(float h,vec3 s){return .62+.95*s.x+.24*smoothstep(.05,.95,h)+.10*h;}
float referenceBody(vec3 p,vec3 s,float t,float ex){
  float h=p.y/2.6;
  if(ex<=0.0||h<0.0||h>1.04)return 0.0;
  vec2 q=(p.xz-referenceAxis(h,s,t))/referenceSection(h,t);
  float radius=referenceRadius(h,s),r=length(q);
  // Keep the full lobe/noise support before applying the graded radial edge.
  if(r>radius*1.50+.08)return 0.0;
  float angle=r>.00001?atan(q.y,q.x):0.0;
  float lobes=1.0+.12*sin(2.0*angle+.7*h-.18*t)+.06*cos(3.0*angle-1.2*h+.11*t);
  vec2 moving=mat2(cos(.38*t),-sin(.38*t),sin(.38*t),cos(.38*t))*q;
  float n=referenceNoise(vec3(moving.x*3.9,9.0*h-.68*t,moving.y*3.9));
  float relative=r/(radius*lobes*(.96+.12*n));
  float fine=referenceNoise(vec3(moving.x*8.3,19.0*h-1.44*t,moving.y*8.3));
  float graded=1.0-smoothstep(.52,1.08,relative);
  float onset=smoothstep(.16,.40,formationProgress+.065*(n-.5));
  float clearing=1.0-smoothstep(.73,.97,formationProgress+.08*(.5-n));
  float erosion=1.0-formationState.y*smoothstep(.22,.78,n);
  float ends=smoothstep(1.0-ex-.02,1.0-ex+.045,h)*(1.0-smoothstep(.96,1.04,h));
  return .62*graded*(.24+.64*n+.25*fine)*onset*clearing*erosion*ends*formationState.x;
}
float referenceCloudHeight(vec2 q,float t){
  vec2 a=q-vec2(-.30+.08*sin(.10*t),.12),b=q-vec2(.72,-.38);
  return 2.91-.33*exp(-a.x*a.x/.95-a.y*a.y/1.25)-.20*exp(-b.x*b.x/.50-b.y*b.y/.90)
    +.09*sin(1.4*q.x+1.1*q.y-.12*t)
    +.22*(referenceNoise(vec3(q.x*2.2,7.0-.12*t,q.y*2.2))-.5);
}
float referenceCloud(vec3 p,float t){
  vec2 q=p.xz-vec2(.12*sin(.11*t),.12*cos(.09*t));
  float r=length(q);
  if(r>2.8||p.y<2.05||p.y>3.5)return 0.0;
  float height=referenceCloudHeight(q,t),thickness=.34+.075*sin(1.8*q.x-.9*q.y+.10*t);
  float vertical=exp(-pow((p.y-height)/thickness,2.0));
  float elliptical=length(q/vec2(1.10,.88));
  float edge=2.28+.13*sin(1.7*q.x+.8*q.y-.09*t);
  float rim=1.0-smoothstep(edge-.60,edge+.32,elliptical);
  float n=referenceNoise(vec3(q.x*2.4,p.y*3.8-.12*t,q.y*2.4));
  float fine=referenceNoise(vec3(q.x*5.1,p.y*8.1-.26*t,q.y*5.1));
  float cutoff=smoothstep(2.05,2.20,p.y)*(1.0-smoothstep(3.25,3.5,p.y))*(1.0-smoothstep(2.6,2.8,r));
  return vertical*rim*(.23+.48*n+.27*fine)*cutoff;
}
float referenceDust(vec3 p,float t){
  if(p.y<0.0||p.y>.40)return 0.0;
  vec2 q=p.xz-vec2(.07*sin(.31*t),.09*cos(.27*t));
  float n=referenceNoise(vec3(q.x*3.3,p.y*9.0-.32*t,q.y*3.3));
  float r=length(q),sector=.55+.30*sin(2.4*q.x-1.2*q.y-.24*t);
  float low=exp(-dot(q,q)/.95-p.y*15.0),lift=exp(-dot(q,q)/.26-p.y*7.0);
  return (.20*low+.12*lift)*sector*(.25+.75*n)*(1.0-smoothstep(.95,1.45,r));
}
#endif
`;
