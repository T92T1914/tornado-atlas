# Local curator workflow

The research desk edits private drafts and validates dossier candidates. It does not publish directly, download media, or register a camera or clock from a source link. Existing catalogue and exhibit files remain the source of the starting context.

Start it from the checkout with Python 3.11 or newer. Choose a private store outside the repository and its public web directory:

```text
python -m atlas.curator --store /absolute/private/atlas-drafts
```

The command prints a loopback session URL and does not launch a browser. Open that URL in your own browser when appropriate. The service binds only to `127.0.0.1`. A random session token protects private API reads and writes. Writes also require the exact local origin and JSON content type. The token stays in the browser session and is not included in exported files. Closing the command ends the service. A file lock prevents two cooperating curator servers from writing the same store.

## Work through a source

1. Choose a reviewed event or search the retained catalogue for a source record. Give the draft a stable local name. A source-record draft does not acquire a reviewed whole-event association.
2. Add private notes for research questions or permission work. These notes enter private backups but never the candidate export.
3. Add a lead or media annotation with an original source URL, exact locator, attributed account and limits. Record creator, uploader and rights holder independently, with an attribution basis. Leave unsupported roles blank.
4. Keep the capture clock, upload/publication time, retrieval scope and video presentation seconds separate. A paused sample uses the same start and end second. Reported place text does not become coordinates. Intake starts unreviewed, unregistered and unresearched even when the link works.
5. Save and reopen the draft. Repeating an identical intake key and content is idempotent. Different content under the same key is rejected so a source revision does not silently erase the earlier record. Use a new revision key and record the relationship and conflict in the dossier account or review.
6. Inspect the complete dossier editor when reviewing competing claims or changing a supported status. The archive validator remains the publication contract. A claim's assertion, time, position, availability and rights states stay separate. The UI does not certify a curator's historical judgment.
7. Validate and preview the candidate. Inspect the exact exported JSON as well as the readable cards. Download it for the repository's reviewed integration path. Candidate status is not publication or new human approval.

The El Reno starting dossier contains retained photographs and discrete Robinson dashcam clock samples. **Fill from a retained video sample** prepares an intake form from that existing record. It performs no new video inspection and does not extend the sample into continuous coverage. You can use it to rehearse the private save, annotation and export cycle without acquiring media. Do not publish duplicate records merely because a rehearsal created them.

## Saved revisions and recovery

Each save compares the expected SHA-256 of the saved draft before replacing it atomically. A conflicting browser tab receives an error and cannot overwrite the newer saved revision. Reopen the draft, inspect both edits and combine them deliberately. Keep private stores away from unrelated writers. The store lock coordinates this tool's servers, not arbitrary text editors.

Opening another draft asks before discarding unsaved notes or dossier edits. Editing either after a candidate preview disables its download until you validate again, so an old preview cannot silently stand in for the current draft.

While a save, intake or preview request is pending, the editor holds its controls until the response is applied. This prevents a delayed response from replacing text typed after the request began.

Download a private backup before a substantial curation session. Restore validates the complete batch before writing, keeps the original saved bytes for canonically identical content and rejects an existing draft with differing content. Save and restore use the archive's canonical JSON identity, which distinguishes booleans, integers and floating point forms. Key order and whitespace do not create a new content identity. Restore a conflicting backup into a separate private store. An interrupted restore can be repeated because each new draft is atomic and identical existing drafts are retained. If storage reports an error, reopen the affected draft before assuming it saved.

For one open draft, **Download saved draft backup** preserves its complete saved content, including private notes, intake records and original event base. Save or reopen unsaved edits first. The server checks the saved revision, so another tab's newer save requires reopening before download. This action never saves edits, includes other drafts or publishes anything. Its private backup uses the same restore format as a whole-store backup. The separate candidate download still excludes private notes and intake records.

A valid store can exceed the 2 MB whole-backup limit even when each draft fits its own limit. In that case, open each saved draft and download its private backup individually. Keep these files private and restore them one at a time into a separate store when inspecting conflicting versions.

### Recover a draft after the reviewed event advances

