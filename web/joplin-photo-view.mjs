// Enhance source-linked photographs and radar figures with the shared viewer.
// Image links remain useful without JavaScript. No session data is retained.
import {mountPhotoViewer} from './photo-view.mjs';

const links = new Map([...document.querySelectorAll('a[data-photo-id]')]
  .map(link => [link.dataset.photoId, link]));
const dialog = document.getElementById('photo-dialog');
const openPhoto = mountPhotoViewer();
const rights = document.querySelector('#hospital-envelope a[href$="#page=4"]');
let currentId = null, ownedEntry = null, opener = null;

function selectedLink() {
  return links.get(new URL(location.href).searchParams.get('photo'));
}
function returnFocus() {
  const target = opener;
  if (!target) return;
  // History can restore user state after popstate dispatch.
  // Return focus on the next paint, unless another view opened meanwhile.
  requestAnimationFrame(() => {
    if (!dialog.open && currentId === null && opener === target && !selectedLink() &&
      document.visibilityState !== 'hidden') target.focus({preventScroll: true});
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
  const image = link.querySelector('img');
  const source = figure.querySelector('figcaption a[href*="#page="]');
  const annotated = link.dataset.photoKind === 'annotated-figure';
  const radar = link.dataset.photoKind === 'radar-figure';
  const itemRights = figure.closest('.documentary-note').querySelector('a[href$="#page=4"]');
  currentId = link.dataset.photoId;
  opener = link;
  openPhoto({
    title: link.getAttribute('aria-label').replace(/^Open the /, ''),
    asset: link.href,
    alt: image.alt,
    caption: figure.querySelector('figcaption').textContent,
    location: radar ? 'The figure retains seven source-reported UTC radar labels. It does not register an optical camera, a street-level wind field or a historical appearance interval.' :
      'Camera capture time and position remain unregistered. No historical clock or viewpoint is assigned.',
    credit: radar ? 'NOAA radar images, enhanced by NIST. Complete report figure, annotations, source credit and original caption retained as a PNG derivative. No government endorsement is implied.' :
      annotated ? 'National Institute of Standards and Technology. Complete photograph rectangle and NIST annotation from the report, retained as a PNG derivative. No separate holder is credited for this figure. No endorsement is implied.' :
      'National Institute of Standards and Technology. Complete embedded report photograph, with no separate holder credited for this figure. No endorsement is implied.',
    source: source.href,
    license: "Read the report's item-specific rights statement",
    licenseUrl: (itemRights || rights).href,
  });
  document.getElementById('photo-original').textContent = radar ? 'Open the complete radar figure and caption' : annotated ?
    'Open the complete photograph and NIST annotation' : 'Open the complete embedded photograph';
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
  // The shared viewer also receives queued close events after another image opens.
  if (dialog.open || currentId === null) return;
  if (selectedLink()?.dataset.photoId !== currentId) {
    currentId = null;
    returnFocus();
    return;
  }
  if (ownedEntry === currentId) {
    // Consume this close before the asynchronous history traversal.
    currentId = null;
    history.back();
  } else {
    // A direct image-view link has no viewer-owned predecessor to navigate to.
    const url = new URL(location.href);
    url.searchParams.delete('photo');
    history.replaceState(null, '', url);
    showFromLocation();
  }
});
window.addEventListener('popstate', showFromLocation);
showFromLocation();
document.body.dataset.photoViewer = 'ready';
