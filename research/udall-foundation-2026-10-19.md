# Udall documentary foundation

This source record supports a documentary account of the May 25, 1955 tornado associated with Udall. The account is distinct from the separate Blackwell tornado. Five retained NCEI records remain individually addressable. Their association is a reviewed interpretation of named historical accounts and source fields, with unresolved boundary and clock differences. It is not a merged catalogue record, geographic replay or calibrated reconstruction.

## Sources and inspected scope

- [NWS Wichita historical storm report](https://www.weather.gov/ict/udall_stormreport): the hosted historical transcription, including the UDALL, KANSAS section, Wheeler Martin passage and final paragraph attributing Phillips's damage survey. Selected original HTML text was read; an original printed edition was not compared. Historical attribution is retained rather than recast as a new Atlas interview or survey.
- [NWS Norman outbreak account](https://www.weather.gov/oun/events-19550525): Summary and Oklahoma Tornado Table, especially distinct Blackwell and Udall rows 9 and 10. The Udall description and county progression support a documentary association. An account of the parent storm does not make its different tornadoes one tornado.
- [NCEI retained 1955 source release](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d1955_c20260323.csv.gz): snapshot ncei:1955:20260323, retrieved September 20, 2026. Seven selected catalogue records were inspected in full. The reported original gzip SHA256 is c503aadb9ca02fe8f9de0fa67e91218b02b4b8489af4f95c7cdc40d34c72c9cc. The original gzip was not reacquired or rehashed for this foundation.
- [NWS Wichita Udall archive](https://www.weather.gov/ict/udall): original report, map, radar, forecast-document and photograph-page routes. [Photograph page 1](https://www.weather.gov/ict/udall_pics1) and [page 2](https://www.weather.gov/ict/udall_pics2) were read as caption and link records. Their image pixels, photographers and item-specific hosting rights were not qualified. Map/radar routes are document leads; no scale, legend or clock was validated, and the refreshed radar request was unavailable.

NWS and NCEI may depend on the same historical material. Agreement between their fields is consistency evidence, not independent optical observation or a second count of people affected.

## Five records and two controls

The table preserves source labels and direct-impact fields. All seven rows have blank narratives and continuation fields, null UTC, reported endpoints without a track, and repeated beginning/ending labels. Those labels do not establish zero duration.

| Role | Raw NCEI ID | County | Reported CST label | Length field, miles | Maximum width field, yards | Direct deaths / injuries | CSV logical record |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Udall association | 10096418 | Kay, OK | 22:00 | 8 | 660 | 0 / 0 | 146 |
| Udall association | 10027629 | Sumner, KS | 22:15 | 24.7 | 660 | 5 / 3 | 1365 |
| Udall association | 10027630 | Cowley, KS | 22:45 | 2.3 | 1320 | 75 / 270 | 1366 |
| Udall association | 10027631 | Cowley, KS | 23:00 | 7.8 | 33 | 0 / 0 | 1367 |
| Udall association | 10027632 | Cowley, KS | 23:15 | 13.6 | 33 | 0 / 0 | 1368 |
| Separate Blackwell control | 10096417 | Kay, OK | 21:26 | 19.6 | 500 | 20 / 280 | 145 |
| Separate Blackwell control | 10027628 | Sumner, KS | 22:00 | 8.8 | 500 | 0 / 0 | 1364 |

The five Udall length fields sum to 56.4 miles, versus 56 miles in the named NWS account. They sum to 80 direct deaths and 273 direct injuries, with a maximum width field of 1,320 yards. These comparisons support the documentary identification without proving a new surveyed length or a rounding rule. The 75 deaths in 10027630 are a county-record field, not an independently established Udall town-only total.

The first candidate boundary fails exact-coordinate agreement: 10096418 ends at [-97.15,37], while 10027629 begins at [-97.25,37]. The 0.1 degree longitude difference remains unbridged. Later candidate endpoints match, but explicit continuation fields remain blank.

The controls expose endpoint ambiguity. Blackwell 10096417 ends at [-97.25,37], matching both its intended Sumner comparison 10027628 and Udall 10027629. The former supports the separate Blackwell comparison; the latter is a rejected cross-event join. Endpoint equality alone cannot select the tornado. Neither control becomes a Udall-associated record.

The Wichita report's final Udall paragraph provides positive historical continuity evidence: its authors attribute a damage survey to Phillips and interpret the survey and radar together. That interpretation remains attributed. It does not repair the exact retained coordinate discrepancy or validate an absolute clock.

## Claim and source locators

| Dossier observation | Exact source scope | Interpretation retained |
| --- | --- | --- |
| udall-damage-account | Wichita report, UDALL, KANSAS opening descriptive paragraphs | Reported damage progression and affected structures; no measured wind field. |
| phillips-survey-continuity | Same section, final paragraph | Attributed historical survey/continuity interpretation, including skipped damage sections. |
| five-record-association | Norman Summary and tornado table row 10; the five retained rows above | Manual documentary association, not an automatic join or independent camera validation. |
| kay-sumner-boundary | 10096418 ending and 10027629 beginning coordinates | Exact unmatched boundary remains unchanged. |
| endpoint-ambiguity-control | 10096417 ending; 10027628 and 10027629 beginnings; Norman rows 9 and 10 | Intended within-Blackwell comparison distinguished from rejected cross-event join. |
| source-clock-disagreement | Wichita Wheeler Martin passage; 10027630 time and quality fields | Reported approximate 2235 CST versus 2245 CST, no UTC conversion or calibrated arrival. |
| injury-count-disagreement | Wichita report introduction; Norman row 10; five impact fields | 250 and 273 remain separate source totals, without an invented explanation. |
| county-loss-scope | Five retained direct-impact fields; Norman row 10 | Whole-track 80 distinct from Cowley 75; no personal fatality map. |
| original-image-limits | Wichita index and both photograph-page caption records | Original-source access without new pixel, photographer or hosting claims. |

## One unchanged regional document

The sole hosted media record reuses [the complete regional forecast document](https://www.weather.gov/images/ict/wxstory/udall/warning2.jpg), already accepted as nws-blackwell-warning2. Its source/media metadata, attribution roles and item-specific rights basis are retained unchanged. The existing asset is assets/blackwell-1955/nws-warning2.jpg: 76,308 bytes, 608 by 436 pixels, SHA256 8de7b776fc25c87834a9277c77c2a6b10939b4618984dbefe450e621584304a5. No duplicate, crop, recoloring or resampling is introduced.

The NWS default public-domain policy is applied only under that existing item assessment. The original issuing office, typist, scan creator and rights holder remain unidentified. An NWS-hosted page does not automatically identify a photograph's creator or clear third-party material. The entire lower archive caption stays visible beside the typewritten forecast. Issue, validity and later caption broadcast labels are separate; no identified recipient, checked time zone or warning lead time is established.

## Publication limits

The account uses the existing authored dossier, archive, native article and reader. Appearance remains unregistered with no intervals, camera, continuous motion or automatic track. The historical F5 classification and damage-width fields supply no wind-laboratory presets, core radius, visible funnel width or failure sequence. Source assessment and authoring are distinct from independent candidate review, executed repository checks, browser behavior and public release acceptance. Earlier archives, raw source records, source grants and El Reno/Nolte timing criteria remain separate and unchanged.
