"""The begin location text comparison disputes exactly the starts it shows to be misplaced."""
import csv
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECORD = 'research/noaa-begin-text-2026-11-16.md'


def misplaced(row):
    # The text point lies inside the labeled county and more than 20 km from the published start.
    return bool(row['km_apart']) and float(row['km_apart']) > 20 and row['text_in_labeled_county'] == 'yes'


class BeginTextDisputeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with (ROOT / 'research/noaa-begin-text-2026-11-16.csv').open(encoding='utf-8', newline='') as file:
            cls.rows = list(csv.DictReader(file))
        cls.reviews = json.loads((ROOT / 'research/location-reviews.json').read_text(encoding='utf-8'))

    def test_exactly_the_misplaced_starts_cite_the_record(self):
        expected = {row['source_record'] for row in self.rows if misplaced(row)}
        self.assertEqual(len(expected), 671)
        citing = {key for key, review in self.reviews.items() if RECORD in review['reason']}
        self.assertEqual(citing, expected)

    def test_far_and_near_starts_outside_that_group_stay_listed_only(self):
        placed = [row for row in self.rows if row['km_apart']]
        far_outside = [row for row in placed if float(row['km_apart']) > 20 and row['text_in_labeled_county'] == 'no']
        near = [row for row in placed if float(row['km_apart']) <= 20]
        self.assertEqual(len(far_outside), 42)
        # 37 near starts in the 2001 and 2003 to 2006 releases and 5 in 2002.
        self.assertEqual(len(near), 42)
        self.assertEqual(sum('_d2002_' not in row['annual_release'] for row in near), 37)
        for row in far_outside + near + [row for row in self.rows if not row['km_apart']]:
            review = self.reviews.get(row['source_record'])
            if review is not None:
                self.assertNotIn(RECORD, review['reason'], row['source_record'])

    def test_each_dispute_matches_its_retained_row(self):
        for row in filter(misplaced, self.rows):
            review = self.reviews[row['source_record']]
            self.assertEqual(review['status'], 'disputed')
            self.assertEqual(review['reported_start'],
                             [float(row['published_longitude']), float(row['published_latitude'])])
            self.assertEqual(review['csv_record'], int(row['logical_csv_record']))
            self.assertTrue(review['source_url'].endswith('/' + row['annual_release']))
            # The distance and the county test belong to the point the range and direction give,
            # read from the gazetteer place, and not to the place itself.
            self.assertIn(f"{row['begin_text']}, read from {row['gazetteer_place']}, gives a point inside "
                          f"that county {row['km_apart']} km from the reported start", review['reason'])
            if row['episode_event_at_start']:
                self.assertIn(row['episode_event_at_start'], review['reason'])

    def test_published_catalogue_keeps_each_disputed_start_searchable(self):
        index = json.loads((ROOT / 'web/catalogue/index.json').read_text(encoding='utf-8'))
        records = {record['id']: record for record in index['records']}
        self.assertEqual(len(records), 80318)
        for row in filter(misplaced, self.rows):
            record = records[row['source_record']]
            self.assertEqual(record['location_quality'], 'disputed')
            self.assertEqual(record['point'], self.reviews[row['source_record']]['reported_start'])
            self.assertEqual(record['area'], row['noaa_county'])
        disputed = {key for key, record in records.items() if record.get('location_quality') == 'disputed'}
        self.assertEqual(disputed, set(self.reviews))


if __name__ == '__main__':
    unittest.main()
