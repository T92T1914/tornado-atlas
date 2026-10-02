import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const index=JSON.parse(await readFile(new URL('../../web/archive/index.json',import.meta.url),'utf8'));
const reference=index.source_directory;
const directory=JSON.parse(await readFile(new URL('../../web/'+reference.file,import.meta.url),'utf8'));
async function open(page,suffix='?view=sources'){
  await page.goto(base+'/dossier.html'+suffix);
  await page.waitForFunction(()=>document.body?.dataset.ready);
}
async function follow(page,locator){
  await Promise.all([page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),locator.click()]);
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
}

for(const width of [308,1280])for(const appearance of ['dark','light'])test(`source discovery and pinned evidence ${width} ${appearance}`,async t=>{
  const page=await fixture(t,{viewport:{width,height:900}}),requests=[];
  page.on('request',request=>requests.push(request.url()));
  await open(page,'');
  assert.equal(requests.some(url=>url.includes('/archive/sources-')),false,'The event entrance does not preload source discovery');
  await follow(page,page.getByRole('link',{name:'Browse inspected source cards',exact:true}));
  assert.equal(await page.locator('#source-results .archive-card').count(),reference.count);
  assert.equal(requests.filter(url=>url.includes('/archive/')&&url.endsWith('.json')).length,3,'Entrance, source view index and one directory');
  assert.equal(requests.filter(url=>/\/archive\/(el-reno|joplin|blackwell)/.test(url)).length,0);
  assert.equal(requests.filter(url=>/youtube|harkphoto|\.png|\.jpg/.test(url)).length,0);
  await page.locator('#reading-appearance').selectOption(appearance);
  await page.getByRole('searchbox',{name:'Search source cards'}).fill('  Printed page 13  ');
  await follow(page,page.getByRole('button',{name:'Find sources',exact:true}));
  assert.equal(await page.locator('#source-results .archive-card').count(),1);
  const sourceCard=page.locator('#source-results .archive-card');
  assert.match(await sourceCard.textContent(),/Joplin/);
  assert.match(await sourceCard.textContent(),/not a full-report visual review/);
  assert.match(await sourceCard.textContent(),/Rights: Metadata and credited links only/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,
    JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(node=>node.getBoundingClientRect().right>innerWidth+1).map(node=>({tag:node.tagName,cls:node.className,width:node.getBoundingClientRect().width,text:node.textContent?.slice(0,60)})))));
  if(process.env.ATLAS_SCREENSHOT_DIR){
    await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`source-discovery-${width}-${appearance}-normal.png`)});
  }
  await page.addStyleTag({content:'body {font-size:200%}'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const destination=sourceCard.getByRole('link',{name:'Open source and its evidence',exact:true});
  await destination.focus();assert.equal(await destination.evaluate(node=>node===document.activeElement),true);
  if(process.env.ATLAS_SCREENSHOT_DIR){
    await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`source-discovery-${width}-${appearance}.png`),fullPage:true});
  }
  const expected=directory.entries.find(row=>row.event_id==='joplin-2011'&&row.source.id==='nws-assessment');
  await follow(page,destination);
  assert.equal(new URL(page.url()).searchParams.get('revision'),expected.dossier_sha256);
  assert.equal(new URL(page.url()).searchParams.get('source'),expected.source.id);
  assert.match(await page.locator('#source-nws-assessment').textContent(),/First-siren distinction/);
  const download=await page.request.get(await page.getByRole('link',{name:'Download dossier metadata (JSON)',exact:true}).getAttribute('href'));
  const doc=await download.json();assert.deepEqual(doc.sources.find(source=>source.id===expected.source.id),expected.source);
  await page.goBack();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.equal(await page.getByRole('searchbox',{name:'Search source cards'}).inputValue(),'  Printed page 13  ');
  await page.reload();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.equal(await page.locator('#source-results .archive-card').count(),1);
});

test('source filters keep shared URLs distinct and disclose missing coverage',async t=>{
  const page=await fixture(t);await open(page);
  await page.getByRole('combobox',{name:'Dossier',exact:true}).selectOption('el-reno-2013');
  await page.getByRole('searchbox',{name:'Search source cards'}).fill('https://www.weather.gov/oun/events-20130531');
  await follow(page,page.getByRole('button',{name:'Find sources',exact:true}));
  assert.equal(await page.locator('#source-results .archive-card').count(),2,'Event narrative and radar loop retain distinct source cards');
  const destinations=await page.locator('#source-results').getByRole('link',{name:'Open source and its evidence',exact:true}).evaluateAll(nodes=>nodes.map(node=>new URL(node.href).searchParams.get('source')));
  assert.deepEqual(new Set(destinations),new Set(['nws-event','nwrt-loop']));
  await page.getByRole('searchbox',{name:'Search source cards'}).fill('No inspected source with this synthetic phrase');
  await follow(page,page.getByRole('button',{name:'Find sources',exact:true}));
  assert.equal(await page.locator('#source-results .archive-card').count(),0);
  assert.match(await page.locator('#content').textContent(),/Sources may exist outside this reviewed collection/);
  await follow(page,page.getByRole('link',{name:'Clear source filters',exact:true}));
  assert.equal(await page.locator('#source-results .archive-card').count(),reference.count);
});

test('unavailable source directory recovers without showing stale source cards',async t=>{
  const page=await fixture(t);let fail=true;
  await page.route('**/'+reference.file,route=>fail?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await open(page);assert.equal(await page.locator('h1').textContent(),'Evidence unavailable');
  assert.equal(await page.locator('.archive-card').count(),0);
  fail=false;await follow(page,page.getByRole('link',{name:'Retry this view',exact:true}));
  assert.equal(await page.locator('#source-results .archive-card').count(),reference.count);
});

test('mismatched directory or unknown event filter fails with an archive route',async t=>{
  const page=await fixture(t);
  const broken=structuredClone(directory);broken.entries[0].dossier_sha256='0'.repeat(64);
  await page.route('**/'+reference.file,route=>route.fulfill({contentType:'application/json',body:JSON.stringify(broken)}));
  await open(page);
  assert.equal(await page.locator('h1').textContent(),'Evidence unavailable');
  assert.match(await page.locator('#content').textContent(),/No source cards have been substituted/);
  assert.equal(await page.locator('.archive-card').count(),0);
  await page.unroute('**/'+reference.file);
  await open(page,'?view=sources&scope=unknown-event');
  assert.match(await page.locator('#content').textContent(),/That dossier is not in this source directory/);
  await follow(page,page.getByRole('link',{name:'Browse the archive',exact:true}));
  assert.equal(await page.getByRole('link',{name:'Browse inspected source cards',exact:true}).count(),1);
});
