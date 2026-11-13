# JMA case revision of October 13, 2026

The Japan source browser now reads the JMA case CSV that JMA last modified on October 13, 2026. Compared with the September 30 revision it replaces, two cases were added, none were removed and two cases had unset cells filled in. Every other case is unchanged apart from its provenance, which now names the new snapshot. JMA also reordered some rows, so the CSV record number in the provenance of 123 cases moved by more than the two rows the added cases account for. The browser sorts by year and case ID, so the order a visitor sees does not depend on the CSV row.

## The two revisions

| | Earlier | Current |
| --- | --- | --- |
| Snapshot | `jma:20260930T061003Z` | `jma:20261013T105201Z` |
| `Last-Modified` | `Wed, 30 Sep 2026 06:10:03 GMT` | `Tue, 13 Oct 2026 10:52:01 GMT` |
| Retrieved | 2026-10-02 19:59:47 UTC | 2026-11-13 21:44:27 UTC |
| CSV SHA-256 | `ca3e1cf01331aff9489e3635677ef158d567f360068a44b270f9272083444469` | `ff4a38c9a10daca12654664721bd44cea1099aae8230754f65c1f6bacdb3e4d2` |
| Source cases | 2,912 | 2,914 |
| Classification code 1 | 1,576 | 1,577 |
| Classification code 6 | 878 | 879 |

Both come from the same mutable address, [`ichiran.csv`](https://www.data.jma.go.jp/stats/data/bosai/tornado/data/ichiran.csv). As the [adapter notes](../docs/jma-adapter.md#revision-and-publication-limits) explain, the `Last-Modified` header orders revisions as observed and the hash identifies the exact bytes. JMA does not sign either one as a release.

The current CSV was retrieved once with `python -m atlas import-jma --refresh` into a separate data directory. That response was 1,110,317 bytes. It imported 2,914 cases with no refusal. `python -m atlas publish-jma --output web/jma-cases` then wrote the browser files from it and `tools/check_jma_cases.py` accepted them. The counts in the other classes are unchanged: code 2 has 120, code 3 has 11, code 4 has 37, code 5 has 83, code 7 has 109, code 8 has 95 and code 9 has 3.

## Added cases

| Case | Place as reported | Classification | Rating |
| --- | --- | --- | --- |
| `2026082601` | 福岡県 福岡市 | code 6, 不明 | JEF0 |
| `2026091401` | 八重山地方 （海上） | code 1, 竜巻 | unknown (`-8888`) |

## Changed cases

Both cases existed in the September 30 revision with the unset value `-9999` in most of their measured cells. In the October 13 revision those cells carry reported values, apart from four cells of `2026073001` that are now reported as unknown (`-8888`). No reported value was replaced by a different reported value.

`2026073001`, 福島県 須賀川市, code 1, JEF1:

1. Damage length minimum and maximum reported as 21, which is 2,100 m in the adapter's units of 100 m. Width minimum and maximum reported as 160 m.
2. Begin and end latitude and longitude reported in degrees, minutes and seconds with an uncertainty of 1 arcsecond each.
3. The end date reported as 2026, 7, 30, with the end hour, end minute and both minute uncertainties reported as unknown (`-8888`).
4. Impact counts reported: 22 homes partly damaged (住家一部損壊) and 22 homes damaged in total, then among buildings other than homes (非住家) 1 destroyed and 7 partly damaged for 8 in total, and zero deaths and injuries. Every shared scope cell is reported as `0`.

`2026080802`, 長野県 長野市, code 6, JEF0:

1. Damage length minimum and maximum reported as 11, which is 1,100 m. Width minimum and maximum reported as 10 m.
2. Begin latitude and longitude reported in degrees, minutes and seconds, with an uncertainty of 8 arcseconds in latitude and 10 in longitude. The end point and the end time are still unset.
3. Impact counts reported: 1 home partly damaged and 1 in total, zero buildings other than homes, and zero deaths and injuries. Every shared scope cell is reported as `0`.

The values above are what the adapter reads from the source cells. They are not checked against any other account of these storms, and the coordinates still carry no datum and no reconstructed track.

## What stays available

The browser index now points at the October 13 snapshot. The detail files of the September 30 snapshot stay in `web/jma-cases/details/`, because detail files are named by their content hash and the exporter never deletes one. The September 30 index stays in the repository history. A comparison file downloaded before this change still names its own snapshot and hash.

## Limits

The comparison covered the index records and processed detail objects of both snapshots, case by case. It did not compare the two raw CSV files row by row, because the September 30 CSV is not retained on the computer that made this record. A case that changed only in a raw cell the adapter does not carry into the processed detail would not show here. Counts remain counts of source cases. They are not unique physical storms or complete national coverage.
