"""Exact three-event documentary addition, with preserved source and image limits."""
import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest
from tempfile import TemporaryDirectory

from atlas.archive import dossiers, validate_dossier
from response_continuation_support import RESPONSE_PROMOTIONS, response_predecessor
from reviewed_continuation_support import reviewed_predecessor

ROOT = Path(__file__).resolve().parents[1]
NOTE = 'research/response-reading-2026-10-30.md'
ASSET = 'assets/moore-2013/bruce_command.jpg'
PHOTO_URL = 'https://www.weather.gov/images/oun/wxevents/20130520/bruce_command.jpg'
PHOTO_SHA = 'b08b9dea73be54a692887caf361d262858561e8e8f4d912518a8dc8737e78281'
BASELINES = {
    'moore-2013': ('archive/moore-2013-5ed36647a0e6141f8dde.json', '0716a3b07a3b171686e9cf9b14f780327efc64b7074fcaddc379d59d1ba9a889', '5ed36647a0e6141f8ddeeee30ef7be9e7bb6332613ed86428b3b9b5536b25e85'),
    'udall-1955': ('archive/udall-1955-ea29259561776155de0d.json', 'e3f665325c67a5769e2f1d514d25229ffd2b702f73c60b56c23e077aa05b541e', 'ea29259561776155de0dce541ee11642c175258d8b6af476c5b143f1fed47bcf'),
    'blackwell-1955': ('archive/blackwell-1955-c0ccacb0fa341a0989a4.json', 'c4459214136b7c1f026a53a65a815a667778bd35aa95393dd79a19a8f74ce68d', 'c0ccacb0fa341a0989a4e16dc1d9e8ac040c07248ab3ceb1cb6a415daf0e29a2'),
}
ADDITIONS = {
    'moore-2013': {'sources': ['nws-moore-command-post'], 'creators': ['bruce-thoren-nws'], 'media': ['moore-command-post'], 'observations': ['moore-response-weather-support']},
    'udall-1955': {'observations': ['udall-directional-damage-comparison']},
    'blackwell-1955': {'observations': ['blackwell-witness-weather-sequences']},
}
ROUTES = {'moore-2013': 'moore.html#weather-support-after-the-tornado', 'blackwell-1955': 'blackwell.html#observations'}
SOURCE_CHANGES = {'moore-2013': 'nws-event-hub', 'blackwell-1955': 'nws-wichita'}
UNCHANGED = {
    'el-reno-2013': ('archive/el-reno-2013-3a4374318d08b471b959.json', 'fda8f908acffe9b264a19c3a6f1303dd709533138c20c97cdfee641e11503813', '3a4374318d08b471b95970693f1ef0d5c3a31f8935d978fd8ca39709987a93a9'),
    'joplin-2011': ('archive/joplin-2011-287b0f5e3036c9f76549.json', '9133b8b962c879c395a9125e78567d47dae2cd8c5f4b221b8da06ebbf0c52dc0', '287b0f5e3036c9f765497b6e5e9b4c6e3994699345decfd4c99f768373d6190c'),
    'tuscaloosa-birmingham-2011': ('archive/tuscaloosa-birmingham-2011-22697c0e0b3bcdf5fce7.json', 'fd8a0deb7a5dc0a7cf239a364dd46624b86a354e67a84cab110cf8bf1bcd353c', '22697c0e0b3bcdf5fce7b4ff7fb4e73e05186ae129d5fa65dc4830b982fe591e'),
}


