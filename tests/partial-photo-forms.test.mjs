import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {appearanceAt,validateAppearanceTimeline} from '../web/appearance-timeline-model.mjs';

/* PARTIAL_FORM_CASES
{
  "form": {
    "kind": "visible_margin",
    "authorship": "independently_authored",
    "coordinate_space": "normalized_schematic_plane",
    "component": "Synthetic open margin only.",
    "points": [
      [
        0.2,
        0.8
      ],
      [
        0.4,
        0.5
      ],
      [
        0.6,
        0.2
      ]
    ],
    "basis": "Authored synthetic geometry; no historical observation.",
    "use_basis": "Original synthetic mathematical form. No source pixels or grant.",
    "limits": [
      "Unseen edges, surface contact, dimensions, depth and camera remain unknown.",
      "Every unsampled instant remains unknown."
    ]
  },
  "invalid": [
    {
      "name": "missing declaration",
      "path": [],
      "remove_sample": true
    },
    {
      "name": "unversioned geometry field",
      "path": [
        "duration_seconds"
      ],
      "value": 8
    },
    {
      "name": "closed funnel type",
      "path": [
        "kind"
      ],
      "value": "full_outline"
    },
    {
      "name": "traced authorship",
      "path": [
        "authorship"
      ],
      "value": "traced"
    },
    {
      "name": "metric coordinates",
      "path": [
        "coordinate_space"
      ],
      "value": "metres"
    },
    {
      "name": "empty component",
      "path": [
        "component"
      ],
      "value": ""
    },
    {
      "name": "absent use basis",
      "path": [
        "use_basis"
      ],
      "delete": true
    },
    {
      "name": "empty basis",
      "path": [
        "basis"
      ],
      "value": " "
    },
    {
      "name": "missing limits",
      "path": [
        "limits"
      ],
      "delete": true
    },
    {
      "name": "empty limits",
      "path": [
        "limits"
      ],
      "value": []
    },
    {
      "name": "one point",
      "path": [
        "points"
      ],
      "value": [
        [
          0.2,
          0.8
        ]
      ]
    },
    {
      "name": "too many points",
      "path": [
        "points"
      ],
      "fill": 65
    },
    {
      "name": "adjacent duplicate",
      "path": [
        "points"
      ],
      "value": [
        [
          0.2,
          0.8
        ],
        [
          0.2,
          0.8
        ],
        [
          0.6,
          0.2
        ]
      ]
    },
    {
      "name": "closed path",
      "path": [
        "points"
      ],
      "value": [
        [
          0.2,
          0.8
        ],
        [
          0.4,
          0.5
        ],
        [
          0.2,
          0.8
        ]
      ]
    },
    {
      "name": "short pair",
      "path": [
        "points"
      ],
      "value": [
        [
          0.2
        ],
        [
          0.4,
          0.5
        ]
      ]
    },
    {
      "name": "outside plane",
      "path": [
        "points",
        0,
        0
      ],
      "value": -0.01
    },
    {
      "name": "boolean coordinate",
      "path": [
        "points",
        0,
        0
      ],
      "value": true
    },
    {
      "name": "string coordinate",
      "path": [
        "points",
        0,
        0
      ],
      "value": "0.2"
    },
    {
      "name": "nonfinite coordinate",
      "path": [
        "points",
        0,
        0
      ],
      "nonfinite": "nan"
    },
    {
      "name": "infinite coordinate",
      "path": [
        "points",
        0,
        0
      ],
      "nonfinite": "infinity"
    }
  ]
}
PARTIAL_FORM_CASES */
const block=(text,name)=>JSON.parse(text.match(new RegExp('/\\* '+name+'\\r?\\n([\\s\\S]*?)\\r?\\n'+name+' \\*/'))[1]);
const spec=block(await readFile(new URL(import.meta.url),'utf8'),'PARTIAL_FORM_CASES');
const photos=block(await readFile(new URL('./photo-observations.test.mjs',import.meta.url),'utf8'),'PHOTO_CASES');
function fixture(){
  const sequence=structuredClone(photos.sequences[1]);
  sequence.samples=sequence.samples.map(entry=>{
    const sample={...structuredClone(photos.sample),...entry,partial_form:structuredClone(spec.form)};
    delete sample.panel_locator;sample.image.panel_locator=entry.panel_locator;
    sample.image.original_url=photos.source.url+'#'+entry.exposure_id;
    return sample;
  });
  return {schema_version:3,event:photos.event,windows:[],photo_sources:[structuredClone(photos.source)],photo_sequences:[sequence]};
}
const validate=value=>validateAppearanceTimeline(value,photos.event,photos.clock,{sources:[]});
function change(value,mutation){
  const sample=value.photo_sequences[0].samples[0];
  if(mutation.remove_sample){delete sample.partial_form;return value;}
  let parent=sample.partial_form;
  for(const key of mutation.path.slice(0,-1))parent=parent[key];
  const key=mutation.path.at(-1);
  if(mutation.delete)delete parent[key];
  else if(mutation.fill)parent[key]=Array.from({length:mutation.fill},(_,i)=>[i/mutation.fill,.5]);
  else parent[key]=mutation.nonfinite?mutation.nonfinite==='nan'?NaN:Infinity:structuredClone(mutation.value);
  return value;
}
test('v3 partial form remains sample-owned and physical geometry remains null',()=>{
  const value=fixture();assert.equal(validate(value),value);
  value.photo_sequences[0].samples[1].partial_form=null;validate(value);
  for(const key of ['shape','extent']){const bad=fixture();bad.photo_sequences[0].samples[0][key]=key==='shape'?'wedge':.8;assert.throws(()=>validate(bad));}
  const bad=fixture();bad.photo_sequences[0].samples[0].viewpoint.bearing_degrees=90;assert.throws(()=>validate(bad));
  const legacy=fixture();legacy.schema_version=2;assert.throws(()=>validate(legacy));
  for(const sample of legacy.photo_sequences[0].samples)delete sample.partial_form;
  assert.equal(validate(legacy),legacy);
});
for(const mutation of spec.invalid)test('partial form rejects '+mutation.name,()=>assert.throws(()=>validate(change(fixture(),mutation))));
test('partial form rejects sparse coordinate and point arrays',()=>{
  for(const points of [[new Array(2),[.4,.5]],Array(3)]){const bad=fixture();bad.photo_sequences[0].samples[0].partial_form.points=points;assert.throws(()=>validate(bad));}
});
test('exact photo selection never widens partial geometry into the gap',()=>{
  const value=fixture();validate(value);const selection={kind:'photo',id:value.photo_sequences[0].id};
  for(const seconds of [20,30]){const state=appearanceAt(value,seconds,photos.clock.start_utc,selection);assert.equal(state.state,'photo_observed');assert.deepEqual(state.partialForm,spec.form);assert.equal(state.shape,null);assert.equal(state.extent,null);}
  for(const seconds of [19.999,20.00001,20.25,25,29.999,30.001]){const state=appearanceAt(value,seconds,photos.clock.start_utc,selection);assert.equal(state.state,'unknown');assert.equal(state.partialForm,null);}
  value.photo_sequences[0].samples[0].partial_form=null;assert.equal(appearanceAt(value,20,photos.clock.start_utc,selection).partialForm,null);
  assert.equal(appearanceAt(value,20,photos.clock.start_utc,'synthetic-video').state,'unknown');
});
