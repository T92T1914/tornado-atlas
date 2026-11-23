import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,base} from './harness.mjs';
import {preparePositions,positionAt} from '../../web/playback-model.mjs';
import {localPoint,sceneProject} from '../../web/reconstruction-model.mjs';
import {reportedWidthTag,reportedWidthCaption} from '../../web/reported-widths-model.mjs';

// The expected circle is worked out here from the published positions, the
// reported width and the scene's own camera. Only the camera and the scene
// size are read from the page.
const bundle=JSON.parse(readFileSync(new URL('../../web/data.json',import.meta.url),'utf8'));
const features=bundle.geometry.features,record=bundle.reported_widths;
const positions=preparePositions(features.filter(feature=>feature.geometry.type==='Point'));
const path=features.find(feature=>feature.geometry.type==='LineString').geometry.coordinates;
const origin=[0,1].map(axis=>(Math.min(...path.map(point=>point[axis]))+Math.max(...path.map(point=>point[axis])))/2);
const offset=utc=>(Date.parse(utc)-positions[0].stamp)/1000;
const centerAt=seconds=>localPoint(positionAt(positions,seconds).coordinates,origin);
const painted=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const [first,second]=record.widths;
// Clocks at the ends and inside each period, and before, between and after them.
const inside=[[offset(first.start_utc),first],[1244,first],[offset(first.end_utc),first],
  [offset(second.start_utc),second],[1260,second],[offset(second.end_utc),second]];
const outside=[0,488,offset(first.start_utc)-1,offset(first.end_utc)+1,1252,offset(second.start_utc)-1,offset(second.end_utc)+1,2280];

