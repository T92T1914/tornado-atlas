import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';
import {assertReadingReflow} from './reading-reflow-diagnostics.mjs';

// Literal source expectations come from the complete-object intake, not article output.
const original='https://www.weather.gov/images/ict/wxstory/udall/east.jpg';
const caption='https://www.weather.gov/ict/udall_pics1';
const source='nws-wichita-udall-east',observation='eastward-aftermath-scene';
const anchor='eastward-aftermath';
async function fontsReady(page,phase){
  console.log('UDALL_FONT_READINESS '+JSON.stringify({phase,route:page.url(),stage:'started'}));
  let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Native font readiness promise did not settle: '+phase)),10000);});
  try{await Promise.race([(async()=>{
    console.log('UDALL_FONT_READINESS '+JSON.stringify({phase,stage:'native-status',status:await page.evaluate(()=>document.fonts.status)}));
    await page.evaluate(()=>document.fonts.ready.then(()=>true));
  })(),deadline]);}
  finally{clearTimeout(timer);}
}
async function stylesReady(page){
  await page.waitForLoadState('load');
  console.log('UDALL_STYLES_READINESS '+JSON.stringify({phase:'loaded',route:page.url()}));
  await page.waitForFunction(()=>document.readyState==='complete'&&
    [...document.querySelectorAll('link[rel="stylesheet"]')].every(node=>node.sheet?.cssRules.length>0));
  await fontsReady(page,'styles-ready');
}
async function nativeFocus(page,locator){
  const target=await locator.elementHandle();
  const state=()=>target.evaluate(node=>{
    const rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
    const active=document.activeElement;
    return {href:node.href,text:node.textContent,connected:node.isConnected,focused:node===active,
      active:{tag:active?.tagName,id:active?.id,href:active?.href},box:rect(node.getBoundingClientRect()),
      fragments:[...node.getClientRects()].map(rect),viewport:{width:innerWidth,height:innerHeight},
      visual:visualViewport?{width:visualViewport.width,height:visualViewport.height,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null,
      scroll:{x:scrollX,y:scrollY},ready:document.readyState,
      appearance:document.documentElement.dataset.appearance,scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior};
  });
  const before=await state();
  try{await locator.focus();await page.waitForFunction(node=>{const r=node?.getBoundingClientRect();
    return node===document.activeElement&&r.width>0&&r.height>0&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;},target);}
  catch(error){
    let after,diagnosticError,keyboardProbe,keyboardProbeError;
    try{after=await state();}catch(failure){diagnosticError=String(failure);}
    // A separate two-key comparison preserves the original failed assertion.
    // It never scrolls directly and cannot turn this failure into a pass.
    try{
      await page.keyboard.press('Shift+Tab');const previous=await state();
      await page.keyboard.press('Tab');keyboardProbe={previous,returned:await state()};
    }catch(failure){keyboardProbeError=String(failure);}
    console.log('UDALL_NATIVE_FOCUS_FAILURE '+JSON.stringify({before,after,diagnosticError,keyboardProbe,keyboardProbeError}));
    throw error;
  }
  finally{await target?.dispose();}
}
async function sourceAndArticle(page,kind){
  const key=kind==='source'?source:observation,id=kind+'-'+key;
  const citation=page.locator('#'+anchor+' a[href*="'+kind+'='+key+'"]');
  const href=await citation.evaluate(node=>node.href);
  await nativeFocus(page,citation);await citation.press('Enter');
  await waitForDossier(page,{href,elementId:id});
  const card=page.locator('#'+id);
  if(kind==='source'){
    assert.equal(await card.locator('a[href="'+original+'"]').count(),1);
    assert.match(await card.innerText(),/7a06cb031bd0eb8d75f4d30f0d07ba969202ede2c2d840c1ff27a1ada29fb172/);
    assert.match(await card.innerText(),/46541/);
    assert.match(await card.innerText(),/506 by 348/);
    assert.match(await card.innerText(),/No image or derivative is hosted/);
  }else{
    assert.match(await card.innerText(),/temporary canvas structures/);
    assert.match(await card.innerText(),/Exact exposure date\/time/);
    assert.match(await card.innerText(),/source links only/i);
  }
  const returnGroup=card.locator('details').filter({has:page.getByText('Continue in the current article',{exact:true})});
  await nativeFocus(page,returnGroup.locator('summary'));await returnGroup.locator('summary').press('Enter');
  const back=returnGroup.locator('a[href="'+base+'/udall.html#'+anchor+'"]');
  assert.equal(await back.count(),1);
  await nativeFocus(page,back);await back.press('Enter');
  await page.waitForURL(url=>url.pathname.endsWith('/udall.html')&&url.hash==='#'+anchor);
  await stylesReady(page);
  await page.goBack();await waitForDossier(page,{href,elementId:id});
  await page.goForward();await page.waitForURL(url=>url.pathname.endsWith('/udall.html')&&url.hash==='#'+anchor);
  await stylesReady(page);
}
for(const width of [320,1280])for(const scheme of ['dark','light'])for(const scripts of [true,false]){
  test('Udall aftermath source-only reading '+width+' '+scheme+' '+(scripts?'scripts':'no scripts'),{timeout:60000},async t=>{
    const page=await fixture(t,{viewport:{width,height:1000},colorScheme:scheme,
      hasTouch:width===320,...(width===320?{isMobile:true}:{}),javaScriptEnabled:scripts,reducedMotion:'reduce'});
    const originalRequests=[];page.on('request',request=>{if(request.url().startsWith('https://www.weather.gov/'))originalRequests.push(request.url());});
    await page.goto(base+'/udall.html');await stylesReady(page);
    if(scripts){
      await page.locator('#reading-appearance:not([disabled])').waitFor();
      await page.locator('#reading-appearance').selectOption(scheme);
      await page.waitForFunction(()=>document.querySelector('.documentary-contents')?.dataset.focusReveal==='ready');
    }else{
      assert.equal(await page.locator('#reading-appearance').isDisabled(),true);
      // This qualifies existing CSS themes, not an enabled no-script selector.
      await page.locator('html').evaluate((node,value)=>node.dataset.appearance=value,scheme);
    }
    assert.equal(await page.locator('html').getAttribute('data-appearance'),scheme);
    assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
    const contents=page.locator('.documentary-contents'),summary=contents.locator(':scope > summary');
    if(!await contents.evaluate(node=>node.open)){await nativeFocus(page,summary);await summary.press('Enter');}
    const entry=contents.locator('a[href="#'+anchor+'"]');assert.equal(await entry.count(),1);
    if(width===320)await entry.tap();else{await nativeFocus(page,entry);await entry.press('Enter');}
    await page.waitForURL(url=>url.hash==='#'+anchor);
    const scene=page.locator('#'+anchor);assert.equal(await scene.count(),1);
    assert.match(await scene.innerText(),/people, temporary canvas structures and vehicles/);
    assert.match(await scene.innerText(),/exposure date and time remain unknown/);
    assert.match(await scene.innerText(),/does not identify the people or establish an aid station/);
    assert.equal(await scene.locator('img,video,iframe,object,embed,picture').count(),0);
    assert.equal(await page.locator('img').count(),1,'Only the unchanged existing forecast is hosted');
    for(const url of [original,caption]){
      const external=scene.locator('a[href="'+url+'"]');assert.equal(await external.count(),1);
      assert.match(await external.getAttribute('rel'),/\bnoreferrer\b/);
      assert.equal(await external.getAttribute('referrerpolicy'),'no-referrer');
      assert.equal(await external.getAttribute('download'),null);
      await nativeFocus(page,external);
    }
    if(scripts){await sourceAndArticle(page,'observation');await sourceAndArticle(page,'source');}
    else{
      const link=scene.locator('a[href*="source='+source+'"]');
      await nativeFocus(page,link);await link.press('Enter');await page.waitForURL('**/dossier.html?**');
      assert.equal(await page.locator('#documentary-js-required').isVisible(),true);
      assert.equal(await page.locator('#documentary-chapters a[href="udall.html"]').count(),1);
      await page.goBack();await page.waitForURL(url=>url.pathname.endsWith('/udall.html')&&url.hash==='#'+anchor);
      await stylesReady(page);
    }
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),scheme,'Computed theme survives the source-return journey');
    await assertReadingReflow(page,'Udall source-only reading '+width+' '+scheme);
    if(!await contents.evaluate(node=>node.open)){await nativeFocus(page,summary);await summary.press('Enter');}
    const roles=['#'+anchor+' > p','#'+anchor+' > h3','.documentary-contents a[href="#'+anchor+'"]'];
    const baseline=await page.evaluate(selectors=>selectors.map(selector=>{
      const node=document.querySelector(selector),r=node.getBoundingClientRect();
      return {selector,font:parseFloat(getComputedStyle(node).fontSize),visible:r.width>0&&r.height>0};
    }),roles);
    baseline.forEach(row=>assert.ok(row.visible&&row.font>0,'Actual rendered baseline '+row.selector));
    await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')],
      sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');});
    await fontsReady(page,'enlarged-text');
    const actual=await page.evaluate(selectors=>selectors.map(selector=>parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)),roles);
    assert.deepEqual(actual,baseline.map(row=>row.font*2),'Actual reading text, heading and contents double');
    await assertReadingReflow(page,'Udall enlarged source-only reading '+width+' '+scheme);
    await nativeFocus(page,page.locator('#'+anchor+' a[href="'+original+'"]'));
    const paragraphs=await scene.locator('p').evaluateAll(nodes=>nodes.flatMap(node=>{
      const range=document.createRange();range.selectNodeContents(node);
      return [...range.getClientRects()].filter(r=>r.width>0).map(r=>({left:r.left,right:r.right}));
    }));
    assert.ok(paragraphs.length>0);
    assert.ok(paragraphs.every(r=>r.left>=-1&&r.right<=width+1),'Every visible passage fragment stays inside the viewport');
    assert.deepEqual(originalRequests,[],'Reading does not request the external photograph or archive');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),scheme,'Captured enlarged text uses the intended actual theme');
    const captures=process.env.ATLAS_UDALL_AFTERMATH_CAPTURE;
    if(captures){
      await mkdir(captures,{recursive:true});
      const box=await scene.boundingBox();
      assert.ok(box&&box.width>0&&box.width<=width+1&&box.height>0&&box.height<=12000,'Full comparison fits the declared section capture bounds');
      const pixels=await scene.screenshot({path:path.join(captures,'udall-aftermath-'+width+'-'+scheme+'-'+(scripts?'scripts':'no-scripts')+'.png'),animations:'disabled'});
      assert.ok(pixels.length<=2097152,'Complete section capture stays within2MiB');
      console.log('UDALL_COMPLETE_SECTION_CAPTURE '+JSON.stringify({width,scheme,scripts,box,bytes:pixels.length,complete_section:true}));
    }
  });
}
for(const width of [320,1280])test('Udall aftermath failed evidence keeps native comparison '+width,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.goto(base+'/udall.html#'+anchor);await stylesReady(page);
  let blocked=0;await page.route('**/archive/index.json',route=>{blocked++;return route.abort();});
  const citation=page.locator('#'+anchor+' a[href*="source='+source+'"]'),href=await citation.evaluate(node=>node.href);
  await nativeFocus(page,citation);await citation.press('Enter');
  await page.waitForFunction(()=>document.body?.dataset.ready==='error');
  assert.ok(blocked>0,'Failure reaches the real evidence loader');
  assert.equal(await page.getByRole('heading',{name:'Evidence unavailable',exact:true}).count(),1);
  assert.equal(await page.getByRole('link',{name:'Retry this view',exact:true}).count(),1);
  await page.goBack();await page.waitForURL(url=>url.pathname.endsWith('/udall.html')&&url.hash==='#'+anchor);
  assert.match(await page.locator('#'+anchor).innerText(),/photographer and item-specific reuse rights remain unresolved/);
  assert.equal(await page.locator('#'+anchor+' a[href="'+original+'"]').count(),1);
  await page.unroute('**/archive/index.json');
  await citation.focus();await citation.press('Enter');await waitForDossier(page,{href,elementId:'source-'+source});
  assert.match(await page.locator('#source-'+source).innerText(),/No image or derivative is hosted/);
});
