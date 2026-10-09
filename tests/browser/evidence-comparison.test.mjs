import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

const index=JSON.parse(await readFile(new URL('../../web/archive/index.json',import.meta.url),'utf8'));
const entry=index.events.find(event=>event.id==='joplin-2011');
const doc=JSON.parse(await readFile(new URL('../../web/'+entry.file,import.meta.url),'utf8'));
const history=JSON.parse(await readFile(new URL('../../web/'+entry.history_file,import.meta.url),'utf8'));
const keys=['media:friskey-joplin-storm','media:nws-joplin-aftermath'];
async function open(page,query){
  await page.goto(base+'/dossier.html?'+query);
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
}
async function follow(page,action){
  await Promise.all([page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),action()]);
  await page.waitForFunction(()=>document.body?.dataset.ready==='true');
}
async function noHorizontalOverflow(page){
  const reading=await page.evaluate(()=>{
    const offset=scrollX,walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),text=[];
    for(let node=walker.nextNode();node&&text.length<8;node=walker.nextNode()){
      if(!node.textContent.trim())continue;
      const range=document.createRange();range.selectNodeContents(node);
      const outside=[...range.getClientRects()].find(box=>box.width>0&&box.right+offset>innerWidth+1);
      if(outside)text.push({parent:node.parentElement?.tagName,class:node.parentElement?.className,
        text:node.textContent.slice(0,60),absoluteRight:outside.right+offset,width:outside.width});
    }
    return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,offset,
    bodyScroll:document.body.scrollWidth,bodyWidth:document.body.getBoundingClientRect().width,text,
    internal:[...document.querySelectorAll('body *')].filter(node=>node.scrollWidth>node.clientWidth+1).slice(0,12)
      .map(node=>({tag:node.tagName,id:node.id,class:node.className,client:node.clientWidth,scroll:node.scrollWidth,
        open:node.open,display:getComputedStyle(node).display})),
    outside:[...document.querySelectorAll('body *')].filter(node=>{
      const box=node.getBoundingClientRect();return box.width>0&&box.right+offset>innerWidth+1;
    }).slice(0,12).map(node=>{
      const box=node.getBoundingClientRect(),style=getComputedStyle(node);
      return {tag:node.tagName,id:node.id,class:node.className,left:box.left+offset,right:box.right+offset,
        width:box.width,scroll:node.scrollWidth,display:style.display,minWidth:style.minWidth,columns:style.gridTemplateColumns};
    })
  };});
  if(reading.scroll>reading.viewport+1){
    // These temporary diagnostic probes cannot admit a failing original layout.
    reading.probes={};
    for(const [name,content] of [
      ['without-comparison','#evidence-comparison{display:none!important}'],
      ['closed-disclosures','details:not([open])>:not(summary){display:none!important}'],
      ['native-controls','#evidence-comparison select{appearance:none!important;width:100%!important;max-width:100%!important}'],
      ['wrapping-links','.archive-main a{display:block!important;white-space:normal!important;word-break:break-all!important}'],
      ['wrapping-values','.archive-main *{word-break:break-all!important;min-width:0!important}']
    ]){
      let style;
      try{style=await page.addStyleTag({content});reading.probes[name]=await page.evaluate(()=>document.documentElement.scrollWidth);}
      catch(error){reading.probes[name]={error:error.message};}
      finally{if(style)await style.evaluate(node=>node.remove());}
    }
  }
  assert.equal(reading.scroll<=reading.viewport+1,true,JSON.stringify(reading));
}

