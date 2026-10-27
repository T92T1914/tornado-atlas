# Reconstructing individual tornadoes

I want someone to open a tornado's page and watch what happened: where it formed,
how it moved, how its appearance changed, and which places were affected. The
long term goal is to give individual storms their own animations, starting with
the most infamous and working toward the wider historical collection.

This is the development plan. The current site has an El Reno geographic
timeline, a spatial replay of that path, an illustrative form study and a separate
wind experiment. The spatial replay follows the historical clock with a freely
orbiting camera and an optional drawing symbol for the funnel. It does not yet
have a completed historical 3D reconstruction of the storm's appearance.

## One playback system, many event packages

The October 26 camera milestone adds an explicitly selected synthetic
ground-view comparison to the existing replay. It supplies declared pinhole
cameras, complete source framing and independent analytic references through
the shared clock and renderer. The [camera contract](ground-view-reconstruction.md)
separates that software capability from the original historical reconstruction.
No continuous El Reno appearance window is admitted by this milestone.

The accepted PR167 funnel increment added a separate procedural moving body to those
same cameras and clock. It uses coherent rising detail, display density,
separate dust trajectories and a drifting cloud base. Its authored interval is
still 120 through 140 player seconds, without historical correspondence. The
earlier camera exercise and six analytic references remain on their explicit
compatibility route. The [form study notes](visual-form-study.md) describe the
model and its limits. Its release evidence remains attached to that version.
Better software rendering supplies no missing historical camera, source
interval, wind or damage evidence.

The next integrated increment adds one research-informed formation and decay
scenario, `genesis-v1`, to Form Study and the replay's existing ground-view
renderer. It separates assumed surface circulation, visible condensation, dust
and cloud behavior over 30 authored study seconds. Replay player 120 through
140 maps to study 0 through 30 through the same PlaybackClock. Earlier
`form-1`, `form-2` and camera comparison behavior remain versioned compatibility
paths. The [source decision](../research/formation-study-2026-10-27.md) explains
why this scenario is not a universal lifecycle or a solved atmosphere. Its
visible improvement, matched motion, required checks and served acceptance
need evidence from the changed implementation.

Historical comparison remains a separate lane. The next bounded target is the
late RaXPol exposure reported at 23:24:41 UTC in Wakimoto et al. (2015), with
later exposures reserved for checks rather than fitting. Original exposure,
camera, clock uncertainty and comparison-use inputs remain unresolved. No new
historical appearance interval is admitted. The same increment deepens the
Tuscaloosa account with source-linked recovery planning and local remembrance,
without turning a recovery area or memorial place into a tornado measurement.

Build the controls, camera system and rendering once. Give each storm a reviewed
event package that the player can load. Event-specific work should primarily be
research, registration and parameter curation, rather than another copy of the
application.

Each package should keep these parts separate:

| Part | What it contributes |
| --- | --- |
| Event identity | A stable museum ID, source records and the evidence that joins any county segments |
| Geographic history | Surveyed geometry, dated or timed positions, terrain context and unresolved gaps |
| Appearance timeline | Supported changes in visible condensation, shape, debris and visibility, with source locators |
| Camera observations | Known or estimated positions, viewing directions, time alignment and uncertainty |
| Damage and human history | Sourced impact locations, photographs, accounts and remembrance, with their time precision retained |
| Interpretation | Every interpolation or illustrative choice needed to connect observations |
| Coverage | Exactly which intervals, locations and views have been reviewed or reconstructed |

These are the full planned event-package parts. Replay manifest version 2
accepts a bounded appearance subset only when its separate source, clock,
fixed-view camera, inspection, rights and uncertainty contract passes.
The existing observation notebook still rejects unsupported historical
registration. El Reno now has eight sparse photo observations across four
sequences. Version 3 added two source-linked partial visible margins. Version 4
introduced two coarse filled partial condensation views and retained one partial
margin. The current version 5 package also includes the earlier partial dark
extension. Each interpretation belongs only to its own source-reported instant.
Its continuous historical appearance timeline remains unregistered.

## Match the animation to the available evidence

