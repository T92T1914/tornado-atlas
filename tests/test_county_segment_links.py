"""The county segment link record agrees with the published catalogue it was built from."""
import csv
import json
import math
import unittest
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LINKED = 'one segment shares an endpoint'
WINDOW = timedelta(hours=3)
# NOAA writes the continuing county's state as a two letter postal code and its own state in full.
STATES = {
    'AL': 'ALABAMA', 'AK': 'ALASKA', 'AZ': 'ARIZONA', 'AR': 'ARKANSAS', 'CA': 'CALIFORNIA', 'CO': 'COLORADO',
    'CT': 'CONNECTICUT', 'DE': 'DELAWARE', 'DC': 'DISTRICT OF COLUMBIA', 'FL': 'FLORIDA', 'GA': 'GEORGIA',
    'HI': 'HAWAII', 'ID': 'IDAHO', 'IL': 'ILLINOIS', 'IN': 'INDIANA', 'IA': 'IOWA', 'KS': 'KANSAS',
    'KY': 'KENTUCKY', 'LA': 'LOUISIANA', 'ME': 'MAINE', 'MD': 'MARYLAND', 'MA': 'MASSACHUSETTS',
    'MI': 'MICHIGAN', 'MN': 'MINNESOTA', 'MS': 'MISSISSIPPI', 'MO': 'MISSOURI', 'MT': 'MONTANA',
    'NE': 'NEBRASKA', 'NV': 'NEVADA', 'NH': 'NEW HAMPSHIRE', 'NJ': 'NEW JERSEY', 'NM': 'NEW MEXICO',
    'NY': 'NEW YORK', 'NC': 'NORTH CAROLINA', 'ND': 'NORTH DAKOTA', 'OH': 'OHIO', 'OK': 'OKLAHOMA',
    'OR': 'OREGON', 'PA': 'PENNSYLVANIA', 'RI': 'RHODE ISLAND', 'SC': 'SOUTH CAROLINA', 'SD': 'SOUTH DAKOTA',
    'TN': 'TENNESSEE', 'TX': 'TEXAS', 'UT': 'UTAH', 'VT': 'VERMONT', 'VA': 'VIRGINIA', 'WA': 'WASHINGTON',
    'WV': 'WEST VIRGINIA', 'WI': 'WISCONSIN', 'WY': 'WYOMING', 'PR': 'PUERTO RICO'}


def km(a, b):
    dx = (a[0] - b[0]) * 111.2 * math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot(dx, (a[1] - b[1]) * 111.2)


def moment(label):
    return datetime.strptime(label, '%d-%b-%y %H:%M:%S')


def touching(source, other):
    """The pair of endpoints that meet within 1 km, or None."""
    pairs = []
    if source['spatial']['end_point'] and other['spatial']['begin_point']:
        pairs.append(km(source['spatial']['end_point'], other['spatial']['begin_point']))
    if source['spatial']['begin_point'] and other['spatial']['end_point']:
        pairs.append(km(source['spatial']['begin_point'], other['spatial']['end_point']))
    return min(pairs) <= 1.0 if pairs else False


class CountySegmentLinkTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with (ROOT / 'research/county-segment-links-2026-11-17.csv').open(encoding='utf-8', newline='') as file:
            cls.rows = list(csv.DictReader(file))
        index = json.loads((ROOT / 'web/catalogue/index.json').read_text(encoding='utf-8'))
        cls.index = {record['id']: record for record in index['records']}
        cls.details = {}
        for name in sorted({record['detail_file'] for record in index['records']}):
            cls.details.update(json.loads((ROOT / 'web/catalogue' / name).read_text(encoding='utf-8')))
        cls.by_county = defaultdict(list)
        for detail in cls.details.values():
            if detail['year'] >= 2000:
                cls.by_county[(detail['administrative_area'], detail['local_area'].upper())].append(detail)

    def test_counts_match_the_record(self):
        self.assertEqual(len(self.rows), 3737)
        self.assertEqual(Counter(row['outcome'] for row in self.rows), {
            LINKED: 3299, 'several segments share an endpoint': 166, 'nearest endpoint within 5 km': 182,
            'no endpoint within 5 km': 65, 'no candidate in the named county': 25})
        linked = [row for row in self.rows if row['linked_record']]
        self.assertEqual(Counter(row['link_direction'] for row in linked),
                         {'continues_into': 3269, 'continues_from': 26, 'either': 4})

    def test_every_published_record_naming_another_county_is_listed(self):
        naming = {key for key, detail in self.details.items()
                  if (detail.get('continuation') or {}).get('TOR_OTHER_CZ_FIPS')}
        self.assertEqual(naming, {row['source_record'] for row in self.rows})

    def test_each_row_matches_its_published_record(self):
        for row in self.rows:
            detail = self.details[row['source_record']]
            self.assertEqual(self.index[row['source_record']]['source_snapshot'], row['snapshot_id'])
            self.assertEqual(detail['provenance']['csv_record'], int(row['csv_record']))
            self.assertEqual(detail['administrative_area'], row['state'])
            self.assertEqual(detail['local_area'], row['county_name'])
            self.assertEqual(detail['time']['begin']['reported'], row['begin_time'])
            self.assertEqual(detail['time']['end']['reported'], row['end_time'])
            continuation = detail['continuation']
            self.assertEqual(continuation['TOR_OTHER_WFO'], row['other_wfo'])
            self.assertEqual(continuation['TOR_OTHER_CZ_STATE'], row['other_state'])
            self.assertEqual(continuation['TOR_OTHER_CZ_FIPS'], row['other_county_fips'])
            self.assertEqual(continuation['TOR_OTHER_CZ_NAME'], row['other_county_name'])

    def test_each_link_is_the_only_touching_segment_of_the_named_county(self):
        for row in self.rows:
            if row['outcome'] != LINKED:
                self.assertEqual(row['linked_record'], '', row['source_record'])
                continue
            self.assertEqual(row['touching'], '1')
            source, other = self.details[row['source_record']], self.details[row['linked_record']]
            self.assertEqual(other['administrative_area'], STATES[row['other_state']], row['source_record'])
            self.assertEqual(other['local_area'].upper(), row['other_county_name'].upper())
            direction = row['link_direction']
            into = km(source['spatial']['end_point'], other['spatial']['begin_point'])
            back = km(source['spatial']['begin_point'], other['spatial']['end_point'])
            self.assertLessEqual({'continues_into': into, 'continues_from': back, 'either': into}[direction], 1.0)
            if direction == 'either':
                self.assertAlmostEqual(into, back, places=9)
            # Recount from the published catalogue: the named state and county, the window, a shared endpoint.
            begin, end = moment(row['begin_time']), moment(row['end_time'])
            found = [candidate['id'] for candidate in self.by_county[(STATES[row['other_state']], row['other_county_name'].upper())]
                     if candidate['id'] != row['source_record']
                     and moment(candidate['time']['begin']['reported']) <= end + WINDOW
                     and moment(candidate['time']['end']['reported']) >= begin - WINDOW
                     and touching(source, candidate)]
            self.assertEqual(found, [row['linked_record']], row['source_record'])

    def test_links_form_chains_with_one_branch(self):
        linked = [row for row in self.rows if row['linked_record']]
        links = {frozenset((row['source_record'], row['linked_record'])) for row in linked}
        self.assertEqual(len(links), 3276)
        touches = Counter(record for link in links for record in link)
        self.assertEqual(len(touches), 5994)
        self.assertEqual(sorted(k for k, v in touches.items() if v > 2), ['ncei:680144'])
        # With direction, only pairs whose order is shown.
        edges = {(row['linked_record'], row['source_record']) if row['link_direction'] == 'continues_from'
                 else (row['source_record'], row['linked_record']) for row in linked if row['link_direction'] != 'either'}
        predecessors = Counter(b for a, b in edges)
        successors = Counter(a for a, b in edges)
        self.assertEqual(sorted(k for k, v in predecessors.items() if v > 1), ['ncei:1154910', 'ncei:680144'])
        self.assertEqual([k for k, v in successors.items() if v > 1], [])


if __name__ == '__main__':
    unittest.main()
