# Maintain a verify-<app> skill

A feature map goes stale when the app changes. This pass checks every feature file against the source and drives every feature in the running app. The unit of rigor is the feature, not each sentence.

```
find the skill ──> index hygiene ──> source wave ──> reconcile ──> live pass ──> triage ──> ship or stop
```

## Outcomes

Name one in the report.

| Outcome | It means | It ships |
|---|---|---|
| clean | every feature got source and live coverage, and nothing needs a fix | nothing |
| changed | proven fixes to the verification skill | one PR, by the `pr` skill |
| blocked | coverage did not finish, or a proven fix could not ship safely | nothing. Say what blocked it |

## Edit scope

Edit only the verification skill's own directory: its `SKILL.md`, `features/` and `scripts/`. Never edit product code in this pass.

A map that describes a behavior the app no longer has is one of two things. Doc drift: fix the map. A product regression: report it to Vasu, and keep it out of the map.

## The pass

1. **Find the skill.** It is the project's `.agents/skills/verify-*/` or `.claude/skills/verify-*/`. Several: ask Vasu which. None: write one with this skill's main procedure.
2. **Index hygiene.** Read `features/README.md` and list its sibling files. Fix entries that are missing, extra, duplicated or dead.
3. **Source wave.** Load `orchestrate`. Start one read-only worker per feature file, up to its ceiling, even for a small map: you keep your context for the live pass, and you do not read the feature source yourself. Run them on Sonnet in Claude Code (`model: sonnet`): reading one feature's source does not need the lead's model. Each worker explains from source how the feature works for the user, flags drift with the file and line, and returns one live recipe. Workers never drive the app and never edit files. Each one returns: the feature summary, the source entry points, the drift or "none", and one recipe.
4. **Reconcile.** Every feature file has a summary. Merge the recipes into as few app states as you can. Check each cited drift yourself; do not prove the clean claims again. Read the recent commits for user-facing surfaces the map does not list. Call a surface missing only with its source path.
5. **Live pass.** Do it even when the source looks clean. You drive; workers do not. Follow the skill's own Launch section: one long-lived instance driven in series for a server or a UI, a fresh session per drive for a short-lived CLI. Drive every feature at least once.
6. **Triage.** Fix doc drift and harness gaps under the edit scope. Drive each harness fix live again before it ships. Record each product regression for the report.
7. **Ship or stop.** For changed: read every changed file again, then open one PR. For clean or blocked: no PR.

## The live pass, whatever fails

- **Doctor before you trust an instance.** Run Doctor before the first drive, on each fresh session, and after any failed drive. If Doctor cannot see the failure, such as a wedged UI on a healthy process, reset to the baseline or launch again.
- **Doctor fails because the skill is stale.** That is drift. Fix it under the edit scope, restart only what the fix changed, and try once more. A second failure makes the pass blocked.
- **The evidence survives every cleanup.** Check it at its path. Do not assume it is there.
- **Nothing you started outlives its use.** Clean up after each failed attempt, whether the session is stuck, exited or shared. On Vasu's instance, clean up your own leftovers and leave the instance running.
- **An unreachable feature** needs the exact prerequisite (auth, entitlement, OS, external state) and the route you tried. If the map does not name that prerequisite, that is drift.

Tear down after the last drive, including the drives that check a fix again.

## Report

The outcome, the features covered (live and from source), each drift you fixed, each unreachable feature with its prerequisite, each product regression, and the evidence path.