| Available evidence | Appropriate visitor experience |
| --- | --- |
| A locality or two reported endpoints | A historical record with its reported positions; no invented surveyed route |
| A surveyed path with limited timing | A path overview with known time anchors and explicitly estimated progression |
| A path and timed position observations | A geographic replay distinguishing observations from movement interpolated between them |
| Registered footage or photographs over a bounded interval | A reconstruction of supported appearance changes for that interval and viewpoint |
| Several aligned views and supported impact locations | A richer reconstruction with camera comparison and a documented damage layer |

A track and its reported maximum width do not specify the visible funnel at each
instant. A final intensity rating does not supply changing dimensions or a wind
field. The appearance model needs its own observations. Unknown sections can
remain map-only or clearly illustrative while better documented sections become
more detailed.

Damage photographs establish an observed outcome at their documented locations.
Animate a particular impact time only when evidence supports that time. Otherwise
show the surveyed outcome separately rather than making up a building-collapse
sequence.

## Start with the infamous storms

Use public interest to choose the research shortlist, then inspect usable evidence
to choose the next reconstruction. Consider path quality, time anchors, original
footage, identifiable camera locations and media reuse rights. Do not turn a
popularity ranking into a claim about scientific importance or victim impact.

The initial working queue below records the earlier reconstruction priorities.
The [current collection](../exhibits/events.json) also includes documentary
exhibits for Newcastle and Moore, and Udall. These additions do not establish
a historical appearance reconstruction.

1. **El Reno 2013:** finish the first bounded reconstruction using the geographic
   exhibit and source collection already assembled. Establish a supported time
   interval and viewpoint before expanding its appearance model.
2. **Joplin 2011:** develop the modern exhibit dossier from the existing catalogue
   leads, then assess the path and footage for reconstruction readiness.
3. **Blackwell 1955:** develop the contrasting historical dossier and inspect the
   surviving visual evidence. Keep recorded observations, testimony and later
   interpretations distinguishable.
4. **Tuscaloosa-Birmingham 2011:** deepen the existing damage, warning, radar and
   satellite account. Qualify original storm imagery and footage independently
   of the aftermath photographs and written survey progression.

That plan prioritized depth across the four main dossiers before expanding the
collection. El Reno supplies the visitor standard: a substantial
account, purposeful media, usable source routes, chronological or geographic
context where supported, and clear uncertainty. Each event should approach that
useful depth through its own surviving evidence. Equal numbers of photographs
or a borrowed replay would not establish equally complete accounts.

Photographs, inspected video intervals, radar and historical documents belong
where they explain the storm, warnings, surroundings, damage, response or
remembrance. A contextual photograph can be useful without a registered camera.
An archival link can remain useful while hosting permission is unresolved.
Neither becomes reconstruction evidence merely by joining a dossier. Preserve
the complete readable account and original source routes when a map, script,
image or external player is unavailable.

Keep additional event leads private while depth across the existing dossiers
remains the priority. Review their remaining narrative, media and usability gaps
against the El Reno standard before expanding the main collection. Source
scarcity and rights gaps remain visible rather than being filled with unrelated imagery. This
priority does not turn the existing geographic replay, authored form study or
Wind Lab into a historical appearance or wind reconstruction.

This is a working sequence, not a fixed ranking of notoriety. Events can move
forward when better evidence is available, and research can continue on another
storm while one reconstruction has unresolved gaps.

## Completion of the first limited reconstruction

* Load one event package into a shared play, pause and scrub interface.
* Keep the geographic replay and appearance scene on one explicit timeline.
* Expose a source-supported viewpoint and identify any freely orbiting view as
  a reconstruction extending beyond the original camera view.
* Link supported visual changes to source observations; show interpolation and
  uncertainty where observations do not determine an exact state.
* Keep damage markers and chapters aligned only to their supported time precision.
* Compare the rendered view with the registered source material and record the
  inspected time range, camera assumptions and remaining disagreements.
* Check playback at different rendering frame rates, long pauses, viewport sizes
  and quality settings. Display quality must not change historical event time.

## Scaling the collection

The present 80,318 NOAA rows are source records, including county segments. They
are not 80,318 unique tornadoes requiring separate models. Event grouping needs
reviewed source support before several records become one reconstruction.

