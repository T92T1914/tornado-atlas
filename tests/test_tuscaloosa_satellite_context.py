"""Satellite context must preserve source variants, dates and accepted history."""
import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import struct
import unittest
import zlib

from museum_test_support import assert_preserved_field
from atlas.archive import digest, dossier_history, dossiers, publication, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
EVENT = 'tuscaloosa-birmingham-2011'
PREVIOUS = '890095f5efe240af075c4c1aa7c7a63af403cc0bf9b8a07ab38ddd49b65f5dbb'
SATELLITE_SHA = 'acf5660d7495f756a4b4d865ae85c4ba17c5a1e44b7295f26bcc0cdfb4354b34'
GOES = 'goes-east-storm-context'
EO1 = 'eo1-tuscaloosa-track'
GOES_SHA = '8001a4a3c13b16293b99f80ef00e231b14dd3e6e908a9976f2cd498f55387c00'
EO1_SHA = '301bb3387e4018cad6f54f2c932e4d1d2db6ad0ae1c1ebfffa989d0f09605b5e'


class SatelliteHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.figures, self.openers, self.images, self.hrefs = {}, {}, {}, []
        self.figure = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'figure':
            self.figure = attrs.get('id')
            self.figures[self.figure] = attrs
        if tag == 'a':
            self.hrefs.append(attrs.get('href'))
            if attrs.get('data-photo-id') in (GOES, EO1):
                self.openers[attrs['data-photo-id']] = attrs
        if tag == 'img' and self.figure in ('goes-storm', 'eo1-track'):
            self.images[self.figure] = attrs

    def handle_endtag(self, tag):
        if tag == 'figure':
            self.figure = None


class TuscaloosaSatelliteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = next(d for d in dossiers() if d['id'] == EVENT)
        cls.prior = json.loads((ROOT / f'web/archive/{EVENT}-{PREVIOUS[:20]}.json').read_text(encoding='utf-8'))
        cls.items = {m['id']: m for m in cls.doc['media'] if m['id'] in (GOES, EO1)}
        cls.html = (ROOT / 'web/tuscaloosa.html').read_text(encoding='utf-8')
        cls.view = SatelliteHTML()
        cls.view.feed(cls.html)

    def test_exact_predecessor_is_preserved_with_only_named_additions(self):
        satellite = json.loads((ROOT / f'web/archive/{EVENT}-{SATELLITE_SHA[:20]}.json').read_text(encoding='utf-8'))
        self.assertEqual(digest(satellite), SATELLITE_SHA)
        self.assertEqual(digest(self.prior), PREVIOUS)
        self.assertEqual(tuple(len(satellite[k]) for k in ('media', 'sources', 'observations', 'creators', 'records', 'routes')),
                         (9, 14, 12, 6, 3, 10))
        for key in ('media', 'sources', 'creators', 'routes'):
            self.assertEqual(satellite[key][:len(self.prior[key])], self.prior[key], key)
        for key in ('observations', 'records', 'reconstruction', 'title', 'summary', 'coverage'):
            self.assertEqual(satellite[key], self.prior[key], key)
        self.assertEqual([m['id'] for m in satellite['media'][7:]], [GOES, EO1])
        self.assertEqual([s['id'] for s in satellite['sources'][12:]], ['nesdis-goes-storm', 'nasa-eo1-track'])
        for key in ('media', 'sources', 'observations', 'creators', 'routes'):
            self.assertEqual(self.doc[key][:len(satellite[key])], satellite[key], key)
        for key in ('records', 'reconstruction', 'title', 'summary', 'coverage'):
            assert_preserved_field(self, self.doc[key], satellite[key], key)
        self.assertIs(validate_dossier(satellite), satellite)
        self.assertIs(validate_dossier(self.doc), self.doc)
        version = next(version for version in dossier_history(self.doc)['versions']
                       if version['dossier_sha256'] == SATELLITE_SHA)
        self.assertEqual(version['review']['previous_dossier_sha256'], PREVIOUS)
        self.assertTrue(version['predecessor_available'])
        self.assertFalse(any(row['change'] != 'added' for row in version['changes'] if row['kind'] != 'dossier'))
        self.assertEqual([(row['kind'], row['id']) for row in version['changes']], [
            ('sources', 'nasa-eo1-track'), ('sources', 'nesdis-goes-storm'),
            ('media', EO1), ('media', GOES), ('creators', 'nasa-earth-observatory'),
            ('creators', 'nasa-eo-image-team'), ('creators', 'noaa-nesdis'), ('dossier', EVENT),
        ])

    def test_clocks_and_source_annotations_do_not_register_geometry_or_replay(self):
        for item in self.items.values():
            self.assertEqual(item['status'], dict(intake='published', assertion='observed_sample',
                             temporal='source_label', spatial='unregistered',
                             availability='reviewed_available', rights='permitted_hosting'))
            self.assertIsNone(item['time']['alignment'])
            self.assertIsNone(item['time']['video'])
            self.assertIsNone(item['place']['coordinates'])
            self.assertIsNone(item['parent'])
            self.assertEqual(item['kind'], 'photograph')
        self.assertIn('22:15 UTC', self.items[GOES]['time']['capture'])
        self.assertIsNone(self.items[GOES]['time']['publication'])
        self.assertIn('May 2, 2011', self.items[EO1]['time']['capture'])
        self.assertIn('May 5, 2011', self.items[EO1]['time']['publication'])
        self.assertIn('Hour not supplied', self.items[EO1]['time']['capture'])
        self.assertEqual(self.doc['reconstruction']['intervals'], [])
        for text in ('not an aligned before and after pair', 'different fields of view',
                     'No coordinates, measured width, matching pixels or shared animation'):
            self.assertIn(text, self.html)

    def test_item_specific_attribution_and_rights_survive_source_directory_projection(self):
        artifacts = publication()
        entry = next(e for e in artifacts['archive/index.json']['events'] if e['id'] == EVENT)
        self.assertEqual(entry['registered_media'], 0)
        self.assertEqual(artifacts[entry['file']], self.doc)
        sources = artifacts[artifacts['archive/index.json']['source_directory']['file']]['entries']
        for source_id in ('nesdis-goes-storm', 'nasa-eo1-track'):
            row = next(row for row in sources if row['event_id'] == EVENT and row['source']['id'] == source_id)
            self.assertEqual((row['media'], row['observations']), (1, 0))
            self.assertIn('endorsement', row['source']['rights'])
        noaa = next(s for s in self.doc['sources'] if s['id'] == 'nesdis-goes-storm')
        nasa = next(s for s in self.doc['sources'] if s['id'] == 'nasa-eo1-track')
        self.assertIn('HTTP 403', noaa['access'])
        self.assertIn('Individual maker and employment unknown', noaa['rights'])
        self.assertIn('Jesse Allen and Robert Simmon', nasa['rights'])
        self.assertIn('different, wider extent', nasa['locator'])
        self.assertEqual(self.items[GOES]['roles'], dict(creator=None, uploader='noaa-nesdis', rights_holder=None))
        self.assertEqual(self.items[EO1]['roles'], dict(creator='nasa-eo-image-team',
                         uploader='nasa-earth-observatory', rights_holder=None))

    def test_goes_png_is_exact_bounded_full_image_derivative_without_ancillary_metadata(self):
        item = self.items[GOES]
        raw = (ROOT / 'web' / item['transformation']['asset']).read_bytes()
        self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()), (1390014, GOES_SHA))
        self.assertEqual(raw[:8], b'\x89PNG\r\n\x1a\n')
        cursor, chunks = 8, []
        while cursor < len(raw):
            size = int.from_bytes(raw[cursor:cursor+4], 'big')
            kind = raw[cursor+4:cursor+8]
            body = raw[cursor+8:cursor+8+size]
            self.assertLessEqual(cursor+12+size, len(raw))
            crc = int.from_bytes(raw[cursor+8+size:cursor+12+size], 'big')
            self.assertEqual(zlib.crc32(kind+body) & 0xffffffff, crc)
            chunks.append(kind)
            if kind == b'IHDR':
                self.assertEqual(struct.unpack('>IIBBBBB', body), (1280, 720, 8, 2, 0, 0, 0))
            cursor += size+12
        self.assertEqual(cursor, len(raw))
        self.assertEqual((chunks[0], chunks[-1]), (b'IHDR', b'IEND'))
        self.assertEqual(set(chunks), {b'IHDR', b'IDAT', b'IEND'})
        self.assertEqual((item['transformation']['width'], item['transformation']['height']), (1280, 720))
        self.assertIn('No crop', item['transformation']['recipe'])
        self.assertIn('changed educational derivative', item['transformation']['recipe'])

    def test_nasa_display_preserves_exact_inspected_bytes_and_its_distinct_extent(self):
        item = self.items[EO1]
        raw = (ROOT / 'web' / item['transformation']['asset']).read_bytes()
        self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()), (117833, EO1_SHA))
        self.assertEqual(raw[:2], b'\xff\xd8')
        cursor, frame = 2, None
        while raw[cursor:cursor+2] != b'\xff\xda':
            marker = raw[cursor+1]
            size = int.from_bytes(raw[cursor+2:cursor+4], 'big')
            self.assertNotIn(marker, (0xe1, 0xed, 0xfe), 'No private EXIF, IPTC or comment payload')
            self.assertLessEqual(cursor+size+2, len(raw))
            if marker in (0xc0, 0xc1, 0xc2):
                frame = (int.from_bytes(raw[cursor+7:cursor+9], 'big'),
                         int.from_bytes(raw[cursor+5:cursor+7], 'big'))
            cursor += size+2
        self.assertEqual(frame, (720, 480))
        self.assertIn('different extent', item['transformation']['recipe'])
        self.assertIn('contrail', item['transformation']['alt'])
        self.assertIn('1 km scale', item['locator'])

    def test_static_content_and_gallery_metadata_join_the_actual_images(self):
        for media_id, figure_id, source_id in ((GOES, 'goes-storm', 'nesdis-goes-storm'),
                                               (EO1, 'eo1-track', 'nasa-eo1-track')):
            item = self.items[media_id]
            transform = item['transformation']
            opener, image, figure = self.view.openers[media_id], self.view.images[figure_id], self.view.figures[figure_id]
            self.assertEqual(figure['data-photo-kind'], 'satellite')
            self.assertEqual((opener['href'], image['src']), (transform['asset'], transform['asset']))
            self.assertEqual((image['width'], image['height'], image['loading']),
                             (str(transform['width']), str(transform['height']), 'lazy'))
            self.assertEqual(image['alt'], transform['alt'])
            source = next(s for s in self.doc['sources'] if s['id'] == source_id)
            self.assertEqual(figure['data-photo-source'], source['url'])
            self.assertIn(figure['data-photo-rights'], source['rights'])
            for route in (f'dossier.html?event={EVENT}&media={media_id}#media-{media_id}',
                          f'dossier.html?event={EVENT}&source={source_id}#source-{source_id}'):
                self.assertIn(route, self.view.hrefs)
        for route in ('#satellite-context', '#path', '#damage', '#evidence'):
            self.assertIn(route, self.view.hrefs)
        for text in (json.dumps(self.doc), self.html):
            for private in ('C:/Users/', 'C:\\Users\\', 'GPSInfo', 'private_notes', 'access_token'):
                self.assertNotIn(private, text)

    def test_synthetic_registration_and_private_metadata_do_not_become_evidence(self):
        for media_id in (GOES, EO1):
            broken = copy.deepcopy(self.doc)
            next(m for m in broken['media'] if m['id'] == media_id)['place']['coordinates'] = [-87.54, 33.21]
            with self.assertRaisesRegex(ValueError, 'Unregistered evidence cannot acquire a map point'):
                validate_dossier(broken)
        broken = copy.deepcopy(self.doc)
        broken['media'][-1]['transformation']['exif'] = {'GPSInfo': 'Synthetic fixture only'}
        with self.assertRaisesRegex(ValueError, 'Private curator fields'):
            validate_dossier(broken)


if __name__ == '__main__':
    unittest.main()
