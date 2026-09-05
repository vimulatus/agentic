"""Exercise the watcher's emitted check counts with GitHub rollup fixtures."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class WatchChecksTest(unittest.TestCase):
    def test_every_check_has_a_bucket(self):
        cases = [
            ({"status": status, "conclusion": conclusion}, "pending")
            for status in ("IN_PROGRESS", "QUEUED", "REQUESTED", "WAITING", "PENDING")
            for conclusion in (None, "")
        ]
        cases += [({"status": "COMPLETED", "conclusion": state}, bucket)
                  for bucket, states in (
                      ("ok", ("SUCCESS", "NEUTRAL", "SKIPPED")),
                      ("bad", ("FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED",
                               "STALE", "STARTUP_FAILURE")),
                      ("pending", (None, "", "FUTURE_STATE")),
                  ) for state in states]
        cases += [({"state": state}, bucket) for state, bucket in (
            ("SUCCESS", "ok"), ("FAILURE", "bad"), ("ERROR", "bad"),
            ("PENDING", "pending"), ("EXPECTED", "pending"),
        )]
        task_dir = Path(tempfile.gettempdir()) / "vimulatus" / "watch-pr-test"
        task_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=task_dir) as directory:
            fixture = Path(directory)
            gh = fixture / "gh"
            gh.write_text("""#!/bin/sh
while [ "$#" -gt 0 ]; do
  if [ "$1" = --jq ]; then
    shift
    exec jq -r "$1" "$WATCH_FIXTURE"
  fi
  shift
done
exit 1
""")
            gh.chmod(0o755)
            snapshot = fixture / "snapshot.json"
            env = dict(os.environ, PATH=f"{fixture}:{os.environ['PATH']}",
                       WATCH_FIXTURE=str(snapshot), TMPDIR=directory)
            for check, bucket in cases:
                with self.subTest(check=check):
                    snapshot.write_text(json.dumps({
                        "state": "CLOSED", "mergeable": "MERGEABLE", "reviewDecision": "APPROVED",
                        "baseRefName": "new", "sha": "base", "comments": [],
                        "data": {"repository": {"pullRequest": {"reviewThreads": {"nodes": []}}}},
                        "statusCheckRollup": [{"name": "build", "context": "build",
                                               "detailsUrl": "https://example.com/check", **check}],
                    }))
                    result = subprocess.run(
                        ["sh", str(ROOT / "skills/pr/scripts/watch-pr.sh"), "1", "example/repo"],
                        text=True, capture_output=True, check=True, env=env, timeout=5,
                    )
                    counts = [int(bucket == name) for name in ("ok", "bad", "pending")]
                    self.assertIn(f"checks {counts[0]} ok {counts[1]} bad {counts[2]} pending",
                                  result.stdout.splitlines())
                    self.assertEqual(any(line.startswith("bad build ") for line in result.stdout.splitlines()),
                                     bucket == "bad")


if __name__ == "__main__":
    unittest.main()
