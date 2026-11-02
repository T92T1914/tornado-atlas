"""Greensburg source identity and reading contracts, not visual reconstruction."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest
from urllib.parse import parse_qs, urlsplit

from atlas.archive import dossiers, digest, validate_dossier
from atlas.evidence_coverage import layer_references
from atlas.event_package import build_event_packages

ROOT = Path(__file__).resolve().parents[1]
EVENT = 'greensburg-2007'
SOURCE_URL = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2007_c20260323.csv.gz'
SOURCE_SHA = 'e8289daa871946230862e2ca0d119195df7108e4a680fe83e3d419f3f21a7524'
RECORDS = ['ncei:35934', 'ncei:35937']
ANCHORS = ['path-and-impact', 'warnings', 'records-and-clocks', 'boundary-and-dimensions',
           'response', 'recovery', 'documentary-views', 'counts-and-remembrance', 'sources', 'assumed-experiments']


class Article(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.elements = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))


class GreensburgDocumentaryTests(unittest.TestCase):
    def setUp(self):
        self.doc = next(row for row in dossiers(ROOT) if row['id'] == EVENT)
        self.index = json.loads((ROOT / 'web/archive/index.json').read_bytes())
        self.html = (ROOT / 'web/greensburg.html').read_text(encoding='utf8')
        self.article = Article(self.html)
        self.observations = {row['id']: row for row in self.doc['observations']}

    def record(self, identifier):
        prefix = hashlib.sha256(identifier.encode()).hexdigest()[:2]
        file = self.index['record_shards'][prefix]
        return json.loads((ROOT / 'web/catalogue' / file).read_bytes())[identifier]

    def test_two_original_records_support_association_without_an_invented_replay(self):
        validate_dossier(self.doc)
        self.assertEqual([row['id'] for row in self.doc['records']], RECORDS)
        self.assertTrue(all(row['status'] == 'reviewed_association' and row['basis'] for row in self.doc['records']))
        first, second = [self.record(identifier) for identifier in RECORDS]
        self.assertIn('beginning of the Greensburg tornado', first['narrative'])
        self.assertIn('started in Comanche county', second['narrative'])
        self.assertEqual(first['continuation']['TOR_OTHER_CZ_NAME'], 'KIOWA')
        self.assertEqual(first['continuation']['TOR_OTHER_CZ_FIPS'], '097')
        event = next(row for row in json.loads((ROOT / 'exhibits/events.json').read_bytes())['events'] if row['id'] == EVENT)
        self.assertEqual(event['documentary'], 'greensburg.html')
        self.assertIsNone(event['replay'])
        self.assertIsNone(event['chronology'])
        self.assertEqual(build_event_packages(ROOT, {}, event_ids=[EVENT]), {})
        self.assertEqual(self.doc['reconstruction']['appearance'], 'unregistered')
        self.assertEqual(self.doc['reconstruction']['intervals'], [])

    def test_original_county_clocks_ratings_counts_and_provenance_remain_separate(self):
        expected = [
            ('ncei:35934', 'COMANCHE', 'EF1', '20:00', '20:03', '02:00', '02:03', 3.01, 100, 0, 0, 53100),
            ('ncei:35937', 'KIOWA', 'EF5', '20:03', '21:05', '02:03', '03:05', 25.8, 3000, 11, 63, 54170),
        ]
        for identifier, county, rating, start, end, utc_start, utc_end, length, width, deaths, injuries, csv_row in expected:
            with self.subTest(record=identifier):
                row = self.record(identifier)
                self.assertEqual(row['local_area'], county)
                self.assertEqual(row['rating']['reported'], rating)
                for role, local, utc in [('begin', start, utc_start), ('end', end, utc_end)]:
                    self.assertEqual(row['time'][role]['local'], '2007-05-04T' + local)
                    self.assertEqual(row['time'][role]['utc'], '2007-05-05T' + utc + ':00+00:00')
                    self.assertEqual(row['time'][role]['zone'], 'CST-6')
                    self.assertEqual(row['time'][role]['basis'], 'reported_local_standard_time')
                self.assertEqual(row['dimensions']['reported_length_miles'], length)
                self.assertEqual(row['dimensions']['reported_width_yards'], width)
                self.assertIsNone(row['dimensions']['visible_funnel_width_m'])
                self.assertEqual(row['impacts']['deaths_direct'], deaths)
                self.assertEqual(row['impacts']['injuries_direct'], injuries)
                self.assertEqual(row['provenance']['snapshot_id'], 'ncei:2007:20260323')
                self.assertEqual(row['provenance']['source_url'], SOURCE_URL)
                self.assertEqual(row['provenance']['sha256'], SOURCE_SHA)
                self.assertEqual(row['provenance']['csv_record'], csv_row)
        clock = self.observations['county-clocks']['account']
        for label in ('CST-6', '9:00 to 9:03 p.m.', '9:03 to 10:05 p.m. CDT', 'UTC on May 5'):
            self.assertIn(label, clock)

    def test_mismatching_boundary_is_preserved_without_a_connecting_line(self):
        first, second = [self.record(identifier) for identifier in RECORDS]
        self.assertEqual(first['spatial']['end_point'], [-99.4517, 37.3668])
        self.assertEqual(second['spatial']['begin_point'], [-99.3826, 37.3934])
        self.assertNotEqual(first['spatial']['end_point'], second['spatial']['begin_point'])
        for row in (first, second):
            self.assertEqual(row['spatial']['coordinate_order'], 'longitude_latitude')
            self.assertIsNone(row['spatial']['track'])
            self.assertIsNone(row['spatial']['interpolation'])
        account = self.observations['boundary-coordinate-conflict']
        for number in ('-99.4517', '37.3668', '-99.3826', '37.3934'):
            self.assertIn(number, account['account'])
        self.assertIn('without repairing either coordinate', account['limits'])

    def test_warning_and_casualty_accounts_keep_their_distinct_scopes(self):
        warning = self.observations['warning-sequence']
        self.assertEqual(warning['source_id'], 'nws-ddc-2017')
        for value in ('8:55 p.m.', '9:19 p.m.', '9:45 p.m.', '26 minutes'):
            self.assertIn(value, warning['account'])
        self.assertIn('time zone is not printed', warning['limits'])
        emergency = self.observations['tornado-emergency-example']
        self.assertEqual(emergency['source_id'], 'nws-warning-example-2010')
        self.assertIn('9:41 p.m. CDT', emergency['account'])
        self.assertIn('not recovered original transmission bytes', emergency['limits'])
        casualty = self.observations['event-casualties']
        self.assertEqual(casualty['source_id'], 'ncei-2007-retained')
        for value in ('11 direct deaths', '63 direct injuries', 'September 19, 2007'):
            self.assertIn(value, casualty['account'])
        city = self.observations['city-count-scope']
        self.assertEqual(city['source_id'], 'city-greensburg-2007')
        self.assertIn('ten fatalities within Greensburg city limits', city['account'])
        self.assertIn('other county deaths are not added', city['limits'])

    def test_positive_damage_response_and_recovery_accounts_are_source_linked(self):
        expected = {
            'comanche-beginning': ('ncei-2007-retained', ['oil tanks and trees', 'EF1']),
            'kiowa-town-impact': ('ncei-2007-retained', ['95 percent', '961', '216', '307', '$250 million']),
            'ending-loop': ('ncei-2007-retained', ['northwest', 'west, south and east', 'new circulation']),
            'reported-dimensions': ('nws-ddc-2008', ['65 minutes', '28.8 miles', '1.7 miles', 'approximate']),
            'epa-response': ('epa-greensburg-response', ['May 5', 'May 9', 'May 11', 'chlorine', 'anhydrous ammonia']),
            'dated-recovery': ('nws-ddc-2008', ['April 25, 2008', '800,000 cubic yards']),
        }
        for identifier, (source, phrases) in expected.items():
            row = self.observations[identifier]
            self.assertEqual(row['source_id'], source)
            for phrase in phrases:
                self.assertIn(phrase, row['account'])
        self.assertIn('400,000 cubic yards', self.observations['dated-recovery']['limits'])
        self.assertIn('July 26', self.observations['dated-recovery']['limits'])
        self.assertIn('not treated as one simultaneous measurement', self.observations['dated-recovery']['limits'])
        for row in self.doc['observations']:
            self.assertEqual(row['status']['rights'], 'links_only')
            self.assertEqual(row['status']['assertion'], 'source_reported')
            self.assertEqual(row['status']['temporal'], 'unregistered')
            self.assertEqual(row['status']['spatial'], 'unregistered')
            self.assertIsNone(row['time']['alignment'])
            self.assertIsNone(row['place']['coordinates'])

    def test_two_gallery_links_do_not_publish_uninspected_images(self):
        expected = [('nws-ddc-main-street-2008', 'https://www.weather.gov/images/ddc/IMG_0231.jpg'),
                    ('nws-ddc-main-street-2012', 'https://www.weather.gov/images/ddc/Main_looking_north.jpg')]
        self.assertEqual([(row['id'], row['url']) for row in self.doc['media']], expected)
        for row in self.doc['media']:
            self.assertEqual(row['source_id'], 'nws-ddc-recovery-gallery')
            self.assertEqual(row['status']['rights'], 'links_only')
            self.assertEqual(row['status']['availability'], 'not_researched')
            self.assertEqual(row['roles'], {'creator': None, 'uploader': 'nws-ddc', 'rights_holder': None})
            self.assertIsInstance(row['transformation'], str)
            self.assertIsNone(row['time']['capture'])
            self.assertIsNone(row['time']['alignment'])
            self.assertIsNone(row['place']['coordinates'])
        self.assertEqual([attrs for tag, attrs in self.article.elements if tag in ('img', 'video', 'source', 'iframe')], [])
        hrefs = [attrs.get('href') for tag, attrs in self.article.elements if tag == 'a']
        for _, url in expected:
            self.assertIn(url, hrefs)

    def test_article_and_reader_provide_specific_ordinary_routes(self):
        ids = [attrs['id'] for _, attrs in self.article.elements if 'id' in attrs]
        self.assertEqual(len(ids), len(set(ids)))
        for anchor in ANCHORS + ['article-contents']:
            self.assertIn(anchor, ids)
        routes = {row['href'] for row in self.doc['routes']}
        for anchor in ANCHORS:
            self.assertIn('greensburg.html#' + anchor, routes)
        hrefs = [attrs.get('href', '') for tag, attrs in self.article.elements if tag == 'a']
        records = [parse_qs(urlsplit(href).query)['record'][0] for href in hrefs
                   if urlsplit(href).path == 'dossier.html' and 'record' in parse_qs(urlsplit(href).query)]
        for identifier in RECORDS:
            self.assertIn(identifier, records)
        self.assertIn('study.html?event=greensburg-2007', hrefs)
        self.assertIn('wind.html?event=greensburg-2007#wind-model-limits', hrefs)
        for file in ('dossier.html', 'study.html', 'wind.html'):
            fallback = Article((ROOT / 'web' / file).read_text(encoding='utf8'))
            self.assertTrue(any(tag == 'a' and attrs.get('href') == 'greensburg.html'
                                for tag, attrs in fallback.elements), file)

    def test_coverage_exposes_damage_and_gaps_without_calibrated_appearance(self):
        refs = layer_references(ROOT, self.doc)
        self.assertIsNone(refs['survey'])
        self.assertEqual(refs['damage']['observations'], ['comanche-beginning', 'kiowa-town-impact'])
        self.assertEqual(refs['gaps']['observations'], ['county-clocks', 'boundary-coordinate-conflict',
                         'warning-sequence', 'event-casualties', 'city-count-scope', 'dated-recovery', 'recovery-views'])
        for layer in ('geography', 'appearance'):
            self.assertEqual(refs[layer]['observations'], [])
        self.assertTrue(all(refs[layer]['media'] == [] for layer in ('geography', 'damage', 'appearance', 'gaps')))
        entry = next(row for row in self.index['events'] if row['id'] == EVENT)
        self.assertEqual(entry['dossier_sha256'], digest(self.doc))
        raw = (ROOT / 'web' / entry['file']).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), entry['file_sha256'])
        self.assertEqual(json.loads(raw), self.doc)


if __name__ == '__main__':
    unittest.main()
