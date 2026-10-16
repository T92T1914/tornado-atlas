import json,unittest
from pathlib import Path
from atlas.archive import dossiers,digest
ROOT=Path(__file__).resolve().parents[1]
class IndependentEvidence(unittest.TestCase):
 def test_primary_additions_keep_attribution_and_unsupported_quantities_unknown(self):
  docs={d['id']:d for d in dossiers(ROOT)}
  cases={'blackwell-1955':['interior-blackwell-electric-distribution-study'],'joplin-2011':['nist-joplin-school-shelter-code-changes','nist-joplin-existing-refuge-selection'],'el-reno-2013':['wakimoto-2016-early-extension']}
  for event,ids in cases.items():
   doc=docs[event]
   for ident in ids:
    obs=next(o for o in doc['observations'] if o['id']==ident)
    self.assertEqual(obs['status']['assertion'],'source_reported');self.assertEqual(obs['status']['spatial'],'unregistered');self.assertEqual(obs['status']['rights'],'links_only');self.assertIsNone(obs['place']['coordinates']);self.assertIsNone(obs['time']['alignment'])
    self.assertIn(obs['source_id'],[s['id'] for s in doc['sources']])
  black=next(s for s in docs['blackwell-1955']['sources'] if s['id']=='interior-blackwell-power-study-fy1955')
  self.assertIn('d8c64dc077c7b8ce9a83c0ada5309e6d870d4f52c477b26be7bf7f20241260ed',black['revision'])
  self.assertIn('not acquired or inspected',black['access'])
  joplin=[o for o in docs['joplin-2011']['observations'] if o['id'] in cases['joplin-2011']]
  self.assertIn('2018',joplin[0]['account']);self.assertIn('2017',joplin[1]['account']);self.assertIn('local adoption',joplin[0]['limits'])
 def test_early_source_is_discrete_and_its_figure_is_not_hosted(self):
  t=json.loads((ROOT/'exhibits/el-reno-2013/appearance-timeline.json').read_text())
  seq=next(s for s in t['photo_sequences'] if s['id']=='wakimoto-early-extension')
  self.assertEqual(len(seq['samples']),1);self.assertEqual(t['windows'],[])
  s=seq['samples'][0];self.assertEqual(s['reported_utc'],'2013-05-31T23:05:10Z')
  self.assertEqual(s['image']['original_url'],'https://repository.library.noaa.gov/view/noaa/32144/noaa_32144_DS1.pdf#page=8')
  self.assertIsNone(s['shape']);self.assertIsNone(s['extent']);self.assertIsNone(s['timing']['uncertainty_seconds'])
  self.assertTrue(all(value is None for key,value in s['viewpoint'].items() if key not in ('mode','description','basis')))
  self.assertNotIn('hosted_image',s);self.assertNotIn('display_preset',s['partial_form'])

 def test_only_exact_named_additions_change_the_accepted_reading_release(self):
  import copy
  from test_article_reading import accepted_reading_dossier,ACCEPTED_READING_DOSSIERS
  from atlas.archive import dossier_history
  current={d['id']:d for d in dossiers(ROOT)}
  additions={
   'el-reno-2013':{'sources':[],'observations':['wakimoto-2016-early-extension'],'routes':[{'label':'Early partial view and its unresolved outline','href':'index.html#early-downward-extension'}]},
   'blackwell-1955':{'sources':['interior-blackwell-power-study-fy1955'],'observations':['interior-blackwell-electric-distribution-study'],'routes':[{'label':'Read the power-system damage study','href':'blackwell.html#power-system-assessment'}]},
   'joplin-2011':{'sources':['nist-joplin-standards-impacts'],'observations':['nist-joplin-school-shelter-code-changes','nist-joplin-existing-refuge-selection'],'routes':[{'label':'Read what changed after the investigation','href':'joplin.html#post-investigation-changes'}]},
  }
  for event,expected in additions.items():
   with self.subTest(event=event):
    old=accepted_reading_dossier(event);retained=copy.deepcopy(current[event])
    for field,extra in expected.items():
     actual=retained[field][len(old[field]):]
     self.assertEqual(actual if field=='routes' else [row['id'] for row in actual],extra)
     retained[field]=retained[field][:len(old[field])]
    if event=='el-reno-2013':
     before=next(s for s in old['sources'] if s['id']=='wakimoto-aerial-2016')
     after=next(s for s in retained['sources'] if s['id']==before['id'])
     for field in ('access','locator','agent_processing'):
      self.assertTrue(after[field].startswith(before[field]));self.assertGreater(len(after[field]),len(before[field]))
      after[field]=before[field]
    old['provenance'].pop('publication_review');retained['provenance'].pop('publication_review')
    # Canonical JSON preserves number-vs-boolean and integer-vs-float spellings.
    self.assertEqual(digest(retained),digest(old))
    self.assertIn(ACCEPTED_READING_DOSSIERS[event],{v['dossier_sha256'] for v in dossier_history(current[event])['versions']})
  self.assertEqual(digest(current['tuscaloosa-birmingham-2011']),ACCEPTED_READING_DOSSIERS['tuscaloosa-birmingham-2011'])
