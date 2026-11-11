# The nine NWS damage photographs belong to nine survey records

Each of the nine NWS gallery photographs in `exhibits/el-reno-2013/damage.json` is pixel for pixel the same photograph as one original attached to a NWS Damage Assessment Toolkit (DAT) survey record. The file on the NWS event page is a separate encoding of it. Each photograph therefore has a known survey record, damage indicator, degree of damage, rating and surveyed point. The point is where the DAT records the damaged structure. It is not a camera position or a capture time, so `coordinates` and `captured_at` in `damage.json` stay null.

The [September 20 survey location record](damage-locations-2026-09-20.md) left these photographs unmatched. A byte-size comparison on November 10 found no gallery file that shared a size with any of the 89 retained attachment records. Two encodings of one photograph differ in bytes, so the comparison had to be made on decoded pixels.

## Inputs

* **Gallery.** The nine JPEGs at `web/assets/el-reno-2013/damage01.jpg` to `damage09.jpg`, preserved unchanged from the NWS Norman event page on 2026-09-20, with the hashes and sizes recorded in `damage.json`. Each entry's `caption` is a short project paraphrase attributed to NWS, as `THIRD_PARTY.md` states. Its `location_description` carries the roads or landmark.
* **Attachments.** The retained response `exhibits/el-reno-2013/survey-attachments-response.json` names 45 original attachments and 44 thumbnails on 45 survey records. On 2026-11-11, between 07:21:39 and 07:22:27 UTC, one GET per original at `https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/MapServer/0/{parent}/attachments/{id}` returned 45 files and 43,331,924 bytes. Every file's length equals the size declared in the retained response. The files are not committed. NOAA hosts them, and the attachment metadata names no photographer.
* **Survey points.** The retained point response `exhibits/el-reno-2013/survey-response.json` from 2026-09-20, in WGS 84 (`wkid` 4326).

## Method

Every image was decoded with Pillow 12.3.0 and turned upright by any EXIF orientation tag. None of the 18 files in the matched pairs carries an EXIF segment.

The first pass compared each gallery photograph with all 45 originals. Both images were reduced to 64 by 48 grayscale pixels and scored by normalized cross-correlation, where 1 means the same pattern of light and dark. Each comparison tried eight orientations: four rotations, each with and without a mirror. The second pass took the best original for each photograph and compared full-color pixels at native size, with no resizing.

## Results

Every photograph has exactly one original that scores 1.0000 in the first pass. No other original scores above 0.7456 for any photograph. In the second pass every pair has the same dimensions and orientation. The mean absolute difference is 0.50 to 0.58 on a 0 to 255 scale, 99.86 to 99.93 percent of values differ by 3 or less, the largest difference anywhere is 5 to 8, and the peak signal-to-noise ratio is 48.5 to 49.3 dB. A second exposure of the same scene would differ far more, even from a tripod, because noise and light change between frames. The JPEG settings also differ: every DAT original uses quantization tables of all 1, while every gallery file's brightness table uses steps of 1 and 2. Those are two encodings of one photograph.

Because each pair has identical dimensions and its largest difference is 8 at zero offset, the match also rules out a crop, a resized copy or a shifted copy.

