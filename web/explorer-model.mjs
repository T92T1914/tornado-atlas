import {project, readSearchLink, writeSearchLink} from './atlas-model.mjs';

export function positionStatus(record) {
  if (record.location_quality === 'disputed') return 'disputed';
  return project(record.point) ? 'reported' : 'missing';
}
export function usablePoints(records) {
  return records.filter(record => positionStatus(record) === 'reported');
}
export function inside(point, area) {
  if (!project(point) || !area) return false;
  const [west,south,east,north] = area;
  return point[0]>=west && point[0]<=east && point[1]>=south && point[1]<=north;
}
function numbers(value, length) {
  if (!value) return null;
  const parts=value.split(',');
  if (parts.length!==length || parts.some(x=>!x.trim())) return null;
  const result=parts.map(Number);
  return result.every(Number.isFinite) ? result : null;
}
export function validArea(area) {
  return Array.isArray(area) && area.length===4 && area.every(Number.isFinite)
    && area[0]>=-180 && area[2]<=180 && area[1]>=-85 && area[3]<=85
    && area[0]<area[2] && area[1]<area[3];
}
export function readExplorerLink(search='',hash='') {
  const basic=readSearchLink(search,hash), p=new URLSearchParams(search);
  const view=numbers(p.get('view'),3), area=numbers(p.get('area'),4);
  return {...basic,view:view && Math.abs(view[0])<=85 && Math.abs(view[1])<=180 && view[2]>=0 && view[2]<=16 ? view:null,
    area:validArea(area)?area:null, layer:['local','topo','terrain'].includes(p.get('layer'))?p.get('layer'):'topo',
    media:p.get('media')||'',quality:['missing','disputed','reported'].includes(p.get('quality'))?p.get('quality'):'',
    hasMedia:p.get('hasMedia')==='1'};
}
export function writeExplorerLink(state) {
  const base=new URL(writeSearchLink(state.filters,state.recordId),'https://example.invalid/');
  const p=base.searchParams;
  if (state.view) p.set('view',state.view.map((v,i)=>Number(v.toFixed(i===2?2:5))).join(','));
  // This rectangle is a filter, not just a camera view. Rounding a boundary
  // can change which source records survive a shared-link round trip.
  if (validArea(state.area)) p.set('area',state.area.join(','));
  if (state.layer && state.layer!=='topo') p.set('layer',state.layer);
  if (state.media) p.set('media',state.media);
  if (state.quality) p.set('quality',state.quality);
  if (state.hasMedia) p.set('hasMedia','1');
  return `${p.size?'?'+p.toString():''}${base.hash}`;
}

// Bins are anchored to projected world pixels, so a pan does not reshuffle
// every group. Only visible points enter the bounded map representation.
export function screenGroups(records, projectPixel, viewport, size=72) {
  if (!Number.isFinite(size) || size<24) throw new RangeError('Invalid group size');
  const [left,top,right,bottom]=viewport, bins=new Map();
  let visible=0,missing=0,disputed=0;
  for (const record of records) {
    const status=positionStatus(record);
    if(status==='missing'){missing++;continue;}
    if(status==='disputed'){disputed++;continue;}
    const p=projectPixel(record.point);
    if (p[0]<left || p[0]>right || p[1]<top || p[1]>bottom) continue;
    visible++;
    const key=`${Math.floor(p[0]/size)}:${Math.floor(p[1]/size)}`;
    if(!bins.has(key)) bins.set(key,{key,records:[],point:[0,0],anchor:[(Math.floor(p[0]/size)+.5)*size,(Math.floor(p[1]/size)+.5)*size]});
    const group=bins.get(key); group.records.push(record);
    group.point[0]+=p[0];group.point[1]+=p[1];
  }
  for(const group of bins.values()) group.point=group.point.map(v=>v/group.records.length);
  return {groups:[...bins.values()],visible,missing,disputed};
}

export function compactCount(count) {
  return count<1000 ? String(count) : `${(count/1000).toFixed(1).replace(/\.0$/,'')}k`;
}
