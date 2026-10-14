"""Malformed attribution cannot leave a private draft as a public candidate."""
import copy
import http.client
import json
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest

from atlas.archive import digest, dossiers, promote_candidate
from atlas.curator import Store, candidate, server
from test_archive_contract import specimen

BAD = (None, False, True, 123, 1.5, '', [], ['text'], {}, {'text': 'value'})


class CreatorAttributionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.store = Store(self.root / 'private')
        base = specimen()
        self.draft = dict(schema_version=1, id='synthetic-attribution',
            target=dict(kind='event', id=base['id'], title=base['title']),
            base=dict(event_id=base['id'], dossier_sha256=digest(base)),
            dossier=base, private_notes='Synthetic private permission note.', intake={})

    def test_invalid_attribution_cannot_save_export_or_partially_restore(self):
        saved = self.store.save(self.draft, None)
        before = self.store.path(self.draft['id']).read_bytes()
        valid_new = copy.deepcopy(self.draft); valid_new['id'] = 'valid-before-invalid'
        for field in ('name', 'basis'):
            for value in BAD:
                with self.subTest(field=field, value=value):
                    bad = copy.deepcopy(self.draft)
                    bad['dossier']['creators'][0][field] = value
                    original = copy.deepcopy(bad)
                    for operation in (lambda: candidate(bad),
                            lambda: self.store.save(bad, saved['revision'])):
                        with self.assertRaisesRegex(ValueError, 'Creator name and attribution basis'):
                            operation()
                    bad['id'] = 'later-invalid'
                    with self.assertRaises(ValueError):
                        self.store.restore(dict(schema_version=1, kind='private-curator-backup',
                                                drafts=[valid_new, bad]))
                    self.assertFalse(self.store.path(valid_new['id']).exists())
                    self.assertFalse(self.store.path(bad['id']).exists())
                    bad['id'] = self.draft['id']
                    self.assertEqual(bad, original)
                    self.assertEqual(self.store.path(self.draft['id']).read_bytes(), before)
                    self.assertEqual(self.store.load(self.draft['id']), saved)

    def test_candidate_http_rejects_bad_attribution_and_preserves_saved_revision(self):
        saved = self.store.save(self.draft, None)
        before = self.store.path(self.draft['id']).read_bytes()
        app = SimpleNamespace(store=self.store, token='synthetic-test-token', origin=None)
        httpd = server(app); thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            for field in ('name', 'basis'):
                for value in BAD:
                    bad = copy.deepcopy(self.draft); bad['dossier']['creators'][0][field] = value
                    connection = http.client.HTTPConnection('127.0.0.1', httpd.server_address[1], timeout=5)
                    try:
                        connection.request('POST', '/api/candidate', json.dumps({'draft': bad}),
                            {'Origin': app.origin, 'Content-Type': 'application/json', 'X-Curator-Token': app.token})
                        response = connection.getresponse(); body = json.loads(response.read())
                        self.assertEqual(response.status, 400)
                        self.assertIn('Creator name and attribution basis', body['error'])
                        self.assertNotIn('candidate', body)
                    finally:
                        connection.close()
            self.assertEqual(self.store.path(self.draft['id']).read_bytes(), before)
            self.assertEqual(self.store.load(self.draft['id']), saved)
        finally:
            httpd.shutdown(); httpd.server_close(); thread.join(timeout=5)
        self.assertFalse(thread.is_alive())

    def test_promotion_rejects_before_writing_and_valid_text_survives_real_promotion(self):
        root = self.root / 'publication'; research = root / 'research'; research.mkdir(parents=True)
        (research / 'archive-dossiers.json').write_text('[]', encoding='utf8')
        (research / 'record-aliases.json').write_text('{}', encoding='utf8')
        base = specimen(); directory = root / 'exhibits' / base['id']; directory.mkdir(parents=True)
        (directory / 'dossier.json').write_text(json.dumps(base), encoding='utf8')
        path = root / 'candidate.json'
        for field in ('name', 'basis'):
            for value in BAD:
                bad = copy.deepcopy(base); bad['creators'][0][field] = value
                path.write_text(json.dumps(dict(schema_version=1, kind='atlas-curator-candidate',
                    base=dict(event_id=base['id'], dossier_sha256=digest(base)), dossier=bad)), encoding='utf8')
                with self.assertRaisesRegex(ValueError, 'Creator name and attribution basis'):
                    promote_candidate(path, 'Synthetic review.', root)
                self.assertFalse((root / 'web').exists())
                self.assertFalse((research / 'archive-curated').exists())
        for text in ('Unicode Ω 測', 'Cafe\u0301', '  text  ', ' '):
            current = dossiers(root)[0]; draft = copy.deepcopy(self.draft)
            draft['base']['dossier_sha256'] = digest(current); draft['dossier'] = copy.deepcopy(current)
            draft['dossier']['creators'][0].update(name=text, basis=text)
            exported = candidate(draft); self.assertNotIn('private_notes', exported)
            path.write_text(json.dumps(exported), encoding='utf8')
            promote_candidate(path, 'Synthetic valid attribution review.', root)
            published = dossiers(root)[0]
            self.assertEqual(published['creators'][0]['name'].encode('utf8'), text.encode('utf8'))
            self.assertEqual(published['creators'][0]['basis'].encode('utf8'), text.encode('utf8'))


if __name__ == '__main__':
    unittest.main()
