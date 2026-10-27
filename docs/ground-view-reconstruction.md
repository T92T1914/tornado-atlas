# Ground-view rendering and comparison

The spatial replay contains a deliberately selected synthetic camera exercise.
Open the appearance selector and choose Synthetic ground-view comparison, or
use its direct link in the appearance evidence panel. Choose the front or
oblique camera, then use the existing Play, playback speed and time controls.
The demonstration starts paused at 1x when opened directly. Its authored form
exists only at player seconds 120 through 140. Outside that interval the view
is empty. These offsets supply no El Reno exposure or historical correspondence.

The three comparison buttons select 120, 130 and 140 seconds on that same
PlaybackClock. Each has a complete independently constructed SVG reference.
Between those instants the render can move, while the reference panel states
that no frozen reference exists. It does not hold an earlier image under a
new time or camera label. Reference failure retains an explicit retry and the
complete file link. The historical photograph modes and their original media
remain separate.

## Procedural funnel view

The separate Procedural funnel simulation choice uses the same renderer,
PlaybackClock and two declared cameras. Its direct route is
`reconstruction.html?event=el-reno-2013&appearance_view=simulation&ground_view=synthetic-front&t=120`.
It starts paused at 1x. The existing controls play, pause or seek the authored
interval from 120 through 140 seconds. Playback stops at 140. Starting again
from the end or an outside instant returns to 120. Neighboring intervals have
no assigned form.

This view places the existing clock and playback controls immediately above
the funnel, so starting motion does not take the visitor back above its camera
explanation. Switching to another appearance view restores their original
document position. There is still one clock and one set of controls.

These player values are simulation offsets, without historical El Reno
correspondence. The `kinematic-v1` profile changes smoothly from base 0.42 and flare 0.70
to base 0.65 and flare 0.58, with bend 0.10. All values remain authored scene
units. The density body, rising detail, low dust and drifting cloud base use
`kinematic-v1`, described in the [form study notes](visual-form-study.md).
The camera remains locked while geographic orbit controls turn only the path
scene. Changing particle quality does not change the selected time, camera or
body parameters.

The original Synthetic ground-view comparison remains an explicit compatibility
path. It still uses the earlier particle geometry, all six SVGs and their
unchanged analytic profile. The new procedural view has no analytic reference
image. It clears and hides the old reference panel instead of showing a guide
for the wrong geometry. Switching back restores the original comparison route.

The retained PR167 before and after comparison contains about eighteen seconds of actual
playback for each renderer, including pause, resume, backward seeking and a
quality change. Ordered inspection covers all 323 encoded baseline frames and
161 candidate frames. It does not establish normal speed perception or behavior
between encoded frames. Brief blocky frames coincide with noninitial keyframes
in both recordings. A separate raw framebuffer comparison did not reproduce
that banding at the tested seek and quality transition. The original encoded
artifact and its uncertain cause remain part of the record.

## Formation and decay view

The Formation and decay study choice adds the same `genesis-v1` scenario used
by Form Study to the existing ground cameras. Open
`reconstruction.html?event=el-reno-2013&appearance_view=formation&ground_view=synthetic-front&t=120#replay-appearance`.
The direct route starts paused at 1x and retains the existing end, restart,
camera, history and outside-interval behavior. There is no second animation
clock. The shared player maps linearly to the study:

```
study_seconds = (player_seconds - 120) * 1.5
```

Player 120, 130 and 140 therefore select study seconds 0, 15 and 30. These are
authored demonstration offsets, not newly established El Reno exposure times.
Selecting this view does not register the scenario against the geographic path.

The body now develops through changing density and coherent irregularity, then
leans, thins and erodes. Surface circulation cues, condensation and dust follow
separate schedules. A continuous visible column need not be present while the
assumed circulation is active. The arrows show normalized display directions,
not measured wind vectors. The [Form Study](../web/study.html) also lets a
visitor reduce condensation at the same circulation, time and camera. Neither
the ordinary nor reduced display is a universal model of tornadogenesis.

