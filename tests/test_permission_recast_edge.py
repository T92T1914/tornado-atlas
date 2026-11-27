"""The El Reno dossier version that recasts three sentences about Nick Nolte's permission and what he reported.

After the first recast, three sentences of the same kind were left where a
visitor reads about his three photographs. The creator basis and the rights of
his original timecoded publication called the permission specific to each item
with a hyphenated compound, and the inspection scope of the full exports did the
same for what the creator reported. These tests hold the version that rewrites
them to a second exact recast edge, and check that the review date, the scope
of the permission and the separate Commons license keep their form.
"""
import copy
import json
import re
import unittest

from atlas.archive import dossiers
from recast_continuation_support import (BASIS, RECAST_PROMOTIONS, ROOT, _recast_edge, canonical, explain_recast,
                                         recast_chain)

EVENT = 'el-reno-2013'
CREATOR = ('creators', 'nick-nolte-three-permitted-exports', 'basis')
TIMECODED = ('sources', 'nolte-original-timecoded-publication', 'rights')
EXPORTS = ('sources', 'nolte-three-permitted-full-exports', 'access')
SENTENCES = {
    CREATOR: 'Creator attribution on the three unchanged published JPEGs and documentary permission, specific to each '
             'item, reviewed October 15, 2026. Separate from the Commons image license and movie publication account.',
    TIMECODED: 'Original movie links only. No movie, audio or private inspection screenshot hosting permission follows. '
               'The three full JPEGs have separate records of permission, specific to each item. The Commons '
               'photograph keeps its separate license.',
    EXPORTS: 'All three complete full JPEGs and bottom marks inspected. The export, timing and approximate camera '
             'context reported by the creator were reviewed separately. Original camera streams, GPS records and '
             'editor project have not been inspected.',
}


def strings(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)
    elif isinstance(value, str):
        yield value


def row(doc, place):
    kind, identity, _ = place
    return next(item for item in doc[kind] if item['id'] == identity)


def path(doc, place):
    kind, identity, key = place
    return (kind, [item['id'] for item in doc[kind]].index(identity), key)


class PermissionRecastEdgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docs = {doc['id']: doc for doc in dossiers(ROOT)}
        cls.specs = RECAST_PROMOTIONS[EVENT]
        cls.spec = cls.specs[1]

    def setUp(self):
        # The chain ends with the version before every recast. Counted from that end, the version the
        # first recast admitted comes second last and this edge's version third last, whatever newer
        # edges come later. Without a newer edge, this version's entry is the real current one.
        chain = recast_chain(self, self.docs[EVENT])
        self.current, entry = chain[-3]
        if entry is None:
            index = json.loads((ROOT / 'web/archive/index.json').read_bytes())
            entry = next(item for item in index['events'] if item['id'] == EVENT)
        self.current_entry = entry
        self.previous, self.entry = chain[-2]

    def test_the_list_runs_oldest_first_and_this_edge_extends_the_first_recast(self):
        self.assertGreaterEqual(len(self.specs), 2)
        first = self.specs[0]
        self.assertEqual(canonical(self.current), self.spec['current'])
        self.assertEqual((canonical(self.previous), canonical(self.entry)),
                         (self.spec['previous'], self.spec['previous_index_sha256']))
        for name in ('', '_file', '_wire', '_index_sha256'):
            with self.subTest(pin='previous' + name):
                self.assertEqual(self.spec['previous' + name], first['current' + name])
        self.assertEqual((self.spec['previous_history_file'], self.spec['previous_history_wire']),
                         (first['history_file'], first['history_wire']))
        chain = recast_chain(self, self.docs[EVENT])
        self.assertEqual([canonical(doc) for doc, _ in chain[-3:]],
                         [self.spec['current'], first['current'], first['previous']])
        self.assertEqual(canonical(self.current_entry), self.spec['current_index_sha256'])
        self.assertTrue(self.current['provenance']['publication_review']['basis'].startswith(BASIS))

    def test_the_three_sentences_lose_the_old_wording_and_keep_their_scope(self):
        for old, new, count in self.spec['recasts']:
            with self.subTest(phrase=old):
                self.assertFalse(any(old in text for text in strings(self.current)))
                self.assertEqual(sum(text.count(new) for text in strings(self.current)), count)
        # The reader, the coverage page and the curated archive are built from this version.
        for page in ('web/index.html', 'web/data.json', 'web/coverage.html', 'research/archive-curated/el-reno-2013.json'):
            text = (ROOT / page).read_text(encoding='utf-8')
            for old, _, _ in self.spec['recasts']:
                with self.subTest(page=page, phrase=old):
                    self.assertNotIn(old, text)
        coverage = (ROOT / 'web/coverage.html').read_text(encoding='utf-8')
        self.assertEqual(coverage.count(self.spec['recasts'][2][1]), 3)
        for place, sentence in SENTENCES.items():
            with self.subTest(row=place[1]):
                now, before = row(self.current, place), row(self.previous, place)
                self.assertEqual(now[place[2]], sentence)
                self.assertNotIn(';', sentence)
                self.assertIsNone(re.search(r'[A-Za-z]-[A-Za-z]', sentence))
                # Every other field of the row, the processing statement included, is what it was.
                self.assertEqual(set(now), set(before))
                for key in set(now) - {place[2]}:
                    self.assertEqual(now[key], before[key])
        self.assertIn('reviewed October 15, 2026', row(self.previous, CREATOR)['basis'])
        self.assertIn('No movie, audio or private inspection screenshot hosting permission follows.',
                      row(self.previous, TIMECODED)['rights'])

    def test_the_explanation_refuses_every_change_it_does_not_name(self):
        # explain_recast reads no pinned bytes, so each change below reaches the rule itself.
        paths, _ = explain_recast(self, self.spec, self.previous, copy.deepcopy(self.current))
        self.assertEqual(sorted(paths), sorted(path(self.current, place) for place in SENTENCES))

        def edit(place, old, new):
            def change(doc):
                item = row(doc, place)
                self.assertIn(old, item[place[2]])
                item[place[2]] = item[place[2]].replace(old, new)
            return change
        other = next(item['id'] for item in self.current['sources']
                     if item['id'] not in (TIMECODED[1], EXPORTS[1]) and 'rights' in item)
        named, only = 'with the named phrases replaced', 'changes only the phrases it names'
        changes = {
            'an old sentence put back': (edit(CREATOR, 'documentary permission, specific to each item,',
                                              'item-specific documentary permission'), named),
            'another rewording': (edit(TIMECODED, 'specific to each item. The', 'specific to the item. The'), named),
            'a later review date': (edit(CREATOR, 'October 15, 2026', 'October 16, 2026'), named),
            'a wider grant': (edit(TIMECODED, 'No movie, audio or private inspection screenshot hosting permission '
                                              'follows. ', ''), named),
            'a reworded processing statement': (lambda doc: row(doc, TIMECODED).__setitem__(
                'agent_processing', row(doc, TIMECODED)['agent_processing'] + ' Reviewed again.'), only),
            'another source reworded': (lambda doc: next(item for item in doc['sources'] if item['id'] == other)
                                        .__setitem__('rights', 'Unreviewed replacement'), only),
            'a renamed creator': (lambda doc: row(doc, CREATOR).__setitem__('name', 'N. Nolte'), only),
            'a changed revision note': (lambda doc: row(doc, EXPORTS).__setitem__(
                'revision', 'Three exact full JPEG identities.'), only),
            'another basis': (lambda doc: doc['provenance']['publication_review'].__setitem__('basis', 'Recast.'),
                              'names the wording recast'),
            'another candidate': (lambda doc: doc['provenance']['publication_review'].__setitem__(
                'candidate_sha256', '0' * 64), 'exact reviewed candidate'),
            'another predecessor': (lambda doc: doc['provenance']['publication_review'].__setitem__(
                'previous_dossier_sha256', '0' * 64), 'exact predecessor'),
        }
        for label, (change, message) in changes.items():
            with self.subTest(change=label):
                successor = copy.deepcopy(self.current)
                change(successor)
                with self.assertRaisesRegex(AssertionError, message):
                    explain_recast(self, self.spec, self.previous, successor)

    def test_the_named_sentences_must_explain_the_successor_exactly(self):
        recasts = self.spec['recasts']

        def with_pair(index, new=None, count=None):
            old, wording, times = recasts[index]
            changed = (old, wording if new is None else new, times if count is None else count)
            return {'recasts': recasts[:index] + (changed,) + recasts[index + 1:]}
        for label, change, message in (
                ('a sentence left out', {'recasts': recasts[:-1]}, 'changes only the phrases it names'),
                ('one string more', {'strings': 4}, 'exactly its reviewed strings'),
                ('a sentence counted twice', with_pair(0, count=2), 'exactly as often as the edge counts'),
                ('another new wording', with_pair(1, new=recasts[1][1].replace('each item', 'the item')),
                 'with the named phrases replaced'),
                ('a recast that changes the date', with_pair(0, new=recasts[0][1].replace('15', '16')),
                 'keeps every number'),
                ('a recast that drops a name', with_pair(1, new=recasts[1][1].replace('The Commons photograph',
                                                                                      'The other photograph')),
                 'keeps every name'),
                ('a recast that changes nothing', with_pair(2, new=recasts[2][0]), 'must change its phrase'),
                ('another candidate', {'candidate_sha256': '0' * 64}, 'exact reviewed candidate')):
            with self.subTest(change=label), self.assertRaisesRegex(AssertionError, message):
                _recast_edge(self, self.current, {**self.spec, **change}, ROOT, self.current_entry)


if __name__ == '__main__':
    unittest.main()
