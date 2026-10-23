import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';

const original = await readFile(new URL('../../web/app.js',import.meta.url),'utf8');
const sourceHash = createHash('sha256').update(original).digest('hex');
assert.equal(sourceHash,'766d604e909af3cc3b13f8ca4d74e00b0eabb8c1dec987003aba0ab6b832b1ab','The bounded diagnostic uses the reviewed application');
let instrumented = original;
function once(needle,replacement) {
 assert.equal(instrumented.split(needle).length,2,'One exact diagnostic transformation: '+needle.slice(0,70));
 instrumented = instrumented.replace(needle,replacement);
}
once('function startupReaderPosition() {','function startupReaderPosition() {\n  const diagnose = row => window.__atlasStartupPositionNote(row);');
once('  const clear = () => { anchor = null; };',
 "  const clear = event => { diagnose({kind:'clear',reason:typeof event === 'string' ? event : event?.type || 'explicit',active:!!anchor}); anchor = null; };");
once("if (nativeLink() && document.elementFromPoint(event.clientX,event.clientY)?.closest('a[href]') !== anchor.button) clear();",
 "if (nativeLink() && document.elementFromPoint(event.clientX,event.clientY)?.closest('a[href]') !== anchor.button) clear('pointermove');");
once("const sourceActivated = () => { if (nativeLink()) clear(); };",
 "const sourceActivated = () => { if (nativeLink()) clear('click'); };");
once("const focusChanged = () => { if (anchor && document.activeElement !== anchor.button) clear(); };",
 "const focusChanged = () => { if (anchor && document.activeElement !== anchor.button) clear('focusin'); };");
once("const hidden = () => { if (document.hidden) clear(); };",
 "const hidden = () => { if (document.hidden) clear('visibilitychange'); };");
once('      const owner = anchor;',
 "      const owner = anchor;\n      diagnose({kind:'update',owner:!!owner});");
once("        scrollStyle?.setProperty('overflow-anchor','none','important');",
 "        scrollStyle?.setProperty('overflow-anchor','none','important');\n        diagnose({kind:'before-read',policyRequested:!!scrollStyle,owner:!!owner && anchor === owner});");
once('        before = current() ? owner.button.getBoundingClientRect() : null;',
 "        before = current() ? owner.button.getBoundingClientRect() : null;\n        diagnose({kind:'measured',top:before?.top ?? null,bottom:before?.bottom ?? null,width:before?.width ?? null,height:before?.height ?? null,owner:!!owner && anchor === owner});");
once("          else scrollStyle.removeProperty('overflow-anchor');",
 "          else scrollStyle.removeProperty('overflow-anchor');\n          diagnose({kind:'restored',value:previousAnchoring[0],priority:previousAnchoring[1]});");
once('            const after = owner.button.getBoundingClientRect();',
 "            const after = owner.button.getBoundingClientRect();\n            diagnose({kind:'correcting',before:before.top,after:after.top,delta:after.top-before.top,owner:!!owner && anchor === owner});");
once('    retire() {\n      clear();',
 "    retire() {\n      clear('retire');");
assert.notEqual(instrumented,original);
new Function(instrumented);

