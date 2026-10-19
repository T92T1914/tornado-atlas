import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base,withNavigationDiagnostics} from './harness.mjs';
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

for(const width of [320,1280])for(const method of ['pointer','keyboard'])test('documentary startup keeps the static appearance link usable before reader enhancement '+width+' '+method,async t=>{
 const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
 let release,requested;
 const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>requested=resolve);
 t.after(release);
 await page.route(base+'/reader-view.mjs',async route=>{requested();await gate;await route.continue();});
 const events=[];
 const observe=message=>{
  const text=message.text();if(!text.startsWith('ATLAS_NAVIGATION_OBSERVATION ')||text.length>4096)return;
  try{const event=JSON.parse(text.slice('ATLAS_NAVIGATION_OBSERVATION '.length));
   if(events.length<4&&event.type==='click')events.push({trusted:event.trusted,intended:event.intended_target,ready:event.exhibit_ready});
  }catch{}
 };
 const retireGate=frame=>{if(frame===page.mainFrame()&&new URL(frame.url()).pathname==='/reconstruction.html')release();};
 page.on('console',observe);page.on('framenavigated',retireGate);
 try{
  await withNavigationDiagnostics(page,'early_static_appearance_link',async mark=>{
   await page.goto(base+'/index.html#partial-condensation-reading');
   let timer;try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Reader gate did not arrive within the existing 10000ms action bound')),10000);})]);}
   finally{clearTimeout(timer);}
   assert.notEqual(await page.evaluate(()=>document.body.dataset.exhibitReady),'true');
   const link=page.locator('#partial-condensation-reading').getByRole('link',{name:'Open its appearance study in the simulator'});
   const expected=base+'/reconstruction.html?event=el-reno-2013&t=1241&appearance_view=photo&appearance_photo=wakimoto-visible-condensation';
   assert.equal(new URL(await link.getAttribute('href'),base).href,expected);
   mark('early_static_native_'+method,expected);
   if(method==='keyboard'){await link.focus();await page.keyboard.press('Enter');}
   else await link.click();
   release();await page.waitForURL(expected);
   await page.locator('#replay-time:not([disabled])').waitFor();
   assert.equal(await page.locator('#replay-time').inputValue(),'1241');
   assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'photo:wakimoto-visible-condensation');
   assert.ok(events.some(event=>event.trusted&&event.intended&&event.ready!=='true'),'The unchanged static link received a trusted activation before enhancement completed');
   t.diagnostic('EARLY_STATIC_APPEARANCE_LINK '+JSON.stringify({width,method,events}));
  });
 }finally{release();page.off('console',observe);page.off('framenavigated',retireGate);}
});

