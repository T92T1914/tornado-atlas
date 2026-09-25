// Recorded observer context. A held sample never becomes a current camera pose.
export function validateCamera(manifest,eventId){
  const fail=message=>{throw new Error(message);};
  if(!manifest||manifest.schema!==1||manifest.event!==eventId)fail('Camera evidence belongs to a different event or schema.');
  for(const key of ['observer','source','locator','credit','method','limits']){
    if(typeof manifest[key]!=='string'||!manifest[key].trim())fail('Camera evidence needs attribution and display limits.');
  }
  const source=new URL(manifest.source);
  if(source.protocol!=='https:'||source.username||source.password)fail('Camera source requires HTTPS without credentials.');
  for(const key of ['source_sha256','excerpt_sha256'])if(!/^[a-f0-9]{64}$/.test(manifest[key]))fail('Camera source digest is missing.');
  if(manifest.display_max_age_seconds!==90)fail('Camera display age requires review.');
  if(!Array.isArray(manifest.samples)||!manifest.samples.length||manifest.samples.length>100)fail('Camera evidence needs a bounded sample list.');
  let previous=-Infinity;
  for(const sample of manifest.samples){
    if(!sample||Object.keys(sample).sort().join('|')!=='azimuth|coordinates|utc')fail('Unsupported camera sample fields.');
    const stamp=Date.parse(sample.utc),normalized=typeof sample.utc==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|\+00:00)$/.test(sample.utc);
    if(!normalized||!Number.isFinite(stamp)||new Date(stamp).toISOString().replace('.000Z','Z')!==sample.utc.replace('+00:00','Z')||stamp<=previous)fail('Camera samples require ordered normalized UTC.');
    previous=stamp;
    const point=sample.coordinates;
    if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90||!Number.isFinite(sample.azimuth)||sample.azimuth<0||sample.azimuth>360)fail('Invalid recorded camera coordinates or bearing.');
  }
  return manifest;
}

export function cameraAt(manifest,utc,enabled=true){
  const selected=Date.parse(utc);
  if(!Number.isFinite(selected))throw new RangeError('Invalid camera clock');
  if(!enabled)return {status:'disabled',visible:false,sample:null,ageSeconds:null};
  let sample=null,ageSeconds=null;
  for(const item of manifest.samples){
    const age=(selected-Date.parse(item.utc))/1000;
    if(age>=0&&(ageSeconds===null||age<ageSeconds)){sample=item;ageSeconds=age;}
  }
  if(!sample)return {status:'unavailable',visible:false,sample:null,ageSeconds:null};
  const status=ageSeconds===0?'recorded':ageSeconds<=manifest.display_max_age_seconds?'held':'stale';
  return {status,visible:status!=='stale',sample,ageSeconds};
}

export function cameraStatus(manifest,state,formatTime){
  if(state.status==='disabled')return 'Recorded observer layer hidden.';
  if(!state.sample)return 'No preceding recorded camera sample. The observer marker is hidden.';
  const {sample,ageSeconds}=state;
  const age=ageSeconds<1?'less than 1':Math.floor(ageSeconds);
  const basis=state.status==='recorded'?'exact sample time':`${age} ${ageSeconds<=1?'second':'seconds'} old`;
  const placement=state.visible?'Marker stays at that recorded location.':`Older than the ${manifest.display_max_age_seconds}-second display limit. The observer marker is hidden.`;
  return `${manifest.observer} · camera 1 · ${sample.azimuth}° from north. Recorded at ${formatTime(sample.utc)}. ${basis}. ${placement}`;
}
