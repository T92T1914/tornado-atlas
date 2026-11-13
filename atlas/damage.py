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
    """No inferred coordinates, capture dates, wind estimates or altered images in this schema.

    The survey-record link is checked for shape here. `validate_survey_links`
    checks it against the retained DAT responses.
    """
    if gallery.get("schema") != 1 or gallery.get("event") != "el-reno-2013":
        raise ValueError("Unsupported damage gallery")
    if not isinstance(gallery.get("survey_link_note"), str) or "not where the camera stood" not in gallery["survey_link_note"]:
        raise ValueError("The survey-record link must say that its point is not the camera position")
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
        validate_link_shape(photo.get("survey_record"))
        if not re.fullmatch(r"[0-9a-f]{64}", photo.get("sha256", "")):
            raise ValueError("A pinned source digest is required")
        if type(photo.get("bytes")) is not int or not 0 < photo["bytes"] <= 5_000_000:
            raise ValueError("Invalid asset size")
        if any(type(photo.get(key)) is not int or not 1 <= photo[key] <= 10000 for key in ("width", "height")):
            raise ValueError("Invalid image dimensions")
        if web_root is not None:
            content = (web_root / photo["asset"]).read_bytes()
            verify_image(photo, content)


LINK_REVIEW = "research/nws-photo-survey-joins-2026-11-11.md"
GLOBAL_ID = re.compile(r"\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}")


def validate_link_shape(link) -> None:
    """A survey-record link names the damaged structure's record. It is never a camera position."""
    if not isinstance(link, dict) or set(link) != {"object_id", "global_id", "attachment_id", "matched_by", "review"}:
        raise ValueError("Each gallery photograph needs exactly one reviewed survey-record link")
    if any(type(link[key]) is not int or link[key] <= 0 for key in ("object_id", "attachment_id")):
        raise ValueError("Invalid survey-record link identifier")
    if not isinstance(link["global_id"], str) or not GLOBAL_ID.fullmatch(link["global_id"]):
        raise ValueError("Invalid survey-record global ID")
    if link["matched_by"] != "decoded_pixels" or link["review"] != LINK_REVIEW:
        raise ValueError("A survey-record link needs the reviewed pixel match")


def validate_survey_links(gallery: dict, records: dict, survey: dict, media: dict) -> None:
    """Check each link against the retained DAT point and attachment responses.

    `records` is the raw point response, `survey` the compiled map points and
    `media` the compiled attachments. A link must name a record that is on the
    survey map and an original attached to that same record.
    """
    global_ids = {f["attributes"]["objectid"]: f["attributes"]["globalid"] for f in records["features"]}
    mapped = {point["id"] for point in survey["points"]}
    seen = set()
    for photo in gallery["photos"]:
        link = photo["survey_record"]
        validate_link_shape(link)
        object_id = link["object_id"]
        if object_id not in global_ids:
            raise ValueError(f"Survey record is missing from the retained response: {photo['id']}")
        if global_ids[object_id] != link["global_id"]:
            raise ValueError(f"Survey record global ID does not match the retained response: {photo['id']}")
        if object_id not in mapped:
            raise ValueError(f"Survey record is not on the survey map: {photo['id']}")
        attachments = {item["attachment_id"] for item in media["photos"].get(str(object_id), [])}
        if link["attachment_id"] not in attachments:
            raise ValueError(f"Attachment is not an original on that survey record: {photo['id']}")
        if object_id in seen:
            raise ValueError(f"Two gallery photographs link one survey record: {photo['id']}")
        seen.add(object_id)


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
