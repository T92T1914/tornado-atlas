import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const data=JSON.parse(await readFile(new URL('../../web/data.json',import.meta.url),'utf8'));
const records=data.survey.points.filter(point=>data.survey_media.photos[String(point.id)]?.length);
const expected=records.map(point=>({value:String(point.id),text:`${point.id} · ${point.rating} · ${point.indicator}`}));
const widths=[320,375,390,1280];

async function ready(page){
  await page.locator('#survey-observation option').last().waitFor({state:'attached'});
  await page.waitForLoadState('networkidle');
  await page.evaluate(()=>document.fonts.ready);
}
async function geometry(page){
  return page.locator('#damage .survey-inspector .survey-controls').evaluate(controls=>{
    const rect=node=>{const box=node.getBoundingClientRect();return {x:box.x,y:box.y,right:box.right,bottom:box.bottom,width:box.width,height:box.height};};
    const select=controls.querySelector('select');
    return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,controls:rect(controls),
      controlsScrollWidth:controls.scrollWidth,controlsClientWidth:controls.clientWidth,
      label:rect(select.parentElement),select:rect(select),selectWhiteSpace:getComputedStyle(select).whiteSpace,
      buttons:[...controls.querySelectorAll('button')].map(button=>({id:button.id,...rect(button)}))};
  });
}
function checkBounds(metrics){
  assert.ok(metrics.documentWidth<=metrics.viewport+1,'Damage controls do not enlarge the document');
  assert.ok(metrics.controlsScrollWidth<=metrics.controlsClientWidth+1,'Native selector text stays inside its control row');
  for(const [name,box] of [['controls',metrics.controls],['label',metrics.label],['selector',metrics.select],...metrics.buttons.map(button=>[button.id,button])]){
    assert.ok(box.x>=-1&&box.right<=metrics.viewport+1,`${name} fits the viewport`);
  }
  assert.ok(metrics.select.height>=44&&metrics.select.width>=44,'Observation selector retains a usable target');
  for(const button of metrics.buttons)assert.ok(button.height>=44&&button.width>=44,'Navigation buttons retain usable targets');
}
async function capture(page,name,metrics){
  if(!process.env.ATLAS_SCREENSHOT_DIR)return;
  await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});
  const controls=page.locator('#damage .survey-inspector .survey-controls');
  await controls.scrollIntoViewIfNeeded();await ready(page);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await controls.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,name+'.png')});
  await writeFile(path.join(process.env.ATLAS_SCREENSHOT_DIR,name+'.json'),JSON.stringify(metrics,null,2)+'\n');
}
async function checkSelection(page,record){
  const select=page.locator('#survey-observation');await select.selectOption(String(record.id));
  assert.equal(await page.locator('#survey-detail h4').textContent(),record.indicator,'Selecting an option updates its historical assessment');
  assert.equal(await page.locator('#survey-detail > .eyebrow').first().textContent(),`NWS DAT RECORD ${record.id} · ${record.rating}`);
  assert.equal(new URL(await page.locator('#survey-share').getAttribute('href')).searchParams.get('survey'),String(record.id));
  checkBounds(await geometry(page));
}
async function exercise(page,width,appearance,enlarged=false){
  await page.goto(base+'/index.html');await ready(page);await page.locator('#reading-appearance').selectOption(appearance);
  const select=page.locator('#survey-observation');
  assert.deepEqual(await select.locator('optgroup').last().locator('option').evaluateAll(options=>options.map(option=>({value:option.value,text:option.textContent}))),expected,'Every linked survey observation remains in the selector');
  assert.equal(await select.locator('optgroup').first().locator('option').count(),data.history.remembrance.places.length,'Separate fatality records stay available');
  if(enlarged){
    // A controlled text-reflow fixture, not evidence of physical phone settings.
    await page.locator('#damage .survey-inspector .survey-controls').evaluate(controls=>{
      const nodes=[controls,...controls.querySelectorAll('label,select,button')],sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');
    });
  }
  let metrics=await geometry(page);checkBounds(metrics);
  assert.equal(metrics.selectWhiteSpace,'normal','Native option text can wrap inside its survey column');
  await capture(page,`damage-${appearance}-${width}${enlarged?'-enlarged':''}`,metrics);
  const longest=records.reduce((best,record)=>record.indicator.length>best.indicator.length?record:best);
  await checkSelection(page,longest);
  const middle=records[Math.floor(records.length/2)],index=records.indexOf(middle);await checkSelection(page,middle);
  const next=page.locator('#survey-next'),previous=page.locator('#survey-previous');
  if(width<600){await next.tap();}else{await next.click();}
  assert.equal(await select.inputValue(),String(records[index+1].id),'Next remains reachable and changes the selection');
  if(width<600){await previous.tap();}else{await previous.click();}
  assert.equal(await select.inputValue(),String(middle.id),'Previous remains reachable and restores the selection');
  await next.focus();await page.keyboard.press('Enter');
  assert.equal(await select.inputValue(),String(records[index+1].id),'Focused keyboard activation reaches the next observation');
  checkBounds(await geometry(page));
}

for(const appearance of ['dark','light'])for(const width of widths){
  test(`El Reno damage controls ${appearance} at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
    await exercise(page,width,appearance);
  });
}
for(const appearance of ['dark','light'])test(`El Reno damage controls ${appearance} with doubled text at 320px`,async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await exercise(page,320,appearance,true);
});
