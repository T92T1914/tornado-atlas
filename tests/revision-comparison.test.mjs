import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {loadVerifiedDossier,validateDossierForReader,DOSSIER_FILE_LIMIT} from '../web/dossier-file-model.mjs';
import {indexDossierLiterals,literalValue,selectedLiteralChanges,LITERAL_DEPTH_LIMIT,LITERAL_TOKEN_LIMIT} from '../web/dossier-literal-model.mjs';
import {selectRevisionEdge,revisionComparisonRoute,admitRevisionComparison,loadRevisionComparison} from '../web/revision-comparison.mjs';

const index=JSON.parse(await readFile(new URL('../web/archive/index.json',import.meta.url),'utf8'));
const event=index.events.find(row=>row.id==='joplin-2011');
const history=JSON.parse(await readFile(new URL('../web/'+event.history_file,import.meta.url),'utf8'));
const successor=history.versions.find(row=>row.dossier_sha256.startsWith('1f02a52e8fca'));
const predecessor=history.versions.find(row=>row.dossier_sha256===successor.review.previous_dossier_sha256);
const edge=selectRevisionEdge(new URLSearchParams({event:event.id,revision:successor.dossier_sha256,predecessor:predecessor.dossier_sha256}),history,event.id);
const options=raw=>({subtle:webcrypto.subtle,fetcher:async()=>new Response(raw)});
const beforeBytes=await readFile(new URL('../web/'+predecessor.file,import.meta.url)),afterBytes=await readFile(new URL('../web/'+successor.file,import.meta.url));
const before=await loadVerifiedDossier(predecessor,event.id,options(beforeBytes)),after=await loadVerifiedDossier(successor,event.id,options(afterBytes));
const base=JSON.parse(afterBytes);
const wire=raw=>createHash('sha256').update(raw).digest('hex');
const scan=doc=>{validateDossierForReader(doc,event.id);return indexDossierLiterals(JSON.stringify(doc),event.id);};
const changed=fields=>[{kind:'observations',id:base.observations[0].id,change:'updated',fields}];
const row=index=>index.rows.get('observations').get(base.observations[0].id);
function withLiteral(fragment){
  const doc=structuredClone(base);doc.observations[0].literal_fixture=null;
  return JSON.stringify(doc).replace('"literal_fixture":null','"literal_fixture":'+fragment);
}
async function checkedRaw(raw,reference=predecessor){
  return loadVerifiedDossier({...reference,file_sha256:wire(raw)},event.id,options(raw));
}

test('actual retained qualification preserves complete source spans and separate publication basis',()=>{
  const pair=admitRevisionComparison(after,before,edge,event.id);
  assert.deepEqual(pair.changes.map(change=>change.fields),[['account','review']]);
  const observation=before.dossier.observations.find(row=>row.id==='intake-nist-east-middle-refuge-2014');
  for(const change of pair.changes)for(const value of change.values){
    assert.equal(value.before.text,observation[value.field]);
    assert.equal(value.before.raw,JSON.stringify(observation[value.field]));
    assert.equal(JSON.parse(value.after.raw),after.dossier.observations.find(row=>row.id===change.id)[value.field]);
  }
  assert.match(pair.changes[0].values[0].after.text,/likely explanation/);
  assert.match(observation.limits,/school was unoccupied/);
  assert.match(observation.limits,/Estimated winds are not direct measurements/);
  assert.equal(pair.edge.successor.review.basis,successor.review.basis);
});

test('all actual retained dossiers fit the source-range bounds and preserve whole values',async()=>{
  const files=new Set();
  for(const entry of index.events){
    const versions=JSON.parse(await readFile(new URL('../web/'+entry.history_file,import.meta.url),'utf8'));
    for(const reference of versions.versions){
      if(files.has(reference.file))continue;files.add(reference.file);
      const bytes=await readFile(new URL('../web/'+reference.file,import.meta.url));
      const result=await loadVerifiedDossier(reference,entry.id,options(bytes));
      const literals=indexDossierLiterals(result.rawText,entry.id);
      assert.ok(literals.stats.depth<=LITERAL_DEPTH_LIMIT&&literals.stats.tokens<=LITERAL_TOKEN_LIMIT);
      for(const field of ['routes','reconstruction','observations']){
        const value=literalValue(literals,literals.root.members.get(field));
        assert.deepEqual(JSON.parse(value.raw),result.dossier[field]);
      }
    }
  }
  assert.equal(files.size,39);
});

