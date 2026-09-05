"""Check that hook instructions name skills discoverable by either client."""

import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class HookRoutingTest(unittest.TestCase):
    def test_skill_references_resolve(self):
        cases = (
            ("route.sh", {"prompt": "where are we"}, "status"),
            ("product-section.sh", {}, "product-context"),
            ("pr-opened.sh", {
                "tool_input": {"command": "gh pr create --title example"},
                "tool_response": "https://github.com/example/repo/pull/1",
            }, "pr"),
        )
        task_dir = Path(tempfile.gettempdir()) / "vimulatus" / "hook-routing"
        task_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=task_dir) as cwd:
            for client in ("claude", "codex"):
                manifest = ROOT / f".{client}-plugin/plugin.json"
                namespace = json.loads(manifest.read_text())["name"]
                env = dict(os.environ)
                env.pop("PLUGIN_ROOT", None)
                if client == "codex":
                    env["PLUGIN_ROOT"] = str(ROOT)
                for hook, payload, expected in cases:
                    with self.subTest(client=client, hook=hook):
                        result = subprocess.run(
                            ["bash", str(ROOT / "hooks" / hook)],
                            input=json.dumps({"cwd": cwd, **payload}),
                            text=True, capture_output=True, check=True, env=env,
                        )
                        context = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
                        names = re.findall(r"`([^`]+)`", context)
                        self.assertTrue(
                            expected in names or f"{namespace}:{expected}" in names,
                            f"{client} cannot resolve {names} to {expected}",
                        )
                        self.assertTrue((ROOT / "skills" / expected / "SKILL.md").is_file())


if __name__ == "__main__":
    unittest.main()
