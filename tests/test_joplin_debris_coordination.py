"""A retained provider preview must not acquire original-file or camera claims."""
import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from atlas.archive import digest, dossier_history, dossiers, publication, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
EVENT = 'joplin-2011'
MEDIA = 'usace-joplin-debris-coordination'
SOURCE = 'dvids-joplin-debris-coordination'
OBSERVATION = 'usace-joplin-debris-quality-assurance'
PRIOR = '91411174f67bc15ab146041e01a248d1339ad49ae5862a0936b28c566e2c5707'
ASSET = 'assets/joplin-2011/usace-debris-coordination-preview.webp'
SHA = '489306ca212062f38295df6cd951f4cc80b573df10c8ebaef8579ddb8a6970ca'
PAGE = 'https://www.dvidshub.net/image/423630/removing-joplin-tornado-debris-july-4'
POLICY = 'https://www.dvidshub.net/about/copyright'
NOTICE = 'The appearance of U.S. Department of War (DoW) visual information does not imply or constitute DoW endorsement.'


def checked_preview(raw):
    """Check this exact simple VP8 WebP envelope without decoding or transforming it."""
    if raw[:4] != b'RIFF' or raw[8:12] != b'WEBP':
        raise ValueError('Expected WebP RIFF envelope')
    if int.from_bytes(raw[4:8], 'little') + 8 != len(raw):
        raise ValueError('Truncated or trailing WebP bytes')
    cursor, chunks = 12, []
    while cursor < len(raw):
        if cursor + 8 > len(raw):
            raise ValueError('Truncated WebP chunk')
        size = int.from_bytes(raw[cursor+4:cursor+8], 'little')
        end = cursor + 8 + size
        if end + (size % 2) > len(raw):
            raise ValueError('Truncated WebP payload')
        chunks.append((raw[cursor:cursor+4], raw[cursor+8:end]))
        cursor = end + (size % 2)
    if len(chunks) != 1 or chunks[0][0] != b'VP8 ':
        raise ValueError('Expected single image payload without descriptive metadata')
    payload = chunks[0][1]
    if len(payload) < 10 or payload[3:6] != b'\x9d\x01\x2a':
        raise ValueError('Expected VP8 key frame')
    dimensions = (int.from_bytes(payload[6:8], 'little') & 0x3fff,
                  int.from_bytes(payload[8:10], 'little') & 0x3fff)
    if dimensions != (1000, 716):
        raise ValueError('Unexpected provider preview dimensions')
    return dimensions


class ChapterLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.images, self.ids, self.hrefs = {}, {}, [], []
        self.current = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'a':
            self.hrefs.append(attrs.get('href'))
            self.current = attrs.get('data-photo-id')
            if self.current:
                self.links[self.current] = attrs
        if tag == 'img' and self.current:
            self.images[self.current] = attrs

    def handle_endtag(self, tag):
        if tag == 'a':
            self.current = None


class JoplinDebrisCoordinationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = next(doc for doc in dossiers() if doc['id'] == EVENT)
        cls.prior = json.loads((ROOT / f'web/archive/{EVENT}-{PRIOR[:20]}.json').read_text(encoding='utf-8'))
        cls.source = next(row for row in cls.doc['sources'] if row['id'] == SOURCE)
        cls.media = next(row for row in cls.doc['media'] if row['id'] == MEDIA)
        cls.observation = next(row for row in cls.doc['observations'] if row['id'] == OBSERVATION)
        cls.html = (ROOT / 'web/joplin.html').read_text(encoding='utf-8')
        cls.links = ChapterLinks()
        cls.links.feed(cls.html)
        cls.raw = (ROOT / 'web' / ASSET).read_bytes()

    def test_preserved_predecessor_and_exact_added_records(self):
        self.assertEqual(digest(self.prior), PRIOR)
        for field in ('sources', 'media', 'observations', 'creators', 'routes'):
            self.assertEqual(self.doc[field][:len(self.prior[field])], self.prior[field], field)
        for field in ('records', 'reconstruction', 'title', 'summary', 'coverage'):
            self.assertEqual(self.doc[field], self.prior[field], field)
        self.assertEqual(self.doc['sources'][len(self.prior['sources']):], [self.source])
        self.assertEqual(self.doc['media'][len(self.prior['media']):], [self.media])
        self.assertEqual(self.doc['observations'][len(self.prior['observations']):], [self.observation])
        self.assertEqual([row['id'] for row in self.doc['creators'][len(self.prior['creators']):]], ['andrew-stamer'])
        self.assertEqual(self.doc['routes'][len(self.prior['routes']):], [
            {'label':'Debris removal and quality assurance', 'href':'joplin.html#debris-removal'}])
        self.assertIs(validate_dossier(self.doc), self.doc)
        current = dossier_history(self.doc)['versions'][0]
        self.assertEqual(current['review']['previous_dossier_sha256'], PRIOR)
        self.assertTrue(current['predecessor_available'])
        self.assertFalse(any(row['change'] == 'removed' for row in current['changes']))

    def test_attributed_roles_and_item_specific_notice(self):
        self.assertEqual((self.source['url'], self.media['url'], self.media['source_id']), (PAGE, PAGE, SOURCE))
        self.assertEqual(self.media['roles'], {'creator':'andrew-stamer', 'uploader':None, 'rights_holder':None})
        for text in ('423630', '110704-A-BJ146-018', 'PUBLIC DOMAIN', 'privacy/publicity',
                     'third-party IP', 'No employment/official-duty proof or separate portrayed-person permissions were independently obtained.', NOTICE):
            self.assertIn(text, json.dumps(self.source))
        self.assertIn('caption claims', self.observation['limits'])
        self.assertIn('Incidental wind and personnel-total', self.observation['limits'])
        self.assertEqual(self.media['status']['assertion'], 'observed_sample')
        self.assertEqual(self.observation['status']['assertion'], 'source_reported')

    def test_separate_date_and_posting_labels_without_alignment_or_map_point(self):
        for item in (self.media, self.observation):
            self.assertEqual(item['status']['temporal'], 'unregistered')
            self.assertEqual(item['status']['spatial'], 'unregistered')
            self.assertEqual(item['status']['rights'], 'permitted_hosting')
            self.assertIn('May 22, 2011', item['time']['event']['reported'])
            self.assertIn('July 4, 2011', item['time']['capture']['reported'])
            self.assertNotIn('19:47', item['time']['capture']['reported'])
            self.assertIn('19:47', item['time']['publication']['reported'])
            self.assertIn('unestablished', item['time']['capture']['reported'])
            self.assertIsNone(item['time']['alignment'])
            self.assertIsNone(item['time']['video'])
            self.assertIsNone(item['place']['coordinates'])
        self.assertEqual(self.doc['reconstruction']['intervals'], [])

    def test_exact_retained_preview_bytes_and_dimensions(self):
        self.assertEqual((len(self.raw), hashlib.sha256(self.raw).hexdigest()), (261024, SHA))
        self.assertEqual(checked_preview(self.raw), (1000, 716))
        transform = self.media['transformation']
        self.assertEqual((transform['asset'], transform['sha256'], transform['source_sha256']), (ASSET, SHA, SHA))
        self.assertEqual((transform['width'], transform['height']), (1000, 716))
        for text in ('provider display-preview', 'No local resize', 'unacquired original', 'WebP'):
            self.assertIn(text, transform['recipe'])
        self.assertIn('Register/Login', self.source['access'])
        self.assertIn('was not requested', self.source['access'])

    def test_truncation_metadata_and_wrong_dimensions_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Truncated or trailing'):
            checked_preview(self.raw[:-1])
        wrong = bytearray(self.raw)
        wrong[26:28] = (999).to_bytes(2, 'little')
        with self.assertRaisesRegex(ValueError, 'dimensions'):
            checked_preview(wrong)
        payload = b'Synthetic descriptive control'
        appended = self.raw + b'EXIF' + len(payload).to_bytes(4, 'little') + payload + bytes(len(payload) % 2)
        appended = appended[:4] + (len(appended)-8).to_bytes(4, 'little') + appended[8:]
        with self.assertRaisesRegex(ValueError, 'descriptive metadata'):
            checked_preview(appended)

    def test_static_routes_viewer_labels_credit_and_mime(self):
        link, image = self.links.links[MEDIA], self.links.images[MEDIA]
        self.assertEqual((link['href'], image['src']), (ASSET, ASSET))
        self.assertEqual((image['width'], image['height'], image['loading']), ('1000', '716', 'lazy'))
        self.assertEqual(image['alt'], self.media['transformation']['alt'])
        self.assertEqual(link['data-photo-original-label'], 'Open the retained provider display preview')
        self.assertEqual(link['data-photo-source-label'], 'Primary photograph record, credit and reuse terms')
        self.assertEqual((link['data-photo-source'], link['data-photo-rights']), (PAGE, POLICY))
        self.assertIn(NOTICE, link['data-photo-credit'])
        self.assertIn(NOTICE, self.html)
        for original in ('friskey-joplin-storm', 'nws-joplin-aftermath'):
            self.assertNotIn('data-photo-source-label', self.links.links[original])
            self.assertNotIn('data-photo-original-label', self.links.links[original])
        for kind, identifier in (('media', MEDIA), ('source', SOURCE), ('observation', OBSERVATION)):
            self.assertIn(f'dossier.html?event={EVENT}&{kind}={identifier}#{kind}-{identifier}', self.links.hrefs)
        self.assertEqual(self.links.ids.count('debris-removal'), 1)
        self.assertEqual(self.links.ids.count('source-usace-debris'), 1)
        self.assertLess(self.html.index('id="debris-removal"'), self.html.index('id="temporary-housing"'))
        adapter = (ROOT / 'web/joplin-photo-view.mjs').read_text(encoding='utf-8')
        self.assertIn("link.dataset.photoSourceLabel || 'Inspect the original file, credit and reuse record'", adapter)
        self.assertIn("link.dataset.photoOriginalLabel || 'Open the unchanged original photograph'", adapter)
        harness = (ROOT / 'tests/browser/harness.mjs').read_text(encoding='utf-8')
        self.assertIn("'.webp':'image/webp'", harness)

    def test_actual_publication_links_and_invalid_registration_controls(self):
        artifacts = publication()
        index = artifacts['archive/index.json']
        entry = next(row for row in index['events'] if row['id'] == EVENT)
        self.assertEqual(artifacts[entry['file']], self.doc)
        self.assertEqual(entry['registered_media'], 0)
        rows = artifacts[index['source_directory']['file']]['entries']
        row = next(row for row in rows if row['event_id'] == EVENT and row['source']['id'] == SOURCE)
        self.assertEqual((row['media'], row['observations']), (1, 1))
        for kind, identifier in (('media', MEDIA), ('observations', OBSERVATION)):
            broken = copy.deepcopy(self.doc)
            next(row for row in broken[kind] if row['id'] == identifier)['place']['coordinates'] = [-94.5, 37.1]
            with self.assertRaisesRegex(ValueError, 'Unregistered evidence cannot acquire a map point'):
                validate_dossier(broken)
        for text in ('C:/Users/', 'C:\\Users\\', 'private_notes', 'access_token'):
            self.assertNotIn(text, json.dumps(self.doc) + self.html)


if __name__ == '__main__':
    unittest.main()
