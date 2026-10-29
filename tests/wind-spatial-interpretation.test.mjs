import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {MPH,FOOT,windAt,loadAt} from '../web/wind-model.mjs';
import {advanceWindTracer} from '../web/wind-tracer.mjs';

// Run the actual stationary consumer. These cardinal-point expectations come
// from vector addition and the declared drag equation, not generated model data.
async function consumer(){
  const source=await readFile(new URL('../web/wind.js',import.meta.url),'utf8');
  const imports=source.match(/^import .*;\r?$/gm)||[];
  assert.equal(imports.length,2);
  assert.ok(imports.every(line=>line.includes('./wind-model.mjs')||line.includes('./wind-tracer.mjs')));
  const program=source.replace(/^import .*;\r?$/gm,'').replace(/^export \{.*\};\r?$/gm,'')+'\nglobalThis.examine={update};';
  const defaults={peak:100,radius:500,background:0,'probe-x':1,'probe-y':0,area:1,coefficient:1.2,travel:30,offset:1,threshold:50,capacity:1,'passage-time':237};
  const nodes=new Map(),dispatched=[],painted=[];let requestedFrames=0;
  const context=new Proxy({measureText(){return {width:35};},fillText(text){painted.push(text);}}, {get:(target,key)=>key in target?target[key]:(()=>{})});
  function get(id){
    if(!nodes.has(id))nodes.set(id,{_value:String(defaults[id]??''),get value(){return this._value;},set value(value){this._value=String(value);},defaultValue:String(defaults[id]??''),textContent:'',clientWidth:700,width:0,height:0,listeners:new Map(),
      addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn);},
      dispatchEvent(event){dispatched.push({id,type:event.type,bubbles:event.bubbles});for(const fn of this.listeners.get(event.type)||[])fn(event);return true;},
      getContext(){return context;},reset(){for(const node of nodes.values())node.value=node.defaultValue;}});
    return nodes.get(id);
  }
  const realm={MPH,FOOT,windAt,loadAt,advanceWindTracer,Math,Number,Array,Object,RangeError,devicePixelRatio:1,Event,
    getComputedStyle(){return {fontFamily:'Arial',color:'#ddd',getPropertyValue(name){return {'--wind-slow-rgb':'164,164,164','--wind-fast-rgb':'244,244,244','--muted':'#aaa'}[name]||'';}};},
    MutationObserver:class{observe(){}},matchMedia(){return {addEventListener(){}};},
    requestAnimationFrame(){requestedFrames++;return 1;},cancelAnimationFrame(){},IntersectionObserver:class{observe(){}},ResizeObserver:class{observe(){}},
    document:{hidden:false,documentElement:{hasAttribute(){return false;}},getElementById:get,addEventListener(){},fonts:{ready:Promise.resolve()}}};
  vm.runInNewContext(program,realm,{timeout:1000,filename:'actual-wind-spatial-consumer.js'});
  return {get,dispatched,painted,frames:()=>requestedFrames,
    read:id=>get(id).textContent,
    input(id,value){get(id).value=String(value);get(id).dispatchEvent(new Event('input',{bubbles:true}));},
    update:()=>realm.examine.update(),
    click(id){get(id).dispatchEvent(new Event('click'));}};
}

test('actual probe components distinguish east and north with signed opposite-side winds',async()=>{
  const c=await consumer();
  assert.equal(c.read('probe-east-component'),'0.0 mph · 0.0 m/s');
  assert.equal(c.read('probe-north-component'),'100.0 mph · 44.7 m/s');
  assert.equal(c.read('wind-north-point'),'100.0 mph · 44.7 m/s · 1.47 kN drag');
  assert.equal(c.read('wind-south-point'),c.read('wind-north-point'));
  assert.equal(c.read('wind-side-ratio'),'1.000 ×');
  c.input('background',20);c.click('wind-probe-north');
  assert.equal(c.read('probe-east-component'),'-80.0 mph · -35.8 m/s');
  assert.equal(c.read('probe-north-component'),'0.0 mph · 0.0 m/s');
  // Independent literal forces: 940.0697585664N and 2115.1569567744N.
  assert.equal(c.read('wind-north-point'),'80.0 mph · 35.8 m/s · 0.94 kN drag');
  assert.equal(c.read('wind-south-point'),'120.0 mph · 53.6 m/s · 2.12 kN drag');
  assert.equal(c.read('wind-side-ratio'),'2.250 ×');
  c.click('wind-probe-south');
  assert.equal(c.read('probe-east-component'),'120.0 mph · 53.6 m/s');
  assert.equal(c.read('probe-north-component'),'0.0 mph · 0.0 m/s');
  c.input('probe-x',-1);c.input('probe-y',0);
  assert.equal(c.read('probe-east-component'),'20.0 mph · 8.9 m/s');
  assert.equal(c.read('probe-north-component'),'-100.0 mph · -44.7 m/s');
});

test('opposition describes the swirl direction without reversing a stronger net background',async()=>{
  const c=await consumer();c.input('peak',10);c.input('background',50);c.click('wind-probe-north');
  assert.equal(c.read('probe-east-component'),'40.0 mph · 17.9 m/s');
  assert.match(c.read('wind-north-point'),/^40\.0 mph/);
  assert.match(c.read('wind-south-point'),/^60\.0 mph/);
  assert.match(c.read('wind-spatial-note'),/net wind at the north point still points east/);
  assert.equal(c.read('wind-side-ratio'),'2.250 ×');
});

