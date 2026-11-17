# NOAA begin location text for the 2001 to 2006 starts

Compared November 16, 2026. The [county boundary screen](county-boundary-screen-2026-11-15.md) found that the NOAA annual releases for 2001 and 2003 to 2006 place the start of 9.6 to 16.1 percent of their records more than 0.05 degrees outside the labeled county, and it could not say which field was wrong. Every one of those starts also carries NOAA's begin location text, a range in miles and a compass direction from a named place, such as `2 SW COLLYER`. I placed that text with the Census Bureau's place gazetteer and compared it with the published start.

For most of those starts the text agrees with the county label and the coordinates do not. The text placed 750 of the 983 flagged starts. 713 of them lie more than 20 km from their own text, at a median of 82 to 101 km depending on the release, and for 671 of those 713 the text point falls inside the labeled county. The published start of 514 of the 713 sits within 3 km of the begin text of another event in the same NOAA episode, most often a hail or thunderstorm wind report. A chance control finds such a match for 3 of 817 points. NOAA's own locations table carries the same misplaced points. NCEI's FAQ says that coordinates from 1996 to 2006 were calculated from the range and azimuth, which would put them on the text, and none of the five NCEI documents I read explains why these five releases do not.

Nothing is marked disputed in this change, and `location-reviews.json` is unchanged.

Note dated November 17, 2026. The 671 starts whose text falls inside the labeled county while the published start lies more than 20 km away are now disputed in `location-reviews.json`, each citing this record. Two of them were already disputed by the state screen, and their reviews now add this finding. The 42 far starts whose text also falls outside the county, the 37 near ones and the five near starts from 2002 stay listed here and are not marked. `tests/test_begin_text_disputes.py` holds the reviews to exactly that group.

## Inputs

The place gazetteer is the Census Bureau's 2023 national places file, [`2023_Gaz_place_national.zip`](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip), 1,220,953 bytes, SHA-256 `3c8b23c0dcdb15c0ebd16fee7373e032466e6b585650aa219bc1bee5ac8bd58f`. It was retrieved on November 16, 2026 at 23:15 UTC, and the server reported Last-Modified `Tue, 26 Sep 2023 13:32:25 GMT`. It lists 32,329 incorporated places and census designated places, each with an internal point.

The county polygons are the 2023 cartographic boundary file at 1:500,000 that the county screen used, `cb_2023_us_county_500k.zip`, SHA-256 `99d6597b1fc7767deef62e01d28d8b5dcbd578e151855f7dc0d173cbf5bf0868`.

The NOAA rows are the retained annual details releases the catalogue cites, `StormEvents_details-ftp_v1.0_d2000_c20260323.csv.gz` through `d2008`. The flagged starts are the 989 starts from 2001 to 2006 in the county screen's list.

NOAA's locations files for 2001 to 2007 were retrieved on November 16, 2026 at 23:32 UTC from the same directory, each named `StormEvents_locations-ftp_v1.0_d<year>_c20260707.csv.gz`.

| Locations file | Bytes | SHA-256 |
| --- | --- | --- |
| 2001 | 604,806 | `f2f948c4ef6df1126fae81a0b7b0de75ff1f7c0c0c47cfbe20a78c0629e3b0d1` |
| 2002 | 634,522 | `6df68ca2575eb87a06499848ab0946f0342aa5858af81ba810d83e510bd02711` |
| 2003 | 676,418 | `3e02d56ac7fb2318eb247d790b64bbfa9a8279ccfee277000ece2702fb2a4062` |
| 2004 | 665,590 | `b8037b48ec803a86ddbf5dcfa1dd0ca06c26d4e7cc3f3b1c841d1fb220b949bf` |
| 2005 | 728,127 | `fad1145721484290b277b9cf85657ad6283bfab01560c96cd31220ac4094dbc8` |
| 2006 | 3,256,957 | `f483195e7d160eff068d736c7f6f1024c514be06093fe633ed7f8eaf9b56e80d` |
| 2007 | 925,583 | `51403d76762f0fd6a3d27d3cfec2e40dbd2cb9201386a9ee73146f0f559e5074` |

