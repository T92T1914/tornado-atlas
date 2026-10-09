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

A direct event visit loads the index, its bounded revision list and one selected event document. It does not fetch the complete media collection or third party images. A record visit hashes the stable ID to locate one of the existing catalogue shards. The source download contains only that selected public record. This uses the current catalogue count and shard map rather than copying thousands of records into another index.

The index and revision list retain the full `dossier_sha256` logical identity and a separate `file_sha256` for the exact published bytes. The logical identity uses the existing sorted-key canonical JSON encoding in `atlas.archive.digest`, without a terminating LF. It is unchanged by this byte check. Existing dossier paths and retained file bytes remain intact, including their original whitespace and numeric spelling. The builder checks persisted dossier associations before publishing the index and rejects truncated-path collisions or attempted immutable replacement. Python values such as `1`, `1.0` and `true` are compared by their canonical publication encoding, so ordinary Python equality cannot silently substitute a different representation.

Current, retained, comparison and creator views share one dossier loading boundary. It reads at most 200,000 accepted response bytes, checks SHA256 against the selected full file reference, then decodes strict UTF8, parses JSON and validates the reading structure before displaying evidence. Revision lists have a 100,000-byte bound and must agree with the index's full current tuple. The response stream is cancelled on a reading failure. A chunk that exceeds the remaining allowance is rejected before accumulation. These are accepted-buffer limits, not hard network-transfer ceilings. Creator contributions are staged until every selected current dossier passes, so a later failure cannot leave a partial contribution view.

The primary metadata download button fetches and checks a fresh response before starting a browser download of those exact bytes. A failed response leaves the rendered dossier available and the same button ready to retry. Only one dossier download check runs at a time. The browser object URL is revoked after the download starts. A separate link explicitly opens the raw, unverified metadata file. The raw archive index and current documentary chapter links remain available without JavaScript. The no-script page does not provide the interactive retained-dossier reader.

This checks the association asserted by the publication metadata. It does not authenticate that metadata, establish freshness, verify the history as complete, or prove a historical claim. A publisher or attacker able to replace both the trusted reference and its file can supply another matching pair. Byte consistency also does not enlarge source inspection, reuse rights, optical timing or camera registration.

Current documentary chapter links remain available when JavaScript or dossier metadata cannot load. They open the current historical accounts, without replacing a requested retained dossier revision. Dossier search, evidence cards and revision metadata require JavaScript.

The inspected-source directory offers another entrance. Search source titles, exact locators, revision records and inspection scope across the current dossiers, or narrow the results to one event. Each card preserves the source's rights statement and separates linked observation counts from linked media counts. These counts do not establish independent sources, complete inspection or media availability. Two cards at the same URL remain separate when they belong to different source records or inspected scopes.

The directory is a separate content-addressed metadata file, loaded only when a reader opens source discovery. It does not download the event documents or original media to search them. Its source-card links include the indexed dossier revision, so a later publication cannot silently replace the evidence attached to that result. A mismatched directory fails with a retry and archive route. The builder rejects a directory over 256 KB rather than cutting off source records. Growth beyond that boundary needs an explicit loading design.

Each event also loads a small revision list. The correction-history section links the retained snapshots and their exact metadata downloads. A `revision` query identifies one indexed dossier SHA256, so its observations and source-card links stay in that same snapshot. Unknown or cross-event identities produce an unavailable view rather than silently showing current text. Existing links without a revision still open the current dossier.

Related source-record links and creator pages continue to open the current catalogue and attribution views. The retained dossier preserves its own association basis, evidence and source cards. It does not claim that the catalogue or creator page has been rewound to that publication.

Publication-review records retain their stated basis and predecessor identity. Field differences are calculated only when both snapshots are available. An absent predecessor remains an explicit gap, and a snapshot without a review record does not acquire an invented date or decision. The list puts the current dossier first and orders the rest by identifier. It is not a complete chronological history. Dossier identities remain separate from original source revisions and historical clock roles.

Where that recorded predecessor is retained, the history card links to the complete earlier and later values selected by the publication change list. The route supplies one event, successor `revision` and full `predecessor` identity. Duplicate or malformed parameters, a self edge, another event or a predecessor different from the explicit review fail admission. The successor's own publication review must agree with the recorded history. The reader reuses its checked successor and loads one predecessor through the same byte-verifying boundary. Both inputs and all requested targets are prepared before either dossier or the pair enters the page. A failed second response leaves the unavailable view and its retry, archive, catalogue and documentary recovery routes. Retry reloads the full selected URL even when it includes a section fragment.

`dossier-literal-model.mjs` scans the exact decoded source text under the existing 200,000-byte limit, a maximum depth of 32 and 20,000 visited tokens including object keys. It retains complete value ranges, original numeric spelling and whitespace within each value. Range positions are JavaScript string indices, not byte offsets. The scan rejects duplicate decoded keys throughout all subtrees and repeated row identities in every evidence category. The publisher's existing changes list selects fields and rows. The browser does not calculate another difference list from JavaScript equality or spelling. Disjoint dossier field descriptors are permitted. Repeated row descriptors, overlapping fields, contradictory row presence and fields absent at both endpoints are rejected.

The comparison shows full logical and exact file identities separately from the publication candidate identity. Earlier and later accounts keep complete contextual limits, locators, retained inspection records and source rights. Strings have readable decoded text and a native disclosure of their exact raw JSON. Other values retain their complete literals. An absent field, an absent row and explicit `null` have distinct labels. Versioned source, evidence and full-dossier routes remain attached to each endpoint. Current catalogue and attribution routes are labelled as current, and direct raw-file links remain labelled unverified. The existing comparison within one dossier and fresh verified download remain available. Without scripting, the current documentary chapters and raw archive paths provide the stated reading fallback. Comparing publication metadata does not enlarge original-source inspection, historical registration or reuse rights.

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
