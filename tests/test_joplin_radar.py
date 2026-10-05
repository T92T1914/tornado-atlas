"""The selected radar figure preserves evidence rather than becoming a wind map."""
import copy
import hashlib
import json
from pathlib import Path
import struct
import unittest

from atlas.archive import digest, dossiers, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
ID = 'nist-joplin-radar-sequence'


class JoplinRadarTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = next(doc for doc in dossiers() if doc['id'] == 'joplin-2011')
        cls.before = json.loads((ROOT / 'web/archive/joplin-2011-22debeaf0abaa4cb5c06.json').read_text(encoding='utf-8'))
        cls.media = next(row for row in cls.doc['media'] if row['id'] == ID)
        cls.source = next(row for row in cls.doc['sources'] if row['id'] == ID)

    def test_radar_increment_retains_every_previous_row_and_reconstruction_boundary(self):
        for field in ('sources', 'media', 'creators', 'routes'):
            self.assertEqual(self.doc[field][:-1], self.before[field], field)
        for field in ('observations', 'records', 'reconstruction', 'title', 'summary', 'coverage'):
            self.assertEqual(self.doc[field], self.before[field], field)
        self.assertEqual(self.doc['provenance']['publication_review']['previous_dossier_sha256'], digest(self.before))
        self.assertEqual(self.media['kind'], 'radar')
        self.assertEqual(self.doc['routes'][-1]['href'], 'joplin.html#radar-reading')

    def test_complete_figure_and_caption_have_fixed_pixels_and_no_embedded_metadata(self):
        transform = self.media['transformation']
        raw = (ROOT / 'web' / transform['asset']).read_bytes()
        self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()),
                         (1222331, '8d00dd1d87fc1607f855282337b5d1ee9b7d9f35605a5c28d691841e1b77cbd3'))
        self.assertEqual(raw[:8], b'\x89PNG\r\n\x1a\n')
        self.assertEqual(struct.unpack('>II', raw[16:24]), (947, 1326))
        self.assertEqual(transform['sha256'], hashlib.sha256(raw).hexdigest())
        self.assertIn('full original caption', transform['recipe'])
        self.assertIn('No recoloring', transform['recipe'])
        offset, kinds = 8, set()
        while offset < len(raw):
            length = struct.unpack('>I', raw[offset:offset + 4])[0]
            kinds.add(raw[offset + 4:offset + 8])
            offset += length + 12
        self.assertEqual(offset, len(raw))
        self.assertEqual(kinds, {b'IHDR', b'IDAT', b'IEND'})

    def test_source_labels_measurement_limits_and_attribution_stay_separate(self):
        self.assertEqual(self.media['roles'], {'creator': 'noaa-radar', 'uploader': None, 'rights_holder': None})
        self.assertEqual(self.media['status']['temporal'], 'source_label')
        self.assertEqual(self.media['status']['spatial'], 'unregistered')
        self.assertEqual(self.media['status']['rights'], 'permitted_hosting')
        self.assertIsNone(self.media['time']['alignment'])
        self.assertIsNone(self.media['time']['capture'])
        self.assertIsNone(self.media['time']['video'])
        self.assertIsNone(self.media['place']['coordinates'])
        labels = self.media['time']['event']['reported']
        self.assertEqual(labels, ['May 22, 2011: 2224 UTC', '2229 UTC', '2234 UTC',
                                  '2239 UTC', '2243 UTC', '2248 UTC', '2253 UTC'])
        for text in ('not a continuous radar animation', 'raw radar volumes', 'wind model', '2258 UTC'):
            self.assertIn(text, self.media['limits'])
        for text in ('NOAA', 'NIST', 'PDF page 4', 'GeoEye', 'not hosted'):
            self.assertIn(text, self.source['rights'])

    def test_adding_a_guessed_map_point_is_rejected(self):
        guessed = copy.deepcopy(self.doc)
        row = next(row for row in guessed['media'] if row['id'] == ID)
        row['place']['coordinates'] = [-94.5, 37.1]
        with self.assertRaisesRegex(ValueError, 'Unregistered evidence cannot acquire a map point'):
            validate_dossier(guessed)


if __name__ == '__main__':
    unittest.main()
