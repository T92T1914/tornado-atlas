import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSourceDirectory,discoverSources} from '../web/archive-discovery-model.mjs';

const identity='a'.repeat(64);
const index={events:[{id:'first',title:'First event',dossier_sha256:identity,file:`archive/first-${identity.slice(0,20)}.json`},
  {id:'second',title:'Second event',dossier_sha256:identity,file:`archive/second-${identity.slice(0,20)}.json`}],source_directory:{count:2}};
const source={id:'shared',title:'Original Évidence report',url:'https://example.org/report',locator:'Printed page 19',
  access:'Selected page inspected',revision:'Revision 2',rights:'Links only',agent_processing:'Synthetic fixture'};
const directory={schema_version:1,kind:'atlas-source-directory',scope:'Synthetic scope',entries:[
  {event_id:'first',event_title:'First event',dossier_sha256:identity,source:{...source},observations:1,media:0},
  {event_id:'second',event_title:'Second event',dossier_sha256:identity,source:{...source,locator:'Printed page 20'},observations:0,media:1}]};

test('source discovery searches retained locators and preserves event-specific records',()=>{
  assert.equal(validateSourceDirectory(directory,index),directory);
  assert.equal(discoverSources(directory,{query:'  ÉVIDENCE  '}).length,2);
  assert.equal(discoverSources(directory,{query:'page 19'})[0].event_id,'first');
  assert.equal(discoverSources(directory,{event:'second',query:'report'}).length,1);
  assert.equal(discoverSources(directory,{query:'uninspected footage'}).length,0);
  assert.equal(discoverSources(directory,{query:'',event:'unknown'}).length,0);
  assert.equal(directory.entries.length,2);
});

test('stale, duplicated or malformed directory records fail before display',()=>{
  for(const mutate of [
    value=>{value.schema_version=2;},
    value=>{value.entries.pop();},
    value=>{value.entries[0].dossier_sha256='b'.repeat(64);},
    value=>{value.entries[0].dossier_sha256=identity.slice(0,20)+'b'.repeat(44);},
    value=>{value.entries[0].event_title='Unmatched title';},
    value=>{value.entries[0].source.revision='';},
    value=>{value.entries[0].media=-1;},
    value=>{value.entries[1]=structuredClone(value.entries[0]);},
    value=>{value.entries[0]=null;},
  ]){
    const broken=structuredClone(directory);mutate(broken);
    assert.throws(()=>validateSourceDirectory(broken,index),/does not match this archive publication/);
  }
});
