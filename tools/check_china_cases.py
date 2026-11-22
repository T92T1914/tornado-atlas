"""Verify the published mainland China source cases without the source file or a network request."""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

MD5 = "f5622b1553a1fec7bbd7d21e3f5d8163"
SHA256 = "d1c1b2164c732e0583c7c72a9a8d68c9e909677a43a795fac69f59ced0528279"
DOI = "https://doi.org/10.4121/19801633.v2"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
OMITTED = ["Notes on time", "Detailed locations in Chinese", "Detailed locations in English",
           "Damage Descriptions in Chinese", "Damage Descriptions in English"]
# Every published field. A new field, such as one holding yearbook text, fails here.
FIELDS = {"schema_version", "id", "source", "case_label", "sequence", "year", "country_code",
          "recorded_date", "start_time", "end_time", "position", "rating", "provenance"}
NO_TEXT = re.compile(r"[㐀-鿿]")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(folder: Path) -> dict:
    raw = (folder / "index.json").read_bytes()
    index = json.loads(raw)
    require(index["schema_version"] == 1, "Unsupported schema")
    source = index["source"]
    require(source["doi"] == DOI and source["md5"] == MD5 and source["sha256"] == SHA256
            and source["version"] == 2, "Unsupported source identity")
    require(source["license"] == "CC BY 4.0" and source["license_url"] == LICENSE_URL,
            "The CC BY 4.0 license and its link are required")
    require(len(source["creators"]) == 6 and all(source["creators"]), "Every creator must be credited")
    require("CC BY 4.0" in index["attribution"] and "doi:10.4121/19801633.v2" in index["attribution"],
            "Attribution must name the license and the DOI")
    require("both damage description columns" in index["changes"]
            and "Chinese and English locations" in index["changes"]
            and "not a publication of the dataset's authors" in index["changes"],
            "The changes notice must say what was left out and that this is not the authors' publication")
    require(index["omitted_columns"] == OMITTED, "Unexpected omitted columns")
    records = index["records"]
    require(not NO_TEXT.search(json.dumps(records, ensure_ascii=False)),
            "Chinese text appears in the published cases")
    for record in records:
        require(set(record) == FIELDS, "Unexpected published field: " + ", ".join(sorted(set(record) ^ FIELDS)))
    require(0 < len(records) <= 5_000, "Unsupported case count")
    ids, years, ratings = set(), set(), Counter()
    for number, record in enumerate(records, start=1):
        require(record["id"] == f"cn-zhang:{number}" and record["case_label"] == f"China_tornado_{number}"
                and record["id"] not in ids, "Cases must keep the source order and labels")
        ids.add(record["id"])
        require(record["country_code"] == "CN" and record["provenance"]["md5"] == MD5,
                "Case provenance disagrees with the source")
        date = record["recorded_date"]
        require(date["approximate"] is (date["kind"] == "approximate_date_range")
                and date["first"] <= date["last"], "Date range state is inconsistent")
        for key in ("start_time", "end_time"):
            time = record[key]
            require(time["utc"] is None, "No UTC conversion is claimed")
            require(time["kind"] in ("not_recorded", "period_of_day", "clock_time"), "Unknown time kind")
            require((time["zone"] is None) is (time["kind"] == "not_recorded"), "Recorded times keep UTC+8")
            if time["kind"] == "clock_time":
                require(re.fullmatch(r"[0-2][0-9]:[0-5][0-9]", time["local"]), "Invalid clock label")
        position = record["position"]
        require(position["datum"] is None, "No datum is claimed")
        require(position["basis"] == ("geocoded_from_place_description" if position["point"] else "not_geocoded"),
                "Every position is labeled as geocoded")
        rating = record["rating"]
        require((rating["reported"] is None) is (rating["basis"] == "unrated"), "Rating state is inconsistent")
        ratings[rating["reported"] or "unrated"] += 1
        years.add(record["year"])
    coverage = index["coverage"]
    require(coverage["source_cases"] == len(records)
            and coverage["rating_counts"] == dict(sorted(ratings.items()))
            and coverage["occurrence_years"] == sorted(years)
            and coverage["geocoded_positions"] == sum(r["position"]["point"] is not None for r in records)
            and coverage["approximate_date_ranges"] == sum(r["recorded_date"]["approximate"] for r in records),
            "Coverage disagrees with the cases")
    return {"cases": len(records), "geocoded": coverage["geocoded_positions"],
            "approximate_date_ranges": coverage["approximate_date_ranges"], "bytes": len(raw)}


if __name__ == "__main__":
    print(json.dumps(validate(Path(__file__).resolve().parents[1] / "web/china-cases"), indent=2))
