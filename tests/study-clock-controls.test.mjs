import test from 'node:test';
import assert from 'node:assert/strict';

test('active study controls and scheduled frames use the same wall clock',async()=>{
  // Exercise the actual renderer module with an authored DOM/GL schedule.
  // A frame timestamp can precede a control's performance.now() in that frame.
  const ids=new Map(),frames=new Map();let wall=100,next=0;
  class Element{
    constructor(id){this.id=id;this.handlers=new Map();this.value='0';this.checked=false;this.dataset={};this.textContent='';}
    addEventListener(name,callback){this.handlers.set(name,callback);}
    getBoundingClientRect(){return {width:800,height:500};}
    getContext(){return gl;}
  }
  const factories=new Set(['createProgram','createShader','createVertexArray','createBuffer','getUniformLocation']);
  const gl=new Proxy({}, {get(_target,name){
    if(name==='getShaderParameter'||name==='getProgramParameter')return ()=>true;
    if(name==='getParameter')return ()=>[1,64];
    if(name==='getAttribLocation')return ()=>0;
    if(factories.has(name))return ()=>({});
    if(name.toUpperCase()===name)return 1;
    return ()=>{};
  }});
  globalThis.document={hidden:false,getElementById:id=>{if(!ids.has(id))ids.set(id,new Element(id));return ids.get(id);},addEventListener:()=>{}};
  globalThis.window={devicePixelRatio:1,matchMedia:()=>({matches:false,addEventListener:()=>{}})};
  globalThis.performance={now:()=>wall};
  globalThis.requestAnimationFrame=callback=>{const id=++next;frames.set(id,callback);return id;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  globalThis.ResizeObserver=class{observe(){}};
  globalThis.IntersectionObserver=class{observe(){}};
  for(const [id,value] of Object.entries({quality:'3600',shape:'cone',condensation:'100',azimuth:'25',elevation:'12',distance:'7','sequence-time':'0','sequence-coverage':'bounded','sequence-rate':'1'}))document.getElementById(id).value=value;
  await import('../web/study.js');
  const draw=timestamp=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(timestamp);};
  draw(100);ids.get('sequence-enabled').checked=true;ids.get('sequence-enabled').handlers.get('change')();
  wall=101;ids.get('motion').handlers.get('click')();
  wall=116.2;draw(116);
  wall=132.2;ids.get('sequence-rate').value='15';ids.get('sequence-rate').handlers.get('change')();
  assert.doesNotThrow(()=>draw(132));
  wall=149.2;draw(149);
  const progressed=Number(ids.get('sequence-time').value);
  assert.ok(progressed>0&&progressed<1);
  ids.get('motion').handlers.get('click')();
  const paused=ids.get('sequence-time').value;
  wall=200;draw(199);
  assert.equal(ids.get('sequence-time').value,paused);
});