All of these files are kept outside the repository, and the site uses none of them.

## Method

1. Read every tornado row of the 2000 to 2008 releases that names a county and has a begin point.
2. Take `BEGIN_RANGE` in miles, `BEGIN_AZIMUTH` on the 16 point compass and the place name in `BEGIN_LOCATION`. Look the name up among the gazetteer places of the record's state. The gazetteer's type word, such as city, town, village or CDP, is dropped, case, spaces and punctuation are ignored, and Saint, Fort and Mount are compared as St, Ft and Mt. A name is used only when exactly one place in the state matches it.
3. From that place's internal point, move the range along the azimuth. A text with no range places the start at the place itself. Over a few miles a flat approximation is enough, so a degree of latitude is taken as 111.2 km and a degree of longitude as that times the cosine of the latitude.
4. Measure the distance from the text point to the published start, and test whether the text point lies inside the labeled county's polygon.
5. For every start more than 20 km from its text, search all events of the same release, of every event type, for one whose own begin text, placed the same way, lies within 3 km of the published start. A match counts here only when that event belongs to the same NOAA episode as the start. As a chance control, reflect the published start through the record's own text point, so the control lies as far from the record as the published start does, and search that record's episode again.
6. Read the locations file rows of the same events and compare location index 1 with the start in the details file.

The 20 km line sits far outside how the gazetteer agrees with the starts that pass the county screen, shown next. The 3 km window is wide enough for the gazetteer's own error and narrow enough that the control almost never meets it.

## The gazetteer against starts that pass the screen

The gazetteer's internal point is not the reference point NOAA used, which the format document describes as the geographical center or primary post office of the place, and these releases give coordinates in whole minutes of arc, about 1.85 km of latitude each. So a correct start still sits a little off its text point.

| Release | Starts placed, not flagged | Median distance | Within 5 km | More than 20 km |
| --- | --- | --- | --- | --- |
| 2001 | 924 | 1.23 km | 865 | 20 |
| 2002 | 765 | 1.16 km | 735 | 6 |
| 2003 | 933 | 1.23 km | 868 | 25 |
| 2004 | 1,177 | 1.24 km | 1,092 | 18 |
| 2005 | 834 | 1.31 km | 781 | 19 |
| 2006 | 848 | 1.24 km | 775 | 22 |

The releases on either side agree the same way. 2000 has a median of 1.22 km over 869 starts, 2007 has 1.05 km over 772 and 2008 has 1.06 km over 878.

## The flagged starts

| Release | Flagged starts | Text placed | Within 20 km | More than 20 km | Of those, text inside the labeled county | Median distance | Start at another event of the episode |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2001 | 145 | 115 | 10 | 105 | 96 | 78.5 km | 80 |
| 2002 | 6 | 5 | 5 | 0 | 0 | 1.1 km | 0 |
| 2003 | 242 | 179 | 6 | 173 | 158 | 88.9 km | 120 |
| 2004 | 314 | 254 | 11 | 243 | 233 | 88.2 km | 178 |
| 2005 | 161 | 117 | 7 | 110 | 105 | 79.7 km | 77 |
| 2006 | 121 | 85 | 3 | 82 | 79 | 93.5 km | 59 |

The median is over every placed start in the row. Of the 750 placed starts in the five releases, 671 have their text inside the labeled county and their published start more than 20 km away. 42 more lie more than 20 km from their text while the text also falls outside the labeled county, so the text supports neither field there. The other 37 lie within 20 km of their text, so the text does not separate the two fields, and 20 of those have their text outside the labeled county. 233 flagged starts from the five releases were not placed. 229 name a place the gazetteer does not hold under that spelling, such as `FIVE PTS` or an unincorporated community, and 4 name a place that appears more than once in its state.

