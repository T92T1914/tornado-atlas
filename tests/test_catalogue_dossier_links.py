"""Catalogue article links follow reviewed associations, not source-name guesses."""
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from atlas.archive import dossiers
from atlas.catalogue import import_ncei
from atlas.publication import (build, export_catalogue, load_catalogue_aliases,
                               reviewed_catalogue_aliases)
import test_catalogue as fixtures
from test_catalogue import sample

ROOT = Path(__file__).resolve().parents[1]
FROZEN = json.loads((ROOT / 'tests/fixtures/catalogue-dossier-discovery.json').read_text(encoding='utf-8'))
EXPECTED = {identifier: group['route'] for group in FROZEN['groups']
            for identifier in group['records']}


class CatalogueDossierLinksTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.legacy = json.loads((ROOT / 'research/record-aliases.json').read_text(encoding='utf-8'))
        cls.links = json.loads((ROOT / 'research/catalogue-dossier-links.json').read_text(encoding='utf-8'))
        cls.events = json.loads((ROOT / 'exhibits/events.json').read_text(encoding='utf-8'))
        cls.reviewed = dossiers(ROOT)

    def reconcile(self, *, aliases=None, links=None, events=None, reviewed=None):
        return reviewed_catalogue_aliases(
            copy.deepcopy(self.legacy if aliases is None else aliases),
            copy.deepcopy(self.links if links is None else links),
            copy.deepcopy(self.events if events is None else events),
            copy.deepcopy(self.reviewed if reviewed is None else reviewed))

    def test_fifteen_routes_match_the_source_qualified_extension(self):
        result = load_catalogue_aliases(ROOT)
        self.assertEqual(len(EXPECTED), 15)
        self.assertEqual({key: row['exhibit'] for key, row in result.items()
                          if row.get('exhibit')}, EXPECTED)
        for group in FROZEN['groups']:
            for identifier in group['records']:
                with self.subTest(record=identifier):
                    names = ' '.join(result[identifier]['names']).casefold()
                    self.assertTrue(all(term.casefold() in names
                                        for term in group['query'].split()))
                    self.assertTrue(result[identifier]['basis'])
        self.assertNotIn(FROZEN['unrelated_record'], result)
        self.assertEqual(next(doc for doc in self.reviewed
                              if doc['id'] == 'blackwell-1955')['coverage'], 'Dossier')

    def test_historical_alias_bytes_and_existing_positive_annotations_are_preserved(self):
        self.assertEqual(hashlib.sha256((ROOT / 'research/record-aliases.json').read_bytes()).hexdigest(),
                         FROZEN['legacy_alias_sha256'])
        result = self.reconcile()
        for identifier in ['ncei:453682', 'ncei:296617', 'ncei:296620']:
            self.assertEqual(result[identifier], self.legacy[identifier])
        self.assertEqual(result['ncei:10096417']['basis'], self.legacy['ncei:10096417']['basis'])
        self.assertEqual(result['ncei:10096417']['sources'], self.legacy['ncei:10096417']['sources'])
        before = copy.deepcopy((self.legacy, self.links, self.events, self.reviewed))
        self.reconcile()
        self.assertEqual((self.legacy, self.links, self.events, self.reviewed), before)

    def test_new_catalogue_basis_retains_the_accepted_association_text(self):
        reviewed = copy.deepcopy(self.reviewed)
        row = next(doc for doc in reviewed if doc['id'] == 'moore-2013')['records'][0]
        row['basis'] = '  Source spelling and combining text: cafe\u0301.  '
        result = self.reconcile(reviewed=reviewed)
        self.assertEqual(result[row['id']]['basis'], row['basis'])

    def test_ambiguous_or_duplicate_reviewed_membership_is_refused(self):
        for same_event in [False, True]:
            reviewed = copy.deepcopy(self.reviewed)
            target = reviewed[0] if same_event else reviewed[1]
            target['records'].append(copy.deepcopy(reviewed[0]['records'][0]))
            with self.subTest(same_event=same_event), self.assertRaisesRegex(ValueError, 'Ambiguous or duplicate'):
                self.reconcile(reviewed=reviewed)

    def test_unreviewed_unknown_missing_and_reassigned_members_are_refused(self):
        variants = []
        missing = copy.deepcopy(self.links)
        missing['associations'].pop()
        variants.append(missing)
        unknown = copy.deepcopy(self.links)
        unknown['associations'][0]['records'].append(FROZEN['unrelated_record'])
        variants.append(unknown)
        duplicate = copy.deepcopy(self.links)
        duplicate['associations'][0]['records'].append('ncei:453682')
        variants.append(duplicate)
        reassigned = copy.deepcopy(self.links)
        reassigned['associations'][1]['records'].append('ncei:453682')
        variants.append(reassigned)
        for links in variants:
            with self.subTest(links=links), self.assertRaises(ValueError):
                self.reconcile(links=links)
        reviewed = copy.deepcopy(self.reviewed)
        reviewed[0]['records'][0]['status'] = 'unreviewed'
        with self.assertRaisesRegex(ValueError, 'unreviewed'):
            self.reconcile(reviewed=reviewed)

    def test_legacy_conflicts_and_unassociated_article_routes_are_refused(self):
        aliases = copy.deepcopy(self.legacy)
        aliases['ncei:10096417']['exhibit'] = 'joplin.html'
        with self.assertRaisesRegex(ValueError, 'Conflicting retained article route'):
            self.reconcile(aliases=aliases)
        aliases = copy.deepcopy(self.legacy)
        aliases[FROZEN['unrelated_record']] = {'names': ['Unrelated'], 'exhibit': 'udall.html'}
        with self.assertRaisesRegex(ValueError, 'no accepted source association'):
            self.reconcile(aliases=aliases)

    def test_missing_duplicate_or_unsafe_documentary_routes_are_refused(self):
        for route in [None, '', '../private.html', 'https://example.invalid/account',
                      'udall.html?private=1', 'joplin.html']:
            events = copy.deepcopy(self.events)
            events['events'][0]['documentary'] = route
            with self.subTest(route=route), self.assertRaisesRegex(ValueError, 'article route'):
                self.reconcile(events=events)
        events = copy.deepcopy(self.events)
        events['events'].pop()
        with self.assertRaisesRegex(ValueError, 'unique article route'):
            self.reconcile(events=events)

    def test_normal_build_refuses_conflict_or_missing_article_before_connect_or_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in ['research/record-aliases.json', 'research/catalogue-dossier-links.json',
                             'exhibits/events.json']:
                destination = root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes((ROOT / relative).read_bytes())
            (root / 'web/catalogue').mkdir(parents=True)
            marker = root / 'web/catalogue/index.json'
            marker.write_bytes(b'previous publication remains intact')
            for event in self.events['events']:
                (root / 'web' / event['documentary']).write_text('Existing public account')
            reviewed = copy.deepcopy(self.reviewed)
            reviewed[1]['records'].append(copy.deepcopy(reviewed[0]['records'][0]))
            for conflict in [True, False]:
                if not conflict:
                    (root / 'web/udall.html').unlink()
                before = {str(path.relative_to(root)): path.read_bytes()
                          for path in root.rglob('*') if path.is_file()}
                with self.subTest(conflict=conflict), patch('atlas.publication.ROOT', root), \
                        patch('atlas.archive.dossiers', return_value=reviewed if conflict else self.reviewed), \
                        patch('atlas.publication.connect') as connect:
                    with self.assertRaises(ValueError):
                        build()
                    connect.assert_not_called()
                self.assertEqual(before, {str(path.relative_to(root)): path.read_bytes()
                                          for path in root.rglob('*') if path.is_file()})


