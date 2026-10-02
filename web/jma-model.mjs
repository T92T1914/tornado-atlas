// Source-case state and labels, independent of the browser.
export const classLabels = {
  '1':'Tornado', '2':'Downburst', '3':'Tornado or downburst',
  '4':'Gust front', '5':'Dust devil', '6':'Unknown phenomenon',
  '7':'Tornado or funnel cloud', '8':'Downburst or gust front',
  '9':'Other', '-9999':'Unset phenomenon',
};
export function readCaseLink(search='', hash='') {
  const params=new URLSearchParams(search);
  const caseId=new URLSearchParams(hash.replace(/^#/, '')).get('case')||'';
  return {filters:{query:params.get('q')||'',classCode:params.get('class')??'1',rating:params.get('rating')||''},
    caseId,panel:params.get('panel')==='list'?'list':params.get('panel')==='detail'||caseId?'detail':'list'};
}
export function writeCaseLink({filters={},caseId='',panel='list'}={}) {
  const params=new URLSearchParams();
  if(filters.query)params.set('q',filters.query);
  if(filters.classCode!==undefined&&filters.classCode!=='1')params.set('class',filters.classCode);
  if(filters.rating)params.set('rating',filters.rating);
  if(panel==='detail')params.set('panel','detail');
  else if(caseId)params.set('panel','list');
  const query=params.toString();
  return (query?'?'+query:'')+(caseId?'#case='+encodeURIComponent(caseId):'');
}
export function filterCases(records,{query='',classCode='1',rating=''}={}) {
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(record=>{
    if(classCode!=='all'&&record.classification_code!==classCode)return false;
    if(rating&&(rating==='unrated'?Boolean(record.rating):record.rating!==rating))return false;
    const text=[record.id,record.case_id,record.title,record.year,record.classification_reported]
      .join(' ').toLocaleLowerCase();
    return terms.every(term=>text.includes(term));
  }).sort((a,b)=>b.year-a.year||b.case_id.localeCompare(a.case_id));
}
export function numberLabel(field) {
  if(!field||typeof field!=='object')return 'Not provided';
  if(field.status==='reported')return String(field.reported);
  const labels={unset:'Unset',unknown:'Unknown',blank:'Blank',invalid:'Invalid source value'};
  return (labels[field.status]||'Unresolved')+(field.reported!==''?' ('+String(field.reported)+')':'');
}
export function intervalLabel(interval) {
  if(!interval)return 'Not provided';
  const bound=(value,source)=>value===null||value===undefined?numberLabel(source):String(value)+' m';
  return 'Minimum: '+bound(interval.minimum_m,interval.reported_minimum)+
    '. Maximum: '+bound(interval.maximum_m,interval.reported_maximum)+'.';
}
export function validDetail(detail,record,source) {
  return detail?.id===record.id&&detail.country_code==='JP'
    &&detail.classification_code===record.classification_code
    &&detail.provenance?.snapshot_id===source.snapshot_id
    &&detail.provenance?.sha256===source.sha256
    &&detail.provenance?.source_url===source.url;
}
export function detailPath(record) {
  if(!/^details\/[0-9a-f]{2}-[0-9a-f]{20}\.json$/.test(record.detail_file||''))
    throw Error('The source case has an unsupported detail path.');
  return 'jma-cases/'+record.detail_file;
}