The flagged starts of 2002 behave the other way. For the five the text could place, it agrees with the coordinates and both lie outside the labeled county, so there the label is the field that disagrees.

## Whose location the misplaced starts carry

In the five releases, 817 starts lie more than 20 km from their own text, the 713 flagged ones and 104 that the county screen did not flag. 555 of the 817 sit within 3 km of the begin text of another event in the same episode. The reflected control points meet that test 3 times in 817.

The other event is a hail report for 285 of the 555, thunderstorm wind for 149, another tornado for 114 and another type for 7. Only 20 of the 555 are exchanges, where the other event's own published start sits at this record's text. Event numbers do not suggest a neighbor in the file either. The median gap between the two event IDs is 338, and only 17 pairs are adjacent.

`ncei:5462441`, the sample the county screen named, is one of them. Its text is `2 SW COLLYER` in Trego County, Kansas, and its published start, 37.36667, -100.23333, lies 183.7 km south of that text in Meade County. That point is `2 SW FOWLER`, the begin text of `ncei:5460417`, another tornado of the same episode. In Iowa in 2004, `ncei:5394531` (`2 N NEWTON`, Jasper County) is published at `2 NW DALLAS CENTER`, the text of `ncei:5394534`, and `ncei:5394534` is in turn published at `2 N BAXTER`, the text of `ncei:5394537`. Here the points move along a chain of events rather than trading places.

The other 262 of the 817 found no such event. Their published start may belong to an event whose text the gazetteer could not place, or come from somewhere else, and this record does not establish which.

NOAA's locations table does not hold the text points either. For all 817 starts, location index 1 in the locations file has the same range, azimuth and place as the details file, and for 814 it has the same point within 1 km. For none of them is that point within 5 km of the text point. The misplaced points are in NOAA's location data itself, not only in the details file.

## What NCEI documents

NCEI's Storm Events FAQ answers "How are event latitude and longitude determined?" and "How accurate are event latitude and longitude locations?" The old address, `https://www.ncei.noaa.gov/stormevents/faq.jsp`, now redirects to [the Storm Events Database application](https://www.ncei.noaa.gov/access/storm-events-database/), which renders its text from a script. I read the text from that script, `assets/index-BDF-ROjl.js`, 3,748,741 bytes, SHA-256 `e09fbae5630b1563f5cff33677bfd77459fb792a542a44451b2eb5643ddd9974`, retrieved on November 16, 2026 at 23:36 UTC. The first answer says locations are entered either as a distance and direction from a known place, from which a latitude and longitude are added, or as a latitude and longitude, from which the range, azimuth and nearest place are calculated. The second answer gives the history by period, and its period headings and the sentences on how coordinates were made read:

> 1996 to 2006: Storm Data (from Paradox 7.0 Database)

> When entering the data into the database, the WCM would use the Range (in hundredths of miles) and Azimuth (in 16-point compass bearing) from the nearest city/town/location (from a table containing > 103,000 entries). Latitude and longitude were calculated from the supplied range and azimuth and recorded in the same precision as above (e.g., 2.75 miles ESE Asheville, NC, corresponds to a latitude of 3535 and longitude of -8230).

> 10/2006 to Current: Storm Data (from Windows SQL Server database CSV dump)

The releases match that boundary. Every tornado row from January to September 2006 has `PDS` in the `DATA_SOURCE` column and every row from October 2006 has `CSV`. Every tornado row from 2001 to 2005 is `PDS`, 2002 included, while 2000 is `PDC` and 2007 is `CSV`. 120 of the 121 flagged 2006 starts are `PDS` rows. The other, `ncei:1466` from October, is `CSV`, and its text could not be placed. Neither NCEI format document lists a `DATA_SOURCE` field, so these codes are matched to the FAQ by date only.

