import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
import {readDossierDownload} from './dossier-download-helper.mjs';

async function openDossier(page,suffix=''){
  await page.goto(base+'/dossier.html'+suffix);
  await page.waitForFunction(()=>document.body?.dataset.ready);
}
async function navigate(page, action){
  const navigation=page.waitForEvent('framenavigated',frame=>frame===page.mainFrame());
  await action();await navigation;
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
}

test('installed Inter supplies actual dossier interface glyphs',{
  skip:process.env.ATLAS_REQUIRE_INTER!=='1'||['webkit','firefox'].includes(process.env.ATLAS_BROWSER_ENGINE)
},async t=>{
  const page=await fixture(t);await openDossier(page,'?event=el-reno-2013');
  await page.evaluate(()=>document.fonts.ready);
  const session=await page.context().newCDPSession(page);
  try{
    await session.send('DOM.enable');await session.send('CSS.enable');
    const {root}=await session.send('DOM.getDocument');
    for(const [selector,face] of [['#content > p:nth-of-type(2)','Inter-Regular'],['#media-ER13-HARK-PHOTO-604 dt','Inter-SemiBold']]){
      const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});
      const {fonts}=await session.send('CSS.getPlatformFontsForNode',{nodeId});
      assert.ok(fonts.some(f=>f.postScriptName===face&&f.glyphCount>0),JSON.stringify(fonts));
    }
  }finally{await session.detach();}
});
for(const width of [390,1280])for(const appearance of ['dark','light'])test(`dossier source journey ${width} ${appearance}`,async t=>{
  const page=await fixture(t,{viewport:{width,height:900}}),requests=[];
  page.on('request',r=>requests.push(r.url()));
  await openDossier(page,'?event=el-reno-2013');
  await page.locator('#reading-appearance').selectOption(appearance);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(requests.filter(u=>u.endsWith('/data.json')||u.includes('/catalogue/index')).length,0);
  assert.equal(requests.filter(u=>/youtube|harkphoto|\.png|\.jpg/.test(u)).length,0);
  if(process.env.ATLAS_SCREENSHOT_DIR){await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`dossier-event-${width}-${appearance}.png`)});}
  const card=page.locator('#media-ER13-HARK-PHOTO-604');
  assert.match(await card.textContent(),/6:04 PM/);
  await navigate(page,()=>card.getByRole('link',{name:'Inspect the source card'}).click());
  await page.locator('#source-hark-account').waitFor();
  assert.match(await page.locator('#source-hark-account').textContent(),/Copyright 2013 William T. Hark/);
  await navigate(page,()=>page.locator('#media-ER13-HARK-PHOTO-604').getByRole('link',{name:'William T. Hark'}).first().click());
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.equal(await page.locator('h1').textContent(),'William T. Hark');
  assert.equal(await page.locator('.archive-card').count(),2);
  await page.goBack();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  await navigate(page,()=>page.getByRole('link',{name:'ncei:453682',exact:true}).click());
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.match(await page.locator('#content').textContent(),/CSV logical record/);
  assert.equal(await page.locator('.source-narrative').count()>1,true);
  await page.reload();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  await page.addStyleTag({content:'body {font-size:200%}'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.ATLAS_SCREENSHOT_DIR){await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`dossier-record-${width}-${appearance}.png`),fullPage:true});}
});

test('discovery distinguishes registered evidence and sparse record coverage',async t=>{
  const page=await fixture(t);await openDossier(page);
  await page.getByRole('combobox',{name:'Evidence available'}).selectOption('registered');
  await navigate(page,()=>page.getByRole('button',{name:'Search',exact:true}).click());
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.match(await page.locator('#content').textContent(),/No reviewed dossier meets/);
  await navigate(page,()=>page.getByRole('link',{name:'Clear evidence filters'}).click());
  await page.getByRole('combobox',{name:'Evidence available'}).selectOption('chronology');
  await navigate(page,()=>page.getByRole('button',{name:'Search',exact:true}).click());
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.equal(await page.locator('.archive-grid .archive-card').count(),1);
  assert.match(await page.locator('.archive-grid').textContent(),/Joplin/);
  await navigate(page,()=>page.getByRole('link',{name:'Wybark, Oklahoma'}).click());
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.match(await page.locator('#content').textContent(),/No reviewed canonical event association/);
  assert.match(await page.locator('.source-narrative').textContent(),/first segment of a two segment tornado/);
});