for(const width of [390,1280])test('documentary startup keeps Nolte native entry during a held reader gesture '+width,async t=>{
 const page=await fixture(t,{viewport:{width,height:900}});
 const label='Read this reported instant in the player',prefix='NOLTE_HELD_GESTURE ';
 const expected=base+'/reconstruction.html?event=el-reno-2013&t=397&appearance_view=photo&appearance_photo=nolte-reported-stills#replay-appearance';
 const observed={width,expected_player:expected,events:[],snapshots:{}};let release,requested,held=false;
 const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>requested=resolve);
 t.after(()=>release());
 await page.route(base+'/reader-view.mjs',async route=>{requested();await gate;await route.continue();});
 const listen=message=>{
  const text=message.text();if(!text.startsWith(prefix)||text.length>2048)return;
  try{const row=JSON.parse(text.slice(prefix.length));if(observed.events.length<3)observed.events.push(row);}catch{}
 };
 page.on('console',listen);t.after(()=>page.off('console',listen));
 await page.addInitScript(({label,prefix})=>{
  const small=value=>value==null?null:String(value).slice(0,256);
  const box=r=>({x:r.x,y:r.y,width:r.width,height:r.height});
  window.__nolteHeldGestureState=()=>{
   const a=[...document.querySelectorAll('#documentary-nolte-231037 a')].find(n=>n.textContent.trim()===label);
   const range=document.createRange();if(a)range.selectNodeContents(a);
   return {url:small(location.href),exhibit_ready:small(document.body?.dataset.exhibitReady),
    document_time_origin:performance.timeOrigin,scroll_y:scrollY,contents_open:document.getElementById('exhibit-contents')?.open??null,
    anchor:a?{present:true,tag:a.tagName,href:small(a.href),rects:[...a.getClientRects()].slice(0,4).map(box),
     text_rects:[...range.getClientRects()].slice(0,4).map(box)}:{present:false}};
  };
  let count=0;
  for(const type of ['pointerdown','pointerup','click'])addEventListener(type,event=>{
   if(!event.isTrusted||count++>=3)return;
   const node=event.target instanceof Element?event.target:null,a=node?.closest('a');
   console.info(prefix+JSON.stringify({type:event.type,trusted:event.isTrusted,target_tag:small(node?.tagName),target_id:small(node?.id),
    anchor_tag:small(a?.tagName),anchor_href:small(a?.href),x:event.clientX,y:event.clientY,
    exhibit_ready:small(document.body?.dataset.exhibitReady),document_time_origin:performance.timeOrigin,scroll_y:scrollY}));
  },{capture:true,passive:true});
 },{label,prefix});
 const state=()=>page.evaluate(()=>window.__nolteHeldGestureState());
 try{
  await page.goto(base+'/index.html#documentary-nolte-231037');
  let timer;try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Actual reader module route did not arrive within10000ms')),10000);})]);}
  finally{clearTimeout(timer);}
  assert.notEqual(await page.evaluate(()=>document.body?.dataset.exhibitReady),'true');
  const link=page.locator('#documentary-nolte-231037').getByRole('link',{name:label,exact:true});
  assert.equal(new URL(await link.getAttribute('href'),base+'/').href,expected);
  await link.scrollIntoViewIfNeeded();
  const point=await link.evaluate(a=>{
   const range=document.createRange();range.selectNodeContents(a);
   for(const r of range.getClientRects()){
    const x=r.x+r.width/2,y=r.y+r.height/2;
    if(r.width>0&&r.height>0&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&document.elementFromPoint(x,y)?.closest('a')===a)return {x,y};
   }
   return null;
  });
  assert.ok(point,'A visible actual Nolte text rectangle supplies the trusted pointer location');observed.saved_pointer=point;
  await page.mouse.move(point.x,point.y);observed.snapshots.before_down=await state();
  await page.mouse.down();held=true;observed.snapshots.after_down_before_release=await state();
  assert.ok(observed.events.some(e=>e.type==='pointerdown'&&e.trusted&&e.target_tag==='A'&&e.anchor_href===expected&&e.exhibit_ready!=='true'));
  release();await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');
  observed.snapshots.after_ready_before_up=await state();
  await page.mouse.up();held=false;
  await page.waitForURL(expected);await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#replay-time').inputValue(),'397');
  for(const type of ['pointerdown','pointerup','click'])assert.ok(observed.events.some(e=>e.type===type&&e.trusted&&e.target_tag==='A'&&e.anchor_tag==='A'&&e.anchor_href===expected),'Actual trusted '+type+' reaches the exact Nolte anchor');
  assert.ok(observed.events.some(e=>e.type==='click'&&e.exhibit_ready==='true'));
 }catch(error){observed.error={name:error.name,message:String(error.message).slice(0,512)};throw error;}
 finally{
  release();if(held&&!page.isClosed())await page.mouse.up().catch(()=>{});
  page.off('console',listen);observed.actual_final_url=page.url().slice(0,256);
  const diagnostic=JSON.stringify(observed);t.diagnostic('NOLTE_HELD_GESTURE '+diagnostic);
  assert.ok(Buffer.byteLength(diagnostic,'utf8')<=16384,'Three bounded pointer events and geometry snapshots stay within16KiB');
 }
});
