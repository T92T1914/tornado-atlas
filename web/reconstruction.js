import {PlaybackClock, preparePositions, positionAt} from './playback-model.mjs';
import {frameAt} from './timeline-media-model.mjs';
import {loadEventPackage,displayClock} from './event-package-model.mjs';
import {localPoint, sceneProject, initialSeconds, funnelGlyph} from './reconstruction-model.mjs';
import {mountFootage} from './footage-view.mjs';

const el=id=>document.getElementById(id), canvas=el('replay-scene'), context=canvas.getContext('2d');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
let drawPending=null, frame=null, clock=null, redraw=()=>{}, refresh=()=>{};
const failedRadar=new Set();
const requestDraw=()=>{if(drawPending===null) drawPending=requestAnimationFrame(()=>{drawPending=null;redraw();});};
function pause(){clock?.pause(performance.now());if(frame!==null) cancelAnimationFrame(frame);frame=null;el('replay-play').textContent='Play timeline';}
function resetView(){const distance=Math.min(60,Math.max(24,43.2*canvas.clientHeight/canvas.clientWidth));for(const [key,value] of Object.entries({azimuth:0,elevation:48,distance}))el(`replay-${key}`).value=value;el('replay-follow').checked=false;requestDraw();}

async function start(){
  const {index,event,config,data}=await loadEventPackage(new URLSearchParams(location.search).get('event'));
  const picker=el('replay-event');picker.replaceChildren();
  for(const row of index.events){const option=document.createElement('option');option.value=row.id;option.textContent=`${row.title}${row.replay?' · Geographic replay':' · Research readiness'}`;picker.append(option);}
  picker.value=event.id;picker.disabled=false;
  picker.addEventListener('change',()=>{location.href=`reconstruction.html?event=${encodeURIComponent(picker.value)}`;});
  document.title=`${event.title} in space and time | Tornado Atlas`;
  el('replay-title').textContent=`${event.title}, in space and time.`;
  el('replay-event-name').textContent=event.title;
  for(const link of document.querySelectorAll('[data-event-documentary]'))link.href=event.documentary+(link.dataset.eventDocumentary||'');
  el('replay-documentary').textContent=`Read the ${event.title} documentary`;
  if(!config){
    document.title=`${event.title} reconstruction readiness | Tornado Atlas`;
    el('replay-title').textContent=`${event.title}: reconstruction readiness`;
    el('replay-eyebrow').textContent='DOCUMENTARY AVAILABLE / REPLAY NOT YET REGISTERED';
    el('replay-introduction').textContent='The documentary is available. A reviewed geographic replay package has not been published for this event.';
    el('replay-readiness').hidden=false;
    return;
  }
  if(!context) throw new Error('The scene cannot start in this browser. The source map and historical account remain available.');
  const localStamp=displayClock(config.clock.time_zone),features=data.geometry.features;
  el('replay-content').hidden=false;
  canvas.setAttribute('aria-label',`Three-dimensional view of the documented ${event.title} path. Drag or use arrow keys to turn the scene. The following controls provide the same options.`);
  const positions=preparePositions(features.filter(f=>f.geometry.type==='Point'));
  const path=features.find(f=>f.geometry.type==='LineString').geometry.coordinates;
  const boundary=features.find(f=>f.geometry.type==='Polygon').geometry.coordinates[0];
  const bounds=[0,1].map(axis=>[Math.min(...path.map(p=>p[axis])),Math.max(...path.map(p=>p[axis]))]);
  const origin=bounds.map(([lo,hi])=>(lo+hi)/2), stagePath=path.map(p=>localPoint(p,origin)), stageBoundary=boundary.map(p=>localPoint(p,origin));
  clock=new PlaybackClock((positions.at(-1).stamp-positions[0].stamp)/1000);
  clock.seek(initialSeconds(location.search,clock.duration));
  el('replay-time').max=clock.duration;el('replay-time').disabled=false;el('replay-play').disabled=false;
  let current=positionAt(positions,clock.seconds), lastText=null, radarFile=null;
  el('replay-source-note').textContent=`The source supplies ${positions.length} minute positions and the center path. The moving marker uses linear interpolation between those positions. ${config.clock.basis}`;
  el('replay-geography-source').href=config.geography_source.url;
  const updateFootage=mountFootage({...data.footage,introduction:'Choose a checked clock reading from the original footage. Each button pauses the spatial scene and radar viewer at that historical time and selects the corresponding video position. The original footage stays separate from the illustrative funnel.'},positions[0].stamp,seconds=>{pause();clock.seek(seconds);refresh();},pause,{headingLevel:2,formatTime:localStamp,clockLabel:`Historical clock (${config.clock.time_zone})`});
  function readCamera(center){
    const camera={focus:el('replay-follow').checked?center:[0,0,0]};
    for(const key of ['azimuth','elevation','distance']){
      camera[key]=Number(el(`replay-${key}`).value);
      el(`replay-${key}-value`).textContent=`${camera[key]}${key==='distance'?' km':'°'}`;
    }
    return camera;
  }
  redraw=()=>{
    const rect=canvas.getBoundingClientRect(), ratio=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));
    context.setTransform(ratio,0,0,ratio,0,0);
    const style=getComputedStyle(document.documentElement), text=style.getPropertyValue('--text').trim(), muted=style.getPropertyValue('--muted').trim();
    context.fillStyle=style.getPropertyValue('--bg');context.fillRect(0,0,rect.width,rect.height);
    const center=localPoint(current.coordinates,origin), camera=readCamera(center), project=p=>sceneProject(p,camera,rect.width,rect.height);
    function line(points,color,width=1,close=false,alpha=1){
      const projected=points.map(project);context.beginPath();let started=false;
      for(const p of projected){if(!p){started=false;continue;}if(!started){context.moveTo(p.x,p.y);started=true;}else context.lineTo(p.x,p.y);}
      if(close)context.closePath();context.globalAlpha=alpha;context.strokeStyle=color;context.lineWidth=width;context.stroke();context.globalAlpha=1;
    }
    for(let x=-16;x<=16;x+=2)line([[x,-12,0],[x,12,0]],muted,1,false,.17);
    for(let y=-12;y<=12;y+=2)line([[-16,y,0],[16,y,0]],muted,1,false,.17);
    line(stageBoundary,muted,1.4,true,.8);line(stagePath,text,2.1);
    for(const point of positions){const p=project(localPoint(point.geometry.coordinates,origin));if(!p)continue;context.beginPath();context.arc(p.x,p.y,2.5,0,Math.PI*2);context.fillStyle=text;context.fill();}
    const marker=project(center);
    if(el('replay-funnel').checked){
      // The glyph's dimensions are deliberately fixed artwork, never inferred from the path envelope.
      const particles=funnelGlyph(clock.seconds/12).map(p=>project(p.map((v,i)=>v+center[i]))).filter(Boolean).sort((a,b)=>b.depth-a.depth);
      context.fillStyle=text;
      for(const p of particles){context.globalAlpha=.09;context.beginPath();context.arc(p.x,p.y,Math.max(1,Math.min(12,p.scale*.07)),0,Math.PI*2);context.fill();}
      context.globalAlpha=1;
    }
    if(marker){context.strokeStyle=text;context.lineWidth=2;context.beginPath();context.arc(marker.x,marker.y,7,0,Math.PI*2);context.stroke();context.fillStyle=text;context.font='12px Segoe UI, sans-serif';context.fillText('Center position',marker.x+12,marker.y+4);}
    const north=project([0,9,0]);if(north){context.fillStyle=muted;context.font='12px Segoe UI, sans-serif';context.fillText('N',north.x,north.y);}
    context.fillStyle=muted;context.font='11px Segoe UI, sans-serif';context.fillText('Grid spacing: 2 km · flat reference plane',16,rect.height-16);
  };
  refresh=()=>{
    current=positionAt(positions,clock.seconds);requestDraw();
    const key=`${Math.floor(clock.seconds)}:${current.published}`;if(key===lastText)return;lastText=key;
    const time=localStamp(current.utc);el('replay-clock').textContent=time;
    updateFootage(current.utc);
    el('replay-time').value=clock.seconds;el('replay-time').setAttribute('aria-valuetext',time);
    el('replay-basis').textContent=current.published?'Published source minute position. The funnel remains an illustrative symbol.':`Position interpolated between ${positions[current.before].properties.display_time} and ${positions[current.after].properties.display_time}. Funnel appearance is not registered.`;
    el('replay-link').href=`reconstruction.html?event=${encodeURIComponent(event.id)}&t=${Math.floor(clock.seconds)}`;
    const media=data.timeline_media;
    const match=frameAt(media.frames,current.utc,media.max_age_seconds);
    const image=el('replay-radar-image');image.hidden=!match||failedRadar.has(match?.frame.file);
    if(match){if(radarFile!==match.frame.file){radarFile=match.frame.file;image.src=radarFile;image.alt=match.frame.alt;}el('replay-radar-note').textContent=`${media.credit}. Frame: ${localStamp(match.frame.utc)}. ${Math.floor(match.ageSeconds)} seconds before the selected time. Times use the source filename interpreted as UTC. This regional frame is not a geographic overlay.`;}
    else el('replay-radar-note').textContent='No reviewed radar frame within the permitted age of this time.';
    if(match&&failedRadar.has(match.frame.file))el('replay-radar-note').textContent='This radar image could not load. The historical clock and source map remain available.';
  };
  function animate(){frame=null;clock.tick(performance.now());refresh();if(clock.playing)frame=requestAnimationFrame(animate);else pause();}
  el('replay-play').addEventListener('click',()=>{if(clock.playing){pause();refresh();return;}clock.play(performance.now());el('replay-play').textContent='Pause timeline';frame=requestAnimationFrame(animate);});
  el('replay-time').addEventListener('input',()=>{pause();clock.seek(Number(el('replay-time').value));refresh();});
  el('replay-rate').addEventListener('change',()=>{clock.setRate(Number(el('replay-rate').value),performance.now());refresh();});
  refresh();
}
for(const key of ['azimuth','elevation','distance','follow','funnel'])el(`replay-${key}`).addEventListener('input',requestDraw);
el('replay-reset').addEventListener('click',resetView);
function orbit(dx,dy){const angle=Number(el('replay-azimuth').value)+dx;el('replay-azimuth').value=((angle+180)%360+360)%360-180;el('replay-elevation').value=Math.min(80,Math.max(10,Number(el('replay-elevation').value)+dy));requestDraw();}
function zoom(delta){el('replay-distance').value=Math.min(60,Math.max(3,Number(el('replay-distance').value)*delta));requestDraw();}
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;orbit((e.clientX-drag.x)*.4,(e.clientY-drag.y)*.3);drag.x=e.clientX;drag.y=e.clientY;});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{drag=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-200,Math.min(200,e.deltaY))*.002));},{passive:false});
canvas.addEventListener('keydown',e=>{const keys={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,5],ArrowDown:[0,-5]};if(keys[e.key]){e.preventDefault();orbit(...keys[e.key]);}else if(['+','=','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')resetView();else zoom(e.key==='-'?1.15:1/1.15);}});
new ResizeObserver(requestDraw).observe(canvas);
new MutationObserver(requestDraw).observe(document.documentElement,{attributes:true,attributeFilter:['data-appearance']});
matchMedia('(prefers-color-scheme: light)').addEventListener('change',requestDraw);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();refresh();}else requestDraw();});
reduceMotion.addEventListener('change',event=>{if(event.matches){pause();refresh();}});
el('replay-radar-image').addEventListener('error',()=>{const image=el('replay-radar-image');failedRadar.add(image.getAttribute('src'));image.hidden=true;el('replay-radar-note').textContent='This radar image could not load. The historical clock and source map remain available.';});
start().catch(error=>{pause();el('replay-error').textContent=error.message;el('replay-error').hidden=false;});
