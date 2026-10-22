import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,open,search,detail} from './harness.mjs';

const frozen=JSON.parse(await readFile(new URL('../fixtures/catalogue-dossier-discovery.json',import.meta.url),'utf8'));
const published=JSON.parse(await readFile(new URL('../../web/catalogue/index.json',import.meta.url),'utf8'));
const identifiers=new Set([...frozen.groups.flatMap(group=>group.records),frozen.unrelated_record]);
const records=published.records.filter(row=>identifiers.has(row.id));
assert.equal(records.length,15,'All fourteen published associations and the ordinary control must exist');
const byYear={};for(const record of records)byYear[record.year]=(byYear[record.year]??0)+1;

async function selectedCatalogue(t,width){
  const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
  // This controlled fifteen-record response uses actual published annotation
  // values. It tests the existing consumer, not full-catalogue payload costs.
  // Full-payload local/public acceptance needs its own declared workload.
  await page.route('**/catalogue/index.json.gz',route=>route.fulfill({status:404,body:'Use selected published JSON records'}));
  await page.route('**/catalogue/index.json',route=>route.fulfill({json:{records,coverage:{by_year:byYear}}}));
  await open(page,'&exhibits=1&panel=list');
  return page;
}

async function listView(page){
  if(await page.locator('#back-list').isVisible())await page.locator('#back-list').click();
  else if(await page.locator('#show-list').isVisible())await page.locator('#show-list').click();
}

async function results(page,ids){
  await page.waitForFunction(expected=>{
    const actual=[...document.querySelectorAll('#results [data-record]')].map(row=>row.dataset.record).sort();
    return JSON.stringify(actual)===JSON.stringify([...expected].sort());
  },ids);
}

async function catalogueState(page,group,id){
  await detail(page,id);
  assert.equal(await page.locator('#query').inputValue(),group.query);
  assert.equal(await page.locator('#exhibits').isChecked(),true);
  const url=new URL(page.url());
  assert.equal(url.searchParams.get('q'),group.query);
  assert.equal(url.searchParams.get('exhibits'),'1');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('record'),id);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}

for(const width of [320,1280])test('published dossier links preserve catalogue reading state at '+width,async t=>{
  const page=await selectedCatalogue(t,width);
  await results(page,[...identifiers].filter(id=>id!==frozen.unrelated_record));
  for(const theme of ['dark','light']){
    await page.locator('#reading-appearance').selectOption(theme);
    for(const group of frozen.groups){
      await listView(page);await search(page,group.query);await results(page,group.records);
      for(const id of group.records){
        await listView(page);
        const record=page.locator('#results [data-record="'+id+'"]');
        await record.focus();await record.press('Enter');
        await catalogueState(page,group,id);
        const article=page.getByRole('link',{name:'Open reviewed exhibit',exact:true});
        assert.equal(new URL(await article.getAttribute('href'),page.url()).pathname,'/'+group.route);
        // The first theme follows all six actual article routes and native
        // Back/Forward. Both themes inspect every one of the fourteen links.
        if(theme==='dark'&&id===group.records[0]){
          await article.focus();await article.press('Enter');
          await page.waitForURL(url=>url.pathname==='/'+group.route);
          assert.equal(await page.locator('h1').count(),1);
          await page.goBack();await page.waitForFunction(()=>document.body.dataset.ready==='true');
          await catalogueState(page,group,id);
          await page.goForward();await page.waitForURL(url=>url.pathname==='/'+group.route);
          await page.goBack();await page.waitForFunction(()=>document.body.dataset.ready==='true');
          await catalogueState(page,group,id);
        }
      }
    }
  }
  const last=frozen.groups.at(-1),id=last.records.at(-1);
  await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');
  await catalogueState(page,last,id);
  const link=await page.locator('#search-link').getAttribute('href');
  assert.equal(new URLSearchParams(new URL(link,page.url()).hash.slice(1)).get('record'),id);
  await listView(page);await search(page,frozen.unrelated_record);await results(page,[]);
});
