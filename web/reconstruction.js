import {mountChronology} from './chronology-view.mjs';
import {PlaybackClock, preparePositions, positionAt} from './playback-model.mjs';
import {frameAt} from './timeline-media-model.mjs';
import {loadEventPackage,displayClock} from './event-package-model.mjs';
import {localPoint, sceneProject, replaySeconds, replayURL, funnelGlyph, observerGlyph} from './reconstruction-model.mjs';
import {mountFootage} from './footage-view.mjs';
import {mountReplayCamera} from './replay-camera-view.mjs';
import {anchorAt,sourceLink} from './footage-model.mjs';
import {appearanceAt} from './appearance-timeline-model.mjs';
import {createFormRenderer} from './form-renderer.mjs';
import {issuedAt} from './documentary-model.mjs';
import {replayChapters,chapterAt,adjacentChapter} from './replay-context-model.mjs';
import {mountSurvey} from './survey-view.mjs';
import {mountPhotoViewer} from './photo-view.mjs';

const el=id=>document.getElementById(id), canvas=el('replay-scene'), context=canvas.getContext('2d');
const setText=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
let drawPending=null, frame=null, clock=null, redraw=()=>{}, refresh=()=>{}, syncLocation=()=>{};
const failedRadar=new Set();
const requestDraw=()=>{if(drawPending===null) drawPending=requestAnimationFrame(()=>{drawPending=null;redraw();});};
function pause(){clock?.pause(performance.now());if(frame!==null) cancelAnimationFrame(frame);frame=null;el('replay-play').textContent='Play timeline';}
function resetView(){const distance=Math.min(60,Math.max(24,43.2*canvas.clientHeight/canvas.clientWidth));for(const [key,value] of Object.entries({azimuth:0,elevation:48,distance}))el(`replay-${key}`).value=value;el('replay-follow').checked=false;requestDraw();}