test('failed or obsolete dossier has a useful retry and cannot display stale evidence',async t=>{
  const page=await fixture(t);let fail=true;
  await page.route('**/archive/el-reno-2013-*.json',r=>fail?r.fulfill({status:503,body:'Unavailable'}):r.continue());
  await openDossier(page,'?event=el-reno-2013');assert.equal(await page.locator('h1').textContent(),'Evidence unavailable');
  fail=false;await navigate(page,()=>page.getByRole('link',{name:'Retry this view'}).click());await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.match(await page.locator('h1').textContent(),/El Reno/);
  await openDossier(page,'?record=ncei:999999999999');assert.equal(await page.locator('h1').textContent(),'Evidence unavailable');
  assert.equal(await page.locator('.source-narrative').count(),0);
});

test('slow dossier keeps a readable loading state and navigation usable',async t=>{
  const page=await fixture(t);let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/archive/el-reno-2013-*.json',async route=>{await gate;await route.continue();});
  await page.goto(base+'/dossier.html?event=el-reno-2013');
  await page.waitForFunction(()=>document.querySelector('#content h1')?.textContent==='Loading archive...');
  assert.match(await page.locator('#content').textContent(),/Loading archive/);
  assert.equal(await page.evaluate(()=>document.body.dataset.ready),undefined);
  const chapter=page.locator('#documentary-chapters a[href="joplin.html"]');
  await chapter.focus();assert.equal(await chapter.evaluate(e=>e===document.activeElement),true);
  const navigation=page.getByRole('link',{name:'Map and catalogue',exact:true});
  await navigation.focus();assert.equal(await navigation.evaluate(e=>e===document.activeElement),true);
  release();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.match(await page.locator('h1').textContent(),/El Reno/);
});

test('event and source metadata downloads preserve original values and provenance',async t=>{
  const page=await fixture(t,{acceptDownloads:true});await openDossier(page,'?event=el-reno-2013');
  const {dossier,filename}=await readDossierDownload(page);assert.equal(filename,'el-reno-2013.json');
  assert.equal(dossier.id,'el-reno-2013');assert.ok(dossier.sources.every(s=>s.locator&&s.revision&&s.rights));
  assert.equal(dossier.media[0].time.alignment,null);
  await openDossier(page,'?record=ncei:432342');
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download source record metadata'}).click();
  const received=await pending;const stream=await received.createReadStream();let text='';for await(const chunk of stream)text+=chunk;
  const record=JSON.parse(text);assert.equal(record.id,'ncei:432342');assert.match(record.narrative,/first segment of a two segment tornado/);
  assert.ok(record.provenance.source_url&&record.provenance.snapshot_id);assert.ok(record.time.begin.zone);
});

for(const width of [390,1280])test(`radar viewer preserves complete image ${width}`,async t=>{
  const page=await fixture(t,{viewport:{width,height:844}});
  await page.goto(base+'/index.html');
  // The asynchronous exhibit fills sections below the map after its first frame.
  // Wait for that layout and the source image before a pointer interaction.
  await page.waitForFunction(()=>document.querySelector('#research-log')?.children.length>0&&document.querySelector('.timeline-media-enlarge img')?.naturalWidth===597);
  await page.locator('.timeline-media-enlarge').click();
  try{await page.waitForFunction(()=>document.querySelector('#photo-full')?.naturalWidth===597);}catch(error){
    const state=await page.evaluate(()=>({open:document.querySelector('#photo-dialog')?.open,image:document.querySelector('#photo-full')?.outerHTML,title:document.querySelector('#photo-title')?.textContent,status:document.querySelector('#photo-status')?.textContent,mode:document.querySelector('#timeline-media-mode')?.value}));
    assert.fail(JSON.stringify(state)+' '+error.message);
  }
  assert.equal(await page.getByRole('button',{name:'Close viewer',exact:true}).isVisible(),true);
  const image=await page.locator('#photo-full').evaluate(e=>({width:e.naturalWidth,height:e.naturalHeight,fit:getComputedStyle(e).objectFit,box:e.getBoundingClientRect().toJSON(),dialog:document.querySelector('#photo-dialog').getBoundingClientRect().toJSON()}));
  assert.equal(image.height,599);assert.equal(image.fit,'contain');
  assert.ok(image.box.x>=image.dialog.x&&image.box.right<=image.dialog.right);
  assert.match(await page.locator('#photo-location').textContent(),/not an Atlas crop/);
  if(process.env.ATLAS_SCREENSHOT_DIR){await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`radar-viewer-${width}.png`)});}
  await page.locator('#photo-close').press('Escape');assert.equal(await page.locator('#photo-dialog').evaluate(e=>e.open),false);
});
