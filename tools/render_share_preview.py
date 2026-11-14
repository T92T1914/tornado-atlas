"""Render a compact sharing summary from maintained evidence, without an experiment."""

import argparse
import hashlib
import importlib
import json
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
CONFIG_PATH = ROOT / "docs/sharing-card.json"
RECEIPT = ROOT / "docs/sharing-card-receipt.json"
# Obscur sizes type in absolute points at 100 dpi. Its smallest label, 30 pt,
# is 42 px on any card, this 1280 px one included. Long text wraps instead.
MIN_LABEL_PX = 42
LINE_PITCH = 1.24


def digest(path):
    data = path.read_bytes()
    if path.suffix in (".py", ".json", ".md", ".css"):
        data = path.read_text(encoding="utf-8").encode()
    return hashlib.sha256(data).hexdigest()


def content(config):
    source = ROOT / config["source"]
    kind = config["kind"]
    if kind in ("freight", "timing", "solver"):
        helper = importlib.import_module("tools." + config["helper"])
        data = helper.load_data()
    if kind == "freight":
        panels = [
            ["Ridge model", f"{data['metrics']['model_mae']:.0f}", "moves / month"],
            [
                "Seasonal baseline",
                f"{data['metrics']['naive_mae']:.0f}",
                "moves / month",
            ],
        ]
        context = "Mean absolute error | 24 synthetic test months"
        footer = "Prior observations used. Not operational forecasts."
    elif kind == "timing":
        panels = [
            ["Requests", str(data["request_count"]), "submitted"],
            ["Calculations", str(data["stats"]["computed"]), "executed"],
        ]
        context = "Controlled worker example"
        footer = "99 waiting requests replaced. 1 obsolete result rejected."
        if data["stats"]["replaced"] != 99 or data["stats"]["stale"] != 1:
            raise ValueError("Retained worker result changed")
    elif kind == "solver":
        names = {"H": "HIT", "S": "STAND"}
        panels = [
            [
                " + ".join("10" if c == "T" else c for c in hand["cards"]),
                names[hand["action"]],
                f"{hand['values'][hand['action']]:.6f} net return",
            ]
            for hand in data["hands"]
        ]
        context = "Both total 16 | Dealer shows 10 | Saved six-deck example"
        footer = "Exact hit / stand / double. Split values approximate."
    elif kind == "mcts":
        panels = [
            ["Same forest", "Sequential", "independent roots"],
            ["Same forest", "Parallel", "independent roots"],
        ]
        context = "Fixed seeds and work | Retained execution comparison"
        footer = "No general speedup or stronger-play claim."
    else:
        panels = [
            ["Source record", "Observation", "what is claimed"],
            ["Exact locator", "Source", "where to inspect it"],
        ]
        context = "Reviewed dossiers | Sources, creators and uncertainty"
        footer = "Source records remain distinct from unique tornadoes."
    return dict(
        title=config["title"],
        subtitle=config["subtitle"],
        panels=panels,
        context=context,
        footer=footer,
        source_sha256=digest(source),
    )


def roles(config):
    text = (ROOT / config["tokens"]).read_text(encoding="utf-8")
    if config["kind"] != "atlas" or config["tokens"].endswith(".json"):
        palette = json.loads(text)["themes"]["obscur"]
        return palette
    values = dict(re.findall(r"--([a-z-]+):(#(?:[a-f0-9]{6}));", text.split("}", 1)[0]))
    return dict(
        canvas=values["bg"],
        panel=values["panel"],
        divider=values["line"],
        text=values["text"],
        muted=values["muted"],
        accent=values["text"],
    )


