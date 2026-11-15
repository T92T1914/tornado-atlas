# Blackwell 1955: first source comparison

Reviewed September 21, 2026. This is the foundation for `web/blackwell.html`,
not a registered appearance reconstruction. The initial comparison found
conflicting clock labels and injury counts. Neither is silently normalized.
The [claim ledger](blackwell-claims-2026-09-21.csv) retains source relationships.

## Inspected evidence

| Source | Coverage actually inspected | Access and provenance limits |
| --- | --- | --- |
| [NWS Norman outbreak account](https://www.weather.gov/oun/events-19550525) | Summary, Oklahoma tornado table, Blackwell table, Burgess section on storm electricity, references, and memorial section | Official retrospective HTML. Page revision date unspecified. No local immutable snapshot or source hash was captured. Listed references are leads, not proof that the original papers were inspected. |
| [NWS Wichita reproduction of the storm report](https://www.weather.gov/ict/udall_stormreport) | Entire historical report text: introduction, Tonkawa, Blackwell, Arkansas City area and Udall | Officially hosted transcription. Original printed pages not compared. Visible transcription/encoding problems remain in the source. Do not silently repair them in quoted testimony. |
| [Gunn 1956 publisher record](https://journals.ametsoc.org/view/journals/atsc/13/3/1520-0469_1956_013_0269_efiatg_2_0_co_2.xml) | Abstract as indexed by the publisher | Requests for the original XML/PDF failed. An ordinary request returned 403. No figures inspected. Journal of Meteorology 13, 269 to 273. |
| [Vonnegut and Moore 1957 publisher record](https://journals.ametsoc.org/view/journals/atsc/14/3/1520-0469_1957_014_0284_eaawtb_2_0_co_2.xml) | Indexed text covering the correspondence on pages 284 to 285, including testimony attribution and interpretation | Not a verified reading of the original pages. Direct requests failed/returned 403. Journal of Meteorology 14, 284 to 285. No publisher barrier was bypassed. |

The public chapter cites only the two successfully opened official HTML sources
for historical facts. Limits on access to the original papers are retained here
rather than presenting search extraction as a complete literature review. The
map that NWS links to is linked for inspection, not copied, georeferenced or
visually analyzed. No image or paper from a third party has been redistributed
by this change.

## Consequential differences

- Clock: Norman's summary gives 9:27 p.m. CDT, and its table gives 2126 under
  a CST heading. Wichita's Blackwell section says about 2127 CST. No preferred
  UTC timestamp is assigned. The approximate qualifier is retained.
- Injuries: Norman's row gives 280 and the reproduced report gives 250.
  Both give 20 deaths. This is an attributed discrepancy, not a reconstructed
  reconciliation person by person.
- Identity: Norman separates the Blackwell and Udall tornadoes and calls
  the Tonkawa/Blackwell relationship probable. No catalogue rows are merged here.
- Instrument coverage: Gunn's abstract reports eight measuring stations
  near Udall. Burgess describes a network of ten stations. These may describe
  different coverage. The original paper is needed before interpreting the
  difference as an error.

## Appearance and physical interpretation

Gunn's abstract concerns ground measurements of the electric field near Udall.
It does not supply a Blackwell optical record. The 1957 correspondence disputes
the interpretation of those measurements and relays testimony through
Montgomery. The Lee Hunter passage points to personal communication. Proposed
electrical explanations are interpretations, not measured funnel appearance.

Burgess distinguishes radio sferics bursts from lightning flashes and describes
later research locating enhanced lightning activity in the parent storm. Do not
turn either count into a rendered light sequence. The separately located Kansas
backlighting accounts in the Wichita report cannot be used as Blackwell camera
observations. Lack of a verified mechanism also does not disprove a witness's
reported experience.

## Registration decision and next evidence

The event index explicitly keeps `replay: null`. There is no UTC playback clock,
camera coordinate, funnel geometry, calibrated color, impact animation or
individual death site marker for Blackwell. The catalogue remains unchanged.

Next work is concrete:

- inspect original Montgomery pages
- compare the Wichita transcription with its printed report
- resolve source clock conventions using contemporary records
- obtain the underlying newspaper damage survey before deriving locations
- review public memorial/individual records before naming victims or linking
  identities to sites

These are missing evidence, not fields to fill with estimates for an interface
that looks more complete.
