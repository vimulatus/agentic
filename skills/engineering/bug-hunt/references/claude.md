# Claude Code run

The `Workflow` tool runs the stages; this skill's instruction is the opt-in it requires. `scripts/bug-hunt.workflow.js` carries the run, and the workers read their briefs from `references/`.

```
Workflow({
  scriptPath: "<skill-dir>/scripts/bug-hunt.workflow.js",
  args: {
    task: "bug-hunt-<app>-<yyyy-mm-dd>",
    app: "<URL, or the port and the run command's source>",
    area: "<the area Vasu named, or null>",
    repo: "<absolute repo path>",
    skillDir: "<skill-dir>",
    evidenceDir: "<evidence-dir>",
    taskDir: "${TMPDIR:-/tmp}/vimulatus/<task>",
    maxPersonas: 5
  }
})
```

Pass `args` as a JSON object, and every path as an absolute path; the workers resolve nothing from this session. `maxPersonas` bounds the fleet at 2 + N + 1 agents. Raise it only when Vasu asks for a wider hunt.

The tool returns when the workflow completes, with `{ env, personas, hunts, report }`:

| Field | Use |
|---|---|
| `env.startedBy`, `env.stopCommand` | the Done step: stop the server only when `startedBy` is `me` |
| `hunts[].goals` | per persona, what was reached, reached slowly, not found or blocked |
| `report.reportPath`, `report.findings` | the report and its table, as the dedupe worker wrote them |
| `report === null` | no findings reproduced, or the prepare stage failed; the `log` lines in the run say which |

A hunter that returns `null` was skipped or died; its findings are not in the report, and the run logs how many. Read the run's `journal.jsonl` before diagnosing an empty result; `workflow-authoring` owns resume.
