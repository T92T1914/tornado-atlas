import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';
import {waitForSettledTouchTarget} from './touch-target-readiness.mjs';

const report='https://www.weather.gov/ict/udall_stormreport';
const observations=['blackwell-tonkawa-barograph','blackwell-debris-directions'];
const diagnostics=new WeakMap();
function ownedURL(value){
  try{const url=new URL(value);return url.origin===new URL(base).origin?url.href.slice(0,512):'[outside owned loopback]';}
  catch{return '[unavailable]';}
}
async function observe(page){
  const record={events:[],omitted:0};
  const retain=value=>{if(record.events.length===60){record.events.shift();record.omitted++;}record.events.push(value);};
  record.retain=retain;diagnostics.set(page,record);
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())retain({kind:'navigation',url:ownedURL(frame.url())});});
  page.on('request',request=>retain({kind:'request',url:ownedURL(request.url())}));
  page.on('requestfinished',request=>retain({kind:'requestfinished',url:ownedURL(request.url())}));
  page.on('requestfailed',request=>retain({kind:'requestfailed',url:ownedURL(request.url()),failure:request.failure()?.errorText?.slice(0,100)}));
  page.on('response',response=>{if(response.status()>=400)retain({kind:'http_failure',url:ownedURL(response.url()),status:response.status()});});
  page.on('pageerror',error=>retain({kind:'pageerror',message:error.message.replace(/[a-z][\w+.-]*:\/\/[^\s)]+/gi,ownedURL).slice(0,300)}));
  page.on('console',message=>{
    const text=message.text(),prefix='BLACKWELL_INPUT ';
    if(!text.startsWith(prefix))return;
    if(text.length>4096){record.omitted++;return;}
    try{retain(JSON.parse(text.slice(prefix.length)));}catch{record.omitted++;}
  });
  await page.addInitScript(origin=>{
    if(location.origin!==origin)return;
    const observedDocument=document;
    let emitted=0,omitted=0,scrolls=0,scrollsOmitted=0,summaries=0,summariesOmitted=0,sequence=0,pendingFinals=0;
    const number=value=>Number.isFinite(value)?Math.round(Math.max(-1e9,Math.min(1e9,value))*1000)/1000:null;
    const href=value=>{if(!value)return null;try{const url=new URL(value,location.href);return url.origin===origin?url.href.slice(0,512):null;}catch{return null;}};
    const describe=node=>({tag:node?.tagName?.slice(0,24)||null,id:node?.id?.slice(0,80)||null,
      href:href(node?.closest?.('a')?.href||'')});
    const rectangles=node=>node?[...node.getClientRects()].slice(0,4).map(r=>[r.x,r.y,r.width,r.height].map(number)):[];
    const state=()=>{
      const link=document.querySelector('#pressure-damage a[href*="observation=blackwell-tonkawa-barograph"]');
      const viewport=visualViewport;
      return {href:href(location.href),time:number(performance.now()),scroll:[number(scrollX),number(scrollY)],
        viewport:[number(innerWidth),number(innerHeight)],visualViewport:viewport?
          [viewport.offsetLeft,viewport.offsetTop,viewport.pageLeft,viewport.pageTop,viewport.width,viewport.height,viewport.scale].map(number):null,
        pressureLink:describe(link),pressureRects:rectangles(link),
        scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior.slice(0,24),
        touchAction:link?getComputedStyle(link).touchAction.slice(0,32):null};
    };
    const emit=row=>{
      if(emitted===48){omitted++;return false;}
      const text=JSON.stringify(row);
      if(text.length>4000){omitted++;return false;}
      emitted++;console.log('BLACKWELL_INPUT '+text);return true;
    };
    const counts=()=>({emitted,omitted,scrollsOmitted,summariesOmitted,pendingFinals});
    window.__blackwellInputCounts=counts;
    for(const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','click']){
      window.addEventListener(type,event=>{
        if(emitted===48){omitted++;return;}
        const point=event.changedTouches?.[0]||event,id=++sequence,anchor=event.target?.closest?.('a');
        const x=number(point.clientX),y=number(point.clientY);
        const retained=emit({kind:'input',id,type,trusted:event.isTrusted,cancelable:event.cancelable,
          pointerType:event.pointerType?.slice(0,16)||null,detail:number(event.detail),
          capturedDefaultPrevented:event.defaultPrevented,finalSample:'pending post-dispatch task',
          target:describe(event.target),anchor:describe(anchor),anchorRects:rectangles(anchor),point:[x,y],
          hit:describe(x!==null&&y!==null?document.elementFromPoint(x,y):null),...state()});
        if(!retained)return;
        pendingFinals++;
        // Capture can precede later listeners. A separate task observes the final
        // flag without delaying input; navigation may make this sample unavailable.
        setTimeout(()=>{
          pendingFinals--;
          if(document===observedDocument&&location.origin===origin)
            emit({kind:'input-final',id,type,href:href(location.href),defaultPrevented:event.defaultPrevented,
              timing:'post-dispatch task in the same document'});
        },0);
      },{capture:true,passive:true});
    }
    window.addEventListener('scroll',()=>{if(scrolls++<8)emit({kind:'scroll',...state()});else scrollsOmitted++;},{passive:true});
    window.addEventListener('pagehide',()=>{
      // At most eight summaries expose omissions across native history returns.
      if(summaries++>=8){summariesOmitted++;return;}
      console.log('BLACKWELL_INPUT '+JSON.stringify({kind:'input-summary',href:href(location.href),...counts()}));
    },{passive:true});
  },new URL(base).origin);
}
async function ready(page,expected){
  try{await waitForDossier(page,expected);}
  catch(error){
    let timer,state;
    try{state=await Promise.race([
      page.evaluate(origin=>location.origin!==origin?{unavailable:'Outside owned loopback'}:{
        ready:document.body?.dataset.ready?.slice(0,20)??null,documentReady:document.readyState,
        title:document.title.slice(0,200),headings:[...document.querySelectorAll('h1')].slice(0,3).map(node=>node.textContent.slice(0,200)),
        explanation:document.querySelector('#content')?.textContent?.slice(0,600)??null,
        inputCounts:window.__blackwellInputCounts?.()??null
      },new URL(base).origin).catch(e=>({unavailable:e.name.slice(0,100)})),
      new Promise(resolve=>{timer=setTimeout(()=>resolve({unavailable:'Diagnostic snapshot exceeded 500 ms'}),500);})
    ]);}finally{clearTimeout(timer);}
    console.error('BLACKWELL_READINESS_DIAGNOSTIC '+JSON.stringify({
      expected:{href:ownedURL(expected.href),elementId:expected.elementId.slice(0,100)},url:ownedURL(page.url()),state,
      events:diagnostics.get(page)?.events??[],eventsOmitted:diagnostics.get(page)?.omitted??0
    }));
    throw error;
  }
}
async function transition(page,action,expected){
  // Register the document-specific wait before touch, click or history activation.
  // Settle both paths so a trigger failure cannot leave an unhandled waiter.
  const settled=ready(page,expected).then(()=>({}),error=>({error}));
  let activationError;
  try{await action();}catch(error){activationError=error;}
  const result=await settled;
  if(activationError)throw activationError;
  if(result.error)throw result.error;
}
async function fits(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal document overflow');}

for(const [width,height,appearance] of [[1280,900,'light'],[1280,900,'dark'],[390,844,'light'],[390,844,'dark'],[700,320,'light']]){
  test(`Blackwell pressure and debris source journey ${width}x${height} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height},hasTouch:width<800,isMobile:width<800});
    await observe(page);
    await page.goto(base+'/blackwell.html#pressure-damage');
    await page.locator('#reading-appearance').selectOption(appearance);
    const chapter=page.locator('#pressure-damage');
    assert.match(await chapter.textContent(),/0.08 inch Hg/);
    assert.match(await chapter.textContent(),/0.10 inch Hg/);
    assert.match(await chapter.textContent(),/not wind speeds/);
    assert.match(await chapter.textContent(),/origin was uncertain/);
    await fits(page);
    for(const id of observations){
      const link=chapter.locator(`a[href*="observation=${id}"]`);
      const observationRoute={href:new URL(await link.getAttribute('href'),page.url()).href,
        elementId:'observation-'+id};
      diagnostics.get(page).retain({kind:'activation',observation:id,href:observationRoute.href});
      if(width===390){
        await link.scrollIntoViewIfNeeded();
        await waitForSettledTouchTarget(page,link);
      }
      await transition(page,()=>width===390?link.tap():link.click(),observationRoute);
      const card=page.locator('#observation-'+id);
      await card.waitFor();
      assert.match(await card.textContent(),/source reported/);
      assert.match(await card.textContent(),/rightslinks only/);
      if(id===observations[0]){
        assert.match(await card.textContent(),/capture/);
        assert.match(await card.textContent(),/about 2055 CST/);
        assert.match(await card.textContent(),/time checks absent/);
      }else assert.match(await card.textContent(),/not measured wind speeds/);
      const sourceLink=card.getByRole('link',{name:'Inspect the source card',exact:true});
      const sourceRoute={href:new URL(await sourceLink.getAttribute('href'),page.url()).href,
        elementId:'source-nws-wichita'};
      await transition(page,()=>sourceLink.click(),sourceRoute);
      const source=page.locator('#source-nws-wichita');await source.waitFor();
      assert.equal(await source.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),report);
      await transition(page,()=>page.goBack(),observationRoute);await card.waitFor();
      await page.goBack();await chapter.waitFor();
      assert.equal(new URL(page.url()).hash,'#pressure-damage');
    }
    const sizes=await chapter.evaluate(chapter=>{
      const nodes=[...chapter.querySelectorAll('h2,p')];
      const before=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node,index)=>node.style.fontSize=before[index]*2+'px');
      return nodes.map((node,index)=>[before[index],parseFloat(getComputedStyle(node).fontSize)]);
    });
    for(const [before,after] of sizes)assert.equal(after,before*2);
    await fits(page);
  });
}

test('Blackwell pressure observation can be reached through keyboard traversal',async t=>{
  if(process.platform==='win32'&&process.env.ATLAS_BROWSER_ENGINE==='webkit'){
    t.skip('Sequential link Tab is not established in the isolated Windows WebKit fixture. Linux WebKit and other engines still require traversal.');
    return;
  }
  const page=await fixture(t);await observe(page);await page.goto(base+'/blackwell.html#pressure-damage');
  let reached=false;
  for(let step=0;step<70;step++){
    await page.keyboard.press('Tab');
    if(await page.evaluate(()=>document.activeElement?.getAttribute('href')?.includes('observation=blackwell-tonkawa-barograph'))){reached=true;break;}
  }
  assert.ok(reached,'Reach the observation link through Tab');
  const observationLink=page.locator('#pressure-damage a[href*="observation=blackwell-tonkawa-barograph"]');
  await transition(page,()=>page.keyboard.press('Enter'),{
    href:new URL(await observationLink.getAttribute('href'),page.url()).href,
    elementId:'observation-blackwell-tonkawa-barograph'});
  await page.locator('#observation-blackwell-tonkawa-barograph').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('observation'),'blackwell-tonkawa-barograph');
});
