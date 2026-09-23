import test from 'node:test';
import assert from 'node:assert/strict';
import {mountExplorerMap} from '../web/explorer-map.mjs';

// Exercise the adapter's lifecycle with controlled map events. Real tile
// requests and responsive layout still need browser verification.
function harness(t) {
  const saved=new Map(), replace=(key,value)=>{saved.set(key,globalThis[key]);globalThis[key]=value;};
  t.after(()=>{for(const [key,value] of saved)if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
  const groups=[],tiles=[],statuses=[],invalidations=[],pans=[],timers=new Map();
  const reduced={matches:false};
  let resizeCallback,mediaCallback,nextTimer=0;
  const narrow={matches:false,addEventListener(_,callback){mediaCallback=callback;}};
  const host={clientWidth:800,clientHeight:500,setAttribute(){}};
  const evented=()=>({events:{},on(name,fn){this.events[name]=fn;return this;},emit(name){this.events[name]?.();}});
  const map={...evented(),dragging:{enabled:true,enable(){this.enabled=true;},disable(){this.enabled=false;}},
    attributionControl:{setPrefix(){},addAttribution(){}},createPane(){},getPane(){return {style:{}};},
    getPixelBounds(){return {min:{x:-180,y:-90},max:{x:180,y:90}};},getZoom(){return 4;},
    project(point){return {x:point[1],y:point[0]};},unproject(point){return point;},
    setView(){return this;},panBy(offset,options){pans.push({offset,options});return this;},invalidateSize(options){invalidations.push(options);}};
  const element=()=>({dataset:{},setAttribute(){}});
  const marker=()=>({addTo(group){group.layers.push(this);return this;},on(){return this;},bindTooltip(){return this;},getElement:element});
  const L={map:()=>map,control:{scale:()=>({addTo(){}})},
    layerGroup(){const group={layers:[],addTo(){return this;},clearLayers(){this.layers=[];}};groups.push(group);return group;},
    marker,circleMarker:marker,divIcon:value=>value,geoJSON:()=>({addTo(){}}),
    tileLayer(url,options){const tile={...evented(),url,options,removed:false,remove(){this.removed=true;},addTo(){this.emit('loading');}};tiles.push(tile);return tile;}};
  replace('window',{L});replace('document',{createElement:element});replace('matchMedia',query=>query.includes('max-width')?narrow:query.includes('reduced-motion')?reduced:{matches:false});
  replace('ResizeObserver',class{constructor(callback){resizeCallback=callback;}observe(){}});
  replace('fetch',async()=>({ok:true,json:async()=>({type:'FeatureCollection',features:[]})}));
  replace('setTimeout',fn=>{timers.set(++nextTimer,fn);return nextTimer;});replace('clearTimeout',id=>timers.delete(id));
  const ui=mountExplorerMap(host,{onSelect(){},onGroup(){},onView(){},onCount(){},onStatus:text=>statuses.push(text)});
  return {ui,map,groups,tiles,statuses,host,invalidations,pans,reduced,timers,resize:()=>resizeCallback(),narrow:matches=>{narrow.matches=matches;mediaCallback();}};
}

test('hidden panels do not invalidate a useful map size and reopening preserves its center',t=>{
  const h=harness(t);h.host.clientWidth=0;h.resize();h.ui.resize();assert.equal(h.invalidations.length,0);
  h.host.clientWidth=390;h.resize();assert.equal(h.invalidations.length,1);
  assert.notEqual(h.invalidations[0].pan,false);
});
test('narrow screens disable implicit dragging while an explicit choice survives resizing',t=>{
  const h=harness(t);h.narrow(true);assert.equal(h.map.dragging.enabled,false);
  h.ui.interactive(true);h.narrow(false);h.narrow(true);assert.equal(h.map.dragging.enabled,true);
});
test('reduced motion also disables the library keyboard pan animation',t=>{
  const h=harness(t);h.reduced.matches=true;h.map.panBy([80,0],{duration:.25});
  assert.deepEqual(h.pans[0],{offset:[80,0],options:{duration:.25,animate:false}});
  h.reduced.matches=false;h.map.panBy([0,80]);assert.equal(h.pans[1].options,undefined);
});
test('disputed positions require an explicit center action and do not leak to the next selection',t=>{
  const h=harness(t),row={id:'disputed',point:[-12.18,34.6],location_quality:'disputed'};
  h.ui.select(row);assert.equal(h.groups[1].layers.length,0);
  h.ui.center(row);assert.equal(h.groups[1].layers.length,2);
  h.ui.select(null);h.ui.select(row);assert.equal(h.groups[1].layers.length,0);
});
test('old layer failures cannot remove a new layer or overwrite its status',t=>{
  const h=harness(t);h.ui.setLayer('topo');const first=h.tiles[0];
  h.ui.setLayer('terrain');const second=h.tiles[1];second.emit('load');
  const status=h.statuses.at(-1);first.emit('tileerror');assert.equal(h.statuses.at(-1),status);assert.equal(second.removed,false);
  assert.deepEqual(second.options.bounds,[[-85.05112878,-180],[85.05112878,180]]);
});
test('a later stalled tile load falls back and a retry can succeed',t=>{
  const h=harness(t);h.ui.setLayer('topo');h.tiles[0].emit('load');assert.equal(h.timers.size,0);
  h.tiles[0].emit('loading');assert.equal(h.timers.size,1);[...h.timers.values()][0]();
  assert.equal(h.tiles[0].removed,true);assert.match(h.statuses.at(-1),/Local geography and the record list still work/);
  h.ui.retry();h.tiles[1].emit('load');assert.match(h.statuses.at(-1),/^Modern USGS/);assert.equal(h.timers.size,0);
});
