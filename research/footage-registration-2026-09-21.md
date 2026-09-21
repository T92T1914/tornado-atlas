# Original footage on the El Reno clock

Research and source inspection began September 20, 2026, Central time.
Implementation and publication checks continued September 21.

## What has been registered

The source is Dan Robinson's original [full dashcam upload](https://www.youtube.com/watch?v=MxgU1QcFMJM),
on his verified channel. Its description identifies forward and rear dash
cameras during the Reuter Road escape. The creator describes the printed CDT
clock as GPS synchronized. That is an attributed claim. The original GPS log
has not been independently checked.

The following samples were inspected while paused, with the player position
and printed historical clock checked together in Chrome. The offsets identify
this upload only. The display rounds source position to minutes and seconds;
the manifest retains the observed fractional player positions.

| Video seconds | Printed CDT | Assigned UTC |
| ---: | --- | --- |
| 5 | 6:17:03 PM | 2013-05-31T23:17:03Z |
| 86.810056 | 6:18:23 PM | 2013-05-31T23:18:23Z |
| 260.430169 | 6:21:14 PM | 2013-05-31T23:21:14Z |
| 434.050283 | 6:24:04 PM | 2013-05-31T23:24:04Z |
| 607.670396 | 6:26:55 PM | 2013-05-31T23:26:55Z |
| 694.480453 | 6:27:47 PM | 2013-05-31T23:27:47Z |
| 781.290509 | 6:29:12 PM | 2013-05-31T23:29:12Z |

This is a description and seven sampled frames, not a continuous visual or
audio review. Initial in-app browser samples showed a mismatch between seek
state and advancing rendered video. They were discarded and the listed
positions checked in Chrome. A requested seek is not proof that the displayed
frame belongs to that position.

The sampled clocks do not justify one constant offset across the upload.
The viewer therefore exposes individual moments and leaves gaps unassigned.
The historical clock is preserved to the printed second, without claiming
subsecond historical accuracy. YouTube can seek to a nearby frame; the visible
clock remains available for the visitor to compare. Playing the video does not
advance the map through unreviewed footage.

## Geography, identity and rights

The opening sample contains a creator label for southbound S Choctaw near
Jensen. It is retained as a source label, not a surveyed coordinate. No camera
position or bearing is registered for this upload. The existing Tim Marshall
marker is a separate record and is not used to locate Robinson's footage.
No newly identified fatality location, vehicle identity or impact time is
claimed from these frames.

The original title retains an EF5 label. The exhibit continues to state the
final NWS EF3 damage rating and explains the difference between damage rating
and radar measurement.

The upload is copyright Dan Robinson. The site uses the original host player
and timestamped links. It does not redistribute the video, export its frames
as museum assets or republish its transcript. The player loads only when a
visitor requests it and can be removed with Close player.

## Availability and legacy alignment

The [El Reno Survey metadata](https://el-reno-survey.net/ted/ted-elreno-metadata.js)
and [viewer code](https://el-reno-survey.net/ted/ted-elreno.js) describe a global
start at 22:30 UTC with specially aligned Vimeo edits. Their offsets cannot
be reused on another upload.

* Tim Marshall's linked Vimeo player, `143033121`, displayed an unavailable-video
  message during direct inspection.
* Skip Talbot's linked Vimeo player, `142010192`, displayed the same message.
* Robinson's old event page and September 2013 FAQ now lead to a site closure
  notice. They must not be treated as currently readable full accounts.

These observations apply to those specific resources. They do not establish
that every legacy survey video is unavailable. Automated HTTP checks are
reported separately because a successful response can still be a closure or
error page.

## Why these reading additions

The [El Reno Survey collection guidance](https://el-reno-survey.net/data-collection-recommendations/)
emphasizes accurate clocks, continuous recording, GPS, landmarks and camera
geometry. Those requirements inform the six reading guides and contribution
checklist. The [original project announcement](https://stormtrack.org/threads/the-el-reno-survey-unveils-the-tornado-environment-display.28821/)
also provides a specialist precedent for placing separate records together.

A [r/tornado discussion asking for synchronized views](https://www.reddit.com/r/tornado/comments/1cmk0hx/any_videos_of_synced_tornado_footage/)
is a useful audience lead. It is an anecdotal request, not a representative
visitor study. The exhibit search addresses the practical problem of finding
specific details in a growing long page. Neither addition has yet undergone
visitor testing.

## What remains

Register complete uninterrupted passages only after inspecting cuts and clock
behavior throughout them. Match each camera to independently supported road
positions and bearings before drawing its viewing direction. Additional
original uploads need their own version and timing checks. A transcript alone
cannot do any of those jobs. The existing camera metadata, radar timestamps,
warning issue times and new video samples retain separate coverage limits.

## Verification

Local checks passed: 109 Python tests, 75 JavaScript tests, exhibit integrity,
catalogue integrity and browser module syntax. Browser inspection covered the
original embed at two checked moments, link restoration, hiding the view across
an unregistered second, removal of the iframe on close, report search, both
Clair and Obscur, and a 390-pixel phone viewport. Rendered internal links had
no missing targets or duplicate IDs. This is browser QA, not a visitor study
or an independent validation of the creator's GPS claim.

The remembrance update identifies Richard Charles Henderson explicitly and
links all unresolved victim location accounts from both maps. A separate
completeness check requires all eight names to have exactly one location status.
It protects against omission and duplication; it does not independently prove
the underlying historical sources. The precise Henderson incident location
remains unresolved.
