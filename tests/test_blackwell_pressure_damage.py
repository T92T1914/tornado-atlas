"""Keep the pressure instrument, qualitative damage and event clock distinct."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PRIOR = ROOT / 'web/archive/blackwell-1955-a90a7539209f78940922.json'
PRESSURE_REVISION = ROOT / 'web/archive/blackwell-1955-cc230959464007bb4cbc.json'
NEW_IDS = {'blackwell-tonkawa-barograph', 'blackwell-debris-directions'}


class BlackwellPressureDamageTests(unittest.TestCase):
    def setUp(self):
        self.prior = json.loads(PRIOR.read_bytes())
        # This test describes that exact increment, not every later current dossier.
        self.current = json.loads(PRESSURE_REVISION.read_bytes())
        self.items = {o['id']: o for o in self.current['observations'] if o['id'] in NEW_IDS}

    def test_increment_preserves_existing_evidence_and_only_adds_two_observations(self):
        self.assertEqual(set(self.items), NEW_IDS)
        self.assertEqual([o for o in self.current['observations'] if o['id'] not in NEW_IDS], self.prior['observations'])
        for field in ('records', 'sources', 'media', 'creators', 'reconstruction'):
            self.assertEqual(self.current[field], self.prior[field], field)
        self.assertEqual(self.current['routes'][:-1], self.prior['routes'])
        self.assertEqual(self.current['routes'][-1]['href'], 'blackwell.html#pressure-damage')

    def test_barograph_clock_is_an_unchecked_capture_label_without_blackwell_registration(self):
        item = self.items['blackwell-tonkawa-barograph']
        self.assertIsNone(item['time']['event'])
        self.assertEqual(item['time']['capture']['reported'], 'about 2055 CST')
        self.assertIn('time checks absent', item['time']['capture']['precision'])
        self.assertIsNone(item['time']['alignment'])
        self.assertIsNone(item['place']['coordinates'])
        self.assertIn('Tonkawa', item['place']['reported'])
        self.assertIn('not placed at that funnel location', item['place']['reported'])
        self.assertEqual(item['status']['temporal'], 'source_label')
        self.assertIn('0.08 inch Hg', item['account'])
        self.assertIn('0.10 inch Hg', item['account'])

    def test_debris_directions_do_not_become_measured_wind_or_geometry(self):
        item = self.items['blackwell-debris-directions']
        self.assertIsNone(item['time']['event'])
        self.assertIsNone(item['time']['capture'])
        self.assertIsNone(item['time']['alignment'])
        self.assertIsNone(item['place']['coordinates'])
        self.assertEqual(item['status']['spatial'], 'unregistered')
        self.assertEqual(item['status']['temporal'], 'unregistered')
        self.assertIn('not measured wind speeds', item['limits'])

    def test_observations_reuse_existing_report_without_claiming_new_media_rights(self):
        for item in self.items.values():
            self.assertEqual(item['source_id'], 'nws-wichita')
            self.assertEqual(item['status']['intake'], 'published')
            self.assertEqual(item['status']['assertion'], 'source_reported')
            self.assertEqual(item['status']['rights'], 'links_only')
            self.assertIn('original printed report', item['review'])


if __name__ == '__main__':
    unittest.main()
