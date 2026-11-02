import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';
import {assertReadingReflow} from './reading-reflow-diagnostics.mjs';
import {noScriptImage} from './no-script-image.mjs';

// Exact reviewed publications, not expectations generated from the current index.
const stories=[
 {event:'moore-2013',digest:'d7a6ec9d4ca0081f368bd2703c2b65ac3ba6e05dcabfc333029f42af87c1f654',article:'moore.html',section:'weather-support-after-the-tornado',observation:'moore-response-weather-support',source:'nws-event-hub',original:'https://www.weather.gov/oun/events-20130520',
  file:'archive/moore-2013-d7a6ec9d4ca0081f368b.json',wire:'1541685e18bc57b125e1779658c39c5858dc05e2e4bad71af193b06f2ae3145f',bytes:57874,
  facts:[/Warren Theater parking lot/,/May 21/,/7 a\.m\. to 7 p\.m\./,/Tuesday through Saturday/],limits:/printed shift hours have no separate time-zone label/},
 {event:'udall-1955',digest:'33163d1731a0f30fae5e138ab18b67c7f97121ef229a7748a79f9a6b517ba802',article:'udall.html',section:'damage-and-aftermath',observation:'udall-directional-damage-comparison',source:'nws-wichita-storm-report',original:'https://www.weather.gov/ict/udall_stormreport',
  file:'archive/udall-1955-33163d1731a0f30fae5e.json',wire:'8296d1156ba922652b7e8a708a7e3e267fec69a923f2a8aec360fbf5494d70cc',bytes:37573,
  facts:[/water tower toward the southwest/,/another group remained on the siding/,/free edge pointed northeast/],limits:/not a newly measured wind field/},
 {event:'blackwell-1955',digest:'dcb7f27027e6e619290215f8ae554e38ab2a45a51aff59861427b8d3285e6ae2',article:'blackwell.html',section:'observations',observation:'blackwell-witness-weather-sequences',source:'nws-wichita',original:'https://www.weather.gov/ict/udall_stormreport',
  file:'archive/blackwell-1955-dcb7f27027e6e6192902.json',wire:'d14d75d302f1236b507e7e583420ff9c6ac7a6c0ee2c7807efa37f3fd3a62cd5',bytes:55792,
  facts:[/southern Blackwell/,/north-side account/,/Arkansas City/,/do not establish an eye or a safe interval/],limits:/Kansas accounts are not moved into Blackwell/}
];
const asset='assets/moore-2013/bruce_command.jpg',imageSHA='b08b9dea73be54a692887caf361d262858561e8e8f4d912518a8dc8737e78281';
const originalImage='https://www.weather.gov/images/oun/wxevents/20130520/bruce_command.jpg';
const alt='People standing and sitting around tables with papers and communication equipment inside a fire-station bay.';
const absolute=route=>new URL(route,base+'/').href;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function activate(page,link){await link.scrollIntoViewIfNeeded();await link.focus();assert.equal(await link.evaluate(n=>document.activeElement===n),true);await page.keyboard.press('Enter');}
async function ready(page,appearance='dark',script=true){
 await page.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.endsWith('/documentary-page.css')&&s.cssRules.length>0)&&document.fonts.status==='loaded');
 if(script){await page.locator('#reading-appearance:not([disabled])').waitFor();await page.locator('#reading-appearance').selectOption(appearance);}
 else assert.equal(await page.locator('#reading-appearance').isDisabled(),true);
 assert.equal(await page.locator('html').getAttribute('data-appearance'),appearance);
}
async function chapter(page,section){const toc=page.locator('.documentary-contents');if(!await toc.evaluate(n=>n.open))await activate(page,toc.locator('summary'));await activate(page,toc.locator('a[href="#'+section+'"]'));await page.waitForURL(u=>u.hash==='#'+section);}
async function capture(page,name,anchor){if(!process.env.ATLAS_DOCUMENTARY_CAPTURE)return;await anchor.scrollIntoViewIfNeeded();await mkdir(process.env.ATLAS_DOCUMENTARY_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_DOCUMENTARY_CAPTURE,name+'.png'),fullPage:false});}
function noExternal(page,t){const outside=[];page.on('request',r=>{if(!r.url().startsWith(base+'/')&&!r.url().startsWith('blob:'+base+'/'))outside.push(r.url());});t.after(()=>assert.deepEqual(outside,[],'Source links never request an external provider'));
}
async function imageLayout(page,{noScript=false}={}){
 const image=page.locator('#moore-command-post img');await image.scrollIntoViewIfNeeded();
 await page.waitForFunction(({asset,url})=>{const n=document.querySelector('#moore-command-post img');return n?.getAttribute('src')===asset&&n.currentSrc===url&&n.complete&&n.naturalWidth===2592&&n.naturalHeight===1936;},{asset,url:absolute(asset)});
 // A returned page Promise can remain pending in no-script Firefox.
 // Reuse the maintained synchronous bitmap witness; full layout and byte checks remain separate.
 if(noScript)await noScriptImage(image,{source:absolute(asset),width:2592,height:1936});
 else await image.evaluate(n=>n.decode());
 const view=await image.evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n),clips=[],altered=[];for(let p=n;p;p=p.parentElement){const c=getComputedStyle(p),b=p.getBoundingClientRect();if(c.filter!=='none'||c.mixBlendMode!=='normal'||Number(c.opacity)!==1||c.visibility!=='visible')altered.push(p.id||p.tagName);if(c.clipPath!=='none'||c.maskImage&&c.maskImage!=='none'||['hidden','clip','auto','scroll'].includes(c.overflowX)&&r.left<b.left-1||['hidden','clip','auto','scroll'].includes(c.overflowX)&&r.right>b.right+1||['hidden','clip','auto','scroll'].includes(c.overflowY)&&r.top<b.top-1||['hidden','clip','auto','scroll'].includes(c.overflowY)&&r.bottom>b.bottom+1)clips.push(p.id||p.tagName);}
  const points=[[r.left+3,r.top+3],[r.right-3,r.top+3],[r.left+3,r.bottom-3],[r.right-3,r.bottom-3],[r.left+r.width/2,r.bottom-3]];
  return {width:r.width,height:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right,viewport:[innerWidth,innerHeight],fit:s.objectFit,clips,altered,visibleEdges:points.map(([x,y])=>document.elementFromPoint(x,y)===n),alt:n.alt};});
 assert.equal(view.alt,alt);assert.notEqual(view.fit,'cover');assert.ok(view.width>0&&view.height>0);assert.ok(Math.abs(view.width/view.height-2592/1936)<.01,'The full image rectangle retains its aspect');
 assert.ok(view.left>=-1&&view.right<=view.viewport[0]+1&&view.top>=-1&&view.bottom<=view.viewport[1]+1,'The whole image, including its bottom edge, is in the inspection viewport');assert.deepEqual(view.clips,[],'No ancestor clips or masks the full image');assert.deepEqual(view.altered,[],'Documentary colors and opacity are not changed by presentation filters');assert.ok(view.visibleEdges.every(Boolean),'All four corners and the bottom edge remain unobscured');
 const figure=page.locator('#moore-command-post');assert.match(await figure.innerText(),/Bruce Thoren \/ NWS/);assert.match(await figure.innerText(),/May 22, 2013/);assert.match(await figure.innerText(),/exact exposure time and camera position remain unknown/);
 assert.equal(await figure.locator('a[href="'+originalImage+'"]').count(),1);return image;
}
async function checkedBody(response,expected){assert.equal(response.status(),200);assert.equal(response.request().method(),'GET');const bytes=await response.body();assert.equal(bytes.length,expected.bytes);assert.equal(hash(bytes),expected.wire);return JSON.parse(bytes.toString('utf8'));}
async function enlarge(page,selector){const before=await page.locator(selector).first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize));await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')],sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});assert.ok(await page.locator(selector).first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=before*1.99);await assertReadingReflow(page,'Enlarged response reading');}
async function returnToArticle(page,card,spec){const summary=card.locator('summary').filter({hasText:'Continue in the current article'});await activate(page,summary);await activate(page,card.locator('a[href="'+absolute(spec.article+'#'+spec.section)+'"]'));await page.waitForURL(absolute(spec.article+'#'+spec.section));}
async function observationJourney(page,spec,preservePredecessor=false){
 const link=page.locator('#'+spec.section+' a[href*="observation='+spec.observation+'"]');const href=await link.evaluate(n=>n.href);
 const [response]=await Promise.all([page.waitForResponse(r=>r.url()===absolute(spec.file)),activate(page,link)]);await waitForDossier(page,{href,elementId:'observation-'+spec.observation});const doc=await checkedBody(response,spec);assert.equal(doc.id,spec.event);assert.match(await page.locator('#content').innerText(),new RegExp(spec.digest));
 const row=doc.observations.find(x=>x.id===spec.observation);assert.equal(row.source_id,spec.source);assert.equal(row.status.rights,'links_only');assert.equal(row.status.temporal,'unregistered');assert.equal(row.status.spatial,'unregistered');assert.equal(row.time.alignment,null);assert.equal(row.place.coordinates,null);assert.match(row.limits,spec.limits);
 if(preservePredecessor){
  const digest='ea29259561776155de0dce541ee11642c175258d8b6af476c5b143f1fed47bcf',retained={file:'archive/udall-1955-ea29259561776155de0d.json',wire:'e3f665325c67a5769e2f1d514d25229ffd2b702f73c60b56c23e077aa05b541e',bytes:35841};
  const prior=page.locator('#revision-'+digest).getByRole('link',{name:'Open this dossier revision',exact:true}),priorHref=await prior.evaluate(n=>n.href);assert.equal(new URL(priorHref).searchParams.get('revision'),digest);
  const [priorResponse]=await Promise.all([page.waitForResponse(r=>r.url()===absolute(retained.file)),activate(page,prior)]);await waitForDossier(page,{href:priorHref,elementId:'correction-history'});const old=await checkedBody(priorResponse,retained);assert.equal(old.id,'udall-1955');assert.equal(old.observations.some(x=>x.id==='udall-directional-damage-comparison'),false);assert.equal(await page.locator('#observation-udall-directional-damage-comparison').count(),0);assert.match(await page.locator('#content').innerText(),/reading a retained dossier revision/);
  await page.goBack();await waitForDossier(page,{href,elementId:'observation-'+spec.observation});
 }
 const observation=page.locator('#observation-'+spec.observation);assert.match(await observation.innerText(),spec.limits);
 const source=observation.getByRole('link',{name:'Inspect the source card',exact:true}),sourceHref=await source.evaluate(n=>n.href);assert.equal(new URL(sourceHref).searchParams.get('source'),spec.source);assert.equal(new URL(sourceHref).searchParams.get('revision'),null);
 await activate(page,source);await waitForDossier(page,{href:sourceHref,elementId:'source-'+spec.source});const card=page.locator('#source-'+spec.source);assert.equal(await card.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),spec.original);await returnToArticle(page,card,spec);
 await page.goBack();await waitForDossier(page,{href:sourceHref,elementId:'source-'+spec.source});await page.goForward();await page.waitForURL(absolute(spec.article+'#'+spec.section));return doc;
}
async function mediaJourney(page){
 const spec=stories[0],media=page.locator('#moore-command-post a[href*="media=moore-command-post"]'),href=await media.evaluate(n=>n.href);await activate(page,media);await waitForDossier(page,{href,elementId:'media-moore-command-post'});
 const card=page.locator('#media-moore-command-post');assert.match(await card.innerText(),/Bruce Thoren/);assert.match(await card.innerText(),/permitted hosting/);assert.match(await card.innerText(),/exact exposure clock/);
 await activate(page,card.locator('summary').filter({hasText:'Clock roles and registration'}));const clocks=JSON.parse(await card.locator('details').filter({has:page.locator('summary').filter({hasText:'Clock roles and registration'})}).locator('pre').textContent());assert.equal(clocks.capture.reported_date,'May 22, 2013');assert.equal(clocks.capture.precision,'source_caption_day');assert.equal(clocks.video,null);assert.equal(clocks.alignment,null);
 const source=card.getByRole('link',{name:'Inspect the source card',exact:true}),sourceHref=await source.evaluate(n=>n.href);assert.equal(new URL(sourceHref).searchParams.get('source'),'nws-moore-command-post');await activate(page,source);await waitForDossier(page,{href:sourceHref,elementId:'source-nws-moore-command-post'});
 const item=page.locator('#source-nws-moore-command-post');assert.equal(await item.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),originalImage);assert.match(await item.innerText(),/courtesy storm photographs/);await returnToArticle(page,item,spec);
}
for(const spec of stories)for(const [width,appearance]of [[320,'dark'],[1280,'light']])test('Response reading '+spec.event+' source and return '+width,{timeout:60000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});noExternal(page,t);
 // Capture the first actual native image response, including an eager load before the anchor scroll.
 let imageResponse=null;page.on('response',r=>{if(r.url()===absolute(asset)&&!imageResponse)imageResponse=r;});
 await page.goto(absolute(spec.article));await ready(page,appearance);await chapter(page,spec.section);const section=page.locator('#'+spec.section);for(const fact of spec.facts)assert.match(await section.innerText(),fact);
 if(spec.event==='moore-2013'){await imageLayout(page);assert.ok(imageResponse,'The complete JPEG produced a native browser response');assert.equal(imageResponse.status(),200);const bytes=await imageResponse.body();assert.equal(bytes.length,1669372);assert.equal(hash(bytes),imageSHA);}
 const doc=await observationJourney(page,spec,spec.event==='udall-1955'&&width===1280);await ready(page,appearance);
 if(spec.event==='moore-2013'){
  const media=doc.media.find(x=>x.id==='moore-command-post');assert.deepEqual(media.roles,{creator:'bruce-thoren-nws',uploader:'nws-norman',rights_holder:null});assert.equal(media.transformation.sha256,imageSHA);assert.equal(media.transformation.asset,asset);assert.deepEqual([media.transformation.bytes,media.transformation.width,media.transformation.height],[1669372,2592,1936]);assert.equal(media.parent,null);assert.equal(media.time.publication,null);
  await mediaJourney(page);await ready(page,appearance);await activate(page,page.locator('#moore-command-post a[data-photo-id="moore-command-post"]'));await page.waitForURL(absolute(asset));await page.locator('img').evaluate(n=>n.decode());assert.deepEqual(await page.locator('img').evaluate(n=>[n.naturalWidth,n.naturalHeight]),[2592,1936]);await page.goBack();await page.waitForURL(absolute(spec.article+'#'+spec.section));await ready(page,appearance);await imageLayout(page);
 }
 await capture(page,'response-'+spec.event+'-'+width,spec.event==='moore-2013'?page.locator('#moore-command-post img'):section);
 await enlarge(page,'#'+spec.section+' > p');await page.reload();await ready(page,appearance);for(const fact of spec.facts)assert.match(await page.locator('#'+spec.section).innerText(),fact);await assertReadingReflow(page,'Reloaded response reading');
});

