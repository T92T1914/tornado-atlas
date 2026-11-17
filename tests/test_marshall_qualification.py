"""The Marshall candidate near 2314:42 UTC stays out of the El Reno package.

The registration below holds only what research/marshall-qualification-2026-11-16.md
says exists. Unknown inputs stay None rather than invented values, so the
validator must refuse the window. A later admission needs a new decision record.
"""
import copy
import json
from pathlib import Path
import unittest

from atlas.event_package import validate_replay

ROOT = Path(__file__).resolve().parents[1]
RECORD = ROOT / 'research/marshall-qualification-2026-11-16.md'
MARSHALL_URL = 'https://player.vimeo.com/video/143033121'


def marshall_candidate():
    return {
        'id': 'marshall-2314',
        'start_utc': '2013-05-31T23:13:27Z',
        'end_utc': '2013-05-31T23:15:49Z',
        'source_id': 'marshall-survey',
        'kind': 'registered',
        'basis': 'Seimon and colleagues Fig. 4b names this view at 2314:42 UTC.',
        'registration': {
            'source': {'url': MARSHALL_URL, 'video_id': '143033121',
                       'original_locator': MARSHALL_URL, 'edit_identity': 'El Reno Survey edit',
                       'sha256': None,
                       'identity_basis': 'Attached by the Survey metadata, not public on 2026-11-16.'},
            'inspection': {'status': 'not_inspected', 'start_video_seconds': None,
                           'end_video_seconds': None, 'reviewed_on': '2026-11-16',
                           'discontinuities': 'unknown',
                           'basis': 'No frame of this interval has been seen.'},
            'timing': {'method': None, 'anchors': [], 'uncertainty_seconds': None,
                       'basis': 'Track times are position fixes, not frames.'},
            'camera': {'mode': 'fixed_view', 'coordinates': [-97.954941, 35.488103],
                       'bearing_degrees': 225, 'pitch_degrees': None, 'roll_degrees': None,
                       'position_uncertainty_m': None, 'orientation_uncertainty_degrees': None,
                       'lens_calibration': None,
                       'basis': 'Reported by the Survey metadata at 23:13:27Z, 23:14:38Z and 23:15:49Z.'},
            'rights': {'reuse': 'external_links_only', 'creator': 'Tim Marshall', 'uploader': None,
                       'rights_holder': 'Tim Marshall',
                       'basis': 'Survey terms restrict use to the Survey and researchers.'},
            'uncertainty': None,
        },
        'keys': [{'at': 0, 'shape': 'wedge', 'extent': .5, 'label': 'No inspected observation'},
                 {'at': 1, 'shape': 'wedge', 'extent': .5, 'label': 'No inspected observation'}],
    }


class MarshallQualificationTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((ROOT / 'exhibits/el-reno-2013/replay.json').read_text(encoding='utf-8'))
        self.bundle = json.loads((ROOT / 'web/data.json').read_text(encoding='utf-8'))

    def test_published_package_admits_no_marshall_source_or_window(self):
        # A registered window must name a footage source, so a Marshall window
        # cannot enter without one of these sources.
        validate_replay(self.config, self.bundle)
        marshall = {s['id'] for s in self.bundle['footage']['sources']
                    if '143033121' in (s.get('url') or '') or 'Marshall' in (s.get('creator') or '')}
        self.assertEqual(marshall, set())
        windows = self.bundle['appearance_timeline']['windows']
        self.assertEqual([w['id'] for w in windows
                          if w['kind'] == 'registered' and w['source_id'] in marshall], [])

    def test_candidate_is_refused_without_a_footage_source(self):
        bundle = copy.deepcopy(self.bundle)
        bundle['appearance_timeline']['windows'] = [marshall_candidate()]
        with self.assertRaisesRegex(ValueError, 'matching footage source'):
            validate_replay(self.config, bundle)

    def test_candidate_is_refused_even_with_a_declared_source(self):
        # Declaring the Survey edit as a footage source does not inspect it.
        bundle = copy.deepcopy(self.bundle)
        bundle['footage']['sources'].append({
            'id': 'marshall-survey', 'video_id': '143033121', 'url': MARSHALL_URL,
            'creator': 'Tim Marshall', 'duration_seconds': None,
        })
        bundle['appearance_timeline']['windows'] = [marshall_candidate()]
        with self.assertRaisesRegex(ValueError, 'continuous video inspection'):
            validate_replay(self.config, bundle)

    def test_decision_record_gives_no_contract_part_a_passing_result(self):
        text = RECORD.read_text(encoding='utf-8')
        self.assertIn('\nNot admitted.', text)
        section = text.split('## The contract, part by part', 1)[1].split('\n## ', 1)[0]
        rows = [line for line in section.splitlines() if line.startswith('| ') and not line.startswith('| Contract part')]
        results = {}
        for line in rows:
            cells = [cell.strip() for cell in line.strip('|').split('|')]
            self.assertEqual(len(cells), 4, line)
            results.setdefault(cells[0], []).append(cells[3])
        for part in ('Footage source', '`source`', '`inspection`', '`timing`', '`camera`', '`rights`', '`uncertainty`'):
            with self.subTest(part=part):
                found = [result for label, values in results.items() if label.startswith(part) for result in values]
                self.assertTrue(found, part)
                for result in found:
                    self.assertFalse(result.lower().startswith('pass'), result)
                    self.assertRegex(result, r'^(Fails|Reported value only|No usable route)')


if __name__ == '__main__':
    unittest.main()
