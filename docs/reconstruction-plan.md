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
registration. The published El Reno package remains version 1.

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

The initial working queue is:

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

The current priority is depth across these four existing main dossiers before
another main event is added. El Reno supplies the visitor standard: a substantial
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
