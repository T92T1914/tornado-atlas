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
const compared=(page,id)=>page.locator('[data-comparison-case="'+id+'"]');
async function comparisonReady(page,record){await compared(page,record.id).locator('[lang=ja]').first().waitFor();await page.waitForFunction(id=>document.querySelector('[data-comparison-case="'+id+'"]')?.dataset.state==='ready',record.id);}
const comparisonQuery=records=>'?'+new URLSearchParams(records.map(record=>['compare',record.id])).toString();
async function downloadedComparison(page,action=()=>page.locator('#case-comparison-download').click()){
 const event=page.waitForEvent('download');await action();const download=await event;
 assert.equal(await download.failure(),null);
 const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
 const bytes=Buffer.concat(chunks),text=bytes.toString('utf8');
 assert.ok(bytes.length<=1024*1024);assert.ok(text.endsWith('\n'));
 return {value:JSON.parse(text),bytes,filename:download.suggestedFilename()};
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
 fail=false;
 await Promise.all([page.waitForEvent('domcontentloaded'),page.locator('#case-reload').click()]);
 await page.waitForFunction(()=>document.body?.dataset.ready==='true');
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
test('retain an F and JEF case while browsing, with source bounds and provenance',async t=>{
 const page=await fixture(t),jef=tornadoes.find(r=>r.rating?.startsWith('JEF')),f=tornadoes.find(r=>r.rating==='F1');
 await open(page,'#case='+encodeURIComponent(jef.id));await ready(page,jef);
 await page.locator('#case-compare-add').click();await comparisonReady(page,jef);
 await page.locator('#case-back').click();await page.locator('#case-query').fill(f.case_id);await page.locator('#case-query').press('Enter');
 await caseButton(page,f.id).click();await ready(page,f);
 await page.locator('#case-compare-add').click();await comparisonReady(page,f);
 assert.equal(await page.locator('[data-comparison-case]').count(),2);
 assert.equal(await page.locator('#case-compare-add').isEnabled(),false);
 assert.deepEqual(new URL(page.url()).searchParams.getAll('compare'),[jef.id,f.id]);
 for(const record of [jef,f]){
  const card=compared(page,record.id),detail=await original(record);
  for(const summary of await card.locator('summary').all())await summary.click();
  const text=await card.innerText();
  assert.ok(text.includes(detail.classification_reported));
  assert.ok(text.includes('Reported scale\n'+detail.rating.scale));
  assert.ok(text.includes('Minimum category\n'+detail.rating.source_minimum.reported));
  assert.ok(text.includes('Maximum category\n'+detail.rating.source_maximum.reported));
  assert.ok(text.includes('Beginning uncertainty, minus minutes\n'+detail.time.begin.uncertainty_minus_minutes.reported));
  assert.ok(text.includes('UTC conversion\nNot performed'));
  assert.ok(text.includes(detail.provenance.sha256));
  assert.ok(text.includes('Shared-scope source cell:')&&text.includes('Not aggregated.'));
  assert.equal(await card.getByRole('link',{name:'Read the original JMA case CSV',exact:true}).getAttribute('href'),index.source.url);
 }
 const fText=await compared(page,f.id).innerText();
 assert.ok(fText.includes('Minimum: 100 m. Maximum: 100 m.')&&fText.includes('Minimum: 1500 m. Maximum: 1500 m.'));
 assert.ok(fText.includes('Unknown (-8888)'));
 assert.equal(await page.locator('[id="case-outside-filters"]').count(),1);
});
test('comparison survives filters, selected record, reload and removal history',async t=>{
 const page=await fixture(t,{viewport:{width:390,height:844}}),first=tornadoes[0],second=tornadoes[1];
 await open(page,comparisonQuery([first,second])+'&class=6#case='+encodeURIComponent(first.id));
 await comparisonReady(page,first);await comparisonReady(page,second);
 await page.locator('#case-back').click();await page.locator('#case-class').selectOption('all');
 await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');
 await comparisonReady(page,first);await comparisonReady(page,second);
 assert.equal(await page.locator('#case-layout').getAttribute('data-panel'),'list');
 await compared(page,second.id).getByRole('button',{name:'Remove case '+second.case_id+' from comparison',exact:true}).click();
 assert.deepEqual(new URL(page.url()).searchParams.getAll('compare'),[first.id]);
 await page.goBack();await comparisonReady(page,second);
 assert.equal(await page.locator('[data-comparison-case]').count(),2);
 await page.goForward();await comparisonReady(page,first);
 assert.equal(await page.locator('[data-comparison-case]').count(),1);
 await page.locator('#case-comparison-clear').click();assert.equal(await page.locator('#case-comparison').isVisible(),false);
 assert.equal(new URL(page.url()).searchParams.has('compare'),false);
});
test('uncertain and unavailable comparison cases remain separate and removable',async t=>{
 const page=await fixture(t),uncertain=index.records.find(r=>r.classification_code==='6'),missing={id:'jma:0000000000'};
 await open(page,comparisonQuery([uncertain,missing]));await comparisonReady(page,uncertain);
 assert.ok((await compared(page,uncertain.id).innerText()).includes('not counted as an explicitly classified tornado'));
 assert.ok((await compared(page,uncertain.id).innerText()).includes('Unset (-9999)'));
 assert.equal(await compared(page,missing.id).getAttribute('data-state'),'unavailable');
 assert.ok((await compared(page,missing.id).innerText()).includes('Source case not found'));
 await compared(page,missing.id).getByRole('button',{name:'Remove case '+missing.id+' from comparison',exact:true}).click();
 assert.equal(await page.locator('[data-comparison-case]').count(),1);
 assert.equal(await page.locator('#case-layout').getAttribute('data-panel'),'list');
});

test('unavailable selected case canonicalizes comparison links and history',async t=>{
 const page=await fixture(t),pair=tornadoes.slice(0,2),missing='jma:0000000000';
 const params=new URLSearchParams([['compare',pair[0].id],['compare',pair[0].id],['compare','not-a-case'],['compare',pair[1].id],['compare',tornadoes[2].id]]);
 await open(page,'?'+params+'#case='+encodeURIComponent(missing));
 for(const record of pair)await comparisonReady(page,record);
 const check=async()=>{
  const saved=new URL(await page.locator('#case-view-link').getAttribute('href'),page.url());
  assert.deepEqual(saved.searchParams.getAll('compare'),pair.map(r=>r.id));
  assert.equal(new URLSearchParams(saved.hash.slice(1)).get('case'),missing);
  assert.deepEqual(new URL(page.url()).searchParams.getAll('compare'),pair.map(r=>r.id));
 };
 await check();await page.locator('#case-class').selectOption('all');
 await page.goBack();for(const record of pair)await comparisonReady(page,record);await check();
 await page.goForward();for(const record of pair)await comparisonReady(page,record);await check();
 await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');await check();
 assert.match(await page.locator('#case-detail').innerText(),/Source case not found/);
});
test('failed or mismatched comparison detail retries without losing the other source',async t=>{
 const page=await fixture(t),first=tornadoes[0],second=tornadoes.find(r=>r.detail_file!==first.detail_file);let mode='failed';
 const mismatched=JSON.parse(await readFile(new URL('../../web/jma-cases/'+second.detail_file,import.meta.url)));
 mismatched[second.id].provenance.sha256='wrong-source';
 await page.route('**/jma-cases/'+second.detail_file,route=>mode==='failed'?route.fulfill({status:503,body:'unavailable'}):mode==='mismatched'?route.fulfill({contentType:'application/json',body:JSON.stringify(mismatched)}):route.continue());
 await open(page,comparisonQuery([first,second]));await comparisonReady(page,first);
 const card=compared(page,second.id);assert.equal(await card.getAttribute('data-state'),'failed');
 assert.equal(await card.getByRole('link',{name:'Original JMA source',exact:true}).getAttribute('href'),index.source.url);
 const firstSource=compared(page,first.id).getByText('Case provenance and parser notes',{exact:true});await firstSource.click();
 const retry=card.getByRole('button',{name:'Retry comparison case '+second.case_id,exact:true});
 mode='mismatched';await retry.focus();await retry.press('Enter');
 await page.waitForFunction(id=>document.querySelector('[data-comparison-case="'+id+'"]')?.dataset.state==='failed',second.id);
 assert.equal(await card.evaluate(node=>document.activeElement===node),true);
 assert.ok((await card.innerText()).includes('does not match this retained source case'));
 mode='ready';await retry.focus();await retry.press('Enter');
 await comparisonReady(page,first);await comparisonReady(page,second);
 assert.equal(await card.evaluate(node=>document.activeElement===node),true);
 assert.equal(await firstSource.locator('..').getAttribute('open'),'');
 assert.equal(await page.locator('[data-comparison-case]').count(),2);
});
test('removed comparison cannot return when its old request completes',async t=>{
 const page=await fixture(t),first=tornadoes[0],second=tornadoes.find(r=>r.detail_file!==first.detail_file);let release,started;
 const held=new Promise(r=>release=r),seen=new Promise(r=>started=r);t.after(()=>release());
 await page.route('**/jma-cases/'+second.detail_file,async route=>{started();await held;await route.continue();});
 await page.goto(base+'/japan.html'+comparisonQuery([first,second]));await seen;await comparisonReady(page,first);
 await compared(page,second.id).getByRole('button',{name:'Remove case '+second.case_id+' from comparison',exact:true}).click();
 const response=page.waitForResponse(response=>response.url().endsWith(second.detail_file));release();await response;
 await page.waitForFunction(()=>document.body.dataset.ready==='true');
 assert.equal(await compared(page,second.id).count(),0);
 assert.deepEqual(new URL(page.url()).searchParams.getAll('compare'),[first.id]);
});
test('two comparison cards keep keyboard controls and both appearances at phone widths',async t=>{
 const page=await fixture(t),pair=[tornadoes[0],tornadoes.find(r=>r.rating==='F1')];
 for(const width of [320,390])for(const appearance of ['dark','light']){
  await page.setViewportSize({width,height:844});await open(page,comparisonQuery(pair));
  await page.locator('#reading-appearance').selectOption(appearance);for(const record of pair)await comparisonReady(page,record);
  const metrics=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('#case-comparison button')].map(n=>({height:n.getBoundingClientRect().height,right:n.getBoundingClientRect().right})),cards:[...document.querySelectorAll('[data-comparison-case]')].map(n=>n.getBoundingClientRect().width)}));
  assert.ok(metrics.scroll<=width,'No comparison overflow at '+width+'/'+appearance);
  assert.ok(metrics.controls.every(n=>n.height>=44&&n.right<=width));assert.ok(metrics.cards.every(value=>value>0&&value<=width));
  const inspect=compared(page,pair[1].id).getByRole('button',{name:'Inspect case '+pair[1].case_id,exact:true});
  await inspect.focus();await page.keyboard.press('Enter');await ready(page,pair[1]);
  assert.equal(await page.locator('#case-layout').getAttribute('data-panel'),'detail');
  assert.deepEqual(new URL(page.url()).searchParams.getAll('compare'),pair.map(r=>r.id));
 }
});

