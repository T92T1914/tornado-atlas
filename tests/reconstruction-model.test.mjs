import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preparePositions,positionAt} from '../web/playback-model.mjs';
import {frameAt} from '../web/timeline-media-model.mjs';
import {localPoint,sceneProject,initialSeconds,replaySeconds,replayURL,funnelGlyph,replayFunnel,REPLAY_FUNNEL,centerLabelX,sceneMarks,markAt,markStack,markLabelPlace,FATALITY_MARK_HALF,MARK_LABEL_REACH} from '../web/reconstruction-model.mjs';
import {funnelVolumeFragment} from '../web/funnel-simulation-model.mjs';
import {formationAt} from '../web/formation-model.mjs';

test('geographic stage keeps longitude east and latitude north, in kilometers',()=>{
  assert.deepEqual(localPoint([-98,35],[-98,35]),[0,0,0]);
  const east=localPoint([-97,35],[-98,35]),north=localPoint([-98,36],[-98,35]);
  assert.ok(east[0]>90&&east[0]<92);assert.equal(east[1],0);
  assert.equal(north[0],0);assert.equal(north[1],111.195);
});
test('perspective places the focus centrally and turns east and north consistently',()=>{
  const camera={azimuth:0,elevation:45,distance:20,focus:[0,0,0]};
  const center=sceneProject([0,0,0],camera,800,500);
  assert.equal(center.x,400);assert.equal(center.y,250);
  assert.ok(sceneProject([1,0,0],camera,800,500).x>400);
  assert.ok(sceneProject([0,1,0],camera,800,500).y<250);
  assert.equal(sceneProject([0,-100,100],camera,800,500),null);
  assert.throws(()=>sceneProject([0,0,0],{...camera,distance:0},800,500));
});
test('shared links cannot seek outside the documented historical window',()=>{
  for(const q of ['','?t=bad','?t=Infinity','?t=-1','?t='])assert.equal(initialSeconds(q,2280),0);
  assert.equal(initialSeconds('?t=58',2280),58);
  assert.equal(initialSeconds('?t=999999',2280),2280);
});

const historyStart=Date.parse('2013-05-31T23:04:00Z');
const historyAnchors=[{id:'source-moment',utc:'2013-05-31T23:17:03Z'}];

test('a linked moment keeps its source when an explicit source conflicts',()=>{
  const anchors=[{...historyAnchors[0],source_id:'a'},{...historyAnchors[0],id:'b-moment',source_id:'b'}];
  const url=replayURL('https://example.test/reconstruction.html?footage=source-moment&footage_source=b','el-reno-2013',783,anchors,historyStart);
  assert.equal(url.searchParams.get('footage'),'source-moment');
  assert.equal(url.searchParams.get('footage_source'),'a');
  assert.equal(replaySeconds(url.search,2280,anchors,historyStart),783);
  const gap=replayURL(url.href,'el-reno-2013',782,anchors,historyStart);
  assert.equal(gap.searchParams.get('footage'),null);
  assert.equal(gap.searchParams.get('footage_source'),'a');
  const directGap=replayURL('https://example.test/reconstruction.html?footage=b-moment','el-reno-2013',782,anchors,historyStart);
  assert.equal(directGap.searchParams.get('footage'),null);
  assert.equal(directGap.searchParams.get('footage_source'),'b');
});
test('replay URL preserves supported fractional historical times',()=>{
  const url=replayURL('https://example.test/reconstruction.html','el-reno-2013',58.25,historyAnchors,historyStart);
  assert.equal(replaySeconds(url.search,2280,historyAnchors,historyStart),58.25);
});
test('a fractional time within a printed source second is not rewritten as its exact anchor',()=>{
  const url=replayURL('https://example.test/reconstruction.html?footage=source-moment#registered-footage','el-reno-2013',783.25,historyAnchors,historyStart);
  assert.equal(url.searchParams.has('footage'),false);
  assert.equal(replaySeconds(url.search,2280,historyAnchors,historyStart),783.25);
});
test('legacy footage links retain precedence without letting unknown IDs assign a time',()=>{
  assert.equal(replaySeconds('?t=338&footage=source-moment',2280,historyAnchors,historyStart),783);
  assert.equal(replaySeconds('?t=58.25&footage=unknown',2280,historyAnchors,historyStart),58.25);
  for(const [query,expected] of [['?t=-8',0],['?t=Infinity',0],['?t=9000',2280]]){
    assert.equal(replaySeconds(query,2280,historyAnchors,historyStart),expected);
  }
});
test('new replay URLs only identify exact checked moments and preserve unrelated context',()=>{
  const href='https://example.test/reconstruction.html?event=old&footage=source-moment&context=kept#registered-footage';
  for(const seconds of [0,58.25,782.999,783,783.25,784,2280]){
    const url=replayURL(href,'el-reno-2013',seconds,historyAnchors,historyStart);
    assert.equal(url.searchParams.get('event'),'el-reno-2013');
    assert.equal(url.searchParams.get('context'),'kept');
    assert.equal(url.searchParams.get('footage'),seconds===783?'source-moment':null);
    assert.equal(url.hash,seconds===783?'#registered-footage':'');
    assert.equal(replaySeconds(url.search,2280,historyAnchors,historyStart),seconds);
  }
  assert.equal(replayURL(href,'el-reno-2013',783,[],historyStart).searchParams.has('footage'),false);
});
const scale=REPLAY_FUNNEL.columnKilometers/REPLAY_FUNNEL.columnUnits;
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const mean=(ring,axis)=>ring.points.reduce((sum,point)=>sum+point[axis],0)/ring.points.length;

