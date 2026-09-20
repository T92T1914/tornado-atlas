import {PRESETS} from './vortex-model.mjs';
// Authored shape keys, not observations or a universal tornado life cycle.
export const EXAMPLE_KEYS=Object.freeze([
  Object.freeze({at:0,shape:'cone',extent:.4,label:'A short visible funnel'}),
  Object.freeze({at:.3,shape:'cone',extent:1,label:'The visible funnel extends'}),
  Object.freeze({at:.65,shape:'wedge',extent:1,label:'A broad form'}),
  Object.freeze({at:1,shape:'rope',extent:.65,label:'A narrow, bent form'}),
]);
export function formAt(progress,keys=EXAMPLE_KEYS) {
  if(!Number.isFinite(progress) || progress<0 || progress>1 || !Array.isArray(keys) || keys.length<2) throw new RangeError('Invalid form sequence');
  if(keys[0].at!==0 || keys.at(-1).at!==1) throw new RangeError('Keys must cover the sequence');
  keys.forEach((k,i)=>{
    if(!Number.isFinite(k.at) || (i && k.at<=keys[i-1].at) || !Object.hasOwn(PRESETS,k.shape) || !Number.isFinite(k.extent) || k.extent<0 || k.extent>1) throw new RangeError('Invalid form key');
  });
  const index=Math.max(0,keys.findLastIndex(k=>k.at<=progress));
  const a=keys[index],b=keys[Math.min(index+1,keys.length-1)];
  const fraction=a===b?0:(progress-a.at)/(b.at-a.at),smooth=fraction*fraction*(3-2*fraction);
  const mix=(x,y)=>x+(y-x)*smooth,shape={};
  for(const field of ['base','flare','bend']) shape[field]=mix(PRESETS[a.shape][field],PRESETS[b.shape][field]);
  return {shape,extent:mix(a.extent,b.extent),label:a===b?a.label:`${a.label} → ${b.label}`,fraction};
}
