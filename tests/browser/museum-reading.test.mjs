import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const bundle=JSON.parse(await readFile(new URL('../../web/data.json',import.meta.url),'utf8'));
const registry=JSON.parse(await readFile(new URL('../../exhibits/events.json',import.meta.url),'utf8'));
test('modified photograph activation keeps the native original-file route',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce'});
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');
  const photograph=page.locator('#hero-photograph [data-storm-photo]');
  const [popup]=await Promise.all([page.context().waitForEvent('page'),photograph.click({modifiers:['Control']})]);
  await popup.waitForLoadState('load');
  assert.equal(popup.url(),base+'/'+bundle.storm_photos[0].file);
  assert.equal(await page.locator('#photo-dialog').evaluate(node=>node.open),false);
  await popup.close();
});
for(const width of [320,1280]){
  for(const activation of ['pointer','keyboard']){
    test(`a chronology chapter has one Back and Forward step: ${width}px ${activation}`,async t=>{
      const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
      await page.goto(base+'/index.html?t=0#questions');
      await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');
      const chapter=page.locator('[data-chapter-minute="19"]');
      if(activation==='keyboard'){await chapter.focus();await page.keyboard.press('Enter');}
      else await chapter.click();
      await page.waitForFunction(()=>new URL(location.href).searchParams.get('t')==='900'&&location.hash==='#path');
      assert.equal(await page.locator('#published-position').inputValue(),'900');
      await page.goBack();
      await page.waitForFunction(()=>new URL(location.href).searchParams.get('t')==='0'&&location.hash==='#questions');
      assert.equal(await page.locator('#published-position').inputValue(),'0');
      await page.goForward();
      await page.waitForFunction(()=>new URL(location.href).searchParams.get('t')==='900'&&location.hash==='#path');
      assert.equal(await page.locator('#published-position').inputValue(),'900');
    });
  }
  test(`grouped contents follow the actual reading position: ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
    await page.goto(base+'/index.html');
    await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');
    for(const id of ['photos','remembrance','questions','location-research','sources']){
      await page.locator('#'+id).evaluate(node=>node.scrollIntoView({behavior:'instant',block:'start'}));
      await page.waitForFunction(id=>document.querySelector('#exhibit-contents [aria-current="location"]')?.getAttribute('href')==='#'+id,id);
      assert.equal(await page.locator('#exhibit-contents [aria-current="location"]').count(),1);
    }
  });
}
async function reading(page){
  assert.equal(await page.locator('#introduction').textContent(),bundle.exhibit.introduction+' NWS account');
  assert.deepEqual(await page.locator('#documentary-report article>p').allTextContents(),bundle.history.report.flatMap(row=>row.paragraphs));
  assert.deepEqual(await page.locator('#memorial-names>li>strong').allTextContents(),bundle.history.remembrance.people.map(row=>row.name));
  assert.equal(await page.locator('#source-register li').count(),bundle.reading.sources.length);
  assert.equal(await page.locator('#storm-chronology>li').count(),bundle.history.chapters.length);
  assert.equal(await page.locator('#forecast-sequence>li').count(),bundle.documentary.warnings.length);
  assert.equal(await page.locator('#storm-photographs [data-storm-photo]').count(),2);
  assert.match(await page.locator('#chronology-42').textContent(),/6:42/);
  assert.match(await page.locator('#chronology-42').textContent(),/6:44/);
  const ids=await page.locator('[id]').evaluateAll(nodes=>nodes.map(node=>node.id));
  assert.equal(ids.length,new Set(ids).size,'Published and enhanced reading have no duplicate anchors');
  const layout=await page.evaluate(()=>({innerWidth,rootScrollWidth:document.documentElement.scrollWidth,rootClientWidth:document.documentElement.clientWidth,bodyScrollWidth:document.body.scrollWidth,bodyClientWidth:document.body.clientWidth,scrollX,scrollY}));
  assert.ok(layout.rootScrollWidth<=layout.innerWidth+1,'Reading document fits: '+JSON.stringify(layout));
}
test('principal routes expose the same four-exhibit navigation at narrow width',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:false});
  for(const route of ['atlas.html','index.html','joplin.html','blackwell.html','tuscaloosa.html','dossier.html','coverage.html','reconstruction.html','survey.html','radar-source.html','study.html','wind.html','japan.html','curator.html']){
    await page.goto(base+'/'+route,{waitUntil:'load'});
    const summary=page.locator('.museum-nav details').first().locator('summary');
    await summary.focus();await page.keyboard.press('Enter');
    assert.deepEqual(await page.locator('.museum-nav details').first().locator('a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href'))),registry.events.map(row=>route==='curator.html'?'https://t92t1914.github.io/tornado-atlas/'+row.documentary:row.documentary),route);
    const bounds=await page.locator('.museum-nav').boundingBox();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=321,route+' keeps its header within the viewport');
  }
});
async function museum(page){
  const disclosure=page.locator('.museum-nav details').first();
  await disclosure.locator('summary').click();
  assert.deepEqual(await disclosure.locator('a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href'))),registry.events.map(row=>row.documentary));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
}
async function capture(page,name){
  if(!process.env.ATLAS_MUSEUM_CAPTURE_DIR)return;
  await mkdir(process.env.ATLAS_MUSEUM_CAPTURE_DIR,{recursive:true});
  await page.screenshot({path:path.join(process.env.ATLAS_MUSEUM_CAPTURE_DIR,name+'-'+(process.env.ATLAS_BROWSER_ENGINE||'chromium')+'.png'),fullPage:false});
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test(`museum entrance and enhanced El Reno reading ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
    await page.goto(base+'/atlas.html?layer=local');
    await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.equal(await page.locator('#museum article h2>a').count(),4);
    assert.ok((await page.locator('#museum').boundingBox()).y<(await page.locator('#catalogue').boundingBox()).y);
    await capture(page,`collection-${width}-${appearance}`);
    await museum(page);
    await page.locator('.museum-nav details').first().locator('a[href="index.html"]').click();
    await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');
    await reading(page);
    assert.match(await page.locator('#facts').textContent(),/8Direct tornado deaths/);
    await capture(page,`el-reno-${width}-${appearance}`);
    const photograph=page.locator('#hero-photograph [data-storm-photo]');
    await photograph.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('#photo-dialog').open&&document.querySelector('#photo-full').naturalWidth===5103);
    assert.match(await page.locator('#photo-credit').textContent(),/Daniel Rodriguez/);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#photo-dialog').open);
    assert.equal(await photograph.evaluate(node=>node===document.activeElement),true);
    await page.locator('[data-chapter-minute="19"]').click();
    assert.equal(new URL(page.url()).searchParams.get('t'),'900');
    await page.locator('#source-search').fill('vehicle');
    assert.ok(await page.locator('#source-register li:visible').count()>0);
    assert.ok(await page.locator('#source-register li:visible').count()<bundle.reading.sources.length);
    await page.locator('#source-reset').click();
    assert.equal(await page.locator('#source-register li:visible').count(),bundle.reading.sources.length);
    await page.reload();await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');
    assert.equal(new URL(page.url()).searchParams.get('t'),'900');
    await reading(page);
  });
}
for(const route of ['atlas.html','index.html','joplin.html','tuscaloosa.html','blackwell.html']){
  test(`four-exhibit entrance and historical reading without scripts: ${route}`,async t=>{
    const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:false});
    await page.goto(base+'/'+route,{waitUntil:'load'});
    await museum(page);
    if(route==='index.html'){
      await reading(page);
      assert.equal(await page.locator('#source-search').isDisabled(),true);
      assert.equal(await page.locator('#storm-photographs [data-storm-photo]').first().getAttribute('href'),bundle.storm_photos[0].file);
      await page.goto(base+'/index.html#changing-circulation');
      assert.ok((await page.locator('#changing-circulation').boundingBox()).y<100);
    } else if(route==='atlas.html') assert.equal(await page.locator('#museum article h2>a').count(),4);
    else assert.ok((await page.locator('.documentary-reading').innerText()).length>4000);
    await capture(page,'nojs-'+route.replace('.html',''));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  });
}
for(const scenario of ['data503','module503','photographs503']){
  test(`El Reno keeps its account, sources and navigation after ${scenario}`,async t=>{
    const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});
    if(scenario==='data503') await page.route('**/data.json',route=>route.fulfill({status:503,body:'controlled unavailable data'}));
    if(scenario==='module503') await page.route('**/photo-view.mjs',route=>route.fulfill({status:503,body:'controlled unavailable module'}));
    if(scenario==='photographs503') await page.route('**/assets/el-reno-2013/storm*.jpg',route=>route.fulfill({status:503,body:'controlled unavailable photograph'}));
    await page.goto(base+'/index.html');
    await page.waitForFunction(()=>['error','true'].includes(document.body?.dataset.exhibitReady));
    await reading(page);
    await museum(page);
    assert.equal(await page.locator('#source-register a').count(),bundle.reading.sources.length);
    if(scenario==='photographs503'){
      assert.match(await page.locator('#hero-photograph').textContent(),/Photograph unavailable/);
      assert.equal(await page.locator('#hero-photograph figcaption a').first().getAttribute('href'),bundle.storm_photos[0].source);
    } else assert.equal(await page.locator('#enhancement-status').isVisible(),true);
  });
}
for(const enabled of [false,true])test(`essential El Reno reading and museum navigation reflow at doubled text, scripts ${enabled}`,async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:enabled});
  await page.goto(base+'/index.html');
  if(enabled)await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');
  await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')];const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)) console.log('READING_REFLOW_DIAGNOSTIC '+JSON.stringify(await page.evaluate(()=>{
    const root=document.documentElement,body=document.body;
    const boxes=[root,body,...body.querySelectorAll('*')].map(node=>{const box=node.getBoundingClientRect(),style=getComputedStyle(node);return {tag:node.tagName,id:node.id,cls:typeof node.className==='string'?node.className:'',width:box.width,left:box.left,right:box.right,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,overflowX:style.overflowX};});
    const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT),text=[];
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      if(!node.textContent.trim())continue;
      const range=document.createRange();range.selectNodeContents(node);
      const box=range.getBoundingClientRect();
      if(box.width>0&&(box.right>innerWidth+1||box.left< -1))text.push({tag:node.parentElement.tagName,id:node.parentElement.id,preview:node.textContent.trim().slice(0,100),left:box.left,right:box.right,width:box.width});
      range.detach();
    }
    const controlProbes=[];
    for(const [name,selector,declarations] of [
      ['hide-selects','select',{display:'none'}],
      ['hide-ranges','input[type=range]',{display:'none'}],
      ['hide-checkboxes','input[type=checkbox]',{display:'none'}],
      ['block-control-labels','.camera-controls label,.geography-controls label,.damage-filters label,.impact-controls label',{display:'block'}],
      ['hide-svg','svg',{display:'none'}]
    ]){
      const nodes=[...body.querySelectorAll(selector)],saved=nodes.map(node=>node.getAttribute('style'));
      try {
        nodes.forEach(node=>Object.assign(node.style,declarations));
        controlProbes.push({name,count:nodes.length,rootScrollWidth:root.scrollWidth});
      } finally {
        nodes.forEach((node,index)=>saved[index]===null?node.removeAttribute('style'):node.setAttribute('style',saved[index]));
      }
    }
    return {innerWidth,scrollX,scrollY,root:boxes.slice(0,2),outside:boxes.filter(row=>row.width>0&&(row.right>innerWidth+1||row.left< -1)).slice(0,30),scrolling:boxes.filter(row=>row.scrollWidth>row.clientWidth+1).slice(0,30),text:text.slice(0,30),controlProbes,restoredRootScrollWidth:root.scrollWidth};
  })));
  try {await reading(page);await museum(page);}
  finally {await capture(page,'el-reno-320-enlarged-'+(enabled?'enhanced':'nojs'));}
});
