import copy
import json
import unittest
from pathlib import Path

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


class PhotographNotebookTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1]
        self.book = json.loads((root / 'exhibits/el-reno-2013/observations.json').read_text(encoding='utf-8'))
        self.queue = json.loads((root / 'research/video-review-queue.json').read_text(encoding='utf-8'))
        self.photo = self.book['photographs'][0]

    def check(self):
        validate_notebook(self.book, self.queue, 'el-reno-2013')

    def test_inspected_photographs_preserve_explicit_unknowns(self):
        original = copy.deepcopy(self.book)
        self.check()
        self.assertEqual(self.book, original)
        self.assertEqual(len(self.book['photographs']), 2)
        for photo in self.book['photographs']:
            self.assertIsNone(photo['historical_utc'])
            self.assertIsNone(photo['camera_position'])

    def test_optional_photographs_do_not_require_migrating_video_notebooks(self):
        del self.book['photographs']
        self.check()

    def test_duplicate_ids_within_and_across_media_are_rejected(self):
        for duplicate in (self.book['photographs'][1]['id'], self.book['observations'][0]['id']):
            with self.subTest(identifier=duplicate):
                self.photo['id'] = duplicate
                with self.assertRaisesRegex(ValueError, 'Duplicate'):
                    self.check()

    def test_exact_placement_cannot_be_added_or_implicitly_omitted(self):
        for field, value in (('historical_utc', '2013-05-31T23:04:00Z'),
                             ('camera_position', [-98., 35.])):
            for mutation in ('registered', 'omitted'):
                with self.subTest(field=field, mutation=mutation):
                    original = copy.deepcopy(self.photo)
                    if mutation == 'registered':
                        self.photo[field] = value
                    else:
                        del self.photo[field]
                    with self.assertRaises(ValueError):
                        self.check()
                    self.photo.clear()
                    self.photo.update(original)

    def test_required_provenance_review_and_rights_cannot_disappear(self):
        for group in ('source', 'review', 'rights', 'processing', 'place', 'source_time'):
            for field in tuple(self.photo[group]):
                for value in (None, ''):
                    with self.subTest(group=group, field=field, value=value):
                        original = self.photo[group].pop(field)
                        if value is not None:
                            self.photo[group][field] = value
                        with self.assertRaises(ValueError):
                            self.check()
                        self.photo[group][field] = original

    def test_unsafe_original_and_account_links_are_rejected(self):
        for field in ('url', 'original_url'):
            original = self.photo['source'][field]
            for url in ('http://example.test/photo.jpg', 'javascript:alert(1)',
                        'https://user:password@example.test/photo.jpg',
                        'https:///missing-host', 'https://example.test/\nphoto.jpg',
                        'https://example.test\\@other.test/photo.jpg'):
                with self.subTest(field=field, url=url):
                    self.photo['source'][field] = url
                    with self.assertRaises(ValueError):
                        self.check()
            self.photo['source'][field] = original

    def test_unreviewed_sources_and_unsupported_rights_are_rejected(self):
        for group, field, value in (
                ('source', 'access', 'located'), ('review', 'status', 'caption_only'),
                ('rights', 'usage', 'redistribute'), ('processing', 'status', 'raw'),
                ('place', 'basis', 'surveyed'), ('source_time', 'calibration', 'verified'),
                ('source_time', 'accuracy', '+/- 30 seconds'),
                ('source_time', 'precision', 'second'), ('source_time', 'label', '6:04:15 PM')):
            with self.subTest(group=group, field=field):
                original = self.photo[group][field]
                self.photo[group][field] = value
                with self.assertRaises(ValueError):
                    self.check()
                self.photo[group][field] = original

    def test_unsupported_geometry_media_and_clock_fields_are_not_silently_ignored(self):
        for target, field, value in (
                (self.photo, 'asset', 'copied.jpg'), (self.photo['place'], 'coordinates', [-98., 35.]),
                (self.photo['source_time'], 'utc', '2013-05-31T23:04:00Z'),
                (self.photo, 'azimuth', 270)):
            with self.subTest(field=field):
                target[field] = value
                with self.assertRaises(ValueError):
                    self.check()
                del target[field]

    def test_malformed_collections_records_and_dates_fail_with_validation_error(self):
        for value in (None, {}, 'photo', [None]):
            with self.subTest(value=value):
                original = self.book['photographs']
                self.book['photographs'] = value
                with self.assertRaises(ValueError):
                    self.check()
                self.book['photographs'] = original
        for group, field in (('source', 'accessed_on'), ('review', 'reviewed_on')):
            original = self.photo[group][field]
            self.photo[group][field] = 'not-a-date'
            with self.assertRaises(ValueError):
                self.check()
            self.photo[group][field] = original
