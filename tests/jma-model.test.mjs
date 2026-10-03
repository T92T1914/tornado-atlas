import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {readCaseLink,writeCaseLink,filterCases,numberLabel,intervalLabel,validDetail,detailPath,boundedComparison,comparisonExport,comparisonExportText,comparisonQualifications} from '../web/jma-model.mjs';

const cases=[
  {id:'jma:2026010101',case_id:'2026010101',year:2026,title:'東京都 *literal%',classification_code:'1',rating:'JEF1..JEF3'},
  {id:'jma:2000010102',case_id:'2000010102',year:2000,title:'Unknown case',classification_code:'6',rating:null},
  {id:'jma:2000010103',case_id:'2000010103',year:2000,title:'Ambiguous',classification_code:'7',rating:'F1'},
  {id:'jma:2000010101',case_id:'2000010101',year:2000,title:'Source tornado',classification_code:'1',rating:'F1'},
];
test('default is only the explicit tornado classification',()=>{
  assert.deepEqual(filterCases(cases).map(c=>c.case_id),['2026010101','2000010101']);
  assert.deepEqual(filterCases(cases,{classCode:'7'}).map(c=>c.case_id),['2000010103']);
  assert.equal(filterCases(cases,{classCode:'all'}).length,4);
  assert.equal(filterCases(cases,{classCode:'missing'}).length,0);
});
test('rating intervals, JEF and unrated source values stay separate',()=>{
  assert.equal(filterCases(cases,{rating:'JEF1..JEF3'}).length,1);
  assert.equal(filterCases(cases,{rating:'JEF1'}).length,0);
  assert.equal(filterCases(cases,{rating:'unrated',classCode:'all'})[0].classification_code,'6');
});
test('Japanese text and punctuation are literal search terms',()=>{
  assert.equal(filterCases(cases,{query:'東京都 *literal%'}).length,1);
  assert.equal(filterCases(cases,{query:'2026 2026010101'}).length,1);
  assert.equal(filterCases(cases,{query:'wildcard%'}).length,0);
});
test('query, unavailable filters and selected list/detail views roundtrip',()=>{
  for(const classCode of ['1','all','6','unknown',''])for(const panel of ['list','detail']){
    const state={filters:{query:'東京都 + 100%',classCode,rating:'JEF1..JEF3'},caseId:'jma:2026010101',panel,comparisonIds:[]};
    const link=writeCaseLink(state),split=link.indexOf('#');
    assert.deepEqual(readCaseLink(link.slice(0,split),link.slice(split)),state);
  }
  assert.equal(readCaseLink().panel,'list');
  assert.equal(readCaseLink('','#case=jma%3A2026010101').panel,'detail');
});
test('two retained cases travel independently of selected record and filters',()=>{
  const state={filters:{query:'unrelated place',classCode:'6',rating:'unrated'},caseId:'jma:2026010101',panel:'list',comparisonIds:['jma:2000010101','jma:0000000000']};
  const href=writeCaseLink(state),split=href.indexOf('#');
  assert.deepEqual(readCaseLink(href.slice(0,split),href.slice(split)),state);
  assert.deepEqual(readCaseLink('?compare=jma%3A2000010101&compare=jma%3A2000010101&compare=&compare=jma%3A2000010103&compare=extra').comparisonIds,['jma:2000010101','jma:2000010103']);
  const first='jma:2000010101',second='jma:2000010103',third='jma:2026010101';
  assert.deepEqual(boundedComparison([null,'',1,'https://example.org/source.json','jma:wrong',first,first,second,third]),[first,second]);
  assert.deepEqual(readCaseLink(writeCaseLink({comparisonIds:[first,first,second,third]})).comparisonIds,[first,second]);
});
test('reported zero, unknown, unset, blank and invalid labels do not collapse',()=>{
  assert.equal(numberLabel({status:'reported',reported:'0',value:0}),'0');
  assert.equal(numberLabel({status:'unknown',reported:'-8888',value:null}),'Unknown (-8888)');
  assert.equal(numberLabel({status:'unset',reported:'-9999',value:null}),'Unset (-9999)');
  assert.equal(numberLabel({status:'blank',reported:'',value:null}),'Blank');
  assert.equal(numberLabel({status:'invalid',reported:'nan',value:null}),'Invalid source value (nan)');
});
test('damage intervals do not become a midpoint or funnel measurement',()=>{
  const interval={minimum_m:0,maximum_m:400,reported_minimum:{status:'reported',reported:'0'},reported_maximum:{status:'reported',reported:'4'}};
  assert.equal(intervalLabel(interval),'Minimum: 0 m. Maximum: 400 m.');
  interval.minimum_m=null;interval.reported_minimum={status:'unknown',reported:'-8888'};
  assert.match(intervalLabel(interval),/Unknown \(-8888\)/);
});
test('detail source identity must match the selected case and source snapshot',()=>{
  const record={id:'jma:2000010101',classification_code:'1'};
  const source={snapshot_id:'jma:revision',sha256:'abc',url:'https://example.org/source.csv'};
  const detail={id:record.id,country_code:'JP',classification_code:'1',provenance:{...source,snapshot_id:source.snapshot_id,source_url:source.url}};
  assert.equal(validDetail(detail,record,source),true);
  for(const key of ['id','country_code','classification_code'])assert.equal(validDetail({...detail,[key]:'changed'},record,source),false);
  for(const key of ['snapshot_id','sha256','source_url'])assert.equal(validDetail({...detail,provenance:{...detail.provenance,[key]:'changed'}},record,source),false);
});
test('detail paths cannot select an external endpoint or traverse directories',()=>{
  assert.equal(detailPath({detail_file:'details/ab-0123456789abcdef0123.json'}),'jma-cases/details/ab-0123456789abcdef0123.json');
  for(const path of ['../index.json','https://example.org/source.json','details/ab-wrong.json','details\\ab-0123456789abcdef0123.json'])assert.throws(()=>detailPath({detail_file:path}),/unsupported detail path/);
});

