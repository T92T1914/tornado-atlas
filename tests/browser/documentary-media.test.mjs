import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
const events=[{file:'index.html',section:'photos',video:'EFwJAlg0qWc',photo:'assets/el-reno-2013/storm03.jpg'},{file:'joplin.html',section:'photographs-and-film',video:'wuU-nFuIZN4',photo:'assets/joplin-2011/storm.jpg'},{file:'tuscaloosa.html',section:'photographs-and-film',video:'9KjWtBrEYHY',photo:'assets/tuscaloosa-birmingham-2011/birmingham-aftermath-april29.jpg'},{file:'blackwell.html',section:'photographs-and-film',video:'Em5HbYt0Fsk',photo:'assets/blackwell-1955/nara-283884.jpg'}];
for(const width of [320,1280])for(const event of events)test('real documentary media and chosen external player '+event.file+' '+width,async t=>{
 const page=await fixture(t,{viewport:{width,height:900}}),providers=[];
 page.on('request',r=>{if(/youtube|googlevideo|ytimg/.test(r.url()))providers.push(r.url());});
 await page.goto(base+'/'+event.file+(event.file==='index.html'?'?t=0':'')+'#'+event.section);
 const section=page.locator('#'+event.section),image=section.locator('img[src="'+event.photo+'"]');
 await image.scrollIntoViewIfNeeded();await page.waitForFunction(src=>{const image=document.querySelector('img[src="'+src+'"]');return image?.complete&&image.naturalWidth>0;},event.photo);
 assert.equal(await section.locator('canvas').count(),0,'Museum photographs never include an authored reconstruction canvas');
 assert.equal(await section.locator('iframe').count(),0);assert.deepEqual(providers,[],'No external video or poster loads before selection');
 if(process.env.ATLAS_DOCUMENTARY_MEDIA_CAPTURE){
  const folder=process.env.ATLAS_DOCUMENTARY_MEDIA_CAPTURE;await mkdir(folder,{recursive:true});
  for(const img of await section.locator('img').all()){
   await img.scrollIntoViewIfNeeded();await img.evaluate(image=>image.decode());
  }
  await section.screenshot({path:path.join(folder,event.file.replace('.html','')+'-'+width+'.png'),animations:'disabled'});
 }
 const card=section.locator('[data-documentary-video="'+event.video+'"]'),button=card.getByRole('button',{name:'Load video here'});await button.waitFor();
 const target='https://www.youtube-nocookie.com/embed/'+event.video+'?autoplay=0&playsinline=1&rel=0';
 await page.route(target,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Controlled external-player fixture</title><p>No source video is provided by this fixture.</p>'}));
 const url=page.url();await button.click();assert.equal(page.url(),url,'Media opening does not change source history or the clock');
 const frame=card.locator('iframe');await frame.waitFor();assert.equal(await frame.getAttribute('src'),target);assert.ok(await frame.getAttribute('title'));assert.equal(await card.getByRole('button',{name:'Close video'}).getAttribute('aria-expanded'),'true');
 assert.equal(await card.getByRole('link',{name:'Watch the original publication on YouTube'}).getAttribute('href'),'https://www.youtube.com/watch?v='+event.video);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await card.getByRole('button',{name:'Close video'}).click();assert.equal(await card.locator('iframe').count(),0);assert.equal(page.url(),url);
});
for(const event of ['joplin-2011','blackwell-1955','tuscaloosa-birmingham-2011'])test('El Reno appearance study is absent for '+event,async t=>{
 const page=await fixture(t);await page.goto(base+'/reconstruction.html?event='+event);
 await page.locator('#replay-event:not([disabled])').waitFor();
 assert.equal(await page.locator('#replay-reported-appearance').isVisible(),false);
 assert.equal(await page.locator('#early-condensation-canvas').getAttribute('data-documentary-state'),null);
});

test('documentary media source links and photographs remain readable without scripts',async t=>{
 for(const event of events){
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900}});
  await page.goto(base+'/'+event.file+'#'+event.section);
  const section=page.locator('#'+event.section);
  assert.equal(await section.locator('img[src="'+event.photo+'"]').isVisible(),true);
  assert.equal(await section.locator('canvas,iframe').count(),0);
  assert.equal(await section.getByRole('button',{name:'Load video here'}).count(),0);
  assert.equal(await section.getByRole('link',{name:'Watch the original publication on YouTube'}).getAttribute('href'),'https://www.youtube.com/watch?v='+event.video);
  await page.close();
 }
});
