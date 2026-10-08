# Browse damage along the published line

The El Reno survey inspector offers preserved record order and spatial order
along the NWS center line. Both use the same observations, photographs, source
links and assessment text. Previous and Next follow the chosen order, including
when the map cannot be used. Shared observation links carry the order into the
full report and focused survey page.

Observation selection, Previous, Next, rating, photograph availability and
order changes now update the address. Back, Forward and reload restore the
selected record and controls on both pages. Search typing adds one history
entry for an edit session and updates that entry as the query changes. A
filtered result with no matching observations clears the selected point and
its nearest-line annotation. On the full report, a survey change pauses the
running historical clock and saves that moment before adding a survey entry.
Fatality records remain separate from survey ratings and photograph filters.

Spatial order assigns each feature to its nearest segment on the retained line.
The inspector reports approximate distance along the stored vertices and offset
from the line. It uses a local planar conversion at the line's mean latitude.
The source coordinates and record order are never rewritten. Coincident nearest
segments use the earlier stored segment, so a loop can make the assignment
ambiguous. This is a browsing aid for this local exhibit, not a general geodesic
measurement service.

Selecting an observation now emphasizes the segment used for that comparison.
A square marks its calculated nearest point, and a dashed connector joins that
point to the surveyed feature. The original feature keeps its own selection
outline and coordinates. The explanation beside the map names the selected
record and distances. The assessment also reports the approximate nearest point
and offset in text, so the comparison remains readable without operating the map.
Fatality selection and an empty damage result clear this survey annotation.

Neither distance nor list order establishes an impact time, instantaneous width,
wind field or camera position. The line and outline come from the retained
[NWS El Reno KMZ](https://www.weather.gov/source/oun/wxevents/20130531/gis/ElRenoTornadoPath_final.kmz),
whose source identity remains in the exhibit geometry. Damage observations keep
their own DAT links and assessment limitations. The original record order remains
available, and Reset restores it.

The new NOAA Event Footprint Catalog is a separate source lead. Its public
description distinguishes DAT footprints from Storm Events geometries that can
be reconstructed from endpoints. No Event Footprint Catalog geometry is used by
this inspector. Its processing basis and event-specific payload must be inspected
before any new footprint is presented as surveyed evidence.