const retainedIndex=JSON.parse(await readFile(new URL('../web/jma-cases/index.json',import.meta.url)));
const exportedRecords=[retainedIndex.records.find(record=>record.rating==='F1'),retainedIndex.records.find(record=>record.rating?.startsWith('JEF'))];
const exportedEntries=await Promise.all(exportedRecords.map(async record=>({record,
  detail:JSON.parse(await readFile(new URL('../web/jma-cases/'+record.detail_file,import.meta.url)))[record.id]})));

test('portable comparison retains the ordered complete source records and qualifications',()=>{
  const state={filters:{query:'東京都 + 100%',classCode:'6',rating:'unrated'},caseId:'jma:0000000000',panel:'list'};
  const text=comparisonExportText(retainedIndex,exportedEntries,state),portable=JSON.parse(text);
  assert.equal(portable.format,'tornado-atlas/jma-comparison');assert.equal(portable.schema_version,1);
  assert.deepEqual(portable.source,retainedIndex.source);
  assert.equal(portable.attribution,retainedIndex.attribution);assert.equal(portable.transformation,retainedIndex.transformation);
  assert.deepEqual(portable.qualifications,comparisonQualifications);
  assert.deepEqual(portable.cases.map(entry=>entry.index_record),exportedRecords);
  assert.deepEqual(portable.cases.map(entry=>entry.detail),exportedEntries.map(entry=>entry.detail));
  assert.deepEqual(portable.cases.map(entry=>entry.processed_detail_path),exportedRecords.map(detailPath));
  assert.deepEqual(portable.cases.map(entry=>entry.detail.rating.scale),['F','JEF']);
  assert.equal(portable.view_path,'japan.html'+writeCaseLink({...state,comparisonIds:exportedRecords.map(record=>record.id)}));
  assert.equal(comparisonExportText(retainedIndex,exportedEntries,state),text);
  assert.ok(text.endsWith('\n'));assert.ok(text.includes(exportedRecords[1].title));
  assert.equal('created_at' in portable,false);assert.equal('totals' in portable,false);
});

test('portable values are detached without changing input records or cached details',()=>{
  const before=JSON.stringify({index:retainedIndex,entries:exportedEntries}),portable=comparisonExport(retainedIndex,exportedEntries);
  portable.source.sha256='changed';portable.cases[0].index_record.title='changed';
  portable.cases[0].detail.time.begin.components[0].reported='changed';portable.qualifications.identity='changed';
  assert.equal(JSON.stringify({index:retainedIndex,entries:exportedEntries}),before);
  assert.notEqual(comparisonQualifications.identity,'changed');
});

test('incomplete duplicate unavailable and mismatched pairs refuse portable output',()=>{
  for(const entries of [null,[],exportedEntries.slice(0,1),[...exportedEntries,exportedEntries[0]],[exportedEntries[0],exportedEntries[0]]])
    assert.throws(()=>comparisonExportText(retainedIndex,entries));
  for(const missing of [{record:exportedRecords[0],detail:null},{record:{id:'jma:0000000000',case_id:'0000000000'},detail:exportedEntries[0].detail}])
    assert.throws(()=>comparisonExportText(retainedIndex,[missing,exportedEntries[1]]));
  for(const key of ['id','country_code','classification_code','source_record_id']){
    const changed=structuredClone(exportedEntries);changed[0].detail[key]='wrong';
    assert.throws(()=>comparisonExportText(retainedIndex,changed),/does not match/);
  }
  for(const key of ['snapshot_id','sha256','source_url']){
    const changed=structuredClone(exportedEntries);changed[1].detail.provenance[key]='wrong';
    assert.throws(()=>comparisonExportText(retainedIndex,changed),/does not match/);
  }
  const path=structuredClone(exportedEntries);path[0].record.detail_file='../private.json';
  assert.throws(()=>comparisonExportText(retainedIndex,path),/unsupported detail path/);
});

test('portable output refuses missing source metadata and bounds UTF-8 bytes',()=>{
  for(const source of [{...retainedIndex.source,sha256:'wrong'},{...retainedIndex.source,snapshot_id:''},{...retainedIndex.source,url:'https://example.org/source.csv'}])
    assert.throws(()=>comparisonExportText({...retainedIndex,source},exportedEntries),/source metadata/);
  assert.throws(()=>comparisonExportText({...retainedIndex,attribution:undefined},exportedEntries),/source metadata/);
  const changed=structuredClone(exportedEntries);changed[0].detail.narrative='雪'.repeat(400000);
  assert.ok(JSON.stringify(changed).length<1024*1024);
  assert.throws(()=>comparisonExportText(retainedIndex,changed),/one-megabyte/);
});
