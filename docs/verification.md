# Verification record

Date: September 20, 2026.

## Executed locally

* Python 3.11 unit suite: 38 tests passed. Fifteen cover catalogue normalization and persistence; ten cover the geographic adapter; seven cover static publication; six cover footage notebook integrity.
* JavaScript model suite: eight tests passed for filters, aliases, scale identity, missing points, projection, map bounds and unrated display.
* Offline exhibit check: bundle matches its dossier, creator catalogue, video queue, footage notebook and GeoJSON. It contains 39 unique chronologically ordered positions, ten video leads, three creators and five footage notes.
* Offline catalogue check: all 3,350 index records resolve to the expected source revisions across 16 detail files. File content hashes, record coverage and coordinate ranges agree.
* JavaScript syntax checks passed for both browser entry points.
* Source conversion: downloaded NWS KMZ passed its SHA-256 integrity check and produced one polygon, one line and 39 points. Original coordinate sequences were preserved; KML ordering of 6:17 before 6:16 was corrected only in timeline display order.
* Browser: opened the served local exhibit in the Codex browser. Verified initial 6:04 position, next-position movement to 6:05, keyboard selection of the 6:42 endpoint, disabled next button at the end, playback restart from the beginning, and pause.
* Browser search: Blackwell returned the two corresponding creator leads. Browser error log was empty during these checks. Desktop appearance was visually inspected. Separate physical-device and cross-browser testing has not been performed.
* Atlas browser: Joplin search returned the two reviewed aliases while retaining their source titles and distinct segment ratings. El Reno selection displayed the published account and opened the exhibit. Year 1950 plus EF3 produced no matches; changing to F3 produced 33, with 20 on the first page and 13 on the second. Exhibit-only filtering produced one record. World view, zoom and arrow-key pan changed the map bounds as intended.
* Browser testing found and repaired a reset timing fault. The corrected reset explicitly clears controls before reapplying filters. Retest returned all 3,350 records and cleared the previous detail panel. Reloading a direct El Reno record URL restored its selected source record.
* Footage notebook: five cards, evidence labels, timestamped source links and unresolved registration details rendered successfully. No browser errors were reported during the inspected catalogue/exhibit flow.
* Local catalogue: pilot imports contain 3,350 source records across 1950, 2011 and 2013. This is partial coverage and does not establish a count of distinct tornadoes.

## Research coverage

The initial channel listings and selected descriptions were inspected. Pecos Hank's El Reno description and available captions from 0:02 through 8:19 were read. Two paused visual samples near 2:18.52 and 3:42.98 have approximate browser-clock readings in the notebook. These are individual stills, not continuous video inspection or measurements. A later seek entered an advertisement and was rejected as evidence. Audio has not been independently reviewed. No channel's entire archive has been watched, and no complete 3D reconstruction has been validated.

The 2014 El Reno Survey Project conference abstract was read as a methodological precedent. A related 2016 paper was available only through search-indexed excerpts; direct access returned 403. Neither that full paper nor the conference presentation has been reviewed.

## Not yet executed

The GitHub Actions workflow is prepared but has not run on GitHub. Publishing is pending account authentication and repository setup. The museum is a local preview, not a hosted public release.
