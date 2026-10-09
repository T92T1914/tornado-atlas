const IMAGE_BYTE_LIMIT = 2 * 1024 * 1024;
const IMAGE_DEADLINE_MS = 10000;

// An opted-in selection must display precisely the bytes checked here. A URL,
// successful response or matching dimensions do not establish that association.
export async function checkedPhotoBytes(photo, {signal, fetcher = globalThis.fetch,
  subtle = globalThis.crypto?.subtle, deadline} = {}) {
  const live = () => {
    signal?.throwIfAborted();
    if (deadline !== undefined && performance.now() >= deadline) throw Error('The image check took too long.');
  };
  if (typeof photo.expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(photo.expectedSha256))
    throw Error('The selected record has no usable image fingerprint.');
  if (typeof subtle?.digest !== 'function') throw Error('This browser cannot check the selected image.');
  live();
  const response = await fetcher(photo.asset, {signal, cache:'no-store', credentials:'omit',
    redirect:'error', referrerPolicy:'no-referrer'});
  let reader;
  try {
    live();
    if (!response.ok) throw Error('The selected image could not load.');
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > IMAGE_BYTE_LIMIT))
      throw Error('The selected image exceeds its reading limit.');
    if (typeof response.body?.getReader !== 'function') throw Error('This browser cannot read a bounded image response.');
    reader = response.body.getReader();
    const chunks = []; let size = 0;
    for (;;) {
      const {value, done} = await reader.read();
      live();
      if (done) break;
      if (!(value instanceof Uint8Array) || value.byteLength > IMAGE_BYTE_LIMIT - size)
        throw Error('The selected image exceeds its reading limit.');
      size += value.byteLength; chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
    const digest = [...new Uint8Array(await subtle.digest('SHA-256', bytes))]
      .map(value => value.toString(16).padStart(2, '0')).join('');
    live();
    if (digest !== photo.expectedSha256) throw Error('The received image does not match the selected record.');
    return {bytes, type:response.headers.get('content-type') || 'application/octet-stream'};
  } catch (error) {
    // The viewer also aborts the owning fetch. Cancellation is observed without
    // allowing a rejected or stalled cancellation promise to delay that abort.
    try {Promise.resolve(reader ? reader.cancel() : response.body?.cancel()).catch(() => {});} catch {}
    throw error;
  } finally {reader?.releaseLock();}
}

// One viewer for historical images, with the credit supplied by each source.
export function mountPhotoViewer() {
  const byId = id => document.getElementById(id);
  const dialog = byId('photo-dialog');
  let image = byId('photo-full'), current = null, selected = null, attempt = null;
  const close = byId('photo-close'), failure = byId('photo-failure');
  const ordinaryFailure = failure.textContent;
  const status = document.createElement('p');
  status.id = 'photo-status'; status.setAttribute('role', 'status');
  const retry = document.createElement('button');
  retry.id = 'photo-retry'; retry.type = 'button'; retry.textContent = 'Retry image'; retry.hidden = true;
  failure.after(status, retry);
  function retire() {
    if (!attempt) return;
    attempt.active = false; clearTimeout(attempt.timer); attempt.controller?.abort();
    if (attempt.url) URL.revokeObjectURL(attempt.url);
    attempt.image.removeAttribute('src'); attempt = null;
  }
  close.addEventListener('click', () => {retire(); dialog.close();});
  dialog.addEventListener('cancel', retire);
  dialog.addEventListener('close', () => {
    // A queued close event can arrive after the visitor has opened another image.
    if (dialog.open) return;
    retire(); current = null; selected = null;
    image.hidden = true; image.removeAttribute('src');
    failure.hidden = true; retry.hidden = true; status.textContent = '';
  });
  function load(photo) {
    retire();
    // A new element cannot display the previous request's bitmap with a new caption.
    const request = document.createElement('img');
    request.id = 'photo-full'; request.alt = photo.alt; request.hidden = true;
    request.referrerPolicy = 'no-referrer';
    current = request;
    const checked = Object.hasOwn(photo, 'expectedSha256');
    const owned = {image:request, active:true, controller:checked ? new AbortController() : null,
      timer:null, url:null, deadline:checked ? performance.now() + IMAGE_DEADLINE_MS : null};
    attempt = owned;
    const owns = () => current === request && owned.active && dialog.open;
    const failed = message => {
      if (!owns()) return;
      // Ordinary failed images retain their selected src, as before. Checked
      // failures must additionally abort and retire any allocated display URL.
      if (checked) retire();
      request.hidden = true; failure.hidden = false; retry.hidden = false;
      status.textContent = checked ? message + ' It has not been displayed.' : '';
    };
    const withinDeadline = () => {
      if (!owns()) return false;
      if (checked && performance.now() >= owned.deadline) {
        failed('The image check took too long.'); return false;
      }
      return true;
    };
    image.removeAttribute('src');
    image.replaceWith(request); image = request;
    failure.hidden = true; failure.textContent = checked
      ? 'The image could not be checked or displayed. Retry, or follow its description and source links.' : ordinaryFailure;
    retry.hidden = true; status.textContent = checked ? 'Checking the complete image...' : 'Loading image...';
    request.addEventListener('load', async () => {
      if (!withinDeadline()) return;
      if (checked) {
        try {
          if (typeof request.decode !== 'function') throw Error('Decode unavailable');
          await request.decode();
        } catch {failed('The checked image could not finish decoding.'); return;}
        if (!withinDeadline()) return;
      }
      clearTimeout(owned.timer); request.hidden = false;
      status.textContent = checked ? 'Image bytes match the selected record.' : '';
    }, {once:true});
    request.addEventListener('error', () => {
      failed('The checked image could not be displayed.');
    }, {once:true});
    if (!checked) {request.src = photo.asset; return;}
    // The deadline includes reading, hashing and decoding. A late digest cannot
    // resurrect a failed, closed or replaced selection.
    owned.timer = setTimeout(() => failed('The image check took too long.'), IMAGE_DEADLINE_MS);
    checkedPhotoBytes(photo, {signal:owned.controller.signal, deadline:owned.deadline}).then(({bytes, type}) => {
      if (!withinDeadline()) return;
      if (typeof URL.createObjectURL !== 'function' || typeof URL.revokeObjectURL !== 'function')
        throw Error('This browser cannot display a checked image.');
      owned.url = URL.createObjectURL(new Blob([bytes], {type}));
      request.src = owned.url;
    }).catch(error => failed(error.message || 'The selected image could not be checked.'));
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
