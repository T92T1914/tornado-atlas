"""Service history remains separate from accepted storm reconstruction inputs."""
import json
from pathlib import Path
import unittest
from atlas.archive import digest, dossiers

ROOT = Path(__file__).resolve().parents[1]
BASE = 'c3e7158df532378f4a7f14f59b901f54797160dff84e73e4bc47425cb395272a'
IDS = {'nist-freeman-service-continuity', 'nist-sjrmc-internal-services',
       'nist-joplin-utility-restoration', 'nist-sjrmc-temporary-care',
       'barbe-joplin-temporary-care-phases', 'mercy-joplin-temporary-care-phases'}


class JoplinLifelineTests(unittest.TestCase):
    def test_preexisting_evidence_and_reconstruction_are_preserved(self):
        previous = json.loads((ROOT / f'web/archive/joplin-2011-{BASE[:20]}.json').read_text(encoding='utf-8'))
        self.assertEqual(digest(previous), BASE)
        current = next(row for row in dossiers(ROOT) if row['id'] == 'joplin-2011')
        for kind in ['records', 'routes', 'creators', 'media', 'reconstruction']:
            self.assertEqual(current[kind], previous[kind], kind)
        for kind in ['sources', 'observations']:
            actual = {row['id']: row for row in current[kind]}
            for row in previous[kind]:
                self.assertEqual(actual[row['id']], row, row['id'])
        self.assertEqual(set(row['id'] for row in current['observations']) -
                         set(row['id'] for row in previous['observations']), IDS)
        chronology = json.loads((ROOT / 'exhibits/joplin-2011/chronology.json').read_text(encoding='utf-8'))
        self.assertEqual(len(chronology['entries']), 7)
        self.assertNotIn(chronology['radar_context']['reference']['dossier_sha256'], [digest(current)])
        self.assertFalse(IDS.intersection(row['id'] for row in chronology['entries']))

    def test_service_labels_cannot_supply_impact_clocks_or_coordinates(self):
        current = next(row for row in dossiers(ROOT) if row['id'] == 'joplin-2011')
        for row in current['observations']:
            if row['id'] not in IDS:
                continue
            self.assertEqual(row['status']['assertion'], 'source_reported')
            self.assertEqual(row['status']['temporal'], 'unregistered')
            self.assertEqual(row['status']['spatial'], 'unregistered')
            self.assertIsNone(row['time']['alignment'])
            self.assertIsNone(row['time']['video'])
            self.assertIsNone(row['place']['coordinates'])
            self.assertEqual(row['status']['rights'], 'links_only')


if __name__ == '__main__':
    unittest.main()
