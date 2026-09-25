import json
import copy
from pathlib import Path
import tempfile
import unittest

from atlas.cameras import FOLDER, load_cameras, parse_track, validate_camera_context


class CameraTests(unittest.TestCase):
    def setUp(self):
        literal = (FOLDER / 'camera-marshall-literal.txt').read_text(encoding='utf-8')
        self.sample = parse_track(literal)[5]
        self.row = {'DateTime': self.sample['utc'], 'Latitude': self.sample['coordinates'][1],
                    'Longitude': self.sample['coordinates'][0], 'AzimuthCam1': self.sample['azimuth'],
                    'AzimuthCam2': None, 'AzimuthCam3': None}

    def test_source_excerpt_and_window(self):
        data = load_cameras()
        self.assertEqual(len(data['samples']), 22)
        selected = [s for s in data['samples'] if '2013-05-31T23:04:00Z' <= s['utc'] <= '2013-05-31T23:42:00Z']
        self.assertEqual(len(selected), 17)
        self.assertEqual(selected[0], {'utc': '2013-05-31T23:09:38Z', 'coordinates': [-97.954941, 35.488103], 'azimuth': 250})
        self.assertEqual(selected[-1]['utc'], '2013-05-31T23:27:56Z')

    def test_expressions_cannot_be_executed(self):
        for literal in ('[process.exit()]', '[{"Latitude": (() => 1)()}]', '[]; alert(1)'):
            with self.subTest(literal=literal), self.assertRaises(ValueError):
                parse_track(literal)

    def test_ambiguous_times_rejected(self):
        for stamp in ('2013-05-31T23:09:38', '2013-05-31T23:09:38+01:00', '2013-06-01T23:09:38Z'):
            row = {**self.row, 'DateTime': stamp}
            with self.subTest(stamp=stamp), self.assertRaises(ValueError):
                parse_track(json.dumps([row]))

    def test_duplicate_and_reversed_times(self):
        later = {**self.row, 'DateTime': '2013-05-31T23:09:54Z'}
        for rows in ([self.row, self.row], [later, self.row]):
            with self.assertRaises(ValueError):
                parse_track(json.dumps(rows))

    def test_invalid_coordinates_and_azimuth(self):
        for field, value in [('Latitude', 100), ('Longitude', -120), ('AzimuthCam1', 361),
                             ('AzimuthCam1', -1), ('Latitude', float('inf')), ('AzimuthCam1', True)]:
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                parse_track(json.dumps([{**self.row, field: value}]))

    def test_new_camera_fields_require_review(self):
        row = {**self.row, 'AzimuthCam2': 90}
        with self.assertRaises(ValueError):
            parse_track(json.dumps([row]))

    def test_modified_excerpt_rejected(self):
        with tempfile.TemporaryDirectory() as name:
            folder = Path(name)
            for filename in ('cameras.json', 'camera-marshall-literal.txt'):
                (folder / filename).write_bytes((FOLDER / filename).read_bytes())
            with (folder / 'camera-marshall-literal.txt').open('ab') as stream:
                stream.write(b' ')
            with self.assertRaisesRegex(ValueError, 'hash'):
                load_cameras(folder)

    def test_zero_and_full_circle_are_valid_bearings(self):
        for azimuth in (0, 360):
            self.assertEqual(parse_track(json.dumps([{**self.row, 'AzimuthCam1': azimuth}]))[0]['azimuth'], azimuth)

    def test_shared_player_rejects_mixed_or_unsupported_camera_context(self):
        original = load_cameras()
        for mutate in (
            lambda data: data.update(event='joplin-2011'),
            lambda data: data.update(display_max_age_seconds=900),
            lambda data: data.update(excerpt_sha256=''),
            lambda data: data.update(source='https://user:pass@example.test/source'),
            lambda data: data.update(samples=[]),
            lambda data: data['samples'].reverse(),
            lambda data: data['samples'][0].update(utc='2013-05-31T18:00:00-05:00'),
            lambda data: data['samples'][0].update(utc='2013-02-30T23:00:00Z'),
            lambda data: data['samples'][0].update(coordinates=[0, 91]),
            lambda data: data['samples'][0].update(azimuth=True),
            lambda data: data['samples'][0].update(field_of_view=90),
        ):
            data = copy.deepcopy(original)
            mutate(data)
            with self.assertRaises(ValueError):
                validate_camera_context(data, 'el-reno-2013')
