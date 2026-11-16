# County boundary screen of catalogue positions

Screened November 15, 2026. I tested every begin and end position in the published catalogue of 80,318 NOAA records against the polygon of the county its record names. 4,665 positions on 3,377 records lie more than 0.05 degrees outside that polygon, and each one matches its row in the retained NOAA annual file. 2,235 of those positions are starts.

Nothing is marked disputed in this change. Under the rule the [state screen](state-boundary-screen-2026-11-14.md) uses, 2,153 starts would become newly disputed, about 40 times the 54 that screen added, and the rate at which starts are flagged jumps in five annual files. That is a decision for review, so this record lists every flagged position and leaves `location-reviews.json` as it was. [What marking them would do](#what-marking-them-would-do) gives the numbers.

## Boundaries

The polygons come from the Census Bureau's 2023 cartographic boundary file at 1:500,000, [`cb_2023_us_county_500k.zip`](https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip), 11,630,077 bytes, SHA-256 `99d6597b1fc7767deef62e01d28d8b5dcbd578e151855f7dc0d173cbf5bf0868`. It was retrieved on November 15, 2026 at 22:23 CST (04:23 UTC on November 16), before the screen ran, and the server reported Last-Modified `Tue, 16 Apr 2024 12:24:29 GMT`. It is the same release and scale as the state file the state screen used. It holds 3,235 counties and county equivalents. The file is kept outside the repository and the site does not use it.

## Method

Every catalogue record is a NOAA row with `CZ_TYPE` `C`, so its `STATE_FIPS` and `CZ_FIPS` name one county. The screen reads those two codes from the retained row of the annual release the published record cites, joins them to the Census `GEOID`, and tests the begin and end positions the published detail file shows. The shapefile and its attribute table are read with the Python standard library and no other package. A position is inside when a ray from it crosses the county's rings an odd number of times.

A record is screened only when its NOAA county name is the name of the county its code points to. Case, accents and the ` (C)` NOAA writes after an independent city are ignored in that comparison. 133,161 positions were screened. The rest are described under [Not screened](#not-screened).

For a position outside its labeled county, the screen measures the planar distance in degrees of longitude and latitude to the nearest edge of that county's polygon. A position counts only when that distance is more than 0.05 degrees. Each counted position falls in one of three groups, as in the state screen:

1. Inside another county's polygon.
2. In no county's polygon, nearer its own county than any other, and within 1 degree of it. Here that means coastal water, a lake or just across a national border.
3. In no county's polygon and either more than 1 degree from its own county or nearer another county.

For the description of the results below, the screen also read each flagged record's NOAA begin location field from the same retained row. Every counted position was then read again from the retained NOAA annual file itself, not from the database, counting logical CSV records the way the importer does. All 4,665 gave the same event ID, the same county code and the same point. The catalogue screened is the one published at `06b3223`, which includes NOAA's October 26, 2026 revision of 2012.

## Results

| Group | Starts | Ends |
| --- | --- | --- |
| 1. Inside another county | 2,174 | 2,398 |
| 2. Beside its own county | 18 | 13 |
| 3. Away from its own county | 43 | 19 |
| Total | 2,235 | 2,430 |

1,288 records have both positions flagged. 1,142 records have only a flagged end. 99 flagged starts lie inside a county of another state or territory, and 64 of the starts in groups 1 and 3 belong to records the state screen or the September review already disputed.

The flagged starts are not spread evenly over the years. The shares in this table and the next paragraph are of all records in each release.

| Annual releases | Records | Flagged starts | Share |
| --- | --- | --- | --- |
| 1950 to 1995 | 37,543 | 1,121 | 3.0 percent |
| 1996 to 2006 | 15,117 | 1,058 | 7.0 percent |
| 2007 to 2025 | 27,658 | 56 | 0.2 percent |

Within 1996 to 2006, five files carry almost all of it: 2001 has 145 flagged starts in 1,351 records (10.7 percent), 2003 has 242 in 1,535 (15.8), 2004 has 314 in 1,947 (16.1), 2005 has 161 in 1,343 (12.0) and 2006 has 121 in 1,263 (9.6). 2002 has 6 in 1,040, and no other year from 1996 on passes 2.2 percent. Each flagged start from 2001 to 2006 carries a NOAA begin location, a place name with a range and an azimuth such as `4 SW DANVILLE`. The CSV below gives the release of every flagged position, so the count for any year can be checked from it.

A rate that changes this sharply from one annual file to the next points at how those files' coordinates were produced, not at nearly a thousand separate mistakes. The count is less concentrated than the rate. The 1950 to 1995 releases still hold 1,121 flagged starts at about 3 percent. I did not establish that. The begin location text could test which field is wrong, because it places the start relative to a named town, but this screen did not geocode it.

## What marking them would do

The state screen disputes a start in group 1 or group 3 and lists everything else. Applied here, that rule gives 2,217 starts, of which 64 are already disputed and 2,153 would be new. 117 of the new ones clear the 0.05 degree threshold by less than 0.01 degrees. 51 of the new ones lie inside a county of another state. The state screen disputes none of those 51, which means none lies more than 0.11 degrees outside its own state.

A disputed start leaves ordinary map groups and fitted views. Measured against the 79,142 records that have a reported start, 2,153 new disputes would take 2.7 percent of starts off the ordinary map, 7.0 percent of those from 1996 to 2006 and 13.4 percent of those in the five annual files named above. They would also touch every one of the 256 detail buckets. Old detail filenames stay valid across rebuilds, so the site would keep the current 174,739,267 bytes of detail files and add as much again. The `web` folder the site publishes holds about 552 MB today.

Those consequences are why this change marks nothing. The open choices are to mark all 2,153, to mark a narrower set such as starts in another state or more than a stated distance outside, or to keep the list as a record and describe the five annual files as a source property instead of disputing each start.

## Not screened

271 positions carry a county code the 2023 file does not hold. 215 are Connecticut's eight historical counties, which the Census Bureau replaced with planning regions in its files from 2022 on. 31 are Puerto Rico rows whose state code is `99` and not `72`. 8 are Alaska rows named for forecast zones. The other 17 are retired or zone style codes in California, Georgia, Hawaii, Missouri, Montana, South Dakota, the Virgin Islands and Virginia, where for example Norfolk and Suffolk appear under codes the Census file no longer uses.

95 positions on 52 records carry a NOAA county name that is not the name of the coded county. 44 of those records name several counties in one label, such as `CULLMAN AND MARSHALL`, with the code of the first, so no single polygon is the labeled area. The other 8 are listed here because the name and the code disagree:

| Source record | NOAA county name | County the code names | Annual release and logical CSV record |
| --- | --- | --- | --- |
| `ncei:10080189` | WHITE PINE | Clark County, Nevada (`32003`) | [1971 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1971_c20260323.csv.gz), row 532 |
| `ncei:10324706` | GREENUP | Green County, Kentucky (`21087`) | [1993 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1993_c20260323.csv.gz), row 8168 |
| `ncei:10329955` | JEFFERSON DAVIS | Jefferson County, Mississippi (`28063`) | [1993 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1993_c20260323.csv.gz), row 2927 |
| `ncei:10355709` | VAL VERDE S | Val Verde County, Texas (`48465`) | [1993 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1993_c20260323.csv.gz), row 3810 |
| `ncei:10355712` | VAL VERDE S | Val Verde County, Texas (`48465`) | [1993 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1993_c20260323.csv.gz), row 4204 |
| `ncei:10345561` | SYNDER | Snyder County, Pennsylvania (`42109`) | [1994 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1994_c20260323.csv.gz), row 2940 |
| `ncei:10355235` | WASHINGTON N | Washington County, Texas (`48477`) | [1994 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1994_c20260323.csv.gz), row 8256 |
| `ncei:10329966` | JEFFERSON DAVIS | Jefferson County, Mississippi (`28063`) | [1995 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1995_c20260323.csv.gz), row 17526 |

`SYNDER` is a spelling of Snyder, and the `S` and `N` suffixes look like the southern and northern parts of a county. The other three name pairs, on four rows, name different counties. These are catalogue naming anomalies and are not corrected here.

Records with no reported position are not screened.

## Limits

A degree is a screening unit, not a ground distance. 0.05 degrees of latitude is about 5.6 km. 0.05 degrees of longitude is about 5 km at 25 degrees north and about 3.7 km at 49 degrees north.

A 1:500,000 cartographic file generalizes rivers and coastlines and clips counties at the shoreline, so group 2 is expected along coasts and lakes. Many older NOAA positions have two decimals, which is about 1 km.

County lines are 2023 lines. A county that changed its boundary after a tornado is tested against the later line. Independent cities in Virginia, Maryland, Missouri and Nevada are tested as the separate areas the Census file draws.

A segment of a tornado that crosses counties begins or ends on a county line by construction. A threshold of 0.05 degrees is well above the imprecision of a segment end placed on that line, but an end placed loosely near a crossing can still clear it. That is one reason ends are listed and not judged.

A flagged position shows that the source fields conflict. It does not say which field is wrong. The coordinate, the county code or the precision of an older record could each explain it, and this screen does not decide between them.

## The list

[`county-boundary-screen-2026-11-15.csv`](county-boundary-screen-2026-11-15.csv) holds all 4,665 flagged positions, one row each, sorted by state, county and record. Its columns are the source record, the position (start or end), the NOAA state and county, the Census `GEOID` of the coded county, the latitude and longitude as published, the degrees outside to three places, the group, the county that contains the position or the nearest one, the annual release file, the logical CSV record and whether the record is already disputed. The third decimal is the screen's arithmetic, not the precision of the boundaries.

## Reproduction

The screen, the row check and the summary are standard library Python scripts kept outside the repository with their output. They need the Census zip above and a catalogue database built from the releases the published catalogue cites. A rerun on the same inputs gives the same CSV, whose SHA-256 is `273d18acf24e21ce13d5187050cf4d1f6f535ea146b574a4f7a776e465e78990`.
