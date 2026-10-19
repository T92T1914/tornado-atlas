import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
import {assertReadingReflow} from './reading-reflow-diagnostics.mjs';

// Register in the existing focused reading category as well as full discovery.
// The complete pre-mutation HTML font snapshot and every original assertion stay.
export function laboratoryEnlargedReadingCases(){
 for(const kind of ['wind','study'])test('purposeful reading route through complete laboratory notes and controls with doubled text '+kind,{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},isMobile:true,reducedMotion:'reduce'});await page.goto(base+'/'+kind+'.html');await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  const enlarged=await page.evaluate(()=>{
   const fallback=document.getElementById('lab-documentary-fallback'),enhancement=document.getElementById('lab-enhancement');
   const fallbackHidden=fallback.getAttribute('hidden'),enhancementHidden=enhancement.getAttribute('hidden');
   let nodes,sizes,result;
   try{
    // Hidden fallback links reported unchanged computed fonts in hosted WebKit.
    // Measure their actual rendered fonts, then restore the enhanced reading.
    fallback.removeAttribute('hidden');
    nodes=[document.body,...document.body.querySelectorAll('*')].filter(n=>n instanceof HTMLElement);sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));
    nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');
    let mismatches=0;const rows=[];
    nodes.forEach((n,i)=>{
     const computed=getComputedStyle(n).fontSize,requested=sizes[i]*2;if(parseFloat(computed)===requested)return;mismatches++;
     if(rows.length<24)try{const r=n.getBoundingClientRect(),s=getComputedStyle(n);rows.push({index:i,tag:n.tagName,id:n.id,type:n.getAttribute('type'),baseline:sizes[i],requested,inline:n.style.fontSize,computed,display:s.display,appearance:s.appearance,font_family:s.fontFamily,left:r.left,right:r.right,width:r.width,height:r.height,preview:n.textContent.slice(0,64)});}catch(error){rows.push({index:i,diagnostic_unavailable:String(error.message).slice(0,128)});}
    });
    const fallbackLinks=[...fallback.querySelectorAll('a')].map(n=>{const r=n.getBoundingClientRect();return {href:n.getAttribute('href'),width:r.width,height:r.height};});
    result={exact:mismatches===0,elements:nodes.length,mismatches,rows,fallbackLinks};
   }finally{
    if(fallbackHidden===null)fallback.removeAttribute('hidden');else fallback.setAttribute('hidden',fallbackHidden);
   }
   let restoredMismatches=0;nodes.forEach((n,i)=>{if(n.getClientRects().length&&parseFloat(getComputedStyle(n).fontSize)!==sizes[i]*2)restoredMismatches++;});
   return {...result,fallback_hidden_before:fallbackHidden,fallback_hidden_after:fallback.getAttribute('hidden'),enhancement_hidden_before:enhancementHidden,enhancement_hidden_after:enhancement.getAttribute('hidden'),restored_visible_font_mismatches:restoredMismatches};
  });
  if(!enlarged.exact){const record={kind,...enlarged,json_byte_limit:8192,rows_removed:0};while(Buffer.byteLength(JSON.stringify(record),'utf8')>8192&&record.rows.length){record.rows.pop();record.rows_removed++;}console.log('LABORATORY_FONT_ENLARGEMENT '+JSON.stringify(record));}
  assert.equal(enlarged.exact,true,'Every declared HTML font is exactly twice its measured baseline');
  assert.equal(enlarged.fallbackLinks.length,5);assert.ok(enlarged.fallbackLinks.every(link=>link.width>0&&link.height>0),'All five documentary fallback links were rendered during font measurement');
  assert.equal(enlarged.fallback_hidden_after,enlarged.fallback_hidden_before,'Restore the exact fallback hidden attribute before layout checks');assert.equal(enlarged.enhancement_hidden_after,enlarged.enhancement_hidden_before,'Preserve original enhancement visibility');
  assert.equal(enlarged.restored_visible_font_mismatches,0,'Visible HTML remains exactly doubled after restoring the enhanced reading');
  await page.addStyleTag({content:'main p,main label,main legend,main select,main button,main li,main a,main h1,main h2,main h3,main dt,main dd {line-height:1.5 !important;letter-spacing:.06em;word-spacing:.12em}'});
  const target=kind==='wind'?'wind-model-limits':'form-model-limits',link=page.locator('.lab-contents a[href="#'+target+'"]');await link.focus();await link.press('Enter');await page.waitForURL(url=>url.hash==='#'+target);await page.locator('#'+target).waitFor({state:'visible'});
  await assertReadingReflow(page,'Doubled and spaced '+kind+' laboratory reading');
  const result=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('.lab-contents a,.study-controls label,.control-note,.wind-caption,.study-explanation p,.lab-return a,.lab-step-title')].flatMap(node=>{const r=document.createRange();r.selectNodeContents(node);return [...r.getClientRects()].filter(b=>b.width>0&&(b.left< -1||b.right>innerWidth+1)).map(b=>({text:node.textContent.slice(0,100),left:b.left,right:b.right}));})}));assert.ok(result.document<=result.viewport+1,JSON.stringify(result));assert.deepEqual(result.overflow,[],JSON.stringify(result));
  if(process.env.ATLAS_LEARNING_CAPTURE){await mkdir(process.env.ATLAS_LEARNING_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_LEARNING_CAPTURE,kind+'-learning-enlarged.png')});}
  const boxes=await page.locator('.study-controls input[type="range"]').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));assert.ok(boxes.length>0&&boxes.every(height=>height>=44));
 });
}
