// Versioned optical illustration. Coefficients and distances are authored,
// without measured droplets, physical length, sunlight or historical exposure.
export const FUNNEL_LIGHTING=Object.freeze({id:'world-v1',probes:2,extinction:3.6,
  direction:Object.freeze([-.65,.72,.42]),offsets:Object.freeze([.10,.42]),
  lengths:Object.freeze([.20,.44]),ambient:.24});

export function opticalTransmission(densities,lengths,extinction=FUNNEL_LIGHTING.extinction){
  if(!Array.isArray(densities)||!Array.isArray(lengths)||densities.length!==lengths.length||densities.length>2||
    !Number.isFinite(extinction)||extinction<0||
    ![...densities,...lengths].every(x=>Number.isFinite(x)&&x>=0))throw new RangeError('Expected up to two nonnegative optical segments');
  if(extinction===0)return 1;
  const depth=densities.reduce((sum,density,index)=>sum+density*lengths[index]*extinction,0);
  return Math.exp(-depth);
}

// Two fixed probes retain a bounded local optical approximation. Earlier
// presentations use a coarse proxy; storm-v1 uses filtered shared material.
// Both omit distant shadow transport and calibrated scattering.
export const FUNNEL_LIGHTING_GLSL=`
vec3 worldLight(){return normalize(vec3(-.65,.72,.42));}
float sceneDensity(vec3 p){
#if STORM_SCENE
  if(p.y<0.0||p.y>5.6)return 0.0;
  // The same two light probes now see filtered samples of the shared material.
  stormSample(p,worldLight(),time,.22);
  float body=stormBody(p,shape,time,extent),cloud=stormCloud(p,time);
  float haze=dust?stormDust(p,time)*formationState.z:0.0;
  return max(0.0,body+.6*cloud+.5*haze);
#else
  if(p.y<0.0||p.y>3.5)return 0.0;
  float rawHeight=p.y/2.6,h=clamp(rawHeight,0.0,1.0),body=0.0;
  if(p.y<=2.71&&extent>0.0){
    vec2 radial=p.xz-funnelCenter(h,shape,time);
    float radius=max(.02,shape.x+shape.y*pow(h,1.7));
#if REFERENCE_FORM
    radial/=referenceSection(h,time);
    radius=referenceRadius(h,shape);
#endif
    body=(1.0-smoothstep(.65*radius,1.10*radius,length(radial)))
      *smoothstep(1.0-extent-.02,1.0-extent+.045,rawHeight)*(1.0-smoothstep(.96,1.04,rawHeight))
      *(genesis?formationState.x*(1.0-.6*formationState.y):1.0);
  }
  vec2 q=p.xz-vec2(.12*sin(.11*time),.12*cos(.09*time));
  float cloud=0.0;
  if(p.y>2.05){
    float radius=length(q)*(genesis?1.18:1.0);
    float height=2.83-.20*exp(-dot(q,q)/.85),thickness=.24;
#if REFERENCE_FORM
    height=referenceCloudHeight(q,time);thickness=.38;
    radius=length(q/vec2(1.10,.88));
#endif
    cloud=.35*exp(-pow((p.y-height)/thickness,2.0))*(1.0-smoothstep(1.8,2.55,radius));
  }
  float haze=0.0;
  if(dust&&p.y<.45)haze=.45*exp(-dot(p.xz,p.xz)/.28-p.y*12.0)*(genesis?formationState.z:1.0);
  return max(0.0,body+.6*cloud+.5*haze);
#endif
}
float nearbyTransmission(vec3 p,vec3 direction){
  float depth=.20*sceneDensity(p+.10*direction)+.44*sceneDensity(p+.42*direction);
  return exp(-3.6*max(0.0,depth));
}
vec3 worldMaterial(vec3 p,float localDensity){
#if STORM_SCENE
  vec3 primaryPoint=stormMaterialPoint,primarySpan=stormSampleSpan;
  float fixedLight=.28+.72*nearbyTransmission(p,worldLight())*exp(-.70*max(0.0,localDensity));
  stormMaterialPoint=primaryPoint;stormSampleSpan=primarySpan;
  return mix(vec3(.14,.16,.17),vec3(.64,.66,.65),fixedLight);
#endif
  // The existing primary sample supplies a short authored local extinction cue.
  // It adds no density probe and is not calibrated microphysical scattering.
  float illumination=.24+.76*nearbyTransmission(p,worldLight())*exp(-.72*max(0.0,localDensity));
#if REFERENCE_FORM
  illumination=.32+.68*nearbyTransmission(p,worldLight())*exp(-.18*max(0.0,localDensity));
#endif
  float value=readingPalette==1?mix(.12,.61,illumination):mix(.12,.84,illumination);
  return readingPalette>0?vec3(value):vec3(value*.95,value,value*.98);
}
`;