The original synthetic comparison and its six SVGs still use their original
analytic geometry. The separate procedural simulation still selects
`kinematic-v1`. Neither supplies independent geometric validation for the new
formation mode. Its reference panel stays empty instead of attaching an old
guide to a different model. The [formation decision record](../research/formation-study-2026-10-27.md)
separates primary scientific context, authored assumptions and historical inputs.

PR167's accepted recordings and served checks remain evidence for that earlier
model. They do not transfer visible or delivery acceptance to a changed
formation presentation.

Integrated browser checks and served publication acceptance are separate gates
bound to the tested revision. Neither a paused image, deterministic trajectory
nor successful camera test establishes historical likeness or physical accuracy.

## Shared lighting and synthetic ground

The formation view now has a versioned `world-v1` presentation shared with Form
Study. Open
`reconstruction.html?event=el-reno-2013&appearance_view=formation&appearance_style=world-v1&ground_view=synthetic-front&t=120#replay-appearance`.
The appearance selector and the current Form Study context link select this
presentation. A formation URL without `appearance_style` retains its earlier
lighting. Unknown or repeated style values leave the requested presentation
unavailable instead of substituting a different scene. The original camera
comparison and `kinematic-v1` simulation remain separate compatibility paths.

One fixed scene light gives the body, cloud, dust and synthetic ground a common
direction. Two coarse probes estimate nearby attenuation, with an additional
local response from the existing primary density sample. A coherent hashed
value field supplies moving density texture. The ground sits beneath the grid,
flow marks and volume, with faint grain, distance fade and nearby shading.
The [form study notes](visual-form-study.md) explain these approximations and
their additional rendering work.

Lighter reduces both particle count and the `world-v1` density raster, to a
320 by 200 cap. Standard retains the 512 by 320 cap. Both preserve the complete
camera frame, selected time and scenario parameters. Older lighting links keep
their earlier density cap. The lower drawing size trades fine spatial detail
for fewer shaded pixels. Its native validation is still pending, and observed
software rendering cadence supplies no hardware performance claim.

The ground remains an authored plane. Its shading supplies neither El Reno's
terrain nor a measured contact point, and the light has no historical sun or
exposure calibration. Camera position, projection, authored time and formation
schedule keep their existing meaning. A more detailed picture does not supply
missing historical geometry.

Paused native views have been inspected in both declared cameras. Complete
motion inspection, integrated regression checks and the normal publication
gates remain pending for this lighting candidate. The blocky frames at index
101 in the earlier matched formation clips still have an unknown cause. A
separate fixed-state diagnostic can compare new framebuffer and encoded
evidence, but cannot reproduce the old state without its missing frame-to-draw
mapping.

## Explicit camera contract

`source-camera-model.mjs` accepts a right handed, Y-up coordinate system.
X and Z span the ground, with the model's central ground point as origin.
Positions, clipping distances and model geometry use authored scene units.
The existing height 2.6 stays in those units. No surveyed width, geographic
coordinate or EF rating is converted into a funnel radius or camera position.

Each camera declares position, target and an up vector; complete image width
and height; focal lengths fx and fy in pixels; principal point cx and cy;
near and far clipping; and an explicit distortion model. Position, orientation,
intrinsics and distortion each retain a measured, reported, fitted or
illustrative classification. Both demonstration cameras are wholly illustrative.
Unknown quantities cannot supply a projection. At present only an explicitly
undistorted pinhole image is supported. Distortion coefficients, undeclared
fields, incompatible units, degenerate axes and invalid numeric inputs fail.
An absent lens model is not silently treated as calibrated zero distortion.

The corrected camera basis is forward = normalize(target minus position),
right = normalize(forward cross up), and corrected up = right cross forward.
Pixel x increases right and pixel y increases down from the top left. For a
point relative to the camera and positive forward depth d:

```
x = cx + fx * dot(relative, right) / d
y = cy - fy * dot(relative, corrected_up) / d
```

