import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';
import {revisionComparisonRoute} from '../../web/revision-comparison.mjs';

const index=JSON.parse(await readFile(new URL('../../web/archive/index.json',import.meta.url),'utf8'));
const event=index.events.find(row=>row.id==='joplin-2011');
const history=JSON.parse(await readFile(new URL('../../web/'+event.history_file,import.meta.url),'utf8'));
const next=history.versions.find(row=>row.dossier_sha256.startsWith('1f02a52e8fca'));
const previous=history.versions.find(row=>row.dossier_sha256===next.review.previous_dossier_sha256);
const oldBytes=await readFile(new URL('../../web/'+previous.file,import.meta.url));
const newBytes=await readFile(new URL('../../web/'+next.file,import.meta.url));
const documents=[JSON.parse(oldBytes),JSON.parse(newBytes)];
const target='intake-nist-east-middle-refuge-2014';
const accounts=documents.map(doc=>doc.observations.find(row=>row.id===target));
const path=revisionComparisonRoute(event.id,next.dossier_sha256,previous.dossier_sha256);
const wire=raw=>createHash('sha256').update(raw).digest('hex');
async function ready(page){await page.waitForFunction(()=>document.body?.dataset.ready);}
async function open(page,suffix=path){await page.goto(base+'/'+suffix);await ready(page);}
async function follow(page,link){
  await Promise.all([page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),link.click()]);
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
}
const noPair=async page=>{assert.equal(await page.locator('#revision-comparison').count(),0);assert.equal(await page.locator('#content .archive-card').count(),0);};