test('Response reading Moore no-script complete photograph and native return 320',{timeout:40000},async t=>{
 const phaseStarted=performance.now();let phaseOrdinal=0;
 const phase=(name,edge)=>t.diagnostic('ATLAS_MOORE_NOSCRIPT_PHASE '+JSON.stringify({phase:name,edge,ordinal:++phaseOrdinal,elapsed_ms:Math.round(performance.now()-phaseStarted)}));
 phase('fixture-and-response-listener','before');
 const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900},reducedMotion:'reduce'});noExternal(page,t);let response=null;page.on('response',r=>{if(r.url()===absolute(asset)&&!response)response=r;});
 phase('fixture-and-response-listener','after');
 phase('initial-article-navigation','before');
await page.goto(absolute('moore.html'));
 phase('initial-article-navigation','after');
 phase('initial-style-readiness','before');
await ready(page,'dark',false);
 phase('initial-style-readiness','after');
 phase('initial-chapter-navigation','before');
await chapter(page,'weather-support-after-the-tornado');
 phase('initial-chapter-navigation','after');
 phase('complete-image-layout','before');
await imageLayout(page,{noScript:true});
 phase('complete-image-layout','after');
 phase('exact-image-body','before');
assert.ok(response);assert.equal(response.status(),200);const bytes=await response.body();assert.equal(bytes.length,1669372);assert.equal(hash(bytes),imageSHA);
 phase('exact-image-body','after');
 phase('optional-viewport-capture','before');

 await capture(page,'response-moore-noscript-320',page.locator('#moore-command-post img'));
 phase('optional-viewport-capture','after');
 phase('source-link-activation','before');
