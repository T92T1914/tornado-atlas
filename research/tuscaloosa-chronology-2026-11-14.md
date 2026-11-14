# Tuscaloosa and Birmingham: a documentary chronology

This record explains the four entries in
`exhibits/tuscaloosa-birmingham-2011/chronology.json`, the two sources behind
them and the difference between those sources that the chronology leaves open.
It is a documentary clock. It places no storm position, image, wind estimate or
neighborhood arrival time on the timeline.

## Sources retained on November 14, 2026

### NWS Birmingham survey page

[NWS Birmingham's survey of the Tuscaloosa and Birmingham tornado](https://www.weather.gov/bmx/event_04272011tuscbirm)
answered at 2026-11-14T07:05:59Z with HTTP 200 and 79,073 bytes of HTML. The
SHA-256 of the HTML as served is
`90e3cbe55f0520fd0bb19a17698cd54d4ef3ac861cc3b180ae7c60b53c1ad26f`. The page
carries no date, so this is the text the page served on that day, not a
recovered 2011 revision.

The text of its event section is archived as
`exhibits/tuscaloosa-birmingham-2011/nws-bmx-survey-2026-11-14.txt`, 9,346
bytes, SHA-256
`36f1e0bf820c774a23438fbd0bf16020a8c032e7bc76795d603e062d2df08ccd`. It runs
from the page heading to the last image caption. Tags were removed, HTML
entities decoded and runs of spaces joined. Wording, spelling and clock labels
are as served, including the page's own split in "C entral Alabama". The file
is marked `-text` in `.gitattributes` so its bytes, and its hash, survive a
checkout on any platform.

The two clock labels this chronology uses, quoted from the archive:

> Approximate Start Point/Time:
> 33.0297/-87.9350 at 443 pm

> Approximate End Point/Time:
> 33.6311/-86.7436 at 614 pm

Neither label names a time zone. The narrative on the same page gives the
parent supercell's times as "2:54 pm CDT" and "approximately 10:18 pm CDT".

### December 2011 service assessment

[The Historic Tornadoes of April 2011](https://www.weather.gov/media/publications/assessments/historic_tornadoes.pdf)
answered with HTTP 200 and 4,527,822 bytes, SHA-256
`bd944284c81192e463a7aa98f671f733a5d1c772440451127bdf3aad271a70f5`. The earlier
foundation record notes an HTTP 403 on its own attempt. This time the file was saved and is retained as
`exhibits/tuscaloosa-birmingham-2011/nws-service-assessment.pdf`.

Table 1 sits on PDF page 14, printed page 6. I rendered the table and read it
as an image, because the text layer places the county names on the wrong rows.
The rendered row reads `3:50 – 4:45 p.m.`, `Tuscaloosa, Jefferson AL`, `4`,
`66`, under a column headed `Time (CST)`.

## How the labels become UTC

The survey's `443 pm` and `614 pm` are read as CDT, five hours behind UTC, which
gives 21:43 and 23:14 UTC. Two things support that reading. The same page states
CDT for its other times. The retained NCEI county records for this track,
snapshot `ncei:2011:20260323`, begin at 15:43 and end at 17:14 under `CST-6`,
which are the same two instants. Those NCEI rows come from the same agency
survey, so their agreement shows a consistent conversion, not an independent
observation.

Table 1's interval is converted as printed, six hours behind UTC, which gives
21:50 and 22:45 UTC, or 4:50 and 5:45 p.m. CDT.

| Entry | Source label | UTC | Precision |
| --- | --- | --- | --- |
| Approximate start in the survey | `443 pm` | 21:43 | approximate minute |
| Assessment Table 1 interval begins | `3:50 – 4:45 p.m.`, Time (CST) | 21:50 | reported minute |
| Assessment Table 1 interval ends | `3:50 – 4:45 p.m.`, Time (CST) | 22:45 | reported minute |
| Approximate end in the survey | `614 pm` | 23:14 | approximate minute |

## The difference left open

Read as printed, Table 1 starts 7 minutes after the survey's approximate start
and ends 29 minutes before its approximate end. If the column label were wrong
and the times were CDT, the interval would run from 20:50 to 21:45 UTC and end
2 minutes after the survey's start. The assessment does not explain its interval.
The chronology shows both sources, writes the conflict into the limits line of
each Table 1 entry and does not choose between them.

## What stays out

The assessment's 4:15 p.m. CDT warning is not an entry. Its pathcast covered a
supercell in western Tuscaloosa County while a second supercell formed in the
same polygon, and the report does not tie that warning to this tornado. A museum
label must not suggest that it does.

The survey's two radar captions at `538 pm`, the warning span of `338 pm until
800 pm` for the parent supercell and the untimed damage progression are not
entries either. The radar image pixels were not inspected, and the warning span
belongs to the storm rather than this tornado.

## Validator change

`validate_chronology` used to require every source to be a retained PDF cited by
page. It now also accepts a source archived as text under the event's exhibit
folder. Entries citing a text source carry `page: null`, entries citing a PDF
still need a page number, and both kinds are checked against their pinned
SHA-256. The player links a text source by its address and a PDF by page.

## Limits

1. Both survey times are approximate and the survey gives no error bound.
2. Minute labels keep source precision. They do not establish clock accuracy.
3. The page is undated and can change. The archive records what it served on
   November 14, 2026.
4. No photograph, footage or radar image is registered to this clock.
