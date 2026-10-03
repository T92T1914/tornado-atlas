import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDocumentary} from '../web/documentary-view.mjs';

// Component output with authored clock/source fixtures, not historical footage.
test('documentary camera card follows source identity and retains it on warning changes',()=>{
  const previous=globalThis.document,ids=new Map();
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.handlers=new Map();this.textContent='';}
    set id(value){this._id=value;ids.set(value,this);}get id(){return this._id;}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=[...items];}
    setAttribute(){}
    addEventListener(name,callback){this.handlers.set(name,callback);}
  }
  const text=element=>[element.textContent,...element.children.map(text)].join(' ');
  const desk=new Element('div');desk.id='evidence-desk';
  const sequence=new Element('ol');sequence.id='forecast-sequence';
  globalThis.document={getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag),createTextNode:value=>({textContent:value,children:[]})};
  try{
    const utc='2013-05-31T23:17:03Z',later='2013-05-31T23:17:07Z';
    const footage={sources:[{id:'a',creator:'Source A'},{id:'b',creator:'Source B'}],anchors:[{id:'a-clock',source_id:'a',utc},{id:'b-clock',source_id:'b',utc},{id:'b-later',source_id:'b',utc:later}]};
    const update=mountDocumentary({warnings:[]},{frames:[],max_age_seconds:240},{samples:[],display_max_age_seconds:90},new Element('svg'),()=>[0,0],0,Infinity,()=>{},footage);
    const camera=desk.children.find(element=>element.className==='evidence-cards').children[2];
    update(utc);assert.match(text(camera),/Source A/);assert.doesNotMatch(text(camera),/Source B/);
    update(utc,'b');assert.match(text(camera),/Source B/);assert.doesNotMatch(text(camera),/Source A|Dan Robinson/);
    update(later,'b');assert.match(text(camera),/Source B/);
    const toggle=ids.get('warning-polygons');toggle.checked=true;toggle.handlers.get('change')();
    assert.match(text(camera),/Source B/,'Warning updates keep the selected footage source');
    update(later,'a');assert.match(text(camera),/No checked video frame/);assert.doesNotMatch(text(camera),/Source B/);
    update('2013-05-31T23:17:06Z','b');assert.match(text(camera),/No checked video frame/,'A later anchor does not fill the preceding gap');
  }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
