import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

const index=JSON.parse(await readFile(new URL('../../web/jma-cases/index.json',import.meta.url)));
const tornadoes=index.records.filter(r=>r.classification_code==='1').sort((a,b)=>b.year-a.year||b.case_id.localeCompare(a.case_id));
const original=async record=>JSON.parse(await readFile(new URL('../../web/jma-cases/'+record.detail_file,import.meta.url)))[record.id];
const caseButton=(page,id)=>page.locator('[data-case="'+id+'"]');
async function open(page,suffix=''){
 await page.goto(base+'/japan.html'+suffix);
 await page.waitForFunction(()=>document.body.dataset.ready==='true');
}
async function ready(page,record){
 await page.waitForFunction(id=>document.querySelector('#case-detail .eyebrow')?.textContent===id&&document.querySelector('#case-detail a')?.textContent==='Read the original JMA case CSV',record.case_id);
}
test('retained counts, default tornado class and bounded pagination',async t=>{
 const page=await fixture(t);await open(page);
 assert.match(await page.locator('#case-coverage').innerText(),/2,912.*1,576/);
 assert.equal(await page.locator('[data-case]').count(),20);
 assert.equal(await page.locator('[data-case]').first().getAttribute('data-case'),tornadoes[0].id);
 await page.locator('#case-next-page').click();
 assert.equal(await page.locator('[data-case]').first().getAttribute('data-case'),tornadoes[20].id);
 await page.locator('#case-prev-page').click();
 assert.equal(await page.locator('[data-case]').first().getAttribute('data-case'),tornadoes[0].id);
 await page.locator('#case-class').selectOption('6');
 assert.match(await page.locator('#case-results-count').innerText(),/^878 matching cases/);
 await page.locator('#case-class').selectOption('all');
 assert.match(await page.locator('#case-results-count').innerText(),/^2,912 matching cases/);
});
test('Japanese literal search and rating filters preserve class distinctions',async t=>{
 const page=await fixture(t);await open(page);
 const target=tornadoes.find(r=>r.rating?.startsWith('JEF'));
 await page.locator('#case-query').fill(target.case_id);
 await page.locator('#case-query').press('Enter');
 assert.equal(await page.locator('[data-case]').count(),1);
 assert.equal(await caseButton(page,target.id).locator('strong').getAttribute('lang'),'ja');
 await caseButton(page,target.id).click();await ready(page,target);
 await page.locator('#case-back').click();
 await page.locator('#case-query').fill('no such place [not a regex]');
 await page.locator('#case-query').press('Enter');
 assert.match(await page.locator('#case-results').innerText(),/No source cases match/);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await page.locator('#case-rating').selectOption(target.rating);
 assert.match(await page.locator('[data-case]').first().innerText(),new RegExp(target.rating));
 assert.equal(await page.locator('#case-class').inputValue(),'1');
});
test('details retain reported fields, uncertainty and full source provenance',async t=>{
 const page=await fixture(t);const target=tornadoes.find(r=>r.rating?.startsWith('JEF'));const detail=await original(target);
 await open(page,'#case='+encodeURIComponent(target.id));await ready(page,target);
 for(const summary of await page.locator('#case-detail summary').all())await summary.click();
 const text=await page.locator('#case-detail').innerText();
 assert.ok(text.includes(detail.classification_reported));
 assert.ok(text.includes('Timezone')&&text.includes('Unresolved in this adapter'));
 assert.ok(text.includes('Not performed')&&text.includes('Damage length, meters'));
 assert.ok(text.includes('Shared-scope source cell:'));
 assert.ok((await page.locator('#case-detail').innerText()).includes(index.source.sha256));
 assert.equal(await page.locator('#case-detail a').first().getAttribute('href'),index.source.url);
 assert.equal(await page.locator('#case-detail a').first().getAttribute('rel'),'noopener noreferrer');
});
test('selection on a later page survives list view reload and Back/Forward',async t=>{
 const page=await fixture(t,{viewport:{width:390,height:844}});await open(page);
 await page.locator('#case-next-page').click();const target=tornadoes[20];
 await caseButton(page,target.id).click();await ready(page,target);
 await page.locator('#case-back').click();
 assert.equal(await page.locator('#case-layout').getAttribute('data-panel'),'list');
 await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');await ready(page,target);
 assert.equal(await page.locator('#case-layout').getAttribute('data-panel'),'list');
 assert.equal(await caseButton(page,target.id).getAttribute('aria-pressed'),'true');
 await page.locator('#case-record-view').click();
 await page.locator('#case-next').click();await ready(page,tornadoes[21]);
 await page.goBack();await ready(page,target);
 await page.goForward();await ready(page,tornadoes[21]);
 assert.equal(await page.locator('#case-layout').getAttribute('data-panel'),'detail');
});
test('selected outside-filter case and unavailable incoming filters keep their meaning',async t=>{
 const page=await fixture(t);const target=index.records.find(r=>r.classification_code==='6');
 await open(page,'?class=1#case='+encodeURIComponent(target.id));await ready(page,target);
 assert.equal(await page.locator('#case-outside-filters').isVisible(),true);
 assert.equal(await page.locator('#case-next').isEnabled(),false);
 await open(page,'?class=unknown-code&rating=unknown-rating#case=jma%3A0000000000');
 assert.equal(await page.locator('#case-class').inputValue(),'unknown-code');
 assert.match(await page.locator('#case-detail').innerText(),/Source case not found/);
 assert.ok(page.url().includes('jma%3A0000000000'));
});
test('old detail success cannot replace a newer selected record',async t=>{
 const page=await fixture(t);let release,started;
 const held=new Promise(r=>release=r),seen=new Promise(r=>started=r);
 const first=tornadoes[0],second=tornadoes.slice(1,20).find(r=>r.detail_file!==first.detail_file);
 await page.route('**/jma-cases/'+first.detail_file,async route=>{started();await held;await route.continue();});
 t.after(()=>release());
 await open(page);await caseButton(page,first.id).click();await seen;
 await caseButton(page,second.id).click();await ready(page,second);
 release();
 await page.waitForResponse(response=>response.url().endsWith(first.detail_file));
 await page.waitForTimeout(50);
 assert.equal(await page.locator('#case-detail .eyebrow').innerText(),second.case_id);
});
test('failed detail can retry while original source remains usable',async t=>{
 const page=await fixture(t);const target=tornadoes[0];let fail=true;
 await page.route('**/jma-cases/'+target.detail_file,route=>fail?route.fulfill({status:503,body:'unavailable'}):route.continue());
 await open(page);await caseButton(page,target.id).click();
 await page.getByRole('button',{name:'Retry this case'}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Original JMA source',exact:true}).getAttribute('href'),index.source.url);
 fail=false;await page.getByRole('button',{name:'Retry this case'}).click();await ready(page,target);
 assert.equal(await page.getByRole('button',{name:'Retry this case'}).count(),0);
});
test('failed collection keeps official sources and offers a successful reload',async t=>{
 const page=await fixture(t);let fail=true;
 await page.route('**/jma-cases/index.json',route=>fail?route.fulfill({status:503,body:'unavailable'}):route.continue());
 await page.goto(base+'/japan.html');await page.locator('#case-load-error').waitFor();
 assert.equal(await page.locator('#case-query').isEnabled(),false);
 await page.locator('.jma-source-note').first().locator('summary').click();
 assert.equal(await page.getByRole('link',{name:'JMA database and collection criteria'}).isVisible(),true);
 fail=false;await page.locator('#case-reload').click();await page.waitForFunction(()=>document.body.dataset.ready==='true');
 assert.equal(await page.locator('#case-query').isEnabled(),true);
 assert.equal(await page.locator('[data-case]').count(),20);
});
test('phone widths in Clair and Obscur preserve readable record and controls',async t=>{
 const page=await fixture(t);
 for(const width of [320,390])for(const appearance of ['dark','light']){
  await page.setViewportSize({width,height:844});await open(page);
  await page.locator('#reading-appearance').selectOption(appearance);
  await caseButton(page,tornadoes[0].id).click();await ready(page,tornadoes[0]);
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
   panel:document.getElementById('case-panel').getBoundingClientRect().width,
   controls:[...document.querySelectorAll('#case-panel button')].map(n=>({height:n.getBoundingClientRect().height,right:n.getBoundingClientRect().right}))}));
  assert.ok(metrics.scroll<=width,'No horizontal overflow at '+width+'/'+appearance);
  assert.ok(metrics.panel>0&&metrics.panel<=width);
  assert.ok(metrics.controls.every(n=>n.height>=44&&n.right<=width));
  await page.locator('#case-back').click();
  assert.equal(await page.locator('#case-browse').isVisible(),true);
  assert.equal(await page.locator('#case-panel').isVisible(),false);
 }
});
