import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest
from urllib.parse import parse_qs, urlsplit

from atlas.archive import dossiers, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
UDALL_RECORDS = ['ncei:10096418', 'ncei:10027629', 'ncei:10027630', 'ncei:10027631', 'ncei:10027632']
BLACKWELL_CONTROLS = ['ncei:10096417', 'ncei:10027628']
WARNING = 'assets/blackwell-1955/nws-warning2.jpg'
WARNING_SHA = '8de7b776fc25c87834a9277c77c2a6b10939b4618984dbefe450e621584304a5'
SOURCE_SHA = 'c503aadb9ca02fe8f9de0fa67e91218b02b4b8489af4f95c7cdc40d34c72c9cc'
ANCHORS = ['damage-and-aftermath', 'regional-forecast', 'udall-regional-forecast', 'records',
           'boundary-and-identity', 'clocks-and-counts', 'original-images', 'remembrance',
           'sources', 'assumed-experiments', 'eastward-aftermath']
# Frozen from the accepted five dossiers before adding Udall, not new generator output.
PRESERVED_DOSSIERS = {
    'el-reno-2013': ('archive/el-reno-2013-854b56dffaf8720e27be.json', '7033875ffc69f083f131ddfb31136afab6d5af418e4d0bb9dbfa3d69b5c5b131'),
    'joplin-2011': ('archive/joplin-2011-68dca24097277ba2afb7.json', '05d6966cb4c1e6469c1b1cae9ed26b0799f330ecfb696ab80efb2d11d2315bd2'),
    'blackwell-1955': ('archive/blackwell-1955-9e74182ea8d0076dae45.json', '7d4aad53d4bdaa7fd9813a5b4f962145bfe484fd0d0a0b9195128364b8232dd1'),
    'moore-2013': ('archive/moore-2013-b871ef828cd8a1c475bc.json', 'c15c3c827585eec744ef91fb760d6b4a989e39cbc9e77c3b35b61049764aa7e8'),
    'tuscaloosa-birmingham-2011': ('archive/tuscaloosa-birmingham-2011-63b08e0460f38874aeb9.json', '02c2d593027112397d859184955225db56912135ab6ea827ec2f76598d334f72'),
}


class Article(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.elements = []
        self.text = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))

    def handle_data(self, data):
        self.text.append(data)


