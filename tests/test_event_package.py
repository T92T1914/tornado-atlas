import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from atlas.event_package import publication_artifacts, validate_index, validate_replay, write_packages

ROOT = Path(__file__).resolve().parents[1]


def appearance_fixture(config, bundle, *, registered=False):
    """Authored admission fixtures. None of these records qualifies El Reno."""
    config, bundle = copy.deepcopy(config), copy.deepcopy(bundle)
    config['schema_version'] = 2
    config['event_id'] = 'synthetic-appearance'
    config['coverage']['appearance'] = 'bounded_timeline'
    bundle['exhibit']['id'] = config['event_id']
    for field in ('timeline_media', 'footage', 'cameras'):
        bundle[field]['event'] = config['event_id']
    source = {
        'id': 'synthetic-camera', 'video_id': 'abcdefghijk',
        'url': 'https://www.youtube.com/watch?v=abcdefghijk',
        'creator': 'Synthetic fixture creator', 'duration_seconds': 60,
    }
    bundle['footage']['sources'] = [source]
    bundle['footage']['anchors'] = []
    early = {
        'id': 'early', 'start_utc': '2013-05-31T23:05:00Z',
        'end_utc': '2013-05-31T23:05:10Z', 'source_id': None,
        'kind': 'illustrative', 'basis': 'Authored software fixture, not a historical observation.',
        'registration': None,
        'keys': [{'at': 0, 'shape': 'cone', 'extent': .4, 'label': 'Authored short cone'},
                 {'at': 1, 'shape': 'cone', 'extent': 1, 'label': 'Authored extended cone'}],
    }
    late = {**copy.deepcopy(early), 'id': 'late',
            'start_utc': '2013-05-31T23:05:22Z', 'end_utc': '2013-05-31T23:05:30Z'}
    late['keys'][0]['shape'] = 'wedge'
    late['keys'][1]['shape'] = 'rope'
    if registered:
        early['source_id'] = source['id']
        early['kind'] = 'registered'
        early['registration'] = {
            'source': {'url': source['url'], 'video_id': source['video_id'],
                       'original_locator': source['url'], 'edit_identity': 'Synthetic original edit A',
                       'sha256': None, 'identity_basis': 'Authored identity fixture, no acquired media.'},
            'inspection': {'status': 'continuous_video_inspected', 'start_video_seconds': 10,
                           'end_video_seconds': 20, 'reviewed_on': '2026-10-07',
                           'discontinuities': 'none_observed',
                           'basis': 'Synthetic continuous inspection declaration for software tests.'},
            'timing': {'method': 'linear_verified', 'uncertainty_seconds': .5,
                       'basis': 'Synthetic time alignment, not a measured source clock.',
                       'anchors': [{'video_seconds': 10, 'utc': early['start_utc']},
                                   {'video_seconds': 15, 'utc': '2013-05-31T23:05:05Z'},
                                   {'video_seconds': 20, 'utc': early['end_utc']}]},
            'camera': {'mode': 'fixed_view', 'coordinates': [0, 0], 'bearing_degrees': 90,
                       'pitch_degrees': 0, 'roll_degrees': 0, 'position_uncertainty_m': 10,
                       'orientation_uncertainty_degrees': 2, 'lens_calibration': 'Synthetic calibration',
                       'basis': 'Authored camera at zero coordinates for software admission only.'},
            'rights': {'reuse': 'external_links_only', 'creator': source['creator'],
                       'uploader': 'Synthetic fixture uploader', 'rights_holder': 'Synthetic fixture owner',
                       'basis': 'Synthetic source links only, no video, frames or transcript hosted.'},
            'uncertainty': 'Every observation and calibration in this registration is synthetic.',
        }
    bundle['appearance_timeline'] = {'schema_version': 1, 'event': config['event_id'],
                                     'windows': [early, late]}
    return config, bundle


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
        self.config['schema_version'] = 1
        self.config['coverage']['appearance'] = 'illustrative_symbol'
        self.bundle.pop('appearance_timeline', None)
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
            ('schema_version', None, 3),
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

    def test_version_one_remains_unchanged_and_refuses_silent_appearance_fields(self):
        self.config['schema_version'] = 1
        self.config['coverage']['appearance'] = 'illustrative_symbol'
        self.bundle.pop('appearance_timeline', None)
        before = copy.deepcopy((self.config, self.bundle))
        validate_replay(self.config, self.bundle)
        self.assertEqual((self.config, self.bundle), before)
        for appearance in (None, {}, {'schema_version': 1, 'event': 'el-reno-2013', 'windows': []}):
            bundle = copy.deepcopy(self.bundle)
            bundle['appearance_timeline'] = appearance
            with self.subTest(appearance=appearance), self.assertRaisesRegex(ValueError, 'schema version 2'):
                validate_replay(self.config, bundle)
        for field in ('appearance_timeline', 'historical_registration'):
            config = copy.deepcopy(self.config)
            config[field] = None
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'fields'):
                validate_replay(config, self.bundle)

    def test_version_two_admits_authored_windows_with_an_explicit_gap_and_no_mutation(self):
        config, bundle = appearance_fixture(self.config, self.bundle)
        before = copy.deepcopy((config, bundle))
        validate_replay(config, bundle)
        self.assertEqual((config, bundle), before)
        windows = bundle['appearance_timeline']['windows']
        self.assertEqual(windows[0]['end_utc'], '2013-05-31T23:05:10Z')
        self.assertEqual(windows[1]['start_utc'], '2013-05-31T23:05:22Z')
        bundle['appearance_timeline']['windows'] = []
        validate_replay(config, bundle)

    def test_version_two_requires_its_own_coverage_timeline_and_identity(self):
        for case in ('missing', 'null', 'identity', 'schema', 'boolean-schema', 'coverage', 'extra-field'):
            config, bundle = appearance_fixture(self.config, self.bundle)
            if case == 'missing':
                del bundle['appearance_timeline']
            elif case == 'null':
                bundle['appearance_timeline'] = None
            elif case == 'identity':
                bundle['appearance_timeline']['event'] = 'another-event'
            elif case in ('schema', 'boolean-schema'):
                bundle['appearance_timeline']['schema_version'] = 2 if case == 'schema' else True
            elif case == 'coverage':
                config['coverage']['appearance'] = 'illustrative_symbol'
            else:
                bundle['appearance_timeline']['historical_width_m'] = 4200
            with self.subTest(case=case), self.assertRaises(ValueError):
                validate_replay(config, bundle)

    def test_appearance_windows_reject_overlap_ambiguous_boundaries_and_unsupported_geometry(self):
        for case in ('overlap', 'equal-boundary', 'order', 'duplicate-id', 'outside', 'fractional-utc',
                     'width', 'source', 'registration', 'kind', 'blank-basis', 'too-many'):
            config, bundle = appearance_fixture(self.config, self.bundle)
            windows = bundle['appearance_timeline']['windows']
            if case == 'overlap':
                windows[1]['start_utc'] = '2013-05-31T23:05:09Z'
            elif case == 'equal-boundary':
                windows[1]['start_utc'] = windows[0]['end_utc']
            elif case == 'order':
                windows.reverse()
            elif case == 'duplicate-id':
                windows[1]['id'] = windows[0]['id']
            elif case == 'outside':
                windows[1]['end_utc'] = '2013-05-31T23:43:00Z'
            elif case == 'fractional-utc':
                windows[0]['start_utc'] = '2013-05-31T23:05:00.1Z'
            elif case == 'width':
                windows[0]['width_m'] = 4200
            elif case == 'source':
                windows[0]['source_id'] = 'synthetic-camera'
            elif case == 'registration':
                windows[0]['registration'] = {}
            elif case == 'kind':
                windows[0]['kind'] = 'observed'
            elif case == 'blank-basis':
                windows[0]['basis'] = ' '
            else:
                bundle['appearance_timeline']['windows'] *= 9
            with self.subTest(case=case), self.assertRaises(ValueError):
                validate_replay(config, bundle)

    def test_appearance_keys_reject_missing_endpoints_and_invalid_normalized_parameters(self):
        for case in ('one-key', 'too-many', 'missing-start', 'missing-end', 'unordered', 'duplicate',
                     'shape', 'nontext-shape', 'extent', 'nan', 'boolean', 'overflow', 'label', 'historical-radius'):
            config, bundle = appearance_fixture(self.config, self.bundle)
            keys = bundle['appearance_timeline']['windows'][0]['keys']
            if case == 'one-key':
                keys.pop()
            elif case == 'too-many':
                keys *= 33
            elif case == 'missing-start':
                keys[0]['at'] = .1
            elif case == 'missing-end':
                keys[-1]['at'] = .9
            elif case == 'unordered':
                keys.reverse()
            elif case == 'duplicate':
                keys.insert(1, copy.deepcopy(keys[0]))
            elif case == 'shape':
                keys[0]['shape'] = 'EF5'
            elif case == 'nontext-shape':
                keys[0]['shape'] = []
            elif case == 'extent':
                keys[0]['extent'] = 1.1
            elif case == 'nan':
                keys[0]['extent'] = float('nan')
            elif case == 'boolean':
                keys[0]['at'] = False
            elif case == 'overflow':
                keys[0]['extent'] = 10 ** 400
            elif case == 'label':
                keys[0]['label'] = ''
            else:
                keys[0]['radius_m'] = 2100
            with self.subTest(case=case), self.assertRaises(ValueError):
                validate_replay(config, bundle)

    def test_synthetic_registered_window_accepts_explicit_identity_with_optional_media_hash(self):
        config, bundle = appearance_fixture(self.config, self.bundle, registered=True)
        before = copy.deepcopy((config, bundle))
        validate_replay(config, bundle)
        self.assertEqual((config, bundle), before)
        bundle['appearance_timeline']['windows'][0]['registration']['source']['sha256'] = 'a' * 64
        validate_replay(config, bundle)
        for suffix in ('Z', '+00:00'):
            candidate = copy.deepcopy(bundle)
            for window in candidate['appearance_timeline']['windows']:
                for bound in ('start_utc', 'end_utc'):
                    window[bound] = window[bound].replace('Z', suffix)
                if window['registration']:
                    for anchor in window['registration']['timing']['anchors']:
                        anchor['utc'] = anchor['utc'].replace('Z', suffix)
            validate_replay(config, candidate)

    def test_registered_appearance_rejects_uninspected_frames_and_mismatched_source_edits(self):
        for case in ('no-registration', 'no-source', 'wrong-source', 'wrong-video', 'wrong-url',
                     'empty-edit', 'empty-identity-basis', 'missing-original', 'unsafe-original',
                     'bad-hash', 'paused-samples', 'cut', 'impossible-date', 'date-format', 'inspection-gap',
                     'outside-source', 'empty-inspection-basis', 'extra-pose-claim'):
            config, bundle = appearance_fixture(self.config, self.bundle, registered=True)
            window = bundle['appearance_timeline']['windows'][0]
            registration = window['registration']
            if case == 'no-registration':
                window['registration'] = None
            elif case == 'no-source':
                window['source_id'] = None
            elif case == 'wrong-source':
                window['source_id'] = 'marshall-camera'
            elif case in ('wrong-video', 'wrong-url', 'empty-edit', 'empty-identity-basis', 'missing-original', 'unsafe-original', 'bad-hash'):
                field, value = {
                    'wrong-video': ('video_id', 'MxgU1QcFMJM'),
                    'wrong-url': ('url', 'https://www.youtube.com/watch?v=MxgU1QcFMJM'),
                    'empty-edit': ('edit_identity', ''), 'empty-identity-basis': ('identity_basis', ''),
                    'missing-original': ('original_locator', None),
                    'unsafe-original': ('original_locator', 'https://user:password@example.test/video'),
                    'bad-hash': ('sha256', 'not-a-media-hash'),
                }[case]
                registration['source'][field] = value
            elif case == 'paused-samples':
                registration['inspection']['status'] = 'paused_samples_inspected'
            elif case == 'cut':
                registration['inspection']['discontinuities'] = 'observed_edit_cut'
            elif case in ('impossible-date', 'date-format'):
                registration['inspection']['reviewed_on'] = '2026-02-30' if case == 'impossible-date' else '20261007'
            elif case == 'inspection-gap':
                registration['inspection']['end_video_seconds'] = 19
            elif case == 'outside-source':
                registration['inspection']['end_video_seconds'] = 61
            elif case == 'empty-inspection-basis':
                registration['inspection']['basis'] = ''
            else:
                registration['camera_pose_at_every_frame'] = True
            with self.subTest(case=case), self.assertRaises(ValueError):
                validate_replay(config, bundle)

    def test_registered_timing_rejects_clock_disagreement_discontinuity_and_unknown_error(self):
        for case in ('two-samples', 'not-linear', 'missing-bound', 'missing-video-start', 'missing-video-end',
                     'nonmonotonic-video', 'nonmonotonic-clock',
                     'outside-inspection', 'unknown-uncertainty', 'zero-uncertainty', 'nan-uncertainty',
                     'missing-basis', 'unsupported-method'):
            config, bundle = appearance_fixture(self.config, self.bundle, registered=True)
            timing = bundle['appearance_timeline']['windows'][0]['registration']['timing']
            anchors = timing['anchors']
            if case == 'two-samples':
                anchors.pop(1)
            elif case == 'not-linear':
                anchors[1]['utc'] = '2013-05-31T23:05:08Z'
            elif case == 'missing-bound':
                anchors[-1]['utc'] = '2013-05-31T23:05:09Z'
            elif case == 'missing-video-start':
                anchors[0]['video_seconds'] = 10.1
            elif case == 'missing-video-end':
                anchors[-1]['video_seconds'] = 19.9
            elif case == 'nonmonotonic-video':
                anchors[1]['video_seconds'] = 10
            elif case == 'nonmonotonic-clock':
                anchors[1]['utc'] = anchors[0]['utc']
            elif case == 'outside-inspection':
                anchors[0]['video_seconds'] = 9
            elif case in ('unknown-uncertainty', 'zero-uncertainty', 'nan-uncertainty'):
                timing['uncertainty_seconds'] = {'unknown-uncertainty': None, 'zero-uncertainty': 0,
                                                  'nan-uncertainty': float('nan')}[case]
            elif case == 'missing-basis':
                timing['basis'] = ''
            else:
                timing['method'] = 'copied_provider_offset'
            expected = 'inspected source interval' if case in ('missing-video-start', 'missing-video-end') else ''
            with self.subTest(case=case), self.assertRaisesRegex(ValueError, expected):
                validate_replay(config, bundle)

    def test_registered_form_keys_require_their_own_inspected_source_time(self):
        config, bundle = appearance_fixture(self.config, self.bundle, registered=True)
        keys = bundle['appearance_timeline']['windows'][0]['keys']
        interior = {'at': .5, 'shape': 'cone', 'extent': .7,
                    'label': 'Synthetic middle form at the inspected five-second anchor'}
        keys.insert(1, interior)
        validate_replay(config, bundle)
        for position in (.4, .45):
            interior['at'] = position
            with self.subTest(position=position), self.assertRaisesRegex(ValueError, 'exact inspected timing anchor'):
                validate_replay(config, bundle)

    def test_registered_camera_and_rights_require_supported_pose_and_separate_provenance(self):
        for case in ('moving-camera', 'unknown-position', 'longitude', 'bearing', 'unknown-pitch',
                     'unknown-position-error', 'orientation-error', 'unknown-lens', 'no-camera-basis',
                     'wrong-creator', 'unknown-uploader', 'unknown-owner', 'no-rights-basis', 'hosting',
                     'no-uncertainty'):
            config, bundle = appearance_fixture(self.config, self.bundle, registered=True)
            registration = bundle['appearance_timeline']['windows'][0]['registration']
            camera, rights = registration['camera'], registration['rights']
            if case == 'moving-camera':
                camera['mode'] = 'sparse_moving_samples'
            elif case == 'unknown-position':
                camera['coordinates'] = None
            elif case == 'longitude':
                camera['coordinates'][0] = 181
            elif case == 'bearing':
                camera['bearing_degrees'] = 360
            elif case == 'unknown-pitch':
                camera['pitch_degrees'] = None
            elif case == 'unknown-position-error':
                camera['position_uncertainty_m'] = None
            elif case == 'orientation-error':
                camera['orientation_uncertainty_degrees'] = -1
            elif case == 'unknown-lens':
                camera['lens_calibration'] = ''
            elif case == 'no-camera-basis':
                camera['basis'] = ''
            elif case == 'wrong-creator':
                rights['creator'] = 'Another creator'
            elif case == 'unknown-uploader':
                rights['uploader'] = None
            elif case == 'unknown-owner':
                rights['rights_holder'] = None
            elif case == 'no-rights-basis':
                rights['basis'] = ''
            elif case == 'hosting':
                rights['reuse'] = 'mirrored_video'
            else:
                registration['uncertainty'] = ''
            with self.subTest(case=case), self.assertRaises(ValueError):
                validate_replay(config, bundle)

    def test_source_comparison_allows_coincident_registered_windows_in_distinct_lanes(self):
        config, bundle = appearance_fixture(self.config, self.bundle, registered=True)
        first = bundle['appearance_timeline']['windows'][0]
        alternate = copy.deepcopy(first)
        alternate['id'] = 'alternate-view'
        alternate['source_id'] = 'synthetic-camera-b'
        source = {**bundle['footage']['sources'][0], 'id': alternate['source_id'],
                  'video_id': 'zyxwvutsrqp', 'url': 'https://www.youtube.com/watch?v=zyxwvutsrqp',
                  'creator': 'Synthetic second creator'}
        bundle['footage']['sources'].append(source)
        alternate['registration']['source'].update(url=source['url'], video_id=source['video_id'],
                                                     original_locator=source['url'])
        alternate['registration']['rights']['creator'] = source['creator']
        bundle['appearance_timeline']['windows'].insert(1, alternate)
        validate_replay(config, bundle)
        # An illustrative lane can share this time without qualifying either camera.
        illustrative = copy.deepcopy(first)
        illustrative.update(id='authored-view', source_id=None, kind='illustrative', registration=None)
        bundle['appearance_timeline']['windows'].insert(2, illustrative)
        validate_replay(config, bundle)
        alternate['source_id'] = first['source_id']
        alternate['registration'] = copy.deepcopy(first['registration'])
        with self.assertRaisesRegex(ValueError, 'same source'):
            validate_replay(config, bundle)

    def test_duplicate_appearance_source_identity_is_rejected_before_registration(self):
        config, bundle = appearance_fixture(self.config, self.bundle, registered=True)
        source = copy.deepcopy(bundle['footage']['sources'][0])
        source['url'] = 'https://example.test/different-edit'
        bundle['footage']['sources'].append(source)
        with self.assertRaisesRegex(ValueError, 'duplicate appearance footage source'):
            validate_replay(config, bundle)

    def test_version_two_publication_binds_the_validated_timeline_to_exact_bundle_bytes(self):
        config, bundle = appearance_fixture(self.config, self.bundle, registered=True)
        index = {'schema_version': 1, 'default_event': config['event_id'],
                 'events': [{'id': config['event_id'], 'title': 'Synthetic appearance fixture',
                             'documentary': 'fixture.html', 'replay': 'events/synthetic-appearance.json'}]}
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            exhibit = root / 'exhibits' / config['event_id']
            exhibit.mkdir(parents=True)
            (root / 'exhibits' / 'events.json').write_text(json.dumps(index), encoding='utf-8')
            (exhibit / 'replay.json').write_text(json.dumps(config), encoding='utf-8')
            (root / 'web').mkdir()
            (root / 'web' / 'fixture.html').write_text('<p>Synthetic fixture.</p>', encoding='utf-8')
            raw = json.dumps(bundle).encode('utf-8')
            artifacts = publication_artifacts(root, raw)
            manifest = artifacts['events/synthetic-appearance.json']
            self.assertEqual(manifest['schema_version'], 2)
            self.assertEqual(manifest['bundle_sha256'], hashlib.sha256(raw).hexdigest())
            bundle['appearance_timeline']['windows'][0]['registration']['inspection']['status'] = 'paused_samples_inspected'
            with self.assertRaisesRegex(ValueError, 'continuous video inspection'):
                publication_artifacts(root, json.dumps(bundle).encode('utf-8'))


if __name__ == '__main__':
    unittest.main()
