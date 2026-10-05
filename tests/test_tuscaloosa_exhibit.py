"""The documentary account must preserve source scope and registration limits."""

import copy
from datetime import datetime
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest
from urllib.parse import parse_qs, urlsplit

from atlas.archive import validate_dossier


ROOT = Path(__file__).resolve().parents[1]
DOSSIER = ROOT / 'exhibits/tuscaloosa-birmingham-2011/dossier.json'


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.hrefs = []
        self.images = []
        self.frames = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'a' and 'href' in attrs:
            self.hrefs.append(attrs['href'])
        if tag == 'img':
            self.images.append(attrs)
        if tag == 'iframe':
            self.frames.append(attrs)


def retained_records():
    index = json.loads((ROOT / 'web/catalogue/index.json').read_text(encoding='utf-8'))
    records = {}
    for row in index['records']:
        if row['id'] in {'ncei:314625', 'ncei:314662', 'ncei:314663'}:
            shard = json.loads((ROOT / 'web/catalogue' / row['detail_file']).read_text(encoding='utf-8'))
            records[row['id']] = shard[row['id']]
    return records


class TuscaloosaExhibitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = json.loads(DOSSIER.read_text(encoding='utf-8'))
        cls.html = (ROOT / 'web/tuscaloosa.html').read_text(encoding='utf-8')
        cls.links = Links()
        cls.links.feed(cls.html)
        cls.records = retained_records()

    def test_standalone_input_uses_current_archive_contract(self):
        self.assertIs(validate_dossier(self.doc), self.doc)
        self.assertEqual(self.doc['coverage'], 'Exhibit')
        self.assertLess(DOSSIER.stat().st_size, 50_000)

    def test_county_association_has_continuation_and_matching_boundaries(self):
        rows = [self.records[key] for key in ('ncei:314625', 'ncei:314662', 'ncei:314663')]
        self.assertEqual({r['id'] for r in self.doc['records']}, set(self.records))
        self.assertEqual([r['local_area'] for r in rows], ['GREENE', 'TUSCALOOSA', 'JEFFERSON'])
        for before, after in zip(rows, rows[1:]):
            self.assertEqual(before['continuation']['TOR_OTHER_CZ_NAME'], after['local_area'])
            self.assertEqual(before['spatial']['end_point'], after['spatial']['begin_point'])
            self.assertIn('Tuscaloosa', before['narrative'])
            self.assertIn('Birmingham', before['narrative'])
        points = {o['id']: o['place']['coordinates'] for o in self.doc['observations']}
        self.assertEqual(points['survey-start'], rows[0]['spatial']['begin_point'])
        self.assertEqual(points['survey-end'], rows[-1]['spatial']['end_point'])

    def test_standard_time_utc_and_source_impact_classification_remain_visible(self):
        start = self.records['ncei:314625']['time']['begin']
        end = self.records['ncei:314663']['time']['end']
        self.assertEqual(start['zone'], 'CST-6')
        self.assertEqual(end['zone'], 'CST-6')
        self.assertEqual(datetime.fromisoformat(start['utc']).hour, 21)
        self.assertEqual(datetime.fromisoformat(end['utc']).hour, 23)
        self.assertIn('21:43 through 23:14 UTC', self.html)
        tuscaloosa = self.records['ncei:314662']['impacts']
        jefferson = self.records['ncei:314663']['impacts']
        self.assertEqual((tuscaloosa['deaths_direct'], tuscaloosa['deaths_indirect']), (44, 8))
        self.assertEqual((jefferson['deaths_direct'], jefferson['deaths_indirect']), (20, 0))
        self.assertIn('44 direct and 8 indirect', self.html)
        self.assertIn('20 direct deaths', self.html)
        self.assertIn('65 fatalities', self.html)
        self.assertIn('lists 66', self.html)
        self.assertIn('inventing a reconciled total', self.html)

    def test_contextual_places_do_not_acquire_camera_or_clock_registration(self):
        for item in self.doc['observations']:
            self.assertIsNone(item['time']['alignment'])
            self.assertIsNone(item['time']['capture'])
            self.assertIsNone(item['time']['video'])
            if item['id'] not in {'survey-start', 'survey-end'}:
                self.assertEqual(item['status']['spatial'], 'unregistered')
                self.assertIsNone(item['place']['coordinates'])
        self.assertEqual(self.doc['reconstruction']['appearance'], 'unregistered')
        self.assertEqual(self.doc['reconstruction']['intervals'], [])

    def test_unregistered_damage_cannot_be_promoted_by_adding_a_point(self):
        doc = copy.deepcopy(self.doc)
        item = next(o for o in doc['observations'] if o['id'] == 'tuscaloosa-damage-progression')
        item['place']['coordinates'] = [-87.54, 33.21]
        with self.assertRaisesRegex(ValueError, 'Unregistered evidence cannot acquire a map point'):
            validate_dossier(doc)

    def test_documentary_links_resolve_to_actual_sources_observations_and_anchors(self):
        self.assertEqual(len(self.links.ids), len(set(self.links.ids)))
        observations = {o['id'] for o in self.doc['observations']}
        sources = {s['id'] for s in self.doc['sources']}
        for href in self.links.hrefs:
            parsed = urlsplit(href)
            if not parsed.path and parsed.fragment:
                self.assertIn(parsed.fragment, self.links.ids)
            if parsed.path == 'dossier.html':
                query = parse_qs(parsed.query)
                if 'event' in query:
                    self.assertEqual(query['event'], [self.doc['id']])
                if 'source' in query:
                    self.assertIn(query['source'][0], sources)
                if 'observation' in query:
                    self.assertIn(query['observation'][0], observations)
                if 'record' in query:
                    self.assertIn(query['record'][0], self.records)
        for route in self.doc['routes']:
            parsed = urlsplit(route['href'])
            self.assertTrue((ROOT / 'web' / parsed.path).is_file())
            if parsed.path == 'tuscaloosa.html' and parsed.fragment:
                self.assertIn(parsed.fragment, self.links.ids)

    def test_the_inspected_original_radar_pair_remains_unchanged(self):
        expected = {
            'kbmx-reflectivity-county-crossing': ('3d4581d6ca3bf8eda91f2bfd665e9c48d9ae7261d72286fe205d2b29c0d7ce18', 755, 583),
            'kbmx-storm-relative-velocity-county-crossing': ('34591f78f45cb8ff46ba385b74ccc50aca9b9e0f7292cd15b63c31d998215d63', 756, 567),
        }
        radar = [m for m in self.doc['media'] if m['kind'] == 'radar']
        self.assertEqual({m['id'] for m in radar}, set(expected))
        self.assertEqual(len(self.links.images), 5)  # Radar pair, two photographs and empty viewer.
        for item in radar:
            identity, width, height = expected[item['id']]
            raw = (ROOT / 'web' / item['transformation']['asset']).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), identity)
            self.assertIn(raw[:6], (b'GIF87a', b'GIF89a'))
            self.assertEqual((int.from_bytes(raw[6:8], 'little'), int.from_bytes(raw[8:10], 'little')), (width, height))
            self.assertEqual(item['transformation']['sha256'], identity)
            self.assertEqual(item['kind'], 'radar')
            self.assertEqual(item['status']['rights'], 'permitted_hosting')
            self.assertEqual(item['status']['temporal'], 'source_label')
            self.assertEqual(item['status']['spatial'], 'unregistered')
            self.assertEqual(item['roles'], dict(creator=None, uploader='nws-birmingham', rights_holder=None))
            for clock in ('capture', 'publication', 'video', 'alignment'):
                self.assertIsNone(item['time'][clock])
            self.assertIsNone(item['place']['coordinates'])
            self.assertIn('no visible color scale', item['limits'])
        self.assertIn('no timestamp, units or color key', self.html)
        self.assertEqual(self.links.frames, [])
        assessment = next(s for s in self.doc['sources'] if s['id'] == 'april-warning-assessment')
        self.assertIn('No report figure pixels visually inspected', assessment['access'])
        self.assertIn('do not clear every figure', assessment['rights'])

    def test_media_increment_preserves_the_prior_dossier_and_reviewed_accounts(self):
        prior_path = ROOT / 'web/archive/tuscaloosa-birmingham-2011-52bd3ebb4b7537641971.json'
        prior = json.loads(prior_path.read_text(encoding='utf-8'))
        self.assertEqual(self.doc['observations'], prior['observations'])
        self.assertEqual(self.doc['records'], prior['records'])
        self.assertEqual(self.doc['reconstruction'], prior['reconstruction'])
        self.assertEqual(self.doc['sources'][:4], prior['sources'])
        radar_stage = json.loads((ROOT / 'web/archive/tuscaloosa-birmingham-2011-82ac763506249130a2e9.json').read_text(encoding='utf-8'))
        self.assertEqual(radar_stage['provenance']['publication_review']['previous_dossier_sha256'],
                         '52bd3ebb4b75376419719cc44ec1bb9421eee9bc558e14d1b54b9060e433944a')

    def test_photo_has_a_separate_identity_and_no_embedded_private_metadata(self):
        photos = [m for m in self.doc['media'] if m['kind'] == 'photograph']
        self.assertEqual([m['id'] for m in photos],
                         ['birmingham-aftermath-april29', 'apartment-complex-aftermath'])
        self.assertEqual(len(self.doc['media']), 4)
        item = photos[0]
        self.assertEqual(item['url'], 'https://www.weather.gov/images/bmx/significant_events/2011/042711/tuscbirm/6.JPG')
        self.assertEqual(item['roles'], dict(creator=None, uploader='nws-birmingham', rights_holder=None))
        self.assertEqual(item['status']['rights'], 'permitted_hosting')
        self.assertEqual(item['status']['temporal'], 'source_label')
        self.assertEqual(item['status']['spatial'], 'unregistered')
        self.assertIsNone(item['place']['coordinates'])
        for clock in ('capture', 'publication', 'video', 'alignment'):
            self.assertIsNone(item['time'][clock])
        self.assertIn('printed April 29, 2011 date', item['limits'])
        self.assertIn('No recompression', item['transformation']['recipe'])
        raw = (ROOT / 'web' / item['transformation']['asset']).read_bytes()
        identity = '2a7c08901d95a8943b53c1d55da6b1f0d6b1c45f717220f7d747856d318507cf'
        self.assertEqual(len(raw), 159895)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), identity)
        self.assertEqual(item['transformation']['sha256'], identity)
        self.assertEqual(raw[:2], b'\xff\xd8')
        # Inspect actual JPEG segments before the scan, not a substring-only claim.
        cursor = 2
        dimensions = None
        while raw[cursor:cursor+2] != b'\xff\xda':
            self.assertEqual(raw[cursor], 0xff)
            marker = raw[cursor+1]
            length = int.from_bytes(raw[cursor+2:cursor+4], 'big')
            self.assertGreaterEqual(length, 2)
            self.assertNotIn(marker, (0xe1, 0xed, 0xfe), 'No EXIF/XMP, IPTC or comment metadata')
            if marker in (0xc0, 0xc1, 0xc2):
                dimensions = (int.from_bytes(raw[cursor+7:cursor+9], 'big'),
                              int.from_bytes(raw[cursor+5:cursor+7], 'big'))
            cursor += length + 2
            self.assertLess(cursor, len(raw))
        self.assertEqual(dimensions, (800, 600))
        scan = cursor + 2 + int.from_bytes(raw[cursor+2:cursor+4], 'big')
        self.assertEqual(raw[-2:], b'\xff\xd9')
        self.assertEqual(len(raw[scan:-2]), 159529)
        self.assertEqual(hashlib.sha256(raw[scan:-2]).hexdigest(),
                         'a470babc948025825f475490af4e848e5c7c149f9228e5af42a978eac16368d1')
        source = next(s for s in self.doc['sources'] if s['id'] == item['source_id'])
        self.assertIn('533b3afe03f4d868faee8b5c94c5d6b1f4a3e0a383b40f397b6e254ced4bc2df', source['revision'])
        self.assertIn('embedded NWS BMX credit', source['rights'])
        self.assertIn('narrow inference', source['rights'])

    def test_aftermath_increment_preserves_the_immediate_radar_predecessor(self):
        prior = json.loads((ROOT / 'web/archive/tuscaloosa-birmingham-2011-82ac763506249130a2e9.json').read_text(encoding='utf-8'))
        for field in ('observations', 'records', 'reconstruction'):
            self.assertEqual(self.doc[field], prior[field])
        self.assertEqual(self.doc['media'][:2], prior['media'])
        self.assertEqual(self.doc['sources'][:6], prior['sources'])
        aftermath = json.loads((ROOT / 'web/archive/tuscaloosa-birmingham-2011-1eca25f06fa270ce9e71.json').read_text(encoding='utf-8'))
        self.assertEqual(aftermath['provenance']['publication_review']['previous_dossier_sha256'],
                         '82ac763506249130a2e9fe9f8d99407b20ff08cf87e4e2dce42d4c455d2b6229')

    def test_new_prose_preserves_voice_and_public_boundary(self):
        for text in (self.html, DOSSIER.read_text(encoding='utf-8')):
            for forbidden in ('\u2014', '\u2013', 'C:/Users/', 'C:\\Users\\', 'access_token', 'private_notes'):
                self.assertNotIn(forbidden, text)


if __name__ == '__main__':
    unittest.main()
