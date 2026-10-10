/* A reading layer over the same curated chapters used by the map. */
import {sourceMatches} from './source-filter.mjs';
export function mountReaderLayout() {
  const contents = document.getElementById('exhibit-contents');
  const narrow = matchMedia('(max-width:1080px)');
  const adapt = () => { contents.open = !narrow.matches; };
  adapt();
  narrow.addEventListener('change', adapt);
}
export function mountReader(reading, chapters, selectMinute) {
  const create = (tag, text, className) => {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const external = (text, url) => {
    const anchor = create('a', text);
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return anchor;
  };
  const chronology = document.getElementById('storm-chronology');
  for (const chapter of chapters) {
    chronology.querySelector(`[data-chapter-minute="${chapter.minute}"]`)
      .addEventListener('click', () => selectMinute(chapter.minute));
  }
  const groups = new Map();
  const sourceRows = [];
  const sourceSearch = document.getElementById('source-search');
  const sourceGroup = document.getElementById('source-group');
  const cursors = new Map();
  for (const group of document.querySelectorAll('#source-register .source-group')) {
    const name = group.querySelector('h3').textContent;
    groups.set(name, group.querySelector('ol'));
    cursors.set(name, 0);
    const option = create('option', name); option.value = name; sourceGroup.append(option);
  }
  for (const source of reading.sources) {
    const list = groups.get(source.group);
    const index = cursors.get(source.group);
    sourceRows.push({source, item:list.children[index]});
    cursors.set(source.group, index + 1);
  }
  for (const control of [sourceSearch,sourceGroup,document.getElementById('source-reset')]) control.disabled = false;
  const filterSources = () => {
    let count = 0;
    for (const {source,item} of sourceRows) {
      item.hidden = !sourceMatches(source, sourceSearch.value, sourceGroup.value);
      if (!item.hidden) count++;
    }
    for (const list of groups.values()) list.parentElement.hidden = ![...list.children].some(item => !item.hidden);
    document.getElementById('source-count').textContent = `${count} of ${sourceRows.length} sources${count ? '' : '. Try a different phrase or clear the filters.'}`;
  };
  sourceSearch.addEventListener('input', filterSources);
  sourceGroup.addEventListener('change', filterSources);
  document.getElementById('source-reset').addEventListener('click', () => {
    sourceSearch.value = ''; sourceGroup.value = ''; filterSources(); sourceSearch.focus();
  });
  filterSources();

  const contents = document.getElementById('exhibit-contents');
  const anchors = [...contents.querySelectorAll('a')];
  const sections = anchors.map(anchor => document.getElementById(anchor.hash.slice(1)));
  let scheduled = false;
  let current = -1;
  function markCurrent() {
    scheduled = false;
    let next = 0;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= 110) next = index;
    });
    if (next === current) return;
    anchors.forEach((anchor, index) => {
      if (index === next) anchor.setAttribute('aria-current', 'location');
      else anchor.removeAttribute('aria-current');
    });
    current = next;
  }
  const schedule = () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(markCurrent); }
  };
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule);
  markCurrent();
}
