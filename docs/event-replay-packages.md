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

Run `python -m atlas.exhibit` to regenerate the bundle, index and replay manifest.
The source builder remains specific to the reviewed El Reno inputs. It writes
`web/events.json` and `web/events/el-reno-2013.json`, adding the SHA-256 of the
exact UTF-8 bundle bytes. JSON uses LF endings, including on Windows. The build's
optional destination may select another directory, but its basename must match
the curated bundle path (`data.json` for El Reno).

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

The existing exhibit build publishes the chronology under `web/events/`.
`check_exhibit.py` compares it with the reviewed input. Python checks the archived
source hash. Browser validation checks schema, event joins, ordering and source
locators. Those checks preserve the curated contract, not independent historical
verification. The source is a retrospective assessment, not a synchronized feed
of what every observer knew at each moment.