| Photo | DAT record | Attachment | Original bytes and SHA-256 | Pixels | Runner-up | Mean abs. difference | PSNR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 165524 `{36553DD3-317E-478C-B2AD-43E6F7734A59}` | 112145 `apHmtMGy_1370101592082.jpg` | 1,065,229 `c213647f83fa765ec4b9f6f4acbf1528504d60a1a8bcff78a8179db94182fe5c` | 1280 × 960 | 0.3552 | 0.561 | 48.68 dB |
| 2 | 165486 `{C4E2FA6B-B91B-4237-83E3-2EB69004372B}` | 112129 `apHmtMGy_1370098696867.jpg` | 859,553 `6271226a41145b12b76825c4d24998f9aba067a34010b1fb4aed601bfe75d184` | 1280 × 960 | 0.6934 | 0.521 | 49.12 dB |
| 3 | 165638 `{81E1CF73-3A74-4E39-B9B4-EEA5947D99B7}` | 112214 `apHmtMGy_1370109741882.jpg` | 974,326 `41f52f5b6680af3a5e1945aa5a78d4c0ff4f4da48f1c620ec9402eca14b668a0` | 1280 × 960 | 0.2785 | 0.555 | 48.77 dB |
| 4 | 165650 `{E6BBE8A0-F204-45C0-AC67-BFB2F7AC16CB}` | 112218 `apHmtMGy_1370110729160.jpg` | 1,052,538 `89cff4d83b4500d8e3e6f4b8d8893077af1078d9099f934f21d6cbc30f17a86a` | 1280 × 960 | 0.4546 | 0.577 | 48.53 dB |
| 5 | 165632 `{650A7C8C-9982-4245-B726-4544EFD44E40}` | 112210 `apHmtMGy_1370109008851.jpg` | 1,014,353 `96fcb1fc45297c73aebb7fa86fbf6289d3a38f6c0a8273f30ede8c667bdddfa1` | 1280 × 960 | 0.3219 | 0.562 | 48.70 dB |
| 6 | 165712 `{016BDA8E-BB63-4D28-B3FA-A34FBCEB098F}` | 112252 `apHmtMGy_1370117456017.jpg` | 1,014,799 `68cd3db1d9db5d30cbe7a1f21339883387c2086122e9686381bc5d7ddc3ac606` | 1280 × 960 | 0.2848 | 0.544 | 48.88 dB |
| 7 | 165695 `{5CDE4603-09CA-48E7-B5CA-C09AA04FE98C}` | 112236 `apHmtMGy_1370113516991.jpg` | 788,464 `eda5c0c782675fbc591b7e2d99b4c7b0cc3dd3a210c84e1f0edb1a979a42a7e2` | 960 × 1280 | 0.7456 | 0.557 | 48.76 dB |
| 8 | 165757 `{6F3D68FA-2A0B-40EC-AAF2-DAA985C29B0E}` | 112272 `apHmtMGy_1370119867851.jpg` | 879,976 `436f8c1852e543ff1d99aa5d9fb28c92985ce6bcc8e8f2941b92ff6c31ed2164` | 960 × 1280 | 0.4387 | 0.497 | 49.31 dB |
| 9 | 165756 `{2F04D0F0-ECB1-4397-8CE0-F11400B20A92}` | 112270 `apHmtMGy_1370119678313.jpg` | 1,130,441 `cfd468f8f75c6bfcd2487ad5fd49897fbc339cc6af41092a469e7572d445dfd8` | 960 × 1280 | 0.4733 | 0.582 | 48.50 dB |

## What each survey record says

The DAT text is quoted as published. The gallery caption is the project's paraphrase and the rating is the one NWS reported, both from `damage.json`. Coordinates are the retained response's values exactly as published, with digits that say nothing about survey accuracy.

