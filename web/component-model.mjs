import {loadAt} from './wind-model.mjs';
// One generic component. Its capacity is a user assumption, not a building rating.
export function componentHistory(samples, {capacity,...load}) {
  if (!Array.isArray(samples) || !samples.length || !Number.isFinite(capacity) || capacity<=0) throw new RangeError('Invalid component experiment');
  let peak=0, firstFailureIndex=null, previousTime=-Infinity;
  const states=samples.map((sample,index)=>{
    if(!Number.isFinite(sample.time) || sample.time<=previousTime) throw new RangeError('Samples must have increasing times');
    previousTime=sample.time;
    const force=loadAt(sample.speed,load).force;
    peak=Math.max(peak,force);
    if(force>capacity && firstFailureIndex===null) firstFailureIndex=index;
    return {time:sample.time,force,ratio:force/capacity,failed:firstFailureIndex!==null,peak};
  });
  return {states,peak,firstFailureIndex,firstFailureTime:firstFailureIndex===null?null:states[firstFailureIndex].time};
}
