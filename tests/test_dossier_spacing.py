"""Tuscaloosa and Moore read with the spaces their sources have.

Text extraction had joined words to numbers in both dossiers, so the coverage
page read Table2 and at2:40p.m.CDT. New versions put the spaces back through an
exact spacing edge. These tests hold the current text to that and check that the
edge admits spaces and nothing else.
"""
import copy
import html
import json
from pathlib import Path
import unittest

from atlas.archive import dossiers
from reviewed_continuation_support import reviewed_predecessor
from response_continuation_support import response_predecessor
from spacing_continuation_support import (REVIEW_KEYS, SPACING_PROMOTIONS, canonical, spaces_inserted,
                                          spacing_boundary, spacing_paths)
from text_spacing_support import joined_words

ROOT = Path(__file__).resolve().parents[1]
# The other current dossiers and the catalogue detail notes join once their own spaced versions exist.
CHECKED = ('tuscaloosa-birmingham-2011', 'moore-2013')
# Identifiers, links and digests are names, not text a reader reads.
IDENTIFIER_KEYS = {'id', 'source_id', 'parent', 'creator', 'uploader', 'rights_holder', 'url', 'href',
                   'asset', 'file', 'sha256', 'parent_sha256', 'source_sha256'}
EDGE = '.,;:()'


def reader_strings(value, path=(), key=None):
    """Every string outside provenance that is not an identifier, link or digest."""
    if isinstance(value, dict):
        for name, item in value.items():
            if name != 'provenance':
                yield from reader_strings(item, path + (name,), name)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from reader_strings(item, path + (index,), key)
    elif isinstance(value, str) and key not in IDENTIFIER_KEYS:
        yield path, value


def leaf(doc, path):
    for part in path:
        doc = doc[part]
    return doc


def published_files():
    web = ROOT / 'web'
    return sorted([*web.glob('*.html'), *web.glob('*.json'), *(web / 'events').glob('*.json')])


def shown_forms(text):
    return {text, html.escape(text, quote=False), html.escape(text), json.dumps(text)[1:-1],
            json.dumps(text, ensure_ascii=False)[1:-1]}


class DossierSpacingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docs = {doc['id']: doc for doc in dossiers(ROOT)}

    def edge(self, event):
        spec = SPACING_PROMOTIONS[event]
        previous = json.loads((ROOT / 'web' / spec['previous_file']).read_bytes())
        view = copy.deepcopy(self.docs[event])
        for key in REVIEW_KEYS:
            view['provenance']['publication_review'][key] = previous['provenance']['publication_review'][key]
        return previous, [(leaf(previous, path), leaf(view, path)) for path in spacing_paths(self, previous, view)]

    def test_current_checked_dossiers_have_no_word_joined_to_a_number(self):
        for event in CHECKED:
            for path, text in reader_strings(self.docs[event]):
                with self.subTest(event=event, path='/'.join(map(str, path))):
                    self.assertEqual(joined_words(text), [])

    def test_every_spaced_string_held_a_join_and_holds_none_now(self):
        for event in CHECKED:
            _, pairs = self.edge(event)
            self.assertEqual(len(pairs), SPACING_PROMOTIONS[event]['strings'])
            for old, new in pairs:
                with self.subTest(event=event, text=old[:60]):
                    self.assertNotEqual(joined_words(old), [])
                    self.assertEqual(joined_words(new), [])

    def test_identifiers_written_joined_are_not_flagged(self):
        for text in ('Video 5ohIVzIZLuQ at 04:22 MM:SS', 'An EF4 rating and an F5 rating', 'Header WFUS54 KBMX',
                     'Release c20260323 in BAMS-D-20-0251.1', 'Page E2777 of 1,351 frames', 'Panels 6b,c on the 27th',
                     'File IMG_9287-800.jpg and DOI 10.1175/BAMS-D-20-0251.1', 'SHA256 ' + 'd4' * 32,
                     'Points [-97.605,35.303] at 2013-05-20T20:04:00Z', 'Read https://example.org/a2b?c=3'):
            with self.subTest(text=text):
                self.assertEqual(joined_words(text), [])

    def test_joined_words_are_flagged(self):
        for text, word in (('See Table2.', 'Table2.'), ('Issued at2:40p.m.CDT today', 'at2:40p.m.CDT'),
                           ('Published December2022', 'December2022'), ('Figures 5,8 show it', '5,8'),
                           ('About 150m away', '150m'), ('It was 23pages long', '23pages')):
            with self.subTest(text=text):
                self.assertIn(word, joined_words(text))

    def test_an_injected_join_in_a_checked_dossier_is_found(self):
        doc = copy.deepcopy(self.docs['tuscaloosa-birmingham-2011'])
        doc['observations'][0]['account'] += ' See Table2.'
        found = [joined_words(text) for _, text in reader_strings(doc) if joined_words(text)]
        self.assertEqual(found, [['Table2.']])

    def test_no_published_page_shows_a_word_this_edge_spaced_in_its_joined_form(self):
        pages = {path.relative_to(ROOT).as_posix(): path.read_text(encoding='utf-8') for path in published_files()}
        self.assertIn('web/coverage.html', pages)
        # A joined word that another current dossier still carries belongs to that dossier's own check.
        elsewhere = ' '.join(text for event, doc in self.docs.items() if event not in CHECKED
                             for _, text in reader_strings(doc))
        tested = 0
        for event in CHECKED:
            _, pairs = self.edge(event)
            shown = 0
            for old, new in pairs:
                new_words = new.split(' ')
                words = {word.strip(EDGE) for word in old.split(' ') if word not in new_words}
                for word in sorted(words - {''}):
                    if word in elsewhere:
                        continue
                    tested += 1
                    for name, text in pages.items():
                        with self.subTest(event=event, page=name, word=word):
                            self.assertFalse(any(form in text for form in shown_forms(word)))
                shown += any(form in pages['web/coverage.html'] for form in shown_forms(new))
            self.assertGreater(shown, 0, 'The coverage page shows spaced text from ' + event)
        self.assertGreater(tested, 50)

    def test_catalogue_details_of_checked_events_have_no_joined_words(self):
        folder = ROOT / 'web/catalogue'
        index = {row['id']: row for row in json.loads((folder / 'index.json').read_bytes())['records']}
        details = {}
        checked = 0
        for event in CHECKED:
            for record in self.docs[event]['records']:
                row = index[record['id']]
                if row['detail_file'] not in details:
                    details[row['detail_file']] = json.loads((folder / row['detail_file']).read_bytes())
                detail = details[row['detail_file']][record['id']]
                self.assertEqual(detail['curation']['basis'], record['basis'])
                for field in ('curation', 'location_review'):
                    for path, text in reader_strings(detail.get(field) or {}, (field,)):
                        checked += 1
                        with self.subTest(record=record['id'], path='/'.join(map(str, path))):
                            self.assertEqual(joined_words(text), [])
        self.assertGreater(checked, 0)

    def test_spacing_edges_return_the_exact_predecessors(self):
        self.assertEqual(set(SPACING_PROMOTIONS), set(CHECKED))
        for event, spec in SPACING_PROMOTIONS.items():
            with self.subTest(event=event):
                previous, entry = spacing_boundary(self, self.docs[event])
                self.assertEqual(canonical(previous), spec['previous'])
                self.assertEqual(entry['dossier_sha256'], spec['previous'])
                self.assertEqual(canonical(self.docs[event]), spec['current'])
        self.assertEqual(canonical(response_predecessor(self, self.docs['moore-2013'])),
                         '5ed36647a0e6141f8ddeeee30ef7be9e7bb6332613ed86428b3b9b5536b25e85')
        self.assertEqual(canonical(reviewed_predecessor(self, self.docs['tuscaloosa-birmingham-2011'])),
                         'e0ed6012db7845157367bfb80aef9b9f22efd21fb3857fe32308d994de93bdfd')

    def test_the_spacing_rule_admits_inserted_spaces_only(self):
        self.assertTrue(spaces_inserted('Table2', 'Table 2'))
        self.assertTrue(spaces_inserted('at2:40p.m.CDT', 'at 2:40 p.m. CDT'))
        for before, after in (('Table2', 'Table2'), ('Table 2', 'Table2'), ('Table2', 'Table 3'),
                              ('Table2', 'Table\u00a02'), ('Table2', 'Table  2.'), ('Table2', 'Tab le2x')):
            with self.subTest(before=before, after=after):
                self.assertFalse(spaces_inserted(before, after))

    def test_any_other_change_fails_the_edge(self):
        base = {'id': 'event451537', 'title': 'Event451537', 'count': 2, 'rows': [{'id': 'a1', 'limits': 'Page10'}],
                'locator': 'DOI 10.1175/BAMS-D-20-0251.1 at 04:22 MM:SS from https://example.org/a2b',
                'time': {'capture': {'reported': 'at2207UTC'}, 'publication': '2019-11-16'},
                'provenance': {'summary': 'Page10', 'inputs': {'note.md': 'abc'}}}
        changes = {
            'a changed digit': (lambda doc: doc.__setitem__('title', 'Event 451538'), 'may only put spaces back'),
            'a removed key': (lambda doc: doc.pop('count'), 'keeps every key'),
            'a longer list': (lambda doc: doc['rows'].append({'id': 'b2', 'limits': ''}), 'keeps every list length'),
            'a changed type': (lambda doc: doc.__setitem__('count', '2'), 'keeps every JSON type'),
            'a spaced identifier': (lambda doc: doc.__setitem__('id', 'event 451537'), 'only change reader prose'),
            'a spaced row identifier': (lambda doc: doc['rows'][0].__setitem__('id', 'a 1'), 'only change reader prose'),
            'a provenance input': (lambda doc: doc['provenance']['inputs'].__setitem__('note.md', 'a bc'),
                                   'cannot change provenance'),
            'a provenance summary': (lambda doc: doc['provenance'].__setitem__('summary', 'Page 10'),
                                     'cannot change provenance'),
            'a capture time': (lambda doc: doc['time']['capture'].__setitem__('reported', 'at 2207 UTC'),
                               'capture, alignment or video time'),
            'a split clock': (lambda doc: doc.__setitem__('locator', doc['locator'].replace('04:22', '04: 22')),
                              'cannot split'),
            'a split DOI': (lambda doc: doc.__setitem__('locator', doc['locator'].replace('1175/BAMS', '1175/ BAMS')),
                            'cannot split'),
            'a split link': (lambda doc: doc.__setitem__('locator', doc['locator'].replace('org/a2b', 'org/a 2b')),
                             'cannot split'),
            'a split date': (lambda doc: doc['time'].__setitem__('publication', '2019- 11-16'), 'cannot split'),
            'a leading space': (lambda doc: doc.__setitem__('title', ' Event451537'), 'cannot split'),
        }
        self.assertEqual(spacing_paths(self, base, copy.deepcopy(base)), [])
        spaced = copy.deepcopy(base)
        spaced['title'] = 'Event 451537'
        spaced['rows'][0]['limits'] = 'Page 10'
        self.assertEqual(spacing_paths(self, base, spaced), [('title',), ('rows', 0, 'limits')])
        hashed = {'revision': 'SHA256' + 'd4' * 32}
        self.assertEqual(spacing_paths(self, hashed, {'revision': 'SHA256 ' + 'd4' * 32}), [('revision',)])
        for label, (change, message) in changes.items():
            with self.subTest(change=label):
                after = copy.deepcopy(base)
                change(after)
                with self.assertRaisesRegex(AssertionError, message):
                    spacing_paths(self, base, after)

    def test_a_mutated_current_dossier_is_not_a_spacing_edge(self):
        for event in CHECKED:
            changes = {
                'one more space': lambda doc: doc['sources'][0].__setitem__('title', doc['sources'][0]['title'] + ' '),
                'a changed rights line': lambda doc: doc['sources'][0].__setitem__('rights', 'Unreviewed replacement'),
                'a different basis': lambda doc: doc['provenance']['publication_review'].__setitem__('basis', 'Spacing.'),
            }
            for label, change in changes.items():
                with self.subTest(event=event, change=label):
                    current = copy.deepcopy(self.docs[event])
                    change(current)
                    with self.assertRaisesRegex(AssertionError, 'Only the exact reviewed continuation'):
                        spacing_boundary(self, current)


if __name__ == '__main__':
    unittest.main()
