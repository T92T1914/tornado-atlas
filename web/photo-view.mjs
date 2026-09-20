// One viewer for historical photographs, with the credit supplied by each source.
export function mountPhotoViewer() {
  const byId = id => document.getElementById(id);
  const dialog = byId('photo-dialog');
  const image = byId('photo-full');
  byId('photo-close').addEventListener('click', () => dialog.close());
  image.addEventListener('error', () => {
    image.hidden = true;
    byId('photo-failure').hidden = false;
  });
  return photo => {
    byId('photo-title').textContent = photo.title;
    image.hidden = false;
    byId('photo-failure').hidden = true;
    image.alt = photo.alt;
    image.src = photo.asset;
    byId('photo-caption').textContent = photo.caption;
    byId('photo-location').textContent = photo.location;
    byId('photo-credit').textContent = photo.credit;
    byId('photo-source').href = photo.source;
    byId('photo-original').href = photo.asset;
    const license = byId('photo-license');
    license.hidden = !photo.license;
    license.textContent = photo.license || '';
    if (photo.licenseUrl) license.href = photo.licenseUrl;
    else license.removeAttribute('href');
    dialog.showModal();
  };
}
