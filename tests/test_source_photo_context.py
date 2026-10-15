"""Consistency checks for admitted documentary context, not source authentication."""
import copy,json,math,unittest
from pathlib import Path
from atlas.event_package import validate_appearance_timeline,utc
from atlas.evidence_coverage import validate_source_comparison_joins
from atlas.archive import dossiers,validate_dossier
ROOT=Path(__file__).resolve().parents[1]
TIMELINE=json.loads((ROOT/'exhibits/el-reno-2013/appearance-timeline.json').read_bytes())
CONFIG=json.loads((ROOT/'exhibits/el-reno-2013/replay.json').read_bytes())
FOOTAGE=json.loads((ROOT/'exhibits/el-reno-2013/footage.json').read_bytes())
CASES=json.loads((ROOT/'tests/fixtures/source-photo-context-cases.json').read_bytes())
def fixture():
 value=copy.deepcopy(TIMELINE);value['windows']=[]
 value['photo_sequences']=[next(s for s in value['photo_sequences'] if s['id']=='nolte-reported-stills')]
 return value
def validate(value):
 validate_appearance_timeline(value,value['event'],utc(CONFIG['clock']['start_utc']),utc(CONFIG['clock']['end_utc']),FOOTAGE['sources'])
class SourcePhotoContextTests(unittest.TestCase):
 def test_reading_precision_and_legacy_source_labels_remain_distinct(self):
  value=fixture();validate(value);samples=value['photo_sequences'][0]['samples']
  self.assertEqual(samples[0]['reported_utc'],'2013-05-31T23:10:37Z')
  self.assertEqual(samples[0]['source_comparison']['printed_utc'],'2013-05-31T23:10:37.254Z')
  self.assertEqual(samples[1]['source_comparison']['reading_precision'],'whole_second_label_readable')
  self.assertNotIn('source_comparison',samples[2]);self.assertNotIn('source_comparison',samples[3])
  for sample in samples:
   sample.pop('source_comparison',None);sample.pop('hosted_image',None)
  validate(value);value['schema_version']=3;validate(value)
  old=fixture();old['schema_version']=3
  with self.assertRaises(ValueError):validate(old)
 def test_shared_invalid_claims_and_positions_reject(self):
  for case in CASES['invalid']:
   with self.subTest(case=case['name']):
    value=fixture();comparison=value['photo_sequences'][0]['samples'][0]['source_comparison']
    for change in case.get('changes',[case]):
     target=comparison
     for key in change['path'][:-1]:target=target[key]
     target[change['path'][-1]]=change['value']
    with self.assertRaises(ValueError):validate(value)
  for bad in (None,[],False):
   value=fixture();value['photo_sequences'][0]['samples'][0]['source_comparison']=bad
   with self.assertRaises(ValueError):validate(value)
  for bad in (math.nan,math.inf,-math.inf):
   value=fixture();value['photo_sequences'][0]['samples'][0]['source_comparison']['callback_seconds']=bad
   with self.assertRaises(ValueError):validate(value)
 def test_reviewed_dossier_points_match_each_comparison(self):
  doc=next(d for d in dossiers(ROOT) if d['id']=='el-reno-2013')
  validate_source_comparison_joins(doc,fixture())
 def test_unadmitted_or_mismatched_dossier_points_reject(self):
  original=next(d for d in dossiers(ROOT) if d['id']=='el-reno-2013')
  mutations=[(('status','intake'),'candidate'),(('status','availability'),'unavailable'),(('status','temporal'),'discrete_anchor'),(('review',),'Unverified string review'),(('review','photo_sample_id'),'other-photo'),(('time','alignment'),{'offset':0}),(('place','coordinates'),[-97,35])]
  for path,replacement in mutations:
   with self.subTest(path=path):
    doc=copy.deepcopy(original);point=next(r for r in doc['media'] if r['id']=='nolte-timecoded-context-231037');target=point
    for key in path[:-1]:target=target[key]
    target[path[-1]]=replacement
    if path==('status','availability'):validate_dossier(doc)
    with self.assertRaises(ValueError):validate_source_comparison_joins(doc,fixture())
  value=fixture();value['photo_sequences'][0]['samples'][0]['source_comparison']['record_id']='missing-record'
  with self.assertRaises(ValueError):validate_source_comparison_joins(original,value)
if __name__=='__main__':unittest.main()