| Photo | Gallery caption (project paraphrase) and NWS rating | DAT damage indicator | DAT degree of damage | DAT rating | Published longitude, latitude |
| --- | --- | --- | --- | --- | --- |
| 1 | Exterior walls collapsed at this house. EF3 | One- or Two-Family Residences (FR12) | Exterior walls collapsed | EF3 | -98.010758785999997, 35.44992141900002 |
| 2 | Rigid frames progressively collapsed in this metal building. EF3 | Metal Building System (MBS) | Progressive collapse of rigid frames | EF3 | -98.007589999999993, 35.451459999999997 |
| 3 | All walls collapsed at this house. EF3 | One- or Two-Family Residences (FR12) | All walls collapsed | EF3 | -97.931299684999999, 35.450331377999987 |
| 4 | Large sections of the roof were removed; most walls remained standing. EF2 | One- or Two-Family Residences (FR12) | Large sections of roof structure removed; most walls remain standing | EF2 | -97.930306597000026, 35.450442522000003 |
| 5 | Large sections of the roof were removed; most walls remained standing. EF2 | One- or Two-Family Residences (FR12) | Large sections of roof structure removed; most walls remain standing | EF2 | -97.932165368000028, 35.45040321099998 |
| 6 | Rigid frames progressively collapsed in this metal and steel building. EF3 | Metal Building System (MBS) | Progressive collapse of rigid frames | EF3 | -97.876239716999976, 35.503874472000007 |
| 7 | Steel electrical power poles were bent or broken. EF3 | Electrical Transmission Lines (ETL) | Broken or bent steel or concrete poles | EF3 | -97.901578042999972, 35.494400574999986 |
| 8 | Exterior walls collapsed in a large metal and steel building. EF3 | Large, Isolated Retail Building [K-Mart, Wal-Mart] (LIRB) | Inward or outward collapse of exterior walls | EF3 | -97.880946659000017, 35.509854499000028 |
| 9 | Rigid frames progressively collapsed in a large metal and steel building. EF3 | Metal Building System (MBS) | Progressive collapse of rigid frames | EF3 | -97.880958141999997, 35.510495923999997 |

All nine ratings agree. Eight of the nine indicators match the gallery's `subject` field (House, Metal building, Infrastructure). Photo 8 is the exception: the gallery's subject is Metal building and its caption says a large metal and steel building, while its survey record uses the Large, Isolated Retail Building indicator. The pixel match does not decide which label is better, so both stay as published.

## Nearby records with the same indicator

The item asked for the survey records near each captioned place that share the photograph's indicator. Once the pixels named the record, the useful list is the one around that record's own point, because it shows what location and indicator alone would have left open. Distances are computed between published DAT points and rounded to 10 m.

| Photo | Other records with the same indicator within 400 m (degree of damage, rating, distance) |
| --- | --- |
| 1 | 165531 (Exterior walls collapsed, EF2, 80 m); 165515 (Large sections of roof structure removed; most walls remain standing, EF2, 240 m); 585916 (Loss of roof covering material (<20%), gutters and/or awning; loss of vinyl or metal siding, EF0, 290 m); 585915 (Large sections of roof structure removed; most walls remain standing, EF2, 350 m); 165491 (Uplift of roof deck and loss of significant roof covering material (>20%); collapse of chimney; garage doors collapse inward; failure of porch or carport, EF2, 360 m); 165521 (Most walls collapsed, except small interior rooms, EF3, 400 m) |
| 2 | None |
| 3 | 165632 (Large sections of roof structure removed; most walls remain standing, EF2, 80 m); 165650 (same degree, EF2, 90 m); 587116 (Loss of roof covering material (<20%), gutters and/or awning; loss of vinyl or metal siding, EF0, 180 m); 165658 (Large sections of roof structure removed; most walls remain standing, EF2, 340 m) |
| 4 | 165638 (All walls collapsed, EF3, 90 m); 587116 (Loss of roof covering material (<20%), gutters and/or awning; loss of vinyl or metal siding, EF0, 90 m); 165632 (Large sections of roof structure removed; most walls remain standing, EF2, 170 m); 165658 (same degree, EF2, 340 m) |
| 5 | 165638 (All walls collapsed, EF3, 80 m); 165650 (Large sections of roof structure removed; most walls remain standing, EF2, 170 m); 587116 (Loss of roof covering material (<20%), gutters and/or awning; loss of vinyl or metal siding, EF0, 260 m); 165658 (Large sections of roof structure removed; most walls remain standing, EF2, 340 m) |
| 6 | 165713 (Progressive collapse of rigid frames, EF3, 50 m) |
| 7 | None |
| 8 | 587525 (Uplift of roof decking; significant loss of roof covering (>20%); loss of rooftop HVAC equipment, EF1, 110 m); 586334 (Uplift and removal of roof structure, EF2, 110 m); 165758 (Long roof spans collapsed downward, EF2, 120 m); 586332, 586333 and 586331 (each Uplift of roof decking; significant loss of roof covering (>20%); loss of rooftop HVAC equipment, EF1, 200 to 210 m) |
| 9 | 587524 (Total destruction of building, EF3, 300 m) |

