# Browse damage along the published line

The El Reno survey inspector offers preserved record order and spatial order
along the NWS center line. Both use the same observations, photographs, source
links and assessment text. Previous and Next follow the chosen order, including
when the map cannot be used. Shared observation links carry the order into the
full report and focused survey page.

Spatial order assigns each feature to its nearest segment on the retained line.
The inspector reports approximate distance along the stored vertices and offset
from the line. It uses a local planar conversion at the line's mean latitude.
The source coordinates and record order are never rewritten. Coincident nearest
segments use the earlier stored segment, so a loop can make the assignment
ambiguous. This is a browsing aid for this local exhibit, not a general geodesic
measurement service.

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
