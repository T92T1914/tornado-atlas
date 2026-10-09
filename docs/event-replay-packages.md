# Geographic replay packages

`exhibits/events.json` is the reviewed event index. Each entry links to its
documentary and either a replay manifest or `null`. A documentary without a
replay opens a research-readiness page; it never borrows the default event's
geometry. An explicit unknown event produces an error. With no event parameter,
the index's default is used.

The first package is El Reno. Joplin remains documentary-only. This implements
a reusable selection and loading boundary, not a second historical replay or a
historical appearance reconstruction.

## Publication contract

`exhibits/el-reno-2013/replay.json` declares schema version 1, event identity,
the bundle path, UTC clock bounds, display time zone, minute precision, timing
basis, geographic source URL and SHA-256, and supported coverage. Version 1
supports published minute positions, linear longitude/latitude interpolation,
a freely orbiting camera, and an illustrative symbol. Other coverage values
fail validation. It requires one center path, one closed outline without holes,
ordered minute positions with source display labels, and the existing single
footage-source contract. Raw source conversion still preserves polygon holes;
this renderer rejects them instead of discarding them.

Clock bounds use `YYYY-MM-DDTHH:MM:00Z` or `YYYY-MM-DDTHH:MM:00+00:00`.
The publication validator and browser accept both UTC suffixes. Compact dates,
space-separated times, omitted seconds and other offset spellings fail before
publication, even when Python can parse them. This keeps a successful build
from producing a replay that the browser rejects. Raw source time labels remain
separate from this normalized package boundary.

Normalized geographic positions and footage anchors also use the expanded date,
`T` separator, explicit seconds and either UTC suffix. Geographic observations
remain on whole minutes. Footage anchors retain their recorded whole seconds,
including values between geographic samples. Fractional anchor times are rejected
because this viewer selects printed clock readings at one-second resolution.
Neither timestamp validation nor that display resolution establishes clock accuracy.

Run `python -m atlas.exhibit` to regenerate the El Reno source bundle and the
registered package metadata. The source converter remains specific to the
reviewed El Reno inputs. It writes
`web/events.json` and `web/events/el-reno-2013.json`, adding the SHA-256 of the
exact UTF-8 bundle bytes. JSON uses LF endings, including on Windows. The build's
optional destination may select another directory, but its basename must match
the curated bundle path (`data.json` for El Reno).

Run `python -m atlas.event_package` to validate and publish every package in
the existing event index from its reviewed configuration and current bundle.
This command does not fetch or reinterpret historical sources. Each replay
supplies its own event identity, public bundle path and exact UTF-8 bytes.
Publication rejects missing or foreign replay inputs, cross-event evidence,
changed provenance and bundle paths that collide with another registered
bundle, manifest, chronology or the index. The packet is assembled and
validated before any output is written. Filesystem writes are individual
writes, not a transactional deployment. The browser's existing integrity
checks still reject a mixed publication.

`python -m atlas.event_package --event joplin-2011 --output preview` publishes
the reviewed Joplin chronology without an El Reno replay input.
Publication of documentary chronology reads only the selected chronology,
its archived sources and documentary page. It does not need another event's
replay configuration, bundle or documentary page. The shared index must
remain valid, including distinct manifest and chronology publication paths.

Repeat
`--event` to select more than one event. A selected publication omits the
event index so it cannot advertise missing assets in a new output directory.
A documentary-only event with no registered chronology or replay produces
no package assets. Its documentary remains the visitor entry point.

`build_event_packages(root, bundles, event_ids=None)` is the admission boundary.
Its bundle mapping must contain exactly the selected replay identities, with
each value `(public_path, exact_bytes)`. `replay_inputs` reads those bytes from
the checked-in museum or accepts an explicit converter override. The existing
`publication_artifacts` call remains compatible with the El Reno converter.
That convenience call supplies the converter's new bytes and reads existing
bundles for other registered replays. A fresh multi-event build supplies all
new bundle bytes explicitly to `build_event_packages`.
Unchanged JSON metadata in the destination keeps its existing bytes. New or
changed metadata uses indented JSON with LF endings. Replay bundle bytes are
never reformatted. Metadata comparison preserves JSON value types, so a boolean
version cannot be retained as an equivalent number. The shared publication
checker uses the same comparison before the El Reno source-specific checks.

