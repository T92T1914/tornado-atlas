import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fixture,base,withNavigationDiagnostics} from './harness.mjs';
const timeline=JSON.parse(await readFile(new URL('../../exhibits/el-reno-2013/appearance-timeline.json',import.meta.url)));
const samples=timeline.photo_sequences[0].samples;
const names=['231037','231059','231202'];
const expected=['e9ad30c4fdcb6a28340bbb0e422b80cbc937ef248b497092246c7bff51fd4847','10de8e092a55e9f4e87650f6731fb70e0829ba90246335f48c484ce3bca47a8c','2232f9f7276c1a59f96464720e5295d8cad6d8a0f1ef3289d9a111a1a1a27e36'];
const player=(at=397)=>base+'/reconstruction.html?event=el-reno-2013&t='+at+'&appearance_view=photo&appearance_photo=nolte-reported-stills#replay-appearance';
async function ready(page){await page.locator('#replay-time:not([disabled])').waitFor();}
async function shown(page,index){
 await page.waitForFunction(()=>{const img=document.getElementById('photo-full');return document.getElementById('photo-dialog').open&&!img.hidden&&img.naturalWidth===1920&&img.naturalHeight===1080;});
 assert.equal(await page.locator('#photo-title').textContent(),'Nick Nolte / '+names[index]+'.jpg');
 assert.equal(await page.locator('#photo-source').getAttribute('href'),samples[index].hosted_image.original_url);
 assert.equal(await page.locator('#photo-original').getAttribute('href'),samples[index].hosted_image.asset);
 assert.match(await page.locator('#photo-credit').textContent(),/item-specific permission/);
 const hash=await page.evaluate(async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(document.getElementById('photo-full').src)).arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join(''));
 assert.equal(hash,expected[index],'Actual displayed Blob has the independent full JPEG identity');
 const framing=await page.locator('#photo-full').evaluate(img=>({fit:getComputedStyle(img).objectFit,rect:img.getBoundingClientRect().toJSON()}));
 assert.equal(framing.fit,'contain');assert.ok(framing.rect.height>0&&framing.rect.width>0);
}
async function capture(page,name,locator){
 if(!process.env.ATLAS_NOLTE_PRIVATE_CAPTURE_DIR)return;
 const folder=process.env.ATLAS_NOLTE_PRIVATE_CAPTURE_DIR;assert.ok(!folder.includes('ci-diagnostics'));
 await mkdir(folder,{recursive:true});await (locator??page).screenshot({path:path.join(folder,name+'.png')});
}
for(const width of [320,1280])test('Nolte full documentary story, checked images, item source and player '+width,async t=>{
 const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
 const external=[];page.on('request',r=>{if(/nnwx.us|youtube.com/.test(r.url()))external.push(r.url());});
 await withNavigationDiagnostics(page,'nolte_article_initial',async mark=>{
 mark('nolte_article_initial',base+'/index.html#nolte-documentary-photographs');
 await page.goto(base+'/index.html#nolte-documentary-photographs');
 mark('nolte_article_viewer_ready');
 await page.waitForFunction(()=>Boolean(document.querySelector('#photo-retry')));
 const group=page.locator('#nolte-documentary-photographs');assert.equal(await group.locator('[data-documentary-photo]').count(),3);
 for(let index=0;index<3;index++){
  const card=page.locator('#documentary-nolte-'+names[index]),opener=card.locator('[data-documentary-photo]');
  mark('nolte_viewer_open_'+names[index]);
  await opener.focus();await page.keyboard.press('Enter');await shown(page,index);
  await capture(page,'nolte-dialog-'+names[index]+'-'+width,page.locator('#photo-full'));
  if(index===1)await capture(page,'nolte-dialog-context-'+width);
  mark('nolte_viewer_close_'+names[index]);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
  assert.equal(await page.locator('#photo-full').getAttribute('src'),null);
  assert.equal(await opener.evaluate(a=>document.activeElement===a),true);
  assert.equal(await card.locator('img').getAttribute('src'),samples[index].hosted_image.asset);
  assert.match(await card.textContent(),/clock accuracy|not independently calibrated/);
 }
 assert.deepEqual(external,[],'No automatic creator or movie acquisition');
 await capture(page,'nolte-story-'+width,page.locator('#documentary-nolte-231037 img'));
 await page.locator('#nolte-documentary-photographs h3').scrollIntoViewIfNeeded();await capture(page,'nolte-story-context-'+width);
 const articleURL=page.url();
 const link=page.locator('#documentary-nolte-231059 a').filter({hasText:'Source and item permission'});
 const destination=await link.getAttribute('href');mark('nolte_item_source',base+'/'+destination);
 await Promise.all([page.waitForURL(base+'/'+destination),link.click()]);
 const source=page.locator('#media-nolte-231059-full-documentary');await source.waitFor();
 assert.match(await source.textContent(),/Hosting basis recorded|permitted hosting|permitted_hosting/);
 assert.match(await source.textContent(),/21:02|1262/);assert.equal(await source.locator('a').filter({hasText:'Open original media at its source'}).getAttribute('href'),samples[1].hosted_image.original_url);
 mark('nolte_article_back',articleURL);
 await page.goBack();await group.waitFor();await page.waitForURL(articleURL);
 mark('nolte_returned_article_ready',articleURL);
 await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');
 const play=page.locator('#documentary-nolte-231059 a').filter({hasText:'Read this reported instant'});
 mark('nolte_player_input',player(419));
 assert.equal(new URL(await play.getAttribute('href'),base+'/').href,player(419));
 await Promise.all([page.waitForURL(/reconstruction.html/),play.click()]);
 mark('nolte_player_ready',player(419));await ready(page);
 mark('nolte_player_assertions',player(419));
 assert.equal(await page.locator('#replay-time').inputValue(),'419');assert.equal(await page.locator('#replay-photo-creator-guide').getAttribute('href'),'https://www.youtube.com/watch?v=jsBDFA6_81M&t=1262s');
 const full=page.locator('#replay-photo-full');await full.focus();await page.keyboard.press('Enter');await shown(page,1);
 assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
 await page.locator('#photo-close').click();assert.equal(await full.evaluate(a=>a===document.activeElement),true);
 await page.locator('[data-photo-sample="nolte-231255"]').click();
 assert.equal(await page.locator('#replay-photo-full').count(),0);assert.equal(await page.locator('#replay-photo-creator-guide').count(),0);
 assert.match(await page.locator('#replay-photo-record').textContent(),/No photograph is loaded or copied/);
 assert.equal(await page.locator('#replay-appearance img,#replay-appearance iframe').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 });
});
test('Nolte no-script full frame reading retains all marks and native original links',async t=>{
 const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900}});
 await page.goto(base+'/index.html#nolte-documentary-photographs');
 for(let index=0;index<3;index++){
  const card=page.locator('#documentary-nolte-'+names[index]),image=card.locator('img');await image.scrollIntoViewIfNeeded();
  const state=await image.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,fit:getComputedStyle(img).objectFit,box:img.getBoundingClientRect().toJSON()}));
  assert.equal(state.width,1920);assert.equal(state.height,1080);assert.equal(state.fit,'contain');assert.ok(Math.abs(state.box.width/state.box.height-1920/1080)<0.01);
  assert.equal(await card.locator('[data-documentary-photo]').getAttribute('href'),samples[index].hosted_image.asset);
  assert.match(await card.textContent(),/Nick Nolte|complete|copyright/);
 }
 await capture(page,'nolte-no-script-full-marks',page.locator('#documentary-nolte-231202 img'));
 const direct=page.locator('#documentary-nolte-231202 a').filter({hasText:'Open the unchanged full resolution JPEG'});
 const target=base+'/'+samples[2].hosted_image.asset;
 const [response]=await Promise.all([page.waitForResponse(r=>r.url()===target),direct.click()]);
 assert.equal(response.status(),200);assert.equal(createHash('sha256').update(await response.body()).digest('hex'),expected[2]);
 await page.waitForURL(target);await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth===1920);
 assert.equal(await page.locator('img').evaluate(img=>img.naturalHeight),1080);
 await page.goBack();await page.locator('#nolte-documentary-photographs').waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});
