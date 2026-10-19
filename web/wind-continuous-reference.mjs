// Continuous reference for the stated Rankine idealization, not observed wind or damage.
// Inputs use SI units: m/s, m, m², kg/m³ and N. Offset and extent are multiples of R.
// Geometry uses a finite annulus at zero background and piecewise path intervals otherwise.
export function continuousRankineReference(field,{threshold,capacity,extent=6}={}){
  if(!field||typeof field!=='object')throw new RangeError('Reference settings are required');
  const {peak,radius,background,travel,offset,area,coefficient,density=1.225}=field;
  if(![peak,radius,background,travel,offset,area,coefficient,density,threshold,capacity,extent].every(Number.isFinite)||peak<0||radius<=0||background<0||travel<=0||area<=0||coefficient<0||density<=0||threshold<0||capacity<=0||extent<=0)throw new RangeError('Invalid continuous reference parameters');
  if(background>0)return backgroundReference({peak,radius,background,travel,offset,area,coefficient,density},{threshold,capacity,extent});

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

// Positive background changes the radial annulus into a piecewise function of
// q=s², where s is along-track distance/R and h is the signed offset squared.
// This independent reference never reads the production passage samples.
function backgroundReference({peak,radius,background,travel,offset,area,coefficient,density},
    {threshold,capacity,extent}){
  const fail=()=>{throw new RangeError('Continuous background reference exceeds representable range');};
  const finite=value=>{if(!Number.isFinite(value))fail();return value;};
  const square=value=>{const result=finite(value*value);if(value!==0&&result===0)fail();return result;};
  const timeScale=finite(radius/travel),halfTime=finite(extent*timeScale),windowDuration=finite(2*halfTime);
  if(timeScale<=0||halfTime<=0||windowDuration<=0)fail();
  const background2=square(background),factor=coefficient===0?0:finite(.5*density*area*coefficient);
  if(coefficient>0&&factor===0)fail();
  if(peak===0){
    const maximumDrag=factor===0?0:finite(factor*background2);
    if(factor>0&&maximumDrag===0)fail();
    const capacityExceeded=maximumDrag>capacity;
    return {status:'available',halfTime,maximumSpeed:background,maximumDrag,
      comparisonDuration:threshold<=background?windowDuration:0,capacityExceeded,
      capacityExceedanceDuration:capacityExceeded?windowDuration:0};
  }
  const peak2=square(peak),h=square(offset),end=square(extent);
  finite(end+h);
  const peakOffset=finite(peak*offset),backgroundOffset=finite(background*offset);
  if(offset!==0&&(peakOffset===0||backgroundOffset===0))fail();
  const a=square(background-peakOffset),outsideBase=square(backgroundOffset-peak);
  const difference=finite(peak-finite(2*backgroundOffset)),C=finite(peak*difference);
  if(difference!==0&&C===0)fail();
  const core=1-h;
  function value(q,inside){
    if(inside){
      if(C===0&&q===core)return background2;
      const term=finite(peak2*q);if(q>0&&term===0)fail();
      return finite(a+term);
    }
    if(C===0)return background2;
    // (B²q + (B*offset-V)²)/(q+h) avoids subtracting nearly equal
    // positive and negative terms at an outside cancellation point.
    const term=finite(background2*q);if(q>0&&term===0)fail();
    const denominator=finite(q+h);if(denominator<=0)fail();
    const result=finite(finite(term+outsideBase)/denominator);
    if(term+outsideBase>0&&result===0)fail();
    return result;
  }
  const at=q=>value(q,q+h<=1);
  let maximum2=Math.max(at(0),at(end));
  if(core>0&&core<end)maximum2=Math.max(maximum2,value(core,true));
  const maximumSpeed=finite(Math.sqrt(maximum2));
  const maximumDrag=factor===0?0:finite(factor*maximum2);
  if(maximum2<=0||(factor>0&&maximumDrag===0))fail();
  const capacityExceeded=maximumDrag>capacity;
  function duration(level,strict){
    const intervals=[];
    const qualifies=v=>strict?factor*v>capacity:v>=level;
    function partition(lo,hi,inside){
      if(hi<=lo)return;
      const first=qualifies(value(lo,inside)),last=qualifies(value(hi,inside));
      if(first===last){if(first)intervals.push([lo,hi]);return;}
      const increasing=inside||C<0;
      if(first===increasing)fail();
      let crossing;
      if(inside)crossing=(level-a)/peak2;
      else{
        const delta=level-background2;
        if(delta===0||Math.sign(delta)!==Math.sign(C))fail();
        crossing=C/delta-h;
      }
      finite(crossing);
      if(crossing<lo||crossing>hi)fail();
      const interval=increasing?[crossing,hi]:[lo,crossing];
      if(strict&&interval[0]===interval[1])fail();
      intervals.push(interval);
    }
    if(core>0)partition(0,Math.min(end,core),true);
    if(end>Math.max(0,core))partition(Math.max(0,core),end,false);
    // Joining at the core boundary prevents counting it twice and gives an
    // exact full-window result when both complete partitions qualify.
    const merged=[];
    for(const interval of intervals){
      const previous=merged.at(-1);
      if(previous&&interval[0]<=previous[1])previous[1]=Math.max(previous[1],interval[1]);
      else merged.push([...interval]);
    }
    let result=0;
    for(const [lo,hi] of merged){
      if(hi===lo)continue;
      if(lo===0&&hi===end)return windowDuration;
      const width=(hi-lo)/(Math.sqrt(hi)+Math.sqrt(lo));
      const seconds=finite(2*timeScale*width);
      if(width<=0||seconds<=0)fail();
      result=finite(result+seconds);
    }
    if(result<0||result>windowDuration)fail();
    return result;
  }
  let comparisonDuration=threshold===0?windowDuration:0;
  if(threshold>0&&threshold<=maximumSpeed){
    comparisonDuration=duration(square(threshold),false);
    if(threshold<maximumSpeed&&comparisonDuration===0)fail();
  }
  let capacityExceedanceDuration=0;
  if(capacityExceeded){
    const level=finite(capacity/factor);if(level<=0)fail();
    capacityExceedanceDuration=duration(level,true);
    if(capacityExceedanceDuration===0)fail();
  }
  return {status:'available',halfTime,maximumSpeed,maximumDrag,comparisonDuration,
    capacityExceeded,capacityExceedanceDuration};
}