class UdallDocumentaryTests(unittest.TestCase):
    def setUp(self):
        self.doc = next(row for row in dossiers(ROOT) if row['id'] == 'udall-1955')
        self.html = (ROOT / 'web/udall.html').read_text(encoding='utf-8')
        self.article = Article(self.html)
        self.index = json.loads((ROOT / 'web/archive/index.json').read_bytes())

    def raw_record(self, record_id):
        prefix = hashlib.sha256(record_id.encode()).hexdigest()[:2]
        shard = self.index['record_shards'][prefix]
        return json.loads((ROOT / 'web/catalogue' / shard).read_bytes())[record_id]

    def test_five_records_are_a_documentary_association_without_replay(self):
        validate_dossier(self.doc)
        self.assertEqual([row['id'] for row in self.doc['records']], UDALL_RECORDS)
        self.assertTrue(set(BLACKWELL_CONTROLS).isdisjoint(row['id'] for row in self.doc['records']))
        self.assertTrue(all(row['basis'] for row in self.doc['records']))
        self.assertEqual(self.doc['reconstruction']['appearance'], 'unregistered')
        self.assertEqual(self.doc['reconstruction']['intervals'], [])
        event = next(row for row in json.loads((ROOT / 'exhibits/events.json').read_bytes())['events'] if row['id'] == 'udall-1955')
        self.assertEqual(event['documentary'], 'udall.html')
        self.assertIsNone(event['replay'])
        self.assertIsNone(event['chronology'])

    def test_original_record_fields_and_unresolved_clocks_are_not_reconciled(self):
        # Literal fields from retained source release ncei:1955:20260323.
        expected = [
            ('ncei:10096418', 'KAY', '22:00', 8, 0, 0),
            ('ncei:10027629', 'SUMNER', '22:15', 24.7, 5, 3),
            ('ncei:10027630', 'COWLEY', '22:45', 2.3, 75, 270),
            ('ncei:10027631', 'COWLEY', '23:00', 7.8, 0, 0),
            ('ncei:10027632', 'COWLEY', '23:15', 13.6, 0, 0),
        ]
        for record_id, county, clock, length, deaths, injuries in expected:
            with self.subTest(record=record_id):
                row = self.raw_record(record_id)
                self.assertEqual(row['local_area'], county)
                self.assertEqual(row['time']['begin']['local'], '1955-05-25T' + clock)
                self.assertEqual(row['time']['end']['local'], row['time']['begin']['local'])
                self.assertEqual(row['time']['begin']['zone'], 'CST')
                self.assertIsNone(row['time']['begin']['utc'])
                self.assertIsNone(row['time']['end']['utc'])
                self.assertIn('unresolved_timezone:BEGIN', row['quality_notes'])
                self.assertIn('same_reported_start_end_not_proof_of_zero_duration', row['quality_notes'])
                self.assertEqual(row['dimensions']['reported_length_miles'], length)
                self.assertEqual(row['impacts']['deaths_direct'], deaths)
                self.assertEqual(row['impacts']['injuries_direct'], injuries)
                self.assertEqual(row['narrative'], '')
                self.assertTrue(all(value is None for value in row['continuation'].values()))
                self.assertIsNone(row['spatial']['track'])
                self.assertIsNone(row['spatial']['interpolation'])
                self.assertEqual(row['provenance']['snapshot_id'], 'ncei:1955:20260323')
                self.assertEqual(row['provenance']['sha256'], SOURCE_SHA)

    def test_mismatched_and_ambiguous_endpoints_remain_positive_controls(self):
        kay, sumner = self.raw_record('ncei:10096418'), self.raw_record('ncei:10027629')
        blackwell, blackwell_sumner = (self.raw_record(item) for item in BLACKWELL_CONTROLS)
        self.assertEqual(kay['spatial']['end_point'], [-97.15, 37])
        self.assertEqual(sumner['spatial']['begin_point'], [-97.25, 37])
        self.assertNotEqual(kay['spatial']['end_point'], sumner['spatial']['begin_point'])
        self.assertEqual(blackwell['spatial']['end_point'], blackwell_sumner['spatial']['begin_point'])
        self.assertEqual(blackwell['spatial']['end_point'], sumner['spatial']['begin_point'])
        observations = {row['id']: row for row in self.doc['observations']}
        self.assertIn('-97.15', json.dumps(observations['kay-sumner-boundary']))
        self.assertIn('-97.25', json.dumps(observations['kay-sumner-boundary']))
        self.assertIn('10096417', json.dumps(observations['endpoint-ambiguity-control']))
        self.assertIn('10027628', json.dumps(observations['endpoint-ambiguity-control']))
        self.assertIn('10027629', json.dumps(observations['endpoint-ambiguity-control']))

    def test_positive_historical_account_and_disagreements_keep_source_roles(self):
        observations = {row['id']: row for row in self.doc['observations']}
        continuity = observations['phillips-survey-continuity']
        self.assertEqual(continuity['source_id'], 'nws-wichita-storm-report')
        self.assertIn('Phillips', continuity['account'])
        self.assertIn('3.5', continuity['account'])
        self.assertRegex(continuity['account'].lower(), r'gap|skip')
        damage = observations['udall-damage-account']
        self.assertEqual(damage['source_id'], 'nws-wichita-storm-report')
        self.assertRegex(damage['account'].lower(), r'tower|rail|building')
        for item, values in [('source-clock-disagreement', ('2220', '2235', '2245')),
                             ('injury-count-disagreement', ('250', '273'))]:
            row = observations[item]
            self.assertEqual(row['status']['assertion'], 'disputed')
            for value in values:
                self.assertIn(value, row['account'])
        clock = observations['source-clock-disagreement']
        self.assertIn('reported roar around 2220 CST', clock['account'])
        self.assertIn("house's collapse at 2235 CST", clock['account'])
        self.assertIsNone(clock['time']['alignment'])
        for row in observations.values():
            self.assertEqual(row['status']['spatial'], 'unregistered')
            self.assertIsNone(row['time']['alignment'])
            self.assertIsNone(row['place']['coordinates'])

    def test_only_the_exact_previously_permitted_regional_document_is_hosted(self):
        self.assertEqual(len(self.doc['media']), 1)
        media = self.doc['media'][0]
        self.assertEqual(media['id'], 'nws-blackwell-warning2')
        self.assertEqual(media['source_id'], 'nws-blackwell-warning2')
        self.assertEqual(media['transformation']['asset'], WARNING)
        self.assertEqual(media['transformation']['sha256'], WARNING_SHA)
        self.assertEqual((media['transformation']['width'], media['transformation']['height']), (608, 436))
        self.assertEqual(media['status']['rights'], 'permitted_hosting')
        self.assertEqual(media['roles']['creator'], None)
        self.assertEqual(media['roles']['rights_holder'], None)
        self.assertIsNone(media['time']['alignment'])
        raw = (ROOT / 'web' / WARNING).read_bytes()
        self.assertEqual(len(raw), 76308)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), WARNING_SHA)
        # Reuse does not rewrite the pre-existing item or its item-specific rights.
        blackwell = next(row for row in dossiers(ROOT) if row['id'] == 'blackwell-1955')
        old = next(row for row in blackwell['media'] if row['id'] == 'nws-blackwell-warning2')
        self.assertEqual(media, old)
        images = [attrs['src'] for tag, attrs in self.article.elements if tag == 'img']
        self.assertEqual(images, [WARNING])
        self.assertNotIn('283885', self.html)
        self.assertFalse(any(src.lower().endswith(('.gif', '.mp4', '.webm')) for src in images))

    def test_native_article_and_dossier_routes_keep_specific_reading_returns(self):
        ids = [attrs['id'] for _, attrs in self.article.elements if 'id' in attrs]
        self.assertEqual(len(ids), len(set(ids)), 'Native fragment targets are unique')
        for anchor in ANCHORS + ['article-contents']:
            self.assertIn(anchor, ids)
        routes = {row['href'] for row in self.doc['routes']}
        for anchor in ANCHORS:
            self.assertIn('udall.html#' + anchor, routes)
        hrefs = [attrs['href'] for tag, attrs in self.article.elements if tag == 'a' and 'href' in attrs]
        record_links = [parse_qs(urlsplit(href).query)['record'][0] for href in hrefs
                        if urlsplit(href).path == 'dossier.html' and 'record' in parse_qs(urlsplit(href).query)]
        for record_id in UDALL_RECORDS:
            self.assertIn(record_id, record_links)
        self.assertIn('dossier.html?event=udall-1955&source=nws-wichita-storm-report#source-nws-wichita-storm-report', hrefs)
        self.assertIn('study.html?event=udall-1955', hrefs)
        self.assertIn('wind.html?event=udall-1955', hrefs)
        self.assertTrue(any(tag == 'details' and 'documentary-contents' in attrs.get('class', '').split()
                            for tag, attrs in self.article.elements))
        fallback = Article((ROOT / 'web/dossier.html').read_text(encoding='utf-8'))
        self.assertTrue(any(tag == 'a' and attrs.get('href') == 'udall.html'
                            for tag, attrs in fallback.elements))

    def test_clock_clarification_retains_the_first_candidate_and_exact_change(self):
        entry = next(row for row in self.index['events'] if row['id'] == 'udall-1955')
        initial = 'f9611c08821bb3e8852e612615fe75704fa647a4256e92c82094c0030150ae61'
        path = ROOT / 'web/archive/udall-1955-f9611c08821bb3e8852e.json'
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), 'a304c5cc3013cc17aa23497f70d79321ae523af62a22631a3baf937504f6e094')
        history = json.loads((ROOT / 'web' / entry['history_file']).read_bytes())
        clarification = next(row for row in history['versions'] if row['dossier_sha256'] == '9e17a19743779426b29248a0685472a4c747f3409e707ae4964d7d526ddc47ec')
        current = next(row for row in history['versions'] if row['dossier_sha256'] == entry['dossier_sha256'])
        self.assertEqual(clarification['review']['previous_dossier_sha256'], initial)
        self.assertEqual(current['review']['previous_dossier_sha256'], clarification['dossier_sha256'])
        self.assertTrue(clarification['predecessor_available'])
        self.assertTrue(current['predecessor_available'])
        self.assertEqual(clarification['changes'], [{'kind': 'observations', 'id': 'source-clock-disagreement',
                         'change': 'updated', 'fields': ['account', 'limits']}])
        self.assertEqual(len(history['versions']), 3)
        self.assertIn({'kind': 'sources', 'id': 'nws-wichita-udall-east', 'change': 'added', 'fields': []}, current['changes'])
        self.assertIn({'kind': 'observations', 'id': 'eastward-aftermath-scene', 'change': 'added', 'fields': []}, current['changes'])

    def test_damage_coverage_links_report_context_without_geometry_admission(self):
        from atlas.archive import digest
        from atlas.evidence_coverage import layer_references
        refs = layer_references(ROOT, self.doc)
        self.assertIsNone(refs['survey'])
        self.assertEqual(refs['damage']['observations'], ['udall-damage-account', 'phillips-survey-continuity', 'eastward-aftermath-scene'])
        self.assertEqual(refs['damage']['media'], [])
        self.assertEqual(refs['gaps']['observations'], ['kay-sumner-boundary', 'endpoint-ambiguity-control',
                         'source-clock-disagreement', 'injury-count-disagreement', 'original-image-limits'])
        for layer in ['geography', 'appearance']:
            self.assertEqual(refs[layer]['observations'], [])
            self.assertEqual(refs[layer]['media'], [])
        membership = json.loads((ROOT / 'exhibits/udall-1955/layers.json').read_bytes())
        self.assertEqual(membership['dossier_sha256'], digest(self.doc))

    def test_existing_five_dossiers_keep_their_accepted_archive_objects(self):
        entries = {row['id']: row for row in self.index['events']}
        for event_id, (file, sha) in PRESERVED_DOSSIERS.items():
            with self.subTest(event=event_id):
                self.assertEqual(entries[event_id]['file'], file)
                self.assertEqual(entries[event_id]['file_sha256'], sha)
                self.assertEqual(hashlib.sha256((ROOT / 'web' / file).read_bytes()).hexdigest(), sha)


    def test_one_inspected_aftermath_view_keeps_links_rights_and_unknowns_separate(self):
        source = next(row for row in self.doc['sources'] if row['id'] == 'nws-wichita-udall-east')
        observation = next(row for row in self.doc['observations'] if row['id'] == 'eastward-aftermath-scene')
        original = 'https://www.weather.gov/images/ict/wxstory/udall/east.jpg'
        self.assertEqual(source['url'], original)
        for literal in ['46541', '506 by 348', '7a06cb031bd0eb8d75f4d30f0d07ba969202ede2c2d840c1ff27a1ada29fb172']:
            self.assertIn(literal, json.dumps(source))
        self.assertEqual(observation['source_id'], source['id'])
        self.assertEqual(observation['status']['assertion'], 'observed_sample')
        self.assertEqual(observation['status']['rights'], 'links_only')
        self.assertEqual(observation['status']['temporal'], 'unregistered')
        self.assertEqual(observation['status']['spatial'], 'unregistered')
        for role in ['capture', 'publication', 'video', 'alignment']:
            self.assertIsNone(observation['time'][role])
        self.assertIsNone(observation['place']['coordinates'])
        self.assertIn('No person, aid organization, medical function or named report building', observation['limits'])
        self.assertIn('No image or derivative is hosted', source['rights'])
        self.assertIn('dead.jpg', source['locator'])
        self.assertEqual(self.doc['provenance']['inputs']['research/udall-foundation-2026-10-19.md'],
                         hashlib.sha256((ROOT / 'research/udall-foundation-2026-10-19.md').read_bytes()).hexdigest())
        self.assertEqual(self.doc['provenance']['reviewed_on'], '2026-10-21')
        self.assertEqual(self.doc['provenance']['foundation_reviewed_on'], '2026-10-19')
        links = [attrs for tag, attrs in self.article.elements if tag == 'a' and attrs.get('href') == original]
        self.assertEqual(len(links), 1)
        self.assertIn('noreferrer', links[0]['rel'].split())
        self.assertEqual(links[0]['referrerpolicy'], 'no-referrer')
        self.assertNotIn('download', links[0])
        self.assertFalse(any(tag in ['iframe', 'video', 'object', 'embed'] for tag, _ in self.article.elements))
        # Accepted predecessor is independent evidence of the retained contracts.
        previous = json.loads((ROOT / 'web/archive/udall-1955-9e17a19743779426b292.json').read_bytes())
        for key in ['records', 'creators', 'media', 'reconstruction']:
            self.assertEqual(self.doc[key], previous[key], key + ' remains unchanged')
        self.assertNotIn('nws-wichita-udall-east', {row['id'] for row in previous['sources']})
        self.assertIn('No complete aftermath photo pixels', next(row for row in previous['observations']
                                                               if row['id'] == 'original-image-limits')['limits'])


if __name__ == '__main__':
    unittest.main()