Keep catalogue coverage, researched exhibits, geographic replays and appearance
reconstructions as separate progress measures. That lets the museum grow without
calling every imported row a finished exhibit. Reusable software can reduce the
cost of adding each storm; the historical research remains work for each event.

## September 20 implementation update

The exhibit now has time-linked radar frames with a maximum age and explicit
clock interpretation. The image panel shares the geographic timeline, while
untimed storm photographs remain clearly labeled context. No ground-view
photograph is registered yet. See the [source access record](../research/timeline-and-simulation-2026-09-20.md).

The visual renderer accepts a reversible, evolving sequence of authored shape
keys. The wind lab carries a generic component's failure state forward after
its user-assumed capacity is exceeded. Those tools are implemented and tested;
calibrated historical geometry and real structural archetypes remain future
work. The priority remains finishing a bounded El Reno reconstruction before
expanding the detailed exhibit list.

The damage explorer now displays 336 geographically selected DAT survey
records. Their recorded coordinates give the historical map a damage layer,
with the original query and individual records available for inspection.
Event joins, photograph matches and impact times remain unverified. See the
[survey selection record](../research/damage-locations-2026-09-20.md).

The historical map now has a shared second-level clock with explicit playback
rates and labeled interpolation between the unchanged NWS positions. A Tim
Marshall camera overlay uses 17 published samples within that interval, showing
the last recorded location and its age before hiding it after 90 seconds.
Camera gaps are not interpolated. This establishes a usable geographic clock
and viewpoint layer; it does not register the untimed ground photographs or
complete the historical appearance scene. The
[camera source and playback record](../research/camera-playback-2026-09-20.md)
sets out those boundaries and the remaining work.

## September 27 source review

