import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {MPH,FOOT,windAt,loadAt} from '../web/wind-model.mjs';
import {advanceWindTracer} from '../web/wind-tracer.mjs';

const near=(actual,expected,tolerance=1e-11)=>assert.ok(Math.abs(actual-expected)<=tolerance,actual+' versus '+expected);

test('zero-background tracers follow independent circular solutions across supported controls and step sizes',()=>{
  for(const [mph,feet] of [[10,2000],[100,500],[250,50]])for(const radial of [.1,.7,1,1.5,2])for(const dt of [1/60,1/30,.04]){
    const field={peak:mph*MPH,radius:feet*FOOT,background:0},point={x:radial,y:0},steps=Math.round(24/dt);
    for(let i=0;i<steps;i++)assert.equal(advanceWindTracer(point,field,dt),point);
    // Tangential speed is peak*r/R in the core and peak*R/r outside.
    // Dividing by physical radius gives this independent angular position.
    const omega=(mph*.44704)/(feet*.3048)*(radial<=1?1:1/(radial*radial)),angle=omega*steps*dt;
    near(point.x,radial*Math.cos(angle));near(point.y,radial*Math.sin(angle));
    near(Math.hypot(point.x,point.y),radial);
  }
});

test('center, calm swirl and zero elapsed time leave the existing marker intact',()=>{
  const field={peak:50,radius:100,background:0};
  for(const [point,settings,dt] of [[{x:0,y:0},field,.04],[{x:1,y:-2},{...field,peak:0},.04],[{x:1,y:-2},field,0]]){
    const before={...point};assert.equal(advanceWindTracer(point,settings,dt),point);assert.deepEqual(point,before);
  }
  const explicit={x:.4,y:.2},omitted={...explicit};
  advanceWindTracer(explicit,field,.02);advanceWindTracer(omitted,{peak:50,radius:100},.02);assert.deepEqual(omitted,explicit);
});

test('uniform eastward flow without swirl has an independently known straight trajectory',()=>{
  const point={x:-1,y:.3},field={peak:0,radius:50,background:10};
  for(let i=0;i<600;i++)advanceWindTracer(point,field,.04);
  near(point.x,-1+10/50*24);assert.equal(point.y,.3);
});

test('positive-background paths without a wholly core-contained orbit preserve midpoint behavior',()=>{
  for(const background of [5,20,50])for(const start of [{x:1,y:0},{x:-1.5,y:1}]){
    const field={peak:250*MPH,radius:50*FOOT,background:background*MPH},expected={...start},actual={...start};
    for(let i=0;i<1;i++){
      const dt=.04,wind=windAt(expected.x*field.radius,expected.y*field.radius,field);
      const mx=expected.x+wind.u/field.radius*dt/2,my=expected.y+wind.v/field.radius*dt/2;
      const midpoint=windAt(mx*field.radius,my*field.radius,field);
      expected.x+=midpoint.u/field.radius*dt;expected.y+=midpoint.v/field.radius*dt;
      advanceWindTracer(actual,field,dt);
    }
    // The outer/crossing approximation is preserved, not used as an oracle.
    assert.deepEqual(actual,expected);
  }
  // When B>V, no whole shifted circle fits, so all 60 advances are fallback.
  for(const background of [20,50]){
    const field={peak:10*MPH,radius:50*FOOT,background:background*MPH},expected={x:.1,y:.2},actual={...expected};
    for(let i=0;i<60;i++){
      const dt=.04,first=windAt(expected.x*field.radius,expected.y*field.radius,field);
      const mx=expected.x+first.u/field.radius*dt/2,my=expected.y+first.v/field.radius*dt/2;
      const middle=windAt(mx*field.radius,my*field.radius,field);
      expected.x+=middle.u/field.radius*dt;expected.y+=middle.v/field.radius*dt;
      advanceWindTracer(actual,field,dt);
    }
    assert.deepEqual(actual,expected);
  }
});

