import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,open,search,select,detail,base} from './harness.mjs';
async function providers(page,selector){
  const session=await page.context().newCDPSession(page);
  try{
    await session.send('DOM.enable');await session.send('CSS.enable');
    const {root}=await session.send('DOM.getDocument');
    const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});
    return (await session.send('CSS.getPlatformFontsForNode',{nodeId})).fonts.filter(f=>f.glyphCount>0);
  }finally{await session.detach();}
}
const faces=[[400,'normal','Inter-Regular'],[600,'normal','Inter-SemiBold'],[700,'normal','Inter-Bold'],
  [400,'italic','Inter-Italic'],[600,'italic','Inter-SemiBoldItalic'],[700,'italic','Inter-BoldItalic']];
for(const appearance of ['dark','light'])test(`${appearance} typography preserves selected evidence and narrow controls`,async t=>{
  const page=await fixture(t);await open(page);await search(page,'El Reno');
  await select(page,'ncei:453682');await detail(page,'ncei:453682');
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const url=page.url(),record=await page.locator('#detail').textContent();
  await page.locator('#reading-appearance').selectOption(appearance);await page.evaluate(()=>document.fonts.ready);
  assert.match(await page.locator('body').evaluate(e=>getComputedStyle(e).fontFamily),/Atlas Inter/);
  assert.equal(page.url(),url);assert.equal(await page.locator('#detail').textContent(),record);
  // Serif exhibit titles are an existing museum choice, not a font fallback.
  assert.match(await page.locator('h1').evaluate(e=>getComputedStyle(e).fontFamily),/Georgia/);
  await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'body {font-size:200%}'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#show-list').click();
  const row=page.locator('#results [data-record="ncei:453682"]');await row.focus();await row.press('Enter');
  await detail(page,'ncei:453682');assert.equal(await page.locator('#detail h2').textContent(),'Calumet, Oklahoma');
  if(process.env.ATLAS_SCREENSHOT_DIR){await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});
    await page.locator('#selected-panel').screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`interface-${appearance}.png`)});}
});
test('six installed faces supply interface and separate diagnostic glyphs',{
  skip:process.env.ATLAS_REQUIRE_INTER!=='1'||process.env.ATLAS_BROWSER_ENGINE==='webkit'
},async t=>{
  const page=await fixture(t);await open(page);
  await page.evaluate(faces=>{
    const section=document.createElement('section');section.id='font-diagnostic';
    for(const [weight,style,name] of faces){const p=document.createElement('p');p.id=name;p.style.fontWeight=weight;p.style.fontStyle=style;p.textContent='Interface glyph diagnostic 123';section.append(p);}
    const code=document.createElement('code');code.id='font-code';code.style.fontFamily='monospace';code.textContent='let value = 123;';section.append(code);document.body.append(section);
  },faces);
  await page.evaluate(()=>document.fonts.ready);
  for(const appearance of ['dark','light']){
    await page.locator('#reading-appearance').selectOption(appearance);
    for(const [,,name] of faces){const fonts=await providers(page,'#'+name);
      assert.ok(fonts.some(f=>f.postScriptName===name),JSON.stringify({appearance,name,fonts}));
      console.log(JSON.stringify({appearance,scope:'diagnostic',face:name,fonts}));}
    for(const [selector,name] of [['#coverage','Inter-Regular'],['label[for="reading-appearance"]','Inter-SemiBold'],['.catalogue-cluster','Inter-Bold']]){
      const fonts=await providers(page,selector);assert.ok(fonts.some(f=>f.postScriptName===name),JSON.stringify({appearance,selector,fonts}));
      console.log(JSON.stringify({appearance,scope:'interface',selector,fonts}));}
    assert.ok((await providers(page,'#font-code')).every(f=>!f.postScriptName.startsWith('Inter')));
  }
});
test('unavailable Inter keeps readable fallback and original media styling',async t=>{
  const page=await fixture(t);await page.goto(base+'/index.html');
  await page.addStyleTag({content:':root {--interface-font:"Atlas unavailable font",Arial,sans-serif}'});
  await page.locator('#introduction').filter({hasText:/\S/}).waitFor();
  assert.match(await page.locator('#introduction').evaluate(e=>getComputedStyle(e).fontFamily),/Atlas unavailable font/);
  if(process.env.ATLAS_BROWSER_ENGINE!=='webkit'){
    const fonts=await providers(page,'#introduction');assert.ok(fonts.length);assert.ok(fonts.every(f=>!f.postScriptName.startsWith('Inter')));}
  const photo=page.locator('#hero-photograph img').first();await photo.waitFor();
  assert.equal(await photo.evaluate(e=>getComputedStyle(e).filter),'none');
});
test('canvas labels inherit interface family without advancing playback',async t=>{
  const page=await fixture(t);await page.goto(base+'/reconstruction.html');
  await page.locator('#replay-play:not([disabled])').waitFor();await page.evaluate(()=>document.fonts.ready);
  const time=await page.locator('#replay-time').inputValue();
  await page.waitForFunction(()=>document.querySelector('#replay-scene').getContext('2d').font.includes('Atlas Inter'));
  await page.locator('#reading-appearance').selectOption('light');
  assert.equal(await page.locator('#replay-time').inputValue(),time);assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  await page.goto(base+'/wind.html');
  await page.waitForFunction(()=>document.querySelector('canvas').getContext('2d').font.includes('Atlas Inter'));
  assert.equal(await page.locator('#wind-motion').textContent(),'Play tracers');
});
