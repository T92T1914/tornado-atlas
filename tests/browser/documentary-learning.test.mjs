import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base,withNavigationDiagnostics} from './harness.mjs';

for(const width of [320,1280])test('controlled documentary motion and source journey '+width,async t=>{
 const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'}),motionRequests=[];
 page.on('request',r=>{if(/bohac-opening-source-relative\.(mp4|webm)/.test(r.url()))motionRequests.push(r.url());});
 await page.goto(base+'/index.html?t=0#bohac-opening-motion');
 await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
 const region=page.locator('#bohac-opening-motion'),video=region.locator('video');
 assert.equal(await video.getAttribute('preload'),'none');assert.equal(await video.getAttribute('autoplay'),null);assert.equal(await video.getAttribute('loop'),null);
 // preload is a browser hint, not a guarantee of zero media requests.
 assert.equal(await video.evaluate(v=>v.paused),true);assert.equal(await video.evaluate(v=>v.currentTime),0);
 assert.equal(await page.locator('#published-position').inputValue(),'0');
 const allowedSources=new Set(['mp4','webm'].map(format=>base+'/assets/el-reno-2013/bohac-opening-source-relative.'+format));
 assert.ok(motionRequests.every(url=>allowedSources.has(url)),'Any browser-selected preload retains the exact reviewed asset');
 t.diagnostic('CLIP_BEFORE_PLAY '+JSON.stringify({requests:motionRequests,scope:'Browser preload may occur; playback remains paused at source time zero.'}));
 const play=region.getByRole('button',{name:'Play short clip'});await play.focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>{const v=document.querySelector('[data-documentary-clip]');return v.videoWidth===1280&&v.videoHeight===720&&v.currentTime>0.1&&!v.paused;});
 assert.ok(allowedSources.has(await video.evaluate(v=>v.currentSrc)),'Actual playing source is a reviewed full-frame encode');
 assert.equal(await page.locator('#published-position').inputValue(),'0','Source elapsed playback does not move the historical clock');
 await region.getByRole('button',{name:'Pause short clip'}).click();assert.equal(await video.evaluate(v=>v.paused),true);
 t.diagnostic('CLIP_BEFORE_SEEK '+JSON.stringify(await video.evaluate(v=>({time:v.currentTime,duration:v.duration,ready:v.readyState,network:v.networkState,seekable:Array.from({length:v.seekable.length},(_,i)=>[v.seekable.start(i),v.seekable.end(i)]),buffered:Array.from({length:v.buffered.length},(_,i)=>[v.buffered.start(i),v.buffered.end(i)]),source:v.currentSrc,error:v.error?.code}))));await video.evaluate(v=>{v.currentTime=2;});await page.waitForFunction(()=>Math.abs(document.querySelector('[data-documentary-clip]').currentTime-2)<0.05);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.equal(await video.evaluate(v=>{const r=v.getBoundingClientRect();return Math.abs(r.width/r.height-1280/720)<0.03;}),true,'Full frame is retained without a fixed crop');
 if(process.env.ATLAS_LEARNING_CAPTURE){await mkdir(process.env.ATLAS_LEARNING_CAPTURE,{recursive:true});await region.screenshot({path:path.join(process.env.ATLAS_LEARNING_CAPTURE,'bohac-motion-'+width+'.png')});}
 await play.click();await page.waitForFunction(()=>document.querySelector('[data-documentary-clip]').currentTime>2.1);
 await video.evaluate(v=>{v.currentTime=3.7;});await page.waitForFunction(()=>document.querySelector('[data-documentary-clip]').ended);
 // Native ended can become true before the queued ended handler updates the reader.
 await page.waitForFunction(()=>{const clip=document.querySelector('[data-documentary-clip]');return clip.ended&&/Passage ended/.test(clip.closest('section').querySelector('[role=status]').textContent);});
 assert.match(await region.locator('[role=status]').textContent(),/Passage ended/);
 await play.click();await page.waitForFunction(()=>!document.querySelector('[data-documentary-clip]').paused);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));assert.equal(await video.evaluate(v=>v.paused),true,'Leaving retires playback');
 await region.getByRole('link',{name:'Clip, parent and reuse record'}).click();const card=page.locator('#media-bohac-opening-documentary-motion');await card.waitFor();
 assert.match(await card.textContent(),/bohac-archived-extended-film/);assert.match(await card.textContent(),/unregistered/);
 await page.goBack();await region.waitFor();assert.equal(await video.evaluate(v=>v.paused),true);
});
test('failed documentary media retains originals and can retry',async t=>{
 const page=await fixture(t);await withNavigationDiagnostics(page,'documentary-media-retry',async mark=>{
 await page.route('**/bohac-opening-source-relative.*',r=>r.fulfill({status:404,body:'Controlled unavailable media'}));
 mark('documentary-media-failed-entry',base+'/index.html#bohac-opening-motion');
 await page.goto(base+'/index.html#bohac-opening-motion');const region=page.locator('#bohac-opening-motion');
 await region.getByRole('button',{name:'Play short clip'}).click();await page.waitForFunction(()=>document.querySelector('[data-clip-action]').textContent==='Retry short clip');
 assert.equal(await region.getByRole('link',{name:'Archived extended film'}).count(),1);
 mark('documentary-media-retry-playback');
 await page.unroute('**/bohac-opening-source-relative.*');await region.getByRole('button',{name:/Play short clip|Retry short clip/}).click();
 await page.waitForFunction(()=>{const v=document.querySelector('[data-documentary-clip]');return v.videoWidth===1280&&v.currentTime>0.1&&!v.paused;});
 });
});
test('documentary motion keeps native controls and reading without scripts',async t=>{
 const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900}});
 await page.goto(base+'/index.html#bohac-opening-motion');const region=page.locator('#bohac-opening-motion');
 assert.equal(await region.locator('video[controls]').count(),1);assert.equal(await region.getByRole('button').count(),0);
 assert.equal(await region.getByRole('link',{name:'Open the MP4 clip'}).count(),1);assert.match(await region.textContent(),/not UTC/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});
