# State boundary screen of catalogue positions

Screened November 14, 2026. I tested every begin and end position in the published catalogue of 80,318 NOAA records against the polygon of the state its record names. 127 positions on 102 records lie more than 0.1 degrees outside that polygon, and each one matches its row in the retained NOAA annual file. 66 of those records have a flagged start. They are now disputed in `location-reviews.json`. 56 are new, and the other 10 were reviewed in September and stay as they were. The 15 records whose only flagged position is an end, and the 21 records whose flagged positions sit just outside their own state, are listed below and not marked.

The [September 24 review](location-reviews-2026-09-24.md) used a broad mainland envelope and said it was not an audit of state boundaries. This screen is that audit for one question only: does a reported position fall inside the state its record names?

## Boundaries

The polygons come from the Census Bureau's 2023 cartographic boundary file at 1:500,000, [`cb_2023_us_state_500k.zip`](https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip), 3,249,332 bytes, SHA-256 `4a9b4f5cf993cd23738ac49b58fbb556f1f097fcf5e404a9dc10348dd41f7432`. It was retrieved on November 13 and again on November 14, 2026, and both copies have that hash. The server reported Last-Modified `Tue, 16 Apr 2024 12:24:27 GMT`. The file is kept outside the repository and the site does not use it.

## Method

The screen reads the shapefile and its attribute table with the Python standard library and no other package. Each state is the set of rings in its record, and a position is inside when a ray from it crosses those rings an odd number of times. NOAA writes `VIRGIN ISLANDS` where the Census file writes `United States Virgin Islands`, and the screen treats them as one name. All 133,527 positions with a state label were screened, and no label went unmatched.

For a position outside its labeled state, the screen measures the planar distance in degrees of longitude and latitude to the nearest edge of that state's polygon. A position counts only when that distance is more than 0.1 degrees. Each counted position falls in one of three groups:

1. Inside another state's polygon.
2. In no state's polygon, nearer its own state than any other, and within 1 degree of it. Here that means coastal water, the Great Lakes or just across a national border.
3. In no state's polygon and either more than 1 degree from its own state or nearer another state.

Every counted position was then read from its row in the retained NOAA annual file, and all 127 gave the same point. The catalogue screened is the one that includes NOAA's October 26, 2026 revision of 2012. No 2012 record is flagged.

## Why only starts are disputed

A disputed review excludes the start from ordinary map groups and fitted views and shows it only through the explicitly labeled reported position action. The review model has no way to exclude only an end. Marking a record whose start passed the screen would hide a start that nothing contradicts. So the records in groups 1 and 3 with a flagged start are disputed, and everything else is listed here and left as published.

Each new entry binds the review to the source URL, release, SHA-256, logical CSV row and both reported positions, like the September entries. Its reason names the label, the flagged start, its distance outside the labeled state and where it lies. No coordinate is corrected and no position is substituted.

## Disputed starts

The 66 records with a start more than 0.1 degrees outside their labeled state, in group 1 or group 3. The 10 marked as already reviewed keep their September entries. 18 of these records also have a flagged end, which is not listed separately. So the 127 positions are these 66 starts, those 18 ends, the 15 ends in the second table and the 28 positions in the third.

"In no state" does not always mean water. By the Natural Earth country outline the site already draws, the starts for Nueces, Reeves and Sherman in Texas fall on land in Mexico.

