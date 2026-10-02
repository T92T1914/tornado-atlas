"""Verify processed JMA browser files without a database or network request."""
from __future__ import annotations
import gzip
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

URL = "https://www.data.jma.go.jp/stats/data/bosai/tornado/data/ichiran.csv"

def require(condition, message):
    if not condition:
        raise ValueError(message)

def validate(folder: Path) -> dict:
    plain = (folder / "index.json").read_bytes()
    require(gzip.decompress((folder / "index.json.gz").read_bytes()) == plain,
            "Gzip companion disagrees with the canonical index")
    index = json.loads(plain)
    require(index["schema_version"] == 1, "Unsupported source-case schema")
    source = index["source"]
    require(source["url"] == URL and re.fullmatch(r"[0-9a-f]{64}", source["sha256"]),
            "Unsupported source identity")
    require("path" not in source, "Local cache path in public source metadata")
    require("Japan Meteorological Agency" in index["attribution"]
            and "not a JMA publication or endorsement" in index["transformation"],
            "Missing source attribution or transformation notice")
    records, details, paths, groups = index["records"], {}, set(), {}
    require(0 < len(records) <= 10_000, "Unsupported source-case count")
    for item in index["details"]:
        relative = item["path"]
        require(re.fullmatch(r"details/[0-9a-f]{2}-[0-9a-f]{20}\.json", relative),
                "Unsupported detail filename")
        require(relative not in paths, "Duplicate detail object")
        paths.add(relative)
        content = (folder / relative).read_bytes()
        digest = hashlib.sha256(content).hexdigest()
        require(digest == item["sha256"] and type(item["bytes"]) is int
                and len(content) == item["bytes"] and digest[:20] in relative,
                "Detail bytes disagree with their identity")
        group = json.loads(content)
        require(isinstance(group, dict) and group, "Empty or invalid detail object")
        require(not details.keys() & group.keys(), "Duplicate case across detail objects")
        groups[relative] = group
        details.update(group)
    ids, counts, years = set(), Counter(), set()
    for row in records:
        identifier = row["id"]
        require(re.fullmatch(r"jma:[0-9]{10}", identifier) and identifier not in ids,
                "Invalid or duplicate source case")
        ids.add(identifier)
        require(row["detail_file"] in paths, "Unlisted detail object")
        group = groups[row["detail_file"]]
        require(identifier in group, "Selected case is absent from its detail object")
        detail = details[identifier]
        require(detail["country_code"] == "JP" and detail["id"] == identifier
                and detail["source_record_id"] == row["case_id"], "Case identity mismatch")
        for key in ("title", "year", "classification", "classification_code",
                    "classification_reported", "confirmed_tornado", "language"):
            require(type(detail[key]) is type(row[key]) and detail[key] == row[key],
                    "Indexed field disagrees with detail: " + key)
        require(detail["rating"]["reported"] == row["rating"], "Rating mismatch")
        require(row["confirmed_tornado"] is (row["classification_code"] == "1"),
                "Phenomenon incorrectly counted as tornado")
        provenance = detail["provenance"]
        require(provenance["source_url"] == source["url"]
                and provenance["sha256"] == source["sha256"]
                and provenance["snapshot_id"] == source["snapshot_id"],
                "Case provenance disagrees with retained source")
        require(type(provenance["csv_record"]) is int and provenance["csv_record"] >= 2,
                "Invalid source CSV record")
        require(all(detail["time"][endpoint]["zone"] is None
                    and detail["time"][endpoint]["utc"] is None
                    for endpoint in ("begin", "end"))
                and detail["spatial"]["datum"] is None and detail["spatial"]["track"] is None
                and detail["spatial"]["interpolation"] is None
                and detail["dimensions"]["visible_funnel_width_m"] is None
                and detail["dimensions"]["length_m"] is None
                and detail["dimensions"]["width_m"] is None
                and detail["reconstruction"]["status"] == "not_built"
                and detail["reconstruction"]["observed_appearance"] is None
                and detail["wind"]["unit"] is None, "Unreviewed source inference")
        require(all(value["aggregation"] == "not_aggregated" for value in detail["impacts"].values()),
                "Shared-impact aggregation is outside the contract")
        counts[row["classification_code"]] += 1
        years.add(row["year"])
    require(ids == details.keys(), "Unindexed or missing detail cases")
    coverage = index["coverage"]
    require(coverage["source_cases"] == len(records)
            and coverage["classified_tornado_records"] == counts["1"]
            and coverage["classification_counts"] == dict(counts)
            and coverage["occurrence_years"] == sorted(years), "Coverage mismatch")
    require(len(plain) + sum(item["bytes"] for item in index["details"]) <= 64_000_000,
            "Processed publication exceeds 64 MB")
    return {"cases": len(records), "classified_tornado_records": counts["1"],
            "detail_files": len(paths), "source_sha256": source["sha256"]}

if __name__ == "__main__":
    print(json.dumps(validate(Path(__file__).resolve().parents[1] / "web/jma-cases"),
                     sort_keys=True))
