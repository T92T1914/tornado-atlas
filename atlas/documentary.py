"""Preserved warning records and matched historical imagery, with explicit limits."""
import hashlib
import math
from datetime import datetime, date
from pathlib import Path
from .history import source_url


def validate_documentary(data, root):
    if data.get('schema') != 1 or data.get('event') != 'el-reno-2013':
        raise ValueError('Unsupported documentary exhibit')
    date.fromisoformat(data['reviewed'])
    if 'reported_appearance' in data:
        validate_documentary_appearance(data['reported_appearance'])
    seen = set()
    previous = None
    def preserved(relative, digest, base=root):
        path = (base / relative).resolve()
        if not path.is_relative_to(base.resolve()) or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f'Invalid or changed preserved evidence: {relative}')
    for record in data['warnings']:
        stamp = datetime.fromisoformat(record['issued'])
        if stamp.tzinfo is None or (previous and stamp <= previous) or record['id'] in seen:
            raise ValueError('Warnings need unique IDs and ordered timezone-aware issue times')
        previous = stamp
        seen.add(record['id'])
        source_url(record['source'])
        preserved(record['preserved'], record['sha256'])
        if not record['title'] or not record['summary']:
            raise ValueError('Warning account missing')
        if record['event_id']:
            expiry = datetime.fromisoformat(record['expires'])
            ring = record['polygon']
            if expiry <= stamp or len(ring) < 4 or ring[0] != ring[-1]:
                raise ValueError('Invalid warning validity or polygon')
            for lon, lat in ring:
                if not all(math.isfinite(v) for v in (lon, lat)) or not (-180 <= lon <= 180 and -90 <= lat <= 90):
                    raise ValueError('Invalid warning coordinate')
    pair = data['comparison']
    for key in ('source', 'rights', 'original_url'):
        source_url(pair[key])
    preserved(pair['original_asset'], pair['original_sha256'], root / 'web')
    for side in ('before', 'after'):
        preserved(pair[side]['asset'], pair[side]['sha256'], root / 'web')
        if not pair[side]['date'] or not pair[side]['alt']:
            raise ValueError('Image needs a date and description')
    for record in data['log'] + data['unmapped_fatalities']:
        if not record['sources']:
            raise ValueError('Research accounts need sources')
        for source in record['sources']:
            source_url(source['url'])
    if any('coordinates' in item for item in data['unmapped_fatalities']):
        raise ValueError('Unresolved locations cannot silently acquire map pins')
    for item in data['unmapped_fatalities']:
        if 'location_review' not in item:
            continue
        review = item['location_review']
        date.fromisoformat(review['date'])
        if not review['needed'] or not review['evidence']:
            raise ValueError('Location reviews must explain evidence and what remains unresolved')
        for row in review['evidence']:
            if not all(row.get(key, '').strip() for key in ('title', 'finding', 'limit', 'source_label')):
                raise ValueError('Location evidence needs an account, source label and limitation')
            source_url(row['source'])


def load_documentary(root):
    import json
    data = json.loads((root / 'exhibits/el-reno-2013/documentary.json').read_text(encoding='utf-8'))
    validate_documentary(data, root)
    return data


def validate_remembrance_coverage(history, documentary):
    """Every named victim must have one visible, sourced location status."""
    people = [person['name'] for person in history['remembrance']['people']]
    if len(people) != history['impacts']['deaths_direct'] or len(people) != len(set(people)):
        raise ValueError('El Reno remembrance must account for all eight recorded deaths')
    located = [name for place in history['remembrance']['places'] for name in place['people']]
    unresolved = [name for record in documentary['unmapped_fatalities'] for name in record['people']]
    coverage = located + unresolved
    if len(coverage) != len(set(coverage)) or set(coverage) != set(people):
        raise ValueError('Every remembered person needs exactly one location status')
    ids = [record['id'] for record in documentary['unmapped_fatalities']]
    if len(ids) != len(set(ids)) or any(not value.startswith('location-') for value in ids):
        raise ValueError('Unresolved location records need distinct stable links')
    if any(not record['account'] or not record['reason'] for record in documentary['unmapped_fatalities']):
        raise ValueError('Explain each unresolved location without inventing a pin')


# Reported-minute forms are documentary records, not replay appearance windows.
from .event_package import (fields, _photo_text, _photo_id, _photo_url,
                            _photo_digest, _validate_condensation_support)


