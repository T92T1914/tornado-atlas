import copy
import unittest
from atlas.sources import ROOT
from atlas.documentary import load_documentary, validate_documentary


class DocumentaryTests(unittest.TestCase):
    def setUp(self):
        self.data = load_documentary(ROOT)

    def test_actual_archived_warning_and_comparison_hashes(self):
        self.assertEqual(len(self.data['warnings']), 7)
        self.assertEqual(self.data['warnings'][3]['issued'], '2013-05-31T23:08:00Z')

    def test_wrong_source_bytes_fail(self):
        self.data['warnings'][0]['sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            validate_documentary(self.data, ROOT)

    def test_warning_expires_before_issue_fails(self):
        self.data['warnings'][1]['expires'] = '2013-05-31T20:00:00Z'
        with self.assertRaises(ValueError):
            validate_documentary(self.data, ROOT)

    def test_unresolved_place_cannot_get_pin(self):
        self.data['unmapped_fatalities'][0]['coordinates'] = [-97.9, 35.4]
        with self.assertRaises(ValueError):
            validate_documentary(self.data, ROOT)