test('download an exact ordered F and JEF pair after browsing and reload',async t=>{
 const page=await fixture(t,{acceptDownloads:true}),jef=tornadoes.find(record=>record.rating?.startsWith('JEF')),f=tornadoes.find(record=>record.rating==='F1');
 await open(page,'#case='+encodeURIComponent(jef.id));await ready(page,jef);
 await page.locator('#case-compare-add').click();await comparisonReady(page,jef);
 assert.equal(await page.locator('#case-comparison-download').isEnabled(),false);
 await page.locator('#case-back').click();await page.locator('#case-query').fill(f.case_id);await page.locator('#case-query').press('Enter');
 await caseButton(page,f.id).click();await ready(page,f);await page.locator('#case-compare-add').click();await comparisonReady(page,f);
 const exported=await downloadedComparison(page),pair=[jef,f];
 assert.equal(exported.filename,'jma-comparison-'+pair.map(record=>record.case_id).join('-')+'.json');
 assert.deepEqual(exported.value.source,index.source);assert.equal(exported.value.attribution,index.attribution);
 assert.equal(exported.value.transformation,index.transformation);
 assert.deepEqual(exported.value.cases.map(entry=>entry.index_record),pair);
 assert.deepEqual(exported.value.cases.map(entry=>entry.detail),await Promise.all(pair.map(original)));
 assert.deepEqual(exported.value.cases.map(entry=>entry.detail.rating.scale),['JEF','F']);
 assert.match(exported.value.qualifications.identity,/not a merged event/);
 const relative=new URL(exported.value.view_path,page.url());assert.equal(relative.origin,new URL(base).origin);
 assert.deepEqual(relative.searchParams.getAll('compare'),pair.map(record=>record.id));
 assert.equal(relative.searchParams.get('q'),f.case_id);
 assert.equal(new URLSearchParams(relative.hash.slice(1)).get('case'),f.id);
 const unchanged=await downloadedComparison(page);assert.deepEqual(unchanged.bytes,exported.bytes);
 await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');for(const record of pair)await comparisonReady(page,record);
 assert.deepEqual((await downloadedComparison(page)).bytes,exported.bytes);
 assert.equal(await page.locator('#case-detail .eyebrow').innerText(),f.case_id);
});