async function start(){
  const {index,event,config,data,chronology,radarContext}=await loadEventPackage(new URLSearchParams(location.search).get('event'));
  const picker=el('replay-event');picker.replaceChildren();
  for(const row of index.events){const option=document.createElement('option');option.value=row.id;option.textContent=`${row.title}${row.replay?' · Geographic replay':row.chronology?' · Source chronology':' · Research readiness'}`;picker.append(option);}
  picker.value=event.id;picker.disabled=false;
  picker.addEventListener('change',()=>{location.href=`reconstruction.html?event=${encodeURIComponent(picker.value)}`;});
  document.title=`${event.title} in space and time | Tornado Atlas`;
  el('replay-title').textContent=`${event.title}, in space and time.`;
  el('replay-event-name').textContent=event.title;
  for(const link of document.querySelectorAll('[data-event-documentary]'))link.href=event.documentary+(link.dataset.eventDocumentary||'');
  el('replay-documentary').textContent=`Read the ${event.title} documentary`;
  if(chronology){
    document.title=`${event.title} source chronology | Tornado Atlas`;
    el('replay-title').textContent=`${event.title}: the documented sequence`;
    el('replay-eyebrow').textContent='SOURCE CHRONOLOGY / NO GEOGRAPHIC REPLAY';
    el('replay-introduction').textContent='Move through reviewed warning and event records. Read what each clock label establishes and open its original source page.';
    mountChronology(el('replay-chronology'),chronology,event,{radarContext,openPhoto:mountPhotoViewer()});
    if(!config)return;
  }
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
  const start=positions[0].stamp,anchors=data.footage.anchors;
  const photoView=(href=location.href)=>new URL(href).searchParams.get('appearance_view')==='photo';
  function selectedSeconds(search){
    const params=new URLSearchParams(search);
    if(params.get('appearance_view')==='photo')params.delete('footage');
    return replaySeconds(params.toString(),clock.duration,anchors,start);
  }
  function momentURL(href,seconds){
    const original=new URL(href);
    if(!photoView(original.href))return replayURL(original.href,event.id,seconds,anchors,start);
    original.searchParams.delete('footage');
    const url=replayURL(original.href,event.id,seconds,anchors,start);
    url.searchParams.delete('footage');
    url.hash=original.hash;
    return url;
  }
  clock.seek(selectedSeconds(location.search));
  syncLocation=(mode='replace',fragment=null)=>{
    const url=momentURL(location.href,clock.seconds);
    if(fragment)url.hash=fragment;
    if(url.href!==location.href){
      history[mode==='push'?'pushState':'replaceState'](null,'',url);
      window.dispatchEvent(new Event('atlas:replay-url-change'));
    }
  };
  if(photoView())syncLocation();
  function seek(seconds,{mode='push',fragment=null}={}){
    pause();clock.seek(seconds);refresh();if(mode)syncLocation(mode,fragment);
  }
  function restore(){lastText=null;restoreAppearanceMode();seek(selectedSeconds(location.search),{mode:null});syncLocation();}
  el('replay-time').max=clock.duration;el('replay-time').disabled=false;el('replay-play').disabled=false;
  let current=positionAt(positions,clock.seconds), observer=null, lastText=null, radarFile=null, selectedSurvey=null;
  const footageCreators=[...new Set(data.footage.sources.map(source=>source.creator))].join(' and ');
  const updateObserver=mountReplayCamera(data.cameras,positions[0].stamp,positions.at(-1).stamp,seek,localStamp,footageCreators);
  if(data.cameras&&!data.footage.sources.length)el('replay-camera-separation').textContent='This recorded observer track is separate from any photographic declarations. A matching clock does not connect their sources. No video source is declared in this package.';
  el('replay-camera-enabled').addEventListener('change',()=>{observer=updateObserver(current.utc);requestDraw();});
  el('replay-source-note').textContent=`The source supplies ${positions.length} minute positions and the center path. The moving marker uses linear interpolation between those positions. ${config.clock.basis}`;
  el('replay-geography-source').href=config.geography_source.url;
  const updateFootage=mountFootage({...data.footage,introduction:'Choose a checked clock reading from the original footage. Each button pauses the spatial scene and radar viewer at that historical time and selects the corresponding video position. The original footage stays separate from the illustrative funnel.'},start,seconds=>seek(seconds,{mode:'replace'}),pause,{headingLevel:2,formatTime:localStamp,clockLabel:`Historical clock (${config.clock.time_zone})`,restoreInitialMoment:false,onMomentSelect:anchor=>seek((Date.parse(anchor.utc)-start)/1000,{fragment:'registered-footage'})});
  el('footage-source')?.addEventListener('change',()=>{lastText=null;refresh();syncLocation();});
  const chapters=replayChapters(data.history?.event===event.id?data.history:null,positions,start);
  const warnings=data.documentary?.event===event.id&&Array.isArray(data.documentary.warnings)?data.documentary.warnings:[];
  const mappedChapters=chapters.filter(chapter=>chapter.mapSeconds!==null);
  const contextReady=Boolean(mappedChapters.length);
  let shownChapter=undefined,shownWarning=undefined;
  if(contextReady){
    el('replay-context').hidden=false;
    const list=el('replay-chapter-list');
    for(const chapter of chapters){
      const button=document.createElement('button'),time=document.createElement('span'),title=document.createElement('strong');
      button.type='button';time.textContent=`Source: ${chapter.time} · Map: ${chapter.mapTime??'unavailable'}`;
      title.textContent=chapter.title;button.append(time,title);
      button.disabled=chapter.mapSeconds===null;
      if(!button.disabled)button.addEventListener('click',()=>seek(chapter.mapSeconds));
      list.append(button);chapter.button=button;
    }
    el('replay-chapter-previous').addEventListener('click',()=>{
      const previous=adjacentChapter(mappedChapters,clock.seconds,-1);
      if(previous)seek(previous.mapSeconds);
    });
    el('replay-chapter-next').addEventListener('click',()=>{
      const next=adjacentChapter(mappedChapters,clock.seconds,1);
      if(next)seek(next.mapSeconds);
    });
  }
  function updateContext(){
    if(!contextReady)return;
    const chapter=chapterAt(mappedChapters,clock.seconds);
    if(chapter!==shownChapter){
      shownChapter=chapter;
      setText(el('replay-chapter-title'),chapter?`${chapter.time} · ${chapter.title}`:'No chapter assigned at this map time.');
      setText(el('replay-chapter-account'),chapter?.text??'');
      el('replay-chapter-source').hidden=!chapter;
      if(chapter)el('replay-chapter-source').href=chapter.source;
      for(const item of chapters)item.button.setAttribute('aria-current',item===chapter?'step':'false');
    }
    const warning=issuedAt(warnings,current.utc).at(-1)??null;
    if(warning!==shownWarning){
      shownWarning=warning;
      setText(el('replay-warning-issued'),warning?`Issued ${localStamp(warning.issued)}. This is the bulletin issue time.`:'');
      setText(el('replay-warning-title'),warning?.title??'No reviewed bulletin issued by this time.');
      setText(el('replay-warning-summary'),warning?.summary??'');
      el('replay-warning-source').hidden=!warning;
      if(warning)el('replay-warning-source').href=warning.source;
    }
    el('replay-chapter-previous').disabled=!adjacentChapter(mappedChapters,clock.seconds,-1);
    el('replay-chapter-next').disabled=!adjacentChapter(mappedChapters,clock.seconds,1);
  }
  const appearanceTimeline=data.appearance_timeline??null;
  const photoSequences=appearanceTimeline?.photo_sequences??[];
  const drawing=el('replay-appearance-drawing'),formCanvas=el('replay-appearance-canvas'),mode=el('replay-appearance-mode');
  let appearanceRenderer=null,appearanceState={state:'unknown'};
  let unavailablePhotoId=null,shownPhotoSequence=null,shownPhotoSample=null;
  for(const sequence of photoSequences){
    const option=document.createElement('option');option.value=`photo:${sequence.id}`;
    const creators=[...new Set(sequence.samples.map(sample=>sample.source_id))]
      .map(id=>appearanceTimeline.photo_sources.find(source=>source.id===id).creator);
    option.textContent=`${creators.join(', ')}: ${sequence.samples.length} reported still${sequence.samples.length===1?'':'s'}`;
    mode.append(option);
  }
  if(!appearanceTimeline?.windows.some(window=>window.kind==='illustrative'))mode.querySelector('[value="illustrative"]')?.remove();
  restoreAppearanceMode();
  if(appearanceTimeline?.windows.length||photoSequences.length){
    drawing.hidden=false;
    try{appearanceRenderer=createFormRenderer(formCanvas,3200);}
    catch(error){formCanvas.hidden=true;el('replay-appearance-renderer-status').textContent='The form renderer could not start here. Source and coverage text remain available.';console.error('Appearance renderer failed:',error);}
    formCanvas.addEventListener('webglcontextlost',event=>{event.preventDefault();appearanceRenderer=null;formCanvas.hidden=true;el('replay-appearance-renderer-status').textContent='The form renderer lost its graphics context. Source and coverage text remain available.';});
    formCanvas.addEventListener('webglcontextrestored',()=>{
      try{appearanceRenderer=createFormRenderer(formCanvas,3200);formCanvas.hidden=false;el('replay-appearance-renderer-status').textContent='';requestDraw();}
      catch(error){console.error('Appearance renderer recovery failed:',error);}
    });
    new ResizeObserver(requestDraw).observe(formCanvas);
    mode.addEventListener('change',()=>{
      const requested=new URL(location.href);
      if(mode.value.startsWith('photo:')){
        requested.searchParams.set('appearance_view','photo');
        requested.searchParams.set('appearance_photo',mode.value.slice(6));
      }else if(mode.value==='unavailable-photo'){
        requested.searchParams.set('appearance_view','photo');
        if(unavailablePhotoId)requested.searchParams.set('appearance_photo',unavailablePhotoId);
        else requested.searchParams.delete('appearance_photo');
      }else{
        requested.searchParams.delete('appearance_photo');
        if(mode.value==='illustrative')requested.searchParams.set('appearance_view','illustrative');
        else requested.searchParams.delete('appearance_view');
      }
      const url=momentURL(requested.href,clock.seconds);
      if(url.href!==location.href){
        history.pushState(null,'',url);
        window.dispatchEvent(new Event('atlas:replay-url-change'));
      }
      lastText=null;refresh();
    });
  }
  function restoreAppearanceMode(){
    mode.querySelector('[data-unavailable-photo]')?.remove();
    unavailablePhotoId=null;
    const params=new URL(location.href).searchParams;
    if(params.get('appearance_view')==='photo'){
      const id=params.get('appearance_photo')??'';
      if(photoSequences.some(sequence=>sequence.id===id))mode.value=`photo:${id}`;
      else{
        unavailablePhotoId=id;
        const option=document.createElement('option');option.value='unavailable-photo';
        option.dataset.unavailablePhoto='';option.textContent='Unavailable photograph selection';
        mode.append(option);mode.value=option.value;
      }
      return;
    }
    mode.value=params.get('appearance_view')==='illustrative'&&
      appearanceTimeline?.windows.some(window=>window.kind==='illustrative')?'illustrative':'source';
  }
  function renderPhotoRecord(sample,source){
    const host=el('replay-photo-record'),record=document.createElement('dl');
    function field(label,text){
      const term=document.createElement('dt'),value=document.createElement('dd');
      term.textContent=label;value.textContent=text;record.append(term,value);
    }
    field('Source title',source.title);
    field('Creator',source.creator);
    field('Publisher',source.publisher);
    field('Publication identity',source.publication_identity);
    field('Resource version',source.version_identity);
    field('Original resource locator',source.original_locator);
    field('Resource identity basis',source.identity_basis);
    field('Resource digest',source.sha256??'Not established.');
    field('Image or panel locator',sample.image.panel_locator);
    field('Image identity basis',sample.image.identity_basis);
    field('Image digest',sample.image.sha256??'Not established.');
    field('Reported UTC label',sample.reported_utc);
    field(`Reported local label (${config.clock.time_zone})`,localStamp(sample.reported_utc));
    field('Source-reported timing basis',sample.timing.basis);
    field('Timing uncertainty',sample.timing.uncertainty_seconds===null?'Unquantified.':`±${sample.timing.uncertainty_seconds} seconds.`);
    field('Timing uncertainty basis',sample.timing.uncertainty_basis);
    field('Viewpoint description',sample.viewpoint.description);
    field('Viewpoint basis',sample.viewpoint.basis);
    field('Numeric camera pose and calibration','Unknown: coordinates, bearing, pitch, roll, position uncertainty, orientation uncertainty and lens calibration. Orbit controls are authored display choices.');
    field('Inspection declaration',`${sample.inspection.status}. ${sample.inspection.pixels} Reviewed on ${sample.inspection.reviewed_on}. ${sample.inspection.basis}`);
    field('Use and rights basis',`External original links only. Rights holder: ${source.rights.rights_holder}. ${source.rights.basis}`);
    field('Photographic geometry','Shape and extent are unassigned. No particle form is drawn.');
    host.append(record);
    for(const [label,values] of [['Declared visible characteristics',sample.characteristics],['Boundary limits',sample.boundary_limits]]){
      const heading=document.createElement('h4'),list=document.createElement('ul');heading.textContent=label;
      for(const text of values){const item=document.createElement('li');item.textContent=text;list.append(item);}
      host.append(heading,list);
    }
    const original=document.createElement('a');original.id='replay-photo-original';
    original.href=sample.image.original_url;original.target='_blank';original.rel='noopener';
    original.textContent=`Open the original image or panel: ${sample.image.panel_locator}`;
    const boundary=document.createElement('p');
    boundary.textContent='This panel retains separately declared still inspection and independently worded characteristics. Schema validation does not repeat inspection or authenticate the source. No photograph is loaded or copied by this player.';
    host.prepend(original);
    host.append(boundary);
  }
  function updatePhotoPanel(sequence){
    const panel=el('replay-appearance-photo'),list=el('replay-photo-samples'),record=el('replay-photo-record');
    panel.hidden=!sequence;
    if(sequence!==shownPhotoSequence){
      shownPhotoSequence=sequence;shownPhotoSample=null;list.replaceChildren();record.replaceChildren();
      if(sequence){
        const count=sequence.samples.length,first=sequence.samples[0],last=sequence.samples.at(-1);
        setText(el('replay-photo-sequence'),`${sequence.id}: ${count===1?
          `One reported instant at ${first.reported_utc}, with no duration.`:
          `${count} reported instants from ${first.reported_utc} to ${last.reported_utc}. This span is sparse context, not continuous coverage.`} ${sequence.basis}`);
        for(const sample of sequence.samples){
          const button=document.createElement('button');button.type='button';button.dataset.photoSample=sample.id;
          button.textContent=`${localStamp(sample.reported_utc)} · ${sample.image.panel_locator}`;
          button.title=`Reported UTC label: ${sample.reported_utc}. Timing uncertainty is separate from this label.`;
          button.setAttribute('aria-pressed','false');
          button.addEventListener('click',()=>seek((Date.parse(sample.reported_utc)-Date.parse(config.clock.start_utc))/1000));
          list.append(button);
        }
      }
    }
    const sample=sequence&&appearanceState.state==='photo_observed'?appearanceState.sample:null;
    for(const button of list.children){
      const pressed=String(button.dataset.photoSample===sample?.id);
      if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
    }
    if(sample!==shownPhotoSample){
      shownPhotoSample=sample;record.replaceChildren();
      if(sample&&appearanceState.source)renderPhotoRecord(sample,appearanceState.source);
    }
  }
  function updateAppearance(){
    const sourceId=el('footage-source')?.value??'';
    const photoSelected=mode.value.startsWith('photo:')||mode.value==='unavailable-photo';
    const sequence=photoSequences.find(item=>mode.value===`photo:${item.id}`)??null;
    const selected=mode.value==='illustrative'?null:sourceId;
    appearanceState=photoSelected?
      sequence?appearanceAt(appearanceTimeline,clock.seconds,config.clock.start_utc,{kind:'photo',id:sequence.id}):
        {state:'unknown',shape:null,extent:null}:
      appearanceAt(appearanceTimeline,clock.seconds,config.clock.start_utc,selected);
    const source=data.footage.sources.find(item=>item.id===sourceId);
    const anchor=source?anchorAt(anchors,current.utc,sourceId):null;
    const status=el('replay-appearance-state'),detail=el('replay-appearance-detail'),link=el('replay-appearance-source');
    let statusText,detailText,linkTarget='',linkText='';
    if(photoSelected){
      if(!sequence){
        statusText='Photograph selection unavailable.';
        detailText=`The requested sequence "${unavailablePhotoId||'(missing identity)'}" is not declared in this event package. Choose an available appearance view. No source has been substituted.`;
      }else if(appearanceState.state==='photo_observed'){
        statusText='Declared photographic observation at this reported instant.';
        detailText='This still has no duration. Its reported label does not establish independently verified clock accuracy. Shape and extent are unassigned; no particle form is drawn.';
        linkTarget=appearanceState.source.url;
        linkText=`Open the original publication: ${appearanceState.source.title}`;
      }else{
        statusText='Photographic appearance unknown at this exact clock instant.';
        const relation={before:'Before the first reported sample',between:'Between the reported samples',after:'After the last reported sample'}[appearanceState.relation];
        detailText=`${relation}. ${sequence.samples.length===1?'One separately declared inspected instant has no duration.':'Only the separately declared sample instants have photographic observations.'} Samples are neither held nor interpolated. Timing uncertainty does not widen their appearance coverage.`;
      }
    }else if(appearanceState.state==='unknown'){
      if(mode.value==='illustrative'){
        statusText='No illustrative form assigned at this time.';
        detailText='The authored study leaves this interval blank. It does not fill an evidence gap.';
      }else if(!source){
        statusText='No video source is declared in this package.';
        detailText='Choose a photographic sequence if one is available. Geographic timing and documentary reading remain available.';
      }else{
        statusText=anchor?'Checked original frame at this source clock. Appearance between frames remains unknown.':'Appearance unknown at this source and time.';
        detailText=anchor?anchor.note:'No continuous source view or form has been registered for this interval.';
        if(anchor&&source){linkTarget=sourceLink(source,anchor);linkText='Open the checked original frame';}
      }
    }else{
      statusText={observed:'Source-linked appearance anchor',interpolated:'Interpolated appearance between source anchors',illustrative:'Illustrative authored form'}[appearanceState.state];
      const registration=appearanceState.registration;
      detailText=`${appearanceState.label}. ${appearanceState.basis} ${registration?`Timing uncertainty: ±${registration.timing.uncertainty_seconds} seconds. ${registration.uncertainty} `:''}The normalized form is not a measured funnel dimension or wind field.`;
      if(registration&&source){
        linkTarget=sourceLink(source,{video_seconds:appearanceState.videoSeconds});
        linkText='Open the original source near this registered moment';
      }
    }
    updatePhotoPanel(photoSelected?sequence:null);
    setText(status,statusText);setText(detail,detailText);
    if(link.hidden===Boolean(linkTarget))link.hidden=!linkTarget;
    if(linkTarget&&link.href!==linkTarget)link.href=linkTarget;
    if(!linkTarget&&link.hasAttribute('href'))link.removeAttribute('href');
    if(linkText)setText(link,linkText);
    if(drawing.dataset.evidenceState!==appearanceState.state)drawing.dataset.evidenceState=appearanceState.state;
    if(formCanvas.dataset.evidenceState!==appearanceState.state)formCanvas.dataset.evidenceState=appearanceState.state;
  }
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
    const projectedSurvey=selectedSurvey?project(localPoint(selectedSurvey.coordinates,origin)):null;
    const surveyed=projectedSurvey&&projectedSurvey.x>=0&&projectedSurvey.x<=rect.width&&projectedSurvey.y>=0&&projectedSurvey.y<=rect.height?projectedSurvey:null;
    canvas.dataset.surveyRecord=selectedSurvey?String(selectedSurvey.id):'';
    canvas.dataset.surveyVisible=String(Boolean(surveyed));
    if(surveyed){
      context.fillStyle=style.getPropertyValue('--bg');context.strokeStyle=text;context.lineWidth=2;
      context.beginPath();context.moveTo(surveyed.x,surveyed.y-8);context.lineTo(surveyed.x+8,surveyed.y);
      context.lineTo(surveyed.x,surveyed.y+8);context.lineTo(surveyed.x-8,surveyed.y);context.closePath();context.fill();context.stroke();
      if(rect.width>=600){context.fillStyle=text;context.font='12px '+getComputedStyle(canvas).fontFamily;context.fillText(`Survey ${selectedSurvey.id}`,surveyed.x+12,surveyed.y+4);}
    }
    el('replay-damage-offscreen').hidden=!selectedSurvey||Boolean(surveyed);
    for(const point of positions){const p=project(localPoint(point.geometry.coordinates,origin));if(!p)continue;context.beginPath();context.arc(p.x,p.y,2.5,0,Math.PI*2);context.fillStyle=text;context.fill();}
    const marker=project(center);
    if(el('replay-funnel').checked){
      // The glyph's dimensions are deliberately fixed artwork, never inferred from the path envelope.
      const particles=funnelGlyph(clock.seconds/12).map(p=>project(p.map((v,i)=>v+center[i]))).filter(Boolean).sort((a,b)=>b.depth-a.depth);
      context.fillStyle=text;
      for(const p of particles){context.globalAlpha=.09;context.beginPath();context.arc(p.x,p.y,Math.max(1,Math.min(12,p.scale*.07)),0,Math.PI*2);context.fill();}
      context.globalAlpha=1;
    }
    if(marker){context.strokeStyle=text;context.lineWidth=2;context.beginPath();context.arc(marker.x,marker.y,7,0,Math.PI*2);context.stroke();context.fillStyle=text;context.font='12px '+getComputedStyle(canvas).fontFamily;context.fillText('Center position',marker.x+12,marker.y+4);}
    const glyph=observer?.visible?observerGlyph(observer.sample,origin,camera,rect.width,rect.height):null;
    canvas.dataset.observerVisible=String(Boolean(glyph));
    if(glyph){
      const {x,y,dx,dy}=glyph,headX=x+dx,headY=y+dy;
      context.strokeStyle=text;context.fillStyle=style.getPropertyValue('--bg');context.lineWidth=2;
      context.fillRect(x-5,y-5,10,10);context.strokeRect(x-5,y-5,10,10);
      context.beginPath();context.moveTo(x,y);context.lineTo(headX,headY);
      context.moveTo(headX-dx*.25-dy*.18,headY-dy*.25+dx*.18);context.lineTo(headX,headY);context.lineTo(headX-dx*.25+dy*.18,headY-dy*.25-dx*.18);context.stroke();
      if(rect.width>=600){
        context.fillStyle=text;context.font='12px '+getComputedStyle(canvas).fontFamily;
        context.fillText('Recorded observer',Math.max(8,Math.min(rect.width-125,x+12)),Math.max(16,y-10));
      }
    }
    el('replay-camera-key').hidden=!glyph||rect.width>=600;
    el('replay-camera-offscreen').hidden=!observer?.visible||Boolean(glyph);
    const north=project([0,9,0]);if(north){context.fillStyle=muted;context.font='12px '+getComputedStyle(canvas).fontFamily;context.fillText('N',north.x,north.y);}
    context.fillStyle=muted;context.font='11px '+getComputedStyle(canvas).fontFamily;context.fillText('Grid spacing: 2 km · flat reference plane',16,rect.height-16);
    if(appearanceRenderer)appearanceRenderer.render({shape:appearanceState.shape??null,extent:appearanceState.extent??0,time:clock.seconds,dust:false});
  };
  refresh=()=>{
    current=positionAt(positions,clock.seconds);observer=updateObserver(current.utc);requestDraw();
    const key=`${Math.floor(clock.seconds)}:${current.published}:${new URL(location.href).searchParams.get('footage_source')}:${new URL(location.href).searchParams.get('footage')}`;
    if(key!==lastText)updateFootage(current.utc);
    updateAppearance();
    el('replay-link').href=momentURL(location.href,photoView()?clock.seconds:Math.floor(clock.seconds)).href;
    el('replay-time').step=photoView()?'any':'1';
    el('replay-time').value=photoView()?clock.seconds:Math.round(clock.seconds);
    if(key===lastText)return;lastText=key;
    updateContext();
    const time=localStamp(current.utc);el('replay-clock').textContent=time;
    el('replay-time').setAttribute('aria-valuetext',time);
    el('replay-basis').textContent=current.published?'Published source minute position. The funnel remains an illustrative symbol.':`Position interpolated between ${positions[current.before].properties.display_time} and ${positions[current.after].properties.display_time}. Funnel appearance is not registered.`;
    const media=data.timeline_media;
    const match=frameAt(media.frames,current.utc,media.max_age_seconds);
    const image=el('replay-radar-image');image.hidden=!match||failedRadar.has(match?.frame.file);
    if(match){if(radarFile!==match.frame.file){radarFile=match.frame.file;image.src=radarFile;image.alt=match.frame.alt;}el('replay-radar-note').textContent=`${media.credit}. Frame: ${localStamp(match.frame.utc)}. ${Math.floor(match.ageSeconds)} seconds before the selected time. Times use the source filename interpreted as UTC. This regional frame is not a geographic overlay.`;}
    else el('replay-radar-note').textContent='No reviewed radar frame within the permitted age of this time.';
    if(match&&failedRadar.has(match.frame.file))el('replay-radar-note').textContent='This radar image could not load. The historical clock and source map remain available.';
  };
  function animate(){frame=null;clock.tick(performance.now());refresh();if(clock.playing)frame=requestAnimationFrame(animate);else{pause();syncLocation();}}
  el('replay-play').addEventListener('click',()=>{if(clock.playing){pause();refresh();syncLocation();return;}clock.play(performance.now());el('replay-play').textContent='Pause timeline';frame=requestAnimationFrame(animate);});
  el('replay-time').addEventListener('input',()=>seek(Number(el('replay-time').value),{mode:'replace'}));
  el('replay-rate').addEventListener('change',()=>{clock.setRate(Number(el('replay-rate').value),performance.now());refresh();});
  window.addEventListener('popstate',restore);
  refresh();syncLocation();
  if(event.id==='el-reno-2013'&&data.survey&&data.survey_media){
    const panel=el('replay-damage');panel.hidden=false;
    let mounted=false;
    function mountDamage(){
      if(mounted)return;mounted=true;
      try{
        mountSurvey(data.survey,data.geometry,data.survey_media,mountPhotoViewer(),data.history?.remembrance?.places??[],{
          reportPage:event.documentary,alternatePage:'survey.html',alternateLabel:'Open this selection in the focused survey map',
          beforeHistoryChange:()=>{if(clock.playing)clock.tick(performance.now());pause();refresh();syncLocation();},
          afterHistoryChange:refresh,
          onObservationSelect:point=>{
            selectedSurvey=point;
            el('replay-damage-status').hidden=!point;
            el('replay-damage-status').textContent=point?`Outlined diamond: NWS survey record ${point.id}, ${point.rating}. A surveyed feature location with no assigned impact time. Inspect its assessment below.`:'';
            requestDraw();
          },
        });
      }catch(error){el('survey-explorer').textContent=`The survey inspector could not start. Read the documented damage in the ${event.title} report using the documentary link above.`;}
    }
    panel.addEventListener('toggle',()=>{if(panel.open)mountDamage();});
    const hasSurveyTarget=()=>['survey','surveyRating','surveySearch','surveyPhotos','surveyOrder','fatality'].some(key=>new URL(location.href).searchParams.has(key));
    if(hasSurveyTarget()){panel.open=true;mountDamage();}
    window.addEventListener('popstate',()=>{if(hasSurveyTarget()){panel.open=true;mountDamage();}});
  }
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
document.fonts.ready.then(requestDraw);
new MutationObserver(requestDraw).observe(document.documentElement,{attributes:true,attributeFilter:['data-appearance']});
matchMedia('(prefers-color-scheme: light)').addEventListener('change',requestDraw);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();refresh();syncLocation();}else requestDraw();});
reduceMotion.addEventListener('change',event=>{if(event.matches){pause();refresh();syncLocation();}});
el('replay-radar-image').addEventListener('error',()=>{const image=el('replay-radar-image');failedRadar.add(image.getAttribute('src'));image.hidden=true;el('replay-radar-note').textContent='This radar image could not load. The historical clock and source map remain available.';});
start().catch(error=>{pause();el('replay-error').textContent=error.message;el('replay-error').hidden=false;});
