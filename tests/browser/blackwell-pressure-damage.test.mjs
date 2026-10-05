import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

const report='https://www.weather.gov/ict/udall_stormreport';
const observations=['blackwell-tonkawa-barograph','blackwell-debris-directions'];
async function ready(page){await page.waitForFunction(()=>document.body?.dataset.ready==='true');}
async function fits(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal document overflow');}

for(const [width,height,appearance] of [[1280,900,'light'],[1280,900,'dark'],[390,844,'light'],[390,844,'dark'],[700,320,'light']]){
  test(`Blackwell pressure and debris source journey ${width}x${height} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height},hasTouch:width<800,isMobile:width<800});
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
  const page=await fixture(t);await page.goto(base+'/blackwell.html#pressure-damage');
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
