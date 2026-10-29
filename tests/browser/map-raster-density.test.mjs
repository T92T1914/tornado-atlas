import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

// Literal independent controls, not expectations imported from the new helper.
// This first group mounts the actual changed geography and navigation modules
// with a fixed affine map. Whole-article integration is a separate group below.
const cases=[
 {width:3840,height:2160,dpr:1,size:[2896,1448]},
 {width:3840,height:2160,dpr:2,size:[2896,1448]},
 {width:320,height:844,dpr:2,size:[640,320]},
];
const fullBounds=[-98,35,-97,35.5],returnedExtent={xmin:-98.05,ymin:34.95,xmax:-96.95,ymax:35.55,spatialReference:{wkid:4326}};
const imageBody=(width,height,id)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fafafa"/><path d="M0 ${height/2}H${width}M${width/2} 0V${height}" stroke="#747474" stroke-width="4"/><text x="20" y="40" font-size="20">Controlled map source ${id}</text></svg>`;

async function mockGeography(page,{fixedExtent=null}={}){
 const exports=[],images=[],objects=new Map(),state={refuseTerrain:false};let serial=0;
 await page.route('https://basemap.nationalmap.gov/**',async route=>{
  const url=new URL(route.request().url());assert.equal(route.request().method(),'GET');
  if(url.pathname.endsWith('/export')){
   const terrain=url.pathname.includes('USGSShadedReliefOnly'),size=url.searchParams.get('size').split(',').map(Number),bbox=url.searchParams.get('bbox').split(',').map(Number);
   if(terrain&&state.refuseTerrain){exports.push({url:url.href,size,bbox,status:503});await route.fulfill({status:503,contentType:'text/plain',body:'Controlled metadata refusal before provider contact'});return;}
   const id=++serial,href='https://basemap.nationalmap.gov/density-'+(terrain?'terrain':'streets')+'-'+id+'.svg';
   const extent=fixedExtent??{xmin:bbox[0],ymin:bbox[1],xmax:bbox[2],ymax:bbox[3],spatialReference:{wkid:4326}};
   const record={url:url.href,size,bbox,status:200,href,extent};exports.push(record);objects.set(href,{size,id});
   await route.fulfill({json:{href,width:size[0],height:size[1],extent}});
  }else{
   const object=objects.get(url.href);assert.ok(object,'Only the image returned by an admitted metadata record is requested');images.push(url.href);
   await route.fulfill({contentType:'image/svg+xml',body:imageBody(...object.size,object.id)});
  }
 });
 return {exports,images,state};
}
async function fixedMap(page,theme){
 await page.route('**/map-density-fixture.html',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="en" data-appearance="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="appearance.css"><style>main{width:100%;max-width:none;padding:0}#density-map{display:block;width:100%;height:auto}#density-host{padding:8px}select{max-width:100%;font:inherit}.geography-controls p,.geography-controls a{overflow-wrap:anywhere}</style></head><body><main><h1>Controlled geographic consumer</h1><p>Fixed source extent for raster sizing and registration. This is a browser fixture, not tornado evidence.</p><div id="density-host"></div><svg id="density-map" viewBox="0 0 960 480" role="group" aria-label="Controlled map"><path class="map-path" d="M80 400L880 80"/></svg><output id="fixture-clock">Unchanged documentary time</output></main><script type="module">import {mountGeography} from './geography-view.mjs';import {mountMapNavigation} from './map-navigation.mjs';const svg=document.getElementById('density-map');mountMapNavigation(svg,{extent:[0,0,960,480]});mountGeography(svg,([lon,lat])=>[(lon+98)*960,(35.5-lat)*960],document.getElementById('density-host'));document.body.dataset.fixtureReady='true';</script></body></html>`}));
 await page.goto(base+'/map-density-fixture.html');await page.locator('#density-map').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('#density-map')?.classList.contains('has-basemap'));
}
async function displayed(page,id,expected=null){
 await page.waitForFunction(({mapId,href})=>{const map=document.getElementById(mapId),image=map?.querySelector('.basemap-layer image:not([style*="hidden"])');return map?.classList.contains('has-basemap')&&image&&(href===null||image.getAttribute('href')===href);},{mapId:id,href:expected});
 return page.locator('#'+id+' .basemap-layer image:not([style*="hidden"])').evaluate(node=>Object.fromEntries(['href','x','y','width','height','preserveAspectRatio'].map(key=>[key,node.getAttribute(key)])));
}
async function capture(page,id,name){if(process.env.ATLAS_MAP_DENSITY_CAPTURE){await mkdir(process.env.ATLAS_MAP_DENSITY_CAPTURE,{recursive:true});await page.locator('#'+id).screenshot({scale:'css',path:path.join(process.env.ATLAS_MAP_DENSITY_CAPTURE,name+'.png')});}}

