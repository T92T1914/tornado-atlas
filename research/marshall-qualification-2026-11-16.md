# Marshall at 2314:42 UTC: an appearance qualification decision

The [Seimon record](seimon-el-reno-survey-2026-11-11.md) named T. Marshall's view near 2314:42 UTC as the strongest candidate for the first bounded El Reno appearance interval. This record takes that candidate through the registration contract in `atlas/event_package.py` for one interval and one viewpoint.

The answer is no. The interval is not admitted, and the replay package is unchanged. The only known edit of Marshall's video is not public, so no public route lets anyone inspect the interval, read a clock from it or tie an observation to an instant. The camera samples stay what they were, documentary context for the map. The paper's description of the moment stays a source statement. The candidate's qualified role is an unresolved lead.

## The interval examined

The paper's Fig. 4b pairs a G. Rhinehart still with a T. Marshall still at "2314:42 UTC". It places Marshall "NE of the tornado looking SW" and publishes an MPAR scan time of "2314:38 UTC" beside the stills. The paper names no clip, offset or edit for either still.

The retained Survey track for Marshall (`exhibits/el-reno-2013/camera-marshall-literal.txt`, from the metadata file of SHA-256 `529691b0c0639e912864b55b2b305a85a15a645d204f8e926b99ab635ecfd0b2`) reports these rows around that moment.

| Metadata UTC | Reported latitude | Reported longitude | Reported camera 1 azimuth |
| --- | --- | --- | --- |
| 2013-05-31T23:11:05Z | 35.488103 | -97.954941 | 250 |
| 2013-05-31T23:12:16Z | 35.488103 | -97.954941 | 225 |
| 2013-05-31T23:13:27Z | 35.488103 | -97.954941 | 225 |
| 2013-05-31T23:14:38Z | 35.488103 | -97.954941 | 225 |
| 2013-05-31T23:15:49Z | 35.488103 | -97.954941 | 225 |
| 2013-05-31T23:16:41Z | 35.488103 | -97.954941 | 220 |

The rows from 23:09:54Z to 23:15:49Z sit exactly 71 seconds apart, which is the step the paper gives for position fixes "coinciding with radar scans". The 23:14:38Z row shares its time with the published MPAR scan. The track does not say whether a row came from a GPS log or from matching a frame to Street View, and the same coordinates repeat to six decimals across all eight rows from 23:09:38Z to 23:16:41Z. The rows are reported values, not measurements made here.

The interval examined is 23:13:27Z to 23:15:49Z. Both ends and the middle are Survey fixes with the same reported position and azimuth, and it contains 2314:42. A fixed view is the only camera mode the contract accepts, and these rows are a stretch of the track where a fixed view is at least plausible. Sparse rows do not show that the car stayed still between them.

## Access on 2026-11-16

The Survey attaches Vimeo `143033121` to Marshall. The [September footage record](footage-registration-2026-09-21.md) found its player unavailable on 2026-09-20. I checked again with one request each and no player, browser or video download.

| UTC | Request | Result |
| --- | --- | --- |
| 22:29:21 | Vimeo oEmbed for `vimeo.com/143033121` | HTTP 404, body `404 Not Found`, 13 bytes |
| 22:29:22 | `player.vimeo.com/video/143033121` | HTTP 403, 3,700 bytes, visible text "Sorry", "This video isn't available. The owner has been notified." |
| 22:29:35 | Vimeo oEmbed for `vimeo.com/145291664` | HTTP 404, 13 bytes |
| 22:29:35 | `player.vimeo.com/video/145291664` | HTTP 403, 3,700 bytes, the same visible text |
| 22:29:41 | Vimeo oEmbed for `vimeo.com/76979871`, a public video from Vimeo's own documentation | HTTP 200, title "The New Vimeo Player (You Know, For Videos)" |
| 22:40:23 | `player.vimeo.com/video/76979871` | HTTP 200, 34,393 bytes, page title "The New Vimeo Player (You Know, For Videos) on Vimeo", no unavailable message |

The last two rows are the control. Vimeo answered both kinds of request for a public video normally from the same machine, so the 404 and the player message for `143033121` describe that video and not a refusal of the request type. `145291664` is the Survey's aligned edit of Dan Robinson's footage. It is unavailable in the same way today. The response bodies are retained outside the repository.

