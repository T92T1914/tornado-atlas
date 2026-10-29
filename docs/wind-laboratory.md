# Wind and force laboratory

This is a separate educational experiment at `web/wind.html`. A documentary
reference can select one of the six dossiers, but it does not assign the
model to that tornado or populate its assumptions from historical measurements
or a damage rating.

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

The visible dots are passive markers. With zero background, their paths use the exact circular solution of this stated field. With positive background, a marker follows an exact shifted circle when that entire circle lies strictly inside the core. Other paths use fourth-order Runge-Kutta with bounded substeps, including paths that can cross the core boundary. A frame is divided at a nominal swirl angle of 0.04 radians, up to eight substeps at the supported slider limits. The wider helper input range has the same fixed work cap, without an accuracy guarantee outside those controls. The animation step is bounded to 0.04 seconds and does not catch up a longer frame gap. This does not solve fluid dynamics. Colors
are normalized to the current velocity settings and therefore do not form
a fixed wind-speed scale across different experiments. Motion starts paused,
stops when hidden, and does not catch up a hidden-tab time gap.

## Direction and opposite sides of the field

The stationary probe shows its signed east and north velocity components in mph
and m/s. Positive values point east or north and negative values west or south.
This is the direction the air moves, not the meteorological direction it comes
from. Speed remains the magnitude of those two components.

Beside the selected probe, the laboratory compares the points `(0,+R)` and
`(0,-R)` under the same peak swirl, eastward background, core radius, reference
area and coefficient. At those points, the east components are `background -
peak` and `background + peak`; their north components are zero. With 100 mph
swirl and 20 mph background, their speeds are 80 and 120 mph. The same generic
drag equation therefore gives a south/north force ratio of `(120/80)² = 2.25`.
This is a consequence of the chosen field, not a rule for every tornado.

The comparison uses unrounded forces. A zero north force has no finite ratio;
if both forces are zero, that case is stated separately. A background greater
than swirl can make the north point's net wind point east despite opposing the
local swirl. Radius changes the physical positions of the points but not their
normalized velocities. Area and coefficient change their drag, not their wind.

Native buttons move the existing probe to either point through its existing
input path. They change only its two coordinate controls and do not start
motion. The shared experiment link, selected passage sample and documentary
reference retain their existing owners. The HTML contains the complete default
component and opposite-side readings with printed assumptions. Without scripts,
those readings stay at their stated defaults and the new buttons stay disabled,
alongside the complete existing sample table. The generated table is unchanged.

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

For zero background, an independent finite-annulus reference derives the
continuous comparison duration from the probe's straight path through the
threshold region, clipped to the finite window. It does not integrate production
samples. Its controls cover zero wind/comparison, missing intersections,
tangency and clipped intervals. An off-grid near-peak case preserves the coarse
sampler's missed interval alongside the independent duration. This checks those
stated mathematical cases, not a general error bound or historical wind. The
positive-background extension uses independently derived piecewise intervals;
its controls add both offset signs, constant fields, strict equality and
representability refusals.

The default-table generator reads the actual HTML defaults and uses the same
wind and component functions. `node tools/build_wind_sample_table.mjs --check`
requires an exact match. Numeric checks cover all rows, stale defaults, units,
strict capacity equality and the separation of model time from playback time.
The actual passage consumer checks that selection and playback leave computed
cells and row ownership intact. Browser journeys check reading, settings,
reset, focus and the no-script or unavailable-module fallback separately.

## Keep an experiment beside its source account

Open the laboratory from any of the six dossiers, or choose a documentary reference within the page. The reference provides a specific account and its evidence dossier, plus one checked existing documentary image with its source, rights and limits. It never changes peak swirl, radius, background flow, probe position, passage settings, capacity or the selected sample. The recorded outcome and hypothetical model remain separate. See the [laboratory reading notes](laboratory-reading.md) for the selected items, full-image presentation and Clair/Obscur behavior.

The experiment link records all eleven controls and one shared sample index from 0 through 480. Reopening, reloading or using Back/Forward restores those settings paused. The field, passage graph, component state and sampled-values table are recomputed from that same state. Before an ordinary same-tab evidence visit, the displayed sample is captured in the experiment URL so native Back can recover it. Reset restores the documented model defaults while retaining the documentary reference.

Changing a control updates the experiment link immediately. During rapid input, updates to the address are grouped at most once per 250 milliseconds so browser history limits do not interrupt the controls. An explicit link save, reference change or ordinary source visit commits the latest settings. One temporary browser-session record retains the current entry’s pending settings for reload and is removed when the address is committed. Selecting a reference or explicitly saving the paused link creates a deliberate history entry. Pending settings from same-document Back/Forward navigation remain available during that document’s lifetime. An intermediate address that never received its pending update is not guaranteed after a later full reload. Save the paused link when retaining a specific experiment. No playback state is serialized and no link starts animation.

