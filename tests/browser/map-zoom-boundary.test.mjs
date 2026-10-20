import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

// Independent Web-Mercator geometry for the existing finite latitude bounds.
// A world at zoom zero is 256 CSS pixels wide. Latitude 85 limits its height.
const worldHeight=256/Math.PI*Math.log(Math.tan(Math.PI/4+85*Math.PI/360));
async function state(page){return page.locator('#world-map').evaluate(node=>({width:node.clientWidth,height:node.clientHeight,view:new URL(location.href).searchParams.get('view').split(',').map(Number)}));}
async function boundary(page){
 await page.waitForFunction(()=>Boolean(new URL(location.href).searchParams.get('view')));
 const s=await state(page),required=Math.max(0,Math.ceil(Math.log2(Math.max(s.width/256,s.height/worldHeight))/.25)*.25);
 assert.equal(s.view[2],required,JSON.stringify(s));
 assert.ok(256*2**s.view[2]>=s.width&&worldHeight*2**s.view[2]>=s.height);
 return s;
}
async function minimum(page){
 const button=page.locator('#zoom-out');
 const probe=await button.evaluateHandle(node=>{
  const rows=[],observe=event=>rows.push({trusted:event.isTrusted,button:event.button,detail:event.detail,zoom:Number(new URL(location.href).searchParams.get('view').split(',')[2])});
  node.addEventListener('click',observe,{passive:true});
  return {rows,stop:()=>node.removeEventListener('click',observe)};
 });
 try{
  // Preserve eight native pointer activations with one actionability check.
  await button.click({clickCount:8});
  const events=await probe.evaluate(value=>value.rows),result=await boundary(page);
  assert.equal(events.length,8);assert.ok(events.every(event=>event.trusted&&event.button===0));
  assert.ok(events.every(event=>event.zoom>=result.view[2]),'Every activation respects the independently checked minimum');
  return result;
 }finally{await probe.evaluate(value=>value.stop());await probe.dispose();}
}
async function ready(page,query='layer=local&view=0,0,0'){
 await page.goto(base+'/atlas.html?'+query);await page.locator('body[data-ready="true"]').waitFor();
}
for(const width of [320,1280,3202])for(const layer of ['local','topo'])test('finite world fills zoomed-out viewport '+width+' '+layer,async t=>{
 const page=await fixture(t,{viewport:{width,height:width===3202?1497:900},reducedMotion:'reduce',serviceWorkers:'block'});
 let tileRequests=0;
 await page.route('**/USGSTopo/MapServer/tile/**',async route=>{tileRequests++;await route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#9a9a9a"/><path d="M0 128H256M128 0V256" stroke="#555"/></svg>'});});
 await ready(page,'layer='+layer+'&view=0,0,0');const serializedLayer=new URL(page.url()).searchParams.get('layer');await minimum(page);
 await page.locator('#expand-map').click();const expanded=await minimum(page);
 await page.locator('#world-map').focus();await page.keyboard.press('-');await boundary(page);
 await page.locator('#region').selectOption('world');await minimum(page);
 await page.locator('#expand-map').click();await minimum(page);
 assert.equal(new URL(page.url()).searchParams.get('layer'),serializedLayer,'The existing default-layer serialization remains unchanged');
 assert.equal(await page.locator('#layer').inputValue(),layer);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 if(layer==='topo'){await page.waitForFunction(()=>document.querySelector('#map-status').textContent.startsWith('Modern USGS'));assert.ok(tileRequests>0,'Controlled tile responses exercise the existing layer');}
 if(width===3202&&layer==='local'&&process.env.ATLAS_REPAIR_CAPTURE_DIR){await mkdir(process.env.ATLAS_REPAIR_CAPTURE_DIR,{recursive:true});await page.locator('#expand-map').click();await minimum(page);await page.locator('#world-map').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.ATLAS_REPAIR_CAPTURE_DIR,'map-wide-finite-world.png')});}
 assert.ok(expanded.width>250);
});

test('resize relaxes the boundary, hidden return retains source and closer views',async t=>{
 const page=await fixture(t,{viewport:{width:3202,height:1497},reducedMotion:'reduce'});
 await ready(page);await page.locator('#expand-map').click();const wide=await minimum(page);
 await page.setViewportSize({width:320,height:900});const narrow=await minimum(page);assert.ok(narrow.view[2]<wide.view[2]);
 await page.setViewportSize({width:1280,height:900});await minimum(page);
 // A valid close view is preserved, while only an obsolete zoom-zero view clamps.
 await ready(page,'q=El+Reno&year=2013&layer=local&panel=map&view=35.485,-98.09589,12#record=ncei%3A453682');
 await page.locator('#detail .source-link').waitFor();
 const source=await page.locator('#detail .source-link').getAttribute('href');
 for(const viewport of [{width:320,height:900},{width:3202,height:1497},{width:1280,height:900}]){
  await page.setViewportSize(viewport);assert.equal((await state(page)).view[2],12);
  assert.equal(await page.locator('#detail .source-link').getAttribute('href'),source);
  assert.equal(await page.locator('#detail .eyebrow').textContent(),'ncei:453682');
 }
 await page.setViewportSize({width:320,height:900});await page.locator('#show-list').click();await page.setViewportSize({width:390,height:844});await page.locator('#show-map').click();
 assert.equal((await state(page)).view[2],12);assert.equal(await page.locator('#query').inputValue(),'El Reno');assert.equal(await page.locator('#year').inputValue(),'2013');
 await page.reload();await page.locator('body[data-ready="true"]').waitFor();assert.equal((await state(page)).view[2],12);assert.equal(await page.locator('#detail .source-link').getAttribute('href'),source);
});

test('failed provider retains finite zoom boundary and working local geography',async t=>{
 const page=await fixture(t,{viewport:{width:3202,height:1497},reducedMotion:'reduce'});
 await page.route('**/USGSTopo/MapServer/tile/**',route=>route.fulfill({status:503,body:'Controlled unavailable map tile'}));
 await ready(page,'layer=topo&view=0,0,0');await page.locator('#expand-map').click();await minimum(page);
 await page.waitForFunction(()=>document.querySelector('#map-status').textContent.startsWith('USGS map unavailable'));
 await page.locator('#world-map').focus();await page.keyboard.press('-');await boundary(page);
 assert.equal(await page.locator('#world-map .context-land').count()>0,true);
 assert.match(await page.locator('#map-status').textContent(),/record list still work/);
});
