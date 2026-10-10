"""Publication binds logical dossier identities to preserved file bytes."""
import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from atlas.archive import build, digest, dossier_history, dossiers, publication, verify_dossier_files
from atlas.publication import json_bytes, write_json

ROOT = Path(__file__).resolve().parents[1]


class ArchiveFileIdentityTests(unittest.TestCase):
    def test_every_real_retained_file_has_an_independent_byte_hash(self):
        artifacts = publication()
        references = {}
        for event in artifacts['archive/index.json']['events']:
            history = artifacts[event['history_file']]
            current = next(v for v in history['versions'] if v['dossier_sha256'] == history['current_dossier_sha256'])
            for key in ('file', 'dossier_sha256', 'file_sha256'):
                self.assertEqual(event[key], current[key])
            for version in history['versions']:
                raw = (ROOT / 'web' / version['file']).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(), version['file_sha256'])
                self.assertEqual(digest(json.loads(raw)), version['dossier_sha256'])
                references[version['file']] = version['file_sha256']
        self.assertEqual(len(references), 40)

    def test_encoder_and_writer_use_identical_utf8_and_lf(self):
        payload = {'text': '雪', 'float': 1.0, 'zero': -0.0}
        expected = b'{"text":"\xe9\x9b\xaa","float":1.0,"zero":-0.0}\n'
        self.assertEqual(json_bytes(payload), expected)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'file.json'
            self.assertEqual(write_json(path, payload), expected)
            self.assertEqual(path.read_bytes(), expected)

    def test_retained_crlf_whitespace_and_unicode_escapes_are_preserved(self):
        doc = copy.deepcopy(dossiers()[0])
        doc['summary'] += ' Synthetic fixture: 雪.'
        logical = digest(doc)
        raw = (json.dumps(doc, ensure_ascii=True, indent=1).replace('\n', '\r\n') + '\r\n').encode('utf-8')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            relative = f"archive/{doc['id']}-{logical[:20]}.json"
            path = root / 'web' / relative
            path.parent.mkdir(parents=True)
            path.write_bytes(raw)
            history = dossier_history(doc, root)
            current = history['versions'][0]
            self.assertEqual(current['file_sha256'], hashlib.sha256(raw).hexdigest())
            self.assertNotEqual(current['file_sha256'], hashlib.sha256(json_bytes(doc)).hexdigest())
            history_file = f"archive/{doc['id']}-history-{digest(history)[:20]}.json"
            index = {'events': [{'id': doc['id'], 'history_file': history_file,
                                 **{key: current[key] for key in ('file', 'dossier_sha256', 'file_sha256')}}],
                     'coverage': {'current_source_records': 1}}
            artifacts = {relative: doc, history_file: history, 'archive/index.json': index}
            with patch('atlas.archive.publication', return_value=artifacts):
                self.assertEqual(build(root), {'dossiers': 1, 'records': 1})
                self.assertEqual(build(root), {'dossiers': 1, 'records': 1})
            self.assertEqual(path.read_bytes(), raw)
            self.assertEqual(json.loads((root / 'web/archive/index.json').read_bytes()), index)

    def test_immutable_numeric_and_boolean_aliases_are_rejected_before_index_replace(self):
        for before, after in [(1, 1.0), (1, True), (0.0, -0.0)]:
            with self.subTest(before=before, after=after), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                target = root / 'web/archive/fixture.json'
                write_json(target, {'value': before})
                index = root / 'web/archive/index.json'
                previous = b'{"previous":"retained index"}\n'
                index.write_bytes(previous)
                original = target.read_bytes()
                artifacts = {'archive/fixture.json': {'value': after},
                             'archive/index.json': {'events': [], 'coverage': {'current_source_records': 1}}}
                with patch('atlas.archive.publication', return_value=artifacts):
                    with self.assertRaisesRegex(ValueError, 'immutable'):
                        build(root)
                self.assertEqual(index.read_bytes(), previous)
                self.assertEqual(target.read_bytes(), original)

    def test_repeated_build_preserves_source_directory_above_dossier_budget(self):
        docs = copy.deepcopy(dossiers()[:2])
        for doc in docs:
            doc['sources'][0]['access'] += ' Repeated-build source-directory fixture.' * 2500
            self.assertLessEqual(len(json_bytes(doc)), 200_000)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_json(root / 'web/catalogue/index.json', {'records': [], 'coverage': {'current_source_records': 0}})
            with patch('atlas.archive.dossiers', return_value=docs):
                self.assertEqual(build(root), {'dossiers': 2, 'records': 0})
                index_path = root / 'web/archive/index.json'
                initial_index = index_path.read_bytes()
                index = json.loads(initial_index)
                directory_path = root / 'web' / index['source_directory']['file']
                original = directory_path.read_bytes()
                self.assertGreater(len(original), 200_000)
                self.assertLessEqual(len(original), 256_000)
                self.assertEqual(build(root), {'dossiers': 2, 'records': 0})
                self.assertEqual(directory_path.read_bytes(), original)
                self.assertEqual(index_path.read_bytes(), initial_index)
                self.assertEqual(json.loads(original)['schema_version'], 1)

    def test_conflicting_full_identities_with_a_controlled_prefix_are_rejected(self):
        doc = copy.deepcopy(dossiers()[0])
        old = copy.deepcopy(doc)
        old['summary'] = 'Controlled older collision fixture.'
        prefix = '0123456789abcdef0123'
        def controlled(value):
            if isinstance(value, dict) and value.get('id') == doc['id']:
                return prefix + ('a' if value['summary'] == old['summary'] else 'b') * 44
            return digest(value)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_json(root / 'web/archive' / f"{doc['id']}-{prefix}.json", old)
            with patch('atlas.archive.digest', side_effect=controlled):
                with self.assertRaisesRegex(ValueError, 'truncated path'):
                    dossier_history(doc, root)

    def test_persisted_current_tuple_and_byte_mismatch_fail_before_index_publication(self):
        doc = copy.deepcopy(dossiers()[0])
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            logical = digest(doc)
            relative = f"archive/{doc['id']}-{logical[:20]}.json"
            original = write_json(root / 'web' / relative, doc)
            history = dossier_history(doc, root)
            current = history['versions'][0]
            history_file = f"archive/{doc['id']}-history-{digest(history)[:20]}.json"
            write_json(root / 'web' / history_file, history)
            event = {'id': doc['id'], 'history_file': history_file,
                     **{key: current[key] for key in ('file', 'dossier_sha256', 'file_sha256')}}
            index = {'events': [event], 'coverage': {'current_source_records': 1}}
            verify_dossier_files(index, root)
            event['file_sha256'] = '0' * 64
            with self.assertRaisesRegex(ValueError, 'references do not agree'):
                verify_dossier_files(index, root)
            event['file_sha256'] = current['file_sha256']
            path = root / 'web' / relative
            # Whitespace keeps logical identity but breaks the published byte association.
            path.write_bytes(b' ' + original)
            with self.assertRaisesRegex(ValueError, 'Persisted dossier bytes'):
                verify_dossier_files(index, root)
            previous = b'{"previous":"retained index"}\n'
            (root / 'web/archive/index.json').write_bytes(previous)
            artifacts = {relative: doc, history_file: history, 'archive/index.json': index}
            with patch('atlas.archive.publication', return_value=artifacts):
                with self.assertRaisesRegex(ValueError, 'Persisted dossier bytes'):
                    build(root)
            self.assertEqual((root / 'web/archive/index.json').read_bytes(), previous)

    def test_invalid_retained_utf8_oversize_and_directory_are_rejected(self):
        doc = dossiers()[0]
        for kind in ['invalid_utf8', 'oversize', 'directory']:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                path = root / 'web/archive' / f"{doc['id']}-{digest(doc)[:20]}.json"
                path.parent.mkdir(parents=True)
                if kind == 'directory':
                    path.mkdir()
                else:
                    path.write_bytes(b'\xff' if kind == 'invalid_utf8' else b' ' * 200_001)
                with self.assertRaises((ValueError, UnicodeDecodeError)):
                    dossier_history(doc, root)
