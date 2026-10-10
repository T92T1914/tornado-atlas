import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountChronology} from '../web/chronology-view.mjs';
import {resolveRadarContext} from '../web/chronology-radar-model.mjs';
import {loadVerifiedDossier} from '../web/dossier-file-model.mjs';
import {webcrypto} from 'node:crypto';

const data=JSON.parse(await readFile(new URL('../exhibits/joplin-2011/chronology.json',import.meta.url),'utf8'));
const radar=resolveRadarContext(data,await loadVerifiedDossier(data.radar_context.reference,data.event_id,{
  fetcher:async()=>new Response(await readFile(new URL('../web/'+data.radar_context.reference.file,import.meta.url))),subtle:webcrypto.subtle,
}));

function fixture(t,{withRadar=false}={}){
  const elements=[],frames=new Map(),documentHandlers=new Map(),windowHandlers=new Map(),mediaHandlers=new Map();
  const before=JSON.stringify(data);let wall=100,nextFrame=0;
  const listen=(handlers,name,callback)=>{if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(callback);};
  const remove=(handlers,name,callback)=>handlers.get(name)?.delete(callback);
  const fire=(handlers,name,event={})=>{for(const callback of handlers.get(name)||[])callback(event);};
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.handlers=new Map();this.attributes=new Map();this.textContent='';this._value='';this._selected=false;elements.push(this);}
    append(child){child.parent=this;this.children.push(child);if(this.tag==='select'&&this.children.length===1)child.selected=true;}
    replaceChildren(...children){for(const child of this.children)delete child.parent;this.children=[];this.textContent='';for(const child of children)this.append(child);}
    set value(value){this._value=String(value);if(this.tag==='option'&&this.selected)this.parent.value=this._value;}
    get value(){return this._value;}
    set selected(value){this._selected=Boolean(value);if(this._selected&&this.parent){for(const sibling of this.parent.children)if(sibling!==this)sibling._selected=false;this.parent.value=this.value;}}
    get selected(){return this._selected;}
    addEventListener(name,callback){listen(this.handlers,name,callback);}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    fire(name,event){fire(this.handlers,name,event);}
  }
  const container=new Element('section');
  const location=new URL('https://atlas.example/reconstruction.html?event=joplin-2011&t=13140');
  const entries=[location.href];let entryIndex=0;
  const history={
    pushState(_state,_title,url){location.href=new URL(url,location.href).href;entries.splice(entryIndex+1);entries.push(location.href);entryIndex++;},
    replaceState(_state,_title,url){location.href=new URL(url,location.href).href;entries[entryIndex]=location.href;},
    back(){assert.ok(entryIndex>0);location.href=entries[--entryIndex];fire(windowHandlers,'popstate');},
    forward(){assert.ok(entryIndex<entries.length-1);location.href=entries[++entryIndex];fire(windowHandlers,'popstate');},
  };
  const document={hidden:false,createElement:tag=>new Element(tag),addEventListener:(name,callback)=>listen(documentHandlers,name,callback),removeEventListener:(name,callback)=>remove(documentHandlers,name,callback)};
  const media={matches:false,addEventListener:(name,callback)=>listen(mediaHandlers,name,callback),removeEventListener:(name,callback)=>remove(mediaHandlers,name,callback)};
  const globals={document,location,history,performance:{now:()=>wall},
    window:{addEventListener:(name,callback)=>listen(windowHandlers,name,callback),removeEventListener:(name,callback)=>remove(windowHandlers,name,callback)},
    matchMedia:()=>media,
    requestAnimationFrame:callback=>{const id=++nextFrame;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id)};
  const original=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  let unmount;
  t.after(()=>{unmount?.();assert.equal(JSON.stringify(data),before,'Consumer leaves curated entries unchanged');frames.clear();for(const [key,descriptor] of original)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
  const opened=[];
  unmount=mountChronology(container,data,{id:'joplin-2011',documentary:'joplin.html'},withRadar?{radarContext:radar,openPhoto:photo=>opened.push(photo)}:{});
  const get=id=>{const element=elements.find(node=>node.id===id);assert.ok(element,`Actual mounted element ${id}`);return element;};
  const button=text=>{const element=elements.find(node=>node.tag==='button'&&node.textContent===text);assert.ok(element,`Actual mounted button ${text}`);return element;};
  const rate=elements.find(node=>node.attributes.get('aria-label')==='Chronology playback speed');
  const card=elements.find(node=>node.className==='chronology-record');
  return {get,button,rate,card,history,location,entries,frames,opened,
    restoreSaved(){fire(windowHandlers,'popstate');},
    setWall(value){assert.ok(value>=wall,'Monotonic performance.now');wall=value;},
    draw(value,timestamp=value){this.setWall(value);assert.equal(frames.size,1,'One owned animation callback');const [id,callback]=frames.entries().next().value;frames.delete(id);callback(timestamp);assert.ok(frames.size<=1,'No competing animation chain');},
    playing(expected){assert.equal(button(expected?'Pause chronology':'Play chronology').textContent,expected?'Pause chronology':'Play chronology');assert.equal(frames.size,expected?1:0);},
    visibility(hidden){document.hidden=hidden;fire(documentHandlers,'visibilitychange');},
    reduce(){media.matches=true;fire(mediaHandlers,'change',{matches:true});},
    unmount(){unmount();unmount=null;assert.equal(frames.size,0);for(const handlers of [documentHandlers,windowHandlers,mediaHandlers])for(const callbacks of handlers.values())assert.equal(callbacks.size,0,'Unmount removes its lifetime listeners');},
  };
}

test('mounted radar updates inside one documentary entry and shares seek, history and the image viewer',t=>{
  const f=fixture(t,{withRadar:true});
  assert.match(f.get('chronology-radar-selected').textContent,/No earlier radar snapshot/);
  assert.equal(f.get('chronology-radar-snapshot').children.length,7,'Blank start plus six in-range labels');
  assert.equal(f.get('chronology-radar-snapshot').children.some(row=>row.value==='radar-2253'),false);
  const seek=seconds=>{f.get('chronology-time').value=seconds;f.get('chronology-time').fire('input');};
  seek(14940);const documentary=f.card.children[1].textContent;
  assert.equal(f.get('chronology-radar-snapshot').value,'radar-2239');
  seek(15180);assert.equal(f.card.children[1].textContent,documentary);
  assert.equal(f.get('chronology-radar-snapshot').value,'radar-2243');
  assert.match(f.get('chronology-radar-age').textContent,/0 min 0 s/);
  f.get('chronology-radar-snapshot').value='radar-2229';f.get('chronology-radar-snapshot').fire('change');
  assert.equal(f.location.searchParams.get('t'),'14340');f.playing(false);
  f.history.back();assert.equal(f.get('chronology-radar-snapshot').value,'radar-2243');f.playing(false);
  f.history.forward();assert.equal(f.get('chronology-radar-snapshot').value,'radar-2229');f.playing(false);
  f.button('Open complete radar figure').fire('click');assert.equal(f.opened.length,1);
  assert.equal(f.opened[0].asset,radar.media.transformation.asset);
  assert.equal(f.opened[0].caption,radar.media.account+' '+radar.media.limits);
  assert.equal(f.opened[0].credit,radar.creator.name+'. '+radar.creator.basis);
  assert.equal(f.opened[0].license,radar.source.rights);
});

test('mounted radar age follows fractional clock time through rate, pause and lifetime transitions',t=>{
  const f=fixture(t,{withRadar:true});
  f.get('chronology-time').value='14940';f.get('chronology-time').fire('input');
  f.rate.value='120';f.rate.fire('change');f.button('Play chronology').fire('click');
  f.draw(1100);assert.match(f.get('chronology-radar-age').textContent,/2 min 0 s/);f.playing(true);
  f.rate.value='15';f.rate.fire('change');f.draw(2100);
  assert.match(f.get('chronology-radar-age').textContent,/2 min 15 s/);
  f.visibility(true);f.playing(false);f.setWall(10000);
  assert.match(f.get('chronology-radar-age').textContent,/2 min 15 s/);
  f.visibility(false);f.button('Play chronology').fire('click');f.draw(10020);
  assert.match(f.get('chronology-radar-age').textContent,/2 min 15 s/,'Floor display does not invent a minute observation');
  f.reduce();f.playing(false);f.unmount();
});

for(const transition of ['visibility','reduce']){
  test(`mounted ${transition} pause preserves a radar boundary on the saved documentary clock`,t=>{
    const f=fixture(t,{withRadar:true});
    f.get('chronology-time').value='14940';f.get('chronology-time').fire('input');
    const entry=f.card.children[1].textContent;
    f.rate.value='120';f.rate.fire('change');f.button('Play chronology').fire('click');f.draw(2100);
    assert.equal(f.get('chronology-radar-snapshot').value,'radar-2243');assert.equal(f.card.children[1].textContent,entry);
    if(transition==='visibility')f.visibility(true);else f.reduce();
    f.playing(false);assert.equal(f.location.searchParams.get('t'),'15180');
    assert.equal(f.entries.length,1,'Lifecycle pause replaces the existing history entry');
    f.setWall(10000);f.restoreSaved();f.playing(false);
    assert.equal(f.get('chronology-radar-snapshot').value,'radar-2243');assert.equal(f.card.children[1].textContent,entry);
  });
}

test('a rate sample that finishes chronology cancels its frame before immediate restart',t=>{
  const f=fixture(t,{withRadar:true});
  f.get('chronology-time').value='15360';f.get('chronology-time').fire('input');
  f.rate.value='120';f.rate.fire('change');f.button('Play chronology').fire('click');
  const oldFrame=f.frames.keys().next().value;f.playing(true);
  // Sample the endpoint through the actual rate handler before the queued RAF.
  f.setWall(1100);f.rate.value='15';f.rate.fire('change');
  assert.equal(f.frames.size,0,'Rate completion cancels the queued animation callback');
  assert.equal(f.frames.has(oldFrame),false);f.playing(false);
  assert.equal(f.location.searchParams.get('t'),'15480');assert.equal(f.entries.length,1);
  assert.equal(f.get('chronology-radar-snapshot').value,'radar-2248');
  f.button('Play chronology').fire('click');f.playing(true);
  f.draw(1200);f.playing(true);
  assert.equal(f.get('chronology-time').value,'1.5','The first frame samples15x from the restarted origin');
  assert.match(f.get('chronology-radar-selected').textContent,/No earlier radar snapshot/);
  f.draw(1300);f.playing(true);
  f.visibility(true);f.playing(false);f.unmount();
});

test('actual chronology starts despite an earlier scheduled frame timestamp',t=>{
  const f=fixture(t);
  f.setWall(101);f.button('Play chronology').fire('click');f.playing(true);
  // RAF supplies the frame's timestamp, which can precede a control callback.
  f.draw(111.2,100);
  f.draw(2101,2100);
  assert.equal(f.get('chronology-entry').value,'2');
  assert.match(f.get('chronology-clock').textContent,/5:11/);
  assert.equal(new URL(f.get('chronology-link').href).searchParams.get('t'),'13260');
  assert.equal(f.card.children[1].textContent,'First siren alert');
  f.playing(true);
});

test('actual rate control and scheduled frames use the same monotonic wall clock',t=>{
  const f=fixture(t);
  f.setWall(101);f.button('Play chronology').fire('click');f.draw(116.2,116);
  f.setWall(132.2);f.rate.value='15';f.rate.fire('change');
  f.draw(132.2,132);
  f.draw(149.2,149);
  assert.equal(f.get('chronology-entry').value,'1');
  assert.equal(new URL(f.get('chronology-link').href).searchParams.get('t'),'13140');
  f.draw(8132.2,8132);
  assert.equal(f.get('chronology-entry').value,'2');
  assert.equal(new URL(f.get('chronology-link').href).searchParams.get('t'),'13260');
  f.playing(true);
});

test('actual pause, seek, history and lifetime transitions keep one paused or playing chronology',t=>{
  const f=fixture(t);
  f.setWall(1000);f.button('Play chronology').fire('click');f.draw(1500);
  f.setWall(2250);f.button('Pause chronology').fire('click');f.playing(false);
  assert.equal(new URL(f.get('chronology-link').href).searchParams.get('t'),'13200');
  assert.equal(f.location.searchParams.get('t'),'13200','Pause replaces the address at minute precision');
  assert.match(f.card.children[0].textContent,/Latest earlier entry/);
  f.setWall(100000);f.button('Play chronology').fire('click');f.draw(101000);
  assert.equal(f.get('chronology-entry').value,'2','Paused wall time is not counted');
  f.get('chronology-time').value='13740';f.get('chronology-time').fire('input');f.playing(false);
  assert.equal(f.location.searchParams.get('t'),'13740');assert.equal(f.entries.length,1,'Scrubbing replaces the current entry');
  f.get('chronology-entry').value='4';f.get('chronology-entry').fire('change');f.playing(false);
  assert.equal(f.location.searchParams.get('t'),'14640');assert.equal(f.entries.length,2);
  assert.match(f.card.children[5].textContent,/Approximate time, with no numerical error bound/);
  assert.equal(f.card.children[4].href,'https://www.weather.gov/media/publications/assessments/Joplin_tornado.pdf#page=8');
  f.history.back();f.playing(false);assert.equal(f.get('chronology-entry').value,'3');
  f.history.forward();f.playing(false);assert.equal(f.get('chronology-entry').value,'4');
  f.setWall(200000);f.button('Play chronology').fire('click');
  f.setWall(200500);f.visibility(true);f.playing(false);
  f.setWall(500000);f.visibility(false);f.playing(false);
  f.button('Play chronology').fire('click');f.draw(501000);f.playing(true);
  assert.equal(new URL(f.get('chronology-link').href).searchParams.get('t'),'14700','Hidden wall time is not counted');
  f.setWall(501500);f.reduce();f.playing(false);
  f.setWall(550000);f.button('Play chronology').fire('click');f.playing(true);
  f.setWall(550500);f.unmount();f.playing(false);
});