An event draft keeps its original reviewed base. If a newer account has been published, **Preview draft recovery** reads that current account and verifies the retained original against the draft's complete base digest. The preview changes no saved file. It compares the original, your edited draft and the current account using the archive's existing field comparison. Compatible private edits are carried onto current content. Private notes and the intake ledger stay in the recovered draft.

When both accounts change the same field differently, choose **Use private edit** or **Keep current reviewed value**. Status, time, place and other structured fields are compared as complete values, so recovery does not invent a mixture of conflicting clock or rights qualifications. A removed row that has newer edits also needs a choice. Current row order is preserved and compatible private additions follow it. A private reorder or an insertion among existing rows needs an explicit order choice, which keeps the other account's additional rows available.

Authored provenance changes receive their own choices. The current publication review stays attached as the record of its earlier publication. It does not approve the recovered candidate. A private change to `publication_review` cannot be recovered automatically. Keep that draft and inspect its provenance manually.

Open each conflict's original, private and current values. **Inspect complete recovery context and result** includes all three dossiers and the resulting private draft, including notes. Keep this material private. After choosing conflicts, use **Review selected recovery choices** to inspect the validated result before **Save recovered draft**. Editing notes or dossier JSON invalidates the preview.

Saving rechecks the expected private revision, exact edited content and freshly read current account. A changed preview, missing or invalid original, invalid combined result, exceeded size limit or storage error prevents a successful save. The saved original remains available until the atomic save succeeds. Reopen after a storage error to inspect the actual saved state. Source-record drafts have no reviewed event base and cannot use this recovery path.

Recovery changes the private draft's base to the checked current account. Validate and inspect a new candidate before export. If the reviewed account advances again, the unchanged publication-time base check rejects that stale candidate. Recovery grants no publication permission, historical registration or new source approval.

Conflict disclosures, complete recovery context and the dossier editor preserve server-produced JSON literal text. This keeps integer and floating point forms such as `1` and `1.0` distinguishable. Save, intake, recovery and candidate validation submit the literal edited dossier to the existing Python decoder. Candidate downloads and private backups also preserve those numeric forms. Restore sends the bounded original backup text through the same validator. JSON syntax and literal identity remain separate from the historical meaning of a number.

Limits are 250 KB per draft, 100 drafts per store and 2 MB per backup/import request. Oversized or malformed documents fail before publication. The service serves only the editor's allowlisted static assets, not the private store, the full checkout or arbitrary paths. It sends no cross-origin API permission headers and does not fetch submitted URLs.

## Candidate boundary

Source hosts must use explicit spelling rather than percent-encoded authority text or abbreviated, octal or hexadecimal IPv4 forms. Internationalized hostnames are checked in their ASCII form while the supplied URL stays unchanged. These checks reject private address literals and ambiguous host forms. They do not resolve DNS, follow redirects or replace the curator's privacy and rights review.

An explicit source port must be numeric and within 0 to 65535. A bracketed address must occupy the complete host part, with only an optional port after its closing bracket. Invalid ports and extra authority text fail intake, save, restore and candidate validation before they can break the public dossier view. Valid explicit ports, empty port markers and the original path, query and fragment stay unchanged. These syntax checks do not expand the address policy or establish that a source is reachable.

The candidate envelope records schema version, `atlas-curator-candidate` kind, original event identity and original generated dossier digest, plus the validated dossier. Private notes and the intake ledger are excluded. A later reviewed promotion must compare that base with current source output and reject stale candidates. Source-record-only drafts have a null event base and need a separate reviewed association before event promotion.

Reviewed promotion retains the previous public dossier before replacing its current reviewed account. Two promotions before a publication build therefore keep both predecessors available for correction history. An existing equivalent snapshot keeps its original bytes. A conflicting snapshot or storage failure stops the replacement. Older missing predecessors remain documented gaps. This does not publish private notes or replace the separate Git review and site build.

Only the intake state changes to candidate during export. Source-reported values, assertion states, rights, clock and place qualifications remain intact. An unknown capture time or unavailable source does not become known because a JSON document validates. Review prose for personal information before committing, even after structural privacy checks pass.

The public site has no writable curator service. It can display this static explanation, but authoring requires the local command and session URL. No new hosted account, database service, background watcher or automatic publication credential is required.