class CatalogueAnnotationPublicationTests(unittest.TestCase):
    def test_publication_changes_only_curation_and_reading_index_fields(self):
        fixture = fixtures.PersistenceTests()
        fixture.setUp()
        try:
            identifiers = list(EXPECTED) + [FROZEN['unrelated_record']]
            rows = [sample(EVENT_ID=identifier.split(':')[1]) for identifier in identifiers]
            import_ncei(fixture.db, fixture.snapshot(rows, '20260323'), fixture.root)
            output = fixture.root / 'public'
            export_catalogue(fixture.db, output, {})
            before = json.loads((output / 'index.json').read_text(encoding='utf-8'))
            old_files = {row['detail_file']: (output / row['detail_file']).read_bytes()
                         for row in before['records']}
            annotations = load_catalogue_aliases(ROOT)
            export_catalogue(fixture.db, output, annotations)
            after = json.loads((output / 'index.json').read_text(encoding='utf-8'))
            self.assertEqual(after['coverage'], before['coverage'])
            self.assertEqual(after['sources'], before['sources'])
            before_rows = {row['id']: row for row in before['records']}
            for row in after['records']:
                old_row = before_rows[row['id']]
                self.assertEqual({key: value for key, value in row.items()
                                  if key not in {'aliases', 'exhibit', 'detail_file'}},
                                 {key: value for key, value in old_row.items()
                                  if key not in {'aliases', 'exhibit', 'detail_file'}})
                old_detail = json.loads(old_files[old_row['detail_file']])[row['id']]
                detail = json.loads((output / row['detail_file']).read_text(encoding='utf-8'))[row['id']]
                self.assertEqual(detail.pop('curation'), annotations.get(row['id']))
                old_detail.pop('curation')
                self.assertEqual(detail, old_detail)
                self.assertEqual(row['exhibit'], EXPECTED.get(row['id']))
            for relative, content in old_files.items():
                self.assertEqual((output / relative).read_bytes(), content)
        finally:
            fixture.tearDown()


if __name__ == '__main__':
    unittest.main()