| Source record | Source place label | Reported start, latitude / longitude | Degrees outside | Where it lies | Annual release and logical CSV record |
| --- | --- | --- | --- | --- | --- |
| `ncei:9979842` | Tuscaloosa, Alabama | 33.3 / -88.65 | 0.344 | inside Mississippi | [1983 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1983_c20260323.csv.gz), row 1939 |
| `ncei:5599610` (already reviewed) | Apple Vly Arpt, California | 34.6 / -12.18 | 101.952 | in no state | [1997 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1997_c20260323.csv.gz), row 23731 |
| `ncei:9991247` | San Joaquin, California | 37.93 / -112.2 | 3.807 | inside Utah | [1978 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1978_c20260323.csv.gz), row 3398 |
| `ncei:9988744` | Hardee, Florida | 27.55 / -84.3 | 1.484 | in no state | [1968 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1968_c20260323.csv.gz), row 2033 |
| `ncei:9999122` | Escambia, Florida | 30.18 / -87.5 | 0.102 | in no state, nearest Alabama | [1991 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1991_c20260323.csv.gz), row 6576 |
| `ncei:9999379` | Miami-Dade, Florida | 25.78 / -83.33 | 1.216 | in no state | [1972 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1972_c20260323.csv.gz), row 1038 |
| `ncei:9993463` (already reviewed) | Bulloch, Georgia | 20.85 / -156.0 | 71.642 | in no state | [1974 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1974_c20260323.csv.gz), row 2530 |
| `ncei:10004918` | Massac, Illinois | 37.27 / -88.2 | 0.189 | inside Kentucky | [1989 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1989_c20260323.csv.gz), row 6131 |
| `ncei:10005328` | Rock Island, Illinois | 41.95 / -90.57 | 0.328 | inside Iowa | [1981 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1981_c20260323.csv.gz), row 2524 |
| `ncei:10009712` | Kankakee, Illinois | 41.17 / -87.33 | 0.197 | inside Indiana | [1950 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1950_c20260323.csv.gz), row 190 |
| `ncei:10010918` | Crawford, Illinois | 39.0 / -87.18 | 0.335 | inside Indiana | [1959 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1959_c20260323.csv.gz), row 1208 |
| `ncei:10005168` | Randolph, Indiana | 40.1 / -84.63 | 0.179 | inside Ohio | [1955 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1955_c20260323.csv.gz), row 1166 |
| `ncei:5264264` | Wheeler, Indiana | 42.51667 / -87.18333 | 0.836 | in no state, nearest Illinois | [2001 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2001_c20260323.csv.gz), row 40031 |
| `ncei:5598628` | Lagrange, Indiana | 42.08 / -86.0 | 0.320 | inside Michigan | [1997 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1997_c20260323.csv.gz), row 12148 |
| `ncei:5598629` | Angola Airport, Indiana | 42.27 / -85.08 | 0.510 | inside Michigan | [1997 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1997_c20260323.csv.gz), row 12149 |
| `ncei:5598735` | Stone Lake, Indiana | 42.3 / -86.47 | 0.540 | in no state, nearest Michigan | [1997 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1997_c20260323.csv.gz), row 30809 |
| `ncei:10013620` | Clinton, Iowa | 42.87 / -90.58 | 0.267 | inside Wisconsin | [1965 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1965_c20260323.csv.gz), row 1461 |
| `ncei:10013899` | Jasper, Iowa | 46.15 / -93.18 | 2.650 | inside Minnesota | [1979 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1979_c20260323.csv.gz), row 2626 |
| `ncei:10025254` | Morris, Kansas | 38.72 / -90.68 | 3.929 | inside Missouri | [1964 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1964_c20260323.csv.gz), row 2330 |
| `ncei:10025263` | Lyon, Kansas | 30.45 / -96.12 | 6.549 | inside Texas | [1964 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1964_c20260323.csv.gz), row 1325 |
| `ncei:10025264` | Lyon, Kansas | 30.53 / -96.08 | 6.469 | inside Texas | [1964 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1964_c20260323.csv.gz), row 1326 |
| `ncei:10030692` | Madison, Louisiana | 31.52 / -91.25 | 0.165 | inside Mississippi | [1973 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1973_c20260323.csv.gz), row 3886 |
| `ncei:10030693` | East Carroll, Louisiana | 31.55 / -91.27 | 0.138 | inside Mississippi | [1973 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1973_c20260323.csv.gz), row 3887 |
| `ncei:10032689` | Calcasieu, Louisiana | 30.1 / -97.33 | 3.414 | inside Texas | [1953 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1953_c20260323.csv.gz), row 476 |
| `ncei:10033042` | Cameron, Louisiana | 39.97 / -92.97 | 6.953 | inside Missouri | [1966 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1966_c20260323.csv.gz), row 1478 |
| `ncei:5605850` | Richmond, Massachusetts | 42.38 / -73.57 | 0.159 | inside New York | [1997 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1997_c20260323.csv.gz), row 4640 |
| `ncei:10047807` | Mower, Minnesota | 44.72 / -92.48 | 0.147 | inside Wisconsin | [1982 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1982_c20260323.csv.gz), row 2615 |
| `ncei:10047808` | Fillmore, Minnesota | 44.75 / -92.45 | 0.184 | inside Wisconsin | [1982 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1982_c20260323.csv.gz), row 2313 |
| `ncei:5334504` | Clontarf, Minnesota | 45.38333 / -96.83333 | 0.126 | inside South Dakota | [2003 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2003_c20260323.csv.gz), row 8213 |
| `ncei:5409819` | Wilno, Minnesota | 44.61667 / -96.66667 | 0.215 | inside South Dakota | [2004 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2004_c20260323.csv.gz), row 36465 |
| `ncei:10050841` | Holmes, Mississippi | 30.15 / -89.85 | 0.243 | inside Louisiana | [1969 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1969_c20260323.csv.gz), row 637 |
| `ncei:10058762` | Crawford, Missouri | 36.13 / -91.35 | 0.367 | inside Arkansas | [1982 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1982_c20260323.csv.gz), row 897 |
| `ncei:10058763` | Franklin, Missouri | 36.2 / -91.28 | 0.297 | inside Arkansas | [1982 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1982_c20260323.csv.gz), row 898 |
| `ncei:10065287` | Dawes, Nebraska | 43.63 / -102.85 | 0.630 | inside South Dakota | [1983 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1983_c20260323.csv.gz), row 2135 |
| `ncei:10069480` | Cheyenne, Nebraska | 40.85 / -103.18 | 0.152 | inside Colorado | [1959 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1959_c20260323.csv.gz), row 657 |
| `ncei:5268078` | Cal-Nev-Ari, Nevada | 33.98333 / -115.55 | 1.368 | inside California | [2001 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2001_c20260323.csv.gz), row 47330 |
| `ncei:10079133` | Hillsborough, New Hampshire | 43.1 / -72.8 | 0.304 | inside Vermont | [1968 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1968_c20260323.csv.gz), row 1370 |
| `ncei:5714606` | Enfield Center, New Hampshire | 44.58 / -72.15 | 0.285 | inside Vermont | [1999 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1999_c20260323.csv.gz), row 20143 |
| `ncei:5543162` | Monroe, North Carolina | 34.7 / -80.57 | 0.118 | inside South Carolina | [1996 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1996_c20260323.csv.gz), row 42266 |
| `ncei:10082804` | Grand Forks, North Dakota | 48.92 / -97.05 | 0.135 | inside Minnesota | [1978 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1978_c20260323.csv.gz), row 1039 |
| `ncei:10100462` | Preble, Ohio | 38.58 / -84.55 | 0.402 | inside Kentucky | [1986 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1986_c20260323.csv.gz), row 4725 |
| `ncei:10110748` | Codington, South Dakota | 44.9 / -96.08 | 0.372 | inside Minnesota | [1951 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1951_c20260323.csv.gz), row 135 |
| `ncei:10110946` | Union, South Dakota | 42.6 / -99.6 | 0.398 | inside Nebraska | [1969 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1969_c20260323.csv.gz), row 896 |
| `ncei:10113360` | Todd, South Dakota | 43.02 / -110.17 | 6.117 | inside Wyoming | [1962 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1962_c20260323.csv.gz), row 902 |
| `ncei:10123210` | Tipton, Tennessee | 36.4 / -89.97 | 0.309 | inside Missouri | [1981 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1981_c20260323.csv.gz), row 2132 |
| `ncei:10125206` | Lauderdale, Tennessee | 35.72 / -90.15 | 0.191 | inside Arkansas | [1959 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1959_c20260323.csv.gz), row 1160 |
| `ncei:10121091` | Nueces, Texas | 24.57 / -97.77 | 1.317 | in no state | [1956 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1956_c20260323.csv.gz), row 542 |
| `ncei:10122107` | Polk, Texas | 34.05 / -94.93 | 0.191 | inside Oklahoma | [1959 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1959_c20260323.csv.gz), row 178 |
| `ncei:10122284` | Dallas, Texas | 37.48 / -96.97 | 3.185 | inside Kansas | [1957 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1957_c20260323.csv.gz), row 1447 |
| `ncei:10122345` | Reeves, Texas | 31.32 / -108.75 | 2.182 | in no state, nearest New Mexico | [1961 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1961_c20260323.csv.gz), row 1507 |
| `ncei:10129922` | Fannin, Texas | 33.88 / -96.33 | 0.116 | inside Oklahoma | [1976 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1976_c20260323.csv.gz), row 3026 |
| `ncei:10132439` | Refugio, Texas | 28.17 / -92.38 | 2.098 | in no state, nearest Louisiana | [1967 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1967_c20260323.csv.gz), row 2675 |
| `ncei:10133509` | Hardin, Texas | 36.33 / -94.17 | 2.574 | inside Arkansas | [1967 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1967_c20260323.csv.gz), row 2501 |
| `ncei:10134824` | Sherman, Texas | 26.48 / -101.7 | 2.249 | in no state | [1968 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1968_c20260323.csv.gz), row 2829 |
| `ncei:10142713` | Fannin, Texas | 33.95 / -96.37 | 0.182 | inside Oklahoma | [1984 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1984_c20260527.csv.gz), row 6050 |
| `ncei:10144750` | Fannin, Texas | 34.15 / -96.32 | 0.356 | inside Oklahoma | [1983 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1983_c20260323.csv.gz), row 7289 |
| `ncei:10149563` | Walla Walla, Washington | 45.9 / -118.6 | 0.101 | inside Oregon | [1964 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1964_c20260323.csv.gz), row 2309 |
| `ncei:5606609` (already reviewed) | Nespelem, Washington | 48.17 / -12.42 | 104.519 | in no state | [1997 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1997_c20260323.csv.gz), row 9014 |
| `ncei:5606610` (already reviewed) | Nespelem, Washington | 48.17 / -12.42 | 104.519 | in no state | [1997 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1997_c20260323.csv.gz), row 9015 |
| `ncei:10148750` | Ohio, West Virginia | 39.55 / -82.33 | 0.602 | inside Ohio | [1961 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1961_c20260323.csv.gz), row 2061 |
| `ncei:10159477` (already reviewed) | Big Horn, Wyoming | 18.27 / -66.75 | 43.684 | inside Puerto Rico | [1959 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1959_c20260323.csv.gz), row 1507 |
| `ncei:10159507` (already reviewed) | Natrona, Wyoming | 18.2 / -67.2 | 43.337 | in no state | [1962 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1962_c20260323.csv.gz), row 1788 |
| `ncei:10161496` (already reviewed) | Laramie, Wyoming | 18.2 / -67.2 | 43.337 | in no state | [1965 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1965_c20260323.csv.gz), row 2095 |
| `ncei:10161755` (already reviewed) | Goshen, Wyoming | 18.3 / -66.1 | 44.224 | inside Puerto Rico | [1969 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1969_c20260323.csv.gz), row 2055 |
| `ncei:10161769` (already reviewed) | Goshen, Wyoming | 18.2 / -65.3 | 44.964 | in no state | [1969 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1969_c20260323.csv.gz), row 2069 |
| `ncei:10162873` (already reviewed) | Platte, Wyoming | 18.4 / -67.25 | 43.189 | in no state | [1972 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1972_c20260323.csv.gz), row 1417 |

