import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';
import {readDossierDownload} from './dossier-download-helper.mjs';

const index=JSON.parse(await readFile(new URL('../../web/archive/index.json',import.meta.url),'utf8'));
async function open(page,suffix){
  await page.goto(base+'/dossier.html'+suffix);
  await page.waitForFunction(()=>document.body?.dataset.ready);
}
async function follow(page,locator){
  await Promise.all([page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),locator.click()]);
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
}

for(const entry of index.events)for(const width of [308,1280])test(`retained evidence journey ${entry.id} ${width}`,async t=>{
  const history=JSON.parse(await readFile(new URL('../../web/'+entry.history_file,import.meta.url),'utf8'));
  const old=history.versions.find(v=>v.dossier_sha256!==history.current_dossier_sha256);
  const page=await fixture(t,{viewport:{width,height:900},acceptDownloads:true}),requests=[];
  page.on('request',request=>requests.push(request.url()));
  if(!old){
    assert.equal(history.versions.length,1,'A first publication must not invent a predecessor');
    await open(page,'?event='+entry.id);
    assert.match(await page.locator('#content').textContent(),/current published dossier/);
    assert.equal(await page.locator('#correction-history .archive-card').count(),1);
    assert.equal(await page.getByRole('link',{name:'Return to the current dossier',exact:true}).count(),0);
    const saved=await readDossierDownload(page);assert.equal(saved.dossier.id,entry.id);
    await page.addStyleTag({content:'body {font-size:200%}'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    return;
  }
  const expected=JSON.parse(await readFile(new URL('../../web/'+old.file,import.meta.url),'utf8'));
  await open(page,'?event='+entry.id+'&revision='+old.dossier_sha256);
  assert.match(await page.locator('#content').textContent(),/reading a retained dossier revision/);
  assert.match(await page.locator('#content').textContent(),/creator pages open current catalogue/);
  assert.equal(await page.locator('#correction-history .archive-card').count(),history.versions.length);
  assert.equal(requests.filter(url=>url.includes('/archive/')&&url.endsWith('.json')).length,3);
  assert.equal(requests.filter(url=>url.includes('/catalogue/')||/youtube|harkphoto|\.png|\.jpg/.test(url)).length,0);
  const observation=expected.observations[0],card=page.locator('#observation-'+observation.id);
  assert.match(await card.textContent(),new RegExp(observation.locator.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  await card.getByText('Inspection coverage',{exact:true}).click();
  assert.equal(await card.locator('details').last().getAttribute('open')!==null,true);
  await follow(page,card.getByRole('link',{name:'Inspect the source card',exact:true}));
  assert.equal(new URL(page.url()).searchParams.get('revision'),old.dossier_sha256);
  const source=expected.sources.find(s=>s.id===observation.source_id);
  const sourceCard=page.locator('#source-'+source.id);
  assert.match(await sourceCard.textContent(),/Source revision:/);
  assert.equal(await sourceCard.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),source.url);
  const saved=await readDossierDownload(page);assert.deepEqual(saved.dossier,expected);
  assert.deepEqual(saved.bytes,await readFile(new URL('../../web/'+old.file,import.meta.url)));
  await sourceCard.getByRole('link',{name:'Link to source card',exact:true}).focus();
  assert.equal(await sourceCard.getByRole('link',{name:'Link to source card',exact:true}).evaluate(e=>e===document.activeElement),true);
  await page.reload();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  for(const appearance of ['dark','light']){
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.addStyleTag({content:'body {font-size:200%}'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await follow(page,page.getByRole('link',{name:'Return to the current dossier',exact:true}));
  assert.equal(new URL(page.url()).searchParams.has('revision'),false);
  assert.match(await page.locator('#content').textContent(),/current published dossier/);
  await page.goBack();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.equal(new URL(page.url()).searchParams.get('revision'),old.dossier_sha256);
});

test('actual Joplin account correction links each recorded evidence revision',async t=>{
  const entry=index.events.find(e=>e.id==='joplin-2011');
  const history=JSON.parse(await readFile(new URL('../../web/'+entry.history_file,import.meta.url),'utf8'));
  const correction=history.versions.find(v=>v.dossier_sha256.startsWith('1f02a52e8fca'));
  const change=correction.changes.find(c=>c.kind==='observations');
  const page=await fixture(t);
  await open(page,'?event=joplin-2011&revision='+correction.dossier_sha256+'#correction-history');
  const card=page.locator('#revision-'+correction.dossier_sha256);
  assert.match(await card.textContent(),/updated \(account, review\)/);
  await follow(page,card.getByRole('link',{name:'Inspect this evidence revision',exact:true}));
  assert.equal(new URL(page.url()).searchParams.get('observation'),change.id);
  assert.equal(new URL(page.url()).searchParams.get('revision'),correction.dossier_sha256);
  assert.match(await page.locator('#observation-'+change.id).textContent(),/likely explanation/);
});

test('absent predecessors and unrecorded decisions stay explicit',async t=>{
  const page=await fixture(t);await open(page,'?event=el-reno-2013');
  assert.match(await page.locator('#correction-history').textContent(),/predecessor is not retained/);
  await open(page,'?event=blackwell-1955');
  assert.match(await page.locator('#correction-history').textContent(),/No publication-review record is retained/);
});

test('unknown and cross-event revisions cannot silently display current accounts',async t=>{
  const elReno=index.events.find(e=>e.id==='el-reno-2013');
  const history=JSON.parse(await readFile(new URL('../../web/'+elReno.history_file,import.meta.url),'utf8'));
  const page=await fixture(t);
  for(const revision of ['0'.repeat(64),'../archive/index.json',history.current_dossier_sha256]){
    await open(page,'?event=joplin-2011&revision='+encodeURIComponent(revision));
    assert.equal(await page.locator('h1').textContent(),'Evidence unavailable');
    assert.match(await page.locator('#content').textContent(),/No current account has been substituted/);
    assert.equal(await page.locator('.archive-card').count(),0);
  }
});

test('a missing retained snapshot fails closed and can recover after retry',async t=>{
  const entry=index.events.find(e=>e.id==='joplin-2011');
  const history=JSON.parse(await readFile(new URL('../../web/'+entry.history_file,import.meta.url),'utf8'));
  const old=history.versions.find(v=>v.dossier_sha256!==history.current_dossier_sha256);
  const page=await fixture(t);let fail=true;
  await page.route('**/'+old.file,route=>fail?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await open(page,'?event='+entry.id+'&revision='+old.dossier_sha256);
  assert.equal(await page.locator('h1').textContent(),'Evidence unavailable');
  assert.equal(await page.locator('.archive-card').count(),0);
  fail=false;await follow(page,page.getByRole('link',{name:'Retry this view',exact:true}));
  assert.match(await page.locator('#content').textContent(),/reading a retained dossier revision/);
});

test('a mismatched revision list cannot replace the current indexed dossier',async t=>{
  const entry=index.events.find(e=>e.id==='joplin-2011');
  const history=JSON.parse(await readFile(new URL('../../web/'+entry.history_file,import.meta.url),'utf8'));
  history.current_dossier_sha256=history.versions.find(v=>v.dossier_sha256!==history.current_dossier_sha256).dossier_sha256;
  const page=await fixture(t);
  await page.route('**/'+entry.history_file,route=>route.fulfill({contentType:'application/json',body:JSON.stringify(history)}));
  await open(page,'?event='+entry.id);
  assert.equal(await page.locator('h1').textContent(),'Evidence unavailable');
  assert.match(await page.locator('#content').textContent(),/No earlier account has been substituted/);
  assert.equal(await page.locator('.archive-card').count(),0);
});
