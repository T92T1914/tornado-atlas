# Exploring source records

The collection page puts the map beside a source-record browser. Selecting a
record keeps its NOAA ID through filtering, map movement, photograph navigation
and shared links. A selected record can remain outside the current filters.
The record panel says when that happens.

The national overview is a starting view, not a coverage estimate. Region
shortcuts include Alaska, Hawaii, Puerto Rico and the Virgin Islands, and world
context. Imported records remain US records. Panning does not search an area
automatically. `Search this area` stores the current rectangle as a filter until
the reader replaces or removes it. Shared links preserve the rectangle without
rounding its edges.

## Map and list contract

`explorer-model.mjs` contains position classification, area filtering, URL state
and visible grouping. `explorer-map.mjs` adapts those operations to the locally
pinned Leaflet renderer. `atlas.js` owns the coordinated selection and detail
requests. Detail responses carry a request token so an older response cannot
replace a later selection.

Only visible, usable reported positions enter the map groups. A group is a
72-pixel world-grid cell at the current zoom. Its symbol is at the cell center,
not a derived tornado position. Opening a group reveals its source records in
the same paginated list. Single records and the selection ring use the reported
coordinate. Coincident records remain separate list entries. Compact labels
have exact accessible counts. These are source-record counts, including county
segments, not counts of unique tornadoes or a climatology.

The list renders twenty records at a time. Map markers are bounded by visible
grid cells rather than total catalogue size. The map is not a substitute for
the keyboard-accessible list. Arrow keys and plus/minus operate a focused map.
Narrow screens offer Map, List and Record views and leave dragging off until the
reader enables it. Hiding a map panel does not replace its last useful size
with zero dimensions.

## Geographic context and failure handling

The renderer is [Leaflet 1.9.4](https://leafletjs.com/reference.html), vendored
with its license and byte hashes in `web/vendor/leaflet/sources.json`. The
adapter uses its pan, zoom, tile and accessible-control foundations rather than
expanding the earlier custom SVG into a second map library. It does not require
WebGL, a geocoding account or a map backend. Vector tiles remain a possible
later choice if reviewed path geometry and measured workloads justify them.

[USGS The National Map](https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer)
provides optional roads, towns and terrain. Its reference geography is modern,
not a reconstruction of historical streets or buildings. Attribution stays on
the map. Tile requests stay inside the provider's geographic bounds. A failed
request or a stalled load removes the failed layer, preserves local Natural
Earth geography and the list, and offers Retry map. A response from an older
layer cannot replace the current status. The local outline remains available
without an external tile service.

Obscur keeps the basemap monochrome. Clair retains the provider's map colors.
Record identity, selection and disputed-position warnings also use text and
shapes. The map does not use intensity colors to imply a measured wind field.

The interaction comparison used the configured
[September 11 Photo Collection Map](https://www.arcgis.com/apps/instant/attachmentviewer/index.html?appid=1b7d4d22866b445881b181614e25d4d4)
on September 23, 2026. Observed features included its map/gallery arrangement,
selected marker, location panel, Back and previous/next location controls, and
the narrow-screen gallery. The selected attachment remained loading during
that inspection. Its complete media behavior was not verified. The useful
pattern here is coordinated evidence browsing with a stable selection, not a
claim that Atlas reproduces every feature of that application.

## Location review and photographs

Missing positions remain searchable. A reported end may be used only when the
source start is missing, and the panel identifies that fallback. No line is
invented between endpoints.

`research/location-reviews.json` records reviewed conflicts separately from raw
source values. Publication checks the source revision, hash, logical CSV row,
URL and both endpoints. A changed source requires renewed review. Currently
`ncei:5599610` retains the original California-labelled record's Atlantic start
coordinate. The original CSV and a fresh download agree. The available record
does not establish a corrected start. It is excluded from ordinary map groups
and fitted bounds. Only the explicit reported-position action reveals its
question-mark marker. This single review is not a collection-wide geographic
accuracy audit.

`python -m atlas.explorer` generates `web/catalogue/media.json` from existing
reviewed record aliases and exhibit manifests. It verifies original asset
hashes and keeps source, creator, license and registration limits. These are
event-level photograph associations. They do not identify the reported start
position, a particular county segment, or an inferred camera location.

Full photographs load on selection through the existing museum photo viewer.
Previous/next photograph and previous/next source record are separate controls.
A failed image retains the caption, credit and source links with a retry.
Source-only records say that no reviewed photograph is linked.

## Verification boundaries

Run the current workflow's Python, Node and publication checks. The focused
map tests are `node --test tests/explorer-model.test.mjs tests/explorer-map.test.mjs`.
The adapter tests use controlled map events. They protect hidden-panel sizing,
explicit disputed-position display, stale layer failures, timeout recovery and
responsive dragging policy. They do not prove a real tile service, physical
touchscreen, screen reader or browser paint behavior.

Browser acceptance also needs ordinary and overlapping selections, fixed area
search, fresh shared links, Back/Forward, rapid record and photograph changes,
unavailable details/media/tiles, both themes, keyboard controls and narrow
layouts. Test the exact deployed revision separately from a local preview.
External geography is supplementary. Source evidence must remain readable
when that service is unavailable.