## Flagged ends, not marked

The 15 records whose start passed the screen and whose end lies more than 0.1 degrees outside the labeled state, in group 1 or group 3.

| Source record | Source place label | Point | Latitude / longitude | Degrees outside | Where it lies | Annual release and logical CSV record |
| --- | --- | --- | --- | --- | --- | --- |
| `ncei:10001119` | Jackson, Florida | end | 31.05 / -84.9 | 0.113 | inside Georgia | [1988 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1988_c20260323.csv.gz), row 6305 |
| `ncei:10005143` | Randolph, Indiana | end | 40.2 / -84.5 | 0.306 | inside Ohio | [1955 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1955_c20260323.csv.gz), row 745 |
| `ncei:10013619` | Cedar, Iowa | end | 42.87 / -90.92 | 0.164 | inside Wisconsin | [1965 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1965_c20260323.csv.gz), row 1460 |
| `ncei:5702521` | Protection, Kansas | end | 35.15 / -99.48 | 1.850 | inside Oklahoma | [1999 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1999_c20260323.csv.gz), row 8322 |
| `ncei:10072246` | Fallon, Montana | end | 46.37 / -103.12 | 0.925 | inside North Dakota | [1952 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1952_c20260323.csv.gz), row 67 |
| `ncei:10065596` | Douglas, Nebraska | end | 41.25 / -95.53 | 0.320 | inside Iowa | [1968 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1968_c20260323.csv.gz), row 709 |
| `ncei:10068026` | Richardson, Nebraska | end | 40.73 / -95.6 | 0.182 | inside Iowa | [1965 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1965_c20260323.csv.gz), row 635 |
| `ncei:10344037` | Optima, Oklahoma | end | 37.12 / -101.27 | 0.123 | inside Kansas | [1993 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1993_c20260323.csv.gz), row 4274 |
| `ncei:10110317` | Dillon, South Carolina | end | 34.47 / -79.1 | 0.112 | inside North Carolina | [1963 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1963_c20260323.csv.gz), row 285 |
| `ncei:10346513` | Inman To To 3 Se Ches, South Carolina | end | 35.4 / -81.23 | 0.240 | inside North Carolina | [1994 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1994_c20260323.csv.gz), row 5950 |
| `ncei:10112657` | Lincoln, South Dakota | end | 44.37 / -96.13 | 0.322 | inside Minnesota | [1968 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1968_c20260323.csv.gz), row 354 |
| `ncei:10124655` | Fall River, South Dakota | end | 43.3 / -104.9 | 0.846 | inside Wyoming | [1983 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1983_c20260323.csv.gz), row 4554 |
| `ncei:10123987` | Obion, Tennessee | end | 36.63 / -88.9 | 0.128 | inside Kentucky | [1967 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1967_c20260323.csv.gz), row 692 |
| `ncei:10161762` | Goshen, Wyoming | end | 41.92 / -103.95 | 0.103 | inside Nebraska | [1969 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1969_c20260323.csv.gz), row 2062 |
| `ncei:5650678` | Torrington, Wyoming | end | 42.43 / -103.7 | 0.353 | inside Nebraska | [1998 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1998_c20260323.csv.gz), row 43949 |