for(const [width,appearance] of [[320,'dark'],[1280,'light']])test('recorded Joplin values, source routes and native journeys '+width+' '+appearance,async t=>{
  const page=await fixture(t,{viewport:{width,height:900},colorScheme:appearance}),requests=[];
  page.on('request',request=>requests.push(request.url()));
  await open(page,'dossier.html?event=joplin-2011#correction-history');
  requests.length=0;
  const historyLink=page.locator('#revision-'+next.dossier_sha256).getByRole('link',{name:'Read earlier and later recorded values',exact:true});
  assert.equal(await historyLink.getAttribute('href'),base+'/'+path);
  await historyLink.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.dataset.ready==='true'&&!!document.getElementById('revision-comparison'));
  assert.equal(new URL(page.url()).searchParams.get('predecessor'),previous.dossier_sha256);
  const section=page.locator('#revision-comparison');
  assert.equal(await section.locator('.revision-change').count(),1);
  const body=await section.textContent();
  for(const identity of [previous.dossier_sha256,previous.file_sha256,next.dossier_sha256,next.file_sha256,next.review.candidate_sha256])assert.ok(body.includes(identity));
  assert.ok(body.includes(next.review.basis));
  assert.equal(await section.locator('.revision-identities').getAttribute('open'),null);
  for(const [number,key] of [[0,'before'],[1,'after']]){
    const endpoint=section.locator('[data-endpoint="'+key+'"]'),account=endpoint.locator('[data-field="account"]');
    assert.equal(await account.locator('.literal-decoded').textContent(),accounts[number].account);
    const disclosure=account.locator('summary');await disclosure.focus();await page.keyboard.press('Enter');
    assert.equal(await account.locator('.literal-raw').isVisible(),true);
    assert.equal(await account.locator('.literal-raw').textContent(),JSON.stringify(accounts[number].account));
    assert.ok((await endpoint.textContent()).includes(accounts[number].limits));
    assert.ok((await endpoint.textContent()).includes(accounts[number].review));
    const context=endpoint.locator('.revision-context');
    assert.equal(await context.getAttribute('open'),null);
    assert.ok(await endpoint.locator('h5').filter({hasText:'Limits'}).isVisible());
    await context.locator(':scope > summary').focus();await page.keyboard.press('Enter');
    assert.equal(await context.getAttribute('open'),'');
    const reference=number?next:previous,source=documents[number].sources.find(row=>row.id===accounts[number].source_id);
    assert.equal(await endpoint.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),source.url);
    const sourceLink=new URL(await endpoint.getByRole('link',{name:'Inspect the source in this revision',exact:true}).getAttribute('href'));
    assert.equal(sourceLink.searchParams.get('revision'),reference.dossier_sha256);assert.equal(sourceLink.searchParams.get('source'),source.id);
    const evidenceLink=new URL(await endpoint.getByRole('link',{name:'Read this observation in this revision',exact:true}).getAttribute('href'));
    assert.equal(evidenceLink.searchParams.get('revision'),reference.dossier_sha256);assert.equal(evidenceLink.searchParams.get('observation'),target);
    for(const field of ['access','rights','revision'])assert.ok((await endpoint.textContent()).includes(source[field]));
  }
  assert.equal(requests.filter(url=>url.endsWith('/'+previous.file)).length,1);
  assert.equal(requests.filter(url=>url.endsWith('/'+next.file)).length,1);
  assert.equal(requests.filter(url=>/\/archive\/joplin-2011-[0-9a-f]{20}\.json$/.test(url)).length,2);
  assert.deepEqual(requests.filter(url=>/youtube|\/assets\/|\.png|\.jpe?g/.test(url)),[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const text=await section.textContent();
  await section.evaluate(node=>{const nodes=[node,...node.querySelectorAll('*')],sizes=nodes.map(item=>parseFloat(getComputedStyle(item).fontSize));nodes.forEach((item,i)=>item.style.fontSize=sizes[i]*2+'px');});
  assert.equal(await section.textContent(),text);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const control of await section.locator('summary,nav a').all())if(await control.isVisible())assert.ok((await control.boundingBox()).height>=44);
  const identities=section.locator('.revision-identities');
  await identities.locator(':scope > summary').focus();await page.keyboard.press('Enter');
  assert.equal(await identities.getAttribute('open'),'');
  for(const control of await identities.locator('summary,nav a').all())assert.ok((await control.boundingBox()).height>=44);
  await follow(page,section.locator('[data-endpoint="before"]').getByRole('link',{name:'Inspect the source in this revision',exact:true}));
  assert.equal(new URL(page.url()).searchParams.get('revision'),previous.dossier_sha256);
  assert.equal(await page.locator('#revision-comparison').count(),0);
  await page.goBack();await page.waitForFunction(()=>document.body.dataset.ready==='true'&&!!document.getElementById('revision-comparison'));
  await page.goForward();await page.waitForFunction(()=>document.body.dataset.ready==='true'&&!document.getElementById('revision-comparison'));
  await page.goBack();await page.waitForFunction(()=>!!document.getElementById('revision-comparison'));
  await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true'&&!!document.getElementById('revision-comparison'));
  assert.equal(new URL(page.url()).searchParams.get('predecessor'),previous.dossier_sha256);
  assert.equal(await page.locator('#evidence-comparison').count(),1,'Existing within-dossier comparison remains available');
});

test('delayed predecessor never exposes a partial pair or successor dossier',async t=>{
  const page=await fixture(t);let release,seen;
  const delay=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>seen=resolve);
  t.after(()=>release());
  await page.route('**/'+previous.file,async route=>{seen();await delay;await route.fulfill({contentType:'application/json',body:oldBytes});});
  await page.goto(base+'/'+path,{waitUntil:'domcontentloaded'});await requested;await noPair(page);
  assert.equal(await page.locator('h1').textContent(),'Loading archive...');
  release();await page.waitForFunction(()=>document.body.dataset.ready==='true');
  assert.equal(await page.locator('#revision-comparison').count(),1);
});

