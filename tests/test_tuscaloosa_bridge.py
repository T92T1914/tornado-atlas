"""An infrastructure documentary photograph must retain its own evidence and privacy limits."""

import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from museum_test_support import assert_preserved_field
from atlas.archive import digest, dossiers, publication, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
EVENT = 'tuscaloosa-birmingham-2011'
MEDIA = 'railway-bridge-aftermath'
SOURCE = 'bmx-railway-bridge'
ASSET = 'assets/tuscaloosa-birmingham-2011/railway-bridge-april29.jpg'
PUBLIC_SHA = '1abcd76e5b905f157c39da7d3ee39b0b1e4966810211f16410c5a21f097a8a59'
PREVIOUS_SHA = 'a1d19787e5730aa6216e3606955ce25a6edefc112891326875e8dc5101bbe115'


class PhotoFigure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_figure = False
        self.figure = None
        self.links = []
        self.images = []
        self.text = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'figure' and attrs.get('id') == 'railway-bridge':
            self.in_figure = True
            self.figure = attrs
        if self.in_figure:
            if tag == 'a':
                self.links.append(attrs)
            if tag == 'img':
                self.images.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'figure':
            self.in_figure = False

    def handle_data(self, data):
        if self.in_figure:
            self.text.append(data)


class TuscaloosaBridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = next(d for d in dossiers() if d['id'] == EVENT)
        cls.prior = json.loads((ROOT / 'web/archive' / f'{EVENT}-{PREVIOUS_SHA[:20]}.json').read_text(encoding='utf-8'))
        cls.item = next(m for m in cls.doc['media'] if m['id'] == MEDIA)
        cls.source = next(s for s in cls.doc['sources'] if s['id'] == SOURCE)
        cls.html = (ROOT / 'web/tuscaloosa.html').read_text(encoding='utf-8')

    def test_previous_evidence_and_registration_are_unchanged(self):
        bridge_sha = '11a6678e22a1f3fab562a7cddb07891279bd6e7d03b83f2d57d08bd12614e8df'
        bridge = json.loads((ROOT / 'web/archive' / f'{EVENT}-{bridge_sha[:20]}.json').read_text(encoding='utf-8'))
        self.assertEqual(digest(bridge), bridge_sha)
        self.assertEqual(digest(self.prior), PREVIOUS_SHA)
        self.assertEqual(len(self.prior['media']), 4)
        self.assertEqual(len(self.prior['sources']), 8)
        self.assertEqual(len(self.prior['observations']), 11)
        self.assertEqual(len(self.prior['records']), 3)
        for field in ('observations', 'records', 'reconstruction', 'creators', 'title', 'coverage'):
            self.assertEqual(bridge[field], self.prior[field], field)
            if field in ('observations', 'creators'):
                self.assertEqual(self.doc[field][:len(bridge[field])], bridge[field], field)
            else:
                assert_preserved_field(self, self.doc[field], bridge[field], field)
        self.assertEqual(bridge['media'][:-1], self.prior['media'])
        self.assertEqual(bridge['sources'][:-1], self.prior['sources'])
        self.assertEqual(bridge['media'][-1]['id'], MEDIA)
        self.assertEqual(bridge['sources'][-1]['id'], SOURCE)
        self.assertEqual(bridge['provenance']['publication_review']['previous_dossier_sha256'], PREVIOUS_SHA)
        self.assertEqual(self.doc['media'][:len(bridge['media'])], bridge['media'])
        self.assertEqual(self.doc['sources'][:len(bridge['sources'])], bridge['sources'])
        self.assertLess((ROOT / f'exhibits/{EVENT}/dossier.json').stat().st_size, 50_000)

    def test_item_attribution_does_not_assign_a_bridge_or_camera(self):
        self.assertEqual(self.item['source_id'], SOURCE)
        self.assertEqual(self.item['kind'], 'photograph')
        self.assertEqual(self.item['url'], 'https://www.weather.gov/images/bmx/significant_events/2011/042711/tuscbirm/2.JPG')
        self.assertEqual(self.source['url'], self.item['url'])
        self.assertEqual(self.item['roles'], {'creator': None, 'uploader': 'nws-birmingham', 'rights_holder': None})
        self.assertEqual(self.item['status']['rights'], 'permitted_hosting')
        self.assertEqual(self.item['status']['assertion'], 'observed_sample')
        self.assertEqual(self.item['status']['temporal'], 'source_label')
        self.assertEqual(self.item['status']['spatial'], 'unregistered')
        self.assertIsNone(self.item['place']['coordinates'])
        for clock in ('capture', 'publication', 'video', 'alignment'):
            self.assertIsNone(self.item['time'][clock])
        self.assertIn('Train Bridge Demolished', self.item['locator'])
        self.assertIn('NWS BMX', self.source['rights'])
        self.assertIn('Item-specific agency-material inference', self.source['rights'])
        self.assertIn('Photographer employment is unknown', self.source['rights'])
        self.assertIn('485386e762936039cc9d3d404e550ae407e724d8c98db4b0e217c560a413855d', self.source['revision'])
        self.assertNotIn('Black Warrior', self.item['place']['reported'])
        self.assertNotIn('Tuscaloosa city', self.item['place']['reported'])

    def test_public_jpeg_has_no_private_header_and_retains_the_original_scan(self):
        transform = self.item['transformation']
        self.assertEqual(transform['asset'], ASSET)
        self.assertEqual(transform['sha256'], PUBLIC_SHA)
        self.assertEqual((transform['width'], transform['height']), (800, 600))
        raw = (ROOT / 'web' / ASSET).read_bytes()
        self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()), (148308, PUBLIC_SHA))
        self.assertEqual(raw[:2], b'\xff\xd8')
        cursor, frame = 2, None
        while raw[cursor:cursor + 2] != b'\xff\xda':
            self.assertEqual(raw[cursor], 0xff)
            marker = raw[cursor + 1]
            length = int.from_bytes(raw[cursor + 2:cursor + 4], 'big')
            self.assertGreaterEqual(length, 2)
            self.assertNotIn(marker, (0xe1, 0xed, 0xfe), 'No EXIF/XMP, IPTC or comment metadata')
            if marker in (0xc0, 0xc1, 0xc2):
                frame = (int.from_bytes(raw[cursor + 7:cursor + 9], 'big'),
                         int.from_bytes(raw[cursor + 5:cursor + 7], 'big'), raw[cursor + 9])
            cursor += length + 2
            self.assertLess(cursor, len(raw))
        self.assertEqual(frame, (800, 600, 3))
        scan = cursor + 2 + int.from_bytes(raw[cursor + 2:cursor + 4], 'big')
        self.assertEqual(raw[-2:], b'\xff\xd9')
        self.assertEqual(len(raw[scan:-2]), 147938)
        self.assertEqual(hashlib.sha256(raw[scan:-2]).hexdigest(),
                         'fbbad686acb0172ec2a986ae717f49e2f8a8cce22ec3590163897fdb7ff329a2')

    def test_new_figure_joins_the_item_and_has_a_real_local_fallback(self):
        figure = PhotoFigure()
        figure.feed(self.html)
        self.assertIsNotNone(figure.figure)
        self.assertEqual(figure.figure['data-photo-kind'], 'photograph')
        opener = next(a for a in figure.links if a.get('data-photo-id') == MEDIA)
        self.assertEqual(opener['href'], ASSET)
        self.assertTrue(opener.get('aria-label'))
        self.assertEqual(len(figure.images), 1)
        self.assertEqual(figure.images[0]['src'], ASSET)
        self.assertTrue(figure.images[0].get('alt'))
        hrefs = {a.get('href') for a in figure.links}
        self.assertIn(f'dossier.html?event={EVENT}&media={MEDIA}#media-{MEDIA}', hrefs)
        self.assertIn('Individual photographer unknown', ' '.join(figure.text))
        self.assertIn('April 29, 2011', figure.figure['data-photo-location'])
        self.assertIn('capture time and time zone are unknown', figure.figure['data-photo-location'])
        for text in (json.dumps(self.doc), self.html):
            for private in ('C:/Users/', 'C:\\Users\\', 'private_notes', 'access_token'):
                self.assertNotIn(private, text)

    def test_publication_associates_only_the_new_media_with_its_new_source(self):
        artifacts = publication()
        entry = next(e for e in artifacts['archive/index.json']['events'] if e['id'] == EVENT)
        published = artifacts[entry['file']]
        self.assertEqual(published, self.doc)
        self.assertEqual(entry['registered_media'], 0)
        sources_file = next(name for name in artifacts if name.startswith('archive/sources-'))
        rows = [r for r in artifacts[sources_file]['entries'] if r['event_id'] == EVENT and r['source']['id'] == SOURCE]
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]['observations'], rows[0]['media']), (0, 1))
        self.assertEqual(rows[0]['source'], self.source)

    def test_a_coordinate_cannot_turn_the_new_photo_into_registered_evidence(self):
        doc = copy.deepcopy(self.doc)
        next(m for m in doc['media'] if m['id'] == MEDIA)['place']['coordinates'] = [-87.54, 33.21]
        with self.assertRaisesRegex(ValueError, 'Unregistered evidence cannot acquire a map point'):
            validate_dossier(doc)


if __name__ == '__main__':
    unittest.main()
