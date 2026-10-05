import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

const report='https://www.weather.gov/ict/udall_stormreport';
const observations=['blackwell-tonkawa-barograph','blackwell-debris-directions'];
const diagnostics=new WeakMap();
function observe(page){
  const events=[];
  const retain=value=>{events.push(value);if(events.length>60)events.shift();};
  diagnostics.set(page,{events,retain});
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())retain({kind:'navigation',url:frame.url()});});
  page.on('request',request=>retain({kind:'request',url:request.url()}));
  page.on('requestfinished',request=>retain({kind:'requestfinished',url:request.url()}));
  page.on('requestfailed',request=>retain({kind:'requestfailed',url:request.url(),failure:request.failure()?.errorText}));
  page.on('response',response=>{if(response.status()>=400)retain({kind:'http_failure',url:response.url(),status:response.status()});});
  page.on('pageerror',error=>retain({kind:'pageerror',message:error.message.slice(0,300)}));
}
async function ready(page){
  try{await page.waitForFunction(()=>document.body?.dataset.ready==='true');}
  catch(error){
    let timer,state;
    try{state=await Promise.race([
      page.evaluate(()=>({ready:document.body?.dataset.ready??null,documentReady:document.readyState,
        title:document.title,headings:[...document.querySelectorAll('h1')].slice(0,3).map(node=>node.textContent.slice(0,200)),
        explanation:document.querySelector('#content')?.textContent?.slice(0,600)??null})).catch(e=>({unavailable:e.message.slice(0,300)})),
      new Promise(resolve=>{timer=setTimeout(()=>resolve({unavailable:'Diagnostic snapshot exceeded 500 ms'}),500);})
    ]);}finally{clearTimeout(timer);}
    console.error('BLACKWELL_READINESS_DIAGNOSTIC '+JSON.stringify({url:page.url(),state,events:diagnostics.get(page)?.events??[]}));
    throw error;
  }
}
async function fits(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal document overflow');}

for(const [width,height,appearance] of [[1280,900,'light'],[1280,900,'dark'],[390,844,'light'],[390,844,'dark'],[700,320,'light']]){
  test(`Blackwell pressure and debris source journey ${width}x${height} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height},hasTouch:width<800,isMobile:width<800});
    observe(page);
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
      diagnostics.get(page).retain({kind:'activation',observation:id,href:await link.getAttribute('href')});
      if(width===390)await link.tap();else await link.click();
      await ready(page);
      const card=page.locator('#observation-'+id);
      await card.waitFor();
      assert.match(await card.textContent(),/source reported/);
      assert.match(await card.textContent(),/rightslinks only/);
      if(id===observations[0]){
        assert.match(await card.textContent(),/capture/);
        assert.match(await card.textContent(),/about 2055 CST/);
        assert.match(await card.textContent(),/time checks absent/);
      }else assert.match(await card.textContent(),/not measured wind speeds/);
      await card.getByRole('link',{name:'Inspect the source card',exact:true}).click();
      await ready(page);
      const source=page.locator('#source-nws-wichita');await source.waitFor();
      assert.equal(await source.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),report);
      await page.goBack();await ready(page);await card.waitFor();
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
  const page=await fixture(t);observe(page);await page.goto(base+'/blackwell.html#pressure-damage');
  let reached=false;
  for(let step=0;step<70;step++){
    await page.keyboard.press('Tab');
    if(await page.evaluate(()=>document.activeElement?.getAttribute('href')?.includes('observation=blackwell-tonkawa-barograph'))){reached=true;break;}
  }
  assert.ok(reached,'Reach the observation link through Tab');
  await page.keyboard.press('Enter');await ready(page);
  await page.locator('#observation-blackwell-tonkawa-barograph').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('observation'),'blackwell-tonkawa-barograph');
});
