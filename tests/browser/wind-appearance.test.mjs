import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

// These literal colors express the intended Clair and Obscur reading contract.
const palettes={dark:{slow:[164,164,164],fast:[244,244,244]},light:{slow:[100,98,92],fast:[36,36,36]}};
const fields=['peak','radius','background','probe-x','probe-y','area','coefficient','travel','offset','threshold','capacity'];
const readouts=['probe-speed','probe-si','probe-pressure','probe-force','passage-now','passage-force','component-now','component-first','component-state','reference-maximum-wind','reference-maximum-drag'];
const query='experiment=wind-1&event=moore-2013&peak=100&radius=500&background=0&probe-x=1&probe-y=0&area=1&coefficient=1.2&travel=30&offset=-0.7&threshold=50&capacity=1.6&sample=206';

async function observeDrawing(page){
  await page.addInitScript(()=>{
    const state={frames:0,points:[],cells:[],labels:[]};
    const proto=CanvasRenderingContext2D.prototype;
    const clear=proto.clearRect,arc=proto.arc,fillRect=proto.fillRect,fillText=proto.fillText;
    proto.clearRect=function(...args){
      if(this.canvas.id==='wind-field'){state.frames++;state.points=[];state.cells=[];state.labels=[];}
      return clear.apply(this,args);
    };
    proto.arc=function(x,y,r,...args){
      if(this.canvas.id==='wind-field'&&r===1.15)state.points.push([x,y]);
      return arc.call(this,x,y,r,...args);
    };
    proto.fillRect=function(x,y,width,height){
      if(this.canvas.id==='wind-field')state.cells.push({x,y,width,height,color:this.fillStyle,alpha:this.globalAlpha});
      return fillRect.call(this,x,y,width,height);
    };
    proto.fillText=function(text,x,y,...args){
      if(this.canvas.id==='wind-field')state.labels.push({text,x,y,color:this.fillStyle});
      return fillText.call(this,text,x,y,...args);
    };
    window.windAppearanceProbe=state;
    localStorage.setItem('tornado-atlas-appearance','system');
  });
}
async function ready(page){
  await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>window.windAppearanceProbe?.points.length===260);
  for(const id of ['wind-motion','passage-play','component-play'])assert.match(await page.locator('#'+id).textContent(),/^Play/);
}
async function modelState(page){
  return page.evaluate(({fields,readouts})=>({
    controls:Object.fromEntries(fields.map(id=>[id,document.getElementById(id).value])),
    readouts:Object.fromEntries(readouts.map(id=>[id,document.getElementById(id).textContent])),
    sample:document.getElementById('passage-time').value,
    paired:document.getElementById('component-time').value,
    selected:[...document.querySelectorAll('#sampled-values-body tr[aria-current="true"]')].map(node=>node.id),
    selectedCells:[...document.getElementById('passage-sample-206').cells].map(node=>[node.textContent,node.dataset.value??null]),
    source:document.getElementById('lab-event').value,
    share:document.getElementById('lab-share').getAttribute('href'),
    href:location.href,historyLength:history.length,historyState:history.state
  }),{fields,readouts});
}
async function view(page){
  return page.evaluate(async()=>{
    const canvas=document.getElementById('wind-field'),ctx=canvas.getContext('2d'),style=getComputedStyle(canvas);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const digest=await crypto.subtle.digest('SHA-256',pixels);
    return {frames:window.windAppearanceProbe.frames,
      points:window.windAppearanceProbe.points.map(point=>[...point]),
      cells:window.windAppearanceProbe.cells.map(cell=>({...cell})),
      labels:window.windAppearanceProbe.labels.map(label=>({...label})),
      width:canvas.clientWidth,height:canvas.clientWidth/1.4,
      background:style.backgroundColor,text:style.color,muted:style.getPropertyValue('--muted').trim(),
      slow:style.getPropertyValue('--wind-slow-rgb').trim(),fast:style.getPropertyValue('--wind-fast-rgb').trim(),
      legend:getComputedStyle(document.querySelector('.wind-key i')).backgroundImage,
      hash:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join(''),
      overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
}
function rgb(value){
  if(/^#[0-9a-f]{6}$/i.test(value))return [1,3,5].map(index=>parseInt(value.slice(index,index+2),16));
  const match=/^rgba?\(([^)]+)\)$/.exec(value);
  assert.ok(match,'A native RGB color was observed: '+value);
  const result=match[1].split(/[ ,/]+/).slice(0,3).map(Number);
  assert.ok(result.length===3&&result.every(number=>Number.isFinite(number)&&number>=0&&number<=255));
  return result;
}
function cellAt(drawing,x,y){
  const scale=drawing.height/5.5,left=drawing.width/2+(x-.125)*scale,top=drawing.height/2-(y+.125)*scale;
  const cell=drawing.cells.find(row=>Math.abs(row.x-left)<1e-7&&Math.abs(row.y-top)<1e-7);
  assert.ok(cell,'The actual field includes grid coordinate '+x+','+y);
  return cell;
}
function assertPalette(drawing,scheme){
  const expected=palettes[scheme];
  assert.equal(drawing.slow,expected.slow.join(','));assert.equal(drawing.fast,expected.fast.join(','));
  const legend=drawing.legend.replace(/\s/g,'');
  assert.ok(legend.includes('rgb('+expected.slow.join(',')+')'));
  assert.ok(legend.includes('rgb('+expected.fast.join(',')+')'));
  assert.equal(drawing.cells.length,609);assert.equal(drawing.points.length,260);
  // For this independently fixed zero background fixture, speed is zero at
  // the center and equals peak swirl at one chosen core radius.
  assert.deepEqual(rgb(cellAt(drawing,0,0).color),expected.slow);
  assert.deepEqual(rgb(cellAt(drawing,1,0).color),expected.fast);
  const north=drawing.labels.find(label=>label.text==='N ↑'),probe=drawing.labels.find(label=>label.text==='PROBE');
  assert.ok(north&&probe);assert.deepEqual(rgb(north.color),rgb(drawing.muted));assert.deepEqual(rgb(probe.color),rgb(drawing.text));
  assert.equal(drawing.overflow,false);
}
async function redrawn(page,before,scheme){
  await page.waitForFunction(({frames,slow})=>window.windAppearanceProbe.frames>frames&&getComputedStyle(document.getElementById('wind-field')).getPropertyValue('--wind-slow-rgb').trim()===slow,
    {frames:before.frames,slow:palettes[scheme].slow.join(',')},{polling:20});
  const drawing=await view(page);assertPalette(drawing,scheme);return drawing;
}
async function unchanged(page,before,state){
  const after=await view(page);
  assert.deepEqual(after.points,before.points,'A paused theme redraw preserves all 260 native marker coordinates');
  assert.deepEqual(await modelState(page),state,'Appearance preserves numeric values, selected sample, source and history');
  for(const id of ['wind-motion','passage-play','component-play'])assert.match(await page.locator('#'+id).textContent(),/^Play/);
}

for(const width of [320,1280])for(const scheme of ['light','dark'])test('Wind canvas and legend preserve paused state '+width+' '+scheme,{timeout:45000},async t=>{
  const opposite=scheme==='light'?'dark':'light';
  const page=await fixture(t,{viewport:{width,height:900},colorScheme:opposite,reducedMotion:'reduce',serviceWorkers:'block'});
  await observeDrawing(page);
  await page.goto(base+'/wind.html?'+query);await ready(page);
  const state=await modelState(page),initial=await view(page);assertPalette(initial,opposite);
  assert.equal(state.sample,'206');assert.equal(state.paired,'206');assert.equal(state.source,'moore-2013');
  assert.deepEqual(state.selected,['passage-sample-206']);
  const appearance=page.locator('#reading-appearance');

  await appearance.selectOption(scheme);
  const explicit=await redrawn(page,initial,scheme);
  assert.equal(await page.locator('html').getAttribute('data-appearance'),scheme);
  assert.notEqual(explicit.hash,initial.hash,'The native canvas pixels change with the drawing palette');
  await unchanged(page,initial,state);

  await appearance.selectOption('system');
  const system=await redrawn(page,explicit,opposite);
  assert.equal(await page.locator('html').getAttribute('data-appearance'),null);
  assert.equal(await appearance.inputValue(),'system');await unchanged(page,initial,state);
  await page.emulateMedia({colorScheme:scheme});
  const changed=await redrawn(page,system,scheme);
  assert.notEqual(changed.hash,system.hash);await unchanged(page,initial,state);
  if(process.env.ATLAS_WIND_CAPTURE){
    await mkdir(process.env.ATLAS_WIND_CAPTURE,{recursive:true});
    await page.locator('.wind-panel').screenshot({path:path.join(process.env.ATLAS_WIND_CAPTURE,'wind-theme-'+width+'-'+scheme+'.png')});
  }

  await appearance.selectOption(opposite);
  const fixed=await redrawn(page,changed,opposite);
  await page.emulateMedia({colorScheme:opposite});
  const retained=await view(page);assertPalette(retained,opposite);
  assert.equal(await page.locator('html').getAttribute('data-appearance'),opposite);
  assert.equal(retained.hash,fixed.hash);await unchanged(page,initial,state);

  // The public peak slider starts at 10 mph. This controlled DOM fixture calls
  // the existing production refresh entry directly for the model's valid zero
  // field. It does not claim zero is a supported saved laboratory assumption.
  const beforeZero=await modelState(page),points=retained.points;
  await page.evaluate(async()=>{
    const peak=document.getElementById('peak');peak.min='0';peak.value='0';
    document.getElementById('background').value='0';
    const module=await import(new URL('wind.js',location.href).href);module.refreshWind();
  });
  const zero=await view(page);
  assert.equal(await page.locator('#probe-speed').textContent(),'0.0 mph');
  assert.equal(await page.locator('#probe-pressure').textContent(),'0.00 kPa');
  assert.equal(await page.locator('#probe-force').textContent(),'0.00 kN');
  assert.equal(zero.cells.length,609);assert.ok(zero.cells.every(cell=>JSON.stringify(rgb(cell.color))===JSON.stringify(palettes[opposite].slow)));
  assert.deepEqual(zero.points,points);
  const afterZero=await modelState(page);
  assert.equal(afterZero.href,beforeZero.href);assert.equal(afterZero.historyLength,beforeZero.historyLength);assert.deepEqual(afterZero.historyState,beforeZero.historyState);
  t.diagnostic(JSON.stringify({width,scheme,scope:'Native isolated canvas and logical paused state; controlled zero field is outside the public slider range',frames:zero.frames,palette_pixel_hashes:{initial:initial.hash,explicit:explicit.hash,system:system.hash,changed:changed.hash},markers:zero.points.length,cells:zero.cells.length}));
});