for(const [width,appearance] of [[320,'dark'],[390,'light'],[1280,'light']])test(`evidence comparison preserves source clocks, routes and history ${width} ${appearance}`,async t=>{
  const page=await fixture(t,{viewport:{width,height:900}}),requests=[];
  page.on('request',request=>requests.push(request.url()));
  await open(page,'event=joplin-2011');
  await page.locator('#reading-appearance').selectOption(appearance);
  await follow(page,()=>page.locator('#media-friskey-joplin-storm').getByRole('link',{name:'Compare this evidence',exact:true}).click());
  assert.equal(new URL(page.url()).searchParams.get('revision'),history.current_dossier_sha256);
  assert.match(await page.locator('#evidence-comparison').textContent(),/first record is selected/);
  await page.getByLabel('Evidence 2',{exact:true}).selectOption(keys[1]);
  const submit=page.getByRole('button',{name:'Compare selected evidence',exact:true});
  await submit.focus();
  await follow(page,()=>page.keyboard.press('Enter'));
  assert.equal(await page.locator('.comparison-card').count(),2);
  const selectedURL=page.url(),query=new URL(selectedURL).searchParams;
  assert.equal(query.get('revision'),history.current_dossier_sha256);
  assert.deepEqual(query.getAll('compare').filter(Boolean),keys);
  const storm=page.locator('[data-compare="'+keys[0]+'"]'),aftermath=page.locator('[data-compare="'+keys[1]+'"]');
  assert.match(await storm.textContent(),/inception field says March 21, 2025/);
  assert.match(await aftermath.textContent(),/outcome|depicted location/i);
  await aftermath.getByText('Time and date roles',{exact:true}).focus();
  await page.keyboard.press('Enter');
  assert.match(await aftermath.textContent(),/May 23, 2011 at 13:19/);
  assert.match(await aftermath.textContent(),/unverified clock and time zone/);
  await storm.getByText('Inspection scope and reuse',{exact:true}).click();
  const original=doc.media.find(item=>item.id==='friskey-joplin-storm');
  const source=doc.sources.find(source=>source.id===original.source_id);
  assert.equal(await storm.getByRole('link',{name:'Read its original source',exact:true}).getAttribute('href'),source.url);
  assert.match(await storm.textContent(),/Recorded source revision/);
  const sourceRoute=new URL(await storm.getByRole('link',{name:'Inspect its source card',exact:true}).getAttribute('href'));
  assert.equal(sourceRoute.searchParams.get('source'),source.id);
  assert.equal(sourceRoute.searchParams.get('revision'),history.current_dossier_sha256);
  assert.equal(await page.locator('iframe,video,img').count(),0);
  assert.equal(requests.some(url=>/youtube|harkphoto|\.jpg|\.png/.test(url)),false);
  await noHorizontalOverflow(page);
  await page.addStyleTag({content:'body{font-size:200%}'});
  await noHorizontalOverflow(page);
  await page.goBack();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.equal(await page.locator('.comparison-card').count(),0);
  assert.equal(await page.getByLabel('Evidence 1',{exact:true}).inputValue(),keys[0]);
  await page.goForward();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.equal(page.url(),selectedURL);
  await page.reload();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
  assert.equal(await page.locator('.comparison-card').count(),2);
  await follow(page,()=>page.locator('[data-compare="'+keys[0]+'"] a').filter({hasText:'Open this evidence record'}).click());
  assert.equal(new URL(page.url()).searchParams.get('media'),original.id);
  assert.equal(new URL(page.url()).searchParams.get('revision'),history.current_dossier_sha256);
});

test('comparison rejects duplicates, foreign records and current-only items in retained revisions',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  const old=history.versions.find(version=>version.dossier_sha256!==history.current_dossier_sha256);
  for(const [revision,values] of [[history.current_dossier_sha256,[keys[0],keys[0]]],
    [history.current_dossier_sha256,['observation:blackwell-clocks']],[old.dossier_sha256,keys]]){
    const query=new URLSearchParams({event:'joplin-2011',revision});for(const value of values)query.append('compare',value);
    await open(page,query);
    assert.equal(await page.locator('.comparison-card').count(),0);
    assert.equal(await page.locator('#evidence-comparison [role="alert"]').count(),1);
    await follow(page,()=>page.getByRole('link',{name:'Clear comparison',exact:true}).click());
    assert.equal(new URL(page.url()).searchParams.get('revision'),revision);
    assert.equal(new URL(page.url()).searchParams.has('compare'),false);
  }
});

