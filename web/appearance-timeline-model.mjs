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

function photoText(value,label,maximum=2000){
  requireValue(typeof value==='string'&&/[^\s\u0085\u001c-\u001f]/u.test(value)&&
    Array.from(value).length<=maximum,`Invalid photographic ${label}.`);
}
function photoId(value,label){
  requireValue(typeof value==='string'&&value.length<=64&&idPattern.test(value),`Invalid photographic ${label}.`);
}
function photoUrl(value){
  photoText(value,'original URL',2048);
  // Photo-only syntax supports explicit HTTPS, ASCII DNS (including punycode),
  // canonical decimal IPv4, decimal ports and whitespace/control-free suffixes.
  // IPv6/raw Unicode hosts are outside this increment, not a trust judgment.
  // Preserve URL identity; this checks neither DNS/publicness nor rights.
  const match=/^https:\/\/([a-z0-9.-]+)(?::([0-9]{1,5}))?(?:[/?#][\s\S]*)?$/i.exec(value);
  requireValue(!/[\s\\\x00-\x1f\x7f-\x9f]/u.test(value)&&match,
    'Photographic original URLs require explicit HTTPS without credentials.');
  const host=match[1],labels=host.split('.');
  const dns=labels.every(label=>/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))&&
    /[A-Za-z]/.test(labels.at(-1));
  const ipv4=labels.length===4&&labels.every(label=>/^(?:0|[1-9][0-9]{0,2})$/.test(label)&&Number(label)<=255);
  requireValue(host.length<=253&&(dns||ipv4)&&(match[2]===undefined||Number(match[2])<=65535),
    'Photographic original URLs require ASCII DNS or canonical IPv4 with a valid port.');
}
function photoDigest(value){
  requireValue(value===null||typeof value==='string'&&digestPattern.test(value),'Invalid photographic digest.');
}
function photoDate(value){
  requireValue(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!value.startsWith('0000-'),
    'Photographic inspection requires YYYY-MM-DD.');
  const stamp=Date.parse(`${value}T00:00:00Z`);
  requireValue(Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value,
    'Invalid photographic inspection date.');
}
function photoUtc(value){
  const stamp=utc(value);
  requireValue(!value.startsWith('0000-'),'Invalid photographic UTC year.');
  return stamp;
}
function validatePhotos(timeline,lower,upper){
  // Declared consistency cannot authenticate inspection, provenance or rights.
  requireValue(Array.isArray(timeline.photo_sources)&&timeline.photo_sources.length<=16,
    'Photographic timelines permit at most 16 resource sources.');
  requireValue(Array.isArray(timeline.photo_sequences)&&timeline.photo_sequences.length<=16,
    'Photographic timelines permit at most 16 sparse sequences.');
  const sources=new Map(),resourceIdentities=new Set();
  for(const source of timeline.photo_sources){
    fields(source,['id','url','title','creator','publisher','publication_identity','version_identity',
      'original_locator','sha256','identity_basis','rights'],'photographic source');
    photoId(source.id,'source identity');
    requireValue(!sources.has(source.id),'Duplicate photographic source identity.');
    photoUrl(source.url);
    for(const name of ['title','creator','publisher','publication_identity','version_identity','original_locator'])
      photoText(source[name],name,512);
    photoDigest(source.sha256);photoText(source.identity_basis,'source identity basis');
    const identity=JSON.stringify([source.url,source.publication_identity,source.version_identity,source.original_locator]);
    requireValue(!resourceIdentities.has(identity),'Duplicate photographic resource version.');
    resourceIdentities.add(identity);
    fields(source.rights,['reuse','rights_holder','basis'],'photographic rights');
    requireValue(source.rights.reuse==='external_links_only','Photographic sources permit original external links only.');
    photoText(source.rights.rights_holder,'rights holder',512);
    photoText(source.rights.basis,'rights basis');
    sources.set(source.id,source);
  }
  const sequenceIds=new Set(),sampleIds=new Set(),exposures=new Set(),imageLocators=new Set();
  let total=0;
  for(const sequence of timeline.photo_sequences){
    fields(sequence,['id','basis','samples'],'photographic sequence');
    photoId(sequence.id,'sequence identity');
    requireValue(!sequenceIds.has(sequence.id),'Duplicate photographic sequence identity.');
    sequenceIds.add(sequence.id);photoText(sequence.basis,'sequence basis');
    requireValue(Array.isArray(sequence.samples)&&sequence.samples.length>=1&&sequence.samples.length<=64,
      'Photographic sequences need one through 64 samples.');
    total+=sequence.samples.length;
    requireValue(total<=256,'Photographic timelines permit at most 256 samples.');
    let previous=-Infinity;
    for(const sample of sequence.samples){
      fields(sample,['id','source_id','exposure_id','image','reported_utc','timing','inspection',
        'viewpoint','characteristics','boundary_limits','shape','extent'],'photographic sample');
      photoId(sample.id,'sample identity');photoId(sample.source_id,'sample source identity');
      photoId(sample.exposure_id,'exposure identity');
      requireValue(!sampleIds.has(sample.id),'Duplicate photographic sample identity.');
      requireValue(sources.has(sample.source_id),'Photographic sample lacks its original resource source.');
      requireValue(!exposures.has(sample.exposure_id),'Duplicate photographic exposure; crops are not new exposures.');
      sampleIds.add(sample.id);exposures.add(sample.exposure_id);
      fields(sample.image,['original_url','panel_locator','sha256','identity_basis'],'photographic image identity');
      photoUrl(sample.image.original_url);photoText(sample.image.panel_locator,'original image or panel locator',512);
      photoDigest(sample.image.sha256);photoText(sample.image.identity_basis,'image identity basis');
      const locator=JSON.stringify([sample.source_id,sample.image.original_url,sample.image.panel_locator]);
      requireValue(!imageLocators.has(locator),'Duplicate photographic image or panel locator.');
      imageLocators.add(locator);
      const stamp=photoUtc(sample.reported_utc);
      requireValue(stamp>=lower&&stamp<=upper&&stamp>previous,
        'Photographic samples must be strictly ordered within replay coverage.');
      previous=stamp;
      fields(sample.timing,['method','basis','uncertainty_seconds','uncertainty_basis'],'photographic timing');
      requireValue(sample.timing.method==='source_reported','Unsupported photographic timing method.');
      photoText(sample.timing.basis,'reported timing basis');
      photoText(sample.timing.uncertainty_basis,'sourced timing uncertainty basis');
      requireValue(sample.timing.uncertainty_seconds===null||number(sample.timing.uncertainty_seconds,0,Infinity),
        'Invalid photographic timing uncertainty.');
      fields(sample.inspection,['status','pixels','reviewed_on','basis'],'photographic inspection');
      requireValue(sample.inspection.status==='still_pixels_inspected',
        'Photographic samples require a still-pixel inspection declaration.');
      photoText(sample.inspection.pixels,'inspected pixels');photoDate(sample.inspection.reviewed_on);
      photoText(sample.inspection.basis,'inspection basis');
      const numericFields=['coordinates','bearing_degrees','pitch_degrees','roll_degrees',
        'position_uncertainty_m','orientation_uncertainty_degrees','lens_calibration'];
      fields(sample.viewpoint,['mode','description','basis',...numericFields],'photographic viewpoint');
      requireValue(sample.viewpoint.mode==='qualitative_text','Photographic viewpoints require sourced qualitative text.');
      photoText(sample.viewpoint.description,'viewpoint description');photoText(sample.viewpoint.basis,'viewpoint basis');
      requireValue(numericFields.every(name=>sample.viewpoint[name]===null),
        'Qualitative photographic registration cannot invent numeric camera fields.');
      for(const name of ['characteristics','boundary_limits']){
        requireValue(Array.isArray(sample[name])&&sample[name].length>=1&&sample[name].length<=16,
          `Photographic ${name} needs one through 16 descriptions.`);
        for(const text of sample[name])photoText(text,name,1000);
      }
      requireValue(sample.shape===null&&sample.extent===null,
        'Qualitative photographic geometry must remain explicitly null.');
    }
  }
}

export function validateAppearanceTimeline(timeline,eventId,clock,footage){
  const version=timeline?.schema_version;
  fields(timeline,['schema_version','event','windows',...(version===2?['photo_sources','photo_sequences']:[])],'appearance timeline');
  requireValue([1,2].includes(version)&&timeline.event===eventId&&Array.isArray(timeline.windows)&&timeline.windows.length<=16,'Appearance timeline identity or version differs.');
  requireValue(Array.isArray(footage?.sources)&&footage.sources.length>=(version===1?1:0)&&footage.sources.length<=8&&
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
  if(version===2)validatePhotos(timeline,lower,upper);
  return timeline;
}

function photoAt(timeline,seconds,startUtc,selection){
  fields(selection,['kind','id'],'photographic selection');
  requireValue(selection.kind==='photo','Unsupported typed appearance selection.');
  photoId(selection.id,'selected sequence identity');
  const sequence=timeline.schema_version===2?timeline.photo_sequences.find(item=>item.id===selection.id):null;
  if(!sequence)return {state:'unknown',reason:'No photographic sequence is assigned to this selection.',
    sequence:null,shape:null,extent:null};
  const origin=photoUtc(startUtc);
  const offset=sample=>(photoUtc(sample.reported_utc)-origin)/1000;
  const context={id:sequence.id,basis:sequence.basis,coverage:'sparse_instants',
    start_utc:sequence.samples[0].reported_utc,end_utc:sequence.samples.at(-1).reported_utc,
    sample_count:sequence.samples.length};
  // Compare offsets directly so fractional seconds cannot round into a sample.
  const sample=sequence.samples.find(item=>seconds===offset(item));
  if(!sample)return {state:'unknown',
    reason:'No inspected photograph exists at this exact reported clock instant.',
    sequence:context,relation:seconds<offset(sequence.samples[0])?'before':
      seconds>offset(sequence.samples.at(-1))?'after':'between',
    shape:null,extent:null};
  return {state:'photo_observed',sequence:context,sourceId:sample.source_id,
    source:timeline.photo_sources.find(item=>item.id===sample.source_id),sample,
    shape:null,extent:null};
}

export function appearanceAt(timeline,seconds,startUtc,sourceId=null){
  if(!Number.isFinite(seconds))throw new RangeError('Invalid appearance time');
  if(!timeline)return {state:'unknown',reason:'No historical appearance interval is registered.'};
  if(sourceId!==null&&typeof sourceId==='object')return photoAt(timeline,seconds,startUtc,sourceId);
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
