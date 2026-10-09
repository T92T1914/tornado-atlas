import {loadVerifiedDossier} from './dossier-file-model.mjs';
import {indexDossierLiterals,literalValue,selectedLiteralChanges} from './dossier-literal-model.mjs';

const hash=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const fail=message=>{throw Error(message+' No publication comparison has been substituted.');};
const route=values=>'dossier.html?'+new URLSearchParams(values);
const reviewKeys=['reviewer_kind','reviewed_at','basis','candidate_sha256','previous_dossier_sha256'];
const sameReview=(left,right)=>left&&right&&Object.keys(left).length===reviewKeys.length&&
  Object.keys(right).length===reviewKeys.length&&reviewKeys.every(key=>typeof left[key]==='string'&&left[key]===right[key]);

export function revisionComparisonRoute(eventId,successor,predecessor){
  return route({event:eventId,revision:successor,predecessor})+'#revision-comparison';
}

export function selectRevisionEdge(query,history,eventId){
  if(['event','revision','predecessor'].some(key=>query.getAll(key).length!==1)||
    ['record','creator','view'].some(key=>query.has(key))||query.get('event')!==eventId||
    !hash(query.get('revision'))||!hash(query.get('predecessor'))||
    query.get('revision')===query.get('predecessor')||history?.event_id!==eventId)fail('The publication comparison route is invalid.');
  const successor=history.versions.find(row=>row.dossier_sha256===query.get('revision'));
  const predecessor=history.versions.find(row=>row.dossier_sha256===query.get('predecessor'));
  if(!successor||!predecessor||!successor.predecessor_available||!Array.isArray(successor.changes)||
    successor.review?.previous_dossier_sha256!==predecessor.dossier_sha256)fail('This is not an explicitly retained publication predecessor.');
  return {successor,predecessor};
}

function matchingReference(result,reference,eventId){
  if(result?.dossier?.id!==eventId||result?.reference?.event_id!==eventId||
    ['file','dossier_sha256','file_sha256'].some(key=>result.reference[key]!==reference[key]))fail('The checked endpoint reference differs from the recorded edge.');
}
function matchingSuccessor(result,edge,eventId){
  matchingReference(result,edge.successor,eventId);
  if(!sameReview(result.dossier.provenance.publication_review,edge.successor.review)||
    result.dossier.provenance.publication_review.previous_dossier_sha256!==edge.predecessor.dossier_sha256)fail('The successor publication review differs from its revision list.');
}

export function admitRevisionComparison(successor,predecessor,edge,eventId){
  matchingSuccessor(successor,edge,eventId);matchingReference(predecessor,edge.predecessor,eventId);
  const before=indexDossierLiterals(predecessor.rawText,eventId),after=indexDossierLiterals(successor.rawText,eventId);
  const changes=selectedLiteralChanges(before,after,edge.successor.changes,eventId);
  return {eventId,edge,before,after,predecessor,successor,changes};
}

export async function loadRevisionComparison(successor,edge,eventId,options={}){
  matchingSuccessor(successor,edge,eventId);
  const predecessor=await loadVerifiedDossier(edge.predecessor,eventId,options);
  return admitRevisionComparison(successor,predecessor,edge,eventId);
}

