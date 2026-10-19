# Newcastle and Moore: a documentary foundation

The new account follows one tornado across two county records, then separates its
reported path, issued warnings, school and hospital accounts, and following-day
survey photographs. Its deciding contribution is a readable source comparison.
It adds no calibrated camera, historical wind field or continuous appearance
interval. The documentary account uses the existing article and archive
components rather than another player or source registry.

## Decision and source base

The decision is to implement a substantial documentary exhibit and standalone
schema 1 dossier. The accepted source base is
`031f09746fbeb258da235990e6c2cc285e367c87`. The existing four dossiers, archive
validator, event registry, native contents, photograph reader contracts and
publisher were inspected before authoring. `atlas.archive.dossiers()` already
discovers authored `exhibits/*/dossier.json` files, so this addition needs no new
archive architecture.

The private shortlist previously favored Moore/Newcastle for primary-source
qualification. It also retained a lead for an integrated damage, visual and radar
paper. That paper's full text was inaccessible in the earlier review. This
increment did not repeat that unchanged request, acquire its data or treat its
abstract as inspected methods. Useful documentary reading does not depend on
solving that separate reconstruction question.

The article and dossier are authored work. Independent candidate review,
publication checks, browser acceptance, required CI, main and public deployment
are separate delivery stages. They are not established by this research note.

## Source identities and inspection