test('Nolte native history retires only its selected dialog and unknown gaps clear the full action',async t=>{
 const page=await fixture(t,{viewport:{width:390,height:900}});await page.goto(player());await ready(page);
 await page.locator('[data-photo-sample="nolte-231059"]').click();await page.locator('#replay-photo-full').click();await shown(page,1);
 await page.goBack();await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&document.getElementById('replay-time').value==='397');
 assert.equal(await page.locator('#photo-full').getAttribute('src'),null);assert.equal(await page.locator('#replay-photo-full').getAttribute('href'),samples[0].hosted_image.asset);
 assert.equal(await page.evaluate(()=>document.activeElement?.isConnected),true);
 await page.goForward();await page.waitForFunction(()=>document.getElementById('replay-time').value==='419');
 await page.locator('#replay-photo-full').click();await shown(page,1);
 // History traversal above is native; this adverse mode change exercises an open-modal retirement.
 await page.locator('#replay-appearance-mode').selectOption('source');await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
 assert.equal(await page.locator('#photo-full').getAttribute('src'),null);
 await page.goto(player(450));await ready(page);assert.equal(await page.locator('#replay-photo-full').count(),0);
 assert.equal(await page.locator('#replay-photo-creator-guide').count(),0);
});
test('Nolte rejects a valid sibling JPEG and retries only the selected full original',async t=>{
 const page=await fixture(t,{viewport:{width:320,height:900}});let correct=false,requests=0;
 const first=samples[0].hosted_image,other=await readFile(new URL('../../web/'+samples[1].hosted_image.asset,import.meta.url));
 const original=await readFile(new URL('../../web/'+first.asset,import.meta.url));
 await page.route('**/'+first.asset,route=>{requests++;return route.fulfill({contentType:'image/jpeg',body:correct?original:other});});
 await page.goto(player());await ready(page);await page.locator('#replay-photo-full').click();await page.locator('#photo-retry').waitFor();
 assert.equal(await page.locator('#photo-full').getAttribute('src'),null);assert.equal(await page.locator('#photo-full').isVisible(),false);
 assert.match(await page.locator('#photo-status').textContent(),/does not match/);assert.equal(requests,1);
 correct=true;await page.locator('#photo-retry').click();await shown(page,0);assert.equal(requests,2);
 await capture(page,'nolte-retried-exact-231037',page.locator('#photo-full'));
 await page.keyboard.press('Escape');await page.locator('[data-photo-sample="nolte-231202"]').click();await page.locator('#replay-photo-full').click();await shown(page,2);
 assert.match(await page.locator('#photo-caption').textContent(),/23:12Z/);assert.doesNotMatch(await page.locator('#photo-caption').textContent(),/23:10:37Z/);
});
test('Nolte enlarged reading and dialog retain full image and reachable source links',async t=>{
 const page=await fixture(t,{viewport:{width:320,height:900}});await page.goto(base+'/index.html#nolte-documentary-photographs');await page.waitForFunction(()=>Boolean(document.getElementById('photo-retry')));
 await page.evaluate(()=>{const root=document.getElementById('nolte-documentary-photographs'),nodes=[root,...root.querySelectorAll('*')];const sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});
 await page.locator('[data-documentary-photo="nolte-231202"]').focus();await page.keyboard.press('Enter');await shown(page,2);
 await page.evaluate(()=>{const root=document.getElementById('photo-dialog'),nodes=[root,...root.querySelectorAll('*')];const sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});
 await page.locator('#photo-original').scrollIntoViewIfNeeded();assert.equal(await page.locator('#photo-original').isVisible(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await capture(page,'nolte-enlarged-dialog-marks',page.locator('#photo-full'));
 await page.keyboard.press('Escape');
});

test('Nolte page retirement closes its dialog before document history restoration',async t=>{
 const page=await fixture(t,{viewport:{width:390,height:900}});
 await page.addInitScript(()=>{window.noltePageShows=[];addEventListener('pageshow',event=>window.noltePageShows.push({persisted:event.persisted}));});
 await page.goto(base+'/index.html#documentary-nolte-231037');await page.locator('#documentary-nolte-231037 a').filter({hasText:'Read this reported instant'}).click();await ready(page);
 await page.locator('#replay-photo-full').click();await shown(page,0);
 await page.goBack();await page.locator('#nolte-documentary-photographs').waitFor();await page.goForward();await ready(page);
 assert.equal(await page.locator('#photo-dialog').evaluate(d=>d.open),false);
 assert.equal(await page.locator('#photo-full').getAttribute('src'),null);
 // A freshly loaded player mounts this viewer lazily; a restored one may
 // retain the cleared status node. Neither route may retain success text.
 assert.ok(await page.locator('#photo-status').count()<=1);
 for(const text of await page.locator('#photo-status').allTextContents())assert.equal(text,'');
 t.diagnostic('Actual restored pageshow observations: '+JSON.stringify(await page.evaluate(()=>window.noltePageShows)));
 await page.locator('#replay-photo-full').click();await shown(page,0);
 // Explicit lifecycle-event control also decides synchronous cleanup when a
 // host preserves the document. It is not proof that this engine used BFCache.
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 assert.equal(await page.locator('#photo-dialog').evaluate(d=>d.open),false);
 assert.equal(await page.locator('#photo-full').getAttribute('src'),null);assert.equal(await page.locator('#photo-status').textContent(),'');
 await page.locator('#replay-photo-full').click();await shown(page,0);
});
