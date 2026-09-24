# Conflicting catalogue locations

Reviewed September 24, 2026. Three linked records prompted a bounded screen that identified six more candidates. All nine were traced from the published index to their immutable details and original NOAA CSV rows. Fresh downloads of the seven annual releases matched every retained SHA-256. The original source fields contain the contradictions. This is not a longitude/latitude swap or a rendering transform.

| Source record | Source place label | Reported start, latitude / longitude | Annual release and logical CSV record |
| --- | --- | --- | --- |
| `ncei:10159477` | Big Horn, Wyoming | 18.27 / -66.75 | [CSV release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1959_c20260323.csv.gz), row 1507 |
| `ncei:10159507` | Natrona, Wyoming | 18.2 / -67.2 | [CSV release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1962_c20260323.csv.gz), row 1788 |
| `ncei:10161496` | Laramie, Wyoming | 18.2 / -67.2 | [CSV release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1965_c20260323.csv.gz), row 2095 |
| `ncei:10161755` | Goshen, Wyoming | 18.3 / -66.1 | [CSV release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1969_c20260323.csv.gz), row 2055 |
| `ncei:10161769` | Goshen, Wyoming | 18.2 / -65.3 | [CSV release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1969_c20260323.csv.gz), row 2069 |
| `ncei:10162873` | Platte, Wyoming | 18.4 / -67.25 | [CSV release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1972_c20260323.csv.gz), row 1417 |
| `ncei:9993463` | Bulloch, Georgia | 20.85 / -156.0 | [CSV release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1974_c20260323.csv.gz), row 2530 |
| `ncei:5606609` | Nespelem, Washington | 48.17 / -12.42 | [CSV release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1997_c20260323.csv.gz), row 9014 |
| `ncei:5606610` | Nespelem, Washington | 48.17 / -12.42 | [CSV release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1997_c20260323.csv.gz), row 9015 |

The Goshen 1969 record lies in the Caribbean by its coordinates. The two Nespelem 1997 starts lie in the North Atlantic, while both end positions are reported in Washington. The other reviewed Wyoming labels also conflict with Caribbean coordinates, and the Bulloch, Georgia label conflicts with a Hawaii coordinate. These contradictions establish an unresolved location, not a replacement point. A missing longitude digit or mistaken place label may be a lead, but neither is promoted to a correction.

The screen checked mainland-labelled records against a deliberately broad geographic envelope and then inspected the nine source rows listed above. Six were additional to the three supplied links. This is not a complete audit of state boundaries, coastal records, county attribution or all 80,318 records. The existing Apple Vly review remains separate.

`location-reviews.json` binds each review to its source URL, release, hash, logical CSV record and exact start/end fields. The source-driven publication retains the coordinates and source identity. Disputed starts are excluded from ordinary groups and fitted views, remain searchable, and can be revealed explicitly. No duplicate-event assumption is made for the two Nespelem rows. Their source narratives describe two tornadoes.

A simplified land outline can also omit small islands. That separate basemap limitation is not evidence that a particular event coordinate is wrong and was not used to decide these flags.

## Playback context

The El Reno path map previously enabled the reviewed recovery overlay by default. That fixed location is independent of the playback clock. It can help orientation, but the initial view made it too easy to read it as a timed observation. The overlay is now off by default, with a control beside the map and a legend entry shown only when enabled. The damage map and sourced remembrance retain their existing records. Other victims are not assigned points without reviewed location evidence.
