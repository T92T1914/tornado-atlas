# Formation, visible cloud and a bounded historical target

This increment extends the existing kinematic renderer with one illustrative
supercell scenario. The visitor can compare visible condensation with assumed
surface circulation, watch development and erosion, and use the same scenario
through the replay's declared ground cameras. It is not a calibrated El Reno
genesis or an atmospheric simulation.

## What the primary sources change

| Source | Access obtained for this increment | Implementation consequence |
| --- | --- | --- |
| [NOAA tornado education](https://www.noaa.gov/education/resource-collections/weather-atmosphere/tornadoes), Supercell tornadoes | Selected original text read | Circulation, condensation and dust remain distinguishable. A tornado can reach the ground without a visible condensation funnel. |
| [Houser et al. (2022)](https://repository.library.noaa.gov/view/noaa/43768), DOI 10.1175/MWR-D-21-0227.1 | NOAA metadata and abstract, plus indexed primary significance and introduction passages. The NOAA PDF exceeded the reader's size limit, a lawful alternative returned 502 and AMS HTML returned 403. No complete-paper or supplement inspection claimed. | The reported seven cases show generally non-descending development with exceptions and definition sensitivity. Do not teach one universal descending or upward pathway. |
| [Wakimoto et al. (2015)](https://escholarship.org/content/qt1md9s51b/qt1md9s51b_noSplash_116f4892f819852acb1afb94a8cb3b15.pdf), DOI 10.1175/MWR-D-15-0034.1 | Methods and relevant radar/photography passages reread. Earlier figure-pixel inspection is retained evidence, not a fresh continuous optical review. | Historical fitting needs the exact exposure, horizon/camera constraints and supported time correspondence. Publication analysis does not transfer calibration to an arbitrary image. |

The retained October 21 Consensus report supplies background. No fresh Consensus
search result was obtained for this increment. Scientific context does not
validate an authored shape or provide permission to reproduce source imagery.

## The declared scenario

`web/formation-model.mjs` evaluates the `genesis-v1` state directly from 0 through
30 authored seconds. Smooth bounded envelopes control assumed circulation,
condensation density, dust and erosion. The model develops a modest cone and
then increases lean and thinning. It does not require a wedge or rope stage.
These schedules are software choices, not measured atmospheric times or
physical thresholds taken from the papers.

Condensation can become faint while circulation remains substantial. The
comparison control reduces condensation without changing time, camera or the
circulation envelope. Dust has a separate display switch and schedule. Its
presence or absence does not define whether a tornado exists. The optional
surface arrows have constant length and opacity tied to assumed circulation.
They are direction cues in normalized scene units, not measured velocity
vectors or a validated flow field.

The shared density renderer adds evolving contour irregularity and local
erosion while keeping coherent detail through time. It integrates display
opacity along camera rays. It solves no pressure, humidity, buoyancy, fluid
conservation, physical light scattering or debris loading. Quality changes
sampling rather than the authored time or model state. The existing raster
and depth-sampling bounds remain in place.

Form Study saves the scenario as `form-3`, including condensation visibility and
the flow cue. Complete valid links reopen paused. Older `form-1` links retain
the original renderer and `form-2` links retain `kinematic-v1`. The replay uses
its existing clock: player 120 through 140 maps linearly to study 0 through
30. These offsets have no established historical El Reno correspondence.

## One source-constrained El Reno question

Can the exposure reported at 23:24:41 UTC in Wakimoto et al. (2015), Figure 5(a),
support a camera-aware partial appearance comparison, leaving later exposures
as checks rather than tuning targets? This is a late-life view, not genesis.

The retained paper is 9,933,086 bytes with SHA-256
`b0d7b4b2e8aabf3e214ddbc23ca4b4bb7822b99fd389bcfb30e9422e0a8c14e9`.
That identifies the retained publication, not the original camera exposure.
Its methods use photographer position and horizon-target bearings to determine
effective focal length and tilt, with uncertainty belonging to that analysis.
Nearby radar and a printed photograph time do not supply Atlas with that
exposure's camera solution or capture-clock error.

The deciding inputs remain:

1. A uniquely identified original exposure and its documented relationship to
   the published crop or edit, retaining the needed horizon and source support.
2. Exposure-specific position, horizon correspondences, bearing, lens or
   effective focal lengths, tilt, roll and distortion information, with an
   uncertainty assessment or enough original information to solve them.
3. Supported exposure-clock correspondence and uncertainty. A printed second
   is a source label, not established subsecond accuracy.
4. Allowed use covering the exact comparison and any derivative display.
   Existing links-only paper use and an independently authored schematic do
   not authorize hosting or tracing the photographs.
5. An inspectable original/edit interval and camera-change assessment before
   claiming historical motion, with actual declared visual coverage.

The source-reported 23:25:01 UTC exposure in Figures 9(a) and 10(a), and
23:25:09 UTC exposure in Figure 11(a), are candidate held-out comparisons after
their own qualification. Figures 9 and 10 are one exposure. A comparison would
need masks for obscured or unresolved regions and projected contour, width,
centerline and timing residuals at supported precision. No numerical fit,
pixel-error threshold, held-out score or new historical interval is admitted
by this decision.

The disposition preserves the existing discrete interpretations and unknown
continuous coverage. It freezes a specific target and missing inputs without
repeating an exhausted acquisition probe. Nolte's first unique match, frozen
+22 and prior/reserved +85 remain unchanged. The three permitted full JPEGs
retain their complete marks. The fourth image and film inherit no permission.
No Tim Marshall camera track is assigned to another creator's source.

## Verification boundary

The new formation scenario needs matched before/after motion from the actual
implementation, complete declared encoded-frame inspection and detailed checks
around development, transitions and erosion. Independent mathematical and
source assessment is separate from rendered acceptance. Narrow/wide Clair and
Obscur layouts, enlarged text, reduced motion, alternate cameras, playback,
reverse seek, quality changes and failure/recovery need checks at the changed
candidate.

Earlier PR167 recordings, test totals and public captures remain evidence for
that earlier version. They are not new execution for this increment. Local
checks, hosted CI, deployment and served visitor acceptance must retain their
own source identities and results. None establishes physical-phone behavior,
hardware GPU performance, human comprehension or historical truth by itself.