I also looked for any other edit of Marshall's footage. A YouTube search for "Tim Marshall El Reno tornado May 31 2013" returned 15 videos on 2026-11-16, none uploaded or credited as Marshall's footage. Two web searches found his photograph credit in the [2014 AMS conference manuscript](https://ams.confex.com/ams/27SLS/webprogram/Manuscript/Paper254342/ElReno-FINAL.pdf) and his part in the damage survey, and no public upload of his video. A search that finds nothing does not prove that no copy exists.

## The geometry the sources report

The reported position and azimuth can be compared with the NWS center positions in `exhibits/el-reno-2013/path.geojson` (SHA-256 `4073891bdb8137a89e48925142369582da8d96068818c2d6d22884690d5f4fd0`). Those positions are KML labels read to the nearest minute with no error bounds. Bearings below are initial great circle bearings from the reported camera position.

| NWS minute | Bearing to NWS center | Distance |
| --- | --- | --- |
| 23:12 | 236.9 degrees | 7.16 km |
| 23:13 | 229.1 degrees | 6.22 km |
| 23:14 | 224.1 degrees | 5.25 km |
| 23:15 | 222.7 degrees | 4.56 km |
| 23:16 | 213.8 degrees | 3.94 km |

The reported 225 degrees lies within 5 degrees of the bearing to the NWS center at 23:13, 23:14 and 23:15, and within 12 degrees at 23:12. Across 23:13 to 23:15 that agrees with the paper's "NE of the tornado looking SW". It is consistency and not a check. The paper says directions were estimated from road orientations and landscape features, and the Survey viewer draws its tornado circle from NWS centroids at one minute steps. Whether the analysts looked at an NWS track when setting an arrow is not stated, so the agreement is not independent.

The agreement does not hold at the next row. At 23:16:41Z the track reports 220 degrees. A straight line between the 23:16 and 23:17 centers gives a bearing of 204.6 degrees at that second, about 15 degrees away and wider than the paper's plus or minus 10 degrees. That line between minutes is an interpolation and not an observed position, so the gap shows only that the reported arrow and the NWS track stop agreeing once the center passes south. The distance is to the NWS center, not to the visible condensation, the rain curtain or anything a frame would show.

## The contract, part by part

`_validate_registration` admits a registered window only when every part below passes. Nothing here was entered into the package, so each line is what a registration would have to say and what exists to say it. The validator checks the form of each field and that the window names its footage source. It cannot tell whether an inspection or a calibration happened. The Result column is therefore a judgment of the evidence, which is stricter than what the code alone would refuse.

| Contract part | What it requires | What exists for 23:13:27Z to 23:15:49Z | Result |
| --- | --- | --- | --- |
| Footage source | A `source_id` naming an entry in `exhibits/el-reno-2013/footage.json`, with a duration | The register holds one source, Robinson's YouTube upload. Marshall has no entry, and no duration has been read from any Marshall edit | Fails |
| `source` | `url`, `video_id`, `original_locator`, `edit_identity` and `identity_basis`, matching the footage source | The fields could be typed for Vimeo `143033121`, the only known edit, but it is not public. The paper describes the Survey edit as one processed hour at 1280 by 720 and 29.97 fps with burned UTC code, and neither its bytes nor its relation to Marshall's camera files can be read | Fails on evidence. The validator would accept typed fields |
| `inspection` | `continuous_video_inspected` over a stated source interval, with `none_observed` discontinuities | No frame of this interval has been seen | Fails |
| `timing` | `linear_verified`, at least three anchors read inside the inspected source, a positive uncertainty | The paper's claim of sync "within one video frame" for "almost all video clips ≥15-s duration" applies to its own edit and names no clip. The track times are position fixes, not frames | Fails |
| `camera` position | Longitude and latitude with `position_uncertainty_m` | Reported 35.488103, -97.954941 with no stated method and no uncertainty | Reported value only, uncertainty missing |
| `camera` direction | `bearing_degrees` with `orientation_uncertainty_degrees` | Reported 225 degrees. The paper's plus or minus 10 degrees is a method value, not a measured error for this sample, so it cannot fill the field honestly | Reported value only, uncertainty missing |
| `camera` pitch, roll, lens | `pitch_degrees`, `roll_degrees`, `lens_calibration` | Not published. The paper says "no attempt has been made to unwarp lens-distorted imagery" | Fails |
| `rights` | `external_links_only`, with `creator` equal to the footage source's creator, plus `uploader`, `rights_holder` and `basis` | The Survey told contributors copyright stays with the videographer and use is "restricted to the Survey and researchers for scientific purposes only". Creator and rights holder would be Tim Marshall. The Vimeo uploader is not identified by any read. A link to a player that says the video is unavailable gives a visitor nothing | No usable route |
| `uncertainty` and form keys | A written uncertainty, and form keys only at inspected timing anchors | No observation exists to bound or to key | Fails |

## Decision

Not admitted. The interval stays unregistered, and `exhibits/el-reno-2013/appearance-timeline.json` keeps no registered window. The decisive missing input is an accessible copy of Marshall's footage for 23:13:27Z to 23:15:49Z, either the Survey edit or the camera's own files. Without it no other failing part can be filled. With it, pitch, roll, lens and the two uncertainties would still need landmarks and a stated method, and the rights route would still need a basis a visitor can use.

Two routes could supply the footage, and this record takes neither. The paper says the edited hour, the original files and the metadata for every second sit behind Survey registration and acceptance of its terms, which means a new account. The other route is asking Tim Marshall, which is contact with a creator.

## Smaller or different routes

A smaller result is possible from the paper alone. Fig. 4b's Marshall still could join the photo comparison as one published instant at 2314:42 UTC, linked to the article, in the way the Nolte stills were added. That would be a discrete documentary observation with the paper's own time label. It would not be an interval and would add no clock beyond the label. The figure image was not opened for this record.

Two different sources are worth more than this candidate today.

1. Robinson's YouTube upload (`MxgU1QcFMJM`) is the one El Reno source in the register with a printed clock already read at seven moments, and a register of its shots is the first item of the [roadmap](../docs/roadmap.md). Its Survey edit is unavailable as shown above, so any pose for it has to come from its own frames and landmarks and not from the Survey's Robinson track.
2. Ray Bohac's [archived extended film](https://commons.wikimedia.org/wiki/File:May_31_El_Reno_EF5_Extended_Version_filmed_up_close_in_the_TVN_Dominator_1.ogv) is the one El Reno moving image the repository holds with a free license (CC BY 3.0, per the [documentary media record](documentary-media-2026-10-12.md)) and retrievable bytes. It has no capture UTC or calibrated view yet, and its time coverage has not been established.

## What this record did not do

No video was played, watched or downloaded, and no frame was compared with anything by eye. No Survey account was made and nobody was contacted. The exhibit files, the replay package and `web/data.json` are unchanged. The Fig. 4b image and the paper's PDF remain unopened.
