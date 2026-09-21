# Verification record

Date: September 20, 2026.

## Initial pilot checks

* Python 3.11 unit suite: 46 tests passed. Fifteen cover catalogue normalization and persistence; ten cover the geographic adapter; seven cover static publication; six cover footage notebook integrity; eight cover photograph integrity and restoration.
* JavaScript model suite: 14 tests passed. Eight cover filters, aliases, scale identity, missing points, projection, map bounds and unrated display. Six cover repeatable particle layouts, allocation limits, camera and geometry validity, and animation timing.
* Offline exhibit check: bundle matches its dossier, creator catalogue, video queue, footage notebook, damage gallery and GeoJSON. It contains 39 unique chronologically ordered positions, ten video leads, three creators, five footage notes and nine original survey photographs.
* Offline catalogue check: all 3,350 index records resolve to the expected source revisions across 16 detail files. File content hashes, record coverage and coordinate ranges agree.
* JavaScript syntax checks passed for the atlas, exhibit, damage view and form study entry points.
* Source conversion: downloaded NWS KMZ passed its SHA-256 integrity check and produced one polygon, one line and 39 points. Original coordinate sequences were preserved; KML ordering of 6:17 before 6:16 was corrected only in timeline display order.
* Browser: opened the served local exhibit in the Codex browser. Verified initial 6:04 position, next-position movement to 6:05, keyboard selection of the 6:42 endpoint, disabled next button at the end, playback restart from the beginning, and pause.
* Browser search: Blackwell returned the two corresponding creator leads. Browser error log was empty during these checks. Desktop appearance was visually inspected. Separate physical-device and cross-browser testing has not been performed.
* Atlas browser: Joplin search returned the two reviewed aliases while retaining their source titles and distinct segment ratings. El Reno selection displayed the published account and opened the exhibit. Year 1950 plus EF3 produced no matches; changing to F3 produced 33, with 20 on the first page and 13 on the second. Exhibit-only filtering produced one record. World view, zoom and arrow-key pan changed the map bounds as intended.
* Browser testing found and repaired a reset timing fault. The corrected reset explicitly clears controls before reapplying filters. Retest returned all 3,350 records and cleared the previous detail panel. Reloading a direct El Reno record URL restored its selected source record.
* Footage notebook: five cards, evidence labels, timestamped source links and unresolved registration details rendered successfully. No browser errors were reported during the inspected catalogue/exhibit flow.
* Local catalogue: pilot imports contain 3,350 source records across 1950, 2011 and 2013. This is partial coverage and does not establish a count of distinct tornadoes.

## Survey gallery and visual study pass

* Nine original JPEGs were retrieved from the NWS event page, hashed and verified. Pillow 12.3 was used once to check decoding, dimensions and EXIF presence; it is not a runtime or test dependency. All nine had no EXIF tags. Six files are 1,280 by 960 and three are 960 by 1,280. Source page and use-policy snapshots were preserved in the local archive.
* Browser: the initial comparison displayed an EF3 house and an EF2 house with their separate source locations. Changing one comparison to the power-pole photo updated its image and description. The enlargement dialog opened with the original source link, and Escape closed it. A final keyboard check confirmed focus returned to the photograph button.
* Browser filters: EF2 returned two photographs. Adding Infrastructure returned an explicit empty result. Clearing the rating returned one infrastructure image, and clearing both returned nine. No errors or warnings appeared in the inspected flow.
* WebGL 2 rendered the form study successfully in the Codex browser. Cone, wedge and rope controls, explicit play and pause, the visibility slider, lighter detail, dust toggle, pointer orbit and arrow-key orbit were exercised. The visibility slider reached 35 percent and the keyboard orbit updated the view direction by five degrees.
* Browser inspection found an incorrect alpha accumulation in the first renderer. Separate color and alpha blending corrected the compositing. A subsequent screenshot was inspected. The renderer starts paused and the tested scroll-away flow paused motion after most of the scene left view.
* Neither the form study nor its software tests establish physical tornado behavior. No GPU timing benchmark, continuous long-duration render test, physical mobile-device test or cross-browser test has been performed. WebGL context loss and restoration handling exists but has not been exercised in browser testing.

## Research coverage

The initial channel listings and selected descriptions were inspected. Pecos Hank's El Reno description and available captions from 0:02 through 8:19 were read. Two paused visual samples near 2:18.52 and 3:42.98 have approximate browser-clock readings in the notebook. These are individual stills, not continuous video inspection or measurements. A later seek entered an advertisement and was rejected as evidence. Audio has not been independently reviewed. No channel's entire archive has been watched, and no complete 3D reconstruction has been validated.

