import {PRESETS} from './vortex-model.mjs';
// Authored shape keys, not observations or a universal tornado life cycle.
export const EXAMPLE_KEYS=Object.freeze([
  Object.freeze({at:0,shape:'cone',extent:.4,label:'A short visible funnel'}),
  Object.freeze({at:.3,shape:'cone',extent:1,label:'The visible funnel extends'}),
  Object.freeze({at:.65,shape:'wedge',extent:1,label:'A broad form'}),
  Object.freeze({at:1,shape:'rope',extent:.65,label:'A narrow, bent form'}),
]);
// A laboratory fixture with deliberately missing coverage. The windows are
// authored examples, not observations of any historical storm.
export const EXAMPLE_WINDOWS=Object.freeze([
  Object.freeze({id:'early',start:0,end:10,keys:[
    {at:0,shape:'cone',extent:.4,label:'A short visible funnel'},
    {at:1,shape:'cone',extent:1,label:'An extended visible funnel'},
  ]}),
  Object.freeze({id:'late',start:22,end:30,keys:[
    {at:0,shape:'wedge',extent:1,label:'A broad authored form'},
    {at:1,shape:'rope',extent:.65,label:'A narrow authored form'},
  ]}),
]);

export function boundedFormAt(seconds,windows=EXAMPLE_WINDOWS) {
  if(!Number.isFinite(seconds)||!Array.isArray(windows)||windows.length<1||windows.length>16)throw new RangeError('Invalid bounded form sequence');
  const ids=new Set();
  windows.forEach((window,i)=>{
    if(typeof window.id!=='string'||!window.id||ids.has(window.id)||!Number.isFinite(window.start)||!Number.isFinite(window.end)||window.start<0||window.start>=window.end||(i&&window.start<=windows[i-1].end))throw new RangeError('Invalid appearance window');
    ids.add(window.id);formAt(0,window.keys);
  });
  const window=windows.find(window=>seconds>=window.start&&seconds<=window.end);
  if(!window)return null;
  return {...formAt((seconds-window.start)/(window.end-window.start),window.keys),window:window.id,start:window.start,end:window.end};
}
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
