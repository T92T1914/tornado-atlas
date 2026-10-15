"""Full documentary copies, separate item permission and retained clocks."""
import copy,hashlib,json,unittest
from pathlib import Path
from atlas.archive import dossiers,digest
from atlas.event_package import validate_appearance_timeline,utc
from atlas.evidence_coverage import validate_hosted_photo_joins
ROOT=Path(__file__).resolve().parents[1]
T=json.loads((ROOT/'exhibits/el-reno-2013/appearance-timeline.json').read_bytes())
C=json.loads((ROOT/'exhibits/el-reno-2013/replay.json').read_bytes())
F=json.loads((ROOT/'exhibits/el-reno-2013/footage.json').read_bytes())
EXPECTED=[('231037',216698,'e9ad30c4fdcb6a28340bbb0e422b80cbc937ef248b497092246c7bff51fd4847','20:41',1241),('231059',237567,'10de8e092a55e9f4e87650f6731fb70e0829ba90246335f48c484ce3bca47a8c','21:02',1262),('231202',189386,'2232f9f7276c1a59f96464720e5295d8cad6d8a0f1ef3289d9a111a1a1a27e36','22:07',1327)]
def validate(t):return validate_appearance_timeline(t,t['event'],utc(C['clock']['start_utc']),utc(C['clock']['end_utc']),F['sources'])
class NolteFullDocumentaryTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.doc=next(d for d in dossiers(ROOT)if d['id']=='el-reno-2013')
 def test_three_exact_fulls_and_original_exposures(self):
  validate(T);validate_hosted_photo_joins(self.doc,T,ROOT/'web')
  samples=T['photo_sequences'][0]['samples'];self.assertEqual([s['id']for s in samples],['nolte-'+x for x in('231037','231059','231202','231255')])
  for sample,(name,size,sha,label,seconds)in zip(samples,EXPECTED):
   image=sample['hosted_image'];self.assertEqual(image['original_url'],'https://nnwx.us/wp-content/uploads/2018/02/'+name+'.jpg')
   self.assertEqual((image['bytes'],image['sha256'],image['width'],image['height']),(size,sha,1920,1080))
   raw=(ROOT/'web'/image['asset']).read_bytes();self.assertEqual((len(raw),hashlib.sha256(raw).hexdigest()),(size,sha))
   self.assertNotEqual(sample['image']['sha256'],sha);self.assertIn('-1024x576.jpg',sample['image']['original_url'])
   self.assertEqual((image['creator_report']['movie_locator'],image['creator_report']['movie_seconds']),(label,seconds))
  self.assertNotIn('hosted_image',samples[3]);self.assertFalse((ROOT/'web/assets/el-reno-2013/nolte-231255-full.jpg').exists())
  self.assertEqual(len([m for m in self.doc['media']if m['id'].endswith('-full-documentary')]),3)
 def test_older_comparisons_commons_and_metadata_records_unchanged(self):
  old=json.loads((ROOT/'web/archive/el-reno-2013-e987d46a1c95d8536c0f.json').read_bytes())
  ids=['nolte-timecoded-context-231037','nolte-timecoded-context-231059','nolte-el-reno-documentary-photo']
  for identity in ids:self.assertEqual(next(m for m in self.doc['media']if m['id']==identity),next(m for m in old['media']if m['id']==identity))
  for sample in T['photo_sequences'][0]['samples'][:2]:
   prior=next(m for m in old['media']if m['id']=='nolte-timecoded-context-'+sample['id'].split('-')[-1])
   self.assertEqual(sample['source_comparison'],prior['review']['source_comparison'])
  self.assertEqual(T['photo_sequences'][0]['samples'][1]['source_comparison']['requested_seconds'],1263.223333)
  self.assertEqual(T['photo_sequences'][0]['samples'][1]['hosted_image']['creator_report']['movie_seconds'],1262)
 def test_hosting_requires_own_grant_sample_clock_and_source(self):
  for path,value in [(('status','rights'),'links_only'),(('status','temporal'),'discrete_anchor'),(('source_id',),'commons-nolte-el-reno'),(('parent',),'nolte-timecoded-context-231037'),(('review','photo_sample_id'),'nolte-231255'),(('review','permission','item_url'),'https://nnwx.us/wp-content/uploads/2018/02/231255.jpg'),(('review','permission','preserve_marks'),False),(('time','alignment'),{'utc':'2013-05-31T23:10:37Z','basis':'invented'}),(('place','coordinates'),[-97.968850,35.450045])]:
   with self.subTest(path=path):
    doc=copy.deepcopy(self.doc);target=next(m for m in doc['media']if m['id']=='nolte-231037-full-documentary')
    for key in path[:-1]:target=target[key]
    target[path[-1]]=value
    with self.assertRaises(ValueError):validate_hosted_photo_joins(doc,T)
  t=copy.deepcopy(T);t['photo_sequences'][0]['samples'][3]['hosted_image']=copy.deepcopy(t['photo_sequences'][0]['samples'][0]['hosted_image'])
  with self.assertRaises(ValueError):validate_hosted_photo_joins(self.doc,t)
 def test_bad_full_reference_or_calibration_claim_rejects(self):
  for key,value in [('asset','../private.jpg'),('bytes',True),('bytes',2097153),('sha256',None),('sha256',T['photo_sequences'][0]['samples'][0]['image']['sha256']),('width',0)]:
   with self.subTest(key=key):
    t=copy.deepcopy(T);t['photo_sequences'][0]['samples'][0]['hosted_image'][key]=value
    with self.assertRaises(ValueError):validate(t)
  for key,value in [('movie_seconds',1262.5),('movie_locator','20:61'),('kind','calibrated_registration'),('callback_seconds',1241.24),('utc','2013-05-31T23:10:37Z')]:
   t=copy.deepcopy(T);t['photo_sequences'][0]['samples'][0]['hosted_image']['creator_report'][key]=value
   with self.assertRaises(ValueError):validate(t)
  for version in (1,2,3,4):
   t=copy.deepcopy(T);t['schema_version']=version
   with self.assertRaises(ValueError):validate(t)
 def test_swap_valid_siblings_and_missing_bytes_reject(self):
  t=copy.deepcopy(T);a,b=t['photo_sequences'][0]['samples'][:2];a['hosted_image']['sha256']=b['hosted_image']['sha256']
  with self.assertRaises(ValueError):validate_hosted_photo_joins(self.doc,t,ROOT/'web')
  import tempfile
  with tempfile.TemporaryDirectory()as folder:
   with self.assertRaises(ValueError):validate_hosted_photo_joins(self.doc,T,Path(folder))
 def test_no_new_continuous_registration_or_geometry(self):
  self.assertEqual(T['windows'],json.loads((ROOT/'web/data.json').read_bytes())['appearance_timeline']['windows'])
  self.assertEqual(self.doc['reconstruction']['intervals'],[])
  for s in T['photo_sequences'][0]['samples']:
   self.assertIsNone(s['shape']);self.assertIsNone(s['extent']);self.assertTrue(all(s['viewpoint'][k]is None for k in('coordinates','bearing_degrees','lens_calibration')))
if __name__=='__main__':unittest.main()
