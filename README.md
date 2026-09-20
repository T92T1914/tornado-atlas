# Tornado Atlas

An interactive museum of historical tornadoes, built around source records, documented paths, footage and the questions those records leave open.

I have always been interested in tornadoes. I wanted a place where I could look up a storm, follow where it went, see the evidence behind its history, and eventually explore a reconstruction of what it looked like. This project is how I am starting to build that.

The atlas starts with 3,350 NOAA source records from three US pilot years. The first detailed exhibit is **El Reno, Oklahoma, on May 31, 2013**, with an interactive geographic timeline, the published NWS outline and center path, nine damage survey photographs, and a footage notebook. A separate interactive 3D form study starts the visual work. The longer term goal is worldwide coverage with detailed exhibits that grow one storm at a time.

## Try the museum

Python 3.11 or newer. No additional packages, API keys or map service accounts are needed for the included preview.

From the repository directory:

```powershell
py -3.11 -m http.server 8768 --bind 127.0.0.1 --directory web
```

Open **http://127.0.0.1:8768/atlas.html** for the catalogue, **http://127.0.0.1:8768/index.html#damage** for the El Reno survey gallery, or **http://127.0.0.1:8768/study.html** for the form study. On macOS or Linux, replace `py -3.11` with `python3`. All three pages run offline after checkout. Source links open external websites. The animated view needs WebGL 2; the historical pages do not.

Filter the atlas by year, reported rating, state or exhibit availability. Search for a locality, source ID or a reviewed name such as Joplin. Select a map point or list entry to inspect the original account and source revision. Each selection has a direct link that can be bookmarked. The map uses Natural Earth geography without a map service account.

Use the timeline slider, previous and next buttons, or playback to step through 39 published positions. Search the research collection for a storm or creator. The shaded outline covers the entire event, so moving the marker does not turn it into a changing funnel model.

Compare two survey photographs, enlarge either one, or filter the collection by subject and the rating in the original NWS caption. The files are unchanged government survey photographs. Locations remain descriptive because exact camera positions and capture times have not been established.

In the form study, choose a cone, wedge or rope, drag to orbit, change the visible funnel extent, and start or pause the motion. This is procedural artwork in three dimensions, with no historical date, physical scale, wind estimate or damage prediction. It is a working visual prototype, not yet a reconstruction of El Reno.

## What is implemented

| Part | What you can inspect |
| --- | --- |
| Searchable atlas | World outline, 3,350 US source records, combined filters, paginated results and linked source details |
| El Reno exhibit | Geographic timeline, five timestamped footage notes, source links and unresolved evidence questions |
| Damage survey gallery | Nine original NOAA/NWS photographs, independent comparison views, enlargement, caption ratings and descriptive locations |
| Interactive form study | Native WebGL 2 particle rendering, three forms, camera orbit, visibility controls and motion that begins paused |
| Source catalogue | NOAA NCEI imports, SQLite search, original records, source revisions and SHA-256 checks |
| Browser publication | A static search index and 16 content-addressed detail files, loaded as needed without a database server |
| Geographic adapter | A bounded NWS KMZ to GeoJSON conversion that preserves coordinate order and sorts time labels |
| Video research collection | Pecos Hank, TornadoTRX and Swegle Studios, with ten initial leads grouped by event |
| Verification | 46 Python tests, 14 JavaScript tests, offline bundle and photograph checks, and a GitHub Actions workflow |

This is an early working project. International imports, complete documentary exhibits, historically registered 3D storm reconstructions and experimental building damage models are still ahead. The world outline is a navigation layer; only the stated US years are populated. The video collection records exactly what has been inspected; adding a video does not mean it has been watched or verified in full.

## Explore the data pipeline

```powershell
py -3.11 -X utf8 -m atlas import-ncei --years 1950 2011 2013
py -3.11 -X utf8 -m atlas stats
py -3.11 -X utf8 -m atlas search 'Joplin' --year 2011
py -3.11 -X utf8 -m atlas search 'El Reno' --year 2013
py -3.11 -X utf8 -m atlas search --rating F3 --year 1950
py -3.11 -X utf8 -m atlas export
py -3.11 -X utf8 -m atlas.publication
```

The first import requires a network connection. It discovers the latest publisher revision for each requested year. Raw downloads and the local database live in `data/`, which is excluded from Git. The CLI export goes into `outputs/`. `atlas.publication` builds the browser files in `web/catalogue/` and retrieves the Natural Earth map if it is not cached. Its index is published only after every referenced detail file exists. Old detail filenames remain valid across rebuilds.

The pilot import on September 20, 2026 produced 3,350 source records across those three years. A row can describe one county's segment of a longer tornado. That number is not a count of unique tornadoes, and the selected years do not imply continuous coverage.

Rebuild the exhibit from the preserved NWS source:

```powershell
py -3.11 -X utf8 -m atlas.exhibit
```

This reuses an integrity-checked local source or downloads it if absent. Add `--refresh` to retrieve the mutable source URL again. If the geometry structure changes, the adapter stops for review. The small exhibit JSON and GeoJSON are included in Git so visitors can run the preview without downloading the research archive.

The nine survey photographs are also included. `py -3.11 -m atlas.damage` verifies them and can restore a missing asset from the recorded source. Changed remote bytes or a corrupt existing asset stop the operation for review. It does not silently replace reviewed images.

## Why the evidence stays visible

A rating does not tell us the shape of a funnel. A damage outline does not show the storm's appearance at every instant. An edited video's clock does not necessarily match the time of the event.

The project therefore keeps raw source records separate from curated exhibits. Unknown values stay unknown. F, EF, IF and JEF ratings retain their original scale. Revised source files do not erase previous snapshots. The first exhibit preserves a disagreement between a narrative's ending time and tabulated records instead of selecting one without an explanation.

Future reconstructions will connect specific shots to camera positions and historical times. Observed features, interpretation and illustrative assumptions will remain identifiable. The source work is part of the exhibit.

## Verify it

```powershell
py -3.11 -m unittest discover -s tests -v
py -3.11 tools/check_exhibit.py
node --check web/app.js
node --check web/atlas.js
node --check web/study.js
node --check web/damage-view.mjs
node --test tests/atlas-model.test.mjs tests/vortex-model.test.mjs
py -3.11 tools/check_catalogue.py
```

Node 20 or newer is needed for the JavaScript checks, but not to serve the museum. Tests cover source corruption, revision replacement, transaction rollback, date and time handling, missing values, rating identity, map bounds, static publication consistency and observation coverage. Synthetic fixtures test the software. They do not validate every historical claim in the source databases.

## Project notes

* [Museum brief](docs/museum-brief.md)
* [Data contract](docs/data-contract.md)
* [Video evidence workflow](docs/video-evidence-workflow.md)
* [Visual form study](docs/visual-form-study.md)
* [Research claim ledger](research/claim-ledger.csv)
* [Roadmap](docs/roadmap.md)
* [Verification record](docs/verification.md)
* [Source attribution and third-party material](THIRD_PARTY.md)

Original software and documentation use the [MIT License](LICENSE). Source data and third-party material are handled separately in the attribution record. This is an independent historical project and is not an operational warning service.
