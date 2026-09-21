"""Build the first curated exhibit from a preserved NWS geographic source.

This adapter deliberately accepts only the geometry used in this exhibit.
It is not a general KML importer and never fetches KML icons or network links.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import re
import zipfile
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

from .documentary import load_documentary, validate_remembrance_coverage
from .sources import ROOT, cached_retrieval, read_object, retrieve
from .observations import validate_notebook
from .damage import validate_gallery
from .history import validate_history
from .reading import validate_reading
from .timeline_media import validate_timeline_media
from .community import validate_community
from .survey import load_survey
from .cameras import load_cameras
from .survey_attachments import load_survey_attachments

KMZ_URL = "https://www.weather.gov/source/oun/wxevents/20130531/gis/ElRenoTornadoPath_final.kmz"
PAGE_URL = "https://www.weather.gov/oun/events-20130531"
NS = {"k": "http://www.opengis.net/kml/2.2"}


def coordinates(text: str | None) -> list[list[float]]:
    result = []
    for token in (text or "").split():
        parts = token.split(",")
        if len(parts) not in (2, 3):
            raise ValueError("Expected KML longitude,latitude[,altitude]")
        values = [float(value) for value in parts]
        if not all(math.isfinite(value) for value in values):
            raise ValueError("Non-finite coordinate")
        lon, lat = values[:2]
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError("Coordinate outside geographic range")
        result.append([lon, lat])
    if not result:
        raise ValueError("Empty coordinates")
    return result


def label_time(label: str, *, event_date: date, utc_offset_hours: int, meridiem: str) -> datetime:
    """AM/PM and UTC offset require a curator's explicit source context."""
    match = re.fullmatch(r"(\d{1,2}):(\d{2})", label)
    if not match or meridiem not in {"AM", "PM"}:
        raise ValueError("Time label requires h:mm and explicit AM or PM")
    hour, minute = map(int, match.groups())
    if not 1 <= hour <= 12 or not 0 <= minute < 60:
        raise ValueError("Invalid clock label")
    hour = hour % 12 + (12 if meridiem == "PM" else 0)
    zone = timezone(timedelta(hours=utc_offset_hours))
    return datetime.combine(event_date, time(hour, minute), zone)


def convert_kmz(content: bytes, *, event_date: date, utc_offset_hours: int,
                meridiem: str, provenance: dict) -> dict:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        if len(archive.infolist()) > 50:
            raise ValueError("Too many archive members")
        matches = [info for info in archive.infolist() if info.filename == "doc.kml"]
        if len(matches) != 1 or matches[0].file_size > 2_000_000:
            raise ValueError("Expected one bounded doc.kml")
        xml = archive.read(matches[0])
    if b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
        raise ValueError("XML entity declarations are not supported")
    root = ET.fromstring(xml)
    features = []
    for item in root.findall(".//k:Placemark", NS):
        name = item.findtext("k:name", default="", namespaces=NS).strip()
        geometries = [child for child in item if child.tag.rsplit("}", 1)[-1]
                      in {"Point", "LineString", "Polygon", "MultiGeometry", "Model"}]
        if len(geometries) != 1:
            raise ValueError(f"Ambiguous or missing geometry: {name}")
        node = geometries[0]
        kind = node.tag.rsplit("}", 1)[-1]
        properties = {"source_name": name, "source_url": provenance["url"],
                      "source_sha256": provenance["sha256"]}
        if kind == "Point":
            points = coordinates(node.findtext("k:coordinates", namespaces=NS))
            if len(points) != 1:
                raise ValueError("A point must have one coordinate")
            dt = label_time(name, event_date=event_date, utc_offset_hours=utc_offset_hours,
                            meridiem=meridiem)
            properties.update(role="published_center_position", local_time=dt.isoformat(),
                              utc=dt.astimezone(timezone.utc).isoformat(),
                              display_time=f"{name} {meridiem} CDT",
                              time_basis="Bare KML label interpreted using the NWS event chronology",
                              precision="source label to nearest minute; no error bounds supplied")
            geometry = {"type": kind, "coordinates": points[0]}
        elif kind == "LineString":
            points = coordinates(node.findtext("k:coordinates", namespaces=NS))
            if len(points) < 2:
                raise ValueError("Line requires two coordinates")
            properties["role"] = "published_center_path"
            geometry = {"type": kind, "coordinates": points}
        elif kind == "Polygon":
            outer = node.findall("k:outerBoundaryIs/k:LinearRing/k:coordinates", NS)
            inner = node.findall("k:innerBoundaryIs/k:LinearRing/k:coordinates", NS)
            if len(outer) != 1:
                raise ValueError("Polygon requires one exterior ring")
            rings = [coordinates(element.text) for element in outer + inner]
            if any(len(ring) < 4 or ring[0] != ring[-1] for ring in rings):
                raise ValueError("Source ring must be closed; do not silently repair it")
            properties["role"] = "published_tornado_outline"
            geometry = {"type": kind, "coordinates": rings}
        else:
            raise ValueError(f"Unsupported geometry: {kind}")
        features.append({"type": "Feature", "properties": properties, "geometry": geometry})
    if not features:
        raise ValueError("No geographic features found")
    points = [f for f in features if f["geometry"]["type"] == "Point"]
    times = [f["properties"]["utc"] for f in points]
    if len(set(times)) != len(times):
        raise ValueError("Duplicate time labels require curator review")
    # Source XML lists 6:17 before 6:16. Display order follows time, never XML order.
    features.sort(key=lambda f: (f["geometry"]["type"] == "Point", f["properties"].get("utc", "")))
    return {"type": "FeatureCollection", "source": provenance,
            "transformation": "KML longitude/latitude preserved; altitude omitted for 2D display. No geometry interpolation.",
            "features": features}


