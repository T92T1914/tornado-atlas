# Storm scene and shared transport

`storm-v1` gives the illustrative formation study a continuing cloud layer, a changing condensation body and low dust whose spatial detail follows one declared flow. It uses the existing `genesis-v1` schedule and camera controls. Its dimensions, visibility, light and transport are authored in scene units. No conversion to metres, measured wind or historical El Reno clock is assigned.

Fresh Form Study experiments use `form-6`, with `model=genesis-v1`, `coverage=storm` and `presentation=storm-v1`. They open paused. When running this checkout, open `study.html` or select **Storm scene and shared transport**. The complete experiment link retains the selected view, sequence position, condensation comparison, dust switch, flow cue and drawing detail.

The replay uses the same renderer through its existing declared ground cameras. One explicit example is:

```text
reconstruction.html?event=el-reno-2013&appearance_view=formation&appearance_style=storm-v1&ground_view=synthetic-front&t=130#replay-appearance
```

The existing player maps seconds 120 through 140 to study seconds 0 through 30:

```text
study_seconds = (player_seconds - 120) * 1.5
```

Player 130 therefore selects study second 15. The replay has no additional storm clock. These offsets exercise the shared player and have no historical correspondence. A selected original footage source remains a separate documentary choice.

## A distinct presentation over the existing schedule

`genesis-v1` still supplies condensation, circulation, dust and erosion envelopes over thirty seconds. Reducing condensation keeps the selected circulation, time and camera. The dust switch changes the dust contribution. Circulation arrows remain independently removable. Their length is fixed and their opacity follows the assumed circulation strength, so their appearance does not measure speed.

Older links retain their declared presentation:

| Form link | Presentation |
| --- | --- |
| `form-6`, `coverage=storm`, `presentation=storm-v1` | Continuing storm scene with shared material transport and fixed opaque exposure |
| `form-5`, `coverage=reference`, `presentation=reference-v1` | Earlier broad form informed by documentary photographs |
| `form-4`, `coverage=formation`, `lighting=world-v1` | Earlier formation view with scene lighting and a synthetic ground surface |

The earlier `form-1`, `form-2` and `form-3` links, manual forms, bounded sequence gap and six analytic camera references retain their own contracts. Explicit replay `appearance_style=reference-v1` and `appearance_style=world-v1` also remain available. A formation replay URL without a style retains its earlier lighting. Unknown or repeated style values leave that selection unavailable. The [form study notes](visual-form-study.md) describe saving and restoration, and the [reference notes](reference-form-study.md) preserve the earlier presentation's source and material boundaries.

## One analytic flow for material detail

[`storm-scene-model.mjs`](../web/storm-scene-model.mjs) defines radial inflow, differential rotation and vertical lift with strain. For position `p = [x, y, z]`, the declared velocity is:

```text
a = 0.018
b = 0.036
c = 0.95
omega(p) = 0.24 / (1 + (x*x + z*z)/(c*c))

v(p) = [-a*x - omega(p)*z, 0.08 + b*y, omega(p)*x - a*z]
```

Distances are scene units and time is the authored study second. The coefficients are chosen for the illustration. The field has zero divergence by construction because `b = 2*a` and the radial rotation terms cancel in the divergence. That mathematical property does not make visible cloud a conserved moisture field, or turn the model into a pressure or thermodynamic solution.

The model evaluates the flow map analytically. At a selected time, it works backward from each world sample to its material coordinate at time zero. This backward map is the material pullback. Condensation detail, cloud detail and dust detail all use that same pullback before their different fixed texture scales and offsets. A fixed orthonormal basis rotates the resulting texture coordinates. It changes their orientation without adding another animation rate or a separate transport field.

The shared transport applies to material detail. The body envelope, cloud support and visibility schedules remain separately authored. The surface arrows use the field's direction at their displayed ground positions, with a normalized display length. They are not integrated particle paths or measured wind vectors. A selected time determines the state directly, so reverse seeking does not depend on an accumulated simulation history.

The texture comes from the existing periodic R8 reference lattice. A sample bin's length and the directional derivative of the same pullback estimate its texture footprint. Frequencies that the bin cannot resolve blend toward the declared mean value 0.5. This is a bounded detail filter. It is not an exact integral of the texture, a turbulence model or proof that every camera and drawing size is free of temporal or spatial aliasing.

## Shared density integration and the distant cloud tail

[`funnel-simulation-model.mjs`](../web/funnel-simulation-model.mjs) integrates condensation, cloud and enabled dust together through the shared body region. The storm branch uses a sampling box spanning `[-3.3, 3.3]` on X and Z and `[0, 2.71]` on Y. This bounds the region where the media overlap. The continuing cloud has no radial rim and is separately supported between Y = 1.8 and Y = 5.6.

The maximum primary budget remains 48 samples through the shared body region and 16 total across the exterior cloud segments. Cloud before, within and after the body is composed in depth order along the ray. The body segment uses uniform bins. Exterior cloud segments use squared normalized bin boundaries, concentrating samples near each segment's start. Each bin uses its actual length in the exponential opacity response:

