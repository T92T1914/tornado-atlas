"""Named current-article routes must preserve the accepted documentary record."""
import copy,json
from pathlib import Path
import unittest
from atlas.archive import dossiers,digest,dossier_history
ROOT=Path(__file__).resolve().parents[1]
BASELINES={
  "el-reno-2013": "cb0fda6d9b7effa35f77e61f483bd66f5ffad46e65283b6a991db143152021d8",
  "joplin-2011": "232cae340b227461d5e6bf529d1fa1363b6ec0133c471c352482d057adae2c25",
  "tuscaloosa-birmingham-2011": "54ffef26d78708e233889c994a08456997daa65bc2b36f6b62d4d73f0ca2f75e",
  "blackwell-1955": "cf2c15c7e7554aa8e5241101d9361130af5b922f11b169783039b8b003f82ea9"
}
READING_ROUTES={
  "el-reno-2013": [
    {
      "label": "Read the permitted documentary photographs",
      "href": "index.html#nolte-documentary-photographs"
    },
    {
      "label": "Read the moving-viewpoint example",
      "href": "index.html#bohac-opening-motion"
    },
    {
      "label": "Read the feature-tracking comparison",
      "href": "index.html#tracked-feature-radar"
    }
  ],
  "joplin-2011": [
    {
      "label": "Read the utility reporting comparison",
      "href": "joplin.html#utility-worked-comparison"
    },
    {
      "label": "Read the hospital services account",
      "href": "joplin.html#hospital-services"
    }
  ],
  "tuscaloosa-birmingham-2011": [
    {
      "label": "Read the worked survey comparison",
      "href": "tuscaloosa.html#survey-worked-comparison"
    },
    {
      "label": "Continue the field-survey account",
      "href": "tuscaloosa.html#field-survey"
    }
  ],
  "blackwell-1955": [
    {
      "label": "Read the parent storm and separate tornadoes",
      "href": "blackwell.html#storm-and-tornadoes"
    },
    {
      "label": "Read the clock disagreements",
      "href": "blackwell.html#clocks"
    },
    {
      "label": "Read the remembrance",
      "href": "blackwell.html#remembrance"
    }
  ]
}

class ArticleReadingPreservationTests(unittest.TestCase):
    def test_routes_are_the_only_content_change_from_the_accepted_dossiers(self):
        current={d["id"]:d for d in dossiers(ROOT)}
        for event,sha in BASELINES.items():
            with self.subTest(event=event):
                before=json.loads((ROOT/"web/archive"/(event+"-"+sha[:20]+".json")).read_bytes())
                self.assertEqual(digest(before),sha)
                expected=copy.deepcopy(before)
                expected["routes"]+=READING_ROUTES[event]
                expected["provenance"]["publication_review"]=current[event]["provenance"]["publication_review"]
                self.assertEqual(current[event],expected)
                self.assertEqual(current[event]["provenance"]["publication_review"]["previous_dossier_sha256"],sha)
                history=dossier_history(current[event])
                self.assertIn(sha,{v["dossier_sha256"] for v in history["versions"]})
                newest=next(v for v in history["versions"] if v["dossier_sha256"]==digest(current[event]))
                self.assertEqual(newest["changes"],[{"kind":"dossier","id":event,"change":"updated","fields":["routes"]}])
