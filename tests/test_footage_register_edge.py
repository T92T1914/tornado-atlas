"""The El Reno dossier version that follows the footage register.

The footage register now carries the reviewed shot register of Robinson's
upload. These tests hold the new dossier version to an exact edge whose every
change is the adapter's projection of that register, and check that the edge
refuses anything else. A later spacing edge sits above this one, so the edge
itself is tested on the version that spacing edge retained.
"""
import copy
import unittest

from atlas.archive import dossiers
from footage_continuation_support import (FOOTAGE_PROMOTIONS, ROOT, _footage_edge, canonical, footage_boundary,
                                          footage_index_entry)
from spacing_continuation_support import LATE_SPACING_PROMOTIONS, SPACING_PROMOTIONS, late_spacing_boundary


class FootageRegisterEdgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docs = {doc['id']: doc for doc in dossiers(ROOT)}
        cls.spec = FOOTAGE_PROMOTIONS['el-reno-2013']

    def setUp(self):
        # The footage register version as the later spacing edge retained it, with its index entry.
        self.footage, self.entry = late_spacing_boundary(self, self.docs['el-reno-2013'])

    def test_the_edge_returns_the_spaced_predecessor_and_its_index_entry(self):
        previous, entry = footage_boundary(self, self.docs['el-reno-2013'])
        self.assertEqual(canonical(previous), self.spec['previous'])
        self.assertEqual(canonical(entry), self.spec['previous_index_sha256'])
        spaced = SPACING_PROMOTIONS['el-reno-2013'][-1]
        self.assertEqual((self.spec['previous'], self.spec['previous_index_sha256'], self.spec['previous_history_file']),
                         (spaced['current'], spaced['current_index_sha256'], spaced['history_file']))
        later = LATE_SPACING_PROMOTIONS['el-reno-2013'][0]
        self.assertEqual((later['previous'], later['previous_index_sha256'], later['previous_history_file']),
                         (self.spec['current'], self.spec['current_index_sha256'], self.spec['history_file']))
        self.assertEqual(canonical(self.footage), self.spec['current'])

    def test_events_without_the_edge_come_back_unchanged(self):
        for event, doc in self.docs.items():
            if event in FOOTAGE_PROMOTIONS:
                continue
            with self.subTest(event=event):
                self.assertEqual(footage_boundary(self, doc), (doc, None))
                entry = {'id': event}
                self.assertIs(footage_index_entry(self, entry), entry)

    def test_the_current_dossier_says_what_the_register_shows(self):
        doc = self.docs['el-reno-2013']
        media = {row['id']: row for row in doc['media']}
        for identity in ('robinson-04', 'robinson-05'):
            self.assertIn('rear camera', media[identity]['account'])
        for identity in ('robinson-01', 'robinson-02', 'robinson-03', 'robinson-06', 'robinson-07'):
            self.assertNotIn('rear camera', media[identity]['account'])
        source = next(row for row in doc['sources'] if row['id'] == 'robinson-dashcam')
        self.assertIn('Which basis matches the true time is open', source['access'])
        self.assertIn('this review did not test that', source['access'])
        self.assertEqual(source['revision'], 'Reviewed 2026-11-17')
        self.assertIn('Which caption basis matches the true time is open.',
                      self.footage['provenance']['publication_review']['basis'])
        # Sample times, positions and their temporal status are what they were.
        previous = footage_boundary(self, doc)[0]
        before = {row['id']: row for row in previous['media']}
        for identity in ('robinson-0%d' % number for number in range(1, 8)):
            with self.subTest(sample=identity):
                for key in ('locator', 'status', 'url', 'kind', 'place'):
                    self.assertEqual(media[identity][key], before[identity][key])
                for key in ('video', 'alignment'):
                    self.assertEqual(media[identity]['time'][key], before[identity]['time'][key])
                self.assertEqual(media[identity]['time']['capture']['reported_utc'],
                                 before[identity]['time']['capture']['reported_utc'])

    def test_a_mutated_current_dossier_is_refused(self):
        changes = {
            'a changed rights line': lambda doc: doc['sources'][0].__setitem__('rights', 'Unreviewed replacement'),
            'a moved sample': lambda doc: next(m for m in doc['media'] if m['id'] == 'robinson-04')['time']['video']
                .__setitem__('start_seconds', 435),
            'a different basis': lambda doc: doc['provenance']['publication_review'].__setitem__('basis', 'Footage.'),
        }
        for label, change in changes.items():
            with self.subTest(change=label):
                current = copy.deepcopy(self.footage)
                change(current)
                with self.assertRaisesRegex(AssertionError, 'Only the exact reviewed continuation'):
                    footage_boundary(self, current, ROOT, copy.deepcopy(self.entry))

    def test_the_named_changes_must_explain_the_successor_exactly(self):
        current = self.footage
        missing = copy.deepcopy(self.spec)
        missing['changes'] = [row for row in missing['changes'] if row[1] != 'robinson-02']
        with self.assertRaisesRegex(AssertionError, 'must explain every changed leaf'):
            _footage_edge(self, current, missing, ROOT, None)
        idle = copy.deepcopy(self.spec)
        idle['changes'][2] = ('media', 'robinson-02', ['account', 'limits', 'review', 'time'])
        with self.assertRaisesRegex(AssertionError, 'must change its leaf'):
            _footage_edge(self, current, idle, ROOT, None)
        other = copy.deepcopy(self.spec)
        other['footage_sha256'] = other['previous_footage_sha256']
        with self.assertRaisesRegex(AssertionError, 'differs from the reviewed one'):
            _footage_edge(self, current, other, ROOT, None)


if __name__ == '__main__':
    unittest.main()
