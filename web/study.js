import { PRESETS, advanceTime } from './vortex-model.mjs';
import { formAt, boundedFormAt } from './evolution-model.mjs';
import {formationAt} from './formation-model.mjs';
import { PlaybackClock } from './playback-model.mjs';
import { createFormRenderer } from './form-renderer.mjs';
import {mountLabContext} from './lab-context.mjs';
import {DEFAULT_EXPERIMENTS} from './experiment-state.mjs';

const byId = id => document.getElementById(id);
const canvas = byId('scene');
let renderer = null, lab = null;
let motionModel='genesis-v1';
let lightingStyle='storm-v2';
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let frame = 0, time = 0, last = null, running = false, inView = true;
const sequenceClock=new PlaybackClock(30,1);
const formationSelected=()=>motionModel==='genesis-v1';
const sequenceForm=()=>formationSelected()?formationAt(Number(byId('sequence-time').value)*30,{visibility:byId('condensation-visibility').value,flow:byId('flow-cues').checked}):byId('sequence-coverage').value==='bounded'?boundedFormAt(Number(byId('sequence-time').value)*30):formAt(Number(byId('sequence-time').value));

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
  running = false; const owned=renderer;renderer=null;last = null;
  try{owned?.dispose();}catch(error){console.error('Form renderer cleanup failed:',error);}
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
    if(time>=30){stop('Sequence complete');lab?.changed();}
  }
  last=now;
  const sequence=evolving?sequenceForm():null;
  canvas.dataset.appearanceCoverage=evolving?(sequence?'assigned':'gap'):'manual';
  try{renderer.render({
    motionModel,
    lightingStyle:formationSelected()?lightingStyle:'legacy',
    formationTime:formationSelected()?time:null,formationVisibility:byId('condensation-visibility').value,flow:byId('flow-cues').checked,
    readingAppearance:getComputedStyle(canvas).colorScheme==='light'?'light':'dark',
    shape:evolving?sequence?.shape || null:PRESETS[byId('shape').value],
    extent:evolving?sequence?.extent ?? 0:Number(byId('condensation').value)/100,
    time,
    dust:byId('dust').checked,
    azimuth:Number(byId('azimuth').value),
    elevation:Number(byId('elevation').value),
    distance:Number(byId('distance').value),
  });}catch(error){console.error('Form rendering failed:',error);fail('The renderer could not draw this state. Reload to retry.');return;}
  lab?.preview();
  if(running) requestFrame();
}
// Redraw a paused illustration without seeking, playing or rewriting history.
byId('reading-appearance').addEventListener('change',requestFrame);
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change',requestFrame);
function syncControls() {
  for (const id of ['condensation','azimuth','elevation','distance']) {
    const suffix=id==='condensation'?'%':id==='distance'?'':'°';
    byId(id+'-value').textContent=(id==='distance'?Number(byId(id).value).toFixed(1):byId(id).value)+suffix;
  }
  byId('scene-form').textContent=formationSelected()?'ILLUSTRATIVE SUPERCELL STUDY':byId('sequence-enabled').checked?(sequenceForm()?'AUTHORED FORM SEQUENCE':'GAP / NO ASSIGNED FORM'):PRESETS[byId('shape').value].label.toUpperCase()+' FORM';
  requestFrame();lab?.changed();
}
for (const id of ['shape','condensation','azimuth','elevation','distance','dust']) byId(id).addEventListener('input',syncControls);
for(const id of ['condensation-visibility','flow-cues'])byId(id).addEventListener('change',()=>{stop();sequenceReadout();requestFrame();lab?.changed();});
byId('quality').addEventListener('change',() => {
  renderer?.setQuality(Number(byId('quality').value));
  requestFrame();lab?.changed();
});
byId('motion').addEventListener('click',() => {
  if(running) {stop();lab?.changed();return;}
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
document.addEventListener('visibilitychange',() => {if(document.hidden){const wasRunning=running;stop('Paused while page hidden');if(wasRunning)lab?.changed();}else requestFrame();});
motionPreference.addEventListener('change',event => {if(event.matches){const wasRunning=running;stop('Paused · reduced motion preference');if(wasRunning)lab?.changed();}});
new ResizeObserver(requestFrame).observe(canvas);
new IntersectionObserver(entries => {
  inView=entries[0].isIntersecting && entries[0].intersectionRatio>=.4;
  if(!inView){const wasRunning=running;stop('Paused while most of the scene is out of view');if(wasRunning)lab?.changed();}else requestFrame();
}, {threshold:[0,.4]}).observe(canvas);
canvas.addEventListener('webglcontextlost',event => {event.preventDefault();fail('Graphics context lost; waiting for recovery');});
canvas.addEventListener('webglcontextrestored',initialize);
function sequenceReadout() {
  canvas.dataset.lightingStyle=formationSelected()?lightingStyle:'legacy';
  byId('lighting-note').hidden=!formationSelected()||lightingStyle==='legacy';
  byId('reference-form-sources').hidden=!formationSelected()||!['reference-v1','storm-v1','storm-v2'].includes(lightingStyle);
  byId('lighting-note').textContent=lightingStyle==='storm-v2'?'A wider authored cloud base, irregular condensation and low dust share the same declared transport. Ground parcels are illustrative scale cues, not historical El Reno geography. Scene lighting stays fixed across reading appearances. The thirty study seconds, terrain and shape have no calibrated historical camera or clock.':['storm-v1','storm-v2'].includes(lightingStyle)?'A wider authored storm base, condensation and low dust share one assumed transport field. Scene lighting stays fixed when the reading appearance changes. Shape, transport and thirty study seconds have no calibrated El Reno camera, physical scale or historical clock.':lightingStyle==='reference-v1'?'This broad, irregular form uses published photographs as visible references. Its shape, light, cloud motion and ground surface are authored. No historical camera, time or physical scale is assigned.':'Authored side light and a synthetic ground surface help show depth. Their brightness, texture and distances are illustrative, with no historical illumination or physical scale.';
  byId('quality').querySelector('[value="3600"]').textContent=['storm-v1','storm-v2'].includes(lightingStyle)&&formationSelected()?'Lighter · up to 320 × 200':formationSelected()&&lightingStyle!=='legacy'?'Lighter · 3,600 particles · up to 320 × 200':'Lighter · 3,600 particles';
  byId('quality').querySelector('[value="7200"]').textContent=['storm-v1','storm-v2'].includes(lightingStyle)&&formationSelected()?'Standard · up to 512 × 320':'Standard · 7,200 particles';
  const groundLink=document.querySelector('.formation-context a[href*="reconstruction.html"]');
  if(groundLink){const target=new URL(groundLink.href);if(lightingStyle!=='legacy')target.searchParams.set('appearance_style',lightingStyle);else target.searchParams.delete('appearance_style');groundLink.href=target.href;}
  const value=Number(byId('sequence-time').value);
  byId('sequence-progress').textContent=`${Math.round(value*100)}% of authored sequence`;
  const state=sequenceForm();
  byId('sequence-stage').textContent=state?.stage??state?.label??'No assigned form between 10 and 22 seconds. The last form is not held or blended across this gap.';
  byId('formation-observation').textContent=formationSelected()?`${state.circulation>.1?'Assumed surface circulation is present.':'Assumed circulation is weak or absent.'} ${state.condensation>.1?'Condensation is visible.':'Little or no condensation is visible.'} Dust visibility is separate from both.`:'';
  byId('formation-assumptions').hidden=!formationSelected();
  byId('scene-form').textContent=formationSelected()?'ILLUSTRATIVE SUPERCELL STUDY':byId('sequence-enabled').checked?(state?'AUTHORED FORM SEQUENCE':'GAP / NO ASSIGNED FORM'):PRESETS[byId('shape').value].label.toUpperCase()+' FORM';
}
byId('sequence-enabled').addEventListener('change',()=>{
  if(formationSelected()&&!byId('sequence-enabled').checked){motionModel='kinematic-v1';byId('sequence-coverage').value='continuous';}
  stop();time=Number(byId('sequence-time').value)*30;sequenceClock.seek(time);
  for(const id of ['shape','condensation']) byId(id).disabled=byId('sequence-enabled').checked;
  byId('sequence-time').disabled=!byId('sequence-enabled').checked;
  coverageNote();syncControls();sequenceReadout();lab?.changed();
});
byId('sequence-time').addEventListener('input',()=>{const requested=Number(byId('sequence-time').value)*30;stop();time=requested;sequenceClock.seek(time);byId('sequence-time').value=time/30;sequenceReadout();requestFrame();lab?.changed();});
function coverageNote(){byId('sequence-coverage-note').textContent=['storm-v1','storm-v2'].includes(lightingStyle)&&formationSelected()?'A reduced storm scene over the existing 30 authored study seconds. Inflow, rotation and lift are declared assumptions in scene units. Condensation and dust remain separate visibility responses. This is not solved tornadogenesis or a matched historical interval.':lightingStyle==='reference-v1'&&formationSelected()?'A broad appearance study informed by documentary photographs, using the existing 30 authored study seconds. Photograph times do not set this sequence. Camera, hidden shape and physical dimensions are unresolved.':formationSelected()?'One illustrative supercell scenario over 30 authored seconds. Circulation precedes a continuous visible funnel in this example. Condensation and dust do not define tornado existence. These timings are assumptions, not a universal sequence or a historical clock.':byId('sequence-coverage').value==='bounded'?'This authored laboratory fixture covers 0 through 10 seconds and 22 through 30 seconds. The unassigned gap contains no funnel drawing. These windows are not historical observations.':'Four authored shapes blend over 30 seconds. This example is not El Reno or a measured life cycle.';}
byId('sequence-coverage').addEventListener('change',()=>{stop();const selected=byId('sequence-coverage').value;motionModel=['formation','reference','storm','storm-detail'].includes(selected)?'genesis-v1':motionModel==='legacy'?'legacy':'kinematic-v1';lightingStyle=selected==='storm-detail'?'storm-v2':selected==='storm'?'storm-v1':selected==='reference'?'reference-v1':selected==='formation'?'world-v1':'legacy';if(formationSelected()){byId('sequence-enabled').checked=true;time=Number(byId('sequence-time').value)*30;sequenceClock.seek(time);}for(const id of ['shape','condensation'])byId(id).disabled=byId('sequence-enabled').checked;byId('sequence-time').disabled=!byId('sequence-enabled').checked;coverageNote();sequenceReadout();requestFrame();lab?.changed();});
byId('sequence-rate').addEventListener('change',()=>{sequenceClock.setRate(Number(byId('sequence-rate').value),performance.now());lab?.changed();});

function experimentState(){
  const position=Number(byId('sequence-time').value),sequence=byId('sequence-enabled').checked;
  const state={shape:byId('shape').value,condensation:Number(byId('condensation').value),azimuth:Number(byId('azimuth').value),elevation:Number(byId('elevation').value),distance:Number(byId('distance').value),dust:byId('dust').checked,quality:Number(byId('quality').value),sequence,coverage:byId('sequence-coverage').value,rate:Number(byId('sequence-rate').value),position,phase:sequence?position*30:time};
  if(motionModel!=='legacy')state.model=motionModel;
  if(formationSelected()){state.visibility=byId('condensation-visibility').value;state.flow=byId('flow-cues').checked;}
  if(formationSelected()&&['reference-v1','storm-v1','storm-v2'].includes(lightingStyle))state.presentation=lightingStyle;
  else if(formationSelected()&&lightingStyle==='world-v1')state.lighting=lightingStyle;
  return state;
}
function captureExperiment(){
  stop();
  // The sequence control exposes thousandth steps. Save the selected step, not an unsupported exposure time.
  if(byId('sequence-enabled').checked){
    const position=Math.round(Number(byId('sequence-time').value)*1000)/1000;
    byId('sequence-time').value=position;time=position*30;sequenceClock.seek(time);sequenceReadout();requestFrame();
  }
  return experimentState();
}
function restoreExperiment(state){
  stop();
  motionModel=state.model??'legacy';
  lightingStyle=state.presentation??state.lighting??'legacy';
  byId('condensation-visibility').value=state.visibility??'ordinary';byId('flow-cues').checked=state.flow??true;
  for(const key of ['shape','condensation','azimuth','elevation','distance','quality'])byId(key).value=state[key];
  byId('dust').checked=state.dust;byId('sequence-enabled').checked=state.sequence;
  byId('sequence-coverage').value=state.coverage;byId('sequence-rate').value=state.rate;byId('sequence-time').value=state.position;
  time=state.phase;sequenceClock.seek(state.position*30);sequenceClock.setRate(state.rate);
  for(const id of ['shape','condensation'])byId(id).disabled=state.sequence;
  byId('sequence-time').disabled=!state.sequence;
  coverageNote();
  renderer?.setQuality(state.quality);sequenceReadout();syncControls();
}
sequenceReadout();syncControls();
lab=mountLabContext({kind:'form',read:experimentState,capture:captureExperiment,apply:restoreExperiment,defaults:{...DEFAULT_EXPERIMENTS.form,model:'genesis-v1',sequence:true,coverage:'storm-detail',visibility:'ordinary',flow:true,presentation:'storm-v2'}});
byId('reference-form-sources').addEventListener('click',event=>{if(event.target.closest('a'))lab.beforeNavigate?.();});
initialize();