// Record every dashed stroke of a frame and where the center text starts.
// Only a reported width is dashed.
async function watchScene(page){
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      const context=get.call(this,kind,...args);
      if(this.id!=='replay-scene'||kind!=='2d'||!context||context.widthWatched)return context;
      context.widthWatched=true;
      const {fillRect,beginPath,moveTo,lineTo,stroke,fillText}=context;
      let outline=[];
      context.fillRect=function(...values){if(values[0]===0&&values[1]===0)window.widthFrame={dashed:[],centerText:null};return fillRect.apply(this,values);};
      context.fillText=function(words,x,y,...rest){if(window.widthFrame&&words==='Center position')window.widthFrame.centerText=[x,y];return fillText.call(this,words,x,y,...rest);};
      context.beginPath=function(){outline=[];return beginPath.call(this);};
      context.moveTo=function(x,y){outline.push([x,y]);return moveTo.call(this,x,y);};
      context.lineTo=function(x,y){outline.push([x,y]);return lineTo.call(this,x,y);};
      context.stroke=function(...values){
        const frame=window.widthFrame;
        if(frame&&this.getLineDash().length)frame.dashed.push(outline.slice());
        return stroke.apply(this,values);
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
// Where the middle of the circle and its four ends fall on screen.
async function expectedCircle(page,seconds,metres){
  const view=await sceneView(page),center=centerAt(seconds);
  const camera={azimuth:view.azimuth,elevation:view.elevation,distance:view.distance,focus:view.follow?center:[0,0,0]};
  const project=point=>sceneProject(point,camera,view.width,view.height),half=metres/2000;
  return {view,middle:project(center),east:project([center[0]+half,center[1],0]),west:project([center[0]-half,center[1],0]),
    north:project([center[0],center[1]+half,0]),south:project([center[0],center[1]-half,0])};
}
async function open(page,address='/reconstruction.html?event=el-reno-2013'){
  await page.goto(base+address);
  await page.locator('#replay-scene').waitFor();
  await page.waitForFunction(()=>!document.querySelector('#replay-time').disabled&&document.querySelector('#replay-scene').hasAttribute('data-reported-width'));
  await painted(page);
}
// The recorded width can still be the earlier clock's when this resolves. The
// two frames that follow paint the new clock before anything is read.
async function seekTo(page,seconds,widthId){
  await page.locator('#replay-time').fill(String(seconds));
  await page.waitForFunction(({seconds,widthId})=>document.querySelector('#replay-time').value===String(seconds)&&
    document.querySelector('#replay-scene').dataset.reportedWidth===widthId,{seconds,widthId});
  await painted(page);
}
const frameOf=page=>page.evaluate(()=>window.widthFrame);
function contains(outer,inner){return inner.x>=outer.x&&inner.x+inner.width<=outer.x+outer.width&&inner.y>=outer.y&&inner.y+inner.height<=outer.y+outer.height;}
function apart(a,b){return a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y;}

for(const width of [390,1280]){
  test(`each reported funnel width is a dashed ground circle of its size inside its period only at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await watchScene(page);
    await open(page);
    const tag=page.locator('#replay-width-label'),caption=page.locator('#replay-width-status'),scene=page.locator('#replay-scene');
    assert.equal((await sceneView(page)).azimuth,0,'The scene looks north, so east to west is level on screen.');
    for(const [seconds,reported] of inside){
      await seekTo(page,seconds,reported.id);
      const expected=await expectedCircle(page,seconds,reported.metres);
      const strokes=(await frameOf(page)).dashed;
      assert.equal(strokes.length,1,`One dashed circle at ${seconds} s.`);
      const xs=strokes[0].map(point=>point[0]),ys=strokes[0].map(point=>point[1]);
      const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
      // The reported diameter, at the scale of the scene at the center.
      const diameter=reported.metres/1000*expected.middle.scale;
      assert.ok(diameter>20,`The circle is large enough to measure, ${diameter.toFixed(1)} px.`);
      assert.ok(Math.abs(right-left-diameter)<=1,`The circle is ${reported.metres} m wide at ${seconds} s: ${(right-left).toFixed(2)} px against ${diameter.toFixed(2)} px.`);
      assert.ok(Math.abs(left-expected.west.x)<=1&&Math.abs(right-expected.east.x)<=1,`Its east and west ends sit where the width puts them at ${seconds} s.`);
      assert.ok(Math.abs(top-expected.north.y)<=1&&Math.abs(bottom-expected.south.y)<=1,`Its north and south ends sit where the width puts them at ${seconds} s.`);
      assert.ok(Math.abs((left+right)/2-expected.middle.x)<=1&&top<expected.middle.y&&bottom>expected.middle.y,`It surrounds the center position at ${seconds} s.`);
      // The tag names the mark. The caption under the scene says where its size
      // comes from, where the circle was put and what it is not.
      assert.equal(await tag.isVisible(),true);
      assert.equal((await tag.textContent()).trim(),reportedWidthTag(reported));
      assert.equal(await caption.isVisible(),true);
      const published=positionAt(positions,seconds).published;
      const words=(await caption.textContent()).trim();
      assert.equal(words,reportedWidthCaption(record,reported,{published}));
      assert.match(words,new RegExp(`^Dashed circle: Wakimoto and colleagues give a visible funnel (width|diameter) of about ${reported.metres} m `));
      assert.match(words,published?/is the NWS minute position for this clock, not a place taken from the paper\./:
        /is interpolated between the NWS minute positions and was not observed\./);
      assert.match(words,/It is not a footprint, a damage width or a wind field\.$/);
      const frame=await scene.boundingBox(),tagBox=await tag.boundingBox(),captionBox=await caption.boundingBox();
      assert.ok(contains(frame,tagBox),`The tag stays inside the scene at ${seconds} s.`);
      assert.ok(captionBox.y>=frame.y+frame.height-1,`The caption sits under the scene at ${seconds} s.`);
      // Nothing is laid over the circle: not the tag, not the funnel label, not the center text.
      const circle={x:frame.x+left,y:frame.y+top,width:right-left,height:bottom-top};
      assert.ok(apart(circle,tagBox),`The tag leaves the circle uncovered at ${seconds} s.`);
      const funnel=page.locator('#replay-funnel-label');
      assert.equal(await funnel.isVisible(),true);
      const funnelBox=await funnel.boundingBox();
      assert.ok(apart(circle,funnelBox),`The funnel label leaves the circle uncovered at ${seconds} s.`);
      assert.ok(apart(tagBox,funnelBox),`The tag and the funnel label do not cover each other at ${seconds} s.`);
      const centerText=(await frameOf(page)).centerText;
      assert.ok(centerText&&centerText[0]>=right+5,`The center text starts beside the circle at ${seconds} s.`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No sideways scroll with the caption shown at ${seconds} s.`);
    }
    // The published 23:25:00 position is inside the second period, so both placements were read.
    assert.equal(positionAt(positions,1260).published,true);assert.equal(positionAt(positions,1244).published,false);
    assert.match(reportedWidthCaption(record,first),/2° elevation/);
    assert.match(reportedWidthCaption(record,second),/names no elevation/);
    for(const seconds of outside){
      await seekTo(page,seconds,'');
      const frame=await frameOf(page),expected=await expectedCircle(page,seconds,first.metres);
      assert.deepEqual(frame.dashed,[],`No width is drawn at ${seconds} s.`);
      assert.equal(await tag.isVisible(),false,`No tag at ${seconds} s.`);
      assert.equal(await caption.isVisible(),false,`No caption at ${seconds} s.`);
      assert.equal(await tag.textContent()+await caption.textContent(),'');
      assert.ok(Math.abs(frame.centerText[0]-(expected.middle.x+12))<=1,`The center text keeps its place beside the marker at ${seconds} s.`);
    }
  });
}

