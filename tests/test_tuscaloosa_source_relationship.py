"""The published relation stays discrete, attributed and separate from UTC."""
import json
from pathlib import Path
import unittest
from atlas.archive import dossiers, digest, validate_dossier
from atlas.evidence_coverage import layer_references
from test_article_reading import BASELINES, READING_ROUTES

ROOT = Path(__file__).resolve().parents[1]


class TuscaloosaSourceRelationshipTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = next(x for x in dossiers() if x['id'] == 'tuscaloosa-birmingham-2011')
        cls.old = json.loads((ROOT / 'web/archive/tuscaloosa-birmingham-2011-86b0d953102d962b43c5.json').read_text(encoding='utf8'))

    def test_prior_evidence_identity_order_and_source_limits_survive(self):
        for field in ('records', 'creators', 'media', 'reconstruction'):
            self.assertEqual(digest(self.doc[field]), digest(self.old[field]))
        self.assertEqual(self.doc['routes'], self.old['routes'] + READING_ROUTES[self.doc['id']] + [
            {'label': 'Read recovery planning and local remembrance',
             'href': 'tuscaloosa.html#recovery-and-remembrance'}])
        for field in ('sources', 'observations'):
            self.assertEqual(digest(self.doc[field][:len(self.old[field])]), digest(self.old[field]))
        self.assertEqual(self.doc['reconstruction']['intervals'], [])
        self.assertEqual(self.doc['coverage'], 'Exhibit')
        accepted_sha = BASELINES[self.doc['id']]
        accepted = json.loads((ROOT / 'web/archive' /
                               (self.doc['id'] + '-' + accepted_sha[:20] + '.json')).read_bytes())
        self.assertEqual(digest(accepted), accepted_sha)
        self.assertEqual(accepted['provenance']['publication_review']['previous_dossier_sha256'], digest(self.old))
        reading_sha = '63b08e0460f38874aeb9f56825860abb768886cb6eea408e5415e9215bcc4a64'
        reading = json.loads((ROOT / 'web/archive' /
                             (self.doc['id'] + '-' + reading_sha[:20] + '.json')).read_bytes())
        self.assertEqual(digest(reading), reading_sha)
        self.assertEqual(reading['provenance']['publication_review']['previous_dossier_sha256'], accepted_sha)
        intermediate_sha = 'f880ae503c3cb6ef1ebefec27a81f1d9f558abeb9b11eeea8dd59e3962371297'
        intermediate = json.loads((ROOT / 'web/archive' /
                                  (self.doc['id'] + '-' + intermediate_sha[:20] + '.json')).read_bytes())
        self.assertEqual(digest(intermediate), intermediate_sha)
        self.assertEqual(intermediate['provenance']['publication_review']['previous_dossier_sha256'], reading_sha)
        self.assertEqual(self.doc['provenance']['publication_review']['previous_dossier_sha256'], intermediate_sha)

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
