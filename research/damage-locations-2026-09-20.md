# El Reno survey locations

The [NWS Damage Assessment Toolkit service](https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/MapServer)
provides public survey points. Its service description calls the data quality
controlled but preliminary and directs official statistics to Storm Data.
The service and point-layer field metadata were read on September 20, 2026.

One bounded query requested May 31 through June 1, 2013 UTC within longitude
-98.1 to -97.6 and latitude 35.35 to 35.65. It returned 424 records without a
transfer-limit flag. The exact response, query URL, retrieval timestamp, hash,
byte count and reviewed selection totals are preserved in
`exhibits/el-reno-2013/survey-response.json` and `survey-source.json`.

All retrieved event IDs are blank and path GUIDs are zero. The records cannot
be joined to El Reno by an event key. A point-in-polygon calculation places
336 records inside or on the published NWS outline; 88 lie outside and are
not displayed. This is a derived geographic selection. It does not establish
causation for each observation, survey completeness, a unique building count
or a final official rating.

The selected source labels are EF0 (99), EF1 (107), EF2 (60), EF3 (12), N/A (35),
UNKNOWN (21), and TSTM/Wind (2). The last category remains thunderstorm-wind
damage. Missing ratings are not converted to EF0. Repeated locations retain
their separate source IDs rather than being silently merged. These totals
must not be compared directly with counts of damage indicators in research
papers without reconciling the records and the papers' inclusion rules.

Coordinates, indicator text, degree-of-damage text and labels are retained.
The displayed coordinates are survey locations, not registered camera
positions. The storm-date field only limits retrieval; it is not treated as
an impact timestamp. No casualty fields, names, freeform comments, device IDs
or third-party images were requested. The existing nine NWS photograph
captions have not been matched to the point records.

The static map uses the same published outline as the geographic replay.
It does not change when the historical clock moves. Linking a particular
damage observation to a time or photograph still requires source evidence.
The normalized bundle is rebuilt and checked offline from the preserved
response; visitors do not query the mutable service automatically.

This adds documented locations for future reconstruction work. It does not
calibrate the wind lab or supply building-collapse animations.
