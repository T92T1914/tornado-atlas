import json
import os
import struct
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

from atlas import china  # noqa: E402
from atlas.china_publication import build_index, encoded  # noqa: E402
from atlas.xls import _Pieces, _rk, read_workbook  # noqa: E402
import check_china_cases  # noqa: E402

PUBLISHED = ROOT / "web" / "china-cases"
# Set this to the retained version 2 file to compare it with the published index.
SOURCE = os.environ.get("ATLAS_CHINA_SOURCE")


def record(kind, payload):
    return struct.pack("<HH", kind, len(payload)) + payload


def workbook(rows):
    """Build a one sheet BIFF8 workbook inside a minimal compound file."""
    strings = sorted({value for row in rows for value in row if isinstance(value, str)})
    sst = struct.pack("<II", len(strings), len(strings)) + b"".join(
        struct.pack("<HB", len(text), 1) + text.encode("utf-16-le") for text in strings)
    cells = b""
    for r, row in enumerate(rows):
        for c, value in enumerate(row):
            if isinstance(value, str):
                cells += record(0x00FD, struct.pack("<HHHI", r, c, 0, strings.index(value)))
            elif value is not None:
                cells += record(0x0203, struct.pack("<HHHd", r, c, 0, value))
    bof = record(0x0809, struct.pack("<HHHHII", 0x0600, 0x0005, 0, 0, 0, 0))
    eof = record(0x000A, b"")
    name = "Data".encode("latin-1")
    sheet_entry_size = 4 + 6 + 2 + len(name)
    sheet_offset = len(bof) + sheet_entry_size + len(record(0x00FC, sst)) + len(eof)
    globals_ = bof + record(0x0085, struct.pack("<IBBBB", sheet_offset, 0, 0, len(name), 0) + name)
    globals_ += record(0x00FC, sst) + eof
    stream = globals_ + bof + cells + eof
    stream += b"\0" * (4096 - len(stream) % 4096 if len(stream) < 4096 else (-len(stream)) % 512)
    sectors = len(stream) // 512
    header = bytearray(512)
    header[:8] = bytes.fromhex("d0cf11e0a1b11ae1")
    struct.pack_into("<HHHHH", header, 0x18, 0x3E, 3, 0xFFFE, 9, 6)
    struct.pack_into("<IIIIIIIII", header, 0x2C, 1, 1, 0, 4096, 0xFFFFFFFE, 0, 0xFFFFFFFE, 0, 0)
    struct.pack_into("<109I", header, 0x4C, 0, *[0xFFFFFFFF] * 108)
    fat = [0xFFFFFFFD, 0xFFFFFFFE] + [2 + n + 1 for n in range(sectors - 1)] + [0xFFFFFFFE]
    fat += [0xFFFFFFFF] * (128 - len(fat))

    def entry(label, kind, start, size):
        raw = bytearray(128)
        encoded_name = (label + "\0").encode("utf-16-le")
        raw[:len(encoded_name)] = encoded_name
        struct.pack_into("<HBB", raw, 0x40, len(encoded_name), kind, 1)
        struct.pack_into("<III", raw, 0x44, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF if kind == 2 else 1)
        struct.pack_into("<II", raw, 0x74, start, size)
        return bytes(raw)

    directory = entry("Root Entry", 5, 0xFFFFFFFE, 0) + entry("Workbook", 2, 2, len(stream))
    directory += b"\0" * (512 - len(directory))
    return bytes(header) + struct.pack("<128I", *fat) + directory + stream


ROW = ["China_tornado_1", "2017-07-06", 0.6875, None, "lasted 5 minutes", 115.977994, 34.569791,
       "河南省商丘市虞城县田庙乡", "Tianmiao Township, Yucheng County, Shangqiu City, Henan Province",
       "刮倒折断树木", "Trees were knocked down", 2.0]


class XlsReaderTests(unittest.TestCase):
    def test_reads_text_and_numbers_from_a_compound_workbook(self):
        cells = read_workbook(workbook([list(china.HEADERS), ROW]))["Data"]
        self.assertEqual([cells.get((0, c)) for c in range(12)], list(china.HEADERS))
        self.assertEqual(cells[(1, 7)], ROW[7])
        self.assertEqual(cells[(1, 2)], 0.6875)
        self.assertNotIn((1, 3), cells)

    def test_rejects_a_file_that_is_not_a_compound_document(self):
        with self.assertRaises(ValueError):
            read_workbook(b"not a workbook" * 40)

    def test_rk_values(self):
        self.assertEqual(_rk((1234 << 2) | 2), 1234.0)
        self.assertEqual(_rk((1234 << 2) | 3), 12.34)
        self.assertEqual(_rk(struct.unpack("<Q", struct.pack("<d", 1.5))[0] >> 32), 1.5)

    def test_a_string_continued_in_a_new_record_keeps_its_own_width(self):
        first = struct.pack("<HB", 4, 0) + b"ab"
        second = bytes([1]) + "中文".encode("utf-16-le")
        reader = _Pieces([first, second])
        count = struct.unpack("<H", reader.take(2))[0]
        self.assertEqual(reader.chars(count, bool(reader.take(1)[0] & 1)), "ab中文")


