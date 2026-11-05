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
    querySelector(selector){
      assert.equal(this.id,'quality');
      const options=new Map([['[value="3600"]','lighter-option'],['[value="7200"]','standard-option']]);
      assert.ok(options.has(selector),'Only the two actual quality options exist');
      const id=options.get(selector);if(!ids.has(id))ids.set(id,new Element(id));
      return ids.get(id);
    }
  }
  const factories=new Set(['createProgram','createShader','createVertexArray','createBuffer','createTexture','getUniformLocation']);
  const gl=new Proxy({}, {get(_target,name){
    if(name==='getShaderParameter'||name==='getProgramParameter')return ()=>true;
    if(name==='getParameter')return ()=>[1,64];
    if(name==='getError')return ()=>0;
    if(name==='NO_ERROR')return 0;
    if(name==='getAttribLocation')return ()=>0;
    if(factories.has(name))return ()=>({});
    if(name.toUpperCase()===name)return 1;
    return ()=>{};
  }});
  const groundLink=new Element('formation-link');groundLink.href='https://example.test/reconstruction.html?event=el-reno-2013&appearance_view=formation&ground_view=synthetic-front&t=120#replay-appearance';
  globalThis.document={hidden:false,getElementById:id=>{if(id==='lab-context')return null;if(!ids.has(id))ids.set(id,new Element(id));return ids.get(id);},
    querySelector:selector=>{assert.equal(selector,'.formation-context a[href*="reconstruction.html"]');return groundLink;},addEventListener:()=>{}};
  globalThis.window={devicePixelRatio:1,matchMedia:()=>({matches:false,addEventListener:()=>{}})};
  let appearance='dark';globalThis.getComputedStyle=()=>({colorScheme:appearance});
  globalThis.performance={now:()=>wall};
  globalThis.requestAnimationFrame=callback=>{const id=++next;frames.set(id,callback);return id;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  globalThis.ResizeObserver=class{observe(){}};
  globalThis.IntersectionObserver=class{observe(){}};
  for(const [id,value] of Object.entries({quality:'3600',shape:'cone',condensation:'100',azimuth:'25',elevation:'12',distance:'7','sequence-time':'0','sequence-coverage':'storm-integrated','sequence-rate':'1','condensation-visibility':'ordinary'}))document.getElementById(id).value=value;
  document.getElementById('flow-cues').checked=true;
  document.getElementById('sequence-enabled').checked=true;
  await import('../web/study.js');
  assert.match(ids.get('lighter-option').textContent,/320 × 200/);
  assert.match(ids.get('standard-option').textContent,/512 × 320/);
  assert.equal(new URL(groundLink.href).searchParams.get('appearance_style'),'storm-v3');
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
  for(appearance of ['light','dark']){
    ids.get('reading-appearance').handlers.get('change')();
    wall+=20;draw(wall-1);
    assert.equal(ids.get('sequence-time').value,paused,'Appearance redraw retains the paused sequence position');
    assert.equal(ids.get('motion').textContent,'Play motion');
  }
  for(const [position,target]of [[0,120],[.2,124],[.5,130],[.8,136],[1,140],[.333,126.66]]){
    ids.get('sequence-time').value=String(position);ids.get('sequence-time').handlers.get('input')();
    assert.equal(Number(new URL(groundLink.href).searchParams.get('t')),target);
    assert.equal(new URL(groundLink.href).searchParams.get('appearance_style'),'storm-v3');
  }
  ids.get('condensation-visibility').value='limited';ids.get('flow-cues').checked=false;ids.get('dust').checked=false;
  groundLink.handlers.get('focus')();
  assert.equal(groundLink.textContent,'View this authored phase with Replay defaults');
  assert.deepEqual([...new URL(groundLink.href).searchParams.keys()].sort(),['appearance_style','appearance_view','event','ground_view','t']);
  for(const [coverage,style]of [['formation','world-v1'],['reference','reference-v1'],['storm','storm-v1'],['storm-detail','storm-v2'],['storm-integrated','storm-v3']]){
    ids.get('sequence-coverage').value=coverage;ids.get('sequence-coverage').handlers.get('change')();
    assert.equal(new URL(groundLink.href).searchParams.get('appearance_style'),style);
  }
  ids.get('sequence-time').value='.5';ids.get('sequence-time').handlers.get('input')();
  ids.get('motion').handlers.get('click')();
  groundLink.handlers.get('click')({button:0,ctrlKey:true,defaultPrevented:false});
  assert.equal(ids.get('motion').textContent,'Pause motion','Modified activation leaves the source motion alone');
  ids.get('motion').handlers.get('click')();
  ids.get('sequence-enabled').checked=false;ids.get('sequence-enabled').handlers.get('change')();
  assert.equal(new URL(groundLink.href).searchParams.get('t'),'120');
  assert.equal(new URL(groundLink.href).searchParams.has('appearance_style'),false);
  assert.match(groundLink.textContent,/separate formation scenario/);
  ids.get('lab-state').dataset.state='invalid';groundLink.handlers.get('focus')();
  groundLink.handlers.get('click')({button:0,defaultPrevented:false});
  assert.equal(ids.get('lab-state').dataset.state,'invalid');assert.equal(new URL(groundLink.href).searchParams.get('t'),'120');
});
