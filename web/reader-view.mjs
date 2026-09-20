/* A reading layer over the same curated chapters used by the map. */
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
  const updated = document.getElementById('exhibit-updated');
  const date = create('time', new Date(reading.updated + 'T00:00:00Z').toLocaleDateString('en-US',
    {year:'numeric', month:'long', day:'numeric', timeZone:'UTC'}));
  date.dateTime = reading.updated;
  updated.append('Exhibit updated ', date);
  const chronology = document.getElementById('storm-chronology');
  for (const chapter of chapters) {
    const item = create('li', '');
    item.id = `chronology-${chapter.minute}`;
    item.append(create('span', chapter.time, 'chapter-time'),
      create('h4', chapter.title), create('p', chapter.text));
    const links = create('div', '', 'chapter-links');
    // A chapter may describe an interval or precede the first observed point.
    // Label the actual selectable map time instead of silently equating the two.
    const mapLink = create('a', `View ${chapter.map_time} on the map`);
    mapLink.href = '#path';
    mapLink.addEventListener('click', () => selectMinute(chapter.minute));
    links.append(mapLink, external('NWS account ↗', chapter.source));
    item.append(links);
    chronology.append(item);
  }
  const groups = new Map();
  for (const source of reading.sources) {
    if (!groups.has(source.group)) {
      const group = create('div', '', 'source-group');
      const list = create('ol', '');
      group.append(create('h3', source.group), list);
      document.getElementById('source-register').append(group);
      groups.set(source.group, list);
    }
    const item = create('li', '');
    const title = create('h4', '');
    title.append(external(source.title + ' ↗', source.url));
    item.append(create('p', source.publisher, 'source-publisher'), title, create('p', source.use));
    groups.get(source.group).append(item);
  }

  const contents = document.getElementById('exhibit-contents');
  const narrow = matchMedia('(max-width:1080px)');
  const adapt = () => { contents.open = !narrow.matches; };
  adapt();
  narrow.addEventListener('change', adapt);
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
