"""Every rendered figure draws the Obscur roles it should, not just any Obscur value."""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class FigureTokenTests(unittest.TestCase):
    def setUp(self):
        data = json.loads((ROOT / "docs/obscur-tokens.json").read_text(encoding="utf-8"))
        self.source = data["source"]
        self.tokens = data["tokens"]
        self.theme = data["themes"]["obscur"]

    def test_tokens_record_their_source(self):
        self.assertEqual(self.source["repository"], "T92T1914/clair-obscur-themes")
        self.assertRegex(self.source["revision"], r"^[0-9a-f]{40}$")
        self.assertRegex(self.source["file_sha256"], r"^[0-9a-f]{64}$")
        self.assertEqual(len(self.tokens), 17)
        self.assertTrue(all(re.fullmatch(r"#[0-9a-f]{6}", value) for value in self.tokens.values()))

    def test_figure_theme_maps_each_role_to_its_token(self):
        # A figure card is filled with control and outlined in border.
        expected = dict(canvas="canvas", panel="control", divider="divider", border="border",
                        text="text", muted="muted", accent="accent", warning="warning")
        self.assertEqual(self.theme, {role: self.tokens[token] for role, token in expected.items()})

    def test_mechanism_figure_uses_obscur_roles(self):
        config = json.loads((ROOT / "docs/mechanism.json").read_text(encoding="utf-8"))
        self.assertEqual(config["adapter"]["source"], "docs/obscur-tokens.json")
        self.assertEqual(config["adapter"]["roles"], dict(
            canvas=self.tokens["canvas"], panel=self.tokens["control"], text=self.tokens["text"],
            muted=self.tokens["muted"], line=self.tokens["border"]))
        receipt = json.loads((ROOT / "docs/mechanism-rendering.json").read_text(encoding="utf-8"))
        self.assertEqual(receipt["adapter"], config["adapter"])
        self.assertIn('rounding_size=18"', (ROOT / "tools/render_mechanism.py").read_text(encoding="utf-8"))

    def test_sharing_card_uses_obscur_without_italic(self):
        from tools.render_share_preview import check, roles

        config = json.loads((ROOT / "docs/sharing-card.json").read_text(encoding="utf-8"))
        self.assertEqual(config["tokens"], "docs/obscur-tokens.json")
        self.assertEqual(roles(config), self.theme)
        source = (ROOT / "tools/render_share_preview.py").read_text(encoding="utf-8")
        self.assertIn("radius=18,", source)
        self.assertIn('outline=palette.get("border", palette["divider"])', source)
        receipt = check()
        self.assertEqual({label["face"] for label in receipt["painted_labels"]},
                         {"Inter-Regular", "Inter-SemiBold", "Inter-Bold"})
        # Obscur sizes type in absolute points at 100 dpi, so its smallest
        # label, 30 pt, is 42 px on this 1280 pixel card too.
        from tools.render_share_preview import MIN_LABEL_PX

        self.assertEqual(MIN_LABEL_PX, 42)
        for label in receipt["painted_labels"]:
            self.assertGreaterEqual(label["size"], MIN_LABEL_PX, label["text"])
            left, top, right, bottom = label["bounds"]
            self.assertTrue(60 <= left < right <= 1220 and 40 <= top < bottom <= 602, label["text"])
        self.assertIn("Type is never made smaller to fit.", source)


if __name__ == "__main__":
    unittest.main()
