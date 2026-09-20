import {MPH,FOOT,loadAt,samplePassage} from './wind-model.mjs';
import {componentHistory} from './component-model.mjs';
const el=id=>document.getElementById(id);
const controls=['travel','offset','threshold','capacity'];
let result,field,component,running=false,raf=0,last=null,progress=0,visible=true;
const x=i=>52+i/480*636;
let y=speed=>180-speed;
function settings() {
  const n=id=>Number(el(id).value);
  return {peak:n('peak')*MPH,radius:n('radius')*FOOT,background:n('background')*MPH,travel:n('travel')*MPH,offset:n('offset'),area:n('area'),coefficient:n('coefficient')};
}
function show() {
  const index=Math.round(Number(el('passage-time').value)),s=result.samples[index];
  el('passage-cursor').setAttribute('x1',x(index));el('passage-cursor').setAttribute('x2',x(index));
  el('passage-dot').setAttribute('cx',x(index));el('passage-dot').setAttribute('cy',y(s.speed));
  el('passage-center').setAttribute('cx',360+s.center/field.radius*50);
  el('passage-probe').setAttribute('cy',210-field.offset*50);
  el('passage-time-value').textContent=`${s.time.toFixed(1)} s from closest approach`;
  el('passage-now').textContent=`${(s.speed/MPH).toFixed(1)} mph`;
  el('passage-force').textContent=`${(loadAt(s.speed,field).force/1000).toFixed(2)} kN`;
  const state=component.states[index];
  el('component-now').textContent=`${state.ratio.toFixed(2)} × assumed capacity`;
  el('component-time').value=index;
  el('component-time-value').textContent=`${s.time.toFixed(1)} s from closest approach`;
  el('component-state').textContent=state.failed?'Failed under this rule':'Capacity not exceeded so far';
  el('component-panel').setAttribute('transform',state.failed?'translate(75 20) rotate(20 180 70)':'');
  el('component-panel').classList.toggle('failed',state.failed);
  el('component-connections').setAttribute('opacity',state.failed?'0':'1');
  el('component-diagram').setAttribute('aria-label',state.failed?'Schematic detached component: the assumed capacity has been exceeded earlier in this passage.':'Schematic attached component: assumed capacity has not been exceeded so far in this passage.');
}
function rebuild() {
  pause();field=settings();const threshold=Number(el('threshold').value)*MPH;
  result=samplePassage(field,{threshold});
  component=componentHistory(result.samples,{...field,capacity:Number(el('capacity').value)*1000});
  el('capacity-value').textContent=`${Number(el('capacity').value).toFixed(1)} kN`;
  el('component-peak').textContent=`${(component.peak/1000).toFixed(2)} kN`;
  el('component-first').textContent=component.firstFailureTime===null?'Not exceeded in this sampled window':`${component.firstFailureTime.toFixed(1)} s from closest approach (first failing sample)`;
  const top=Math.max(field.peak+field.background,threshold)*1.12;
  y=speed=>200-speed/top*170;
  el('passage-line').setAttribute('d',result.samples.map((s,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(s.speed).toFixed(2)}`).join(' '));
  el('passage-threshold').setAttribute('y1',y(threshold));el('passage-threshold').setAttribute('y2',y(threshold));
  el('passage-top').textContent=`${Math.round(top/MPH)} mph`;
  el('passage-start').textContent=`−${result.halfTime.toFixed(1)} s`;
  el('passage-end').textContent=`+${result.halfTime.toFixed(1)} s`;
  el('passage-peak').textContent=`${(result.peak/MPH).toFixed(1)} mph`;
  el('passage-duration').textContent=`≈ ${result.aboveSeconds.toFixed(1)} s`;
  el('travel-value').textContent=`${el('travel').value} mph`;
  el('offset-value').textContent=`${field.offset.toFixed(1)} R`;
  el('threshold-value').textContent=`${el('threshold').value} mph`;
  el('passage-range').textContent=`Time at or above ${el('threshold').value} mph within the displayed window`;
  show();
}
function pause() {running=false;cancelAnimationFrame(raf);last=null;for(const id of ['passage-play','component-play'])el(id).textContent='Play passage';}
function frame(now) {
  if (!running) return;
  if (last!==null) progress+=Math.min(now-last,100)/24000*480;
  last=now;el('passage-time').value=Math.min(480,Math.round(progress));show();
  if(progress>=480) return pause();
  raf=requestAnimationFrame(frame);
}
function togglePlay() {
  if(running) return pause();if(document.hidden || !visible) return;
  progress=Number(el('passage-time').value);if(progress>=480)progress=0;
  running=true;last=null;for(const id of ['passage-play','component-play'])el(id).textContent='Pause passage';raf=requestAnimationFrame(frame);
}
for(const id of ['passage-play','component-play'])el(id).addEventListener('click',togglePlay);
el('passage-time').addEventListener('input',()=>{pause();show();});
el('component-time').addEventListener('input',()=>{pause();el('passage-time').value=el('component-time').value;show();});
controls.forEach(id=>el(id).addEventListener('input',rebuild));
el('wind-controls').addEventListener('input',rebuild);
el('wind-reset').addEventListener('click',()=>queueMicrotask(()=>{
  for(const id of controls) el(id).value=el(id).defaultValue;
  el('passage-time').value=0;
  rebuild();
}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)pause();},{threshold:.05}).observe(el('passage'));
rebuild();
