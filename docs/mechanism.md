# Follow an observation without losing its limits

This conceptual diagram connects a credited source record, its exact locator and
clock claim to checked context and an inspectable replay. It contains no weather
measurement, photograph, new historical registration or scientific result.

A photograph's stated time can remain unresolved when its timezone or camera
position is unknown. The source record keeps that uncertainty rather than assigning
an invented UTC instant. The existing shared replay clock places admitted path
positions and observations while procedural illustrations remain labeled. This
figure creates no additional clock, renderer or source correspondence.

Use the [source dossier](archive-dossiers.md) and
[ground-view contract](ground-view-reconstruction.md) for the actual data and
limits. Original photographs, radar colors and film pixels remain unchanged.
The adapter uses the existing project's `web/appearance.css` roles at the recorded
basis revision. It does not fetch mutable theme definitions.

The page starts in Obscur, including without JavaScript. A saved explicit
Clair/Obscur/Auto reading choice remains honored by the existing appearance owner.
Switching appearance does not reset replay, cameras, source selections or history.
The entry graphic stays Obscur in either surrounding appearance.

## Rebuild the graphic

The editable source is [mechanism.json](mechanism.json) and
[tools/render_mechanism.py](../tools/render_mechanism.py). Install the optional
[figure requirements](requirements-figures.txt) in an isolated authoring environment.
They are not application dependencies. Supply genuine Inter Regular 400,
SemiBold 600 and Bold 700 static TTF files from one release. No font files or
machine paths are distributed.

```console
python -m pip install -r docs/requirements-figures.txt
python tools/render_mechanism.py --font-dir /path/to/Inter/extras/ttf
python tools/render_mechanism.py --check
```

`OBSCUR_FONT_DIR` is an optional alternative to the argument. The renderer checks
actual font names, weights and Latin glyph coverage, exports opaque 1800 x 800
wide and 960-pixel-wide narrow PNG/SVG editions, and rejects labels outside the canvas.
The narrow height follows actual font bounds. The current recorded edition is 960 x 1279.
Labels use at least 30 points at 100 dpi. SVG labels are outlines from those same
files. Adjacent HTML/Markdown supplies selectable text and source links.

The generated `mechanism-rendering.json` records source/adapter hashes, font
hashes, renderer versions, layout and all four output hashes. `--check` compares
committed inputs and outputs without importing the application, downloading fonts
or silently regenerating missing files. A new presentation render is not a new
application or scientific execution. Actual receiving-page image selection,
readability and visitor font fallback remain separate checks.

