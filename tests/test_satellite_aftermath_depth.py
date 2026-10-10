"""Bind educational renditions to source, clocks, immutable history and consumers."""
import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest
from museum_test_support import assert_preserved_field
from atlas.archive import digest, dossiers, validate_dossier, dossier_history

ROOT=Path(__file__).resolve().parents[1]
CASES=[('joplin-2011','nasa-joplin-aster-may30','nasa-joplin-aster','joplin.html','satellite-scar',
        'df879ecba5ed85a4c8c089a7f3a34bdfde021fdb7e05b11a41b5a8c22df31881',
        '67d01b39991050aa409f8e5ff24156873b6ff6342b072be83bd986455c1ec0f0',381451,1606,1606),
       ('tuscaloosa-birmingham-2011','usgs-tuscaloosa-landsat-scar','usgs-landsat-scar','tuscaloosa.html','landsat-scar',
        '97e10eef58cf724adaace0b81b37aef6981aa6868c53263bb213284259f11b4c',
        'af3e08af2f69d9b6d6f8ea43de1850fe23aac4cc969636831e2fb8a27c8fff6c',789555,1108,577)]

class Links(HTMLParser):
    def __init__(self): super().__init__();self.links={};self.images=[];self.source_sections={};self.in_sources=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='section': self.in_sources=a.get('id')=='sources'
        if tag=='a' and 'data-photo-id' in a: self.links[a['data-photo-id']]=a
        if tag=='img': self.images.append(a)
        if tag=='li' and a.get('id','').startswith('source-'): self.source_sections[a['id']]=self.in_sources
    def handle_endtag(self,tag):
        if tag=='section': self.in_sources=False

class SatelliteDepthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.docs={d['id']:d for d in dossiers()}
    def test_bytes_sources_and_real_image_links_agree(self):
        for event,item,source,page,section,prior,sha,size,width,height in CASES:
            doc=self.docs[event];row=next(m for m in doc['media'] if m['id']==item)
            src=next(s for s in doc['sources'] if s['id']==source)
            raw=(ROOT/'web'/row['transformation']['asset']).read_bytes()
            self.assertEqual((len(raw),hashlib.sha256(raw).hexdigest()),(size,sha))
            self.assertEqual((row['transformation']['width'],row['transformation']['height']),(width,height))
            self.assertEqual(row['transformation']['source_sha256'],sha)
            self.assertIn(sha,src['revision']);self.assertEqual(row['status']['rights'],'permitted_hosting')
            html=(ROOT/'web'/page).read_text(encoding='utf-8');view=Links();view.feed(html)
            self.assertEqual(view.links[item]['href'],row['transformation']['asset'])
            self.assertEqual(sum(i.get('src')==row['transformation']['asset'] for i in view.images),1)
            self.assertIn(f'id="{section}"',html)
            self.assertIn(f'media={item}#media-{item}',html)
            self.assertIn(src['url'],html);self.assertTrue(view.source_sections['source-'+source])
    def test_no_unwitnessed_clock_measurement_or_registration(self):
        for event,item,*_ in CASES:
            doc=self.docs[event];row=next(m for m in doc['media'] if m['id']==item)
            self.assertIsNone(row['time']['alignment']);self.assertIsNone(row['time']['video'])
            self.assertIsNone(row['place']['coordinates']);self.assertEqual(row['status']['spatial'],'unregistered')
            self.assertEqual(doc['reconstruction']['appearance'],'unregistered');self.assertEqual(doc['reconstruction']['intervals'],[])
            bad=copy.deepcopy(doc);next(m for m in bad['media'] if m['id']==item)['place']['coordinates']=[-94.5,37.1]
            with self.assertRaisesRegex(ValueError,'Unregistered evidence'):validate_dossier(bad)
        j=next(m for m in self.docs['joplin-2011']['media'] if m['id']==CASES[0][1])
        t=next(m for m in self.docs['tuscaloosa-birmingham-2011']['media'] if m['id']==CASES[1][1])
        self.assertIn('May 30, 2011',j['time']['capture']);self.assertIn('Hour',j['time']['capture'])
        self.assertIsNone(t['time']['capture']);self.assertIn('no legend',t['limits'])
        self.assertIn('00:00:00',j['limits']);self.assertIn('not adopted',j['limits'])
    def test_all_previous_evidence_and_immutable_predecessors_survive(self):
        for event,item,source,page,section,prior,*_ in CASES:
            doc=self.docs[event];old=json.loads((ROOT/f'web/archive/{event}-{prior[:20]}.json').read_text(encoding='utf-8'))
            self.assertEqual(digest(old),prior)
            for key in ('sources','media','observations','creators','routes'):
                self.assertEqual(doc[key][:len(old[key])],old[key],key)
            for key in ('records','reconstruction','summary','title','coverage'):assert_preserved_field(self,doc[key],old[key],key)
            history=dossier_history(doc)
            # Preserve the original satellite publication edge after later
            # metadata integrations have added a new current revision.
            additions=[v for v in history['versions'] if v['review'] and v['review']['previous_dossier_sha256']==prior]
            self.assertEqual(len(additions),1);self.assertTrue(additions[0]['predecessor_available'])
            added=json.loads((ROOT/'web'/additions[0]['file']).read_text(encoding='utf-8'))
            self.assertEqual(digest(added),additions[0]['dossier_sha256'])
            self.assertIn(item,{row['id'] for row in added['media']})
    def test_rendering_and_rights_keep_provider_roles_separate(self):
        j=next(m for m in self.docs['joplin-2011']['media'] if m['id']==CASES[0][1])
        t=next(m for m in self.docs['tuscaloosa-birmingham-2011']['media'] if m['id']==CASES[1][1])
        self.assertEqual(j['roles']['creator'],'nasa-aster-image-team')
        self.assertEqual(j['roles']['uploader'],'nasa-earth-observatory')
        self.assertIsNone(t['roles']['creator']);self.assertEqual(t['roles']['uploader'],'usgs-office-communications')
        self.assertIn('dynamic-image',j['transformation']['recipe']);self.assertIn('381451',j['transformation']['recipe'])
        self.assertIn('dimension',t['transformation']['recipe'])
        for row in (j,t):self.assertIn('No',row['limits'])
