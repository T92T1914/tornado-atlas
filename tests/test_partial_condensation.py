import copy,json,re,unittest
from pathlib import Path
from unittest.mock import patch
from atlas.event_package import build_event_packages
from test_partial_photo_forms import fixture as margin_fixture
from test_photo_observations import validate,package_fixture
text=Path(__file__).with_name('partial-condensation.test.mjs').read_text(encoding='utf-8')
SPEC=json.loads(re.search(r'/\* CONDENSATION_CASES\r?\n([\s\S]*?)\r?\nCONDENSATION_CASES \*/',text).group(1))
def fixture():
 value=margin_fixture();value['schema_version']=4
 for sequence in value['photo_sequences']:
  for sample in sequence['samples']:sample['partial_form']=copy.deepcopy(SPEC['form'])
 return value

def change(value,mutation):
 parent=value['photo_sequences'][0]['samples'][0]['partial_form']
 for key in mutation['path'][:-1]:parent=parent[key]
 key=mutation['path'][-1]
 if mutation.get('delete'):del parent[key]
 elif mutation.get('fill'):parent[key]=[[i/mutation['fill'],.5] for i in range(mutation['fill'])]
 elif mutation.get('nonfinite'):parent[key]=float('nan') if mutation['nonfinite']=='nan' else float('inf')
 else:parent[key]=copy.deepcopy(mutation['value'])
 return value
class PartialCondensation(unittest.TestCase):
 def test_shared_contract_and_legacy_separation(self):
  value=fixture();self.assertIs(validate(value),value)
  value['photo_sequences'][0]['samples'][0]['partial_form']=None;validate(value)
  for mutation in SPEC['invalid']:
   with self.subTest(name=mutation['name']),self.assertRaises(ValueError):validate(change(fixture(),mutation))
  legacy=fixture();legacy['schema_version']=3
  with self.assertRaises(ValueError):validate(legacy)
  validate(margin_fixture());value=margin_fixture();value['schema_version']=4;validate(value)
 def test_physical_fields_stay_null(self):
  for key,value in [('shape','wedge'),('extent',.8)]:
   bad=fixture();bad['photo_sequences'][0]['samples'][0][key]=value
   with self.assertRaises(ValueError):validate(bad)
  bad=fixture();bad['photo_sequences'][0]['samples'][0]['viewpoint']['bearing_degrees']=90
  with self.assertRaises(ValueError):validate(bad)
 def test_valid_packet_and_invalid_declared_silhouette_rejected(self):
  value=fixture();config,bundle,index=package_fixture(value);root=Path('synthetic-condensation-root');config_path=root/'exhibits'/config['event_id']/'replay.json'
  def read_text(path,*args,**kwargs):
   if path!=config_path:raise AssertionError('Unexpected read')
   return json.dumps(config)
  with patch('atlas.event_package.reviewed_index',return_value=index),patch.object(Path,'read_text',read_text),patch.object(Path,'is_file',lambda path:path==root/'web/fixture.html'):
   raw=json.dumps(bundle).encode('utf-8');self.assertEqual(build_event_packages(root,{config['event_id']:(config['bundle'],raw)})[config['bundle']],raw)
   bundle['appearance_timeline']['photo_sequences'][0]['samples'][0]['partial_form']['closure']='observed_silhouette'
   with self.assertRaises(ValueError):build_event_packages(root,{config['event_id']:(config['bundle'],json.dumps(bundle).encode('utf-8'))})
