/* A permanent historical location is independent of the animated storm clock. */
export function mountPlaces(places, svg, project) {
  const create = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const layer = document.createElementNS(svg.namespaceURI, 'g');
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('display', 'none');
  svg.append(layer);
  const enabled = document.getElementById('places-enabled');
  const status = document.getElementById('places-status');
  const update = () => {
    layer.setAttribute('display', enabled.checked ? 'inline' : 'none');
    status.textContent = enabled.checked
      ? `${places.length} documented location shown as a diamond. Recovery location, not an exact death location. It remains fixed while the timeline moves.`
      : 'Documented locations are hidden. Open the location account below the map to inspect the evidence.';
  };
  enabled.addEventListener('change', update);
  for (const place of places) {
    const [x,y] = project(place.coordinates);
    const mark = document.createElementNS(svg.namespaceURI, 'path');
    mark.setAttribute('d', `M ${x} ${y-9} l 9 9 l -9 9 l -9 -9 Z`);
    mark.setAttribute('class', 'incident-marker');
    const mapLink = document.createElementNS(svg.namespaceURI, 'a');
    mapLink.setAttribute('href', '#'+place.id);
    mapLink.setAttribute('aria-label', place.title+'; '+place.label);
    // The matching HTML link keeps the account accessible outside the SVG image.
    mapLink.append(mark); layer.append(mapLink);
    const card = create('article', '', 'place-record');
    card.id = place.id;
    card.append(create('p', place.label, 'place-kind'), create('h3', place.title),
      create('p', place.account), create('p', place.precision_note, 'fineprint'),
      create('p', place.time_note, 'fineprint'));
    const source = create('a', 'Read the research account');
    source.href = place.source; source.target = '_blank'; source.rel = 'noopener noreferrer';
    const locator = create('p', place.source_locator, 'fineprint');
    const show = create('a', 'Show this location on the path map');
    show.href = '#path';
    show.addEventListener('click', () => { enabled.checked = true; update(); });
    const links = create('div', '', 'report-links'); links.append(source, show);
    card.append(links, locator);
    document.getElementById('documented-places').append(card);
  }
  update();
}
