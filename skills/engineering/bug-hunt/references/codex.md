# Codex run

Codex has no workflow runner. Run the stages with `orchestrate` workers, in the order the SKILL.md diagram gives, and read `orchestrate`'s Codex reference for spawning, handles and interruption.

| Stage | Spawn | Brief |
|---|---|---|
| Prepare | two workers at once, the reasoning model | one reads `references/environment.md`, one reads `references/personas.md` |
| Hunt | one worker per persona, up to `maxPersonas` (default 5), the fast model, all at once | `references/hunter.md`, plus the environment return and the persona as JSON |
| Report | one worker, the fast model, after every hunter returns | `references/dedupe.md`, plus every hunter return as JSON |

Every brief carries the task slug, the repo path, the task directory, `<skill-dir>` and `<evidence-dir>` as absolute paths, and the line "Return exactly the Return object in the brief". The worker's final message is that JSON; parse it before the next stage.

Barriers: the hunt waits for both prepare workers, and the dedupe waits for every hunter. A hunter that fails leaves its findings out; say how many when you report.

With no delegation capability, run the stages yourself in order, one persona at a time, each in its own browser session.
