// The original local image links work without JavaScript.
// The shared viewer adds enlargement and reversible URL history.
import {mountPhotoViewer} from './photo-view.mjs';

const links = new Map([...document.querySelectorAll('a[data-photo-id]')]
  .map(link => [link.dataset.photoId, link]));
const dialog = document.getElementById('photo-dialog');
const openPhoto = mountPhotoViewer();
let currentId = null, ownedEntry = null, opener = null;

function selectedLink() {
  return links.get(new URL(location.href).searchParams.get('photo'));
}
function returnFocus() {
  const target = opener;
  if (!target) return;
  // History traversal can clear outside focus after popstate but before this frame.
  const claim = document.activeElement;
  const destination = claim && claim !== document.body && claim !== target &&
    !dialog.contains(claim) ? claim : target;
  requestAnimationFrame(() => {
    const focus = document.activeElement;
    if (focus && focus !== document.body && focus !== target && !dialog.contains(focus)) return;
    if (!dialog.open && currentId === null && opener === target && !selectedLink() &&
      document.visibilityState !== 'hidden' && destination.isConnected) destination.focus({preventScroll:true});
  });
}
function showFromLocation() {
  const link = selectedLink();
  if (!link) {
    currentId = null;
    if (dialog.open) dialog.close();
    returnFocus();
    return;
  }
  const figure = link.closest('figure');
  currentId = link.dataset.photoId;
  opener = link;
  const photograph = figure.dataset.photoKind === 'photograph';
  openPhoto({
    title: figure.querySelector('h3').textContent + (photograph ? '' : ' at the reported county crossing'),
    asset: link.href,
    alt: link.querySelector('img').alt,
    caption: figure.querySelector('figcaption').textContent,
    location: photograph ? figure.dataset.photoLocation : 'Source caption: April 27, 2011, 5:38 p.m., KBMX 0.5-degree product. The caption does not repeat a time-zone label. No independent alignment, raster registration or surface-wind measurement is assigned.',
    credit: photograph ? figure.dataset.photoCredit : 'Original National Weather Service Birmingham radar product, preserved unchanged. Individual image maker is not named. NWS material is not subject to copyright protection. No government endorsement is implied.',
    source: 'https://www.weather.gov/bmx/event_04272011tuscbirm',
    license: 'Read the NWS material and third-party rights policy',
    licenseUrl: 'https://www.weather.gov/disclaimer',
  });
  document.getElementById('photo-original').textContent = photograph ?
    'Open the metadata-stripped publication copy' : 'Open the original radar image';
}
for (const [id, link] of links) {
  link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
      event.shiftKey || event.altKey) return;
    event.preventDefault();
    const url = new URL(location.href);
    url.searchParams.set('photo', id);
    history.pushState(null, '', url);
    ownedEntry = id;
    showFromLocation();
  });
}
dialog.addEventListener('close', () => {
  if (dialog.open || currentId === null) return;
  if (selectedLink()?.dataset.photoId !== currentId) {
    currentId = null;
    returnFocus();
    return;
  }
  if (ownedEntry === currentId) history.back();
  else {
    // A direct viewer URL has no viewer-owned predecessor to navigate to.
    const url = new URL(location.href);
    url.searchParams.delete('photo');
    history.replaceState(null, '', url);
    showFromLocation();
  }
});
window.addEventListener('popstate', showFromLocation);
showFromLocation();
document.body.dataset.photoViewer = 'ready';
