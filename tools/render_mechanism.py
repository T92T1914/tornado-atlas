"""Render the conceptual project route. No application or scientific calculation runs."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "docs/mechanism.json"
RECEIPT = ROOT / "docs/mechanism-rendering.json"
FACES = {"Regular": 400, "SemiBold": 600, "Bold": 700}


def digest(path: Path) -> str:
    data = path.read_bytes()
    if path.suffix in {".py", ".json", ".md", ".css"}:
        data = path.read_text(encoding="utf-8").replace("\r\n", "\n").encode()
    return hashlib.sha256(data).hexdigest()


def inputs(config: dict) -> dict:
    names = ["docs/mechanism.json", "tools/render_mechanism.py",
             config["adapter"]["source"], *config["source_paths"]]
    return {name: digest(ROOT / name) for name in sorted(set(names))}


def check() -> None:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    record = json.loads(RECEIPT.read_text(encoding="utf-8"))
    if record["inputs_sha256_lf"] != inputs(config):
        raise ValueError("Mechanism source or adapter changed")
    expected = {config["output_prefix"] + "-" + layout + "." + ext
                for layout in ("wide", "narrow") for ext in ("png", "svg")}
    if set(record["outputs_sha256"]) != expected:
        raise ValueError("Incomplete mechanism output inventory")
    for name, expected_hash in record["outputs_sha256"].items():
        if digest(ROOT / name) != expected_hash:
            raise ValueError("Mechanism output changed: " + name)
    if record["application_or_scientific_execution"] is not False:
        raise ValueError("A conceptual figure is not an application execution")
    print("Mechanism source, adapter and four outputs agree")


def render(directory: Path) -> None:
    # Optional authoring dependencies never become application requirements.
    import matplotlib
    matplotlib.use("Agg")
    import fontTools
    from fontTools.ttLib import TTFont
    from matplotlib.figure import Figure
    from matplotlib.backends.backend_agg import FigureCanvasAgg
    from matplotlib.font_manager import FontProperties
    from matplotlib.patches import FancyBboxPatch

    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    roles = config["adapter"]["roles"]
    fonts, font_records = {}, {}
    for face, weight in FACES.items():
        path = directory / ("Inter-" + face + ".ttf")
        with TTFont(path) as font:
            names = {r.toUnicode() for r in font["name"].names if r.nameID == 6}
            if "Inter-" + face not in names or font["OS/2"].usWeightClass != weight or font["post"].italicAngle:
                raise ValueError("Expected genuine nonitalic Inter " + face)
            if not set(range(32, 127)).issubset(font.getBestCmap()):
                raise ValueError("Required Latin glyphs are missing")
        fonts[face] = FontProperties(fname=str(path))
        font_records[face] = {"filename": path.name, "weight": weight, "sha256": digest(path)}
    source_before = inputs(config)
    layouts = {}
    outputs = {}
    for layout, width, height in (("wide", 1800, 800), ("narrow", 960, 1100)):
        fig = Figure(figsize=(width / 100, height / 100), dpi=100, facecolor=roles["canvas"])
        ax = fig.add_axes((0, 0, 1, 1))
        ax.set(xlim=(0, width), ylim=(height, 0))
        ax.axis("off")
        labels = []
        card_labels = []
        def label(x, y, text, size=30, face="Regular", color=None):
            item = ax.text(x, y, text, fontsize=size, fontproperties=fonts[face],
                           color=color or roles["text"], va="top", linespacing=1.3)
            labels.append(item)
        narrow = layout == "narrow"
        margin = 48 if narrow else 72
        probe_renderer = FigureCanvasAgg(fig).get_renderer()
        def measured_size(text, size, face="Regular"):
            item = ax.text(0, 0, text, fontsize=size, fontproperties=fonts[face], va="top")
            box = item.get_window_extent(probe_renderer)
            result = (box.width, box.height)
            item.remove()
            return result
        def measured_height(text, size, face="Regular"):
            return measured_size(text, size, face)[1]
        def wrapped(text, size, maximum_width, face="Regular"):
            lines, current = [], ""
            for word in text.split():
                candidate = (current + " " + word).strip()
                if measured_size(candidate, size, face)[0] <= maximum_width:
                    current = candidate
                else:
                    if not current or measured_size(word, size, face)[0] > maximum_width:
                        raise ValueError("A mechanism word cannot fit without reducing type: " + word)
                    lines.append(current)
                    current = word
            if current:
                lines.append(current)
            return lines
        card_width = 864 if narrow else 500
        body_size, title_size = (33, 34) if narrow else (30, 32)
        body_lines = [[line for paragraph in p["lines"]
                       for line in wrapped(paragraph, body_size, card_width - 56)]
                      for p in config["panels"]]
        title_heights = [measured_height(str(i + 1) + "  " + p["title"], title_size, "SemiBold")
                         for i, p in enumerate(config["panels"])]
        line_heights = [[measured_height(line, body_size) for line in lines] for lines in body_lines]
        # Extra padding is real layout room, not a relaxed admission boundary.
        card_height = max(64 + title_heights[i] + 20 + sum(line_heights[i])
                          + 14 * max(0, len(lines) - 1)
                          for i, lines in enumerate(body_lines))
        if narrow:
            # Derive the stack from the actual font, never a font-size multiplier.
            title_y = 45
            subtitle_y = title_y + measured_height(config["title"], 40, "Bold") + 20
            card_top = subtitle_y + measured_height(config["subtitle"], 33) + 32
            footer_y = card_top + len(config["panels"]) * card_height + 24 * (len(config["panels"]) - 1) + 40
            footer_lines = wrapped(config["footer"], 33, width - 2 * margin, "SemiBold")
            footer_height = sum(measured_height(line, 33, "SemiBold") for line in footer_lines) + 14 * (len(footer_lines) - 1)
            height = max(height, int(footer_y + footer_height + 49))
            fig.set_size_inches(width / 100, height / 100)
            ax.set_ylim(height, 0)
        else:
            footer_lines = [config["footer"]]
            title_y, subtitle_y = 50, 140
            footer_y = max(680, 240 + card_height + 40)
            height = max(height, int(footer_y + measured_height(config["footer"], 30, "SemiBold") + 49))
            fig.set_size_inches(width / 100, height / 100)
            ax.set_ylim(height, 0)
        label(margin, title_y, config["title"], 40, "Bold")
        label(margin, subtitle_y, config["subtitle"], 33 if narrow else 30, color=roles["muted"])
        for index, panel in enumerate(config["panels"]):
            x = margin if narrow else margin + 578 * index
            y = card_top + index * (card_height + 24) if narrow else 240
            w, h = card_width, card_height
            ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=18",
                                       facecolor=roles["panel"], edgecolor=roles["line"], linewidth=2))
            first_label = len(labels)
            label(x + 28, y + 32, str(index + 1) + "  " + panel["title"], title_size, "SemiBold")
            line_y = y + 32 + title_heights[index] + 20
            for line_index, line in enumerate(body_lines[index]):
                label(x + 28, line_y, line, body_size)
                line_y += line_heights[index][line_index] + 14
            card_labels.append((labels[first_label:], x, y, w, h))
            if index < 2:
                start, end = ((480, y + h + 3), (480, y + h + 21)) if narrow else ((x + w + 12, 420), (x + 566, 420))
                ax.annotate("", xy=end, xytext=start,
                            arrowprops={"arrowstyle": "-|>", "color": roles["text"], "lw": 2.5, "mutation_scale": 18})
        for line in footer_lines:
            label(margin, footer_y, line, 33 if narrow else 30, "SemiBold", roles["muted"])
            footer_y += measured_height(line, 33 if narrow else 30, "SemiBold") + 14
        canvas = FigureCanvasAgg(fig)
        canvas.draw()
        renderer = canvas.get_renderer()
        bounds = [item.get_window_extent(renderer) for item in labels]
        if any(b.x0 < 0 or b.y0 < 0 or b.x1 > width or b.y1 > height for b in bounds):
            raise ValueError("A mechanism label leaves the canvas: " + json.dumps({"layout": layout, "canvas": [width, height], "labels": [{"text": t.get_text(), "bounds": list(b.bounds)} for t, b in zip(labels, bounds)]}))
        for items, x, y, w, h in card_labels:
            for item in items:
                box = item.get_window_extent(renderer)
                if box.x0 < x + 12 or box.x1 > x + w - 12 or box.y0 < height - y - h + 10 or box.y1 > height - y - 10:
                    raise ValueError("A mechanism label leaves its card: " + json.dumps({"layout": layout, "text": item.get_text(), "label_bounds": list(box.bounds), "card": [x, y, w, h], "allowed_display_bounds": [x + 12, height - y - h + 10, x + w - 12, height - y - 10]}))
        # Cards and explicit line breaks provide a stable narrow composition.
        layouts[layout] = {"width": width, "height": height, "labels_within_canvas": len(labels),
                           "card_height": card_height,
                           "rendered_body_lines": body_lines,
                           "rendered_footer_lines": footer_lines,
                           "height_rule": "actual font bounds, measured-width wrapping and fixed padding/gaps",
                           "minimum_font_points": min(item.get_fontsize() for item in labels),
                           "minimum_font_pixels_at_100dpi": min(item.get_fontsize() for item in labels) * 100 / 72}
        description = json.dumps({"kind": "conceptual mechanism", "panels": config["panels"],
                                  "footer": config["footer"], "application_or_scientific_execution": False}, sort_keys=True)
        for ext in ("png", "svg"):
            name = config["output_prefix"] + "-" + layout + "." + ext
            target = ROOT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with matplotlib.rc_context({"svg.fonttype": "path", "svg.hashsalt": config["id"]}):
                metadata = {"Date": None, "Description": description} if ext == "svg" else {"Description": description}
                if ext == "svg":
                    with target.open("wb") as stream:
                        fig.savefig(stream, format="svg", dpi=100, facecolor=roles["canvas"],
                                    metadata=metadata)
                    target.write_bytes(target.read_bytes().replace(b"\r\n", b"\n"))
                else:
                    fig.savefig(target, dpi=100, facecolor=roles["canvas"], metadata=metadata)
            outputs[name] = digest(target)
    if inputs(config) != source_before:
        raise ValueError("Source changed while rendering")
    record = {"schema_version": 1, "kind": "conceptual mechanism", "basis_revision": config["basis_revision"],
              "application_or_scientific_execution": False, "adapter": config["adapter"],
              "inputs_sha256_lf": source_before, "fonts": font_records,
              "renderer": {"matplotlib": matplotlib.__version__, "fonttools": fontTools.__version__, "backend": "Agg"},
              "layouts": layouts, "outputs_sha256": outputs}
    RECEIPT.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8", newline="\n")
    check()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--font-dir", type=Path, default=os.environ.get("OBSCUR_FONT_DIR"))
    args = parser.parse_args()
    if args.check:
        check()
    else:
        if args.font_dir is None:
            parser.error("Supply --font-dir or OBSCUR_FONT_DIR with the actual Inter TTF directory")
        render(Path(args.font_dir))


if __name__ == "__main__":
    main()

