"""The El Reno dossier version that recasts the hyphenated words left after the first two recasts.

The first two recasts left words of the same kind where a visitor reads about
Nick Nolte's photographs: the rights basis of his two timecoded context stills,
two creator bases, the Commons photograph's locator, access and rights, the
revision of his three full exports, the scene accounts and unreviewed scope of
the context stills, and a semicolon after the bottom mark of the three full
exports. The summary, one Conrady account, the role of one published photograph
and one Bohac inspection sentence held the same kind of word. These tests hold
the version that rewrites them to a third exact recast edge. That edge is the
first to name extra prose places, the summary among them, and the tests check
that only it may use them and that clock labels, terms of the field and the
processing statement keep their form.
"""
import copy
import json
import re
import unittest

from atlas.archive import dossiers
from recast_continuation_support import (PROSE_KEYS, RECAST_PROMOTIONS, ROOT, _recast_edge, admitted_path,
                                         canonical, explain_recast, recast_chain, recast_history_changes,
                                         recast_paths)

EVENT = 'el-reno-2013'
COMPOUND = re.compile(r'\b[A-Za-z]+-[A-Za-z]+\b')
# The one compound a new phrase may hold is the license name.
KEPT = {'BY-SA'}
# Pages that hold every event are searched only for phrases long enough to belong to El Reno alone.
SHARED_PAGES = {'web/coverage.html', 'web/archive/index.json'}
# The exhibit page text holds the summary and five more phrases of the same kind.
EXHIBIT = (
    ('The visible condensation, surveyed damage and radar-measured winds',
     'The visible condensation, the surveyed damage and the winds measured by radar'),
    ('Time-labeled positions in the NWS file', 'Positions with time labels in the NWS file'),
    ('center path and time-labeled center positions. The shaded outline covers the event as a whole; it is not',
     'center path and center positions with time labels. The shaded outline covers the event as a whole. It is not'),
    ('a measured second-by-second route.', 'a route measured second by second.'),
    ('needs shot-level evidence about viewpoint, visibility and time.',
     'needs evidence about the viewpoint, visibility and time of individual shots.'),
    ('in the original-footage viewer.', 'in the viewer for the original footage.'),
)


def strings(value, path=()):
    if isinstance(value, dict):
        for key, item in value.items():
            yield from strings(item, path + (key,))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from strings(item, path + (index,))
    elif isinstance(value, str):
        yield path, value


def at(doc, path):
    for part in path:
        doc = doc[part]
    return doc


class WordsRecastEdgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docs = {doc['id']: doc for doc in dossiers(ROOT)}
        cls.specs = RECAST_PROMOTIONS[EVENT]
        cls.spec = cls.specs[2]
        cls.timeline = json.loads((ROOT / 'exhibits/el-reno-2013/appearance-timeline.json').read_bytes())

    def setUp(self):
        # Counted from the end of the chain, this edge's version comes fourth last whatever newer edges come later.
        chain = recast_chain(self, self.docs[EVENT])
        self.current, entry = chain[-4]
        if entry is None:
            index = json.loads((ROOT / 'web/archive/index.json').read_bytes())
            entry = next(item for item in index['events'] if item['id'] == EVENT)
        self.current_entry = entry
        self.previous, self.entry = chain[-3]
        # Live pages and exhibit sources follow the newest version. Once a newer edge exists, its own
        # tests compare them, and these keep to what this edge's version holds.
        self.newest = len(self.specs) == 3

    def test_this_edge_extends_the_permission_recast(self):
        second = self.specs[1]
        self.assertEqual(canonical(self.current), self.spec['current'])
        self.assertEqual((canonical(self.previous), canonical(self.entry)),
                         (self.spec['previous'], self.spec['previous_index_sha256']))
        for name in ('', '_file', '_wire', '_index_sha256'):
            with self.subTest(pin='previous' + name):
                self.assertEqual(self.spec['previous' + name], second['current' + name])
        self.assertEqual((self.spec['previous_history_file'], self.spec['previous_history_wire']),
                         (second['history_file'], second['history_wire']))
        self.assertEqual(canonical(self.current_entry), self.spec['current_index_sha256'])
        # Only this edge names extra prose places. The older edges keep the reader prose keys alone.
        self.assertEqual([bool(spec.get('prose_paths')) for spec in self.specs[:3]], [False, False, True])

    def test_the_old_words_are_gone_and_the_new_ones_are_counted(self):
        texts = [text for _, text in strings(self.current)]
        for old, new, count in self.spec['recasts']:
            with self.subTest(phrase=old):
                self.assertFalse(any(old in text for text in texts))
                self.assertEqual(sum(text.count(new) for text in texts), count)
                self.assertNotIn(';', new)
                self.assertIsNone(re.search('[–—]', new))
                self.assertEqual([word for word in COMPOUND.findall(new) if word not in KEPT], [])
        pages = ('web/index.html', 'web/data.json', 'web/coverage.html', 'web/events/el-reno-2013.json',
                 'web/archive/index.json', 'research/archive-curated/el-reno-2013.json',
                 'exhibits/el-reno-2013/appearance-timeline.json', 'exhibits/el-reno-2013/dossier.json')
        for page in pages:
            text = (ROOT / page).read_text(encoding='utf-8')
            for old in [old for old, _, _ in self.spec['recasts']] + [old for old, _ in EXHIBIT]:
                if page in SHARED_PAGES and len(old) < 40:
                    continue
                with self.subTest(page=page, phrase=old):
                    self.assertNotIn(old, text)
        if not self.newest:
            return
        exhibit = (ROOT / 'exhibits/el-reno-2013/dossier.json').read_text(encoding='utf-8')
        reader = (ROOT / 'web/index.html').read_text(encoding='utf-8')
        for _, new in EXHIBIT:
            with self.subTest(exhibit=new):
                self.assertEqual(exhibit.count(new), 1)
                self.assertEqual(reader.count(new), 1)
        self.assertEqual(json.loads(exhibit)['introduction'], self.current['summary'])

    def test_clock_labels_terms_and_the_processing_statement_keep_their_form(self):
        media = {row['id']: row for row in self.current['media']}
        for identity, mark in (('nolte-231037-full-documentary', '23:10Z'), ('nolte-231059-full-documentary', '23:10Z'),
                               ('nolte-231202-full-documentary', '23:12Z')):
            caption = media[identity]['review']['hosted_image']['caption']
            with self.subTest(media=identity):
                self.assertIn('The visible bottom mark reads ' + mark + '. The exposure second', caption)
                self.assertTrue(media[identity]['account'].startswith(caption))
                self.assertNotIn(';', caption)
        self.assertIn('rear-flanking downdraft (RFD)', media['nolte-231202-full-documentary']['account'])
        source = next(row for row in self.current['sources'] if row['id'] == 'nolte-original-timecoded-publication')
        self.assertIn('unchanged creator-reported stills', source['agent_processing'])
        if not self.newest:
            return
        # The timeline holds the same captions and comparisons as the dossier rows it feeds.
        samples = {sample['id']: sample for sequence in self.timeline['photo_sequences'] for sample in sequence['samples']}
        for identity in ('231037', '231059', '231202'):
            with self.subTest(sample=identity):
                row = media['nolte-' + identity + '-full-documentary']
                self.assertEqual(samples['nolte-' + identity]['hosted_image']['caption'],
                                 row['review']['hosted_image']['caption'])
        for identity in ('231037', '231059'):
            with self.subTest(context=identity):
                comparison = media['nolte-timecoded-context-' + identity]['review']['source_comparison']
                self.assertEqual(samples['nolte-' + identity]['source_comparison']['rights_basis'],
                                 comparison['rights_basis'])
                self.assertEqual(samples['nolte-' + identity]['source_comparison']['scene_features'],
                                 comparison['scene_features'])

    def test_the_edge_uses_exactly_its_extra_prose_places(self):
        paths, _ = explain_recast(self, self.spec, self.previous, copy.deepcopy(self.current))
        self.assertEqual(len(paths), self.spec['strings'])
        reached = {tuple('*' if isinstance(part, int) else part for part in path) for path in paths}
        extra = {path for path in reached if path[-1] not in PROSE_KEYS}
        self.assertEqual(extra, set(self.spec['prose_paths']))
        changes = recast_history_changes(self.previous, paths)
        self.assertEqual(changes[-1], dict(kind='dossier', id=EVENT, change='updated', fields=['summary']))
        self.assertEqual(sum(row['kind'] == 'dossier' for row in changes), 1)
        # Without its extra places this edge fails at the first string outside the reader prose keys.
        with self.assertRaisesRegex(AssertionError, 'may only change reader prose'):
            explain_recast(self, {**self.spec, 'prose_paths': ()}, self.previous, copy.deepcopy(self.current))

    def test_an_extra_place_matches_its_whole_path_and_a_star_only_a_list_position(self):
        patterns = (('sources', '*', 'locator'), ('media', '*', 'review', 'source_comparison', 'scene_features', '*'))
        for path, admitted in ((('sources', 0, 'locator'), True), (('sources', 'x', 'locator'), False),
                               (('sources', 0, 'locator', 0), False), (('sources', 0), False),
                               (('sources', 0, 'title'), False), (('records', 0, 'locator'), False),
                               (('media', 2, 'review', 'source_comparison', 'scene_features', 1), True),
                               (('media', 2, 'review', 'source_comparison', 'scene_features', 'note'), False)):
            with self.subTest(path=path):
                self.assertIs(admitted_path(path, patterns), admitted)
        self.assertFalse(admitted_path(('summary',), ()))
        # A named phrase at a key beside an extra place is still refused there, though it is replaced exactly.
        recasts = (('a green-gray storm', 'a greenish gray storm', 1),)
        before = {'sources': [{'id': 'a', 'locator': 'Note', 'title': 'Toward a green-gray storm'}]}
        after = {'sources': [{'id': 'a', 'locator': 'Note', 'title': 'Toward a greenish gray storm'}]}
        with self.assertRaisesRegex(AssertionError, 'may only change reader prose'):
            recast_paths(self, before, after, recasts, {}, admitted=patterns)
        deeper = ({'sources': [{'id': 'a', 'revision': {'note': 'a green-gray storm'}}]},
                  {'sources': [{'id': 'a', 'revision': {'note': 'a greenish gray storm'}}]})
        with self.assertRaisesRegex(AssertionError, 'may only change reader prose'):
            recast_paths(self, *deeper, recasts, {}, admitted=(('sources', '*', 'revision'),))
        self.assertEqual(recast_paths(self, {'sources': [{'id': 'a', 'locator': 'a green-gray storm'}]},
                                      {'sources': [{'id': 'a', 'locator': 'a greenish gray storm'}]}, recasts, {},
                                      admitted=patterns), [('sources', 0, 'locator')])

    def test_the_explanation_refuses_every_change_it_does_not_name(self):
        def edit(path, old, new):
            def change(doc):
                text = at(doc, path[:-1])[path[-1]]
                self.assertIn(old, text)
                at(doc, path[:-1])[path[-1]] = text.replace(old, new)
            return change

        def place(kind, identity, *keys):
            return (kind, [row['id'] for row in self.current[kind]].index(identity)) + keys
        caption = place('media', 'nolte-231037-full-documentary', 'review', 'hosted_image', 'caption')
        role = place('media', 'nolte-timecoded-context-231037', 'review', 'published_resource_provenance', 'role')
        scope = place('media', 'nolte-timecoded-context-231037', 'review', 'published_resource_provenance', 'scope')
        title = place('sources', 'commons-nolte-el-reno', 'title')
        named, only = 'with the named phrases replaced', 'changes only the phrases it names'
        changes = {
            'an old semicolon put back': (edit(caption, '23:10Z. The exposure', '23:10Z; the exposure'), named),
            'another clock label': (edit(caption, 'reads 23:10Z.', 'reads 23:11Z.'), named),
            'another wording at an extra place': (edit(role, 'full size, not', 'in full, not'), named),
            'a reworded sibling of an extra place': (edit(scope, 'External links only', 'Links only'), only),
            'a reworded title': (edit(title, 'El Reno', 'El Reno, Oklahoma'), only),
            'a reworded summary': (lambda doc: doc.__setitem__('summary', doc['summary'] + ' Reviewed again.'), named),
            'a reworded processing statement': (lambda doc: next(
                row for row in doc['sources'] if row['id'] == 'nolte-original-timecoded-publication').__setitem__(
                'agent_processing', 'Reviewed again.'), only),
        }
        for label, (change, message) in changes.items():
            with self.subTest(change=label):
                successor = copy.deepcopy(self.current)
                change(successor)
                with self.assertRaisesRegex(AssertionError, message):
                    explain_recast(self, self.spec, self.previous, successor)

    def test_the_named_phrases_must_explain_the_successor_exactly(self):
        recasts = self.spec['recasts']

        def with_pair(index, new=None, count=None):
            old, wording, times = recasts[index]
            changed = (old, wording if new is None else new, times if count is None else count)
            return {'recasts': recasts[:index] + (changed,) + recasts[index + 1:]}
        mark = next(index for index, (old, _, _) in enumerate(recasts) if '23:10Z;' in old)
        commons = next(index for index, (old, _, _) in enumerate(recasts) if old.startswith('The Commons'))
        for label, change, message in (
                ('a phrase left out', {'recasts': recasts[:1] + recasts[2:]}, 'changes only the phrases it names'),
                ('one string more', {'strings': self.spec['strings'] + 1}, 'exactly its reviewed strings'),
                ('a phrase counted once less', with_pair(mark, count=3), 'exactly as often as the edge counts'),
                ('a recast that changes the clock label', with_pair(mark, new=recasts[mark][1].replace('23:10Z', '23:11Z')),
                 'keeps every number'),
                ('a recast that drops a name', with_pair(commons, new=recasts[commons][1].replace('Nick Nolte', 'he')),
                 'keeps every name'),
                ('a recast that changes nothing', with_pair(0, new=recasts[0][0]), 'must change its phrase'),
                ('another candidate', {'candidate_sha256': '0' * 64}, 'exact reviewed candidate')):
            with self.subTest(change=label), self.assertRaisesRegex(AssertionError, message):
                _recast_edge(self, self.current, {**self.spec, **change}, ROOT, self.current_entry)


if __name__ == '__main__':
    unittest.main()