The graphics matrix uses those same declared image bounds, rather than the
website viewport aspect. The complete source frame is fitted with letterboxing.
A common backing-buffer scale preserves that frame when either raster cap is
reached. Point sprites use the focal lengths and fitted raster scale, including
their per-axis aspect. The source scissor prevents sprites from painting into
the letterbox. Source fitting uses the canvas client area, excluding its border.
Client dimensions and raster rounding do not provide subpixel measurements.
Sprite diameters retain the WebGL implementation's point-size limit. The old authored orbit remains the separate legacy rendering
path. Geographic orbit controls do not turn the source-locked appearance view.
Schematic partial forms cannot inherit a camera projection.

## Independent synthetic reference

The six SVGs were constructed separately from the production projector. They
use scalar camera-basis and pinhole equations, with side-surface tangency for
an axisymmetric profile. Radius at normalized height h is base + flare * h^1.6;
height is 2.6 h. Over the authored interval, base changes from 0.18 to 0.83 and
flare from 0.62 to 0.32. Bend is zero. Top and base joins are declared display
closures. The reference marks the origin, two ground points at X = -2 and +2,
and the point at Y = 2.6. No historical pixels are present.

Before fitting or rendered inspection, the software comparison criteria are:

* The independently derived reference-point positions constrain axes, signs,
  principal point, pitch, roll and unequal focal lengths. Float32 matrix
  comparisons allow 0.01 source-image pixels, a software numeric tolerance.
* Complete source support must remain inside the fitted frame through viewport
  and pixel-density changes. Ordinary raster rounding is separate from camera
  uncertainty.
* Actual graphics marks must be painted at the independently predicted image
  locations. A small pixel neighborhood is a raster presence control, without
  a claim of subpixel residual measurement.
* Shared-time shape and camera parameters must agree after pause, reverse seek,
  rate or quality changes. Drawing quality changes particle sampling, not time.
* Source changes, missing cameras, gaps and late reference callbacks must not
  transfer a previous camera, reference or caption into the selected state.

The analytic guide describes the funnel side surface. The particle render has
soft sprite edges, interior sampling and a separate authored cloud base. These
are visible disagreements, not calibrated condensation, debris or wind.
Neither representation establishes hidden depth from a single photograph.

## Historical admission remains separate

The El Reno appearance declaration retains eight discrete observations across
four sequences and no registered continuous window. The best retained
calibration lead is the late RaXPol photographic sequence in
[Wakimoto et al. (2015), Section 2](https://doi.org/10.1175/MWR-D-15-0034.1).
Its photographer locations and horizon targets explain why a source-specific
camera model matters. Their calibration and uncertainty do not transfer to
another exposure, creator, crop or uploaded edit.

The bounded next comparison target is the source-reported 23:24:41 UTC exposure
in Wakimoto et al. (2015), Figure 5(a). It is a late-life view, not genesis.
The paper's identity and retained figure interpretation do not establish the
original exposure or a reusable Atlas camera solution. The source-reported
23:25:01 exposure in Figures 9(a) and 10(a), and 23:25:09 exposure in Figure
11(a), are candidate held-out checks after their own qualification. Figures 9
and 10 show one exposure, not two independent observations.

The next deciding input is an original exposure-specific calibration record,
or an original image with surveyed horizon correspondences, tied to that uniquely
identified exposure and its documented crop/edit relationship. A changing historical interval would additionally need
the inspectable sequence, edit and time correspondence, continuous inspection,
camera-change assessment and item-specific allowed use. No new camera fit,
pixel residual, held-out result or registered interval is reported. Sparse
stills do not become an animation through this software demonstration.

Nolte's permitted full JPEGs remain discrete documentary observations with
their complete marks. Their first unique correspondence requirement, frozen
+22 prediction and recorded +85 disposition remain unchanged. Movie locators
and reported still labels retain their separate meanings. The fourth still
and film have no inherited grant. Historical likeness comparison, calibrated
3D appearance, physical wind and damage simulation remain unfinished.
