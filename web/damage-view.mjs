const el = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const byId = id => document.getElementById(id);

export function mountDamage(gallery, showPhoto) {
  byId('damage-introduction').textContent = gallery.introduction;
  byId('damage-interpretation').textContent = gallery.interpretation_note;
  byId('damage-location').textContent = gallery.location_note;
  function openPhoto(photo) {
    showPhoto({title:photo.title, asset:photo.asset, alt:photo.caption,
      caption:`${photo.reported_rating} in NWS caption. ${photo.caption}`,
      location:photo.location_description + ' Exact camera coordinates and capture time are unverified.',
      credit:'NOAA / National Weather Service survey personnel. Original image bytes preserved.',
      source:photo.image_url});
  }
  function imageButton(photo, lazy = true) {
    const button = el('button', null, 'photo-button');
    button.setAttribute('aria-label', `Enlarge ${photo.title}`);
    const image = el('img');
    image.src = photo.asset;
    image.alt = photo.caption;
    image.width = photo.width;
    image.height = photo.height;
    image.loading = lazy ? 'lazy' : 'eager';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      button.replaceChildren(el('span', 'Photograph unavailable. Open the NWS source to view it.'));
      button.disabled = true;
    }, { once: true });
    button.append(image);
    button.addEventListener('click', () => openPhoto(photo));
    return button;
  }
  for (const [index, defaultIndex] of [0, 3].entries()) {
    const panel = el('div', null, 'damage-panel');
    const label = el('label', `Compare view ${index + 1}`);
    const select = el('select');
    select.id = `damage-view-${index + 1}`;
    label.htmlFor = select.id;
    for (const photo of gallery.photos) {
      const option = el('option', `${photo.source_photo_number}. ${photo.title} (${photo.reported_rating})`);
      option.value = photo.id;
      select.append(option);
    }
    select.value = gallery.photos[defaultIndex].id;
    const content = el('figure');
    function update() {
      const photo = gallery.photos.find(p => p.id === select.value);
      const caption = el('figcaption');
      caption.append(el('span', `NWS caption / ${photo.reported_rating}`, 'eyebrow'),
        el('h3', photo.title), el('p', photo.caption), el('p', photo.location_description, 'fineprint'));
      content.replaceChildren(imageButton(photo), caption);
    }
    select.addEventListener('change', update);
    panel.append(label, select, content);
    byId('damage-compare').append(panel);
    update();
  }
  function filter() {
    const photos = gallery.photos.filter(photo =>
      (!byId('damage-subject').value || photo.subject === byId('damage-subject').value) &&
      (!byId('damage-rating').value || photo.reported_rating === byId('damage-rating').value));
    byId('damage-photos').replaceChildren();
    byId('damage-count').textContent = `${photos.length} of ${gallery.photos.length} photographs`;
    for (const photo of photos) {
      const card = el('article');
      card.append(imageButton(photo), el('h3', photo.title), el('p', `${photo.subject} · ${photo.reported_rating} in NWS caption`));
      byId('damage-photos').append(card);
    }
    if (!photos.length) byId('damage-photos').append(el('p', 'No survey photographs match these filters.'));
  }
  for (const id of ['damage-subject', 'damage-rating']) byId(id).addEventListener('change', filter);
  filter();
}
