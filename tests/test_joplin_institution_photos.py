"""Institution photographs retain exact resources and distinct NIST findings."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from atlas.archive import dossiers
from test_article_reading import accepted_reading_dossier
from atlas.evidence_coverage import coverage_rows

ROOT=Path(__file__).resolve().parents[1]
PREVIOUS='joplin-2011-788ea858c4f8cc854936.json'
EXPECTED=[
 ('nws-joplin-st-johns-aftermath','nws-st-johns-aftermath.jpg',4038164,
  '8c28031659db5d046b78eb1b510cbeb8a794855c385e52556a48afb1015f19ae',3888,2592,'hospital-services','szDSBShpJu2viH3LcSxFJ.jpeg'),
 ('nws-joplin-high-school-aftermath','nws-high-school-aftermath.jpg',132606,
  '34121880416d15911ec9cc29957eb04a4961dcfb4528a597b63f729c39678da1',1024,768,'school-refuge','KXXgtHdF_en4ssVYWzmEc.jpeg'),
]

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='a' and attrs.get('data-photo-id'):
            self.rows.append(attrs)

def same_types(test,a,b):
    test.assertIs(type(a),type(b))
    if isinstance(a,dict):
        test.assertEqual(set(a),set(b))
        for k in a: same_types(test,a[k],b[k])
    elif isinstance(a,list):
        test.assertEqual(len(a),len(b))
        for x,y in zip(a,b): same_types(test,x,y)
    else: test.assertEqual(a,b)

class JoplinInstitutionPhotos(unittest.TestCase):
    def setUp(self):
        self.doc=next(d for d in dossiers() if d['id']=='joplin-2011')
        self.media={m['id']:m for m in self.doc['media']}

    def test_exact_images_and_source_attribution_remain_unregistered(self):
        for id,file,length,sha,width,height,anchor,sourcefile in EXPECTED:
            m=self.media[id]; raw=(ROOT/'web/assets/joplin-2011'/file).read_bytes()
            self.assertEqual((len(raw),hashlib.sha256(raw).hexdigest()),(length,sha))
            self.assertEqual((m['transformation']['width'],m['transformation']['height']),(width,height))
            self.assertEqual(m['transformation']['sha256'],sha)
            self.assertEqual(m['transformation']['source_sha256'],sha)
            self.assertEqual(m['roles'],dict(creator=None,uploader='nws-sgf-storymap-publisher',rights_holder=None))
            self.assertEqual(m['status'],dict(intake='published',assertion='observed_sample',temporal='unregistered',spatial='unregistered',availability='reviewed_available',rights='permitted_hosting'))
            self.assertEqual(m['source_id'],'nws-joplin-storymap-damage-photos')
            self.assertEqual(m['kind'],'photograph')
            self.assertTrue(m['url'].endswith('/'+sourcefile))
            for key in ('capture','publication','video','alignment'): self.assertIsNone(m['time'][key])
            self.assertIsNone(m['place']['coordinates'])
            self.assertIn('not a verified exposure',m['limits'])
        source=next(s for s in self.doc['sources'] if s['id']=='nws-joplin-storymap-damage-photos')
        self.assertIn('agency-declared',source['rights'])
        self.assertIn('Tim Marshall',source['rights'])
        self.assertIn('City of Joplin',source['rights'])
        self.assertIn('No identifiable bus',self.media[EXPECTED[1][0]]['account'])
        self.assertIn('generator failure',self.media[EXPECTED[0][0]]['limits'])

    def test_old_ordered_values_and_numeric_types_are_preserved(self):
        publication=accepted_reading_dossier('joplin-2011')
        previous=json.loads((ROOT/'web/archive'/PREVIOUS).read_bytes())
        for field in ('creators','sources','media','routes'):
            same_types(self,previous[field],publication[field][:len(previous[field])])
        for field in set(previous)-{'creators','sources','media','routes','provenance'}:
            same_types(self,previous[field],publication[field])
        self.assertEqual(len(publication['observations']),20)
        self.assertEqual(publication['reconstruction']['intervals'],[])

    def test_article_binds_each_item_once_to_its_own_original_and_source(self):
        parser=Links(); parser.feed((ROOT/'web/joplin.html').read_text(encoding='utf8'))
        for id,file,length,sha,width,height,anchor,sourcefile in EXPECTED:
            links=[a for a in parser.rows if a['data-photo-id']==id]
            self.assertEqual(len(links),1)
            a=links[0];m=self.media[id]
            self.assertEqual(a['href'],m['transformation']['asset'])
            self.assertEqual(a['data-photo-kind'],'context-photograph')
            self.assertEqual(a['data-photo-source'],'https://storymaps.arcgis.com/stories/d64c8d41c28949bd87478f252ac7e378')
            self.assertEqual(a['data-photo-rights'],'https://creativecommons.org/publicdomain/zero/1.0/')
            self.assertIn('photographer unestablished',a['data-photo-credit'])
            self.assertIn('unregistered',a['data-photo-location'])
            self.assertIn('agency-published',a['data-photo-original-label'])
            self.assertIn(dict(label=m['title'],href='joplin.html?photo='+id+'#'+anchor),self.doc['routes'])

    def test_coverage_adds_documentary_damage_without_appearance(self):
        row=next(r for r in coverage_rows(ROOT) if r['doc']['id']=='joplin-2011')
        items=[i['id'] for k,i in row['layers']['damage']['items']]
        for id,*rest in EXPECTED: self.assertIn(id,items)
        self.assertEqual([i['id'] for k,i in row['layers']['appearance']['items']],['friskey-joplin-storm'])
        self.assertEqual(row['layers']['appearance']['state'],'not_admitted')

if __name__=='__main__': unittest.main()
