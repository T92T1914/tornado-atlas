import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,open,search,detail,base} from './harness.mjs';

const frozen=JSON.parse(await readFile(new URL('../fixtures/catalogue-dossier-discovery.json',import.meta.url),'utf8'));
const published=JSON.parse(await readFile(new URL('../../web/catalogue/index.json',import.meta.url),'utf8'));
const identifiers=new Set([...frozen.groups.flatMap(group=>group.records),frozen.unrelated_record]);
const records=published.records.filter(row=>identifiers.has(row.id));
assert.equal(records.length,15,'All fourteen published associations and the ordinary control must exist');
const byYear={};for(const record of records)byYear[record.year]=(byYear[record.year]??0)+1;

async function selectedCatalogue(t,width,beforeOpen=async()=>{}){
  const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
  // This controlled fifteen-record response uses actual published annotation
  // values. It tests the existing consumer, not full-catalogue payload costs.
  // Full-payload local/public acceptance needs its own declared workload.
  await page.route('**/catalogue/index.json.gz',route=>route.fulfill({status:404,body:'Use selected published JSON records'}));
  await page.route('**/catalogue/index.json',route=>route.fulfill({json:{records,coverage:{by_year:byYear}}}));
  await beforeOpen(page);
  await open(page,'&exhibits=1&panel=list');
  return page;
}

async function listView(page){
  if(await page.locator('#back-list').isVisible())await page.locator('#back-list').click();
  else if(await page.locator('#show-list').isVisible())await page.locator('#show-list').click();
}

async function results(page,ids){
  await page.waitForFunction(expected=>{
    const actual=[...document.querySelectorAll('#results [data-record]')].map(row=>row.dataset.record).sort();
    return JSON.stringify(actual)===JSON.stringify([...expected].sort());
  },ids);
}

async function catalogueState(page,group,id){
  await detail(page,id);
  assert.equal(await page.locator('#query').inputValue(),group.query);
  assert.equal(await page.locator('#exhibits').isChecked(),true);
  const url=new URL(page.url());
  assert.equal(url.searchParams.get('q'),group.query);
  assert.equal(url.searchParams.get('exhibits'),'1');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('record'),id);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}

for(const width of [320,1280])test('published dossier links preserve catalogue reading state at '+width,async t=>{
  const page=await selectedCatalogue(t,width);
  await results(page,[...identifiers].filter(id=>id!==frozen.unrelated_record));
  for(const theme of ['dark','light']){
    await page.locator('#reading-appearance').selectOption(theme);
    for(const group of frozen.groups){
      await listView(page);await search(page,group.query);await results(page,group.records);
      for(const id of group.records){
        await listView(page);
        const record=page.locator('#results [data-record="'+id+'"]');
        await record.focus();await record.press('Enter');
        await catalogueState(page,group,id);
        const article=page.getByRole('link',{name:'Open reviewed exhibit',exact:true});
        assert.equal(new URL(await article.getAttribute('href'),page.url()).pathname,'/'+group.route);
        // The first theme follows all six actual article routes and native
        // Back/Forward. Both themes inspect every one of the fourteen links.
        if(theme==='dark'&&id===group.records[0]){
          await article.focus();await article.press('Enter');
          await page.waitForURL(url=>url.pathname==='/'+group.route);
          assert.equal(await page.locator('h1').count(),1);
          await page.goBack();await page.waitForFunction(()=>document.body.dataset.ready==='true');
          await catalogueState(page,group,id);
          await page.goForward();await page.waitForURL(url=>url.pathname==='/'+group.route);
          await page.goBack();await page.waitForFunction(()=>document.body.dataset.ready==='true');
          await catalogueState(page,group,id);
        }
      }
    }
  }
  const last=frozen.groups.at(-1),id=last.records.at(-1);
  await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');
  await catalogueState(page,last,id);
  const link=await page.locator('#search-link').getAttribute('href');
  assert.equal(new URLSearchParams(new URL(link,page.url()).hash.slice(1)).get('record'),id);
  await listView(page);await search(page,frozen.unrelated_record);await results(page,[]);
});