The 2014 El Reno Survey Project conference abstract was read as a methodological precedent. A related 2016 paper was available only through search-indexed excerpts; direct access returned 403. Neither that full paper nor the conference presentation has been reviewed.

The NWS damage captions and government-personnel attribution were read and matched to the selected original files. The NWS use policy and wedge glossary were read. NSSL's explanation of visibility was available through a search-indexed excerpt; direct access failed. A NOAA repository record and abstract for Wakimoto and colleagues' 2016 aerial-damage/mobile-radar study were located, but its full PDF has not been reviewed or redistributed.

## Expanded collection and wind laboratory

Later on September 20, the catalogue was expanded to all 76 annual NOAA source files from 1950 through 2025. The earlier counts above describe the initial pilot.

* Current publication: 80,318 source records, 79,142 with usable reported coordinates and 1,176 without. These are not deduplicated tornadoes. The index references 256 current detail files, each checked against its content hash and source revision.
* The deterministic gzip index expands to exactly the readable JSON bytes. The compressed transfer is approximately 3.5 MB instead of 29.6 MB. The browser retains a readable JSON fallback.
* Python suite: 46 tests passed. JavaScript suite: 23 tests passed, including a 150,000-record map-grouping fixture, coverage gaps, and five analytic wind-model tests. The exhibit and catalogue integrity checks passed.
* Desktop browser: grouped selection returned 1,865 source records; pagination advanced to page 2 of 94. Clearing the group restored 80,318 results. Search for Blackwell in 1955 returned the reviewed Kay County record. Its detail retained the original F5 rating, 19.6-mile segment length, 20 direct deaths, 280 direct injuries and source clock label.
* Wind browser: the default probe displayed 100 mph, 1.22 kPa and 1.47 kN. At 200 mph with other inputs unchanged it displayed 5.88 kN. Play and pause controls worked. Reload restored the paused default state.
* Narrow viewport: the atlas and wind laboratory were inspected at a 390 by 844 override. Both had 375-pixel content widths after the scrollbar with no horizontal overflow. A text-encoding defect in the wind page was found, corrected and visually rechecked. Viewport overrides were reset after testing.
* No warnings or errors appeared in the inspected atlas and wind browser flows. This does not substitute for a physical mobile-device test or cross-browser coverage.

No historical tornado or structural failure model is validated by these software tests.

## First public deployment