The publication tests include an independently authored two-position software
fixture with a different clock, source identity and bundle path alongside
El Reno. It is confined to tests. Its source roles exercise the contract and
do not represent observations of a historical tornado.

`python tools/check_exhibit.py` checks that generated manifests match source
configuration and current bundle bytes. Python validates the time-zone identifier
syntax without requiring a separate time-zone database on Windows. The browser
loader and its Node test use `Intl.DateTimeFormat` to reject unknown zones.

The loader fetches with cache revalidation, checks schema and supported coverage,
verifies bundle bytes, and checks event/source/clock joins before enabling the
scene. A mixed publication fails visibly rather than rendering mismatched
evidence. This digest is a consistency check, not a signature or independent
verification of the historical claims. HTTPS or a localhost preview is required
for the browser's SHA-256 API. See the
[Web Crypto digest API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)
and [display-clock API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat).

## Optional appearance timeline

Replay manifest version 2 admits an `appearance_timeline` in the exact
integrity-checked bundle. Version 1 still rejects that field, including
`null`, and keeps its illustrative map symbol. The current published
El Reno package remains version 1. No historical appearance interval has
been added to it.

Version 2 uses the same geographic clock, player, URL history and source
selector. Its windows are bounded by whole-second UTC times inside the
replay, with explicit gaps. Windows cannot overlap within one source.
Separate source versions can cover the same time for comparison. An
illustrative window has its own source-free lane, an authored basis and no
historical registration. A visitor selects that lane explicitly. A missing
window or unmatched source draws no funnel form and displays an unknown
state.

A registered window requires an exact original source and edit identity,
the continuously inspected presentation interval, a stated absence of
discontinuities, at least one interior timing anchor, a fixed camera
position and view with calibration and uncertainties, a rights record and
an explicit limit statement. Its form keys use the existing normalized
cone, wedge and rope parameters. Each key must coincide with an inspected
timing anchor, which supplies a source video position. The key is labeled
as a source-linked appearance observation. Between keys the view labels
the form as interpolated. Those labels describe the evidence basis of
the assigned form, not a measurement of physical funnel width, wind or
damage. Moving-camera intervals need a later reviewed contract rather
than pretending a sparse camera track is fixed.

The Python publication validator and browser loader enforce the same
admission fields before the form renderer receives a timeline. The shared
WebGL renderer accepts a resolved form state from the geographic replay's
`PlaybackClock`; it does not advance historical time itself. It draws a
grid without funnel particles in unknown gaps. The existing form study
continues to use that renderer for authored examples. Synthetic fixtures
exercise continuous playback, gaps, reverse seeking, source switching,
history and rejected registration. They establish software behavior only.
The retained [Robinson source decision](../research/robinson-registration-decision-2026-10-04.md)
does not qualify a real registered window.

The public spatial replay also shows a source-linked appearance evidence
card for its existing checked paused frames. It links the original source
at that moment and leaves other times unknown. The card works without
WebGL. The form panel appears only for an admitted version 2 timeline,
and the documentary/source routes remain available without JavaScript.

## Survey context in the player

The El Reno replay reuses the existing survey inspector from its checked bundle.
Opening the damage panel mounts it once. A URL with a survey or fatality target,
or survey filters, opens the panel directly. Other events do not borrow this
survey. Its source links, assessment explanations, geographic comparison and
photograph attribution use the same components as the documentary and focused
survey page.

A selected NWS feature projects its preserved coordinates into the geographic
scene as an outlined diamond. This is an untimed surveyed outcome. The moving
center marker retains its separate minute-position and interpolation basis.
Selecting a fatality record clears the survey diamond, preserving the separately
sourced record rather than assigning it a damage survey identity.

