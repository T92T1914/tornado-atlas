"""Publication controls in a disposable source root with fresh module imports.

The geographic converter boundary supplies retained normalized geometry. These
tests do not retrieve or authenticate the original KMZ or the photo resources.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from atlas.event_package import same_json

ROOT = Path(__file__).resolve().parents[1]
CHILD = r'''
import copy,json
from pathlib import Path
from unittest.mock import patch
from atlas import exhibit
root=Path.cwd()
geometry=json.loads((root/'exhibits/el-reno-2013/path.geojson').read_text(encoding='utf-8'))
def forbidden(*args,**kwargs):
    raise AssertionError('Publication control attempted network retrieval')
with patch('atlas.exhibit.cached_retrieval',return_value=copy.deepcopy(geometry['source'])),patch('atlas.exhibit.read_object',return_value=b'normalized-geography-test-boundary'),patch('atlas.exhibit.convert_kmz',return_value=geometry),patch('atlas.exhibit.retrieve',side_effect=forbidden),patch('atlas.sources.urlopen',side_effect=forbidden),patch('socket.socket.connect',side_effect=forbidden),patch('socket.socket.connect_ex',side_effect=forbidden),patch('socket.create_connection',side_effect=forbidden):
    exhibit.build(refresh=False)
'''
CHECKER_CHILD = r'''
import runpy
from unittest.mock import patch
def forbidden(*args,**kwargs):
    raise AssertionError('Source checker control attempted network retrieval')
with patch('atlas.sources.urlopen',side_effect=forbidden),patch('socket.socket.connect',side_effect=forbidden),patch('socket.socket.connect_ex',side_effect=forbidden),patch('socket.create_connection',side_effect=forbidden):
    runpy.run_path('tools/check_exhibit.py',run_name='__main__')
'''


class AppearanceSourcePublicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix='atlas-source-publication-')
        cls.root=Path(cls.temp.name)
        for directory in ('atlas','exhibits','research','web'):
            shutil.copytree(ROOT/directory,cls.root/directory,ignore=shutil.ignore_patterns('__pycache__'))
        (cls.root/'tools').mkdir()
        shutil.copyfile(ROOT/'tools/check_exhibit.py',cls.root/'tools/check_exhibit.py')
        cls.source=cls.root/'exhibits/el-reno-2013/appearance-timeline.json'
        cls.original=cls.source.read_bytes()

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def setUp(self):
        self.source.write_bytes(self.original)

    def child(self,command):
        environment=dict(os.environ)
        environment.pop('PYTHONPATH',None)
        return subprocess.run([sys.executable,'-B','-X','utf8',*command],cwd=self.root,
                              env=environment,capture_output=True,text=True,timeout=30)

    def outputs(self):
        paths=[self.root/'web/data.json',self.root/'web/index.html',self.root/'web/events.json',
               self.root/'exhibits/el-reno-2013/path.geojson',*sorted((self.root/'web/events').glob('*.json'))]
        return {path.relative_to(self.root).as_posix():path.read_bytes() for path in paths}

    def test_valid_source_preserves_existing_fields_and_binds_exact_output(self):
        before=json.loads((self.root/'web/data.json').read_text(encoding='utf-8'))
        source=json.loads(self.original)
        source['photo_sequences'][0]['samples'][0]['characteristics'].append(
            'Synthetic distinguishing source value for a publication control only.')
        self.source.write_bytes(json.dumps(source).encode('utf-8'))
        preserved=self.outputs()
        result=self.child(['-c',CHILD])
        self.assertEqual(result.returncode,0,result.stderr)
        after=json.loads((self.root/'web/data.json').read_text(encoding='utf-8'))
        self.assertTrue(same_json(after['appearance_timeline'],source))
        for key,value in before.items():
            if key!='appearance_timeline':
                self.assertTrue(same_json(after[key],value),key)
        for name in ('web/index.html','exhibits/el-reno-2013/path.geojson'):
            self.assertEqual((self.root/name).read_bytes(),preserved[name],name)
        manifest=json.loads((self.root/'web/events/el-reno-2013.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['schema_version'],2)
        self.assertEqual(manifest['bundle_sha256'],hashlib.sha256((self.root/'web/data.json').read_bytes()).hexdigest())
        self.assertEqual(source['windows'],[])

    def test_invalid_photo_source_fails_before_any_publication_write(self):
        for mutation in ('duplicate_exposure','invented_shape'):
            with self.subTest(mutation=mutation):
                source=json.loads(self.original)
                samples=source['photo_sequences'][0]['samples']
                if mutation=='duplicate_exposure':
                    samples[1]['exposure_id']=samples[0]['exposure_id']
                else:
                    samples[0]['shape']='cone'
                self.source.write_bytes(json.dumps(source).encode('utf-8'))
                before=self.outputs()
                result=self.child(['-c',CHILD])
                self.assertNotEqual(result.returncode,0)
                self.assertIn('ValueError',result.stderr)
                self.assertEqual(self.outputs(),before)

    def test_missing_required_source_fails_without_silent_legacy_output(self):
        before=self.outputs()
        self.source.unlink()
        result=self.child(['-c',CHILD])
        self.assertNotEqual(result.returncode,0)
        self.assertIn('FileNotFoundError',result.stderr)
        self.assertIn('appearance-timeline.json',result.stderr)
        self.assertEqual(self.outputs(),before)

    def test_stale_source_is_rejected_despite_valid_bundle_and_manifest(self):
        before=self.outputs()
        source=json.loads(self.original)
        source['photo_sequences'][0]['samples'][0]['characteristics'].append(
            'Synthetic stale-source mutation for a publication control only.')
        self.source.write_bytes(json.dumps(source).encode('utf-8'))
        result=self.child(['-c',CHECKER_CHILD])
        self.assertNotEqual(result.returncode,0)
        self.assertIn('Stale bundle: appearance_timeline',result.stderr)
        self.assertEqual(self.outputs(),before)


if __name__=='__main__':
    unittest.main()