test('the reported width keeps its size when the funnel illustration is off and when the view changes',async t=>{
  const page=await fixture(t);
  await watchScene(page);
  await open(page);
  await seekTo(page,1244,first.id);
  await page.locator('#replay-funnel').uncheck();
  await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.funnelBase==='');
  await painted(page);
  assert.equal((await frameOf(page)).dashed.length,1,'The sourced width does not leave with the illustration.');
  assert.equal(await page.locator('#replay-width-label').isVisible(),true);
  assert.equal(await page.locator('#replay-funnel-label').isVisible(),false);
  // Closer and lower: the circle is still the reported width at the scale of its center.
  await page.locator('#replay-distance').fill('5');
  await page.locator('#replay-elevation').fill('25');
  await seekTo(page,1260,second.id);
  const expected=await expectedCircle(page,1260,second.metres);
  assert.equal(expected.view.distance,5);assert.equal(expected.view.elevation,25);
  const strokes=(await frameOf(page)).dashed;
  assert.equal(strokes.length,1);
  const xs=strokes[0].map(point=>point[0]),ys=strokes[0].map(point=>point[1]),diameter=second.metres/1000*expected.middle.scale;
  assert.ok(Math.abs(Math.max(...xs)-Math.min(...xs)-diameter)<=1,`The circle is ${second.metres} m wide in the closer view.`);
  assert.ok(Math.abs(Math.min(...xs)-expected.west.x)<=1&&Math.abs(Math.max(...xs)-expected.east.x)<=1,'The circle follows the camera east to west.');
  assert.ok(Math.abs(Math.min(...ys)-expected.north.y)<=1&&Math.abs(Math.max(...ys)-expected.south.y)<=1,'The circle follows the camera north to south.');
});

test('the center text keeps its own place when no width is drawn, even outside the scene',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  await watchScene(page);
  await open(page);
  // No longer following, so at the first clock the marker is far to one side.
  await page.locator('#replay-follow').uncheck();
  await seekTo(page,0,'');
  const frame=await frameOf(page),expected=await expectedCircle(page,0,first.metres);
  assert.ok(expected.middle.x<0||expected.middle.x>expected.view.width,`The marker is outside the scene, at ${expected.middle.x.toFixed(0)} px.`);
  assert.ok(Math.abs(frame.centerText[0]-(expected.middle.x+12))<=1,'The center text stays with its marker.');
  // A width whose circle is outside the view keeps its caption and says so. The tag leaves.
  await seekTo(page,1244,first.id);
  const away=await expectedCircle(page,1244,first.metres);
  assert.ok(away.west.x>away.view.width,`The circle is outside the scene, from ${away.west.x.toFixed(0)} px.`);
  assert.equal(await page.locator('#replay-scene').getAttribute('data-reported-width'),first.id);
  assert.equal((await frameOf(page)).dashed.length,1);
  assert.equal(await page.locator('#replay-width-label').isVisible(),false);
  assert.equal((await page.locator('#replay-width-status').textContent()).trim(),reportedWidthCaption(record,first,{inView:false}));
  assert.match(await page.locator('#replay-width-status').textContent(),/The circle is outside this view\.$/);
  // Turned so that the circle is at or behind the camera, the caption still belongs to the clock.
  await page.locator('#replay-distance').fill('3');
  await page.locator('#replay-azimuth').fill('90');
  await painted(page);
  assert.deepEqual((await frameOf(page)).dashed,[]);
  assert.equal(await page.locator('#replay-scene').getAttribute('data-reported-width'),first.id);
  assert.equal(await page.locator('#replay-width-label').isVisible(),false);
  assert.equal((await page.locator('#replay-width-status').textContent()).trim(),reportedWidthCaption(record,first,{inView:false}));
});

test('the whole second the clock shows decides, as in the link to this moment',async t=>{
  const page=await fixture(t);
  await watchScene(page);
  const cases=[[offset(first.end_utc)+.4,first.id],[offset(first.end_utc)+1,''],[offset(second.start_utc)-.1,''],[offset(second.start_utc),second.id]];
  for(const [seconds,id] of cases){
    await open(page,'/reconstruction.html?event=el-reno-2013&t='+seconds);
    assert.equal(new URL(page.url()).searchParams.get('t'),String(seconds),'The address keeps the fractional clock.');
    assert.equal(await page.locator('#replay-scene').getAttribute('data-reported-width'),id,`The width at ${seconds} s.`);
    assert.equal((await frameOf(page)).dashed.length,id?1:0,`The dashed strokes at ${seconds} s.`);
    // The shared link floors the clock. It has to open the same state.
    const shared=new URL(await page.locator('#replay-link').getAttribute('href'),base+'/');
    assert.equal(shared.searchParams.get('t'),String(Math.floor(seconds)));
    await open(page,shared.pathname+shared.search);
    assert.equal(await page.locator('#replay-scene').getAttribute('data-reported-width'),id,`The link to ${seconds} s opens the same state.`);
  }
});

