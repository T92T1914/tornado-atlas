import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base,detail,photo} from './harness.mjs';

const index=JSON.parse(await readFile(new URL('../../web/archive/index.json',import.meta.url),'utf8'));
const directory=JSON.parse(await readFile(new URL('../../web/'+index.source_directory.file,import.meta.url),'utf8'));
const cases=[
  {name:'portrait',viewport:{width:390,height:844},event:'joplin-2011',appearance:'dark'},
  {name:'short landscape',viewport:{width:844,height:320},event:'blackwell-1955',appearance:'light'},
  {name:'320 reflow with enlarged text',viewport:{width:320,height:640},event:'el-reno-2013',appearance:'dark',enlarge:true},
];
async function ready(page,scenario){
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  if(scenario.enlarge){
    // Double each computed text size once after rendering. This is a bounded
    // text enlargement fixture, not a physical browser zoom or virtual keyboard.
    await page.evaluate(()=>{
      if(document.body.dataset.touchTextEnlarged==='true')return;
      const nodes=[...document.querySelectorAll('body *')].filter(node=>node.namespaceURI==='http://www.w3.org/1999/xhtml');
      const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node,i)=>node.style.fontSize=sizes[i]*2+'px');
      document.body.dataset.touchTextEnlarged='true';
    });
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,
    JSON.stringify(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}))));
}
async function follow(page,locator,scenario){
  await Promise.all([page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),locator.tap()]);
  await page.waitForLoadState('domcontentloaded');
  await ready(page,scenario);
}
async function downloadExact(page,locator,file,filename){
  const [download]=await Promise.all([page.waitForEvent('download'),locator.tap()]);
  assert.equal(download.suggestedFilename(),filename);
  assert.deepEqual(await readFile(await download.path()),await readFile(new URL('../../web/'+file,import.meta.url)));
}
for(const scenario of cases)test(`touch source and retained evidence journey ${scenario.name}`,async t=>{
  const page=await fixture(t,{viewport:scenario.viewport,isMobile:true,hasTouch:true,reducedMotion:'reduce',acceptDownloads:true});
  const touch=[];
  await page.exposeFunction('recordTouch',()=>touch.push(true));
  await page.addInitScript(()=>document.addEventListener('touchstart',()=>window.recordTouch(),{passive:true}));
  const requests=[];page.on('request',request=>requests.push(request.url()));
  const entry=index.events.find(row=>row.id===scenario.event);
  const row=directory.entries.find(row=>row.event_id===entry.id&&row.observations>0);
  const history=JSON.parse(await readFile(new URL('../../web/'+entry.history_file,import.meta.url),'utf8'));
  const retained=history.versions.find(row=>row.dossier_sha256!==history.current_dossier_sha256);
  const currentDoc=JSON.parse(await readFile(new URL('../../web/'+entry.file,import.meta.url),'utf8'));
  const oldDoc=JSON.parse(await readFile(new URL('../../web/'+retained.file,import.meta.url),'utf8'));
  await page.goto(base+'/dossier.html?view=sources');await ready(page,scenario);
  await page.locator('#reading-appearance').selectOption(scenario.appearance);
  const search=page.getByRole('searchbox',{name:'Search source cards'});
  await search.tap();await search.fill(row.source.title);
  await page.getByRole('combobox',{name:'Dossier',exact:true}).selectOption(entry.id);
  await follow(page,page.getByRole('button',{name:'Find sources',exact:true}),scenario);
  const filtered=page.url();
  assert.equal(new URL(filtered).searchParams.get('scope'),entry.id);
  assert.equal(new URL(filtered).searchParams.get('q'),row.source.title);
  assert.equal(await page.locator('#source-results .archive-card').count(),1);
  const sourceResult=page.locator('#source-results .archive-card');
  assert.ok((await sourceResult.textContent()).includes(row.source.rights));
  assert.ok((await sourceResult.textContent()).includes(row.source.access));
  await follow(page,sourceResult.getByRole('link',{name:'Open source and its evidence',exact:true}),scenario);
  const pinned=page.url();
  assert.equal(new URL(pinned).searchParams.get('revision'),row.dossier_sha256);
  const sourceCard=page.locator('#source-'+row.source.id);
  for(const field of ['locator','access','revision','rights'])assert.ok((await sourceCard.textContent()).includes(row.source[field]),field);
  assert.equal(await sourceCard.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),row.source.url);
  await downloadExact(page,page.getByRole('link',{name:'Download dossier metadata (JSON)',exact:true}),entry.file,entry.id+'.json');
  await page.reload();await ready(page,scenario);
  assert.equal(page.url(),pinned);
  assert.equal(await page.locator('#reading-appearance').inputValue(),scenario.appearance);
  await page.goBack();await ready(page,scenario);
  assert.equal(page.url(),filtered);
  assert.equal(await page.getByRole('searchbox',{name:'Search source cards'}).inputValue(),row.source.title);
  await page.goForward();await ready(page,scenario);assert.equal(page.url(),pinned);
  await page.getByRole('link',{name:'Inspect revisions and correction history',exact:true}).tap();
  await page.locator('#correction-history').waitFor();
  const revision=page.locator('#revision-'+retained.dossier_sha256);
  await follow(page,revision.getByRole('link',{name:'Open this dossier revision',exact:true}),scenario);
  assert.equal(new URL(page.url()).searchParams.get('revision'),retained.dossier_sha256);
  assert.match(await page.locator('#content').textContent(),/reading a retained dossier revision/);
  await downloadExact(page,page.getByRole('link',{name:'Download dossier metadata (JSON)',exact:true}),retained.file,entry.id+'.json');
  const observation=oldDoc.observations[0],observed=page.locator('#observation-'+observation.id);
  assert.ok((await observed.textContent()).includes(observation.limits));
  await observed.getByText('Inspection coverage',{exact:true}).tap();
  assert.equal(await observed.locator('details').last().getAttribute('open')!==null,true);
  await follow(page,observed.getByRole('link',{name:'Inspect the source card',exact:true}),scenario);
  assert.equal(new URL(page.url()).searchParams.get('revision'),retained.dossier_sha256);
  const oldSource=oldDoc.sources.find(row=>row.id===observation.source_id);
  assert.ok((await page.locator('#source-'+oldSource.id).textContent()).includes(oldSource.rights));
  await page.reload();await ready(page,scenario);
  assert.equal(new URL(page.url()).searchParams.get('revision'),retained.dossier_sha256);
  await follow(page,page.getByRole('link',{name:'Return to the current dossier',exact:true}),scenario);
  assert.equal(new URL(page.url()).searchParams.has('revision'),false);
  assert.ok((await page.locator('#content').textContent()).includes(currentDoc.reconstruction.limits));
  await page.goBack();await ready(page,scenario);
  assert.equal(new URL(page.url()).searchParams.get('revision'),retained.dossier_sha256);
  assert.ok(touch.length>=8,'This journey dispatches actual emulated touch events rather than mouse clicks');
  assert.equal(requests.some(url=>/\/catalogue\/|youtube|harkphoto|\.pdf|\.png|\.jpg/.test(url)),false);
  if(process.env.ATLAS_SCREENSHOT_DIR){
    await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`touch-${entry.id}.png`)});
    const input=await page.evaluate(()=>({width:innerWidth,height:innerHeight,touchPoints:navigator.maxTouchPoints,coarsePointer:matchMedia('(pointer:coarse)').matches,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,textFixtureApplied:document.body.dataset.touchTextEnlarged==='true',userAgent:navigator.userAgent}));
    await writeFile(path.join(process.env.ATLAS_SCREENSHOT_DIR,`touch-${entry.id}.json`),JSON.stringify({scenario,input,emulatedTouchEvents:touch.length,filteredPath:new URL(filtered).pathname+new URL(filtered).search,currentRevision:row.dossier_sha256,retainedRevision:retained.dossier_sha256,exactDownloads:2},null,2)+'\n');
  }
});

