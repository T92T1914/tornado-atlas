import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,open,detail} from './harness.mjs';

// A small synthetic catalogue isolates page ownership from historical data,
// map positions, external media and source-provider availability.
const records=Array.from({length:41},(_,index)=>({
  id:`fixture:${String(index).padStart(3,'0')}`,title:`Synthetic source ${index}`,
  aliases:[],state:'FIXTURE',area:'SYNTHETIC',rating:null,year:2026,date:'2026-01-01',
  point:null,exhibit:null,detail_file:'details/page-selection.json',
}));
const details=Object.fromEntries(records.map(record=>[record.id,{
  id:record.id,narrative:'Synthetic account for navigation verification.',
  spatial:{begin_point:null,end_point:null},time:{begin:{reported:'Not reported'}},
  dimensions:{reported_length_miles:null,reported_width_yards:null},
  impacts:{deaths_direct:null,injuries_direct:null,property_damage:{reported:null}},
  provenance:{source_url:'https://example.invalid/synthetic.csv',snapshot_id:'synthetic-page-selection',csv_record:null,retrieved_at:'Synthetic'},
  quality_notes:[],
}]));

async function catalogue(t){
  const page=await fixture(t,{viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.route('**/catalogue/index.json.gz',route=>route.fulfill({status:404,body:'Use the synthetic JSON fixture'}));
  await page.route('**/catalogue/index.json',route=>route.fulfill({json:{records,coverage:{by_year:{2026:records.length}}}}));
  await page.route('**/catalogue/media.json',route=>route.fulfill({json:{records:{}}}));
  await page.route('**/catalogue/details/page-selection.json',route=>route.fulfill({json:details}));
  return page;
}

async function selectedResult(page,id,count){
  assert.equal(await page.locator('#page-count').textContent(),count);
  const row=page.locator(`#results [data-record="${id}"]`);
  assert.equal(await row.count(),1,'Back to results must show the selected source row');
  assert.equal(await row.getAttribute('aria-pressed'),'true');
  assert.equal(await row.evaluate(node=>document.activeElement===node),true,'Back to results must focus the selected source row');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}

test('record stepping across a result-page boundary returns to the selected source',async t=>{
  const page=await catalogue(t);await open(page,'&panel=list');
  await page.locator('#next-page').click();
  await page.locator('#results [data-record="fixture:039"]').click();await detail(page,'fixture:039');
  await page.locator('#next-record').click();await detail(page,'fixture:040');
  await page.locator('#back-list').click();
  await selectedResult(page,'fixture:040','41-41 of 41');
  await page.locator('#show-detail').click();await page.locator('#prev-record').click();await detail(page,'fixture:039');
  await page.locator('#back-list').click();
  await selectedResult(page,'fixture:039','21-40 of 41');
  // Ordinary pagination remains available, while an explicit return to the
  // selected source must reveal it again rather than focus an absent row.
  await page.locator('#next-page').click();
  await page.locator('#show-detail').click();await page.locator('#back-list').click();
  await selectedResult(page,'fixture:039','21-40 of 41');
});

test('a reopened later source returns to its result page without a saved page parameter',async t=>{
  const page=await catalogue(t);await open(page,'&panel=detail#record=fixture%3A040');
  await detail(page,'fixture:040');
  assert.equal(new URL(page.url()).searchParams.has('page'),false);
  await page.locator('#back-list').click();
  await selectedResult(page,'fixture:040','41-41 of 41');
});

test('a selected source outside restrictive filters keeps an empty result page',async t=>{
  const page=await catalogue(t);await open(page,'&year=2099&panel=detail#record=fixture%3A040');
  await detail(page,'fixture:040');
  assert.equal(await page.locator('#outside-filter-notice').isVisible(),true);
  await page.locator('#back-list').click();
  assert.equal(await page.locator('#page-count').textContent(),'0 records');
  assert.equal(await page.locator('#results [data-record]').count(),0);
  assert.equal(await page.locator('#prev-page').isDisabled(),true);
  assert.equal(await page.locator('#next-page').isDisabled(),true);
  assert.equal(await page.locator('#detail .eyebrow').textContent(),'fixture:040');
});
