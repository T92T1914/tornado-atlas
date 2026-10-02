import copy
import json
import unittest

from atlas.archive import digest, dossiers, publication, source_directory


class SourceDirectoryTests(unittest.TestCase):
    def test_directory_preserves_exact_inspection_and_pins_current_dossier(self):
        docs = dossiers()
        artifacts = publication()
        reference = artifacts['archive/index.json']['source_directory']
        directory = artifacts[reference['file']]
        self.assertEqual(reference['file'], f"archive/sources-{digest(directory)[:20]}.json")
        self.assertEqual(reference['count'], sum(len(doc['sources']) for doc in docs))
        for row in directory['entries']:
            doc = next(doc for doc in docs if doc['id'] == row['event_id'])
            original = next(source for source in doc['sources'] if source['id'] == row['source']['id'])
            self.assertEqual(row['source'], original)
            self.assertEqual(row['dossier_sha256'], digest(doc))
            self.assertEqual(row['observations'], sum(item['source_id'] == original['id'] for item in doc['observations']))
            self.assertEqual(row['media'], sum(item['source_id'] == original['id'] for item in doc['media']))
        self.assertLess(len(json.dumps(directory).encode()), 256000)
        self.assertLess(len(json.dumps(artifacts['archive/index.json']).encode()), 40000)

    def test_shared_url_and_local_source_id_do_not_merge_distinct_inspections(self):
        first, second = copy.deepcopy(dossiers()[:2])
        first['sources'] = [first['sources'][0]]
        second['sources'] = [copy.deepcopy(first['sources'][0])]
        second['sources'][0]['locator'] = 'Synthetic independent locator.'
        second['sources'][0]['revision'] = 'Synthetic different source revision.'
        directory = source_directory([second, first])
        self.assertEqual(len(directory['entries']), 2)
        self.assertNotEqual(directory['entries'][0]['source']['locator'], directory['entries'][1]['source']['locator'])
        self.assertEqual(directory, source_directory([first, second]))
        directory['entries'][0]['source']['locator'] = 'A changed derivative.'
        self.assertEqual(first['sources'][0]['locator'], 'El Reno tornado narrative and tornado table, Union City / El Reno / Yukon row.')

    def test_oversized_metadata_fails_instead_of_silently_truncating_inspection(self):
        doc = copy.deepcopy(dossiers()[0])
        doc['sources'][0]['access'] = 'Synthetic inspection scope. ' * 20000
        with self.assertRaisesRegex(ValueError, 'selective loading budget'):
            source_directory([doc])


if __name__ == '__main__':
    unittest.main()