test('short touch viewport keeps record media dismissal and list return usable',async t=>{
  const page=await fixture(t,{viewport:{width:700,height:320},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await page.goto(base+'/atlas.html?layer=local');await page.waitForFunction(()=>document.body.dataset.ready==='true');
  await page.locator('#query').tap();await page.locator('#query').fill('El Reno');
  await page.getByRole('button',{name:'Search',exact:true}).tap();
  await page.locator('#show-list').tap();
  await page.locator('#results [data-record="ncei:453682"]').tap();await detail(page,'ncei:453682');
  // Native pointer focusing differs by engine. Preserve the element focused
  // immediately before showModal rather than imposing mouse focus on a tap.
  await page.locator('[data-photo="storm-1"]').evaluate(node=>node.addEventListener('click',()=>{
    window.focusBeforePhotoViewer=document.activeElement;
  },{capture:true,once:true}));
  await page.locator('[data-photo="storm-1"]').tap();await photo(page,'storm-1');
  const credit=page.locator('#photo-credit');
  await credit.scrollIntoViewIfNeeded();
  const creditBox=await credit.boundingBox();assert.ok(creditBox.y>=0&&creditBox.y+creditBox.height<=320,'Attribution remains reachable in the short viewer');
  assert.equal(await credit.textContent(),'Daniel Rodriguez');
  const close=page.getByRole('button',{name:'Close viewer',exact:true});
  await close.scrollIntoViewIfNeeded();
  const box=await close.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=320,'Dismissal fits the short viewport');
  if(process.env.ATLAS_SCREENSHOT_DIR){await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,'touch-media-short.png')});}
  await close.tap();assert.equal(await page.locator('#photo-dialog').getAttribute('open'),null);
  assert.equal(await page.evaluate(()=>document.activeElement===window.focusBeforePhotoViewer),true);
  await page.locator('#back-list').tap();assert.equal(await page.locator('#results').isVisible(),true);
  assert.equal(await page.locator('#query').inputValue(),'El Reno');
});

