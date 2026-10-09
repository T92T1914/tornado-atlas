import copy
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from atlas.chronology import validate_chronology
from atlas.archive import digest,dossiers,dossier_history

ROOT = Path(__file__).resolve().parents[1]


class RadarChronologyTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / 'exhibits/joplin-2011/chronology.json').read_text(encoding='utf-8'))

    def test_complete_existing_figure_and_retained_published_reference(self):
        validate_chronology(self.data, 'joplin-2011', ROOT)
        self.assertEqual(self.data['entries'][-1]['utc'], '2011-05-22T22:48:00Z')
        self.assertEqual(self.data['radar_context']['snapshots'][-1]['utc'], '2011-05-22T22:53:00Z')
        raw = (ROOT / 'web/assets/joplin-2011/nist-radar-sequence.png').read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), '8d00dd1d87fc1607f855282337b5d1ee9b7d9f35605a5c28d691841e1b77cbd3')

    def test_schema_one_remains_compatible_without_borrowed_radar(self):
        old = copy.deepcopy(self.data)
        old['schema_version'] = 1
        old.pop('radar_context')
        validate_chronology(old, 'joplin-2011', ROOT)
        old['radar_context'] = self.data['radar_context']
        with self.assertRaises(ValueError):
            validate_chronology(old, 'joplin-2011')

    def test_metadata_rebase_preserves_the_retained_documentary_account(self):
        reference=self.data['radar_context']['reference']
        old=json.loads((ROOT/'web'/reference['file']).read_text(encoding='utf-8'))
        self.assertEqual(digest(old),reference['dossier_sha256'])
        current=next(doc for doc in dossiers() if doc['id']=='joplin-2011')
        self.assertEqual(current['provenance']['publication_review']['previous_dossier_sha256'],digest(old))
        first,second=copy.deepcopy(old),copy.deepcopy(current)
        for doc in (first,second):
            doc['provenance'].pop('publication_review');doc['provenance'].pop('curator',None)
        second['provenance']['inputs']['exhibits/joplin-2011/chronology.json']=first['provenance']['inputs']['exhibits/joplin-2011/chronology.json']
        self.assertEqual(digest(first),digest(second))
        history=dossier_history(current)
        self.assertIn(reference['dossier_sha256'],{version['dossier_sha256'] for version in history['versions']})

    def test_mixed_malformed_and_overprecise_navigation_fails(self):
        mutations = [lambda c: c.update(event_id='el-reno-2013'),
                     lambda c: c['reference'].update(event_id='el-reno-2013'),
                     lambda c: c['reference'].update(file='archive/other-7c592efa31cda80b84ce.json'),
                     lambda c: c['reference'].update(file_sha256='short'),
                     lambda c: c.update(navigation_basis=''),
                     lambda c: c.update(snapshots=c['snapshots'][:-1]),
                     lambda c: c['snapshots'].reverse(),
                     lambda c: c['snapshots'][1].update(id=c['snapshots'][0]['id']),
                     lambda c: c['snapshots'][1].update(source_label='2230 UTC'),
                     lambda c: c['snapshots'][1].update(utc='2011-05-22T22:29:01Z'),
                     lambda c: c['snapshots'][1].update(utc='2011-05-23T22:29:00Z'),
                     lambda c: c['snapshots'][1].update(coordinates=[0, 0]),
                     lambda c: c.update(alignment={'utc': '2011-05-22T22:24:00Z'})]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                data = copy.deepcopy(self.data); mutate(data['radar_context'])
                with self.assertRaises(ValueError):
                    validate_chronology(data, 'joplin-2011')

    def test_validly_shaped_but_wrong_file_identity_cannot_publish(self):
        for field in ['file_sha256', 'media_id']:
            data = copy.deepcopy(self.data)
            if field == 'file_sha256':data['radar_context']['reference'][field] = '0' * 64
            else:data['radar_context'][field] = 'missing-radar'
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_chronology(data, 'joplin-2011', ROOT)

    def test_changed_figure_is_rejected_before_package_publication(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            shutil.copytree(ROOT / 'web/archive', root / 'web/archive')
            for source in self.data['sources']:
                destination = root / source['archive']; destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / source['archive'], destination)
            path = root / 'web/assets/joplin-2011/nist-radar-sequence.png'; path.parent.mkdir(parents=True)
            path.write_bytes((ROOT / path.relative_to(root)).read_bytes() + b'changed')
            with self.assertRaisesRegex(ValueError, 'figure bytes or dimensions'):
                validate_chronology(self.data, 'joplin-2011', root)
