"""Draw the three Joplin Storm Events segments on Obscur.

Each segment is a straight line between the begin and end points that the
catalogue record reports. The figure is not a survey. It draws no width, no
intensity boundary, no basemap and no position between the endpoints.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "docs/joplin-segments.json"
RECEIPT = ROOT / "docs/joplin-segments-rendering.json"
FACES = {"Regular": 400, "SemiBold": 600, "Bold": 700}
LAYOUTS = (("wide", 1800, 72, 30), ("narrow", 960, 48, 33))
KM_PER_DEGREE_LATITUDE = 110.574
KM_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111.320
# Room inside the map frame for endpoint dots and the numbers above each line.
MAP_PAD = 40
NUMBER_ROOM = 70


def digest(path: Path) -> str:
    data = path.read_bytes()
    if path.suffix in {".py", ".json", ".md", ".css", ".svg"}:
        data = path.read_text(encoding="utf-8").replace("\r\n", "\n").encode()
    return hashlib.sha256(data).hexdigest()


def inputs() -> dict:
    names = ["docs/joplin-segments.json", "tools/render_joplin_segments.py", "docs/obscur-tokens.json"]
    return {name: digest(ROOT / name) for name in sorted(names)}


def kilometres(config: dict) -> list:
    """Project each segment's endpoints to kilometres east and north of their mean.

    An equirectangular display about the mean latitude of the six endpoints.
    Over about 33 km it differs from a geodesic by far less than a pixel.
    """
    points = [p for s in config["segments"] for p in (s["begin_point"], s["end_point"])]
    lon0 = sum(p[0] for p in points) / len(points)
    lat0 = sum(p[1] for p in points) / len(points)
    east = KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * math.cos(math.radians(lat0))
    def project(point):
        return ((point[0] - lon0) * east, (point[1] - lat0) * KM_PER_DEGREE_LATITUDE)
    return [(project(s["begin_point"]), project(s["end_point"])) for s in config["segments"]]


def placement(config: dict, map_left: float, map_top: float, map_width: float) -> dict:
    """Return the pixel scale, map height and endpoint pixels for a map box."""
    projected = kilometres(config)
    xs = [x for segment in projected for x, _ in segment]
    ys = [y for segment in projected for _, y in segment]
    scale = (map_width - 2 * MAP_PAD) / (max(xs) - min(xs))
    height = (max(ys) - min(ys)) * scale + 2 * MAP_PAD + NUMBER_ROOM
    def pixel(point):
        x, y = point
        return [round(map_left + MAP_PAD + (x - min(xs)) * scale, 3),
                round(map_top + NUMBER_ROOM + MAP_PAD + (max(ys) - y) * scale, 3)]
    return {"pixels_per_km": round(scale, 6), "map": [map_left, map_top, map_width, round(height, 3)],
            "segments": [{"id": s["id"], "begin_px": pixel(a), "end_px": pixel(b)}
                         for s, (a, b) in zip(config["segments"], projected)]}


def check() -> dict:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    record = json.loads(RECEIPT.read_text(encoding="utf-8"))
    if record["inputs_sha256_lf"] != inputs():
        raise ValueError("Joplin segment source or renderer changed")
    expected = {config["output_prefix"] + "-" + layout + "." + ext
                for layout, *_ in LAYOUTS for ext in ("png", "svg")}
    if set(record["outputs_sha256"]) != expected:
        raise ValueError("Incomplete Joplin segment output inventory")
    for name, expected_hash in record["outputs_sha256"].items():
        if digest(ROOT / name) != expected_hash:
            raise ValueError("Joplin segment output changed: " + name)
    if record["survey"] is not False or record["basis"] != config["basis"]:
        raise ValueError("A line between reported endpoints is not a survey")
    for layout in record["layouts"].values():
        left, top, width, _ = layout["map"]
        if placement(config, left, top, width) != {key: layout[key] for key in ("pixels_per_km", "map", "segments")}:
            raise ValueError("Drawn endpoints differ from the projected records")
    return record


def render(directory: Path) -> None:
    # Optional authoring dependencies never become application requirements.
    import matplotlib
    matplotlib.use("Agg")
    import fontTools
    from fontTools.ttLib import TTFont
    from matplotlib.backends.backend_agg import FigureCanvasAgg
    from matplotlib.figure import Figure
    from matplotlib.font_manager import FontProperties
    from matplotlib.patches import Circle, Rectangle

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
    source_before = inputs()
    layouts, outputs = {}, {}
    for layout, width, margin, body in LAYOUTS:
        height = 2000
        fig = Figure(figsize=(width / 100, height / 100), dpi=100, facecolor=roles["canvas"])
        ax = fig.add_axes((0, 0, 1, 1))
        ax.set(xlim=(0, width), ylim=(height, 0))
        ax.axis("off")
        probe = FigureCanvasAgg(fig).get_renderer()
        labels = []

        def measured(text, size, face="Regular"):
            item = ax.text(0, 0, text, fontsize=size, fontproperties=fonts[face], va="top")
            box = item.get_window_extent(probe)
            item.remove()
            return box.width, box.height

        def wrapped(text, size, maximum, face="Regular"):
            lines, current = [], ""
            for word in text.split():
                candidate = (current + " " + word).strip()
                if measured(candidate, size, face)[0] <= maximum:
                    current = candidate
                else:
                    if not current or measured(word, size, face)[0] > maximum:
                        raise ValueError("A Joplin segment word cannot fit without reducing type: " + word)
                    lines.append(current)
                    current = word
            return lines + ([current] if current else [])

        def label(x, y, text, size, face="Regular", color=None, **align):
            item = ax.text(x, y, text, fontsize=size, fontproperties=fonts[face],
                           color=color or roles["text"], **({"va": "top"} | align))
            labels.append(item)
            return item

        def block(x, y, lines, size, face="Regular", color=None):
            for line in lines:
                label(x, y, line, size, face, color)
                y += measured(line, size, face)[1] + 14
            return y

        inner = width - 2 * margin
        y = block(margin, 45, wrapped(config["title"], 40, inner, "Bold"), 40, "Bold") + 6
        y = block(margin, y, wrapped(config["subtitle"], body, inner), body, color=roles["muted"]) + 30
        place = placement(config, margin, round(y, 3), inner)
        left, top, map_width, map_height = place["map"]
        ax.add_patch(Rectangle((left, top), map_width, map_height, fill=False,
                               edgecolor=roles["line"], linewidth=2))
        drawn = set()
        for number, segment in enumerate(place["segments"], start=1):
            (x0, y0), (x1, y1) = segment["begin_px"], segment["end_px"]
            ax.plot([x0, x1], [y0, y1], color=roles["text"], linewidth=4, solid_capstyle="round")
            for point in (segment["begin_px"], segment["end_px"]):
                if tuple(point) not in drawn:
                    drawn.add(tuple(point))
                    ax.add_patch(Circle(point, 7, facecolor=roles["text"], edgecolor=roles["canvas"], linewidth=2))
            # The number sits on the screen-up side of its line, clear of the stroke.
            dx, dy = x1 - x0, y1 - y0
            length = math.hypot(dx, dy)
            nx, ny = (dy / length, -dx / length) if dx >= 0 else (-dy / length, dx / length)
            label((x0 + x1) / 2 + nx * 34, (y0 + y1) / 2 + ny * 34, str(number), body, "Bold",
                  ha="center", va="center")
        # Scale bar in the empty lower left of the map, north arrow in the empty upper right.
        bar = config["scale_km"] * place["pixels_per_km"]
        bx, by = left + MAP_PAD, top + map_height - 24
        ax.plot([bx, bx + bar], [by, by], color=roles["text"], linewidth=3)
        for tick in (bx, bx + bar):
            ax.plot([tick, tick], [by - 10, by + 2], color=roles["text"], linewidth=3)
        label(bx, by - 18, str(config["scale_km"]) + " km", body, color=roles["muted"], va="bottom")
        ax_x, ax_y = left + map_width - MAP_PAD, top + 24
        ax.annotate("", xy=(ax_x, ax_y), xytext=(ax_x, ax_y + 70),
                    arrowprops={"arrowstyle": "-|>", "color": roles["text"], "lw": 2.5, "mutation_scale": 18})
        label(ax_x - 16, ax_y + 35, "N", body, "SemiBold", ha="right", va="center")
        y = top + map_height + 32
        # Each entry is its number and place, then its clock as recorded on a second line.
        indent = measured("0  ", body, "Bold")[0]
        key = []
        for n, segment in enumerate(config["segments"], start=1):
            label(margin, y, str(n), body, "Bold")
            lines = wrapped(segment["place"], body, inner - indent) + wrapped(segment["clock"], body, inner - indent)
            y = block(margin + indent, y, lines, body) + 12
            key.append(lines)
        footer = wrapped(config["footer"], body, inner, "SemiBold")
        y = block(margin, y + 18, footer, body, "SemiBold", roles["muted"])
        height = int(math.ceil(y - 14 + 49))
        fig.set_size_inches(width / 100, height / 100)
        ax.set_ylim(height, 0)
        canvas = FigureCanvasAgg(fig)
        canvas.draw()
        renderer = canvas.get_renderer()
        boxes = [(item, item.get_window_extent(renderer)) for item in labels]
        for item, box in boxes:
            if box.x0 < 0 or box.y0 < 0 or box.x1 > width or box.y1 > height:
                raise ValueError("A Joplin segment label leaves the canvas: " + item.get_text())
        for index, (first, a) in enumerate(boxes):
            for second, b in boxes[index + 1:]:
                if a.x0 < b.x1 and b.x0 < a.x1 and a.y0 < b.y1 and b.y0 < a.y1:
                    raise ValueError("Joplin segment labels overlap: " + first.get_text() + " / " + second.get_text())
        layouts[layout] = {"width": width, "height": height, **place,
                           "rendered_key_lines": key, "rendered_footer_lines": footer,
                           "minimum_font_points": min(item.get_fontsize() for item in labels)}
        description = json.dumps({"kind": "catalogue segment map", "basis": config["basis"], "survey": False,
                                  "segments": [s["id"] for s in config["segments"]]}, sort_keys=True)
        for ext in ("png", "svg"):
            name = config["output_prefix"] + "-" + layout + "." + ext
            target = ROOT / name
            with matplotlib.rc_context({"svg.fonttype": "path", "svg.hashsalt": config["id"]}):
                if ext == "svg":
                    with target.open("wb") as stream:
                        fig.savefig(stream, format="svg", dpi=100, facecolor=roles["canvas"],
                                    metadata={"Date": None, "Description": description})
                    target.write_bytes(target.read_bytes().replace(b"\r\n", b"\n"))
                else:
                    fig.savefig(target, dpi=100, facecolor=roles["canvas"], metadata={"Description": description})
            outputs[name] = digest(target)
    if inputs() != source_before:
        raise ValueError("Source changed while rendering")
    record = {"schema_version": 1, "kind": "catalogue segment map", "basis": config["basis"], "survey": False,
              "adapter": config["adapter"], "inputs_sha256_lf": source_before, "fonts": font_records,
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
        print("Joplin segment source, renderer and four outputs agree")
    elif args.font_dir is None:
        parser.error("Supply --font-dir or OBSCUR_FONT_DIR with the actual Inter TTF directory")
    else:
        render(Path(args.font_dir))


if __name__ == "__main__":
    main()
