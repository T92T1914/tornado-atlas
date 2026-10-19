# Interactive visual form study

The museum now has an early visual prototype at `web/study.html`. It lets a visitor rotate a scene and explore three funnel forms. This is original procedural artwork. It has no assigned historical event, physical scale, wind speed or EF rating. An optional documentary reference connects the experiment to one of the six existing dossiers without changing its geometry.

## How the drawing works

`web/vortex-model.mjs` creates a repeatable particle layout from a fixed seed. Each particle has a height, angle, radial position and role. The roles are funnel, illustrative ground dust and cloud base. A small set of geometry parameters controls cone, wedge and rope presets.

`web/study.js` sends those attributes to WebGL 2 once. The vertex shader calculates their positions for each animation time. Soft circular point sprites overlap to suggest cloud. The camera uses a perspective projection, so dragging around the form changes the view in three dimensions. The renderer uses the correct separate alpha blend factors for transparent canvas composition.

The drawing does not solve fluid dynamics, pressure, thermodynamics, structural loading or building failure. Its rotation rate and particle proportions are artistic choices. The grid is an orientation aid with no meter scale. The visibility slider masks part of the funnel; it is not a humidity or wind control.

The NWS [wedge glossary](https://forecast.weather.gov/glossary.php?word=wedge) explains why visual size and appearance alone do not establish intensity. The [NSSL tornado basics page](https://www.nssl.noaa.gov/education/svrwx101/tornadoes/) describes condensation, dust and debris as ways a tornado becomes visible. Only the indexed excerpt of that NSSL page was available in this pass; its direct fetch failed. Neither source validates this renderer's geometry.

## Resource and motion choices

* Starts paused, including for visitors who prefer reduced motion. Starting motion is explicit.
* Pauses when the page is hidden or less than 40 percent of the scene remains in view. Returning to the scene does not restart motion automatically.
* Supports 3,600 or 7,200 particles. The generator rejects budgets above 12,000.
* Reuses GPU buffers when changing detail, with no particle allocations during normal playback.
* Caps drawing pixel ratio at two and drawing buffer dimensions at 2,048 by 1,600.
* Clamps a delayed frame's animation step to 50 milliseconds, avoiding catch-up jumps after interruption. This can slow motion on a very slow device; it is not a physical clock.
* Offers native keyboard controls for the form, view, visibility and motion, plus arrow-key orbit on the canvas.
* Keeps an unavailable or lost renderer's diagnosis visible while visitors adjust view and sequence controls. Context restoration recreates the drawing resources without restarting motion or resetting those controls.

## What would make a historical reconstruction different

A registered reconstruction needs a specific event time, a camera location, viewing direction, lens assumptions and observations of the visible form. Those belong in an evidence model separate from the renderer. A path outline or final damage rating cannot supply the missing camera model or appearance.

The current El Reno footage notebook and geographic timeline are the start of that evidence model. The survey photographs add documented outcomes at named locations. None of those observations are silently converted into this illustration's dimensions or motion.

## Verification boundary

Model tests check deterministic particles, bounded allocation, geometric and camera validity, refresh-rate-independent normal timing, and suspension handling. They establish software behavior, not meteorological accuracy. Browser inspection checks whether controls and rendered views work; it is not a performance benchmark or validation of a physical tornado model.

The isolated browser suite checks unavailable WebGL and uses the standard `WEBGL_lose_context` extension to exercise context loss and restoration when available. It verifies the failure message, disabled playback, preserved sequence controls and positive rendered pixels after recovery. Environments without that extension report the recovery check as skipped. This controlled browser check does not establish recovery from a physical GPU or driver failure on every device.

## Save an assumed experiment

Choose a documentary reference to inspect one existing full documentary image with its actual source, rights, version and limits beside the model. Depending on the event, that item shows the storm, aftermath or a regional forecast document. Changing the reference preserves the form, view, extent and authored-sequence settings. It does not fit the drawing to the selected tornado. Each dossier also links directly to the study with its reference selected. The [laboratory reading notes](laboratory-reading.md) describe the selected items and their different evidential roles.

The generic illustration and its background follow the neutral Clair/Obscur reading palette. Changing appearance redraws a paused view without advancing its clock. The historical replay keeps its separate source-informed drawing contract. The explanation below the illustration uses normal page text, and historical photographs retain their original colors and complete content.

The experiment link retains the complete control settings and reopens paused. The link updates immediately, while rapid control changes update the address at most once per 250 milliseconds to respect browser history limits. An explicit save, reference change or ordinary source visit commits the latest settings. One temporary browser-session record retains the current entry’s pending settings for reload and is removed when the address is committed. Pending same-document Back/Forward settings remain available during that document’s lifetime. An intermediate address that never received its pending update is not guaranteed after a later full reload; save the paused link to retain a specific experiment. Before an ordinary source visit or explicit link save, the study pauses and captures its displayed sequence step. The authored sequence uses the slider's supported steps; manual visual phase remains model time without a historical date or physical interpretation. No link starts motion automatically.

Versioned links reject incomplete, repeated, unknown, nonfinite, out-of-range or off-step fields visibly. A rejected link applies none of its values and identifies the default controls as unrestored. Without scripts, documentary links and the explanation remain available while the model cannot recalculate or restore an experiment.
