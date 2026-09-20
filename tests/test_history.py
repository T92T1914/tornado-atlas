import copy
import json
import unittest
from atlas.sources import ROOT
from atlas.history import validate_history


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.history=json.loads((ROOT/'exhibits/el-reno-2013/history.json').read_text(encoding='utf-8'))
        self.photos=json.loads((ROOT/'exhibits/el-reno-2013/storm-photos.json').read_text(encoding='utf-8'))

    def test_names_sources_and_original_photographs_pass(self):
        validate_history(self.history,self.photos,ROOT/'web')

    def test_unsourced_or_duplicated_names_fail(self):
        self.history['remembrance']['people'][0]['sources']=[]
        with self.assertRaisesRegex(ValueError,'public source'):
            validate_history(self.history,self.photos)
        self.setUp()
        self.history['remembrance']['people'].append(copy.deepcopy(self.history['remembrance']['people'][0]))
        with self.assertRaisesRegex(ValueError,'duplicate'):
            validate_history(self.history,self.photos)

    def test_no_invented_position_or_negative_impacts(self):
        self.history['chapters'][0]['minute']=3
        with self.assertRaisesRegex(ValueError,'published minute'):
            validate_history(self.history,self.photos)
        self.setUp()
        self.history['impacts']['injuries_direct']=-1
        with self.assertRaisesRegex(ValueError,'nonnegative'):
            validate_history(self.history,self.photos)

    def test_photo_attribution_and_bytes_are_checked(self):
        self.photos[0]['sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'integrity'):
            validate_history(self.history,self.photos,ROOT/'web')