test('the caption waits while the timeline runs faster than real time, and shows at the real rate',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  await watchScene(page);
  await open(page,'/reconstruction.html?event=el-reno-2013&t=1230');
  const playing=id=>page.waitForFunction(({id,shown})=>{
    const scene=document.querySelector('#replay-scene'),caption=document.querySelector('#replay-width-status');
    return document.querySelector('#replay-play').textContent==='Pause timeline'&&scene.dataset.reportedWidth===id&&
      !document.querySelector('#replay-width-label').hidden&&caption.hidden===!shown;
  },id);
  // At 15 times the first period lasts under a second. The tag shows and the caption does not.
  await page.locator('#replay-rate').selectOption('15');
  await page.locator('#replay-play').click();
  await playing({id:first.id,shown:false});
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>document.querySelector('#replay-play').textContent==='Play timeline');
  // Paused inside a period, or running at the real rate, the caption is there to read.
  await seekTo(page,1240,first.id);
  assert.equal((await page.locator('#replay-width-status').textContent()).trim(),reportedWidthCaption(record,first));
  await page.locator('#replay-rate').selectOption('1');
  await page.locator('#replay-play').click();
  await playing({id:first.id,shown:true});
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>document.querySelector('#replay-play').textContent==='Play timeline'&&!document.querySelector('#replay-width-status').hidden);
});

test('photograph mode and a study mode keep only the center marker inside a reported period',async t=>{
  const page=await fixture(t);
  await watchScene(page);
  for(const mode of ['appearance_view=photo&appearance_photo=wakimoto-visible-condensation','appearance_view=ground&ground_view=synthetic-front']){
    await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=1241&'+mode);
    await page.locator('#replay-scene').waitFor();
    await page.waitForFunction(()=>document.querySelector('#replay-funnel').disabled&&document.querySelector('#replay-scene').hasAttribute('data-reported-width'));
    await painted(page);
    assert.equal(Number(await page.locator('#replay-time').inputValue()),1241,mode);
    assert.equal(await page.locator('#replay-scene').getAttribute('data-reported-width'),'',mode);
    assert.deepEqual((await frameOf(page)).dashed,[],mode);
    assert.equal(await page.locator('#replay-width-label').isVisible(),false,mode);
    assert.equal(await page.locator('#replay-width-status').isVisible(),false,mode);
  }
});

test('each width in the list leads to its circle in the scene',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  await watchScene(page);
  await open(page,'/reconstruction.html?event=el-reno-2013&t=120');
  await page.locator('#replay-scale-impact:not([hidden])').waitFor();
  for(const reported of record.widths){
    const link=page.locator('#replay-width-show-'+reported.id),seconds=offset(reported.start_utc);
    assert.equal(new URL(await link.getAttribute('href'),base+'/').searchParams.get('t'),String(seconds));
    // The link stops a running timeline at the start of the period.
    await page.locator('#replay-play').click();
    await page.waitForFunction(()=>document.querySelector('#replay-play').textContent==='Pause timeline');
    await link.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(({seconds,id})=>document.querySelector('#replay-time').value===String(seconds)&&
      document.querySelector('#replay-scene').dataset.reportedWidth===id,{seconds,id:reported.id});
    assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
    assert.equal(new URL(page.url()).searchParams.get('t'),String(seconds));
    await page.waitForFunction(()=>{const box=document.querySelector('#replay-scene').getBoundingClientRect();return box.top>=0&&box.top<innerHeight&&document.activeElement?.id==='replay-scene';});
    assert.equal(await page.locator('#replay-width-label').isVisible(),true);
    assert.equal((await page.locator('#replay-width-status').textContent()).trim(),reportedWidthCaption(record,reported));
  }
  // Back returns the clock, and the circle leaves with it.
  await page.goBack();
  await page.waitForFunction(id=>document.querySelector('#replay-scene').dataset.reportedWidth===id,first.id);
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.reportedWidth===''&&Number(document.querySelector('#replay-time').value)<1238);
  assert.equal(await page.locator('#replay-width-label').isVisible(),false);
  assert.equal(await page.locator('#replay-width-status').isVisible(),false);
});
