// Labels and filters for the mainland China source cases, independent of the browser.
export const ZONE_NOTE='UTC+8, as recorded';

export function dateLabel(date){
  if(!date||typeof date!=='object')return 'Date not recorded';
  if(date.kind==='approximate_date_range')return date.first+' to '+date.last+', approximate dates of occurrence';
  return date.first;
}
export function timeLabel(time){
  if(!time||time.kind==='not_recorded')return 'Not recorded';
  if(time.kind==='clock_time')return time.local+' '+ZONE_NOTE;
  if(time.kind==='period_of_day')return time.reported+', '+ZONE_NOTE;
  return 'Not recorded';
}
export function positionLabel(position){
  const point=position?.point;
  if(!Array.isArray(point)||point.length!==2)return 'No geocoded position';
  const [longitude,latitude]=point;
  return latitude.toFixed(4)+'° N, '+longitude.toFixed(4)+'° E, geocoded from the place description';
}
export function ratingLabel(rating){
  return rating?.reported?rating.reported+', as the dataset reports':'Unrated in the dataset';
}
export function filterCases(records,{query='',rating=''}={}){
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(record=>{
    if(rating&&(rating==='unrated'?Boolean(record.rating?.reported):record.rating?.reported!==rating))return false;
    const text=[record.id,record.case_label,record.year,record.recorded_date?.reported]
      .join(' ').toLocaleLowerCase();
    return terms.every(term=>text.includes(term));
  }).sort((a,b)=>b.year-a.year||a.sequence-b.sequence);
}
export function readLink(search=''){
  const params=new URLSearchParams(search);
  const rating=params.get('rating')||'';
  return {query:params.get('q')||'',rating:/^(EF[0-5]|unrated)$/.test(rating)?rating:''};
}
export function writeLink({query='',rating=''}={}){
  const params=new URLSearchParams();
  if(query)params.set('q',query);
  if(rating)params.set('rating',rating);
  const text=params.toString();
  return text?'?'+text:'';
}
