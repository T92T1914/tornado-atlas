"""Every rendered figure draws only Obscur token values."""

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class FigureTokenTests(unittest.TestCase):
    def setUp(self):
        self.tokens = json.loads((ROOT / "docs/obscur-tokens.json").read_text(encoding="utf-8"))
        self.values = set(self.tokens["tokens"].values())

    def test_theme_roles_come_from_the_token_list(self):
        theme = self.tokens["themes"]["obscur"]
        self.assertLessEqual(set(theme.values()), self.values)
        # A figure card is filled with control and outlined in border.
        self.assertEqual(theme["panel"], self.tokens["tokens"]["control"])
        self.assertEqual(theme["border"], self.tokens["tokens"]["border"])
        self.assertEqual(theme["canvas"], self.tokens["tokens"]["canvas"])

    def test_mechanism_figure_uses_obscur(self):
        config = json.loads((ROOT / "docs/mechanism.json").read_text(encoding="utf-8"))
        self.assertEqual(config["adapter"]["source"], "docs/obscur-tokens.json")
        self.assertLessEqual(set(config["adapter"]["roles"].values()), self.values)
        receipt = json.loads((ROOT / "docs/mechanism-rendering.json").read_text(encoding="utf-8"))
        self.assertEqual(receipt["adapter"], config["adapter"])

    def test_sharing_card_uses_obscur_without_italic(self):
        from tools.render_share_preview import check, roles

        config = json.loads((ROOT / "docs/sharing-card.json").read_text(encoding="utf-8"))
        self.assertEqual(config["tokens"], "docs/obscur-tokens.json")
        self.assertLessEqual(set(roles(config).values()), self.values)
        receipt = check()
        self.assertNotIn("Italic", " ".join(label["face"] for label in receipt["painted_labels"]))
        self.assertTrue(all(label["size"] >= 30 for label in receipt["painted_labels"]))


if __name__ == "__main__":
    unittest.main()
