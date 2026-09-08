"""Check categorized skill discovery and portable reference links."""

import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]


class SkillLayoutTest(unittest.TestCase):
    def test_both_clients_discover_every_skill_once(self):
        skills = set((ROOT / "skills").rglob("SKILL.md"))
        self.assertTrue(skills)
        names = []
        for path in skills:
            relative = path.relative_to(ROOT / "skills")
            self.assertEqual(len(relative.parts), 3, str(relative))
            self.assertIn(relative.parts[0], {"engineering", "productivity", "misc"})
            name = re.search(r"^name: (.+)$", path.read_text(), re.MULTILINE).group(1)
            self.assertEqual(name, path.parent.name)
            names.append(name)
        self.assertEqual(len(names), len(set(names)))

        codex = json.loads((ROOT / ".codex-plugin/plugin.json").read_text())
        self.assertEqual(set((ROOT / codex["skills"]).rglob("SKILL.md")), skills)
        claude = json.loads((ROOT / ".claude-plugin/plugin.json").read_text())
        discovered = [path for directory in claude["skills"]
                      for path in (ROOT / directory).glob("*/SKILL.md")]
        self.assertEqual(set(discovered), skills)
        self.assertEqual(len(discovered), len(skills))

    def test_relative_markdown_links_resolve(self):
        for directory in ("skills", "agents", ".agents/skills", ".claude/skills"):
            for path in (ROOT / directory).rglob("*.md"):
                if path.is_symlink():
                    continue
                for target in re.findall(r"\]\(([^)]+)\)", path.read_text()):
                    if ":" in target or target.startswith(("#", "/")):
                        continue
                    target = target.split("#", 1)[0]
                    if "<" in target:
                        continue
                    with self.subTest(file=str(path.relative_to(ROOT)), target=target):
                        self.assertTrue((path.parent / target).exists())

    def test_runtime_role_briefs_resolve(self):
        references = ROOT / "skills/engineering/orchestrate/references"
        for client in ("claude", "codex"):
            path = references / f"{client}.md"
            targets = re.findall(r"`([^`]*<role>[^`]*)`", path.read_text())
            self.assertTrue(targets, f"{client} has no role brief reference")
            for target in targets:
                for role in ("dev", "reviewer", "researcher"):
                    brief = path.parent / target.replace("<role>", role)
                    with self.subTest(client=client, role=role):
                        self.assertEqual(brief.resolve(), ROOT / "agents" / f"{role}.md")
                        self.assertTrue(brief.is_file())


if __name__ == "__main__":
    unittest.main()
