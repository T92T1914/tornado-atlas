"""A bounded, reproducible view of DAT points overlapping the NWS outline.

Geographic overlap is not an event identifier or evidence of impact timing.
The original DAT response and the exact query remain inspectable.
"""
from __future__ import annotations

import hashlib
import json
import math
from urllib.parse import urlencode

from .sources import ROOT

SERVICE = 'https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/MapServer'
FIELDS = 'objectid,globalid,event_id,path_guid,stormdate,surveydate,damage_txt,dod_txt,efscale,office'
QUERY = SERVICE + '/0/query?' + urlencode({
    'f': 'json',
    'where': "stormdate >= timestamp '2013-05-31 00:00:00' AND stormdate < timestamp '2013-06-02 00:00:00'",
    'geometry': '-98.1,35.35,-97.6,35.65', 'geometryType': 'esriGeometryEnvelope',
    'inSR': '4326', 'outSR': '4326', 'spatialRel': 'esriSpatialRelIntersects',
    'outFields': FIELDS, 'returnGeometry': 'true', 'orderByFields': 'objectid',
})
FOLDER = ROOT / 'exhibits/el-reno-2013'


def ring_location(point, ring):
    """Return inside, outside or boundary; preserve holes and boundary cases."""
    x, y = point
    inside = False
    for (ax, ay), (bx, by) in zip(ring, ring[1:]):
        cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax)
        if abs(cross) < 1e-12 and min(ax, bx) - 1e-12 <= x <= max(ax, bx) + 1e-12 and min(ay, by) - 1e-12 <= y <= max(ay, by) + 1e-12:
            return 'boundary'
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            inside = not inside
    return 'inside' if inside else 'outside'


def polygon_location(point, rings):
    outer = ring_location(point, rings[0])
    if outer != 'inside':
        return outer
    for hole in rings[1:]:
        location = ring_location(point, hole)
        if location == 'boundary':
            return 'boundary'
        if location == 'inside':
            return 'outside'
    return 'inside'


def compile_survey(response, geometry):
    if response.get('error') or response.get('exceededTransferLimit'):
        raise ValueError('Incomplete DAT response: error or transfer limit')
    if response.get('spatialReference', {}).get('wkid') != 4326:
        raise ValueError('Expected WGS84 survey coordinates')
    features = response.get('features')
    if not isinstance(features, list) or not 1 <= len(features) <= 2000:
        raise ValueError('Expected a bounded, nonempty survey response')
    outlines = [f['geometry']['coordinates'] for f in geometry['features'] if f['geometry']['type'] == 'Polygon']
    if len(outlines) != 1:
        raise ValueError('Expected one reviewed event outline')
    points, seen = [], set()
    for feature in features:
        attrs = feature['attributes']
        oid = attrs['objectid']
        if type(oid) is not int or oid <= 0 or oid in seen:
            raise ValueError('Invalid or duplicate survey record ID')
        seen.add(oid)
        coords = [feature['geometry']['x'], feature['geometry']['y']]
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in coords) or not (-98.1 <= coords[0] <= -97.6 and 35.35 <= coords[1] <= 35.65):
            raise ValueError('Survey coordinate outside requested region')
        stamp = attrs.get('stormdate')
        if type(stamp) not in (int, float) or not 1369958400000 <= stamp < 1370131200000:
            raise ValueError('Survey date outside requested interval')
        if attrs.get('office') != 'OUN':
            raise ValueError('Unexpected survey office; curator review required')
        # These old records have no usable event joins. Fail if that changes:
        # a refreshed source needs a new association review, not a silent join.
        if attrs.get('event_id') not in ('', None) or attrs.get('path_guid') not in (None, '', '{00000000-0000-0000-0000-000000000000}'):
            raise ValueError('Event association fields changed; review required')
        for field in ('damage_txt', 'dod_txt', 'efscale'):
            if attrs.get(field) is not None and not isinstance(attrs[field], str):
                raise ValueError('Expected source text for survey description')
        relation = polygon_location(coords, outlines[0])
        if relation == 'outside':
            continue
        points.append({
            'id': oid, 'coordinates': coords, 'outline_relation': relation,
            'indicator': attrs.get('damage_txt') or 'Indicator not recorded',
            'degree': attrs.get('dod_txt') or 'Degree of damage not recorded',
            'rating': attrs.get('efscale') or 'Not recorded',
            'source_url': SERVICE + f'/0/query?f=pjson&objectIds={oid}&outFields={FIELDS}&returnGeometry=true&outSR=4326',
        })
    return {'queried_count': len(features), 'included_count': len(points),
            'outside_count': len(features) - len(points), 'points': points}


def load_survey(geometry):
    manifest = json.loads((FOLDER / 'survey-source.json').read_text(encoding='utf-8'))
    content = (FOLDER / 'survey-response.json').read_bytes()
    if manifest.get('query_url') != QUERY or hashlib.sha256(content).hexdigest() != manifest['sha256'] or len(content) != manifest['bytes']:
        raise ValueError('Survey source integrity or query mismatch')
    result = compile_survey(json.loads(content), geometry)
    if {k: result[k] for k in ('queried_count', 'included_count', 'outside_count')} != manifest['reviewed_counts']:
        raise ValueError('Survey coverage changed; curator review required')
    return {**result, 'source': manifest,
            'association': 'geographic_overlap_only',
            'note': 'NWS survey points inside or on the published El Reno outline. The archived records have no event ID linking them to this tornado. Geographic overlap alone does not prove that it caused each observation.',
            'time_note': 'These are surveyed outcomes, not timed impacts. Available DAT attachments are linked to their exact survey records below. The separate nine-photo NWS gallery has not been matched to these points.',
            'status_note': 'DAT calls these quality-controlled records preliminary. The event rating remains the final NWS EF3 assessment. Individual point ratings are separate observations.'}
