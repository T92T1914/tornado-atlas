"""Tuscaloosa and Moore read with the spaces their sources have.

Text extraction had joined words to numbers in both dossiers, so the coverage
page read Table2 and at2:40p.m.CDT. New versions put the spaces back through an
exact spacing edge. These tests hold the current text to that and check that the
edge admits spaces and nothing else. A later El Reno edge does the same for
words that had run into other words, such as exactID and remainsJeffSnyder.
"""
import copy
import html
import json
from pathlib import Path
import unittest

from atlas.archive import dossiers
from footage_continuation_support import FOOTAGE_PROMOTIONS, footage_boundary, footage_predecessor
from recast_continuation_support import recast_boundary
from reviewed_continuation_support import reviewed_predecessor
from response_continuation_support import response_predecessor
from spacing_continuation_support import (LATE_SPACING_PROMOTIONS, REVIEW_KEYS, SPACING_PROMOTIONS, canonical,
                                          late_spacing_boundary, spaces_inserted, spacing_boundary, spacing_paths)
from text_spacing_support import LOWER_JOINS, NAMES, joined_words

ROOT = Path(__file__).resolve().parents[1]
# Every current dossier that held a joined word reached its present version through a spacing edge.
SPACED = ('tuscaloosa-birmingham-2011', 'moore-2013', 'el-reno-2013', 'joplin-2011', 'blackwell-1955', 'udall-1955')
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

    def edges(self, event):
        """Each spacing edge of an event, oldest first, with its changed strings and their current text."""
        found = []
        for spec in SPACING_PROMOTIONS[event] + LATE_SPACING_PROMOTIONS.get(event, []):
            previous = json.loads((ROOT / 'web' / spec['previous_file']).read_bytes())
            view = json.loads((ROOT / 'web' / spec['current_file']).read_bytes())
            for key in REVIEW_KEYS:
                view['provenance']['publication_review'][key] = previous['provenance']['publication_review'][key]
            found.append((spec, [(leaf(previous, path), leaf(view, path), leaf(self.docs[event], path))
                                 for path in spacing_paths(self, previous, view)]))
        return found

    def test_no_current_dossier_has_a_word_joined_to_a_number_or_a_word(self):
        self.assertEqual(len(self.docs), 7)
        for event, doc in self.docs.items():
            for path, text in reader_strings(doc):
                with self.subTest(event=event, path='/'.join(map(str, path))):
                    self.assertEqual(joined_words(text), [])

    def test_every_spaced_string_held_a_join_and_holds_none_now(self):
        for event in SPACED:
            for spec, pairs in self.edges(event):
                self.assertEqual(len(pairs), spec['strings'])
                for old, new, now in pairs:
                    with self.subTest(event=event, edge=spec['current'][:12], text=old[:60]):
                        self.assertNotEqual(joined_words(old), [])
                        self.assertEqual(joined_words(now), [])

    def test_identifiers_written_joined_are_not_flagged(self):
        for text in ('Video 5ohIVzIZLuQ at 04:22 MM:SS', 'An EF4 rating and an F5 rating', 'Header WFUS54 KBMX',
                     'Release c20260323 in BAMS-D-20-0251.1', 'Page E2777 of 1,351 frames', 'Panels 6b,c on the 27th',
                     'File IMG_9287-800.jpg and DOI 10.1175/BAMS-D-20-0251.1', 'SHA256 ' + 'd4' * 32,
                     'Points [-97.605,35.303] at 2013-05-20T20:04:00Z', 'Read https://example.org/a2b?c=3',
                     'Channel TornadoCentral and FlowFrames on YouTube', 'A GoPro clip near McClain read by MacGorman',
                     'Reflectivity in dBZ, sRGB color, PD-USGov and WebM', 'Fields playableInEmbed=true and currentTime',
                     'Several PDFs and IDs'):
            with self.subTest(text=text):
                self.assertEqual(joined_words(text), [])

    def test_joined_words_are_flagged(self):
        for text, word in (('See Table2.', 'Table2.'), ('Issued at2:40p.m.CDT today', 'at2:40p.m.CDT'),
                           ('Published December2022', 'December2022'), ('Figures 5,8 show it', '5,8'),
                           ('About 150m away', '150m'), ('It was 23pages long', '23pages'),
                           ('Exact public uploadEm5HbYt0Fsk and title', 'upload...'),
                           ('Video 5ohIVzIZLuQand more', '...and'), ('ID 9KjWtBrEYHY2011', '...2011'),
                           ('Issued 2:40a.m. today', '2:40a.m.'),
                           ('Metadata read: exactID/title/channel, playabilityOK', 'exactID/title/channel,'),
                           ('Metadata read: exactID/title/channel, playabilityOK', 'playabilityOK'),
                           ('VideoID EFwJAlg0qWc', 'VideoID'), ('The retainedPDF page', 'retainedPDF'),
                           ('Credit remainsJeffSnyder.', 'remainsJeffSnyder.'),
                           ('The channelTornadoCentral upload', 'channelTornadoCentral'),
                           ('Two GoPros', 'GoPros'), ('The PDFwas kept', 'PDFwas'),
                           ('Player with autoplayoff, as described', 'autoplayoff,')):
            with self.subTest(text=text):
                self.assertIn(word, joined_words(text))

    def test_every_held_name_is_camel_case_the_rule_would_otherwise_flag(self):
        for name in NAMES:
            with self.subTest(name=name):
                self.assertEqual(joined_words('x ' + name + ' y'), [])
                self.assertNotEqual(joined_words('x ' + name + 's y'), [])

    def test_a_mutated_current_dossier_is_not_a_late_spacing_edge(self):
        changes = {
            'one more space': lambda doc: doc['sources'][0].__setitem__('title', doc['sources'][0]['title'] + ' '),
            'a joined word again': lambda doc: next(row for row in doc['sources'] if row['id'] == 'wakimoto-aerial-2016')
                .__setitem__('access', 'retainedPDF'),
            'a different basis': lambda doc: doc['provenance']['publication_review'].__setitem__('basis', 'Spacing.'),
        }
        # A wording recast edge is newer, so the late spacing edge gets what that edge retained.
        base, entry = recast_boundary(self, self.docs['el-reno-2013'])
        late_spacing_boundary(self, base, ROOT, entry)
        for label, change in changes.items():
            with self.subTest(change=label):
                current = copy.deepcopy(base)
                change(current)
                with self.assertRaisesRegex(AssertionError, 'Only the exact reviewed continuation'):
                    late_spacing_boundary(self, current, ROOT, entry)

    def test_an_injected_join_in_a_current_dossier_is_found(self):
        doc = copy.deepcopy(self.docs['tuscaloosa-birmingham-2011'])
        doc['observations'][0]['account'] += ' See Table2.'
        found = [joined_words(text) for _, text in reader_strings(doc) if joined_words(text)]
        self.assertEqual(found, [['Table2.']])

    def test_no_published_page_shows_a_word_this_edge_spaced_in_its_joined_form(self):
        pages = {path.relative_to(ROOT).as_posix(): path.read_text(encoding='utf-8') for path in published_files()}
        self.assertIn('web/coverage.html', pages)
        tested = 0
        for event in SPACED:
            pairs = [pair for _, found in self.edges(event) for pair in found]
            shown = 0
            for old, new, now in pairs:
                new_words = new.split(' ')
                words = {word.strip(EDGE) for word in old.split(' ') if word not in new_words}
                for word in sorted(words - {''}):
                    tested += 1
                    for name, text in pages.items():
                        with self.subTest(event=event, page=name, word=word):
                            self.assertFalse(any(form in text for form in shown_forms(word)))
                shown += any(form in pages['web/coverage.html'] for form in shown_forms(now))
            if event != 'udall-1955':
                self.assertGreater(shown, 0, 'The coverage page shows spaced text from ' + event)
        self.assertGreater(tested, 100)

    def test_no_exhibit_reading_list_has_a_joined_word(self):
        lists = sorted((ROOT / 'exhibits').glob('*/reading.json'))
        self.assertGreater(len(lists), 0)
        for path in lists:
            strings = list(reader_strings(json.loads(path.read_bytes())))
            self.assertGreater(len(strings), 100)
            for where, text in strings:
                with self.subTest(file=path.parent.name, path='/'.join(map(str, where))):
                    self.assertEqual(joined_words(text), [])

    def test_no_current_catalogue_detail_note_has_a_joined_word(self):
        folder = ROOT / 'web/catalogue'
        rows = json.loads((folder / 'index.json').read_bytes())['records']
        details = {name: json.loads((folder / name).read_bytes()) for name in sorted({row['detail_file'] for row in rows})}
        checked = 0
        for name, records in details.items():
            for record_id, detail in records.items():
                for field in ('curation', 'location_review'):
                    for path, text in reader_strings(detail.get(field) or {}, (field,)):
                        checked += 1
                        with self.subTest(record=record_id, path='/'.join(map(str, path))):
                            self.assertEqual(joined_words(text), [])
        for doc in self.docs.values():
            for record in doc['records']:
                row = next(row for row in rows if row['id'] == record['id'])
                self.assertEqual(details[row['detail_file']][record['id']]['curation']['basis'], record['basis'])
        self.assertGreater(checked, 400)

    def test_spacing_edges_return_the_exact_predecessors(self):
        self.assertEqual(set(SPACING_PROMOTIONS), set(SPACED))
        for event, specs in SPACING_PROMOTIONS.items():
            with self.subTest(event=event):
                previous, entry = spacing_boundary(self, self.docs[event])
                self.assertEqual(canonical(previous), specs[0]['previous'])
                self.assertEqual(entry['dossier_sha256'], specs[0]['previous'])
                # El Reno has a later footage register edge, with a late spacing edge above it, and footage_predecessor
                # peels both. Every other event ends at its last spacing edge.
                self.assertEqual(canonical(footage_predecessor(self, self.docs[event])), specs[-1]['current'])
                for older, newer in zip(specs, specs[1:]):
                    self.assertEqual((newer['previous'], newer['previous_index_sha256']),
                                     (older['current'], older['current_index_sha256']))
        for event, specs in LATE_SPACING_PROMOTIONS.items():
            with self.subTest(event=event, edge='late'):
                footage = FOOTAGE_PROMOTIONS[event]
                self.assertEqual((specs[0]['previous'], specs[0]['previous_index_sha256']),
                                 (footage['current'], footage['current_index_sha256']))
                # A wording recast edge is newer still, so it is peeled first.
                late, late_entry = recast_boundary(self, self.docs[event])
                previous, entry = late_spacing_boundary(self, late, ROOT, late_entry)
                self.assertEqual((canonical(previous), canonical(entry)),
                                 (footage['current'], footage['current_index_sha256']))
                self.assertEqual(canonical(late), specs[-1]['current'])
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
                'time': {'capture': {'reported': 'at23:24:55UTC', 'precision': 'second'},
                         'alignment': {'reported': 'at2207UTC'}, 'publication': '2019-11-16'},
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
            'an alignment time': (lambda doc: doc['time']['alignment'].__setitem__('reported', 'at 2207 UTC'),
                                  'alignment or video time'),
            'a capture precision': (lambda doc: doc['time']['capture'].__setitem__('precision', 'sec ond'),
                                    'only change reader prose'),
            'a split clock': (lambda doc: doc.__setitem__('locator', doc['locator'].replace('04:22', '04: 22')),
                              'cannot split'),
            'a split DOI': (lambda doc: doc.__setitem__('locator', doc['locator'].replace('1175/BAMS', '1175/ BAMS')),
                            'cannot split'),
            'a split link': (lambda doc: doc.__setitem__('locator', doc['locator'].replace('org/a2b', 'org/a 2b')),
                             'cannot split'),
            'a split date': (lambda doc: doc['time'].__setitem__('publication', '2019- 11-16'), 'cannot split'),
            'a leading space': (lambda doc: doc.__setitem__('title', ' Event451537'), 'cannot split'),
            'a doubled space': (lambda doc: doc.__setitem__('title', 'Event  451537'), 'one space at a time'),
            'a space inside a word': (lambda doc: doc.__setitem__('title', 'Eve nt 451537'), 'ran together'),
            'a space beside a space': (lambda doc: doc.__setitem__('locator', doc['locator'].replace(' at ', '  at ')),
                                       'ran together'),
            'a split enum': (lambda doc: doc['rows'][0].__setitem__('limits', 'Pa ge10'), 'ran together'),
            'a capture space away from the zone': (lambda doc: doc['time']['capture'].__setitem__(
                'reported', 'at 23:24:55 UTC'), 'before its zone'),
        }
        self.assertEqual(spacing_paths(self, base, copy.deepcopy(base)), [])
        spaced = copy.deepcopy(base)
        spaced['title'] = 'Event 451537'
        spaced['rows'][0]['limits'] = 'Page 10'
        spaced['time']['capture']['reported'] = 'at23:24:55 UTC'
        self.assertEqual(spacing_paths(self, base, spaced),
                         [('title',), ('rows', 0, 'limits'), ('time', 'capture', 'reported')])
        hashed = {'revision': 'SHA256' + 'd4' * 32}
        self.assertEqual(spacing_paths(self, hashed, {'revision': 'SHA256 ' + 'd4' * 32}), [('revision',)])
        # A held name is never split, and a space before one must follow a letter run into it.
        named = {'title': 'Channel TornadoCentral', 'rights': 'Player x/YouTube'}
        self.assertEqual(spacing_paths(self, {'title': 'channelTornadoCentral'}, {'title': 'channel TornadoCentral'}),
                         [('title',)])
        for after, message in (({**named, 'title': 'Channel Tornado Central'}, 'cannot split'),
                               ({**named, 'rights': 'Player x/ YouTube'}, 'ran together')):
            with self.subTest(after=after), self.assertRaisesRegex(AssertionError, message):
                spacing_paths(self, named, after)
        with self.assertRaisesRegex(AssertionError, 'cannot split'):
            spacing_paths(self, {'title': 'Near McClain'}, {'title': 'Near Mc Clain'})
        # Two lower case words open only where the reviewed list puts their space.
        self.assertEqual(spacing_paths(self, {'rights': 'with autoplayoff'}, {'rights': 'with autoplay off'}),
                         [('rights',)])
        for before, after in (('with autoplayoff', 'with auto playoff'), ('an autoplayoffset', 'an autoplay offset')):
            with self.subTest(before=before), self.assertRaisesRegex(AssertionError, 'ran together'):
                spacing_paths(self, {'rights': before}, {'rights': after})
        for join, spaced in LOWER_JOINS.items():
            with self.subTest(join=join):
                self.assertEqual((spaced.count(' '), spaced.replace(' ', '')), (1, join))
                self.assertEqual((joined_words(join), joined_words(spaced)), ([join], []))
        self.assertEqual(joined_words('an autoplayoffset'), [])
        for label, (change, message) in changes.items():
            with self.subTest(change=label):
                after = copy.deepcopy(base)
                change(after)
                with self.assertRaisesRegex(AssertionError, message):
                    spacing_paths(self, base, after)

    def test_a_mutated_current_dossier_is_not_a_spacing_edge(self):
        for event in SPACED:
            changes = {
                'one more space': lambda doc: doc['sources'][0].__setitem__('title', doc['sources'][0]['title'] + ' '),
                'a changed rights line': lambda doc: doc['sources'][0].__setitem__('rights', 'Unreviewed replacement'),
                'a different basis': lambda doc: doc['provenance']['publication_review'].__setitem__('basis', 'Spacing.'),
            }
            # El Reno's later edges would refuse these first, so the spacing edge
            # gets the document and index entry the footage register edge retained.
            base, entry = footage_boundary(self, self.docs[event])
            for label, change in changes.items():
                with self.subTest(event=event, change=label):
                    current = copy.deepcopy(base)
                    change(current)
                    with self.assertRaisesRegex(AssertionError, 'Only the exact reviewed continuation'):
                        spacing_boundary(self, current, ROOT, entry)


if __name__ == '__main__':
    unittest.main()
