"""The Joplin segment map draws exactly what the three catalogue records report."""

import json
import math
import unittest
from pathlib import Path

from tools.render_joplin_segments import CONFIG, check, kilometres, placement

ROOT = Path(__file__).resolve().parents[1]


def published_records(ids):
    index = json.loads((ROOT / 'web/catalogue/index.json').read_text(encoding='utf-8'))
    found = {}
    for entry in index['records']:
        if entry['id'] in ids:
            detail = json.loads((ROOT / 'web/catalogue' / entry['detail_file']).read_text(encoding='utf-8'))
            found[entry['id']] = (entry, detail[entry['id']])
    return found


class JoplinSegmentMapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = json.loads(CONFIG.read_text(encoding='utf-8'))
        cls.receipt = check()

    def test_each_segment_matches_its_published_record(self):
        segments = self.config['segments']
        records = published_records({segment['id'] for segment in segments})
        self.assertEqual(set(records), {segment['id'] for segment in segments})
        for segment in segments:
            with self.subTest(record=segment['id']):
                entry, record = records[segment['id']]
                self.assertEqual(entry['source_snapshot'], segment['source_snapshot'])
                self.assertEqual(record['local_area'], segment['local_area'])
                self.assertEqual(record['rating']['reported'], segment['rating'])
                self.assertEqual(record['time']['begin']['reported'], segment['begin'])
                self.assertEqual(record['time']['end']['reported'], segment['end'])
                self.assertEqual(record['time']['begin']['zone'], segment['zone'])
                self.assertEqual(record['spatial']['begin_point'], segment['begin_point'])
                self.assertEqual(record['spatial']['end_point'], segment['end_point'])
                self.assertEqual(record['spatial']['basis'], self.config['basis'])
                self.assertIsNone(record['spatial']['track'])
                # The key repeats the recorded clock and rating, never a converted one.
                self.assertEqual(segment['clock'], f"{segment['begin'][10:15]} to {segment['end'][10:15]} {segment['zone']}")
                self.assertTrue(segment['place'].endswith(', ' + segment['rating']))

    def test_drawn_endpoints_follow_the_records(self):
        projected = kilometres(self.config)
        for name, layout in self.receipt['layouts'].items():
            with self.subTest(layout=name):
                left, top, width, height = layout['map']
                self.assertEqual(layout, layout | placement(self.config, left, top, width))
                drawn = layout['segments']
                # Shared endpoints in the records stay one point in the drawing.
                self.assertEqual(drawn[0]['end_px'], drawn[1]['begin_px'])
                self.assertEqual(drawn[1]['end_px'], drawn[2]['begin_px'])
                for (begin, end), segment in zip(projected, drawn):
                    km = math.dist(begin, end)
                    px = math.dist(segment['begin_px'], segment['end_px'])
                    self.assertAlmostEqual(px / km, layout['pixels_per_km'], delta=0.01)
                for segment in drawn:
                    for x, y in (segment['begin_px'], segment['end_px']):
                        self.assertTrue(left < x < left + width and top < y < top + height)

    def test_the_figure_states_what_it_is_not(self):
        self.assertFalse(self.receipt['survey'])
        self.assertIn('Not the surveyed path', self.config['footer'])
        self.assertIn('straight line between its recorded endpoints', self.config['subtitle'])
        for name, layout in self.receipt['layouts'].items():
            with self.subTest(layout=name):
                self.assertGreaterEqual(layout['minimum_font_points'], 30)

    def test_the_page_shows_both_editions_with_their_limits(self):
        page = (ROOT / 'web/joplin.html').read_text(encoding='utf-8')
        narrow = self.receipt['layouts']['narrow']
        self.assertIn('srcset="assets/joplin-2011/segments-obscur-wide.png"', page)
        self.assertIn(f'src="assets/joplin-2011/segments-obscur-narrow.png" width="{narrow["width"]}" '
                      f'height="{narrow["height"]}"', page)
        self.assertIn('href="assets/joplin-2011/segments-obscur-wide.svg"', page)
        self.assertIn('so it is not the surveyed path', page)


if __name__ == '__main__':
    unittest.main()
