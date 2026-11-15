# Documentary evidence update

The shared clock now includes seven archived NWS products, preserved as original text with hashes. They were read in full from Iowa Environmental Mesonet's HTML archive. The NWS event page links these exact products. The sequence begins with the 4:45 AM outlook and includes the 5:36 and 6:08 PM warnings, three continuation statements, and the 6:28 PM warning with tornado emergency wording. It is a selected sequence, not every operational product. Issue time controls display. Observation times inside the text can precede issue time. Polygons come from the LAT...LON text and retain the source's precision to a hundredth of a degree.

USGS Topo and USGSShadedReliefOnly service metadata were inspected. The map requests geographic images using a bounded export and uses the returned extent, avoiding the alignment error caused by ArcGIS adjusting an image's requested bounding box to its aspect ratio. Current geography is explicitly separate from May 2013 evidence. USGSTopo metadata describes transportation, geographic names, contours, hydrography and shaded relief assembled from government datasets in the public domain. Source attribution remains linked below the controls. Service failure does not disable historical overlays.

The CIMSS article and SSEC reuse policy were read. The two original comparison frames were decoded without cropping or retouching and visually inspected. They show the same regional extent with original browser chrome and the later red ellipse preserved. The header dates are May 14, 17:01 UTC and June 2, 17:32 UTC. Source commentary identifies a resolution of 250 meters and notes different water glint. The exhibit does not claim subpixel registration or identify building damage from MODIS. The source article retains an obsolete early EF5 label. Only its satellite comparison is adopted.

## Fatality location work

The five people without mapped locations were reviewed through the existing reporting that names the fatalities, obituaries, Juliana Keeping's account republished by EMS World, and National Geographic's account. I-40 is supported for Maria Pol Martin and Rey Chicoj Pol, but no mile marker or coordinate is established. National Geographic provides a relative Henderson recovery description. It does not uniquely locate the fatal impact. Obituaries and the contemporary named list do not justify points for Bridges or O'Neal.

The first page of the April 2014 Stormtrack discussion was inspected. Participants propose vehicle identities near Highway 81, Reno Road and SW 15th and disagree over a camera clock by about a minute. This is useful evidence of the need for calibration, not a verified table of fatality coordinates. The Reddit Randy Walton thread was opened as a lead. No full original video inspection or solution matching frames to the map was completed in this pass. Anonymous wiki assertions and maps with unclear provenance were not promoted to coordinates.

The next registration record needs these fields:

- the original creator URL and file/version
- the footage timestamp
- UTC calibration and uncertainty
- camera coordinates and landmark basis
- viewing bearing
- identity evidence independent of location
- observation kind (last seen, impact, recovery)
- a corroborating source
- confidence and competing interpretation

Community posts are discovery paths, not substitutes for these fields.

## Sources inspected

- https://www.weather.gov/oun/events-20130531
- https://www.weather.gov/oun/efscale
- The seven IEM URLs in `exhibits/el-reno-2013/documentary.json`
- https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer?f=pjson
- https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer?f=pjson
- https://cimss.ssec.wisc.edu/satellite-blog/archives/13130
- https://www.ssec.wisc.edu/disclaimer/
- https://www.fox6now.com/news/breakdown-of-the-storm-fatalities-in-oklahoma
- https://www.hmpgloballearningnetwork.com/site/emsworld/news/11031041/language-barriers-hinder-storm-warnings-okla
- https://www.nationalgeographic.com/magazine/article/the-last-chase (indexed reporting excerpt)
- https://www.legacy.com/us/obituaries/legacyremembers/dustin-bridges-obituary?id=22638694
- https://www.legacy.com/us/obituaries/oklahoman/name/william-oneal-obituary?id=11764894
- https://stormtrack.org/threads/el-reno-question.27366/
- https://www.reddit.com/r/tornado/comments/1931iok/

## Link review

`tools/audit_exhibit_links.py` checks distinct external URLs in the curated El Reno bundle and the HTML at the top level with bounded GET requests. `web/source-audit.json` preserves the dated results. This is not a claim review and not a crawl of every generated catalogue record. Government, academic, creator and secondary roles are distinguished. Trust depends on the specific claim and attribution, not a domain alone. Redirects, access errors and soft errors that return HTTP success require interpretation. Local links and fragment targets are checked separately during browser QA.

Final coverage also includes fixed external links in browser modules. The 501 URLs
returned 492 successful responses and nine unresolved access results. Five DOI
links resolved to the expected AMS journal host but returned 403. Two Legacy
obituary links and one Tribute Archive link also returned 403. NSSL's tornado
education page failed TLS verification in the checker. Certificate checking
was not disabled. These references remain identifiable and publicly listed as
unresolved access. None returned a confirmed 404 or 410. A second attempt
with a web tool did not resolve access to NSSL, the Seimon DOI or the Bridges obituary.
The DOI references are scholarly locators, not independent secondary accounts.
