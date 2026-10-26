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

The next deciding input is an original exposure-specific calibration record,
or an original image with surveyed horizon correspondences, tied to a uniquely
identified exposure. A changing historical interval would additionally need
the inspectable sequence, edit and time correspondence, continuous inspection,
camera-change assessment and item-specific allowed use. Sparse stills do not
become an animation through this software demonstration.

Nolte's permitted full JPEGs remain discrete documentary observations with
their complete marks. Their first unique correspondence requirement, frozen
+22 prediction and recorded +85 disposition remain unchanged. Movie locators
and reported still labels retain their separate meanings. The fourth still
and film have no inherited grant. Historical likeness comparison, calibrated
3D appearance, physical wind and damage simulation remain unfinished.