test('failed predecessor has no pair and recovers through the existing retry',async t=>{
  const page=await fixture(t),trace=[];let fail=true;
  page.on('request',request=>{if(request.url().includes('/archive/'))trace.push({event:'request',url:request.url()});});
  page.on('response',response=>{if(response.url().includes('/archive/'))trace.push({event:'response',url:response.url(),status:response.status()});});
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())trace.push({event:'main-frame-navigation',url:frame.url()});});
  await page.route('**/'+previous.file,route=>fail?route.fulfill({status:503,body:'Synthetic second-response failure'}):route.continue());
  await open(page);await noPair(page);assert.equal(await page.locator('h1').textContent(),'Evidence unavailable');
  assert.equal(await page.getByRole('link',{name:'Browse the archive',exact:true}).count(),1);
  fail=false;
  try{await follow(page,page.getByRole('link',{name:'Retry this view',exact:true}));}
  catch(error){
    console.log('Retained comparison retry diagnostic: '+JSON.stringify({trace,state:await page.evaluate(()=>({url:location.href,ready:document.body?.dataset.ready,text:document.getElementById('content')?.textContent}))}));
    throw error;
  }
  assert.equal(await page.locator('#revision-comparison').count(),1);
  assert.equal(trace.filter(row=>row.event==='request'&&row.url.endsWith('/'+previous.file)).length,2,'Retry must fetch the predecessor again');
  assert.equal(new URL(page.url()).hash,'#revision-comparison');
});

test('same-event altered predecessor bytes cannot produce a comparison',async t=>{
  const page=await fixture(t),altered=structuredClone(documents[0]);altered.summary='Synthetic changed response, not historical evidence.';
  await page.route('**/'+previous.file,route=>route.fulfill({contentType:'application/json',body:JSON.stringify(altered)}));
  await open(page);await noPair(page);assert.match(await page.locator('#content').textContent(),/file bytes do not match/);
});

test('matching file hash cannot hide duplicate decoded keys in an unselected subtree',async t=>{
  const page=await fixture(t),doc=structuredClone(documents[0]);doc.provenance.literal_fixture=null;
  const raw=JSON.stringify(doc).replace('"literal_fixture":null','"literal_fixture":{"x":1,"\\u0078":2}');
  const changedHistory=structuredClone(history);changedHistory.versions.find(row=>row.dossier_sha256===previous.dossier_sha256).file_sha256=wire(raw);
  await page.route('**/'+event.history_file,route=>route.fulfill({contentType:'application/json',body:JSON.stringify(changedHistory)}));
  await page.route('**/'+previous.file,route=>route.fulfill({contentType:'application/json',body:raw}));
  await open(page);await noPair(page);assert.match(await page.locator('#content').textContent(),/duplicate decoded object keys/);
});

test('checked successor must retain the same publication review as history before predecessor fetch',async t=>{
  const page=await fixture(t),doc=structuredClone(documents[1]);doc.provenance.publication_review.basis+=' Synthetic mismatch.';
  const raw=JSON.stringify(doc),changedHistory=structuredClone(history);
  changedHistory.versions.find(row=>row.dossier_sha256===next.dossier_sha256).file_sha256=wire(raw);
  const requests=[];page.on('request',request=>requests.push(request.url()));
  await page.route('**/'+event.history_file,route=>route.fulfill({contentType:'application/json',body:JSON.stringify(changedHistory)}));
  await page.route('**/'+next.file,route=>route.fulfill({contentType:'application/json',body:raw}));
  await open(page);await noPair(page);assert.match(await page.locator('#content').textContent(),/publication review differs/);
  assert.equal(requests.filter(url=>url.endsWith('/'+previous.file)).length,0);
});

test('incorrect or duplicated predecessor routes never fall back to current evidence',async t=>{
  const page=await fixture(t);
  for(const suffix of [
    path.replace(previous.dossier_sha256,'0'.repeat(64)),
    path.replace(previous.dossier_sha256,next.dossier_sha256),
    path.replace('#revision-comparison','&predecessor='+previous.dossier_sha256),
    path.replace('#revision-comparison','&event=joplin-2011'),
    path.replace('#revision-comparison','&revision='+next.dossier_sha256),
    'dossier.html?record=ncei:1&predecessor='+previous.dossier_sha256
  ]){
    await open(page,suffix);await noPair(page);assert.equal(await page.locator('h1').textContent(),'Evidence unavailable');
  }
});

test('script-disabled comparison route retains documentary and raw archive reading paths',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:false});
  await page.goto(base+'/'+path);
  assert.equal(await page.locator('#revision-comparison').count(),0);
  assert.match(await page.locator('noscript').textContent(),/JavaScript/);
  assert.ok(await page.locator('a[href="joplin.html"]').count());
  assert.ok(await page.locator('a[href="archive/index.json"]').count());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});