test('a missing retained dossier fails before comparison and no-script retains reading routes',async t=>{
  const page=await fixture(t);
  await page.route('**/'+entry.file,route=>route.fulfill({status:503,body:'Unavailable'}));
  const query=new URLSearchParams({event:'joplin-2011',revision:history.current_dossier_sha256});for(const value of keys)query.append('compare',value);
  await page.goto(base+'/dossier.html?'+query);
  await page.waitForFunction(()=>document.body?.dataset.ready==='error');
  assert.equal(await page.locator('.comparison-card').count(),0);
  assert.equal(await page.locator('#documentary-chapters nav a').count(),4);
  const staticPage=await fixture(t,{javaScriptEnabled:false,viewport:{width:390,height:900}});
  await staticPage.goto(base+'/dossier.html?'+query);
  assert.match(await staticPage.locator('noscript').textContent(),/require JavaScript/);
  assert.equal(await staticPage.getByRole('link',{name:'Compare evidence coverage across events',exact:true}).count(),1);
  assert.equal(await staticPage.locator('#documentary-chapters nav a').count(),4);
  assert.equal(await staticPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});

test('Blackwell disputed clocks remain separate from a caption-only archive date',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}}),requests=[];
  page.on('request',request=>requests.push(request.url()));
  const query=new URLSearchParams({event:'blackwell-1955'});
  for(const key of ['observation:blackwell-clocks','observation:ou-flora62-railroad-yard-caption'])query.append('compare',key);
  await open(page,query);
  assert.equal(await page.locator('.comparison-card').count(),2);
  assert.match(await page.locator('#evidence-comparison').textContent(),/current dossier, whose published version may change/);
  assert.equal(requests.filter(url=>url.includes('/archive/')&&url.endsWith('.json')).length,3);
  requests.length=0;
  await follow(page,()=>page.getByRole('link',{name:'Link to this comparison',exact:true}).click());
  const blackwell=index.events.find(event=>event.id==='blackwell-1955');
  const retained=JSON.parse(await readFile(new URL('../../web/'+blackwell.history_file,import.meta.url),'utf8'));
  assert.equal(new URL(page.url()).searchParams.get('revision'),retained.current_dossier_sha256);
  const clocks=page.locator('[data-compare="observation:blackwell-clocks"]');
  const caption=page.locator('[data-compare="observation:ou-flora62-railroad-yard-caption"]');
  await clocks.getByText('Time and date roles',{exact:true}).click();
  assert.match(await clocks.textContent(),/9:27 p.m. CDT/);
  assert.match(await clocks.textContent(),/2126 CST column/);
  assert.match(await clocks.textContent(),/Source disagreement/);
  await caption.getByText('Time and date roles',{exact:true}).click();
  assert.match(await caption.textContent(),/caption|original photograph/i);
  assert.match(await caption.textContent(),/Not established in this record/);
  assert.equal(requests.filter(url=>url.includes('/archive/')&&url.endsWith('.json')).length,3);
  assert.equal(requests.some(url=>/youtube|harkphoto|\.jpg|\.png/.test(url)),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});

test('direct unversioned empty and seeded comparisons explain and retain their current revision',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  for(const values of [[],[keys[0]]]){
    const query=new URLSearchParams({event:'joplin-2011'});for(const value of values)query.append('compare',value);
    await open(page,query);
    assert.match(await page.locator('#evidence-comparison').textContent(),/current dossier, whose published version may change/);
    const link=page.getByRole('link',{name:'Link to this comparison',exact:true});
    const pinned=new URL(await link.getAttribute('href'));
    assert.equal(pinned.searchParams.get('revision'),history.current_dossier_sha256);
    assert.deepEqual(pinned.searchParams.getAll('compare'),values);
    await follow(page,()=>link.click());
    assert.equal(new URL(page.url()).searchParams.get('revision'),history.current_dossier_sha256);
    assert.equal(await page.locator('.comparison-card').count(),0);
    assert.equal(await page.getByLabel('Evidence 1',{exact:true}).inputValue(),values[0]||'');
    assert.doesNotMatch(await page.locator('#evidence-comparison').textContent(),/current dossier, whose published version may change/);
  }
});