The bulk CSV format document, [`Storm-Data-Bulk-csv-Format.pdf`](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/Storm-Data-Bulk-csv-Format.pdf) (341,218 bytes, SHA-256 `3bd18968d34da43e192f8a7fb8e5548c4fa7d24ede016d2d068d849ee1392df6`, retrieved November 16, 2026), defines `begin_lat` as "The latitude in decimal degrees of the begin point of the event or damage path." For the locations file it defines the range as "Distance (to the tenth of a mile) to the geographical center or primary post office of a particular village/city, providing that the reference point is documented in the Storm Data software location database table." It says nothing about particular years. The export format document, [`Storm-Data-Export-Format.pdf`](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/Storm-Data-Export-Format.pdf) (150,527 bytes, SHA-256 `b0168139621beb5b4453085825dc3901c29e7730e4584e5f621b67657054987c`), describes the locations fields the same way and says nothing about particular years either.

NWS Instruction 10-1605, [Storm Data Preparation](https://www.weather.gov/media/directives/010_pdfs/pd01016005curr.pdf), dated July 26, 2021 (1,432,556 bytes, SHA-256 `c1ce1a2d6429ad2d078c5cf82ceaa01ea6e5a22da23874ea08cac994947e632f`), says on PDF page 7: "Given one set of numbers, the software is able to calculate the same data in the other format." It describes the software in use in 2021, not the program of 2001 to 2006. The directory's [README](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/README), marked "Update: 5/14/2014", says nothing about coordinates.

So NCEI's FAQ describes a method that would put each 1996 to 2006 start on its own text. None of the five documents I read names a known issue with those years' coordinates, a difference between 2002 and the releases on either side of it, or a step at which a point could pass from one event to another. The county screen flags no other release from 1996 on above 2.2 percent, and 2002 carries the same `PDS` code as the five, so the code alone does not produce the misplaced starts.

## What this settles and what it leaves open

For 671 of the 750 placed starts in the five releases, the coordinate is the wrong field and the county label is right. That answers the question the county screen left open for those starts. The record does not say at what stage the points were attached to the wrong events, and the NCEI documents I read do not either. Nor does it explain why 2002, made with the same program and carrying the same code, is clean.

Which of these starts to dispute, and whether to show their text point beside the published one, is left for review.

## Limits

The gazetteer is not NOAA's reference table. A place renamed, merged or dissolved since 2006 may be missing, and a unique name in today's gazetteer could still be the wrong place if NOAA's table held another of that name. The gazetteer's internal point can sit away from the center or post office NOAA used, and the coordinates are rounded to the minute, which together put correct starts a median of about a kilometer off.

Ends were not compared, and nor were releases before 2000. Many misplaced starts have an end at the same point as the start, so their ends are likely misplaced too, but this record did not test them.

The chance control is one reflected point per record. It shows that a 3 km match with an episode event is rare by chance, and it is not a full estimate of the false match rate.

## The list

[`noaa-begin-text-2026-11-16.csv`](noaa-begin-text-2026-11-16.csv) holds all 989 flagged starts from the 2001 to 2006 releases, one row each, sorted by release, state, county and record. Its columns are the source record, the annual release and logical CSV record from the county screen, the NOAA state and county, the begin text, the published latitude and longitude, the gazetteer place used, the text point's latitude and longitude, the distance in km to one decimal, whether the text point lies in the labeled county, the outcome, and for a start at another event of the episode, that event's record, type and begin text. The outcome is one of `start carries another event of the episode`, `text far from the published start`, `text near the published start`, `name not in gazetteer` or `name ambiguous in state`.

## Reproduction

The comparison is standard library Python scripts kept outside the repository with their output. They need the gazetteer and county files above, the NOAA annual releases the catalogue cites, the locations files above and the county screen's list. The five NCEI documents read are kept outside the repository with the hashes given here. A rerun on the same inputs gives the same CSV, whose SHA-256 is `2c5d9c6b769a6975c8bd050e15f2add6785f3909d58f84be7fcfb91fdf45f4bf`.