test('bounded startup position diagnostic collects phases without accepting the source journey',{timeout:22000},async t=>{
 const page = await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});
 const label = 'Inspect this still, its parent film and reuse record';
 const expected = base+'/dossier.html?event=el-reno-2013&media=bohac-opening-film-still#media-bohac-opening-film-still';
 let release,requested,pointerHeld = false,observations = null,pointHit = null;
 const gate = new Promise(resolve=>release=resolve),started = new Promise(resolve=>requested=resolve),snapshots = [];
 await page.addInitScript(()=>{
  const record = {entries:[],omitted:0,errors:0};
  window.__atlasStartupPositionDiagnostic = record;
  const note = row => {
   try {if (record.entries.length < 128) record.entries.push(row);else record.omitted++;}
   catch {record.errors++;}
  };
  window.__atlasStartupPositionNote = note;
  const scrollBy = window.scrollBy;
  window.scrollBy = function(...args) {
   const option = args[0];
   note({kind:'scrollBy',top:typeof option === 'object' ? option?.top ?? null : args[1] ?? null});
   return Reflect.apply(scrollBy,this,args);
  };
  for (const type of ['pointermove','pointerdown','pointerup','click','focusin']) {
   addEventListener(type,event=>{
    const target = event.target instanceof Element ? event.target : null;
    note({kind:'event',type,trusted:event.isTrusted,target:target?.tagName ?? null,id:target?.id ?? null,
     ready:document.body?.dataset.exhibitReady ?? null});
   },{capture:true,passive:true});
  }
 });
 await page.route(base+'/app.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:instrumented}));
 const region = page.locator('#bohac-film-reading');
 const snapshot = async stage=>snapshots.push({stage,...await region.getByRole('link',{name:label,exact:true}).evaluate(anchor=>{
  const r = anchor.getBoundingClientRect();
  return {rect:[r.x,r.y,r.width,r.height],scroll:scrollY,ready:document.body.dataset.exhibitReady ?? null};
 })});
 try {
  await page.goto(base+'/index.html?t=0#photos');
  await page.waitForFunction(()=>document.body.dataset.exhibitReady === 'true');
  await region.getByRole('link',{name:'Open Ray Bohac’s decoded film still at full resolution'}).click();
  await page.waitForURL(url=>url.pathname.endsWith('/bohac-opening-film-still.png'));
  await page.route(base+'/reader-view.mjs',async route=>{requested();await gate;await route.continue();});
  await page.goBack();await region.waitFor();
  let timer;
  try {await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Reader dependency was not held within10000ms')),10000);})]);}
  finally {clearTimeout(timer);}
  const anchor = region.getByRole('link',{name:label,exact:true});
  assert.equal(new URL(await anchor.getAttribute('href'),base+'/').href,expected);
  assert.notEqual(await page.locator('body').getAttribute('data-exhibit-ready'),'true');
  await anchor.scrollIntoViewIfNeeded();
  const point = await anchor.evaluate(anchor=>{
   for (const r of anchor.getClientRects()) {
    const x=r.x+r.width/2,y=r.y+r.height/2;
    if(r.width>0&&r.height>0&&x>0&&x<innerWidth&&y>0&&y<innerHeight&&document.elementFromPoint(x,y)?.closest('a')===anchor)return {x,y};
   }
   return null;
  });
  assert.ok(point,'The actual source link supplies the diagnostic press point');
  await page.mouse.move(point.x,point.y);await snapshot('before_press');
  await page.mouse.down();pointerHeld=true;await snapshot('held_before_startup');
  await snapshot('before_dependency_release');release();
  await page.waitForFunction(()=>document.body.dataset.exhibitReady === 'true');await snapshot('held_after_startup');
  pointHit = await anchor.evaluate((anchor,point)=>document.elementFromPoint(point.x,point.y)?.closest('a')===anchor,point);
  observations = await page.evaluate(()=>window.__atlasStartupPositionDiagnostic);
  assert.ok(observations.entries.some(row=>row.kind === 'update'));
  assert.ok(observations.entries.length <= 128);
  assert.ok(Number.isSafeInteger(observations.omitted)&&observations.omitted >= 0);
  assert.equal(observations.errors,0,'Diagnostic collection errors are not visitor evidence');
 } finally {
  release();if(pointerHeld&&!page.isClosed())await page.mouse.up().catch(()=>{});
  const row = {source_sha256:sourceHash,source_variant:'Instrumented fixture only',point_hit:pointHit,
   visitor_accepted:false,snapshots,observations,final_url:page.url(),
   scope:'Collection evidence only. Records existing source rect values and scroll arguments with bounded passive events. Instrumentation can alter timing. The separate exact original fixture remains the acceptance gate. Native queue internals are not measured.'};
  const output = JSON.stringify(row);
  assert.ok(Buffer.byteLength(output) <= 32768,'Bounded diagnostic output');
  t.diagnostic('ATLAS_STARTUP_POSITION_DIAGNOSTIC '+output);
 }
});