for(const c of cases)for(const theme of ['dark','light'])test('actual geographic consumer fixed extent CSS'+c.width+' DPR'+c.dpr+' '+theme,{timeout:20000},async t=>{
 const page=await fixture(t,{viewport:{width:c.width,height:c.height},deviceScaleFactor:c.dpr,colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'}),provider=await mockGeography(page,{fixedExtent:returnedExtent});
 await fixedMap(page,theme);const first=provider.exports[0];assert.deepEqual(first.bbox,fullBounds);assert.deepEqual(first.size,c.size);assert.equal(provider.exports.length,1);assert.equal(provider.images.length,1);
 const actual=await displayed(page,'density-map');assert.equal(actual.href,first.href);assert.equal(actual.preserveAspectRatio,'none');
 for(const [key,wanted]of [['x',-48],['y',-48],['width',1056],['height',576]])assert.ok(Math.abs(Number(actual[key])-wanted)<1e-7,key+' uses the actual returned extent');
 const source=page.locator('#density-host').getByRole('link',{name:'Open displayed reference image',exact:true});
 await page.locator('#density-host details summary').click();assert.equal(await source.getAttribute('href'),actual.href);
 const sourceDimensions=await page.evaluate(async href=>{const img=new Image();img.src=href;await img.decode();return [img.naturalWidth,img.naturalHeight];},actual.href);
 assert.deepEqual(sourceDimensions,c.size,'This controlled SVG has the declared source dimensions; this is not a native USGS PNG claim');
 await page.locator('#density-map').evaluate(node=>{node.dispatchEvent(new CustomEvent('mapviewchange'));node.dispatchEvent(new CustomEvent('mapviewchange'));});await page.waitForTimeout(400);
 assert.equal(provider.exports.length,1,'Repeated unchanged view events reuse the successful request');
 await page.setViewportSize({width:c.width-1,height:c.height});await page.waitForTimeout(450);assert.equal(provider.exports.length,1,'A same-bucket CSS resize does not refetch');
 if(c.width===320){await page.setViewportSize({width:384,height:c.height});await page.waitForFunction(()=>document.querySelector('#density-map .basemap-layer image')?.getAttribute('href')?.endsWith('streets-2.svg'));assert.deepEqual(provider.exports[1].size,[768,384]);}
 await page.locator('#density-map').focus();const previous=await page.locator('#density-map').getAttribute('viewBox'),zoomResponse=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/export'));await page.keyboard.press('+');
 await page.waitForFunction(value=>document.getElementById('density-map').getAttribute('viewBox')!==value,previous);await zoomResponse;await displayed(page,'density-map',provider.exports.at(-1).href);
 assert.notDeepEqual(provider.exports.at(-1).bbox,fullBounds,'Keyboard zoom changes bounds, not source chronology');
 const homeResponse=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/export'));await page.keyboard.press('Home');await homeResponse;await displayed(page,'density-map',provider.exports.at(-1).href);assert.deepEqual(provider.exports.at(-1).bbox,fullBounds);
 assert.equal(await page.locator('#fixture-clock').textContent(),'Unchanged documentary time');
 await page.evaluate(()=>{for(const node of document.querySelectorAll('#density-host p,#density-host a,#density-host select,#density-host summary'))node.style.fontSize=parseFloat(getComputedStyle(node).fontSize)*2+'px';});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await capture(page,'density-map',`density-${c.width}-dpr${c.dpr}-${theme}`);
 t.diagnostic(JSON.stringify({css_viewport:[c.width,c.height],dpr:c.dpr,requested:first.size,returned_source_kind:'controlled SVG',returned_extent:returnedExtent,provider_contact:false,scope:'Actual consumer sizing, registration, cache and keyboard behavior. Separate native PNG audit and article acceptance remain distinct.'}));
});

test('native geographic image callbacks and failed metadata cannot restore a retired mode',{timeout:20000},async t=>{
 const page=await fixture(t,{viewport:{width:320,height:844},deviceScaleFactor:2,reducedMotion:'reduce',serviceWorkers:'block'}),provider=await mockGeography(page,{fixedExtent:returnedExtent});
 await fixedMap(page,'dark');
 await page.evaluate(()=>{
  window.retiredDensity=[];const set=SVGImageElement.prototype.setAttribute,add=SVGImageElement.prototype.addEventListener;
  SVGImageElement.prototype.setAttribute=function(name,value){if(name==='href'&&String(value).includes('/density-terrain-')){window.retiredDensity.push({node:this,href:value});return;}return set.call(this,name,value);};
  SVGImageElement.prototype.addEventListener=function(name,fn,...options){const row=window.retiredDensity.find(row=>row.node===this);if(row&&(name==='load'||name==='error'))row[name]=fn;return add.call(this,name,fn,...options);};
 });
 await page.locator('#density-map-geography').selectOption('terrain');await page.waitForFunction(()=>window.retiredDensity.length===1&&typeof window.retiredDensity[0].load==='function');
 await page.locator('#density-map-geography').selectOption('none');assert.equal(await page.locator('#density-map .basemap-layer image').count(),0);
 await page.locator('#density-map-geography').selectOption('streets');const current=await displayed(page,'density-map');
 await page.evaluate(()=>{const old=window.retiredDensity[0];old.load.call(old.node,new Event('load'));old.error.call(old.node,new Event('error'));});assert.deepEqual(await displayed(page,'density-map'),current);
 provider.state.refuseTerrain=true;await page.locator('#density-map-geography').selectOption('terrain');
 await page.waitForFunction(()=>document.querySelector('#density-host [role="status"]').textContent.includes('could not be loaded'));
 assert.equal(await page.locator('#density-map .basemap-layer image').count(),0);
 assert.equal(await page.locator('#density-host').getByRole('link',{name:'Open displayed reference image',exact:true}).isVisible(),false);
 assert.equal(provider.exports.at(-1).status,503);
 await page.locator('#density-map-geography').selectOption('streets');await displayed(page,'density-map');assert.match(await page.locator('#density-host [role="status"]').textContent(),/roads and towns geography loaded/);
 assert.equal(await page.locator('#density-map .map-path').getAttribute('d'),'M80 400L880 80');
 t.diagnostic('Controlled callback and 503 refusal occur before provider contact. Successful source/image controls remain separate.');
});

for(const c of cases)for(const route of ['index.html#path','survey.html'])test('published map caller at CSS'+c.width+' DPR'+c.dpr+' '+route,{timeout:25000},async t=>{
 const page=await fixture(t,{viewport:{width:c.width,height:c.height},deviceScaleFactor:c.dpr,reducedMotion:'reduce',serviceWorkers:'block'}),provider=await mockGeography(page);
 const id=route.startsWith('index')?'map':'survey-map';await page.goto(base+'/'+route);await page.locator('#'+id+'-geography').waitFor();await page.locator('#'+id).scrollIntoViewIfNeeded();
 const current=await displayed(page,id),record=provider.exports.find(row=>row.href===current.href);assert.ok(record);
 assert.ok(record.size.every(value=>Number.isInteger(value)&&value>0&&value<=4096));assert.ok(record.size[0]*record.size[1]<=4194304);
 const controls=page.locator('#'+id+'-geography').locator('xpath=ancestor::*[contains(@class,"geography-controls")]');await controls.locator('details summary').click();
 const source=controls.getByRole('link',{name:'Open displayed reference image',exact:true});assert.equal(await source.isVisible(),true);
 assert.equal(await source.getAttribute('href'),current.href);assert.ok(record.bbox.every(Number.isFinite));
 const view=await page.locator('#'+id).getAttribute('viewBox'),clock=route.startsWith('index')?await page.locator('#clock').textContent():null;
 const geometry=await page.locator('#'+id+' .map-path').first().getAttribute('d').catch(()=>null);
 for(const theme of ['light','dark']){await page.locator('#reading-appearance').selectOption(theme);assert.equal((await displayed(page,id)).href,current.href);assert.equal(await page.locator('#'+id).getAttribute('viewBox'),view);}
 if(geometry!==null)assert.equal(await page.locator('#'+id+' .map-path').first().getAttribute('d'),geometry);
 if(clock!==null)assert.equal(await page.locator('#clock').textContent(),clock);
 await page.locator('#'+id+'-geography').selectOption('none');await page.waitForFunction(mapId=>!document.getElementById(mapId).classList.contains('has-basemap'),id);
 assert.equal(await page.locator('#'+id+' .basemap-layer image').count(),0);assert.equal(await source.isVisible(),false);
 await page.locator('#'+id+'-geography').selectOption('streets');const recovered=await displayed(page,id);assert.notEqual(recovered.href,current.href,'Explicit re-entry obtains its new current source');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await capture(page,id,`caller-${id}-${c.width}-dpr${c.dpr}`);
 t.diagnostic(JSON.stringify({route,css_viewport:[c.width,c.height],dpr:c.dpr,source_request:record.url,returned_extent:record.extent,rendered_source:current,provider_contact:false,scope:'Current article caller and controlled geography response, not real provider availability or physical display certification.'}));
});