test('download remains disabled through failure mismatch missing slot and recovery',async t=>{
 const page=await fixture(t,{acceptDownloads:true}),first=tornadoes[0],second=tornadoes.find(record=>record.detail_file!==first.detail_file);let mode='failed';
 const mismatched=JSON.parse(await readFile(new URL('../../web/jma-cases/'+second.detail_file,import.meta.url)));
 mismatched[second.id].provenance.sha256='wrong-source';
 await page.route('**/jma-cases/'+second.detail_file,route=>mode==='failed'?route.fulfill({status:503,body:'unavailable'}):mode==='mismatched'?route.fulfill({contentType:'application/json',body:JSON.stringify(mismatched)}):route.continue());
 await open(page,comparisonQuery([first,second]));await comparisonReady(page,first);
 const control=page.locator('#case-comparison-download'),retry=compared(page,second.id).getByRole('button',{name:'Retry comparison case '+second.case_id,exact:true});
 assert.equal(await control.isEnabled(),false);assert.match(await page.locator('#case-comparison-download-note').innerText(),/cannot be exported as a partial pair/);
 mode='mismatched';await retry.click();await page.waitForFunction(id=>document.querySelector('[data-comparison-case="'+id+'"]')?.dataset.state==='failed',second.id);
 assert.equal(await control.isEnabled(),false);assert.match(await compared(page,second.id).innerText(),/does not match/);
 mode='ready';await retry.focus();await retry.press('Enter');await comparisonReady(page,second);
 assert.equal(await control.isEnabled(),true);assert.equal(await compared(page,second.id).evaluate(node=>document.activeElement===node),true);
 assert.deepEqual((await downloadedComparison(page)).value.cases.map(entry=>entry.detail),await Promise.all([first,second].map(original)));
 await open(page,comparisonQuery([first,{id:'jma:0000000000'}]));await comparisonReady(page,first);
 assert.equal(await control.isEnabled(),false);
 assert.equal(await compared(page,'jma:0000000000').getAttribute('data-state'),'unavailable');
});

