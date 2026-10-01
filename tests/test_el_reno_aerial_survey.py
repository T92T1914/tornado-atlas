"""An attributed damage envelope cannot replace a tornado measurement."""
import hashlib
import json
from pathlib import Path
import unittest

from atlas.archive import digest, dossiers, publication

ROOT = Path(__file__).resolve().parents[1]
OLD = 'archive/el-reno-2013-a28dea62672e27329fd8.json'
OLD_SHA256 = '30c921bff6be754e67cb3e575648e3f796bba5866a71fd4a31d38d1be4e62e08'
SOURCE_ID = 'wakimoto-aerial-2016'
NEW_ID = 'intake-wakimoto-aerial-envelope-2016'


class ElRenoAerialSurveyTests(unittest.TestCase):
    def test_prior_dossier_remains_available_without_changed_evidence(self):
        raw = (ROOT / 'web' / OLD).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), OLD_SHA256)
        old = json.loads(raw)
        current = next(d for d in dossiers() if d['id'] == old['id'])
        self.assertEqual([o for o in current['observations'] if o['id'] != NEW_ID], old['observations'])
        self.assertEqual([s for s in current['sources'] if s['id'] != SOURCE_ID], old['sources'])
        for key in ('records', 'routes', 'media', 'creators', 'reconstruction'):
            self.assertEqual(current[key], old[key])
        self.assertEqual(current['provenance']['publication_review']['previous_dossier_sha256'], digest(old))
        self.assertEqual(current['provenance']['inputs'], old['provenance']['inputs'])

    def test_survey_dates_and_publication_do_not_register_an_event_clock(self):
        doc = next(d for d in dossiers() if d['id'] == 'el-reno-2013')
        rows = [o for o in doc['observations'] if o['id'] == NEW_ID]
        self.assertEqual(len(rows), 1)
        item = rows[0]
        self.assertEqual(item['source_id'], SOURCE_ID)
        self.assertEqual(item['status'], {
            'intake': 'published', 'assertion': 'source_reported',
            'temporal': 'unregistered', 'spatial': 'unregistered',
            'availability': 'reviewed_available', 'rights': 'links_only'})
        self.assertEqual(item['time']['event']['reported'], '2013-05-31')
        self.assertEqual(item['time']['capture']['ground_surveys'], ['2013-06-01', '2013-06-03'])
        self.assertEqual(item['time']['capture']['aerial_survey'], '2013-06-04')
        self.assertEqual(item['time']['publication'], '2016-05')
        for role in ('retrieval', 'video', 'alignment'):
            self.assertIsNone(item['time'][role])
        self.assertIsNone(item['place']['coordinates'])
        self.assertIn('No new human review', item['review'])

    def test_envelope_qualification_stays_beside_the_attributed_width(self):
        doc = next(d for d in dossiers() if d['id'] == 'el-reno-2013')
        item = next(o for o in doc['observations'] if o['id'] == NEW_ID)
        self.assertIn('roughly 7 km', item['account'])
        self.assertIn('separate anticyclonic tornado', item['account'])
        self.assertIn('suggests rear-flank downdraft damage', item['account'])
        self.assertIn('does not replace the NWS 2.6-mile (about 4.2 km)', item['limits'])
        self.assertIn('final EF3 damage rating', item['limits'])
        official = json.loads((ROOT / 'exhibits/el-reno-2013/dossier.json').read_text(encoding='utf-8'))
        facts = {f['label']: f['value'] for f in official['facts']}
        self.assertEqual(facts['Reported maximum tornado width'], '2.6 mi')
        self.assertEqual(facts['Final damage rating'], 'EF3')
        source = next(s for s in doc['sources'] if s['id'] == SOURCE_ID)
        self.assertIn('10.1175/MWR-D-15-0367.1', source['locator'])
        self.assertIn('7ce3c5d8dc1d643417fecddbd802aef3869a9e32ec60d892c973599104c7be50', source['revision'])
        self.assertIn('No PDF or figure republication permission', source['rights'])
        self.assertEqual(len([s for s in doc['sources'] if s['id'] == 'wakimoto-2015']), 1)

    def test_generated_dossier_and_exhibit_link_expose_the_new_observation(self):
        artifacts = publication()
        entry = next(e for e in artifacts['archive/index.json']['events'] if e['id'] == 'el-reno-2013')
        self.assertNotEqual(entry['file'], OLD)
        self.assertEqual(entry['registered_media'], 0)
        current = artifacts[entry['file']]
        self.assertEqual(json.loads((ROOT / 'web' / entry['file']).read_text(encoding='utf-8')), current)
        self.assertNotIn('curator', current['provenance'])
        self.assertNotIn('private_notes', current)
        chapter = (ROOT / 'web/index.html').read_text(encoding='utf-8')
        self.assertIn('observation=' + NEW_ID + '#observation-' + NEW_ID, chapter)


if __name__ == '__main__':
    unittest.main()
