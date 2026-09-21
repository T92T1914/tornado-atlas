# Reconstructing individual tornadoes

I want someone to open a tornado's page and watch what happened: where it formed,
how it moved, how its appearance changed, and which places were affected. The
long term goal is to give individual storms their own animations, starting with
the most infamous and working toward the wider historical collection.

This is the development plan. The current site has an El Reno geographic
timeline, an illustrative form study and a separate wind experiment. It does
not yet have a completed historical 3D reconstruction.

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

These are planned requirements, not new fields accepted by the current schema.
The existing observation validator deliberately rejects unsupported historical
registration. A schema revision must add evidence and uncertainty requirements
before enabling those fields.

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
4. Expand the infamous-storm shortlist and add contrasting weaker and
   international events as their evidence is assembled.

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
