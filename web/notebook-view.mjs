// Unregistered source photographs remain text and credited links. This view
// neither loads the source image nor connects a caption to the historical clock.
export function mountNotebookPhotographs(notebook, container) {
  const element = (tag, text, className) => {
    const item = document.createElement(tag);
    if (text) item.textContent = text;
    if (className) item.className = className;
    return item;
  };
  const link = (text, href) => {
    const item = element('a', text);
    item.href = href;
    item.target = '_blank';
    item.rel = 'noopener noreferrer';
    return item;
  };
  for (const photo of notebook.photographs || []) {
    const card = element('article', '', 'observation');
    card.append(element('span', 'Inspected source photograph · Unregistered', 'eyebrow'),
      element('h4', photo.title),
      element('p', `Inspected still: ${photo.visual_note}`),
      element('p', `Author caption: ${photo.caption_note}`),
      element('p', `Author time: ${photo.source_time.label}. Minute precision; clock calibration unverified and time accuracy unknown.`),
      element('p', `Named place in the caption: ${photo.place.label}. This is not a registered camera position.`),
      element('p', `Image processing: ${photo.processing.note}`),
      element('p', photo.uncertainty),
      element('p', photo.rights.credit, 'fineprint'));
    const sources = element('p');
    sources.append(link('Open original photograph ↗', photo.source.original_url),
      element('span', ' · '), link('Read the source account ↗', photo.source.url));
    card.append(sources);
    const review = element('details');
    review.append(element('summary', 'What was inspected and what remains unknown'),
      element('p', `${photo.source.author} · ${photo.source.title}`),
      element('p', `Source locator: ${photo.source.locator}`),
      element('p', `Accessed ${photo.source.accessed_on}; reviewed ${photo.review.reviewed_on}. ${photo.review.coverage}`),
      element('p', `Not reviewed: ${photo.review.not_reviewed}`),
      element('p', `${photo.rights.notice} Credited links only; no image is copied or embedded here.`));
    card.append(review);
    container.append(card);
  }
}
