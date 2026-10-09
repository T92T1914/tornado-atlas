# Comparing evidence accounts

The comparison section in an event dossier places two to four selected records
alongside their source accounts, limits, clock roles and inspection records.
Use **Compare this evidence** on a card to select the first record, then choose
another record in the comparison form.

Each selection belongs to one retained dossier revision. The ordinary GET URL
contains the event, full dossier revision and repeated `compare` parameters.
For example, `compare=media:friskey-joplin-storm` identifies the media category
and the existing item identifier. Native submission and **Link to this comparison**
pin that dossier version. Native Back, Forward and reload
retain that selection. There is no browser storage or additional evidence fetch.

An event URL without a revision follows the current publication. If it contains
comparison selections, the view explains that the version may change and offers
the versioned comparison link for retaining the displayed records.

The view uses the dossier already loaded by the existing archive route. It does
not merge records or compare them across versions. The existing correction
history remains the route for recorded differences between dossier revisions.
An invalid, repeated, absent or foreign selection shows an error with a clear
route, while preserving the event's ordinary documentary and evidence access.
Missing retained metadata does not substitute current accounts.

## Reading the comparison

Accounts remain attributed. Several cards drawn from one report remain one
reporting stream. The comparison preserves event association, capture,
publication, retrieval, video presentation bounds and historical alignment as
separate fields. A missing value remains unestablished. The page does not derive
a clock conversion, camera position, synchronized photograph, cause or
historical appearance.

Each card exposes its existing item inspection record, source revision,
source inspection scope and reuse statement. These are retained records,
rather than new source inspection during comparison. Its links open the exact
evidence and source cards in the same dossier version, or the original source.
No source media is embedded or preloaded, and no additional redistribution
right is granted.

The comparison keeps candidate, availability, assertion, time, place and rights
statuses separate. Displaying a candidate for comparison does not admit it as a
reviewed reconstruction layer. The current archive does not admit a historical
appearance interval.

## Verification

```console
node --check web/evidence-comparison.mjs
node --test tests/evidence-comparison.test.mjs
node --test --test-concurrency=1 tests/browser/evidence-comparison.test.mjs
```

The model checks selection bounds, exact item/source identity, retained-version
behavior, route identity and preservation of recorded status and clock fields.
The isolated browser checks exercise keyboard selection, native history,
source routes, unknown/error recovery, narrow and enlarged layouts, and the
existing documentary and coverage fallback. The dossier remains useful through
those reading routes when JavaScript or retained metadata is unavailable.
Browser emulation does not establish physical-phone or spoken-reader acceptance.
