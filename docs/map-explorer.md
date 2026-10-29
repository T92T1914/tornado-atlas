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

Searching by a known tornado name or using the `Has a reviewed exhibit` filter
connects separately retained source rows to their accepted documentary accounts. This includes
Blackwell's Dossier account without changing its coverage classification. A link
to an article does not register a camera, merge county records or create a replay.

The publisher checks `research/catalogue-dossier-links.json` against the accepted
dossier memberships and `exhibits/events.json` before opening the catalogue or
writing outputs. Unknown, conflicting or ambiguous article associations are
refused. The older `research/record-aliases.json` retains its exact bytes
because the historical archive adapters bind that file's hash. Its existing names
and association text remain in the effective catalogue annotations. Photograph
associations keep their separate existing builder and permission scope.

## Map and list contract

`explorer-model.mjs` contains position classification, area filtering, URL state
and visible grouping. `explorer-map.mjs` adapts those operations to the locally
pinned Leaflet renderer. `atlas.js` owns the coordinated selection and detail
requests. Detail responses carry a request token so an older response cannot
replace a later selection.

Only visible, usable reported positions enter the map groups. A group is a
72-pixel world-grid cell at the current zoom. Its symbol is at the mean screen
position of its visible members, not a derived tornado position. Opening a group
reveals its source records in the same paginated list. Single records and the selection ring use the reported
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

## Reference images beneath exhibit vectors

The El Reno path and survey SVGs use the separate `geography-view.mjs` consumer,
including the standalone survey and the survey section in Spatial Replay.
Their historical paths, selected records and labels remain vector elements.
Optional USGS reference images are requested for the map's visible CSS size
and device density, targeting at most twice the CSS density in 64-pixel width
buckets. Export dimensions are limited to 4096 on either side and 4,194,304
pixels in total. The source's geographic aspect ratio determines height.
These are loading limits, not a claim of new positional accuracy or native
detail beyond the provider's source.

The actual returned WGS84 extent still places the image under the vectors.
Only a successfully loaded current image commits its request key, including
mode, geographic bounds and bounded size. A resize within that same key keeps
the image without another export request. Changed bounds or size request a new
image; the previous same-mode image stays visible until the replacement loads.
Late metadata or image events cannot replace a newer selection. Error, timeout,
evidence-only mode and mode changes clear the successful key so recovery does
not reuse a failed or inappropriate image. The source link opens the image
actually displayed, with the same stale-result guard. It clears with the image.

CSS resize uses the existing SVG navigation event. A device-density change also
uses that event without moving the view or the historical clock. A hidden
zero-size map waits for a visible size. The old direct export helper retains
its 1200-pixel default for callers that do not provide a measured width.

This export sizing does not change Leaflet tiles, their native zoom limit or
the separate tornado appearance raster. Provider requests, response bytes and
rendered quality require their own measured checks. A 4K CSS viewport or a
larger request alone does not demonstrate source detail, readable labels or a
physical 4K display.

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

The catalogue strip uses the accepted reading versions of Daniel Rodriguez’s two
El Reno photographs. Each is 640 pixels wide and preserves the complete image.
Opening either photograph loads its unchanged original at full resolution through
the existing museum photo viewer. A
failed reading preview tries its original once, then removes only the failed
image while keeping the photograph button. A retired selection cannot start
that fallback or alter the current image. Other catalogue photographs keep
their existing assets. Previous/next photograph and previous/next source record
are separate controls. A failed viewer image retains the caption, credit and
source links with a retry.
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
