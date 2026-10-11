// Existing source facts and one inspected aftermath image, independent of the replay clock.
export function mountReplayScaleImpact(data,openPhoto){
  if(data.exhibit?.id!=='el-reno-2013')return;
  const byId=id=>document.getElementById(id),section=byId('replay-scale-impact');
  const maximum=data.exhibit.facts.find(row=>row.label==='Reported maximum tornado width');
  if(maximum?.value!=='2.6 mi'||maximum.source!=='https://www.weather.gov/oun/events-20130531')return;
  section.hidden=false;byId('replay-scale-jump').hidden=false;
  byId('replay-survey-jump').addEventListener('click',()=>{byId('replay-damage').open=true;});
  const photo=data.damage?.event==='el-reno-2013'&&data.damage.photos.find(row=>row.id==='nws-el-reno-damage-04');
  if(!photo){byId('replay-impact-example').hidden=true;return;}
  const image=byId('replay-impact-image');
  image.addEventListener('error',()=>{image.hidden=true;byId('replay-impact-image-failure').hidden=false;});
  image.src=photo.asset;
  byId('replay-impact-source').href=photo.source_page;
  byId('replay-impact-photo').addEventListener('click',()=>openPhoto({
    title:photo.title,asset:photo.asset,expectedSha256:photo.sha256,alt:image.alt,
    caption:photo.caption+' '+photo.reported_rating+' in the original NWS caption. Capture time and failure order remain unregistered.',
    location:photo.location_description,credit:photo.credit,source:photo.source_page,
    license:photo.rights_basis,licenseUrl:data.damage.rights_url,
  }));
}
