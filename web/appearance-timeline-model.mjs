import {formAt} from './evolution-model.mjs';
import {PRESETS} from './vortex-model.mjs';

const idPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const digestPattern=/^[a-f0-9]{64}$/;
const present=value=>typeof value==='string'&&Boolean(value.trim());
function requireValue(condition,message){if(!condition)throw new Error(message);}
function fields(value,names,label){
  requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===names.sort().join('|'),`Unsupported ${label} fields.`);
}
function utc(value){
  requireValue(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|\+00:00)$/.test(value),'Appearance time needs whole-second UTC.');
  const stamp=Date.parse(value);
  requireValue(Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,19)===value.slice(0,19),'Invalid appearance UTC time.');
  return stamp;
}
function https(value){
  if(!present(value)||/[\s\\\x00-\x1f]/.test(value))return false;
  try{const url=new URL(value);return url.protocol==='https:'&&Boolean(url.hostname)&&!url.username&&!url.password;}
  catch{return false;}
}
function number(value,lo,hi){return typeof value==='number'&&Number.isFinite(value)&&value>=lo&&value<=hi;}

function validateRegistration(registration,window,source){
  fields(registration,['source','inspection','timing','camera','rights','uncertainty'],'appearance registration');
  const identity=registration.source;
  fields(identity,['url','video_id','original_locator','edit_identity','sha256','identity_basis'],'appearance source identity');
  requireValue(https(identity.url)&&identity.url===source.url&&present(identity.video_id)&&identity.video_id===source.video_id&&
    https(identity.original_locator)&&present(identity.edit_identity)&&
    (identity.sha256===null||typeof identity.sha256==='string'&&digestPattern.test(identity.sha256))&&present(identity.identity_basis),'Appearance source or edit identity is not established.');
  const inspection=registration.inspection;
  fields(inspection,['status','start_video_seconds','end_video_seconds','reviewed_on','basis','discontinuities'],'appearance inspection');
  requireValue(inspection.status==='continuous_video_inspected'&&number(source.duration_seconds,0,Infinity)&&
    number(inspection.start_video_seconds,0,source.duration_seconds)&&number(inspection.end_video_seconds,0,source.duration_seconds)&&
    inspection.start_video_seconds<inspection.end_video_seconds&&/^\d{4}-\d{2}-\d{2}$/.test(inspection.reviewed_on)&&
    Number.isFinite(Date.parse(inspection.reviewed_on))&&new Date(inspection.reviewed_on).toISOString().slice(0,10)===inspection.reviewed_on&&
    inspection.discontinuities==='none_observed'&&present(inspection.basis),'Continuous source inspection is not qualified.');
  const timing=registration.timing;
  fields(timing,['method','anchors','uncertainty_seconds','basis'],'appearance timing');
  requireValue(timing.method==='linear_verified'&&Array.isArray(timing.anchors)&&timing.anchors.length>=3&&timing.anchors.length<=128&&
    number(timing.uncertainty_seconds,Number.EPSILON,Infinity)&&present(timing.basis),'Appearance timing is not qualified.');
  const samples=timing.anchors.map(anchor=>{
    fields(anchor,['video_seconds','utc'],'appearance timing anchor');
    requireValue(number(anchor.video_seconds,inspection.start_video_seconds,inspection.end_video_seconds),'Timing anchor outside inspected video.');
    return {video:anchor.video_seconds,stamp:utc(anchor.utc)};
  });
  requireValue(samples[0].video===inspection.start_video_seconds&&samples.at(-1).video===inspection.end_video_seconds&&
    samples[0].stamp===utc(window.start_utc)&&samples.at(-1).stamp===utc(window.end_utc),'Appearance interval differs from inspected clock endpoints.');
  for(let i=1;i<samples.length;i++)requireValue(samples[i].video>samples[i-1].video&&samples[i].stamp>samples[i-1].stamp,'Appearance timing anchors must increase.');
  const first=samples[0],last=samples.at(-1);
  for(const sample of samples.slice(1,-1)){
    const expected=first.stamp+(sample.video-first.video)/(last.video-first.video)*(last.stamp-first.stamp);
    requireValue(Math.abs(sample.stamp-expected)<=timing.uncertainty_seconds*1000,'Appearance timing disagrees with its stated uncertainty.');
  }
  const camera=registration.camera;
  fields(camera,['mode','coordinates','bearing_degrees','pitch_degrees','roll_degrees','position_uncertainty_m','orientation_uncertainty_degrees','lens_calibration','basis'],'appearance camera');
  requireValue(camera.mode==='fixed_view'&&Array.isArray(camera.coordinates)&&camera.coordinates.length===2&&
    number(camera.coordinates[0],-180,180)&&number(camera.coordinates[1],-90,90)&&
    number(camera.bearing_degrees,0,360)&&camera.bearing_degrees!==360&&number(camera.pitch_degrees,-90,90)&&number(camera.roll_degrees,-180,180)&&
    number(camera.position_uncertainty_m,0,Infinity)&&number(camera.orientation_uncertainty_degrees,0,180)&&
    present(camera.lens_calibration)&&present(camera.basis),'Fixed-view camera registration is incomplete.');
  const rights=registration.rights;
  fields(rights,['reuse','creator','uploader','rights_holder','basis'],'appearance rights');
  requireValue(rights.reuse==='external_links_only'&&present(rights.creator)&&rights.creator===source.creator&&
    present(rights.uploader)&&present(rights.rights_holder)&&present(rights.basis)&&present(registration.uncertainty),'Appearance rights or uncertainty is incomplete.');
}

