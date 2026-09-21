export function sourceMatches(source, query = '', group = '') {
  const terms = query.trim().toLocaleLowerCase('en').split(/\s+/).filter(Boolean);
  const text = [source.title, source.publisher, source.use, source.group].join(' ').toLocaleLowerCase('en');
  return (!group || source.group === group) && terms.every(term => text.includes(term));
}
