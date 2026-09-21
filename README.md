# Tornado Atlas

An interactive museum of historical tornadoes, built around source records, documented paths, footage and the questions those records leave open.

I have always been interested in tornadoes. I wanted a place where I could look up a storm, follow where it went, see the evidence behind its history, and eventually explore a reconstruction of what it looked like. This project is how I am starting to build that.

The long term goal is to animate individual tornadoes so you can watch them unfold
along their documented paths, with their changing appearance reconstructed where
photographs and footage support it. I am starting with the most infamous storms
and working outward. One shared playback system will support separate event
packages, so the collection can grow without rebuilding the application for
every tornado. The [reconstruction plan](docs/reconstruction-plan.md)
explains the approach and what still needs to be built.

The atlas contains 80,318 NOAA source records covering US years 1950 through 2025. The first detailed exhibit is **El Reno, Oklahoma, on May 31, 2013**, with an interactive geographic timeline, the published NWS outline and center path, 45 photographs linked to damage survey locations, a separate nine-photo comparison gallery, two credited storm photographs, a sourced remembrance section, and a footage notebook. A separate interactive 3D form study starts the visual work, and a wind laboratory explores an idealized rotating field, generic drag force, and a moving passage past a fixed probe. The longer term goal is worldwide coverage with detailed exhibits that grow one storm at a time.

