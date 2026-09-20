# Connecting a timeline to evidence

Reviewed September 20, 2026. This pass adds usable tools to El Reno and the two
labs. It does not finish a historical reconstruction or a structural simulator.

## The evidence that can move with the clock

The [NWS event page](https://www.weather.gov/oun/events-20130531) publishes an
[NWRT phased-array reflectivity animation](https://www.weather.gov/images/oun/wxevents/20130531/radar/NWRT_20130531_ElReno.gif).
The retrieved GIF contains 242 frames at 597 by 599 pixels. Twelve full frames
were exported without cropping or recoloring, preserving the printed filename
and reflectivity legend. Each selected label was visually read, not inferred
from the GIF playback duration. Frame indices 151 through 184, at intervals of
three, cover labels 23:01:37 through 23:40:51 on May 31.

The filename clock is interpreted as UTC, consistent with the event chronology.
The label does not explicitly print its time zone. This remains a stated clock
interpretation, not an independent time calibration. The page converts it to
America/Chicago daylight time and shows the exact difference from the selected
map position. It selects only a preceding frame within four minutes. That age
limit is a display choice, not a radar sampling claim or a weather threshold.
These regional radar echoes are not photographs of the funnel, a surface wind
map, or a registered overlay on our geographic view.

The original source hash is
`2c8ec05523dd1db897c38b67daae0f6770921135c6ddc2e34735bc40dfa93a7a`.
The manifest keeps the individual output hashes and the extraction script checks
them. Reuse follows the [NWS information policy](https://www.weather.gov/disclaimer).
The two existing Daniel Rodriguez photographs are also available alongside the
timeline, but remain explicitly untimed. Their source permissions and original
bytes remain unchanged. No historical photograph or GIF was generated.

## A useful lead that is currently unavailable

The [El Reno Survey](https://el-reno-survey.net/) describes correcting camera
times through lightning correspondence and establishing positions using GPS and
geographic references. Its [TED viewer](https://el-reno-survey.net/ted/) exposes
video IDs and timed camera positions. Static inspection of its published viewer
code confirms that video offsets are measured from 22:30:00 UTC. The code was
read as text, not executed locally.

The original viewer currently reports a missing Google Maps dependency in this
browser. Vimeo IDs 135989914 and 135931319 both displayed that the video was
unavailable when opened directly. This is evidence about these two sources on
this date, not every survey recording. No inaccessible video was claimed as
watched, embedded as a working feature, or replaced with invented footage.

Preserved public resource snapshots:

* [TED metadata](https://el-reno-survey.net/ted/ted-elreno-metadata.js):
  `529691b0c0639e912864b55b2b305a85a15a645d204f8e926b99ab635ecfd0b2`
* [TED viewer code](https://el-reno-survey.net/ted/ted-elreno.js):
  `34943c8902940e9e1c4d286a1627f5dbf29607f973d24faf60fea6b4e9c2f7bd`

This is a promising registration lead for a later pass if accessible originals
can be matched. Our current photographic notebook still has no historical time
or camera position assigned to its samples.

## The evolving form

The visual lab now blends four authored shape keys over 30 seconds. The
parameters are base radius, flare, bend and visible funnel extent, in normalized
scene units. The blend is a smoothstep interpolation between neighboring keys.
The same position always produces the same shape and particle phase, including
when scrubbing backward. No keys are attributed to El Reno. The sequence is an
example of how the renderer can accept evolving geometry, not a claim that
every tornado follows those stages. It does not solve fluid motion.

## The component experiment

The wind lab now evaluates a user-assumed load capacity alongside its existing
moving Rankine field. At each sampled time it computes
`F = 0.5 * density * speed^2 * area * drag_coefficient`. Failure occurs at the
first sample where `F > capacity`, and remains set for all later samples. Equality
does not trigger the rule. Rewinding reads the corresponding prior state, and
changing parameters builds a new hypothetical experiment.

[NASA's drag explanation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/)
supports the force relationship and the need to specify reference area and drag
coefficient. The capacity rule and its default of 1 kN are our explicit teaching
assumptions. There is no measured building type behind that default.

The [NIST TN 2242 publication abstract](https://www.nist.gov/publications/tornado-wind-speed-maps-building-design-research-and-development-tornado-risk)
describes probabilistic load and resistance modeling with 44 three-dimensional
residential models and broad wind-speed distributions. The abstract was read;
the full technical note was not reviewed in this pass. It gives context for how
much more a validated structural model requires, not validation of our rule.

The experiment omits pressure coupling, deformation, fatigue, changing exposed
area and debris impacts. It begins with an intact component at the first sample
and can miss between-sample peaks. The detached-panel drawing is a state symbol,
not a calculated debris trajectory. No EF category or structural safety outcome
is inferred from it.

## What remains before the first historical reconstruction

1. Establish accessible, reusable ground views with calibrated clocks and camera
   positions, including uncertainty and view coverage. Match a small bounded
   interval first. Do not fill gaps by extending one photograph across the storm.
2. Fit visible geometry to those views and compare the reconstruction from each
   camera. Keep cloud appearance separate from circulation and damage width.
3. Introduce a documented building/component archetype with defensible load and
   resistance parameters before predicting a particular kind of damage.
4. Validate the historical view and model independently of visual appeal, then
   test the reading experience with actual visitors.

El Reno remains the first exhibit to develop through this process before adding
another equally detailed reconstruction.
