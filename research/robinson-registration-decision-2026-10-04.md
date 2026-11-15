# Robinson: a bounded camera and clock decision

The question is whether the first two retained clock samples from [Dan Robinson's original YouTube upload](https://www.youtube.com/watch?v=MxgU1QcFMJM) can support one continuous historical appearance interval. The selected presentation interval is 5 to 86.810056 seconds. The labels on its paused frames are 6:17:03 p.m. and 6:18:23 p.m. CDT, corresponding to May 31, 2013 at 23:17:03Z and 23:18:23Z. The repository already preserves these two anchors among seven checked moments. This decision does not claim a new review of the interval between them at normal speed.

## Evidence actually available

The earlier [footage registration record](footage-registration-2026-09-21.md) inspected paused frames and the creator's description. The description reports a clock synchronized to GPS. That is a creator claim, not an independent check of the original GPS or camera clock. The first source label places the car southbound on South Choctaw near Jensen. A road label and a visible timestamp do not supply a complete camera pose.

The [El Reno Survey Project metadata](https://el-reno-survey.net/ted/ted-elreno-metadata.js) does contain a Robinson track. One bounded read of the original source on October 4, 2026 UTC returned 147,803 bytes, SHA-256 `529691b0c0639e912864b55b2b305a85a15a645d204f8e926b99ab635ecfd0b2`. This matches the source identity retained for the earlier Marshall camera work. The selected `chaserMetaData.Robinson` literal was read as data, never executed. It has 43 ordered samples and attaches Vimeo video ID `145291664`.

Three source rows are relevant to the selected clock span:

| Metadata UTC | Reported latitude | Reported longitude | Reported camera azimuth |
| --- | --- | --- | --- |
| 2013-05-31T23:17:00Z | 35.4899583 | -97.954885 | 180° |
| 2013-05-31T23:17:53Z | 35.47895 | -97.954885 | 90° |
| 2013-05-31T23:18:11Z | 35.4789517 | -97.9517683 | 90° |

These are samples the source reports, not new measurements at the frame level. The numerical digits are preserved as published and are not an accuracy estimate. The metadata reports a change from a southward to an eastward view within this clock span. It supplies no continuous pose between samples, camera pitch or roll, lens calibration or numerical position and bearing uncertainty. Its data are useful camera context. They have not been assigned to the selected YouTube frames in the historical player.

## Why this interval is still unregistered

The metadata attaches a Vimeo source, while the selected clock samples identify a YouTube upload. Different provider identifiers do not establish whether their content or editing differs. The selected source read did not establish their correspondence, a shared presentation offset, the preservation of every intervening frame or the absence of cuts. A global offset from another edited compilation cannot be transferred by title or photographer name. The seek span of 81.810056 seconds and the difference of 80 seconds between printed clock labels are not a measured clock error. The retained samples are paused seek positions whose visible labels show whole seconds, not a continuous audit of frame timing.

The available samples from a moving camera also do not calibrate an image. No matched landmark set, camera intrinsics, correction for lens distortion, horizon solution or bearing and scale for each frame has been established for this interval. The [Survey Project's collection guidance](https://el-reno-survey.net/data-collection-recommendations/) explains why continuous recording, accurate time, GPS logging, known viewing direction, manageable field of view and visible ground landmarks matter. That methodology is not evidence that every required input exists for this particular edit.

The geographic replay retains its NWS damage outline and center positions. These provide geographic context, with their existing interpolation and precision qualifications. They cannot determine visible funnel shape, condensation, wind field or camera calibration. The separate procedural form study does not fill these missing inputs.

For the selected interval, the result is insufficient evidence for continuous historical appearance registration. Its sparse source camera samples are exhibit context only until they are bound to a verified edit and calibrated view. This does not mean the camera records are absent or that future registration is impossible.

## The next decisive step

The smallest useful next step is a bounded visual inspection of the original YouTube interval from 5 to 86.810056 seconds at normal speed, tied to its exact edit identity and a verified relationship to the Survey Project's Vimeo source. This is unfinished engineering evidence work, not an assumed request for new user authorization. The supported check of the text page returned a title and footer without footage. It did not establish that the video is currently available to play. No continuous inspection of the source video was executed. That inspection must record cuts, direction changes, visible time and usable landmarks. Original evidence of GPS and camera calibration would then determine whether even a shorter view can be constrained. Those original inputs remain external source prerequisites. Position and time assumptions should be recorded separately from observed frame content, with a stated uncertainty budget.

This step does not require another general literature review, a new player or invented coordinates. The source remains owned by its creator. Atlas provides official source links and its existing player, which loads after a click, without hosting new video, paused frames or a transcript. No whole copyrighted recording was downloaded, creator contacted or access restriction bypassed. Historical appearance and synthetic form intervals remain unchanged.

## Research to decision record

- **Current implementation:** base revision `418708449fd92694fd2f65b85d90e325d7fa7e5b`. The inspected inputs were the retained seven footage anchors, the existing Marshall camera manifest and parser, the El Reno plans for the event package and reconstruction, and the earlier research on footage and camera playback. The shared player and synthetic appearance windows already exist. Their implementation is not a missing registration input to rebuild.
- **Obtained evidence:** two retained anchors from paused frames and the read of the original Survey Project metadata, with the exact source hash, selected literal, count of 43 rows, three contextual positions/directions and attached Vimeo identifier recorded above. The metadata request had a timeout of eight seconds and a 1 MiB response ceiling, with no retry or script execution. It returned 147,803 bytes. A supported check of the YouTube text page supplied no footage. Neither a review of the interval at normal speed nor a camera calibration was executed.
- **Decision:** retain the sparse source camera context and existing discrete anchors, defer continuous historical appearance registration, and continue the separately sourced documentary increment. The result is insufficient registration evidence, with useful contextual evidence preserved.
- **Next inputs and budget:** the exact source interval and edit correspondence, continuous visual inspection, landmark matches, original GPS/time evidence, camera orientation and lens calibration, reuse basis and stated uncertainties. The first viewing should remain bounded to the selected presentation span of 81.810056 seconds, one muted official player and a total session ceiling of 130 seconds. No acquisition of the whole video, concurrent player, repeated probe of an unavailable source or new renderer is needed for that check.
- **What would change the decision:** verified source correspondence, timing continuity and a calibrated view with inspectable landmarks and uncertainties could support a constrained interval. Demonstrated timing disagreement, missing calibration or unresolved edit discontinuities would reject a continuous registration. A shorter stable view might support a narrower observation while the turn and other intervals remain unknown. Sparse samples alone support none of those upgrades.
- **Visitor and acceptance effect:** the exhibit now links a specific camera and clock decision rather than implying that camera records are absent. No new camera overlay, appearance reconstruction, wind estimate or synchronized footage interval is claimed. The new Joplin source photograph and account can be accepted independently of that uncompleted work on historical registration.