test('exact numeric forms, escaped strings, decoded keys and whole nested values survive S1',async()=>{
  const raw=withLiteral('{"numbers":[1,1.0,1e0,-0.0,0.0,true,null],"quoted\\u005fkey":"A\\nB \\"quoted\\" \\\\ \u2603 \ud83c\udf2a <script>","nested":[{"a":[2,3]},{}]}');
  const checked=await checkedRaw(raw);
  const literals=indexDossierLiterals(checked.rawText,event.id),fixture=row(literals).members.get('literal_fixture');
  assert.equal(literalValue(literals,fixture).raw,raw.slice(fixture.start,fixture.end));
  assert.deepEqual(fixture.members.get('numbers').values.map(node=>literalValue(literals,node).raw),['1','1.0','1e0','-0.0','0.0','true','null']);
  assert.equal(fixture.members.get('quoted_key').text,'A\nB "quoted" \\ \u2603 \ud83c\udf2a <script>');
  assert.equal(literalValue(literals,fixture.members.get('nested')).raw,'[{"a":[2,3]},{}]');
  const alternate=await checkedRaw(withLiteral('{"numbers":[1e0,1.0,1,-0,0,false,null]}'));
  const changes=selectedLiteralChanges(literals,indexDossierLiterals(alternate.rawText,event.id),changed(['literal_fixture']),event.id);
  assert.equal(changes[0].values[0].before.raw,literalValue(literals,fixture).raw);
});

test('missing fields, explicit null, zero and booleans remain distinct',()=>{
  const old=structuredClone(base),next=structuredClone(base);
  next.observations[0].literal_fixture=null;
  let values=selectedLiteralChanges(scan(old),scan(next),changed(['literal_fixture']),event.id)[0].values;
  assert.deepEqual(values[0].before,{present:false,absence:'field'});
  assert.equal(values[0].after.raw,'null');
  old.observations[0].literal_fixture=false;next.observations[0].literal_fixture=0;
  values=selectedLiteralChanges(scan(old),scan(next),changed(['literal_fixture']),event.id)[0].values;
  assert.equal(values[0].before.raw,'false');assert.equal(values[0].after.raw,'0');
});

test('row addition and removal show complete present rows and explicit absent rows',()=>{
  const old=structuredClone(base),next=structuredClone(base);
  next.creators.push({id:'synthetic-literal-creator',name:'Synthetic fixture',basis:'Membership test only.'});
  const added=[{kind:'creators',id:'synthetic-literal-creator',change:'added',fields:[]}];
  const result=selectedLiteralChanges(scan(old),scan(next),added,event.id)[0].values[0];
  assert.deepEqual(result.before,{present:false,absence:'row'});
  assert.deepEqual(JSON.parse(result.after.raw),next.creators.at(-1));
  const removed=selectedLiteralChanges(scan(next),scan(old),[{...added[0],change:'removed'}],event.id)[0].values[0];
  assert.deepEqual(removed.after,{present:false,absence:'row'});
  assert.equal(removed.before.raw,result.after.raw);
});

test('publisher targets allow disjoint dossier fields and empty recorded changes',()=>{
  const literals=scan(base);
  assert.equal(selectedLiteralChanges(literals,literals,[{kind:'dossier',id:event.id,change:'updated',fields:['summary']},{kind:'dossier',id:event.id,change:'updated',fields:['routes']}],event.id).length,2);
  assert.deepEqual(selectedLiteralChanges(literals,literals,[],event.id),[]);
  // Equal parsed numbers and reordered object keys do not invent new changes.
  const a=indexDossierLiterals(withLiteral('{"a":1.0,"b":true}'),event.id),b=indexDossierLiterals(withLiteral('{"b":true,"a":1e0}'),event.id);
  assert.deepEqual(selectedLiteralChanges(a,b,[],event.id),[]);
});

