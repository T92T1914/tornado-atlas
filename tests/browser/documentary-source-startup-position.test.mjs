import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

const label='Inspect this still, its parent film and reuse record';
for(const width of [320,1280])for(const anchoring of ['native','disabled'])for(const action of ['activate','drag-away',...(width===320&&anchoring==='disabled'?['cancelled-click','keyboard-focus']:[])])test('documentary source return preserves native held gesture '+width+' '+anchoring+' '+action,{timeout:22000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
 const expected=base+'/dossier.html?event=el-reno-2013&media=bohac-opening-film-still#media-bohac-opening-film-still';
 const events=[],snapshots=[];let release,requested,pointerHeld=false;
 const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>requested=resolve);
 const observe=message=>{
  const text=message.text();if(!text.startsWith('BOHAC_HELD_SOURCE ')||text.length>2048)return;
  try{const row=JSON.parse(text.slice('BOHAC_HELD_SOURCE '.length));if(events.length<8)events.push(row);}catch{}
 };
 page.on('console',observe);
 await page.addInitScript(()=>{
  let count=0;
  for(const type of ['pointerdown','pointerup','click'])addEventListener(type,event=>{
   if(!event.isTrusted||count++>=8)return;
   const target=event.target instanceof Element?event.target:null,anchor=target?.closest('a');
   console.info('BOHAC_HELD_SOURCE '+JSON.stringify({type,trusted:event.isTrusted,target:target?.tagName??null,
    id:target?.id??null,href:anchor?.href??null,x:event.clientX,y:event.clientY,
    ready:document.body?.dataset.exhibitReady??null,scroll:scrollY}));
  },{capture:true,passive:true});
 });
 const region=page.locator('#bohac-film-reading');
 const snapshot=async stage=>snapshots.push({stage,...await region.getByRole('link',{name:label,exact:true}).evaluate(anchor=>{
  const r=anchor.getBoundingClientRect();return {rect:[r.x,r.y,r.width,r.height],scroll:scrollY,ready:document.body.dataset.exhibitReady??null};
 })});
 try{
  await page.goto(base+'/index.html?t=0#photos');
  await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
  await region.getByRole('link',{name:'Open Ray Bohac’s decoded film still at full resolution'}).click();
  await page.waitForURL(url=>url.pathname.endsWith('/bohac-opening-film-still.png'));
  await page.route(base+'/reader-view.mjs',async route=>{requested();await gate;await route.continue();});
  await page.goBack();await region.waitFor();
  let timer;try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Reader dependency was not held within10000ms')),10000);})]);}
  finally{clearTimeout(timer);}
  if(anchoring==='disabled')await page.addStyleTag({content:'html,body{overflow-anchor:none!important}'});
  const anchor=region.getByRole('link',{name:label,exact:true});
  assert.equal(new URL(await anchor.getAttribute('href'),base+'/').href,expected);
  assert.notEqual(await page.locator('body').getAttribute('data-exhibit-ready'),'true');
  await anchor.scrollIntoViewIfNeeded();
  const point=await anchor.evaluate(anchor=>{
   for(const r of anchor.getClientRects()){
    const x=r.x+r.width/2,y=r.y+r.height/2;
    if(r.width>0&&r.height>0&&x>0&&x<innerWidth&&y>0&&y<innerHeight&&document.elementFromPoint(x,y)?.closest('a')===anchor)return {x,y};
   }
   return null;
  });
  assert.ok(point,'The actual source link supplies a visible native hit point');
  await page.mouse.move(point.x,point.y);await snapshot('before_press');
  await page.mouse.down();pointerHeld=true;await snapshot('held_before_startup');
  if(action==='drag-away')await page.mouse.move(2,2);
  if(action==='cancelled-click'){
   await page.evaluate(label=>addEventListener('click',event=>{
    const anchor=event.target.closest?.('a');
    if(anchor?.textContent.trim()===label){event.preventDefault();window.__atlasCancelledSourceClick=event.isTrusted&&event.defaultPrevented;}
   },{capture:true,once:true}),label);
   await page.mouse.up();pointerHeld=false;
   assert.equal(await page.evaluate(()=>window.__atlasCancelledSourceClick),true,'The control cancels the default action of a real native click');
  }
  if(action==='keyboard-focus'){
   await page.keyboard.press('Tab');
   assert.equal(await anchor.evaluate(node=>node===document.activeElement),false,'Native keyboard focus leaves the pressed source');
  }
  await snapshot('before_dependency_release');
  release();await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
  await snapshot('held_after_startup');
  if(action!=='activate'){
   if(pointerHeld){await page.mouse.up();pointerHeld=false;}
   assert.equal(new URL(page.url()).pathname,'/index.html','A retired gesture does not navigate to a source');
   if(action!=='cancelled-click')assert.equal(events.some(row=>row.type==='click'&&row.href===expected),false,'No source click is replayed after a cancelled gesture');
   if(anchoring==='disabled'){
    const before=snapshots.at(-2),after=snapshots.at(-1);
    assert.ok(after.rect[1]-before.rect[1]>1000,'The actual late layout still exercises substantial growth');
    assert.equal(after.scroll,before.scroll,'The retired source anchor adds no startup scroll');
   }
   return;
  }
  const hit=await anchor.evaluate((anchor,point)=>document.elementFromPoint(point.x,point.y)?.closest('a')===anchor,point);
  assert.equal(hit,true,'The original pressed point still hits the intended source link after actual startup');
  await page.mouse.up();pointerHeld=false;
  await page.waitForURL(expected);const card=page.locator('#media-bohac-opening-film-still');await card.waitFor();
  assert.equal(await card.locator(':scope > .eyebrow').textContent(),'Film still');
  assert.match(await card.textContent(),/bohac-archived-extended-film/);
  assert.match(await card.textContent(),/unregistered/);
  for(const type of ['pointerdown','pointerup','click'])assert.ok(events.some(row=>row.type===type&&row.trusted&&row.href===expected),'The exact source anchor receives the trusted '+type);
 }finally{
  release();if(pointerHeld&&!page.isClosed())await page.mouse.up().catch(()=>{});
  page.off('console',observe);
  t.diagnostic('BOHAC_HELD_SOURCE_RESULT '+JSON.stringify({width,anchoring,action,events,snapshots,final_url:page.url(),scope:'Held actual reader dependency after native image return. Disabled CSS anchoring is a boundary control, not another browser or physical phone.'}));
 }
});
