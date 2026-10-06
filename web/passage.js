import {MPH,FOOT,loadAt,samplePassage} from './wind-model.mjs';
import {componentHistory} from './component-model.mjs';
import {PlaybackClock} from './playback-model.mjs';
import {attachPassageValues} from './passage-values.mjs';
const el=id=>document.getElementById(id);
const controls=['travel','offset','threshold','capacity'];
const clock=new PlaybackClock(24,1);
const sampledValues=attachPassageValues(document);
let result,field,component,raf=0,visible=true;
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
  sampledValues.select(index);
}
function rebuild() {
  pause();field=settings();const threshold=Number(el('threshold').value)*MPH;
  result=samplePassage(field,{threshold});
  component=componentHistory(result.samples,{...field,capacity:Number(el('capacity').value)*1000});
  sampledValues.rebuild({field,result,component,threshold,capacity:Number(el('capacity').value)*1000});
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
function syncTime() {el('passage-time').value=Math.round(clock.seconds/clock.duration*480);show();}
function pause() {
  clock.pause(performance.now());cancelAnimationFrame(raf);raf=0;
  for(const id of ['passage-play','component-play'])el(id).textContent='Play passage';
  if(result)syncTime();
}
function frame() {
  raf=0;if(!clock.playing)return;
  // Controls and frames use the same monotonic clock. An RAF timestamp can
  // precede a control callback's performance.now() in the same display frame.
  clock.tick(performance.now());syncTime();
  if(clock.playing)raf=requestAnimationFrame(frame);else pause();
}
function togglePlay() {
  if(clock.playing)return pause();if(document.hidden || !visible)return;
  clock.play(performance.now());syncTime();
  for(const id of ['passage-play','component-play'])el(id).textContent='Pause passage';raf=requestAnimationFrame(frame);
}
function seek(index) {
  pause();clock.seek(Number(index)/480*clock.duration);syncTime();
}
for(const id of ['passage-play','component-play'])el(id).addEventListener('click',togglePlay);
el('passage-time').addEventListener('input',()=>seek(el('passage-time').value));
el('component-time').addEventListener('input',()=>seek(el('component-time').value));
controls.forEach(id=>el(id).addEventListener('input',rebuild));
el('wind-controls').addEventListener('input',rebuild);
el('wind-reset').addEventListener('click',()=>queueMicrotask(()=>{
  for(const id of controls) el(id).value=el(id).defaultValue;
  clock.seek(0);
  rebuild();
}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)pause();},{threshold:.05}).observe(el('passage'));
rebuild();