test('positive-background core tracers follow an independently derived shifted-circle trajectory',()=>{
  // Frozen before the repair: four supported fields, two shifted radii,
  // four phases and three admitted frame steps, each over 24 model seconds.
  for(const [mph,feet,background] of [[100,500,20],[250,50,20],[250,50,50],[10,2000,5]])for(const rho of [.1,.3])for(const phase of [0,Math.PI/2,Math.PI,3*Math.PI/2])for(const dt of [1/60,1/30,.04]){
    const center=background/mph,start={x:rho*Math.cos(phase),y:center+rho*Math.sin(phase)},point={...start};
    assert.ok(center+rho<1,'the entire reference circle must remain inside the linear core');
    const field={peak:mph*.44704,radius:feet*.3048,background:background*.44704},steps=Math.round(24/dt);
    for(let i=0;i<steps;i++){
      assert.equal(advanceWindTracer(point,field,dt),point);
      const angle=mph*.44704/(feet*.3048)*(i+1)*dt;
      near(point.x,rho*Math.cos(phase+angle));near(point.y,center+rho*Math.sin(phase+angle));
      near(Math.hypot(point.x,point.y-center),rho);
    }
  }
});

test('the frozen mixed-flow witness keeps its radius and phase over 24 admitted seconds',()=>{
  const point={x:.1,y:.2},field={peak:250*.44704,radius:50*.3048,background:20*.44704};
  for(let i=0;i<600;i++)advanceWindTracer(point,field,.04);
  const angle=250*.44704/(50*.3048)*24,center=20/250;
  near(point.x,.1*Math.cos(angle)-(.2-center)*Math.sin(angle));
  near(point.y,center+.1*Math.sin(angle)+(.2-center)*Math.cos(angle));
  near(Math.hypot(point.x,point.y-center),Math.hypot(.1,.2-center));
});

test('shifted equilibrium, very small swirl and nonrepresentable rotation have explicit controls',()=>{
  const point={x:0,y:.2},field={peak:50,radius:100,background:10};
  for(let i=0;i<600;i++)advanceWindTracer(point,field,.04);
  assert.deepEqual(point,{x:0,y:.2});
  const tiny={x:.1,y:.2};advanceWindTracer(tiny,{peak:1e-300,radius:1,background:2e-301},.04);
  near(tiny.x,.1);near(tiny.y,.2);
  const underflow={x:.1,y:1e-20},unchanged={...underflow};
  advanceWindTracer(underflow,{peak:1e-300,radius:1,background:2e-301},1e-100);
  assert.deepEqual(underflow,unchanged,'An underflowed angle must not erase the tiny north coordinate');
  const ratioOverflow={x:.1,y:.2};advanceWindTracer(ratioOverflow,{peak:Number.MIN_VALUE,radius:1,background:1},.04);
  near(ratioOverflow.x,.14);assert.equal(ratioOverflow.y,.2);
  const overflow={x:.1,y:.2};assert.throws(()=>advanceWindTracer(overflow,{peak:1e300,radius:1e-300,background:1e299},.04),RangeError);
  assert.deepEqual(overflow,{x:.1,y:.2});
});

test('touching and intervening-crossing orbits cannot take the exact all-core branch',()=>{
  // At (0,.6), B/V=.8 gives maximum r=1: the strict boundary is excluded.
  const field={peak:100,radius:1,background:80},point={x:0,y:.6},expected={...point},dt=.04;
  const first=windAt(expected.x,expected.y,field),mx=expected.x+first.u*dt/2,my=expected.y+first.v*dt/2;
  const middle=windAt(mx,my,field);expected.x+=middle.u*dt;expected.y+=middle.v*dt;
  advanceWindTracer(point,field,dt);assert.deepEqual(point,expected);
  // Both exact endpoints are interior, but the intervening arc leaves the core.
  const mixed={peak:100*.44704,radius:50*.3048,background:50*.44704},angle=mixed.peak/mixed.radius*.04,rho=.5001;
  const crossing={x:rho*Math.sin(angle/2),y:.5+rho*Math.cos(angle/2)},before={...crossing};
  const exact={x:-before.x,y:before.y};
  assert.ok(Math.hypot(before.x,before.y)<1&&Math.hypot(exact.x,exact.y)<1);
  assert.ok(.5+rho>1,'the intermediate peak is outside despite both interior endpoints');
  const a=windAt(before.x*mixed.radius,before.y*mixed.radius,mixed);
  const mx2=before.x+a.u/mixed.radius*.04/2,my2=before.y+a.v/mixed.radius*.04/2;
  const b=windAt(mx2*mixed.radius,my2*mixed.radius,mixed);
  const expectedCrossing={x:before.x+b.u/mixed.radius*.04,y:before.y+b.v/mixed.radius*.04};
  advanceWindTracer(crossing,mixed,.04);assert.deepEqual(crossing,expectedCrossing);
  assert.ok(Math.hypot(crossing.x-exact.x,crossing.y-exact.y)>1e-6);
});

