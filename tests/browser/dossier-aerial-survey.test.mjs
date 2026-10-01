import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture, base} from './harness.mjs';

const observationId = 'intake-wakimoto-aerial-envelope-2016';
const sourceId = 'wakimoto-aerial-2016';
const oldFile = 'archive/el-reno-2013-a28dea62672e27329fd8.json';
async function ready(page) {
  await page.waitForFunction(() => document.body?.dataset.ready === 'true');
}
async function navigate(page, action) {
  const pending = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
  await action();
  await pending;
  await ready(page);
}

for (const width of [390, 1280]) for (const appearance of ['dark', 'light']) {
  test(`aerial survey source and immutable history journey ${width} ${appearance}`, async t => {
    const page = await fixture(t, {viewport: {width, height: 900}});
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    // Inspect the static entry link without loading the exhibit's media workspace.
    const chapter = await page.request.get(base + '/index.html');
    assert.equal(chapter.ok(), true);
    assert.match(await chapter.text(), /observation=intake-wakimoto-aerial-envelope-2016#observation-intake-wakimoto-aerial-envelope-2016/);
    await page.goto(base + '/dossier.html?event=el-reno-2013&observation=' + observationId);
    await ready(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    const observation = page.locator('#observation-' + observationId);
    assert.match(await observation.textContent(), /roughly 7 km/);
    assert.match(await observation.textContent(), /separate anticyclonic tornado/);
    assert.match(await observation.textContent(), /suggests rear-flank downdraft damage/);
    assert.match(await observation.textContent(), /does not replace the NWS 2.6-mile/);
    assert.equal(await page.locator('[id^="observation-"]').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    const metadata = page.getByRole('link', {name: 'Download dossier metadata (JSON)', exact: true});
    const response = await page.request.get(await metadata.evaluate(el => el.href));
    assert.equal(response.ok(), true);
    const exported = await response.json();
    const item = exported.observations.find(row => row.id === observationId);
    assert.equal(item.status.assertion, 'source_reported');
    assert.equal(item.status.rights, 'links_only');
    assert.equal(item.time.publication, '2016-05');
    assert.equal(item.time.capture.aerial_survey, '2013-06-04');
    assert.equal(item.time.alignment, null);
    assert.equal(item.place.coordinates, null);
    assert.equal(exported.reconstruction.intervals.length, 0);

    await navigate(page, () => observation.getByRole('link', {name: 'Inspect the source card'}).click());
    const source = page.locator('#source-' + sourceId);
    assert.match(await source.textContent(), /PDF pages 3 to 4/);
    assert.match(await source.textContent(), /10.1175\/MWR-D-15-0367.1/);
    assert.match(await source.textContent(), /No PDF or figure republication permission/);
    assert.equal(await source.getByRole('link', {name: 'Read original source', exact: true}).getAttribute('href'),
      'https://repository.library.noaa.gov/view/noaa/32144/noaa_32144_DS1.pdf#page=3');
    await page.reload();
    await ready(page);
    assert.equal(await page.locator('[id^="observation-"]').count(), 1);
    await page.goBack();
    await ready(page);
    await page.locator('#observation-' + observationId).waitFor();
    await page.addStyleTag({content: 'body { font-size: 200%; }'});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(requests.some(url => /catalogue\/|data\.json|\.pdf|\.png|\.jpg|youtube|harkphoto/.test(url)), false);

    const oldResponse = await page.request.get(base + '/' + oldFile);
    assert.equal(oldResponse.ok(), true);
    const old = await oldResponse.json();
    assert.equal(old.id, 'el-reno-2013');
    assert.equal(old.observations.some(row => row.id === observationId), false);
    assert.equal(old.sources.some(row => row.id === sourceId), false);
  });
}
