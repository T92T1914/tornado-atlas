import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,base} from './harness.mjs';
import {localPoint,sceneProject} from '../../web/reconstruction-model.mjs';
import {preparePositions,positionAt} from '../../web/playback-model.mjs';

// The expected marks are worked out here from the survey records and the
// scene's own camera. Only the camera and the scene size are read from the page.
const bundle=JSON.parse(readFileSync(new URL('../../web/data.json',import.meta.url),'utf8'));
const features=bundle.geometry.features,points=bundle.survey.points;
const places=bundle.history.remembrance.places.filter(place=>place.category==='fatalities');
const path=features.find(feature=>feature.geometry.type==='LineString').geometry.coordinates;
const origin=[0,1].map(axis=>(Math.min(...path.map(point=>point[axis]))+Math.max(...path.map(point=>point[axis])))/2);
const painted=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

// Record the diamonds of a frame in the order they are painted: closed paths
// of four points, stroked 6 px across for a survey record, filled 12 px across
// at full strength for a fatality record, filled 16 px across for the selected
// survey record and stroked 22 px across for the selected fatality record.
async function watchScene(page){
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      const context=get.call(this,kind,...args);
      if(this.id!=='replay-scene'||kind!=='2d'||!context||context.marksWatched)return context;
      context.marksWatched=true;
      const {fillRect,beginPath,moveTo,lineTo,closePath,stroke,fill,fillText}=context;
      let outline=[],closed=false,order=0;
      const size=()=>Math.max(...outline.map(point=>point[0]))-Math.min(...outline.map(point=>point[0]));
      const middle=()=>[outline.reduce((sum,point)=>sum+point[0],0)/4,outline.reduce((sum,point)=>sum+point[1],0)/4,order++];
      const is=across=>Math.abs(size()-across)<.01;
      context.fillRect=function(...values){if(values[0]===0&&values[1]===0){order=0;window.marksFrame={survey:[],fatality:[],selected:[],outlined:[],center:null};}return fillRect.apply(this,values);};
      context.fillText=function(text,x,y,...rest){if(window.marksFrame&&text==='Center position')window.marksFrame.center={x,y,width:this.measureText(text).width};return fillText.call(this,text,x,y,...rest);};
      context.beginPath=function(){outline=[];closed=false;return beginPath.call(this);};
      context.moveTo=function(x,y){outline.push([x,y]);return moveTo.call(this,x,y);};
      context.lineTo=function(x,y){outline.push([x,y]);return lineTo.call(this,x,y);};
      context.closePath=function(){closed=true;return closePath.call(this);};
      context.stroke=function(...values){
        if(window.marksFrame&&closed&&outline.length===4&&!this.getLineDash().length){
          if(is(6))window.marksFrame.survey.push(middle());
          if(is(22))window.marksFrame.outlined.push(middle());
        }
        return stroke.apply(this,values);
      };
      context.fill=function(...values){
        if(window.marksFrame&&closed&&outline.length===4){
          if(is(12)&&this.globalAlpha===1)window.marksFrame.fatality.push(middle());
          if(is(16))window.marksFrame.selected.push(middle());
        }
        return fill.apply(this,values);
      };
      return context;
    };
  });
}
const sceneView=page=>page.evaluate(()=>{
  const rect=document.querySelector('#replay-scene').getBoundingClientRect(),value=id=>Number(document.querySelector(id).value);
  return {width:rect.width,height:rect.height,follow:document.querySelector('#replay-follow').checked,
    azimuth:value('#replay-azimuth'),elevation:value('#replay-elevation'),distance:value('#replay-distance'),
    seconds:value('#replay-time')};
});
// The records whose points project into the scene, in order across it.
async function expectedMarks(page){
  const view=await sceneView(page);
  assert.equal(view.follow,false,'The scene is not following, so its focus is the middle of the path.');
  const camera={azimuth:view.azimuth,elevation:view.elevation,distance:view.distance,focus:[0,0,0]};
  const marks=[];
  for(const [kind,records] of [['survey',points],['fatality',places]])for(const record of records){
    const p=sceneProject(localPoint(record.coordinates,origin),camera,view.width,view.height);
    if(p&&p.x>=0&&p.x<=view.width&&p.y>=0&&p.y<=view.height)marks.push({kind,id:record.id,x:p.x,y:p.y});
  }
  const key=mark=>mark.kind+':'+mark.id;
  return marks.sort((a,b)=>a.x-b.x||a.y-b.y||(key(a)<key(b)?-1:key(a)>key(b)?1:0));
}
// The scene is brought to rest in the middle of the viewport with one instant
// scroll before anything is pressed, and controls are worked from the keyboard.
// Nothing here asks the browser to scroll and press in the same step.
async function sceneBox(page){
  return page.evaluate(()=>new Promise(resolve=>{
    const scene=document.querySelector('#replay-scene');
    scene.scrollIntoView({behavior:'instant',block:'center'});
    let last=null,still=0;
    const frame=()=>{
      const rect=scene.getBoundingClientRect();
      still=last&&rect.x===last.x&&rect.y===last.y?still+1:0;last=rect;
      if(still>=3)resolve({x:rect.x,y:rect.y,width:rect.width,height:rect.height,scrollY});
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }));
}
async function pressScene(page,mark){
  const box=await sceneBox(page);
  await page.mouse.click(box.x+mark.x,box.y+mark.y);
  return box;
}
const ready=page=>page.waitForFunction(()=>!document.querySelector('#replay-time').disabled&&document.querySelector('#replay-scene').hasAttribute('data-survey-marks'));
async function open(page,query=''){
  await page.goto(base+'/reconstruction.html?event=el-reno-2013'+query);
  await page.locator('#replay-scene').waitFor();
  await ready(page);
  // Home restores the whole path, which also stops following the center.
  await page.locator('#replay-scene').focus();
  await page.keyboard.press('Home');
  await page.waitForFunction(()=>!document.querySelector('#replay-follow').checked);
  await painted(page);
}
const selected=(page,id)=>page.waitForFunction(id=>document.querySelector('#replay-scene').dataset.surveyRecord===id,String(id));
const close=(a,b)=>Math.abs(a[0]-b.x)<=1&&Math.abs(a[1]-b.y)<=1;
// Page boxes overlap when they share more than a pixel, which leaves room for
// a label whose measured size was rounded to whole pixels.
const overlap=(a,b,slack=1)=>!(a.x+slack>=b.x+b.width||a.x+a.width-slack<=b.x||a.y+slack>=b.y+b.height||a.y+a.height-slack<=b.y);
const within=(mark,box)=>mark.x>box.x+1&&mark.x<box.x+box.width-1&&mark.y>box.y+1&&mark.y<box.y+box.height-1;
const fatalityText=place=>`◆ ${place.map_label}: ${place.deaths} deaths. ${place.label}.`;

for(const width of [390,1280]){
  test(`every survey record in view is a mark and a fatality record has its symbol and its words at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await watchScene(page);
    await open(page);
    for(const distance of [null,12]){
      if(distance!==null){
        await page.locator('#replay-distance').fill(String(distance));
        await painted(page);await painted(page);
      }
      const expected=await expectedMarks(page),survey=expected.filter(mark=>mark.kind==='survey'),fatal=expected.filter(mark=>mark.kind==='fatality');
      const frame=await page.evaluate(()=>window.marksFrame),scene=page.locator('#replay-scene');
      assert.ok(survey.length>20,`${survey.length} survey records are in view.`);
      if(distance===null)assert.equal(survey.length,points.length,'The whole path view holds every survey record.');
      else assert.ok(survey.length<points.length,'A closer view holds fewer records.');
      assert.equal(frame.survey.length,survey.length,'One small diamond for each survey record in view.');
      assert.equal(await scene.getAttribute('data-survey-marks'),String(survey.length));
      // Each painted diamond sits on a record, and each record has one.
      for(const mark of survey)assert.ok(frame.survey.some(point=>close(point,mark)),`Survey record ${mark.id} has its mark.`);
      for(const point of frame.survey)assert.ok(survey.some(mark=>close(point,mark)),`The diamond at ${point} stands on a survey record.`);
      assert.equal(frame.fatality.length,fatal.length);
      assert.equal(await scene.getAttribute('data-fatality-marks'),String(fatal.length));
      const covered=Number(await scene.getAttribute('data-marks-covered'));
      for(const place of places){
        const mark=fatal.find(item=>item.id===place.id),label=page.locator(`.replay-fatality-label[data-fatality="${place.id}"]`);
        assert.equal(await label.isVisible(),Boolean(mark),'The written label shows exactly while its diamond does.');
        if(!mark)continue;
        assert.ok(frame.fatality.some(point=>close(point,mark)),`Fatality record ${mark.id} has its diamond.`);
        // The fatality diamond is painted after every small mark, so none lies over it.
        assert.ok(frame.fatality.every(point=>frame.survey.every(other=>other[2]<point[2])));
        // The symbol and the written words together, in the record's own terms.
        assert.equal((await label.textContent()).trim(),fatalityText(place));
        const box=await label.boundingBox(),frameBox=await scene.boundingBox();
        assert.ok(box.x>=frameBox.x&&box.x+box.width<=frameBox.x+frameBox.width&&box.y>=frameBox.y&&box.y+box.height<=frameBox.y+frameBox.height,'The label stays inside the scene.');
        assert.ok(box.width<=Math.min(frameBox.width-16,240),`The label is a compact block, ${box.width.toFixed(0)} px wide.`);
        const at={x:frameBox.x+mark.x,y:frameBox.y+mark.y};
        assert.equal(overlap(box,{x:at.x-6,y:at.y-6,width:12,height:12}),false,'The label leaves its diamond uncovered.');
        const reach=Math.hypot(Math.max(box.x-at.x,0,at.x-(box.x+box.width)),Math.max(box.y-at.y,0,at.y-(box.y+box.height)));
        assert.ok(reach<=80,`The label sits by its diamond, ${reach.toFixed(1)} px away.`);
        // What the label hides is counted and said. At the whole path it hides nothing.
        const hidden=survey.filter(other=>within({x:frameBox.x+other.x,y:frameBox.y+other.y},box)).length;
        assert.ok(Math.abs(hidden-covered)<=1,`${hidden} marks lie under the label and the scene reports ${covered}.`);
        if(distance===null)assert.equal(covered,0,'At the whole path the label covers no mark.');
      }
      const count=(await page.locator('#replay-marks-count').textContent()).trim();
      const counted=[`${survey.length} NWS survey records`,fatal.length?`${fatal.length} fatality ${fatal.length===1?'record':'records'}`:''].filter(Boolean).join(' and ');
      assert.ok(count.startsWith(`${counted} are marked in this view. A mark is a recorded location. It shows no rating and no time.`),count);
      assert.equal(/The fatality label covers \d+ of them here\./.test(count),covered>0,count);
      if(covered)assert.ok(count.includes(`The fatality label covers ${covered} of them here.`),count);
    }
    assert.equal(places.length,1);
    assert.match(places[0].label,/Approximate vehicle recovery location/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  });
}

test('a press on a mark and a key press on a ringed mark each select that record in the inspector',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900}});
  await watchScene(page);
  await open(page);
  const scene=page.locator('#replay-scene'),expected=await expectedMarks(page);
  assert.equal(await scene.getAttribute('data-survey-record'),'');
  assert.equal(await page.locator('#replay-damage').evaluate(node=>node.open),false);
  // By pointer: the survey record that stands farthest from every other mark.
  // It has no photograph, so the inspector's opening filter would hide it.
  const apart=mark=>Math.min(...expected.filter(other=>other!==mark).map(other=>Math.hypot(other.x-mark.x,other.y-mark.y)));
  const lone=expected.filter(mark=>mark.kind==='survey'&&!bundle.survey_media.photos[String(mark.id)]?.length).sort((a,b)=>apart(b)-apart(a))[0];
  assert.ok(apart(lone)>4,`Record ${lone.id} has ${apart(lone).toFixed(1)} px to itself.`);
  const pressed=await pressScene(page,lone);
  await page.waitForFunction(id=>document.querySelector('#replay-scene').dataset.surveyRecord===id&&document.querySelector('#replay-damage').open,String(lone.id));
  assert.equal(await page.locator('#survey-observation').inputValue(),String(lone.id));
  assert.equal(await page.locator('#survey-photos-only').isChecked(),false,'The filter that would hide the record is cleared.');
  assert.match(await page.locator('#replay-damage-status').textContent(),new RegExp(`NWS survey record ${lone.id},`));
  assert.equal(new URL(page.url()).searchParams.get('survey'),String(lone.id));
  // The visitor stays in the scene: the page has not scrolled.
  assert.equal(await page.evaluate(()=>scrollY),pressed.scrollY);
  // A press on empty ground selects nothing new.
  const corner=await sceneBox(page);
  await page.mouse.click(corner.x+corner.width-6,corner.y+6);
  await painted(page);
  assert.equal(await scene.getAttribute('data-survey-record'),String(lone.id));
  // By keyboard: period moves a ring from the left, comma moves it back and
  // Enter selects the ringed record. The keys that scroll the page are left alone.
  await scene.focus();
  const status=page.locator('#replay-mark-status');
  assert.equal(await status.textContent(),'');
  assert.equal(await status.evaluate(node=>node.hidden),false,'The live region is in the page before it has anything to say.');
  for(let step=0;step<3;step++){
    await page.keyboard.press('.');
    await page.waitForFunction(key=>document.querySelector('#replay-scene').dataset.markCursor===key,expected[step].kind+':'+expected[step].id);
  }
  const third=expected[2];
  assert.equal(third.kind,'survey');
  await page.waitForFunction(id=>document.querySelector('#replay-mark-status').textContent.startsWith(`Ring: NWS survey record ${id},`),third.id);
  assert.match(await status.textContent(),new RegExp(`^Ring: NWS survey record ${third.id}, .*\\. Enter selects it\\.$`));
  await page.keyboard.press(',');
  await page.waitForFunction(key=>document.querySelector('#replay-scene').dataset.markCursor===key,'survey:'+expected[1].id);
  const before=await page.evaluate(()=>scrollY);
  await page.keyboard.press('Enter');
  await selected(page,expected[1].id);
  assert.equal(await page.locator('#survey-observation').inputValue(),String(expected[1].id));
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'replay-scene','The scene keeps focus, so the next key steps on.');
  assert.equal(await page.evaluate(()=>scrollY),before);
  assert.equal(await scene.getAttribute('data-mark-cursor'),'survey:'+expected[1].id);
  await page.keyboard.press('PageDown');
  await painted(page);
  assert.equal(await scene.getAttribute('data-mark-cursor'),'survey:'+expected[1].id,'Page Down is not taken from the page.');
  // Escape puts the ring away.
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.markCursor==='');
  await page.waitForFunction(()=>document.querySelector('#replay-mark-status').textContent==='');
  // Back returns to the record selected before, in the inspector and in the scene.
  await page.goBack();
  await selected(page,lone.id);
  assert.equal(await page.locator('#survey-observation').inputValue(),String(lone.id));
});

test('records that share a place take turns, and the fatality record is selected by its diamond or its words',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900}});
  await watchScene(page);
  await open(page);
  const scene=page.locator('#replay-scene'),expected=await expectedMarks(page);
  // Records 589148 and 589149 have the same coordinates, and others stand within a pixel or two.
  const twin=expected.find(mark=>mark.id===589148),cluster=expected.filter(mark=>mark.kind==='survey'&&Math.hypot(mark.x-twin.x,mark.y-twin.y)<=3).map(mark=>String(mark.id));
  assert.ok(cluster.includes('589149')&&cluster.length>=2);
  const turns=[];
  for(let press=0;press<3;press++){
    await pressScene(page,twin);
    await page.waitForFunction(seen=>{const now=document.querySelector('#replay-scene').dataset.surveyRecord;return now!==''&&now!==seen;},turns.at(-1)??'');
    turns.push(await scene.getAttribute('data-survey-record'));
  }
  assert.ok(turns.every(id=>cluster.includes(id)),`Each press selects a record at that place: ${turns}.`);
  assert.equal(new Set(turns.slice(0,2)).size,2,'A second press moves to another record of the place.');
  // The fatality record by its diamond.
  const fatal=expected.find(mark=>mark.kind==='fatality'),place=places.find(item=>item.id===fatal.id);
  const fatalityStatus=page.locator('#replay-fatality-status');
  assert.equal(await fatalityStatus.isVisible(),false);
  await pressScene(page,fatal);
  await page.waitForFunction(id=>document.querySelector('#survey-observation').value==='fatality:'+id,fatal.id);
  assert.equal(new URL(page.url()).searchParams.get('fatality'),fatal.id);
  await fatalityStatus.waitFor();
  assert.equal((await fatalityStatus.textContent()).trim(),
    `Outlined filled diamond: ${place.title}, ${place.deaths} deaths. ${place.label}. ${place.time_note} Inspect its record below.`);
  assert.equal(await page.locator('#replay-damage-status').isVisible(),false);
  await painted(page);
  const outlined=await page.evaluate(()=>window.marksFrame.outlined);
  assert.equal(outlined.length,1);assert.ok(close(outlined[0],fatal),'The selected fatality record has its second outline.');
  // Then a survey record again, and the fatality record by its written label.
  await pressScene(page,twin);
  await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord!=='');
  await page.waitForFunction(()=>document.querySelector('#replay-fatality-status').hidden);
  const box=await sceneBox(page),label=await page.locator('.replay-fatality-label').boundingBox();
  assert.ok(Math.hypot(label.x+label.width/2-(box.x+fatal.x),label.y+label.height/2-(box.y+fatal.y))>12,'The middle of the label is out of reach of the diamond.');
  await page.mouse.click(label.x+label.width/2,label.y+label.height/2);
  await page.waitForFunction(id=>document.querySelector('#survey-observation').value==='fatality:'+id,fatal.id);
  // With its diamond outside the view the status says so and the label is put away.
  await page.locator('#replay-distance').fill('3');
  await page.waitForFunction(()=>document.querySelector('#replay-fatality-status').textContent.startsWith('Selected fatality record:'));
  assert.equal((await fatalityStatus.textContent()).trim(),
    `Selected fatality record: ${place.title}, ${place.deaths} deaths. ${place.label}. ${place.time_note} Its diamond is outside this view. Whole path restores the overview. Inspect its record below.`);
  assert.equal(await page.locator('.replay-fatality-label').isVisible(),false);
  assert.equal((await page.locator('#replay-marks-count').textContent()).trim(),'No survey record is in this view. Whole path restores the overview.');
});

test('the caption counts the marks a label covers',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900}});
  await watchScene(page);
  await open(page);
  const scene=page.locator('#replay-scene');
  assert.equal(await scene.getAttribute('data-marks-covered'),'0');
  // A label made as wide as the scene and 300 px tall has no place that misses the path.
  await page.addStyleTag({content:'.replay-fatality-label{max-width:none!important;width:calc(100% - 16px)!important;height:300px!important;box-sizing:border-box!important}'});
  await page.waitForFunction(()=>Number(document.querySelector('#replay-scene').dataset.marksCovered)>0);
  await painted(page);await painted(page);
  const covered=Number(await scene.getAttribute('data-marks-covered'));
  const survey=(await expectedMarks(page)).filter(mark=>mark.kind==='survey'),box=await page.locator('.replay-fatality-label').boundingBox(),frameBox=await scene.boundingBox();
  const inside=grow=>survey.filter(mark=>{const x=frameBox.x+mark.x,y=frameBox.y+mark.y;return x>box.x-grow&&x<box.x+box.width+grow&&y>box.y-grow&&y<box.y+box.height+grow;}).length;
  assert.ok(covered>10,`${covered} marks are under the label.`);
  assert.ok(inside(-1.5)<=covered&&covered<=inside(1.5),`${covered} reported, between ${inside(-1.5)} and ${inside(1.5)} by this count.`);
  const count=(await page.locator('#replay-marks-count').textContent()).trim();
  assert.ok(count.includes(`It shows no rating and no time. The fatality label covers ${covered} of them here. Turning or zooming the scene uncovers them. Press one`),count);
  assert.equal(await scene.getAttribute('data-survey-marks'),String(points.length),'Every record is still counted as marked.');
});

test('a selected survey record beside the fatality record leaves its diamond in place',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  await watchScene(page);
  // Record 165661 has a photograph, so a shared link can open on it. At the
  // whole path it stands within a pixel or two of the fatality record.
  await open(page,'&survey=165661');
  await selected(page,165661);
  await painted(page);
  const expected=await expectedMarks(page),fatal=expected.find(mark=>mark.kind==='fatality'),beside=expected.find(mark=>mark.id===165661);
  assert.ok(Math.hypot(beside.x-fatal.x,beside.y-fatal.y)<3,'The two points nearly coincide in this view.');
  const frame=await page.evaluate(()=>window.marksFrame);
  assert.equal(frame.selected.length,1);assert.equal(frame.fatality.length,1);
  assert.ok(close(frame.fatality[0],fatal));
  assert.ok(frame.fatality[0][2]>frame.selected[0][2],'The fatality diamond is painted after the filled outline of the selected record.');
  assert.equal(await page.locator('.replay-fatality-label').isVisible(),true);
});

test('a drag across a mark turns the scene and selects nothing',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900}});
  await watchScene(page);
  await open(page);
  const scene=page.locator('#replay-scene'),expected=await expectedMarks(page),box=await sceneBox(page);
  const apart=mark=>Math.min(...expected.filter(other=>other!==mark).map(other=>Math.hypot(other.x-mark.x,other.y-mark.y)));
  const mark=expected.filter(item=>item.kind==='survey').sort((a,b)=>apart(b)-apart(a))[0],before=(await sceneView(page)).azimuth;
  // Out and back: the pointer comes up where it went down, on the mark, with the scene as it was.
  await page.mouse.move(box.x+mark.x,box.y+mark.y);
  await page.mouse.down();
  await page.mouse.move(box.x+mark.x+60,box.y+mark.y,{steps:4});
  await painted(page);
  assert.notEqual((await sceneView(page)).azimuth,before,'The drag turned the scene.');
  await page.mouse.move(box.x+mark.x,box.y+mark.y,{steps:4});
  await painted(page);
  await page.mouse.up();
  await painted(page);
  assert.equal(await scene.getAttribute('data-survey-record'),'');
  assert.equal(await page.locator('#replay-damage').evaluate(node=>node.open),false);
  // The same press without the drag does select it.
  await page.mouse.click(box.x+mark.x,box.y+mark.y);
  await selected(page,mark.id);
});

test('photograph mode keeps the marks out of the scene and the path view brings them back',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900}});
  await watchScene(page);
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=397&appearance_view=photo&appearance_photo=nolte-reported-stills');
  await ready(page);
  await painted(page);
  const scene=page.locator('#replay-scene');
  assert.equal(await scene.getAttribute('data-survey-marks'),'0');
  assert.equal(await scene.getAttribute('data-fatality-marks'),'0');
  assert.deepEqual(await page.evaluate(()=>[window.marksFrame.survey.length,window.marksFrame.fatality.length]),[0,0]);
  assert.equal(await page.locator('#replay-marks-count').isVisible(),false);
  assert.equal(await page.locator('.replay-fatality-label').isVisible(),false);
  await scene.focus();
  await page.keyboard.press('.');
  await painted(page);
  assert.equal(await scene.getAttribute('data-mark-cursor'),'','No ring where there are no marks.');
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=397');
  await ready(page);
  await page.waitForFunction(()=>Number(document.querySelector('#replay-scene').dataset.surveyMarks)>0);
  assert.equal(await page.locator('#replay-marks-count').isVisible(),true);
  assert.match(await page.locator('#replay-marks-count').textContent(),/are marked in this view/);
  // Changing the mode in place empties the caption as well as hiding it,
  // because the scene is still described by it.
  await page.locator('#replay-appearance-mode').selectOption('photo:nolte-reported-stills');
  await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyMarks==='0');
  await painted(page);
  assert.equal(await page.locator('#replay-marks-count').isVisible(),false);
  assert.equal(await page.locator('#replay-marks-count').textContent(),'');
  assert.match(await scene.getAttribute('aria-describedby'),/replay-marks-count/);
});

// The center passes within about 140 m of the fatality record, and the first
// reported width period begins ten seconds later. At those clocks the funnel
// label, the width tag, the center text and the fatality label share a small
// part of the scene.
for(const width of [390,1280]){
  test(`the fatality label stays off the funnel label, the width tag and the center text as the center passes at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await watchScene(page);
    const positions=preparePositions(features.filter(feature=>feature.geometry.type==='Point'));
    const duration=(positions.at(-1).stamp-positions[0].stamp)/1000,place=places[0];
    const away=seconds=>{const at=positionAt(positions,seconds).coordinates,[x,y]=localPoint(place.coordinates,at);return Math.hypot(x,y);};
    let nearest=0;
    for(let seconds=0;seconds<=duration;seconds++)if(away(seconds)<away(nearest))nearest=seconds;
    assert.ok(away(nearest)<.5,`The center passes ${away(nearest).toFixed(2)} km from the record at ${nearest} s.`);
    await page.goto(base+'/reconstruction.html?event=el-reno-2013&t='+nearest);
    await ready(page);
    assert.equal(await page.locator('#replay-follow').isChecked(),true);
    const label=page.locator('.replay-fatality-label'),funnel=page.locator('#replay-funnel-label'),tag=page.locator('#replay-width-label'),scene=page.locator('#replay-scene');
    let withFunnel=0,withTag=0,withCenter=0;
    for(const azimuth of [0,40])for(const seconds of [nearest-20,nearest,nearest+12,nearest+16,nearest+28,nearest+34])for(const distance of [3,6,12]){
      await page.locator('#replay-azimuth').fill(String(azimuth));
      await page.locator('#replay-time').fill(String(seconds));
      await page.locator('#replay-distance').fill(String(distance));
      await painted(page);await painted(page);
      if(!await label.isVisible())continue;
      const box=await label.boundingBox(),frameBox=await scene.boundingBox(),where=`at ${seconds} s, ${distance} km and ${azimuth} degrees`;
      assert.ok(box.x>=frameBox.x&&box.x+box.width<=frameBox.x+frameBox.width&&box.y>=frameBox.y&&box.y+box.height<=frameBox.y+frameBox.height,`The label stays inside the scene ${where}.`);
      const diamond=(await page.evaluate(()=>window.marksFrame.fatality))[0];
      assert.equal(overlap(box,{x:frameBox.x+diamond[0]-6,y:frameBox.y+diamond[1]-6,width:12,height:12}),false,`The label leaves its diamond uncovered ${where}.`);
      if(await funnel.isVisible()){withFunnel++;assert.equal(overlap(box,await funnel.boundingBox()),false,`The label is off the funnel label ${where}.`);}
      if(await tag.isVisible()){withTag++;assert.equal(overlap(box,await tag.boundingBox()),false,`The label is off the width tag ${where}.`);}
      const center=await page.evaluate(()=>window.marksFrame.center);
      if(center){withCenter++;assert.equal(overlap(box,{x:frameBox.x+center.x,y:frameBox.y+center.y-10,width:center.width,height:14}),false,`The label is off the center text ${where}.`);}
      const reach=Math.hypot(Math.max(box.x-(frameBox.x+diamond[0]),0,frameBox.x+diamond[0]-(box.x+box.width)),Math.max(box.y-(frameBox.y+diamond[1]),0,frameBox.y+diamond[1]-(box.y+box.height)));
      assert.ok(reach<=80,`The label sits by its diamond, ${reach.toFixed(1)} px away ${where}.`);
    }
    assert.ok(withFunnel>=6,`The funnel label and the fatality label were both in view ${withFunnel} times.`);
    assert.ok(withTag>=2,`The width tag and the fatality label were both in view ${withTag} times.`);
    assert.ok(withCenter>=6,`The center text and the fatality label were both in view ${withCenter} times.`);
  });
}