[Explore the atlas](https://T92T1914.github.io/tornado-atlas/atlas.html) · [El Reno exhibit](https://T92T1914.github.io/tornado-atlas/) · [El Reno spatial replay](https://T92T1914.github.io/tornado-atlas/reconstruction.html) · [3D form study](https://T92T1914.github.io/tornado-atlas/study.html) · [Wind laboratory](https://T92T1914.github.io/tornado-atlas/wind.html)

The atlas entrance now brings the documentary, spatial replay and wind laboratory
together before the searchable collection. The spatial replay places El Reno's
39 published minute positions on a three-dimensional stage, with orbit controls,
a following camera, a shared clock and the available radar. The route comes from
the source record. The funnel is a drawing symbol, and the ground is flat.
It is a starting point for the historical reconstruction, not a claim to have
recreated the storm's changing appearance. The [implementation and review notes](research/spatial-replay-2026-09-21.md)
record the tested behavior and remaining gaps.

The El Reno page is both a historical account and a reference. Read it in order,
or use the contents list to jump to the path, photographs, damage, remembrance
or sources. The seven-entry chronology links directly to the published map
positions. Named sources explain what each contributes. The page opens
with a photograph of the actual tornado, and all storm and damage photographs
can be enlarged with their credits. The [documentary design notes](research/documentary-design-2026-09-20.md)
and [audience research notes](research/audience-notes-2026-09-20.md) explain the
choices and the limits of the research.

The path and survey maps now include optional modern USGS roads, towns and
terrain. The shared clock connects the tornado position with the latest
reviewed warning, available radar and published camera samples. Seven preserved
NWS products show how the forecast and warnings changed that day. A matched
MODIS comparison shows the landscape before and after the storm, and survey
photographs include explanations of the recorded damage and its limits.
The [dated research log](https://t92t1914.github.io/tornado-atlas/#corrections)
records additions, corrections and questions that remain open.

Seven checked moments from Dan Robinson's original dashcam upload now connect
to that clock. Select a moment to compare its visible time with the path,
available radar and latest reviewed warning. The original player loads on
request. Unchecked intervals remain unassigned, and no camera coordinates are
inferred from the timestamp. An exhibit search and six short reading guides
help readers find passages and understand timing, viewpoint and rating limits.
The [footage registration record](research/footage-registration-2026-09-21.md)
documents what was inspected.

## Run locally

Python 3.11 or newer. No additional packages, API keys or map service accounts are needed for the included preview.

From the repository directory:

```powershell
py -3.11 -m http.server 8768 --bind 127.0.0.1 --directory web
```

Open **http://127.0.0.1:8768/atlas.html** for the catalogue, **http://127.0.0.1:8768/index.html#survey-explorer** for the linked El Reno photographs, **http://127.0.0.1:8768/study.html** for the form study, or **http://127.0.0.1:8768/wind.html** for the wind experiment. On macOS or Linux, replace `py -3.11` with `python3`. The museum data, maps, preserved galleries and labs run offline after checkout. Optional USGS reference geography needs a network connection and can be hidden. The 45 linked DAT photographs need access to the original NWS service; failed images leave the assessment and source link usable. Source links open external websites. The 3D view needs WebGL 2; the historical pages and wind lab do not.

Filter the atlas by year, reported rating, state or exhibit availability. Search for a locality, source ID or a reviewed name such as Joplin. Select a map point or list entry to inspect the original account and source revision. Numbered groups open a smaller set of records; clear the selected group to return to the current filters. Each selected record has a direct link that can be bookmarked. The map uses Natural Earth geography without a map service account. Scroll to zoom around the pointer, drag to explore, or pinch on a touchscreen. The atlas, historical path and damage survey share these controls. Arrow keys pan a focused map; + and - zoom; Home resets it.

Use **Link to this search** to copy or bookmark the filters together with the
selected record. Reopening the link restores the search, and Back and Forward
move between selected records. Temporary map groups and zoom are not saved in
the link. [Try a filtered El Reno search](https://t92t1914.github.io/tornado-atlas/atlas.html?q=El+Reno&year=2013&rating=EF3&state=OKLAHOMA&exhibits=1#record=ncei%3A453682).

Use the shared second-level clock to scrub or play the path at 1×, 15×, 60× or 120×. Previous and next still select the 39 published minute positions; movement between them is explicitly labeled interpolation. Search the research collection for a storm or creator. The shaded outline covers the entire event, so moving the marker does not turn it into a changing funnel model.

Compare two survey photographs, enlarge either one, or filter the collection by subject and the rating in the original NWS caption. The files are unchanged government survey photographs. Locations remain descriptive because exact camera positions and capture times have not been established.

The damage map adds 336 NWS survey records within the published outline. It
starts with the 45 locations that have original DAT photographs. Select a dot,
thumbnail or observation to see the photograph alongside its recorded assessment.
Filter by rating or description, zoom around the selection, and use the observation
link to share the same filters and record. Turn off the photo filter to inspect
all 336 records. Each photograph is joined by its exact parent object and global
ID. Blank event identifiers still prevent a direct event join for the underlying
regional survey, so the map retains its geographic-selection caveat. No capture
times, camera positions or photographer names are invented.

All four pages offer Clair, Obscur and System appearances. Clair pairs warm
ivory with charcoal text. Obscur uses black, white and gray for the interface.
Fatality records have their own rose diamond and written death count. Forced-color support and text alternatives
remain available for map markers. Photographs and radar
colors are not recolored. Community entries link back to the relevant map or
gallery. The [design and research review](research/linked-evidence-design-2026-09-20.md)
explains the ArcGIS reference, the evidence model and the remaining work.

The history now includes eleven linked sections on the storm environment,
circulation, damage, human consequences, reconstruction and community evidence.
The first documented remembrance location is the approximate TWISTEX vehicle
recovery point from the published research account. It can be opened from the
path map and remains fixed as the timeline moves. It is not labeled as an exact
place of death. The [location and reading notes](research/noir-remembrance-2026-09-20.md)
explain the source disagreement and why the other locations remain unknown.
The [fatality record contract](docs/fatality-records.md) defines the reusable
source and display requirements. The [enthusiast research notes](research/enthusiast-priorities-2026-09-20.md)
set priorities for roads, synchronized evidence, before and after views, and
a dated corrections log.

Five other victims have separate location research accounts, without guessed
coordinates. Chaser footage and community discussions can supply leads, but
vehicle identification, camera clocks and landmarks need to agree before a
location is added. A last sighting, an impact and a recovery are separate
observations. The [documentary evidence notes](research/documentary-evidence-2026-09-20.md)
record what was inspected and what still needs original footage review.

Fatality cards also show nearby survey photographs, with their original record
links and a clear distinction between spatial proximity and an identified
vehicle. Henderson's location account includes the conflicting road claims and
the correction within the original forum discussion. The
[September 21 location review](research/fatality-locations-2026-09-21.md)
explains why that evidence still does not support a precise pin.

In the form study, choose a cone, wedge or rope, drag to orbit, change the visible funnel extent, and start or pause the motion. This is procedural artwork in three dimensions, with no historical date, physical scale, wind estimate or damage prediction. It is a working visual prototype, not yet a reconstruction of El Reno.

## What is implemented

| Part | What you can inspect |
| --- | --- |
| Searchable atlas | World outline, 80,318 US source records, combined filters, grouped map markers, paginated results and linked source details |
| El Reno exhibit | Seven path chapters, 39 timed positions, two credited storm photographs, five footage notes and unresolved evidence questions |
| Recorded camera samples | Tim Marshall's published locations and directions, 17 samples inside the playback window, explicit sample ages and gaps |
| History and remembrance | Eleven historical sections, sources for eight names, one approximate vehicle recovery location and five unresolved location accounts |
| Forecast and evidence clock | Seven original NWS bulletins, issue and observation times, optional archived warning polygons, radar and camera sample availability |
| Reference geography | Optional modern USGS roads, place names and terrain beneath historical path and survey overlays |
| Before and after | Original MODIS frames from May 14 and June 2, 2013, a comparison slider, credits and resolution limits |
| Research log | Dated findings, a source contribution form and a preserved link access audit |
| Damage survey gallery | Nine original NOAA/NWS photographs, independent comparison views, enlargement, caption ratings and descriptive locations |
| Survey location explorer | 336 preserved DAT records, 45 original linked photographs, combined filters, zoom, image enlargement and shareable observations |
| Interactive form study | Native WebGL 2 particle rendering, three forms, camera orbit, visibility controls and motion that begins paused |
| Wind and force laboratory | Adjustable Rankine vortex, passive tracers, a movable probe, time-series passage experiment and generic drag calculations |
| Source catalogue | NOAA NCEI imports, SQLite search, original records, source revisions and SHA-256 checks |
| Browser publication | A compressed static search index and 256 content-addressed detail files, loaded as needed without a database server |
| Geographic adapter | A bounded NWS KMZ to GeoJSON conversion that preserves coordinate order and sorts time labels |
| Video research collection | Pecos Hank, TornadoTRX and Swegle Studios, with ten initial leads grouped by event |
| Community discussions | Three sourced El Reno arguments and overlooked details, with separate evidence checks and open questions |
| Verification | 98 Python tests, 71 JavaScript tests, offline bundle and photograph checks, and a GitHub Actions workflow |

This is an early working project. International imports, complete documentary exhibits, historically registered 3D storm reconstructions and structural damage models are still ahead. The world outline is a navigation layer; only US source coverage is populated. The video collection records exactly what has been inspected; adding a video does not mean it has been watched or verified in full.

## Follow the timeline and try the models

El Reno now has an image panel controlled by the same clock as its path. Twelve
reviewed frames from the published NWS radar animation cover all 39 map
positions, using the latest preceding frame within four minutes. The actual
frame age and the filename-clock interpretation stay visible. The two storm
photographs can be viewed beside the timeline, but remain explicitly untimed.

An arrow marker follows Tim Marshall's published camera samples. Selecting
6:09:38 PM, for example, shows that recorded camera location and moves the
interpolated tornado marker to the same time. Camera samples are held at their
recorded locations for at most 90 seconds, with their age displayed. The marker
then disappears. The arrow shows the reported azimuth, not a measured viewing
cone. The [camera and playback notes](research/camera-playback-2026-09-20.md)
explain the source, gaps and display assumptions.

The [form study](https://t92t1914.github.io/tornado-atlas/study.html) can play and
scrub an authored sequence of changing shapes. The
[wind lab](https://t92t1914.github.io/tornado-atlas/wind.html#component-title)
now has a generic component experiment: choose a load capacity and inspect the
first sampled exceedance, persistent failure state, and rewind behavior. These
are model foundations. They do not reconstruct El Reno's visible evolution or
predict a specific building's damage.

The [source and model notes](research/timeline-and-simulation-2026-09-20.md)
record what was inspected, the unavailable synchronized-video leads, the
assumptions, and what remains before a historical reconstruction.

The [community section](https://t92t1914.github.io/tornado-atlas/#community)
follows selected forum claims back to primary records. It separates supported
details, disputed interpretations and unresolved leads from the main history.
Readers can inspect each source and see what was actually reviewed.

## Explore the data pipeline

```powershell
py -3.11 -X utf8 -m atlas import-ncei --year-range 1950 2025
py -3.11 -X utf8 -m atlas stats
py -3.11 -X utf8 -m atlas search 'Joplin' --year 2011
py -3.11 -X utf8 -m atlas search 'El Reno' --year 2013
py -3.11 -X utf8 -m atlas search --rating F3 --year 1950
py -3.11 -X utf8 -m atlas export
py -3.11 -X utf8 -m atlas.publication
```

The first import requires a network connection. It discovers the latest publisher revision for each requested year. Raw downloads and the local database live in `data/`, which is excluded from Git. The CLI export goes into `outputs/`. `atlas.publication` builds the browser files in `web/catalogue/` and retrieves the Natural Earth map if it is not cached. Its index is published only after every referenced detail file exists. Old detail filenames remain valid across rebuilds.

The September 20, 2026 import includes all 76 annual source files from 1950 through 2025, totaling 80,318 source records. Of those, 79,142 have a usable reported start or end coordinate; 1,176 remain searchable without a map point. A row can describe one county's segment of a longer tornado. This is not a count of unique tornadoes or a guarantee that every historical event was recorded. Reporting practices and source completeness vary over time.

Browsers with native gzip decompression load a 3.5 MB compressed index. A readable JSON fallback is included. Spatial grouping bounds the SVG marker count while preserving individual records in the result list. Detail responses use 256 smaller buckets; old content-addressed filenames remain valid across rebuilds.

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
node --check web/wind.js
node --check web/passage.js
node --check web/damage-view.mjs
node --check web/photo-view.mjs
node --check web/reader-view.mjs
node --check web/timeline-media.mjs
node --check web/community-view.mjs
node --check web/places-view.mjs
node --check web/map-navigation.mjs
node --check web/impact-view.mjs
node --check web/fatality-view.mjs
node --check web/survey-photos.mjs
node --check web/documentary-view.mjs
node --check web/geography-view.mjs
node --check web/damage-explanation.mjs
node --test tests/atlas-model.test.mjs tests/vortex-model.test.mjs tests/wind-model.test.mjs tests/timeline-media.test.mjs tests/component-model.test.mjs tests/evolution-model.test.mjs tests/survey-model.test.mjs tests/playback-model.test.mjs tests/map-navigation.test.mjs tests/impact-model.test.mjs tests/documentary-model.test.mjs
py -3.11 tools/check_catalogue.py
```

Node 20 or newer is needed for the JavaScript checks, but not to serve the museum. Tests cover source corruption, revision replacement, transaction rollback, date and time handling, missing values, rating identity, map bounds, static publication consistency and observation coverage. Synthetic fixtures test the software. They do not validate every historical claim in the source databases.

Optional network audit: install `requests`, then run
`py -3.11 tools/audit_exhibit_links.py`. The report separates reachable links,
missing pages and unresolved access. `--new-only` keeps the original check date
on unchanged URLs and checks additions. HTTP access does not establish that a
source supports a particular claim. The audit covers the curated exhibit and
fixed page links, not all 80,318 catalogue records.

## Project notes

* [Museum brief](docs/museum-brief.md)
* [Documentary and reference design](research/documentary-design-2026-09-20.md)
* [Timeline evidence and simulation methods](research/timeline-and-simulation-2026-09-20.md)
* [Community discussion methods](research/community-discussions-2026-09-20.md)
* [Individual tornado reconstruction plan](docs/reconstruction-plan.md)
* [Data contract](docs/data-contract.md)
* [Video evidence workflow](docs/video-evidence-workflow.md)
* [Visual form study](docs/visual-form-study.md)
* [Wind and force laboratory](docs/wind-laboratory.md)
* [El Reno history and remembrance](docs/el-reno-history.md)
* [Research claim ledger](research/claim-ledger.csv)
* [Roadmap](docs/roadmap.md)
* [Verification record](docs/verification.md)
* [Source attribution and third-party material](THIRD_PARTY.md)

Original software and documentation use the [MIT License](LICENSE). Source data and third-party material are handled separately in the attribution record. This is an independent historical project and is not an operational warning service.
