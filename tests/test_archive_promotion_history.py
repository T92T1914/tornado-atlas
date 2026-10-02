"""Reviewed promotions retain their predecessor before replacing the override."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from atlas.archive import build, digest, dossier_history, dossiers, promote_candidate
from atlas.publication import write_json


class PromotionHistoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        research = self.root / 'research'
        research.mkdir()
        config = [{'id': 'synthetic-promotion', 'title': 'Synthetic promotion',
                   'coverage': 'Dossier', 'summary': 'Synthetic initial account.',
                   'records': [], 'routes': [], 'sources': []}]
        (research / 'archive-dossiers.json').write_text(json.dumps(config), encoding='utf-8')
        (research / 'record-aliases.json').write_text('{}', encoding='utf-8')

    def promote(self, summary):
        current = dossiers(self.root)[0]
        changed = copy.deepcopy(current)
        changed['summary'] = summary
        path = self.root / 'candidate.json'
        path.write_text(json.dumps({
            'schema_version': 1, 'kind': 'atlas-curator-candidate',
            'base': {'event_id': current['id'], 'dossier_sha256': digest(current)},
            'dossier': changed,
        }), encoding='utf-8')
        promote_candidate(path, 'Reviewed synthetic account correction.', self.root)
        return dossiers(self.root)[0]

    def snapshot(self, doc):
        return self.root / 'web/archive' / f"{doc['id']}-{digest(doc)[:20]}.json"

    def override(self):
        return self.root / 'research/archive-curated/synthetic-promotion.json'

    def test_two_promotions_before_a_build_keep_the_complete_new_chain(self):
        initial = dossiers(self.root)[0]
        first = self.promote('Synthetic first correction.')
        second = self.promote('Synthetic second correction.')
        history = dossier_history(second, self.root)
        versions = {row['dossier_sha256']: row for row in history['versions']}
        self.assertEqual(set(versions), {digest(initial), digest(first), digest(second)})
        for newer, previous in ((second, first), (first, initial)):
            row = versions[digest(newer)]
            self.assertTrue(row['predecessor_available'])
            self.assertEqual(row['review']['previous_dossier_sha256'], digest(previous))
            self.assertEqual(row['changes'], [{'kind': 'dossier', 'id': newer['id'],
                                               'change': 'updated', 'fields': ['summary']}])
            old = json.loads((self.root / 'web' / versions[digest(previous)]['file'])
                             .read_text(encoding='utf-8'))
            self.assertEqual(old, previous)

    def test_existing_equivalent_snapshot_keeps_its_exact_bytes(self):
        initial = dossiers(self.root)[0]
        path = self.snapshot(initial)
        path.parent.mkdir(parents=True)
        original = (json.dumps(initial, indent=2) + '\r\n').encode('utf-8')
        path.write_bytes(original)
        first = self.promote('Synthetic first correction.')
        self.assertEqual(path.read_bytes(), original)
        self.assertTrue(dossier_history(first, self.root)['versions'][0]['predecessor_available'])

    def test_publication_build_indexes_chain_without_rewriting_retained_bytes(self):
        first = self.promote('Synthetic first correction.')
        second = self.promote('Synthetic second correction.')
        retained = {path.name: path.read_bytes()
                    for path in (self.root / 'web/archive').iterdir()}
        write_json(self.root / 'web/catalogue/index.json', {
            'records': [{'id': 'ncei:123', 'detail_file': 'details/00-synthetic.json'}],
            'coverage': {'current_source_records': 1},
        })
        self.assertEqual(build(self.root), {'dossiers': 1, 'records': 1})
        for name, raw in retained.items():
            self.assertEqual((self.root / 'web/archive' / name).read_bytes(), raw)
        index = json.loads((self.root / 'web/archive/index.json').read_text(encoding='utf-8'))
        entry = index['events'][0]
        current = json.loads((self.root / 'web' / entry['file']).read_text(encoding='utf-8'))
        history = json.loads((self.root / 'web' / entry['history_file']).read_text(encoding='utf-8'))
        self.assertEqual(current, second)
        self.assertEqual(history['current_dossier_sha256'], digest(second))
        predecessors = {row['dossier_sha256']: row for row in history['versions']}
        self.assertTrue(predecessors[digest(second)]['predecessor_available'])
        self.assertTrue(predecessors[digest(first)]['predecessor_available'])

    def test_conflicting_snapshot_does_not_replace_current_reviewed_account(self):
        first = self.promote('Synthetic first correction.')
        original_override = self.override().read_bytes()
        retained = self.snapshot(first)
        retained.write_text('{"conflicting": "immutable fixture"}', encoding='utf-8')
        original_snapshot = retained.read_bytes()
        with self.assertRaisesRegex(ValueError, 'immutable retained'):
            self.promote('Synthetic second correction.')
        self.assertEqual(self.override().read_bytes(), original_override)
        self.assertEqual(retained.read_bytes(), original_snapshot)
        self.assertEqual(dossiers(self.root)[0], first)

    def test_retention_failure_does_not_replace_current_reviewed_account(self):
        first = self.promote('Synthetic first correction.')
        original_override = self.override().read_bytes()
        with patch('atlas.archive.write_json', side_effect=OSError('synthetic disk failure')):
            with self.assertRaises(OSError):
                self.promote('Synthetic second correction.')
        self.assertFalse(self.snapshot(first).exists())
        self.assertEqual(self.override().read_bytes(), original_override)
        self.assertEqual(dossiers(self.root)[0], first)

    def test_numeric_alias_snapshot_cannot_replace_current_reviewed_account(self):
        first = self.promote('Synthetic first correction.')
        original_override = self.override().read_bytes()
        retained = self.snapshot(first)
        for alias in (True, 1.0):
            with self.subTest(schema_version=alias):
                changed = copy.deepcopy(first)
                changed['schema_version'] = alias
                self.assertEqual(changed, first)
                self.assertNotEqual(digest(changed), digest(first))
                retained.write_text(json.dumps(changed), encoding='utf-8')
                original_snapshot = retained.read_bytes()
                with self.assertRaisesRegex(ValueError, 'immutable retained'):
                    self.promote('Synthetic second correction.')
                self.assertEqual(self.override().read_bytes(), original_override)
                self.assertEqual(retained.read_bytes(), original_snapshot)
                self.assertEqual(dossiers(self.root)[0], first)

    def test_override_failure_retains_previous_account_and_can_be_retried(self):
        first = self.promote('Synthetic first correction.')
        original_override = self.override().read_bytes()

        def fail_override(path, value):
            if path == self.override():
                raise OSError('synthetic override failure')
            return write_json(path, value)

        with patch('atlas.archive.write_json', side_effect=fail_override):
            with self.assertRaises(OSError):
                self.promote('Synthetic second correction.')
        self.assertEqual(self.override().read_bytes(), original_override)
        preserved = self.snapshot(first).read_bytes()
        self.assertEqual(json.loads(preserved), first)
        self.assertEqual(dossiers(self.root)[0], first)
        second = self.promote('Synthetic second correction.')
        self.assertEqual(self.snapshot(first).read_bytes(), preserved)
        self.assertTrue(dossier_history(second, self.root)['versions'][0]['predecessor_available'])

    def test_stale_candidate_cannot_add_snapshots_or_replace_current_account(self):
        self.promote('Synthetic first correction.')
        candidate = (self.root / 'candidate.json').read_bytes()
        self.promote('Synthetic second correction.')
        (self.root / 'candidate.json').write_bytes(candidate)
        original_override = self.override().read_bytes()
        before = {path.name: path.read_bytes()
                  for path in (self.root / 'web/archive').iterdir()}
        with self.assertRaisesRegex(ValueError, 'base changed'):
            promote_candidate(self.root / 'candidate.json', 'Stale synthetic review.', self.root)
        self.assertEqual(self.override().read_bytes(), original_override)
        self.assertEqual(before, {path.name: path.read_bytes()
                                 for path in (self.root / 'web/archive').iterdir()})

    def test_link_or_oversized_snapshot_cannot_replace_current_account(self):
        first = self.promote('Synthetic first correction.')
        original_override = self.override().read_bytes()
        with patch.object(Path, 'is_symlink', return_value=True):
            with self.assertRaisesRegex(ValueError, 'cannot be a link'):
                self.promote('Synthetic second correction.')
        retained = self.snapshot(first)
        retained.write_bytes(b' ' * 200_001)
        with self.assertRaisesRegex(ValueError, 'immutable retained'):
            self.promote('Synthetic second correction.')
        self.assertEqual(retained.read_bytes(), b' ' * 200_001)
        self.assertEqual(self.override().read_bytes(), original_override)


if __name__ == '__main__':
    unittest.main()
