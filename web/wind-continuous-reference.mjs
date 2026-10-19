// Continuous reference for the stated Rankine idealization, not observed wind or damage.
// Inputs use SI units: m/s, m, m², kg/m³ and N. Offset and extent are multiples of R.
// Geometry is derived directly from a straight path through a finite annulus.
export function continuousRankineReference(field,{threshold,capacity,extent=6}={}){
  if(!field||typeof field!=='object')throw new RangeError('Reference settings are required');
  const {peak,radius,background,travel,offset,area,coefficient,density=1.225}=field;
  if(![peak,radius,background,travel,offset,area,coefficient,density,threshold,capacity,extent].every(Number.isFinite)||peak<0||radius<=0||background<0||travel<=0||area<=0||coefficient<0||density<=0||threshold<0||capacity<=0||extent<=0)throw new RangeError('Invalid continuous reference parameters');
  if(background!==0)return {status:'unavailable',reason:'nonzero-background'};

  const timeScale=radius/travel,halfTime=extent*timeScale,windowDuration=2*halfTime;
  const nearest=Math.abs(offset),farthest=Math.hypot(extent,nearest);
  // Speed grows linearly up to R, then decays inversely. A clipped window
  // need not reach R, so its continuous maximum need not equal the chosen peak.
  const maximumFactor=nearest>1?1/nearest:farthest<1?farthest:1;
  const maximumSpeed=peak*maximumFactor;
  const maximumDrag=.5*density*maximumSpeed**2*area*coefficient;
  const corePeakDrag=.5*density*peak**2*area*coefficient;
  if(![timeScale,halfTime,windowDuration,farthest,maximumSpeed,maximumDrag,corePeakDrag].every(Number.isFinite)||timeScale<=0||halfTime<=0||windowDuration<=0||(peak>0&&coefficient>0&&(maximumDrag===0||corePeakDrag===0)))throw new RangeError('Continuous reference exceeds representable range');

  function halfWidth(radialBoundary){
    if(radialBoundary<=nearest)return 0;
    if(radialBoundary>=farthest)return extent;
    if(nearest===0)return radialBoundary;
    // Scale the second factor so adding two large finite radii cannot overflow.
    const width=Math.sqrt(radialBoundary-nearest)*Math.sqrt(radialBoundary)*Math.sqrt(1+nearest/radialBoundary);
    if(!Number.isFinite(width))throw new RangeError('Continuous width exceeds representable range');
    return Math.min(extent,width);
  }
  function durationForRatio(ratio){
    if(ratio===0)return windowDuration;
    if(ratio>1)return 0;
    const outer=halfWidth(1/ratio),inner=halfWidth(ratio);
    return 2*timeScale*Math.max(0,outer-inner);
  }
  let comparisonDuration=threshold===0?windowDuration:0;
  if(threshold>0&&peak>0&&threshold<=maximumSpeed){
    const ratio=threshold/peak;
    if(ratio===0)throw new RangeError('Continuous comparison ratio is below representable range');
    comparisonDuration=durationForRatio(ratio);
  }
  // This status is strict and unrounded. Equality cannot mark a component failed.
  const capacityExceeded=maximumDrag>capacity;
  let capacityExceedanceDuration=0;
  if(capacityExceeded){
    const forceRatio=capacity/corePeakDrag;
    if(forceRatio===0)throw new RangeError('Continuous capacity ratio is below representable range');
    capacityExceedanceDuration=durationForRatio(Math.sqrt(forceRatio));
  }
  if(![comparisonDuration,capacityExceedanceDuration].every(value=>Number.isFinite(value)&&value>=0&&value<=windowDuration))throw new RangeError('Continuous duration exceeds representable range');
  return {status:'available',halfTime,maximumSpeed,maximumDrag,comparisonDuration,capacityExceeded,capacityExceedanceDuration};
}
