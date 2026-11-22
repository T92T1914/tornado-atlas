import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,base} from './harness.mjs';
import {preparePositions,positionAt} from '../../web/playback-model.mjs';
import {localPoint,sceneProject,replayFunnel,REPLAY_FUNNEL} from '../../web/reconstruction-model.mjs';

// The expected point is worked out here from the published positions and the
// scene's own camera. Only the camera and the scene size are read from the page.
const features=JSON.parse(readFileSync(new URL('../../web/data.json',import.meta.url),'utf8')).geometry.features;
const positions=preparePositions(features.filter(feature=>feature.geometry.type==='Point'));
const path=features.find(feature=>feature.geometry.type==='LineString').geometry.coordinates;
const origin=[0,1].map(axis=>(Math.min(...path.map(point=>point[axis]))+Math.max(...path.map(point=>point[axis])))/2);
const painted=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const label='Funnel illustration, not a reconstruction';
const ringCount=replayFunnel().rings.length;
const centerAt=seconds=>localPoint(positionAt(positions,seconds).coordinates,origin);

// Record what the scene paints. Only the funnel rings fill a path below full
// opacity, and the first of them in a frame is the ring on the ground.
async function watchScene(page){
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      const context=get.call(this,kind,...args);
      if(this.id!=='replay-scene'||kind!=='2d'||!context||context.funnelWatched)return context;
      context.funnelWatched=true;
      const {fillRect,beginPath,moveTo,lineTo,fill}=context;
      let outline=[];
      context.fillRect=function(...values){if(values[0]===0&&values[1]===0)window.funnelFrame={rings:0,foot:null};return fillRect.apply(this,values);};
      context.beginPath=function(){outline=[];return beginPath.call(this);};
      context.moveTo=function(x,y){outline.push([x,y]);return moveTo.call(this,x,y);};
      context.lineTo=function(x,y){outline.push([x,y]);return lineTo.call(this,x,y);};
      context.fill=function(...values){
        const frame=window.funnelFrame;
        if(frame&&this.globalAlpha<1){if(!frame.rings)frame.foot=outline.slice();frame.rings++;}
        return fill.apply(this,values);
      };
      return context;
    };
  });
}

const sceneView=page=>page.evaluate(()=>{
  const rect=document.querySelector('#replay-scene').getBoundingClientRect(),value=id=>Number(document.querySelector(id).value);
  return {width:rect.width,height:rect.height,follow:document.querySelector('#replay-follow').checked,
    azimuth:value('#replay-azimuth'),elevation:value('#replay-elevation'),distance:value('#replay-distance')};
});
async function expectedBase(page,seconds){
  const view=await sceneView(page),center=centerAt(seconds);
  return sceneProject(center,{azimuth:view.azimuth,elevation:view.elevation,distance:view.distance,focus:view.follow?center:[0,0,0]},view.width,view.height);
}
// The middle of the painted ground ring, in CSS pixels of the scene.
const paintedBase=page=>page.evaluate(()=>{
  const frame=window.funnelFrame;
  if(!frame?.foot?.length)return null;
  return {rings:frame.rings,x:frame.foot.reduce((sum,point)=>sum+point[0],0)/frame.foot.length,y:frame.foot.reduce((sum,point)=>sum+point[1],0)/frame.foot.length};
});
const recordedBase=page=>page.locator('#replay-scene').evaluate(canvas=>canvas.dataset.funnelBase.split(',').map(Number));
function inside(box,scene){return box.x>=scene.x&&box.x+box.width<=scene.x+scene.width&&box.y>=scene.y&&box.y+box.height<=scene.y+scene.height;}

