import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from atlas.damage import validate_gallery, validate_survey_links, restore_assets
from atlas.sources import ROOT


class SurveyPhotoTests(unittest.TestCase):
    def setUp(self):
        self.gallery = json.loads((ROOT / 'exhibits/el-reno-2013/damage.json').read_text(encoding='utf-8'))

    def test_published_assets_match_reviewed_originals(self):
        validate_gallery(self.gallery, ROOT / 'web')

    def test_unverified_geolocation_and_times_cannot_be_published(self):
        for key, value in [('coordinates', [-97.9, 35.4]), ('captured_at', '2013-05-31T23:20:00Z')]:
            changed = copy.deepcopy(self.gallery)
            changed['photos'][0][key] = value
            with self.assertRaisesRegex(ValueError, 'no verified'):
                validate_gallery(changed)

    def survey_sources(self):
        # The published bundle's survey and attachments equal the compiled
        # sources. tools/check_exhibit.py asserts that equality.
        records = json.loads((ROOT / 'exhibits/el-reno-2013/survey-response.json').read_bytes())
        bundle = json.loads((ROOT / 'web/data.json').read_text(encoding='utf-8'))
        return records, bundle['survey'], bundle['survey_media']

    def test_every_photograph_links_its_matched_survey_record(self):
        records, survey, media = self.survey_sources()
        validate_survey_links(self.gallery, records, survey, media)
        self.assertEqual([p['survey_record']['object_id'] for p in self.gallery['photos']],
                         [165524, 165486, 165638, 165650, 165632, 165712, 165695, 165757, 165756])
        for photo in self.gallery['photos']:
            self.assertIsNone(photo['coordinates'])
            self.assertIsNone(photo['captured_at'])

    def test_link_to_missing_or_mismatched_record_is_rejected(self):
        records, survey, media = self.survey_sources()
        cases = [
            ('object_id', 999999999, 'missing from the retained response'),
            ('global_id', '{00000000-0000-0000-0000-000000000000}', 'global ID does not match'),
            ('attachment_id', 112129, 'not an original on that survey record'),
        ]
        for key, value, message in cases:
            with self.subTest(key=key):
                changed = copy.deepcopy(self.gallery)
                changed['photos'][0]['survey_record'][key] = value
                with self.assertRaisesRegex(ValueError, message):
                    validate_survey_links(changed, records, survey, media)

    def test_link_to_a_record_off_the_survey_map_is_rejected(self):
        records, survey, media = self.survey_sources()
        trimmed = {**survey, 'points': [p for p in survey['points'] if p['id'] != 165524]}
        with self.assertRaisesRegex(ValueError, 'not on the survey map'):
            validate_survey_links(self.gallery, records, trimmed, media)

    def test_two_photographs_cannot_share_one_record(self):
        records, survey, media = self.survey_sources()
        self.gallery['photos'][1]['survey_record'] = copy.deepcopy(self.gallery['photos'][0]['survey_record'])
        with self.assertRaisesRegex(ValueError, 'Two gallery photographs'):
            validate_survey_links(self.gallery, records, survey, media)

    def test_link_shape_requires_the_reviewed_pixel_match(self):
        for key, value in [('matched_by', 'proximity'), ('review', 'research/other.md'),
                           ('object_id', '165524'), ('global_id', '36553DD3')]:
            with self.subTest(key=key):
                changed = copy.deepcopy(self.gallery)
                changed['photos'][0]['survey_record'][key] = value
                with self.assertRaises(ValueError):
                    validate_gallery(changed)
        missing = copy.deepcopy(self.gallery)
        del missing['photos'][0]['survey_record']
        with self.assertRaisesRegex(ValueError, 'survey-record link'):
            validate_gallery(missing)
        extra = copy.deepcopy(self.gallery)
        extra['photos'][0]['survey_record']['camera'] = [-98.0, 35.4]
        with self.assertRaisesRegex(ValueError, 'survey-record link'):
            validate_gallery(extra)

    def test_link_note_keeps_the_camera_distinction(self):
        self.gallery['survey_link_note'] = 'Each photograph is pinned at its survey point.'
        with self.assertRaisesRegex(ValueError, 'not the camera position'):
            validate_gallery(self.gallery)

    def test_asset_path_cannot_escape_gallery(self):
        self.gallery['photos'][0]['asset'] = '../private.jpg'
        with self.assertRaisesRegex(ValueError, 'outside'):
            validate_gallery(self.gallery)

    def test_duplicate_photo_is_rejected(self):
        self.gallery['photos'].append(copy.deepcopy(self.gallery['photos'][0]))
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            validate_gallery(self.gallery)

    def test_existing_corrupt_asset_is_not_overwritten_or_redownloaded(self):
        with tempfile.TemporaryDirectory() as tmp, patch('atlas.damage.retrieve') as download:
            root = Path(tmp)
            target = root / self.gallery['photos'][0]['asset']
            target.parent.mkdir(parents=True)
            target.write_bytes(b'corrupt original')
            with self.assertRaisesRegex(ValueError, 'integrity'):
                restore_assets(self.gallery, root)
            self.assertEqual(target.read_bytes(), b'corrupt original')
            download.assert_not_called()

    def test_missing_asset_restores_exact_bytes_and_reuses_verified_file(self):
        self.gallery['photos'] = self.gallery['photos'][:1]
        photo = self.gallery['photos'][0]
        content = (ROOT / 'web' / photo['asset']).read_bytes()
        with tempfile.TemporaryDirectory() as tmp, patch('atlas.damage.cached_retrieval', return_value={'cached': True}), \
                patch('atlas.damage.read_object', return_value=content) as read, patch('atlas.damage.retrieve') as download:
            self.assertEqual(restore_assets(self.gallery, Path(tmp)), 1)
            self.assertEqual((Path(tmp) / photo['asset']).read_bytes(), content)
            self.assertEqual(restore_assets(self.gallery, Path(tmp)), 0)
            read.assert_called_once()
            download.assert_not_called()

    def test_changed_remote_bytes_are_rejected_before_publication(self):
        with tempfile.TemporaryDirectory() as tmp, patch('atlas.damage.cached_retrieval', return_value=None), \
                patch('atlas.damage.retrieve', return_value={}), patch('atlas.damage.read_object', return_value=b'new bytes'):
            with self.assertRaisesRegex(ValueError, 'integrity'):
                restore_assets(self.gallery, Path(tmp))
            self.assertFalse((Path(tmp) / self.gallery['photos'][0]['asset']).exists())

    def test_hash_alone_does_not_accept_html_as_a_photograph(self):
        content = b'<html>access denied</html>'
        self.gallery['photos'] = self.gallery['photos'][:1]
        self.gallery['photos'][0].update(sha256=hashlib.sha256(content).hexdigest(), bytes=len(content))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / self.gallery['photos'][0]['asset']
            path.parent.mkdir(parents=True)
            path.write_bytes(content)
            with self.assertRaisesRegex(ValueError, 'JPEG'):
                validate_gallery(self.gallery, Path(tmp))


if __name__ == '__main__':
    unittest.main()
