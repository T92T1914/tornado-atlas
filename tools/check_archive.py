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
