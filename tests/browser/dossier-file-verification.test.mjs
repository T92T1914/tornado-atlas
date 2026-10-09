import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';
import {readDossierDownload} from './dossier-download-helper.mjs';

const bytes=path=>readFile(new URL('../../web/'+path,import.meta.url));
const index=JSON.parse(await bytes('archive/index.json'));
const entry=index.events.find(row=>row.id==='joplin-2011');
const history=JSON.parse(await bytes(entry.history_file));
const currentBytes=await bytes(entry.file),current=JSON.parse(currentBytes);
const retained=history.versions.find(row=>row.dossier_sha256!==entry.dossier_sha256);
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const copy=value=>structuredClone(value);
const primary='Verify and download dossier metadata (JSON)';
async function open(page,suffix='?event='+entry.id){
  await page.goto(base+'/dossier.html'+suffix);
  await page.waitForFunction(()=>document.body?.dataset.ready);
}
async function rejected(page,message){
  assert.equal(await page.locator('h1').textContent(),'Evidence unavailable');
  assert.match(await page.locator('#content').textContent(),message);
  assert.equal(await page.locator('#content .archive-card, #evidence-comparison').count(),0);
  assert.equal(await page.locator('#content img, #content video, #content audio, #content iframe').count(),0);
  assert.equal(await page.getByRole('link',{name:'Retry this view',exact:true}).count(),1);
  assert.equal(await page.getByRole('navigation',{name:'Current documentary chapters'}).getByRole('link').count(),4);
}
async function fulfillJSON(page,file,value){
  await page.route('**/'+file,route=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)}));
}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}

for(const view of ['current','retained','comparison'])test(`altered ${view} bytes are rejected before evidence is rendered`,async t=>{
  const ref=view==='retained'?retained:entry,doc=JSON.parse(await bytes(ref.file));
  doc.media[0].account='Controlled altered account. This is an inert test fixture.';
  const page=await fixture(t),requests=[];page.on('request',r=>requests.push(r.url()));
  await fulfillJSON(page,ref.file,doc);
  await open(page,'?event='+entry.id+(view==='retained'?'&revision='+retained.dossier_sha256:view==='comparison'?'&compare=media:friskey-joplin-storm&compare=media:nws-joplin-aftermath':''));
  await rejected(page,/file bytes do not match this publication/);
  assert.equal(requests.filter(url=>url.includes('/archive/')&&url.endsWith('.json')).length,3);
  assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
});

const invalidReferences=[
  ['missing full file hash',i=>{delete i.events.find(e=>e.id===entry.id).file_sha256;},null],
  ['malformed logical hash',i=>{i.events.find(e=>e.id===entry.id).dossier_sha256='BAD';},null],
  ['foreign dossier path',i=>{i.events.find(e=>e.id===entry.id).file=index.events[0].file;},null],
  ['mixed current file tuple',null,h=>{h.versions.find(v=>v.dossier_sha256===entry.dossier_sha256).file_sha256='0'.repeat(64);}],
  ['duplicate retained identity',null,h=>{h.versions.push(copy(h.versions[0]));}],
  ['foreign retained path',null,h=>{h.versions[1].file=index.events[0].file;}]
];
for(const [name,indexEdit,historyEdit] of invalidReferences)test(`${name} fails before dossier fetch`,async t=>{
  const page=await fixture(t);let dossierRequests=0;
  page.on('request',r=>{if(history.versions.some(v=>r.url()===base+'/'+v.file))dossierRequests++;});
  if(indexEdit){const changed=copy(index);indexEdit(changed);await fulfillJSON(page,'archive/index.json',changed);}
  if(historyEdit){const changed=copy(history);historyEdit(changed);await fulfillJSON(page,entry.history_file,changed);}
  await open(page);await rejected(page,/publication|revision list/);assert.equal(dossierRequests,0);
});

test('unsupported byte verification fails before a dossier request',async t=>{
  const page=await fixture(t);let requested=false;
  await page.addInitScript(()=>Object.defineProperty(globalThis.crypto,'subtle',{value:undefined}));
  page.on('request',r=>{if(r.url()===base+'/'+entry.file)requested=true;});
  await open(page);await rejected(page,/cannot verify dossier file bytes/);assert.equal(requested,false);
});

