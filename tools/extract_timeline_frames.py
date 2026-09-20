"""Reproduce reviewed PNG frames. Pillow is needed only for this curation tool.

The manifest contains manually transcribed, visually inspected source labels.
This script does not OCR or infer timestamps from GIF playback duration.
"""
import hashlib
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from atlas.sources import cached_retrieval, read_object, retrieve
from atlas.timeline_media import validate_timeline_media


def main():
    from PIL import Image
    manifest = json.loads((ROOT/'exhibits/el-reno-2013/timeline-media.json').read_text(encoding='utf8'))
    validate_timeline_media(manifest)
    metadata = cached_retrieval(manifest['original_url']) or retrieve(manifest['original_url'])
    if metadata['sha256'] != manifest['original_sha256']:
        raise ValueError('Original GIF changed; review required')
    staged = []
    with Image.open(io.BytesIO(read_object(metadata))) as original:
        for frame in manifest['frames']:
            original.seek(frame['frame_index'])
            output = io.BytesIO();original.convert('RGB').save(output, format='PNG')
            content = output.getvalue()
            if hashlib.sha256(content).hexdigest() != frame['sha256']:
                raise ValueError('Decoded output changed; check source and Pillow version')
            destination = ROOT/'web'/frame['file']
            if destination.exists() and destination.read_bytes() != content:
                raise ValueError('Existing frame differs; preserve and review it')
            staged.append((destination,content))
    for destination,content in staged:
        if not destination.exists():
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
    print(f'{len(staged)} reviewed frames reproduced and verified')


if __name__ == '__main__':
    main()
