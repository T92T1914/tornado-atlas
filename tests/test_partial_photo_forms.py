"""Shared synthetic partial-form contract and fail-before-publication checks."""
import copy
import hashlib
import json
from pathlib import Path
import re
import unittest
from unittest.mock import patch
from atlas.event_package import build_event_packages
from test_photo_observations import fixture as photo_fixture, validate, package_fixture

text=Path(__file__).with_name('partial-photo-forms.test.mjs').read_text(encoding='utf-8')
SPEC=json.loads(re.search(r'/\* PARTIAL_FORM_CASES\r?\n([\s\S]*?)\r?\nPARTIAL_FORM_CASES \*/',text).group(1))
def fixture():
    value=photo_fixture();value['schema_version']=3
    for sequence in value['photo_sequences']:
        for sample in sequence['samples']:
            sample['partial_form']=copy.deepcopy(SPEC['form'])
    return value

def change(value,mutation):
    sample=value['photo_sequences'][0]['samples'][0]
    if mutation.get('remove_sample'):
        del sample['partial_form'];return value
    parent=sample['partial_form']
    for key in mutation['path'][:-1]:parent=parent[key]
    key=mutation['path'][-1]
    if mutation.get('delete'):del parent[key]
    elif mutation.get('fill'):parent[key]=[[i/mutation['fill'],.5] for i in range(mutation['fill'])]
    elif mutation.get('nonfinite'):parent[key]=float('nan') if mutation['nonfinite']=='nan' else float('inf')
    else:parent[key]=copy.deepcopy(mutation['value'])
    return value

class PartialPhotoForms(unittest.TestCase):
    def test_shared_valid_and_invalid_contract(self):
        value=fixture();self.assertIs(validate(value),value)
        value['photo_sequences'][0]['samples'][0]['partial_form']=None;validate(value)
        for mutation in SPEC['invalid']:
            with self.subTest(mutation=mutation['name']),self.assertRaises(ValueError):validate(change(fixture(),mutation))
    def test_physical_geometry_and_legacy_contract_remain_separate(self):
        for key,value in [('shape','wedge'),('extent',.8)]:
            bad=fixture();bad['photo_sequences'][0]['samples'][0][key]=value
            with self.assertRaises(ValueError):validate(bad)
        bad=fixture();bad['photo_sequences'][0]['samples'][0]['viewpoint']['bearing_degrees']=90
        with self.assertRaises(ValueError):validate(bad)
        legacy=fixture();legacy['schema_version']=2
        with self.assertRaises(ValueError):validate(legacy)
        for sequence in legacy['photo_sequences']:
            for sample in sequence['samples']:del sample['partial_form']
        validate(legacy)
    def test_valid_v3_publication_and_invalid_form_rejected_before_artifacts(self):
        value=fixture();config,bundle,index=package_fixture(value)
        root=Path('synthetic-package-root')
        config_path=root/'exhibits'/config['event_id']/'replay.json'
        def read_text(path,*args,**kwargs):
            if path!=config_path:raise AssertionError(f'Unexpected read: {path}')
            return json.dumps(config)
        def is_file(path):return path==root/'web'/'fixture.html'
        with patch('atlas.event_package.reviewed_index',return_value=index), \
                patch.object(Path,'read_text',read_text),patch.object(Path,'is_file',is_file):
            raw=json.dumps(bundle,ensure_ascii=False).encode('utf-8')
            valid=build_event_packages(root,{config['event_id']:(config['bundle'],raw)})
            self.assertEqual(valid[config['bundle']],raw)
            self.assertEqual(valid['events/'+config['event_id']+'.json']['bundle_sha256'],hashlib.sha256(raw).hexdigest())
            bad=copy.deepcopy(bundle)
            bad['appearance_timeline']['photo_sequences'][0]['samples'][0]['partial_form']['duration_seconds']=8
            with self.assertRaises(ValueError):
                build_event_packages(root,{config['event_id']:(config['bundle'],json.dumps(bad).encode('utf-8'))})
