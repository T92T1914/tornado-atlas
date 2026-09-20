# Tornado Atlas

An interactive museum of historical tornadoes, built around source records, documented paths, footage and the questions those records leave open.

I have always been interested in tornadoes. I wanted a place where I could look up a storm, follow where it went, see the evidence behind its history, and eventually explore a reconstruction of what it looked like. This project is how I am starting to build that.

The first exhibit is **El Reno, Oklahoma, on May 31, 2013**. It has an interactive geographic timeline, the published NWS outline and center path, and a searchable video research collection. The longer term goal is worldwide coverage with detailed exhibits that grow one storm at a time.

## Try the museum

Python 3.11 or newer. No additional packages, API keys or map service accounts are needed for the included preview.

From the repository directory:

```powershell
py -3.11 -m http.server 8768 --bind 127.0.0.1 --directory web
```

Open **http://127.0.0.1:8768**. On macOS or Linux, replace `py -3.11` with `python3`. The included exhibit runs offline after checkout. The source links open external websites.

Use the timeline slider, previous and next buttons, or playback to step through 39 published positions. Search the research collection for a storm or creator. The shaded outline covers the entire event, so moving the marker does not turn it into a changing funnel model.

## What is implemented

| Part | What you can inspect |
| --- | --- |
| El Reno exhibit | Geographic timeline, source links, unresolved end-time discrepancy, and explicit video review coverage |
| Source catalogue | NOAA NCEI imports, SQLite search, original records, source revisions and SHA-256 checks |
| Geographic adapter | A bounded NWS KMZ to GeoJSON conversion that preserves coordinate order and sorts time labels |
| Video research collection | Pecos Hank, TornadoTRX and Swegle Studios, with ten initial leads grouped by event |
| Verification | 25 unit tests, an offline exhibit consistency check, and a GitHub Actions workflow |

This is an early working project. A world map, normalized international imports, complete documentary exhibits, 3D storm reconstructions and experimental building damage models are still ahead. The video collection records exactly what has been inspected; adding a video does not mean it has been watched or verified in full.

## Explore the data pipeline

```powershell
py -3.11 -X utf8 -m atlas import-ncei --years 1950 2011 2013
py -3.11 -X utf8 -m atlas stats
py -3.11 -X utf8 -m atlas search 'Joplin' --year 2011
py -3.11 -X utf8 -m atlas search 'El Reno' --year 2013
py -3.11 -X utf8 -m atlas search --rating F3 --year 1950
py -3.11 -X utf8 -m atlas export
```

The first import requires a network connection. It discovers the latest publisher revision for each requested year. Raw downloads and the local database live in `data/`, which is excluded from Git. Exported catalogue JSON goes into `outputs/`.

The pilot import on September 20, 2026 produced 3,350 source records across those three years. A row can describe one county's segment of a longer tornado. That number is not a count of unique tornadoes, and the selected years do not imply continuous coverage.

Rebuild the exhibit from the preserved NWS source:

```powershell
py -3.11 -X utf8 -m atlas.exhibit
```

This reuses an integrity-checked local source or downloads it if absent. Add `--refresh` to retrieve the mutable source URL again. If the geometry structure changes, the adapter stops for review. The small exhibit JSON and GeoJSON are included in Git so visitors can run the preview without downloading the research archive.

## Why the evidence stays visible

A rating does not tell us the shape of a funnel. A damage outline does not show the storm's appearance at every instant. An edited video's clock does not necessarily match the time of the event.

The project therefore keeps raw source records separate from curated exhibits. Unknown values stay unknown. F, EF, IF and JEF ratings retain their original scale. Revised source files do not erase previous snapshots. The first exhibit preserves a disagreement between a narrative's ending time and tabulated records instead of selecting one without an explanation.

Future reconstructions will connect specific shots to camera positions and historical times. Observed features, interpretation and illustrative assumptions will remain identifiable. The source work is part of the exhibit.

## Verify it

```powershell
py -3.11 -m unittest discover -s tests -v
py -3.11 tools/check_exhibit.py
node --check web/app.js
```

Node is only needed for the optional JavaScript syntax check. Tests cover source corruption, revision replacement, transaction rollback, old date formats, time offsets, missing values, rating identity, coordinate validation and geographic timeline ordering. Synthetic fixtures test the parsers. They do not validate every historical claim in the source databases.

## Project notes

* [Museum brief](docs/museum-brief.md)
* [Data contract](docs/data-contract.md)
* [Video evidence workflow](docs/video-evidence-workflow.md)
* [Research claim ledger](research/claim-ledger.csv)
* [Roadmap](docs/roadmap.md)
* [Verification record](docs/verification.md)
* [Source attribution and third-party material](THIRD_PARTY.md)

Original software and documentation use the [MIT License](LICENSE). Source data and third-party material are handled separately in the attribution record. This is an independent historical project and is not an operational warning service.