test('a removed pending source cannot enable download or contaminate its replacement pair',async t=>{
 const page=await fixture(t,{acceptDownloads:true}),first=tornadoes[0],second=tornadoes.find(record=>record.detail_file!==first.detail_file),third=tornadoes.slice(0,20).find(record=>record.id!==first.id&&record.id!==second.id);
 let release,started;const held=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);t.after(()=>release());
 await page.route('**/jma-cases/'+second.detail_file,async route=>{started();await held;await route.continue();});
 await page.goto(base+'/japan.html'+comparisonQuery([first,second]));await seen;await comparisonReady(page,first);
 assert.equal(await page.locator('#case-comparison-download').isEnabled(),false);
 await compared(page,second.id).getByRole('button',{name:'Remove case '+second.case_id+' from comparison',exact:true}).click();
 const response=page.waitForResponse(response=>response.url().endsWith(second.detail_file));release();await response;await page.waitForFunction(()=>document.body.dataset.ready==='true');
 assert.equal(await page.locator('#case-comparison-download').isEnabled(),false);
 assert.equal(await compared(page,second.id).count(),0);
 await caseButton(page,third.id).click();await ready(page,third);await page.locator('#case-compare-add').click();
 for(const record of [first,third])await comparisonReady(page,record);
 assert.deepEqual((await downloadedComparison(page)).value.cases.map(entry=>entry.index_record.id),[first.id,third.id]);
});

test('phone touch and enlarged-text keyboard downloads preserve pair and view state',async t=>{
 const page=await fixture(t,{acceptDownloads:true,hasTouch:true,isMobile:true}),pair=[tornadoes[0],index.records.find(record=>record.classification_code==='6')];
 const query='日本 + & 100% '.repeat(20);
 for(const width of [320,390])for(const appearance of ['light','dark']){
  await page.setViewportSize({width,height:844});await open(page,comparisonQuery(pair)+'&q='+encodeURIComponent(query)+'#case='+encodeURIComponent(pair[0].id));
  await page.locator('#reading-appearance').selectOption(appearance);for(const record of pair)await comparisonReady(page,record);
  await page.addStyleTag({content:'html{font-size:150%}'});
  const control=page.locator('#case-comparison-download');await control.scrollIntoViewIfNeeded();
  const metrics=await control.evaluate(node=>({height:node.getBoundingClientRect().height,right:node.getBoundingClientRect().right,scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(metrics.height>=44&&metrics.right<=width);assert.ok(metrics.scroll<=width);
  const exported=await downloadedComparison(page,()=>control.tap());
  assert.equal(new URL(exported.value.view_path,page.url()).searchParams.get('q'),query);
  assert.equal(exported.value.cases[1].detail.confirmed_tornado,false);
  assert.deepEqual(exported.value.cases[1].detail,await original(pair[1]));
  await control.focus();const keyboard=await downloadedComparison(page,()=>control.press('Enter'));
  assert.deepEqual(keyboard.bytes,exported.bytes);assert.equal(await control.evaluate(node=>document.activeElement===node),true);
  await page.locator('#case-back').click();assert.equal(await page.locator('#case-browse').isVisible(),true);
  assert.deepEqual(new URL(page.url()).searchParams.getAll('compare'),pair.map(record=>record.id));
 }
});
