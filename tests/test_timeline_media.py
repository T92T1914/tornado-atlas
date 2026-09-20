import copy
import json
import unittest
from pathlib import Path
from atlas.timeline_media import validate_timeline_media

ROOT = Path(__file__).resolve().parents[1]


class TimelineMediaTests(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads((ROOT/'exhibits/el-reno-2013/timeline-media.json').read_text(encoding='utf8'))

    def test_actual_assets_match_recorded_hashes(self):
        validate_timeline_media(self.manifest, ROOT/'web')

    def test_clock_mismatch_naive_time_and_wrong_date_rejected(self):
        for stamp in ['2013-05-31T23:01:38Z','2013-05-31T23:01:37','2013-06-01T23:01:37Z']:
            item=copy.deepcopy(self.manifest);item['frames'][0]['utc']=stamp
            with self.assertRaises(ValueError): validate_timeline_media(item)

    def test_duplicate_and_reversed_records_rejected(self):
        for frames in [list(reversed(self.manifest['frames'])),self.manifest['frames']*2]:
            item=copy.deepcopy(self.manifest);item['frames']=frames
            with self.assertRaises(ValueError): validate_timeline_media(item)

    def test_integrity_and_asset_escape_rejected(self):
        item=copy.deepcopy(self.manifest);item['frames'][0]['sha256']='0'*64
        with self.assertRaises(ValueError): validate_timeline_media(item, ROOT/'web')
        item['frames'][0]['file']='../../private.png'
        with self.assertRaises(ValueError): validate_timeline_media(item)

    def test_clock_basis_is_required(self):
        self.manifest['clock_basis']=''
        with self.assertRaises(ValueError): validate_timeline_media(self.manifest)
