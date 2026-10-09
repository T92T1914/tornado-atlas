"""Publication integration, distinct from historical source qualification."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from atlas.event_package import build_event_packages, publication_artifacts, replay_inputs, write_packages

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = json.loads((ROOT / 'tests/fixtures/package-synthetic.json').read_text(encoding='utf-8'))


def two_replay_root(root):
    index = json.loads((ROOT / 'exhibits/events.json').read_text(encoding='utf-8'))
    index['events'] = [index['events'][0], FIXTURE['entry']]
    (root / 'exhibits').mkdir()
    (root / 'exhibits/events.json').write_text(json.dumps(index), encoding='utf-8')
    (root / 'web').mkdir()
    for name in ('index.html', 'fixture.html'):
        (root / 'web' / name).write_text('Synthetic publication root', encoding='utf-8')
    for event_id, config in (
        ('el-reno-2013', json.loads((ROOT / 'exhibits/el-reno-2013/replay.json').read_text())),
        ('synthetic-package', FIXTURE['config']),
    ):
        folder = root / 'exhibits' / event_id
        folder.mkdir()
        (folder / 'replay.json').write_text(json.dumps(config), encoding='utf-8')
    return {
        'el-reno-2013': ('data.json', (ROOT / 'web/data.json').read_bytes()),
        'synthetic-package': ('fixture/observations.json', (json.dumps(FIXTURE['bundle']) + '\n').encode('utf-8')),
    }


class EventPublicationTests(unittest.TestCase):
    def test_current_publication_is_byte_identical(self):
        artifacts = build_event_packages(ROOT, replay_inputs(ROOT))
        with tempfile.TemporaryDirectory() as folder:
            for name in artifacts:
                target = Path(folder) / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / 'web' / name).read_bytes())
            write_packages(Path(folder), artifacts)
            for name in artifacts:
                self.assertEqual((Path(folder) / name).read_bytes(), (ROOT / 'web' / name).read_bytes(), name)

    def test_independent_replays_bind_their_own_bytes_and_provenance(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            inputs = two_replay_root(root)
            result = build_event_packages(root, inputs)
            for event_id, (name, raw) in inputs.items():
                manifest = result[f'events/{event_id}.json']
                self.assertEqual(manifest['bundle_sha256'], hashlib.sha256(raw).hexdigest())
                self.assertEqual(result[name], raw)
                self.assertEqual(manifest['event_id'], event_id)
            self.assertNotEqual(result['events/el-reno-2013.json']['clock'], result['events/synthetic-package.json']['clock'])
            self.assertNotEqual(result['events/el-reno-2013.json']['geography_source'], result['events/synthetic-package.json']['geography_source'])

    def test_chronology_has_no_replay_input_and_does_not_replace_the_index(self):
        result = build_event_packages(ROOT, {}, event_ids=['joplin-2011'])
        self.assertEqual(set(result), {'events/joplin-2011-chronology.json'})
        self.assertEqual(result['events/joplin-2011-chronology.json']['event_id'], 'joplin-2011')
        self.assertEqual(replay_inputs(ROOT, ['joplin-2011']), {})
        self.assertEqual(build_event_packages(ROOT, {}, event_ids=['blackwell-1955']), {})

    def test_documentary_cli_uses_independent_publication(self):
        with tempfile.TemporaryDirectory() as folder:
            completed = subprocess.run([sys.executable, '-m', 'atlas.event_package', '--event', 'joplin-2011', '--output', folder], cwd=ROOT, capture_output=True, text=True, timeout=20)
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(json.loads(completed.stdout)['published'], ['events/joplin-2011-chronology.json'])
            self.assertEqual((Path(folder) / 'events/joplin-2011-chronology.json').read_bytes(), (ROOT / 'web/events/joplin-2011-chronology.json').read_bytes())
            self.assertFalse((Path(folder) / 'events.json').exists())

    def test_missing_foreign_and_mixed_event_inputs_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            inputs = two_replay_root(root)
            for bad in ({}, {'el-reno-2013': inputs['el-reno-2013']}, {**inputs, 'unknown': inputs['synthetic-package']}):
                with self.assertRaisesRegex(ValueError, 'exactly match'):
                    build_event_packages(root, bad)
            wrong = copy.deepcopy(inputs)
            wrong['synthetic-package'] = ('fixture/observations.json', inputs['el-reno-2013'][1])
            with self.assertRaisesRegex(ValueError, 'identities differ'):
                build_event_packages(root, wrong)
            for selection in ([], ['joplin-2011', 'joplin-2011'], ['unknown']):
                with self.assertRaises(ValueError):
                    build_event_packages(ROOT, {}, event_ids=selection)

    def test_collisions_are_rejected_even_in_partial_publication(self):
        for name in ('data.json', 'events.json', 'events/el-reno-2013.json'):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                inputs = two_replay_root(root)
                config = copy.deepcopy(FIXTURE['config'])
                config['bundle'] = name
                (root / 'exhibits/synthetic-package/replay.json').write_text(json.dumps(config))
                inputs['synthetic-package'] = (name, inputs['synthetic-package'][1])
                with self.assertRaisesRegex(ValueError, 'collides'):
                    build_event_packages(root, inputs)
                with self.assertRaisesRegex(ValueError, 'collides'):
                    build_event_packages(root, {'el-reno-2013': inputs['el-reno-2013']}, event_ids=['el-reno-2013'])

    def test_converter_can_supply_new_bytes_before_destination_exists(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            inputs = two_replay_root(root)
            write_packages(root / 'web', {'fixture/observations.json': inputs['synthetic-package'][1]})
            self.assertFalse((root / 'web/data.json').exists())
            result = publication_artifacts(root, inputs['el-reno-2013'][1])
            self.assertEqual(result['events/el-reno-2013.json']['bundle_sha256'], hashlib.sha256(inputs['el-reno-2013'][1]).hexdigest())

    def test_source_change_fails_before_output(self):
        inputs = replay_inputs(ROOT)
        data = json.loads(inputs['el-reno-2013'][1])
        data['geometry']['source']['sha256'] = '0' * 64
        inputs['el-reno-2013'] = ('data.json', json.dumps(data).encode('utf-8'))
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, 'source differs'):
                write_packages(Path(folder), build_event_packages(ROOT, inputs))
            self.assertEqual(list(Path(folder).iterdir()), [])

    def test_matching_foreign_config_and_bundle_cannot_change_the_index_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            inputs = two_replay_root(root)
            config = copy.deepcopy(FIXTURE['config'])
            config['event_id'] = 'foreign-event'
            data = copy.deepcopy(FIXTURE['bundle'])
            data['exhibit']['id'] = 'foreign-event'
            data['timeline_media']['event'] = data['footage']['event'] = 'foreign-event'
            (root / 'exhibits/synthetic-package/replay.json').write_text(json.dumps(config))
            inputs['synthetic-package'] = (config['bundle'], json.dumps(data).encode('utf-8'))
            with self.assertRaisesRegex(ValueError, 'reviewed event identity'):
                build_event_packages(root, inputs)
