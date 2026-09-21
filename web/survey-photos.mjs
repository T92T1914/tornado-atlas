// Survey photographs retain their own captions even inside a fatality record.
export function surveyPhotos(point, media, openPhoto, {context = '', lazy = false} = {}) {
  const gallery = document.createElement('div');gallery.className = 'survey-record-photos';
  for (const [i, photo] of (media.photos[String(point.id)] || []).entries()) {
    const button=document.createElement('button');button.type='button';button.className='survey-photo-open';
    button.setAttribute('aria-label',`Enlarge photograph ${i+1} for survey record ${point.id}`);
    const img=document.createElement('img');img.src=photo.url;
    img.alt=`Photograph attached to NWS survey record ${point.id}, rated ${point.rating}.`;
    img.referrerPolicy='no-referrer';img.decoding='async';if(lazy)img.loading='lazy';
    img.addEventListener('error',()=>{
      button.disabled=true;const message=document.createElement('span');
      message.textContent='Photograph unavailable from the source. Use the original survey record link.';
      button.replaceChildren(message);
    },{once:true});
    button.append(img);button.addEventListener('click',()=>openPhoto({
      title:`${point.rating} · NWS survey ${point.id}`,asset:photo.url,alt:img.alt,
      caption:[context,`Recorded assessment: ${point.degree}. This assessment belongs to the survey record, not a new rating from the photograph.`].filter(Boolean).join(' '),
      location:`Surveyed feature: ${point.coordinates[1].toFixed(5)}°N, ${Math.abs(point.coordinates[0]).toFixed(5)}°W. The camera's position and capture time are not supplied.`,
      credit:media.source.credit,source:point.source_url
    }));gallery.append(button);
  }
  return gallery;
}
