# Nonzero background wind and one assumed connection

This benchmark checks the existing moving-vortex and component functions against independent algebra. A 20 mph eastward background adds to the swirl south of the track and subtracts from it north of the track. The same chosen component can exceed its capacity on one side and stay below it on the other. This is an implementation check for assumed inputs, not a calibrated historical damage model.

## Reproduce the visitor case

Open the wind study. Keep peak swirl at 100 mph, core radius at 500 ft, travel at 30 mph, area at 1 square metre and drag coefficient at 1.2. Set eastward background to 20 mph and assumed load capacity to 1.6 kN. Compare offsets of -0.7 and +0.7 core radii. Negative is south of the track.

At the default 480 steps, the southern case first exceeds capacity at sample index 206. Index 205 remains below capacity. Rewinding to 205 restores the earlier intact state. The northern case never exceeds capacity in the sampled window. Both passage sliders inspect the same clock.

The separate comparison-speed control defaults to 50 mph. Its reported duration measures time above that chosen speed. It does not measure the time force exceeds 1.6 kN. Nor does the component's persistent failed state measure that exceedance interval.

## Independent reference

Let V be peak swirl, B the eastward background, R the core radius, U travel speed, beta the signed cross-track offset in core radii, and s = -Ut/R. The selected beta values have magnitude below 1. The squared speed is:

~~~text
Inside the core:  v² = (B - V beta)² + V² s²
Outside the core: v² = B² + (V² - 2 B V beta)/(s² + beta²)
Force: F = K v², K = 0.5 density area drag_coefficient
Failure rule: F > capacity
~~~

Use SI values V=44.704m/s, B=8.9408m/s, R=152.4m, U=13.4112m/s, density=1.225kg/m³, area=1m² and drag coefficient=1.2. Then K=0.735kg/m and capacity=1600N. The strict rule leaves equality intact.

| Quantity | South, beta=-0.7 | North, beta=+0.7 |
| --- | ---: | ---: |
| Continuous peak force |1938.8938770432N|1116.3328382976N|
| Time with force above capacity |7.4059467579s|0s|
| First failing index at 480 steps |206|None|

The southern exceedance occupies two open intervals, approximately (-9.7083177752,-6.0053443962) and (6.0053443962,9.7083177752) seconds from closest approach. A sampled persistent failure starts at the first failing sample and stays failed thereafter.

The test independently evaluates every speed and force at 480, 960, 1,920 and 3,840 steps on both sides, with 14,408 sample pairs in total. It checks the first failing index, sampled peak, persistent state, onset lag and interpolated exceedance duration. The first sampled failure may lag the continuous onset by at most one grid spacing. Its error need not decrease strictly at every refinement. Duration bounds come from the interpolation bracket and derivative bounds, with a one-cell fallback across the core kink. Continuous peaks differ from sampled peaks.

The reference equations and threshold roots were fixed independently of production outputs. They verify implementation of the same assumed model. They are not independent measurements of a tornado or a published physical benchmark.

## Consumer verification and scope

Four native keyboard-control cases at 320 and 1280 pixels compare both sides, all 481 unrounded table rows and their six numerical cells against the independent equations. They also retain the existing same-engine pure-model/table checks. The southern 205/206 rewind and northern intact state have explicit assertions.

Private numerical and local consumer checks passed before this repository integration. The integrated candidate still requires its own executed checks, review, exact-revision CI and affected deployed acceptance. Earlier receipts remain historical evidence.

~~~text
node --test tests/wind-model.test.mjs tests/component-model.test.mjs tests/passage-clock-controls.test.mjs tests/passage-values.test.mjs tests/wind-numeric-acceptance.test.mjs
node tools/build_wind_sample_table.mjs --check
python tools/check_exhibit.py
python tools/check_archive.py
python tools/run_browser_checks.py chromium -- node --test --test-concurrency=1 tests/browser/wind-passage.test.mjs tests/browser/wind-sampled-values.test.mjs
~~~

No real building resistance, debris impact, fatigue, collapse mechanism, historical wind field or El Reno calibration is established. The model cannot identify density, area and drag coefficient separately from their product, or core radius and travel speed separately from their ratio, using this one force trace. The numerical case does not complete historical appearance reconstruction.
