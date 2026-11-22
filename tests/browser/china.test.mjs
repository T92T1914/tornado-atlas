import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

const index=JSON.parse(await readFile(new URL('../../web/china-cases/index.json',import.meta.url)));
const ordered=[...index.records].sort((a,b)=>b.year-a.year||a.sequence-b.sequence);
const card=(page,id)=>page.locator('[data-case="'+id+'"]');
async function open(page,suffix=''){
  await page.goto(base+'/china.html'+suffix);
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
}
async function only(page,record){
  // A label such as China_tornado_1 also matches 10 to 199, so the date narrows it.
  await page.locator('#china-query').fill(record.case_label+' '+record.recorded_date.reported);
  await page.locator('#china-query').press('Enter');
  await card(page,record.id).waitFor();
  return card(page,record.id);
}

test('counts, order and the geocoded and UTC+8 labels',async t=>{
  const page=await fixture(t);await open(page);
  assert.match(await page.locator('#china-coverage').innerText(),/^738 source cases from 2003 to 2019\. 736 have a geocoded position and 47 give an approximate date range\./);
  assert.equal(await page.locator('[data-case]').count(),20);
  assert.equal(await page.locator('[data-case]').first().getAttribute('data-case'),ordered[0].id);
  const clock=index.records.find(record=>record.start_time.kind==='clock_time'&&record.position.point);
  const shown=await only(page,clock);
  const text=await shown.innerText();
  assert.ok(text.includes(clock.start_time.local+' UTC+8, as recorded'));
  assert.match(text,/geocoded from the place description/);
  assert.equal(await shown.locator('h3').innerText(),clock.case_label);
  assert.equal(await page.locator('[data-case] [lang|=zh]').count(),0);
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-case]').length===20);
  await page.locator('#china-next-page').click();
  assert.equal(await page.locator('[data-case]').first().getAttribute('data-case'),ordered[20].id);
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.case),ordered[20].id);
});

test('date ranges read as approximate and words of the day stay as recorded',async t=>{
  const page=await fixture(t);await open(page);
  const range=index.records.find(record=>record.recorded_date.approximate);
  const ranged=await only(page,range);
  assert.match(await ranged.innerText(),new RegExp(range.recorded_date.first+' to '+range.recorded_date.last+', approximate dates of occurrence'));
  assert.equal(await ranged.getAttribute('data-approximate'),'true');
  const period=index.records.find(record=>record.start_time.kind==='period_of_day');
  const worded=await only(page,period);
  assert.ok((await worded.innerText()).includes(period.start_time.reported+', UTC+8, as recorded'));
  const missing=index.records.find(record=>!record.position.point);
  assert.match(await (await only(page,missing)).innerText(),/No geocoded position/);
});

test('filters live in the link and the credit names the creators and license',async t=>{
  const page=await fixture(t);await open(page,'?rating=EF4');
  assert.equal(await page.locator('#china-rating').inputValue(),'EF4');
  assert.match(await page.locator('#china-results-count').innerText(),/^2 matching cases \/ 738 source cases/);
  await page.locator('#china-provenance summary').click();
  const provenance=await page.locator('#china-source').innerText();
  for(const creator of index.source.creators)assert.ok(provenance.includes(creator),creator);
  for(const column of index.omitted_columns)assert.ok(provenance.includes(column),column);
  assert.equal(await page.locator('#china-source a[href="https://creativecommons.org/licenses/by/4.0/"]').count(),1);
  assert.equal(await page.locator('footer a[href="https://doi.org/10.4121/19801633.v2"]').count(),1);
  assert.equal(await page.locator('.museum-nav a[href="china.html"][aria-current=page]').count(),1);
});

test('a phone width keeps every case inside the screen',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});await open(page);
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
    widest:Math.max(...[...document.querySelectorAll('[data-case]')].map(node=>node.getBoundingClientRect().right))}));
  assert.ok(layout.scroll<=layout.width+1,JSON.stringify(layout));
  assert.ok(layout.widest<=layout.width+1,JSON.stringify(layout));
});