// Construct the complete section while detached. The caller commits neither
// endpoint to the reader until both checked files and all targets are admitted.
export function revisionComparisonSection(comparison,link){
  const make=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
  const section=make('section',undefined,'archive-comparison revision-comparison');section.id='revision-comparison';
  section.append(make('h2','Read the recorded publication change'),make('p','This view follows one explicitly recorded predecessor. The publisher selects the changed fields. Inspection records retain their earlier scope, and the publication decision is shown separately. No new original-source inspection or historical appearance is claimed.'));
  const identities=make('details',undefined,'revision-identities');
  identities.append(make('summary','Full dossier and publication identities'));
  const routes=make('nav',undefined,'comparison-routes');
  for(const [label,result] of [['Predecessor',comparison.predecessor],['Successor',comparison.successor]]){
    const reference=result.reference;
    identities.append(make('h3',label+' identity'),make('p','Logical dossier SHA256: '+reference.dossier_sha256),make('p','Exact file SHA256: '+reference.file_sha256));
    routes.append(link('Read the full '+label.toLowerCase()+' dossier',route({event:comparison.eventId,revision:reference.dossier_sha256})),
      link('Open raw '+label.toLowerCase()+' metadata (unverified)',reference.file));
  }
  identities.append(routes);
  const review=comparison.edge.successor.review;
  identities.append(make('p','Publication candidate SHA256: '+review.candidate_sha256));
  const value=(parent,entry,label)=>{
    if(!entry.present){parent.append(make('p',entry.absence==='row'?'This row is absent in this revision.':'This field is absent in the retained row.','literal-absence'));return;}
    if(entry.kind==='string'){
      parent.append(make('p',entry.text,'literal-decoded'));
      const details=make('details'),summary=make('summary','Exact raw JSON: '+label);
      details.append(summary,make('pre',entry.raw,'literal-raw'));parent.append(details);
    }else parent.append(make('pre',entry.raw,'literal-raw'));
  };
  function context(parent,result,index,change){
    const row=change.kind==='dossier'?index.root:index.rows.get(change.kind).get(change.id);
    if(!row)return;
    const limits=row.members.get('limits');
    if(limits){parent.append(make('h5','Limits'));value(parent,literalValue(index,limits),'limits');}
    const details=make('details',undefined,'revision-context');
    details.append(make('summary','Retained source and inspection context'));
    parent.append(details);parent=details;
    parent.append(make('p','Recorded target: '+change.kind+' '+change.id));
    for(const field of change.kind==='dossier'?['summary']:['title','source_id','locator','basis']){
      const node=row.members.get(field);
      if(node){parent.append(make('p',field==='source_id'?'Source identity:':field.charAt(0).toUpperCase()+field.slice(1)+':'));value(parent,literalValue(index,node),field);}
    }
    for(const [field,label] of [['review','Retained inspection record'],['time','Clock roles in this revision'],['place','Place and its limits in this revision']]){
      const node=row.members.get(field);
      if(node){const details=make('details');details.append(make('summary',label),make('pre',literalValue(index,node).raw,'literal-raw'));parent.append(details);}
    }
    const navigation=make('nav',undefined,'comparison-routes'),version={event:comparison.eventId,revision:result.reference.dossier_sha256};
    const type={sources:'source',observations:'observation',media:'media'}[change.kind];
    if(type)navigation.append(link('Read this '+type+' in this revision',route({...version,[type]:change.id})+'#'+type+'-'+encodeURIComponent(change.id)));
    const sourceId=row.members.get('source_id')?.text;
    const source=sourceId?result.dossier.sources.find(item=>item.id===sourceId):change.kind==='sources'?result.dossier.sources.find(item=>item.id===change.id):null;
    if(source){
      for(const [field,label] of [['locator','Source locator'],['access','Retained source inspection scope'],['revision','Source revision'],['rights','Rights'],['agent_processing','Recorded agent processing']])parent.append(make('p',label+': '+source[field]));
      navigation.append(link('Inspect the source in this revision',route({...version,source:source.id})+'#source-'+encodeURIComponent(source.id)),link('Read original source',source.url));
    }
    if(change.kind==='records')navigation.append(link('Open the current catalogue source record',route({record:change.id})));
    if(change.kind==='creators')navigation.append(link('Open the current attribution page',route({creator:change.id})));
    parent.append(navigation);
  }
  if(!comparison.changes.length)section.append(make('p','No display or evidence field differences were recorded for this retained publication edge.'));
  for(const [number,change] of comparison.changes.entries()){
    const card=make('article',undefined,'archive-card revision-change');card.id='revision-change-'+number;
    const row=comparison.after.rows.get(change.kind)?.get(change.id)??comparison.before.rows.get(change.kind)?.get(change.id);
    const title=row?.members.get('title')?.text;
    card.append(make('h3',(title||change.kind+' '+change.id)+': '+change.change));
    const grid=make('div',undefined,'comparison-grid');
    for(const [role,result,index,key] of [['Predecessor',comparison.predecessor,comparison.before,'before'],['Successor',comparison.successor,comparison.after,'after']]){
      const endpoint=make('section',undefined,'comparison-card revision-endpoint');endpoint.dataset.endpoint=key;
      endpoint.append(make('h4',role));
      for(const item of change.values){
        const group=make('div',undefined,'revision-field');group.dataset.field=item.field??'whole-row';
        const label=item.field??'complete row';group.append(make('h5',label));value(group,item[key],label);endpoint.append(group);
      }
      context(endpoint,result,index,change);grid.append(endpoint);
    }
    card.append(grid);section.append(card);
  }
  section.append(make('h3','Recorded successor publication review'),make('p',review.basis),
    make('p',review.reviewed_at+'; reviewer kind: '+review.reviewer_kind),identities);
  return section;
}
