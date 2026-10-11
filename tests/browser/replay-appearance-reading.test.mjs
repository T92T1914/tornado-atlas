import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
const sourceRoute=seconds=>base+'/reconstruction.html?event=el-reno-2013&t='+seconds+'&appearance_view=photo&appearance_photo=wakimoto-visible-condensation';
const painted=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function inspectScene(page,disableGraphics){
 await page.addInitScript(disable=>{
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(kind,...args){
   if(disable&&this.id==='replay-appearance-canvas'&&kind==='webgl2')return null;
   const context=get.call(this,kind,...args);
   if(this.id!=='replay-scene'||kind!=='2d'||!context)return context;
   const arc=context.arc,fill=context.fillRect;
   context.fillRect=function(...args){if(args[0]===0&&args[1]===0)window.pathSceneDraws={particleArcs:0,centerRings:0};return fill.apply(this,args);};
   context.arc=function(...args){const record=window.pathSceneDraws;if(record){if(Math.abs(this.globalAlpha-.09)<.00001)record.particleArcs++;if(args[2]===7&&this.globalAlpha===1)record.centerRings++;}return arc.apply(this,args);};
   return context;
  };
 },disableGraphics);
}
async function expectCenterOnly(page){
 await painted(page);
 assert.equal(await page.locator('#replay-funnel').isDisabled(),true);
 assert.equal(await page.locator('#replay-stage-kind').textContent(),'SOURCE APPEARANCE / CENTER POSITION');
 const actual=await page.evaluate(()=>window.pathSceneDraws);
 assert.equal(actual.particleArcs,0);
 assert.equal(actual.centerRings,1);
 assert.match(await page.locator('#replay-basis').textContent(),/center marker/);
 return actual;
}
for(const width of [320,1280])for(const unavailable of [false,true])test('primary photographic appearance, center-only geography and native reading '+width+' graphics '+(unavailable?'disabled':'available'),async t=>{
 const page=await fixture(t,{viewport:{width,height:1100},reducedMotion:'reduce'});
 await inspectScene(page,unavailable);
 await page.goto(sourceRoute(1241));await page.locator('#replay-time:not([disabled])').waitFor();
 await page.waitForFunction(()=>document.querySelector('#replay-appearance-canvas').dataset.partialKind==='visible_condensation_region');
 const actual=await expectCenterOnly(page);
 assert.equal(await page.locator('#replay-funnel').isChecked(),true);
 assert.equal(await page.locator('.replay-controls #replay-appearance').count(),0);
 assert.equal(await page.locator('.replay-main > #replay-appearance').count(),1);
 assert.equal(await page.locator('#replay-appearance #replay-time').count(),1);
 assert.equal(await page.evaluate(()=>Boolean(document.querySelector('#replay-appearance-drawing').compareDocumentPosition(document.querySelector('#replay-photo-record'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
 const start=new URL(await page.locator('#replay-appearance-start').getAttribute('href'));
 assert.equal(start.searchParams.get('t'),'1241');assert.equal(start.searchParams.get('appearance_photo'),'wakimoto-visible-condensation');
 assert.equal(await page.locator('#replay-photo-original').isVisible(),true);
 const rect=await page.locator('#replay-appearance-canvas').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}));
 if(unavailable){
  assert.equal(await page.locator('#replay-appearance-canvas').evaluate(n=>n.hidden),true);
  assert.equal(await page.locator('#replay-appearance-renderer-status').textContent(),'The form renderer could not start here. Source and coverage text remain available.');
 }else if(await page.locator('#replay-appearance-canvas').isVisible()){
  if(width===1280){assert.ok(rect.width>500,JSON.stringify(rect));assert.ok(rect.height>250,JSON.stringify(rect));}
  assert.ok(rect.height>=160);await page.locator('#replay-appearance-drawing').scrollIntoViewIfNeeded();
  if(process.env.ATLAS_APPEARANCE_READING_CAPTURE){await mkdir(process.env.ATLAS_APPEARANCE_READING_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_APPEARANCE_READING_CAPTURE,width+'-primary-source.png'),fullPage:false});}
 }else{
  assert.equal(await page.locator('#replay-appearance-renderer-status').textContent(),'The form renderer could not start here. Source and coverage text remain available.');t.diagnostic('Actual appearance graphics unavailable; explicit source-reading fallback checked.');
 }
 await page.locator('#replay-time').fill('1241.25');await expectCenterOnly(page);
 assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
 assert.match(await page.locator('#replay-appearance-state').textContent(),/unknown at this exact clock instant/);
 await page.locator('#replay-appearance-mode').selectOption('photo:wakimoto-visible-margin');
 await page.locator('[data-photo-sample="wakimoto-232501"]').click();await expectCenterOnly(page);
 assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-partial-kind'),'visible_condensation_region');
 assert.equal(await page.locator('#replay-time').inputValue(),'1261');
 await page.locator('[data-photo-sample="wakimoto-232509"]').click();await expectCenterOnly(page);
 assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-partial-kind'),'visible_margin');
 assert.equal(await page.locator('#replay-time').inputValue(),'1269');
 await page.locator('#replay-time').fill('1265');await expectCenterOnly(page);
 assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
 await page.locator('#replay-scale-jump').click();
 assert.equal(new URL(page.url()).hash,'#replay-scale-impact');
 assert.equal(await page.locator('#replay-time').inputValue(),'1265');
 assert.equal(await page.locator('.replay-width-comparison li').count(),3);
 await page.locator('#replay-appearance-mode').selectOption('source');await painted(page);
 assert.equal(await page.locator('#replay-funnel').isDisabled(),false);
 assert.equal(await page.locator('#replay-funnel').isChecked(),true);
 assert.ok((await page.evaluate(()=>window.pathSceneDraws.particleArcs))>0);
 await page.locator('#replay-funnel').uncheck();await painted(page);
 await page.locator('#replay-appearance-mode').selectOption('photo:wakimoto-visible-condensation');await expectCenterOnly(page);
 assert.equal(await page.locator('#replay-funnel').isChecked(),false);
 await page.locator('#replay-appearance-mode').selectOption('source');await painted(page);
 assert.equal(await page.locator('#replay-funnel').isChecked(),false);
 assert.equal(await page.evaluate(()=>window.pathSceneDraws.particleArcs),0);
 await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=1241&appearance_view=photo&appearance_photo=undeclared');
 await page.locator('#replay-time:not([disabled])').waitFor();await expectCenterOnly(page);
 assert.match(await page.locator('#replay-appearance-state').textContent(),/selection unavailable/);
 await page.locator('#replay-appearance-start').click();await page.locator('#replay-time:not([disabled])').waitFor();await expectCenterOnly(page);
 await page.reload();await page.locator('#replay-time:not([disabled])').waitFor();await expectCenterOnly(page);
 assert.equal(await page.locator('#replay-time').inputValue(),'1241');
 await page.goBack();await page.locator('#replay-time:not([disabled])').waitFor();await expectCenterOnly(page);
 assert.match(await page.locator('#replay-appearance-state').textContent(),/selection unavailable/);
 const enlarged=await page.evaluate(()=>{const rows=[...document.querySelectorAll('#replay-appearance *')].map(n=>[n,parseFloat(getComputedStyle(n).fontSize)]);for(const [n,size] of rows)n.style.fontSize=(size*2)+'px';return {count:rows.length,doubled:rows.every(([n,size])=>Math.abs(parseFloat(getComputedStyle(n).fontSize)-size*2)<.1)};});
 assert.equal(enlarged.doubled,true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 t.diagnostic('APPEARANCE_PRIMARY_READING '+JSON.stringify({viewport:width,graphics_deliberately_disabled:unavailable,actual_geographic_draw:actual,appearance_rect:rect,enlarged}));
});
