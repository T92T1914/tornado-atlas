"""Editorial summaries cannot silently revise the surviving historical evidence."""
import copy
import json
from pathlib import Path
import unittest

from atlas.archive import digest, dossiers, dossier_history
from museum_test_support import CURRENT_LIMITS, STATIC_SURVEY_LIMITS, assert_preserved_field

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = '00443cb7e5034a74e86d0f57c423e1b2bb7d13183bc8ed288c9c98b33b7d0405'
SUMMARY = 'dcdd215f71a4258fadc5bf7f7e43e7f58373d629b62f317cc31354bc43c362cd'
EVENT = 'tuscaloosa-birmingham-2011'


class MuseumSourcePreservationTests(unittest.TestCase):
    def test_summary_and_static_survey_preserve_every_older_evidence_value(self):
        previous = json.loads((ROOT / f'web/archive/{EVENT}-{PREVIOUS[:20]}.json').read_text(encoding='utf-8'))
        self.assertEqual(digest(previous), PREVIOUS)
        summary = json.loads((ROOT / f'web/archive/{EVENT}-{SUMMARY[:20]}.json').read_text(encoding='utf-8'))
        self.assertEqual(digest(summary), SUMMARY)
        expected = copy.deepcopy(previous)
        expected['reconstruction']['limits'] = CURRENT_LIMITS
        expected['provenance']['publication_review'] = summary['provenance']['publication_review']
        self.assertEqual(summary, expected)
        self.assertEqual(summary['provenance']['publication_review']['previous_dossier_sha256'], PREVIOUS)

        current = next(row for row in dossiers() if row['id'] == EVENT)
        expected = copy.deepcopy(summary)
        additions = {'sources':['bmx-estimated-damage-map'],
                     'observations':['bmx-estimated-footprint','bmx-198-damage-accounts'],
                     'media':['bmx-static-survey-map'],
                     'routes':[{'label':'Explore the estimated footprint and survey accounts',
                                'href':'tuscaloosa.html#damage-map'}]}
        for field, identities in additions.items():
            count = len(summary[field])
            self.assertEqual(current[field][:count], summary[field], field)
            added = current[field][count:]
            self.assertEqual(added if field == 'routes' else [row['id'] for row in added], identities, field)
            # Added values have source-specific tests. This equality protects every older value.
            expected[field] = current[field]
        expected['reconstruction']['limits'] = STATIC_SURVEY_LIMITS
        expected['provenance']['static_survey_increment'] = {
                  "source_basis_revision": "317eac9d1473f670a680f84e16025be8cbfe50b1",
                  "research_record": "research/tuscaloosa-static-survey-2026-10-12.md",
                  "source_item": "0deae8ed1989461faf99b315bb0e3126",
                  "source_item_sha256": "03c21fb62f6aa0f6af26ca853ebd09364ca552e952eecf8ebf158587dea5b831",
                  "source_data_sha256": "dcc72bcd35da89d8bf4095516e066b164116a9bfa94cce858a43877c6078a025",
                  "survey_package": {
                            "schema_version": 1,
                            "event_id": "tuscaloosa-birmingham-2011",
                            "file": "events/tuscaloosa-birmingham-2011-survey-0a74c2fc7001f9348cc2.json",
                            "bytes": 196105,
                            "sha256": "0a74c2fc7001f9348cc225ab0b7c2bed31d2b3070fbb2fb086f8234144429ebc",
                            "source_data_sha256": "dcc72bcd35da89d8bf4095516e066b164116a9bfa94cce858a43877c6078a025"
                  },
                  "scope": "Retained estimated source geometry and 198 original accounts, projection consistency and relative source geometry only. No new source-image inspection, impact clock or historical calibration."
        }
        expected['provenance']['publication_review'] = current['provenance']['publication_review']
        self.assertEqual(current, expected)
        self.assertEqual(current['provenance']['publication_review']['previous_dossier_sha256'], SUMMARY)
        versions = dossier_history(current)['versions']
        summary_change = next(row for row in versions if row['dossier_sha256'] == SUMMARY)
        self.assertEqual(summary_change['changes'], [{'kind':'dossier','id':EVENT,'change':'updated','fields':['reconstruction']}])
        latest = next(row for row in versions if row['dossier_sha256'] == digest(current))
        self.assertEqual(latest['changes'], [
            {'kind':'sources','id':'bmx-estimated-damage-map','change':'added','fields':[]},
            {'kind':'observations','id':'bmx-198-damage-accounts','change':'added','fields':[]},
            {'kind':'observations','id':'bmx-estimated-footprint','change':'added','fields':[]},
            {'kind':'media','id':'bmx-static-survey-map','change':'added','fields':[]},
            {'kind':'dossier','id':EVENT,'change':'updated','fields':['routes']},
            {'kind':'dossier','id':EVENT,'change':'updated','fields':['reconstruction']}])

    def test_the_summary_exception_rejects_new_registration_or_arbitrary_text(self):
        previous = json.loads((ROOT / f'web/archive/{EVENT}-{PREVIOUS[:20]}.json').read_text(encoding='utf-8'))['reconstruction']
        current = {**previous, 'limits':STATIC_SURVEY_LIMITS}
        assert_preserved_field(self, current, previous, 'reconstruction')
        for field, value in [('appearance','registered'),('intervals',[{'invented':True}]),('limits','Everything has been inspected')]:
            with self.subTest(field=field):
                changed = {**current, field:value}
                with self.assertRaises(AssertionError):
                    assert_preserved_field(self, changed, previous, 'reconstruction')
