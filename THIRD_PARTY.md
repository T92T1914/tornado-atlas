# Source material and attribution

The software license covers original project code and documentation. Source datasets, documentary footage, quoted material and other third-party content retain their applicable rights and terms. Inclusion here does not imply endorsement by NOAA, the National Weather Service, a creator or a research institution.

## El Reno geometry

Publisher: National Weather Service, Norman, Oklahoma.

* [Event account and geographic downloads](https://www.weather.gov/oun/events-20130531)
* [Original KMZ](https://www.weather.gov/source/oun/wxevents/20130531/gis/ElRenoTornadoPath_final.kmz)
* Retrieved September 20, 2026; original SHA-256 `3a6fb5a007e5fab120d844e8c34136fff6cbf8f65b890ba09bdadb4bc630fdce`.
* GeoJSON adaptation: original longitude and latitude retained, altitude omitted for a 2D map. KML time labels interpreted as PM CDT from the accompanying chronology. Timeline points sorted by time. No smoothing or new observations added.

The preview displays a whole-event outline, center path and published timed positions. The shaded outline is not an instantaneous funnel shape or a spatial map of intensity.

The original NWS geographic data is public-domain government material, excluded from the project's copyright claim. The [NWS use policy](https://www.weather.gov/disclaimer) distinguishes its data from licensed third-party imagery and permits adaptation that is not represented as an official government product. This preview is an independent adaptation. Policy checked September 20, 2026.

## Video sources

The catalogue records titles, links, access scope and short original research notes. It does not bundle videos, thumbnails or transcripts.

* [Pecos Hank](https://www.youtube.com/@PecosHank)
* [TornadoTRX](https://www.youtube.com/@tornadotrx/videos)
* [Swegle Studios](https://www.youtube.com/@SwegleStudios/videos)

An uploader may credit other camera operators. As the shot register expands it must preserve those credits and document a reuse basis before third-party media becomes an exhibit asset.

## El Reno damage photographs

The exhibit includes photos 1 through 9 of structures and infrastructure from the **Damage Photos** section of the [NWS event account](https://www.weather.gov/oun/events-20130531). That section explicitly identifies the photographs as taken by NWS/NOAA personnel during the damage survey. This attribution is specific to the survey set; other photographs on the event page have separate photographer credits and are not bundled here.

* Credit: NOAA / National Weather Service survey personnel.
* Reuse basis: public-domain government material under the [NWS use policy](https://www.weather.gov/disclaimer), checked September 20, 2026. Excluded from this project's copyright claim. No government endorsement is implied.
* `exhibits/el-reno-2013/damage.json` records each original URL, SHA-256, byte length, dimensions, retrieval time, location description and caption rating.
* Original JPEG bytes are preserved at `web/assets/el-reno-2013/`. Images are resized only by the browser for display. Captions are short project paraphrases attributed to NWS.
* Camera coordinates and capture times have not been verified. The distributed JPEG files contain no EXIF tags; their absence does not establish when or where the photographs were taken.

The separate 3D form study uses original procedural graphics. It incorporates no creator footage, textures or third-party 3D assets. Its geometry is illustrative and is not derived from the NWS damage rating or footprint.

## Catalogue records and map context

The public preview includes normalized NOAA NCEI Storm Events records for every year from 1950 through 2025, using the latest annual publisher revisions available at import on September 20, 2026. Each record retains its source locator and revision hash. Original government source material is excluded from the project's copyright claim. Full raw annual files and original rows remain in the local archive. Event narratives are included; episode narratives are not included in the browser bundle.

Made with [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/). Its public-domain 1:110m countries dataset supplies 177 geographic features. Coordinates are retained; attributes are reduced to display names. These are modern boundaries for orientation, not a reconstruction of historical jurisdiction.

* [Original GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson)
* Retrieved September 20, 2026; SHA-256 `6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`.
* Terms checked September 20, 2026. No map tiles, external map fonts or tracking service are required.

## El Reno storm photographs and remembrance

The two storm photographs are by **Daniel Rodriguez**, licensed under
[Creative Commons Attribution 2.0](https://creativecommons.org/licenses/by/2.0/):

* [El Reno EF-5 Tornado Wedge](https://commons.wikimedia.org/wiki/File:El_Reno_EF-5_Tornado_Wedge.jpg), originally published on Flickr, stored as `storm01.jpg`.
* [El Reno EF-5 Tornado](https://commons.wikimedia.org/wiki/File:El_Reno_EF-5_Tornado.jpg), originally published on Flickr, stored as `storm02.jpg`.

The original bytes are preserved and checked against the SHA-256 values in
`exhibits/el-reno-2013/storm-photos.json`. The browser scales them for display.
No endorsement is implied. The filenames preserve a superseded rating; this
exhibit uses the final EF3 damage rating. Their camera clocks are not treated
as registered event times. Credit, source and license links appear beside each
image, including when the page runs locally.

The remembrance section transcribes public names with per-person links. It
does not reproduce obituary prose or portraits. Its source scope and access
limits are documented in [the history notes](docs/el-reno-history.md).

## El Reno timeline radar

Twelve full frames from the [NWS NWRT animation](https://www.weather.gov/images/oun/wxevents/20130531/radar/NWRT_20130531_ElReno.gif)
are preserved as PNGs in `web/assets/el-reno-2013/radar/`. Credit: NOAA / National
Weather Service. The [NWS event page](https://www.weather.gov/oun/events-20130531)
publishes the radar loop. The [NWS use policy](https://www.weather.gov/disclaimer),
checked September 20, 2026, supplies the public-domain reuse basis for this
government imagery. No third-party credit is attached to this loop.

The original GIF's SHA-256, selected frame indices, transcribed filename times,
PNG hashes and complete transformation note are in
`exhibits/el-reno-2013/timeline-media.json`. Complete composited frames were
exported without cropping or recoloring. Credit and timing assumptions appear
beside the image. This is an independent exhibit, not an official NWS product.

## Community source links

The community section uses original short summaries and links to discussions,
a blog and primary records. It does not reproduce Reddit comments, user images,
blog tables or figures from the survey paper. Source titles remain attributable
to their publishers. The review scope is stored in `community.json` and the
[community methods note](research/community-discussions-2026-09-20.md).

## Preserved source downloads

Raw NOAA NCEI and JMA downloads remain outside version control in `data/`. Their provenance is preserved locally. The software's license is not a license for arbitrary third-party content discovered during research.
# NWS damage survey attributes

`exhibits/el-reno-2013/survey-response.json` preserves a bounded public response
from the [NOAA/NWS Damage Assessment Toolkit](https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/MapServer).
The accompanying `survey-source.json` records the query, date, SHA-256 and
selection counts. These are government survey attributes, not a transfer of
rights to third-party photographs. The query excludes image links, comments,
names, device identifiers and casualty fields. NWS identifies the survey data
as preliminary. Original coordinates and labels remain available for checking.

# El Reno Survey Project camera metadata

`exhibits/el-reno-2013/camera-marshall-literal.txt` preserves the selected
22-record numerical Tim Marshall track from the
[project's published metadata](https://el-reno-survey.net/ted/ted-elreno-metadata.js).
Credit: El Reno Survey Project and Tim Marshall. The adjacent `cameras.json`
records the full-source hash, excerpt hash, original locator and retrieval date.
Only the factual time, coordinate and azimuth subset is included. The full
viewer implementation, videos and photographs are not republished. This
project's software license does not grant rights to the survey project's media.
