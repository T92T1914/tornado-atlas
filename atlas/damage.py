"""Validate and restore explicitly curated survey photographs without changing their bytes."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from .sources import ROOT, cached_retrieval, read_object, retrieve

PAGE = "https://www.weather.gov/oun/events-20130531"
BASE = "https://www.weather.gov/images/oun/wxevents/20130531/damage/"


def validate_gallery(gallery: dict, web_root: Path | None = None) -> None:
    """No inferred coordinates, capture dates, wind estimates or altered images in this schema."""
    if gallery.get("schema") != 1 or gallery.get("event") != "el-reno-2013":
        raise ValueError("Unsupported damage gallery")
    photos = gallery.get("photos", [])
    if not photos:
        raise ValueError("Damage gallery is empty")
    ids = set()
    for photo in photos:
        number = photo.get("source_photo_number")
        if type(number) is not int or not 1 <= number <= 9:
            raise ValueError("Unreviewed source photograph")
        if photo.get("id") != f"nws-el-reno-damage-{number:02d}" or photo["id"] in ids:
            raise ValueError("Invalid or duplicate photograph ID")
        ids.add(photo["id"])
        filename = f"damage{number:02d}.jpg"
        if (photo.get("image_url") != BASE + filename or photo.get("source_page") != PAGE
                or photo.get("asset") != f"assets/el-reno-2013/{filename}"):
            raise ValueError("Source or asset is outside the curated photograph set")
        if photo.get("reported_rating") not in {"EF2", "EF3"}:
            raise ValueError("Unreviewed source rating")
        if photo.get("subject") not in {"House", "Metal building", "Infrastructure"}:
            raise ValueError("Unknown subject category")
        for field in ("title", "caption", "location_description", "credit", "rights_basis"):
            if not isinstance(photo.get(field), str) or not photo[field].strip():
                raise ValueError(f"Missing photograph context: {field}")
        if photo.get("coordinates", "missing") is not None or photo.get("captured_at", "missing") is not None:
            raise ValueError("This gallery has no verified capture coordinates or times")
        if not re.fullmatch(r"[0-9a-f]{64}", photo.get("sha256", "")):
            raise ValueError("A pinned source digest is required")
        if type(photo.get("bytes")) is not int or not 0 < photo["bytes"] <= 5_000_000:
            raise ValueError("Invalid asset size")
        if any(type(photo.get(key)) is not int or not 1 <= photo[key] <= 10000 for key in ("width", "height")):
            raise ValueError("Invalid image dimensions")
        if web_root is not None:
            content = (web_root / photo["asset"]).read_bytes()
            verify_image(photo, content)


def verify_image(photo: dict, content: bytes) -> None:
    if len(content) != photo["bytes"] or hashlib.sha256(content).hexdigest() != photo["sha256"]:
        raise ValueError(f"Photograph integrity mismatch: {photo['id']}")
    if not content.startswith(b"\xff\xd8\xff") or not content.endswith(b"\xff\xd9"):
        raise ValueError("Expected the reviewed JPEG bytes")


def restore_assets(gallery: dict, web_root: Path = ROOT / "web") -> int:
    validate_gallery(gallery)
    restored = 0
    for photo in gallery["photos"]:
        destination = web_root / photo["asset"]
        if destination.exists():
            verify_image(photo, destination.read_bytes())
            continue
        metadata = cached_retrieval(photo["image_url"]) or retrieve(photo["image_url"], max_bytes=5_000_000)
        content = read_object(metadata)
        verify_image(photo, content)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        restored += 1
    return restored


if __name__ == "__main__":
    gallery = json.loads((ROOT / "exhibits/el-reno-2013/damage.json").read_text(encoding="utf-8"))
    restored = restore_assets(gallery)
    validate_gallery(gallery, ROOT / "web")
    print(f"Verified {len(gallery['photos'])} source photographs; restored {restored} missing assets.")