```text
alpha = 1 - exp(-3.6 * density * delta_s)
```

Changing bin placement therefore also changes `delta_s`. Treating all nonuniform bins as if they had one equal length would assign the wrong optical thickness. Samples below the density cutoff and sufficiently opaque accumulated rays can end work early. The budget is a maximum, not a convergence or rendering-cost guarantee.

The locally sampled cloud stops at the existing camera's far segment. A separate analytic tail represents the same slab beyond that segment using a homogeneous representative effective density of 0.18 and fixed coarse cloud color `[0.48, 0.51, 0.52]`. Its attenuation uses only the slab length beyond the local clip, so it does not overlap the locally integrated segment. It adds no ray samples and does not move the camera or crop the view.

Local material color blends smoothly toward that same coarse color between ray distances 18 and 45 scene units from the local ray origin. Density, bin length and the exponential opacity calculation remain unchanged by this color blend. It supplies a common distant radiance limit without adding another opacity field.

For a nonzero vertical ray component, the tail uses the actual entry and exit distances through Y = 1.8 through 5.6. The parallel branch is selected only when `ray.y == 0.0`. An exactly horizontal ray outside the slab has no tail. One inside the slab uses a large finite length of 1,000,000 scene units to represent a saturated distant limit. Shallow nonzero rays still use the intersection calculation.

The homogeneous tail is a rendering approximation with declared support, density and color. It does not recover distant cloud structure or historical horizon conditions. The local footprint filter, finite quadrature, opacity cutoff, coarse tail and nearby lighting probes each introduce approximation. Their combined image error is not bounded by the R8 value quantization bound. A fixed sample count does not establish equal cost, numerical convergence or a hardware frame rate.

## Local lighting through the same material

The storm presentation keeps the existing fixed light direction and two nearby attenuation probes. Each probe now samples the same condensation, cloud and enabled dust functions through the shared material pullback. Its texture filter uses a fixed span of 0.22 scene units. The probe positions and optical weights remain a coarse local estimate, with an additional response from the density already computed at the primary sample.

These auxiliary samples temporarily change the shader's material coordinate and footprint. The material function restores the primary sample's values afterward, so subsequent primary shading continues from its own sample. Earlier presentations retain their simpler lighting proxy. Evaluating the actual filtered material at the storm probes adds work, even with the same number of probes and raster cap. It supplies no hardware performance claim, calibrated sunlight, droplet scattering or complete shadow transport.

## Exposure, dust and drawing detail

The storm scene has an opaque sky and synthetic ground surface with fixed authored exposure. Clair and Obscur change the surrounding reading interface. They do not select a new storm illumination, material palette or transparent background. The camera, selected time and scene settings keep their meaning when reading appearance changes. Historical photographs retain their original colors and complete content.

Dust stays a separate visibility response even though it participates in the shared density integration. Its low support, optical strength and brown material response are authored. A lifted component uses the term `1.25 * exp(-r*r/0.38 - 3.5*y)` before the patch and support masks, with the hard vertical support still limited to Y = 0 through 0.52. This is a chosen density profile without a physical altitude or debris mass. Turning off dust removes that contribution while retaining the condensation and circulation settings. The storm branch has no separate particle drawing pass. Earlier presentations keep their existing particle behavior.

Standard drawing is capped at 512 by 320 pixels and Lighter at 320 by 200. One scale preserves the complete camera frame while CSS retains the reading size. The primary integration budgets stay fixed. Lighter reduces shaded pixels and fine detail without assigning a different scenario time or camera. The storm quality labels describe drawing dimensions rather than an active particle count.

The existing controls start paused, allow explicit playback and backward seeking, and respond to reduced motion and page visibility. Graphics failure remains explicit, with documentary reading and source links available. These are implementation contracts to verify against the actual candidate. Behavior on physical devices and native recovery need their own evidence.

## Evidence and historical limits

This document describes the implementation and its assumptions. Visual review, motion at normal speed, raw framebuffer behavior, browser controls, numerical checks, required CI and served visitor acceptance need evidence tied to their actual revision. Earlier `reference-v1`, `world-v1` and procedural recordings retain their original scope. They do not establish acceptance for a changed storm scene. Determinism and an analytic flow do not establish convincing appearance or a historical reconstruction.

The scene adds no qualified historical appearance interval, calibrated El Reno camera, physical scale, time match to a source, condensation extent, boundary of damaging winds or damage simulation. The [ground-view contract](ground-view-reconstruction.md#historical-admission-remains-separate) keeps the original exposure and camera requirements explicit.

Nolte's three permitted full JPEGs remain discrete documentary observations with their complete marks. The first unique correspondence requirement, frozen +22 comparison and recorded +85 disposition remain unchanged. The fourth still and film have no inherited grant. This scene changes no source asset, attribution, permission or documentary registration.
