# Verification record

Date: September 20, 2026.

## Executed locally

* Python 3.11 unit suite: 25 tests passed. Fifteen cover catalogue normalization and persistence; ten cover the geographic adapter.
* Offline exhibit check: bundle matches its dossier, creator catalogue, video queue and GeoJSON. It contains 39 unique chronologically ordered positions, ten video leads and three creators.
* JavaScript syntax: `node --check web/app.js` passed.
* Source conversion: downloaded NWS KMZ passed its SHA-256 integrity check and produced one polygon, one line and 39 points. Original coordinate sequences were preserved; KML ordering of 6:17 before 6:16 was corrected only in timeline display order.
* Browser: opened the served local exhibit in the Codex browser. Verified initial 6:04 position, next-position movement to 6:05, keyboard selection of the 6:42 endpoint, disabled next button at the end, playback restart from the beginning, and pause.
* Browser search: Blackwell returned the two corresponding creator leads. Browser error log was empty during these checks. Desktop appearance was visually inspected. Separate physical-device and cross-browser testing has not been performed.
* Local catalogue: pilot imports contain 3,350 source records across 1950, 2011 and 2013. This is partial coverage and does not establish a count of distinct tornadoes.

## Research coverage

The initial channel listings and selected descriptions were inspected. Pecos Hank's El Reno video received a partial caption review and exploratory still sampling. The stills were not registered tightly enough to support measurement. No channel's entire archive has been watched, and no complete 3D reconstruction has been validated.

## Not yet executed

The GitHub Actions workflow is prepared but has not run on GitHub. Publishing is pending account authentication and repository setup. The museum is a local preview, not a hosted public release.
