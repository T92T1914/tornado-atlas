# Tuscaloosa: estimated footprint and individual damage accounts

The official NWS Birmingham survey links a maintained public ArcGIS map. This increment retains its eight estimated polygons and 198 individual accounts, then connects them to the complete written account. The six existing community stops keep their own order. Selecting a survey account assigns no arrival or failure time.

## Source and edition

The [NWS survey](https://www.weather.gov/bmx/event_04272011tuscbirm) embeds Web Map item `0deae8ed1989461faf99b315bb0e3126`, owned by `NWS.BMX_noaa`. The original map link is retained exactly from the inspected iframe source. Atlas does not embed that provider runtime.

The retained item response is 2,371 bytes, SHA256 `03c21fb62f6aa0f6af26ca853ebd09364ca552e952eecf8ebf158587dea5b831`. The data response is 147,547 bytes, SHA256 `dcc72bcd35da89d8bf4095516e066b164116a9bfa94cce858a43877c6078a025`. Both came from ordinary anonymous responses on October 12, 2026. The item was created in 2015 and modified on February 25, 2026. These are maintained agency records, not a recovered 2011 edition.

Only the two embedded collections enter this display. The external county service, original basemap, map tiles and linked photographs were not requested. The [NWS use policy](https://www.weather.gov/disclaimer) supports credited reuse of agency data and separately reserves third-party material. The derived Atlas display supplies no government endorsement or photograph permission.

## Identity and geometry

Source identities combine item, operational layer and FID. The layers are `TCLBHM_Swath_7451` and `TCLBHM_Points_1947`. Both embedded layer definitions use ID zero. FID zero remains valid in each collection, with separate composite identities.

Raw feature objects remain unchanged. The source declares Web Mercator, 102100 with latest code 3857. Spherical inverse Mercator uses a radius of 6,378,137 meters. All 198 converted positions agree with the separately reported latitude and longitude at four decimal places. That checks coordinate representation. It supplies no field-accuracy estimate.

The eight closed rings retain 603 vertices, including closure. Polygon FID zero is the overall estimated footprint with the storm's EF4 classification. The seven other polygons are labeled estimated EF4 damage areas. Their dimensions remain literal `-99` placeholders. The overall source length is 80.68 miles and maximum width 2,600 yards, using the original popup units. The survey places that maximum near Interstate 65. None of those values becomes a visible funnel diameter or a width at every instant.

## Retain the disagreements and gaps

There are 198 source accounts at 187 exact projected positions. Eight coordinate groups contain more than one record. All accounts survive. The map may group overlapping markers for browsing, while the reader exposes every source identity separately.

FIDs 16, 58 and 71 fall outside the estimated overall footprint. They remain available with that relationship explained. Forty-six accounts fall inside a local estimated EF4 area, with individual ratings ranging from EF1 through EF4. Fourteen EF4 accounts lie outside all seven local areas. Estimated boundaries and individual assessments can differ. Their relative geometry does not establish a source error, an undamaged location or a timed wind boundary.

The source wind field contains 55 numeric strings, 138 `N/A` strings and five single-space strings. Its units are unestablished. FID 162 retains `200`, without assigning mph or replacing the written survey's 190 mph maximum. FID 196 retains literal `Null` indicator and degree strings. Incomplete descriptions keep their missing beginning or ending visible rather than receiving borrowed text.

Storm and survey epochs are retained as source numbers. Reader date labels decode in UTC and remain calendar labels. The May 29 and July 12 survey dates survive beside the earlier collection dates. They are not tornado arrival times. The 106 legacy full-image URLs remain uninspected metadata and create no automatic image request or media association.

## Visitor behavior and acceptance

The static overview and native account details are generated from the same pinned source as the optional interactive map. The existing reader owns both `stop` and typed `account` selection. The existing map component supplies grouping, selection, keyboard pan and zoom. A narrow optional footprint layer adds the estimated polygons. It creates no playback controller.

Initial source checks passed seven deciding Python cases and three JavaScript syntax checks. The first nine Chromium visitor cases passed six and failed three. Retained diagnostics showed an uninitialized map view and a narrow deep-account action during smooth scrolling. The map now fits the estimated footprint before rendering account markers; this long source document uses immediate native scrolling. Independent source review also found and corrected an old account fragment retained when choosing a written stop.

The current focused Chromium run passed 18 cases: 13 added survey journeys and five existing reader regressions. These cover distinct duplicate-account identities, map-group member activation, filters, outside accounts, shared links, reload, Back/Forward, account plus photograph history, native reading, optional-module failure and successful recovery after unavailable data or map controls. The two old stop-only fragment expectations remain unchanged. All six saved views have a separate pixel review. The selected-account border now leaves the text inset, and calendar dates have human-readable labels. At the narrow whole-footprint view, two nearby group symbols overlap. The reader lists every account, and visitors can zoom or use the group chooser. These are bounded isolated checks and retained viewport images. Required integrated verification, CI and deployed acceptance remain separate release gates. Human visitor feedback, physical phones and spoken screen readers have not been tested.

The first continuous El Reno appearance interval, physical camera and extent registration, and calibrated historical damage reconstruction remain unfinished. This survey adds a truthful way to inspect recorded scale and outcomes.
