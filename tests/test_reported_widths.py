import copy
import json
import re
import unittest
from datetime import datetime, timezone
from pathlib import Path

from atlas.event_package import validate_replay
from atlas.reported_widths import load_reported_widths, validate_reported_widths

ROOT = Path(__file__).resolve().parents[1]
START = datetime(2013, 5, 31, 23, 4, tzinfo=timezone.utc)
END = datetime(2013, 5, 31, 23, 42, tzinfo=timezone.utc)


class ReportedWidthTests(unittest.TestCase):
    def setUp(self):
        self.record = load_reported_widths(ROOT, "el-reno-2013")
        self.bundle = json.loads((ROOT / "web/data.json").read_text(encoding="utf-8"))
        self.config = json.loads((ROOT / "web/events/el-reno-2013.json").read_text(encoding="utf-8"))
        self.config.pop("bundle_sha256")

    def check(self, record):
        return validate_reported_widths(record, "el-reno-2013", START, END)

    def test_record_holds_the_two_reported_widths(self):
        self.assertIs(self.check(self.record), self.record)
        self.assertEqual(
            [(w["metres"], w["start_utc"], w["end_utc"], w["source_id"], w["approximate"]) for w in self.record["widths"]],
            [(500, "2013-05-31T23:24:38Z", "2013-05-31T23:24:50Z", "wakimoto-2015", True),
             (800, "2013-05-31T23:24:54Z", "2013-05-31T23:25:06Z", "wakimoto-2015", True)])
        self.assertEqual(self.record["placement"], "replay_center_position")
        self.assertEqual(self.record["placement_note"],
                         "The circle's center is interpolated between the NWS minute positions and was not observed.")
        self.assertNotIn("interpolated", self.record["placement_note_published"])

    def test_published_bundle_carries_the_record_unchanged(self):
        self.assertEqual(self.bundle["reported_widths"], self.record)
        validate_replay(self.config, self.bundle)

    def test_source_is_the_recorded_edition_of_the_paper(self):
        recorded = {source["id"]: source for source in self.bundle["appearance_timeline"]["photo_sources"]}
        self.assertEqual(len(self.record["sources"]), 1)
        for source in self.record["sources"]:
            self.assertEqual(source["url"], "https://doi.org/10.1175/MWR-D-15-0034.1")
            self.assertEqual(source["url"], recorded[source["id"]]["url"])
            self.assertEqual(source["retained_copy"], recorded[source["id"]]["original_locator"])
            self.assertEqual(source["sha256"], recorded[source["id"]]["sha256"])
        self.assertEqual([width["locator_url"] for width in self.record["widths"]],
                         [recorded["wakimoto-2015"]["original_locator"] + "#page=12",
                          recorded["wakimoto-2015"]["original_locator"] + "#page=20"])

    def test_bundle_refuses_a_width_from_an_undeclared_source(self):
        bundle = copy.deepcopy(self.bundle)
        bundle["reported_widths"]["widths"][0]["source_id"] = "someone-else"
        with self.assertRaisesRegex(ValueError, "does not declare"):
            validate_replay(self.config, bundle)

    def test_bundle_without_the_record_is_still_a_replay(self):
        bundle = copy.deepcopy(self.bundle)
        del bundle["reported_widths"]
        validate_replay(self.config, bundle)

    def test_an_event_without_a_record_has_none(self):
        self.assertFalse((ROOT / "exhibits/joplin-2011/reported-widths.json").exists())
        self.assertIsNone(load_reported_widths(ROOT, "joplin-2011"))

    def test_records_that_leave_the_source_the_size_or_the_period_are_refused(self):
        def width(key, value, index=0):
            return lambda record: record["widths"][index].__setitem__(key, value)

        def source(key, value):
            return lambda record: record["sources"][0].__setitem__(key, value)

        def statement(old, new):
            def edit(record):
                self.assertIn(old, record["widths"][0]["statement"])
                record["widths"][0]["statement"] = record["widths"][0]["statement"].replace(old, new)
            return edit

        cases = {
            ("another event", "different event or schema"): lambda record: record.__setitem__("event", "joplin-2011"),
            ("an unknown top field", "different event or schema"): lambda record: record.__setitem__("note", "x"),
            ("a different placement", "stated placement"): lambda record: record.__setitem__("placement", "surveyed_position"),
            ("no placement note", "stated placement"): lambda record: record.__setitem__("placement_note", " "),
            ("a placement note of control characters", "stated placement"):
                lambda record: record.__setitem__("placement_note_published", "\u001f\u001f"),
            ("a placement note outside the basic plane", "stated placement"):
                lambda record: record.__setitem__("placement_note", "Placed \U0001F300"),
            ("a placement note of a byte order mark", "stated placement"):
                lambda record: record.__setitem__("placement_note", "Placed\ufeff"),
            ("no sources", "bounded source list"): lambda record: record.__setitem__("sources", []),
            ("an unknown source field", "Unsupported reported width source fields"): source("title", "x"),
            ("a repeated source", "sources need distinct identities"):
                lambda record: record["sources"].append(copy.deepcopy(record["sources"][0])),
            ("a source without a citation", "citation and plain HTTPS addresses"): source("citation", ""),
            ("a plain HTTP source address", "citation and plain HTTPS addresses"):
                source("url", "http://doi.org/10.1175/MWR-D-15-0034.1"),
            ("a retained copy with credentials", "citation and plain HTTPS addresses"):
                source("retained_copy", "https://user:secret@example.org/paper.pdf"),
            ("a retained copy with a port", "citation and plain HTTPS addresses"):
                source("retained_copy", "https://example.org:99999/paper.pdf"),
            ("a retained copy that is already a locator", "citation and plain HTTPS addresses"):
                lambda record: record["sources"][0].__setitem__("retained_copy", record["sources"][0]["retained_copy"] + "#page=1"),
            ("an address without its slashes", "citation and plain HTTPS addresses"): source("url", "https:doi.org/10.1175"),
            ("a short digest", "digest of its retained copy"): source("sha256", "b0d7"),
            ("no widths", "bounded list"): lambda record: record.__setitem__("widths", []),
            ("an unknown width field", "Unsupported reported width fields"): width("radius", 250),
            ("a missing width field", "Unsupported reported width fields"): lambda record: record["widths"][0].pop("limits"),
            ("a repeated identity", "Reported widths need distinct identities"):
                lambda record: record["widths"][1].__setitem__("id", record["widths"][0]["id"]),
            ("an undeclared source", "does not declare"): width("source_id", "someone-else"),
            ("another quantity", "quantity"): width("quantity", "damage_path_width"),
            ("a fractional width", "whole metres"): width("metres", 500.5),
            ("a true or false width", "whole metres"): width("metres", True),
            ("a width stated as exact", "approximate mark"): width("approximate", False),
            ("a period without seconds", "whole second UTC"): width("start_utc", "2013-05-31T23:24Z"),
            ("a day that does not exist", "whole second UTC"): width("start_utc", "2013-05-32T23:24:38Z"),
            ("a day the month does not have", "whole second UTC"): width("start_utc", "2013-02-30T23:24:38Z"),
            ("a reversed period", "ordered, separate and inside"): width("end_utc", "2013-05-31T23:24:30Z"),
            ("a period before the replay clock", "ordered, separate and inside"): width("start_utc", "2013-05-31T23:03:59Z"),
            ("a period after the replay clock", "ordered, separate and inside"): width("end_utc", "2013-05-31T23:42:01Z", 1),
            ("periods that touch", "ordered, separate and inside"): width("start_utc", "2013-05-31T23:24:50Z", 1),
            ("periods out of order", "ordered, separate and inside"): lambda record: record["widths"].reverse(),
            ("a statement with another size", "approximate size and its period"): statement("about 500 m", "about 600 m"),
            ("a statement with a larger size that ends the same", "approximate size and its period"):
                statement("about 500 m", "about 1500 m"),
            ("a statement in another unit", "approximate size and its period"): statement("about 500 m", "about 500 miles"),
            ("a statement that turns the size into a speed", "approximate size and its period"):
                statement("about 500 m at", "about 500 m/s at"),
            ("a statement that moves the period to another zone", "approximate size and its period"):
                statement("23:24:50 UTC.", "23:24:50 UTC+1."),
            ("a note with a character that does not show", "stated placement"):
                lambda record: record.__setitem__("placement_note", "Placed\u200bhere"),
            ("a note with a control character of the second range", "stated placement"):
                lambda record: record.__setitem__("placement_note", "Placed\u0085here"),
            ("a statement that drops about", "approximate size and its period"): statement("about 500 m", "500 m"),
            ("a statement with another period", "approximate size and its period"): statement("23:24:50", "23:25:50"),
            ("a statement with its period turned round", "approximate size and its period"):
                statement("23:24:38 to 23:24:50", "23:24:50 to 23:24:38"),
            ("a locator outside the retained copy", "point into its retained source copy"):
                width("locator_url", "https://example.org/paper.pdf#page=12"),
            ("a locator with no place in the copy", "point into its retained source copy"):
                lambda record: record["widths"][0].__setitem__("locator_url", record["sources"][0]["retained_copy"]),
            ("a locator with an empty place", "point into its retained source copy"):
                lambda record: record["widths"][0].__setitem__("locator_url", record["sources"][0]["retained_copy"] + "#"),
            ("an impossible review date", "review date"): width("reviewed_on", "2026-02-30"),
            ("a review month that does not exist", "review date"): width("reviewed_on", "2026-13-01"),
        }
        # Each case is refused for its own reason, so a missing rule cannot hide behind another.
        for (name, reason), edit in cases.items():
            record = copy.deepcopy(self.record)
            edit(record)
            with self.subTest(name), self.assertRaisesRegex(ValueError, reason):
                self.check(record)
        for bad in (None, [], "record"):
            with self.subTest(bad=bad), self.assertRaisesRegex(ValueError, "different event or schema"):
                self.check(bad)

    def test_the_page_list_and_its_scene_links_agree_with_the_record(self):
        page = (ROOT / "web/reconstruction.html").read_text(encoding="utf-8")
        for width in self.record["widths"]:
            item = re.search(r'<li data-width-metres="%d">(.*?)</li>' % width["metres"], page, re.S)
            self.assertIsNotNone(item, width["id"])
            text = item.group(1)
            first, last = width["start_utc"][11:19], width["end_utc"][11:19]
            self.assertIn(f"{first} to {last} UTC", text)
            seconds = int((datetime.fromisoformat(width["start_utc"].replace("Z", "+00:00")) - START).total_seconds())
            self.assertIn(f'id="replay-width-show-{width["id"]}"', text)
            self.assertIn(f'href="reconstruction.html?event=el-reno-2013&amp;t={seconds}#replay-path-stage"', text)
            self.assertIn(f"See this width in the scene at {first} UTC", text)
            # The page links the same place in the paper that the record cites.
            self.assertIn(f'href="{width["locator_url"]}"', text)


if __name__ == "__main__":
    unittest.main()