test('zero denominators, calm and uniform helper cases retain explicit finite output semantics',async()=>{
  const c=await consumer();c.input('peak',50);c.input('background',50);c.click('wind-probe-north');
  assert.equal(c.read('probe-speed'),'0.0 mph');
  assert.equal(c.read('wind-north-point'),'0.0 mph · 0.0 m/s · 0.00 kN drag');
  assert.equal(c.read('wind-side-ratio'),'Undefined: north calculated drag is zero.');
  // The model permits zero coefficient/swirl; these VM controls do not change
  // the public slider minima or serialize a new experiment field.
  c.input('coefficient',0);
  assert.equal(c.read('wind-side-ratio'),'Undefined: both calculated drags are zero.');
  c.input('peak',0);c.input('background',0);
  assert.equal(c.read('probe-east-component'),'0.0 mph · 0.0 m/s');
  assert.equal(c.read('probe-north-component'),'0.0 mph · 0.0 m/s');
  assert.equal(c.read('wind-side-ratio'),'Undefined: both calculated drags are zero.');
  c.input('coefficient',1.2);c.input('background',20);
  assert.equal(c.read('wind-side-ratio'),'1.000 ×');
  assert.match(c.read('wind-spatial-note'),/equal model speed and drag/);
  for(const id of ['probe-east-component','probe-north-component','wind-north-point','wind-south-point','wind-side-ratio'])assert.doesNotMatch(c.read(id),/NaN|Infinity/);
});

test('radius preserves normalized winds while area and coefficient affect only the compared drag',async()=>{
  const c=await consumer();c.input('background',20);c.click('wind-probe-north');
  const velocity=c.read('probe-east-component');c.input('radius',2000);
  assert.equal(c.read('probe-east-component'),velocity);
  assert.match(c.read('wind-spatial-assumptions'),/core radius 2000 ft/);
  c.input('area',2);c.input('coefficient',2);
  assert.equal(c.read('probe-east-component'),velocity);
  assert.equal(c.read('wind-north-point'),'80.0 mph · 35.8 m/s · 3.13 kN drag');
  assert.equal(c.read('wind-south-point'),'120.0 mph · 53.6 m/s · 7.05 kN drag');
  assert.equal(c.read('wind-side-ratio'),'2.250 ×');
});

test('comparison buttons use the existing input path without moving other controls or starting motion',async()=>{
  const c=await consumer();
  const other=['peak','radius','background','area','coefficient','travel','offset','threshold','capacity','passage-time'];
  const before=Object.fromEntries(other.map(id=>[id,c.get(id).value]));
  for(const [button,y] of [['wind-probe-north','1'],['wind-probe-south','-1']]){
    assert.equal(c.get(button).disabled,false);
    const prior=c.dispatched.filter(row=>row.id==='wind-controls'&&row.type==='input').length;
    c.click(button);
    assert.equal(c.get('probe-x').value,'0');assert.equal(c.get('probe-y').value,y);
    assert.equal(c.dispatched.filter(row=>row.id==='wind-controls'&&row.type==='input'&&row.bubbles).length,prior+1);
    assert.deepEqual(Object.fromEntries(other.map(id=>[id,c.get(id).value])),before);
    assert.equal(c.frames(),0);
  }
  assert.ok(c.painted.includes('N ↑')&&c.painted.includes('E →'));
  c.click('wind-reset');
  assert.equal(c.get('probe-x').value,'1');assert.equal(c.get('probe-y').value,'0');
  assert.equal(c.read('probe-north-component'),'100.0 mph · 44.7 m/s');
});

test('invalid model inputs cannot replace the existing spatial readings',async()=>{
  const c=await consumer(),ids=['probe-east-component','probe-north-component','wind-north-point','wind-south-point','wind-side-ratio'];
  const before=ids.map(id=>c.read(id));c.get('coefficient').value='-1';
  assert.throws(c.update,RangeError);
  assert.deepEqual(ids.map(id=>c.read(id)),before);
});

test('static opposite-side defaults and assumptions remain readable without a script',async()=>{
  const html=await readFile(new URL('../web/wind.html',import.meta.url),'utf8');
  const start=html.indexOf('<section id="wind-spatial-reading"');assert.ok(start>0);
  const content=html.slice(start,html.indexOf('</section>',start));
  for(const literal of ['100.0 mph · 44.7 m/s · 1.47 kN drag','0.0 mph · 0.0 m/s','1.000 ×','density 1.225 kg/m³','Without scripts, they remain this default example.'])assert.ok(content.includes(literal),literal);
  assert.match(content,/<button id="wind-probe-north" type="button" disabled>/);
  assert.match(content,/<button id="wind-probe-south" type="button" disabled>/);
  assert.match(content,/do not describe measured winds, damage or a real object/);
  assert.match(html,/<!-- BEGIN GENERATED WIND SAMPLES -->[\s\S]*id="sampled-values-body"/);
});
