import {frameAt,localStamp} from './timeline-media-model.mjs';
export function mountTimelineMedia(manifest, photos, openPhoto) {
  const el=id=>document.getElementById(id), mode=el('timeline-media-mode');
  let selected=null, renderedKey=null, ageLabel=null;
  el('timeline-media-method').textContent=manifest.clock_basis+' '+manifest.interpretation;
  function render() {
    if (!selected) return;
    const match=mode.value==='radar' ? frameAt(manifest.frames,selected.properties.utc,manifest.max_age_seconds) : null;
    const key=mode.value==='radar' ? `radar:${match?.frame.file || 'none'}` : `photo:${mode.value}`;
    function updateAge() {
      if (!ageLabel || !match) return;
      const age=Math.floor(match.ageSeconds);
      const text=`${Math.floor(age/60)} min ${age%60} sec before the selected time. Latest curated preceding frame; the image does not update every second.`;
      if (ageLabel.textContent !== text) ageLabel.textContent=text;
    }
    if (key === renderedKey) {updateAge();return;}
    renderedKey=key;ageLabel=null;
    const slot=el('timeline-media-image'), body=el('timeline-media-caption');
    slot.replaceChildren();body.replaceChildren();
    const add=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;body.append(n);return n;};
    let asset;
    if(mode.value==='radar') {
      el('timeline-media-status').textContent='RADAR / TIME LINKED';
      if(!match) {add('p','No reviewed radar frame within four minutes before this position.');return;}
      const {frame}=match;
      add('h4',localStamp(frame.utc));
      add('p','Source filename time interpreted as UTC. Clock details below.');
      ageLabel=add('p','');updateAge();
      add('p','Regional reflectivity shows radar echoes, not the visible funnel or a surface wind-speed map.');
      asset={title:'El Reno / regional radar',asset:frame.file,alt:frame.alt,caption:frame.source_label,
        location:manifest.clock_basis,credit:manifest.credit+'. '+manifest.changes,source:manifest.source,license:manifest.license,licenseUrl:manifest.license_url};
    } else {
      const photo=photos[Number(mode.value)];
      el('timeline-media-status').textContent='PHOTOGRAPH / TIME UNKNOWN';
      add('h4','A view of the storm, without an assigned minute');
      add('p',photo.timing_note);
      add('p','This photograph stays the same as you move through the timeline. It is not evidence of the tornado at the selected position.');
      asset={title:'El Reno / storm photograph',asset:photo.file,alt:photo.alt,caption:photo.caption,location:photo.timing_note,credit:photo.credit+'. '+photo.changes,source:photo.source,license:photo.license,licenseUrl:photo.license_url};
    }
    const button=document.createElement('button');button.type='button';button.className='timeline-media-enlarge';button.setAttribute('aria-label','Enlarge timeline evidence');
    const img=document.createElement('img');img.src=asset.asset;img.alt=asset.alt;img.width=597;img.height=599;
    if(mode.value!=='radar') {img.width=photos[Number(mode.value)].width;img.height=photos[Number(mode.value)].height;}
    img.addEventListener('error',()=>{button.replaceChildren(document.createTextNode('Image unavailable. Read the source below.'));button.disabled=true;},{once:true});
    button.append(img);button.addEventListener('click',()=>openPhoto(asset));slot.append(button);
    const credit=add('p',asset.credit+' '),source=document.createElement('a');source.textContent='Source and credit ↗';source.href=asset.source;source.target='_blank';source.rel='noopener';credit.append(source);
  }
  mode.addEventListener('change',render);
  return (position,index)=>{
    selected=position;
    if (el('media-time').value !== String(index)) el('media-time').value=index;
    if (el('media-time-label').textContent !== position.properties.display_time) {
      el('media-time').setAttribute('aria-valuetext',position.properties.display_time);
      el('media-time-label').textContent=position.properties.display_time;
    }
    render();
  };
}
