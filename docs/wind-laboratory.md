# Wind and force laboratory

This is a separate educational experiment at `web/wind.html`. It has no
historical event ID and does not inherit El Reno's measurements or rating.

The horizontal flow uses a Rankine vortex. In SI units, its tangential speed
is `Vmax * r / R` inside the core and `Vmax * R / r` outside. At the center,
the rotational component is zero. A chosen uniform eastward wind is added
vectorially. That addition is a background flow in the diagram, not a claim
that the vortex center translates through a reconstructed landscape.
The [AMS glossary](https://glossary.ametsoc.org/wiki/rankine-vortex/) describes
the underlying idealization. Its solid core and inverse-distance outer field
are mathematical assumptions, not a measured profile for every tornado.

The probe evaluates dynamic pressure `q = 0.5 * rho * V²` and generic drag
`D = q * area * coefficient`, following the
[NASA drag-equation explanation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/).
Density is fixed at 1.225 kg/m³. Area and coefficient are explicit inputs.
With those inputs held fixed, doubling speed quadruples calculated force.
Dynamic pressure here is not a central atmospheric pressure deficit.

The component experiment adds the assumed-capacity rule described below. It
does not model a real structure or validate a building failure. There is no
debris simulation, safety assessment, terrain, vertical flow, turbulence or
damage-rating output. The
[NWS EF-scale explanation](https://www.weather.gov/oun/efscale) describes why
damage indicators and degrees of damage are part of an actual rating.

The visible dots are passive markers. Their motion uses midpoint integration
with a bounded animation time step; it does not solve fluid dynamics. Colors
are normalized to the current velocity settings and therefore do not form
a fixed wind-speed scale across different experiments. Motion starts paused,
stops when hidden, and does not catch up a hidden-tab time gap.

## A passage past a fixed probe

The second view prescribes eastward movement of the unchanged field. A fixed
probe is placed at `(0, offset * R)` and the center moves as `x = travel * t`.
At each sample, the existing wind equation is evaluated relative to that
moving center. Travel speed is separate from the chosen background wind.
This is not a self-consistent fluid solution or an inferred historical path.

The graph has 481 samples from the center at `-6 R` to `+6 R`. Time zero is
closest approach. Wind outside that finite window is omitted. Time above a
user-chosen comparison speed is estimated by linear interpolation between
samples; the comparison is not a damage threshold. The peak is the highest
sampled value, not an analytic optimizer result. Force uses the same generic
area and coefficient as the stationary experiment.

Playback takes 24 display seconds, independent of the model-time axis. The
slider can inspect individual samples. Motion begins paused and stops when
the view is hidden or moved out of view. Changing any model setting pauses
the passage and recomputes the graph.

## A component with an assumed capacity

The component experiment uses the passage's sampled drag forces and a total
load capacity chosen by the visitor, in kilonewtons. The rule assumes an intact
component before evaluating the sequence. A force strictly greater than that
capacity marks it failed, including at the first sample, and it stays failed
through later samples even when the wind falls. Equality
does not trigger failure. The first exceedance is a sample time, not an exact
failure time between samples.

The passage and component sliders inspect the same sequence. Rewinding shows
the state at that earlier sample. Changing an input pauses playback and rebuilds
the hypothetical experiment. Reset restores the controls and returns to its
first sample. The detached panel is a state diagram, not calculated debris
motion.

Capacity is an assumption, not a measured resistance for a roof, wall or other
building part. The rule has no fatigue, deformation, changing area, pressure
coupling or impact loads. It is not a historical reconstruction, structural
safety assessment or EF rating. A real structural archetype would need its own
sourced load and resistance definitions and independent validation.

## Checks

Ten analytic tests check the center, peak, inverse-distance outer
field, background-vector reinforcement/opposition, squared-speed and area
scaling, unit conversions, continuity, and invalid input rejection. These are
checks of the stated equations, not validation of a real tornado or building.
The passage tests include a known central crossing, offset symmetry without
background wind, clipped exposure time, and the invariant that doubling travel
speed halves the time axis and exposure while preserving the sampled winds.
Component checks cover strict capacity exceedance, persistent failure after
wind falls, equality, changed area and speed, an exceedance at the first sample,
and rejection of invalid capacity or unordered times. Consumer checks exercise
the paired sliders, shared clock, pause, rewind, settings, reset and visibility
transitions. These verify the stated software rules, without validating a real
component or building.
