import copy
import html
import json
import re
import unittest

from atlas.tuscaloosa_survey import load_survey, native_section


class TuscaloosaSourceFragmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.survey = load_survey()
        cls.section = native_section(cls.survey, 'events/example.json', b'{}')

    def account(self, section, fid):
        match = re.search(
            rf'<details id="survey-account-{fid}"\s.*?</pre>', section, re.S)
        self.assertIsNotNone(match)
        return match.group()

    def raw_feature(self, account):
        match = re.search(r'<pre>(.*?)</pre>', account, re.S)
        self.assertIsNotNone(match)
        return json.loads(html.unescape(match[1]))

    def test_all_three_exact_fragments_keep_their_literal_source_and_notice(self):
        fragments = [point for point in self.survey['points']
                     if point['source_feature']['attributes']['dod_txt'] == '20%)']
        self.assertEqual([point['fid'] for point in fragments], [20, 31, 165])
        notice = ('The source description begins incompletely. '
                  'Its missing beginning has not been supplied.')
        for point in fragments:
            with self.subTest(fid=point['fid']):
                account = self.account(self.section, point['fid'])
                self.assertIn('<p>20%)</p>', account)
                self.assertIn(notice, account)
                self.assertEqual(self.raw_feature(account), point['source_feature'])

    def test_existing_fragment_and_complete_description_controls(self):
        cases = [
            ('20%); collapse of chimney', True, False),
            ('Loss of roof covering material (', False, True),
            ('Null', False, False),
            ('Loss of roof covering material (up to 20%)', False, False),
            ('Total destruction of entire building', False, False),
        ]
        for degree, leading, trailing in cases:
            with self.subTest(degree=degree):
                survey = copy.deepcopy(self.survey)
                feature = survey['points'][0]['source_feature']
                feature['attributes']['dod_txt'] = degree
                account = self.account(
                    native_section(survey, 'events/example.json', b'{}'), 0)
                self.assertEqual('description begins incompletely' in account, leading)
                self.assertEqual('description ends with an open parenthesis' in account,
                                 trailing)
                self.assertEqual(self.raw_feature(account), feature)
                if degree == 'Null':
                    self.assertIn('No missing description has been supplied.', account)


if __name__ == '__main__':
    unittest.main()