Two places could not have been settled without the pixels. Photos 4 and 5 share one paraphrased caption and EF2, and records 165632, 165650 and 165658 all carry that degree of damage and rating within 350 m of each other. Photo 6's record 165712 has a neighbor, 165713, about 50 m away with the same indicator, degree of damage and rating. The pixels name the record in each case. Elsewhere the degree of damage or the rating would have narrowed the choice, and photos 2 and 7 have no same-indicator neighbor at all.

## An independent check of the described places

One bounded OpenStreetMap read through the Overpass API on 2026-11-11 at 07:30:16 UTC returned 71,788 bytes, SHA-256 `876280ecdaa86024707a06cac158aab5006209803adf3b04880c0e33560f4be5`, with a map data timestamp of 2026-11-11T07:30:02Z. It asked for highways named like Airport, Rother, 15th, Jensen, Radio or Country Club in the box 35.40 to 35.56 N, 98.06 to 97.84 W, and for any feature named like Canadian Valley in the box 35.45 to 35.56 N, 97.95 to 97.84 W. The response is not committed. Named road ways that share a vertex give each described intersection. No Canadian Valley feature came back. Map data © OpenStreetMap contributors, available under the Open Database License.

The distances below are computed between a road centerline vertex and a DAT point whose accuracy the service does not state, so they are rounded to 10 m and a compass point.

| Location description | Intersection in the map data | Photo | Matched point from the intersection |
| --- | --- | --- | --- |
| Near S. Airport Road and SW 15th Street | 35.4496437, -98.0079878 | 1 | about 250 m W |
| | | 2 | about 210 m N |
| Near Rother Road and SW 15th Street | 35.4499608, -97.930565 | 3 | about 80 m WNW |
| | | 4 | about 60 m NNE |
| | | 5 | about 150 m WNW |
| Near Jensen Road and S. Radio Road | 35.49358, -97.9016083 | 7 | about 90 m N |

Every checked point lies within about 250 m of its described intersection, which fits the word "near". A second read for Interstate 40 and nearby schools around photos 6, 8 and 9 timed out and was not repeated. Those three are not checked against map geometry. Photos 8 and 9 lie about 70 m apart, which fits their shared location description.

## Times

Each record carries a `surveydate`. Each attachment name ends in a 13-digit number that, read as Unix milliseconds, falls within one second of its record's `surveydate` for eight photographs, between 14:58 and 20:51 UTC on June 1, 2013. Photo 2's gap is 16.9 seconds, and its `surveydate` is a whole minute, 14:58:00. Whole minutes are common in this response, 394 of its 424 survey dates, so the gap looks like rounding in that field. The match suggests the survey application named each file when its record was made. Neither field is documented as a capture time, and neither says when the tornado damaged the structure. `captured_at` stays null.

## Decision

* **Established:** each gallery photograph's DAT record, with the identity shown by decoded pixels, not by caption, size or proximity.
* **Supported:** the record's indicator, degree of damage, rating and surveyed point, as the DAT publishes them. The service describes its data as quality controlled but preliminary.
* **Not established:** camera position, capture time, photographer and the time of damage. The gallery's rights basis is unchanged. The DAT copies are not hosted.

`damage.json` is unchanged. Its validator rejects non-null `coordinates` and `captured_at` because the gallery schema means camera position and capture time. A survey-record link is a different field and a separate change. It would let the survey map select each photograph's surveyed point, and it changes what the exhibit shows.
