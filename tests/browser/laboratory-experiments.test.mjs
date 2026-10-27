import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,base} from './harness.mjs';
import {observeLabReferenceNavigation} from './lab-reference-navigation-diagnostics.mjs';
import {observeFormResetPassively} from './form-reset-diagnostics.mjs';

const events=[
  ['el-reno-2013','El Reno · 2013','index.html#photos','index.html#damage'],
  ['joplin-2011','Joplin · 2011','joplin.html#photographs-and-film','joplin.html#hospital-envelope'],
  ['blackwell-1955','Blackwell · 1955','blackwell.html#observations','blackwell.html#pressure-damage'],
  ['tuscaloosa-birmingham-2011','Tuscaloosa and Birmingham · 2011','tuscaloosa.html#photographs-and-film','tuscaloosa.html#damage']
];
async function requiredFonts(page){
 const deadline=Date.now()+10000;
 while(await page.evaluate(()=>document.fonts.status)!=='loaded'){
  assert.ok(Date.now()<deadline,'Required font loading must settle within 10 seconds');await delay(50);
 }
}
async function referenceGeometry(page){return page.locator('#lab-context').evaluate(host=>{
 const select=host.querySelector('select'),box=select.getBoundingClientRect(),style=getComputedStyle(select);
 return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,select:{value:select.value,appearance:style.appearance,left:box.left,right:box.right,width:box.width,client:select.clientWidth,scroll:select.scrollWidth},fragments:[...host.querySelectorAll('h2,p,label,a')].flatMap(node=>{const range=document.createRange();range.selectNodeContents(node);return [...range.getClientRects()].filter(r=>r.width>0).map(r=>({tag:node.tagName,left:r.left,right:r.right}));}),overflow:[...host.querySelectorAll('*')].map(node=>{const r=node.getBoundingClientRect();return {tag:node.tagName,id:node.id,left:r.left,right:r.right,client:node.clientWidth,scroll:node.scrollWidth};}).filter(r=>r.client>0&&(r.right>innerWidth+1||r.scroll>r.client+1)).slice(0,16)};
});}
async function ready(page){await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();}
async function input(page,id,value){await page.locator('#'+id).evaluate((node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},String(value));}
async function windState(page){return page.evaluate(()=>({
  controls:Object.fromEntries(['peak','radius','background','probe-x','probe-y','area','coefficient','travel','offset','threshold','capacity','passage-time','component-time'].map(id=>[id,document.getElementById(id).value])),
  labels:Object.fromEntries(['probe-speed','probe-pressure','probe-force','passage-now','passage-force','passage-peak','passage-duration','component-now','component-peak','component-first','component-state','sampled-values-assumptions','sampled-values-selection'].map(id=>[id,document.getElementById(id).textContent])),
  graph:document.getElementById('passage-line').getAttribute('d'),
  rows:[...document.querySelectorAll('#sampled-values-body tr')].map(row=>({current:row.getAttribute('aria-current'),cells:[...row.cells].map(cell=>[cell.textContent,cell.dataset.value??null])}))
}));}
async function formState(page){return page.evaluate(()=>({
  controls:Object.fromEntries(['shape','condensation','azimuth','elevation','distance','quality','sequence-coverage','sequence-rate','sequence-time'].map(id=>[id,document.getElementById(id).value])),
  switches:Object.fromEntries(['dust','sequence-enabled'].map(id=>[id,document.getElementById(id).checked])),
  text:Object.fromEntries(['scene-form','sequence-progress','sequence-stage','sequence-coverage-note'].map(id=>[id,document.getElementById(id).textContent]))
}));}
async function paused(page,kind){
  if(kind==='wind'){assert.equal(await page.locator('#passage-play').textContent(),'Play passage');assert.equal(await page.locator('#component-play').textContent(),'Play passage');assert.equal(await page.locator('#wind-motion').textContent(),'Play tracers');}
  else assert.equal(await page.locator('#motion').textContent(),'Play motion');
}
for(const width of [320,1280])test('Wind experiment restores the same assumptions and complete table across four documentary references '+width,{timeout:60000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},isMobile:width<600,reducedMotion:'reduce',serviceWorkers:'block'});
  await page.goto(base+'/wind.html?event=el-reno-2013');await ready(page);
  const values={peak:125,radius:650,background:20,'probe-x':1.3,'probe-y':-.4,area:2.1,coefficient:1.3,travel:45,offset:-.7,threshold:75,capacity:1.6};
  for(const [id,value] of Object.entries(values))await input(page,id,value);
  await input(page,'component-time',300);
  const expected=await windState(page);assert.equal(expected.rows.length,481);
  assert.equal(expected.controls['passage-time'],'300');assert.equal(expected.controls['component-time'],'300');
  assert.equal(expected.rows.filter(row=>row.current==='true').length,1);assert.equal(expected.rows[300].current,'true');
  assert.match(expected.labels['sampled-values-assumptions'],/Peak swirl 125.0 mph, core radius 650 ft/);
  for(const [id,title,,windRoute] of events){
    await page.locator('#lab-event').selectOption(id);
    assert.deepEqual(await windState(page),expected,'Reference selection cannot modify an assumed experiment');
    assert.equal(await page.locator('#lab-reference-links a').first().getAttribute('href'),windRoute);
    assert.ok((await page.locator('#lab-reference-links').textContent()).includes(title));
  }
  await page.goBack();await ready(page);assert.equal(await page.locator('#lab-event').inputValue(),'blackwell-1955');assert.deepEqual(await windState(page),expected);
  await page.goForward();assert.equal(await page.locator('#lab-event').inputValue(),'tuscaloosa-birmingham-2011');
  await page.locator('#lab-share').click();await paused(page,'wind');
  const saved=page.url();assert.equal(new URL(saved).searchParams.get('experiment'),'wind-1');assert.equal(new URL(saved).searchParams.get('sample'),'300');
  await page.locator('#lab-reference-links a').first().click();await page.waitForURL('**/tuscaloosa.html#damage');
  await page.goBack();await ready(page);assert.deepEqual(await windState(page),expected);await paused(page,'wind');
  await page.reload();await ready(page);assert.equal(page.url(),saved);assert.deepEqual(await windState(page),expected);await paused(page,'wind');
  await page.locator('#wind-reset').click();
  await page.waitForFunction(()=>document.getElementById('travel').value==='30'&&document.getElementById('capacity').value==='1');
  assert.equal(await page.locator('#lab-event').inputValue(),'tuscaloosa-birmingham-2011');
  assert.equal(await page.locator('#peak').inputValue(),'100');assert.equal(await page.locator('#passage-time').inputValue(),'0');
});
for(const width of [320,1280])test('Form experiment retains its authored gap and controls across four documentary references '+width,{timeout:60000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},isMobile:width<600,reducedMotion:'reduce',serviceWorkers:'block'});
  const resetDiagnostic=await observeFormResetPassively(t,page,{width});
  let originalFailed=false,originalError;
  try{
  await page.goto(base+'/study.html?event=el-reno-2013');await ready(page);
  await page.locator('#sequence-enabled').uncheck();await page.locator('#shape').selectOption('rope');
  for(const [id,value] of Object.entries({condensation:65,azimuth:-35,elevation:24,distance:8.2}))await input(page,id,value);
  await page.locator('#dust').uncheck();await page.locator('#quality').selectOption('3600');
  await page.locator('#sequence-coverage').selectOption('bounded');await page.locator('#sequence-rate').selectOption('15');
  await page.locator('#sequence-enabled').check();await input(page,'sequence-time',.5);
  const expected=await formState(page);assert.match(expected.text['sequence-stage'],/No assigned form between 10 and 22 seconds/);
  assert.equal(expected.controls['sequence-time'],'0.5');
  for(const [id,,formRoute] of events){
    await page.locator('#lab-event').selectOption(id);assert.deepEqual(await formState(page),expected);
    assert.equal(await page.locator('#lab-reference-links a').first().getAttribute('href'),formRoute);
  }
  await page.goBack();assert.equal(await page.locator('#lab-event').inputValue(),'blackwell-1955');assert.deepEqual(await formState(page),expected);
  await page.goForward();assert.equal(await page.locator('#lab-event').inputValue(),'tuscaloosa-birmingham-2011');
  await page.locator('#lab-share').click();await paused(page,'form');
  const saved=page.url();assert.equal(new URL(saved).searchParams.get('position'),'0.5');assert.equal(new URL(saved).searchParams.get('phase'),'15');
  await page.locator('#lab-reference-links a').first().click();await page.waitForURL('**/tuscaloosa.html#photographs-and-film');
  await page.goBack();await ready(page);assert.deepEqual(await formState(page),expected);await paused(page,'form');
  await page.reload();await ready(page);assert.equal(page.url(),saved);assert.deepEqual(await formState(page),expected);await paused(page,'form');
  await page.locator('#reset-view').click();assert.equal(await page.locator('#azimuth').inputValue(),'25');assert.equal(await page.locator('#sequence-time').inputValue(),'0');
  assert.equal(await page.locator('#shape').inputValue(),'rope','Reset view retains the chosen form');
  assert.equal(await page.locator('#lab-event').inputValue(),'tuscaloosa-birmingham-2011');
  }catch(error){originalFailed=true;originalError=error;throw error;}
  finally{await resetDiagnostic.report(originalFailed,originalError);}
});
for(const [kind,file] of [['wind','wind.html'],['form','study.html']])test('Refused '+kind+' links apply no partial event or assumptions and remain refused through layout callbacks',{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:700},reducedMotion:'reduce',serviceWorkers:'block'});
  for(const query of ['event=joplin-2011&experiment='+kind+'-1&'+(kind==='wind'?'peak=140':'shape=rope'),'event=unreviewed','event=joplin-2011&event=blackwell-1955']){
    await page.goto(base+'/'+file+'?'+query);await ready(page);
    assert.equal(await page.locator('#lab-state').getAttribute('data-state'),'invalid');assert.match(await page.locator('#lab-state').textContent(),/No values from the link were applied/);
    assert.equal(await page.locator('#lab-event').inputValue(),'');
    assert.equal(await page.locator(kind==='wind'?'#peak':'#shape').inputValue(),kind==='wind'?'100':'cone');
    await page.locator(kind==='wind'?'#passage':'#scene').scrollIntoViewIfNeeded();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(new URL(page.url()).search,'?'+query);assert.equal(await page.locator('#lab-state').getAttribute('data-state'),'invalid');
    await paused(page,kind);
  }
});
for(const file of ['wind.html','study.html'])test(file+' retains native documentary reading without scripts and does not claim URL restoration',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:800},serviceWorkers:'block'});
  await page.goto(base+'/'+file+'?event=joplin-2011&experiment=wind-1&peak=200');
  assert.equal(await page.locator('#lab-enhancement').isVisible(),false);
  assert.deepEqual(await page.locator('#lab-documentary-fallback a').evaluateAll(nodes=>nodes.map(node=>[node.getAttribute('href'),node.textContent])),[
    ['index.html','El Reno documentary'],['joplin.html','Joplin documentary'],['blackwell.html','Blackwell documentary'],['tuscaloosa.html','Tuscaloosa and Birmingham documentary'],['moore.html','Newcastle and Moore documentary'],['udall.html','Udall documentary']
  ]);
  assert.match(await page.locator('#lab-context noscript').textContent(),/need JavaScript to restore settings/);
  if(file==='wind.html'){assert.equal(await page.locator('#sampled-values-body tr').count(),481);assert.match(await page.locator('#sampled-values-static').textContent(),/default experiment/);}
});
test('Form snapshot remains readable and restorable when WebGL is unavailable',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:850},reducedMotion:'reduce',serviceWorkers:'block'});
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});
  const query='experiment=form-1&event=blackwell-1955&shape=rope&condensation=65&azimuth=-35&elevation=24&distance=8.2&dust=0&quality=3600&sequence=1&coverage=bounded&rate=15&position=0.5&phase=15';
  await page.goto(base+'/study.html?'+query);await ready(page);
  assert.equal(await page.locator('#scene-failure').isVisible(),true);assert.equal(await page.locator('#motion').isDisabled(),true);
  assert.equal(await page.locator('#shape').inputValue(),'rope');assert.equal(await page.locator('#sequence-time').inputValue(),'0.5');
  await page.locator('#lab-event').selectOption('joplin-2011');assert.equal(await page.locator('#sequence-time').inputValue(),'0.5');
  assert.match(await page.locator('#motion-status').textContent(),/WebGL 2 is unavailable/);
  assert.equal(await page.locator('#lab-reference-links a').first().getAttribute('href'),'joplin.html#photographs-and-film');
});
for(const [kind,file] of [['wind','wind.html'],['form','study.html']])test(kind+' reference and share controls retain enlarged narrow keyboard reading',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:800},reducedMotion:'reduce',serviceWorkers:'block'});
  await page.goto(base+'/'+file+'?event=tuscaloosa-birmingham-2011');await ready(page);
  await page.locator('#lab-reference-evidence[data-state="ready"]').waitFor();
  await page.locator('#lab-context').evaluate(host=>{const sizes=[...host.querySelectorAll('h2,p,label,select,a')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);for(const [node,size] of sizes)node.style.fontSize=size*2+'px';});
  const corrected=await referenceGeometry(page);
  // Compare the previous native appearance under the same actual font sizes.
  await page.locator('#lab-event').evaluate(node=>{node.style.appearance='auto';node.style.webkitAppearance='auto';});
  const previousNative=await referenceGeometry(page);
  await page.locator('#lab-event').evaluate(node=>{node.style.removeProperty('appearance');node.style.removeProperty('-webkit-appearance');});
  console.log('LAB_SELECT_REFLOW '+JSON.stringify({kind,corrected,previousNative}));
  assert.ok(corrected.documentWidth<=corrected.viewport+1,'Narrow enlarged reference must reflow: '+JSON.stringify(corrected));
  for(const rect of corrected.fragments)assert.ok(rect.left>=-1&&rect.right<=corrected.viewport+1,'Complete enlarged text fragment '+JSON.stringify(rect));
  assert.equal(await page.locator('#lab-event').inputValue(),'tuscaloosa-birmingham-2011');
  assert.match(await page.locator('#lab-reference-account').innerText(),/./);
  await page.locator('#lab-event').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#lab-reference-links a')),true);
  const orderedLinks=page.locator('#lab-reference-links a,#lab-reference-evidence a,#lab-share');
  assert.ok(await orderedLinks.count()>=9,'Current evidence and source routes precede Share');
  for(let i=1;i<await orderedLinks.count();i++){
    await page.keyboard.press('Tab');
    assert.equal(await orderedLinks.nth(i).evaluate(node=>node===document.activeElement),true,'Native tab order at documentary link '+i);
  }
  assert.equal(await page.locator('#lab-share').evaluate(node=>node===document.activeElement),true);
  await page.keyboard.press('Enter');await paused(page,kind);assert.equal(new URL(page.url()).searchParams.get('event'),'tuscaloosa-birmingham-2011');
});

