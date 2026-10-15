import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
import {inspectDossierHop} from './dossier-navigation-diagnostics.mjs';
const still='assets/el-reno-2013/bohac-opening-film-still.png';
const archive='https://commons.wikimedia.org/wiki/File:May_31_El_Reno_EF5_Extended_Version_filmed_up_close_in_the_TVN_Dominator_1.ogv';
for(const width of [320,1280])test('derived film still, parent source and additional creator player '+width,async t=>{
 const page=await fixture(t,{viewport:{width,height:900}}),providers=[];
 page.on('request',r=>{if(/youtube|googlevideo|ytimg/.test(r.url()))providers.push(r.url());});
 await page.goto(base+'/index.html?t=0#photos');
 const region=page.locator('#bohac-film-reading'),img=region.locator('img');
 // Finish the existing hash restoration before scrolling the lower lazy image.
 await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
 await img.evaluate(node=>node.scrollIntoView({behavior:'instant',block:'center'}));
 assert.equal(await img.evaluate(node=>{const r=node.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}),true,'The real film still intersects the viewport');
 try {
  await page.waitForFunction(src=>{const img=document.querySelector('img[src="'+src+'"]');return img?.complete&&img.naturalWidth===1280&&img.naturalHeight===720;},still);
 } catch(error) {
  let timer;
  try {
   const state=await Promise.race([img.evaluate(node=>{const r=node.getBoundingClientRect();return {src:node.getAttribute('src'),currentSrc:node.currentSrc,loading:node.loading,complete:node.complete,naturalWidth:node.naturalWidth,naturalHeight:node.naturalHeight,rect:{top:r.top,bottom:r.bottom,width:r.width,height:r.height},viewport:innerHeight,scrollY,hash:location.hash,exhibitReady:document.body.dataset.exhibitReady};}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Film still diagnostic exceeded 500 milliseconds')),500);})]);
   t.diagnostic('FILM_STILL_FAILURE '+JSON.stringify(state));
  } catch(diagnosticError) {t.diagnostic('FILM_STILL_FAILURE '+String(diagnosticError.message).slice(0,256));}
  finally {clearTimeout(timer);}
  throw error;
 }
 await img.evaluate(i=>i.decode());
 assert.match(await region.textContent(),/Decoded film still/);
 assert.match(await region.textContent(),/rather than a separately taken photograph/);
 assert.equal(await page.locator('#storm-photographs [data-storm-photo]').count(),3,'Three separately taken photographs retain their viewer group');
 assert.equal(await page.locator('#photos canvas, #photos svg, #photos iframe').count(),0);
 assert.deepEqual(providers,[],'No source film or poster loads before reader selection');
 assert.equal(await region.getByRole('link',{name:'Watch the archived film on Wikimedia Commons'}).getAttribute('href'),archive);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 if(process.env.ATLAS_ADDITIONAL_DOCUMENTARY_CAPTURE){await mkdir(process.env.ATLAS_ADDITIONAL_DOCUMENTARY_CAPTURE,{recursive:true});await region.screenshot({path:path.join(process.env.ATLAS_ADDITIONAL_DOCUMENTARY_CAPTURE,'licensed-film-still-'+width+'.png')});}
 await region.getByRole('link',{name:'Open Ray Bohac’s decoded film still at full resolution'}).click();
 await page.waitForURL(u=>u.pathname.endsWith('/bohac-opening-film-still.png'));
 await page.goBack();await region.waitFor();
 const card=page.locator('#media-bohac-opening-film-still');
 await inspectDossierHop(page,async()=>{
  await region.getByRole('link',{name:'Inspect this still, its parent film and reuse record'}).click();
  await card.waitFor();
 });
 assert.equal(await card.locator(':scope > .eyebrow').textContent(),'Film still');
 assert.match(await card.textContent(),/not a separately taken photograph/);
 assert.match(await card.textContent(),/bohac-archived-extended-film/);
 assert.match(await card.textContent(),/unregistered/);
 await card.getByRole('link',{name:'Ray Bohac',exact:true}).first().click();
 const contribution=page.locator('#media-bohac-opening-film-still');await contribution.waitFor();
 assert.equal(await contribution.locator(':scope > .eyebrow').textContent(),'Film still','Creator contribution uses the same accurate derived label');
 await page.goto(base+'/dossier.html?event=el-reno-2013&media=nolte-el-reno-documentary-photo#media-nolte-el-reno-documentary-photo');
 const original=page.locator('#media-nolte-el-reno-documentary-photo');await original.waitFor();
 assert.equal(await original.locator(':scope > .eyebrow').textContent(),'photograph','Parentless source photographs keep their own medium');
 await page.goto(base+'/tuscaloosa.html#photographs-and-film');
 const ros=page.locator('[data-documentary-video="5ohIVzIZLuQ"]');
 const target='https://www.youtube-nocookie.com/embed/5ohIVzIZLuQ?autoplay=0&playsinline=1&rel=0';
 await page.route(target,r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Controlled provider fixture</title><p>No historical video is supplied.</p>'}));
 const before=page.url();await ros.getByRole('button',{name:'Load video here'}).click();
 const frame=ros.locator('iframe');await frame.waitFor();assert.equal(await frame.getAttribute('src'),target);assert.equal(page.url(),before);
 await ros.getByRole('button',{name:'Close video'}).click();assert.equal(await ros.locator('iframe').count(),0);
 await ros.getByRole('link',{name:'Source and inspection record'}).click();
 const source=page.locator('#media-rosolowski-tuscaloosa-original');await source.waitFor();
 assert.match(await source.textContent(),/opening paused presentation was inspected/);
 assert.match(await source.textContent(),/later requested sample did not settle/);
 assert.match(await source.textContent(),/links only/);
 assert.equal(await source.getByRole('link',{name:'Open original media at its source'}).getAttribute('href'),'https://www.youtube.com/watch?v=5ohIVzIZLuQ');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});
test('additional documentary sources and full film still remain native without scripts',async t=>{
 const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900}});
 await page.goto(base+'/index.html#bohac-film-reading');
 const region=page.locator('#bohac-film-reading');assert.equal(await region.locator('img').isVisible(),true);
 assert.match(await region.textContent(),/Decoded film still/);assert.equal(await region.locator('canvas,svg,iframe').count(),0);
 assert.equal(await region.getByRole('link',{name:'Watch the archived film on Wikimedia Commons'}).getAttribute('href'),archive);
 const summary=region.getByText('About this film and still',{exact:true});await summary.focus();await page.keyboard.press('Enter');
 assert.equal(await summary.evaluate(node=>node.parentElement.open),true);assert.match(await region.locator('details').innerText(),/complete film and audio remain unreviewed/);
 await region.getByRole('link',{name:'Open Ray Bohac’s decoded film still at full resolution'}).focus();
 await Promise.all([page.waitForURL(u=>u.pathname.endsWith('/bohac-opening-film-still.png')),page.keyboard.press('Enter')]);
 await page.goto(base+'/tuscaloosa.html#photographs-and-film');const ros=page.locator('[data-documentary-video="5ohIVzIZLuQ"]');
 assert.equal(await ros.getByRole('button',{name:'Load video here'}).count(),0);
 assert.equal(await ros.getByRole('link',{name:'Watch the original publication on YouTube'}).getAttribute('href'),'https://www.youtube.com/watch?v=5ohIVzIZLuQ');
 assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});
