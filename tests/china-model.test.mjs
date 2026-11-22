import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dateLabel,timeLabel,positionLabel,ratingLabel,filterCases,readLink,writeLink} from '../web/china-model.mjs';

const index=JSON.parse(await readFile(new URL('../web/china-cases/index.json',import.meta.url)));

test('date ranges read as approximate and single dates stay plain',()=>{
  assert.equal(dateLabel({kind:'approximate_date_range',first:'2018-03-04',last:'2018-03-05'}),'2018-03-04 to 2018-03-05, approximate dates of occurrence');
  assert.equal(dateLabel({kind:'single_date',first:'2019-02-18',last:'2019-02-18'}),'2019-02-18');
});
test('times keep UTC+8 as recorded and never claim UTC',()=>{
  assert.equal(timeLabel({kind:'clock_time',local:'16:30'}),'16:30 UTC+8, as recorded');
  assert.equal(timeLabel({kind:'period_of_day',reported:'afternoon'}),'afternoon, UTC+8, as recorded');
  assert.equal(timeLabel({kind:'not_recorded'}),'Not recorded');
  assert.ok(index.records.every(record=>!/UTC(?!\+8)/.test(timeLabel(record.start_time))));
});
test('positions are labeled geocoded and missing ones say so',()=>{
  assert.equal(positionLabel({point:[110.630487,19.849082]}),'19.8491° N, 110.6305° E, geocoded from the place description');
  assert.equal(positionLabel({point:null}),'No geocoded position');
  assert.equal(index.records.filter(record=>positionLabel(record.position)==='No geocoded position').length,2);
});
test('ratings say whose they are',()=>{
  assert.equal(ratingLabel({reported:'EF2'}),'EF2, as the dataset reports');
  assert.equal(ratingLabel({reported:null}),'Unrated in the dataset');
});
test('filters search labels and dates and order newest first',()=>{
  const all=filterCases(index.records);
  assert.equal(all.length,738);
  assert.ok(all.every((record,i)=>i===0||all[i-1].year>record.year||(all[i-1].year===record.year&&all[i-1].sequence<record.sequence)));
  assert.equal(filterCases(index.records,{query:'China_tornado_1 '}).filter(r=>r.case_label==='China_tornado_1').length,1);
  assert.deepEqual(filterCases(index.records,{query:'China_tornado_1 2019-02-18'}).map(r=>r.id),['cn-zhang:1']);
  assert.equal(filterCases(index.records,{query:'2016'}).length,20);
  assert.ok(index.records.every(record=>!('location' in record)&&!('time_note' in record)));
  assert.equal(filterCases(index.records,{rating:'unrated'}).length,345);
  assert.equal(filterCases(index.records,{rating:'EF4'}).length,2);
});
test('links keep only supported filters',()=>{
  assert.deepEqual(readLink('?q=Hainan&rating=EF3'),{query:'Hainan',rating:'EF3'});
  assert.deepEqual(readLink('?rating=F9'),{query:'',rating:''});
  assert.equal(writeLink({query:'Hainan',rating:'unrated'}),'?q=Hainan&rating=unrated');
  assert.equal(writeLink({}),'');
});