Before a survey action writes browser history, the player captures its running
clock and pauses. The observation, filters, source choice and moment then share
one URL. Back, Forward and reload restore them together. Replay seeks refresh
the observation's share links without replacing its photograph controls. A
missing photograph leaves its original NWS record and attribution accessible;
the documentary route remains available if the inspector cannot start.

## Spatial replay navigation

The replay owns its historical time and address together. Choosing a checked
footage moment or recorded observer sample adds a history entry. Scrubbing,
pausing and reaching the end update the current entry without adding a trail of
animation frames. Back and Forward restore the selected time paused, updating
the scene, radar, observer status and footage panel through the same clock.
During playback the address retains the last saved selection until playback
pauses or ends. The visible share link continues to identify the displayed whole
second. Free-orbit settings and the observer toggle are not stored in the URL.

Existing links with a known `footage` ID still select that reviewed moment,
including older links whose `t` value differs. New navigation removes that ID
when moving away. Numeric `t` values retain supported fractional seconds instead
of being rounded during reload. A source clock shown throughout one printed
second does not make every fractional time its exact anchor, so new addresses
include `footage` only at the anchor itself. This preserves navigation precision
without claiming greater historical clock accuracy or registering a new frame.

The original documentary's footage links keep their existing behavior. The
optional player remains unloaded until requested. Browser regressions use
isolated local pages with external requests blocked and cover both appearances
at desktop and narrow widths. They do not validate the external video host,
physical devices or the historical source registration.

## Extending reviewed coverage

Adding an index row alone does not create a replay. A new event needs its own
reviewed source transforms, documentary, bundle and package; event-specific
media validators also need review. Clock bounds must agree with actual source
positions. Do not populate absent observations to satisfy the loader.

The synthetic second-event fixture exercises identity selection and loading by
relabelling test data. It does not establish a separately sourced event or prove
that every future geography renders correctly. Historical camera registration,
appearance geometry, continuous footage synchronization and multi-source player
switching remain outside version 1.

## Documentary chronologies

Event index version 2 adds a nullable `chronology` path. Version 1 remains
readable. A chronology is independent of geographic replay. Joplin now loads
seven reviewed NWS entries through the shared event selector and PlaybackClock,
while its geographic replay remains null. Blackwell remains a documentary with
unresolved clock labels, without a chronology assigned to it.
Version 2 rejects assigning both modes to one event. A future combined view must
explicitly synchronize their evidence before enabling that combination.

`exhibits/joplin-2011/chronology.json` supplies chronology schema version 1.
Sources have preserved PDF paths and SHA-256 values checked during publication.
Entries carry their original clock labels, normalized UTC minute, reported or
approximate precision, account, limits and source page. Unknown times cannot be
inserted into a timed sequence. Coordinates, camera registration and appearance
fields are rejected by this schema.

The browser holds the latest earlier entry between observations and labels that
gap. It never interpolates documentary text or positions. Play, pause, rate,
entry selection, minute seeking and a shareable `t` URL use the existing clock.
Entry changes create history entries, while scrubbing replaces the current URL.
Back and forward restore the selected time paused. Hidden pages pause playback.
No media player or external source needs to load for the evidence text to work.
The documentary page remains a noninteractive alternative.

Controls and animation callbacks read the same monotonic wall clock. A queued
animation frame can carry an earlier timestamp than a speed change handled
during that display frame. The chronology reads the current clock when the
callback runs, so that schedule does not halt playback. Minute selection and
documentary precision remain unchanged.

The existing exhibit build publishes the chronology under `web/events/`.
`check_exhibit.py` compares it with the reviewed input. Python checks the archived
source hash. Browser validation checks schema, event joins, ordering and source
locators. Those checks preserve the curated contract, not independent historical
verification. The source is a retrospective assessment, not a synchronized feed
of what every observer knew at each moment.
