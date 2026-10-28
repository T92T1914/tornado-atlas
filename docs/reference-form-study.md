# Documentary references and the broad form study

The shared renderer now has a `reference-v1` presentation. It replaces the
regular vase profile with an unequal broad body, deeper cloud lowerings and
separate low dust. It uses the existing thirty authored seconds of `genesis-v1`.
The clock, camera and physical scale have not been fitted to El Reno.

## What informed the drawing

The comparison uses Daniel Rodriguez's two complete El Reno photographs,
Nick Nolte's three permitted full JPEGs and the retained opening four seconds
of Ray Bohac's extended film edition. The existing
[El Reno photographs](https://t92t1914.github.io/tornado-atlas/index.html#storm-photographs)
and [Nolte documentary section](https://t92t1914.github.io/tornado-atlas/index.html#nolte-documentary-photographs)
retain the full images, attribution and item rights. The Bohac derivative is
the existing `bohac-opening-documentary-motion` item, not the separately
identified short edition or Nolte's movie. No source asset changes here.

These views show unequal margins, overlapping lower cloud and uneven opacity.
They informed the broad outline, drifting texture and cloud connection. The
foreground and cloud obscure parts of the event. They do not recover every
hidden surface, ground contact, dust trajectory or a numerical velocity field.
All five photographs were seen before tuning. They are not withheld validation
views. The Bohac review covered all 120 retained presentations in ordered sheets
and complete endpoints. Ordered still inspection is distinct from watching
continuous motion at normal speed. Camera movement and foreground parallax
prevent treating apparent movement as an independently measured cloud speed.

## One shared scene, a distinct version

`form-5` experiments retain `coverage=reference` and
`presentation=reference-v1`. An explicit ground camera link uses
`appearance_view=formation&appearance_style=reference-v1`. Fresh Form Study
uses `form-6` and `storm-v1`, described in the
[storm scene notes](storm-scene-study.md). The replay still
maps player 120 through 140 to study 0 through 30. Those offsets have no historical
El Reno correspondence. A source visit pauses and saves the current Form Study
step before ordinary navigation. Back restores that experiment.

The earlier `form-4` and explicit `appearance_style=world-v1` keep their previous
geometry and material. Versions1 through3, the manual forms, the earlier
bounded gap and the six analytic camera references retain their separate
meanings. Unsupported or repeated versions refuse rather than borrowing the
new default.

The new field uses unequal elliptical sections, modest changing lobes and an
offset axis. Its lower edge has graded density and local erosion. The cloud
has overlapping lowerings and two scales of moving texture. These are authored
visual choices. Condensation, circulation and dust retain separate schedules.
The optional circulation marks are quieter in this presentation but still show
assumed directions, with no measured speed. A dust switch changes only the dust
drawing. Their independent controls matter because a bright ground mark is not
automatically dust.

## Bounded material work

The new presentation stores a periodic 32 by 32 by 32 value lattice in one R8
texture. Each lattice entry uses one normalized byte. Cubic coordinate weights
and trilinear sampling replace repeated integer hashes at each density lookup.
The analytical value quantization bound is 0.5/255 before hardware filtering and
floating point error. It is not a bound on final image differences after
nonlinear density, opacity and lighting. The texture repeats every 32 input
units. It is an authored detail field, not a meteorological dataset.

The implementation uses WebGL 2 immutable three dimensional texture storage,
one mip level, linear filtering and repeat wrapping. The
[Khronos WebGL 2 specification](https://registry.khronos.org/webgl/specs/latest/2.0/)
defines those interfaces. The broader rendering approach follows the
[GPU Gems volume rendering discussion](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-39-volume-rendering-techniques)
of volume integration, noise detail and quality versus cost. Those references
support a rendering method, not this tornado's historical accuracy.

Standard remains at most 512 by 320 pixels and Lighter at most 320 by 200. The
primary integration still uses at most 48 shared body samples and 16 exterior
cloud samples. Lighting stays enabled. Lighter trades spatial detail for fewer
shaded pixels, with the same camera, time and authored state. Texture allocation
or upload failure is explicit. A partially created texture is retired, and a
successful one stays owned until disposal or reinitialization.

## The historical reconstruction remains unfinished

The bounded changed-input check found no new original exposure, camera solution
or rights record that qualifies a historical interval. The retained
source-reported 23:24:41 UTC RaXPol target is a late-life view. Its original-to-crop
relationship, exposure uncertainty, numerical camera and allowed comparison
use remain unresolved. It cannot validate El Reno genesis.

Nolte's first unique match, frozen +22 and prior/reserved +85 remain unchanged.
Creator movie locators are not calibrated UTC or frame indices. Permission for
three full JPEGs does not extend to the fourth still or movie. Survey damage,
path width and radar context do not supply missing visible funnel dimensions.
The next historical advance needs those independent source and camera inputs,
then a falsifiable comparison at their supported time and viewpoint.
