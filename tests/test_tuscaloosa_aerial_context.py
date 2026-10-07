"""A wider documentary view must keep its own image and uncertainty."""
import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from atlas.archive import digest, dossier_history, dossiers, publication, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
EVENT = 'tuscaloosa-birmingham-2011'
MEDIA = 'aerial-context-aftermath'
SOURCE = 'bmx-aerial-context'
ASSET = 'assets/tuscaloosa-birmingham-2011/aerial-context-april29.jpg'
PUBLIC_SHA = 'df7c4593844902834ce3b428a7b021e8c530efd2b16ac5fe8698c3d7e92b703c'
PREVIOUS_SHA = '11a6678e22a1f3fab562a7cddb07891279bd6e7d03b83f2d57d08bd12614e8df'
AERIAL_SHA = '35b450a43834125500a844d47856b6248f24bc00defcc6d746ecafdf8da6544a'
SCAN_SHA = '2076720f92f92e725aaf85c3826c5d955228cdabd742c977810dc87075436a43'


class Figure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.figure = None
        self.links = []
        self.images = []
        self.text = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'figure' and attrs.get('id') == 'aerial-context':
            self.active = True
            self.figure = attrs
        if self.active:
            if tag == 'a':
                self.links.append(attrs)
            if tag == 'img':
                self.images.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'figure':
            self.active = False

    def handle_data(self, text):
        if self.active:
            self.text.append(text)


class TuscaloosaAerialContextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Test the exact accepted photo increment even after a later, distinct
        # documentary source is published. Current preservation is checked too.
        cls.doc = json.loads((ROOT / 'web/archive' / f'{EVENT}-{AERIAL_SHA[:20]}.json').read_text(encoding='utf-8'))
        cls.current = next(d for d in dossiers() if d['id'] == EVENT)
        cls.prior = json.loads((ROOT / 'web/archive' / f'{EVENT}-{PREVIOUS_SHA[:20]}.json').read_text(encoding='utf-8'))
        cls.item = next(m for m in cls.doc['media'] if m['id'] == MEDIA)
        cls.source = next(s for s in cls.doc['sources'] if s['id'] == SOURCE)
        cls.html = (ROOT / 'web/tuscaloosa.html').read_text(encoding='utf-8')
        cls.raw = (ROOT / 'web' / ASSET).read_bytes()

    def test_every_prior_account_and_media_value_is_preserved(self):
        self.assertEqual(digest(self.doc), AERIAL_SHA)
        self.assertEqual(digest(self.prior), PREVIOUS_SHA)
        self.assertEqual((len(self.prior['media']), len(self.prior['sources'])), (5, 9))
        self.assertEqual((len(self.doc['media']), len(self.doc['sources'])), (6, 10))
        for field in ('observations', 'records', 'reconstruction', 'creators', 'title', 'coverage', 'summary'):
            self.assertEqual(self.doc[field], self.prior[field], field)
        for field in ('media', 'sources', 'routes'):
            self.assertEqual(self.doc[field][:-1], self.prior[field], field)
        for key, value in self.prior['provenance'].items():
            if key not in ('publication_review', 'inputs'):
                self.assertEqual(self.doc['provenance'][key], value, key)
        for key, value in self.prior['provenance']['inputs'].items():
            self.assertEqual(self.doc['provenance']['inputs'][key], value)
        self.assertEqual(self.doc['provenance']['publication_review']['previous_dossier_sha256'], PREVIOUS_SHA)
        self.assertEqual(self.prior['provenance']['publication_review']['previous_dossier_sha256'],
                         'a1d19787e5730aa6216e3606955ce25a6edefc112891326875e8dc5101bbe115')
        self.assertLess((ROOT / f'exhibits/{EVENT}/dossier.json').stat().st_size, 50_000)

    def test_current_publication_preserves_all_accepted_photo_values(self):
        for field in ('records', 'reconstruction', 'title', 'coverage', 'summary'):
            self.assertEqual(self.current[field], self.doc[field], field)
        self.assertEqual(self.current['creators'][:len(self.doc['creators'])], self.doc['creators'])
        for field in ('media', 'observations', 'sources', 'routes'):
            self.assertEqual(self.current[field][:len(self.doc[field])], self.doc[field], field)
        self.assertEqual(validate_dossier(self.current), self.current)

    def test_source_attribution_and_clocks_do_not_register_a_camera_or_path(self):
        url = 'https://www.weather.gov/images/bmx/significant_events/2011/042711/tuscbirm/3.JPG'
        self.assertEqual((self.item['source_id'], self.item['url'], self.source['url']), (SOURCE, url, url))
        self.assertEqual(self.item['kind'], 'photograph')
        self.assertEqual(self.item['roles'], {'creator': None, 'uploader': 'nws-birmingham', 'rights_holder': None})
        for field, value in {'assertion': 'observed_sample', 'temporal': 'source_label',
                             'spatial': 'unregistered', 'rights': 'permitted_hosting'}.items():
            self.assertEqual(self.item['status'][field], value)
        for clock in ('capture', 'publication', 'video', 'alignment'):
            self.assertIsNone(self.item['time'][clock])
        self.assertIn('April 27, 2011', self.item['time']['event'])
        self.assertEqual(self.item['time']['retrieval'], '2026-10-05T18:00:22.631337+00:00')
        self.assertIsNone(self.item['place']['reported'])
        self.assertIsNone(self.item['place']['coordinates'])
        for text in ('April 29, 2011', 'full-track extent', 'measured width', 'wind speed',
                     'rating', 'victim location', 'capture clock', 'time zone'):
            self.assertIn(text, self.item['limits'])
        self.assertIn('Aerial View of Scope of Damage Path', self.item['locator'])
        self.assertIn('Item-specific agency-material inference', self.source['rights'])
        self.assertIn('Photographer employment is unknown', self.source['rights'])
        self.assertIn('36f933185af1f185572fa982ce828067b6a4f33bf8f72f128917e8c5c2f7bb50', self.source['revision'])
        self.assertEqual(self.item['transformation']['asset'], ASSET)
        self.assertEqual(self.item['transformation']['sha256'], PUBLIC_SHA)

    def checked_jpeg(self, raw):
        self.assertEqual(raw[:2], b'\xff\xd8')
        cursor = 2
        frame = None
        while raw[cursor + 1] != 0xda:
            self.assertEqual(raw[cursor], 0xff)
            marker = raw[cursor + 1]
            self.assertNotIn(marker, (0xe1, 0xed, 0xfe), 'No EXIF/XMP, IPTC or comment metadata')
            length = int.from_bytes(raw[cursor + 2:cursor + 4], 'big')
            self.assertGreaterEqual(length, 2)
            if marker in (0xc0, 0xc1, 0xc2):
                frame = (int.from_bytes(raw[cursor + 7:cursor + 9], 'big'),
                         int.from_bytes(raw[cursor + 5:cursor + 7], 'big'), raw[cursor + 9])
            cursor += length + 2
            self.assertLess(cursor, len(raw))
        self.assertEqual(frame, (800, 600, 3))
        scan = cursor + 2 + int.from_bytes(raw[cursor + 2:cursor + 4], 'big')
        self.assertEqual(raw[-2:], b'\xff\xd9')
        self.assertEqual(len(raw[scan:-2]), 95039)
        self.assertEqual(hashlib.sha256(raw[scan:-2]).hexdigest(), SCAN_SHA, 'Exact reviewed entropy scan')
        return scan

    def test_publication_copy_has_exact_bytes_without_private_image_headers(self):
        self.assertEqual((len(self.raw), hashlib.sha256(self.raw).hexdigest()), (95408, PUBLIC_SHA))
        self.checked_jpeg(self.raw)

    def test_metadata_and_changed_scan_faults_fail_the_intended_checks(self):
        with self.assertRaisesRegex(AssertionError, 'No EXIF/XMP'):
            self.checked_jpeg(self.raw[:2] + b'\xff\xe1\x00\x08Exif\x00\x00' + self.raw[2:])
        changed = bytearray(self.raw)
        changed[self.checked_jpeg(self.raw) + 100] ^= 1
        with self.assertRaisesRegex(AssertionError, 'Exact reviewed entropy scan'):
            self.checked_jpeg(changed)

    def test_figure_and_non_map_routes_join_the_exact_source_and_image(self):
        figure = Figure()
        figure.feed(self.html)
        self.assertEqual(figure.figure['data-photo-kind'], 'photograph')
        opener = next(a for a in figure.links if a.get('data-photo-id') == MEDIA)
        self.assertEqual(opener['href'], ASSET)
        self.assertTrue(opener['aria-label'])
        self.assertEqual(len(figure.images), 1)
        self.assertEqual(figure.images[0]['src'], ASSET)
        self.assertEqual(figure.images[0]['alt'], self.item['transformation']['alt'])
        self.assertEqual((figure.images[0]['width'], figure.images[0]['height']), ('800', '600'))
        self.assertIn(f'dossier.html?event={EVENT}&media={MEDIA}#media-{MEDIA}', {a['href'] for a in figure.links})
        for text in ('Individual photographer unknown', 'Aerial View of Scope of Damage Path'):
            self.assertIn(text, ' '.join(figure.text))
        for text in ('locality is unidentified', 'April 29, 2011', 'capture time and time zone are unknown'):
            self.assertIn(text, figure.figure['data-photo-location'])
        self.assertIn(f'dossier.html?event={EVENT}&amp;source={SOURCE}#source-{SOURCE}', self.html)
        self.assertIn('href="#aerial-context"', self.html)

    def test_existing_brand_and_appearance_labels_retain_their_utf8_text(self):
        for text in ('◎ TORNADO ATLAS', 'Obscur · Dark', 'Clair · Light',
                     'APRIL 27, 2011 · CENTRAL ALABAMA'):
            self.assertIn(text, self.html)
        self.assertEqual(self.html.count('◎'), 1)
        self.assertEqual(self.html.count('·'), 20)  # Retained separators plus the new Landsat source routes.
        for corrupted in ('â—Ž', 'Â·'):
            self.assertNotIn(corrupted, self.html)

    def test_publication_and_history_expose_only_the_added_photo_and_source(self):
        artifacts = publication()
        entry = next(e for e in artifacts['archive/index.json']['events'] if e['id'] == EVENT)
        self.assertEqual(artifacts[entry['file']], self.current)
        self.assertEqual(entry['registered_media'], 0)
        sources_file = next(name for name in artifacts if name.startswith('archive/sources-'))
        rows = [row for row in artifacts[sources_file]['entries'] if row['event_id'] == EVENT and row['source']['id'] == SOURCE]
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]['observations'], rows[0]['media']), (0, 1))
        self.assertEqual(rows[0]['source'], self.source)
        latest = dossier_history(self.doc)['versions'][0]
        self.assertTrue(latest['predecessor_available'])
        self.assertEqual(latest['review']['previous_dossier_sha256'], PREVIOUS_SHA)
        for kind, identifier in (('media', MEDIA), ('sources', SOURCE)):
            self.assertEqual([row for row in latest['changes'] if row['kind'] == kind],
                             [{'kind': kind, 'id': identifier, 'change': 'added', 'fields': []}])
        self.assertFalse(any(row['kind'] in ('observations', 'records', 'creators') for row in latest['changes']))

    def test_synthetic_coordinate_and_private_header_fields_cannot_be_published(self):
        doc = copy.deepcopy(self.doc)
        next(m for m in doc['media'] if m['id'] == MEDIA)['place']['coordinates'] = [-87.54, 33.21]
        with self.assertRaisesRegex(ValueError, 'Unregistered evidence cannot acquire a map point'):
            validate_dossier(doc)
        doc = copy.deepcopy(self.doc)
        next(m for m in doc['media'] if m['id'] == MEDIA)['transformation']['exif'] = {'GPSInfo': 'Synthetic fixture only'}
        with self.assertRaisesRegex(ValueError, 'Private curator fields'):
            validate_dossier(doc)
        for text in (json.dumps(self.doc), self.html):
            for private in ('C:/Users/', 'C:\\Users\\', 'private_notes', 'access_token'):
                self.assertNotIn(private, text)


if __name__ == '__main__':
    unittest.main()
