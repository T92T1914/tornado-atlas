# Two checked movie contexts near Nolte’s reported photo times

The existing El Reno photo sequence now links two separately inspected movie presentations to their nearby reported photo labels. The scene comparison is supported. The photograph’s exact exposure has not been identified in the movie.

## Original sources and inspected scope

Nick Nolte’s [July 15, 2013 account](https://nnwx.us/blog/2013/07/15/may-31-2013-the-el-reno-ef-5/) links the [timecoded movie jsBDFA6_81M](https://www.youtube.com/watch?v=jsBDFA6_81M). The account reports the first two stills at 23:10:37 and 23:10:59 UTC. Their image overlays contain only minute labels. The movie introduction describes a GPS-enabled Sony recording and a later overlapping GoPro recording synchronized by the creator. That account does not establish the camera of each still, clock error or calibration.

The selected original-host presentations decoded at 1920 by 1080. Saved browser presentations were inspected independently against the unchanged published stills. The screenshots remain private inspection evidence; the exhibit uses original external links. The Commons photograph’s separate license supplies no movie or source-still hosting permission.

| Photo reported UTC | Requested movie locator, seconds | Callback composition time, seconds | Paused playback time, seconds | Clock read from saved pixels | Outcome |
| --- | ---: | ---: | ---: | --- | --- |
|23:10:37|1241.223333|1241.24|1241.26|23:10:37.254|Compatible field, fence, poles, cloud scene and illuminated left region. Exact exposure unknown.|
|23:10:59|1263.223333|1263.228633|1263.203416|23:10:59, whole second only|Compatible field, fence, poles, horizon and broad cloud scene. A tooltip obscures some fractional digits.|

The first requested locator was frozen before the second lookup. The second position is 22 seconds later. Admission required the literal reported-second label and compatible foreground and scene context. This is an authored navigation rule. It is not a bound containing the photograph’s actual exposure or a measure of clock accuracy.

The first visible movie clock differs from the creator’s whole-second photo label by 0.254 seconds. The second exact numerical difference and lookup residual are unavailable because its fractional digits cannot be read reliably. Requested position, callback composition time and paused currentTime remain three separate values. None substitutes for the printed clock or identifies a camera exposure.

A reserved lookup 85 seconds after the first stopped during video preparation, before a qualified image or clock observation. It supplies no positive or negative historical comparison. No third or fourth comparison was added. Future exposure work must acknowledge that attempted lookup and its zero-image result.

## Consumer and publication boundary

The optional schema 4 source_comparison object belongs to the first two existing photo samples. The original reported labels, source and exposure IDs, timing uncertainty, camera fields, null physical shape/extent and partial forms are preserved. The existing clock selects a photo only at its exact reported instant. Appearance before, between and after the samples remains unknown.

The simulator presents both source labels, the visibility limit, the unknown-exposure statement and an original movie link near the operational locator. Exact timestamps and all three playback values remain in the native source disclosure. Coverage reading and the pinned dossier retain the same documentary relation. No source image, iframe or provider playback is started by selecting a photo.

The source comparison must join a published, reviewed-available documentary point in the same dossier. The join requires matching publication/version, photo ID and label, all comparison metadata, null parent/alignment/coordinates, source-label timing and links-only rights. The exhibit checks that join before writing a bundle.

## Reproducible checks

Use the repository’s existing commands:

~~~text
python -m unittest tests.test_source_photo_context tests.test_exhibit_appearance_source
node --test tests/source-photo-context.test.mjs tests/photo-observations.test.mjs tests/event-package-model.test.mjs
python tools/check_exhibit.py
python tools/check_archive.py
python tools/run_browser_checks.py chromium -- node --test --test-concurrency=1 tests/browser/replay-source-context.test.mjs
~~~

The local checks executed four Python cases, 150 Node cases and the exhibit/archive equivalence checks successfully. Four isolated Chromium 153 browser cases passed at 320 and 1280 pixels, covering both admitted points, disclosure focus, resize, fractional unknown gaps, pause, sample selection, Back/Forward and reload. The saved section captures were inspected at their original sizes. These are automated browser observations; physical phone use, screen-reader behavior and human visitor feedback remain unverified.

The complete disposable-root publication test hit the local owned job’s file-output bound while copying the site fixture. That run is retained as incomplete. Its rejection-before-write cases remain a required hosted CI gate. Exact-revision review, full CI and deployed acceptance are required before this candidate is treated as delivered.

## Remaining reconstruction question

The strict exposure correspondence remains open. The source processing and exact original-frame lineage needed to certify that relationship have not been established. Two scene-context observations do not recover a calibrated camera, physical tornado outline, volume, damaging-wind boundary or continuous appearance interval. The existing appearance windows remain empty.
