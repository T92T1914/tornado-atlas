import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

// This DOM control checks preservation of published reading, not browser navigation.
const source=await fs.readFile(new URL('../web/documentary-view.mjs',import.meta.url),'utf8');
const program=source.replace(/^import [^\r\n]+;\r?\n/gm,'').replace(/^export /gm,'')+'\nthis.mount=mountResearchLog;';
class Node{
 constructor(tag,text=''){this.tagName=tag;this.children=[];this.own=text;}
 append(...items){this.children.push(...items);}
 set textContent(value){this.own=String(value);this.children=[];}
 get textContent(){return this.own+this.children.map(item=>typeof item==='string'?item:item.textContent).join('');}
}
test('research enhancement preserves static audit reading without a request or lifecycle owner',()=>{
 const nodes=new Map(['research-log','unmapped-fatalities','link-audit-summary'].map(id=>[id,new Node('div')]));
 const audit=nodes.get('link-audit-summary'),retained=new Node('p','Dated access results remain available');audit.append(retained);
 const remembrance=new Node('div');let requests=0,listeners=0;
 const document={getElementById:id=>nodes.get(id),querySelectorAll:()=>[remembrance],createElement:tag=>new Node(tag),createTextNode:text=>new Node('text',text)};
 const realm={document,window:{addEventListener(){listeners++;throw Error('Unexpected audit lifecycle owner');}},fetch(){requests++;throw Error('Unexpected background request');},URL};
 vm.runInNewContext(program,realm,{timeout:1000});
 realm.mount({log:[{date:'2026-10-30',status:'reviewed',title:'A source account',finding:'Qualified finding',sources:[{label:'Source',url:'https://example.org/account'}]}],unmapped_fatalities:[{id:'unresolved-location',people:['Named person'],account:'Recorded account',reason:'Location remains unknown',sources:[]}]});
 assert.deepEqual(audit.children,[retained]);assert.equal(audit.children[0],retained);
 assert.equal(requests,0);assert.equal(listeners,0);
 assert.match(nodes.get('research-log').textContent,/A source accountQualified findingSource/);
 assert.match(nodes.get('unmapped-fatalities').textContent,/Named personRecorded accountLocation remains unknown/);
 assert.match(remembrance.textContent,/Five victims with unresolved locations/);
 assert.equal(nodes.get('unmapped-fatalities').children[0].id,'unresolved-location');
});