export function validateAppearanceTimeline(timeline,eventId,clock,footage){
  fields(timeline,['schema_version','event','windows'],'appearance timeline');
  requireValue(timeline.schema_version===1&&timeline.event===eventId&&Array.isArray(timeline.windows)&&timeline.windows.length<=16,'Appearance timeline identity or version differs.');
  requireValue(Array.isArray(footage?.sources)&&footage.sources.length>=1&&footage.sources.length<=8&&
    footage.sources.every(source=>typeof source.id==='string'&&idPattern.test(source.id))&&
    new Set(footage.sources.map(source=>source.id)).size===footage.sources.length,'Appearance source versions need distinct identities.');
  const lower=utc(clock.start_utc),upper=utc(clock.end_utc),ids=new Set(),laneEnds=new Map();
  let priorStart=-Infinity;
  for(const window of timeline.windows){
    fields(window,['id','start_utc','end_utc','source_id','kind','basis','registration','keys'],'appearance window');
    const start=utc(window.start_utc),end=utc(window.end_utc);
    requireValue(typeof window.id==='string'&&idPattern.test(window.id)&&!ids.has(window.id)&&start>=lower&&end<=upper&&start<end&&
      start>=priorStart&&present(window.basis),'Appearance window order, identity or evidence basis is invalid.');
    ids.add(window.id);priorStart=start;
    const lane=window.source_id;
    requireValue(start>(laneEnds.get(lane)??-Infinity),'Appearance windows overlap within a source.');
    laneEnds.set(lane,end);
    requireValue(Array.isArray(window.keys)&&window.keys.length>=2&&window.keys.length<=64,'Appearance keys are missing.');
    requireValue(window.keys[0].at===0&&window.keys.at(-1).at===1,'Appearance keys need both endpoints.');
    for(let i=0;i<window.keys.length;i++){
      const key=window.keys[i];
      fields(key,['at','shape','extent','label'],'appearance key');
      requireValue(number(key.at,0,1)&&(!i||key.at>window.keys[i-1].at)&&typeof key.shape==='string'&&Object.hasOwn(PRESETS,key.shape)&&
        number(key.extent,0,1)&&present(key.label),'Appearance key is invalid.');
    }
    if(window.kind==='illustrative'){
      requireValue(window.source_id===null&&window.registration===null,'Illustrative form cannot inherit a historical registration.');
    }else if(window.kind==='registered'){
      const source=footage.sources.find(item=>item.id===window.source_id);
      requireValue(source,'Appearance source is not in the selected event.');
      validateRegistration(window.registration,window,source);
      for(const key of window.keys){
        requireValue(window.registration.timing.anchors.some(anchor=>key.at===(utc(anchor.utc)-start)/(end-start)),
          'Observed appearance key lacks an inspected source time anchor.');
      }
    }else throw new Error('Unsupported appearance evidence state.');
  }
  return timeline;
}

export function appearanceAt(timeline,seconds,startUtc,sourceId=null){
  if(!Number.isFinite(seconds))throw new RangeError('Invalid appearance time');
  if(!timeline)return {state:'unknown',reason:'No historical appearance interval is registered.'};
  const absolute=Date.parse(startUtc)+seconds*1000;
  const window=timeline.windows.find(item=>item.source_id===sourceId&&absolute>=Date.parse(item.start_utc)&&absolute<=Date.parse(item.end_utc));
  if(!window)return {state:'unknown',reason:'No assigned appearance for this source and time.'};
  const progress=(absolute-Date.parse(window.start_utc))/(Date.parse(window.end_utc)-Date.parse(window.start_utc));
  const form=formAt(progress,window.keys);
  const timing=window.registration?.timing;
  const matched=timing?.anchors.find(anchor=>Date.parse(anchor.utc)===absolute&&
    window.keys.some(key=>key.at===progress));
  const observed=Boolean(matched);
  const videoSeconds=matched?.video_seconds??(timing?timing.anchors[0].video_seconds+
    progress*(timing.anchors.at(-1).video_seconds-timing.anchors[0].video_seconds):null);
  return {state:window.kind==='illustrative'?'illustrative':observed?'observed':'interpolated',
    window:window.id,sourceId:window.source_id,basis:window.basis,registration:window.registration,
    videoSeconds,shape:form.shape,extent:form.extent,label:form.label};
}
