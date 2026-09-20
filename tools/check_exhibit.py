"""Offline integrity checks for the checked-in, inspectable exhibit bundle."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from atlas.damage import validate_gallery
from atlas.history import validate_history
from atlas.reading import validate_reading
bundle = json.loads((root / 'web/data.json').read_text(encoding='utf-8'))
geo = json.loads((root / 'exhibits/el-reno-2013/path.geojson').read_text(encoding='utf-8'))
assert bundle['geometry'] == geo, 'Preview geometry differs from exhibit geometry'
for key, relative in [('exhibit', 'exhibits/el-reno-2013/dossier.json'),
                      ('creators', 'research/creators.json'),
                      ('review_queue', 'research/video-review-queue.json'),
                      ('notebook', 'exhibits/el-reno-2013/observations.json'),
                      ('damage', 'exhibits/el-reno-2013/damage.json'),
                      ('history', 'exhibits/el-reno-2013/history.json'),
                      ('storm_photos', 'exhibits/el-reno-2013/storm-photos.json'),
                      ('visitor_guide', 'exhibits/el-reno-2013/visitor-guide.json'),
                      ('reading', 'exhibits/el-reno-2013/reading.json')]:
    assert bundle[key] == json.loads((root / relative).read_text(encoding='utf-8')), f'Stale bundle: {key}'
points = [f for f in geo['features'] if f['geometry']['type'] == 'Point']
assert len(points) == 39
times = [p['properties']['utc'] for p in points]
assert times == sorted(times) and len(set(times)) == len(times)
assert times[0] == '2013-05-31T23:04:00+00:00'
assert times[-1] == '2013-05-31T23:42:00+00:00'
assert len(bundle['creators']) == 3
ids = [video['id'] for video in bundle['review_queue']]
assert len(ids) == len(set(ids))
creator_ids = {creator['id'] for creator in bundle['creators']}
assert all(video['creator'] in creator_ids for video in bundle['review_queue'])
validate_gallery(bundle['damage'], root / 'web')
validate_history(bundle['history'], bundle['storm_photos'], root / 'web')
validate_reading(bundle['reading'], {key: value for key, value in bundle.items() if key != 'reading'})
minutes = {int(point['properties']['source_name'].split(':')[1]) for point in points}
assert all(chapter['minute'] in minutes for chapter in bundle['history']['chapters']), 'Chapter lacks a published map position'
print(f"Exhibit verified: {len(points)} timed positions, {len(ids)} video leads, 3 creators, {len(bundle['notebook']['observations'])} footage notes, {len(bundle['damage']['photos'])} original survey photographs.")