[NWS Norman's May 20 event page](https://www.weather.gov/oun/events-20130520)
was opened as original maintained HTML. The selected inspection covered its
summary, written damage progression, source directory, event timeline, tornado
table and survey-photo attribution. Its preliminary labels and older wording are
preserved as source-edition context. It is not a recovered 2013 web snapshot.

The [McClain](https://www.weather.gov/oun/tornadodata-county-ok-mcclain) and
[Cleveland](https://www.weather.gov/oun/tornadodata-county-ok-cleveland) county
tables also describe the whole Newcastle-Moore event. These are related NWS
accounts, not independent optical observations or additional tornadoes.

The retained NCEI source is the 2013 CSV release `c20260323`, retrieved on
September 20, 2026. Its retained reported source-object SHA256 is
`4fa4036ed1c7ea9a779d5a5841d18de08596c423920189a9e6173488d1a98260`.
The original CSV object was not downloaded or rehashed in this increment. The
published catalogue details for events `451537` and `451572` were read directly.

The [original NCEI McClain detail](https://www.ncei.noaa.gov/stormevents/eventdetails.jsp?id=451537)
also opened as readable primary HTML and corroborated its retained fields. A
fresh [Cleveland detail request](https://www.ncei.noaa.gov/stormevents/eventdetails.jsp?id=451572)
redirected to an access app without readable narrative in the available web
tool. The Cleveland narrative assessment therefore rests on the identified
retained source record, not a claimed fresh remote rendering.

The [May 2013 NWS Storm Data report](https://www.weather.gov/media/oun/stormdata/oun201305.pdf)
was opened as an original 40-page PDF. The selected May 20 county entries and
preceding Newcastle wind narrative were read. The edition was printed on
September 16, 2013. Its old interpretations remain distinct from the later
retained CSV release.

The [NWS service assessment](https://www.weather.gov/media/publications/assessments/13oklahoma_tornadoes.pdf)
was opened as an original 63-page PDF. The selected inspection covered the scope,
May 20 meteorological account, explicit CDT convention and communication
sections. This report covers several dates and hazards. Its aggregate warning
metrics are not Moore-only measurements. No complete visual review of every
page or figure is claimed.

[NIST Special Publication 1164](https://doi.org/10.6028/NIST.sp.1164), by Erica D.
Kuligowski, Long Phan, Marc L. Levitan and David P. Jorgensen, was published on
December 3, 2013. The original PDF and
[publication metadata](https://www.nist.gov/publications/preliminary-reconnaissance-may-20-2013-newcastle-moore-tornado-oklahoma)
were opened. Selected scope, clock and facility passages were read. The medical
center interpretation uses printed pages 44 to 49, PDF pages 68 to 73. The
reconnaissance examined two schools and one hospital to inform the ongoing
Joplin investigation. It was not a complete technical investigation of every
affected structure. Report figures were not extracted for this account.

The issued warning products were read at their original NWS text identities,
as preserved by the Iowa Environmental Mesonet:

| Product | Identifying header | Stated validity in UTC |
| --- | --- | --- |
| [First warning](https://mesonet.agron.iastate.edu/wx/afos/p.php?e=201305201940&pil=TOROUN) | `WFUS54 KOUN 201940`, `TOROUN`, event `0024` | 19:40 to 20:15 |
| [Tornado-emergency warning](https://mesonet.agron.iastate.edu/wx/afos/p.php?e=201305202001&pil=TOROUN) | `WFUS54 KOUN 202001`, `TOROUN`, event `0026` | 20:01 to 20:45 |

NWS is the issuer and IEM the custodian. Issue, observation, validity, retrieval
and personal receipt remain separate roles.

## One tornado across two records

The association is justified by explicit continuation, exact boundary agreement
and named narratives. The shared episode is supporting evidence only.

| Retained record | County | Standard-time interval | UTC interval | County rating |
| --- | --- | --- | --- | --- |
| `ncei:451537` | McClain | 13:56 to 14:04, CST-6 | 19:56 to 20:04 | EF4 |
| `ncei:451572` | Cleveland | 14:04 to 14:35, CST-6 | 20:04 to 20:35 | EF5 |

McClain's continuation names Cleveland County, FIPS `027`. Its ending and the
Cleveland beginning share `[-97.605, 35.303]` and 20:04 UTC. Their narratives
identify the same Newcastle-Moore tornado. The source episode is `74673`.

The whole interval is reported as 2:56 to 3:35 p.m. CDT. Converting the explicit
standard-time zone does not add historical precision. The serialized `:00`
seconds do not establish second-level accuracy. A line joining source endpoints
would be an interpolation, not the surveyed track or a camera path.

The county dimensions remain 1.85 miles and 1,280 yards for McClain, and 12 miles
and 1,900 yards for Cleveland. The approximately 14-mile whole-track summary is
kept separately. It is not replaced with a newly precise sum. Reported damage
width is not visible funnel width or a default for the illustrative wind model.

The retained direct-injury allocation is 5 in McClain and 207 in Cleveland,
totaling 212. Cleveland reports 24 direct deaths and McClain none. Repeated
whole-track figures in both narratives do not represent additional people.
County impact fields remain intact. No individual fatality locations are added.

## Claims that need their source limits

| Claim | Deciding source | Qualification |
| --- | --- | --- |
| Two county rows describe one tornado | Continuation, shared boundary and named narratives | Retain both IDs and fields. Do not deduplicate every shared episode this way. |
| Briarwood's initial EF5 interpretation changed to EF4 | Retained Cleveland narrative | Old NWS editions retain the initial school rating. The whole-track EF5 maximum remains separate. The correction date and complete engineering basis are unknown here. |
| The first siren label was not a calibrated response delay | NIST printed page 22, PDF page 46 and footnote 30 | The siren computer and weather clock were unsynchronized. Preserve the reported 2:42:34 label without deriving a precise delay or offset. |
| A largely intact hospital frame did not preserve use | NIST medical center account | Envelope failure and infiltration belong to a source-supported facility account. They do not yield a measured local wind speed or a universal hospital guarantee. |
| Earlier Newcastle damage has different source classifications | Preliminary NIST account and later Storm Data | Do not add another tornado or extend the main path from the earlier EF0 description. Retain the unresolved edition difference. |

The school outcomes are not a controlled comparison. The account does not
isolate one cause by comparing different buildings, damage and sheltering
circumstances. Reported observations and later source interpretations stay
attributed rather than becoming an Atlas safety certification.

## Two agency survey photographs

The NWS Damage Photos introduction explicitly credits NWS meteorologist Doug
Speheger during the May 21, 2013 Moore-area damage survey. The
[NWS use policy](https://www.weather.gov/disclaimer) provides an agency-material
basis while preserving separately credited exceptions and prohibiting implied
endorsement. The chosen files belong to this identified agency photo group.
Courtesy tornado pictures by Jenny Hamar and Gabe Garfield do not inherit that
basis and remain links only.

The exact returned 800-pixel-wide versions were acquired and reviewed. Their
filenames were not altered to guess larger originals. The complete public
copies were independently viewed as local image files during authoring. The
publication processing record verifies removal of EXIF/XMP APP1 and Photoshop
IPTC APP13 metadata only, preservation of all other segments and ICC data, and
equality of decoded pixels and complete image rectangles. No crop, resampling or
image re-encoding was performed. Original objects remain retained separately.

| Item | Original NWS object | Publication dimensions and bytes | Publication SHA256 |
| --- | --- | --- | --- |
| Briarwood school | [IMG_2314-800.jpg](https://www.weather.gov/images/oun/wxevents/20130520/photos/damage/IMG_2314-800.jpg) | 800 by 600, 410,330 bytes | `d53b38069c63ec7508cece9e4a70b11fabf45aad090fa072bc7f115efd2ac7e6` |
| Medical center background | [IMG_9287-800.jpg](https://www.weather.gov/images/oun/wxevents/20130520/photos/damage/IMG_9287-800.jpg) | 800 by 533, 339,582 bytes | `f10b6b33fbcecd2c228632d2d681bbef47e58876246b753a04721dda3a58c6bb` |

The original source-object SHA256 values are respectively
`c6892973fe84aebd18978af7a3e952bd3cd762c20c28545a8e87ce73d91abef7`
and `8e6699b5ea42cad9dc61fc5e08ae2ecb2bfbafc9b5a270d279124fa3e7434612`.
Publication hashes identify the metadata-stripped copies, not those original
objects.

The Briarwood view contains damaged classroom material and visible upper-left
clock, coordinate and bearing annotations. Those original image annotations are
preserved. They are not promoted to calibrated camera fields. The medical center
view shows a damaged low building behind vehicles, trees and debris. The source
caption's ENE direction remains qualitative. Neither photo supplies a registered
camera, a tornado appearance interval or the full state of the building's
interior. These are following-day documentary observations.

## Visitor and release acceptance

The article preserves an ordinary no-script reading route, native contents,
section returns, full image links, source captions and the existing dossier
consumer. Sources and observations have named return routes to the article.
Failed enhancement must leave the native image and original-source routes usable.

Acceptance must exercise the actual selected source and photograph at narrow and
wide widths, keyboard contents and return, enlarged text and spacing, dark and
light appearance, no-script reading, original asset identity and complete-frame
display. Existing rights and immutable archives must remain intact. Browser
checks are not a physical phone or comprehension study.

Source qualification and local pixel inspection do not establish release
acceptance. Candidate review, actual affected source and browser checks, full CI,
normal merge, main, Pages and the bounded public visitor checks remain part of
the authorized delivery chain. This note records no invented passes.
