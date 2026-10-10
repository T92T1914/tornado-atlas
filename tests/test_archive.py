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
    def test_retained_single_source_projection_keeps_its_reviewed_identity(self):
        expected = {
            'el-reno-2013': '900cc2c8a99db11a4858006bc3c9d768f468feb1cb88d404d005aa0938b961b4',
            'joplin-2011': '1d53026636f7970d3954388a97dfaa9753ec7fc8b70c9f8606db332a9e770460',
            'blackwell-1955': '51d56cb1f0c100423c8748081cd95e1be2da642ab1bbda16cf808777b9c9aed5',
        }
        self.assertEqual({doc['id']: digest(doc) for doc in dossiers(include_curated=False) if doc['id'] in expected}, expected)

    def test_authored_exhibit_uses_existing_validation_and_review_lifecycle(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'research').mkdir()
            (root / 'research/archive-dossiers.json').write_text('[]', encoding='utf-8')
            (root / 'research/record-aliases.json').write_text('{}', encoding='utf-8')
            base = copy.deepcopy(dossiers()[0])
            base['id'] = 'synthetic-authored'
            target = root / 'exhibits/synthetic-authored/dossier.json'
            target.parent.mkdir(parents=True)
            target.write_text(json.dumps(base), encoding='utf-8')
            self.assertEqual(dossiers(root), [base])
            revised = copy.deepcopy(base)
            revised['summary'] = 'Synthetic reviewed revision, not historical evidence.'
            candidate = root / 'candidate.json'
            candidate.write_text(json.dumps(dict(schema_version=1, kind='atlas-curator-candidate',
                base=dict(event_id=base['id'], dossier_sha256=digest(base)), dossier=revised)), encoding='utf-8')
            promote_candidate(candidate, 'Synthetic lifecycle regression.', root)
            published = dossiers(root)[0]
            self.assertEqual(published['summary'], revised['summary'])
            self.assertEqual(published['observations'], revised['observations'])
            self.assertEqual(published['media'], revised['media'])
            self.assertEqual(published['provenance']['publication_review']['basis'], 'Synthetic lifecycle regression.')
            self.assertEqual(dossiers(root, include_curated=False), [base])
            base['summary'] = 'Changed authored source after review.'
            target.write_text(json.dumps(base), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'rebase and review'):
                dossiers(root)
            base['id'] = 'wrong-directory'
            target.write_text(json.dumps(base), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'identity must match'):
                dossiers(root)

    def test_each_footage_anchor_keeps_its_own_source_and_clock(self):
        original = dossiers(include_curated=False)[0]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in original['provenance']['inputs']:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / relative, target)
            # Limit this authored fixture to El Reno. No retained evidence is edited.
            config_path = root / 'research/archive-dossiers.json'
            config = json.loads(config_path.read_text(encoding='utf-8'))
            config_path.write_text(json.dumps([row for row in config if row['id'] == 'el-reno-2013']), encoding='utf-8')
            footage_path = root / 'exhibits/el-reno-2013/footage.json'
            footage = json.loads(footage_path.read_text(encoding='utf-8'))
            second = copy.deepcopy(footage['sources'][0])
            second.update(id='synthetic-second', creator='Synthetic second creator',
                video_id='abcdefghijk', url='https://www.youtube.com/watch?v=abcdefghijk',
                title='Synthetic alternate-source fixture', rights='Synthetic source rights record.',
                clock_basis='Synthetic independent clock basis.', limits='Synthetic source limits.')
            footage['sources'].append(second)
            anchor = copy.deepcopy(footage['anchors'][0])
            anchor.update(id='synthetic-second-01', source_id=second['id'], video_seconds=12,
                note='Synthetic coincident UTC sample, not inspected historical footage.')
            footage['anchors'].insert(1, anchor)
            footage_path.write_text(json.dumps(footage), encoding='utf-8')
            projected = dossiers(root, include_curated=False)[0]
            item = next(row for row in projected['media'] if row['id'] == anchor['id'])
            self.assertEqual(item['source_id'], second['id'])
            self.assertEqual(item['url'], second['url'] + '&t=12')
            self.assertEqual(item['time']['alignment']['utc'], anchor['utc'])
            self.assertEqual(item['time']['capture']['basis'], second['clock_basis'])
            self.assertIn(second['limits'], item['limits'])
            self.assertIsNone(item['roles']['uploader'])
            self.assertIsNone(item['roles']['rights_holder'])
            creator = next(row for row in projected['creators'] if row['id'] == item['roles']['creator'])
            self.assertEqual(creator['name'], second['creator'])
            self.assertEqual(next(row for row in projected['sources'] if row['id'] == second['id'])['rights'], second['rights'])
            self.assertEqual(next(row for row in projected['sources'] if row['id'] == second['id'])['locator'],
                '1 retained paused clock sample; no continuous audit.')
            for old in original['media']:
                self.assertEqual(next(row for row in projected['media'] if row['id'] == old['id']), old)
            footage['sources'].reverse()
            footage_path.write_text(json.dumps(footage), encoding='utf-8')
            reordered = dossiers(root, include_curated=False)[0]
            self.assertEqual(reordered['media'], projected['media'])
            self.assertEqual({row['id']: row for row in reordered['sources']},
                {row['id']: row for row in projected['sources']})
            self.assertEqual({row['id']: row for row in reordered['creators']},
                {row['id']: row for row in projected['creators']})
            footage['anchors'][1]['source_id'] = 'missing-source'
            footage_path.write_text(json.dumps(footage), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'known source version'):
                dossiers(root, include_curated=False)

    def test_map_is_a_distinct_media_kind_without_registration(self):
        doc = copy.deepcopy(dossiers()[0])
        item = doc['media'][0]
        item['kind'] = 'map'
        validate_dossier(doc)
        self.assertIsNone(item['place']['coordinates'])
        self.assertIsNone(item['time']['alignment'])
        item['kind'] = 'diagram-of-unknown-contract'
        with self.assertRaisesRegex(ValueError, 'Unknown media kind'):
            validate_dossier(doc)

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
