import { PRESETS, advanceTime } from './vortex-model.mjs';
import { formAt, boundedFormAt } from './evolution-model.mjs';
import { PlaybackClock } from './playback-model.mjs';
import { createFormRenderer } from './form-renderer.mjs';

const byId = id => document.getElementById(id);
const canvas = byId('scene');
let renderer = null;
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let frame = 0, time = 0, last = null, running = false, inView = true;
const sequenceClock=new PlaybackClock(30,1);
const sequenceForm=()=>byId('sequence-coverage').value==='bounded'?boundedFormAt(Number(byId('sequence-time').value)*30):formAt(Number(byId('sequence-time').value));

function initialize() {
  try {
    renderer = createFormRenderer(canvas, Number(byId('quality').value));
    byId('scene-failure').hidden = true;
    byId('motion').disabled = false;
    status(motionPreference.matches ? 'Paused · reduced motion preference' : 'Paused · drag to explore');
    requestFrame();
  } catch (error) { console.error('Form study initialization failed:',error); fail(error.message === 'WebGL 2 is unavailable' ? error.message : 'The renderer could not start'); }
}
function status(message) { byId('motion-status').textContent=message; }
function fail(message) {
  if(sequenceClock.playing){sequenceClock.pause(performance.now());time=sequenceClock.seconds;byId('sequence-time').value=time/30;sequenceReadout();}
  running = false; renderer = null; last = null;
  if(frame) cancelAnimationFrame(frame);
  frame=0; byId('motion').disabled=true; byId('motion').textContent='Play motion';
  byId('scene-failure').hidden=false; status(message);
}
function stop(message = 'Paused') {
  if(byId('sequence-enabled').checked&&sequenceClock.playing){sequenceClock.pause(performance.now());time=sequenceClock.seconds;byId('sequence-time').value=time/30;sequenceReadout();}
  running=false;last=null;
  if(frame) cancelAnimationFrame(frame);
  frame=0;byId('motion').textContent='Play motion';
  // View and accessibility controls must not replace a renderer failure diagnosis.
  if(renderer) status(message);
  requestFrame();
}
function requestFrame() { if (!frame && renderer && !document.hidden && inView) frame=requestAnimationFrame(draw); }
function draw(now) {
  frame=0;
  if (!renderer || document.hidden || !inView) return;
  const evolving=byId('sequence-enabled').checked;
  if(evolving&&running)time=sequenceClock.tick(performance.now());
  else if(last !== null)time=advanceTime(time,(now-last)/1000,running);
  if(evolving && running) {
    byId('sequence-time').value=Math.min(1,time/30);
    sequenceReadout();
    if(time>=30) stop('Sequence complete');
  }
  last=now;
  const sequence=evolving?sequenceForm():null;
  canvas.dataset.appearanceCoverage=evolving?(sequence?'assigned':'gap'):'manual';
  renderer.render({
    shape:evolving?sequence?.shape || null:PRESETS[byId('shape').value],
    extent:evolving?sequence?.extent ?? 0:Number(byId('condensation').value)/100,
    time,
    dust:byId('dust').checked,
    azimuth:Number(byId('azimuth').value),
    elevation:Number(byId('elevation').value),
    distance:Number(byId('distance').value),
  });
  if(running) requestFrame();
}
function syncControls() {
  for (const id of ['condensation','azimuth','elevation','distance']) {
    const suffix=id==='condensation'?'%':id==='distance'?'':'°';
    byId(id+'-value').textContent=(id==='distance'?Number(byId(id).value).toFixed(1):byId(id).value)+suffix;
  }
  byId('scene-form').textContent=byId('sequence-enabled').checked?(sequenceForm()?'AUTHORED FORM SEQUENCE':'GAP / NO ASSIGNED FORM'):PRESETS[byId('shape').value].label.toUpperCase()+' FORM';
  requestFrame();
}
for (const id of ['shape','condensation','azimuth','elevation','distance','dust']) byId(id).addEventListener('input',syncControls);
byId('quality').addEventListener('change',() => {
  renderer?.setQuality(Number(byId('quality').value));
  requestFrame();
});
byId('motion').addEventListener('click',() => {
  if(running) {stop();return;}
  if(byId('sequence-enabled').checked && time>=30) time=0;
  if(byId('sequence-enabled').checked){sequenceClock.seek(time);sequenceClock.play(performance.now());}
  running=true;last=null;byId('motion').textContent='Pause motion';status('Illustrative motion playing');requestFrame();
});
byId('reset-view').addEventListener('click',() => {
  stop();time=0;sequenceClock.seek(0);byId('sequence-time').value=0;sequenceReadout();
  for(const [id,value] of Object.entries({azimuth:25,elevation:12,distance:7})) byId(id).value=value;
  syncControls();
});
let drag=null;
canvas.addEventListener('pointerdown',event => {
  if(event.button!==0 || !renderer) return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);
});
function orbit(dx,dy) {
  const wrap=a=>((a+180)%360+360)%360-180;
  byId('azimuth').value=Math.round(wrap(Number(byId('azimuth').value)+dx));
  byId('elevation').value=Math.round(Math.max(3,Math.min(60,Number(byId('elevation').value)+dy)));
  syncControls();
}
canvas.addEventListener('pointermove',event => {
  if(!drag || drag.id!==event.pointerId) return;
  orbit((event.clientX-drag.x)*.5,(event.clientY-drag.y)*.3);drag.x=event.clientX;drag.y=event.clientY;
});
for(const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name,() => {drag=null;});
canvas.addEventListener('keydown',event => {
  const directions={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,3],ArrowDown:[0,-3]};
  if(directions[event.key]) {event.preventDefault();orbit(...directions[event.key]);}
});
document.addEventListener('visibilitychange',() => {if(document.hidden) stop('Paused while page hidden');else requestFrame();});
motionPreference.addEventListener('change',event => {if(event.matches) stop('Paused · reduced motion preference');});
new ResizeObserver(requestFrame).observe(canvas);
new IntersectionObserver(entries => {
  inView=entries[0].isIntersecting && entries[0].intersectionRatio>=.4;
  if(!inView) stop('Paused while most of the scene is out of view');else requestFrame();
}, {threshold:[0,.4]}).observe(canvas);
canvas.addEventListener('webglcontextlost',event => {event.preventDefault();fail('Graphics context lost; waiting for recovery');});
canvas.addEventListener('webglcontextrestored',initialize);
function sequenceReadout() {
  const value=Number(byId('sequence-time').value);
  byId('sequence-progress').textContent=`${Math.round(value*100)}% of authored sequence`;
  byId('sequence-stage').textContent=sequenceForm()?.label || 'No assigned form between 10 and 22 seconds. The last form is not held or blended across this gap.';
  byId('scene-form').textContent=byId('sequence-enabled').checked?(sequenceForm()?'AUTHORED FORM SEQUENCE':'GAP / NO ASSIGNED FORM'):PRESETS[byId('shape').value].label.toUpperCase()+' FORM';
}
byId('sequence-enabled').addEventListener('change',()=>{
  stop();time=Number(byId('sequence-time').value)*30;sequenceClock.seek(time);
  for(const id of ['shape','condensation']) byId(id).disabled=byId('sequence-enabled').checked;
  byId('sequence-time').disabled=!byId('sequence-enabled').checked;
  syncControls();sequenceReadout();
});
byId('sequence-time').addEventListener('input',()=>{const requested=Number(byId('sequence-time').value)*30;stop();time=requested;sequenceClock.seek(time);byId('sequence-time').value=time/30;sequenceReadout();requestFrame();});
byId('sequence-coverage').addEventListener('change',()=>{stop();byId('sequence-coverage-note').textContent=byId('sequence-coverage').value==='bounded'?'This authored laboratory fixture covers 0 through 10 seconds and 22 through 30 seconds. The unassigned gap contains no funnel drawing. These windows are not historical observations.':'Four authored shapes blend over 30 seconds. This example is not El Reno or a measured life cycle.';sequenceReadout();requestFrame();});
byId('sequence-rate').addEventListener('change',()=>{sequenceClock.setRate(Number(byId('sequence-rate').value),performance.now());});
sequenceReadout();syncControls();initialize();
