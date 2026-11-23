"""Widths a source reports for a stated period of a replay.

A width belongs to its period and to its own definition. It is never carried to
another clock. Its place in the scene is the replay's center position, which
this record does not take from the width's source, so the record has to say so.
The record names its own sources and does not depend on what the rest of the
package declares.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path

TOP_FIELDS = {"schema", "event", "placement", "placement_note", "placement_note_published", "sources", "widths"}
SOURCE_FIELDS = {"id", "citation", "url", "retained_copy", "sha256"}
WIDTH_FIELDS = {"id", "source_id", "quantity", "metres", "approximate", "start_utc", "end_utc",
                "statement", "limits", "locator", "locator_url", "reviewed_on"}
_UTC = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")
_ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
# Plain addresses only, so the build and the browser read them the same way.
_ADDRESS = re.compile(r"https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?:/[A-Za-z0-9._~%+/-]*)?")
_FRAGMENT = re.compile(r"[A-Za-z0-9=&._-]+")
_UNREADABLE = re.compile("[\u0000-\u001f\u007f\ud800-\udfff\ufeff]")


def _text(value):
    """Readable text: bounded, with a letter in it, no control characters and
    no characters outside the basic plane, which the two validators would count differently."""
    return (isinstance(value, str) and 1 <= len(value) <= 600 and re.search("[A-Za-z]", value) is not None
            and _UNREADABLE.search(value) is None and all(ord(character) < 0x10000 for character in value))


def _stamp(value):
    if not isinstance(value, str) or not _UTC.fullmatch(value):
        raise ValueError("Reported width periods need whole second UTC")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ValueError("Reported width periods need whole second UTC") from None


def validate_reported_widths(data, event_id, start, end):
    """Check a reported width record before the shared player may draw from it."""
    if (not isinstance(data, dict) or set(data) != TOP_FIELDS
            or type(data["schema"]) is not int or data["schema"] != 1 or data["event"] != event_id):
        raise ValueError("Reported widths belong to a different event or schema")
    if (data["placement"] != "replay_center_position" or not _text(data["placement_note"])
            or not _text(data["placement_note_published"])):
        raise ValueError("Reported widths need a stated placement and its limit")
    if not isinstance(data["sources"], list) or not 1 <= len(data["sources"]) <= 8:
        raise ValueError("Reported widths need a bounded source list")
    sources = {}
    for source in data["sources"]:
        if not isinstance(source, dict) or set(source) != SOURCE_FIELDS:
            raise ValueError("Unsupported reported width source fields")
        if not isinstance(source["id"], str) or not _ID.fullmatch(source["id"]) or source["id"] in sources:
            raise ValueError("Reported width sources need distinct identities")
        if not _text(source["citation"]) or not all(
                isinstance(source[key], str) and _ADDRESS.fullmatch(source[key]) for key in ("url", "retained_copy")):
            raise ValueError("A reported width source needs a citation and plain HTTPS addresses")
        if not isinstance(source["sha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", source["sha256"]):
            raise ValueError("A reported width source needs the digest of its retained copy")
        sources[source["id"]] = source
    widths = data["widths"]
    if not isinstance(widths, list) or not 1 <= len(widths) <= 16:
        raise ValueError("Reported widths need a bounded list")
    seen, previous_end = set(), None
    for width in widths:
        if not isinstance(width, dict) or set(width) != WIDTH_FIELDS:
            raise ValueError("Unsupported reported width fields")
        if not isinstance(width["id"], str) or not _ID.fullmatch(width["id"]) or width["id"] in seen:
            raise ValueError("Reported widths need distinct identities")
        seen.add(width["id"])
        source = sources.get(width["source_id"]) if isinstance(width["source_id"], str) else None
        if source is None:
            raise ValueError("A reported width names a source its record does not declare")
        if width["quantity"] != "visible_funnel_width":
            raise ValueError("Unsupported reported width quantity")
        if type(width["metres"]) is not int or not 10 <= width["metres"] <= 10000 or width["approximate"] is not True:
            raise ValueError("A reported width needs whole metres and its approximate mark")
        first, last = _stamp(width["start_utc"]), _stamp(width["end_utc"])
        if first >= last or first < start or last > end or (previous_end is not None and first <= previous_end):
            raise ValueError("Reported width periods must be ordered, separate and inside the replay clock")
        previous_end = last
        if not all(_text(width[key]) for key in ("statement", "limits", "locator")):
            raise ValueError("A reported width needs its statement, limits and locator")
        # The statement is what the visitor reads, so it has to carry the size as
        # an approximate figure and the whole period that the drawing uses, in order.
        size = re.compile(rf"(?:^|[^A-Za-z0-9.])[Aa]bout {width['metres']} m(?![A-Za-z0-9])")
        period = re.compile(rf"(?:^|[^0-9:]){re.escape(width['start_utc'][11:19])} to "
                            rf"{re.escape(width['end_utc'][11:19])} UTC(?![A-Za-z0-9])")
        if not size.search(width["statement"]) or not period.search(width["statement"]):
            raise ValueError("A reported width statement must name its approximate size and its period")
        # The locator points to a place inside the retained copy whose digest the source carries.
        locator, prefix = width["locator_url"], source["retained_copy"] + "#"
        if not isinstance(locator, str) or not locator.startswith(prefix) or not _FRAGMENT.fullmatch(locator[len(prefix):]):
            raise ValueError("A reported width locator must point into its retained source copy")
        try:
            reviewed = (isinstance(width["reviewed_on"], str)
                        and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", width["reviewed_on"]) is not None
                        and date.fromisoformat(width["reviewed_on"]).isoformat() == width["reviewed_on"])
        except ValueError:
            reviewed = False
        if not reviewed:
            raise ValueError("A reported width needs its review date")
    return data


def load_reported_widths(root: Path, event_id: str):
    """Read an event's reported widths, or None when it has no such record."""
    path = root / "exhibits" / event_id / "reported-widths.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
