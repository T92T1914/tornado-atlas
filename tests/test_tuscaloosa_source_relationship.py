"""The published relation stays discrete, attributed and separate from UTC."""
import json
from pathlib import Path
import unittest
from atlas.archive import dossiers, digest, validate_dossier
from atlas.evidence_coverage import layer_references

ROOT = Path(__file__).resolve().parents[1]


class TuscaloosaSourceRelationshipTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = next(x for x in dossiers() if x['id'] == 'tuscaloosa-birmingham-2011')
        cls.old = json.loads((ROOT / 'web/archive/tuscaloosa-birmingham-2011-86b0d953102d962b43c5.json').read_text(encoding='utf8'))

    def test_prior_evidence_identity_order_and_source_limits_survive(self):
        for field in ('records', 'routes', 'creators', 'media', 'reconstruction'):
            self.assertEqual(digest(self.doc[field]), digest(self.old[field]))
        for field in ('sources', 'observations'):
            self.assertEqual(digest(self.doc[field][:len(self.old[field])]), digest(self.old[field]))
        self.assertEqual(self.doc['reconstruction']['intervals'], [])
        self.assertEqual(self.doc['coverage'], 'Exhibit')
        self.assertEqual(self.doc['provenance']['publication_review']['previous_dossier_sha256'], digest(self.old))

    def test_source_is_the_inspected_links_only_publication(self):
        s = next(x for x in self.doc['sources'] if x['id'] == 'oliveira-2022-trailing-vortices')
        self.assertEqual(s['url'], 'https://twister.caps.ou.edu/papers/Oliveira_Xue_RobertsBAMS2022.pdf')
        self.assertIn('d495402ae2f2b6b883ba4517c89fa83d8158c7a969fad26a5e56b8417f06161a', s['revision'])
        self.assertIn('one publication stream', s['agent_processing'])
        self.assertIn('does not grant Atlas', s['rights'])
        self.assertIn('No2022figure', s['rights'])

    def test_four_published_samples_have_no_player_bounds_or_historical_alignment(self):
        for panel, label in zip('abcd', ('04:22', '04:27', '04:30', '04:32')):
            o = next(x for x in self.doc['observations'] if x['id'] == 'rosolowski-2022-panel-' + panel)
            self.assertIn(label, o['locator'])
            self.assertIn('5ohIVzIZLuQ', o['locator'])
            self.assertEqual(o['source_id'], 'oliveira-2022-trailing-vortices')
            self.assertEqual(o['status']['assertion'], 'source_reported')
            self.assertEqual(o['status']['temporal'], 'source_label')
            self.assertEqual(o['status']['rights'], 'links_only')
            for field in ('capture', 'alignment', 'video'):
                self.assertIsNone(o['time'][field])
            self.assertIsNone(o['place']['coordinates'])
            self.assertIn('intervening footage are unknown', o['limits'])
        b = next(x for x in self.doc['observations'] if x['id'] == 'rosolowski-2022-panel-b')
        self.assertIn('counterclockwise', b['account'])
        self.assertIn('not a recovered camera orientation', b['limits'])

    def test_reported_camera_is_context_not_frame_calibration(self):
        o = next(x for x in self.doc['observations'] if x['id'] == 'rosolowski-2022-reported-viewpoint')
        self.assertEqual(o['place']['coordinates'], [-87.52420, 33.19472])
        self.assertEqual(o['place']['role'], 'camera')
        self.assertEqual(o['status']['spatial'], 'source_reported')
        self.assertIn('damage-path centerline', o['account'])
        self.assertIn('not measured field accuracy', o['limits'])
        self.assertIn('does not supply an independent second constraint', o['limits'])
        refs = layer_references(ROOT, self.doc)
        self.assertIn(o['id'], refs['geography']['observations'])
        self.assertEqual(refs['appearance']['observations'], ['rosolowski-2022-panel-' + p for p in 'abcd'])
        self.assertIs(validate_dossier(self.doc), self.doc)


if __name__ == '__main__':
    unittest.main()
