"""A rolling-stock photograph must join its source without changing accepted evidence."""

import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from atlas.archive import digest, dossier_history, dossiers, publication, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
EVENT = 'tuscaloosa-birmingham-2011'
MEDIA = 'train-cars-aftermath'
SOURCE = 'bmx-train-cars'
ASSET = 'assets/tuscaloosa-birmingham-2011/train-cars-april29.jpg'
ORIGINAL_URL = 'https://www.weather.gov/images/bmx/significant_events/2011/042711/tuscbirm/5.JPG'
ORIGINAL_SHA = 'a5dcbf3aeae597b7ec58e6617cb30ac4dc5dca9489d7b22f3f8077d92b198a49'
PUBLIC_SHA = '7d3f623f672efe61a65fc975feddddcc2e5ec58007b731a84da97bb3f8c6dd61'
SCAN_SHA = 'd10d3bdc7ff991dcbb504f38ac9407a5644863d11d13f385e9929fbfc610489d'
PRIOR_SHA = '51dee7670bcc10fbe2a64a7bc53f2bfe20ca9afbab777b1c777e1657cb3b73be'
TRAIN_SHA = '890095f5efe240af075c4c1aa7c7a63af403cc0bf9b8a07ab38ddd49b65f5dbb'
ADAPTER_SHA = '35b450a43834125500a844d47856b6248f24bc00defcc6d746ecafdf8da6544a'
STANDALONE_SHA = '70c3287ca062c2aa109214620bc7fc300c88ac2f9500709f1b8b95bf537d216d'
ALT = ('Elevated view of light-colored rail cars along an upper track and others scattered or angled '
       'across dark open ground near trees. NWS BMX is printed at bottom left and 04/29/2011 at bottom right.')
MEDIA_ROUTE = f'dossier.html?event={EVENT}&media={MEDIA}#media-{MEDIA}'
SOURCE_ROUTE = f'dossier.html?event={EVENT}&source={SOURCE}#source-{SOURCE}'


class TrainHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.hrefs, self.openers = [], [], []
        self.figure_count = 0
        self.figure = None
        self.links, self.images, self.caption = [], [], []
        self.source_links, self.source_text, self.interpretation = [], [], []
        self.in_figure = self.in_source = self.in_paragraph = False
        self.awaiting_paragraph = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'a':
            self.hrefs.append(attrs.get('href'))
            if attrs.get('data-photo-id') == MEDIA:
                self.openers.append(attrs)
        if tag == 'figure' and attrs.get('id') == 'train-cars':
            self.figure_count += 1
            self.figure = attrs
            self.in_figure = True
        if tag == 'li' and attrs.get('id') == 'source-train-cars':
            self.in_source = True
        if tag == 'p' and self.awaiting_paragraph:
            self.in_paragraph = True
            self.awaiting_paragraph = False
        if self.in_figure:
            if tag == 'a':
                self.links.append(attrs)
            if tag == 'img':
                self.images.append(attrs)
        if self.in_source and tag == 'a':
            self.source_links.append(attrs.get('href'))

    def handle_endtag(self, tag):
        if tag == 'figure' and self.in_figure:
            self.in_figure = False
            self.awaiting_paragraph = True
        if tag == 'li':
            self.in_source = False
        if tag == 'p':
            self.in_paragraph = False

    def handle_data(self, text):
        if self.in_figure:
            self.caption.append(text)
        if self.in_source:
            self.source_text.append(text)
        if self.in_paragraph:
            self.interpretation.append(text)


class TuscaloosaTrainCarsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.current = next(doc for doc in dossiers() if doc['id'] == EVENT)
        cls.doc = json.loads((ROOT / 'web/archive' / f'{EVENT}-{TRAIN_SHA[:20]}.json').read_text(encoding='utf-8'))
        cls.prior = json.loads((ROOT / 'web/archive' / f'{EVENT}-{PRIOR_SHA[:20]}.json').read_text(encoding='utf-8'))
        cls.wrapper = json.loads((ROOT / f'research/archive-curated/{EVENT}.json').read_text(encoding='utf-8'))
        cls.item = next(item for item in cls.doc['media'] if item['id'] == MEDIA)
        cls.source = next(source for source in cls.doc['sources'] if source['id'] == SOURCE)
        cls.html = (ROOT / 'web/tuscaloosa.html').read_text(encoding='utf-8')
        cls.view = TrainHTML()
        cls.view.feed(cls.html)
        cls.raw = (ROOT / 'web' / ASSET).read_bytes()

    def test_exact_retained_train_revision_preserves_the_accepted_outlook_publication(self):
        self.assertEqual(digest(self.doc), TRAIN_SHA)
        self.assertEqual(digest(self.prior), PRIOR_SHA)
        self.assertEqual(tuple(len(self.prior[key]) for key in ('media', 'sources', 'observations', 'records', 'routes')),
                         (6, 11, 12, 3, 8))
        self.assertEqual(tuple(len(self.doc[key]) for key in ('media', 'sources', 'observations', 'records', 'routes')),
                         (7, 12, 12, 3, 9))
        for field in ('observations', 'records', 'creators', 'reconstruction', 'title', 'summary', 'coverage'):
            self.assertEqual(self.doc[field], self.prior[field], field)
        for field in ('media', 'sources', 'routes'):
            self.assertEqual(self.doc[field][:len(self.prior[field])], self.prior[field], field)
        self.assertEqual(self.doc['media'][len(self.prior['media']):], [self.item])
        self.assertEqual(self.doc['sources'][len(self.prior['sources']):], [self.source])
        self.assertEqual(self.doc['routes'][len(self.prior['routes']):],
                         [{'label': 'Inspect the rail-car aftermath', 'href': 'tuscaloosa.html#train-cars'}])
        for key, value in self.prior['provenance'].items():
            if key != 'publication_review':
                self.assertEqual(self.doc['provenance'][key], value, key)
        self.assertEqual(self.doc['provenance']['publication_review']['previous_dossier_sha256'], PRIOR_SHA)
        self.assertEqual(self.wrapper['dossier'], self.current)
        for field in ('media', 'sources', 'creators', 'routes'):
            self.assertEqual(self.current[field][:len(self.doc[field])], self.doc[field], field)
        for field in ('observations', 'records', 'reconstruction', 'title', 'summary', 'coverage'):
            self.assertEqual(self.current[field], self.doc[field], field)
        self.assertEqual(self.wrapper['adapter_sha256'], ADAPTER_SHA)
        standalone = (ROOT / f'exhibits/{EVENT}/dossier.json').read_bytes()
        self.assertEqual((len(standalone), hashlib.sha256(standalone).hexdigest()), (49883, STANDALONE_SHA))
        self.assertEqual(digest(json.loads(standalone)), ADAPTER_SHA)
        self.assertIs(validate_dossier(self.doc), self.doc)

    def test_publication_and_history_identify_only_the_intended_increment(self):
        artifacts = publication()
        entry = next(entry for entry in artifacts['archive/index.json']['events'] if entry['id'] == EVENT)
        self.assertEqual(artifacts[entry['file']], self.current)
        self.assertEqual(entry['registered_media'], 0)
        directory = artifacts[artifacts['archive/index.json']['source_directory']['file']]
        rows = [row for row in directory['entries'] if row['event_id'] == EVENT and row['source']['id'] == SOURCE]
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]['observations'], rows[0]['media']), (0, 1))
        self.assertEqual(rows[0]['source'], self.source)
        latest = next(version for version in dossier_history(self.current)['versions']
                      if version['dossier_sha256'] == TRAIN_SHA)
        self.assertEqual(latest['dossier_sha256'], digest(self.doc))
        self.assertTrue(latest['predecessor_available'])
        self.assertEqual(latest['review']['previous_dossier_sha256'], PRIOR_SHA)
        self.assertEqual(latest['changes'], [
            {'kind': 'sources', 'id': SOURCE, 'change': 'added', 'fields': []},
            {'kind': 'media', 'id': MEDIA, 'change': 'added', 'fields': []},
            {'kind': 'dossier', 'id': EVENT, 'change': 'updated', 'fields': ['routes']},
        ])

    def test_photo_roles_source_labels_and_uncertainty_do_not_register_a_site(self):
        self.assertEqual((self.item['source_id'], self.item['url'], self.source['url']),
                         (SOURCE, ORIGINAL_URL, ORIGINAL_URL))
        self.assertEqual(self.source['title'], 'NWS Birmingham: Train Cars Derailed & Thrown')
        self.assertEqual((self.item['title'], self.item['kind']), ('Rail cars in the survey aftermath', 'photograph'))
        self.assertEqual(self.item['status'], {
            'assertion': 'observed_sample', 'availability': 'reviewed_available', 'intake': 'published',
            'rights': 'permitted_hosting', 'spatial': 'unregistered', 'temporal': 'source_label',
        })
        self.assertEqual(self.item['roles'], {'creator': None, 'uploader': 'nws-birmingham', 'rights_holder': None})
        self.assertIsNone(self.item['parent'])
        self.assertIsNone(self.item['place']['coordinates'])
        self.assertEqual(self.item['place']['role'], 'aftermath_context')
        for clock in ('capture', 'publication', 'video', 'alignment'):
            self.assertIsNone(self.item['time'][clock])
        self.assertIn('April 27, 2011', self.item['time']['event'])
        self.assertEqual(self.item['time']['retrieval'], '2026-10-06T02:33:06.654056+00:00')
        self.assertIn('Train Cars Derailed & Thrown', self.item['locator'])
        for word in ('source label', 'railway', 'photographer', 'camera', 'capture', 'bridge',
                     'force', 'wind speed', 'trajectory', 'rating', 'victim'):
            self.assertIn(word, self.item['limits'].lower())
        self.assertIn('April 29, 2011', self.item['limits'])
        self.assertIn(ORIGINAL_SHA, self.source['revision'])
        for word in ('Item-specific agency-material inference', 'NWS BMX', 'third-party', 'endorsement'):
            self.assertIn(word, self.source['rights'])
        self.assertRegex(self.source['rights'], r'(?i)photographer.{0,40}employment.{0,40}unknown')
        self.assertIn('https://www.weather.gov/disclaimer', self.source['rights'])

    def checked_jpeg(self, raw):
        self.assertEqual(raw[:2], b'\xff\xd8')
        cursor, frame = 2, None
        while True:
            self.assertLess(cursor + 4, len(raw))
            self.assertEqual(raw[cursor], 0xff)
            marker = raw[cursor + 1]
            length = int.from_bytes(raw[cursor + 2:cursor + 4], 'big')
            self.assertGreaterEqual(length, 2)
            self.assertLessEqual(cursor + length + 2, len(raw))
            if marker == 0xda:
                break
            self.assertNotIn(marker, (0xe1, 0xed, 0xfe), 'No EXIF/XMP, IPTC or comment metadata')
            if marker in (0xc0, 0xc1, 0xc2):
                frame = (int.from_bytes(raw[cursor + 7:cursor + 9], 'big'),
                         int.from_bytes(raw[cursor + 5:cursor + 7], 'big'), raw[cursor + 9])
            cursor += length + 2
        self.assertEqual(frame, (800, 600, 3))
        scan = cursor + length + 2
        self.assertEqual(raw[-2:], b'\xff\xd9')
        self.assertEqual(len(raw[scan:-2]), 102770)
        self.assertEqual(hashlib.sha256(raw[scan:-2]).hexdigest(), SCAN_SHA, 'Exact reviewed entropy scan')
        return scan

    def test_exact_publication_copy_matches_its_transform_without_private_headers(self):
        self.assertEqual((len(self.raw), hashlib.sha256(self.raw).hexdigest()), (103141, PUBLIC_SHA))
        transform = self.item['transformation']
        self.assertEqual((transform['asset'], transform['sha256'], transform['width'], transform['height']),
                         (ASSET, PUBLIC_SHA, 800, 600))
        self.assertEqual(transform['alt'], ALT)
        for word in ('EXIF', 'recompression', 'crop', 'rescal', 'credit', 'date'):
            self.assertIn(word, transform['recipe'])
        self.checked_jpeg(self.raw)

    def test_metadata_and_changed_scan_fixtures_fail_the_corresponding_boundary(self):
        with self.assertRaisesRegex(AssertionError, 'No EXIF/XMP'):
            self.checked_jpeg(self.raw[:2] + b'\xff\xe1\x00\x08Exif\x00\x00' + self.raw[2:])
        changed = bytearray(self.raw)
        changed[self.checked_jpeg(self.raw) + 100] ^= 1
        with self.assertRaisesRegex(AssertionError, 'Exact reviewed entropy scan'):
            self.checked_jpeg(changed)

    def test_static_figure_and_source_routes_join_the_exact_selected_image(self):
        view = self.view
        self.assertEqual(view.figure_count, 1)
        self.assertEqual(len(view.openers), 1)
        self.assertEqual(len(view.ids), len(set(view.ids)))
        self.assertLess(view.ids.index('railway-bridge'), view.ids.index('train-cars'))
        self.assertLess(view.ids.index('train-cars'), view.ids.index('aerial-context'))
        self.assertEqual(view.figure['data-photo-kind'], 'photograph')
        self.assertEqual(view.openers[0]['href'], ASSET)
        self.assertTrue(view.openers[0].get('aria-label'))
        self.assertEqual(len(view.images), 1)
        self.assertEqual(view.images[0]['src'], ASSET)
        self.assertEqual(view.images[0]['alt'], self.item['transformation']['alt'])
        self.assertEqual((view.images[0]['width'], view.images[0]['height'], view.images[0]['loading']),
                         ('800', '600', 'lazy'))
        self.assertIn(MEDIA_ROUTE, {link.get('href') for link in view.links})
        self.assertIn(SOURCE_ROUTE, view.source_links)
        self.assertIn(ORIGINAL_URL, view.source_links)
        self.assertIn('#train-cars', view.hrefs)
        caption = ' '.join(view.caption)
        for phrase in ('Train Cars Derailed & Thrown', 'NWS BMX', 'April 29, 2011', 'Individual photographer unknown'):
            self.assertIn(phrase, caption)
        for phrase in ('source label', 'capture time and time zone are unknown', 'No clock or geographic registration'):
            self.assertIn(phrase, view.figure['data-photo-location'])
        for phrase in ('NWS BMX', 'Individual photographer and employment unknown.',
                       'decoded pixels, agency credit and printed date are unchanged',
                       'Item-specific agency-material reuse basis', 'No government endorsement'):
            self.assertIn(phrase, view.figure['data-photo-credit'])
        interpretation = ' '.join(view.interpretation)
        for phrase in ('not established', 'same railway or place', 'attributed', 'failure sequence',
                       'force', 'wind speed', 'trajectory', 'not a calibrated capture clock'):
            self.assertIn(phrase, interpretation)

    def test_current_coverage_and_public_boundaries_match_the_five_photo_increment(self):
        for phrase in ('five contextual aftermath photographs', 'Five survey photographs',
                       'five separate aftermath photographs'):
            self.assertIn(phrase, self.html)
        readme = (ROOT / 'README.md').read_text(encoding='utf-8')
        self.assertIn('five contextual aftermath photographs', readme)
        self.assertIn('rail', readme[readme.index('five contextual aftermath photographs'):].split('\n')[0])
        for text in (json.dumps(self.doc), self.html):
            for private in ('C:/Users/', 'C:\\Users\\', 'private_notes', 'access_token',
                            'acceptance-review/', 'train-photo-integration-plan', 'GPSInfo'):
                self.assertNotIn(private, text)

    def test_synthetic_coordinate_and_private_metadata_cannot_register_the_train_photo(self):
        doc = copy.deepcopy(self.doc)
        next(item for item in doc['media'] if item['id'] == MEDIA)['place']['coordinates'] = [-87.54, 33.21]
        with self.assertRaisesRegex(ValueError, 'Unregistered evidence cannot acquire a map point'):
            validate_dossier(doc)
        doc = copy.deepcopy(self.doc)
        next(item for item in doc['media'] if item['id'] == MEDIA)['transformation']['exif'] = {'GPSInfo': 'Synthetic fixture only'}
        with self.assertRaisesRegex(ValueError, 'Private curator fields'):
            validate_dossier(doc)


if __name__ == '__main__':
    unittest.main()
