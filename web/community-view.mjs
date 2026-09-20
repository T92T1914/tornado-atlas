/* Curated arguments and source checks, separate from the official event record. */
const labels = {
  supported_detail:'Supported detail',
  disputed_interpretation:'Disputed interpretation',
  unresolved:'Unresolved claim'
};
const sourceRoles = {primary:'Primary record', secondary:'Secondary account', community:'Community discussion'};
function element(tag, text, className) {
  const item = document.createElement(tag);
  if (text) item.textContent = text;
  if (className) item.className = className;
  return item;
}
function citations(ids, sources) {
  const list = element('ul', '', 'discussion-sources');
  for (const id of ids) {
    const source = sources.get(id);
    const item = element('li');
    const anchor = element('a', source.title);
    anchor.href = source.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    item.append(anchor, element('p', `${sourceRoles[source.role]} · ${source.publisher}`, 'fineprint'));
    const coverage = element('details');
    coverage.append(element('summary', 'What was checked'), element('p', source.coverage));
    item.append(coverage);
    list.append(item);
  }
  return list;
}
export function mountCommunity(documentation) {
  document.getElementById('community-introduction').textContent = documentation.introduction;
  document.getElementById('community-scope').textContent = documentation.scope;
  const sources = new Map(documentation.sources.map(source => [source.id, source]));
  const list = document.getElementById('community-discussions');
  for (const entry of documentation.entries) {
    const card = element('article', '', 'community-card');
    card.id = entry.id;
    const status = element('p', labels[entry.status], `discussion-status ${entry.status}`);
    const heading = element('h3');
    const permalink = element('a', entry.title);
    permalink.href = `#${entry.id}`;
    heading.append(permalink);
    card.append(status, heading, element('p', entry.claim), element('p', entry.conclusion, 'discussion-conclusion'));
    const evidence = element('details');
    evidence.append(element('summary', 'Follow the evidence and open questions'),
      element('h4', 'What the records support'), element('p', entry.check),
      citations(entry.evidence_sources, sources), element('h4', 'Where the discussion starts'),
      citations(entry.discussion_sources, sources), element('h4', 'What remains open'),
      element('p', entry.remaining));
    const reviewed = element('p', 'Reviewed ', 'fineprint');
    const date = element('time', new Date(entry.reviewed + 'T00:00:00Z').toLocaleDateString('en-US',
      {year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}));
    date.dateTime = entry.reviewed;
    reviewed.append(date);
    card.append(evidence, reviewed);
    list.append(card);
  }
}