// Pixels that differ between the scene with the funnel and without it, as a
// box in CSS pixels of the scene.
async function funnelPixels(page){
  await painted(page);
  await page.locator('#replay-scene').evaluate(canvas=>{
    window.funnelScenePixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  });
  await page.locator('#replay-funnel').uncheck();
  await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.funnelBase===''&&window.funnelFrame.rings===0);
  await painted(page);
  return page.locator('#replay-scene').evaluate(canvas=>{
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,before=window.funnelScenePixels;
    const ratio=canvas.width/canvas.getBoundingClientRect().width;
    let count=0,left=canvas.width,right=-1,top=canvas.height,bottom=-1;
    for(let i=0;i<pixels.length;i+=4){
      if(pixels[i]===before[i]&&pixels[i+1]===before[i+1]&&pixels[i+2]===before[i+2])continue;
      const x=(i/4)%canvas.width,y=Math.floor(i/4/canvas.width);
      count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    delete window.funnelScenePixels;
    return {count,left:left/ratio,right:right/ratio,top:top/ratio,bottom:bottom/ratio};
  });
}

for(const width of [390,1280]){
  test(`the funnel illustration stands on the center position and carries its label at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await watchScene(page);
    await page.goto(base+'/reconstruction.html?event=el-reno-2013');
    await page.locator('#replay-scene').waitFor();
    assert.equal(await page.locator('#replay-funnel').isChecked(),true);
    assert.match(await page.locator('.replay-boundary').textContent(),/The funnel is an illustration, not a reconstruction\./);
    // Whole path stops following, so the base has to move across the scene.
    await page.locator('#replay-reset').click();
    const seen=new Set();
    let foot=null;
    for(const seconds of [0,488,2280]){
      await page.locator('#replay-time').fill(String(seconds));
      await painted(page);
      const expected=await expectedBase(page,seconds);
      assert.ok(expected,`The center position projects into the scene at ${seconds} s.`);
      // Wait for the frame that paints this clock, then read it once.
      await page.waitForFunction(({x,y})=>{
        const ring=window.funnelFrame?.foot;
        if(!ring?.length)return false;
        const middle=axis=>ring.reduce((sum,point)=>sum+point[axis],0)/ring.length;
        return Math.abs(middle(0)-x)<=1&&Math.abs(middle(1)-y)<=1;
      },{x:expected.x,y:expected.y}).catch(async()=>{
        assert.fail(`Painted funnel base ${JSON.stringify(await paintedBase(page))} is not within 1 px of ${expected.x},${expected.y} at ${seconds} s.`);
      });
      foot=await paintedBase(page);
      assert.ok(Math.abs(foot.x-expected.x)<=1&&Math.abs(foot.y-expected.y)<=1,`The painted ground ring is centered on the position at ${seconds} s.`);
      assert.equal(foot.rings,ringCount,'Every ring of the funnel is painted.');
      seen.add(`${foot.x.toFixed(1)},${foot.y.toFixed(1)}`);
      // The page records the same base it paints around.
      const recorded=await recordedBase(page);
      assert.ok(Math.abs(recorded[0]-expected.x)<=1&&Math.abs(recorded[1]-expected.y)<=1,`The recorded base matches at ${seconds} s.`);
      const text=page.locator('#replay-funnel-label');
      assert.equal(await text.isVisible(),true);
      assert.equal((await text.textContent()).trim(),label);
      const box=await text.boundingBox(),scene=await page.locator('#replay-scene').boundingBox();
      const x=scene.x+foot.x,y=scene.y+foot.y;
      assert.ok(inside(box,scene),`The label stays inside the scene at ${seconds} s.`);
      // Beside the base: no farther than its own offsets from the point.
      assert.ok(Math.max(0,box.x-x,x-(box.x+box.width))<=14,`The label sits beside the base horizontally at ${seconds} s.`);
      assert.ok(Math.max(0,box.y-y,y-(box.y+box.height))<=16,`The label sits beside the base vertically at ${seconds} s.`);
    }
    assert.equal(seen.size,3,'Each clock paints the base at its own position.');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    // The funnel is painted around that base, rises from it, and leaves with its label.
    const difference=await funnelPixels(page);
    assert.ok(difference.count>20,`Only ${difference.count} pixels changed.`);
    assert.ok(difference.left-1<=foot.x&&foot.x<=difference.right+1,'The painted funnel spans its base.');
    assert.ok(difference.top<foot.y&&difference.bottom>=foot.y-2,'The painted funnel rises from its base.');
    assert.equal(await page.locator('#replay-funnel-label').isVisible(),false);
    await page.locator('#replay-funnel').check();
    await page.waitForFunction(count=>document.querySelector('#replay-scene').dataset.funnelBase!==''&&window.funnelFrame.rings===count,ringCount);
    assert.equal(await page.locator('#replay-funnel-label').isVisible(),true);
  });
}

// A clock and a view distance, with the scene looking north at its middle,
// whose projected base and column top satisfy the given condition.
function findView(scene,accept){
  for(const seconds of [0,244,488,732,976,1241,1500,1830,2040,2280])for(let distance=3;distance<=30;distance+=.25){
    const center=centerAt(seconds),camera={azimuth:0,elevation:48,distance,focus:[0,0,0]};
    const foot=sceneProject(center,camera,scene.width,scene.height);
    const top=sceneProject([center[0],center[1],REPLAY_FUNNEL.columnKilometers],camera,scene.width,scene.height);
    if(foot&&top&&accept(foot,top))return {seconds,distance,foot};
  }
  return null;
}
async function look(page,view){
  await page.locator('#replay-distance').fill(String(view.distance));
  await page.locator('#replay-time').fill(String(view.seconds));
  await page.waitForFunction(({x,y})=>{
    const recorded=document.querySelector('#replay-scene').dataset.funnelBase.split(',').map(Number);
    return recorded.length===2&&Math.abs(recorded[0]-x)<=1&&Math.abs(recorded[1]-y)<=1;
  },{x:view.foot.x,y:view.foot.y});
  await painted(page);
}

test('the label stays while part of the funnel is in view and leaves when none is',async t=>{
  const page=await fixture(t);
  await watchScene(page);
  await page.goto(base+'/reconstruction.html?event=el-reno-2013');
  await page.locator('#replay-scene').waitFor();
  await page.locator('#replay-follow').uncheck();
  const scene=await sceneView(page);
  assert.equal(scene.azimuth,0);assert.equal(scene.elevation,48);
  const text=page.locator('#replay-funnel-label');
  // The base is just below the scene and the column top is still inside it.
  const partly=findView(scene,(foot,top)=>foot.y>scene.height+6&&foot.y<scene.height+40&&foot.x>120&&foot.x<scene.width-120&&
    top.y<scene.height-15&&top.x>20&&top.x<scene.width-20);
  assert.ok(partly,'A view with the base just below the scene exists.');
  await look(page,partly);
  assert.equal((await paintedBase(page)).rings,ringCount);
  assert.equal(await text.isVisible(),true,'The label stays with a funnel whose base has just left the scene.');
  assert.ok(inside(await text.boundingBox(),await page.locator('#replay-scene').boundingBox()),'The label stays inside the scene.');
  // The base is far outside, so nothing of the funnel body is in view. The
  // page still records where the base is.
  const gone=findView(scene,foot=>foot.y>scene.height+400||foot.x<-400||foot.x>scene.width+400);
  assert.ok(gone,'A view with the funnel far outside the scene exists.');
  await look(page,gone);
  assert.notEqual(await page.locator('#replay-scene').getAttribute('data-funnel-base'),'');
  assert.equal(await text.isVisible(),false,'The label leaves when no part of the funnel body is in view.');
});

test('photograph mode shows no funnel illustration and no label',async t=>{
  const page=await fixture(t);
  await watchScene(page);
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=1241&appearance_view=photo&appearance_photo=wakimoto-visible-condensation');
  await page.locator('#replay-scene').waitFor();
  await page.waitForFunction(()=>document.querySelector('#replay-funnel').disabled);
  await painted(page);
  assert.equal(await page.locator('#replay-scene').getAttribute('data-funnel-base'),'');
  assert.equal(await page.evaluate(()=>window.funnelFrame.rings),0);
  assert.equal(await page.locator('#replay-funnel-label').isVisible(),false);
});
