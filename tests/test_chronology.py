import copy
import json
from pathlib import Path
import tempfile
import unittest

from atlas.chronology import validate_chronology
from atlas.event_package import publication_artifacts, validate_index

ROOT = Path(__file__).resolve().parents[1]


class ChronologyTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / 'exhibits/joplin-2011/chronology.json').read_text())

    def test_source_bytes_and_clock_conversion(self):
        validate_chronology(self.data, 'joplin-2011', ROOT)
        self.assertEqual(self.data['entries'][4]['utc'], '2011-05-22T22:34:00Z')
        self.assertEqual(self.data['entries'][4]['precision'], 'approximate_minute')
        self.assertEqual(self.data['entries'][0]['utc'], '2011-05-22T18:30:00Z')

    def test_rejects_unknown_time_precision_identity_and_source(self):
        mutations = [lambda d: d.update(event_id='another-event'),
                     lambda d: d['entries'][0].update(precision='exact'),
                     lambda d: d['clock'].update(time_zone=None),
                     lambda d: d['sources'][0].update(url='https://user:password@example.test/report.pdf'),
                     lambda d: d['entries'][0].update(utc=None),
                     lambda d: d['entries'][0].update(utc='2011-02-30T18:30:00Z'),
                     lambda d: d['entries'][0].update(utc='2011-05-22T18:30:01Z'),
                     lambda d: d['entries'][0].update(source_id='missing'),
                     lambda d: d['entries'][0].update(page=True),
                     lambda d: d['entries'][0].update(limits=''),
                     lambda d: d['entries'][0].update(coordinates=[0, 0]),
                     lambda d: d['sources'][0].update(archive='../private.pdf'),
                     lambda d: d['sources'][0].update(url='javascript:alert(1)'),
                     lambda d: d['entries'].reverse(),
                     lambda d: d['entries'][1].update(id=d['entries'][0]['id'])]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                data = copy.deepcopy(self.data)
                mutate(data)
                with self.assertRaises(ValueError):
                    validate_chronology(data, 'joplin-2011')

    def test_changed_source_is_not_silently_republished(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / self.data['sources'][0]['archive']
            source.parent.mkdir(parents=True)
            source.write_bytes(b'changed source')
            with self.assertRaisesRegex(ValueError, 'bytes have changed'):
                validate_chronology(self.data, 'joplin-2011', root)

    def test_generated_chronology_matches_curated_evidence(self):
        artifacts = publication_artifacts(ROOT, (ROOT / 'web/data.json').read_bytes())
        self.assertEqual(artifacts['events/joplin-2011-chronology.json'], self.data)
        self.assertIsNone(artifacts['events.json']['events'][1]['replay'])
        self.assertIsNone(artifacts['events.json']['events'][2]['chronology'])

    def test_index_versions_do_not_tolerate_unreviewed_paths(self):
        index = json.loads((ROOT / 'exhibits/events.json').read_text(encoding='utf-8'))
        index['events'][1]['chronology'] = 'events/blackwell-1955-chronology.json'
        with self.assertRaisesRegex(ValueError, 'Chronology path'):
            validate_index(index)
        index['events'][1]['chronology'] = 'events/joplin-2011-chronology.json'
        index['events'][1]['replay'] = 'events/joplin-2011.json'
        with self.assertRaisesRegex(ValueError, 'synchronization'):
            validate_index(index)
        index['schema_version'] = 1
        for event in index['events']:
            del event['chronology']
        validate_index(index)