test('Unavailable Wind 2D drawing preserves restored numeric and complete sampled consumers',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:850},reducedMotion:'reduce',serviceWorkers:'block'});
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return this.id==='wind-field'&&type==='2d'?null:original.call(this,type,...args);};});
  const query='experiment=wind-1&event=joplin-2011&peak=100&radius=500&background=20&probe-x=1&probe-y=0&area=1&coefficient=1.2&travel=30&offset=-0.7&threshold=50&capacity=1.6&sample=480';
  await page.goto(base+'/wind.html?'+query);await ready(page);
  assert.equal(await page.locator('#wind-field-failure').isVisible(),true);assert.equal(await page.locator('#wind-motion').isDisabled(),true);
  assert.equal(await page.locator('#probe-speed').textContent(),'102.0 mph','Orthogonal assumed 100 and 20 mph components retain their numeric result');
  assert.equal(await page.locator('#passage-time').inputValue(),'480');assert.equal(await page.locator('#component-time').inputValue(),'480');
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);assert.equal(await page.locator('#passage-sample-480').getAttribute('aria-current'),'true');
  assert.equal(await page.locator('#component-state').textContent(),'Failed under this rule');
  await page.locator('#lab-event').selectOption('blackwell-1955');
  assert.equal(await page.locator('#capacity').inputValue(),'1.6');assert.equal(await page.locator('#component-state').textContent(),'Failed under this rule');
  await input(page,'capacity',20);assert.equal(await page.locator('#component-state').textContent(),'Capacity not exceeded so far');
  assert.equal(await page.locator('#passage-sample-480 td').last().textContent(),'Capacity not exceeded so far');
  await page.reload();await ready(page);await paused(page,'wind');
  assert.equal(await page.locator('#capacity').inputValue(),'20');assert.equal(await page.locator('#passage-time').inputValue(),'480');
  assert.equal(await page.locator('#component-state').textContent(),'Capacity not exceeded so far');
  assert.equal(await page.locator('#lab-reference-links a').first().getAttribute('href'),'blackwell.html#pressure-damage');
  assert.equal(await page.locator('#wind-field-failure').isVisible(),true);
});