test('ambiguous, unsupported, unresolved and overlapping publisher targets fail closed',()=>{
  const literals=scan(base),valid=changed(['account'])[0];
  const cases=[
    [{...valid,fields:[]}],[{...valid,fields:['account','account']}],[{...valid,fields:['absent_at_both']}],
    [{...valid,id:'missing-row'}],[{...valid,kind:'unknown'}],[{...valid,change:'added',fields:[]}],
    [{...valid,change:'removed',fields:[]}],[valid,valid],[{...valid,extra:'unsupported'}],
    [{kind:'dossier',id:event.id,change:'updated',fields:['summary']},{kind:'dossier',id:event.id,change:'updated',fields:['summary']}],
    [{kind:'dossier',id:'foreign',change:'updated',fields:['summary']}],
    [{kind:'dossier',id:event.id,change:'updated',fields:['provenance']}],
    [{kind:'dossier',id:event.id,change:'added',fields:[]}]
  ];
  for(const changes of cases)assert.throws(()=>selectedLiteralChanges(literals,literals,changes,event.id),/recorded/);
});

test('duplicate decoded keys are rejected even in unselected S1-readable subtrees',async()=>{
  for(const fragment of ['{"x":1,"x":2}','{"x":1,"\\u0078":2}','[{"__proto__":null,"\\u005f_proto__":true}]']){
    const checked=await checkedRaw(withLiteral(fragment));
    assert.throws(()=>indexDossierLiterals(checked.rawText,event.id),/duplicate decoded object keys/);
  }
});

test('duplicate row identities in every category and foreign event roots are rejected',()=>{
  for(const category of ['sources','observations','media','creators','records']){
    const doc=structuredClone(base);
    if(!doc[category].length){
      if(category==='records')doc.records.push({id:'ncei:9999999',basis:'Synthetic duplicate-identity fixture.',status:'reviewed_association',alternatives:[]});
      else if(category==='creators')doc.creators.push({id:'synthetic-literal-creator',name:'Synthetic fixture',basis:'Duplicate identity test only.'});
      else if(category==='media')doc.media.push({...structuredClone(doc.observations[0]),id:'synthetic-literal-media',kind:'photograph',url:doc.sources[0].url,
        account:'Synthetic duplicate identity fixture.',limits:'No historical media or observation is supplied.',review:'Synthetic membership test.',
        roles:{creator:null,uploader:null,rights_holder:null},parent:null,transformation:null});
      else assert.fail('Unexpected empty fixture category.');
    }
    validateDossierForReader(doc,event.id);
    doc[category].push(structuredClone(doc[category][0]));
    assert.throws(()=>indexDossierLiterals(JSON.stringify(doc),event.id),/duplicate row identities/);
  }
  assert.throws(()=>indexDossierLiterals(JSON.stringify({...base,id:'foreign'}),event.id),/another event/);
});

test('JSON grammar rejects incomplete tokens, control characters, trailing input and separators',()=>{
  for(const fragment of ['[1,]','{"x":1,}','01','+1','.1','1.','1e','NaN','undefined','"bad\nstring"','"\\x01"','{"x" 1}','[true false]']){
    assert.throws(()=>indexDossierLiterals(withLiteral(fragment),event.id),/complete JSON/);
  }
  const raw=JSON.stringify(base);
  assert.throws(()=>indexDossierLiterals(raw+'{}',event.id),/complete JSON/);
  assert.throws(()=>indexDossierLiterals('\v'+raw,event.id),/complete JSON/);
  assert.equal(indexDossierLiterals('\r\n '+raw+'\t',event.id).root.kind,'object');
});