def font_files(config, directory):
    if config["helper"]:
        return importlib.import_module("tools." + config["helper"]).font_files(
            directory
        )
    from fontTools.ttLib import TTFont

    files, evidence = {}, {}
    for face, weight, italic in [
        ("Regular", 400, False),
        ("SemiBold", 600, False),
        ("Bold", 700, False),
    ]:
        path = directory / ("Inter-" + face + ".ttf")
        with TTFont(path) as font:
            name = font["name"].getDebugName(6)
            if (
                name != "Inter-" + face
                or font["OS/2"].usWeightClass != weight
                or bool(font["OS/2"].fsSelection & 1) != italic
                or not set(range(32, 127)).issubset(font.getBestCmap())
            ):
                raise ValueError("Wrong Inter face or missing authored glyph")
            evidence[face] = dict(
                postscript=name, weight=weight, italic=italic, sha256=digest(path)
            )
        files[face] = path
    return files, evidence


def inputs(config):
    names = [
        "tools/render_share_preview.py",
        "docs/sharing-card.json",
        config["source"],
        config["tokens"],
    ]
    if config["helper"]:
        names.append("tools/" + config["helper"] + ".py")
    return {name: digest(ROOT / name) for name in names}


def check():
    config = json.loads(CONFIG_PATH.read_text())
    receipt = json.loads(RECEIPT.read_text())
    if receipt["inputs_sha256_lf"] != inputs(config) or receipt["content"] != content(
        config
    ):
        raise ValueError("Sharing evidence or renderer changed")
    data = (ROOT / config["output"]).read_bytes()
    if (
        hashlib.sha256(data).hexdigest() != receipt["png_sha256"]
        or data[:8] != b"\x89PNG\r\n\x1a\n"
        or struct.unpack(">II", data[16:24]) != (1280, 640)
        or data[25] != 2
        or len(data) >= 1_000_000
    ):
        raise ValueError("Sharing PNG identity, dimensions, opacity or size differs")
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font-dir", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
        print("Sharing PNG matches retained content and renderer")
        return
    if args.font_dir is None:
        parser.error("--font-dir is required, no font is downloaded")
    from PIL import Image, ImageDraw, ImageFont, __version__

    config = json.loads(CONFIG_PATH.read_text())
    data, palette = content(config), roles(config)
    files, faces = font_files(config, args.font_dir)
    image = Image.new("RGB", (1280, 640), palette["canvas"])
    draw = ImageDraw.Draw(image)

    def font(size, face):
        if size < MIN_LABEL_PX:
            raise ValueError(f"Sharing label below {MIN_LABEL_PX} px: {size}")
        return ImageFont.truetype(str(files[face]), size)

    def width(text, size, face):
        bounds = draw.textbbox((0, 0), text, font=font(size, face), anchor="lt")
        return bounds[2] - bounds[0]

    def lines(text, size, face, max_width):
        # Long text moves onto more lines. Type is never made smaller to fit.
        if width(text, size, face) <= max_width:
            return [text]
        if " | " in text:
            result = []
            for part in text.split(" | "):
                if result and width(result[-1] + " | " + part, size, face) <= max_width:
                    result[-1] += " | " + part
                else:
                    result.append(part)
            if len(result) <= 2 and all(width(line, size, face) <= max_width for line in result):
                return result
        words = text.split()
        splits = [
            [" ".join(words[:i]), " ".join(words[i:])]
            for i in range(1, len(words))
            if "|" not in (words[i - 1], words[i])
        ]
        fitting = [pair for pair in splits if max(width(line, size, face) for line in pair) <= max_width]
        if not fitting:
            raise ValueError("Sharing label does not fit on two lines: " + text)
        return min(fitting, key=lambda pair: max(width(line, size, face) for line in pair))

    def paint(panel_floor, shift):
        labels = []

        def label(x, y, text, size, face="Regular", color=None, max_width=1144, anchor="lt"):
            typeface = font(size, face)
            bounds = draw.textbbox((x, y), text, font=typeface, anchor=anchor)
            if panel_floor is not None and (
                bounds[0] < 60
                or bounds[1] < 40
                or bounds[2] > 1220
                or bounds[3] > 602
                or bounds[2] - bounds[0] > max_width
            ):
                raise ValueError("Sharing label leaves its safe region: " + text)
            if panel_floor is not None:
                draw.text((x, y), text, font=typeface, fill=color or palette["text"], anchor=anchor)
            labels.append(
                dict(text=text, face="Inter-" + face, bounds=list(bounds), size=size)
            )
            return bounds

        def block(x, top, text, size, face="Regular", color=None, max_width=1144):
            bottom = top
            for line in lines(text, size, face, max_width):
                bottom = label(x, top, line, size, face, color, max_width)[3]
                top += round(size * LINE_PITCH)
            return bottom

        title = label(68, 104 + shift, data["title"], 64, "Bold", anchor="ls")
        subtitle_x = title[2] + 32
        if subtitle_x + width(data["subtitle"], 42, "SemiBold") <= 1212:
            subtitle = label(subtitle_x, 104 + shift, data["subtitle"], 42, "SemiBold", palette["accent"], anchor="ls")
            bottom = max(title[3], subtitle[3])
        else:
            bottom = block(68, title[3] + 20, data["subtitle"], 42, "SemiBold", palette["accent"])
        bottom = block(68, bottom + 24, data["context"], 42)
        panel_top = bottom + 32
        panel_bottom = panel_top
        if panel_floor is not None:
            for i in range(len(data["panels"])):
                x = 68 + i * 588
                draw.rounded_rectangle(
                    (x, panel_top, x + 556, panel_floor),
                    radius=18,
                    fill=palette["panel"],
                    outline=palette.get("border", palette["divider"]),
                    width=2,
                )
        # Rows are shared across panels, so values of different sizes sit on
        # one baseline and the detail lines start level. A wrapped name moves
        # the whole value row down by its extra lines.
        name_lines = max(len(lines(name, 42, "SemiBold", 502)) for name, _, _ in data["panels"])
        baseline = panel_top + 146 + (name_lines - 1) * round(42 * LINE_PITCH)
        for i, (name, value, detail) in enumerate(data["panels"]):
            x = 68 + i * 588
            block(x + 26, panel_top + 24, name, 42, "SemiBold", max_width=502)
            label(
                x + 26,
                baseline,
                value,
                68 if len(value) < 10 else 56,
                "Bold",
                accents[i],
                max_width=502,
                anchor="ls",
            )
            detail_bottom = block(x + 26, baseline + 32, detail, 42, max_width=502)
            panel_bottom = max(panel_bottom, detail_bottom + 30)
        block(68, panel_bottom + 28, data["footer"], 42, "SemiBold", palette["muted"])
        return panel_bottom, labels

    accents = [palette["accent"], palette.get("warning", palette["muted"])]
    if config["kind"] == "freight":
        series = json.loads((ROOT / config["tokens"]).read_text())["series"]
        accents = [series["model"]["obscur"], series["seasonal_naive"]["obscur"]]
    # The first pass only measures, so each panel can be drawn under its text
    # before the second pass paints the same positions. The shift centers the
    # block and may move it up. The second pass enforces the safe region.
    panel_bottom, measured = paint(None, 0)
    top = min(item["bounds"][1] for item in measured)
    bottom = max(item["bounds"][3] for item in measured)
    shift = (640 - bottom - top) // 2
    _, labels = paint(panel_bottom + shift, shift)
    output = ROOT / config["output"]
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, optimize=True)
    receipt = dict(
        schema_version=1,
        content=data,
        inputs_sha256_lf=inputs(config),
        png_sha256=hashlib.sha256(output.read_bytes()).hexdigest(),
        dimensions=[1280, 640],
        appearance="obscur",
        opaque=True,
        renderer={"Pillow": __version__},
        font_files=faces,
        painted_labels=labels,
        experimental_work_rerun=False,
        kind="authored summary, not an application screenshot",
    )
    RECEIPT.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    check()
    print("Rendered opaque Inter sharing summary from retained evidence")


if __name__ == "__main__":
    main()
