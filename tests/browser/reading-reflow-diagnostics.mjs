import assert from 'node:assert/strict';

// Read the failed layout without changing styles, input, focus or scroll.
async function snapshot(page){return page.evaluate(()=>{
 const small=(value,limit=96)=>String(value??'').slice(0,limit),viewport=innerWidth,x=scrollX;
 const limits={elements:20000,text_nodes:20000,fragments_per_text:128,element_rows:16,text_rows:16,ancestor_rows:3,ancestor_depth:12,scan_ms:750};
 const start=performance.now(),elements=[],text=[],counts={elements:0,text_nodes:0,text_fragments:0,element_candidates:0,outside_elements:0,clipped_outside_elements:0,internal_overflow_elements:0,outside_text_fragments:0,clipped_outside_text_fragments:0,fragment_rows_unscanned:0};
 let incomplete=false;
 const expired=()=>performance.now()-start>limits.scan_ms;
 const identify=node=>({tag:small(node.tagName,32),id:small(node.id),cls:small(typeof node.className==='string'?node.className:'')});
 const box=node=>{const r=node.getBoundingClientRect();return {left:r.left+x,right:r.right+x,top:r.top,width:r.width,height:r.height};};
 const rank=row=>row.outside?(row.clipped_outside?1:2):0;
 const retain=(rows,row,limit)=>{rows.push(row);rows.sort((a,b)=>rank(b)-rank(a)||b.extent-a.extent);if(rows.length>limit)rows.pop();};
 const clipping=node=>{
  const rows=[];let depth=0,clipped=false,own=null,omitted=0,parent=node;
  for(;parent&&depth<limits.ancestor_depth;parent=parent.parentElement){
   depth++;const style=getComputedStyle(parent);
   if(['hidden','clip','auto','scroll'].includes(style.overflowX)||style.clipPath!=='none'||/paint|strict|content/.test(style.contain)){
    const r=box(parent),row={...identify(parent),...r,overflow_x:small(style.overflowX,32),clip_path:small(style.clipPath),contain:small(style.contain,32)};
    if(r.width>0&&r.left>=-1&&r.right<=viewport+1)clipped=true;
    if(parent===node)own=row;else if(rows.length<limits.ancestor_rows)rows.push(row);else omitted++;
   }
  }
  return {clipping_ancestors:rows,own_clip:own,clipping_rows_omitted:omitted,clipping_scan_limited:Boolean(parent),clipped};
 };
 const describe=node=>{
  const style=getComputedStyle(node);
  return {...identify(node),section:small(node.closest('section[id],article[id],aside[id],main[id]')?.id),
   display:small(style.display,32),visibility:small(style.visibility,32),position:small(style.position,32),overflow_x:small(style.overflowX,32),
   min_width:small(style.minWidth,32),max_width:small(style.maxWidth,32),box_sizing:small(style.boxSizing,32),appearance:small(style.appearance,32),
   white_space:small(style.whiteSpace,32),font_family:small(style.fontFamily),font_size:small(style.fontSize,32),
   line_height:small(style.lineHeight,32),letter_spacing:small(style.letterSpacing,32),word_spacing:small(style.wordSpacing,32)};
 };
 const elementWalker=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT);
 for(let node=document.documentElement;node;node=node===document.documentElement?document.body:elementWalker.nextNode()){
  if(counts.elements>=limits.elements||expired()){incomplete=true;break;}counts.elements++;
  const r=box(node);if(r.width<=0||r.height<=0)continue;
  const client=node.clientWidth,scroll=node.scrollWidth,outside=r.left< -1||r.right>viewport+1,internal=client>0&&scroll>client+1;
  if(!outside&&!internal)continue;
  counts.element_candidates++;
  const clip=clipping(node),clipped_outside=outside&&clip.clipped;
  if(outside)counts.outside_elements++;if(internal)counts.internal_overflow_elements++;
  if(clipped_outside)counts.clipped_outside_elements++;
  retain(elements,{node,...r,...clip,client,scroll,outside,clipped_outside,internal,extent:Math.max(0,r.right-viewport,-r.left,internal?r.left+scroll-viewport:0)},limits.element_rows);
 }
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  if(counts.text_nodes>=limits.text_nodes||expired()){incomplete=true;break;}counts.text_nodes++;
  if(!node.textContent.trim())continue;
  const range=document.createRange();range.selectNodeContents(node);const fragments=range.getClientRects();
  if(fragments.length>limits.fragments_per_text){counts.fragment_rows_unscanned+=fragments.length-limits.fragments_per_text;incomplete=true;}
  for(let index=0;index<Math.min(fragments.length,limits.fragments_per_text);index++){
   const r=fragments[index];counts.text_fragments++;if(r.width<=0||r.height<=0)continue;
   const left=r.left+x,right=r.right+x;if(left>=-1&&right<=viewport+1)continue;
   counts.outside_text_fragments++;
   const clip=clipping(node.parentElement);if(clip.clipped)counts.clipped_outside_text_fragments++;
   retain(text,{node:node.parentElement,...clip,left,right,top:r.top,width:r.width,height:r.height,outside:true,clipped_outside:clip.clipped,
    preview:small(node.textContent.trim(),120),extent:Math.max(right-viewport,-left)},limits.text_rows);
  }
  range.detach();
 }
 return {viewport,scroll_x:x,scroll_y:scrollY,route:small(location.pathname+location.search+location.hash,256),ready_state:document.readyState,
  font_status:document.fonts.status,root:{...box(document.documentElement),client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth},
  body:{...box(document.body),client:document.body.clientWidth,scroll:document.body.scrollWidth},counts,limits,scan_incomplete:incomplete,
  element_rows_omitted:Math.max(0,counts.element_candidates-elements.length),text_rows_omitted:Math.max(0,counts.outside_text_fragments-text.length),
  elements:elements.map(({node,...row})=>({...row,...describe(node),preview:small(node.textContent,120)})),
  text:text.map(({node,...row})=>({...row,...describe(node)})),scan_elapsed_ms:performance.now()-start};
});}

function print(record){
 const maxBytes=16384;record.output_rows_removed={elements:0,text:0};record.json_byte_limit=maxBytes;
 let encoded=JSON.stringify(record);
 while(Buffer.byteLength(encoded,'utf8')>maxBytes&&(record.snapshot?.elements.length||record.snapshot?.text.length)){
  const kind=record.snapshot.elements.length>=record.snapshot.text.length?'elements':'text';
  record.snapshot[kind].pop();record.output_rows_removed[kind]++;encoded=JSON.stringify(record);
 }
 if(Buffer.byteLength(encoded,'utf8')>maxBytes)encoded=JSON.stringify({label:record.label,original_error:record.original_error,
  diagnostic:'Detailed snapshot exceeded JSON bound',snapshot_counts:record.snapshot?.counts??null,json_byte_limit:maxBytes});
 console.log('READING_REFLOW_FAILURE '+encoded);
}

export async function assertReadingReflow(page,label='Article'){
 label=String(label).slice(0,160);
 const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
 try{assert.ok(fits,label+' has no horizontal document overflow');}
 catch(original){
  let timer;
  const record={label,original_error:{name:original.name,message:String(original.message).slice(0,256)},diagnostic_deadline_ms:1000};
  try{record.snapshot=await Promise.race([snapshot(page),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Reading reflow diagnostic exceeded 1000 milliseconds')),1000);})]);}
  catch(error){record.diagnostic_unavailable=String(error.message).slice(0,256);record.cleanup='Pending read retires with the owned fixture context';}
  finally{clearTimeout(timer);}
  try{print(record);}catch{}
  throw original;
 }
}