test('exact byte, depth and all-subtree token limits are enforced',()=>{
  const raw=JSON.stringify(base);
  assert.equal(indexDossierLiterals(raw+' '.repeat(DOSSIER_FILE_LIMIT-Buffer.byteLength(raw)),event.id).root.kind,'object');
  assert.throws(()=>indexDossierLiterals(raw+' '.repeat(DOSSIER_FILE_LIMIT-Buffer.byteLength(raw)+1),event.id),/byte limit/);
  const multibyte=structuredClone(base);multibyte.summary='\u2603'.repeat(70000);
  assert.throws(()=>indexDossierLiterals(JSON.stringify(multibyte),event.id),/byte limit/);
  for(const [arrays,accepted] of [[29,true],[30,false]]){
    const nested='['.repeat(arrays)+'0'+']'.repeat(arrays);
    if(accepted)assert.equal(indexDossierLiterals(withLiteral(nested),event.id).stats.depth,32);
    else assert.throws(()=>indexDossierLiterals(withLiteral(nested),event.id),/depth limit/);
  }
  const empty=indexDossierLiterals(withLiteral('[]'),event.id).stats.tokens;
  const exact='['+Array(LITERAL_TOKEN_LIMIT-empty).fill('0').join(',')+']';
  assert.equal(indexDossierLiterals(withLiteral(exact),event.id).stats.tokens,LITERAL_TOKEN_LIMIT);
  assert.throws(()=>indexDossierLiterals(withLiteral(exact.slice(0,-1)+',0]'),event.id),/token limit/);
});

test('strict routes follow only the explicit same-event retained predecessor edge',()=>{
  const url=revisionComparisonRoute(event.id,successor.dossier_sha256,predecessor.dossier_sha256);
  assert.equal(url.endsWith('#revision-comparison'),true);
  for(const edit of [
    q=>q.append('event',event.id),q=>q.append('revision',successor.dossier_sha256),q=>q.append('predecessor',predecessor.dossier_sha256),
    q=>q.delete('revision'),q=>q.set('predecessor','0'.repeat(64)),q=>q.set('predecessor',successor.dossier_sha256),
    q=>q.set('revision',event.dossier_sha256),q=>q.set('revision','../invalid'),q=>q.set('event','foreign'),
    q=>q.set('creator','a'),q=>q.set('record','ncei:1'),q=>q.set('view','sources')
  ]){
    const query=new URLSearchParams(url.split('?')[1].split('#')[0]);edit(query);
    assert.throws(()=>selectRevisionEdge(query,history,event.id),/route|predecessor/);
  }
  const missing=structuredClone(history);missing.versions=missing.versions.filter(row=>row.dossier_sha256!==predecessor.dossier_sha256);
  assert.throws(()=>selectRevisionEdge(new URLSearchParams({event:event.id,revision:successor.dossier_sha256,predecessor:predecessor.dossier_sha256}),missing,event.id),/predecessor/);
});

test('already checked successor is reused and only one predecessor is fetched',async()=>{
  const requests=[];
  const pair=await loadRevisionComparison(after,edge,event.id,{subtle:webcrypto.subtle,fetcher:async file=>{requests.push(file);return new Response(beforeBytes);}});
  assert.equal(pair.successor,after);assert.deepEqual(requests,[predecessor.file]);
  assert.equal(pair.predecessor.reference.file_sha256,predecessor.file_sha256);
});

test('different endpoint references and successor publication reviews cannot prepare a pair',async()=>{
  for(const modify of [
    r=>r.reference.file_sha256='0'.repeat(64),r=>r.reference.dossier_sha256=event.dossier_sha256,
    r=>r.dossier.provenance.publication_review.basis+=' Synthetic alteration.',
    r=>r.dossier.provenance.publication_review.previous_dossier_sha256='0'.repeat(64),
    r=>delete r.dossier.provenance.publication_review.candidate_sha256
  ]){
    const result=structuredClone(after);modify(result);let requests=0;
    await assert.rejects(loadRevisionComparison(result,edge,event.id,{fetcher:async()=>{requests++;return new Response(beforeBytes);},subtle:webcrypto.subtle}),/reference|publication review/);
    assert.equal(requests,0);
  }
  await assert.rejects(loadRevisionComparison(after,edge,event.id,options(beforeBytes.toString().replace('NIST','TEST'))),/file bytes do not match/);
  await assert.rejects(loadRevisionComparison(after,edge,event.id,{...options(beforeBytes),fetcher:async()=>new Response('Unavailable',{status:503})}),/could not load/);
});
