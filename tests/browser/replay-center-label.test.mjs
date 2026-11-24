import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,base} from './harness.mjs';
import {preparePositions,positionAt} from '../../web/playback-model.mjs';
import {localPoint,sceneProject} from '../../web/reconstruction-model.mjs';

// Where the marker sits is worked out here from the published positions and
// the scene's own camera. The text's place and width are read from the frame
// the page paints.
const bundle=JSON.parse(readFileSync(new URL('../../web/data.json',import.meta.url),'utf8'));
const features=bundle.geometry.features;
const positions=preparePositions(features.filter(feature=>feature.geometry.type==='Point'));
const path=features.find(feature=>feature.geometry.type==='LineString').geometry.coordinates;
const origin=[0,1].map(axis=>(Math.min(...path.map(point=>point[axis]))+Math.max(...path.map(point=>point[axis])))/2);
const painted=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

// Record where the center text of each frame starts and how wide it is.
async function watchText(page){
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      const context=get.call(this,kind,...args);
      if(this.id!=='replay-scene'||kind!=='2d'||!context||context.textWatched)return context;
      context.textWatched=true;
      const {fillRect,fillText}=context;
      context.fillRect=function(...values){if(values[0]===0&&values[1]===0)window.textFrame={center:null};return fillRect.apply(this,values);};
      context.fillText=function(words,x,y,...rest){
        if(window.textFrame&&words==='Center position')window.textFrame.center={x,y,width:this.measureText(words).width};
        return fillText.call(this,words,x,y,...rest);
      };
      return context;
    };
  });
}
async function markerAt(page,seconds){
  const view=await page.evaluate(()=>{
    const rect=document.querySelector('#replay-scene').getBoundingClientRect(),value=id=>Number(document.querySelector(id).value);
    return {width:rect.width,height:rect.height,follow:document.querySelector('#replay-follow').checked,
      azimuth:value('#replay-azimuth'),elevation:value('#replay-elevation'),distance:value('#replay-distance')};
  });
  const center=localPoint(positionAt(positions,seconds).coordinates,origin);
  const camera={azimuth:view.azimuth,elevation:view.elevation,distance:view.distance,focus:view.follow?center:[0,0,0]};
  return {view,marker:sceneProject(center,camera,view.width,view.height)};
}
async function open(page){
  await page.goto(base+'/reconstruction.html?event=el-reno-2013');
  await page.locator('#replay-scene').waitFor();
  await page.waitForFunction(()=>!document.querySelector('#replay-time').disabled);
}
async function seekTo(page,seconds){
  await page.locator('#replay-time').fill(String(seconds));
  await page.waitForFunction(seconds=>document.querySelector('#replay-time').value===String(seconds),seconds);
  await painted(page);
}

test('the center text stays inside the scene when the center nears its right edge at 390px',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  await watchText(page);
  await open(page);
  // The whole path view, late in the track, puts the center near the right edge.
  await page.locator('#replay-reset').click();
  await seekTo(page,2280);
  const {view,marker}=await markerAt(page,2280);
  const text=(await page.evaluate(()=>window.textFrame)).center;
  assert.ok(text,'The center text is drawn.');
  assert.ok(marker.x>=0&&marker.x<=view.width,`The marker is in the scene, at ${marker.x.toFixed(1)} of ${view.width} px.`);
  assert.ok(marker.x+12+text.width>view.width,'Beside the marker on the right the text would cross the edge, so this clock tests the change.');
  assert.ok(text.x>=0&&text.x+text.width<=view.width,`The text spans ${text.x.toFixed(1)} to ${(text.x+text.width).toFixed(1)} px inside ${view.width} px.`);
  assert.ok(text.x+text.width<=marker.x-7||text.x>=marker.x+7,'The text does not cover the marker.');
  assert.ok(Math.abs(text.y-(marker.y+4))<=1,'The text stays on the marker line.');
});

for(const width of [390,1280]){
  test(`the center text keeps its place right of the marker where it fits at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await watchText(page);
    await open(page);
    await seekTo(page,488);
    const {view,marker}=await markerAt(page,488);
    const text=(await page.evaluate(()=>window.textFrame)).center;
    assert.ok(marker.x+12+text.width<=view.width-8,'The text fits beside the marker.');
    assert.ok(Math.abs(text.x-(marker.x+12))<=1,'The text starts 12 px right of the marker as before.');
  });
}
