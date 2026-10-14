import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';

const bytes=p=>readFile(new URL('../../web/'+p,import.meta.url));
const index=JSON.parse(await bytes('archive/index.json'));
const entry=index.events.find(x=>x.id==='joplin-2011');
const current=JSON.parse(await bytes(entry.file));
const history=JSON.parse(await bytes(entry.history_file));
for(const [label,edit,valid] of [
  ['array name',c=>{c.name=['invalid'];},false],
  ['object attribution basis',c=>{c.basis={invalid:'basis'};},false],
  ['exact Unicode attribution',c=>{c.name='  Cafe\u0301 Ω 測  ';c.basis=' ';},true]
])test(`hash-matching ${label} reaches the actual reader structure boundary`,async t=>{
  const page=await fixture(t),doc=structuredClone(current);edit(doc.creators[0]);
  const body=Buffer.from(JSON.stringify(doc)),hash=createHash('sha256').update(body).digest('hex');
  const i=structuredClone(index),h=structuredClone(history);
  i.events.find(x=>x.id===entry.id).file_sha256=hash;
  h.versions.find(x=>x.dossier_sha256===entry.dossier_sha256).file_sha256=hash;
  // Deliberately supplied publication references isolate the subsequent reader
  // structure check. This fixture does not authenticate a changed publication.
  await page.route('**/archive/index.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(i)}));
  await page.route('**/'+entry.history_file,r=>r.fulfill({contentType:'application/json',body:JSON.stringify(h)}));
  await page.route('**/'+entry.file,r=>r.fulfill({contentType:'application/json',body}));
  await page.goto(base+'/dossier.html?event='+entry.id);
  await page.waitForFunction(()=>document.body.dataset.ready);
  if(valid){
    assert.equal(await page.locator('body').getAttribute('data-ready'),'true');
    assert.ok((await page.locator('#content').textContent()).includes(doc.creators[0].name));
    assert.equal(await page.locator('#media-'+doc.media[0].id).count(),1);
  }else{
    assert.equal(await page.locator('h1').textContent(),'Evidence unavailable');
    assert.match(await page.locator('#content').textContent(),/incompatible reading structure/);
    assert.equal(await page.locator('#content .archive-card').count(),0);
    assert.equal(await page.getByRole('link',{name:'Retry this view',exact:true}).count(),1);
  }
});
