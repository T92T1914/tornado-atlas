import copy
import json
import unittest
from pathlib import Path
from atlas.community import validate_community

ROOT = Path(__file__).resolve().parents[1]


class CommunityTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT/'exhibits/el-reno-2013/community.json').read_text(encoding='utf8'))

    def test_curated_collection_validates_without_mutation(self):
        before = copy.deepcopy(self.data)
        validate_community(self.data, 'el-reno-2013')
        self.assertEqual(before, self.data)

    def test_wrong_event_and_unknown_conclusion_rejected(self):
        with self.assertRaises(ValueError): validate_community(self.data, 'el-reno-2011')
        self.data['entries'][0]['status'] = 'official_upgrade'
        with self.assertRaises(ValueError): validate_community(self.data, 'el-reno-2013')

    def test_forum_cannot_be_promoted_to_primary_evidence(self):
        self.data['entries'][1]['evidence_sources'] = ['house-thread']
        with self.assertRaises(ValueError): validate_community(self.data, 'el-reno-2013')

    def test_missing_or_unread_evidence_is_rejected(self):
        for refs in [[], ['missing-source']]:
            data = copy.deepcopy(self.data)
            data['entries'][1]['evidence_sources'] = refs
            with self.assertRaises(ValueError): validate_community(data, 'el-reno-2013')
        for status in ['not_reviewed', 'unavailable']:
            data = copy.deepcopy(self.data)
            next(source for source in data['sources'] if source['id']=='ground-survey')['access'] = status
            with self.assertRaises(ValueError): validate_community(data, 'el-reno-2013')

    def test_duplicate_ids_and_citations_are_rejected(self):
        data = copy.deepcopy(self.data)
        data['entries'].append(copy.deepcopy(data['entries'][0]))
        with self.assertRaises(ValueError): validate_community(data, 'el-reno-2013')
        self.data['entries'][0]['discussion_sources'] *= 2
        with self.assertRaises(ValueError): validate_community(self.data, 'el-reno-2013')

    def test_unsafe_urls_and_review_dates_are_rejected(self):
        for url in ['javascript:alert(1)', 'https://user:password@example.org', 'http://example.org']:
            data = copy.deepcopy(self.data)
            data['sources'][0]['url'] = url
            with self.assertRaises(ValueError): validate_community(data, 'el-reno-2013')
        self.data['entries'][0]['reviewed'] = '2027-01-01'
        with self.assertRaises(ValueError): validate_community(self.data, 'el-reno-2013')
