import copy
import unittest
from atlas.footage import load_footage, validate_footage


class FootageTests(unittest.TestCase):
    def setUp(self):
        self.data = copy.deepcopy(load_footage())

    def test_preserved_register_is_valid(self):
        validate_footage(self.data)

    def test_player_rejects_unsupported_multiple_versions(self):
        self.data['sources'].append(copy.deepcopy(self.data['sources'][0]))
        with self.assertRaises(ValueError): validate_footage(self.data)

    def test_rejects_invented_continuous_coverage(self):
        self.data['anchors'][0]['end_utc'] = self.data['anchors'][1]['utc']
        with self.assertRaises(ValueError): validate_footage(self.data)

    def test_rejects_unverified_camera_coordinate(self):
        self.data['anchors'][0]['coordinates'] = [-97.9, 35.48]
        with self.assertRaises(ValueError): validate_footage(self.data)

    def test_rejects_non_utc_clock(self):
        self.data['anchors'][0]['utc'] = '2013-05-31T18:17:03'
        with self.assertRaises(ValueError): validate_footage(self.data)

    def test_rejects_wrong_video_version(self):
        self.data['sources'][0]['video_id'] = '0Wdv6zsvsI0'
        with self.assertRaises(ValueError): validate_footage(self.data)

    def test_rejects_out_of_range_seek(self):
        for value in (-1, float('nan'), float('inf'), 1000):
            self.data['anchors'][0]['video_seconds'] = value
            with self.assertRaises(ValueError): validate_footage(self.data)

    def test_rejects_duplicate_or_reversed_utc(self):
        self.data['anchors'][1]['utc'] = self.data['anchors'][0]['utc']
        with self.assertRaises(ValueError): validate_footage(self.data)
