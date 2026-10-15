import copy, hashlib, json, tempfile, unittest
from pathlib import Path
from atlas.archive import dossiers, dossier_changes
from atlas.documentary_clip import validate_clip

ROOT = Path(__file__).resolve().parents[1]
class DocumentaryClipTests(unittest.TestCase):
    def setUp(self):
        self.doc = copy.deepcopy(next(d for d in dossiers(ROOT) if d['id']=='el-reno-2013'))
        self.row = next(r for r in self.doc['media'] if r['id']=='bohac-opening-documentary-motion')
    def test_exact_published_versions_and_source_join(self):
        clip=validate_clip(self.doc,ROOT/'web')
        self.assertEqual([a['sha256'] for a in clip['assets']],['a8cadb5074a14b09221eb4cc7cadd06b22eddb0a7db43d516df138b1f32d1053','d394f7969b26a6f140e55f24fa713046aa99874aadfc25163baeddb06f66774c'])
        self.assertEqual([a['bytes'] for a in clip['assets']],[965874,905286])
        self.assertFalse(self.doc['reconstruction']['intervals'])
    def test_rejects_transferred_rights_clock_and_parent(self):
        for field,value in [('parent','nolte-el-reno-documentary-photo'),('source_id','nolte-three-permitted-full-exports')]:
            bad=copy.deepcopy(self.doc);row=next(r for r in bad['media'] if r['id']==self.row['id']);row[field]=value
            with self.assertRaises(ValueError):validate_clip(bad,ROOT/'web')
        for change in ['rights','alignment','capture','coordinates']:
            bad=copy.deepcopy(self.doc);row=next(r for r in bad['media'] if r['id']==self.row['id'])
            if change=='rights':row['status']['rights']='links_only'
            elif change=='coordinates':row['place']['coordinates']=[-98.0,35.0]
            else:row['time'][change]={'utc':'2013-05-31T23:10:37Z','basis':'unsupported fixture'}
            with self.assertRaises(ValueError):validate_clip(bad,ROOT/'web')
    def test_rejects_changed_bytes_and_unreviewed_paths(self):
        for key,value in [('sha256','0'*64),('bytes',965875),('asset','../private.mp4')]:
            bad=copy.deepcopy(self.doc);row=next(r for r in bad['media'] if r['id']==self.row['id']);row['transformation']['assets'][0][key]=value
            with self.assertRaises(ValueError):validate_clip(bad,ROOT/'web')
    def test_requires_complete_original_digest_and_poster_parent(self):
        for value in ['', 'b869', '0'*64]:
            bad=copy.deepcopy(self.doc);row=next(r for r in bad['media'] if r['id']==self.row['id']);row['transformation']['source_sha256']=value
            with self.assertRaises(ValueError):validate_clip(bad,ROOT/'web')
    def test_nolte_contract_and_assets_stay_separate(self):
        rows=[r for r in self.doc['media'] if r['source_id']=='nolte-three-permitted-full-exports']
        self.assertEqual(len(rows),3)
        self.assertTrue(all(r['kind']=='photograph' and r['time']['alignment'] is None for r in rows))
        self.assertTrue(all(r['transformation']['asset'].endswith('-full.jpg') for r in rows))

    def test_only_named_learning_records_change_the_accepted_dossiers(self):
        prior=json.loads((ROOT/'web/archive/el-reno-2013-6e0560dbb1650389c0c9.json').read_bytes())
        self.assertEqual(dossier_changes(prior,self.doc),[
            {'kind':'sources','id':'bohac-licensed-archive-publication','change':'updated','fields':['access','agent_processing']},
            {'kind':'sources','id':'wakimoto-aerial-2016','change':'updated','fields':['access','locator']},
            {'kind':'observations','id':'wakimoto-2016-dust-feature-radar-comparison','change':'added','fields':[]},
            {'kind':'media','id':'bohac-archived-extended-film','change':'updated','fields':['review']},
            {'kind':'media','id':'bohac-opening-documentary-motion','change':'added','fields':[]}])
        old=json.loads((ROOT/'web/archive/blackwell-1955-56f349cf05ee5a567840.json').read_bytes())
        current=next(d for d in dossiers(ROOT) if d['id']=='blackwell-1955')
        self.assertEqual(dossier_changes(old,current),[
            {'kind':'observations','id':'nws-parent-storm-separate-tornadoes','change':'added','fields':[]}])
