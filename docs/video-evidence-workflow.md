# From a video to an exhibit

The initial source collection is Pecos Hank, TornadoTRX and Swegle Studios. Each channel was supplied by the project owner. That establishes a research priority, not an automatic endorsement of every statement or a license to reuse footage.

## Organize around the event

1. Record the video's stable ID, original title, uploader and URL. Keep the exact subject and event date unresolved until checked. El Reno 2011 and El Reno 2013 are separate events.
2. Connect it to an event exhibit. One documentary can cover several tornadoes; one tornado can appear in many films. An outbreak is a separate grouping.
3. Inspect the description, credits, corrections, citations and available captions. Record exactly what was accessed. Captions can be wrong and do not count as an audio audit.
4. Review the film in bounded passages. Record elapsed video time, scene cuts, credited camera operator, location, viewpoint and visible features. Preserve uncertainty in each field.
5. Match shots to independently supported historical times. Playback time can change through cuts, time lapse, slow motion and repeated footage. Do not align a whole documentary to the event with one constant offset.
6. Compare the account with official surveys, original research and contemporary observations. Two videos using the same clip are one observation, not two independent confirmations.
7. Add a claim to the evidence ledger. Keep disagreements and corrections visible. A superlative in a title does not establish a measured ranking.
8. Build a reconstruction only to the detail supported. Specify which clouds, condensation boundaries, circulation, debris and damage are observed, inferred or illustrative.

## Review status

* `metadata_only`: title or listing located; no watched-content claim.
* `description_checked`: event or other metadata checked on the watch page.
* `partial_review`: specific text or visual intervals examined, with coverage recorded.
* `full_review`: the entire specified video version examined; unresolved claims may remain.
* `discrete_clock_anchors`: particular paused samples have a recorded source time and visible historical clock. This is temporal registration only; it does not establish camera location or continuous coverage.
* `registered_observations`: particular shots have defensible temporal and spatial placement.

These statuses describe work performed. They are not confidence scores or a quality ranking of creators.

The original Robinson upload now has seven `discrete_clock_anchors` in
`exhibits/el-reno-2013/footage.json`. The shared clock offers each moment and
cues the original host player only after a visitor loads it. No coverage is
assigned between those samples. Playing the source video leaves the historical
map paused. The [registration record](../research/footage-registration-2026-09-21.md)
contains the source version, observed clock values and limits.

## Observation fields

Every observation needs a source ID, elapsed start and end, access method, inspected date, concise original note, and evidence type. Historical time, camera position, view direction, measured dimensions and uncertainty stay null unless supported. Preserve who actually filmed the shot, even when a different channel uploaded the documentary.

Store short notes and links by default. Do not paste full transcripts into project documentation. Do not scrape membership content, download creator footage for redistribution, or publish frame captures as museum assets without an appropriate reuse basis. Use credited external links while rights are unresolved.

The first implemented register is `exhibits/el-reno-2013/observations.json`. Two inspected stills and three creator annotations are published with different labels. Its validator prevents an inspected still from becoming a claimed continuous interval or acquiring an unsupported camera/time placement. A sampled image must be checked after seeking: an advertisement or stale decoded frame is not evidence from the requested scene.

The [2014 El Reno Survey Project abstract](https://ams.confex.com/ams/27SLS/webprogram/Paper254094.html) describes fixing time and location before combining multiple views. This is a useful precedent for future registration. Reading that abstract is not equivalent to implementing or validating the researchers' complete method.

## Initial comparison cases

* El Reno 2013: Pecos Hank footage and TornadoTRX's documentary, alongside NWS geographic evidence. The first preview implements the path, not a completed appearance reconstruction.
* Blackwell 1955: Swegle's watch-page description confirms the subject. TornadoTRX's Blackwell title is a related lead. Compare historical testimony carefully before visualizing reported light phenomena.
* Pilger: keep multiple vortices and tornado identities separate.
* Argentina: find exact events from the footage before making country-level catalogue claims.
* Wizard of Oz: a possible visual methods reference, explicitly fictional.
