// Source-case state and labels, independent of the browser.
export const classLabels = {
  '1':'Tornado', '2':'Downburst', '3':'Tornado or downburst',
  '4':'Gust front', '5':'Dust devil', '6':'Unknown phenomenon',
  '7':'Tornado or funnel cloud', '8':'Downburst or gust front',
  '9':'Other', '-9999':'Unset phenomenon',
};
export function boundedComparison(ids=[]) {
  return [...new Set(ids.filter(id=>typeof id==='string'&&/^jma:[0-9]{10}$/.test(id)))].slice(0,2);
}
export function readCaseLink(search='', hash='') {
  const params=new URLSearchParams(search);
  const caseId=new URLSearchParams(hash.replace(/^#/, '')).get('case')||'';
  return {filters:{query:params.get('q')||'',classCode:params.get('class')??'1',rating:params.get('rating')||''},
    caseId,panel:params.get('panel')==='list'?'list':params.get('panel')==='detail'||caseId?'detail':'list',
    comparisonIds:boundedComparison(params.getAll('compare'))};
}
export function writeCaseLink({filters={},caseId='',panel='list',comparisonIds=[]}={}) {
  const params=new URLSearchParams();
  if(filters.query)params.set('q',filters.query);
  if(filters.classCode!==undefined&&filters.classCode!=='1')params.set('class',filters.classCode);
  if(filters.rating)params.set('rating',filters.rating);
  if(panel==='detail')params.set('panel','detail');
  else if(caseId)params.set('panel','list');
  for(const id of boundedComparison(comparisonIds))params.append('compare',id);
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

export const comparisonQualifications = {
  representation:'Processed Tornado Atlas source records, not original raw CSV rows or a JMA publication.',
  identity:'Two separate source cases, not a merged event, unique-storm count or complete national coverage.',
  ratings:'F and JEF remain distinct damage scales. No equivalent wind speed or combined rating is calculated.',
  time:'Reported calendar fields and uncertainties are retained. Timezone and UTC conversion remain unresolved.',
  coordinates:'Reported reference points and angular uncertainties are retained. The datum is unresolved. No surveyed track is created.',
  dimensions:'Reported damage-area intervals do not establish visible funnel size.',
  wind:'The separate reported wind value has no established unit or measurement basis in this adapter.',
  impacts:'Shared casualty and building cells remain separate. No combined or national total is calculated.',
};

export function comparisonExport(catalogue,entries,state={}) {
  if(catalogue?.schema_version!==1||catalogue.source?.url!=='https://www.data.jma.go.jp/stats/data/bosai/tornado/data/ichiran.csv'
    ||!/^[0-9a-f]{64}$/.test(catalogue.source.sha256||'')||!catalogue.source.snapshot_id
    ||typeof catalogue.attribution!=='string'||typeof catalogue.transformation!=='string')
    throw Error('The retained source metadata cannot identify this comparison.');
  if(!Array.isArray(entries)||entries.length!==2)
    throw Error('Load two complete source cases before downloading the comparison.');
  const ids=entries.map(entry=>entry?.record?.id),admitted=boundedComparison(ids);
  if(admitted.length!==2||ids.some((id,index)=>id!==admitted[index]))
    throw Error('The comparison must contain two distinct source-case identifiers.');
  const cases=entries.map(({record,detail})=>{
    if(!validDetail(detail,record,catalogue.source)||detail.source_record_id!==record.case_id
      ||record.id!=='jma:'+record.case_id)
      throw Error('A comparison detail does not match its retained source case.');
    return {index_record:record,processed_detail_path:detailPath(record),detail};
  });
  // Detach the portable value from the browser's cached objects.
  return JSON.parse(JSON.stringify({format:'tornado-atlas/jma-comparison',schema_version:1,
    source:catalogue.source,attribution:catalogue.attribution,transformation:catalogue.transformation,
    qualifications:comparisonQualifications,
    view_path:'japan.html'+writeCaseLink({...state,comparisonIds:ids}),cases}));
}

export function comparisonExportText(catalogue,entries,state={}) {
  const text=JSON.stringify(comparisonExport(catalogue,entries,state),null,2)+'\n';
  if(new TextEncoder().encode(text).byteLength>1024*1024)
    throw Error('This comparison exceeds the one-megabyte JSON download limit.');
  return text;
}