for(const width of [320,1280])for(const theme of ['dark','light'])test('static museum cards retain doubled text within '+width+' '+theme,async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},javaScriptEnabled:false,colorScheme:theme,reducedMotion:'reduce'});
  await page.goto(base+'/atlas.html',{waitUntil:'load'});
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),theme);
  assert.match(await page.locator('noscript').innerText(),/accounts and their source links are available/);
  const result=await page.evaluate(()=>{
    const museum=document.getElementById('museum'),grid=museum.querySelector('.museum-routes');
    const cards=[...grid.querySelectorAll(':scope > article')];
    const targets=[museum.querySelector('h1'),museum.querySelector('p'),...cards.map(n=>n.querySelector('h2'))];
    const sizes=()=>targets.map(n=>({text:n.textContent.trim(),size:parseFloat(getComputedStyle(n).fontSize)}));
    const before=sizes(),text=museum.textContent;
    // Reproduce the failed acceptance operation: every body's descendant gets
    // twice its previously computed font size. No widths or overflow are altered.
    const nodes=[document.body,...document.body.querySelectorAll('*')];
    const original=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));
    nodes.forEach((n,i)=>n.style.fontSize=original[i]*2+'px');
    const box=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {left:r.left,right:r.right,width:r.width,client:n.clientWidth,scroll:n.scrollWidth,overflow:s.overflowX};};
    return {viewport:innerWidth,document_width:document.documentElement.scrollWidth,
      before,after:sizes(),text_preserved:museum.textContent===text,grid:box(grid),
      cards:cards.map(card=>{
        const r=card.getBoundingClientRect(),s=getComputedStyle(card);
        const content={left:r.left+parseFloat(s.borderLeftWidth)+parseFloat(s.paddingLeft),
          right:r.right-parseFloat(s.borderRightWidth)-parseFloat(s.paddingRight)};
        const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT),fragments=[];
        let node;while((node=walker.nextNode()))if(node.textContent.trim()){
          const range=document.createRange();range.selectNodeContents(node);
          for(const rect of range.getClientRects())if(rect.width>0&&rect.height>0)
            fragments.push({left:rect.left,right:rect.right,text:node.textContent.trim().slice(0,80)});
        }
        return {title:card.querySelector('h2').textContent.trim(),box:box(card),content,fragments};
      })};
  });
  assert.equal(result.cards.length,5,'All five additional documentary account cards remain');
  assert.equal(result.text_preserved,true,'No documentary text was removed for reflow');
  result.before.forEach((before,i)=>{
    assert.ok(before.size>0);assert.equal(result.after[i].text,before.text);
    assert.equal(result.after[i].size,before.size*2,'Actual computed font size is doubled');
  });
  assert.ok(result.document_width<=result.viewport+1,JSON.stringify({document:result.document_width,viewport:result.viewport}));
  assert.ok(result.grid.left>=-1&&result.grid.right<=result.viewport+1);
  assert.ok(!['hidden','clip'].includes(result.grid.overflow),'Grid overflow is not hidden');
  for(const card of result.cards){
    assert.ok(card.box.width>0&&card.content.right>card.content.left);
    assert.ok(card.box.left>=result.grid.left-1&&card.box.right<=result.grid.right+1,JSON.stringify(card.box));
    assert.ok(card.box.scroll<=card.box.client+1,'Card content fits rather than being clipped');
    assert.ok(!['hidden','clip'].includes(card.box.overflow),'Card text overflow is not hidden');
    assert.ok(card.fragments.length>0);
    for(const fragment of card.fragments)assert.ok(fragment.left>=card.content.left-1&&fragment.right<=card.content.right+1,JSON.stringify({title:card.title,content:card.content,fragment}));
  }
  t.diagnostic(JSON.stringify({viewport:result.viewport,theme,document_width:result.document_width,
    measured_fonts:result.after,cards:result.cards.map(card=>({title:card.title,width:card.box.width,text_fragments:card.fragments.length}))}));
});