def build(*, refresh=False, destination: Path = ROOT / "web" / "data.json") -> dict:
    metadata = None if refresh else cached_retrieval(KMZ_URL)
    metadata = metadata or retrieve(KMZ_URL)
    geojson = convert_kmz(read_object(metadata), event_date=date(2013, 5, 31),
                          utc_offset_hours=-5, meridiem="PM", provenance=metadata)
    counts = {kind: sum(f["geometry"]["type"] == kind for f in geojson["features"])
              for kind in ("Point", "LineString", "Polygon")}
    if counts != {"Point": 39, "LineString": 1, "Polygon": 1}:
        raise ValueError(f"NWS source changed; curator review required: {counts}")
    dossier = json.loads((ROOT / "exhibits/el-reno-2013/dossier.json").read_text(encoding="utf-8"))
    queue = json.loads((ROOT / "research/video-review-queue.json").read_text(encoding="utf-8"))
    creators = json.loads((ROOT / "research/creators.json").read_text(encoding="utf-8"))
    notebook = json.loads((ROOT / "exhibits/el-reno-2013/observations.json").read_text(encoding="utf-8"))
    validate_notebook(notebook, queue, dossier['id'])
    damage = json.loads((ROOT / "exhibits/el-reno-2013/damage.json").read_text(encoding="utf-8"))
    validate_gallery(damage, ROOT / "web")
    history = json.loads((ROOT / "exhibits/el-reno-2013/history.json").read_text(encoding="utf-8"))
    photos = json.loads((ROOT / "exhibits/el-reno-2013/storm-photos.json").read_text(encoding="utf-8"))
    validate_history(history, photos, ROOT / "web")
    guide = json.loads((ROOT / "exhibits/el-reno-2013/visitor-guide.json").read_text(encoding="utf-8"))
    result = {"exhibit": dossier, "geometry": geojson, "review_queue": queue, "creators": creators,
              "notebook": notebook, "damage": damage, "history": history, "storm_photos": photos,
              "visitor_guide": guide}
    media = json.loads((ROOT / 'exhibits/el-reno-2013/timeline-media.json').read_text(encoding='utf-8'))
    validate_timeline_media(media, ROOT / 'web')
    result['timeline_media'] = media
    community = json.loads((ROOT / 'exhibits/el-reno-2013/community.json').read_text(encoding='utf-8'))
    validate_community(community, dossier['id'])
    result['community'] = community
    result['survey'] = load_survey(geojson)
    result['survey_media'] = load_survey_attachments(result['survey'])
    result['cameras'] = load_cameras()
    result['documentary'] = load_documentary(ROOT)
    validate_remembrance_coverage(history, result['documentary'])
    from .footage import load_footage
    result['footage'] = load_footage(ROOT)
    reading = json.loads((ROOT / "exhibits/el-reno-2013/reading.json").read_text(encoding="utf-8"))
    validate_reading(reading, result)
    result['reading'] = reading
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    geo_path = ROOT / "exhibits/el-reno-2013/path.geojson"
    geo_path.write_text(json.dumps(geojson, indent=2) + "\n", encoding="utf-8")
    return {"output": str(destination), "geometry": counts, "source_sha256": metadata["sha256"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build the local El Reno exhibit from preserved NWS geometry")
    parser.add_argument("--refresh", action="store_true", help="Fetch the mutable source URL again")
    args = parser.parse_args()
    print(json.dumps(build(refresh=args.refresh), indent=2))
