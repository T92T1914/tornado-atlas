# A documentary that opens into evidence

Research and implementation record, September 20, 2026, America/Chicago. Some source requests occurred after midnight UTC on September 21.

The aim is an exhibit someone can read from beginning to end, then explore a photograph, damage observation or disputed claim without losing the story. El Reno is the working example. This update connects original survey attachments to their locations and adds an appearance choice. It does not yet reconstruct the historical tornado's visible shape or simulate individual buildings failing.

## What the reference actually does

I inspected the live [September 11 Photo Collection Map](https://www.arcgis.com/apps/instant/attachmentviewer/index.html?appid=1b7d4d22866b445881b181614e25d4d4), its public application configuration and its web map. It uses Esri's **Attachment Viewer**, with a map-focused layout. That template links mapped features to attachments and supports filters and alternative layouts. See the [official template documentation](https://doc.arcgis.com/en/instant-apps/latest/create-apps/attachment-viewer.htm).

The reference's useful idea is the connection among place, photograph and context. A selected gallery item opens a photograph and its record beside the map, while a filmstrip makes nearby material accessible. The public configuration enables attachment-only results. Photographer search and filters include broad timeframes as well as known times. Historical aerial imagery, streets and building layers help explain where the camera was.

A Hossam Hammad record was inspected with its photograph loaded. It names Dey Street and the broad interval 9:03 to 9:59 AM, links a Facebook source, and leaves the exact time blank. That distinction is worth carrying over: an interval is not an exact timestamp. I opened the reference's share menu, but did not verify its copied URL or restoration behavior. I did not audit the whole collection or import its media or code.

| Reference behavior | Atlas implementation in this update | Further work |
| --- | --- | --- |
| Map selection opens the associated photograph | A selected NWS observation opens its original attachment and recorded assessment | Historical basemap with known date and suitable rights |
| Filmstrip offers another way through the collection | Labeled thumbnails, previous/next and a native observation selector | Grouping multiple viewpoints of the same moment |
| Filters narrow the mapped evidence | Rating, observation text and photographs-only filters combine | Time filters once capture times are established |
| Record explains source and location | Original record link, feature coordinates, source credit and explicit missing metadata | Named photographers and camera positions only when sourced |
| Reader can share a particular item | Observation links restore the selected record and filters on reload | Stable links across future source revisions |

Public configuration inspected: [application data](https://www.arcgis.com/sharing/rest/content/items/1b7d4d22866b445881b181614e25d4d4/data?f=json) and [web map data](https://www.arcgis.com/sharing/rest/content/items/39b51519e0394714961af558c35af36d/data?f=json). The application data SHA256 was `9fd542eca26d84a766f010f14a59032c4d39ff1ad18c62d64e3ba40edf280e7f`; the map data SHA256 was `65b23f7fc7fc22924d574aaaf553b0f5f6c8592a01fccaf26703704e48c7ce5c`. Public visibility alone does not establish permission to republish every attachment.

## Forty-five photographs, with a defensible connection

The [NWS Damage Assessment Toolkit service](https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/MapServer) has a separate attachment interface. Its legacy image field is not a reliable inventory of those attachments. A bounded query for the existing 336 geographically selected records returned 45 original photographs at 45 records, plus 44 thumbnail files.

The importer checks each parent object ID and global ID against the preserved survey response. It rejects unknown or duplicate parents, incomplete responses, orphan thumbnails, invalid file metadata and changed reviewed counts. The raw response's bytes and SHA256 are preserved separately from normalized data. Thumbnails do not count as additional photographs.

The page initially shows the 45 photographed locations. Readers can reveal all 336 records. Some have no photograph and say so. Images load from the original NWS service as needed; a failed request leaves the assessment and source link available. The nine photographs already preserved in the exhibit gallery remain a separate collection. They have not been silently matched to survey points.

These joins establish which attachment belongs to which survey record. They do not establish the photographer, capture time or camera position. The marker is the surveyed feature. The regional records remain preliminary, and their blank event IDs mean that selection within the published outline is a geographic association, not a verified event-ID join. Original service metadata and the exact bounded query are recorded in [the attachment manifest](../exhibits/el-reno-2013/survey-attachments-source.json).

## Reading, exploration and community context

[Segel and Heer's narrative-visualization paper](https://idl.cs.washington.edu/files/2010-Narrative-InfoVis.pdf) examines 58 examples and offers a design framework for balancing an authored story with reader exploration. I read its abstract, introduction and sections 4.1 and 4.2. It is a design analysis, not an experiment proving that one layout increases engagement.

My application of that framework is to keep the history readable in sequence, with explicit links into evidence and back to the relevant explanation. The new damage explorer links to history, remembrance and the EF-rating discussion. Community entries link back to the observations they discuss. A debate should explain what the original evidence supports, what it contradicts and what remains unknown.

The underlying records should remain distinct:

- **Event account:** sourced history, chronology, definitions and casualty counts with their scope.
- **Places:** tornado path, damage outline, surveyed feature and camera position, each with its own meaning.
- **Time:** exact time, interval or unknown, plus timezone and registration uncertainty.
- **Media:** original source, credit, rights, caption and independently justified place/time associations.
- **Assessment:** the source's rating and damage description, separate from a new interpretation of an image.
- **Community claim:** the question, evidence trail, counterevidence and current conclusion.
- **Reconstruction:** authored geometry and motion linked to observations, with assumptions visible.

Stable identifiers connect these records. A reader should not have to guess whether a point means a photographed building, a camera, a tornado center or a death location. Remembrance locations and names require their own reliable public sources. Missing details should stay missing rather than become plausible-looking map pins.

## Appearance research: preference is not the same as performance

Consensus was used to discover and retrieve paper records, followed by primary-source checks where accessible. Its summaries were treated as leads, not independent corroboration.

[Sethi and Ziat's polarity study](https://doi.org/10.1080/00140139.2022.2160879) reports effects that vary with age group and lighting, and distinguishes reading performance from preferences. The abstract was inspected through Consensus; the full paper was not reviewed. This supports caution about prescribing one mode to every visitor, not a claim that either theme universally prevents fatigue.

A [2024 study by Muhamad and Mokhtar](https://he01.tci-thaijo.org/index.php/jhsmr/article/view/275050) tested 30 young adults reading on a laptop for 15 minutes per polarity. Its journal abstract reports faster reading in dark mode, without a significant difference in the measured reading errors. That population and task do not establish how an older visitor, a phone user outdoors or someone examining radar will perform. The abstract was read; the full paper was not.

The resulting design decision is **System, Light and Dark**, with a saved visitor choice on the El Reno exhibit. System follows the browser-exposed color preference. A browser's decorative toolbar theme is not necessarily the same preference. Historical photographs and radar are not recolored. The map retains a separate documented palette so a reading-theme change does not change the apparent meaning of the source imagery.

[MDN's color-scheme documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme) explains the browser preference interface. Its [forced-colors documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/forced-colors) describes user palettes that replace page colors. The exhibit uses system colors in that mode and preserves selection outlines. Arbitrary extensions may rewrite a page in other ways; supporting these standards does not guarantee compatibility with every extension.

The implementation follows specific accessibility requirements and design targets:

- Text contrast is checked against the [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): 4.5:1 for normal text and 3:1 for large text.
- Rating words, record IDs and selected-state outlines accompany color, following [use-of-color guidance](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).
- Controls reflow at narrow widths, including 320 CSS pixels, following [reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). Maps retain a two-dimensional view while the surrounding reading remains usable.
- Principal buttons target 44-pixel height. The [WCAG 2.2 AA target-size requirement](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) is 24 CSS pixels with exceptions; 44 is our more generous design target, not a claim about that minimum.
- Playback starts paused. Reduced-motion preferences disable decorative transitions and smooth scrolling.

This is not a WCAG conformance certification or a claim that visitor enjoyment has been measured.

## What the strongest storm research changes

The new history context draws on the [NWS event account](https://www.weather.gov/oun/events-20130531) and the abstract of [Bluestein, Snyder and Houser's multiscale overview](https://doi.org/10.1175/WAF-D-14-00152.1). These support explaining the storm's larger environment before discussing the tornado. They do not supply a ready-made animated funnel.

For reconstruction, [Wakimoto and colleagues' 2015 photogrammetry study](https://escholarship.org/content/qt1md9s51b/qt1md9s51b_noSplash_116f4892f819852acb1afb94a8cb3b15.pdf) is particularly relevant. I inspected the abstract and section 2 methods. It combines photographs with mobile radar using known observer positions, identifiable horizon targets, camera geometry and time alignment. The implication for Atlas is a registration workflow: establish where and when an image was taken before aligning it with the path and radar. The paper's calibration accuracy cannot be assigned to our uncalibrated overlay, and a radar signature should not be treated as a direct picture of the visible funnel.

The [2016 aerial-survey and radar study](https://doi.org/10.1175/MWR-D-15-0367.1) is a further lead for connecting damage swaths and radar observations. Its abstract and indexed excerpts were accessible; the publisher's full text was not reviewed. No new wind-field coefficients, exact collapse times or historical funnel geometry were fitted from these papers in this update.

## Verification and what comes next

The current build passes 88 Python tests and 58 JavaScript tests, plus exhibit integrity and the 80,318-record catalogue check. Tests cover attachment provenance, exact parent joins, malformed responses, filter composition, observation-link restoration and map zoom bounds.

In the Chromium-based in-app browser, I checked original photographs, rating filters, previous/next, a record without media, empty search and reset, enlargement, a shared observation after reload, persistent appearance, system appearance and forced colors. A deliberately blocked image showed the fallback without losing the record. At 390 and 320 CSS pixels the document did not overflow horizontally. Temporary network and device overrides were removed.

Firefox, Safari, physical iOS/Android devices and third-party theme extensions have not been tested. An emulated narrow layout is not a physical-phone test. The new appearance selector currently applies to the El Reno exhibit, not every separate atlas or simulation page. These limits should remain visible in any release claim.

Next priorities are a dated and licensed geographic basemap, registered historical photographs tied to exact or bounded times, and a more complete documentary sequence. The simulation should consume that evidence only where it supports a reconstruction. An attractive generic tornado remains an illustration until its event-specific geometry is checked.

Visitor testing should ask people to find a damage photo, identify its source and location meaning, share it, navigate back to the history, and distinguish a documented fact from a community claim. Test keyboard use, phone layouts and each appearance mode. Record task completion, errors and explanations of uncertainty. Time spent on the site alone is not evidence that someone understood it.
