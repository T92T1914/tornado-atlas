# What to add for readers interested in tornado history

This is a focused review of examples and community discussion, not a survey of
all tornado enthusiasts. Forum comments show particular interests and problems;
they do not establish how common those preferences are. Priorities below are
editorial recommendations for this museum.

## The next additions

| Priority | Addition | Why it belongs here | Evidence and implementation boundary |
| --- | --- | --- | --- |
| 1 | Roads, towns and optional terrain beneath the path | People should recognize where a photograph or incident occurred without opening another map. | Retain the clean survey view and source geometry. Select a basemap with suitable attribution and service terms; modern roads and buildings must not silently represent 2013 conditions. |
| 2 | A synchronized evidence viewer | One clock should connect the storm position, available radar, warning history and verified camera views. | Expand the existing clock with explicitly timed evidence. Unknown times stay unknown. A reconstruction or interpolated frame must remain distinguishable from an observation. |
| 3 | Before and after pairs with original photo records | Readers can inspect what changed at a known place. | Require the same location, dates, credit, original links and usable rights. Do not use generated imagery as historical evidence. |
| 4 | A closer explanation of individual damage assessments | Explain the structure, recorded damage indicator, degree of damage and the limits of an EF inference beside the photograph. | Preserve the NWS assessment. An enthusiastic unofficial analysis can be discussed with attribution, without replacing that record. |
| 5 | The forecast and warning sequence | Show what was known before the tornado and how information changed during the event. | Use original SPC/NWS products and issue times. Forecast environment, warning polygon, tornado route and reconstructed winds are different layers. |
| 6 | A dated corrections and research log | Readers should be able to follow a disputed claim to its evidence and see why an exhibit changed. | Build on the existing sourced discussion entries. Require source links for corrections; do not publish unreviewed accusations or personal location claims. |

The first two would most improve the current experience. The larger documentary
should then grow through specific places, photographs and source accounts.
Longer text alone would not solve the missing geographic context.

## What was inspected

**NWS Little Rock's tornado database:** the official page describes tracks,
damage indicators, photographs, radar and historical material together. It also
explains that older tracks can be straight interpolations between endpoints.
This supports the combined exhibit structure and visible geometry limits, not
a claim about visitor satisfaction.
[Official page](https://www.weather.gov/lzk/tordatabase.htm), full page accessed.

**Maas and colleagues, 2024:** the abstract, methodology excerpts and online
interface section of the NOAA-hosted Tornado Archive paper were inspected.
The work describes detailed filters, environmental reanalysis, attribution and
inconsistent international coverage. These are useful examples for outbreak
context and future worldwide coverage. The whole paper and every figure were
not audited in this update.
[Primary paper](https://repository.library.noaa.gov/view/noaa/69259/noaa_69259_DS1.pdf).

**A Reddit request for historic damage paths:** the original post reports trouble
using DAT. Replies value individual damage points and photos, and discuss map
loading delays. This is direct anecdotal support for making evidence easy to
explore and keeping the interface responsive.
[Discussion](https://www.reddit.com/r/tornado/comments/wyu59w/), post and relevant comments accessed.

**A Reddit post showing detailed unofficial survey maps:** a commenter asks for
a usable project link, while another recognizes an event from its route and a
single damage photograph. This is a small example of interest in detailed,
shareable event records. The author's maps were not independently verified.
[Discussion](https://www.reddit.com/r/tornado/comments/1teb10i/), post and visible comments accessed.

The Tornado Archive feature blog returned 403 and a separate Reddit historical
map discussion returned 429. Neither is treated as an inspected full source.
No new complete viewing of Pecos Hank, TornadoTRX or Swegle Studios was performed
for this design update. Their existing review coverage remains in the queue.

## The vehicle labeled Other

The live DAT query for object 165661 gives `Other (O)`, `N/A` and the comment
`vehicle tossed`. It does not identify the vehicle or its occupants. Its numeric
death and injury fields are zero, which cannot resolve its relationship to a
separately documented fatal incident. The current attachment is joined to that
survey record, not to a named fatality record.

The TWISTEX account instead uses the published research location and the three
sourced names already preserved in the exhibit. The map now presents that
account as **TWISTEX, 3 deaths**. The nearby survey entry links to it with an
explicit statement that proximity does not identify the photographed vehicle.

[Full DAT record query](https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/MapServer/0/query?f=json&objectIds=165661&outFields=*&returnGeometry=true&outSR=4326).
The [preserved response](evidence/dat-165661-2026-09-20.json) includes its retrieval time.
