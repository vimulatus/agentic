"""Check hook routing and client-specific output contracts."""

import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class HookRoutingTest(unittest.TestCase):
    def test_codex_stop_reports_owned_listener_once(self):
        task_dir = Path(tempfile.gettempdir()) / "vimulatus" / "hook-routing"
        task_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=task_dir) as directory:
            fixture = Path(directory)
            commands = {
                "lsof": "if [ \"$1\" = -a ]; then exit 0; fi\nprintf 'p987654\ncnode\nn*:4567\np987655\ncother\nn*:4568\n'\n",
                "ps": "case \"$*\" in *987654*) echo 'node CODEX_SESSION_ID=port-test';; *) echo 'other CODEX_SESSION_ID=foreign';; esac\n",
            }
            for name, body in commands.items():
                command = fixture / name
                command.write_text("#!/bin/sh\n" + body)
                command.chmod(0o755)
            env = dict(os.environ, PLUGIN_ROOT=str(ROOT), TMPDIR=directory,
                       CLAUDE_PID="1", PATH=f"{fixture}:{os.environ['PATH']}")
            payload = json.dumps({"session_id": "port-test", "hook_event_name": "Stop"})
            result = subprocess.run(["bash", str(ROOT / "hooks/ports.sh")],
                                    input=payload, text=True, capture_output=True, check=True, env=env)
            output = json.loads(result.stdout)
            self.assertEqual(output.get("decision"), "block")
            self.assertEqual(set(output), {"decision", "reason"})
            self.assertIn(":4567", output["reason"])
            self.assertNotIn(":4568", output["reason"])
            repeat = subprocess.run(["bash", str(ROOT / "hooks/ports.sh")],
                                    input=payload, text=True, capture_output=True, check=True, env=env)
            self.assertEqual(repeat.stdout, "")

    def test_custom_codex_home_global_symlink_is_skipped(self):
        task_dir = Path(tempfile.gettempdir()) / "vimulatus" / "hook-routing"
        task_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=task_dir) as directory:
            fixture = Path(directory)
            codex_dir = fixture / "codex"
            project = fixture / "project"
            codex_dir.mkdir()
            project.mkdir()
            global_rules = codex_dir / "AGENTS.md"
            global_rules.write_text("Personal preferences, without project sections.\n")
            (project / "AGENTS.md").symlink_to(global_rules)
            env = dict(os.environ, PLUGIN_ROOT=str(ROOT), CODEX_HOME=str(codex_dir))
            result = subprocess.run(["bash", str(ROOT / "hooks/product-section.sh")],
                                    input=json.dumps({"cwd": str(project)}), text=True,
                                    capture_output=True, check=True, env=env)
            self.assertEqual(result.stdout, "")

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
