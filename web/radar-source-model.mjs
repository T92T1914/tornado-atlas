// This reader is the retained El Reno selection, not an arbitrary radar feed.
export function validateRadarSource(manifest) {
  const requireValue=(value,message)=>{if(!value)throw new Error(message);};
  requireValue(manifest&&manifest.schema===1&&manifest.event==='el-reno-2013'
    &&manifest.max_age_seconds===240,'Unsupported retained radar source.');
  requireValue(Array.isArray(manifest.frames)&&manifest.frames.length===12,
    'The retained radar selection must contain twelve observations.');
  let previous=-Infinity;
  for(const [index,frame] of manifest.frames.entries()) {
    const identity=151+3*index;
    requireValue(frame&&frame.frame_index===identity
      &&frame.file==='assets/el-reno-2013/radar/frame-'+identity+'.png',
      'A radar asset differs from its retained frame identity.');
    requireValue(typeof frame.utc==='string'
      &&/^2013-05-31T23:\d{2}:\d{2}\+00:00$/.test(frame.utc),
      'A retained radar time label is invalid.');
    const stamp=Date.parse(frame.utc);
    requireValue(Number.isFinite(stamp)&&stamp>previous
      &&new Date(stamp).toISOString()===frame.utc.replace('+00:00','.000Z'),
      'Retained radar labels must be valid and strictly ordered.');
    previous=stamp;
    requireValue(frame.source_label==='wseNWRT_Reflectivity_20130531-'
      +frame.utc.slice(11,19).replaceAll(':','')+'_00.51.png',
      'A printed radar filename differs from its interpreted time.');
    requireValue(typeof frame.sha256==='string'&&/^[a-f0-9]{64}$/.test(frame.sha256)
      &&typeof frame.alt==='string'&&frame.alt.trim(),'A retained radar image record is incomplete.');
  }
  return manifest;
}

export function radarSelection(manifest,rawFrame) {
  validateRadarSource(manifest);
  if(rawFrame===null||rawFrame===undefined)return {index:0,unknown:false};
  const index=typeof rawFrame==='string'&&/^[1-9]\d*$/.test(rawFrame)
    ?manifest.frames.findIndex(frame=>String(frame.frame_index)===rawFrame):-1;
  return index<0?{index:0,unknown:true}:{index,unknown:false};
}

export function retainedGap(manifest,index) {
  validateRadarSource(manifest);
  if(!Number.isInteger(index)||index<0||index>=manifest.frames.length)
    throw new RangeError('Radar observation ordinal is outside the retained selection.');
  return index===0?null:(Date.parse(manifest.frames[index].utc)
    -Date.parse(manifest.frames[index-1].utc))/1000;
}
