import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from atlas.event_package import publication_artifacts, validate_index, validate_replay, write_packages

ROOT = Path(__file__).resolve().parents[1]


class EventPackageTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((ROOT / 'exhibits/el-reno-2013/replay.json').read_text())
        self.bundle = json.loads((ROOT / 'web/data.json').read_text(encoding='utf-8'))
        self.index = json.loads((ROOT / 'exhibits/events.json').read_text(encoding='utf-8'))

    def test_package_preserves_source_and_binds_exact_bytes(self):
        raw = (ROOT / 'web/data.json').read_bytes()
        result = publication_artifacts(ROOT, raw)
        self.assertEqual(result['events/el-reno-2013.json']['bundle_sha256'], hashlib.sha256(raw).hexdigest())
        self.assertEqual(result['events/el-reno-2013.json']['geography_source'], self.config['geography_source'])
        with tempfile.TemporaryDirectory() as folder:
            write_packages(Path(folder), result)
            first = (Path(folder) / 'events/el-reno-2013.json').read_bytes()
            write_packages(Path(folder), result)
            self.assertEqual(first, (Path(folder) / 'events/el-reno-2013.json').read_bytes())
            self.assertNotIn(b'\r', first)

    def test_future_synthetic_event_uses_same_validator(self):
        self.config['event_id'] = 'synthetic-fixture'
        self.config['clock']['time_zone'] = 'UTC'
        self.bundle['exhibit']['id'] = 'synthetic-fixture'
        for field in ('timeline_media', 'footage', 'cameras'):
            self.bundle[field]['event'] = 'synthetic-fixture'
        validate_replay(self.config, self.bundle)

    def test_no_replay_is_a_valid_readiness_state(self):
        validate_index(self.index)
        self.assertIsNone(self.index['events'][1]['replay'])

    def test_clock_bounds_accept_both_browser_supported_utc_suffixes(self):
        for suffix in ('Z', '+00:00'):
            with self.subTest(suffix=suffix):
                config = copy.deepcopy(self.config)
                for bound in ('start_utc', 'end_utc'):
                    config['clock'][bound] = config['clock'][bound].replace('+00:00', suffix)
                validate_replay(config, self.bundle)

    def test_clock_bounds_reject_formats_the_browser_cannot_load(self):
        for value in ('20130531T230400Z', '2013-05-31 23:04:00+00:00',
                      '2013-05-31T23:04+00:00', '2013-05-31T23:04:00+0000',
                      '2013-05-31T23:04:00-00:00'):
            with self.subTest(value=value):
                config = copy.deepcopy(self.config)
                config['clock']['start_utc'] = value
                with self.assertRaises(ValueError):
                    validate_replay(config, self.bundle)

    def test_mixed_event_evidence_is_rejected(self):
        for field in ('exhibit', 'timeline_media', 'footage', 'cameras'):
            bundle = copy.deepcopy(self.bundle)
            bundle[field]['id' if field == 'exhibit' else 'event'] = 'another-event'
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_replay(self.config, bundle)

    def test_normalized_position_and_anchor_times_must_be_browser_readable(self):
        cases = (
            ('position', '20130531T230500Z'),
            ('position', '2013-W22-5T23:05:00Z'),
            ('anchor', '20130531T231703Z'),
            ('anchor', '2013-W22-5T23:17:03Z'),
            ('anchor', '2013-05-31T23:17:03.125Z'),
        )
        for kind, value in cases:
            with self.subTest(kind=kind, value=value):
                bundle = copy.deepcopy(self.bundle)
                if kind == 'position':
                    target = [feature['properties'] for feature in bundle['geometry']['features']
                              if feature['geometry']['type'] == 'Point'][1]
                else:
                    target = bundle['footage']['anchors'][0]
                target['utc'] = value
                with self.assertRaises(ValueError):
                    publication_artifacts(ROOT, json.dumps(bundle).encode('utf-8'))

    def test_normalized_evidence_keeps_second_precision_and_both_utc_suffixes(self):
        for suffix in ('Z', '+00:00'):
            with self.subTest(suffix=suffix):
                bundle = copy.deepcopy(self.bundle)
                for feature in bundle['geometry']['features']:
                    if feature['geometry']['type'] == 'Point':
                        feature['properties']['utc'] = feature['properties']['utc'].replace('+00:00', suffix)
                for anchor in bundle['footage']['anchors']:
                    anchor['utc'] = anchor['utc'].replace('Z', suffix)
                validate_replay(self.config, bundle)
                self.assertIn('23:17:03', bundle['footage']['anchors'][0]['utc'])

    def test_unsupported_precision_appearance_and_source_are_rejected(self):
        mutations = [
            ('schema_version', None, 2),
            ('coverage', 'appearance', 'historical_reconstruction'),
            ('clock', 'precision', 'second'),
            ('clock', 'end_utc', '2013-05-31T23:41:00+00:00'),
            ('clock', 'start_utc', '2013-05-31T18:04:00-05:00'),
            ('clock', 'time_zone', '../../local'),
            ('geography_source', 'sha256', '0' * 64),
            ('bundle', None, '../private.json'),
        ]
        for field, key, value in mutations:
            config = copy.deepcopy(self.config)
            if key is None:
                config[field] = value
            else:
                config[field][key] = value
            with self.subTest(field=field, key=key), self.assertRaises(ValueError):
                validate_replay(config, self.bundle)

    def test_unrendered_geometry_is_not_silently_discarded(self):
        for case in ('hole', 'unclosed', 'nonfinite', 'source', 'duplicate-time'):
            bundle = copy.deepcopy(self.bundle)
            features = bundle['geometry']['features']
            polygon = next(f for f in features if f['geometry']['type'] == 'Polygon')
            points = [f for f in features if f['geometry']['type'] == 'Point']
            if case == 'hole':
                polygon['geometry']['coordinates'].append(copy.deepcopy(polygon['geometry']['coordinates'][0]))
            elif case == 'unclosed':
                polygon['geometry']['coordinates'][0].pop()
            elif case == 'nonfinite':
                points[0]['geometry']['coordinates'][0] = float('nan')
            elif case == 'source':
                points[0]['properties']['source_sha256'] = '0' * 64
            else:
                points[1]['properties']['utc'] = points[0]['properties']['utc']
            with self.subTest(case=case), self.assertRaises(ValueError):
                validate_replay(self.config, bundle)

    def test_index_rejects_duplicates_traversal_and_missing_default(self):
        for case in ('duplicate', 'path', 'default', 'version'):
            index = copy.deepcopy(self.index)
            if case == 'duplicate':
                index['events'].append(copy.deepcopy(index['events'][0]))
            elif case == 'path':
                index['events'][0]['documentary'] = '../private.html'
            elif case == 'default':
                index['default_event'] = 'unknown'
            else:
                index['schema_version'] = True
            with self.subTest(case=case), self.assertRaises(ValueError):
                validate_index(index)

    def test_wrong_destination_requires_explicit_package_change(self):
        with self.assertRaisesRegex(ValueError, 'destination'):
            publication_artifacts(ROOT, (ROOT / 'web/data.json').read_bytes(), 'different.json')


if __name__ == '__main__':
    unittest.main()
