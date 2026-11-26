"""The El Reno dossier version that recasts the labels around Nick Nolte's reported values.

Six phrases written around those values were hyphenated compounds. The
timeline of the exhibit and the reviewed dossier hold the same wording, so both
change together and the dossier gets a new version. These tests hold that
version to an exact edge that replaces the named phrases and nothing else, and
check that the values the creator reported keep their form.
"""
import copy
import json
import unittest

from atlas.archive import digest, dossiers
from recast_continuation_support import (BASIS, RECAST_PROMOTIONS, ROOT, _recast_edge, canonical, explain_recast,
                                         recast_boundary, recast_index_entry, recast_paths)
from spacing_continuation_support import LATE_SPACING_PROMOTIONS

EVENT = 'el-reno-2013'
ROWS = ('nolte-231037-full-documentary', 'nolte-231059-full-documentary', 'nolte-231202-full-documentary')


def strings(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)
    elif isinstance(value, str):
        yield value


class RecastEdgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docs = {doc['id']: doc for doc in dossiers(ROOT)}
        cls.spec = RECAST_PROMOTIONS[EVENT]
        cls.timeline = json.loads((ROOT / 'exhibits/el-reno-2013/appearance-timeline.json').read_bytes())

    def media(self, doc, identity):
        return next(row for row in doc['media'] if row['id'] == identity)

    def test_the_edge_returns_the_late_spaced_predecessor_and_its_index_entry(self):
        self.assertEqual(canonical(self.docs[EVENT]), self.spec['current'])
        previous, entry = recast_boundary(self, self.docs[EVENT])
        self.assertEqual(canonical(previous), self.spec['previous'])
        self.assertEqual(canonical(entry), self.spec['previous_index_sha256'])
        late = LATE_SPACING_PROMOTIONS[EVENT][-1]
        self.assertEqual((self.spec['previous'], self.spec['previous_index_sha256'], self.spec['previous_history_file']),
                         (late['current'], late['current_index_sha256'], late['history_file']))
        self.assertTrue(self.docs[EVENT]['provenance']['publication_review']['basis'].startswith(BASIS))

    def test_events_without_the_edge_come_back_unchanged(self):
        self.assertEqual(set(RECAST_PROMOTIONS), {EVENT})
        for event, doc in self.docs.items():
            if event in RECAST_PROMOTIONS:
                continue
            with self.subTest(event=event):
                self.assertEqual(recast_boundary(self, doc), (doc, None))
                entry = {'id': event}
                self.assertIs(recast_index_entry(self, entry), entry)

    def test_no_old_phrase_is_left_and_the_reported_values_keep_their_form(self):
        doc = self.docs[EVENT]
        previous = recast_boundary(self, doc)[0]
        held = list(strings(doc)) + list(strings(self.timeline))
        for old, new, count in self.spec['recasts']:
            with self.subTest(phrase=old):
                self.assertFalse(any(old in text for text in held), 'The old phrase is gone from the dossier and the timeline')
                self.assertEqual(sum(text.count(new) for text in strings(doc)), count)
        # The pages a visitor reads are built from the timeline and the dossier.
        for page in ('web/index.html', 'web/data.json', 'web/coverage.html'):
            text = (ROOT / page).read_text(encoding='utf-8')
            for old, _, _ in self.spec['recasts']:
                with self.subTest(page=page, phrase=old):
                    self.assertNotIn(old, text)
        labels = ('2013-05-31T23:10:37Z', '2013-05-31T23:10:59Z', '2013-05-31T23:12:02Z')
        for identity, label in zip(ROWS, labels):
            with self.subTest(row=identity):
                row, before = self.media(doc, identity), self.media(previous, identity)
                self.assertIn('Label reported by the creator: ' + label + '.', row['account'])
                self.assertIn('using the GPS equipped Sony HDR-PJ710V recording as a time reference', row['account'])
                self.assertIn('permission, specific to each item, for unchanged copies of 231037.jpg, 231059.jpg and '
                              '231202.jpg.', row['review']['permission']['basis'])
                self.assertIn('The fourth still and movie remain outside this grant.', row['review']['permission']['basis'])
                self.assertIn('0, 22 and 85 seconds', row['review']['hosted_image']['creator_report']['clock_disposition'])
                self.assertIn('0, 21 and 86 seconds', row['review']['hosted_image']['creator_report']['clock_disposition'])
                # Everything but the recast prose is what it was: status, times, place, roles, link and file identity.
                for key in ('id', 'title', 'source_id', 'locator', 'status', 'time', 'place', 'kind', 'url', 'roles',
                            'parent', 'transformation'):
                    self.assertEqual(row[key], before[key])
                image, old_image = row['review']['hosted_image'], before['review']['hosted_image']
                for key in set(image) - {'caption', 'rights_basis', 'creator_report'}:
                    self.assertEqual(image[key], old_image[key])
                for key in ('use', 'credit', 'item_url', 'preserve_marks'):
                    self.assertEqual(row['review']['permission'][key], before['review']['permission'][key])
        # The timeline and the dossier still hold one wording for each hosted photograph.
        samples = {sample['hosted_image']['record_id']: sample['hosted_image']
                   for sequence in self.timeline['photo_sequences'] for sample in sequence['samples']
                   if sample.get('hosted_image')}
        self.assertEqual(set(samples), set(ROWS))
        for identity in ROWS:
            self.assertEqual(digest(self.media(doc, identity)['review']['hosted_image']), digest(samples[identity]))

    def test_a_mutated_current_dossier_is_refused_by_its_pinned_bytes(self):
        changes = {
            'a changed rights line': lambda doc: doc['sources'][0].__setitem__('rights', 'Unreviewed replacement'),
            'a different basis': lambda doc: doc['provenance']['publication_review'].__setitem__('basis', 'Recast.'),
        }
        for label, change in changes.items():
            with self.subTest(change=label):
                current = copy.deepcopy(self.docs[EVENT])
                change(current)
                with self.assertRaisesRegex(AssertionError, 'Only the exact reviewed continuation'):
                    recast_boundary(self, current)

    def test_the_explanation_refuses_every_change_it_does_not_name(self):
        # explain_recast reads no pinned bytes, so each change below reaches the rule itself.
        previous = recast_boundary(self, self.docs[EVENT])[0]
        paths, _ = explain_recast(self, self.spec, previous, copy.deepcopy(self.docs[EVENT]))
        self.assertEqual(len(paths), 25)
        first = lambda doc: self.media(doc, ROWS[0])
        named, only = 'with the named phrases replaced', 'changes only the phrases it names'
        changes = {
            'an old phrase put back': (lambda doc: first(doc).__setitem__(
                'limits', first(doc)['limits'].replace('navigation guides reported by the creator', 'creator-reported navigation guides')), named),
            'another rewording': (lambda doc: first(doc).__setitem__(
                'account', first(doc)['account'].replace('Label reported by the creator: ', 'Label the creator reported: ')), named),
            'a changed reported second': (lambda doc: first(doc).__setitem__(
                'account', first(doc)['account'].replace('23:10:37Z', '23:10:38Z')), named),
            'a changed offset': (lambda doc: first(doc)['review']['hosted_image']['creator_report'].__setitem__(
                'clock_disposition', first(doc)['review']['hosted_image']['creator_report']['clock_disposition']
                .replace('0, 22 and 85', '0, 23 and 85')), named),
            'a wider grant': (lambda doc: first(doc)['review']['permission'].__setitem__(
                'basis', first(doc)['review']['permission']['basis'].replace('The fourth still and movie remain outside this grant. ', '')), named),
            'another row reworded': (lambda doc: doc['sources'][0].__setitem__('rights', 'Unreviewed replacement'), only),
            'a changed capture label': (lambda doc: first(doc)['time']['capture'].__setitem__('reported', '2013-05-31T23:10:38Z'), only),
            'a changed status': (lambda doc: first(doc)['status'].__setitem__('rights', 'links_only'), only),
            'a changed provenance input': (lambda doc: doc['provenance']['inputs'].__setitem__(
                'exhibits/el-reno-2013/footage.json', '0' * 64), only),
            'a changed byte count': (lambda doc: first(doc)['review']['hosted_image'].__setitem__(
                'bytes', first(doc)['review']['hosted_image']['bytes'] + 1), 'changes strings only'),
            'a registered point': (lambda doc: first(doc)['place'].__setitem__('coordinates', [-97.9, 35.4]),
                                   'keeps every JSON type'),
            'an added key': (lambda doc: first(doc).__setitem__('note', 'x'), 'keeps every key'),
            'an added row': (lambda doc: doc['media'].append(copy.deepcopy(doc['media'][0])), 'keeps every list length'),
            'another basis': (lambda doc: doc['provenance']['publication_review'].__setitem__('basis', 'Recast.'),
                              'names the wording recast'),
            'another candidate': (lambda doc: doc['provenance']['publication_review'].__setitem__(
                'candidate_sha256', '0' * 64), 'exact reviewed candidate'),
            'another predecessor': (lambda doc: doc['provenance']['publication_review'].__setitem__(
                'previous_dossier_sha256', '0' * 64), 'exact predecessor'),
        }
        for label, (change, message) in changes.items():
            with self.subTest(change=label):
                successor = copy.deepcopy(self.docs[EVENT])
                change(successor)
                with self.assertRaisesRegex(AssertionError, message):
                    explain_recast(self, self.spec, previous, successor)

    def test_the_named_phrases_must_explain_the_successor_exactly(self):
        current, recasts = self.docs[EVENT], self.spec['recasts']

        def with_pair(index, old=None, new=None, count=None):
            pair = recasts[index]
            changed = (old or pair[0], new or pair[1], pair[2] if count is None else count)
            return {'recasts': recasts[:index] + (changed,) + recasts[index + 1:]}
        for label, change, message in (
                ('a phrase left out', {'recasts': recasts[:-1]}, 'with the named phrases replaced'),
                ('the only phrase of a string left out', {'recasts': recasts[:2] + recasts[3:]},
                 'changes only the phrases it names'),
                ('one string fewer', {'strings': 24}, 'exactly its reviewed strings'),
                ('a phrase counted once more', with_pair(0, count=7), 'exactly as often as the edge counts'),
                ('another new wording', with_pair(0, new='Label the creator reported: '), 'with the named phrases replaced'),
                ('a recast that changes a number', with_pair(2, new=recasts[2][1].replace('22', '23')),
                 'keeps every number'),
                ('a recast that drops a number', with_pair(2, new=recasts[2][1].replace('0, 21 and 86 seconds', '0 and 21 seconds')),
                 'keeps every number'),
                ('a recast that drops a name', with_pair(4, new='exports from the recording made by his roof camera.'),
                 'keeps every name'),
                ('a recast that changes nothing', with_pair(1, new=recasts[1][0]), 'must change its phrase'),
                ('another candidate', {'candidate_sha256': '0' * 64}, 'exact reviewed candidate')):
            with self.subTest(change=label), self.assertRaisesRegex(AssertionError, message):
                _recast_edge(self, current, {**self.spec, **change}, ROOT, None)

    def test_a_named_phrase_is_recast_only_in_reader_prose(self):
        recasts = (('Creator-reported label: ', 'Label reported by the creator: ', 1),)
        old, new = 'Creator-reported label: 23:10Z', 'Label reported by the creator: 23:10Z'
        self.assertEqual(recast_paths(self, {'media': [{'id': 'a', 'account': old}]},
                                      {'media': [{'id': 'a', 'account': new}]}, recasts, {}), [('media', 0, 'account')])
        for label, before, after, message in (
                ('a title', {'media': [{'id': 'a', 'title': old}]}, {'media': [{'id': 'a', 'title': new}]},
                 'may only change reader prose'),
                ('an identifier', {'media': [{'id': old}]}, {'media': [{'id': new}]}, 'may only change reader prose'),
                ('a capture time', {'media': [{'time': {'capture': {'basis': old}}}]},
                 {'media': [{'time': {'capture': {'basis': new}}}]}, 'cannot change a time, a place, a status or a role'),
                ('a place', {'media': [{'place': {'basis': old}}]}, {'media': [{'place': {'basis': new}}]},
                 'cannot change a time, a place, a status or a role'),
                ('provenance', {'provenance': {'basis': old}}, {'provenance': {'basis': new}}, 'cannot change provenance'),
                ('a phrase left as it was', {'media': [{'account': old}]}, {'media': [{'account': old}]},
                 'with the named phrases replaced')):
            with self.subTest(change=label), self.assertRaisesRegex(AssertionError, message):
                recast_paths(self, before, after, recasts, {})


if __name__ == '__main__':
    unittest.main()