const previewPhotos=JSON.parse(await readFile(new URL('../../exhibits/el-reno-2013/storm-photos.json',import.meta.url),'utf8'))
  .filter(photo=>['storm-1','storm-2'].includes(photo.id))
  .map(photo=>({...photo,preview:photo.reading_versions.find(version=>version.width===640)}));

async function chooseReadingRecord(page,query,id){
  await listView(page);await search(page,query);
  await page.locator('#results [data-record="'+id+'"]').click();await detail(page,id);
}

async function stripImage(page,photo,file,width){
  const image=page.locator('[data-photo="'+photo.id+'"] img');
  await image.scrollIntoViewIfNeeded();
  await page.waitForFunction(({id,file,width})=>{
    const image=document.querySelector('[data-photo="'+id+'"] img');
    return image&&new URL(image.currentSrc||image.src).pathname==='/'+file
      &&image.complete&&image.naturalWidth===width;
  },{id:photo.id,file,width});
}

async function originalShown(page,photo){
  await page.waitForFunction(photo=>{
    const image=document.getElementById('photo-full');
    return document.getElementById('photo-dialog').open&&image&&!image.hidden
      &&new URL(image.currentSrc||image.src).pathname==='/'+photo.file
      &&image.complete&&image.naturalWidth===photo.width&&image.naturalHeight===photo.height;
  },photo);
  assert.equal(await page.locator('#photo-original').getAttribute('href'),photo.file);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),photo.source);
  assert.equal(await page.locator('#photo-credit').textContent(),photo.credit);
  assert.equal(await page.locator('#photo-license').textContent(),photo.license);
  assert.equal(await page.locator('#photo-license').getAttribute('href'),photo.license_url);
}

// Observe these four image URLs before initial navigation. The entrance hero
// can already supply storm01-640, and a modal can reuse a decoded original.
function previewEvidence(){
  const eligible=new Set(previewPhotos.flatMap(photo=>[photo.file,photo.preview.file]));
  const states=new Map(),listeners=[];let omitted=0;
  const evidence={stage:'initial entrance',proofs:[]};
  const request=req=>{
    const asset=new URL(req.url()).pathname.slice(1);if(!eligible.has(asset))return;
    if(states.size===64){omitted++;return;}
    let resolve;const terminal=new Promise(done=>resolve=done);
    states.set(req,{row:{id:states.size+1,asset,stage:evidence.stage,method:req.method(),status:null,terminal:null},terminal,resolve,body:null});
  };
  const response=res=>{
    const state=states.get(res.request());if(!state)return;state.row.status=res.status();
    state.body=(async()=>{
      try{
        const body=await res.body();assert.ok(body.length<=8*1024*1024,'Bounded fixture image response');
        state.row.bytes=body.length;state.row.sha256=createHash('sha256').update(body).digest('hex');
        await state.terminal;
      }catch(error){state.row.body_error=error.message;}
    })();
  };
  const terminal=(req,kind)=>{const state=states.get(req);if(!state)return;state.row.terminal=kind;state.resolve();};
  evidence.attach=page=>{
    for(const [event,listener] of [['request',request],['response',response],
      ['requestfinished',req=>terminal(req,'finished')],['requestfailed',req=>terminal(req,'failed')]]){
      page.on(event,listener);listeners.push(()=>page.off(event,listener));
    }
  };
  evidence.verify=async(asset,sha256,bytes,status=200)=>{
    const candidates=[...states.values()].filter(state=>state.row.asset===asset&&state.row.status===status);
    assert.ok(candidates.length>0,'An actual same-context response must support '+asset);
    const state=candidates.at(-1);assert.ok(state.body);await state.body;
    assert.equal(state.row.terminal,'finished');assert.equal(state.row.body_error,undefined);
    assert.equal(state.row.bytes,bytes);assert.equal(state.row.sha256,sha256);assert.equal(omitted,0);
    const proof={asset,source_request:state.row.id,source_stage:state.row.stage,display_stage:evidence.stage,
      prior_response_reused:state.row.stage!==evidence.stage,bytes,sha256,
      scope:'Exact completed same-context native response plus current image URL/dimensions; no second network request required'};
    evidence.proofs.push(proof);return proof;
  };
  evidence.count=asset=>[...states.values()].filter(state=>state.row.asset===asset).length;
  evidence.finish=()=>Promise.all([...states.values()].map(state=>state.body));
  evidence.snapshot=phase=>({phase,stage:evidence.stage,requests:[...states.values()].map(state=>({...state.row})),omitted,proofs:evidence.proofs});
  evidence.stop=()=>listeners.forEach(stop=>stop());
  return evidence;
}

