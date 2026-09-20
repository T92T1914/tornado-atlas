# A documentary that also works as a reference

Reviewed September 20, 2026. This pass covers the El Reno exhibit's reading
structure and navigation. It does not establish a winning visual design or
measure how visitors behave on Tornado Atlas.

I want someone to be able to read the storm's history from beginning to end,
then return later to find a photograph, a location or a source without searching
through the whole page again. The animation belongs alongside that account.

## What informed the change

* **Descriptive headings and readable groups.** Nielsen Norman Group's
  [layer-cake scanning article](https://www.nngroup.com/articles/layer-cake-pattern-scanning/)
  describes readers using headings to find relevant passages. The practical
  guidance includes clear visual hierarchy and keeping related items together.
  I replaced the exhibit's more indirect section titles with literal labels
  such as History and context, Path and timeline, and Damage survey. This is an
  application of UX guidance, not evidence of a measured improvement here.
* **Contents available during a long read.** Wikimedia's
  [desktop table-of-contents work](https://www.mediawiki.org/wiki/Reading/Web/Desktop_Improvements/Features/Table_of_contents)
  documents prototype feedback, a persistent side column and a compact form for
  narrow screens. El Reno now has a side contents list that marks the current
  section. On a phone it becomes an ordinary disclosure above the article,
  rather than covering the reading area. The exact breakpoint is our layout
  choice; no Wikimedia engagement percentage is claimed for this project.
* **A real photograph, its context, then deeper reading.** I opened the
  Smithsonian's [When Volcanoes Erupt](https://naturalhistory.si.edu/education/teaching-resources/earth-science/when-volcanoes-erupt)
  article in the browser and inspected its opening layout and article structure.
  It combines photography and attribution, descriptive headings, links to
  specialist records and an update date. This is an observed design example,
  not a usability experiment. Our existing tornado photographs keep their nearby
  credits, and the exhibit gains a readable source directory and update date.
* **Reflow.** W3C's [explanation of WCAG 2.2 SC 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
  describes reading at a width equivalent to 320 CSS pixels without requiring
  horizontal scrolling for ordinary text. Maps have a specific two-dimensional
  layout exception. The reading layout stacks its columns on narrow screens;
  that exception is not used to excuse page-wide overflow. This is one
  accessibility check, not a claim of full WCAG conformance.

The earlier [audience notes](audience-notes-2026-09-20.md) remain relevant:
visitors in the small forum sample mentioned chronology, survivor accounts,
remembering those who died and understanding map symbols. Those are anecdotal
preferences. The three selected creators remain research leads, with the
previously recorded partial review coverage. No additional complete YouTube
review was performed for this design pass.

## What changed in the exhibit

The article moves from context to the path, photographs, damage, remembrance,
questions, research, video sources and written sources. Its seven-entry written
chronology uses the same chapter data as the map. Each entry names the exact
published position its map link selects. The first chapter still describes
formation at 6:03 while linking to the first available point at 6:04. The final
entry retains the conflicting end times.

The historical introduction is based on the NWS account, rechecked during this
pass. The source directory organizes twelve sources already used by the exhibit,
explaining their roles and limitations. Existing historical claims, victim names
and source identities are carried forward from the earlier research record;
listing them here does not mean every original page was fetched again today.
The build rejects duplicate or unused bibliography URLs and an introduction
without a registered source. These are consistency checks, not fact checking.

The reading stylesheet applies only to this exhibit. Main prose is 17 pixels
with generous line spacing, supporting text is generally 14 pixels, and long
paragraphs have bounded line lengths. Those dimensions are implementation
choices to test with readers, not universal research-derived optimums. The
timeline still begins paused, and contents links move directly to their sections.

## What remains

The exhibit needs visitor testing: ask readers to find a specific time on the
path, distinguish a whole-event outline from a funnel, identify a photograph's
source and explain the casualty scope. Record errors and confusion before
claiming the page is easier to use. Slow-network, physical-phone and broader
assistive-technology checks remain separate from the local browser checks.

This establishes the reading template for the next storms. More historical
narrative, registered viewpoints, additional licensed photographs and individual
animated reconstructions still depend on source work. No amount of layout work
can supply an unrecorded view of a tornado.
