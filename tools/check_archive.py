"""Check publication equivalence without replacing any source or generated file."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from atlas.archive import digest, publication, verify_dossier_files

artifacts = publication(ROOT)
for relative, payload in artifacts.items():
    assert digest(json.loads((ROOT / 'web' / relative).read_text(encoding='utf-8'))) == digest(payload), relative
verify_dossier_files(artifacts['archive/index.json'], ROOT)
print('Archive projection and catalogue routing verified.')
from atlas.evidence_coverage import publication as coverage_publication
for relative, raw in coverage_publication(ROOT).items():
    assert (ROOT / 'web' / relative).read_bytes() == raw, f'Stale evidence coverage: {relative}'
print('Evidence coverage matches reviewed packages and dossier references.')
from atlas.tuscaloosa_survey import publication as survey_publication, load_survey, native_section
survey_artifacts = survey_publication(ROOT)
for relative, raw in survey_artifacts.items():
    assert (ROOT / 'web' / relative).read_bytes() == raw, f'Stale Tuscaloosa survey: {relative}'
survey_index = json.loads(survey_artifacts['events/tuscaloosa-birmingham-2011-survey-index.json'])
expected = native_section(load_survey(ROOT), survey_index['file'], survey_artifacts[survey_index['file']])
article = (ROOT / 'web/tuscaloosa.html').read_text(encoding='utf-8')
assert article.count(expected) == 1, 'Native Tuscaloosa accounts differ from the preserved source'
print('Tuscaloosa estimated areas, complete source accounts and native reading verified.')
