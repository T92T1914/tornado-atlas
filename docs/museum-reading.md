# Reading the historical collection

The collection opens with four historical exhibits. The map and source catalogue
remain below them, at `atlas.html#catalogue`. Existing record URLs, filters and
history routes continue to use the same catalogue. The museum header separates
the exhibit collection, exploration tools and source readers from each article's
own contents.

## El Reno reading and exploration

El Reno's essential historical reading is generated into `web/index.html` from
the same exhibit records supplied to its interactive tools. The introduction,
historical context and complete report, warning sequence, chronological account,
photographs, questions, impact figures, named remembrance, discrepancies and
source register remain available when scripts or the exhibit data cannot load.
Their existing anchors remain intact. The path player, source filtering and
photograph viewer enhance this reading when their dependencies are available.

The generated regions use explicit `reading:` comments. A source correction
belongs in the existing JSON authority, followed by a rebuild. Editing the
generated passage alone produces a publication check failure. There is no
separately maintained fallback account.

Regenerate essential reading from the checked bundle:

```text
python -m atlas.museum_reading
python tools/check_exhibit.py
```

The existing exhibit build also publishes the reading. Regenerate the shared
header after a change to the existing event registry:

```text
python -m atlas.museum_navigation
python -m atlas.evidence_coverage
```

The coverage generator uses the same header. Its detailed evidence remains
available behind the existing disclosures.

## Starting routes through the other exhibits

Joplin offers starting points through warnings and choices, buildings and refuge,
and the surveyed path and original evidence. Blackwell keeps path, clocks and
remembrance beside forecast bulletins, testimony, rescue and archival leads.
Tuscaloosa and Birmingham connect the path through communities with warnings,
storm observations and the aftermath. Each starting point links into the
retained article. They do not assign an impact time to a survey place, register
an appearance interval, or establish permission for an archival photograph.

The appearance selector stays disabled at its system setting until the existing
appearance script enables it. Reading without scripts follows the system's
light or dark preference. Longer documentary credits and source words wrap
at narrow widths and enlarged text without shortening their wording.

## Documentary photograph versions

The two Daniel Rodriguez photographs retain their original bytes, credit,
source links and CC BY 2.0 license links. Smaller JPEG versions at 640, 1280 and
1920 pixels keep the full frame. They are resized with Lanczos resampling and
JPEG compressed at quality 82. The original retains its SHA-256 identity and
dimensions. Each reading version has separate byte counts, dimensions and a
SHA-256 record in the existing photograph data.
The page uses responsive versions for reading and preserves original-file links
and enlargement. The photograph captions identify the resizing and compression.

Regeneration requires Pillow:

```text
python tools/build_storm_reading_versions.py
python -m atlas.museum_reading
```

Publication checks use the standard library and the retained version identities.
They do not require Pillow or repeat the original source inspection. The
permissions basis is the attributed CC BY 2.0 record on each Commons source
page, inspected again on October 10, 2026. These files remain documentary
context. Camera clocks, viewpoints and historical appearance intervals have
not been registered by making reading versions.

## Acceptance boundaries

The reading tests compare the visible historical paragraphs, names and source
counts with their records. They exercise the collection entrance, narrow and
wide reading, ordinary enlargement and connected focus, clock selection and
reload, no-script reading, source filtering, failed data and module responses,
failed photograph responses, and doubled computed text at 320 pixels.
Controlled failures and browser emulation have their stated scope. They do not
establish physical phone behavior or spoken screen-reader acceptance.

An isolated expert walkthrough provides rendered observations. Human visitor
feedback is a separate evidence category. None has been collected for this
release at the time this note was written. Local checks, independent review,
required CI, deployment and public visitor acceptance remain separate gates.
This editorial work does not complete the required historical El Reno
appearance interval.

## Museum links from the private curator

The curator's header opens the public museum in a separate tab with no referrer
or opener access. Its private server serves the shared navigation stylesheet
alongside the existing editor assets. It continues to refuse article files and
private store paths. Curator API requests remain on its private loopback origin.
