# Interactive visual form study

The museum now has an early visual prototype at `web/study.html`. It lets a visitor rotate a scene and explore three funnel forms. This is original procedural artwork. It has no assigned historical event, physical scale, wind speed or EF rating.

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
* Includes a fallback message for an unavailable renderer and a context-restoration handler. Context-loss and cross-device recovery are not yet browser-tested.

## What would make a historical reconstruction different

A registered reconstruction needs a specific event time, a camera location, viewing direction, lens assumptions and observations of the visible form. Those belong in an evidence model separate from the renderer. A path outline or final damage rating cannot supply the missing camera model or appearance.

The current El Reno footage notebook and geographic timeline are the start of that evidence model. The survey photographs add documented outcomes at named locations. None of those observations are silently converted into this illustration's dimensions or motion.

## Verification boundary

Model tests check deterministic particles, bounded allocation, geometric and camera validity, refresh-rate-independent normal timing, and suspension handling. They establish software behavior, not meteorological accuracy. Browser inspection checks whether controls and rendered views work; it is not a performance benchmark or validation of a physical tornado model.
