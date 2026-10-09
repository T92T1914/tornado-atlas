import {radarAt} from './chronology-radar-model.mjs';

export function mountChronologyRadar(container,data,event,resolved,openPhoto){
  if(data.schema_version!==2)return ()=>{};
  const make=(tag,text,parent)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
  const section=make('section','',container);section.id='chronology-radar';section.className='chronology-radar';
  make('h3','Radar context on the documentary clock',section);
  const revision=`dossier.html?event=${encodeURIComponent(event.id)}&revision=${data.radar_context.reference.dossier_sha256}`;
  const recovery=()=>{const link=make('a','Read the complete documentary figure and caption',section);link.href=event.documentary+'#radar';const dossier=make('a','Inspect the pinned evidence revision',section);dossier.href=revision;};
  if(resolved?.state!=='available'||typeof openPhoto!=='function'){
    make('p',resolved?.message||'Radar context is unavailable here. The documentary clock remains usable.',section);
    recovery();return ()=>{};
  }
  const {media,source,creator}=resolved,transform=media.transformation;
  make('p',data.radar_context.navigation_basis,section);
  const label=make('label','Printed radar snapshot',section);label.htmlFor='chronology-radar-snapshot';
  const picker=make('select','',section);picker.id=label.htmlFor;
  const first=make('option','Start of chronology (no earlier snapshot)',picker);first.value='';
  const start=Date.parse(data.entries[0].utc),end=Date.parse(data.entries.at(-1).utc);
  for(const snapshot of data.radar_context.snapshots){
    if(Date.parse(snapshot.utc)<start||Date.parse(snapshot.utc)>end)continue;
    const option=make('option',snapshot.source_label,picker);option.value=snapshot.id;
  }
  const selected=make('p','',section);selected.id='chronology-radar-selected';
  const age=make('p','',section);age.id='chronology-radar-age';
  make('p','Radial velocity is at left and reflectivity at right in each printed pair. The selected pair is identified by its printed label in the complete figure. No crop or overlay is applied.',section);
  const figure=make('figure','',section),open=make('button','Open complete radar figure',figure);
  open.type='button';open.id='chronology-radar-open';
  const image=make('img','',open);image.src=transform.asset;image.alt=transform.alt;image.width=transform.width;image.height=transform.height;image.loading='lazy';
  const imageStatus=make('p','',figure);imageStatus.setAttribute('role','status');
  image.addEventListener('error',()=>{image.hidden=true;imageStatus.textContent='The preview could not load. Open the viewer to retry the image, or follow the source and documentary links.';});
  make('figcaption','Complete report figure. Original credit and report caption remain in the figure.',figure);
  open.addEventListener('click',()=>openPhoto({asset:transform.asset,alt:transform.alt,title:media.title,caption:media.account+' '+media.limits,location:media.locator,credit:creator.name+'. '+creator.basis,source:source.url,license:source.rights}));
  make('p',media.account,section);make('p',media.limits,section);
  const outside=data.radar_context.snapshots.filter(row=>Date.parse(row.utc)<start||Date.parse(row.utc)>end);
  if(outside.length)make('p',`Outside this chronology: ${outside.map(row=>row.source_label).join(', ')}. These panels remain in the complete figure and are not clock seek choices.`,section);
  const original=make('a',source.title,section);original.href=source.url;
  const record=make('a','Read this radar account, source inspection and reuse record',section);record.href=revision+`&source=${encodeURIComponent(media.source_id)}#media-${encodeURIComponent(media.id)}`;
  recovery();
  let seek=null;
  picker.addEventListener('change',()=>{const snapshot=data.radar_context.snapshots.find(row=>row.id===picker.value);seek?.(snapshot?(Date.parse(snapshot.utc)-start)/1000:0);});
  const set=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
  return (seconds,seekClock)=>{
    seek=seekClock;const match=radarAt(data,seconds);
    picker.value=match?.snapshot?.id??'';
    if(!match?.snapshot){set(selected,`No earlier radar snapshot is supplied before the first printed label, ${data.radar_context.snapshots[0].source_label}. The complete figure remains available as a document.`);set(age,'No selected radar observation. Source labels have minute precision. Clock accuracy is not established.');return;}
    set(selected,`${match.elapsedSeconds<60?'Selected source minute':'Latest earlier printed snapshot'}: ${match.snapshot.source_label}.`);
    const elapsed=Math.floor(match.elapsedSeconds);
    set(age,`Elapsed navigation age: ${Math.floor(elapsed/60)} min ${elapsed%60} s after the printed minute. Source labels have minute precision. Clock accuracy is not established. This is not radar latency, camera calibration or an estimate of winds at a building.`);
  };
}