## Beside their own state, not marked

The 21 records whose flagged positions are all in group 2. Against the coarse Natural Earth country outline the site already draws, 4 of these 28 positions fall in Canada and 3 in Mexico. The rest fall over water or on a shoreline that outline does not resolve.

| Source record | Source place label | Point | Latitude / longitude | Degrees outside | Annual release and logical CSV record |
| --- | --- | --- | --- | --- | --- |
| `ncei:10000283` | Escambia, Florida | start | 30.23 / -86.92 | 0.139 | [1973 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1973_c20260323.csv.gz), row 2660 |
| `ncei:10002012` | Volusia, Florida | end | 29.05 / -79.92 | 0.802 | [1983 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1983_c20260323.csv.gz), row 4611 |
| `ncei:9987238` | Volusia, Florida | start | 29.05 / -80.3 | 0.503 | [1961 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1961_c20260323.csv.gz), row 411 |
| `ncei:9987269` | Lake, Florida | start | 25.9 / -81.9 | 0.155 | [1962 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1962_c20260323.csv.gz), row 1107 |
| `ncei:9991475` | Duval, Florida | start | 30.3 / -80.53 | 0.835 | [1953 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1953_c20260323.csv.gz), row 2 |
| `ncei:9991475` | Duval, Florida | end | 30.33 / -80.52 | 0.852 | [1953 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1953_c20260323.csv.gz), row 2 |
| `ncei:9999427` | Duval, Florida | end | 30.6 / -81.33 | 0.111 | [1973 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1973_c20260323.csv.gz), row 4083 |
| `ncei:5431047` | Aiea, Hawaii | start | 21.38333 / -158.91667 | 0.663 | [2004 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2004_c20260323.csv.gz), row 2714 |
| `ncei:5431047` | Aiea, Hawaii | end | 21.38333 / -158.91667 | 0.663 | [2004 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2004_c20260323.csv.gz), row 2714 |
| `ncei:5484719` | Aiea, Hawaii | start | 21.38333 / -158.95 | 0.679 | [2005 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2005_c20260323.csv.gz), row 53161 |
| `ncei:5484719` | Aiea, Hawaii | end | 21.38333 / -158.95 | 0.679 | [2005 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2005_c20260323.csv.gz), row 53161 |
| `ncei:10030475` | Plaquemines, Louisiana | start | 28.95 / -92.5 | 0.604 | [1957 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1957_c20260323.csv.gz), row 1506 |
| `ncei:10042625` | Waldo, Maine | start | 45.28 / -67.2 | 0.109 | [1954 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1954_c20260323.csv.gz), row 148 |
| `ncei:10038343` | Wayne, Michigan | end | 42.28 / -82.75 | 0.181 | [1973 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1973_c20260323.csv.gz), row 1432 |
| `ncei:10040618` | Presque Isle, Michigan | end | 45.48 / -83.62 | 0.106 | [1964 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1964_c20260323.csv.gz), row 272 |
| `ncei:5461153` | Angle Inlet, Minnesota | start | 48.93333 / -93.83333 | 0.303 | [2005 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2005_c20260323.csv.gz), row 34168 |
| `ncei:5461153` | Angle Inlet, Minnesota | end | 48.9 / -93.75 | 0.286 | [2005 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2005_c20260323.csv.gz), row 34168 |
| `ncei:5567533` | Granby, New York | start | 43.48 / -76.73 | 0.118 | [1996 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1996_c20260323.csv.gz), row 34032 |
| `ncei:5567533` | Granby, New York | end | 43.48 / -76.73 | 0.118 | [1996 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1996_c20260323.csv.gz), row 34032 |
| `ncei:10120077` | Galveston, Texas | end | 29.13 / -94.65 | 0.211 | [1961 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1961_c20260323.csv.gz), row 261 |
| `ncei:10133548` | Galveston, Texas | start | 29.37 / -94.38 | 0.171 | [1969 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1969_c20260323.csv.gz), row 2397 |
| `ncei:10133549` | Galveston, Texas | start | 29.37 / -94.38 | 0.171 | [1969 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1969_c20260323.csv.gz), row 2398 |
| `ncei:10133879` | Jefferson, Texas | start | 29.43 / -94.4 | 0.108 | [1970 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1970_c20260323.csv.gz), row 2826 |
| `ncei:10133879` | Jefferson, Texas | end | 29.38 / -94.35 | 0.172 | [1970 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1970_c20260323.csv.gz), row 2826 |
| `ncei:10133881` | Jefferson, Texas | start | 29.43 / -94.4 | 0.108 | [1970 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1970_c20260323.csv.gz), row 2828 |
| `ncei:10142383` | Hidalgo, Texas | end | 25.97 / -98.27 | 0.104 | [1983 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1983_c20260323.csv.gz), row 6984 |
| `ncei:10142384` | Hidalgo, Texas | start | 25.97 / -98.27 | 0.104 | [1983 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1983_c20260323.csv.gz), row 6985 |
| `ncei:10142384` | Hidalgo, Texas | end | 25.95 / -98.28 | 0.126 | [1983 release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1983_c20260323.csv.gz), row 6985 |

