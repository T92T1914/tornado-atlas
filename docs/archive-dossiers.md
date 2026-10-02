# Following a record into its evidence

The [archive entrance](https://t92t1914.github.io/tornado-atlas/dossier.html) connects the existing source catalogue to small event dossiers. El Reno, Joplin and Blackwell share one renderer. The Wybark example uses the same record route with a short official account and no reviewed event association.

A source record is not a canonical event. The imported NOAA ID, episode ID, county segment and reviewed event association remain separate. Association rows retain the reviewed basis from `research/record-aliases.json`. An association can be revised without changing the underlying source record. Alternatives remain an explicit list, empty only where none have been recorded. The application does not infer joins from nearby coordinates.

## Evidence contract

`atlas.archive` projects existing reviewed material into schema version 1. This is an additional archive contract, not a renaming of the existing replay schema or a destructive database migration. The original chronology, notebook, video anchors, radar manifest, catalogue and old URLs remain usable.

Each dossier separates sources from observations and media. Sources retain title, original URL, exact locator, access coverage, revision, rights and agent processing. Evidence items point to a source and preserve their own locator, account, limits and review scope. Creator, uploader and rights holder are separate roles. Missing attribution remains null. Creator pages contain linked contributions and their attribution basis, not generated biographies.

Six status dimensions remain independent: intake, assertion, temporal registration, spatial registration, availability and rights. A linked copyrighted photograph can be inspected while its camera position remains unregistered. A discrete clock sample does not register the video between samples. A documented unsuccessful search needs its date, scope and method. It is different from a source that has not been researched.

Clock roles are event, capture, publication, retrieval, video presentation and derived alignment. Place records retain their role, source wording, coordinate availability and basis. Unregistered entries cannot acquire coordinates or an alignment accidentally. Original units, reported ratings and impact definitions remain in the source record download. Source disagreements are displayed as attributed observations, not resolved by a preferred value.

The present reconstruction contract has no registered appearance intervals. Geographic replay and documentary chronology remain useful without claiming historical visual coverage. The labels Catalogued, Dossier, Exhibit and Reconstruction describe available coverage. They do not certify historical completeness.

## Publication and loading

Run `python -m atlas.archive` to validate and build the projection. Run `python tools/check_archive.py` to compare the checked public files with their current source projection. Each event document has a content digest in its filename. The small index is published last. Existing event documents remain available when the index advances.

A direct event visit loads the index and that event document. It does not fetch the complete media collection or third party images. A record visit hashes the stable ID to locate one of the existing catalogue shards. The source download contains only that selected public record. This uses the current catalogue count and shard map rather than copying thousands of records into another index.

Each event also loads a small revision list. The correction-history section links the retained snapshots and their exact metadata downloads. A `revision` query identifies one indexed dossier SHA256, so its observations and source-card links stay in that same snapshot. Unknown or cross-event identities produce an unavailable view rather than silently showing current text. Existing links without a revision still open the current dossier.

Related source-record links and creator pages continue to open the current catalogue and attribution views. The retained dossier preserves its own association basis, evidence and source cards. It does not claim that the catalogue or creator page has been rewound to that publication.

Publication-review records retain their stated basis and predecessor identity. Field differences are calculated only when both snapshots are available. An absent predecessor remains an explicit gap, and a snapshot without a review record does not acquire an invented date or decision. The list puts the current dossier first and orders the rest by identifier. It is not a complete chronological history. Dossier identities remain separate from original source revisions and historical clock roles.

The archive builder validates retained dossier filenames against their content identities and leaves their existing bytes untouched. It rejects malformed retained evidence and attempted immutable replacement. The new revision list does not expand source inspection, media hosting rights or historical registration.

The public renderer creates text nodes for imported content. It does not interpret source text as HTML or instructions. External links use HTTPS source validation. Local and private address literals are rejected. These mechanical checks do not replace a curator's privacy and rights review before publication. No private notes or original EXIF belong in the public dossier schema.

Metadata links are available even where media hosting is not permitted. Hashes are recorded only for retained bytes, such as the radar original and published PNG. A linked video is not a preserved original. No additional footage, photograph or source figure is downloaded by this view.

## From private research to a reviewed publication

The [local research desk](curator-workflow.md) exports a candidate without private notes. Review its exact diff, source locators, attribution, rights and status fields before promotion. The following explicit action accepts a candidate against its original event revision:

```text
python -m atlas.archive --candidate /absolute/private/candidate.json --basis "Describe the inspected evidence and publication scope."
```

Promotion rejects a changed base. It records agent processing and changes intake to published without promoting assertion, availability, time, position or rights. The reviewed override lives in `research/archive-curated`. If retained adapter inputs later change, publication stops until that override is rebased and reviewed. A source-record draft cannot promote itself into a canonical event.

The first exercised cycle clarifies the existing Robinson source locator with seven retained presentation seconds. It adds no duplicate media, new timing claim or continuous video coverage. Private rehearsal drafts, notes and backups remain outside the repository. Reverting a reviewed override restores the retained adapter output. Content addressed public documents remain available for older index references, and the existing Git history retains the publication decision.

## Visitor checks and remaining human study

Automated browser journeys cover source record to event, photograph to source card, creator to contribution, chronology discovery, unavailable content, reload, Back, both appearances, narrow layout and enlarged text. They run in temporary headless profiles. They are not human participants or physical phone tests.

For a consented unfamiliar reader, use these tasks without explaining the answer first:

1. Find a source record near a town and explain whether it represents a whole tornado.
2. Follow an El Reno photograph to its creator and state what its caption does and does not establish.
3. Find a source disagreement and identify both attributed values.
4. Locate the historical radar timestamp and explain whether an empty area proves no rain.
5. Find an event through its available evidence rather than its exact name.
6. Open the sparse Wybark record and explain what has not yet been researched.

Record consent, task outcome, observed navigation, confusion and the tested revision privately. Do not label agent walkthroughs as this study. Participant observations remain unavailable until an actual study occurs.

Source corrections use the existing GitHub issue template. They enter review and cannot directly change accepted history. The public form is a real GitHub receiving workflow. It warns contributors against sharing private information or media they lack permission to upload.