The [2015 photogrammetry study](https://doi.org/10.1175/MWR-D-15-0034.1)
is now linked through the [El Reno source card](https://t92t1914.github.io/tornado-atlas/dossier.html?event=el-reno-2013&source=wakimoto-2015).
Section 2 and panels a to c of Figures 4, 9 and 11 were inspected, including
the actual figure pixels. Their photograph labels give 23:24:41, 23:25:01
and 23:25:09 UTC on May 31, 2013.

The method uses photographer position, horizon targets and camera geometry.
It adjusts radar observations for motion before comparison with a photograph.
Atlas has not recovered the original photographs, full calibration inputs or
an independently checked timing uncertainty. The paper's calibration accuracy
cannot be assigned to another creator's footage. Figure hosting rights are
also unresolved, so the dossier provides metadata and the original link.
Three samples do not establish a continuous 28 second reconstruction. The
existing geographic replay and observer context retain their current scope.

## October 3 shared playback increment

The discrete footage register and player now support separate original source
versions, including checked frames at the same historical second. Source switching
closes the previous player and preserves clock and URL history. The published
El Reno register still has one source and seven paused samples.

The existing form study also has a bounded authored example with two windows
and an empty gap. It uses the geographic player's wall-clock model, preserving
sequence time across drawing-quality changes and reverse seeks. These are
laboratory fixtures, not newly registered historical appearance. The
[implementation and acceptance record](shared-playback-acceptance.md) explains
the behavior, executed checks and missing historical prerequisites.

## October 7 appearance integration

The spatial replay now resolves a versioned optional appearance timeline from
its existing historical clock. The form study and replay use the same form
renderer. Assigned source anchors, interpolation, illustrative forms and
unknown gaps are distinct interface states. Source comparison keeps the
selected upload identity and history; the renderer has no second clock or
media player. Synthetic fixtures exercise that software path.

The published El Reno package still has no registered appearance window.
Visitors can see the checked original frame linked to the selected clock
moment, while unreviewed intervals state that appearance is unknown. The
[package contract](event-replay-packages.md#optional-appearance-timeline)
requires source inspection, edit identity, timing anchors, a qualified fixed
view, rights and uncertainty before any historical form can be published.
The Robinson decision above remains a negative result for continuous
registration.

## October 7 replay context

The El Reno spatial replay now places the reviewed event chapters and the
latest issued warning bulletin beside its existing clock. A chapter's source
time stays as written, while its button seeks to the matching published map
minute. The two can differ, including the formation account before the first
mapped point and the conflicting ending times. Previous, Next, browser history
and reload use the same replay position. Warning selection follows bulletin
issue time; an earlier observation mentioned inside a bulletin does not make
that bulletin available sooner. This adds source context to the geographic
replay without creating new path points or an appearance interval.

## October 10 sparse photo comparison

El Reno's version 2 package records four separately inspected, creator-published
stills from [Nick Nolte's event account](https://nnwx.us/blog/2013/07/15/may-31-2013-the-el-reno-ef-5/).
Interpreting the account's caption labels as Central Daylight Time gives UTC
labels of 23:10:37, 23:10:59, 23:12:02 and 23:12:55. Selecting a
record seeks the existing historical clock to its arithmetic offset from
23:04:00 and exposes its original-image link, attributed setting, partial visual
observation and limits. The creator labels and sample count make that comparison
choice readable without changing its stable sequence ID or source routes.

Those are reported capture labels with unquantified clock error. They are not
independently synchronized with the NWS positions. The acquired 1024 by 576
resources identify published response versions, not recovered camera-original
files. Qualitative roadside descriptions do not establish measured camera pose.
The fourth image is identified as GoPro in the account, without evidence that it
shares the earlier images' camera pose.

All seven numeric historical camera fields, shape and extent remain null. The
player supplies these partial records only at their declared source instants.
The 22, 63 and 53 seconds between them remain unknown, including fractional
seeks. A 138-second span between the first and last reported labels supplies no
continuous appearance interval. Selecting an original source does not transfer
its observations to another upload or admit an illustrative form as historical.

Publication uses external original links and independently worded factual
observations. No source photograph is copied, rehosted, traced or adapted, and
no reproduction permission is inferred from public availability. The package
build validates the source before writing outputs. The separate exhibit checker
compares its exact typed representation with the generated bundle. These checks
establish software and file consistency, without adding clock accuracy, camera
calibration or rights.

The first defensible El Reno appearance interval remains required. It needs an
exact original view or sequence, an inspected interval, an edit and timing map,
supported camera registration, uncertainty and a usable rights basis. This
sparse comparison adds a truthful source-reading action while that historical
requirement remains unresolved.

## October 10 reconstruction acceptance

The reconstruction should let visitors recognize the supported appearance of the
actual tornado, understand its size and inspect the damage it caused. A generic
funnel, an isolated partial outline or a hypothetical component failure does not
complete that goal. The first bounded appearance outcome remains a separate
required step.

Use the existing clock and renderer to build an event-specific visual account
from inspected photographs and footage. Compare each supported view against its
original observations. Preserve unknown views and intervening motion, and keep
any authored interpretation visible. Partial evidence can advance the work
without being presented as the full tornado.

Show physical scale with its source definition. The visible condensation funnel,
reported event maximum, radar circulation and damage envelope can differ. A
reported maximum must not become the funnel's diameter at every replay instant.
The new replay comparison puts the published optical estimates beside the NWS
maximum without assigning them to a ground footprint or filling a camera gap.

Use surveyed outcomes and authentic aftermath photographs to develop the damage
journey. Keep inferred event joins and unknown impact times explicit. Develop
the simulation through stated building, wind and failure assumptions, and compare
its outputs with recorded damage where the evidence supports that comparison.
The current generic force-capacity experiment remains uncalibrated.

Acceptance of a useful partial-margin, scale or reading release leaves the full
appearance and historical damage-model requirements open. Prioritize those
capabilities alongside useful museum development, rather than treating navigation
or source counts as their substitutes.

## October 11 partial condensation view

The reported 23:24:41 UTC photograph in Figure 5(a) of the inspected 2015
paper now guides a coarse, independently authored filled condensation view.
It uses the existing replay clock and renderer at offset 1241. The broad dark
body and lighter southern opening provide a more useful appearance account
than an open margin alone. The upper continuation lies outside the supported
view, and the lower appearance is omitted where contact is obscured.

The display support, colors, opacity and softness are authored choices. They
are not a measured complete contour, photographic lighting reconstruction,
wind density, physical size or camera calibration. Figure 13(a) supplies
complementary source context with the same whole-second label; that matching
label does not establish the same camera-original exposure. Every adjacent
fractional instant and intervening motion remains unknown.

The [specific source and comparison record](../research/el-reno-partial-condensation-2026-10-11.md)
separates original source inspection, private output comparison, integrated
software checks and required publication acceptance. This increment leaves
the first defensible appearance interval, a complete evolving likeness and a
historically supported damage model required. The source-qualified size and
recorded aftermath panels retain their separate definitions and timing limits.

## October 11 appearance and field-damage reading candidate

The private candidate makes the checked source appearance the main visual and places the existing clock controls beside it. The geographic scene appears below the full source record. Photograph mode shows only the center marker in that geographic scene, including unsupported times. The authored source form remains in its separate display plane. This changes presentation without supplying new historical geometry or camera registration.

The [field-scouring source record](../research/el-reno-field-scouring-2026-10-11.md) connects the original Figure 7 account to the replay at the paper’s reported 23:12:08 UTC RaXPol time. The passage around 23:12 and later aerial collection remain separate. The comparison creates no exact damage timing, new field coordinates or simulated failure sequence. Original figure links retain the links-only use basis.

The source-qualified record is promoted in the isolated private candidate. Current rendered checks and required revision-linked publication gates remain ahead. Complete evolving appearance, a defensible continuous interval and historical damage-model acceptance remain separate required outcomes.

The scoped private source and browser review subsequently accepted the primary appearance hierarchy and the field-account clock journey. The preserved failed checks and corrections remain in the acceptance record. An exact publication candidate, full required CI and anonymous deployed acceptance remain ahead. No historical interval, calibrated camera or damage-model coverage was added by those software checks.

## October 11 second partial body and comparison

The separately inspected 23:25:01 UTC photograph, enlarged in Figure 10(a)
of the 2015 paper, now guides a second independently authored partial body.
Its broad dark region and sloping southern transition enclose a more conspicuous
bright lower-left opening. The display support differs from the earlier view
without applying the ratio between the paper's 800 m and 500 m references.

Both reported views are reachable beside the existing replay clock. Each link
selects its own sequence and reported time. They remain separate interpreted
stills, with unknown motion between them. The 23:25:09 margin stays unchanged;
its interval and every fractional neighbor remain unknown. Existing links,
exposure identities, null physical geometry and source-defined lengths remain
separate. The geographic path scene remains a center-position reference.

The [second-view source and comparison record](../research/el-reno-later-partial-body-2026-10-11.md)
describes actual private source/output inspection and the remaining integration
and release gates. It adds no camera solution, historical duration, three-dimensional
silhouette or calibrated damage prediction. The first defensible continuous
appearance interval remains required.

## October 11 earlier reported-minute view

Reid’s inspected photograph, labeled 6:04 PM CDT on May 31, 2013, supports
a coarse light taper against darker cloud in the article. The reported minute
is retained outside the exact replay timeline. No exposure second, clock accuracy,
camera solution or physical size is assigned. The drawing uses the existing
renderer without animating the observation or holding it across a minute.

The [source and comparison record](../research/el-reno-reported-minute-taper-2026-10-11.md)
describes its seven authored support points, incomplete upper cloud and omitted
lowest region. The original photograph remains an external link. The specific
private source-use decision supplies no photograph-hosting permission.

The corrected private integration passed 19 scoped Chrome cases. Actual source
and viewport comparison covered narrow and wide layouts, doubled text and
reading fallbacks. Whole visitor-journey review, hosted CI and public acceptance
remain ahead. This earlier view leaves the continuous appearance interval,
metric camera registration and historical damage-model requirements open.

## October 16 early partial extension

The retained 2016 paper supplies one separately inspected Figure 6(a) view at
the reported 23:05:10 UTC label. The original October 10 cone/wedge/rope
comparison already stopped before numerical fitting. Its visible boundaries did
not constrain a complete shape. The new step is an independently authored
partial dark extension, with dark image-left context leaving the opposite outline
unassigned and fades omitting both unresolved continuations. A specific source
and output review accepted the refined component after rejecting the first
version's overly definite paired contour. No figure, crop or tracing is hosted.

The existing player selects this observation only at offset 70. It has no
duration, and every neighboring instant remains unknown. The source reports
site 1 near Jensen and Country Club Roads, distinct from the later
I-40/Banner Road setting. Physical shape, extent, camera calibration and
inter-source clock error remain unassigned. The source's beam annotations and
lengths do not calibrate the drawing.

The [original Figure 6](https://repository.library.noaa.gov/view/noaa/32144/noaa_32144_DS1.pdf#page=8),
current article, curated observation and player retain those limits together.
Nolte's first unique correspondence, frozen +22 comparison and prior +85
disposition are unchanged. This increment leaves the original continuous
appearance and historical damage-reconstruction objective unfinished.

## Documentary references and repeatable laboratory experiments

The dossiers provide direct entries to the existing Form Study and Wind Lab with their documentary reference selected. The reference keeps a relevant account and source dossier beside visitor chosen assumptions. Changing the reference does not derive a funnel, wind field, component capacity or failure sequence from the event.

Versioned experiment links preserve the complete manual configuration and reopen paused. Native reload, history and source return can recover that experiment. Wind passage and component views retain one shared selected sample and the same numerical table. This improves comparison and reproducibility without creating another clock, renderer or physics model.

El Reno's geographic replay and Joplin's warning chronology retain their separate coverage. Blackwell's unresolved clocks and Tuscaloosa's untimed survey outcomes are not converted into moving paths by the laboratory reference. The first bounded historical appearance reconstruction remains unfinished under the criteria above.

## Moore documentary and numerical comparison

The Moore 2013 documentary follows one source-supported tornado through its separately retained McClain and Cleveland county records. It preserves a later Briarwood rating revision beside older official material and provides agency survey photographs with their source annotations and edition limits. This extends the documentary collection without assigning a moving path, camera solution or historical appearance interval to Moore.

The Wind Lab's continuous zero-background comparison addresses a different gap: a finite sample sequence can miss a brief peak in its own assumed field. Independent annulus geometry now exposes that discrepancy beside the unchanged sampled graph, component and table. The comparison improves numerical interpretation. It does not validate the Rankine idealization against observed tornado winds or calibrate structural response.

The original reconstruction requirements remain open. Documentary depth, a repeatable manual experiment and an analytical reference are useful capabilities with separate acceptance. They do not complete evolving historical appearance, independent optical synchronization, registered camera geometry or a historically supported damage model. Nolte's first-match requirement, frozen +22 and already attempted +85 disposition remain unchanged.

## Laboratory motion and school evidence

The Wind Lab’s passive markers use the circular solution of the existing field with no background flow. A controlled execution of the old drawing consumer reproduced artificial outward drift at supported control limits. Removing that numerical distortion improves the illustration of its chosen assumptions. A later bounded correction also supplies the exact shifted circle when positive background flow keeps the entire orbit strictly inside the core. Other mixed paths remain approximate. No radial inflow, weather solution in three dimensions or historical wind is added. The force, passage, sampled failure and continuous reference rules are unchanged. The [wind guide](wind-laboratory.md#follow-the-experiment-as-a-reading-path) records both corrections and their limits.

The Moore school account adds three source-specific observations from NIST’s preliminary reconnaissance. Reported refuge changes, observed building damage and the report’s proposed structural explanation retain their different evidence kinds. Native learning paths connect the laboratory controls to their limits and the existing documentary reference. The records provide no measured settings for the generic component experiment.

This increment leaves the original El Reno appearance interval, independent synchronization, camera geometry and historically supported damage reconstruction unfinished. Nolte’s first unique match, frozen +22 comparison and prior +85 disposition remain unchanged.

## Udall documentary foundation

The six documentary accounts now include Udall, a separate tornado later in the Blackwell evening. Its reviewed association retains five county records and two separate Blackwell comparison controls. Source continuity interpretations, an unmatched county boundary, conflicting clock labels and injury totals remain available together. The existing regional forecast image is reused unchanged with its complete archive caption and item-specific use basis. Other image routes remain original-source links.

This is a documentary addition under the newer request to expand the collection. It preserves the original reconstruction sequence and its unfinished acceptance requirements. Udall supplies neither a continuously surveyed path nor calibrated camera, historical wind or appearance intervals. Its optional laboratory reference does not change manual assumptions. Nolte's first unique match, frozen +22 comparison and prior +85 disposition remain unchanged.