class ChinaAdapterTests(unittest.TestCase):
    def test_keeps_structured_fields_and_drops_yearbook_text(self):
        item = china.normalize(ROW, 1)
        self.assertEqual(item["id"], "cn-zhang:1")
        self.assertEqual(item["start_time"]["local"], "16:30")
        self.assertEqual(item["start_time"]["zone"], "UTC+8 as the dataset states")
        self.assertIsNone(item["start_time"]["utc"])
        self.assertEqual(item["end_time"]["kind"], "not_recorded")
        self.assertEqual(item["position"]["basis"], "geocoded_from_place_description")
        self.assertEqual(item["rating"]["reported"], "EF2")
        self.assertEqual(item["provenance"]["sheet_row"], 2)
        text = json.dumps(item, ensure_ascii=False)
        for copied in (ROW[4], ROW[7], ROW[8], ROW[9], ROW[10]):
            self.assertNotIn(copied, text)
        self.assertEqual(set(item), check_china_cases.FIELDS)

    def test_date_ranges_are_approximate_and_periods_stay_as_words(self):
        row = ROW[:1] + ["2018-03-04/2018-03-05", "afternoon"] + ROW[3:5] + [None, None] + ROW[7:11] + [None]
        item = china.normalize(row, 5)
        self.assertEqual(item["recorded_date"]["kind"], "approximate_date_range")
        self.assertTrue(item["recorded_date"]["approximate"])
        self.assertEqual(item["year"], 2018)
        self.assertEqual(item["start_time"], {"reported": "afternoon", "kind": "period_of_day", "local": None,
                                               "zone": "UTC+8 as the dataset states", "utc": None})
        self.assertEqual(item["position"], {"point": None, "coordinate_order": "longitude_latitude",
                                             "basis": "not_geocoded", "datum": None})
        self.assertEqual(item["rating"]["basis"], "unrated")

    def test_unsupported_values_need_review(self):
        for index, value in ((1, "2018-03-05/2018-03-04"), (2, "teatime"), (2, 0.00001), (5, 10.0),
                             (4, "about an hour"), (11, 6.0), (0, "China_tornado_x")):
            row = list(ROW)
            row[index] = value
            with self.subTest(column=index, value=value), self.assertRaises(ValueError):
                china.normalize(row, 1)

    def test_only_the_version_2_bytes_are_read(self):
        with self.assertRaises(ValueError):
            list(china.iter_cases(b"\0" * china.FILE_BYTES))
        with self.assertRaises(ValueError):
            list(china.iter_cases(workbook([list(china.HEADERS), ROW])))


class PublishedChinaCasesTests(unittest.TestCase):
    def test_published_index_passes_its_check(self):
        result = check_china_cases.validate(PUBLISHED)
        self.assertEqual((result["cases"], result["geocoded"], result["approximate_date_ranges"]), (738, 736, 47))

    def test_published_index_credits_and_links_the_license(self):
        index = json.loads((PUBLISHED / "index.json").read_text(encoding="utf-8"))
        self.assertEqual(index["source"]["creators"],
                         ["Yi Zhang", "Genshen Fang", "Weichiang Pang", "Jinxin Cao", "Shuyang Cao", "Yaojun Ge"])
        self.assertEqual(index["source"]["md5"], "f5622b1553a1fec7bbd7d21e3f5d8163")
        self.assertTrue((ROOT / index["source"]["terms_record"]).is_file())

    def test_check_rejects_a_missing_label_or_yearbook_text(self):
        for name, change in (("geocoded label", lambda r: r["position"].update(basis="surveyed")),
                             ("place field", lambda r: r.update(location="Tianmiao Township")),
                             ("Chinese text", lambda r: r["recorded_date"].update(reported="河南省"))):
            index = json.loads((PUBLISHED / "index.json").read_text(encoding="utf-8"))
            change(index["records"][0])
            with self.subTest(name), tempfile.TemporaryDirectory() as folder:
                (Path(folder) / "index.json").write_bytes(encoded(index))
                with self.assertRaises(ValueError):
                    check_china_cases.validate(Path(folder))

    @unittest.skipUnless(SOURCE, "Set ATLAS_CHINA_SOURCE to the retained version 2 file")
    def test_published_index_is_rebuilt_from_the_version_2_file(self):
        self.assertEqual(encoded(build_index(Path(SOURCE).read_bytes())),
                         (PUBLISHED / "index.json").read_bytes())


if __name__ == "__main__":
    unittest.main()
