import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
const target='https://www.youtube-nocookie.com/embed/EFwJAlg0qWc?autoplay=0&playsinline=1&rel=0';
async function delayedPage(t,hash='#photos'){
 const page=await fixture(t,{viewport:{width:320,height:900}});let release,requested;
 const gate=new Promise(r=>release=r),started=new Promise(r=>requested=r);
 t.after(()=>release());
 await page.route(base+'/data.json',async route=>{requested();await gate;await route.continue();});
 await page.route(target,r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><p>Controlled source-player fixture. No historical video is supplied.</p>'}));
 await page.addInitScript(()=>{window.__fragmentScrolls=[];const scroll=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){if(this.id&&window.__fragmentScrolls.length<32)window.__fragmentScrolls.push({id:this.id,options});return scroll.call(this,options);};});
 try {
  await page.goto(base+'/index.html?t=0'+hash);let timer;
  try {await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Exhibit data request did not arrive within the existing 10000ms action bound')),10000);})]);}
  finally {clearTimeout(timer);}
 } catch(error) {release();throw error;}
 return {page,release,card:page.locator('[data-documentary-video="EFwJAlg0qWc"]')};
}
test('documentary startup retains an untouched deep fragment',async t=>{
 const {page,release}=await delayedPage(t,'#bohac-film-reading');release();await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
 const calls=await page.evaluate(()=>window.__fragmentScrolls.filter(x=>x.id==='bohac-film-reading'));
 assert.deepEqual(calls,[{id:'bohac-film-reading',options:{behavior:'instant',block:'start'}}]);
 assert.equal(new URL(page.url()).hash,'#bohac-film-reading');
});
test('documentary startup yields during a trusted source-button mouse gesture',async t=>{
 const {page,release,card}=await delayedPage(t),button=card.getByRole('button',{name:'Load video here'});await button.scrollIntoViewIfNeeded();
 await page.evaluate(()=>{window.__sourceInput=[];for(const type of ['pointerdown','pointerup','click'])window.addEventListener(type,e=>{if(window.__sourceInput.length<12)window.__sourceInput.push({type,trusted:e.isTrusted,target:e.target.tagName,text:e.target.textContent.slice(0,48)});},true);});
 const box=await button.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down();release();await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');await page.mouse.up();
 const input=await page.evaluate(()=>window.__sourceInput);t.diagnostic('DOCUMENTARY_SOURCE_GESTURE '+JSON.stringify(input));
 assert.ok(input.some(x=>x.type==='pointerdown'&&x.trusted&&x.target==='BUTTON'));
 assert.ok(input.some(x=>x.type==='click'&&x.trusted&&x.target==='BUTTON'),'Actual pointerup activates the chosen source');
 await card.locator('iframe').waitFor();assert.equal(await card.locator('iframe').getAttribute('src'),target);
 assert.equal(await card.getByRole('button',{name:'Close video'}).getAttribute('aria-expanded'),'true');
 assert.equal(await page.evaluate(()=>window.__fragmentScrolls.filter(x=>x.id==='photos').length),0);
 await card.getByRole('button',{name:'Close video'}).click();assert.equal(await card.locator('iframe').count(),0);
});
test('documentary startup yields to native keyboard source activation',async t=>{
 const {page,release,card}=await delayedPage(t),button=card.getByRole('button',{name:'Load video here'});await button.focus();await page.keyboard.press('Enter');await card.locator('iframe').waitFor();
 release();await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');assert.equal(await card.locator('iframe').getAttribute('src'),target);
 assert.equal(await card.getByRole('button',{name:'Close video'}).getAttribute('aria-expanded'),'true');
 assert.equal(await page.evaluate(()=>window.__fragmentScrolls.filter(x=>x.id==='photos').length),0);
 assert.equal(new URL(page.url()).hash,'#photos');
});
test('documentary source controls remain independent when exhibit data fails',async t=>{
 const page=await fixture(t,{viewport:{width:320,height:900}});await page.route(base+'/data.json',r=>r.fulfill({status:503,contentType:'text/plain',body:'Controlled unavailable exhibit data'}));
 await page.route(target,r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><p>Controlled source-player fixture. No historical video is supplied.</p>'}));
 await page.goto(base+'/index.html?t=0#photos');await page.waitForFunction(()=>document.body.dataset.exhibitReady==='error');
 const card=page.locator('[data-documentary-video="EFwJAlg0qWc"]');assert.equal(await card.getByRole('link',{name:'Watch the original publication on YouTube'}).getAttribute('href'),'https://www.youtube.com/watch?v=EFwJAlg0qWc');
 assert.equal(await page.locator('#storm-photographs [data-storm-photo]').count(),3);await card.getByRole('button',{name:'Load video here'}).click();await card.locator('iframe').waitFor();
 assert.equal(await card.locator('iframe').getAttribute('src'),target);assert.equal(await page.locator('#timeline').isDisabled(),true);
 await card.getByRole('button',{name:'Close video'}).click();assert.equal(await card.locator('iframe').count(),0);
});