test('invalid steps fail before changing the existing marker',()=>{
  const field={peak:50,radius:100,background:0};
  const cases=[...[NaN,Infinity,-.01,.04001,'0.01'].map(dt=>[field,dt]),...[{peak:-1},{peak:Infinity},{radius:0},{radius:NaN},{background:-1},{background:null}].map(change=>[{...field,...change},.01])];
  for(const [settings,dt] of cases){const point={x:.1,y:.2};assert.throws(()=>advanceWindTracer(point,settings,dt),RangeError);assert.deepEqual(point,{x:.1,y:.2});}
  for(const point of [{x:NaN,y:0},{x:0,y:Infinity}])assert.throws(()=>advanceWindTracer(point,field,.01),RangeError);
  assert.throws(()=>advanceWindTracer(null,field,.01),RangeError);
  assert.throws(()=>advanceWindTracer({x:1,y:0},null,.01),RangeError);
});

async function actualConsumer(){
  const source=await readFile(new URL('../web/wind.js',import.meta.url),'utf8');
  const imports=source.match(/^import .*;\r?$/gm)||[];
  assert.equal(imports.length,2);assert.ok(imports.some(line=>line.includes('./wind-tracer.mjs')));
  assert.ok(imports.every(line=>line.includes('./wind-model.mjs')||line.includes('./wind-tracer.mjs')));
  // Execute the production body with its real model/helper bindings. Only the
  // module declarations are stripped; the appended probe is private to this VM.
  const program=source.replace(/^import .*;\r?$/gm,'').replace(/^export \{.*\};\r?$/gm,'')+'\nglobalThis.probe={advance(point,steps,dt){particles=[{...point}];for(let i=0;i<steps;i++)draw(dt);return {...particles[0]};}};';
  const defaults={peak:250,radius:50,background:0,'probe-x':1,'probe-y':0,area:1,coefficient:1.2},nodes=new Map();
  const ctx=new Proxy({measureText(){return {width:35};}},{get(target,key){return key in target?target[key]:(()=>{});}});
  function get(id){if(!nodes.has(id))nodes.set(id,{value:String(defaults[id]??''),clientWidth:700,width:0,height:0,addEventListener(){},dispatchEvent(){},getContext(){return ctx;}});return nodes.get(id);}
  const realm={MPH,FOOT,windAt,loadAt,advanceWindTracer,Math,Number,Array,Object,RangeError,devicePixelRatio:1,getComputedStyle(){return {fontFamily:'Arial'};},requestAnimationFrame(){return 1;},cancelAnimationFrame(){},IntersectionObserver:class{observe(){}},ResizeObserver:class{observe(){}},document:{hidden:false,getElementById:get,addEventListener(){},fonts:{ready:Promise.resolve()}}};
  vm.runInNewContext(program,realm,{timeout:1000,filename:'wind-tracer-consumer.js'});
  return {probe:realm.probe,get};
}

test('actual wind consumer retains the core tracer radius at the supported extreme',async()=>{
  const {probe}=await actualConsumer(),point=probe.advance({x:.1,y:0},600,.04);
  near(Math.hypot(point.x,point.y),.1);
  const angle=(250*.44704)/(50*.3048)*24;
  near(point.x,.1*Math.cos(angle));near(point.y,.1*Math.sin(angle));
});

test('actual drawing consumer repairs the frozen mixed-flow witness without recycling',async()=>{
  const {probe,get}=await actualConsumer();get('background').value='20';
  const point=probe.advance({x:.1,y:.2},600,.04),angle=250*.44704/(50*.3048)*24,center=20/250;
  near(point.x,.1*Math.cos(angle)-(.2-center)*Math.sin(angle));
  near(point.y,center+.1*Math.sin(angle)+(.2-center)*Math.cos(angle));
  near(Math.hypot(point.x,point.y-center),Math.hypot(.1,.2-center));
});

test('actual wind consumer retains positive-background motion and its existing boundary recycling',async()=>{
  const {probe,get}=await actualConsumer();get('peak').value='0';get('background').value='50';
  const within=probe.advance({x:0,y:.3},1,.04);near(within.x,50*.44704/(50*.3048)*.04);assert.equal(within.y,.3);
  const recycled=probe.advance({x:3.59,y:.3},1,.04);assert.equal(recycled.x,-3.5);near(recycled.y,.3);
});