test('touch source discovery can retry an unavailable directory and clear an empty search',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  let failed=true;
  await page.route('**/'+index.source_directory.file,route=>failed?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.goto(base+'/dossier.html?view=sources');
  await page.waitForFunction(()=>document.body?.dataset.ready==='error');
  assert.equal(await page.locator('#source-results .archive-card').count(),0);
  assert.match(await page.locator('#content').textContent(),/This evidence could not load/);
  assert.equal(await page.getByRole('link',{name:'Open the catalogue',exact:true}).getAttribute('href'),base+'/atlas.html');
  failed=false;
  await follow(page,page.getByRole('link',{name:'Retry this view',exact:true}),{});
  assert.equal(await page.locator('#source-results .archive-card').count(),index.source_directory.count);
  const search=page.getByRole('searchbox',{name:'Search source cards'});
  await search.tap();await search.fill('No inspected source with this synthetic mobile phrase');
  await follow(page,page.getByRole('button',{name:'Find sources',exact:true}),{});
  assert.equal(await page.locator('#source-results .archive-card').count(),0);
  assert.match(await page.locator('#content').textContent(),/Sources may exist outside this reviewed collection/);
  await follow(page,page.getByRole('link',{name:'Clear source filters',exact:true}),{});
  assert.equal(await page.getByRole('searchbox',{name:'Search source cards'}).inputValue(),'');
  assert.equal(await page.locator('#source-results .archive-card').count(),index.source_directory.count);
});

test('default narrow map lets a touch swipe scroll the page without changing the selected source',
  {skip:process.env.ATLAS_BROWSER_ENGINE==='webkit'?'Native scrolling probe uses the available Chromium CDP touch protocol':false},async t=>{
  const page=await fixture(t,{viewport:{width:390,height:640},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await page.goto(base+'/atlas.html?layer=local');await page.waitForFunction(()=>document.body.dataset.ready==='true');
  await page.locator('#query').tap();await page.locator('#query').fill('El Reno');
  await page.getByRole('button',{name:'Search',exact:true}).tap();await page.locator('#show-list').tap();
  await page.locator('#results [data-record="ncei:453682"]').tap();await detail(page,'ncei:453682');
  await page.locator('#show-map').tap();await page.locator('#world-map').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#map-drag').isChecked(),false);
  assert.equal(await page.locator('#world-map').evaluate(node=>getComputedStyle(node).touchAction),'pan-y');
  const view=new URL(page.url()).searchParams.get('view'),before=await page.evaluate(()=>scrollY);
  const box=await page.locator('#world-map').boundingBox(),x=box.x+box.width*.75,y=Math.min(600,box.y+box.height*.75);
  const cdp=await page.context().newCDPSession(page);
  try{
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let n=1;n<=8;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-18*n}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(before=>scrollY>before+30,before);
  }finally{await cdp.detach();}
  assert.equal(new URL(page.url()).searchParams.get('view'),view);
  assert.equal(new URL(page.url()).hash,'#record=ncei%3A453682');
  assert.equal(await page.locator('#show-map').getAttribute('aria-pressed'),'true');
  const after=await page.evaluate(()=>scrollY);
  await page.locator('#show-detail').tap();await detail(page,'ncei:453682');
  if(process.env.ATLAS_SCREENSHOT_DIR){
    await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});
    await writeFile(path.join(process.env.ATLAS_SCREENSHOT_DIR,'default-map-scroll.json'),JSON.stringify({before,after,view,source:'ncei:453682',input:'Chromium CDP touch gesture in isolated mobile context'},null,2)+'\n');
  }
});