await activate(page,page.locator('#moore-command-post a[href*="source=nws-moore-command-post"]'));
 phase('source-link-activation','after');
 phase('source-noscript-fallback','before');
await page.locator('#documentary-js-required').waitFor();assert.equal(await page.locator('#source-nws-moore-command-post').count(),0);
 phase('source-noscript-fallback','after');
 phase('return-link-activation','before');
await activate(page,page.locator('#documentary-chapters a[href="moore.html"]'));
 phase('return-link-activation','after');
 phase('return-exact-url','before');
await page.waitForURL(absolute('moore.html'));
 phase('return-exact-url','after');
 phase('return-style-readiness','before');
await ready(page,'dark',false);
 phase('return-style-readiness','after');
 phase('return-chapter-navigation','before');
await chapter(page,'weather-support-after-the-tornado');
 phase('return-chapter-navigation','after');
 phase('enlarged-text-and-reflow','before');
await enlarge(page,'#weather-support-after-the-tornado > p');
 phase('enlarged-text-and-reflow','after');
 phase('returned-attribution','before');
assert.match(await page.locator('#moore-command-post figcaption').innerText(),/Bruce Thoren \/ NWS/);
 phase('returned-attribution','after');
});

test('Response reading Moore unavailable photograph preserves account and item source 320',{timeout:40000},async t=>{
 const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});noExternal(page,t);let refused=0;await page.route(absolute(asset),route=>{assert.equal(route.request().method(),'GET');refused++;return route.abort();});await page.goto(absolute('moore.html'));await ready(page);await chapter(page,'weather-support-after-the-tornado');await page.locator('#moore-command-post img').scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const n=document.querySelector('#moore-command-post img');return n.complete&&n.naturalWidth===0&&n.naturalHeight===0;});assert.equal(refused,1);
 assert.equal(await page.locator('#moore-command-post img').getAttribute('alt'),alt);const account=page.locator('#weather-support-after-the-tornado > h2 + p');assert.equal(await account.count(),1);for(const fact of stories[0].facts)assert.match(await account.innerText(),fact);const accountSource=account.getByRole('link',{name:'NWS Decision Support account',exact:true});assert.equal(await accountSource.count(),1);assert.equal(await accountSource.getAttribute('href'),'https://www.weather.gov/oun/events-20130520#idss');assert.match(await page.locator('#moore-command-post figcaption').innerText(),/Bruce Thoren \/ NWS/);assert.equal(await page.locator('#moore-command-post a[href="'+originalImage+'"]').count(),1);await capture(page,'response-moore-unavailable-320',page.locator('#moore-command-post'));await mediaJourney(page);await ready(page);assert.equal(await page.locator('#moore-command-post a[href*="source=nws-moore-command-post"]').count(),1);await page.locator('#moore-command-post img').scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const n=document.querySelector('#moore-command-post img');return n.complete&&n.naturalWidth===0&&n.naturalHeight===0;});assert.equal(refused,2,'One controlled failure on initial reading and one on the returned article, with no automatic retry');await enlarge(page,'#weather-support-after-the-tornado > p');
});
