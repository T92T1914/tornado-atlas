# Reading the retained NWRT observations

The radar source reader now exposes the twelve unchanged observations already
used by the El Reno timeline and replay. Previous, Next and the observation
selector identify the complete PNG, its original GIF index and its printed
filename. The [original source comparison](radar-source-comparison-2026-09-27.md)
retains the extraction and reuse evidence.

The source labels span 23:01:37 to 23:40:51 on May 31, 2013 under the existing
filename as UTC interpretation. Consecutive retained labels differ by 213, 214
or 223 seconds. These are gaps in the curated selection, not evidence of the
instrument's update interval. The twelve observations are not the complete GIF
with 242 frames.

Display playback starts only when requested. Explicit Play brings an offscreen
observation into view without animated scrolling and keeps keyboard focus on
the control. Stepping and timed updates do not initiate scrolling.
Each complete checked image stays
for at least one second before the next observation is requested. Network and
decode time can extend that dwell. There is no image interpolation or historical
clock progression. Manual selection pauses playback. The last observation,
departure, hidden page, offscreen image and a change to reduced motion stop the
sequence without automatic restart.

The reader uses the existing verified event package and bounded image check.
It shows the exact checked bytes through an owned Blob URL and verifies the
597 by 599 dimensions before committing the image and its label together.
Loading or a failed selection preserves the previous complete image when it
is still available. After departure has retired that image, a failed restore
explicitly reports that no image is displayed. The identified source record,
original link and recovery remain available. An obsolete request cannot commit
over a later selection.

The complete legend, colors, map extent and filename remain unchanged. Static
reading keeps the original frame 151 and source links without scripts. The
reader's controls and URL selection do not alter the replay's latest preceding
frame rule or its maximum age of 240 seconds. Native Back returns to the
existing replay entry and its clock.

The design follows the W3C guidance on
[reader control of moving information](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
and retains reduced motion behavior. This is implementation guidance, not an
accessibility certification. The reader supplies no exact beam footprint,
optical synchronization, camera calibration, surface wind or historical funnel
geometry. Nolte's existing correspondence criteria and unknown intervals are
unchanged.
