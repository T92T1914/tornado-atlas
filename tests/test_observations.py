import copy
import unittest

from atlas.observations import validate_notebook


class NotebookIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.queue = [{'id':'video', 'event_id':'event'}]
        self.row = {'id':'sample', 'video':'video', 'start_seconds':12.5, 'end_seconds':12.5,
                    'kind':'visual_sample', 'historical_utc':None, 'camera_position':None}
        self.book = {'event_id':'event', 'coverage':{'video':{'duration_seconds':30,
                     'visual_samples_seconds':[12.5]}}, 'observations':[self.row]}

    def test_unregistered_sample_is_accepted_without_inventing_a_position(self):
        original = copy.deepcopy(self.book)
        validate_notebook(self.book,self.queue,'event')
        self.assertEqual(self.book,original)

    def test_video_from_another_event_is_rejected(self):
        self.queue[0]['event_id'] = 'other'
        with self.assertRaises(ValueError):
            validate_notebook(self.book,self.queue,'event')

    def test_still_cannot_turn_into_continuous_inspection(self):
        self.row['end_seconds'] = 20
        with self.assertRaises(ValueError):
            validate_notebook(self.book,self.queue,'event')

    def test_unobserved_time_and_out_of_range_time_are_rejected(self):
        for value in [13,30,float('nan'),True]:
            with self.subTest(value=value):
                self.row['start_seconds'] = self.row['end_seconds'] = value
                with self.assertRaises(ValueError):
                    validate_notebook(self.book,self.queue,'event')

    def test_registration_cannot_be_added_without_an_evidence_schema(self):
        self.row['historical_utc'] = '2013-05-31T23:10:00Z'
        with self.assertRaises(ValueError):
            validate_notebook(self.book,self.queue,'event')

    def test_duplicate_identifier_is_rejected(self):
        self.book['observations'].append(copy.deepcopy(self.row))
        with self.assertRaises(ValueError):
            validate_notebook(self.book,self.queue,'event')
