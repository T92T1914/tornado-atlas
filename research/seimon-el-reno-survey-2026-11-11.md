# Seimon and colleagues: what the El Reno Survey paper registers

[Crowdsourcing the El Reno 2013 Tornado: A New Approach for Collation and Display of Storm Chaser Imagery for Scientific Applications](https://doi.org/10.1175/BAMS-D-15-00174.1) by Anton Seimon, John T. Allen, Tracie A. Seimon, Skip J. Talbot and David K. Hoadley, *Bulletin of the American Meteorological Society* 97(11), pages 2069 to 2084, published November 1, 2016. Earlier records could reach only indexed excerpts. The [September 20 documentary evidence record](documentary-evidence-2026-09-20.md) and ledger row C016 both record a 403 from the publisher. This record covers the first full-text read.

The question is narrow. Which chaser recordings does the paper itself time-correct or place, what does it say about each one's clock and position, and where in the paper does it say so? The answer decides which recordings are worth carrying into the first bounded appearance interval and which inputs the paper cannot supply.

## Access

On 2026-11-11 at 07:07:46 UTC, one unauthenticated GET of the DOI redirected to `https://journals.ametsoc.org/view/journals/bams/97/11/bams-d-15-00174.1.xml` and returned HTTP 200 with 1,515,410 bytes, SHA-256 `79a5be0e2ce992ee5864870453764f3f288e2f2eecffec1ba2d72bd66520c0b4`. The page carried the complete article text, the six figure captions and the reference list. The text was extracted from the HTML as data. No sign-in, institutional route or access workaround was used. The page offers a PDF and a "Get Permissions" link. The PDF and the figure images were not opened, so nothing below depends on reading a figure panel, and "as published" below means as published in the HTML. The HTML bytes are not retained in the repository because the article is the publisher's copyrighted text. Quotations here are short and exact, including the paper's own minus signs, approximation marks and curly apostrophes.

The same session tried one read of the Survey's TED metadata file for a cross-check of contributor tracks. The server answered 406 from Mod_Security with 226 bytes. That probe was not repeated. The track facts already retained from earlier reads, in `exhibits/el-reno-2013/camera-marshall-literal.txt` and the [Robinson decision](robinson-registration-decision-2026-10-04.md), are unchanged by this record.

## How the paper corrects time and places cameras

**Clock.** Section "Video time correction" matches the intervals between lightning flashes on video to the National Lightning Detection Network archive. Only cloud-to-ground flashes with "peak currents > 20 kA" were used for calibration. Single-flash segments were matched by channel shape or continuing-current duration and then cross-checked against videos "already set in time". Segments with no ground flash fell back to optical transients, then to cloud features, warning audio, live television feeds and passing Survey vehicles. The stated result is that the team "temporally synchronized almost all video clips ≥15-s duration to within one video frame (i.e., 0.033 s at 29.97 fps) of actual time." Segments that could not be synchronized "were excluded from analysis".

One window has its own clock statement. In Results, "Despite an absence of CG lightning between 2319:30 and 2326:30, pattern matching of weak optical transients from intracloud discharges enabled precise time calibration, and video stabilization facilitated coherent tracking of features despite often-severe camera motion during filming." Recordings inside that window were timed from intracloud light, not from a ground flash in the archive, and some were stabilized.

**Position.** Section "Camera viewpoint geolocation" says positions came from GPS logs where they existed or, "more commonly", from matching video frames to Google Maps and Street View. Most participants "did not record vehicle locations in real time." Further fixes were taken "at 71-s time steps, coinciding with radar scans". The view direction is "estimated with ±10° precision, based on road orientations and landscape features".

**What the processed video is.** Section "Database entry" says each contributor's time-fixed clips were assembled into one hour, 2230 to 2330 UTC, "reprocessed at 1280 × 720 pixel resolution at 29.97 fps" with the videographer's name and UTC time code burned in. Gaps show as blank frames. Some hand-held sequences were stabilized, and the paper says this is noted in metadata. Each contributor's database entry holds that edited hour, the original files and "an Excel file providing second-by-second metadata". The paper states that "no attempt has been made to unwarp lens-distorted imagery".

**What TED shows.** Section "Online visualization tool" says the TED viewer plays up to four of these videos in step, with chaser arrows "oriented according to camera direction at the time of the most current locational fix". Its tornado circle is "interpolated from 1-min centroid coordinates as reported by the National Weather Service". The circle is therefore NWS track context, not a video observation.

## Recordings the paper names

The paper publishes no per-recording clock offset, no raw camera clock and no numerical camera coordinates. Times are UTC as published. The view column gives only what the paper says about where a camera was or which way it looked. Where the paper locates the subject instead, that location sits in the subject column. The clock column says which route the paper states for that recording. "General method" means the paper states no route for that recording beyond the section above. "Intracloud transients" marks the Fig. 5 recordings, where the paper names that route. Other recordings inside the 2319:30 to 2326:30 window had no ground flash to match, but the paper does not say how each was timed.

| Credit as published | Locator | Published time | Camera view or position | Subject | Clock route stated |
| --- | --- | --- | --- | --- | --- |
| Unnamed contributors | Fig. 2a | None; a 35-s span | None | Worked example of flash alignment | Flash alignment, shown before and after |
| J. Snyder, D. Lewison, J. Weingart | Fig. 2b (credit given for the whole figure) | None; "at the time of a CG lightning flash" | Positions and view azimuths found by scene matching, shown on a satellite view | Worked example of georeferencing | A CG flash recorded by all three |
| D. Shaw, M. Pfister, G. Käser, T. Marshall, S. Talbot | Fig. 3 | Flash at "2302:52 UTC" | Arrow icons in TED; five names for "four simultaneous video perspectives" | The one video-confirmed negative ground flash | NLDN-detected negative CG flash |
| M. Pfister and G. Käser | Fig. 4a, upper row | "23:08:08 to 23:08:14 UTC" at 2-s intervals | "from NE looking SW" | Multiple vortices during development | General method |
| D. Robinson | Fig. 4a, lower row | "23:08:08 to 23:08:14 UTC" | "from N looking S", 2.4 km from the upper-row view | Same moment | General method |
| G. Rhinehart | Fig. 4b | "2314:42 UTC" | "north of the tornado looking south-southwest (SSW)" | Condensation funnel forming at subvortex genesis | General method |
| T. Marshall | Fig. 4b | "2314:42 UTC" | "NE of the tornado looking SW" | Same moment | General method |
| T. Seimon | Fig. 4c, lower panel | "2319:04 UTC" | "view from S looking N", an enhanced photo still | Broad opaque cylinder crossing US-81 | General method |
| A. Gwyn | Fig. 4c, upper panel; Results text | "2319:04 UTC" | "view looking south"; "positioned 0.5 km north of the core" inside the outer wall | Multivortex subvortex crossing US-81 | General method; 26 s before the window with no CG flash |
| L. Bruns, D. Robinson | Results text, "not shown" | "2319–20" | None | Up to five vortices feeding the larger circulation from the NW | General method; overlaps the window with no CG flash |
| J. Snyder | Fig. 5a and 5h | "2325:55 UTC" | "view to WSW from the RaXPol deployment" | Subvortex on the tornado's SE flank | Intracloud transients |
| J. Bishop | Fig. 5b, 5d and 5h; Results text | "2325:55", "2326:01 UTC" and the 2326:07 failure | "a vehicle moving east on I-40" | Billboard failure 2.5 km ENE of the centroid | Intracloud transients |
| C. Asselin | Fig. 5c, 5e and 5h; Results text | "2326:01" and "2326:07 UTC" | One of three videographers at the RaXPol site; wide-angle view to WSW | Exit sign thrown across I-40 | Intracloud transients |
| K. Butler | Fig. 5f, 5g and 5h | "2326:06–07 UTC" | One of three videographers at the RaXPol site | Structures disintegrating | Intracloud transients |
| V. Deligny | Results text | "2326:07" | One of three videographers at the RaXPol site | Same failure, no panel | Intracloud transients |
| H. Farrar | Fig. 6; Results text | "2320:08 UTC" | None | Hailstone impact "7 km NW of the tornado center" | Inside the window with no CG flash; route not stated |
| H. Farrar, G. Rhinehart | Results text | None for this pairing | None | Time and place of "several exceptionally large hailstones" | General method |
| M. Gribble, M. Gotl, R. and S. Thompson | Results text | "2317–18" | None | Hail falling "well within the tornado’s broad circulation in its eastern quadrant" | General method |
| S. Talbot | Results text | "2320" | None | Hail rebound "5 km east-southeast (ESE) of the tornado centroid" | Inside the window with no CG flash; route not stated |

Fig. 5h is the one mapped camera layout in the paper: a "Google Earth oblique aerial perspective to 257° showing chaser viewing vectors (blue arrows)" for the Fig. 5 recordings. Fig. 4a and 4b also publish MPAR scan times of "2307:32" and "2314:38 UTC" beside the video stills. Fig. 5i is a RaXPol scan at "2325:59 UTC" contributed by H. Bluestein and J. Snyder.

## Appearance statements the paper makes

These are the authors' readings of their own time-corrected video. They are source statements with locators, not observations this museum has inspected, and none is admitted to an appearance timeline by this record.

1. "first ground contact by a condensation funnel occurs at 2302:15", earlier than the 2304 in Bluestein and colleagues (2015). Results, "Tornado evolution and structure".
2. "By 2304, multiple vortices are present beneath a broad truncated funnel", "most clearly visible from viewing perspectives to the north (N) west-southwest (WSW) through northeast". Same paragraph.
3. A tail cloud with small funnels at "2313:12", and "A large condensation funnel extending to the ground materializes rapidly within rotating rain curtains at 2314:30". Same section.
4. From outside, around 2318 to 2320 the tornado "appears as a vast, rain-wrapped rotating cylinder". Same section.
5. Video coverage between 2300 and 2305 is "available from more than two-dozen perspectives". Discussion, "Visual representation of storm phenomena".

## Conflicts and loose ends inside the paper

These are recorded as published in the HTML. None is resolved here.

* The Fig. 3 caption puts the negative flash at "2302:52 UTC" with "MPAR reflectivity at 2350:57 UTC". The Results text calls it "a −27-kA CG flash at 2252:02, shown in Fig. 3". The caption's radar time also falls after the paper's own 2330 analysis window and after the 2343 dissipation it gives elsewhere.
* The lightning paragraph says episodes of frequent positive ground flashes "precede the genesis of the El Reno tornado at 2202", and that "The peak flash rate of 11 CG flashes min−1 at 2233–34 occurs 29 min before the tornado." The second sentence's arithmetic gives about 2302 to 2303, which matches the 2302:15 ground contact in the next section and the 40-minute duration ending at 2343. The first sentence's 2202 is not corrected here.
* The text counts "125 video-confirmed CG flashes" for 2230 to 2330 and later cites a "minimum peak current of 146 video-confirmed El Reno CG flashes". The second count's period is not stated. It may cover the database's longer 2100 to 2343 span, so this is an unreconciled count rather than a demonstrated conflict.
* Fig. 6 gives a fall velocity of "±67.0 m s−1". The text says "∼67 m s−1". The text's "n = ±1,200" shows the same pattern, which may be how the HTML renders an approximation sign. The PDF would settle it and was not opened.

## What the paper cannot supply

The paper establishes a method and a published precision claim for the Survey's own timing. It does not let this museum skip any input that the [reconstruction plan](../docs/reconstruction-plan.md) requires for an appearance interval.

* **Clock.** "within one video frame" is the authors' stated result for "almost all video clips ≥15-s duration" in their own processing. It does not say which clips fell outside it, and it applies to the Survey's edits, not to a creator's own upload of the same day. The Robinson decision already shows why that matters: the TED track attaches a Vimeo source while the retained Robinson anchors come from a YouTube upload, and no correspondence between them has been shown. The paper publishes no offset that could be transferred to another edit.
* **Camera.** The ±10° bearing is a method precision for the Survey metadata, and the 71-s spacing is how often positions were fixed. Neither is a measured error for any one sample. The paper gives no pitch, roll, focal length or field of view, and says lens distortion was never removed.
* **Rights.** Contributors were told the "copyrights of all imagery submitted were to remain solely the property of the photo/videographer and that usage would be restricted to the Survey and researchers for scientific purposes only." Database access requires registration and "agreeing to respect copyrights on imagery usage terms." The paper describes no grant that would let this museum host a frame, and the database terms themselves were not inspected. The figures are published by the American Meteorological Society under its own permissions.

## Decision

The paper is **method evidence and a source of dated appearance statements**. It does not qualify any recording for this museum.

Its most useful result for the first bounded appearance interval is a short list of recordings that the authors placed in time and named with a view direction. T. Marshall is the strongest candidate. The paper places Marshall "NE of the tornado looking SW" at 2314:42 UTC. The retained Marshall literal in `exhibits/el-reno-2013/camera-marshall-literal.txt` has samples at 23:13:27Z and 23:14:38Z at the same reported position with a reported azimuth of 225°, which agrees with that wording. D. Robinson is a weaker candidate. The paper names Robinson at 23:08:08 to 23:08:14 UTC "from N looking S" and again at 2319 to 2320, but the only Robinson camera rows this repository retains are three samples from 23:17:00Z to 23:18:11Z, which cover neither moment.

Neither candidate is qualified by this record. Each still needs the exact edit, a verified correspondence to the Survey's processed hour, continuous inspection of the interval, a calibrated view and a reuse basis.

## Next inputs

1. A qualification decision for one bounded Marshall interval near 2314:42 UTC, covering edit identity, clock map, viewpoint, rights and uncertainty. Any camera match judged by eye belongs to a person, not to an automated read.
2. The Survey's second-by-second metadata, which the paper says sits behind database registration. Registration with the Survey and contact with its team have not been attempted and are outside this record.
3. Two exhibit records still describe this paper from an indexed-excerpt read. `exhibits/el-reno-2013/reading.json` says the methods were "checked in indexed primary-source passages", and the Marshall manifest's limits line says direction uncertainty is not quantified. Updating either one changes what the museum says and rebuilds `web/data.json`, so it is left for a separate item.
