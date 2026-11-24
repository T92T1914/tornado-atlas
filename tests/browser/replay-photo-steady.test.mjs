import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

// The replay opens on a Nolte sample whose complete photograph is checked
// before it is shown. The record under it, which holds the link
// #replay-photo-full, must not move when that photograph appears.
const player=()=>base+'/reconstruction.html?event=el-reno-2013&t=397&appearance_view=photo&appearance_photo=nolte-reported-stills#replay-appearance';
const painted=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

// Hold the bytes of every checked Nolte photograph until the test lets them go.
async function holdPhotographs(page){
  const held=[];let open=false;
  await page.route(/\/assets\/el-reno-2013\/nolte-\d+-full\.jpg$/,route=>{if(open)route.continue();else held.push(route);});
  return {held:()=>held.length,release(){open=true;for(const route of held.splice(0))route.continue();}};
}
async function openHeld(page){
  const hold=await holdPhotographs(page);
  await page.goto(player());
  await page.locator('#replay-photo-full').waitFor();
  await page.locator('#replay-documentary-image[data-state="loading"]').waitFor();
  const until=Date.now()+10000;
  while(!hold.held()){assert.ok(Date.now()<until,'The checked photograph is requested.');await page.waitForTimeout(25);}
  await painted(page);
  return hold;
}
const place=page=>page.locator('#replay-photo-full').evaluate(link=>{const box=link.getBoundingClientRect();return {page:box.top+scrollY,view:box.top,height:box.height};});

for(const width of [320,390,1280]){
  test(`the photograph record stays where it is when the checked photograph is shown at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
    const hold=await openHeld(page);
    const loading=await place(page);
    hold.release();
    await page.locator('#replay-documentary-image[data-state="ready"]').waitFor();
    await painted(page);
    const shown=await place(page);
    assert.ok(Math.abs(shown.page-loading.page)<=1,`The link keeps its place on the page: ${loading.page.toFixed(1)} px while loading, ${shown.page.toFixed(1)} px once shown.`);
    assert.ok(Math.abs(shown.view-loading.view)<=1,`The link keeps its place in the window: ${loading.view.toFixed(1)} px while loading, ${shown.view.toFixed(1)} px once shown.`);
    assert.ok(loading.height>=44,'The link keeps its full height.');
  });
}

test('a pointer press on the photograph link while the photograph loads opens the dialog',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900},reducedMotion:'reduce'});
  await page.addInitScript(()=>addEventListener('click',event=>{const node=event.target;window.lastClick=node.id?'#'+node.id:node.localName;},true));
  const hold=await openHeld(page);
  const link=page.locator('#replay-photo-full');
  await link.scrollIntoViewIfNeeded();await painted(page);
  const box=await link.boundingBox();
  // The press begins while the photograph is held and ends after it is shown.
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  hold.release();
  await page.locator('#replay-documentary-image[data-state="ready"]').waitFor();
  await painted(page);
  await page.mouse.up();
  assert.equal(await page.evaluate(()=>window.lastClick),'#replay-photo-full','The press lands on the link it began on.');
  await page.waitForFunction(()=>{const img=document.getElementById('photo-full');return document.getElementById('photo-dialog').open&&!img.hidden&&img.naturalWidth===1920&&img.naturalHeight===1080;});
});
