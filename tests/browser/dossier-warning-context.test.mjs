import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fixture, base} from './harness.mjs';
import {readDossierDownload} from './dossier-download-helper.mjs';

const id = 'intake-nws-local-siren-warning-distinction-2011';
const oldFile = 'archive/joplin-2011-8d3c839b9f9dafb8ff79.json';
const oldHash = '61d5e67f3392e69ed4a19d3b76df4144219aee9e03c783ce1e540918315c6b4a';
const report = 'https://www.weather.gov/media/publications/assessments/Joplin_tornado.pdf';
const reviewedBytes = await readFile(new URL('../../web/archive/joplin-2011-47a506c259e731b4c8e8.json', import.meta.url));
assert.equal(createHash('sha256').update(reviewedBytes).digest('hex'), '4515786871b2e983092685ffcf9bc327fa15874fd8dc455af0f3f62f2b3188f9');
const reviewed = JSON.parse(reviewedBytes.toString('utf8'));
async function ready(page) {
  await page.waitForFunction(() => document.body?.dataset.ready === 'true');
}

for (const width of [308, 390, 768, 1280]) {
  test(`first-siren warning context source journey ${width}`, async t => {
    const page = await fixture(t, {viewport: {width, height: 900}, acceptDownloads: true});
    const requests = [];
    page.on('request', request => requests.push({url: request.url(),
      type: request.resourceType(), referrer: request.headers()['referer'] || ''}));
    await page.goto(base + '/joplin.html#warning-context');
    const note = page.locator('#warning-context');
    await note.waitFor();
    assert.match(await note.textContent(), /5:11 p.m. CDT/);
    assert.match(await note.textContent(), /different storm/);
    assert.match(await note.textContent(), /selected historical interviews/);
    assert.equal(await note.getByRole('link', {name: 'Original report, printed page 13'}).getAttribute('href'), report + '#page=19');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    const beforeDossier = requests.length;
    await note.getByRole('link', {name: 'Inspect the first-siren distinction and its limits'}).click();
    await ready(page);
    assert.equal(new URL(page.url()).searchParams.get('observation'), id);
    const card = page.locator('#observation-' + id);
    assert.equal(await page.locator('[id^="observation-"]').count(), 1);
    assert.match(await card.textContent(), /funnel-cloud reports west of Joplin/);
    assert.match(await card.textContent(), /warning 30/);
    assert.match(await card.textContent(), /not an independently reconstructed alert chain/);
    assert.match(await card.textContent(), /no individual reception time or video alignment/);
    assert.match(await card.textContent(), /Current siren policy was not investigated/);
    assert.match(await card.textContent(), /source reported/);
    assert.match(await card.textContent(), /unregistered/);
    const actionRequests = requests.slice(beforeDossier);
    const dossierRequests = actionRequests.map(request => request.url).filter(url => url.endsWith('.json'));
    assert.equal(dossierRequests.length, 3);
    assert.ok(dossierRequests.some(url => url.endsWith('/archive/index.json')));
    assert.ok(dossierRequests.some(url => /\/archive\/joplin-2011-[a-f0-9]{20}\.json$/.test(url)));
    assert.ok(dossierRequests.some(url => /\/archive\/joplin-2011-history-[a-f0-9]{20}\.json$/.test(url)));
    // Scrolling to click the chapter link can trigger its retained lazy images.
    // Their initiating document is separate from the selected dossier's loading.
    const unexpected = actionRequests.filter(request => {
      const chapterImage = request.type === 'image' && request.referrer === base + '/joplin.html';
      return !chapterImage && /catalogue\/|data\.json|\.pdf|\.png|\.jpg/.test(new URL(request.url).pathname);
    });
    assert.deepEqual(unexpected, [], 'Unexpected dossier media or catalogue requests');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    const {dossier:current} = await readDossierDownload(page);
    const item = current.observations.find(row => row.id === id);
    assert.equal(reviewed.observations.length, 11);
    assert.equal(current.sources.filter(source => source.id === 'nws-assessment').length, 1);
    assert.equal(item.source_id, 'nws-assessment');
    assert.equal(item.time.alignment, null);
    assert.equal(item.time.event, null);
    assert.equal(item.place.coordinates, null);
    assert.equal(item.status.rights, 'links_only');
    assert.equal(current.provenance.publication_review.reviewer_kind, 'agent');
    const oldResponse = await page.request.get(base + '/' + oldFile);
    assert.equal(oldResponse.ok(), true);
    const oldBytes = await oldResponse.body();
    assert.equal(createHash('sha256').update(oldBytes).digest('hex'), oldHash);
    const old = JSON.parse(oldBytes.toString('utf8'));
    assert.deepEqual(reviewed.observations.slice(0, 10), old.observations);
    assert.equal(reviewed.observations[10].id, id);
    assert.deepEqual(current.observations.slice(0, 10), old.observations);
    for (const key of ['records', 'reconstruction']) {
      assert.deepEqual(current[key], old[key]);
    }
    assert.deepEqual(reviewed.routes, [...old.routes, {
      href: 'joplin.html#hospital-envelope', label: 'Hospital frame, windows and loss of function'}, {
      href: 'joplin.html#roof-bracing', label: 'How roof loss removed wall support'}, {
      href: 'joplin.html#radar-reading', label: 'What radar measured above the damage layer'}]);
    assert.deepEqual(reviewed.creators.filter(row=>row.id!=='noaa-radar'), [...old.creators, {id: 'nist', name: 'National Institute of Standards and Technology',
      basis: 'The original NIST investigation overview credits the survivor-interview photograph to NIST. Individual photographer and subjects are not identified in that caption.'}]);
    assert.equal(current.creators.filter(row=>row.id==='noaa-radar').length,1);
    const addedMedia = ['nist-joplin-survivor-interview', 'nist-west-tower', 'nist-west-tower-south-windows', 'nist-home-depot-roof', 'nist-joplin-radar-sequence'];
    assert.deepEqual(reviewed.media.filter(row => !addedMedia.includes(row.id)), old.media);
    assert.deepEqual(reviewed.media.map(row => row.id), [...old.media.map(row => row.id), ...addedMedia]);
    for (const field of ['observations', 'sources', 'media', 'creators']) {
      const retainedIds = new Set(reviewed[field].map(row => row.id));
      assert.deepEqual(current[field].filter(row => retainedIds.has(row.id)), reviewed[field],
        `The current download preserves every complete established ${field} record`);
    }
    assert.deepEqual(current.routes.slice(0, reviewed.routes.length), reviewed.routes);
    const interview = current.media.find(row => row.id === 'nist-joplin-survivor-interview');
    assert.equal(interview.source_id, 'nist-investigation-photo');
    assert.equal(interview.url, 'https://www.nist.gov/sites/default/files/images/2018/10/12/joplin.jpg');
    assert.equal(interview.kind, 'photograph');
    assert.deepEqual(interview.status, {intake: 'published', assertion: 'source_reported', temporal: 'unregistered',
      spatial: 'unregistered', availability: 'reviewed_available', rights: 'permitted_hosting'});
    for (const key of ['event', 'capture', 'publication', 'video', 'alignment']) assert.equal(interview.time[key], null);
    assert.equal(interview.place.coordinates, null);

    await card.getByRole('link', {name: 'Inspect the source card', exact: true}).click();
    await ready(page);
    const source = page.locator('#source-nws-assessment');
    assert.match(await source.textContent(), /PDF pages 17, 18 and 19/);
    assert.match(await source.textContent(), /not a full-report visual review/);
    assert.match(await source.textContent(), /Metadata and credited links only/);
    assert.equal(await source.getByRole('link', {name: 'Read original source', exact: true}).getAttribute('href'), report);
    assert.equal(await page.locator('#observation-' + id).count(), 1);
    assert.ok(await page.locator('#observation-first-siren').count());
    assert.ok(await page.locator('#observation-intake-nws-siren-cessation-2011').count());
    await page.goBack();
    await ready(page);
    assert.equal(new URL(page.url()).searchParams.get('observation'), id);
    assert.equal(await page.locator('[id^="observation-"]').count(), 1);
    await page.reload();
    await ready(page);
    assert.equal(await page.locator('#observation-' + id).count(), 1);
    await page.addStyleTag({content: 'body { font-size: 200%; }'});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
}