for(const width of [320,1280])test('catalogue reading previews keep exact full-size viewer identity at '+width,async t=>{
  const evidence=previewEvidence();
  try{
    const page=await selectedCatalogue(t,width,evidence.attach);
    evidence.stage='selected source previews';await chooseReadingRecord(page,'El Reno','ncei:453682');
    for(const photo of previewPhotos){
      await stripImage(page,photo,photo.preview.file,640);
      await evidence.verify(photo.preview.file,photo.preview.sha256,photo.preview.bytes);
    }
    assert.equal(previewPhotos.reduce((sum,photo)=>sum+evidence.count(photo.file),0),0,
      'Selecting the record does not load either full original');
    for(const photo of previewPhotos){
      evidence.stage='visitor opens '+photo.id;
      await page.locator('[data-photo="'+photo.id+'"]').click();await originalShown(page,photo);
      await evidence.verify(photo.file,photo.sha256,(await stat(new URL('../../web/'+photo.file,import.meta.url))).size);
      await page.locator('#photo-close').click();
      assert.equal(await page.locator('#detail .eyebrow').textContent(),'ncei:453682');
    }
    await evidence.finish();t.diagnostic(JSON.stringify(evidence.snapshot('completed before owned cleanup')));
  }catch(error){t.diagnostic(JSON.stringify(evidence.snapshot('original failure before owned cleanup')));throw error;}
  finally{evidence.stop();}
});

