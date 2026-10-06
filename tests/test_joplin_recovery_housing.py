"""Temporary housing remains a qualified recovery record, not registered occupancy."""
import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from atlas.archive import digest, dossiers, publication, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
EVENT = 'joplin-2011'
MEDIA = 'usace-joplin-temporary-housing'
SOURCE = 'commons-usace-joplin-housing'
OBSERVATION = 'usace-joplin-housing-arrival'
PRIOR = 'c08d06204ba51b28e19b1263e2dc58b533472c50d63d92bdd6cd6ed2391fac33'
ASSET = 'assets/joplin-2011/usace-temporary-housing.jpg'
ASSET_SHA = '221ae67fc60cbab237c6d2d371f2fb47b2a616dbceae644f699d4005d5be7095'
ORIGINAL_SHA = '42aaba740fe6de2cfc44cd9804887e456372030a8e685069cd2ee35627edb085'
ICC_SHA = '2b3aa1645779a9e634744faf9b01e9102b0c9b88fd6deced7934df86b949af7e'
PAGE = 'https://commons.wikimedia.org/wiki/File:First_FEMA_modular_homes_arrive_in_Joplin_(5967939747).jpg'
LICENSE = 'https://creativecommons.org/licenses/by/2.0/'


def checked_jpeg(raw):
    """Walk all progressive scans and reject descriptive metadata, including late headers."""
    if raw[:2] != b'\xff\xd8':
        raise ValueError('Missing JPEG SOI')
    cursor, frames, profiles, scans = 2, [], [], 0
    while cursor < len(raw):
        if raw[cursor] != 255:
            raise ValueError('Expected JPEG marker')
        while cursor < len(raw) and raw[cursor] == 255:
            cursor += 1
        if cursor >= len(raw):
            raise ValueError('Truncated JPEG marker')
        marker = raw[cursor]
        cursor += 1
        if marker == 0xd9:
            if cursor != len(raw) or not scans:
                raise ValueError('Unexpected JPEG terminal bytes')
            if frames != [(1280, 569, 3)] or len(profiles) != 1:
                raise ValueError('Unexpected frame or profile')
            if hashlib.sha256(profiles[0]).hexdigest() != ICC_SHA:
                raise ValueError('Unexpected sRGB profile')
            return {'dimensions': frames[0], 'scans': scans}
        if marker in (0xe1, 0xed, 0xfe):
            raise ValueError('Descriptive JPEG metadata is forbidden')
        if marker in (0, 0xd8) or 0xd0 <= marker <= 0xd7:
            raise ValueError('Unexpected standalone marker')
        if cursor+2 > len(raw):
            raise ValueError('Truncated JPEG length')
        length = int.from_bytes(raw[cursor:cursor+2], 'big')
        if length < 2 or cursor+length > len(raw):
            raise ValueError('Invalid JPEG segment length')
        body = raw[cursor+2:cursor+length]
        cursor += length
        if marker == 0xe0 and not body.startswith(b'JFIF\x00'):
            raise ValueError('Unexpected APP0 payload')
        if marker == 0xe2:
            if not body.startswith(b'ICC_PROFILE\x00\x01\x01'):
                raise ValueError('Unexpected APP2 payload')
            profiles.append(body[14:])
        if 0xe3 <= marker <= 0xef:
            raise ValueError('Unexpected application metadata')
        if marker in (0xc0, 0xc1, 0xc2):
            if len(body) < 6:
                raise ValueError('Truncated JPEG frame')
            frames.append((int.from_bytes(body[3:5], 'big'), int.from_bytes(body[1:3], 'big'), body[5]))
        if marker == 0xda:
            scans += 1
            while True:
                found = raw.find(b'\xff', cursor)
                if found < 0 or found+1 >= len(raw):
                    raise ValueError('Truncated JPEG scan')
                following = raw[found+1]
                if following == 0 or 0xd0 <= following <= 0xd7:
                    cursor = found+2
                elif following == 255:
                    cursor = found+1
                else:
                    cursor = found
                    break
    raise ValueError('Missing JPEG EOI')


class HousingHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.hrefs, self.openers, self.images = [], [], {}, []
        self.in_figure = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'figure' and attrs.get('id') == 'temporary-housing':
            self.in_figure = True
        if tag == 'a':
            self.hrefs.append(attrs.get('href'))
            if attrs.get('data-photo-id'):
                self.openers[attrs['data-photo-id']] = attrs
        if tag == 'img' and self.in_figure:
            self.images.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'figure':
            self.in_figure = False


class JoplinRecoveryHousingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = next(d for d in dossiers() if d['id'] == EVENT)
        cls.prior = json.loads((ROOT / f'web/archive/{EVENT}-{PRIOR[:20]}.json').read_text(encoding='utf-8'))
        cls.item = next(m for m in cls.doc['media'] if m['id'] == MEDIA)
        cls.observation = next(o for o in cls.doc['observations'] if o['id'] == OBSERVATION)
        cls.source = next(s for s in cls.doc['sources'] if s['id'] == SOURCE)
        cls.html = (ROOT / 'web/joplin.html').read_text(encoding='utf-8')
        cls.view = HousingHTML()
        cls.view.feed(cls.html)
        cls.raw = (ROOT / 'web' / ASSET).read_bytes()

    def test_accepted_predecessor_and_existing_records_are_preserved(self):
        self.assertEqual(digest(self.prior), PRIOR)
        for field in ('media', 'observations', 'sources', 'creators', 'routes'):
            self.assertEqual(self.doc[field][:len(self.prior[field])], self.prior[field], field)
        for field in ('records', 'reconstruction', 'title', 'summary', 'coverage'):
            self.assertEqual(self.doc[field], self.prior[field], field)
        self.assertEqual(self.doc['media'][len(self.prior['media']):], [self.item])
        self.assertEqual(self.doc['observations'][len(self.prior['observations']):], [self.observation])
        self.assertEqual(self.doc['sources'][len(self.prior['sources']):], [self.source])
        self.assertEqual([c['id'] for c in self.doc['creators'][len(self.prior['creators']):]],
                         ['mark-haviland', 'usace-kansas-city', 'commons-tyler-ser-noche'])
        self.assertEqual(self.doc['routes'][len(self.prior['routes']):],
                         [{'label': 'Temporary housing and recovery', 'href': 'joplin.html#recovery'}])
        self.assertIs(validate_dossier(self.doc), self.doc)

    def test_photographer_publisher_uploader_and_recorded_rights_remain_distinct(self):
        self.assertEqual(self.source['title'], 'First FEMA modular homes arrive in Joplin (5967939747).jpg')
        self.assertEqual((self.item['source_id'], self.item['url'], self.source['url']), (SOURCE, PAGE, PAGE))
        self.assertEqual(self.item['roles'], dict(creator='mark-haviland', uploader='commons-tyler-ser-noche', rights_holder=None))
        for text in ('September 4, 2018', 'CC BY 2.0', 'FlickreviewR 2', 'Mark Haviland',
                     'Kansas City District', 'separately', 'not independently established', 'No endorsement'):
            self.assertIn(text, self.source['rights'])
        self.assertIn('911895029', self.source['revision'])
        self.assertIn('Tyler ser Noche', self.source['revision'])
        self.assertIn('HTTP 404', self.source['access'])
        self.assertIn('without a retry', self.source['access'])

    def test_caption_camera_and_upload_clocks_do_not_register_the_site(self):
        for item in (self.item, self.observation):
            self.assertEqual(item['status'], dict(intake='published', assertion='source_reported',
                             temporal='unregistered', spatial='unregistered', availability='reviewed_available', rights='permitted_hosting'))
            self.assertIn('8:39 a.m.', item['time']['event']['reported'])
            self.assertIn('10:24:01', item['time']['capture']['reported'])
            self.assertIn('unverified', item['time']['capture']['reported'])
            self.assertIn('September 4, 2018', item['time']['publication']['reported'])
            self.assertIsNone(item['time']['alignment'])
            self.assertIsNone(item['time']['video'])
            self.assertIsNone(item['place']['coordinates'])
        self.assertIn('combined planned capacity of 346', self.observation['account'])
        self.assertIn('either site alone', self.observation['limits'])
        self.assertIn('not independently confirmed completion', self.observation['limits'])
        self.assertEqual(self.doc['reconstruction']['intervals'], [])

    def test_exact_display_has_complete_dimensions_standard_color_and_no_private_headers(self):
        self.assertEqual((len(self.raw), hashlib.sha256(self.raw).hexdigest()), (222440, ASSET_SHA))
        checked = checked_jpeg(self.raw)
        self.assertEqual(checked['dimensions'], (1280, 569, 3))
        self.assertGreater(checked['scans'], 1, 'The reviewed export is progressive JPEG')
        transform = self.item['transformation']
        self.assertEqual((transform['asset'], transform['sha256'], transform['source_sha256']), (ASSET, ASSET_SHA, ORIGINAL_SHA))
        self.assertEqual((transform['width'], transform['height']), (1280, 569))
        for text in ('Complete retained frame', 'No crop', 'sRGB', 'EXIF', 'IPTC', 'XMP', 'change pixels and bytes'):
            self.assertIn(text, transform['recipe'])

    def test_metadata_injection_and_scan_truncation_are_rejected(self):
        for marker in (0xe1, 0xed, 0xfe):
            payload = b'Synthetic private metadata control'
            segment = bytes([255, marker])+bytes([(len(payload)+2)//256, (len(payload)+2)%256])+payload
            with self.assertRaisesRegex(ValueError, 'metadata'):
                checked_jpeg(self.raw[:2]+segment+self.raw[2:])
        with self.assertRaisesRegex(ValueError, 'Truncated JPEG scan'):
            checked_jpeg(self.raw[:-2])

    def test_static_section_source_routes_and_item_label_join_the_actual_derivative(self):
        self.assertEqual(self.view.ids.count('recovery'), 1)
        self.assertEqual(self.view.ids.count('temporary-housing'), 1)
        self.assertEqual(len(self.view.images), 1)
        link, image = self.view.openers[MEDIA], self.view.images[0]
        self.assertEqual((link['href'], image['src']), (ASSET, ASSET))
        self.assertEqual((image['width'], image['height'], image['loading']), ('1280', '569', 'lazy'))
        self.assertEqual(image['alt'], self.item['transformation']['alt'])
        self.assertEqual(link['data-photo-kind'], 'context-photograph')
        self.assertEqual(link['data-photo-original-label'], 'Open the full-frame resized photograph')
        self.assertEqual((link['data-photo-source'], link['data-photo-rights']), (PAGE, LICENSE))
        for original in ('friskey-joplin-storm', 'nws-joplin-aftermath'):
            self.assertNotIn('data-photo-original-label', self.view.openers[original])
        for route in ('#recovery', '#source-usace-housing',
                      f'dossier.html?event={EVENT}&media={MEDIA}#media-{MEDIA}',
                      f'dossier.html?event={EVENT}&source={SOURCE}#source-{SOURCE}',
                      f'dossier.html?event={EVENT}&observation={OBSERVATION}#observation-{OBSERVATION}'):
            self.assertIn(route, self.view.hrefs)
        for text in ('two sites together', 'not a count of homes occupied', '8:39 a.m.', '10:24:01', 'unverified'):
            self.assertIn(text, self.html)
        self.assertLess(self.html.index('id="damage"'), self.html.index('id="recovery"'))
        self.assertLess(self.html.index('id="recovery"'), self.html.index('id="remembrance"'))

    def test_publication_source_projection_counts_real_links_without_registered_media(self):
        artifacts = publication()
        index = artifacts['archive/index.json']
        entry = next(e for e in index['events'] if e['id'] == EVENT)
        self.assertEqual(artifacts[entry['file']], self.doc)
        self.assertEqual(entry['registered_media'], 0)
        rows = artifacts[index['source_directory']['file']]['entries']
        row = next(r for r in rows if r['event_id'] == EVENT and r['source']['id'] == SOURCE)
        self.assertEqual((row['media'], row['observations']), (1, 1))
        self.assertEqual(row['source'], self.source)

    def test_synthetic_alignment_map_point_and_private_fields_are_rejected(self):
        for kind, identifier in (('media', MEDIA), ('observations', OBSERVATION)):
            for field, bad, message in (
                ('place', [-94.5, 37.1], 'Unregistered evidence cannot acquire a map point'),
                ('time', {'utc': '2011-07-23T13:39:00Z', 'basis': 'Synthetic unsupported offset'},
                 'Unregistered evidence cannot acquire an alignment'),
            ):
                broken = copy.deepcopy(self.doc)
                item = next(i for i in broken[kind] if i['id'] == identifier)
                item[field]['coordinates' if field == 'place' else 'alignment'] = bad
                with self.assertRaisesRegex(ValueError, message):
                    validate_dossier(broken)
        broken = copy.deepcopy(self.doc)
        next(i for i in broken['media'] if i['id'] == MEDIA)['transformation']['exif'] = {'Artist': 'Synthetic control'}
        with self.assertRaisesRegex(ValueError, 'Private curator fields'):
            validate_dossier(broken)
        public = json.dumps(self.doc)+self.html
        for private in ('C:/Users/', 'C:\\Users\\', 'access_token', 'private_notes'):
            self.assertNotIn(private, public)


if __name__ == '__main__':
    unittest.main()