def canonical(doc):
    return json.dumps(doc, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf8')


class Elements(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.rows = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.rows.append((tag, dict(attrs)))


class ResponseReadingTests(unittest.TestCase):
    def setUp(self):
        self.docs = {doc['id']: doc for doc in dossiers(ROOT)}

    def previous(self, event):
        file, wire, _ = BASELINES[event]
        raw = (ROOT / 'web' / file).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), wire)
        return json.loads(raw)

    def assert_preserved_delta(self, event, current):
        previous = self.previous(event)
        validate_dossier(current)
        expected = copy.deepcopy(previous)
        for field in ('creators', 'sources', 'observations', 'media'):
            added_ids = ADDITIONS[event].get(field, [])
            self.assertEqual([row['id'] for row in current[field]], [row['id'] for row in previous[field]] + added_ids)
            if field == 'sources' and event in SOURCE_CHANGES:
                source_id = SOURCE_CHANGES[event]
                old = next(row for row in expected[field] if row['id'] == source_id)
                new = next(row for row in current[field] if row['id'] == source_id)
                for leaf in ('locator', 'access', 'revision'):
                    self.assertTrue(new[leaf].startswith(old[leaf]), 'Old inspection context remains present')
                    self.assertNotEqual(new[leaf], old[leaf])
                    old[leaf] = new[leaf]
            expected[field] += [copy.deepcopy(row) for row in current[field] if row['id'] in added_ids]
        if event in ROUTES:
            self.assertEqual(current['routes'][:-1], previous['routes'])
            self.assertEqual(current['routes'][-1]['href'], ROUTES[event])
            expected['routes'].append(copy.deepcopy(current['routes'][-1]))
        old_provenance = expected['provenance']
        self.assertNotIn(NOTE, old_provenance['inputs'])
        old_provenance['inputs'][NOTE] = hashlib.sha256((ROOT / NOTE).read_bytes()).hexdigest()
        review = current['provenance']['publication_review']
        self.assertEqual(review['reviewer_kind'], 'agent')
        self.assertEqual(review['previous_dossier_sha256'], BASELINES[event][2])
        self.assertRegex(review['candidate_sha256'], r'^[0-9a-f]{64}$')
        self.assertTrue(review['basis'])
        self.assertEqual(set(review), set(old_provenance['publication_review']))
        old_provenance['publication_review'] = copy.deepcopy(review)
        self.assertEqual(current, expected, 'Every current difference must belong to the named addition')
        self.assertEqual(canonical(current), canonical(expected), 'Numeric forms and booleans remain distinct')

    def assert_photo_contract(self, doc):
        validate_dossier(doc)
        photo = next(row for row in doc['media'] if row['id'] == 'moore-command-post')
        self.assertEqual(photo['source_id'], 'nws-moore-command-post')
        self.assertEqual(photo['url'], PHOTO_URL)
        self.assertEqual(photo['roles'], {'creator': 'bruce-thoren-nws', 'uploader': 'nws-norman', 'rights_holder': None})
        self.assertIsNone(photo['parent'])
        self.assertEqual(photo['status']['assertion'], 'observed_sample')
        self.assertEqual(photo['status']['rights'], 'permitted_hosting')
        self.assertEqual(photo['status']['temporal'], 'source_label')
        self.assertEqual(photo['status']['spatial'], 'unregistered')
        self.assertIsNone(photo['place']['coordinates'])
        self.assertIsNone(photo['time']['alignment'])
        self.assertIsNone(photo['time']['video'])
        self.assertIsNone(photo['time']['publication'])
        self.assertEqual(photo['time']['capture']['reported_date'], 'May 22, 2013')
        self.assertEqual(photo['time']['capture']['precision'], 'source_caption_day')
        transform = photo['transformation']
        self.assertEqual((transform['asset'], transform['bytes'], transform['sha256'], transform['width'], transform['height']),
                         (ASSET, 1669372, PHOTO_SHA, 2592, 1936))
        source = next(row for row in doc['sources'] if row['id'] == 'nws-moore-command-post')
        self.assertEqual(source['url'], PHOTO_URL)
        self.assertIn('Bruce Thoren', source['rights'])
        self.assertIn('https://www.weather.gov/disclaimer', source['rights'])
        self.assertIn('courtesy storm photographs', source['rights'])

    def test_exact_current_delta_keeps_all_old_evidence_and_grants(self):
        for event in BASELINES:
            with self.subTest(event=event):
                self.assert_preserved_delta(event, self.docs[event])
                self.assertEqual(self.docs[event]['reconstruction'], self.previous(event)['reconstruction'])

    def test_other_three_current_dossiers_and_their_complete_bytes_are_unchanged(self):
        index = json.loads((ROOT / 'web/archive/index.json').read_bytes())
        entries = {row['id']: row for row in index['events']}
        for event, (file, wire, logical) in UNCHANGED.items():
            raw = (ROOT / 'web' / file).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), wire)
            self.assertEqual(canonical(self.docs[event]), canonical(json.loads(raw)))
            self.assertEqual(hashlib.sha256(canonical(self.docs[event])).hexdigest(), logical)
            self.assertEqual((entries[event]['file'], entries[event]['file_sha256'], entries[event]['dossier_sha256']), (file, wire, logical))

    def test_complete_new_image_has_the_independently_retained_original_identity(self):
        self.assert_photo_contract(self.docs['moore-2013'])
        raw = (ROOT / 'web' / ASSET).read_bytes()
        self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()), (1669372, PHOTO_SHA))
        self.assertEqual((raw[:2], raw[-2:]), (b'\xff\xd8', b'\xff\xd9'))
        # The literal hash comes from the independently inspected original, not the publisher.
        for adverse in (raw[:-1], raw[:-1] + bytes([raw[-1] ^ 1]), (ROOT / 'web/assets/moore-2013/IMG_9287-800.jpg').read_bytes()):
            self.assertNotEqual((len(adverse), hashlib.sha256(adverse).hexdigest()), (1669372, PHOTO_SHA))

    def test_valid_schema_cannot_upgrade_the_photo_to_calibrated_evidence(self):
        def photo(doc):
            return next(row for row in doc['media'] if row['id'] == 'moore-command-post')
        changes = [
            lambda row: row['time']['capture'].update(reported_date='June 6, 2013'),
            lambda row: row['time'].update(alignment={'utc': '2013-05-22T12:00:00Z', 'basis': 'unsupported test input'}),
            lambda row: row['place'].update(coordinates=[-97.5, 35.3]),
            lambda row: row['status'].update(spatial='source_reported'),
            lambda row: row['roles'].update(creator='doug-speheger'),
            lambda row: row.update(source_id='nws-event-hub'),
            lambda row: row['status'].update(rights='links_only'),
            lambda row: row['transformation'].update(sha256='f10b6b33fbcecd2c228632d2d681bbef47e58876246b753a04721dda3a58c6bb'),
        ]
        for mutate in changes:
            doc = copy.deepcopy(self.docs['moore-2013'])
            mutate(photo(doc))
            with self.assertRaises((AssertionError, ValueError)):
                self.assert_photo_contract(doc)

    def test_source_level_permission_or_old_media_changes_are_not_an_allowed_delta(self):
        doc = copy.deepcopy(self.docs['moore-2013'])
        next(row for row in doc['sources'] if row['id'] == 'nws-event-hub')['rights'] = 'All photographs on this page are hosted.'
        with self.assertRaises(AssertionError):
            self.assert_preserved_delta('moore-2013', doc)
        doc = copy.deepcopy(self.docs['udall-1955'])
        next(row for row in doc['observations'] if row['id'] == 'eastward-aftermath-scene')['status']['rights'] = 'permitted_hosting'
        with self.assertRaises(AssertionError):
            self.assert_preserved_delta('udall-1955', doc)

    def test_three_new_accounts_keep_their_source_kind_and_locations(self):
        specs = [('moore-2013', 'moore-response-weather-support', 'nws-event-hub', ('Warren Theater', 'May 21', '7 a.m.', '7 p.m.')),
                 ('udall-1955', 'udall-directional-damage-comparison', 'nws-wichita-storm-report', ('southwest', 'northeast', 'railway', 'water tower')),
                 ('blackwell-1955', 'blackwell-witness-weather-sequences', 'nws-wichita', ('southern Blackwell', 'north-side', 'Arkansas City', 'before', 'after'))]
        for event, item, source, facts in specs:
            row = next(row for row in self.docs[event]['observations'] if row['id'] == item)
            self.assertEqual(row['source_id'], source)
            for fact in facts:
                self.assertIn(fact, row['account'])
            self.assertEqual(row['status']['assertion'], 'source_reported')
            self.assertEqual(row['status']['rights'], 'links_only')
            self.assertEqual(row['status']['temporal'], 'unregistered')
            self.assertEqual(row['status']['spatial'], 'unregistered')
            self.assertIsNone(row['place']['coordinates'])
            for role in ('capture', 'publication', 'video', 'alignment'):
                self.assertIsNone(row['time'][role])
        blackwell = next(row for row in self.docs['blackwell-1955']['observations'] if row['id'] == 'blackwell-witness-weather-sequences')
        self.assertIn('Kansas', blackwell['place']['reported'])
        self.assertIn('not moved into Blackwell', blackwell['limits'])

    def test_native_article_retains_exact_full_image_and_source_routes(self):
        moore = (ROOT / 'web/moore.html').read_text(encoding='utf8')
        elements = Elements(moore).rows
        images = [attrs for tag, attrs in elements if tag == 'img' and attrs.get('src') == ASSET]
        self.assertEqual(len(images), 1)
        self.assertEqual((images[0]['width'], images[0]['height']), ('2592', '1936'))
        self.assertEqual(images[0]['alt'], 'People standing and sitting around tables with papers and communication equipment inside a fire-station bay.')
        hrefs = [attrs.get('href') for tag, attrs in elements if tag == 'a']
        self.assertIn('#weather-support-after-the-tornado', hrefs)
        self.assertIn(PHOTO_URL, hrefs)
        self.assertIn('dossier.html?event=moore-2013&media=moore-command-post#media-moore-command-post', hrefs)
        self.assertIn('dossier.html?event=moore-2013&source=nws-moore-command-post#source-nws-moore-command-post', hrefs)
        for file, item in [('udall', 'udall-directional-damage-comparison'), ('blackwell', 'blackwell-witness-weather-sequences')]:
            text = (ROOT / 'web' / (file + '.html')).read_text(encoding='utf8')
            self.assertIn('observation=' + item + '#observation-' + item, text)


    def test_three_exact_publication_edges_expose_only_their_retained_boundaries(self):
        self.assertEqual(set(RESPONSE_PROMOTIONS), {'moore-2013', 'udall-1955', 'blackwell-1955'})
        for event, spec in RESPONSE_PROMOTIONS.items():
            with self.subTest(event=event):
                current = self.docs[event]
                retained = response_predecessor(self, current)
                self.assertEqual(retained, self.previous(event))
                self.assertEqual(hashlib.sha256(canonical(current)).hexdigest(), spec['current'])
                self.assertEqual(hashlib.sha256(canonical(retained)).hexdigest(), BASELINES[event][2])
                self.assertIsNot(current, retained)
                self.assert_preserved_delta(event, current)
        # Blackwell then continues through its exact October 29 amendment. The
        # older media edition and its predecessor contract do not disappear.
        self.assertEqual(hashlib.sha256(canonical(reviewed_predecessor(self, self.docs['blackwell-1955']))).hexdigest(),
                         '9e74182ea8d0076dae452b9a29e44158793d5b2bafe7a237d7969ec336ea5b8b')

    def test_named_response_rows_are_not_open_ended_future_allowances(self):
        for event in BASELINES:
            changes = {
                'new account wording': lambda doc: doc['observations'][-1].__setitem__('account', 'Unreviewed replacement'),
                'new account coordinates': lambda doc: doc['observations'][-1]['place'].__setitem__('coordinates', [-97, 37]),
                'new account hosting': lambda doc: doc['observations'][-1]['status'].__setitem__('rights', 'permitted_hosting'),
                'old source rights': lambda doc: doc['sources'][0].__setitem__('rights', 'All media may be copied'),
                'extra row': lambda doc: doc['observations'].append(copy.deepcopy(doc['observations'][-1])),
                'future review': lambda doc: doc['provenance']['publication_review'].__setitem__('candidate_sha256', 'f' * 64),
                'different reviewer': lambda doc: doc['provenance']['publication_review'].__setitem__('reviewer_kind', 'other'),
                'extra input': lambda doc: doc['provenance']['inputs'].__setitem__('future.md', '0' * 64),
                'new reconstruction': lambda doc: doc['reconstruction']['intervals'].append({'start': 0, 'end': 1}),
            }
            for label, mutate in changes.items():
                with self.subTest(event=event, mutation=label):
                    current = copy.deepcopy(self.docs[event])
                    mutate(current)
                    with self.assertRaisesRegex(AssertionError, 'Only the exact reviewed continuation'):
                        response_predecessor(self, current)
        for event, source_id in SOURCE_CHANGES.items():
            current = copy.deepcopy(self.docs[event])
            next(row for row in current['sources'] if row['id'] == source_id)['access'] += ' Another unreviewed inspection.'
            with self.assertRaisesRegex(AssertionError, 'Only the exact reviewed continuation'):
                response_predecessor(self, current)

    def isolated_response_publication(self, destination, event):
        spec = RESPONSE_PROMOTIONS[event]
        for key in ('previous_file', 'current_file', 'previous_history_file', 'history_file'):
            path = destination / 'web' / spec[key]
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes((ROOT / 'web' / spec[key]).read_bytes())
        path = destination / NOTE
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((ROOT / NOTE).read_bytes())
        index = json.loads((ROOT / 'web/archive/index.json').read_bytes())
        entry = next(row for row in index['events'] if row['id'] == event)
        (destination / 'web/archive/index.json').write_text(json.dumps({'events': [entry]}), encoding='utf8')

    def test_each_retained_or_current_response_object_requires_its_exact_bytes(self):
        for event, spec in RESPONSE_PROMOTIONS.items():
            for key in ('previous_file', 'current_file', 'previous_history_file', 'history_file'):
                with self.subTest(event=event, object=key), TemporaryDirectory() as temporary:
                    isolated = Path(temporary)
                    self.isolated_response_publication(isolated, event)
                    response_predecessor(self, self.docs[event], isolated)
                    path = isolated / 'web' / spec[key]
                    path.write_bytes(path.read_bytes() + b'\n')
                    with self.assertRaisesRegex(AssertionError, 'Immutable reviewed response bytes changed'):
                        response_predecessor(self, self.docs[event], isolated)

    def test_response_index_and_provenance_cannot_point_at_another_valid_boundary(self):
        for event, spec in RESPONSE_PROMOTIONS.items():
            for field in ('file', 'dossier_sha256', 'history_file', 'registered_media'):
                with self.subTest(event=event, field=field), TemporaryDirectory() as temporary:
                    isolated = Path(temporary)
                    self.isolated_response_publication(isolated, event)
                    response_predecessor(self, self.docs[event], isolated)
                    path = isolated / 'web/archive/index.json'
                    index = json.loads(path.read_bytes())
                    index['events'][0][field] = {'file': spec['previous_file'], 'dossier_sha256': spec['previous'],
                        'history_file': spec['previous_history_file'], 'registered_media': 1}[field]
                    path.write_text(json.dumps(index), encoding='utf8')
                    with self.assertRaisesRegex(AssertionError, 'Exact current response index entry'):
                        response_predecessor(self, self.docs[event], isolated)
            with self.subTest(event=event, field='source note'), TemporaryDirectory() as temporary:
                isolated = Path(temporary)
                self.isolated_response_publication(isolated, event)
                response_predecessor(self, self.docs[event], isolated)
                path = isolated / NOTE
                path.write_bytes(path.read_bytes() + b'\n')
                with self.assertRaises(AssertionError):
                    response_predecessor(self, self.docs[event], isolated)


if __name__ == '__main__':
    unittest.main()
