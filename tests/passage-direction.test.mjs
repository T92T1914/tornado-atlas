import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MPH,FOOT,passageAt} from '../web/wind-model.mjs';
import {passageDirection,showPassageDirection} from '../web/passage-direction.mjs';

const field={peak:100*MPH,radius:500*FOOT,background:20*MPH,travel:30*MPH,offset:1};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} differs from ${b}`);
function view() {
  const nodes=new Map();
  const document={getElementById(id){
    if(!nodes.has(id))nodes.set(id,{textContent:'',dataset:{},attributes:new Map(),
      setAttribute(name,value){this.attributes.set(name,String(value));}});
    return nodes.get(id);
  }};
  return {document,node:id=>document.getElementById(id)};
}

test('closest approach distinguishes opposite sides by signed vector addition',()=>{
  // At +/-R, the 100mph swirl opposes or reinforces the 20mph east flow.
  const north=passageAt(0,field),south=passageAt(0,{...field,offset:-1});
  for(const [sample,expected] of [[north,-80],[south,120]]){
    const direction=passageDirection(sample);near(direction.east,expected);assert.equal(Math.abs(direction.north),0);
    near(sample.speed/MPH,Math.abs(expected));
  }
  assert.equal(passageDirection(north).eastText,'-80.0 mph');
  assert.equal(passageDirection(south).eastText,'+120.0 mph');
  assert.match(passageDirection(north).explanation,/westward/);
  assert.match(passageDirection(south).explanation,/eastward/);
});

test('north velocity changes sign before and after closest approach',()=>{
  // At relative positions (+R,+R) and (-R,+R), swirl gives (-50,+/-50)mph.
  for(const [time,north] of [[-field.radius/field.travel,50],[field.radius/field.travel,-50]]){
    const sample=passageAt(time,field),direction=passageDirection(sample);
    near(direction.east,-30);near(direction.north,north);
    near(sample.speed/MPH,Math.hypot(30,50));
    assert.match(direction.explanation,north>0?/northward/:/southward/);
  }
});

test('mph conversion preserves the norm and zero wind has no invented direction',()=>{
  const direction=passageDirection({u:3*MPH,v:4*MPH,speed:5*MPH});
  assert.equal(direction.eastText,'+3.0 mph');assert.equal(direction.northText,'+4.0 mph');
  near(Math.hypot(direction.east,direction.north),5);
  near(direction.unit.east,.6);near(direction.unit.north,.8);
  for(const [u,v] of [[0,0],[-0,0],[0,-0],[-0,-0]]){
    const zero=passageDirection({u,v,speed:0});
    assert.equal(Math.abs(zero.east),0);assert.equal(Math.abs(zero.north),0);
    assert.equal(zero.eastText,'0.0 mph');assert.equal(zero.northText,'0.0 mph');
    assert.equal(zero.unit,null);assert.equal(zero.explanation,'No horizontal wind at this sample, so there is no direction.');
  }
});

test('nonfinite, missing or inconsistent source values are unavailable',()=>{
  for(const sample of [null,undefined,{}, {u:NaN,v:0,speed:0},{u:0,v:Infinity,speed:0},
    {u:0,v:0,speed:-1},{u:0,v:0,speed:Infinity},{u:'1',v:0,speed:1},
    {u:1,v:1,speed:1},{u:1e308,v:1e308,speed:Math.hypot(1e308,1e308)}])
    assert.equal(passageDirection(sample),null);
});

test('the actual direction view uses north-up SVG coordinates and a fixed arrow length',()=>{
  const f=view();
  assert.equal(showPassageDirection(f.document,{u:3*MPH,v:4*MPH,speed:5*MPH},1),true);
  assert.equal(f.node('passage-east-component').textContent,'+3.0 mph');
  assert.equal(f.node('passage-north-component').textContent,'+4.0 mph');
  assert.equal(f.node('passage-direction-arrow').attributes.get('visibility'),'visible');
  assert.match(f.node('passage-direction-arrow').attributes.get('d'),/^M364\.800 153\.600 L390\.000 120\.000 /);
  const previous=f.node('passage-direction-arrow').attributes.get('d');
  showPassageDirection(f.document,{u:30*MPH,v:40*MPH,speed:50*MPH},1);
  assert.equal(f.node('passage-direction-arrow').attributes.get('d'),previous,'Arrow length does not encode speed');
  showPassageDirection(f.document,{u:-3*MPH,v:-4*MPH,speed:5*MPH},1);
  assert.match(f.node('passage-direction-arrow').attributes.get('d'),/^M355\.200 166\.400 L330\.000 200\.000 /);
});

test('zero and unavailable updates retire an earlier arrow and stale values',()=>{
  const f=view();showPassageDirection(f.document,{u:MPH,v:0,speed:MPH},1);
  showPassageDirection(f.document,{u:0,v:0,speed:0},1);
  assert.equal(f.node('passage-direction-arrow').attributes.get('d'),'');
  assert.equal(f.node('passage-direction-arrow').attributes.get('visibility'),'hidden');
  showPassageDirection(f.document,{u:MPH,v:0,speed:MPH},1);
  assert.equal(showPassageDirection(f.document,null,1),false);
  for(const id of ['passage-east-component','passage-north-component']){
    assert.equal(f.node(id).textContent,'Unavailable');assert.equal('value' in f.node(id).dataset,false);
  }
  assert.equal(f.node('passage-direction-reading').textContent,'Wind direction is unavailable for this sample.');
  assert.equal(f.node('passage-direction-arrow').attributes.get('d'),'');
  assert.equal(showPassageDirection(f.document,{u:MPH,v:0,speed:MPH},Infinity),false);
});

test('static default direction is complete and qualified without scripts',async()=>{
  const html=await readFile(new URL('../web/wind.html',import.meta.url),'utf8');
  // First sample: relative position (6R,R), hence u=-100/37 and v=600/37mph.
  assert.match(html,/<dd id="passage-east-component">-2\.7 mph<\/dd>/);
  assert.match(html,/<dd id="passage-north-component">\+16\.2 mph<\/dd>/);
  assert.equal((-100/37).toFixed(1),'-2.7');assert.equal((600/37).toFixed(1),'16.2');
  for(const text of ['shows direction only','Positive means east or north','Negative means west or south','Without scripts, these readings stay at those defaults.'])assert.ok(html.includes(text),text);
  assert.match(html,/<path id="passage-direction-arrow"[^>]*visibility="hidden"[^>]*aria-hidden="true"/);
});
