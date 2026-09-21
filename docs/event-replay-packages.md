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
