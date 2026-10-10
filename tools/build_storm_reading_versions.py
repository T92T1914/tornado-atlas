"""Resize permitted documentary photographs without changing their framing.

Regeneration needs Pillow. Publication checks need only the standard library.
The preserved originals and their attribution remain the content authority.
"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from atlas.history import validate_history
from atlas.event_package import publication_artifacts, write_packages

source = ROOT / 'exhibits/el-reno-2013/storm-photos.json'
photos = json.loads(source.read_text(encoding='utf-8'))
history = json.loads((ROOT / 'exhibits/el-reno-2013/history.json').read_text(encoding='utf-8'))
validate_history(history, photos, ROOT / 'web')
for photo in photos:
    original = ROOT / 'web' / photo['file']
    assert hashlib.sha256(original.read_bytes()).hexdigest() == photo['sha256']
    versions = []
    with Image.open(original) as image:
        assert image.size == (photo['width'], photo['height'])
        for width in [640, 1280, 1920]:
            height = round(width * image.height / image.width)
            relative = f'assets/el-reno-2013/{original.stem}-{width}.jpg'
            destination = ROOT / 'web' / relative
            resized = image.convert('RGB').resize((width, height), Image.Resampling.LANCZOS)
            resized.save(destination, quality=82, optimize=True, progressive=True)
            raw = destination.read_bytes()
            versions.append({'file':relative, 'width':width, 'height':height, 'bytes':len(raw),
                             'sha256':hashlib.sha256(raw).hexdigest(), 'original_sha256':photo['sha256'],
                             'changes':'Full frame resized with Lanczos resampling and JPEG compressed at quality 82. No crop or generated image content.'})
    photo['reading_versions'] = versions
source.write_text(json.dumps(photos, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
bundle_path = ROOT / 'web/data.json'
bundle = json.loads(bundle_path.read_text(encoding='utf-8'))
bundle['storm_photos'] = photos
raw = (json.dumps(bundle, ensure_ascii=False, indent=2)+'\n').encode('utf-8')
bundle_path.write_bytes(raw)
write_packages(ROOT / 'web', publication_artifacts(ROOT, raw))
print(json.dumps({'originals_preserved':True, 'reading_versions':[{ 'original':p['file'], 'versions':p['reading_versions']} for p in photos]}, indent=2))
