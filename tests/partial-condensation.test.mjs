import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {appearanceAt,validateAppearanceTimeline} from '../web/appearance-timeline-model.mjs';
import {buildCondensationGeometry} from '../web/form-renderer.mjs';
/* CONDENSATION_CASES
{
  "form": {
    "kind": "visible_condensation_region",
    "authorship": "independently_authored",
    "coordinate_space": "normalized_schematic_plane",
    "component": "Synthetic partial condensation.",
    "points": [
      [
        0.2,
        0.1
      ],
      [
        0.2,
        1
      ],
      [
        1,
        1
      ],
      [
        1,
        0.3
      ],
      [
        0.7,
        0.1
      ]
    ],
    "closure": "display_support_only",
    "completeness": "partial",
    "basis": "Independent synthetic display support, no historical observation.",
    "use_basis": "Original synthetic mathematical construction, no source pixels or license grant.",
    "limits": [
      "Unseen upper/lower/northern regions, contact, depth and camera remain unknown.",
      "Support closure, palette and softness are display choices. Every neighboring instant remains unknown."
    ]
  },
  "invalid": [
    {
      "name": "unversioned duration",
      "path": [
        "duration_seconds"
      ],
      "value": 1
    },
    {
      "name": "physical height",
      "path": [
        "height_m"
      ],
      "value": 500
    },
    {
      "name": "source texture",
      "path": [
        "texture_url"
      ],
      "value": "https://example.org/photo.jpg"
    },
    {
      "name": "full optical closure",
      "path": [
        "closure"
      ],
      "value": "observed_silhouette"
    },
    {
      "name": "full completeness",
      "path": [
        "completeness"
      ],
      "value": "complete"
    },
    {
      "name": "missing closure",
      "path": [
        "closure"
      ],
      "delete": true
    },
    {
      "name": "missing completeness",
      "path": [
        "completeness"
      ],
      "delete": true
    },
    {
      "name": "metric coordinate plane",
      "path": [
        "coordinate_space"
      ],
      "value": "metres"
    },
    {
      "name": "traced authorship",
      "path": [
        "authorship"
      ],
      "value": "traced"
    },
    {
      "name": "missing use basis",
      "path": [
        "use_basis"
      ],
      "delete": true
    },
    {
      "name": "two support vertices",
      "path": [
        "points"
      ],
      "value": [
        [
          0.1,
          0.1
        ],
        [
          0.8,
          0.8
        ]
      ]
    },
    {
      "name": "repeated terminal",
      "path": [
        "points"
      ],
      "value": [
        [
          0.1,
          0.1
        ],
        [
          0.8,
          0.1
        ],
        [
          0.8,
          0.8
        ],
        [
          0.1,
          0.1
        ]
      ]
    },
    {
      "name": "internal duplicate",
      "path": [
        "points"
      ],
      "value": [
        [
          0.1,
          0.1
        ],
        [
          0.8,
          0.1
        ],
        [
          0.8,
          0.8
        ],
        [
          0.8,
          0.1
        ],
        [
          0.1,
          0.8
        ]
      ]
    },
    {
      "name": "collinear display",
      "path": [
        "points"
      ],
      "value": [
        [
          0.1,
          0.1
        ],
        [
          0.4,
          0.4
        ],
        [
          0.8,
          0.8
        ]
      ]
    },
    {
      "name": "self intersection",
      "path": [
        "points"
      ],
      "value": [
        [
          0.1,
          0.1
        ],
        [
          0.8,
          0.8
        ],
        [
          0.1,
          0.8
        ],
        [
          0.8,
          0.1
        ]
      ]
    },
    {
      "name": "nonadjacent touching",
      "path": [
        "points"
      ],
      "value": [
        [
          0.1,
          0.1
        ],
        [
          0.9,
          0.1
        ],
        [
          0.9,
          0.9
        ],
        [
          0.5,
          0.1
        ],
        [
          0.1,
          0.9
        ]
      ]
    },
    {
      "name": "adjacent double back",
      "path": [
        "points"
      ],
      "value": [
        [
          0.1,
          0.1
        ],
        [
          0.8,
          0.1
        ],
        [
          0.4,
          0.1
        ],
        [
          0.8,
          0.8
        ],
        [
          0.1,
          0.8
        ]
      ]
    },
    {
      "name": "display segment too small",
      "path": [
        "points"
      ],
      "value": [
        [
          0.1,
          0.1
        ],
        [
          0.10000001,
          0.1
        ],
        [
          0.8,
          0.8
        ],
        [
          0.1,
          0.8
        ]
      ]
    },
    {
      "name": "display area too small",
      "path": [
        "points"
      ],
      "value": [
        [
          0.1,
          0.1
        ],
        [
          0.1001,
          0.1
        ],
        [
          0.1,
          0.1001
        ]
      ]
    },
    {
      "name": "boolean point",
      "path": [
        "points",
        0,
        0
      ],
      "value": true
    },
    {
      "name": "string point",
      "path": [
        "points",
        0,
        0
      ],
      "value": "0.2"
    },
    {
      "name": "outside plane",
      "path": [
        "points",
        0,
        0
      ],
      "value": -0.1
    },
    {
      "name": "three dimensional point",
      "path": [
        "points",
        0
      ],
      "value": [
        0.1,
        0.1,
        0.1
      ]
    },
    {
      "name": "nonfinite point",
      "path": [
        "points",
        0,
        0
      ],
      "nonfinite": "nan"
    },
    {
      "name": "infinite point",
      "path": [
        "points",
        0,
        0
      ],
      "nonfinite": "infinity"
    },
    {
      "name": "too many vertices",
      "path": [
        "points"
      ],
      "fill": 65
    }
  ]
}
CONDENSATION_CASES */
const block=(text,name)=>JSON.parse(text.match(new RegExp('/\\* '+name+'\\r?\\n([\\s\\S]*?)\\r?\\n'+name+' \\*/'))[1]);
const spec=block(await readFile(new URL(import.meta.url),'utf8'),'CONDENSATION_CASES');
const photos=block(await readFile(new URL('./photo-observations.test.mjs',import.meta.url),'utf8'),'PHOTO_CASES');
const margins=block(await readFile(new URL('./partial-photo-forms.test.mjs',import.meta.url),'utf8'),'PARTIAL_FORM_CASES');
function fixture(){const sequence=structuredClone(photos.sequences[1]);sequence.samples=sequence.samples.map(entry=>{const sample={...structuredClone(photos.sample),...entry,partial_form:structuredClone(spec.form)};delete sample.panel_locator;sample.image.panel_locator=entry.panel_locator;sample.image.original_url=photos.source.url+'#'+entry.exposure_id;return sample;});return {schema_version:4,event:photos.event,windows:[],photo_sources:[structuredClone(photos.source)],photo_sequences:[sequence]};}
const validate=value=>validateAppearanceTimeline(value,photos.event,photos.clock,{sources:[]});
function change(value,mutation){let parent=value.photo_sequences[0].samples[0].partial_form;for(const key of mutation.path.slice(0,-1))parent=parent[key];const key=mutation.path.at(-1);if(mutation.delete)delete parent[key];else if(mutation.fill)parent[key]=Array.from({length:mutation.fill},(_,i)=>[i/mutation.fill,.5]);else parent[key]=mutation.nonfinite?mutation.nonfinite==='nan'?NaN:Infinity:structuredClone(mutation.value);return value;}
test('v4 condensation is partial display support; legacy margin admission remains unchanged',()=>{const value=fixture();assert.equal(validate(value),value);value.photo_sequences[0].samples[1].partial_form=null;validate(value);const old=fixture();old.schema_version=3;assert.throws(()=>validate(old));for(const sample of old.photo_sequences[0].samples)sample.partial_form=structuredClone(margins.form);assert.equal(validate(old),old);old.schema_version=4;assert.equal(validate(old),old);for(const version of [1,2]){const bad=fixture();bad.schema_version=version;assert.throws(()=>validate(bad));}});
for(const mutation of spec.invalid)test('condensation rejects '+mutation.name,()=>assert.throws(()=>validate(change(fixture(),mutation))));
test('condensation rejects sparse arrays and invented physical sample geometry',()=>{for(const points of [[new Array(2),[.8,.1],[.8,.8]],new Array(3)]){const bad=fixture();bad.photo_sequences[0].samples[0].partial_form.points=points;assert.throws(()=>validate(bad));}for(const [key,value] of [['shape','wedge'],['extent',.8]]){const bad=fixture();bad.photo_sequences[0].samples[0][key]=value;assert.throws(()=>validate(bad));}const bad=fixture();bad.photo_sequences[0].samples[0].viewpoint.bearing_degrees=90;assert.throws(()=>validate(bad));});
test('actual condensation declaration selects only its exact source label and sequence',async()=>{const bundle=JSON.parse(await readFile(new URL('../web/data.json',import.meta.url),'utf8'));const config=JSON.parse(await readFile(new URL('../exhibits/el-reno-2013/replay.json',import.meta.url),'utf8'));const timeline=bundle.appearance_timeline;validateAppearanceTimeline(timeline,'el-reno-2013',config.clock,bundle.footage);const selection={kind:'photo',id:'wakimoto-visible-condensation'};const observed=appearanceAt(timeline,1241,config.clock.start_utc,selection);assert.equal(observed.state,'photo_observed');assert.equal(observed.partialForm.kind,'visible_condensation_region');assert.equal(observed.shape,null);assert.equal(observed.extent,null);for(const s of [1240.999,1241.000001,1241.25,1261,1269])assert.equal(appearanceAt(timeline,s,config.clock.start_utc,selection).partialForm,null);assert.equal(appearanceAt(timeline,1241,config.clock.start_utc,{kind:'photo',id:'wakimoto-visible-margin'}).state,'unknown');const laterSelection={kind:'photo',id:'wakimoto-visible-margin'};assert.equal(appearanceAt(timeline,1261,config.clock.start_utc,laterSelection).partialForm.kind,'visible_condensation_region');assert.equal(appearanceAt(timeline,1269,config.clock.start_utc,laterSelection).partialForm.kind,'visible_margin');for(const s of [1241,1260.999,1261.000001,1261.5,1265,1268.999,1269.25]){const gap=appearanceAt(timeline,s,config.clock.start_utc,laterSelection);assert.equal(gap.partialForm,null);assert.equal(gap.shape,null);assert.equal(gap.extent,null);}assert.notEqual(JSON.stringify(observed.partialForm.points),JSON.stringify(appearanceAt(timeline,1261,config.clock.start_utc,laterSelection).partialForm.points));assert.deepEqual(timeline.windows,[]);});
test('authored condensation frame clips the intact plane without changing normalized support',()=>{const a=buildCondensationGeometry(spec.form.points,320,160),b=buildCondensationGeometry(spec.form.points,900,430);for(const geometry of [a,b]){assert.ok(Math.abs(geometry.frame[2]/geometry.frame[3]-2.37)<1e-6);assert.ok(Math.abs((geometry.frame[0]-geometry.plane[0])/geometry.plane[2]-.125)<1e-6);assert.ok(Math.abs(geometry.frame[0]+geometry.frame[2]-geometry.plane[0]-geometry.plane[2])<.0001);assert.ok(geometry.frame[0]>=19.999&&geometry.frame[1]>=19.999);assert.equal(geometry.vertices.length,12);}assert.deepEqual(Array.from(a.points),Array.from(b.points));assert.equal(buildCondensationGeometry(spec.form.points,40,40),null);assert.throws(()=>buildCondensationGeometry(spec.form.points,1e40,1e40));});