// These fixtures alter the trusted publication association deliberately. They
// test the subsequent decode/reader boundary, without authenticating that index.
for(const [name,body,message] of [
  ['invalid UTF8',Buffer.from([0xff,0xfe]),/not valid UTF8/],
  ['invalid JSON',Buffer.from('{broken'),/not valid JSON/],
  ['wrong event',Buffer.from(JSON.stringify({...current,id:'another-event'})),/incompatible reading structure/],
  ['wrong schema',Buffer.from(JSON.stringify({...current,schema_version:99})),/incompatible reading structure/]
])test(`hash-matching ${name} cannot render evidence`,async t=>{
  const page=await fixture(t),changedIndex=copy(index),changedHistory=copy(history),fileHash=hash(body);
  changedIndex.events.find(e=>e.id===entry.id).file_sha256=fileHash;
  changedHistory.versions.find(v=>v.dossier_sha256===entry.dossier_sha256).file_sha256=fileHash;
  await fulfillJSON(page,'archive/index.json',changedIndex);await fulfillJSON(page,entry.history_file,changedHistory);
  await page.route('**/'+entry.file,r=>r.fulfill({contentType:'application/json',body}));
  await open(page);await rejected(page,message);
});

test('oversized dossier and revision list responses retain documentary recovery',async t=>{
  const page=await fixture(t);
  await page.route('**/'+entry.file,r=>r.fulfill({contentType:'application/json',body:' '.repeat(200001)}));
  await open(page);await rejected(page,/exceeds its reading limit/);
  await page.unroute('**/'+entry.file);
  await page.route('**/'+entry.history_file,r=>r.fulfill({contentType:'application/json',body:' '.repeat(100001)}));
  await open(page);await rejected(page,/exceeds its reading limit/);
});

test('a failed dossier response recovers through the same view retry',async t=>{
  const page=await fixture(t);let failing=true;
  await page.route('**/'+entry.file,r=>failing?r.fulfill({status:503,body:'Unavailable'}):r.continue());
  await open(page);await rejected(page,/metadata response could not load/);
  failing=false;await page.getByRole('link',{name:'Retry this view',exact:true}).click();
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.equal(await page.locator('#media-'+current.media[0].id).count(),1);
});

test('current and unrendered retained downloads save exact checked response bytes',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},acceptDownloads:true}),requests=[];
  page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(()=>{
    globalThis.byteDownloadURLs={created:[],revoked:[]};
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=blob=>{const url=create(blob);byteDownloadURLs.created.push(url);return url;};
    URL.revokeObjectURL=url=>{byteDownloadURLs.revoked.push(url);return revoke(url);};
  });
  await open(page);
  const saved=await readDossierDownload(page);assert.deepEqual(saved.bytes,currentBytes);assert.equal(saved.filename,entry.id+'.json');
  const revisionCard=page.locator('#revision-'+retained.dossier_sha256);
  const earlier=await readDossierDownload(page,{scope:revisionCard,label:'Verify and download this revision (JSON)'});
  assert.deepEqual(earlier.bytes,await bytes(retained.file));assert.equal(earlier.filename,entry.id+'-'+retained.dossier_sha256.slice(0,12)+'.json');
  assert.equal(new URL(page.url()).searchParams.has('revision'),false);
  assert.match(await page.locator('#content').textContent(),/reading the current published dossier/);
  assert.equal(requests.filter(url=>url===base+'/'+retained.file).length,1);
  await page.waitForFunction(()=>byteDownloadURLs.created.length===2&&byteDownloadURLs.revoked.length===2);
  assert.deepEqual(await page.evaluate(()=>byteDownloadURLs.created.sort()),await page.evaluate(()=>byteDownloadURLs.revoked.sort()));
  await page.addStyleTag({content:'body{font-size:200%}'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const control of [page.getByRole('button',{name:primary,exact:true}),revisionCard.getByRole('link',{name:'Open raw metadata file (unverified)',exact:true})]){
    await control.focus();assert.equal(await control.evaluate(el=>el===document.activeElement),true);
    const box=await control.boundingBox();assert.ok(box.height>=44&&box.width>=44);
  }
});

