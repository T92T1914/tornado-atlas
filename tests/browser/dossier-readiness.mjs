// A ready flag belongs to a specific document and selected evidence route.
export async function waitForDossier(page, expected, options={}) {
  await page.waitForFunction(({href,elementId}) =>
    location.href === href && document.body?.dataset.ready === 'true' &&
      Boolean(document.getElementById(elementId)), expected, options);
}
