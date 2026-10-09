# Evidence coverage

`web/coverage.html` lets visitors inspect the published layers across the event
index. It links the existing documentary chapters, chronology and replay routes,
and exact versions of the evidence dossiers. The page remains readable without
JavaScript. Its optional filters retain the event and layer in the browser URL.

## Publication inputs

`atlas.evidence_coverage` reads the reviewed event index, validates the existing
event packages through `atlas.event_package`, and reads the reviewed dossier
projection through `atlas.archive`. These remain the authoritative inputs. The
coverage page does not introduce an event registry, observation store or clock.

Replay and interactive chronology availability come from those validated
packages. Video and radar context come from published, reviewed dossier media.
Disputed observations remain attributed disagreements. Missing classifications
are shown as missing reviewed references, rather than claims that sources do not
exist.

The optional `exhibits/<event-id>/layers.json` records reviewed membership for
geography, damage, appearance context and selected uncertainty records. Each record contains a schema version,
its event identifier, the canonical dossier digest, an optional reviewed survey
digest and basis, and lists of existing observation or media identifiers with a
classification basis. It contains no copied source accounts or derived geometry.

Publication rejects references to another event, absent evidence identifiers,
changed dossiers and changed mapped surveys. A changed dossier requires review
of the memberships and their basis before its digest is updated. Do not update a
digest simply to make the check pass. An omitted record leaves the contextual
classification unknown. It does not hide an independently validated replay.

## Evidence limits

The page distinguishes geography, optical appearance, video samples, radar and
damage. Survey outcomes retain their untimed status. Storm photographs can be
linked as visual context without admitting an appearance interval. Aftermath,
satellite damage scars and source maps belong to their documented context.

Linked records retain their accounts, limitations, source revisions, item
inspection scopes, separate time and date roles, and rights statements. These are existing reviewed records, not new inspection of each
original source during page generation. Each dossier link pins the dossier
revision and selected item. Original source links remain available. The page
loads no source media and grants no additional redistribution rights.

The gaps layer includes disputed observations and selected records with
documented uncertainties, while preserving each record's assertion status.
Its pinned dossier route also exposes limits outside the selected memberships.
Layer wording follows the admitted package and reviewed memberships. It does
not republish an older reconstruction summary as a fresh review of newer media.

A registered appearance window must agree with the dossier's reconstruction
status before publication. The current publication admits no historical
appearance interval. Paused video samples and illustrative replay symbols do
not supply one. Coverage counts describe displayed events and layers, not a
numerical measure of historical completeness.

## Build and check

From the repository root:

```console
python -m atlas.evidence_coverage
python tools/check_archive.py
python -m unittest tests.test_evidence_coverage
node --test --test-concurrency=1 tests/browser/evidence-coverage.test.mjs
```

The build updates the generated coverage HTML. The archive publication check
compares its exact bytes with a fresh projection and is already included in the
repository verification workflow. The browser test uses the existing isolated
`node:test` and Playwright-library harness. It checks filtering, source routes,
history, keyboard use, narrow layouts and the no-script path. Browser emulation
does not establish physical-phone or spoken screen-reader acceptance.