for(const width of [320,1280])test('worked dossier comparisons retain real records '+width,async t=>{
 const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
 await page.goto(base+'/joplin.html#utility-worked-comparison');const utility=page.locator('#utility-worked-comparison');
 assert.match(await utility.textContent(),/13,700/);assert.match(await utility.textContent(),/17,000/);assert.match(await utility.textContent(),/rather than zero/);
 await utility.getByRole('link',{name:'Compare the preserved reporting entries'}).click();await page.locator('#utility-reporting-record>summary').click();assert.match(await page.locator('#utility-reporting-record').textContent(),/May 25/);
 await page.goto(base+'/tuscaloosa.html#survey-worked-comparison');const survey=page.locator('#survey-worked-comparison');
 for(const [name,id,rating] of [['Compare Account 1',0,'EF3'],['Compare Account 159',158,'EF4'],['Inspect Account 17 outside the estimate',16,'EF0']]){
  await survey.getByRole('link',{name,exact:true}).click();const card=page.locator('#survey-account-'+id);await card.waitFor();assert.match(await card.textContent(),new RegExp(rating));await page.goBack();await survey.waitFor();
 }
 await page.goto(base+'/blackwell.html#storm-and-tornadoes');const storm=page.locator('#storm-and-tornadoes');assert.match(await storm.textContent(),/another tornado/);assert.match(await storm.textContent(),/probably/);
 await storm.getByRole('link',{name:'Inspect this attributed sequence'}).click();await page.locator('#observation-nws-parent-storm-separate-tornadoes').waitFor();
 await page.goBack();await storm.waitFor();await page.locator('html').evaluate(n=>n.style.fontSize='200%');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});

test('alternate reviewed WebM plays when MP4 is unavailable',async t=>{
 const page=await fixture(t);await page.route('**/bohac-opening-source-relative.mp4',r=>r.fulfill({status:404,body:'Controlled missing codec alternative'}));
 await page.goto(base+'/index.html#bohac-opening-motion');await page.locator('#bohac-opening-motion').getByRole('button',{name:'Play short clip'}).click();
 await page.waitForFunction(()=>{const v=document.querySelector('[data-documentary-clip]');return v.currentSrc.endsWith('.webm')&&v.videoWidth===1280&&v.videoHeight===720&&v.currentTime>0.1&&!v.paused;});
});

test('scientific method reading reaches its attributed observation and returns',async t=>{
 const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});await page.goto(base+'/index.html#tracked-feature-radar');
 const chapter=page.locator('#tracked-feature-radar');for(const text of ['19.0','3.7','39.8','15.7','2–3 m/s','20 m/s','qualitative consistency','not clock accuracy','not acquired'])assert.ok((await chapter.textContent()).includes(text),text);
 const action=chapter.getByRole('link',{name:'Inspect the feature-tracking observation and limits'});await action.focus();await page.keyboard.press('Enter');
 const record=page.locator('#observation-wakimoto-2016-dust-feature-radar-comparison');await record.waitFor();assert.match(await record.textContent(),/not Atlas measurements/);assert.match(await record.textContent(),/not clock accuracy/);
 await page.goBack();await chapter.waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});
