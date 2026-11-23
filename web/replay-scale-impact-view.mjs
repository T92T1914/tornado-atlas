// Preserve sourced widths and recorded outcomes. Only the declared radar comparison seeks the existing clock.
export function mountReplayScaleImpact(data,openPhoto,seek){
  if(data.exhibit?.id!=='el-reno-2013')return;
  const byId=id=>document.getElementById(id),section=byId('replay-scale-impact');
  const maximum=data.exhibit.facts.find(row=>row.label==='Reported maximum tornado width');
  if(maximum?.value!=='2.6 mi'||maximum.source!=='https://www.weather.gov/oun/events-20130531')return;
  section.hidden=false;byId('replay-scale-jump').hidden=false;
  byId('replay-survey-jump').addEventListener('click',()=>{byId('replay-damage').open=true;});
  if(seek)byId('replay-ground-clock').addEventListener('click',event=>{
    if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();seek(488,{fragment:'replay-ground-scouring'});
  });
  // Each width leads to the start of its own reported period, where the scene
  // draws it. Photograph and study modes keep only the center marker, so there
  // the plain link loads the path view.
  if(seek)for(const width of data.reported_widths?.widths??[]){
    const link=byId('replay-width-show-'+width.id);
    link?.addEventListener('click',event=>{
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      if(['photo','ground','simulation','formation'].includes(new URL(location.href).searchParams.get('appearance_view')))return;
      event.preventDefault();seek(Number(new URL(link.href).searchParams.get('t')),{fragment:'replay-path-stage'});
      // Focus after the frame that draws the circle, so the scene's description is already written.
      const scene=byId('replay-scene');scene.scrollIntoView({block:'center'});
      requestAnimationFrame(()=>scene.focus({preventScroll:true}));
    });
  }
  const photo=data.damage?.event==='el-reno-2013'&&data.damage.photos.find(row=>row.id==='nws-el-reno-damage-04');
  if(!photo){byId('replay-impact-example').hidden=true;return;}
  const image=byId('replay-impact-image');
  image.addEventListener('error',()=>{image.hidden=true;byId('replay-impact-image-failure').hidden=false;});
  image.src=photo.asset;
  byId('replay-impact-source').href=photo.source_page;
  byId('replay-impact-photo').addEventListener('click',()=>openPhoto({
    title:photo.title,asset:photo.asset,expectedSha256:photo.sha256,alt:image.alt,
    caption:photo.caption+' The original NWS caption rates this house '+photo.reported_rating+'. Capture time and the order of structural failures have not been established.',
    location:photo.location_description,credit:photo.credit,source:photo.source_page,
    license:photo.rights_basis,licenseUrl:data.damage.rights_url,
  }));
}
