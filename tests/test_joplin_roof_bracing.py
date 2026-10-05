"""The new report figure cannot replace evidence or acquire invented registration."""
import copy
import hashlib
import json
from pathlib import Path
import struct
import unittest

from atlas.archive import digest, dossiers, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
IDENTIFIER = 'nist-home-depot-roof'


class RoofBracingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.current = next(doc for doc in dossiers() if doc['id'] == 'joplin-2011')
        cls.doc = json.loads((ROOT / 'web/archive/joplin-2011-22debeaf0abaa4cb5c06.json').read_text(encoding='utf-8'))
        raw = (ROOT / 'web/archive/joplin-2011-2ff06de762b0d24a3451.json').read_bytes()
        assert hashlib.sha256(raw).hexdigest() == '1aeea5638cd482a4b6a96d034be77f8ac1a7006192a982ffb4377495673f44a2'
        cls.before = json.loads(raw)
        cls.media = next(row for row in cls.doc['media'] if row['id'] == IDENTIFIER)
        cls.source = next(row for row in cls.doc['sources'] if row['id'] == IDENTIFIER)

    def test_only_named_source_media_and_route_are_added(self):
        for field in ('observations', 'records', 'reconstruction', 'creators', 'title', 'summary', 'coverage'):
            self.assertEqual(self.doc[field], self.before[field], field)
        for field in ('sources', 'media', 'routes'):
            self.assertEqual(self.doc[field][:-1], self.before[field], field)
            self.assertEqual(len(self.doc[field]), len(self.before[field]) + 1, field)
        self.assertEqual(self.doc['sources'][-1]['id'], IDENTIFIER)
        self.assertEqual(self.doc['media'][-1]['id'], IDENTIFIER)
        self.assertEqual(self.doc['routes'][-1], {'label': 'How roof loss removed wall support', 'href': 'joplin.html#roof-bracing'})
        self.assertEqual(self.doc['provenance']['publication_review']['previous_dossier_sha256'], digest(self.before))
        for field in ('sources', 'media', 'routes', 'observations', 'creators', 'records'):
            self.assertEqual(self.current[field][:len(self.doc[field])], self.doc[field], field)
        self.assertEqual(self.current['reconstruction'], self.doc['reconstruction'])

    def test_full_annotated_figure_identity_and_metadata_exclusion(self):
        transform = self.media['transformation']
        raw = (ROOT / 'web' / transform['asset']).read_bytes()
        self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()),
                         (617058, 'cdbc865dcdbc894bc82873d8d14e5dc9d3ea2af3e4b245b071f7ba23a4bc2d97'))
        self.assertEqual(raw[:8], b'\x89PNG\r\n\x1a\n')
        self.assertEqual(struct.unpack('>II', raw[16:24]), (943, 435))
        self.assertEqual(transform['sha256'], hashlib.sha256(raw).hexdigest())
        self.assertEqual((transform['width'], transform['height']), (943, 435))
        self.assertIn('red NIST annotation', transform['recipe'])
        self.assertIn('Not an unchanged original camera photograph', transform['recipe'])
        position = 8
        kinds = []
        while position < len(raw):
            size = struct.unpack('>I', raw[position:position + 4])[0]
            kinds.append(raw[position + 4:position + 8])
            position += size + 12
        self.assertEqual(position, len(raw))
        self.assertEqual(set(kinds), {b'IHDR', b'IDAT', b'IEND'})

    def test_rights_exceptions_and_mechanism_qualification_are_explicit(self):
        for phrase in ('PDF page 4', 'Figure 3-49', 'GeoEye Figure 3-42', 'Homer TLC', 'not hosted'):
            self.assertIn(phrase, self.source['rights'])
        self.assertIn('Not a full report', self.source['access'])
        self.assertIn('possible failure sequence', self.media['limits'])
        self.assertEqual(self.media['roles'], {'creator': 'nist', 'uploader': None, 'rights_holder': None})
        chapter = (ROOT / 'web/joplin.html').read_text(encoding='utf-8')
        note = chapter.split('id="roof-bracing"', 1)[1].split('id="school-refuge"', 1)[0]
        for phrase in ('Possible Failure Sequence', 'cannot show which connection failed first',
                       'not a measured wind speed', 'not make a controlled comparison',
                       'photograph and red annotation', '#page=196', '#page=201', '#page=202', '#page=4'):
            self.assertIn(phrase, note)

    def test_report_photo_stays_unregistered_and_rejects_added_pose_or_clock(self):
        self.assertEqual(self.media['status']['temporal'], 'unregistered')
        self.assertEqual(self.media['status']['spatial'], 'unregistered')
        self.assertEqual(self.media['status']['rights'], 'permitted_hosting')
        for key in ('event', 'capture', 'video', 'alignment'):
            self.assertIsNone(self.media['time'][key])
        self.assertIsNone(self.media['place']['coordinates'])
        for kind in ('clock', 'point'):
            broken = copy.deepcopy(self.doc)
            row = broken['media'][-1]
            if kind == 'clock':
                row['time']['alignment'] = {'utc': '2011-05-22T22:45:00Z', 'basis': 'A guess from the photograph'}
            else:
                row['place']['coordinates'] = [-94.5, 37.1]
            with self.assertRaises(ValueError):
                validate_dossier(broken)


if __name__ == '__main__':
    unittest.main()
