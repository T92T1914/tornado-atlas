import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture, base} from './harness.mjs';

const oldFile = 'archive/joplin-2011-c080b55cf2dfa5efc278.json';
const eastId = 'intake-nist-east-middle-refuge-2014';
const highId = 'intake-nist-high-school-refuge-2014';
async function ready(page) {
  await page.waitForFunction(() => document.body?.dataset.ready === 'true');
}
async function open(page, suffix = '') {
  await page.goto(base + '/dossier.html' + suffix);
  await ready(page);
}
async function navigate(page, action) {
  const pending = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
  await action();
  await pending;
  await ready(page);
}

for (const width of [308, 390, 1280]) for (const appearance of ['dark', 'light']) {
  test(`school refuge discovery and source journey ${width} ${appearance}`, async t => {
    const page = await fixture(t, {viewport: {width, height: 900}});
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await open(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    await page.getByRole('searchbox', {name: 'Search dossiers'}).fill('school refuge');
    await navigate(page, () => page.getByRole('button', {name: 'Search', exact: true}).click());
    assert.equal(await page.locator('.archive-grid .archive-card').count(), 1);
    await navigate(page, () => page.getByRole('link', {name: 'Open evidence dossier', exact: true}).click());
    const east = page.locator('#observation-' + eastId);
    const high = page.locator('#observation-' + highId);
    assert.match(await east.textContent(), /school was unoccupied/);
    assert.match(await east.textContent(), /likely explanation/);
    assert.match(await high.textContent(), /whether anyone sheltered there/);
    assert.equal(await page.locator('h1').textContent(), 'Joplin, Missouri · May 22, 2011');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(requests.some(url => /ncei-|catalogue\/|data\.json|govinfo|\.png|\.jpg/.test(url)), false);
    const metadata = page.getByRole('link', {name: 'Download dossier metadata (JSON)', exact: true});
    const response = await page.request.get(await metadata.evaluate(el => el.href));
    assert.equal(response.ok(), true);
    const exported = await response.json();
    assert.equal(exported.provenance.publication_review.reviewer_kind, 'agent');
    const observed = exported.observations.find(row => row.id === eastId);
    assert.equal(observed.status.rights, 'links_only');
    assert.equal(observed.time.alignment, null);
    assert.equal(observed.place.coordinates, null);
    assert.equal(exported.media.length, 0);

    await navigate(page, () => east.getByRole('link', {name: 'Inspect the source card'}).click());
    const source = page.locator('#source-nist-school-refuge');
    assert.match(await source.textContent(), /PDF pages 274 to 277/);
    assert.match(await source.textContent(), /copyrighted 2007 school plan/);
    assert.match(await source.textContent(), /No human review/);
    assert.match(await source.textContent(), /Evidence drawn from this source Link to source card/);
    assert.match(await source.getByRole('link', {name: 'Read original source', exact: true}).getAttribute('href'), /govinfo\.gov\/content\/pkg\/.*#page=274$/);
    await source.getByRole('link', {name: 'Evidence drawn from this source'}).focus();
    assert.equal(await source.getByRole('link', {name: 'Evidence drawn from this source'}).evaluate(el => el === document.activeElement), true);
    await page.reload();
    await ready(page);
    assert.equal(await page.locator('[id^="observation-intake-nist-"]').count(), 2);
    await page.goBack();
    await ready(page);
    assert.ok(await page.locator('#observation-watch').count());
    // The chapter is static HTML, so use its content rather than the dossier's
    // asynchronous readiness marker to establish that navigation completed.
    await page.getByRole('link', {name: 'School refuge case comparison', exact: true}).click();
    await page.locator('#school-refuge').waitFor();
    assert.match(await page.locator('#school-refuge').textContent(), /historical building performance evidence/);
    await page.getByRole('link', {name: 'Inspect the High School finding and the missing occupancy evidence', exact: true}).click();
    await ready(page);
    await page.locator('#observation-' + highId).waitFor();
    await page.addStyleTag({content: 'body { font-size: 200%; }'});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.ATLAS_SCREENSHOT_DIR) {
      await mkdir(process.env.ATLAS_SCREENSHOT_DIR, {recursive: true});
      await page.screenshot({path: path.join(process.env.ATLAS_SCREENSHOT_DIR, `school-refuge-${width}-${appearance}.png`), fullPage: true});
    }
    const oldResponse = await page.request.get(base + '/' + oldFile);
    assert.equal(oldResponse.ok(), true);
    const old = await oldResponse.json();
    assert.equal(old.id, 'joplin-2011');
    assert.equal(old.observations.some(row => row.id === eastId), false);
    assert.equal(old.observations.find(row => row.id === 'touchdown').time.event.precision, 'approximate_minute');
  });
}

test('new dossier failure preserves retry and original source history', async t => {
  const page = await fixture(t);
  let fail = true;
  await page.route('**/archive/joplin-2011-*.json', route => fail && !route.request().url().endsWith(oldFile)
    ? route.fulfill({status: 503, body: 'Unavailable'}) : route.continue());
  await page.goto(base + '/dossier.html?event=joplin-2011');
  await page.waitForFunction(() => document.body?.dataset.ready === 'error');
  assert.equal(await page.locator('h1').textContent(), 'Evidence unavailable');
  assert.equal(await page.locator('[id^="observation-intake-nist-"]').count(), 0);
  assert.equal((await page.request.get(base + '/' + oldFile)).ok(), true);
  fail = false;
  await navigate(page, () => page.getByRole('link', {name: 'Retry this view'}).click());
  assert.equal(await page.locator('[id^="observation-intake-nist-"]').count(), 2);
});