test('the replay funnel is fixed artwork that stands on the point it is given',()=>{
  const funnel=replayFunnel();
  assert.equal(replayFunnel(),funnel);
  assert.deepEqual(funnel.base,[0,0,0]);
  assert.ok(Object.isFrozen(funnel)&&Object.isFrozen(funnel.rings)&&funnel.rings.every(ring=>Object.isFrozen(ring)&&Object.isFrozen(ring.points)));
  assert.ok(funnel.rings.flatMap(ring=>ring.points).flat().every(Number.isFinite));
  // The lowest ring lies on the ground and is centered on the base.
  const foot=funnel.rings[0];
  assert.equal(foot.part,'body');assert.equal(foot.weight,1);
  assert.ok(foot.points.every(point=>point[2]===0));
  assert.ok(Math.abs(mean(foot,0))<1e-12&&Math.abs(mean(foot,1))<1e-12);
  // A coarser drawing keeps the same foot, so resolution changes no size.
  assert.deepEqual(replayFunnel(20,12).rings[0].points[0],foot.points[0]);
  for(const bad of [[4],[400],[40,4],[40,1000],[NaN],[12.5]])assert.throws(()=>replayFunnel(...bad),RangeError);
  // The replay asks for the drawing once and passes it nothing, so no rating,
  // width record or path envelope can reach its size or shape. It no longer
  // draws the particle symbol.
  const page=readFileSync(new URL('../web/reconstruction.js',import.meta.url),'utf8');
  assert.match(page,/const funnel=replayFunnel\(\);/);
  assert.equal(page.match(/replayFunnel\(/g).length,1);
  assert.doesNotMatch(page,/funnelGlyph/);
});

test('the retained particle symbol stays deterministic for the pinned earlier replay script',()=>{
  const before=funnelGlyph(12);funnelGlyph(99);
  assert.deepEqual(funnelGlyph(12),before);assert.equal(before.length,480);
  assert.ok(before.flat().every(Number.isFinite));
  assert.throws(()=>funnelGlyph(0,1000000));assert.throws(()=>funnelGlyph(NaN));
});

test('the replay funnel widens into a lowered cloud base and ends inside it',()=>{
  const F=REPLAY_FUNNEL,funnel=replayFunnel();
  const body=funnel.rings.filter(ring=>ring.part==='body'),cloud=funnel.rings.filter(ring=>ring.part==='cloud-base');
  assert.equal(body.length,40);assert.equal(cloud.length,12);
  assert.equal(body.length+cloud.length,funnel.rings.length);
  const halfWidth=ring=>(Math.max(...ring.points.map(point=>point[0]))-Math.min(...ring.points.map(point=>point[0])))/2;
  // Narrow at the ground, wider with every step up to the end of the flare.
  const rising=body.filter(ring=>ring.points[0][2]<=F.columnKilometers*F.flareTo);
  for(let i=1;i<rising.length;i++)assert.ok(halfWidth(rising[i])>halfWidth(rising[i-1]),`level ${i}`);
  assert.ok(halfWidth(rising.at(-1))>2*halfWidth(body[0]));
  // The body only thins out above the lowest cloud disc, so its top is in cloud.
  const lowestCloud=Math.max(...cloud[0].points.map(point=>point[2]));
  for(const ring of body)if(ring.weight<1)assert.ok(ring.points[0][2]>lowestCloud);
  assert.ok(body.some(ring=>ring.weight<1&&ring.weight>0));
  // The cloud discs start between the lowered base and the wider layer, rise
  // outward to that layer, grow in radius and together carry the cover once.
  assert.ok(Math.abs(cloud.reduce((sum,ring)=>sum+ring.weight,0)-1)<1e-12);
  for(const ring of cloud)assert.ok(ring.weight>0);
  assert.ok(Math.min(...cloud[0].points.map(point=>point[2]))>F.loweredBase*scale);
  assert.ok(lowestCloud<F.columnKilometers*F.fadeFrom);
  for(let i=1;i<cloud.length;i++){
    assert.ok(mean(cloud[i],2)>mean(cloud[i-1],2),`disc ${i} height`);
    assert.ok(halfWidth(cloud[i])>halfWidth(cloud[i-1]),`disc ${i} radius`);
  }
  assert.ok(Math.abs(mean(cloud.at(-1),2)-F.wideBase*scale)<.02*scale);
  // The column is drawn at the stated height and the whole drawing stays near 1 km.
  const top=Math.max(...funnel.rings.flatMap(ring=>ring.points.map(point=>point[2])));
  assert.ok(top>F.columnKilometers&&top<1.05,`top at ${top} km`);
  // The filled cover is wider than the body where the body meets the lowered
  // base, and the whole cover is wider than the flared top.
  const meeting=body.filter(ring=>ring.points[0][2]<=F.loweredBase*scale).at(-1);
  assert.ok(halfWidth(cloud[0])>halfWidth(meeting));
  assert.ok(halfWidth(cloud.at(-1))>Math.max(...body.map(halfWidth)));
});

test('the replay funnel follows the storm-v3 shader of the form study',()=>{
  const number=pattern=>{const match=funnelVolumeFragment.match(pattern);assert.ok(match,String(pattern));return match.slice(1).map(Number);};
  const [columnUnits]=number(/float stormBody\(vec3 p,vec3 shape,float t,float ex\)\{\n\s*float h=p\.y\/([\d.]+);/);
  const [flare,flareFrom,flareTo]=number(/radius\*=1\.0\+([\d.]+)\*smoothstep\(([\d.]+),([\d.]+),h\);/);
  const [fadeFrom,fadeTo]=number(/\n\s*ends=smoothstep\(1\.0-ex-\.02,1\.0-ex\+\.045,h\)\*\(1\.0-smoothstep\(([\d.]+),([\d.]+),h\)\);/);
  const [joinRadius]=number(/return length\(q\)\/\(([\d.]+)\*referenceRadius\(1\.0,shape\)\);/);
  const [wideBase,wideDip,loweredBase]=number(/float base=([\d.]+)-([\d.]+)\*exp\(-dot\(local,local\)\)\+\.64\*\(broad-\.5\)\+\.28\*\(folded-\.5\);\n\s*float lowered=([\d.]+)\+/);
  const [baseInner,baseOuter]=number(/return mix\(min\(lowered,base\),base,smoothstep\(([\d.]+),([\d.]+),stormJoin\)\);/);
  const [coverInner,coverOuter]=number(/cover=mix\(max\(cover,\.92\+\.20\*\(detail-\.5\)\),cover,smoothstep\(([\d.]+),([\d.]+),stormJoin\)\);/);
  const wideScale=number(/float stormCloudHeight\(vec2 q\)\{\n\s*vec2 local=q\/vec2\(([\d.]+),([\d.]+)\);/);
  assert.deepEqual({...REPLAY_FUNNEL,wideScale:[...REPLAY_FUNNEL.wideScale]},{presentation:'storm-v3',stageSeconds:15,columnUnits,columnKilometers:.85,
    flare,flareFrom,flareTo,fadeFrom,fadeTo,joinRadius,loweredBase,baseInner,baseOuter,coverInner,coverOuter,wideBase,wideDip,wideScale});
  // The radius, axis and section are read from the shader as written, so a
  // change to any of them fails here before the two drawings drift apart.
  for(const piece of ['return vec2(.09*h+.11*h*(1.0-h)*sin(.21*t)+.55*s.z*h*h,','-.10*h+.13*h*(1.0-h)*cos(.17*t));',
    'return vec2(1.10+.06*sin(2.0*h-.13*t),.88+.05*cos(2.7*h+.11*t));','return .62+.95*s.x+.24*smoothstep(.05,.95,h)+.10*h;',
    'radius=referenceRadius(h,shape)*(.82+.42*h*h);','vec2 q=(xz-referenceAxis(1.0,shape,time))/referenceSection(1.0,time);'])
    assert.ok(funnelVolumeFragment.includes(piece),piece);
  const stage=formationAt(REPLAY_FUNNEL.stageSeconds);
  assert.equal(stage.stage,'A developed illustrative tornado');
  const body=replayFunnel().rings.filter(ring=>ring.part==='body');
  body.forEach((ring,level)=>{
    const h=level/body.length*fadeTo,points=ring.points,opposite=points[points.length/2];
    const radius=(.62+.95*stage.shape.base+.24*smooth(.05,.95,h)+.10*h)*(.82+.42*h*h)*(1+flare*smooth(flareFrom,flareTo,h));
    // The first point lies east of the axis, the quarter point north of it and
    // the middle one west of it. At the shader clock's zero the sine sway of
    // the axis is zero and its cosine sway is at full value.
    const axis=[.09*h+.55*stage.shape.bend*h*h,-.10*h+.13*h*(1-h)],section=[1.10+.06*Math.sin(2*h),.88+.05*Math.cos(2.7*h)];
    assert.ok(Math.abs(points[0][0]-(axis[0]+radius*section[0])*scale)<1e-12,`east edge at level ${level}`);
    assert.ok(Math.abs(opposite[0]-(axis[0]-radius*section[0])*scale)<1e-12,`west edge at level ${level}`);
    assert.ok(Math.abs(points[0][1]-axis[1]*scale)<1e-12,`north offset at level ${level}`);
    assert.ok(Math.abs(points[points.length/4][1]-(axis[1]+radius*section[1])*scale)<1e-12,`north edge at level ${level}`);
    assert.ok(Math.abs(points[0][2]-columnUnits*h*scale)<1e-12,`height at level ${level}`);
    assert.ok(Math.abs(ring.weight-(1-smooth(fadeFrom,fadeTo,h)))<1e-12,`weight at level ${level}`);
  });
  // The cloud discs share the footprint of the funnel top: its axis, its
  // section and the join radius times the top radius of the reference form.
  const cloud=replayFunnel().rings.filter(ring=>ring.part==='cloud-base');
  const topAxis=[.09+.55*stage.shape.bend,-.10],topSection=[1.10+.06*Math.sin(2),.88+.05*Math.cos(2.7)];
  const unit=joinRadius*(.62+.95*stage.shape.base+.24+.10);
  cloud.forEach((ring,disc)=>{
    const distance=coverInner+(coverOuter-coverInner)*disc/cloud.length,points=ring.points;
    const east=topAxis[0]+distance*unit*topSection[0],north=topAxis[1]+distance*unit*topSection[1];
    assert.ok(Math.abs(points[0][0]-east*scale)<1e-12,`east edge of disc ${disc}`);
    assert.ok(Math.abs(points[points.length/4][1]-north*scale)<1e-12,`north edge of disc ${disc}`);
    // The rim height is the shader's base height with its noise at the mean.
    const wide=wideBase-wideDip*Math.exp(-((east/wideScale[0])**2+(topAxis[1]/wideScale[1])**2));
    const rise=smooth(baseInner,baseOuter,distance);
    assert.ok(Math.abs(points[0][2]-(Math.min(loweredBase,wide)*(1-rise)+wide*rise)*scale)<1e-12,`east rim height of disc ${disc}`);
  });
});

test('checked-in exhibit supplies the documented scene and bounded radar interval',()=>{
  const data=JSON.parse(readFileSync(new URL('../web/data.json',import.meta.url),'utf8'));
  const points=preparePositions(data.geometry.features.filter(f=>f.geometry.type==='Point'));
  assert.equal(points.length,39);
  const duration=(points.at(-1).stamp-points[0].stamp)/1000;
  assert.equal(duration,2280);
  assert.equal(positionAt(points,960).published,true);
  assert.equal(positionAt(points,960.5).published,false);
  for(let seconds=0;seconds<=duration;seconds+=30){
    const position=positionAt(points,seconds);
    const radar=frameAt(data.timeline_media.frames,position.utc,data.timeline_media.max_age_seconds);
    if(radar)assert.ok(radar.ageSeconds>=0&&radar.ageSeconds<=data.timeline_media.max_age_seconds);
    const local=localPoint(position.coordinates,points[0].geometry.coordinates);
    assert.ok(local.every(Number.isFinite));
  }
});

test('the center text stays inside the scene beside its marker',()=>{
  // Right of the marker where it fits, as before.
  assert.equal(centerLabelX(100,85,348),112);
  // Near the right edge it moves to the marker's left side.
  assert.equal(centerLabelX(260,85,348),163);
  // Right of a reported width circle where that fits, left of it where not.
  assert.equal(centerLabelX(100,85,348,{left:60,right:140}),146);
  assert.equal(centerLabelX(200,85,348,{left:150,right:270}),59);
  // Where the circle leaves no room, it keeps clear of the marker.
  assert.equal(centerLabelX(330,85,348,{left:50,right:610}),233);
  assert.equal(centerLabelX(40,85,348,{left:-200,right:360}),52);
  assert.equal(centerLabelX(170,85,348,{left:20,right:320}),182);
  // Where neither side fits, it is held inside the scene.
  assert.equal(centerLabelX(60,85,120),31);
  // A marker outside the scene keeps its text beside it.
  assert.equal(centerLabelX(-30,85,348),-18);
  assert.equal(centerLabelX(400,85,348),412);
});

test('scene marks are the records whose points project into the scene, in order across it',()=>{
  const data=JSON.parse(readFileSync(new URL('../web/data.json',import.meta.url),'utf8'));
  const path=data.geometry.features.find(feature=>feature.geometry.type==='LineString').geometry.coordinates;
  const origin=[0,1].map(axis=>(Math.min(...path.map(point=>point[axis]))+Math.max(...path.map(point=>point[axis])))/2);
  const points=data.survey.points,places=data.history.remembrance.places.filter(place=>place.category==='fatalities');
  assert.equal(points.length,336);assert.equal(places.length,1);
  for(const [camera,width,height] of [[{azimuth:0,elevation:48,distance:48,focus:[0,0,0]},348,390],
    [{azimuth:0,elevation:48,distance:24,focus:[0,0,0]},868,520],[{azimuth:40,elevation:25,distance:6,focus:[2,1,0]},868,520]]){
    const marks=sceneMarks(points,places,origin,camera,width,height);
    // Counted here without the function: every record whose own projection is inside.
    const inside=record=>{const p=sceneProject(localPoint(record.coordinates,origin),camera,width,height);return Boolean(p)&&p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height;};
    assert.equal(marks.filter(mark=>mark.kind==='survey').length,points.filter(inside).length);
    assert.equal(marks.filter(mark=>mark.kind==='fatality').length,places.filter(inside).length);
    assert.deepEqual(marks.filter(mark=>mark.kind==='survey').map(mark=>mark.id).sort((a,b)=>a-b),points.filter(inside).map(point=>point.id).sort((a,b)=>a-b));
    for(const mark of marks){
      const record=mark.kind==='survey'?points.find(point=>point.id===mark.id):places.find(place=>place.id===mark.id);
      const p=sceneProject(localPoint(record.coordinates,origin),camera,width,height);
      assert.equal(mark.x,p.x);assert.equal(mark.y,p.y);
      assert.deepEqual(Object.keys(mark).sort(),['id','kind','x','y'],'A mark carries its identity and its place, and no rating.');
    }
    for(let i=1;i<marks.length;i++)assert.ok(marks[i-1].x<marks[i].x||(marks[i-1].x===marks[i].x&&marks[i-1].y<=marks[i].y),'Marks run from left to right.');
  }
  // The whole path view holds every record, and a close view holds fewer.
  const whole=sceneMarks(points,places,origin,{azimuth:0,elevation:48,distance:48,focus:[0,0,0]},348,390);
  const close=sceneMarks(points,places,origin,{azimuth:0,elevation:48,distance:4,focus:[0,0,0]},348,390);
  assert.ok(whole.length>close.length&&whole.length>300,`${whole.length} against ${close.length}`);
  assert.deepEqual(sceneMarks([],[],origin,{azimuth:0,elevation:48,distance:8,focus:[0,0,0]},348,390),[]);
});

test('a pointer means the nearest mark within reach and nothing beyond it',()=>{
  const marks=[{kind:'survey',id:1,x:100,y:100},{kind:'survey',id:2,x:108,y:100},{kind:'fatality',id:'place',x:200,y:50}];
  assert.equal(markAt(marks,101,100).id,1);
  assert.equal(markAt(marks,105,100).id,2);
  assert.equal(markAt(marks,104,100).id,1,'At the same distance the first mark across the scene is kept.');
  assert.equal(markAt(marks,200,62).id,'place');
  assert.equal(markAt(marks,200,62.5),null);
  assert.equal(markAt(marks,150,100),null);
  assert.equal(markAt([],10,10),null);
  assert.equal(markAt(marks,120,100,12.01).id,2);
  for(const bad of [[NaN,0,12],[0,Infinity,12],[0,0,0],[0,0,-1]])assert.throws(()=>markAt(marks,...bad),RangeError);
  // A fatality record's filled diamond lies over the small marks beside it,
  // so a pointer on the diamond means that record even when a survey mark is nearer.
  assert.equal(FATALITY_MARK_HALF,6);
  const crowded=[{kind:'survey',id:7,x:201,y:50},{kind:'fatality',id:'place',x:200,y:50},{kind:'survey',id:8,x:203,y:52}];
  assert.equal(markAt(crowded,201,50).id,'place');
  assert.equal(markAt(crowded,203,52).id,'place');
  assert.equal(markAt(crowded,203,53).id,'place','3 across and 3 down is on the edge of the diamond.');
  assert.equal(markAt(crowded,204,53).id,8,'Outside the diamond the nearest mark is meant.');
  assert.equal(markAt(crowded,207,50).id,8);
});

test('the written label of a mark stays in the scene, off its mark and off every taken box',()=>{
  const scene={width:348,height:390},size={width:200,height:34};
  const overlaps=(place,box)=>!(place.x>=box.right||place.x+size.width<=box.left||place.y>=box.bottom||place.y+size.height<=box.top);
  const inScene=place=>place.x>=8&&place.y>=8&&place.x+size.width<=scene.width-8&&place.y+size.height<=scene.height-8;
  // With nothing in the way the label sits above its mark, to the right.
  const mark={x:100,y:200},free=markLabelPlace(mark,size,scene);
  assert.deepEqual(free,{x:110,y:158,covers:0});
  // A box over that place sends it below the mark, and a second one to the left.
  const above={left:90,right:340,top:150,bottom:195},below={left:90,right:340,top:205,bottom:250};
  assert.deepEqual(markLabelPlace(mark,size,scene,[above]),{x:110,y:208,covers:0});
  // With both rows beside the mark taken it moves farther above, in steps of 14 px, to the first free row.
  assert.deepEqual(markLabelPlace(mark,size,scene,[above,below]),{x:110,y:116,covers:0});
  assert.equal(MARK_LABEL_REACH,70);
  const tall={left:0,right:348,top:60,bottom:320},held=markLabelPlace(mark,size,scene,[tall]);
  assert.deepEqual(held,{x:110,y:158,covers:0},'A box that takes every row within reach leaves the label above its mark.');
  const left=markLabelPlace({x:300,y:200},size,scene,[{left:290,right:340,top:100,bottom:300}]);
  assert.deepEqual(left,{x:90,y:158,covers:0});
  for(const taken of [[],[above],[above,below],[null,above]]){
    const place=markLabelPlace(mark,size,scene,taken);
    assert.ok(inScene(place),JSON.stringify(place));
    assert.equal(overlaps(place,{left:mark.x-8,right:mark.x+8,top:mark.y-8,bottom:mark.y+8}),false,'The mark stays uncovered.');
  }
  // Near an edge the label is held inside the scene and still leaves the mark uncovered.
  for(const edge of [{x:4,y:4},{x:344,y:6},{x:340,y:386},{x:2,y:380},{x:174,y:10},{x:174,y:384}]){
    const place=markLabelPlace(edge,size,scene);
    assert.ok(inScene(place),JSON.stringify([edge,place]));
    assert.equal(overlaps(place,{left:edge.x-8,right:edge.x+8,top:edge.y-8,bottom:edge.y+8}),false,JSON.stringify([edge,place]));
  }
  // With every place taken it stays above the mark, inside the scene.
  const everywhere=[{left:0,right:348,top:0,bottom:390}];
  assert.deepEqual(markLabelPlace(mark,size,scene,everywhere),{x:110,y:158,covers:0});
  // A soft box is avoided while a place is free and given up before a taken one.
  assert.deepEqual(markLabelPlace(mark,size,scene,[],[above]),{x:110,y:208,covers:0});
  assert.deepEqual(markLabelPlace(mark,size,scene,[below],everywhere),{x:110,y:158,covers:0});
  assert.deepEqual(markLabelPlace(mark,size,scene,[above],everywhere),{x:110,y:208,covers:0});
  for(const bad of [[{x:NaN,y:0},size,scene],[mark,{width:0,height:10},scene],[mark,size,{width:Infinity,height:390}]])
    assert.throws(()=>markLabelPlace(...bad),RangeError);
  assert.throws(()=>markLabelPlace(mark,size,scene,[],[],[],-1),RangeError);
  // Among free places it takes the one that covers the fewest other marks,
  // and the nearer one when two cover as few. The mark itself is not counted.
  const crowd=[mark,{x:150,y:170},{x:200,y:180},{x:160,y:220}];
  assert.deepEqual(markLabelPlace(mark,size,scene,[],[],crowd),{x:110,y:222,covers:0},'Marks above and below send it one step farther down, where it covers none.');
  assert.deepEqual(markLabelPlace(mark,size,scene,[],[],[mark,{x:150,y:170}]),{x:110,y:208,covers:0},'One mark above sends it below.');
  // While the scene moves the label keeps the place it had beside its mark, as long as that place is free.
  assert.deepEqual(markLabelPlace(mark,size,scene,[],[],crowd,8,{dx:10,dy:-42}),{x:110,y:158,covers:2},'A kept place is kept even where another covers fewer.');
  assert.deepEqual(markLabelPlace(mark,size,scene,[above],[],crowd,8,{dx:10,dy:-42}),{x:110,y:222,covers:0},'A kept place that is taken is given up.');
  assert.deepEqual(markLabelPlace(mark,size,scene,[],[],crowd,8,{dx:NaN,dy:0}),{x:110,y:222,covers:0},'An offset that is not a number is ignored.');
  assert.deepEqual(markLabelPlace(mark,size,scene,[],[],crowd,8,null),{x:110,y:222,covers:0});
  const field=[];
  for(let x=4;x<348;x+=8)for(let y=4;y<390;y+=8)field.push({x,y});
  const packed=markLabelPlace(mark,size,scene,[],[],field);
  assert.ok(packed.covers>0&&inScene(packed),'In a field of marks every place covers some, and the answer says how many.');
  assert.equal(packed.covers,field.filter(point=>point.x>packed.x&&point.x<packed.x+size.width&&point.y>packed.y&&point.y<packed.y+size.height).length);
});

test('marks that share a place form a stack in order across the scene',()=>{
  const marks=[{kind:'survey',id:1,x:100,y:100},{kind:'survey',id:2,x:100,y:100},{kind:'survey',id:3,x:101,y:101},
    {kind:'fatality',id:'place',x:100,y:100},{kind:'survey',id:4,x:103,y:100}];
  assert.deepEqual(markStack(marks,marks[0]).map(mark=>mark.id),[1,2,3],'Within 1.5 px, of the same kind only.');
  assert.deepEqual(markStack(marks,marks[3]).map(mark=>mark.id),['place']);
  assert.deepEqual(markStack(marks,marks[4]).map(mark=>mark.id),[4]);
  assert.deepEqual(markStack(marks,marks[0],0).map(mark=>mark.id),[1,2]);
  assert.throws(()=>markStack(marks,marks[0],-1),RangeError);
  // The two survey records of the exhibit that share one place.
  const data=JSON.parse(readFileSync(new URL('../web/data.json',import.meta.url),'utf8'));
  const twins=data.survey.points.filter(point=>[589148,589149].includes(point.id));
  assert.equal(twins.length,2);assert.deepEqual(twins[0].coordinates,twins[1].coordinates);
});
