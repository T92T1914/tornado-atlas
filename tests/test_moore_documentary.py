import hashlib
import json
from pathlib import Path
import unittest

from atlas.archive import validate_dossier, dossiers

ROOT = Path(__file__).resolve().parents[1]


class MooreDocumentaryTests(unittest.TestCase):
    def setUp(self):
        self.doc = next(row for row in dossiers(ROOT) if row['id'] == 'moore-2013')

    def test_two_county_records_remain_one_unregistered_documentary(self):
        validate_dossier(self.doc)
        self.assertEqual([r['id'] for r in self.doc['records']], ['ncei:451537', 'ncei:451572'])
        self.assertEqual(self.doc['reconstruction']['appearance'], 'unregistered')
        self.assertEqual(self.doc['reconstruction']['intervals'], [])
        event = next(r for r in json.loads((ROOT / 'exhibits/events.json').read_bytes())['events'] if r['id'] == 'moore-2013')
        self.assertEqual(event['documentary'], 'moore.html')
        self.assertIsNone(event['replay'])
        self.assertIsNone(event['chronology'])

    def test_rating_revision_and_unsynchronized_siren_are_source_reported(self):
        observations = {r['id']: r for r in self.doc['observations']}
        revised = observations['briarwood-rating-revision']
        self.assertEqual(revised['source_id'], 'ncei-cleveland-451572')
        self.assertIn('EF4', revised['account'])
        self.assertIn('EF5', revised['account'])
        siren = observations['reported-siren-clock']
        self.assertIn('2:42:34', siren['account'])
        self.assertEqual(siren['status']['temporal'], 'source_label')
        self.assertIsNone(siren['time']['alignment'])

    def test_two_qualified_agency_photograph_versions_remain_exact(self):
        expected = {
            'assets/moore-2013/IMG_2314-800.jpg': (410330, 'd53b38069c63ec7508cece9e4a70b11fabf45aad090fa072bc7f115efd2ac7e6', 800, 600),
            'assets/moore-2013/IMG_9287-800.jpg': (339582, 'f10b6b33fbcecd2c228632d2d681bbef47e58876246b753a04721dda3a58c6bb', 800, 533),
        }
        photos = [row for row in self.doc['media'] if row['kind'] == 'photograph']
        self.assertEqual(len(photos), 2)
        self.assertEqual({r['transformation']['asset'] for r in photos}, set(expected))
        for row in photos:
            asset = row['transformation']
            size, sha, width, height = expected[asset['asset']]
            raw = (ROOT / 'web' / asset['asset']).read_bytes()
            self.assertEqual(len(raw), size)
            self.assertEqual(hashlib.sha256(raw).hexdigest(), sha)
            self.assertEqual((asset['width'], asset['height']), (width, height))
            self.assertEqual(row['status']['rights'], 'permitted_hosting')
            self.assertIsNone(row['place']['coordinates'])
            self.assertIsNone(row['time']['alignment'])
            self.assertNotEqual(asset['parent_sha256'], sha)



    def test_original_radar_sequences_and_static_posters_have_separate_identities(self):
        expected = {
            'moore-ktlx-reflectivity-loop': ('ref', 4621244, 'ad49be3837ff98d9082d6c6e7525d546b12e4342b43a09fad7281c7ed43b2a41', 512786, '62293ccff370acd1cdc2ffbd2f6823b7d42c704981f16e07dc912dc37911adb8'),
            'moore-ktlx-storm-relative-velocity-loop': ('srv', 4256310, '82f45919ef9752dcc009dd4c4ba31141776cb67606d357fbea172ad02eba576c', 588824, 'e4a6a61bdd0d2467307e84f6431855fedcfb8d6ad782268e4b585a6cc6719cb9'),
        }
        radar = {row['id']: row for row in self.doc['media'] if row['kind'] == 'radar'}
        self.assertEqual(set(radar), set(expected))
        names = {'IMG_2314-800.jpg', 'IMG_9287-800.jpg'}
        for item, (product, size, digest, poster_size, poster_digest) in expected.items():
            row = radar[item]
            transform = row['transformation']
            animation = transform['animation']
            stem = 'newcastle-moore-' + product
            for filename, actual, wanted_size, wanted_digest in (
                (stem + '.gif', animation, size, digest),
                (stem + '-poster.png', transform, poster_size, poster_digest),
            ):
                names.add(filename)
                self.assertEqual(actual['asset'], 'assets/moore-2013/' + filename)
                raw = (ROOT / 'web' / actual['asset']).read_bytes()
                self.assertEqual(len(raw), wanted_size)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), wanted_digest)
                self.assertEqual((actual['width'], actual['height']), (800, 558))
                self.assertEqual(actual['sha256'], wanted_digest)
            self.assertEqual((animation['presentations'], animation['stored_delay_ms']), (24, 350))
            self.assertEqual(animation['poster_presentation'], 0)
            self.assertIsNone(animation['clock_alignment'])
            self.assertEqual(row['status']['rights'], 'permitted_hosting')
            self.assertEqual(row['status']['temporal'], 'source_label')
            self.assertIsNone(row['time']['alignment'])
            self.assertIsNone(row['place']['coordinates'])
            self.assertIn('one hour', row['limits'])
            self.assertIn('VST and Prod remain separate', row['time']['capture']['disposition'])
        self.assertEqual({p.name for p in (ROOT / 'web/assets/moore-2013').iterdir()}, names)

    def test_accepted_moore_evidence_is_preserved_when_radar_is_added(self):
        previous = json.loads((ROOT / 'web/archive/moore-2013-b871ef828cd8a1c475bc.json').read_bytes())
        self.assertEqual(len(previous['observations']), 14)
        for field in ('records', 'creators', 'observations', 'reconstruction'):
            self.assertEqual(self.doc[field], previous[field])
        for field in ('sources', 'media', 'routes'):
            for row in previous[field]:
                self.assertIn(row, self.doc[field])

    def test_school_accounts_preserve_source_kind_and_unknown_registration(self):
        # These expectations come from the selected NIST report passages,
        # independently of the archive projection generated by Atlas.
        expected = {
            'plaza-reported-refuge-change': ('printed page 29 / PDF page 53', 'teacher'),
            'plaza-roof-wall-performance': ('printed page 31 / PDF page 55', 'suggests'),
            'briarwood-400-refuge-envelope': ('printed page 36 / PDF page 60', 'Building 400'),
        }
        observations = {row['id']: row for row in self.doc['observations']}
        for item, (locator, evidence_kind) in expected.items():
            with self.subTest(observation=item):
                row = observations[item]
                self.assertEqual(row['source_id'], 'nist-sp1164')
                self.assertIn(locator, row['locator'])
                self.assertIn(evidence_kind.lower(), row['account'].lower())
                self.assertEqual(row['status']['assertion'], 'source_reported')
                self.assertEqual(row['status']['temporal'], 'unregistered')
                self.assertEqual(row['status']['spatial'], 'unregistered')
                self.assertEqual(row['status']['rights'], 'links_only')
                self.assertIsNone(row['time']['capture'])
                self.assertIsNone(row['time']['video'])
                self.assertIsNone(row['time']['alignment'])
                self.assertIsNone(row['place']['coordinates'])
        briarwood = observations['briarwood-400-refuge-envelope']
        self.assertIn('EF4', briarwood['limits'])
        self.assertIn('initial EF5', briarwood['limits'])
        self.assertIn('not registered to Building 400', briarwood['limits'])
        self.assertEqual(self.doc['reconstruction']['intervals'], [])

    def test_school_reader_routes_keep_their_article_and_lab_context(self):
        html = (ROOT / 'web/moore.html').read_text(encoding='utf-8')
        routes = {row['href'] for row in self.doc['routes']}
        for anchor in ('plaza-towers-refuge', 'briarwood-refuge', 'schools-and-model-limits'):
            with self.subTest(anchor=anchor):
                self.assertIn('moore.html#' + anchor, routes)
                self.assertIn('id="' + anchor + '"', html)
        for item in ('plaza-reported-refuge-change', 'plaza-roof-wall-performance', 'briarwood-400-refuge-envelope'):
            with self.subTest(observation=item):
                self.assertIn('dossier.html?event=moore-2013&amp;observation=' + item + '#observation-' + item, html)
        self.assertIn('wind.html?event=moore-2013#wind-model-limits', html)
        self.assertIn("NIST's December 2013 school section also retains that initial interpretation.", html)
        self.assertIn('further evaluation supported EF4', html)
        self.assertIn('No school outcome here calibrates the experiment or certifies a shelter.', html)


if __name__ == '__main__':
    unittest.main()
