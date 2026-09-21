import copy
import json
import tempfile
import unittest
from pathlib import Path

from atlas.survey import FOLDER, load_survey
from atlas.survey_attachments import compile_attachments, load_survey_attachments


class AttachmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.survey = load_survey(json.loads((FOLDER / 'path.geojson').read_bytes()))
        cls.records = json.loads((FOLDER / 'survey-response.json').read_bytes())
        cls.response = json.loads((FOLDER / 'survey-attachments-response.json').read_bytes())

    def test_preserved_photos_join_exact_source_records(self):
        result = load_survey_attachments(self.survey)
        self.assertEqual((result['records_with_photos'], result['photo_count'], result['thumbnail_count']), (45, 45, 44))
        for group in self.response['attachmentGroups']:
            parent = group['parentObjectId']
            originals = [p for p in group['attachmentInfos'] if not p['name'].startswith('thumb_')]
            actual = result['photos'][str(parent)]
            self.assertEqual([p['attachment_id'] for p in actual], [p['id'] for p in originals])
            for photo in actual:
                self.assertTrue(photo['url'].endswith(f"/0/{parent}/attachments/{photo['attachment_id']}"))
                self.assertNotIn('capture_time', photo)
                self.assertNotIn('photographer', photo)

    def test_other_or_changed_parent_cannot_acquire_a_photo(self):
        for change in ({'parentObjectId': -1}, {'parentObjectId': True}, {'parentGlobalId': 'different'}):
            data = copy.deepcopy(self.response)
            data['attachmentGroups'][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                compile_attachments(data, self.survey, self.records)
        records = copy.deepcopy(self.records)
        parent = self.response['attachmentGroups'][0]['parentObjectId']
        next(f['attributes'] for f in records['features'] if f['attributes']['objectid'] == parent)['globalid'] = None
        data = copy.deepcopy(self.response)
        data['attachmentGroups'][0]['parentGlobalId'] = None
        with self.assertRaises(ValueError):
            compile_attachments(data, self.survey, records)

    def test_duplicate_and_incomplete_responses_are_rejected(self):
        for key in ('error', 'exceededTransferLimit'):
            with self.assertRaises(ValueError):
                compile_attachments({**self.response, key: True}, self.survey, self.records)
        data = copy.deepcopy(self.response)
        data['attachmentGroups'].append(data['attachmentGroups'][0])
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            compile_attachments(data, self.survey, self.records)
        data = copy.deepcopy(self.response)
        info = data['attachmentGroups'][0]['attachmentInfos'][0]
        data['attachmentGroups'][0]['attachmentInfos'].append(copy.deepcopy(info))
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            compile_attachments(data, self.survey, self.records)

    def test_thumbnail_is_not_counted_as_another_photograph(self):
        result = compile_attachments(self.response, self.survey, self.records)
        pairs = 0
        for photos in result['photos'].values():
            for photo in photos:
                pairs += photo['thumbnail_url'] != photo['url']
        self.assertEqual(pairs, 44)
        data = copy.deepcopy(self.response)
        info = data['attachmentGroups'][0]['attachmentInfos'][0]
        info['name'] = 'thumb_missing-original.jpg'
        with self.assertRaisesRegex(ValueError, 'Thumbnail'):
            compile_attachments(data, self.survey, self.records)

    def test_unreviewed_content_and_invalid_size_are_rejected(self):
        for update in ({'contentType': 'text/html'}, {'size': 0}, {'size': 40_000_000}, {'id': True}):
            data = copy.deepcopy(self.response)
            data['attachmentGroups'][0]['attachmentInfos'][0].update(update)
            with self.subTest(update=update), self.assertRaises(ValueError):
                compile_attachments(data, self.survey, self.records)

    def test_changed_snapshot_or_coverage_cannot_build(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            for name in ('survey-response.json', 'survey-attachments-response.json', 'survey-attachments-source.json'):
                (folder / name).write_bytes((FOLDER / name).read_bytes())
            original = (folder / 'survey-attachments-response.json').read_bytes()
            (folder / 'survey-attachments-response.json').write_bytes(original + b' ')
            with self.assertRaisesRegex(ValueError, 'hash or byte'):
                load_survey_attachments(self.survey, folder)
            (folder / 'survey-attachments-response.json').write_bytes(original)
            manifest = json.loads((folder / 'survey-attachments-source.json').read_bytes())
            manifest['reviewed_counts']['photo_count'] = 46
            (folder / 'survey-attachments-source.json').write_text(json.dumps(manifest), encoding='utf8')
            with self.assertRaisesRegex(ValueError, 'coverage changed'):
                load_survey_attachments(self.survey, folder)