test('an altered later download fails inline and the same button retries',async t=>{
  const page=await fixture(t,{acceptDownloads:true}),downloads=[];page.on('download',d=>downloads.push(d));
  await open(page);const cardCount=await page.locator('#content .archive-card').count();
  let bad=true,calls=0;const altered=copy(current);altered.observations[0].account='Later-response altered fixture.';
  await page.route('**/'+entry.file,r=>{calls++;return bad?r.fulfill({contentType:'application/json',body:JSON.stringify(altered)}):r.continue();});
  const button=page.getByRole('button',{name:primary,exact:true}),group=button.locator('..');
  await button.click();await group.getByRole('status').filter({hasText:'Metadata download unavailable'}).waitFor();
  assert.equal(downloads.length,0);assert.equal(await button.isEnabled(),true);assert.equal(calls,1);
  assert.equal(await page.locator('#content .archive-card').count(),cardCount);
  assert.match(await page.locator('#observation-'+current.observations[0].id).textContent(),new RegExp(current.observations[0].account.slice(0,25).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  bad=false;const saved=await readDossierDownload(page);assert.deepEqual(saved.bytes,currentBytes);assert.equal(calls,2);assert.equal(downloads.length,1);
});

test('a pending verified download prevents a second request and releases its button',async t=>{
  const page=await fixture(t,{acceptDownloads:true});await open(page);
  const arrived=deferred(),release=deferred();let calls=0;
  await page.route('**/'+entry.file,async r=>{calls++;arrived.resolve();await release.promise;await r.fulfill({contentType:'application/json',body:currentBytes});});
  const button=page.getByRole('button',{name:primary,exact:true}),other=page.locator('#revision-'+retained.dossier_sha256).getByRole('button',{name:'Verify and download this revision (JSON)',exact:true});
  const downloadPromise=page.waitForEvent('download');
  await button.click();await arrived.promise;assert.equal(await button.isDisabled(),true);
  await other.click();assert.match(await other.locator('..').getByRole('status').textContent(),/Another dossier download is being checked/);
  assert.equal(calls,1);release.resolve();const download=await downloadPromise;
  assert.equal(await download.failure(),null);assert.deepEqual(await readFile(await download.path()),currentBytes);
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Verify and download dossier metadata (JSON)')?.disabled===false);
});

test('creator contributions stay staged when a later selected dossier fails',async t=>{
  const first=index.events[0],second=index.events[1],firstDoc=JSON.parse(await bytes(first.file)),secondDoc=JSON.parse(await bytes(second.file));
  const creator=firstDoc.creators.find(c=>firstDoc.media.some(m=>Object.values(m.roles).includes(c.id)));
  assert.ok(creator,'The controlled multi-event attribution fixture needs one existing credited contribution');
  if(!secondDoc.creators.some(c=>c.id===creator.id))secondDoc.creators.push(copy(creator));
  secondDoc.media[0].roles.creator=creator.id;
  const secondBytes=Buffer.from(JSON.stringify(secondDoc)),changedIndex=copy(index);
  for(const e of changedIndex.events)e.creators=e.id===first.id||e.id===second.id?[copy(creator)]:[];
  changedIndex.events.find(e=>e.id===second.id).file_sha256=hash(secondBytes);
  const page=await fixture(t),arrived=deferred(),release=deferred(),requests=[];let failing=true;
  page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(()=>{
    globalThis.partialContribution=false;
    new MutationObserver(()=>{if(document.querySelector('#content .archive-card'))partialContribution=true;}).observe(document,{childList:true,subtree:true});
  });
  await fulfillJSON(page,'archive/index.json',changedIndex);
  await page.route('**/'+second.file,async r=>{arrived.resolve();await release.promise;await r.fulfill(failing?{status:503,body:'Unavailable'}:{contentType:'application/json',body:secondBytes});});
  await page.goto(base+'/dossier.html?creator='+creator.id);await arrived.promise;
  assert.equal(await page.locator('#content .archive-card').count(),0);
  assert.equal(await page.evaluate(()=>partialContribution),false);
  release.resolve();await page.waitForFunction(()=>document.body?.dataset.ready==='error');
  await rejected(page,/metadata response could not load/);assert.equal(await page.evaluate(()=>partialContribution),false);
  failing=false;await page.getByRole('link',{name:'Retry this view',exact:true}).click();
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');assert.ok(await page.locator('#content .archive-card').count()>=2);
  assert.equal(requests.some(url=>url.includes('-history-')),false);
  assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
});

test('no-script reading retains explicitly raw archive and documentary routes',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},javaScriptEnabled:false});await page.goto(base+'/dossier.html?event='+entry.id);
  assert.equal(await page.getByRole('button',{name:primary,exact:true}).count(),0);
  assert.match(await page.locator('#documentary-js-required').textContent(),/revision metadata require JavaScript/);
  const raw=page.getByRole('link',{name:'Open raw archive index (unverified)',exact:true});
  assert.equal(await raw.getAttribute('href'),'archive/index.json');
  const box=await raw.boundingBox();assert.ok(box.height>=44);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('navigation',{name:'Current documentary chapters'}).getByRole('link',{name:'Joplin, 2011',exact:true}).click();
  assert.equal(new URL(page.url()).pathname,'/joplin.html');assert.ok(await page.locator('h1').count());
});
