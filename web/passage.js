import {MPH,FOOT,loadAt,samplePassage} from './wind-model.mjs';
const el=id=>document.getElementById(id);
const controls=['travel','offset','threshold'];
let result,field,running=false,raf=0,last=null,progress=0,visible=true;
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
}
function rebuild() {
  pause();field=settings();const threshold=Number(el('threshold').value)*MPH;
  result=samplePassage(field,{threshold});
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
function pause() {running=false;cancelAnimationFrame(raf);last=null;el('passage-play').textContent='Play passage';}
function frame(now) {
  if (!running) return;
  if (last!==null) progress+=Math.min(now-last,100)/24000*480;
  last=now;el('passage-time').value=Math.min(480,Math.round(progress));show();
  if(progress>=480) return pause();
  raf=requestAnimationFrame(frame);
}
el('passage-play').addEventListener('click',()=>{
  if(running) return pause();if(document.hidden || !visible) return;
  progress=Number(el('passage-time').value);if(progress>=480)progress=0;
  running=true;last=null;el('passage-play').textContent='Pause passage';raf=requestAnimationFrame(frame);
});
el('passage-time').addEventListener('input',()=>{pause();show();});
controls.forEach(id=>el(id).addEventListener('input',rebuild));
el('wind-controls').addEventListener('input',rebuild);
el('wind-reset').addEventListener('click',()=>queueMicrotask(rebuild));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)pause();},{threshold:.05}).observe(el('passage'));
rebuild();
