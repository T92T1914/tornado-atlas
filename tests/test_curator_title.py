"""Title validation across synthetic private drafts and public source cards."""

import copy
from pathlib import Path
import tempfile
import unittest

from atlas.archive import digest, source_directory
from atlas.curator import Store, candidate
from test_archive_contract import specimen


class CuratorTitleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = Store(Path(self.temp.name) / 'private')
        base = specimen()
        self.draft = {
            'schema_version': 1, 'id': 'synthetic-title-review',
            'target': {'kind': 'event', 'id': base['id'], 'title': base['title']},
            'base': {'event_id': base['id'], 'dossier_sha256': digest(base)},
            'dossier': copy.deepcopy(base), 'private_notes': 'Synthetic private note.',
            'intake': {},
        }

    def test_save_and_candidate_reject_nontext_title_without_mutation(self):
        saved = self.store.save(self.draft, None)
        before = self.store.path(self.draft['id']).read_bytes()
        for index, title in enumerate((None, False, True, 123, 1.5, [], ['title'], {}, {'title': 'text'})):
            with self.subTest(title=title):
                bad = copy.deepcopy(self.draft)
                bad['dossier']['title'] = title
                original = copy.deepcopy(bad)
                with self.assertRaisesRegex(ValueError, '^Dossier title must be text$'):
                    candidate(bad)
                with self.assertRaisesRegex(ValueError, '^Dossier title must be text$'):
                    self.store.save(bad, saved['revision'])
                bad_new = copy.deepcopy(bad)
                bad_new['id'] = f'bad-title-{index}'
                with self.assertRaisesRegex(ValueError, '^Dossier title must be text$'):
                    self.store.save(bad_new, None)
                self.assertFalse(self.store.path(bad_new['id']).exists())
                self.assertEqual(bad, original)
                self.assertEqual(self.store.path(self.draft['id']).read_bytes(), before)
                self.assertEqual(self.store.load(self.draft['id']), saved)
                self.assertEqual(self.store.backup()['drafts'], [saved['draft']])

    def test_restore_rejects_later_nontext_title_before_any_write(self):
        saved = self.store.save(self.draft, None)
        before = self.store.path(self.draft['id']).read_bytes()
        valid_new = copy.deepcopy(self.draft)
        valid_new['id'] = 'valid-before-bad-title'
        for title in (None, False, True, 123, 1.5, [], ['title'], {}, {'title': 'text'}):
            with self.subTest(title=title):
                bad_new = copy.deepcopy(self.draft)
                bad_new['id'] = 'later-bad-title'
                bad_new['dossier']['title'] = title
                backup = {'schema_version': 1, 'kind': 'private-curator-backup',
                          'drafts': [valid_new, bad_new]}
                original = copy.deepcopy(backup)
                with self.assertRaisesRegex(ValueError, '^Dossier title must be text$'):
                    self.store.restore(backup)
                self.assertEqual(backup, original)
                self.assertFalse(self.store.path(valid_new['id']).exists())
                self.assertFalse(self.store.path(bad_new['id']).exists())
                self.assertEqual(self.store.path(self.draft['id']).read_bytes(), before)
                self.assertEqual(self.store.load(self.draft['id']), saved)
                self.assertEqual(self.store.backup()['drafts'], [saved['draft']])

    def test_text_title_survives_save_candidate_restore_and_source_directory(self):
        recovered = Store(Path(self.temp.name) / 'recovered')
        for index, title in enumerate(('Synthetic title', 'Unicode title Ω 測', 'Cafe\u0301',
                                       '', '  title  ', ' ')):
            with self.subTest(title=title):
                draft = copy.deepcopy(self.draft)
                draft['id'] = f'valid-title-{index}'
                draft['dossier']['title'] = title
                saved = self.store.save(draft, None)
                self.assertEqual(saved['draft'], draft)
                exported = candidate(saved['draft'])
                self.assertEqual(exported['dossier']['title'].encode('utf-8'), title.encode('utf-8'))
                self.assertNotIn('private_notes', exported)
                directory = source_directory([exported['dossier']])
                self.assertEqual(directory['entries'][0]['event_title'].encode('utf-8'),
                                 title.encode('utf-8'))
                backup = self.store.backup_draft(draft['id'], saved['revision'])
                self.assertEqual(recovered.restore(backup), {'restored': [draft['id']], 'unchanged': 0})
                self.assertEqual(recovered.load(draft['id']), saved)
                self.assertEqual(recovered.restore(backup), {'restored': [], 'unchanged': 1})


if __name__ == '__main__':
    unittest.main()
