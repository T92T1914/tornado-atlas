# Interactive visual form study

The form study at `web/study.html` lets a visitor rotate a scene and explore three funnel forms. Its current implementation draws a continuous condensation body with rising detail, low circulating dust and a separately moving cloud base. This is original procedural artwork. It has no assigned historical event, physical scale, wind speed or EF rating. An optional documentary reference connects the experiment to one of the six existing dossiers without changing its geometry.

## How the drawing works

`web/funnel-simulation-model.mjs` supplies the `kinematic-v1` model. It combines a bounded density field with seeded particles. The shared renderer integrates opacity along each camera ray, using up to 48 samples through the shared body region and 16 across the remaining cloud segments. Overlapping cloud and body density is evaluated together at each depth, rather than sorting two complete volumes. Directional shading and coherent ridges give the body contour and depth. This is a display approximation, without a physical scattering or illumination solution.

Body particles rise and turn around the changing axis. Dust follows separate low trajectories, while a slowly drifting density field forms the cloud base. Particle birth and retirement fade to zero rather than carrying a visible particle across its recycling boundary. Density detail uses continuous functions of position and time, with no new random field generated per frame. It is correlated authored modulation, not curl noise or a solved velocity field.

The seed, model parameters and selected time determine the state directly. Reverse seeking does not integrate a different history, and lowering particle quality keeps the same trajectories in the common prefix. The model accepts finite time from 0 through 86,400 seconds. The camera uses a perspective projection, so dragging changes the view in three dimensions. The renderer retains separate alpha blend factors for transparent canvas composition.

`web/vortex-model.mjs` retains the earlier particle model. Existing `form-1` experiment links select that model explicitly. The synthetic camera comparison also keeps it, together with its six independent analytic references. Those references do not validate the different density profile or motion of `kinematic-v1`.

The drawing does not solve fluid dynamics, pressure, thermodynamics, structural loading or building failure. Its rotation rate and particle proportions are artistic choices. The grid is an orientation aid with no meter scale. The visibility slider masks part of the funnel; it is not a humidity or wind control.

The NWS [wedge glossary](https://forecast.weather.gov/glossary.php?word=wedge) explains why visual size and appearance alone do not establish intensity. The [NSSL tornado basics page](https://www.nssl.noaa.gov/education/svrwx101/tornadoes/) describes condensation, dust and debris as ways a tornado becomes visible. Only the indexed excerpt of that NSSL page was available in this pass; its direct fetch failed. Neither source validates this renderer's geometry.

## Resource and motion choices

* Starts paused, including for visitors who prefer reduced motion. Starting motion is explicit.
* Pauses when the page is hidden or less than 40 percent of the scene remains in view. Returning to the scene does not restart motion automatically.
* Supports 3,600 or 7,200 particles. The generator rejects budgets above 12,000.
* Reuses GPU buffers when changing detail, with no particle allocations during normal playback.
* Keeps the body and cloud integration budgets fixed when particle detail changes. Lower particle quality does not remove the density pass or change its geometry.
* Caps the new density model at 512 by 320 drawing pixels, using one common scale to preserve the complete camera frame. CSS retains the full reading size, so this trades fine spatial detail for bounded fragment work. The earlier particle model retains its 2,048 by 1,600 cap and maximum pixel ratio of two.
* Clamps a delayed frame's animation step to 50 milliseconds, avoiding catch-up jumps after interruption. This can slow motion on a very slow device; it is not a physical clock.
* Offers native keyboard controls for the form, view, visibility and motion, plus arrow-key orbit on the canvas.
* Keeps an unavailable or lost renderer's diagnosis visible while visitors adjust view and sequence controls. Context restoration recreates the drawing resources without restarting motion or resetting those controls.

## What would make a historical reconstruction different

A registered reconstruction needs a specific event time, a camera location, viewing direction, lens assumptions and observations of the visible form. Those belong in an evidence model separate from the renderer. A path outline or final damage rating cannot supply the missing camera model or appearance.

The current El Reno footage notebook and geographic timeline are the start of that evidence model. The survey photographs add documented outcomes at named locations. None of those observations are silently converted into this illustration's dimensions or motion.

## Verification boundary

Model tests check deterministic particles, bounded allocation, geometric and camera validity, refresh-rate-independent normal timing, and suspension handling. They establish software behavior, not meteorological accuracy. Browser inspection checks whether controls and rendered views work; it is not a performance benchmark or validation of a physical tornado model.

The before and after recordings retain about eighteen seconds of actual playback each, with matching initial camera, seed, player time and particle quality. Their different native raster dimensions and actual control timing are recorded. Complete ordered inspection covers all 323 encoded baseline frames and 161 candidate frames. The recordings include pause, resume, backward seeking and a quality change. Encoded gaps, brief keyframe texture artifacts and the software rendering cadence remain explicit limits. A separate raw framebuffer check did not reproduce the banding at the tested transition, and changing point quality preserved the volume bytes exactly at the same player time.

This is qualified evidence from recorded frames. A connected body in a paused capture, decoded files or a selection of stills does not establish smooth motion. Ordered inspection does not supply normal speed perception or knowledge between encoded frames. Physical phone behavior, hardware GPU performance and meteorological accuracy remain separate questions. Required CI and served visitor acceptance are assessed against their actual revisions rather than inferred from the recordings.

The isolated browser suite checks unavailable WebGL and uses the standard `WEBGL_lose_context` extension to exercise context loss and restoration when available. It verifies the failure message, disabled playback, preserved sequence controls and positive rendered pixels after recovery. Environments without that extension report the recovery check as skipped. This controlled browser check does not establish recovery from a physical GPU or driver failure on every device.

## Save an assumed experiment

Choose a documentary reference to inspect one existing full documentary image with its actual source, rights, version and limits beside the model. Depending on the event, that item shows the storm, aftermath or a regional forecast document. Changing the reference preserves the form, view, extent and authored-sequence settings. It does not fit the drawing to the selected tornado. Each dossier also links directly to the study with its reference selected. The [laboratory reading notes](laboratory-reading.md) describe the selected items and their different evidential roles.

The generic illustration and its background follow the neutral Clair/Obscur reading palette. Changing appearance redraws a paused view without advancing its clock. The historical replay keeps its separate source-informed drawing contract. The explanation below the illustration uses normal page text, and historical photographs retain their original colors and complete content.

The experiment link retains the complete control settings and reopens paused. The link updates immediately, while rapid control changes update the address at most once per 250 milliseconds to respect browser history limits. An explicit save, reference change or ordinary source visit commits the latest settings. One temporary browser-session record retains the current entry’s pending settings for reload and is removed when the address is committed. Pending same-document Back/Forward settings remain available during that document’s lifetime. An intermediate address that never received its pending update is not guaranteed after a later full reload; save the paused link to retain a specific experiment. Before an ordinary source visit or explicit link save, the study pauses and captures its displayed sequence step. The authored sequence uses the slider's supported steps; manual visual phase remains model time without a historical date or physical interpretation. No link starts motion automatically.

New `form-2` links name `model=kinematic-v1` and retain its bounded time domain. Earlier `form-1` links keep the earlier renderer and their existing phase contract. Loading an old experiment therefore does not silently replace its geometry or motion with the new model. A fresh study uses the new model by default.

Versioned links reject incomplete, repeated, unknown, nonfinite, out-of-range or off-step fields visibly. A rejected link applies none of its values and identifies the default controls as unrestored. Without scripts, documentary links and the explanation remain available while the model cannot recalculate or restore an experiment.
