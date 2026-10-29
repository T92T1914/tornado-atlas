// Independent profile quadrature for native shader controls. No production
// primitive or generated shader expectations are imported here.

// These nine inputs preserve the existing points, directions and clip lengths.
// The expected result follows the declared mean profile and direct quadrature.
export const retainedTailInputs = Object.freeze([
  {name:'up from y zero beyond far two',point:[0,0,0],ray:[0,1,0],clipLength:2},
  {name:'down from y six beyond far one point five',point:[0,6,0],ray:[0,-1,0],clipLength:1.5},
  {name:'up from y zero beyond far six misses',point:[0,0,0],ray:[0,1,0],clipLength:6},
  {name:'parallel inside mean profile has saturated continuation',point:[0,3,0],ray:[1,0,0],clipLength:2},
  {name:'parallel outside slab is clear',point:[0,1,0],ray:[1,0,0],clipLength:2},
  {name:'lower local support outward ray remains clear',point:[.2,1.8,-.3],ray:[1,-5e-7,0],clipLength:2},
  {name:'upper boundary tiny outward ray misses',point:[.2,5.6,-.3],ray:[1,5e-7,0],clipLength:2},
  {name:'oblique upward mean-profile column',point:[0,0,0],ray:[0,.5,Math.sqrt(.75)],clipLength:5},
  {name:'oblique downward mean-profile column',point:[2,6,-1],ray:[.6,-.8,0],clipLength:.75},
]);

export const additionalTailInputs = Object.freeze([
  {name:'default orbit eye below mean cloud is horizontally clear',
    point:[2.893681287765503,2.605381727218628,6.205519676208496],ray:[1,0,0],clipLength:60},
  {name:'mean profile lower boundary outward ray remains clear',point:[0,2.84,0],ray:[1,-5e-7,0],clipLength:2},
  {name:'lower transition half column down',point:[0,3.21,0],ray:[0,-1,0],clipLength:0},
  {name:'upper transition half column up',point:[0,5.25,0],ray:[0,1,0],clipLength:0},
  {name:'default orbit shallow upward horizon reaches shared radiance',point:[0,2.605381727218628,0],ray:[1,5e-7,0],clipLength:60},
  {name:'default orbit shallow downward horizon reaches shared radiance',point:[0,2.605381727218628,0],ray:[1,-5e-7,0],clipLength:60},
]);

const lowerStart=2.84,lowerEnd=3.58,upperStart=4.9,upperEnd=5.6;
const clamp01=value=>Math.max(0,Math.min(1,value));
const cubic=value=>value*value*(3-2*value);

export function directMeanVerticalProfile(y){
  if(!Number.isFinite(y))throw new RangeError('Finite vertical coordinate required');
  if(y<=lowerStart||y>=upperEnd)return 0;
  const rise=cubic(clamp01((y-lowerStart)/(lowerEnd-lowerStart)));
  const fall=1-cubic(clamp01((y-upperStart)/(upperEnd-upperStart)));
  return rise*fall;
}

// Composite Simpson quadrature evaluates the profile itself. It neither calls
// nor reproduces the production antiderivative. Breakpoints keep each piece
// polynomial and the fixed 64 subintervals bound the work to at most 192 bins.
export function numericalVerticalColumn(from,to){
  if(![from,to].every(Number.isFinite))throw new RangeError('Finite column endpoints required');
  const lo=Math.max(lowerStart,Math.min(from,to));
  const hi=Math.min(upperEnd,Math.max(from,to));
  if(hi<=lo)return 0;
  const boundaries=[lo,...[lowerEnd,upperStart].filter(value=>value>lo&&value<hi),hi];
  let total=0;
  for(let piece=1;piece<boundaries.length;piece++){
    const a=boundaries[piece-1],b=boundaries[piece],n=64,step=(b-a)/n;
    let sum=directMeanVerticalProfile(a)+directMeanVerticalProfile(b);
    for(let index=1;index<n;index++)sum+=(index%2===0?2:4)*directMeanVerticalProfile(a+step*index);
    total+=sum*step/3;
  }
  return total;
}

// Independent literal areas: a complete smoothstep ramp has half its width;
// the lower ramp's first half is width*(3/32), and the upper ramp's last half
// is width*(3/32). These are expectations for the quadrature, not native runs.
export const literalColumnControls = Object.freeze([
  {name:'whole vertical profile',from:2,to:6,expected:2.04},
  {name:'complete lower transition',from:2.84,to:3.58,expected:.37},
  {name:'plateau',from:3.58,to:4.9,expected:1.32},
  {name:'complete upper transition',from:4.9,to:5.6,expected:.35},
  {name:'lower transition first half',from:2.84,to:3.21,expected:.069375},
  {name:'upper transition last half',from:5.25,to:5.6,expected:.065625},
  {name:'column below mean onset',from:0,to:2.6,expected:0},
  {name:'column above upper fade',from:6,to:7,expected:0},
]);

// The declared mean coefficient reduces independently to this rational:
// smoothstep(.25,.70,.5)=425/729; local .6*.44 cloud weighting then yields
// (.6*.44)*(.06+.80*(425/729)+.35*.5)=1124893/6075000.
export const expectedMeanDensity=1124893/6075000;

// Call with the canonical nativeRow output, after its existing direction
// normalization and Math.fround transport, so GPU and CPU inspect the same ray.
export function numericalTailTransmission(row){
  const y=row.point[1],dy=row.ray[1],clip=row.clipLength;
  if(![y,dy,clip].every(Number.isFinite)||clip<0)throw new RangeError('Finite forward tail required');
  if(dy===0)return directMeanVerticalProfile(y)>0?0:1;
  const farY=y+dy*clip;
  let vertical;
  if(dy>0){
    if(farY>=upperEnd)return 1;
    vertical=numericalVerticalColumn(Math.max(farY,lowerStart),upperEnd);
  }else{
    if(farY<=lowerStart)return 1;
    vertical=numericalVerticalColumn(lowerStart,Math.min(farY,upperEnd));
  }
  return Math.exp(-3.6*expectedMeanDensity*vertical/Math.abs(dy));
}

export function numericalTailRGB(row){
  const amount=cubic(clamp01(row.ray[1]/.75));
  const horizon=[.48,.51,.52],upper=[.27,.31,.34],cloud=[.48,.51,.52];
  const transmission=numericalTailTransmission(row);
  return horizon.map((value,index)=>{
    const sky=value+(upper[index]-value)*amount;
    return sky*transmission+cloud[index]*(1-transmission);
  });
}
