"""Context imagery must preserve earlier evidence and refuse invented registration."""
import copy
import hashlib
import json
from pathlib import Path
import unittest

from atlas.archive import dossiers, publication, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
BASES = {
    'blackwell-1955': ('254585ae31741f76ffdf', 'ff47a0d38217afe6dd55525eca796272c90f599f90613128d3649e6d8dbd349c'),
    'joplin-2011': ('30b168fee88e544e1ecd', 'c46521edf5006a26d2b41bae294a0096b36169330d5183ddc427df1cb0964be9'),
    'el-reno-2013': ('06dd86bd23866e8be810', '0446ffc961d253678ff56f8af50aa4c6fd9f7a74d80da8d2b70fd214ddeca934'),
}
ADDITIONS = {
    'blackwell-1955': {'nws-blackwell-smoothed-map', 'nws-blackwell-memorial-2005'},
    'joplin-2011': {'nist-joplin-survivor-interview'},
    'el-reno-2013': {'nws-el-reno-roof-loss-04'},
}
# Hospital photographs use the source-specific checks in test_joplin_hospital.py.
HOSPITAL_ADDITIONS = {'nist-west-tower', 'nist-west-tower-south-windows'}
ROOF_ADDITION = {'nist-home-depot-roof'}


class ContextImageTests(unittest.TestCase):
    def setUp(self):
        self.docs = {doc['id']: doc for doc in dossiers()}

    def test_prior_documents_are_unchanged_and_every_prior_evidence_row_survives(self):
        for event, (identity, checksum) in BASES.items():
            with self.subTest(event=event):
                raw = (ROOT / 'web/archive' / f'{event}-{identity}.json').read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(), checksum)
                old = json.loads(raw)
                current = self.docs[event]
                for field in ('records', 'reconstruction', 'observations'):
                    self.assertEqual(current[field], old[field])
                for field in ('sources', 'media', 'creators', 'routes'):
                    by_id = {row.get('id', row.get('href')): row for row in current[field]}
                    for prior in old[field]:
                        self.assertEqual(by_id[prior.get('id', prior.get('href'))], prior)
                expected_additions = ADDITIONS[event]
                if event == 'joplin-2011':
                    expected_additions = expected_additions | HOSPITAL_ADDITIONS | ROOF_ADDITION
                self.assertEqual({row['id'] for row in current['media']} -
                                 {row['id'] for row in old['media']}, expected_additions)

    def test_available_context_images_do_not_acquire_storm_alignment_or_coordinates(self):
        for event, ids in ADDITIONS.items():
            for item in self.docs[event]['media']:
                if item['id'] not in ids:
                    continue
                with self.subTest(media=item['id']):
                    self.assertEqual(item['status'], {
                        'intake': 'published', 'assertion': 'source_reported',
                        'temporal': 'unregistered', 'spatial': 'unregistered',
                        'availability': 'reviewed_available', 'rights': 'permitted_hosting'})
                    self.assertIsNone(item['time']['alignment'])
                    self.assertIsNone(item['time']['capture'])
                    self.assertIsNone(item['time']['video'])
                    self.assertIsNone(item['place']['coordinates'])
                    for mutate in (
                        lambda row: row['place'].update(coordinates=[-97, 36]),
                        lambda row: row['time'].update(alignment={
                            'utc': '1955-05-26T02:27:00Z', 'basis': 'A tempting guess'}),
                    ):
                        broken = copy.deepcopy(self.docs[event])
                        row = next(row for row in broken['media'] if row['id'] == item['id'])
                        mutate(row)
                        with self.assertRaises(ValueError):
                            validate_dossier(broken)

    def test_original_asset_bytes_dimensions_credits_and_source_routes_are_retained(self):
        for event, ids in ADDITIONS.items():
            doc = self.docs[event]
            sources = {row['id']: row for row in doc['sources']}
            creators = {row['id']: row for row in doc['creators']}
            for item in doc['media']:
                if item['id'] not in ids:
                    continue
                with self.subTest(media=item['id']):
                    transformation = item['transformation']
                    asset = ROOT / 'web' / transformation['asset']
                    self.assertEqual(hashlib.sha256(asset.read_bytes()).hexdigest(), transformation['sha256'])
                    self.assertGreater(transformation['width'], 0)
                    self.assertGreater(transformation['height'], 0)
                    self.assertTrue(transformation['alt'])
                    self.assertIn('https://', sources[item['source_id']]['rights'])
                    self.assertIn(item['roles']['creator'], creators)
                    self.assertTrue(creators[item['roles']['creator']]['basis'])
                    self.assertIsNone(item['roles']['rights_holder'])
                    self.assertIn('https://', item['url'])

    def test_map_and_memorial_keep_their_distinct_meanings(self):
        rows = {row['id']: row for row in self.docs['blackwell-1955']['media']}
        map_row = rows['nws-blackwell-smoothed-map']
        self.assertEqual(map_row['kind'], 'map')
        self.assertIn('smoothed', map_row['account'])
        self.assertIn('not measured wind bands', map_row['limits'])
        self.assertIn('underlying newspaper editions have not been inspected', map_row['limits'])
        self.assertNotIn('1995', map_row['limits'])
        memorial = rows['nws-blackwell-memorial-2005']
        self.assertEqual(memorial['kind'], 'photograph')
        self.assertIn('2005', memorial['account'])
        self.assertIn('remembrance record', memorial['limits'])
        self.assertIn('individual names', memorial['limits'])
        html = (ROOT / 'web/blackwell.html').read_text(encoding='utf-8')
        for path in ('assets/blackwell-1955/nws-smoothed-damage.gif',
                     'assets/blackwell-1955/nws-memorial-2005.jpg'):
            self.assertIn('href="' + path + '"', html)
            self.assertIn('src="' + path + '"', html)

    def test_small_interview_still_is_not_stretched_or_used_as_a_personal_history(self):
        row = next(row for row in self.docs['joplin-2011']['media'] if row['id'] == 'nist-joplin-survivor-interview')
        self.assertEqual((row['transformation']['width'], row['transformation']['height']), (288, 216))
        self.assertIn('does not identify either person', row['limits'])
        html = (ROOT / 'web/joplin.html').read_text(encoding='utf-8')
        self.assertIn('max-width:288px', html)
        self.assertIn('href="assets/joplin-2011/nist-interview.jpg"', html)
        self.assertIn('not what either person saw or did', html)

    def test_el_reno_keeps_local_damage_rating_and_separate_houses(self):
        row = next(row for row in self.docs['el-reno-2013']['media'] if row['id'] == 'nws-el-reno-roof-loss-04')
        self.assertIn('EF2', row['account'])
        self.assertIn('another house', row['limits'])
        self.assertEqual(row['transformation']['asset'], 'assets/el-reno-2013/damage04.jpg')
        history = json.loads((ROOT / 'exhibits/el-reno-2013/history.json').read_text(encoding='utf-8'))
        section = next(section for section in history['report'] if section['id'] == 'reading-damage')
        self.assertIn('different houses', section['paragraphs'][-1])
        self.assertIn('not a before and after sequence', section['paragraphs'][-1])
        self.assertEqual(history['impacts']['deaths_direct'], 8)

    def test_public_export_points_to_new_immutable_documents_with_no_registered_media(self):
        files = publication()
        for entry in files['archive/index.json']['events']:
            if entry['id'] not in ADDITIONS:
                continue
            self.assertEqual(entry['registered_media'], 0)
            self.assertEqual(json.loads((ROOT / 'web' / entry['file']).read_text(encoding='utf-8')), files[entry['file']])
            self.assertNotIn('private_notes', files[entry['file']])


if __name__ == '__main__':
    unittest.main()
