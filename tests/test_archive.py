import copy
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from atlas.archive import digest, dossiers, promote_candidate, publication, public_url, validate_dossier

ROOT = Path(__file__).resolve().parents[1]


class ArchiveTests(unittest.TestCase):
    def test_projection_preserves_source_values_and_separate_clocks(self):
        doc = dossiers()[0]
        photo = doc['media'][0]
        self.assertIsNone(photo['time']['alignment'])
        self.assertIsNone(photo['place']['coordinates'])
        self.assertIsNone(photo['roles']['uploader'])
        film = next(m for m in doc['media'] if m['kind'] == 'video')
        self.assertEqual(film['time']['video']['start_seconds'], 5)
        self.assertEqual(film['time']['alignment']['utc'], '2013-05-31T23:17:03Z')
        self.assertIn('final NWS damage rating is EF3', film['limits'])

    def test_invalid_registration_does_not_publish(self):
        base = dossiers()[0]
        for mutate in [lambda d: d['media'][0]['place'].update(coordinates=[0, 0]),
                       lambda d: d['media'][2]['time'].update(alignment=None),
                       lambda d: d['reconstruction'].update(intervals=['invented']),
                       lambda d: d['media'][0]['status'].update(spatial='source_reported'),
                       lambda d: d['media'][2]['time'].update(video={'start_seconds': 5, 'end_seconds': 2}),
                       lambda d: d['sources'][0].update(private_note='not public'),
                       lambda d: d['media'][0]['status'].update(availability='documented_no_result')]:
            doc = copy.deepcopy(base); mutate(doc)
            with self.assertRaises(ValueError):
                validate_dossier(doc)

    def test_status_dimensions_and_private_urls(self):
        for value in ['file:///private', 'https://127.0.0.1/a', 'https://192.168.1.5/a',
                      'https://localhost/a', 'https://machine.internal/a', 'https://user:pass@example.com/a']:
            with self.assertRaises(ValueError):
                public_url(value)
        doc = dossiers()[0]
        doc['media'][0]['status']['availability'] = 'documented_no_result'
        doc['media'][0]['review'] = dict(searched_on='2026-09-27', scope='A named source page', method='Page inspection')
        validate_dossier(doc)

    def test_selective_record_lookup_and_honest_discovery(self):
        artifacts = publication()
        index = artifacts['archive/index.json']
        self.assertLess(len(json.dumps(index).encode()), 40000)
        self.assertEqual(index['events'][0]['registered_media'], 0)
        self.assertNotIn('chronology', index['events'][2]['evidence'])
        self.assertIn('chronology', index['events'][1]['evidence'])
        for identifier in ['ncei:453682', 'ncei:296617', 'ncei:296620', 'ncei:10096417', index['sparse_example']]:
            file = index['record_shards'][hashlib.sha256(identifier.encode()).hexdigest()[:2]]
            self.assertEqual(json.loads((ROOT / 'web/catalogue' / file).read_text(encoding='utf-8'))[identifier]['id'], identifier)

    def test_generated_publication_is_current(self):
        for relative, expected in publication().items():
            self.assertEqual(json.loads((ROOT / 'web' / relative).read_text(encoding='utf-8')), expected)

    def test_private_host_alias_cannot_replace_a_reviewed_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'research').mkdir()
            config = [{'id': 'synthetic-publication', 'title': 'Synthetic publication',
                       'coverage': 'Dossier', 'summary': 'A source-link validation fixture.',
                       'records': [], 'routes': [], 'sources': [{
                           'identifier': 'fixture-source', 'title': 'Synthetic source',
                           'url': 'https://example.org/source', 'locator': 'Fixture paragraph.',
                           'access': 'Synthetic access record.', 'revision': 'Fixture revision 1.'}]}]
            (root / 'research/archive-dossiers.json').write_text(json.dumps(config), encoding='utf-8')
            (root / 'research/record-aliases.json').write_text('{}', encoding='utf-8')
            base = dossiers(root)[0]
            candidate = {'schema_version': 1, 'kind': 'atlas-curator-candidate',
                         'base': {'event_id': base['id'], 'dossier_sha256': digest(base)},
                         'dossier': copy.deepcopy(base)}
            path = root / 'candidate.json'
            path.write_text(json.dumps(candidate), encoding='utf-8')
            promote_candidate(path, 'Reviewed synthetic public-link fixture.', root)
            retained_path = root / 'research/archive-curated/synthetic-publication.json'
            retained = retained_path.read_bytes()
            current = dossiers(root)[0]
            candidate['base']['dossier_sha256'] = digest(current)
            candidate['dossier'] = copy.deepcopy(current)
            candidate['dossier']['sources'][0]['url'] = 'https://127.1/source'
            path.write_text(json.dumps(candidate), encoding='utf-8')
            with self.assertRaises(ValueError):
                promote_candidate(path, 'A private host alias must not publish.', root)
            self.assertEqual(retained, retained_path.read_bytes())
            self.assertEqual(current, dossiers(root)[0])

    def test_reviewed_candidate_preserves_certainty_and_rejects_stale_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            originals = dossiers(include_curated=False)
            paths = {p for doc in originals for p in doc['provenance']['inputs']}
            for relative in paths:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / relative, target)
            base = dossiers(root)[0]
            edited = copy.deepcopy(base)
            edited['sources'][0]['locator'] += '; explicit retained locator clarification'
            edited['provenance']['curator'] = {'draft_id': 'private-draft-name'}
            for item in edited['media']:
                item['status']['intake'] = 'candidate'
            candidate = {'schema_version': 1, 'kind': 'atlas-curator-candidate',
                         'base': {'event_id': base['id'], 'dossier_sha256': digest(base)},
                         'dossier': edited}
            path = root / 'candidate.json'
            path.write_text(json.dumps(candidate), encoding='utf-8')
            result = promote_candidate(path, 'Inspected retained locator, without new registration.', root)
            published = dossiers(root)[0]
            self.assertEqual(result['dossier_sha256'], digest(published))
            self.assertNotIn('curator', published['provenance'])
            self.assertEqual(published['provenance']['publication_review']['reviewer_kind'], 'agent')
            for before, after in zip(base['media'], published['media']):
                self.assertEqual(before['status'], after['status'])
                self.assertEqual(before['time'], after['time'])
                self.assertEqual(before['place'], after['place'])
            retained = (root / 'research/archive-curated/el-reno-2013.json').read_bytes()
            with self.assertRaisesRegex(ValueError, 'base changed'):
                promote_candidate(path, 'A stale candidate must not overwrite newer work.', root)
            self.assertEqual(retained, (root / 'research/archive-curated/el-reno-2013.json').read_bytes())
            source = root / 'exhibits/el-reno-2013/timeline-media.json'
            source.write_bytes(source.read_bytes() + b'\n')
            with self.assertRaisesRegex(ValueError, 'source projection changed'):
                dossiers(root)


if __name__ == '__main__':
    unittest.main()
