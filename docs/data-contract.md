# Data contract, version 1

## Provenance

Each download has its original URL, resolved URL, retrieval time, byte count, response metadata, and SHA-256. Hashes verify that the stored local bytes have not changed; they are not proof that the publisher's scientific account is correct.

Each NOAA source revision is imported in one database transaction. An invalid schema, duplicate event ID, incompatible year, or corrupt source rolls back the entire revision. Older revisions remain queryable in the database. Current search selects the latest published revision of each imported annual partition, including removal of records absent from a later revision.

The import log retains logical CSV record numbers. These are not physical line numbers, because narratives can span multiple lines. The full original CSV row is retained as JSON beside the normalized record.

## Fields and interpretation

| Normalized field | NOAA field | Interpretation |
| --- | --- | --- |
| source_record_id | EVENT_ID | A source event record, potentially one tornado segment |
| source_episode_id | EPISODE_ID | An episode groups events; it does not identify one tornado |
| rating | TOR_F_SCALE | Original reported F or EF category; unknown preserved |
| time.begin/end | Numeric date/time components and CZ_TIMEZONE | Reported local standard time; explicit source offset produces UTC |
| spatial.begin_point/end_point | BEGIN_LAT/LON, END_LAT/LON | Longitude/latitude endpoint pairs, no interpolated path |
| dimensions.length_m | TOR_LENGTH | Miles converted to meters, scope remains tornado or segment |
| dimensions.width_m | TOR_WIDTH | Yards converted to meters; not visible funnel width |
| impacts | Separate direct/indirect casualty columns | Reported values, blanks remain unknown |
| nominal_usd | DAMAGE_PROPERTY, DAMAGE_CROPS | Parsed K/M/B suffixes, no inflation correction |
| continuation | TOR_OTHER_* | Source continuation hints, no automatic storm merge |
| narrative | EVENT_NARRATIVE | Source text, not an independently verified museum account |

The adapter deliberately leaves UTC unresolved when a source timezone lacks an explicit numeric offset. It preserves the local date/time and a quality note. Summer records marked CST-6 remain UTC minus six; the adapter does not silently apply civil daylight-saving rules.

Bad coordinates, negative dimensions, unrecognized ratings, equal reported start/end times, and replacement characters already present in published narratives produce quality notes. Missing numbers remain null. Reported zero values remain zero.

## International extension

Future adapters must retain original scale, value or interval, authority, language, classification certainty, source record IDs, and time/position uncertainty. F, EF, IF, JEF, and TORRO remain separate scales. Normalization must not manufacture equivalent measured wind speeds.

JMA's CSV has duplicate blank header cells and explicit codes for tornadoes, other gusts, and uncertain phenomena. Its format guide distinguishes -9999 (unset) and -8888 (unknown); retain those meanings in the source record. Some casualty/damage values have shared-count flags. Do not sum those into national totals without reconciling the shared scope.

## Separate exhibit layer, not implemented

An exhibit will have a stable museum ID, aliases, linked source records, and documented grouping decisions. Observations should record their source locator, time basis and uncertainty, geometry type, and confidence rationale. Media need creator, source URL, reuse terms, and retrieval/version details. Reconstruction parameters need an evidence reference or an explicit assumption label.

No present catalogue record claims to supply a finished reconstruction or a damage simulation.
