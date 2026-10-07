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

The nominal spacing is `2 * halfTime / (sampleCount - 1)` model seconds. At
500 ft radius and 30 mph travel, the 481 samples are about 0.284 model seconds
apart. The assumptions show that spacing to three decimal places. It changes
with model settings and is separate from the 24-second playback clock. A brief
peak or capacity exceedance can fall between samples.

For one off-grid example, use 105 mph peak swirl, 500 ft radius, 30 mph travel,
0.7 R offset, zero background wind, 1 m² area, drag coefficient 1.2 and an
assumed 1.6 kN capacity. The continuous zero-background peak from the stated
equations is 1619.417 N. The current 480 intervals, with 481 samples, see only
1594.503 N and no capacity exceedance. A separate API check with 960 intervals
and about 0.142 model seconds between samples sees 1615.622 N and an exceedance.
These two grids illustrate a missed peak and changed sampled state. They do not
establish convergence for every setting, add a public resolution control or
validate a real component.

Playback takes 24 display seconds, independent of the model-time axis. The
slider can inspect individual samples. Motion begins paused and stops when
the view is hidden or moved out of view. Changing any model setting pauses
the passage and recomputes the graph.

The sampled-values table provides the same complete 481-point sequence in
numerical form. It lists model time, wind in mph and m/s, dynamic pressure,
drag, load relative to capacity and the component state. Its assumptions and
units stay beside it. Rounded values are for reading; the capacity rule uses
the unrounded force. A displayed ratio of 1.000 can therefore accompany a
failure just above capacity.

The default table is checked into the page and remains readable without
scripts. In that case it retains the stated defaults, even if a browser lets
the controls move. With scripts available, settings update the existing rows.
Playback changes only the selected marker, without moving focus or rewriting
the numerical cells. The explicit show action opens the table and focuses the
selected row. The table region supports keyboard scrolling across its columns.

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

Analytic checks cover the center, peak, inverse-distance outer
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

For zero background only, an independent finite-annulus reference derives the
continuous comparison duration from the probe's straight path through the
threshold region, clipped to the finite window. It does not integrate production
samples. Its controls cover zero wind/comparison, missing intersections,
tangency and clipped intervals. An off-grid near-peak case preserves the coarse
sampler's missed interval alongside the independent duration. This checks those
stated mathematical cases, not a general error bound or historical wind.

The default-table generator reads the actual HTML defaults and uses the same
wind and component functions. `node tools/build_wind_sample_table.mjs --check`
requires an exact match. Numeric checks cover all rows, stale defaults, units,
strict capacity equality and the separation of model time from playback time.
The actual passage consumer checks that selection and playback leave computed
cells and row ownership intact. Browser journeys check reading, settings,
reset, focus and the no-script or unavailable-module fallback separately.