for(const width of [320,1280])test('failed catalogue preview falls back once without crossing selections at '+width,async t=>{
  // storm02 is not the entrance hero, so its controlled failure belongs to the
  // strip. The initial storm01 reading response is still observed separately.
  const photo=previewPhotos[1],other=previewPhotos[0],evidence=previewEvidence();
  let page;
  try{
    page=await selectedCatalogue(t,width,async owned=>{
      evidence.attach(owned);
      await owned.route('**/'+photo.preview.file,route=>route.fulfill({status:404,body:'Controlled missing reading preview'}));
    });
    evidence.stage='failed strip preview and original fallback';
    await chooseReadingRecord(page,'El Reno','ncei:453682');await stripImage(page,photo,photo.file,photo.width);
    await evidence.verify(photo.preview.file,createHash('sha256').update('Controlled missing reading preview').digest('hex'),Buffer.byteLength('Controlled missing reading preview'),404);
    await evidence.verify(photo.file,photo.sha256,(await stat(new URL('../../web/'+photo.file,import.meta.url))).size);
    assert.equal(evidence.count(photo.preview.file),1);assert.equal(evidence.count(photo.file),1,'One original fallback for this strip');
    evidence.stage='visitor opens the already loaded fallback original';
    await page.locator('[data-photo="'+photo.id+'"]').click();await originalShown(page,photo);
    await evidence.verify(photo.file,photo.sha256,(await stat(new URL('../../web/'+photo.file,import.meta.url))).size);
    assert.ok(evidence.count(photo.file)>=1&&evidence.count(photo.file)<=2,'A cached original need not make a second request');
    await page.locator('#photo-close').click();

    // This deliberately dispatched late error tests ownership. It does not
    // claim that a browser delivered the same native event ordering.
    const retired=await page.locator('[data-photo="'+other.id+'"] img').elementHandle();assert.ok(retired);
    await chooseReadingRecord(page,'Joplin','ncei:296617');
    const current=await page.locator('#detail').evaluate(n=>({id:n.querySelector('.eyebrow').textContent,
      photos:[...n.querySelectorAll('[data-photo]')].map(button=>({id:button.dataset.photo,src:button.querySelector('img')?.getAttribute('src')}))}));
    const retiredResult=await retired.evaluate(image=>{const before=image.getAttribute('src');image.dispatchEvent(new Event('error'));return {connected:image.isConnected,before,after:image.getAttribute('src')};});
    await retired.dispose();assert.equal(retiredResult.connected,false);
    assert.equal(retiredResult.before,other.preview.file);assert.equal(retiredResult.after,other.preview.file);
    assert.equal(evidence.count(other.file),0);
    assert.deepEqual(await page.locator('#detail').evaluate(n=>({id:n.querySelector('.eyebrow').textContent,
      photos:[...n.querySelectorAll('[data-photo]')].map(button=>({id:button.dataset.photo,src:button.querySelector('img')?.getAttribute('src')}))})),current);
    await evidence.finish();t.diagnostic(JSON.stringify(evidence.snapshot('successful fallback before owned cleanup')));
  }catch(error){t.diagnostic(JSON.stringify(evidence.snapshot('original failure before owned cleanup')));throw error;}
  finally{evidence.stop();if(page)await page.context().close();}

  // A fresh context has no successful original to reuse. Refuse both requests
  // before its first navigation, without cache busting or changing product code.
  const refused=previewEvidence();
  try{
    const missing=await selectedCatalogue(t,width,async owned=>{
      refused.attach(owned);
      await owned.route('**/'+photo.preview.file,route=>route.fulfill({status:404,body:'Controlled missing reading preview'}));
      await owned.route('**/'+photo.file,route=>route.fulfill({status:503,body:'Controlled missing original'}));
    });
    refused.stage='fresh context: preview and original both fail';
    await chooseReadingRecord(missing,'El Reno','ncei:453682');
    await missing.locator('[data-photo="'+photo.id+'"]').scrollIntoViewIfNeeded();
    await missing.waitForFunction(id=>{const button=document.querySelector('[data-photo="'+id+'"]');return button&&!button.querySelector('img');},photo.id);
    await refused.verify(photo.preview.file,createHash('sha256').update('Controlled missing reading preview').digest('hex'),Buffer.byteLength('Controlled missing reading preview'),404);
    await refused.verify(photo.file,createHash('sha256').update('Controlled missing original').digest('hex'),Buffer.byteLength('Controlled missing original'),503);
    assert.equal(refused.count(photo.preview.file),1);assert.equal(refused.count(photo.file),1,'The failed original does not loop');
    assert.match(await missing.locator('[data-photo="'+photo.id+'"]').innerText(),/El Reno/);
    refused.stage='visitor opens source controls after both image failures';
    await missing.locator('[data-photo="'+photo.id+'"]').click();await missing.locator('#photo-retry').waitFor({state:'visible'});
    assert.ok(refused.count(photo.file)>=1&&refused.count(photo.file)<=2);
    assert.equal(await missing.locator('#photo-credit').textContent(),photo.credit);
    assert.equal(await missing.locator('#photo-source').getAttribute('href'),photo.source);
    assert.equal(await missing.locator('#photo-original').getAttribute('href'),photo.file);
    assert.equal(await missing.locator('#photo-license').getAttribute('href'),photo.license_url);
    await refused.finish();t.diagnostic(JSON.stringify(refused.snapshot('full failure controls before owned cleanup')));
  }catch(error){t.diagnostic(JSON.stringify(refused.snapshot('original failure before owned cleanup')));throw error;}
  finally{refused.stop();}
});