const articleEntries=[['index.html','el-reno-2013','study.html'],['joplin.html','joplin-2011','wind.html'],['blackwell.html','blackwell-1955','study.html'],['tuscaloosa.html','tuscaloosa-birmingham-2011','wind.html']];
for(const width of [320,1280])test('Every article opens its documentary reference in an assumed laboratory by keyboard '+width,{timeout:60000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
 const diagnostics=width===1280?await observeLabReferenceNavigation(t,page,{base,label:'keyboard-article-entry-'+width}):null;
 try{
 for(const [file,event,labFile] of articleEntries){
  await page.goto(base+'/'+file);const entry=page.locator('.article-laboratory');await entry.waitFor();
  for(const target of ['study.html','wind.html'])assert.equal(await entry.locator('a[href="'+target+'?event='+event+'"]').count(),1);
  const link=entry.locator('a[href="'+labFile+'?event='+event+'"]');await link.focus();assert.equal(await link.evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Enter');await ready(page);
  assert.equal(new URL(page.url()).pathname.endsWith('/'+labFile),true);assert.equal(await page.locator('#lab-event').inputValue(),event);assert.match(await page.locator('#lab-reference-account').innerText(),/./);
  assert.equal(await page.locator(labFile==='study.html'?'#motion':'#passage-play').innerText(),labFile==='study.html'?'Play motion':'Play passage');
  await page.goBack();await entry.waitFor();assert.equal(new URL(page.url()).pathname.endsWith('/'+file),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 }finally{diagnostics?.report('body_finished');}
});

for(const width of [320,1280])test('Wind field labels remain distinct and visible as the probe moves '+width,{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await page.addInitScript(()=>{
    const fill=CanvasRenderingContext2D.prototype.fillText;window.windLabelBounds={};
    CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){
      if(this.canvas.id==='wind-field'&&(text==='N ↑'||text==='PROBE'||/^R = /.test(text))){
        const m=this.measureText(text),key=text.startsWith('R = ')?'radius':text;
        window.windLabelBounds[key]={text,left:x-m.actualBoundingBoxLeft,right:x+m.actualBoundingBoxRight,top:y-m.actualBoundingBoxAscent,bottom:y+m.actualBoundingBoxDescent};
      }
      return fill.call(this,text,x,y,...rest);
    };
  });
  await page.goto(base+'/wind.html');await ready(page);
  for(const radius of [500,2000])for(const [x,y] of [[1,0],[-2.5,2.5],[2.5,2.5],[-2.5,-2.5],[2.5,-2.5],[0,2.5],[0,-2.5]]){
    await input(page,'radius',radius);await input(page,'probe-x',x);await input(page,'probe-y',y);
    const actual=await page.evaluate(()=>({labels:Object.values(window.windLabelBounds),width:document.getElementById('wind-field').clientWidth,height:document.getElementById('wind-field').clientHeight}));
    assert.equal(actual.labels.length,3);assert.ok(actual.labels.some(row=>row.text==='R = '+radius+' ft'));
    for(const label of actual.labels)assert.ok(label.left>=0&&label.right<=actual.width&&label.top>=0&&label.bottom<=actual.height,JSON.stringify(label));
    for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){const a=actual.labels[i],b=actual.labels[j];assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,'Labels overprint: '+a.text+' / '+b.text);}
  }
});

