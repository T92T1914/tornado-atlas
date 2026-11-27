"""The Moore dossier version that cites a paper beside its width limit.

The Moore dossier says a reported damage width is not the size of the visible
funnel. Atkins and colleagues (2014) measured both on this tornado, and a dated
research record holds what their text says. These tests hold the new dossier
version to an exact edge that adds one source and one observation, both tied
to that record, and check that the edge refuses anything else.
"""
import copy
import unittest

from atlas.archive import dossiers
from citation_continuation_support import (BASIS, CITATION_PROMOTIONS, ROOT, _citation_edge, canonical,
                                           citation_boundary, citation_index_entry, citation_rows,
                                           explain_successor, record_text, whole_number)
from spacing_continuation_support import SPACING_PROMOTIONS

EVENT = 'moore-2013'


class CitationEdgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docs = {doc['id']: doc for doc in dossiers(ROOT)}
        cls.spec = CITATION_PROMOTIONS[EVENT]

    def rows(self, doc=None):
        doc = self.docs[EVENT] if doc is None else doc
        source = next(row for row in doc['sources'] if row['id'] == self.spec['source'])
        observation = next(row for row in doc['observations'] if row['id'] == self.spec['observation'])
        return source, observation

    def test_the_edge_returns_the_spaced_predecessor_and_its_index_entry(self):
        self.assertEqual(canonical(self.docs[EVENT]), self.spec['current'])
        previous, entry = citation_boundary(self, self.docs[EVENT])
        self.assertEqual(canonical(previous), self.spec['previous'])
        self.assertEqual(canonical(entry), self.spec['previous_index_sha256'])
        spaced = SPACING_PROMOTIONS[EVENT][-1]
        self.assertEqual((self.spec['previous'], self.spec['previous_index_sha256'], self.spec['previous_history_file']),
                         (spaced['current'], spaced['current_index_sha256'], spaced['history_file']))
        self.assertTrue(self.docs[EVENT]['provenance']['publication_review']['basis'].startswith(BASIS))

    def test_events_without_the_edge_come_back_unchanged(self):
        self.assertEqual(set(CITATION_PROMOTIONS), {EVENT})
        for event, doc in self.docs.items():
            if event in CITATION_PROMOTIONS:
                continue
            with self.subTest(event=event):
                self.assertEqual(citation_boundary(self, doc), (doc, None))
                entry = {'id': event}
                self.assertIs(citation_index_entry(self, entry), entry)

    def test_the_current_dossier_cites_the_paper_beside_the_width_limit(self):
        doc = self.docs[EVENT]
        source, observation = self.rows()
        order = [row['id'] for row in doc['observations']]
        beside = order.index(self.spec['beside'])
        self.assertEqual(order[beside + 1], self.spec['observation'])
        self.assertIn('Reported damage length and width are not optical funnel size', doc['observations'][beside]['limits'])
        self.assertEqual(doc['sources'][-1], source)
        self.assertEqual(source['url'], 'https://doi.org/10.1175/BAMS-D-14-00033.1')
        self.assertIn('none of its images is used here', source['rights'])
        self.assertIn('"The condensation funnel diameter is estimated to be 18% and 8.4% of the width of the damage '
                      'path and TDS, respectively."', observation['account'])
        self.assertIn('2016:43 UTC', observation['account'])
        self.assertIn('"it is assumed that the condensation funnel center is collocated with the damage path '
                      'centerline."', observation['limits'])
        self.assertIn('the figures were not read', observation['limits'])
        self.assertIn('no funnel width for any other time', observation['limits'])
        self.assertEqual((observation['status']['temporal'], observation['status']['spatial']),
                         ('source_label', 'unregistered'))
        # The source row carries a processing statement the dossier already had, not a new one.
        self.assertIn(source['agent_processing'], [row['agent_processing'] for row in doc['sources'][:-1]])
        # The paper adds no creator, no media and no reconstruction, and every older row is what it was.
        previous = citation_boundary(self, doc)[0]
        for kind in ('creators', 'media', 'records', 'routes', 'reconstruction', 'summary', 'title', 'coverage'):
            self.assertEqual(doc[kind], previous[kind])
        for kind, added in (('sources', source), ('observations', observation)):
            self.assertEqual([row for row in doc[kind] if row is not added], previous[kind])

    def test_a_mutated_current_dossier_is_refused_by_its_pinned_bytes(self):
        changes = {
            'a changed rights line': lambda doc: doc['sources'][0].__setitem__('rights', 'Unreviewed replacement'),
            'a different basis': lambda doc: doc['provenance']['publication_review'].__setitem__('basis', 'Citation.'),
        }
        for label, change in changes.items():
            with self.subTest(change=label):
                current = copy.deepcopy(self.docs[EVENT])
                change(current)
                with self.assertRaisesRegex(AssertionError, 'Only the exact reviewed continuation'):
                    citation_boundary(self, current)

    def test_the_rebuild_refuses_every_change_it_does_not_name(self):
        # explain_successor reads no pinned bytes, so each change below reaches the rebuild itself.
        previous = citation_boundary(self, self.docs[EVENT])[0]
        record = record_text(self, self.spec)
        explain_successor(self, self.spec, previous, copy.deepcopy(self.docs[EVENT]), record)

        def swap(doc):
            rows = doc['observations']
            rows[1], rows[2] = rows[2], rows[1]
        explain = 'must explain every change'
        changes = {
            'a changed older rights line': (lambda doc: doc['sources'][0].__setitem__('rights', 'Unreviewed'), explain),
            'a changed older limit': (lambda doc: doc['observations'][1].__setitem__('limits', 'Unreviewed'), explain),
            'a moved observation': (swap, explain),
            'a second new source': (lambda doc: doc['sources'].append({**doc['sources'][-1], 'id': 'another'}), explain),
            'a new media row': (lambda doc: doc['media'].append(copy.deepcopy(doc['media'][0])), explain),
            'an extra input': (lambda doc: doc['provenance']['inputs'].__setitem__('future.md', '0' * 64), explain),
            'another record digest': (lambda doc: doc['provenance']['inputs'].__setitem__(self.spec['record'], '0' * 64),
                                      explain),
            'a registered interval': (lambda doc: doc['reconstruction']['intervals'].append({'start': 0, 'end': 1}),
                                      explain),
            'a number written as a float': (lambda doc: doc.__setitem__('schema_version', 1.0), 'exact JSON types'),
            'another basis': (lambda doc: doc['provenance']['publication_review'].__setitem__('basis', 'Citation.'),
                              'names the source citation'),
            'another candidate': (lambda doc: doc['provenance']['publication_review'].__setitem__(
                'candidate_sha256', '0' * 64), 'exact reviewed candidate'),
            'another predecessor': (lambda doc: doc['provenance']['publication_review'].__setitem__(
                'previous_dossier_sha256', '0' * 64), 'exact predecessor'),
            'another reviewer': (lambda doc: doc['provenance']['publication_review'].__setitem__(
                'reviewer_kind', 'other'), "!= 'agent'"),
            'a changed percentage in the new row': (lambda doc: self.rows(doc)[1].__setitem__(
                'account', self.rows(doc)[1]['account'].replace('18%', '81%')), 'exactly the passages this edge names'),
        }
        for label, (change, message) in changes.items():
            with self.subTest(change=label):
                successor = copy.deepcopy(self.docs[EVENT])
                change(successor)
                with self.assertRaisesRegex(AssertionError, message):
                    explain_successor(self, self.spec, previous, successor, record)

    def test_the_named_rows_must_explain_the_successor_exactly(self):
        current = self.docs[EVENT]
        for label, change, message in (
                ('another neighbor', {'beside': 'county-impacts'}, 'must explain every change'),
                ('an older row named as new', {'observation': 'county-impacts'}, 'must be new'),
                ('another record', {'record_sha256': '0' * 64}, 'differs from the reviewed one'),
                ('another candidate', {'candidate_sha256': '0' * 64}, 'exact reviewed candidate'),
                ('a number left out', {'numbers': self.spec['numbers'][:-1]}, 'exactly the numbers this edge names'),
                ('a number the row does not state', {'numbers': self.spec['numbers'] + ('250',)},
                 'exactly the numbers this edge names'),
                ('a quotation left out', {'quotations': self.spec['quotations'][:-1]},
                 'exactly the passages this edge names')):
            with self.subTest(change=label), self.assertRaisesRegex(AssertionError, message):
                _citation_edge(self, current, {**self.spec, **change}, ROOT, None)

    def test_a_number_stands_in_the_record_only_as_a_whole_number(self):
        record = record_text(self, self.spec)
        for number in self.spec['numbers'] + ('18%', '8.4%', '250', '1955:27', '4,039'):
            with self.subTest(number=number):
                self.assertRegex(record, whole_number(number))
        # Each of these is in the record only as part of a longer number, a hash or a date.
        for number in ('80', '908', '43', '25', '039', '2016:4', '6e68'):
            with self.subTest(number=number):
                self.assertIn(number, record)
                self.assertNotRegex(record, whole_number(number))

    def test_the_new_rows_are_held_to_the_record(self):
        record = record_text(self, self.spec)
        source, observation = self.rows()
        citation_rows(self, self.spec, source, observation, record)

        def edited(row, *path, value):
            row = copy.deepcopy(row)
            target = row
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = value
            return row
        account, limits = observation['account'], observation['limits']
        quoted, named = 'exactly the passages this edge names', 'exactly the numbers this edge names'
        cases = {
            'a quotation the record does not hold': (source, edited(
                observation, 'account', value=account + ' The paper adds "the funnel was 640 m wide."'), quoted),
            'a reworded quotation': (source, edited(
                observation, 'account', value=account.replace('is estimated to be 18%', 'was 18%')), quoted),
            'the record author quoted as the paper': (source, edited(
                observation, 'account', value=account + ' The paper says "the funnel was about a fifth of the damage '
                'width."'), quoted),
            'a quotation in curly marks': (source, edited(
                observation, 'account', value=account + ' The paper says “the funnel was a mile wide.”'),
                'straight double marks'),
            'a quotation in single marks': (source, edited(
                observation, 'account', value=account + " The paper says 'the funnel was a mile wide.'"),
                'straight double marks'),
            'a real quotation moved into another claim': (source, edited(
                observation, 'limits', value=limits + ' The funnel was "about 250 m" wide.'), quoted),
            'a named number stated once more': (source, edited(
                observation, 'limits', value=limits + ' By 2013 standards the funnel was 20 m wide.'), named),
            'coordinates written as the basis of a place': (source, edited(
                observation, 'place', 'basis', value='Near 35.33 N, 97.50 W.'), named),
            'a number the record does not hold': (source, edited(
                observation, 'limits', value=limits + ' The funnel was 640 m wide.'), named),
            'a number the record holds for something else': (source, edited(
                observation, 'limits', value=limits + ' The funnel was 250 m wide.'), named),
            'a number found inside a hash in the record': (source, edited(
                observation, 'limits', value=limits + ' The funnel was 80 m wide.'), named),
            'a percentage moved outside its quotation': (source, edited(
                observation, 'limits', value=limits + ' At 1955:27 UTC the funnel was 18% of the damage width.'), named),
            'a number in the title': (source, edited(observation, 'title', value='A funnel 640 m wide'), named),
            'coordinates written as a place': (source, edited(
                observation, 'place', 'reported', value='Near 35.33 N, 97.50 W.'), named),
            'another clock label': (source, edited(
                observation, 'time', 'event', value='May 20, 2013. The paper labels the KTLX scan 2016:44 UTC.'), named),
            'no quotation': (source, edited(observation, 'account', value='The funnel was smaller than the damage path.'),
                             'quotes its source'),
            'another source': (source, edited(observation, 'source_id', value='nws-event-hub'), 'cites the new source'),
            'another DOI': (edited(source, 'url', value='https://doi.org/10.1175/BAMS-D-13-00001.1'), observation,
                            'a DOI link the record gives'),
            'a shortened DOI': (edited(source, 'url', value='https://doi.org/10.1175/BAMS-D-14-0003'), observation,
                                'a DOI link the record gives'),
            'the bare resolver': (edited(source, 'url', value='https://doi.org/'), observation,
                                  'a DOI link the record gives'),
            'no record named': (edited(source, 'access', value='Read on November 25, 2026.'), observation,
                                'names the record'),
            'a registered point': (source, edited(observation, 'place', 'coordinates', value=[-97.5, 35.3]),
                                   'registers no point'),
            'an aligned clock': (source, edited(
                observation, 'time', 'alignment', value={'utc': '2013-05-20T20:16:43Z', 'basis': 'unsupported'}),
                'registers no alignment time'),
            'a discrete anchor': (source, edited(observation, 'status', 'temporal', value='discrete_anchor'),
                                  'aligns no clock'),
            'a hosting right': (source, edited(observation, 'status', 'rights', value='permitted_hosting'),
                                'registers no place'),
            'a disputed claim': (source, edited(observation, 'status', 'assertion', value='disputed'),
                                 'registers no place'),
        }
        for label, (new_source, new_observation, message) in cases.items():
            with self.subTest(change=label), self.assertRaisesRegex(AssertionError, message):
                citation_rows(self, self.spec, new_source, new_observation, record)
        # Naming a passage in the edge does not admit it. The record has to quote it too.
        own_words = 'the funnel was about a fifth of the damage width.'
        self.assertIn(own_words, record)
        named_too = {**self.spec, 'quotations': self.spec['quotations'] + (own_words,)}
        with self.assertRaisesRegex(AssertionError, 'inside a passage the record quotes'):
            citation_rows(self, named_too, source, edited(
                observation, 'account', value=account + ' The paper says "' + own_words + '"'), record)
        # An apostrophe inside a word opens no quotation.
        citation_rows(self, self.spec, edited(source, 'rights', value=source['rights'] + " The publisher's terms apply."),
                      observation, record)


if __name__ == '__main__':
    unittest.main()
