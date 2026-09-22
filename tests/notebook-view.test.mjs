import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountNotebookPhotographs} from '../web/notebook-view.mjs';

const notebook = JSON.parse(readFileSync(new URL('../exhibits/el-reno-2013/observations.json', import.meta.url)));
class Element {
  constructor(tag) {this.tag=tag;this.children=[];this.textContent='';}
  append(...children) {this.children.push(...children);}
}
function render(book) {
  const previous=globalThis.document;
  const nodes=[];
  globalThis.document={createElement:tag=>{const node=new Element(tag);nodes.push(node);return node;}};
  const container=new Element('div');
  try {mountNotebookPhotographs(book,container);return {nodes,container};}
  finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
}

test('source photographs expose credits and uncertainty without loading or registering media',()=>{
  const {nodes,container}=render(notebook);
  assert.equal(container.children.length,2);
  const text=nodes.map(node=>node.textContent).join('\n');
  assert.match(text,/Inspected still:/);
  assert.match(text,/Author caption:/);
  assert.match(text,/clock calibration unverified and time accuracy unknown/);
  assert.match(text,/not a registered camera position/);
  assert.match(text,/highly enhanced/);
  assert.match(text,/Copyright 2013 William T. Hark/);
  assert.match(text,/Not reviewed:/);
  assert.equal(nodes.filter(node=>['img','image','iframe','video','audio','button'].includes(node.tag)).length,0);
  const links=nodes.filter(node=>node.tag==='a');
  assert.equal(links.length,4);
  assert.deepEqual(links.map(node=>node.href),notebook.photographs.flatMap(photo=>[photo.source.original_url,photo.source.url]));
  assert.ok(links.every(node=>node.target==='_blank' && node.rel==='noopener noreferrer'));
});

test('an older video-only notebook remains valid for the optional photograph view',()=>{
  const {container,nodes}=render({observations:[]});
  assert.equal(container.children.length,0);
  assert.equal(nodes.length,0);
});

test('source prose is assigned as text rather than interpreted as markup',()=>{
  const copy=structuredClone(notebook);
  copy.photographs[0].visual_note='<img src=x onerror=alert(1)>';
  const {nodes}=render(copy);
  assert.ok(nodes.some(node=>node.textContent.includes('<img src=x onerror=alert(1)>')));
  assert.ok(nodes.every(node=>node.innerHTML===undefined));
});
