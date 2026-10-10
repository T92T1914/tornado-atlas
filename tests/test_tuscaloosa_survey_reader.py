"""The reader retains survey evidence rather than manufacturing a timed map."""
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from museum_test_support import assert_preserved_field
from atlas.archive import dossiers

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = 'tuscaloosa-birmingham-2011-acf5660d7495f756a4b4.json'


class Stops(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'li' and attrs.get('id', '').startswith('path-'):
            self.ids.append(attrs['id'])


class TuscaloosaSurveyReaderTests(unittest.TestCase):
    def setUp(self):
        self.doc = next(row for row in dossiers() if row['id'] == 'tuscaloosa-birmingham-2011')
        self.page = (ROOT / 'web/tuscaloosa.html').read_text(encoding='utf-8')

    def test_all_previous_evidence_and_media_are_preserved(self):
        old = json.loads((ROOT / 'web/archive' / PREVIOUS).read_text(encoding='utf-8'))
        for field in ('records', 'reconstruction'):
            assert_preserved_field(self, self.doc[field], old[field], field)
        for field in ('sources', 'observations', 'creators', 'routes', 'media'):
            for row in old[field]:
                self.assertIn(row, self.doc[field], field)
        self.assertEqual(len(self.doc['media']), 10)

    def test_method_record_has_original_authors_and_separate_clock_roles(self):
        source = next(row for row in self.doc['sources'] if row['id'] == 'tuscaloosa-field-survey-method')
        self.assertIn('David O. Prevatt', source['locator'])
        self.assertIn('Samuel Hensen', source['locator'])
        self.assertIn('No report figure', source['rights'])
        item = next(row for row in self.doc['observations'] if row['id'] == 'field-study-boundary-and-clocks')
        self.assertEqual(item['status']['rights'], 'links_only')
        self.assertEqual(item['status']['spatial'], 'unregistered')
        self.assertIsNone(item['place']['coordinates'])
        self.assertIsNone(item['time']['alignment'])
        self.assertIn('April 27, 2011', item['time']['event']['reported'])
        self.assertIn('May 2 to 5', item['time']['capture']['reported'])
        self.assertIn('July 27, 2011', item['time']['publication']['reported'])
        self.assertIn('not a measured continuous tornado width', item['limits'])

    def test_existing_stops_and_new_evidence_routes_remain_readable(self):
        parser = Stops()
        parser.feed(self.page)
        self.assertEqual(parser.ids, ['path-greene', 'path-tuscaloosa', 'path-holt',
                                     'path-concord', 'path-birmingham', 'path-end'])
        self.assertIn('id="survey-reader"', self.page)
        self.assertIn('observation=field-study-boundary-and-clocks', self.page)
        self.assertIn('source=tuscaloosa-field-survey-method', self.page)
        self.assertIn('aftermath collection clocks', self.page)
        self.assertIn('rather than directly measuring winds', self.page)


if __name__ == '__main__':
    unittest.main()