The [GitHub Actions run for f32673c](https://github.com/T92T1914/tornado-atlas/actions/runs/35511588062) completed successfully on September 20, 2026. Both verification and Pages deployment jobs passed on GitHub's Ubuntu runner.

The hosted atlas loaded all 80,318 records. Filtering for an exhibit returned the El Reno source record, its separately fetched detail displayed correctly, and its exhibit link opened the geographic timeline and survey gallery. The hosted wind laboratory displayed 200 mph and 5.88 kN after changing the speed control; Reset restored the paused defaults. No browser errors or warnings appeared in this inspected hosted flow.

Repository metadata now includes the atlas link and seven relevant topics. Raw downloads and the SQLite archive remain local. Physical-device and cross-browser tests, international coverage and historically calibrated reconstructions remain future work.

## Historical account, remembrance and moving passage

The September 20 continuation adds seven sourced path chapters, eight publicly
reported names with per-person links, and two Daniel Rodriguez storm photographs
under CC BY 2.0. The original image bytes and dimensions were checked, and both
images were visually inspected. Their times and viewing directions remain
unregistered. The source-access record is in `docs/el-reno-history.md`.

* The Python suite passed 50 tests; the JavaScript suite passed 28 tests.
* The exhibit and all 80,318 published catalogue records passed integrity checks.
* Browser chapter selection moved the timeline to 6:24 PM and displayed the matching maximum-size account.
* The remembrance displayed eight names and the source-scoped counts of eight deaths and 26 injuries.
* The passage at closest approach displayed 100 mph and 1.47 kN with the default wind and drag settings. Changing travel from 30 to 60 mph reduced displayed time above 50 mph from about 39.4 to 19.7 seconds while preserving the 100 mph sampled peak.
* Playback advanced the timeline and returned to a paused control at its end.
* A 390 by 844 tab viewport showed 375-pixel content without horizontal overflow for the remembrance and passage. Both layouts were visually inspected; passage graph labels were enlarged at the narrow breakpoint. Temporary viewport overrides were cleared.
* No errors or warnings were reported in the inspected exhibit and passage browser flows.

These are local browser and software checks. They do not validate historical
wind measurements, structural failure, or physical mobile-device behavior.

## Photograph presentation and visitor questions

The next September 20 update brings a licensed storm photograph into the opening
view, adds a separate photograph section and four source-linked visitor answers,
and uses a single enlargement dialog with image-specific attribution. Remembrance
now has one shared dedication above the names. The original photograph files and
their hashes are unchanged.

* All 50 Python tests and 28 JavaScript tests passed. Script syntax, exhibit
  integrity and the 80,318-record catalogue check passed.
* The desktop opening view and a 390 by 844 opening view were visually inspected.
  The narrow layout had no horizontal overflow. The remembrance's narrow layout
  was checked through DOM dimensions and content; a readable full-size screenshot
  of that particular mobile section was not obtained.
* Both storm photographs enlarged with Daniel Rodriguez's credit and CC BY 2.0
  link. Opening an NWS damage photograph afterward cleared that license and used
  the NWS source and credit. Returning to the second storm photograph restored
  its own attribution.
* Escape closed the dialog and returned focus to its originating photograph
  button. The EF3 question expanded and displayed its two supporting links.
* A direct remembrance fragment initially landed above its target because the
  exhibit content loads asynchronously. The page now aligns the requested
  section after rendering. A reload with `#remembrance` landed approximately
  24 pixels below the viewport top after the gallery mounted.
* The desktop remembrance was visually inspected. The section contained eight
  names, exactly one `Rest in peace` dedication and none inside individual list
  entries. No browser warnings or errors appeared in the tested interactions.
* Temporary viewport overrides were cleared. No new physical-device or
  cross-browser validation was performed.

The [audience notes](../research/audience-notes-2026-09-20.md) distinguish direct
page inspection, indexed excerpts and limited video samples. They do not claim
complete documentary review or measured engagement improvements.

## Shareable catalogue searches

The next September 20 update preserves place, year, rating, state and exhibit
filters in the URL, together with the selected record. Existing record-only
bookmarks still work. Map groups remain temporary and the sharing label explains
when a link opens the full filtered search. The duplicated selected-group label
has also been removed.

* The JavaScript suite passed 34 tests, including six new search-link cases for
  combined filters, literal symbols, old bookmarks, unavailable values, explicit
  exhibit selection and separate F/EF ratings.
* All 50 Python tests, exhibit integrity and catalogue checks passed.
* In the local browser, an El Reno search restored all five filters, its one
  matching record and the selected source after reload. Back cleared selection
  without discarding filters; Forward restored the selected source. Reset
  returned all 80,318 records and removed the saved search from the URL.
* A link to year 2099 showed an unavailable option and zero matches. A selected
  El Reno record outside those filters remained readable with an explanation.
  An unknown record ID displayed an unavailable message while preserving the
  Joplin search and its 11 matches.
* Selecting a map group showed one group label and explained the full-search
  link. Clearing the group restored all results. Desktop and 390 by 844 layouts
  were visually inspected; the narrow page had no horizontal overflow.
* No warnings or errors appeared in these browser checks. The temporary viewport
  override was cleared. Physical-device and cross-browser testing were not done.

## Documentary reading and source directory

The next September 20 update adds an exhibit-only reading layout, a responsive
contents list, the complete seven-entry chronology and twelve named sources.
The map and written chronology share chapter data. Historical source files,
photograph bytes and the source-scoped remembrance remain unchanged.

* All 56 Python tests and 34 JavaScript tests passed. New cases check bibliography
  source identity, duplicate and unused URLs, unsafe URLs, and the introduction's
  citation. They verify consistency, not historical truth.
* Exhibit integrity, script syntax and all 80,318 published catalogue records
  passed their checks. Every chapter selects an existing map position.
* The desktop opening photograph, history, map and sources were visually checked.
  Contents links selected the intended section and the current marker followed
  the reader. Back to overview returned to the introduction.
* The 6:24 chronology link selected the maximum-size chapter and 6:24 map point.
  The formation link explicitly selected 6:04 while its account retained 6:03.
* A 390 by 844 tab viewport had 375 CSS pixels of content and a 320 by 844 viewport
  had 305, accounting for the scrollbar. Neither had page-wide horizontal
  overflow. Individual exhibit sections also stayed within their bounds at the
  smaller size. The source list and narrow map controls were visually inspected.
* The contents disclosure opened from the keyboard. The second storm photograph
  enlarged with its own attribution and license; Escape closed it and returned
  focus to the originating button. The narrow dialog did not widen the page.
* Changing a damage comparison view selected the steel power poles and its
  caption. Searching Blackwell returned two of ten video leads.
* No browser warnings or errors appeared in these interactions. Viewport
  overrides were cleared. These were local browser checks, not a physical-phone,
  cross-browser, screen-reader, slow-network or complete WCAG audit.

The [design research](../research/documentary-design-2026-09-20.md) records the
sources and distinguishes guidance from observed design and our own choices.
No reader-comprehension or engagement improvement has been measured yet.

## Timeline evidence and simulation update

* Python suite: 61 passing tests. JavaScript suite: 43 passing tests. New checks
  cover invalid clocks, source-label disagreement, duplicate or reordered frames,
  asset integrity, future-frame rejection, frame expiry, all 39 path positions,
  UTC-to-CDT display, reversible form interpolation, and persistent component
  failure after wind falls.
* The source-frame extraction tool reproduced all twelve PNG hashes from the
  preserved original GIF. The selected source labels were visually transcribed.
  The source clock interpretation is documented rather than claimed calibrated.
* The full static catalogue check passed for 80,318 records and 256 immutable
  detail files. The exhibit bundle and existing source photographs also passed.
* Local browser: both geographic and media sliders reached the same 6:42 PM
  position, displaying the preceding 6:40:51 frame and its 69-second age. Switching
  to a storm photograph and rewinding kept its time-unknown label. Enlargement
  opened the evidence dialog; Escape returned focus to its initiating control.
* Local WebGL: the sequence control produced the final narrow/bent form, disabled
  conflicting manual shape inputs, and completed playback at its endpoint.
* Local damage lab: the component remained failed at the end when current force
  was only 0.04 kN, rewound to its intact state, and had no exceedance when assumed
  capacity was raised to 20 kN. Its second scrubber updated the original passage
  slider to the same sample.
* Exhibit and component panels were visually inspected at 390-pixel viewport
  width and checked at 320. Neither widened the document beyond its viewport.
  Temporary viewport overrides were cleared. No browser warnings or errors were
  reported by the three pages during these checks.

These checks establish the implemented behavior, not historical camera
registration, structural validation, physical-device coverage or improved
visitor comprehension. See the [methods and source-access record](../research/timeline-and-simulation-2026-09-20.md).

## Curated community discussions

* Python suite: 67 passing tests after six discussion-integrity tests were added.
  The 43 JavaScript model tests remain unchanged and passed. The regenerated
  exhibit passes its source-file comparison and validation checks.
* The three entry labels and conclusions appeared in the local browser. Opening
  the house entry exposed the primary survey citation, the separate forum link,
  review coverage and remaining questions. Its permalink selected that entry.
* The open entry was visually inspected at 390 CSS pixels. Layout checks at 390
  and 320 reported no document-wide horizontal overflow. Enter toggled the
  evidence disclosure. Temporary viewport overrides were cleared; no browser
  warnings or errors appeared during these interactions.
* The main factual rating and width remain in the existing dossier. Community
  conclusions are separate structured records, with no writeback into it.

These are software and editorial coverage checks, not evidence that the
selection represents every community opinion. No new continuous review of
creator videos was performed for the discussion entries.
# September 20: survey location explorer

At this stage the suites passed 74 Python tests and 45 JavaScript tests. Seven Python
tests cover survey source preservation, incomplete responses, changed event
joins, duplicate IDs, coordinates, dates and polygon holes/boundaries. Two
browser-model tests cover combined filters and the projected point extent.
The regenerated exhibit and the 80,318-record catalogue pass their offline
integrity checks.

Local browser checks covered the 336-record view, all 12 EF3 records, Next,
keyboard selection of the last record, the two TSTM/Wind records and an empty
search followed by recovery. Empty results disable navigation. The detail card
updates the record ID, description, coordinates and source link. The page was
visually inspected at desktop and 390 CSS pixels; document-width checks at 390
and 320 found no horizontal overflow. Temporary device emulation was cleared.
No browser warnings or errors were recorded during these checks.

The [source and selection record](../research/damage-locations-2026-09-20.md)
states what the geographic match establishes. No impact times, photograph
matches, human casualty totals or structural-model calibration were derived.

# September 20: historical playback and camera samples

The suites now pass 82 Python tests and 55 JavaScript tests. Eight new Python
tests validate the numerical camera excerpt and its provenance; ten JavaScript
tests cover clock behavior, frame-rate independence, interpolation and camera
timing. The offline exhibit and 80,318-record catalogue checks also pass.

In the local browser, selecting 6:09:38 moved both sliders to 338 seconds,
showed the exact Marshall sample and labeled the tornado center interpolated.
Keyboard scrubbing advanced both clocks together. CDP DOM node IDs confirmed
that moving one second within a radar frame retained the existing image node.
Playback at 120× stopped at 6:42:00 with Next disabled. At 6:26 the camera
marker was hidden across the source gap. A 1× run advanced and paused normally;
camera toggling, switching to an untimed photo and photo enlargement worked.
No browser warnings or errors appeared in these checks.

The 390-pixel viewport had no horizontal overflow. Temporary emulation was
cleared. The camera layer has not been independently calibrated against footage,
and this update does not validate a historical appearance or damage model.
