"""Editorial summaries cannot silently revise the surviving historical evidence."""
import copy
import json
from pathlib import Path
import unittest

from atlas.archive import digest, dossiers, dossier_history
from museum_test_support import CURRENT_LIMITS, assert_preserved_field

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = '00443cb7e5034a74e86d0f57c423e1b2bb7d13183bc8ed288c9c98b33b7d0405'
EVENT = 'tuscaloosa-birmingham-2011'


class MuseumSourcePreservationTests(unittest.TestCase):
    def test_summary_changes_only_the_qualified_photograph_account(self):
        previous = json.loads((ROOT / f'web/archive/{EVENT}-{PREVIOUS[:20]}.json').read_text(encoding='utf-8'))
        self.assertEqual(digest(previous), PREVIOUS)
        current = next(row for row in dossiers() if row['id'] == EVENT)
        expected = copy.deepcopy(previous)
        expected['reconstruction']['limits'] = CURRENT_LIMITS
        expected['provenance']['publication_review'] = current['provenance']['publication_review']
        self.assertEqual(current, expected)
        self.assertEqual(current['provenance']['publication_review']['previous_dossier_sha256'], PREVIOUS)
        latest = next(row for row in dossier_history(current)['versions'] if row['dossier_sha256'] == digest(current))
        self.assertEqual(latest['changes'], [{'kind':'dossier','id':EVENT,'change':'updated','fields':['reconstruction']}])

    def test_the_summary_exception_rejects_new_registration_or_arbitrary_text(self):
        previous = json.loads((ROOT / f'web/archive/{EVENT}-{PREVIOUS[:20]}.json').read_text(encoding='utf-8'))['reconstruction']
        current = {**previous, 'limits':CURRENT_LIMITS}
        for field, value in [('appearance','registered'),('intervals',[{'invented':True}]),('limits','Everything has been inspected')]:
            with self.subTest(field=field):
                changed = {**current, field:value}
                with self.assertRaises(AssertionError):
                    assert_preserved_field(self, changed, previous, 'reconstruction')
