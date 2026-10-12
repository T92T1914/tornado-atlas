import copy
import json
import unittest
from pathlib import Path

from atlas.documentary import validate_documentary_appearance

ROOT = Path(__file__).resolve().parents[1]


class ReportedAppearanceTests(unittest.TestCase):
    def setUp(self):
        self.document = json.loads((ROOT / 'exhibits/el-reno-2013/documentary.json').read_text(encoding='utf-8'))['reported_appearance']

    def test_inspected_minute_record_remains_outside_exact_replay(self):
        original = copy.deepcopy(self.document)
        validate_documentary_appearance(self.document)
        self.assertEqual(self.document, original)
        timeline = json.loads((ROOT / 'exhibits/el-reno-2013/appearance-timeline.json').read_text(encoding='utf-8'))
        self.assertNotIn(self.document['observations'][0]['id'], json.dumps(timeline))
        self.assertIsNone(self.document['observations'][0]['reported_time']['exact_replay_seconds'])

    def test_minute_record_cannot_acquire_unqualified_reconstruction(self):
        changes = [('reported_time', 'exact_replay_seconds', 0),
                   ('reported_time', 'exposure_second', 0),
                   ('reported_time', 'clock_accuracy', 1),
                   ('viewpoint', 'azimuth_deg', 270),
                   ('viewpoint', 'lens', '21 mm'),
                   (None, 'physical_extent', 100),
                   (None, 'shape', {'base': 1}),
                   (None, 'continuous_registration', {}),
                   (None, 'hold_interval', 60)]
        for parent, key, value in changes:
            with self.subTest(parent=parent, key=key):
                document = copy.deepcopy(self.document)
                row = document['observations'][0]
                (row[parent] if parent else row)[key] = value
                with self.assertRaises(ValueError):
                    validate_documentary_appearance(document)

    def test_source_reuse_and_locator_remain_explicit(self):
        for field, value in [('source_reuse', 'host_original'), ('status', 'metadata_only')]:
            with self.subTest(field=field):
                document = copy.deepcopy(self.document)
                document['observations'][0]['inspection'][field] = value
                with self.assertRaises(ValueError):
                    validate_documentary_appearance(document)
        document = copy.deepcopy(self.document)
        document['observations'][0]['published_image']['sha256'] = None
        with self.assertRaises(ValueError):
            validate_documentary_appearance(document)
        document = copy.deepcopy(self.document)
        document['observations'][0]['original_url'] = 'https://user:secret@example.org/photo.jpg'
        with self.assertRaises(ValueError):
            validate_documentary_appearance(document)

    def test_new_display_preset_requires_reviewed_support(self):
        document = copy.deepcopy(self.document)
        document['observations'][0]['partial_form']['display_preset'] = 'complete_tornado'
        with self.assertRaises(ValueError):
            validate_documentary_appearance(document)


if __name__ == '__main__':
    unittest.main()
