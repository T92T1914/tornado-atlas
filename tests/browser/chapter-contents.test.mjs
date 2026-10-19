import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

const chapters=['joplin.html','blackwell.html','tuscaloosa.html'];
const expectedDestinations={
  'joplin.html':['#photographs-and-film','#before','#chronology','#visibility','#path','#satellite-scar','#radar-reading','#school-refuge','#damage','#hospital-envelope','#roof-bracing','#hospital-services','#recovery','#remembrance','#questions','#sources','#assumed-experiments'],
  'blackwell.html':['#photographs-and-film','#warning-context','#storm-and-tornadoes','#record','#pressure-damage','#database-lineage','#aftermath','#archive-prints','#clocks','#observations','#remembrance','#sources','#assumed-experiments'],
  'tuscaloosa.html':['#photographs-and-film','#storm','#satellite-context','#path','#damage-map','#field-survey','#birmingham-aftermath','#apartment-complex','#train-cars','#aerial-context','#damage','#warnings','#pre-event-outlooks','#counts','#clocks','#evidence','#railway-bridge','#sources','#assumed-experiments']
};
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
async function enlarge(page){
  const result=await page.evaluate(()=>{
    const nodes=[document.body,...document.body.querySelectorAll('*')];
    const before=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node,index)=>node.style.fontSize=before[index]*2+'px');
    return nodes.every((node,index)=>Math.abs(parseFloat(getComputedStyle(node).fontSize)-before[index]*2)<.1);
  });
  assert.equal(result,true,'Every computed text size actually doubles');
}
async function nativeRevealProbe(page){
  await page.addInitScript(()=>{
    const original=Element.prototype.scrollIntoView;
    window.chapterContentsRevealCalls=[];
    Element.prototype.scrollIntoView=function(options){
      const result=original.call(this,options);
      if(this.matches('.documentary-layout > .documentary-contents a')){
        const rect=this.getBoundingClientRect(),rail=this.closest('nav').getBoundingClientRect();
        const rows=window.chapterContentsRevealCalls;
        if(rows.length<64)rows.push({href:this.getAttribute('href'),active:document.activeElement===this,behavior:options?.behavior,block:options?.block,inline:options?.inline,linkTop:rect.top,linkBottom:rect.bottom,railTop:rail.top,railBottom:rail.bottom,viewportHeight:innerHeight});
      }
      return result;
    };
  });
}
async function movingDocument(page){
  const motion=await page.evaluate(async()=>{
    const start=scrollY,destination=Math.min(document.documentElement.scrollHeight-innerHeight,start+1600),samples=[start];
    scrollTo({top:destination,behavior:'smooth'});
    for(let frame=0;frame<60;frame++){
      await new Promise(resolve=>requestAnimationFrame(resolve));
      if(scrollY!==samples.at(-1))samples.push(scrollY);
      if(samples.length>=3&&scrollY!==destination)return {start,destination,samples,moving:true};
    }
    return {start,destination,samples,moving:false};
  });
  assert.equal(motion.moving,true,'Two differing measured scroll positions establish movement before native focus');
  return motion;
}
async function destinations(page,file){
  const nav=page.locator('.documentary-layout > .documentary-contents');
  if(await nav.evaluate(node=>node.tagName==='DETAILS'&&!node.open))await nav.locator(':scope > summary').click();
  const hrefs=await nav.locator('a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
  assert.deepEqual(hrefs,expectedDestinations[file],'Contents retain the complete ordered destinations for '+file);
  assert.equal(new Set(hrefs).size,hrefs.length);
  if(file==='tuscaloosa.html')assert.equal(hrefs.filter(href=>href==='#damage-map').length,1);
  assert.equal(hrefs.at(-1),'#assumed-experiments');
  for(const href of hrefs){
    assert.match(href,/^#[a-z][a-z0-9-]*$/);
    assert.equal(await page.locator(href).count(),1,file+' '+href);
    assert.equal(await page.locator(href).isVisible(),true,file+' retains visible destination '+href);
  }
  return {nav,hrefs};
}
for(const width of [1081,1280])for(const enabled of [false,true])test('wide chapter contents remain reachable with doubled text, '+width+', scripts '+enabled,async t=>{
  const page=await fixture(t,{viewport:{width,height:900},javaScriptEnabled:enabled,colorScheme:width===1081?'dark':'light'});
  if(enabled)await nativeRevealProbe(page);
  for(const file of chapters){
    await page.goto(base+'/'+file);
    const {nav,hrefs}=await destinations(page,file);
    const reading=page.locator('.documentary-layout > .documentary-reading');
    const bounds=await page.evaluate(()=>{
      const rail=document.querySelector('.documentary-contents').getBoundingClientRect();
      const account=document.querySelector('.documentary-reading').getBoundingClientRect();
      return {railRight:rail.right,railBottom:rail.bottom,accountLeft:account.left,accountTop:account.top,accountWidth:account.width};
    });
    if(enabled)assert.ok(bounds.accountLeft>bounds.railRight,'Enhanced contents and account have distinct horizontal columns');
    else assert.ok(bounds.accountTop>=bounds.railBottom-1,'Native contents remain above the account in ordinary flow');
    assert.ok(bounds.accountWidth>600,'At the wide boundary the readable account retains useful width');
    assert.ok((await reading.innerText()).length>4000);
    const railContract=await nav.evaluate(node=>{const style=getComputedStyle(node);return {marker:node.dataset.focusReveal||null,position:style.position,maxHeight:style.maxHeight,overflow:style.overflowY,scroll:node.scrollHeight,client:node.clientHeight};});
    assert.equal(railContract.marker,enabled?'ready':null);
    assert.equal(railContract.position,enabled?'sticky':'static');
    if(enabled){assert.equal(railContract.overflow,'auto');assert.notEqual(railContract.maxHeight,'none');}
    else{assert.equal(railContract.overflow,'visible');assert.equal(railContract.maxHeight,'none');assert.ok(railContract.scroll<=railContract.client+1,'Fallback has no clipped internal scrollport');}
    const original=await nav.textContent();
    await enlarge(page);assert.equal(await fits(page),true,file+' enlarged width');
    assert.equal(await nav.textContent(),original,'Enlargement preserves all contents labels');
    const labelFits=await nav.locator('a').evaluateAll(nodes=>nodes.every(node=>node.scrollHeight<=node.clientHeight+1 && node.scrollWidth<=node.clientWidth+1));
    assert.equal(labelFits,true,'Every doubled contents label fits its own link box without overlapping the next label');
    const motion=enabled?await movingDocument(page):null;
    const links=nav.locator('a');await links.first().focus();
    for(let index=0;index<hrefs.length;index++){
      assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),hrefs[index],'Native keyboard order follows the retained contents');
      if(index<hrefs.length-1)await page.keyboard.press('Tab');
    }
    const focusDeadline=Date.now()+10000;
    let focusSettled=false;
    while(Date.now()<focusDeadline){
      focusSettled=await page.evaluate(()=>{const node=document.activeElement;if(!node?.closest('.documentary-contents'))return false;const box=node.getBoundingClientRect(),rail=node.closest('.documentary-contents').getBoundingClientRect();return box.top>=0 && box.bottom<=innerHeight && box.top>=rail.top-1 && box.bottom<=rail.bottom+1;});
      if(focusSettled)break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    if(!focusSettled) console.log('CHAPTER_CONTENTS_FOCUS_FAILURE '+JSON.stringify(await page.evaluate(file=>{
      const active=document.activeElement,rail=document.querySelector('.documentary-contents');
      const box=node=>{const r=node?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,right:r.right,bottom:r.bottom,left:r.left}:null;};
      const style=rail?getComputedStyle(rail):null,root=getComputedStyle(document.documentElement);
      return {file,url:location.href,active_href:active?.getAttribute('href'),active_tag:active?.tagName,active_in_contents:Boolean(active?.closest('.documentary-contents')),link_rect:box(active),rail_rect:box(rail),rail_scroll_top:rail?.scrollTop,rail_client_height:rail?.clientHeight,rail_scroll_height:rail?.scrollHeight,window_scroll_y:scrollY,window_inner_height:innerHeight,rail_style:style?{position:style.position,top:style.top,max_height:style.maxHeight,overflow_x:style.overflowX,overflow_y:style.overflowY,scroll_behavior:style.scrollBehavior}:null,document_scroll_behavior:root.scrollBehavior,ready_state:document.readyState,font_status:document.fonts?.status};
    },file)));
    assert.equal(focusSettled,true,'Native focused link fits its rail and viewport within the existing action timeout');
    const visible=await links.last().evaluate(node=>{
      const link=node.getBoundingClientRect(),rail=node.closest('.documentary-contents').getBoundingClientRect();
      return {top:link.top,bottom:link.bottom,railTop:rail.top,railBottom:rail.bottom,scroll:node.closest('.documentary-contents').scrollTop,outline:getComputedStyle(node).outlineStyle};
    });
    if(enabled)assert.ok(visible.scroll>0,'Long doubled contents scroll to the final link');
    else{assert.equal(visible.scroll,0,'Ordinary document flow has no nested rail scrolling');assert.ok(await page.evaluate(()=>scrollY>0),'Native keyboard navigation scrolls the document');}
    assert.ok(visible.top>=visible.railTop-1 && visible.bottom<=visible.railBottom+1,'Final link remains inside its scrollable rail');
    assert.ok(visible.top>=0 && visible.bottom<=900,'Final link remains inside the viewport');
    assert.notEqual(visible.outline,'none','Keyboard focus remains visible');
    if(enabled){
      const calls=await page.evaluate(()=>window.chapterContentsRevealCalls);
      for(const href of ['#sources','#assumed-experiments'])assert.ok(calls.some(row=>row.href===href&&row.active&&row.behavior==='instant'&&row.block==='nearest'&&row.inline==='nearest'),'Actual product reveal reaches native focus at '+href);
      console.log('CHAPTER_CONTENTS_NATIVE_REVEAL '+JSON.stringify({width,file,motion,calls,final:visible}));
    }
    if(process.env.ATLAS_CHAPTER_CONTENTS_CAPTURE){
      if(enabled)await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      else await new Promise(resolve=>setTimeout(resolve,50));
      await mkdir(process.env.ATLAS_CHAPTER_CONTENTS_CAPTURE,{recursive:true});
      await page.screenshot({path:path.join(process.env.ATLAS_CHAPTER_CONTENTS_CAPTURE,file.replace('.html','-'+width+'-'+(enabled?'enhanced':'nojs')+'-enlarged.png'))});
    }
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>!document.activeElement.closest('.documentary-contents') && document.activeElement!==document.body),true,'Keyboard leaves the rail in native document order');
    await nav.locator('a[href="#sources"]').focus();
    await Promise.all([page.waitForURL(url=>url.hash==='#sources'),page.keyboard.press('Enter')]);
    assert.equal(await page.locator('#sources').isVisible(),true);
    await page.reload();assert.equal(new URL(page.url()).hash,'#sources');
    await page.goBack();assert.equal(new URL(page.url()).hash,'');
    assert.equal(await fits(page),true,file+' history return width');
  }
});
for(const width of [1080,320])test('chapter contents retain normal flow and visible destinations, '+width,async t=>{
  const page=await fixture(t,{viewport:{width,height:900},javaScriptEnabled:false,colorScheme:'dark'});
  for(const file of chapters){
    await page.goto(base+'/'+file);const {nav}=await destinations(page,file);
    const flow=await page.evaluate(()=>({navBottom:document.querySelector('.documentary-contents').getBoundingClientRect().bottom,accountTop:document.querySelector('.documentary-reading').getBoundingClientRect().top}));
    assert.ok(flow.accountTop>=flow.navBottom-1,'Contents remain before the account in ordinary flow');
    await enlarge(page);assert.equal(await fits(page),true,file+' narrow enlarged width');
    await nav.locator('a[href="#sources"]').focus();
    await Promise.all([page.waitForURL(url=>url.hash==='#sources'),page.keyboard.press('Enter')]);
    assert.equal(await page.locator('#sources').isVisible(),true);
  }
});