## Limits

A degree is a screening unit, not a ground distance. 0.1 degrees of latitude is about 11 km. 0.1 degrees of longitude is about 10 km at 25 degrees north and about 7 km at 49 degrees north, so the threshold is stricter in the north.

A 1:500,000 cartographic file generalizes rivers and coastlines and clips states at the shoreline. Positions on a coast, a bay or a lake fall outside every state for that reason alone, which is why group 2 is listed and not disputed.

Two disputed starts pass the threshold by less than the boundary file can resolve. `ncei:10149563`, Walla Walla, Washington, at 45.9 / -118.6, is 0.101 degrees inside Oregon, where the state line follows the 46th parallel, so its true distance is 0.100. `ncei:9999122`, Escambia, Florida, at 30.18 / -87.5, is 0.102 degrees out in water near the Alabama line, which is the shoreline case above. They meet the rule as the screen applies it, so they are disputed, but a reviewer could fairly move either one to the unmarked lists. The third decimal in these tables is the screen's arithmetic, not the precision of the boundaries.

A start that lies on the wrong side of a state line by less than 0.1 degrees is not flagged. A start inside the right state but in the wrong county is not tested. County attribution, the order of a record's two positions and the distance between them are outside this screen.

A flagged start shows that the source fields conflict. It does not say which field is wrong. The coordinate, the state label or the precision of an older record could each explain it, and this screen does not decide between them.

Records with no reported position are not screened. They stay searchable as before.

## Publication

The browser catalogue was exported again from the same database as the 2012 revision. Exporting with the earlier reviews reproduced the published files byte for byte before the new entries were added. With them, 56 index rows gain `location_quality` `disputed`, the 51 detail files that hold those records are written under new names beside the existing ones, and the archive index points to the new detail files. No record is added or removed, and no source value changes.
