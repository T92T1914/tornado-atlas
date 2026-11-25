# Wood and colleagues: phased array circulation and the NWRT reader

[Doppler Circulation and Areal Contraction Rate as Detected and Measured by a Phased-Array Radar: The El Reno, Oklahoma, Tornado of 31 May 2013](https://doi.org/10.1175/MWR-D-23-0110.1) by Vincent T. Wood, Robert P. Davies-Jones, Jeffrey C. Snyder and Larry J. Hopper, Monthly Weather Review 153(3), pages 491 to 520, published March 13, 2025. The lane's research note of 2026-11-25 dated it 2024. The publisher's page dates it 2025, and this record uses that date. No file in the repository cited it before this record.

The question is narrow. The NWRT source reader in `web/radar-source.html` shows twelve retained reflectivity frames from the National Weather Service's published loop, from 23:01:37 to 23:40:51 by their printed labels, read as UTC. Do the times this paper analyzes overlap those twelve observations, and where does it say so?

## Access

On 2026-11-25 at 18:31:52 UTC, one unauthenticated GET of the DOI redirected to `https://journals.ametsoc.org/view/journals/mwre/153/3/MWR-D-23-0110.1.xml`. Earlier the same day the publisher answered that page with HTTP 403 and 919 bytes. No login, institutional route or other workaround was tried.

The Internet Archive holds a capture of that page from 2026-10-30 at 03:37:37 UTC. On 2026-11-25 at 18:35:24 UTC, one GET of `https://web.archive.org/web/20261030033737id_/https://journals.ametsoc.org/view/journals/mwre/153/3/MWR-D-23-0110.1.xml` returned HTTP 200 with 186,191 gzip bytes, SHA-256 `7c7ad1c2801c0eeb8e50ee23e86f8f00092ad3bfdaf64d4d4bd0457250b083ca`, which expand to 1,867,781 bytes of HTML, SHA-256 `5b8d65737480c55d82530ea5a7e10e5a6041c99fd09dea7a21c869bdd6474161`. The capture carries the abstract, the significance statement, sections 1 to 7, both appendices, the footnotes, the acknowledgments, the data availability statement, the figure captions and the reference list. I read all of it as text extracted from the HTML. The figures, the two tables and the online supplement were not opened, so nothing below depends on reading a figure panel or a table. Locators name the section or the figure caption. The HTML bytes are not retained in the repository. The paper states that it is "licensed under the terms of the default AMS reuse license", and this record quotes only short exact passages.

## What the paper analyzed

Section 4 says the circulation and contraction analyses ran on "all 168 sector scans". The scans hold four elevation angles, 0.5°, 0.9°, 1.3° and 1.8°, "between 2258:03 and 2346:46 UTC", and "The volume update time was 1.18 min for a 90° sector." Section 5a repeats the window as "our analysis times (2258:03–2346:46 UTC)". The caption of Fig. 18 says its time axis gives "The PAR scan time (hhmm:ss, UTC) at the first tilt of 0.5°", with "about 4–6 s elapsed between two sequential tilts".

The paper names these scan times, each with the figure or passage that shows it. Fig. 23 shows the later Yukon tornado, which the paper says formed at 2351 UTC. That is a formation time, not a scan time, and it falls after the analysis window.

| Locator | Scan time as published | Retained reader frame with the same label |
| --- | --- | --- |
| Fig. 7 | 2258:03 UTC, 1.8° elevation | None |
| Fig. 10 | 2300:26 to 2300:42 UTC | None |
| Fig. 11 | 2319:22 to 2319:40 UTC | 23:19:22, GIF index 166 |
| Fig. 12 | 2321:45 to 2322:02 UTC | None |
| Fig. 4 and Fig. 13 | 2324:07 UTC, and 2324:07 to 2324:24 UTC | None |
| Fig. 14 and Fig. 16 | 2328:51 to 2329:09 UTC | None |
| Fig. 15 | 2332:24 to 2332:42 UTC | None |
| Fig. 17 | 2337:08 to 2337:26 UTC | 23:37:08, GIF index 181 |
| Section 5b, the online supplement | Animations "between 2327:40 and 2334:46 UTC" | None. Both ends fall 71 s after a retained frame, 23:26:29 and 23:33:35 |

## The answer

Yes. All twelve retained frames, 23:01:37 to 23:40:51, fall inside the paper's analysis window of 2258:03 to 2346:46 UTC. Two of them carry exactly the start time of a scan the paper analyzes: 23:19:22 is the start of Fig. 11, and 23:37:08 is the start of Fig. 17.

The other named times sit on the same rhythm. Section 5a gives the "PAR’s volumetric update time of ∼71 s". The first eleven retained frames are 213 or 214 s apart, three volumes. So 2324:07 is one volume after the retained 23:22:56, 2321:45 is two volumes after 23:19:22, 2300:26 is one volume before 23:01:37, and the supplement's 2327:40 and 2334:46 are each one volume after a retained frame. That arithmetic suggests the published loop and the paper come from the same scan sequence, and that the reader keeps every third volume through 23:37:08. The last step does not fit: 23:37:08 to 23:40:51 is 223 s, ten seconds more than three volumes, and the paper names no scan time there. This is an inference from the times. Neither the paper nor the loop states it, and this record did not compare the images.

Two limits hold even where the times match. The reader shows reflectivity, and the paper's analyses are of Doppler velocity. The reader's frame labels end in `00.51`, which fits the 0.5° first tilt the paper names, but no source states that the loop's frame is that tilt.

## What else bears on the reader

1. The reader treats the printed frame labels as UTC and says the label itself names no time zone. The paper states its scan times in UTC, and two of them equal retained labels to the second. That fits the reader's interpretation. It is not an independent clock calibration, and this record does not change the reader's clock statement.
2. Section 1 says the NWRT antenna had a "90° field of view", and section 4 gives the 1.18 min update "for a 90° sector". The reader page already says the instrument could scan a 90 degree azimuth sector, and the interpretation in `exhibits/el-reno-2013/timeline-media.json` says the image alone does not establish the sampled footprint. The paper supports the sector, not the footprint of any one frame.
3. Section 4 says some data were removed for sidelobe contamination "prior to 2258 UTC", before the window, and section 5a says sidelobe echoes in low signal areas were removed "for our analysis times". Section 4 also says "some of the PAR data were missing during the first half of the tornado’s life cycle". Section 5c says the analyses have "large regions of missing data" between "∼2301 and ∼2320 UTC" for the larger circles.
4. Section 5a places tornado formation "sometime between 2302 and 2304 UTC" from mobile radar, not from the phased array radar. Section 5e says the El Reno tornado dissipated at 2347 UTC.
5. The abstract gives the peak circulation as "9 × 10 5 m 2 s −1 at a height of 1.5 km". Section 5b puts that maximum in the scan of 2321:45 to 2322:02 UTC, when the apparent radius of maximum tangential wind reached 2.2 km. The paper calls the scale of the vortex a tornado signature, not a tornadic vortex signature, at about 50 km range.
6. The data availability statement says the NWRT data are available from NSSL at `https://data.nssl.noaa.gov/thredds/catalog/RRDD/MPAR/2013/catalog.html` and by request. That address was not opened for this record.
7. Footnote 1 says the SPY-1A antenna "was decommissioned in 2016".

## What this changes

Nothing a visitor sees. The record answers the overlap question for a later item that may want to link the paper from the reader, or to name the two frames whose times a published analysis shares. Whether either belongs on the page is the desk's call.

## Limits

1. The twelve frames are reflectivity images. The paper analyzes Doppler velocity and circulation. A shared scan time does not make the reader's image a view of the paper's analysis.
2. The relation between the loop and every third volume is inferred from times alone.
3. The figures, tables and supplement were not read, so no value is taken from a panel. The time axis of Fig. 18 marks every 0.5° scan time, 1.18 min apart, and would settle which volumes the loop keeps. It was not read.
4. The text was read from an archived capture, not from the publisher, because the publisher refused the request. The capture is dated 2026-10-30.