The bounded versioned contract refuses unknown references, repeated fields, incomplete snapshots and invalid numbers. A refused snapshot applies none of its values and explains that default controls are shown. With scripts unavailable, the fixed default table and ordinary documentary links remain readable; the URL does not alter that static table. These controls qualify reproducible software experiments, not historical wind or structural reconstruction.

## Continuous reference beside the sample grid

The [continuous comparison](https://t92t1914.github.io/tornado-atlas/wind.html#continuous-reference) exposes the independent geometry of the same Rankine assumption, with or without eastward background wind. It calculates the maximum speed and drag within the finite window, the duration at or above the chosen wind comparison, and the duration strictly above the assumed capacity. A separate module derives those values from the probe path through an annulus at zero background, or from piecewise squared-speed intervals with positive background. It does not read the sampled velocities or integrate the displayed graph.

The example button loads the documented 105 mph, 500 ft, 30 mph, 0.7 R and 1.6 kN case, with zero background, area 1 m² and coefficient 1.2. The continuous maximum is 1619.417 N, while the 481-point component sequence stays below 1600 N. The comparison calls out that missed exceedance without changing the graph, table or sampled failure state. Both results describe their stated calculations. Neither supplies a real connection strength or a historical failure time.

With zero background and positive comparison speed no greater than peak swirl, the qualifying radial interval lies between R times comparison/peak and R times peak/comparison. Intersecting the straight path with those boundaries, clipping to the finite window and dividing by travel speed gives the model duration. The maximum considers whether the window reaches the radius of maximum swirl. Zero wind, zero comparison, zero drag coefficient, tangency and strict capacity equality retain separate controls.

Adding eastward background flow changes the annulus geometry and distinguishes the north and south sides of the track. The reference instead splits squared speed into its inside-core and outside-core expressions and solves the clipped intervals. Constant branches, tangencies and strict capacity equality have separate controls. Unrepresentable reference inputs clear its values and explain the refusal while retaining the separate sampled consumers. This is a mathematical cross-check within floating-point arithmetic, not a general sampling-error bound or evidence that finer grids always converge monotonically. The 481 rows, model equations, shared selected sample and paused experiment-link contract remain unchanged.

Moore's documentary reference adds recorded building outcomes and the source-edition discussion beside this experiment. Its damage rating and path dimensions do not populate the model. The same separation applies to all six documentary references.

## Follow the experiment as a reading path

The Wind Lab now has native local contents for its probe, passage, assumed component, continuous reference, full sampled table and model limits. The Form Study follows the same convention for its illustration, authored sequence and limits. These links use the existing paused experiment capture and native browser history. They add no clock or state controller. Control explanations have a larger reading size and range controls have a 44-pixel hit region. These changes need their own desktop and narrow-viewport acceptance, without implying physical-phone or comprehension-study results.

The [Moore school account](https://t92t1914.github.io/tornado-atlas/moore.html#schools-and-model-limits) gives the comparison a specific documentary question. Its NIST source distinguishes interviewed refuge decisions, observed roof and wall damage, and an attributed structural explanation. Those records cannot populate the generic wind or capacity controls.

A controlled execution of the previous drawing consumer found artificial radial drift in zero-background swirl. At 250 mph, 50 ft and a starting radius of 0.1 R, 600 steps of 0.04 seconds moved the tracer to about 0.174 R. The exact stated field keeps that radius at 0.1 R. The zero-background path uses circular rotation at the appropriate angular speed inside or outside the core.

A separate positive-background check found radius and phase drift inside the core. With 250 mph swirl, a 50 ft radius, 20 mph background and initial point (0.1 R, 0.2 R), 600 steps of 0.04 seconds produced about 0.4053 R of position error against the independently derived trajectory. The complete numerical orbit remained inside the core. For this field, shifting the north coordinate by background/peak makes the motion a rigid rotation. The tracer now uses that exact solution when the whole shifted circle is strictly inside the core. This guard covers the complete arc rather than only its endpoints. Circles touching or crossing the boundary and outside-core mixed flow use the bounded fourth-order Runge-Kutta substeps described above. They retain numerical approximation error. The older midpoint witnesses remain in the tests and release evidence. This is a bounded correction, not a general exact mixed-flow solver.

The unchanged frame-time cap, offscreen recycling and visual marker count remain display choices. These repairs improve motion within the mathematical assumption. They do not validate a historical tornado, add radial inflow or change the force, passage, capacity or continuous-reference calculations.
