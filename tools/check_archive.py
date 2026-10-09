"""Check publication equivalence without replacing any source or generated file."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from atlas.archive import publication

for relative, payload in publication(ROOT).items():
    assert json.loads((ROOT / 'web' / relative).read_text(encoding='utf-8')) == payload, relative
print('Archive projection and catalogue routing verified.')
from atlas.evidence_coverage import publication as coverage_publication
for relative, raw in coverage_publication(ROOT).items():
    assert (ROOT / 'web' / relative).read_bytes() == raw, f'Stale evidence coverage: {relative}'
print('Evidence coverage matches reviewed packages and dossier references.')