for(const enabled of [false,true])test('Article experiment entry preserves enlarged spaced text, scripts '+enabled,{timeout:45000},async t=>{
 const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:enabled,reducedMotion:'reduce'});
 for(const file of ['index.html','joplin.html','blackwell.html','tuscaloosa.html']){
  t.diagnostic('Enlarged entry '+file+': navigation, scripts '+enabled);
  await page.goto(base+'/'+file);await requiredFonts(page);t.diagnostic('Enlarged entry '+file+': font state loaded, applying exact doubled sizes');
  await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')],sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');document.getElementById('laboratory-entry-title').style.letterSpacing='.12em';});
  t.diagnostic('Enlarged entry '+file+': measuring complete heading');
  const heading=page.locator('#laboratory-entry-title');await heading.scrollIntoViewIfNeeded();assert.equal(await heading.textContent(),'Explore an assumed experiment.');
  const layout=await heading.evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,headingWidth:node.clientWidth,headingScroll:node.scrollWidth,fragments:[...range.getClientRects()].map(r=>({left:r.left,right:r.right,width:r.width}))};});
  if(layout.documentWidth>layout.width+1||layout.headingScroll>layout.headingWidth+1)console.log('EXPERIMENT_ENTRY_REFLOW '+JSON.stringify({file,enabled,...layout}));
  assert.ok(layout.documentWidth<=layout.width+1,file+' enlarged document');assert.ok(layout.headingScroll<=layout.headingWidth+1,file+' complete heading');
  for(const fragment of layout.fragments)assert.ok(fragment.left>=-1&&fragment.right<=layout.width+1,file+' visible text fragment');
  assert.equal(await page.locator('.article-laboratory a').count(),2);
 }
});
