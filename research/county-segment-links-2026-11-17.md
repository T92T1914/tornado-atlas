# County segment links named by NOAA

Compared November 17, 2026. A NOAA Storm Events tornado record covers one county. A tornado that crosses a county line is split into one record for each county, and the catalogue keeps those records apart, because grouping them is a claim about which records describe one tornado. The roadmap allows that grouping only with supporting identifiers or reviewed reasoning. This record looks at the identifier NOAA itself supplies and measures how far it settles which records belong together.

Nothing is grouped in this change. The catalogue, the map and every exhibit are unchanged.

## What NOAA supplies

From October 2006 on, a tornado record can name the county its tornado continues in. Four fields carry it: `TOR_OTHER_WFO`, the forecast office responsible for that county, `TOR_OTHER_CZ_STATE`, its state as a two letter code, `TOR_OTHER_CZ_FIPS`, its county code, and `TOR_OTHER_CZ_NAME`, its name. They name a county and not a record. No field gives the event ID of the other segment, so the segment itself has to be found.

In the releases the catalogue cites, 3,737 tornado records name another county this way. The first begins on October 4, 2006 and the last on December 28, 2025. Before October 2006 no record carries the fields, so nothing before then can be linked by them.

## Method

1. Read every tornado record from 2000 on, from the snapshot the published catalogue cites for it.
2. For each record that names another county, collect the records whose `WFO`, `CZ_FIPS` and `CZ_NAME` equal the named office, county code and name, and whose interval lies within three hours of its own. Times are compared as NOAA writes them. Neighboring offices can keep different time zones, so the window is wide enough to cover an hour or two of offset, and no time is converted.
3. Measure the distance from the record's end to each candidate's begin, and from the candidate's end to the record's begin, and keep the smaller. The catalogue positions are the published begin and end points.
4. A candidate shares an endpoint when that distance is 1 km or less. A record is linked only when exactly one candidate shares an endpoint with it. The 1 km line is about the size of a hundredth of a degree, the precision most of these records use.
5. The direction of a link is the pair that meets. When both segments are single points, the two distances are the same and the CSV calls the direction `either`.

The distances use a flat approximation, with a degree of latitude taken as 111.2 km and a degree of longitude as that times the cosine of the latitude. Over a kilometer that is far finer than the coordinates.

## Results

| Outcome | Records |
| --- | ---: |
| One segment shares an endpoint | 3,299 |
| Several segments share an endpoint | 166 |
| Nearest endpoint more than 1 km and within 5 km | 182 |
| No endpoint within 5 km | 65 |
| No candidate in the named county | 25 |
| All records naming another county | 3,737 |

Of the 3,299 links, 2,814 meet at the same published point, 415 within half a kilometer and 70 within 1 km.

The fields usually name the next county. In 3,269 of the 3,299 links the named county holds the segment that begins where this one ends. In 26 the named segment is the earlier part. In 4 both segments are single points, so the order is not shown. Only 137 of the linked segments name the first county back, because the next segment usually names the county after it, or nothing when the tornado ends there. 642 links join records of two different NOAA episodes, mostly where the next county belongs to another forecast office.

The 3,276 distinct links join 5,994 records into 2,718 groups. 2,303 groups have two segments, 320 have three and 95 have four or more, up to eleven. 2,717 groups are simple chains, where every record touches at most two others. The other one branches at `ncei:680144`, which touches three. Read with direction, two segments end where `ncei:680144` begins, and two end where `ncei:1154910` begins, so those two places hold either a merge of reports or a coincidence the rule did not catch.

The 166 records with several touching candidates usually sit at a county line that another tornado of the same storm also crossed nearby, such as `ncei:1007107` in Wayne County, Iowa, on March 5, 2022. The CSV names the nearest of them but links none.

## Limits

1. A link says that NOAA's own field names a county and that exactly one segment of that county shares an endpoint with this one inside the window. It does not say that the two records describe one tornado, though that is the plain reading of the field. A grouping in the catalogue needs its own reviewed rule.
2. A segment whose continuation is missing the four fields cannot be linked here, so a tornado can be broken into more than one chain. Before October 2006 nothing is linked.
3. A segment whose published end point is missing or misplaced cannot share an endpoint. No record in the CSV, linked or nearest, is a start that `location-reviews.json` disputes, but a misplaced point nobody has reviewed would fall into the 5 km or no endpoint rows.
4. Nine endpoints of the 5,994 records joined by a link carry no digit past the tenths of a degree, where a published point can sit several kilometers from the true one. A link there rests on the two records writing the same coarse point.
5. Two segments that share an endpoint by chance, inside the window and in the named county, would be linked. The 166 ambiguous records show that this happens where tornadoes cross close together, and the rule refuses those.

## File

[`county-segment-links-2026-11-17.csv`](county-segment-links-2026-11-17.csv) holds one row for each of the 3,737 records, sorted by record. Its columns are the source record, the snapshot and logical CSV record, the record's office, state, county code and name, its begin and end time and time zone as NOAA writes them, the four continuation fields, the number of candidates and of candidates that share an endpoint, the outcome, the linked record and the direction of the link, the nearest candidate and its endpoint distance in km, whether the linked record names this county back, and whether both belong to one NOAA episode. `tests/test_county_segment_links.py` checks every link against the published catalogue.
