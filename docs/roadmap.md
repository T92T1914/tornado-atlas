# Work ahead

The project can gain useful catalogue coverage before every tornado has a detailed reconstruction. The two should not be presented as the same level of completeness.

The destination is a museum where visitors can watch individual tornadoes unfold,
using documented paths and appearance evidence specific to each event when available.
Build the most infamous storms first, then expand toward the wider collection.
The [reconstruction plan](reconstruction-plan.md) defines the shared
playback approach, evidence levels and event selection process.

## Next exhibit work

The [NWRT source reader](../web/radar-source.html) now exposes the twelve retained
complete observations with selection, stepping and controlled display playback.
It preserves their irregular labels and the existing clock interpretation.
This is a documentary reading increment. The bounded historical appearance
reconstruction below remains unfinished.

1. Expand the initial El Reno register of seven clock samples into continuous shot coverage for both source videos, Dan Robinson's upload and the El Reno Survey's aligned edit of the same footage, including cuts, reuse credits and caption corrections. A [shot register of the Robinson upload](../research/robinson-shot-register-2026-11-16.md) now records its four passages, five transitions and a caption clock that changes its basis against the forward camera's own stamp. The exhibit's published register now carries those passages through its own reviewed El Reno dossier version. That version says `robinson-04` and `robinson-05` show the rear camera and that which caption basis matches the true time is open. The Survey's edit was unavailable on 2026-11-16, so its register is still missing. The cut review found no reuse credit in the Robinson upload, though a credit shorter than four seconds could fall between its sampled frames.
2. Locate original footage and research that can establish camera position, direction and historical time. The full text of the Seimon El Reno Survey paper has now been read, though not its figure images. The [record of what it registers](../research/seimon-el-reno-survey-2026-11-11.md) lists the recordings it places in time or space and the inputs it cannot supply. Its strongest candidate, T. Marshall's view at 2314:42 UTC, is [not admitted](../research/marshall-qualification-2026-11-16.md), because the only known edit of that footage is not public, so no public route lets anyone inspect the interval.
3. Establish exact survey locations for the nine included NOAA/NWS photographs. Captions currently supply roads and landmarks only. A [decoded pixel comparison](../research/nws-photo-survey-joins-2026-11-11.md) now matches each photograph to one NWS Damage Assessment Toolkit survey record, and the gallery links each one to that record on the survey map. The surveyed point is the damaged structure. It is not a camera position or a capture time. Do not infer precise failure times or wind fields from a rating.
4. Build shared event playback around the existing El Reno timeline, then add one limited appearance reconstruction from registered observations. Identify the view and time range it represents. The shared playback is built as software, as its [acceptance record](shared-playback-acceptance.md) describes, and the published register still has one source. The appearance reconstruction is not built.
5. Deepen the existing historical exhibits and evidence dossiers. Joplin and Blackwell are already part of the collection, alongside El Reno, Tuscaloosa and Birmingham, Newcastle and Moore, Udall, and Greensburg. Confirm reconstruction order after usable path, timing and appearance coverage is reviewed. Historical testimony and later explanations need separate labels.

The [September 20 audience review](../research/audience-notes-2026-09-20.md)
supports prioritizing registered camera views, understandable map legends,
photographs linked to their sources and the human history. The first exhibit now brings
its photographs into the opening view. New exhibits need their own verified
photographs and rights records. A catalogue record alone does not supply them.

## Catalogue work

* US imports now cover every year from 1950 through 2025. Next, review historical naming and source anomalies while keeping records and events distinct.
* The local JMA adapter and separate source browser retain classifications, sentinel values, ordered source rows and F/JEF intervals. Review source revisions and remaining interpretation limits without merging ambiguous and other gust cases into confirmed tornado counts. The [JMA guide](jma-adapter.md#separate-source-record-browser) explains the existing browser export.
* Investigate international research datasets and reuse terms before adding further adapters.
* Group county segments only with supporting identifiers or reviewed reasoning. A [record of NOAA's own continuation fields](../research/county-segment-links-2026-11-17.md) finds exactly one segment sharing an endpoint for 3,299 of the 3,737 records that name another county, from October 2006 on. Nothing is grouped yet, and a grouping still needs its own reviewed rule.

## Reconstruction work

The first procedural 3D form study now runs separately at `web/study.html`. It is an illustration with three adjustable forms, not an event reconstruction or fluid simulation.

* Represent observations, camera models, visibility and uncertainty independently of the renderer.
* Establish rights for any imagery from third parties that will be embedded or redistributed.
* Prototype wind and damage demonstrations as experiments with explicit assumptions. Do not label them reconstructions of an actual building failure unless supported.
* Include source comparison and uncertainty controls in the visitor experience.
* Make appearance, motion and supporting observations data specific to each event. Reuse the renderer and controls across exhibits.
* Publish bounded completed intervals and expand them as evidence improves. Do not claim complete event reconstruction from one reconstructed shot.

## GitHub and release work

The public repository is T92T1914/tornado-atlas. The workflow verifies the source bundle and tests before deploying the static web directory to GitHub Pages. Continue with evidence curation and small, reviewed releases.