def validate_documentary_appearance(document):
    fields(document, ("schema_version", "event", "observations"), "documentary appearance")
    if type(document["schema_version"]) is not int or document["schema_version"] != 1 or document["event"] != "el-reno-2013":
        raise ValueError("Unsupported documentary appearance schema or event")
    rows = document["observations"]
    if not isinstance(rows, list) or not 1 <= len(rows) <= 16:
        raise ValueError("Documentary appearance requires bounded observations")
    identities = set()
    for row in rows:
        fields(row, ("schema_version", "id", "event", "state", "creator", "original_url",
                     "account_url", "published_image", "reported_time", "viewpoint", "shape",
                     "physical_extent", "continuous_registration", "partial_form", "title",
                     "inspection", "caption", "omission", "clock_note"), "documentary observation")
        _photo_id(row["id"], "documentary observation")
        if row["id"] in identities:
            raise ValueError("Duplicate documentary appearance observation")
        identities.add(row["id"])
        if (type(row["schema_version"]) is not int or row["schema_version"] != 1 or row["event"] != document["event"] or
                row["state"] != "documentary_reported_minute"):
            raise ValueError("Documentary observation is outside the exact replay clock")
        for name in ("creator", "title", "caption", "omission", "clock_note"):
            _photo_text(row[name], name)
        for name in ("original_url", "account_url"):
            _photo_url(row[name])
        image = row["published_image"]
        fields(image, ("bytes", "sha256", "dimensions"), "published documentary image")
        if image["sha256"] is None:
            raise ValueError("Published documentary image requires a non-null digest")
        _photo_digest(image["sha256"])
        if type(image["bytes"]) is not int or image["bytes"] <= 0:
            raise ValueError("Published image requires its byte identity")
        if (not isinstance(image["dimensions"], list) or len(image["dimensions"]) != 2 or
                any(type(value) is not int or value <= 0 for value in image["dimensions"])):
            raise ValueError("Published image requires pixel dimensions")
        timing = row["reported_time"]
        fields(timing, ("local", "utc", "precision", "exposure_second", "clock_accuracy",
                        "exact_replay_seconds"), "reported documentary time")
        for name in ("local", "utc"):
            _photo_text(timing[name], name)
        if (timing["precision"] != "minute" or
                any(timing[name] is not None for name in
                    ("exposure_second", "clock_accuracy", "exact_replay_seconds"))):
            raise ValueError("Reported minute cannot assign an exact exposure or replay instant")
        viewpoint = row["viewpoint"]
        fields(viewpoint, ("reported_relocation", "longitude", "latitude", "azimuth_deg",
                          "elevation_deg", "roll_deg", "horizontal_fov_deg", "height_m", "lens",
                          "crop"), "unregistered documentary viewpoint")
        _photo_text(viewpoint["reported_relocation"], "reported relocation")
        if any(value is not None for key, value in viewpoint.items() if key != "reported_relocation"):
            raise ValueError("Documentary viewpoint is unregistered")
        if any(row[name] is not None for name in ("shape", "physical_extent", "continuous_registration")):
            raise ValueError("Documentary form cannot assign physical or continuous reconstruction")
        form = row["partial_form"]
        fields(form, ("kind", "display_preset", "points", "construction", "basis", "use_basis",
                      "limits"), "documentary partial form")
        if form["kind"] != "visible_condensation_region" or form["display_preset"] != "light_tapered_region":
            raise ValueError("Unsupported reviewed documentary display preset")
        _validate_condensation_support(form["points"])
        for name in ("construction", "basis", "use_basis"):
            _photo_text(form[name], name)
        if not isinstance(form["limits"], list) or not 1 <= len(form["limits"]) <= 16:
            raise ValueError("Documentary form needs bounded limits")
        for limit in form["limits"]:
            _photo_text(limit, "documentary limit")
        inspection = row["inspection"]
        fields(inspection, ("status", "reviewed_on", "source_reuse", "basis"), "documentary inspection")
        if (inspection["status"] != "complete_published_still_pixels_inspected" or
                inspection["source_reuse"] != "external_links_only"):
            raise ValueError("Documentary record requires declared inspected pixels and external source links")
        date.fromisoformat(inspection["reviewed_on"])
        _photo_text(inspection["basis"], "inspection basis")
    return document
