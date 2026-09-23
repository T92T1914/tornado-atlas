// One viewer for historical photographs, with the credit supplied by each source.
export function mountPhotoViewer() {
  const byId = id => document.getElementById(id);
  const dialog = byId('photo-dialog');
  let image = byId('photo-full'), current = null, selected = null;
  const close = byId('photo-close'), failure = byId('photo-failure');
  const status = document.createElement('p');
  status.id = 'photo-status'; status.setAttribute('role', 'status');
  const retry = document.createElement('button');
  retry.id = 'photo-retry'; retry.type = 'button'; retry.textContent = 'Retry photograph'; retry.hidden = true;
  failure.after(status, retry);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    // A queued close event can arrive after the visitor has opened another image.
    if (dialog.open) return;
    current = null; selected = null;
    image.hidden = true; image.removeAttribute('src');
    failure.hidden = true; retry.hidden = true; status.textContent = '';
  });
  function load(photo) {
    // A new element cannot display the previous request's bitmap with a new caption.
    const request = document.createElement('img');
    request.id = 'photo-full'; request.alt = photo.alt; request.hidden = true;
    request.referrerPolicy = 'no-referrer';
    current = request;
    image.removeAttribute('src');
    image.replaceWith(request); image = request;
    failure.hidden = true; retry.hidden = true; status.textContent = 'Loading photograph...';
    request.addEventListener('load', () => {
      if (current !== request) return;
      request.hidden = false; status.textContent = '';
    }, {once:true});
    request.addEventListener('error', () => {
      if (current !== request) return;
      request.hidden = true; failure.hidden = false; retry.hidden = false; status.textContent = '';
    }, {once:true});
    request.src = photo.asset;
  }
  retry.addEventListener('click', () => {
    if (!selected) return;
    close.focus();
    load(selected);
  });
  return photo => {
    selected = {...photo};
    byId('photo-title').textContent = photo.title;
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
    load(selected);
    if (!dialog.open) dialog.showModal();
  };
}
