import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

// Retained departure from the failed full catalogue check. This is a saved
// map view, distinct from the source record's reported tornado location.
const view='36.72004,-97.28016,12';
const route='/atlas.html?exhibits=1&view='+encodeURIComponent(view)+'&layer=local&panel=detail#record=ncei%3A10096417';
const source='https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1955_c20260323.csv.gz';
async function settled(page){
 await page.waitForFunction(()=>document.body.dataset.ready==='true'&&document.querySelector('#detail .source-link'));
 await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function exact(page){
 assert.equal(new URL(page.url()).searchParams.get('view'),view,'A layout resize preserves the independently retained saved view');
 assert.equal(new URL(await page.locator('#search-link').getAttribute('href'),page.url()).href,page.url());
 assert.equal(await page.locator('#detail .eyebrow').textContent(),'ncei:10096417');
 assert.equal(await page.locator('#detail .source-link').getAttribute('href'),source);
 assert.equal(await page.locator('#exhibits').isChecked(),true);
}
for(const [width,theme] of [[320,'dark'],[1280,'light']])test('saved map center survives layout and native Blackwell history '+width+' '+theme,{timeout:28000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
 await page.addInitScript(theme=>localStorage.setItem('tornado-atlas-appearance',theme),theme);
 await page.goto(base+route);await settled(page);await exact(page);
 if(width===320){await page.locator('#show-map').click();await settled(page);await exact(page);}
 await page.locator('#expand-map').click();await settled(page);await exact(page);
 await page.locator('#expand-map').click();await settled(page);await exact(page);
 for(const height of [901,900]){await page.setViewportSize({width,height});await settled(page);await exact(page);}
 if(width===320)await page.locator('#show-detail').click();
 const link=page.getByRole('link',{name:'Open reviewed exhibit',exact:true});
 await link.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
 assert.equal(await link.evaluate(node=>node===document.activeElement),true);
 const departure=page.url();await page.keyboard.press('Enter');await page.waitForURL(base+'/blackwell.html');
 await page.goBack();await settled(page);await exact(page);assert.equal(page.url(),departure);
 await page.goForward();await page.waitForURL(base+'/blackwell.html');
 await page.goBack();await settled(page);await exact(page);assert.equal(page.url(),departure);
 if(width===320)await page.locator('#show-map').click();
 const map=page.locator('#world-map');await map.focus();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(before=>new URL(location.href).searchParams.get('view')!==before,view);
 assert.equal(new URL(page.url()).hash,'#record=ncei%3A10096417');
 assert.equal(new URL(await page.locator('#search-link').getAttribute('href'),page.url()).href,page.url());
 assert.equal(await page.locator('#detail .source-link').getAttribute('href'),source);
 const chosen=new URL(page.url()).searchParams.get('view');
 await page.setViewportSize({width,height:903});await settled(page);
 assert.equal(new URL(page.url()).searchParams.get('view'),chosen,'A genuine resize preserves the newer native pan');
 assert.equal(new URL(await page.locator('#search-link').getAttribute('href'),page.url()).href,page.url());
});

async function actualComponent(expected){
 const {mountExplorerMap}=await import('./explorer-map.mjs');
 const host=document.getElementById('component-map'),factory=L.map,NativeObserver=ResizeObserver;
 let nativeMap,observerCalls=0,ui;const publications=[];
 L.map=function(...args){nativeMap=Reflect.apply(factory,this,args);return nativeMap;};
 window.ResizeObserver=class extends NativeObserver{constructor(callback){super((...args)=>{callback(...args);observerCalls++;});}};
 try{ui=mountExplorerMap(host,{onSelect(){},onGroup(){},onCount(){},onStatus(){},onView(){const c=nativeMap.getCenter();publications.push([c.lat,c.lng,nativeMap.getZoom()]);}});}
 finally{L.map=factory;window.ResizeObserver=NativeObserver;}
 const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const read=()=>{const c=nativeMap.getCenter(),size=nativeMap.getSize();return {public_view:ui.view(),native_view:[c.lat,c.lng,nativeMap.getZoom()],cached_size:[size.x,size.y],visible_size:[host.clientWidth,host.clientHeight],publications:publications.map(row=>[...row]),observer_calls:observerCalls};};
 ui.setView(expected);publications.length=0;ui.resize();await frame();
 window.mapResizeControl={initial:read(),change:async height=>{publications.length=0;host.style.height=height+'px';await frame();return read();}};
}
for(const width of [320,1280])test('actual map center and publication survive pixel parity '+width,{timeout:15000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
 const expected=[36.72004,-97.28016,12],hostWidth=width-32;
 const script='('+actualComponent.toString()+')('+JSON.stringify(expected)+')';
 const html='<!doctype html><html><head><link rel="stylesheet" href="vendor/leaflet/leaflet.css"></head><body><div id="component-map" style="width:'+hostWidth+'px;height:420px"></div><script src="vendor/leaflet/leaflet.js"></script><script type="module">'+script+'</script></body></html>';
 await page.route(base+'/map-resize-control.html',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
 await page.goto(base+'/map-resize-control.html');await page.waitForFunction(()=>window.mapResizeControl);
 const initial=await page.evaluate(()=>window.mapResizeControl.initial);
 assert.deepEqual(initial.public_view,expected);assert.deepEqual(initial.native_view,expected);
 assert.deepEqual(initial.publications,[],'Unchanged size and the initial native observer publish no new view');
 assert.ok(initial.observer_calls>0,'The actual initial ResizeObserver callback ran');
 const changes=[];
 for(const height of [511,420,501,420]){
  const actual=await page.evaluate(height=>window.mapResizeControl.change(height),height);changes.push(actual);
  assert.deepEqual(actual.visible_size,[hostWidth,height]);assert.deepEqual(actual.cached_size,[hostWidth,height]);
  assert.deepEqual(actual.public_view,expected);assert.deepEqual(actual.native_view,expected);
  assert.deepEqual(actual.publications,[expected],'Each genuine resize publishes only its final exact view');
 }
 t.diagnostic(JSON.stringify({width,expected,initial,changes,scope:'Actual bundled map and adapter in a declared synthetic host. Independent exact interior view, actual native ResizeObserver and public native map geometry. No historical geometry or full visitor acceptance claim.'}));
});
