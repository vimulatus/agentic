export const meta = {
  name: 'dev-graph',
  description:
    'Queue-driven test-first implementation loop: decompose the plan into a task GRAPH rather than a chain, keep the queue in git refs so it survives a crash, and route every review finding back through the queue instead of looping the task it came from',
  whenToUse:
    'When you have a plan/spec covering more than one feature and want it implemented under a closed feedback loop whose state lives in git rather than in the orchestrator\'s memory, and you want the wall-clock. The plan is decomposed feature-first into a dependency graph; up to `maxParallel` tasks run at once, each in its own worktree off the run branch, each driven green against the repo\'s own `.claude/qa` gate, attacked by two adversarial lenses, and each landing ITSELF — squash, rebase, resolve its own conflicts, full gate, fast-forward — first-come-first-served under a lock, as soon as it converges rather than in a fixed order. Every surviving finding goes back through `addTask` — filed as an issue, merged into a queued task, or queued as a new task of the next generation — and competes for the same slots. Findings route on AUTHORSHIP (did this run cause it?), not on confidence, and the generation cap terminates the loop. Pass args as {plan, baseRef, maxTasks, maxParallel, issueTracker, branch, model} or as a plain string plan.',
  phases: [
    { title: 'Reconcile', detail: 'read this run\'s queue refs — a re-invocation on the same plan resumes rather than restarts' },
    { title: 'Intake', detail: 'one worktree for the run, write/validate .claude/qa, extract acceptance criteria' },
    { title: 'Decompose', detail: 'split the plan into a task graph, feature-first, and validate it three ways' },
    { title: 'Generate Tests', detail: 'write failing tests for this task' },
    { title: 'Implement', detail: 'worker lands the task; the workflow then runs .claude/qa itself and sends red back' },
    { title: 'Find', detail: 'two read-only lenses attack the task diff' },
    { title: 'Queue', detail: 'dedupe the findings, then route each one through addTask: file, merge, or a new task' },
    { title: 'Land', detail: 'squash, rebase onto the run branch, resolve conflicts, full gate, fast-forward — one task at a time, FCFS' },
    { title: 'Integrate', detail: 'simplify the whole run behind its own green gate, check the finished thing against every criterion' },
  ],
}

// ---- args ----------------------------------------------------------------
// Ported from dev-loop unchanged. 14 of 15 recorded runs passed args as a
// JSON-encoded STRING, and a `typeof args === 'string'` check made the whole
// JSON blob the plan text. Sniff the shape, and log which form was detected so
// this can never be silent.
let a = args
let argForm = 'object'
if (typeof a === 'string') {
  const t = a.trim()
  if (t.startsWith('{')) {
    try {
      a = JSON.parse(t)
      argForm = 'json-string'
    } catch (e) {
      a = { plan: t }
      argForm = 'string (looked like JSON but did not parse)'
    }
  } else {
    a = { plan: t }
    argForm = 'plain string'
  }
} else if (!a || typeof a !== 'object') {
  a = {}
  argForm = 'missing'
}

const plan = a.plan || a.task || a.spec
if (!plan) {
  throw new Error(
    `No plan given (args parsed as: ${argForm}). Invoke with the plan/spec to implement, e.g. args: "Add rate limiting to /upload per docs/plan.md", or args: {plan: "...", baseRef: "main", maxTasks: 8, issueTracker: "gh"}.`,
  )
}

const baseRefOverride = a.baseRef || ''
const baseRefStart = baseRefOverride || 'HEAD'
const issueTracker = a.issueTracker || 'gh'
const branchName = String(a.branch || a.branchName || '').trim()
// There is no global for the session model — a workflow script cannot see what
// it is running on. So the run's model is whatever the caller declares. A run on
// an under-powered model is not a slower run, it is a quieter one.
const declaredModel = String(a.model || '').trim().toLowerCase()

// ---- run identity --------------------------------------------------------
// The run id keys the queue refs, so it has to be identical across a crash and a
// re-invocation. There is no clock and no randomness in a workflow script —
// `Date.now()`, `new Date()` and `Math.random()` all throw, precisely so that a
// resumed run cannot derive different names from the same inputs. So the id is
// derived from the one thing that is by definition the same on both runs: the
// plan text. Same plan, same id, same refs, same queue.
//
// FNV-1a over UTF-16 code units, low byte then high byte, with the multiply
// written as shifts so it never leaves 32 bits.
const fnv1a32 = (s) => {
  let h = 0x811c9dc5
  const mix = (b) => {
    h ^= b
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0
  }
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    mix(c & 0xff)
    if (c > 0xff) mix((c >>> 8) & 0xff)
  }
  return h.toString(16).padStart(8, '0')
}

const runId = fnv1a32(String(plan))
const REF_ROOT = `refs/agent/${runId}`
const META_REF = `${REF_ROOT}/meta`

// Task ids come from an agent and end up in a ref path, where git refuses a
// space, `~^:?*[`, `..`, a trailing `.lock` and a leading or trailing dot or
// slash. Normalising here rather than trusting the agent means a bad id is a
// mangled ref name, not a failed `git update-ref` in the middle of a run.
const refSafe = (id) => {
  let s = String(id || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 80)
    .replace(/[-._]+$/, '')
  // A ref component may not end in `.lock` — git uses that suffix for its own
  // lock files, so `update-ref` on one fails outright.
  if (s.endsWith('.lock')) s = `${s.slice(0, -5)}-lock`
  return s || 'task'
}

const taskRef = (id) => `${REF_ROOT}/task/${refSafe(id)}`

// ---- constants -----------------------------------------------------------
const MAX_TASKS = a.maxTasks || 12
// Times a worker is sent back with the gate's failures before the task fails.
// Not zero: a red gate is the normal end of a worker's first pass. Not large: a
// worker that cannot clear it twice is stuck.
const MAX_GATE_FIXUPS = 2
// A fix-task gets reviewed too, so its findings would spawn fix-tasks forever.
// Decomposed tasks are generation 0; a task born from a finding on a generation
// N task is N+1; and a task at generation 3 can spawn nothing — `addTask` is
// forced to `file`. Direct translation of dev-loop's `MAX_OUTER = 3`: three
// generations of hardening after the original task, then it stops.
const GEN_CAP = 3
// The generation cap bounds the queue's DEPTH but not its BREADTH: nothing in it
// stops one generation from fanning out until the run never finishes. This is
// the breadth bound. Past it `addTask` is forced to `file` whatever the
// generation, so the queue is finite by construction rather than by good
// behaviour.
const MAX_QUEUE = MAX_TASKS * 4
// Tasks in flight at once. Each one holds a git worktree — a full checkout plus
// its dependencies — and runs a test suite, so the ceiling is disk and how many
// suites the machine will run concurrently, not the runtime's own cap. Three is
// a default, not a measurement: it is enough to overlap a slow gate with real
// work and small enough that three checkouts and three suites fit on a laptop.
// Raise it with `maxParallel` when the repo is small or the machine is not.
const MAX_PARALLEL = Math.max(1, Number(a.maxParallel) || 3)
const CLUSTER_THRESHOLD = 4 // N+ findings in one file => one design finding, not N bugs
const SEV_RANK = { P0: 0, P1: 1, P2: 2 }
// A run on an under-powered model does not fail, it goes quiet: the finders stop
// finding and the run reports clean.
const MODEL_RANK = { haiku: 0, sonnet: 1, opus: 2 }
const MODEL_FLOOR = 'sonnet'
// Spread into an agent's opts. Empty when the caller declared no model, so the
// agent inherits the session model.
const MODEL = declaredModel ? { model: declaredModel } : {}

// States a task record can hold. `blocked` is not a failure of the task itself —
// it is a task whose dependency failed, so it can never legitimately start.
const TASK_STATES = ['queued', 'running', 'done', 'failed', 'blocked']
const TERMINAL_STATES = ['done', 'failed', 'blocked']
const isTerminal = (s) => TERMINAL_STATES.includes(s)

// ---- shared vocabulary ---------------------------------------------------
// Ported from dev-loop. Each of these was written out in full in three or four
// places — a schema description and one or more prompts. Defined once and
// interpolated, so the copies cannot drift apart.

// Impact only. Likelihood lives in `evidence`. Folding the two together is how
// an imagined failure with a big blast radius rated P0.
const SEVERITY_DEF =
  'P0 = data loss or a security hole. P1 = user-visible wrong behaviour. P2 = a real defect with a small blast radius.'

// Provenance of a failure scenario, declared by the finder and verified by
// nobody here. It costs the finder nothing — it already did either the tracing
// or the predicting.
const EVIDENCE_DEF = `- \`reproduced\` — you ran it and watched the wrong behaviour happen. Never required.
- \`traced-to-caller\` — you followed the path back to a real call site and named the input it actually passes.
- \`predicted\` — you reasoned it could happen and did neither of the above.`

// dev-loop's DESTINATION_DEF named fixNow / strengthenTest / file, which are the
// three places a finding could go when a task looped on its own findings. There
// is no loop here: a finding goes into the QUEUE or it goes to a human, so these
// are the three things `addTask` can do with one.
//
// The bar for `file` is deliberately HIGHER here than in a real pull request. A
// filed issue in the real world often dies; a queued task in this run actually
// gets done. So anything the run can safely do, it queues.
const DESTINATION_DEF = `- \`file\` — a human has to act on it, and this run must not. Filed as an issue OUTSIDE this run's queue: nothing in this run will pick it up.
- \`merge\` — a task already in the queue covers it, or is about to rewrite that code. Its description gains this finding and no new task is created.
- \`create\` — this run should do it, and no queued task covers it. A new task joins the queue at the next generation, depending on the task whose diff produced it.`

// The routing rule. Not "how confident is the reviewer" — that question produced
// dev-loop's epistemic routing, under which a pre-existing bug in a file the task
// happened to edit was inScope, evidence-backed, needed no decision, and went
// straight to a worker. In a real review that is the textbook *good catch,
// separate issue*. The question a developer actually asks is "did my change
// cause this?", and unlike confidence it is mechanically checkable.
const AUTHORSHIP_DEF = `Does the failure scenario already exist at the source task's \`taskBase\` sha?

- **Yes — this run did not cause it.** Pre-existing. Bias to \`file\`.
- **No — this run caused it.** A regression this run owes. Bias to \`create\` (or \`merge\` if a queued task already covers it).

This is a check, not an introspection: the base sha and the diff are both in front of you. A finding on a line no diff hunk touched, in a file whose behaviour at \`taskBase\` is the same, is pre-existing by construction. No agent has to be trusted to judge its own culpability.

**Severity overrides authorship, and it is the only thing that does.** A P0 — data loss or a security hole — is fixed by this run regardless of who wrote it. A P0 auth bypass in pre-existing code does not become a filed issue on the grounds that it is technically nobody's task.`

// Independent of scope. A finding inside this task's own files can still need a
// decision no acceptance criterion makes, and handing that to a worker is how a
// cosmetic bug got "fixed" by silently destroying stored data: a reproduced,
// user-visible finding went straight to a worker, which chose "strip the
// offending nodes on read". Nothing in the plan said what should happen to
// legacy content and the alternatives had materially different consequences.
const HUMAN_DECISION_DEF = `Any one of these is enough:
- The fix changes observable product behaviour that no acceptance criterion specifies.
- The fix needs a data migration, or touches data that is already stored.
- More than one defensible fix exists with materially different consequences, and the criteria do not pick between them.
- The fix would violate or extend an acceptance criterion.
- It lands on pre-existing behaviour that something may already depend on.`

// ---- the queue substrate -------------------------------------------------
// The queue is git refs, not orchestrator memory and not a state file. Two
// reasons, in order of importance:
//
//   1. Orchestrator memory does not survive a crash. Refs do. Kill the run at
//      any instant and the queue is exactly what was last written.
//   2. A second source of truth can disagree with the first, and git wins that
//      argument every time. There is no `state.json` here for that reason.
//
// Refs under `refs/agent/` are invisible to the working tree, to `git log`, to
// every branch and to `git status`. Writing one changes no file, so the queue
// can be updated from inside a worktree without touching what the worktree is
// there to build. `git update-ref` also writes to the repository's COMMON ref
// store, shared by the main checkout and every linked worktree — which is what
// makes a reconcile from the repo root see refs written from inside the run's
// worktree.
//
// Every write is set-to-value, never append: an agent re-executed by a resume
// against a filesystem that already reflects its effects writes the same blob
// and produces the same ref. That is the whole idempotence story for the queue.
const REF_HOWTO = `## The queue

This run's task queue lives in git refs under \`${REF_ROOT}/\`. Each task is one ref pointing at a blob that holds the task's record as a single JSON object. Refs are invisible to the working tree and to every branch — writing one changes no file and creates no commit.

- **Read one task:** \`git cat-file -p ${REF_ROOT}/task/<taskId>\`
- **List every task:** \`git for-each-ref --format='%(refname)' '${REF_ROOT}/task/*'\`, then \`git cat-file -p\` each refname.
- **Write one task** — this both creates and overwrites, and it is the ONLY way to change a task:

\`\`\`bash
sha=$(git hash-object -w --stdin <<'DEVGRAPH_RECORD'
{"id":"...","state":"queued", ...}
DEVGRAPH_RECORD
)
git update-ref ${REF_ROOT}/task/<taskId> "$sha"
\`\`\`

The heredoc delimiter is quoted, so backticks, \`$\` and quotes inside the JSON stay literal — but it must sit at the start of its own line with nothing before it, or the heredoc never terminates. Write the record on ONE line if you can; if you cannot, any valid JSON is fine.

**Set the whole record to a value. Never append to a ref, never create a second ref for the same task id, and never delete one.** If this step already ran and the ref already holds what you were about to write, writing it again is correct and is a no-op — say so and move on.`

// ---- schemas -------------------------------------------------------------
// A task record's shape lives in JS (see `newRecord` below), not in three
// separate agent schemas that would have to be kept in step with it. So every
// agent that reads or writes the queue passes records as JSON strings, and this
// script parses them. The alternative — restating the record shape in each
// schema — is exactly the drift the shared-vocabulary consts above exist to
// prevent.

const RECONCILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['found', 'tasksJson'],
  properties: {
    found: { type: 'boolean', description: 'True if any ref under the queue namespace exists — that is, this run has been started before.' },
    metaJson: { type: 'string', description: 'Contents of the meta ref verbatim, or an empty string if it does not exist.' },
    tasksJson: {
      type: 'array',
      description: 'One entry per task ref, each the blob contents verbatim. Do not reformat, repair or summarise them.',
      items: { type: 'string' },
    },
    workRootExists: {
      type: 'boolean',
      // Decides whether Intake reuses the previous worktree or builds a new one.
      description: 'True only if the meta ref names a workRoot AND that directory exists AND `git worktree list` still shows it.',
    },
    error: { type: 'string', description: 'Empty normally. Set only if the refs could not be read at all.' },
  },
}

const QUEUE_WRITE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['written'],
  properties: {
    written: { type: 'array', description: 'Ref names you updated, in full (`refs/agent/...`).', items: { type: 'string' } },
    recordsJson: {
      type: 'array',
      // Read back rather than echoed: this is what proves the blob is in the
      // ref store, and it is what the orchestrator keeps as its cache of the
      // queue. A write-before-return contract needs the read-back.
      description: 'The final contents of each ref you wrote, read back with `git cat-file -p` AFTER the update.',
      items: { type: 'string' },
    },
    error: { type: 'string', description: 'Empty normally. What git said if a write failed.' },
  },
}

const ADD_TASK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['outcome', 'reason'],
  properties: {
    outcome: { type: 'string', enum: ['file', 'merge', 'create'], description: `What you did with it.\n${DESTINATION_DEF}` },
    reason: { type: 'string', description: 'Why this outcome and not the other two, naming what you checked at the base sha.' },
    preExisting: {
      type: 'boolean',
      description: 'The authorship verdict: true if the failure scenario already exists at the source task\'s taskBase sha. State it even when severity overrode it.',
    },
    recordJson: {
      type: 'string',
      description: 'Required when outcome is `create` or `merge`, empty otherwise: the task record you wrote, read back with `git cat-file -p` AFTER the update.',
    },
    mergedInto: { type: 'string', description: 'Required when outcome is `merge`: the id of the queued task that absorbed this finding.' },
    issue: { type: 'string', description: 'Issue number or URL when outcome is `file` and filing succeeded. Empty when there is no tracker.' },
    error: { type: 'string', description: 'Empty normally. Set if the ref write or the issue filing failed, and say which.' },
  },
}

const INTAKE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  // `branch` is required, not optional. It was optional once, and the intake
  // agent — which had created the worktree and named the branch correctly —
  // simply never reported the name, because nothing asked for it. An empty
  // `branch` reads downstream as "this run has no branch of its own", which
  // silently drops `maxParallel` to 1 and runs the whole graph serially. The
  // one fact this workflow cannot afford to lose is not one to leave optional.
  required: ['workRoot', 'isolated', 'branch', 'baseRef', 'testLayout', 'testCommand', 'qaCommands', 'qaHash', 'criteria'],
  properties: {
    workRoot: {
      type: 'string',
      description: 'Absolute path every downstream agent works in for the WHOLE run: the worktree, or the repo root if isolation was impossible.',
    },
    isolated: { type: 'boolean', description: 'True if workRoot is a dedicated worktree, false if it is the shared checkout.' },
    branch: {
      type: 'string',
      description:
        'The branch checked out in `workRoot` — the name you actually ended on, read back with `git rev-parse --abbrev-ref HEAD` rather than the one you intended. Every task in this run branches from it and rebases onto it, so a run with an empty `branch` cannot run its tasks in parallel at all. Empty string ONLY when `isolated` is false.',
    },
    reused: { type: 'boolean', description: 'True if you adopted an existing worktree from a previous invocation rather than creating one.' },
    baseRef: {
      type: 'string',
      description: 'Sha the worktree branched from; every whole-run diff is taken against it. Empty string only if the repo has no commits.',
    },
    testLayout: { type: 'string', description: 'Where tests live and what convention they follow (framework, file naming, directory).' },
    testCommand: {
      type: 'string',
      description: 'Exact command that runs the suite from workRoot, confirmed in package.json / Makefile / CI config. Empty string if the repo genuinely has none.',
    },
    qaCommands: {
      type: 'array',
      description: 'The checks .claude/qa now runs, in order — the commands themselves, not the shebang or tallying boilerplate. Each must be one you confirmed exists.',
      items: { type: 'string' },
    },
    qaHash: {
      type: 'string',
      // Every later gate run re-hashes the file and compares, so a worker that
      // edits the gate to get green is caught.
      description: 'sha256 of `<workRoot>/.claude/qa` once final, as 64 hex characters. Empty string only if it could not be hashed.',
    },
    qaFileAction: {
      type: 'string',
      enum: ['created', 'validated', 'repaired'],
      description: 'created = you wrote it; validated = it existed and every line was real; repaired = it existed but named a missing command, or lacked a check CI runs.',
    },
    ciGaps: {
      type: 'array',
      description: 'Checks CI runs on a PR with NO counterpart in `.claude/qa`, naming the workflow file and the command. Empty when the gate covers CI or there is no CI config.',
      items: { type: 'string' },
    },
    qaScopedWritten: {
      type: 'boolean',
      description: 'True only if this repo already has a mechanism for verification scoped to changed packages (`turbo --filter`, `nx affected`, or `pnpm --filter`) and you wrote `.claude/qa-scoped` for it. False — and write nothing — if no such mechanism exists.',
    },
    qaScopedHash: {
      type: 'string',
      description: 'sha256 of `<workRoot>/.claude/qa-scoped` once final, as 64 hex characters. Empty string when `qaScopedWritten` is false, or if it could not be hashed.',
    },
    criteria: {
      type: 'array',
      description: 'The Definition of Done: numbered testable statements from the plan. No aspirations, no restatements of the plan prose.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['n', 'text'],
        properties: {
          n: { type: 'number', description: 'Stable 1-based index. Later phases refer to criteria by this number.' },
          text: { type: 'string', description: 'One testable statement, phrased as an observable outcome.' },
        },
      },
    },
    warning: { type: 'string', description: 'Empty normally. Explain here if isolation, dependency install, or the .claude/qa commit failed.' },
  },
}

const DECOMPOSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tasks'],
  properties: {
    tasks: {
      type: 'array',
      description: 'A dependency GRAPH, not a chain. Order in this array is a tie-break only; `deps` is the real ordering.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'criteria', 'scope', 'deps', 'rationale', 'verificationOnly'],
        properties: {
          id: { type: 'string', description: 'Short stable slug, e.g. "t1-rate-limit-store". Unique across the whole graph.' },
          title: { type: 'string', description: 'One line: what lands when this task is done.' },
          criteria: { type: 'array', description: 'Criterion numbers this task makes true. Never empty.', items: { type: 'number' } },
          deps: {
            type: 'array',
            // Validated three ways before anything runs; a bad edge stops the
            // run rather than being quietly repaired.
            description: 'Ids of tasks whose CODE this one reads, calls or extends. Not tasks that merely come first in the prose. Empty for anything that can start immediately — most tasks should be empty.',
            items: { type: 'string' },
          },
          verificationOnly: {
            type: 'boolean',
            // The loop skips the failing-test gate for these, because their
            // tests are expected to pass the moment they are written.
            description: 'False for every ordinary task. True only for a task whose entire deliverable is a test over behaviour other tasks already landed, with no production change of its own.',
          },
          scope: {
            type: 'array',
            description: 'Files or globs this task expects to change. Overlap with another task is allowed; keep it honest anyway, because it routes findings and derives dependency edges.',
            items: { type: 'string' },
          },
          rationale: { type: 'string', description: 'Why this is one reviewable unit, and why its deps are exactly the ones listed.' },
        },
      },
    },
    warning: {
      type: 'string',
      description: 'Empty normally. If the plan cannot be covered within the task cap, say so HERE and list what is left uncovered — never silently truncate.',
    },
  },
}

const TESTGEN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['testFiles', 'summary', 'redState', 'baseSha'],
  properties: {
    baseSha: {
      type: 'string',
      description: '`git rev-parse HEAD` taken BEFORE you changed anything. Reviewers diff this task against it.',
    },
    // Not printed into the worker prompt — the worker finds the tests via
    // `git status` — but it is the only record of what a task wrote on the two
    // early-exit paths, where nothing is committed and `landedFiles` does not
    // exist. It feeds `tasks[].testsAdded` in the return value.
    testFiles: { type: 'array', items: { type: 'string' }, description: 'Test files created or extended for this task.' },
    summary: { type: 'string', description: 'What behaviour the new tests pin down, and which criterion number each one pins.' },
    // Was a `confirmedRed` boolean in an earlier design, and a false there
    // aborted the entire run. Two of ten recorded runs died on it while being
    // completely right: a criterion that was already satisfied, and a "this
    // assertion is vacuous" finding that has no failing test by construction.
    // Both are outcomes, not failures.
    //
    // `alreadySatisfied` is also the RESUME path. A task re-picked after a crash
    // finds its own tests already on disk and already passing, so it reports
    // this and converges straight through rather than redoing the work.
    redState: {
      type: 'string',
      enum: ['red', 'alreadySatisfied', 'cannotBeRed', 'brokenRed'],
      description:
        'What you actually saw when you ran the new tests. red = they fail for the RIGHT reason (missing or wrong behaviour). alreadySatisfied = an honest test passes as written because the behaviour is already correct. cannotBeRed = a coverage gap, not a behaviour delta, so no failing test can express it. brokenRed = they fail for the WRONG reason (import error, wrong path, typo) and you could not repair them — the only value that counts as a failure.',
    },
    notRedReason: {
      type: 'string',
      description: 'Empty only when redState is "red". Otherwise: what you saw, and which criterion it applies to.',
    },
  },
}

const WORKER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary'],
  properties: {
    summary: { type: 'string', description: 'What you changed and why it satisfies the tests.' },
    blocked: {
      type: 'string',
      description: 'Empty string normally. If a test is genuinely unsatisfiable or self-contradictory, explain here rather than weakening it.',
    },
  },
}

// The workflow script has no shell of its own, so the only way it can verify
// green rather than accept a claim of it is to spend one tiny agent on running
// the gate and reporting the verdict as data.
const GATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['green', 'exitCode', 'failures', 'qaHash', 'gateFile'],
  properties: {
    green: { type: 'boolean', description: 'True if and only if the gate exited 0. Never infer it from the output — take it from the exit status.' },
    exitCode: { type: 'number', description: '-1 if the gate could not be run at all.' },
    failures: {
      type: 'string',
      description: 'Empty when green. When red: WHAT failed and WHY — check names, test names, assertion diffs, compiler and lint errors with file:line. Verbatim, not paraphrased.',
    },
    qaHash: {
      type: 'string',
      description: 'sha256 of the gate file actually run — `.claude/qa-scoped` when `gateFile` is that, otherwise `.claude/qa` — as 64 hex characters. Empty string only if the file is missing or unreadable.',
    },
    gateFile: {
      type: 'string',
      enum: ['qa', 'qa-scoped'],
      description: '`qa-scoped` only when you were allowed to scope this run AND `.claude/qa-scoped` exists. `qa` otherwise — always `qa` when scoping was not allowed.',
    },
    blocked: {
      // Read once and deleted, so it signals the step that just ran and never a
      // later one.
      type: 'string',
      description: 'Contents of `.claude/dev-graph/blocked` if it existed, else empty. Its presence means an agent declared the work unsatisfiable.',
    },
    error: {
      type: 'string',
      description: 'Empty normally. Set only if the gate could not be run at all — no `.claude/qa`, unreadable, or the directory is missing.',
    },
  },
}

// One task's private working copy. Tasks run concurrently, so they cannot share
// a directory: two verification runs in one checkout collide on build output,
// coverage directories, `.next`/`dist`, and any port a test server binds.
const TASK_WORKTREE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['root', 'branch', 'baseSha'],
  properties: {
    root: { type: 'string', description: 'Absolute path of this task\'s worktree. Empty string only if it could not be prepared.' },
    branch: { type: 'string', description: 'The branch checked out in it.' },
    baseSha: {
      type: 'string',
      // Becomes the task's `taskBase`: every authorship verdict in `addTask` is
      // decided against it, and the land protocol asks whether a gate failure
      // already existed at it.
      description: 'Full sha the worktree branched from — the run branch head at the moment it was created, or the branch\'s existing head if you adopted one.',
    },
    reused: { type: 'boolean', description: 'True if you adopted a worktree that was already there rather than creating one.' },
    error: { type: 'string', description: 'Empty normally. What git said if the worktree could not be prepared, leaving `root` empty.' },
  },
}

// Everything a land does BEFORE the gate: the ancestry check that makes a
// replayed land a no-op, the squash, and the rebase with its conflicts.
const LAND_PREP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['alreadyLanded', 'ready', 'headSha'],
  properties: {
    alreadyLanded: {
      type: 'boolean',
      description: 'True if this task\'s branch was ALREADY an ancestor of the run branch when you started — a previous attempt landed it. You then changed nothing.',
    },
    ready: { type: 'boolean', description: 'True if the branch is squashed and rebased onto the run branch head and the gate can now be run against it.' },
    headSha: { type: 'string', description: 'Full sha of the task branch head after your work — unchanged if `alreadyLanded`, the rebased squash commit otherwise.' },
    conflicts: {
      type: 'array',
      description: 'Paths that conflicted during the rebase, whether or not you resolved them. Empty when the rebase was clean.',
      items: { type: 'string' },
    },
    resolution: { type: 'string', description: 'Empty when there were no conflicts. Otherwise, per file: what each side did and how both behaviours survive in what you wrote.' },
    unresolvable: {
      type: 'boolean',
      // Routed to a human with the branch left on disk. Never forced.
      description: 'True if you aborted the rebase because the two sides cannot both survive. Say which files and what each side wanted in `resolution`.',
    },
    error: { type: 'string', description: 'Empty normally. Set only if a git command failed outright, and leave `ready` false.' },
  },
}

// The last step of a land: move the run branch to the verified task branch.
const LAND_FINISH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['fastForwarded', 'runBranchSha'],
  properties: {
    fastForwarded: { type: 'boolean', description: 'True if the run branch now points at the task branch head — including when it already did.' },
    runBranchSha: { type: 'string', description: 'Full sha the run branch points at now, read after the fast-forward.' },
    error: { type: 'string', description: 'Empty normally. What git said if the fast-forward was refused, and leave `fastForwarded` false.' },
  },
}

const COMMIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['committed', 'sha', 'changedFiles'],
  properties: {
    committed: { type: 'boolean', description: 'True if you created a commit. False if there was genuinely nothing to commit.' },
    sha: { type: 'string', description: 'Full sha of HEAD after you finished — the new commit, or the unchanged HEAD if there was nothing to commit.' },
    changedFiles: {
      type: 'array',
      // Ground truth about what this task touched, and the input to the scope
      // check.
      description: 'Repo-relative paths in the commit you just made, from `git show --name-only`. Empty when nothing was committed.',
      items: { type: 'string' },
    },
    note: {
      type: 'string',
      description: 'Empty normally. Say here if you deliberately left something unstaged (a build output or a secret `.gitignore` does not cover).',
    },
    error: { type: 'string', description: 'Empty normally. Set only if the commit could not be made at all, and leave `committed` false.' },
  },
}

const FIND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      description: 'High-conviction findings only. Zero is a legitimate result — do not pad.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'summary', 'failureScenario', 'evidence', 'proposedTest', 'needsHumanDecision'],
        properties: {
          severity: {
            type: 'string',
            enum: ['P0', 'P1', 'P2'],
            description: `How bad it is IF it happens — impact, never likelihood. ${SEVERITY_DEF}`,
          },
          file: { type: 'string' },
          line: { type: 'number' },
          summary: { type: 'string', description: 'One sentence stating the defect.' },
          failureScenario: {
            type: 'string',
            description: 'Concrete inputs/state → the wrong output or crash. If you cannot state one, drop the finding.',
          },
          evidence: {
            type: 'string',
            enum: ['reproduced', 'traced-to-caller', 'predicted'],
            description: `Where the failure scenario came from.\n${EVIDENCE_DEF}`,
          },
          likely: { type: 'boolean', description: 'Optional, only meaningful on a predicted finding: happens in normal use, not only under a contrived input.' },
          expensive: { type: 'boolean', description: 'Optional, only meaningful on a predicted finding: costs real money, data or trust when it lands.' },
          oneWayDoor: { type: 'boolean', description: 'Optional, only meaningful on a predicted finding: fixing it later is materially harder than now.' },
          proposedTest: { type: 'string', description: 'The assertion that SHOULD hold.' },
          criterion: { type: 'number', description: 'Optional. The acceptance criterion number this finding violates, if any.' },
          needsHumanDecision: {
            type: 'boolean',
            description: `True if fixing this needs a judgement the acceptance criteria do not make. ${HUMAN_DECISION_DEF}`,
          },
          humanQuestion: {
            type: 'string',
            description: 'Required when needsHumanDecision is true, empty otherwise. The decision, the options, and what each one costs — answerable in one read without opening the file.',
          },
        },
      },
    },
    heldUp: { type: 'string', description: 'One line on what you attacked that held, so the reader knows it was actually checked.' },
  },
}

// Smaller than dev-loop's. `scope`, `destination` and `laterTaskId` are gone:
// routing is `addTask`'s job now, it decides on authorship rather than on the
// finding's file, and there is no "ignore it, a later task owns it" path when
// tasks are a graph rather than an order.
const DEDUPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['survivors', 'dropped', 'trackerAvailable'],
  properties: {
    survivors: {
      type: 'array',
      description: 'The findings worth routing into the queue, after collapsing, dropping and clustering.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'summary', 'failureScenario', 'evidence', 'proposedTest', 'needsHumanDecision'],
        properties: {
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'], description: `Impact only. ${SEVERITY_DEF}` },
          file: { type: 'string' },
          line: { type: 'number' },
          summary: { type: 'string' },
          failureScenario: { type: 'string' },
          evidence: {
            type: 'string',
            enum: ['reproduced', 'traced-to-caller', 'predicted'],
            description: 'Carried through from the finder unchanged; if you merged findings, take the WEAKEST of the merged labels, never the strongest.',
          },
          likely: { type: 'boolean' },
          expensive: { type: 'boolean' },
          oneWayDoor: { type: 'boolean' },
          proposedTest: { type: 'string' },
          criterion: { type: 'number' },
          needsHumanDecision: { type: 'boolean', description: 'Carried through from the finder. Set it yourself if the finder missed it and the fix plainly needs a decision no criterion makes.' },
          humanQuestion: { type: 'string', description: 'Required when needsHumanDecision is true: the decision, the options, and what each costs.' },
          isCluster: { type: 'boolean', description: 'True if this is a design finding that replaces several individual reports in one file.' },
          mergedFrom: {
            type: 'array',
            description: 'One line per original finding folded into this one (duplicates collapsed, or members of a cluster).',
            items: { type: 'string' },
          },
        },
      },
    },
    dropped: {
      type: 'array',
      description: 'Every finding you removed, with why. This is the audit trail — a silent drop reads as "we found nothing" when we did.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'file', 'reason', 'detail'],
        properties: {
          summary: { type: 'string' },
          file: { type: 'string' },
          // The first three are all "we have seen this". The last four are the
          // quality bar — each one is a shape that actually reached an
          // adjudicator in a recorded run and should never have.
          reason: {
            type: 'string',
            enum: ['duplicateInRound', 'alreadyQueued', 'alreadyTracked', 'noReachableCaller', 'notADefect', 'runScaffolding', 'alreadyTrue', 'clustered'],
          },
          detail: {
            type: 'string',
            description:
              'The specific match: which finding it duplicates, which queued task, or — for `alreadyTracked` — which issue AND how you established the fix is actually in the code (the commit that closed it and what it changed, or the guard now in the file).',
          },
          issue: { type: 'string', description: 'Issue number or URL when reason is alreadyTracked. Not a reason to drop on its own — `detail` must say why the fix is present in the code.' },
        },
      },
    },
    trackerAvailable: {
      type: 'boolean',
      description: 'True only if you successfully queried the tracker. False if there is no remote, no gh, or gh is not authenticated.',
    },
    warning: { type: 'string', description: 'Empty normally. Say here if the tracker arm was skipped, and why.' },
  },
}

const SIMPLIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary'],
  properties: {
    summary: { type: 'string', description: 'Each move you made and the duplication or unearned abstraction it removed. "Nothing" is fine.' },
    commitSha: { type: 'string', description: 'Sha of the refactor commit, so it can be reverted wholesale if it turns out to have changed behaviour.' },
    reverted: {
      type: 'boolean',
      description: 'True if you undid part or all of this pass because the gate went red. Say in `summary` what you reverted and why. Reverting everything is a valid outcome, not a failure.',
    },
  },
}

const REQUIREMENTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['unmet'],
  properties: {
    unmet: {
      type: 'array',
      description: 'Criteria that are NOT observably true in the finished code. Empty is the expected result.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['n', 'text', 'why'],
        properties: {
          n: { type: 'number' },
          text: { type: 'string' },
          why: { type: 'string', description: 'What is missing, or what is present but not enforced by any gate.' },
        },
      },
    },
    ungatedButPresent: {
      type: 'array',
      description: 'Criteria that appear satisfied but nothing would catch a regression: no test, or a file outside the typecheck/lint include set.',
      items: { type: 'string' },
    },
    integrationDefects: {
      type: 'array',
      description: 'Defects that exist only BETWEEN tasks — a caller left on an old signature, two half-migrated paths, a seam nobody owns.',
      items: { type: 'string' },
    },
  },
}

// A run leaves a full checkout plus its dependencies behind — around 2 GB of it
// in a typical repo, and 25 GB of abandoned worktrees had accumulated across the
// machine, 19 GB of that in one repo. A clean run does not need its worktree any
// more: the branch holds every commit it made and removing a worktree never
// touches a branch. A run that is anything other than clean keeps it.
const CLEANUP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['removed', 'branch', 'headSha'],
  properties: {
    removed: { type: 'boolean', description: 'True only if the directory is gone and `git worktree list` confirms it.' },
    branch: { type: 'string', description: 'The branch the worktree was on — where every commit this run made still lives. Empty only if you could not read it.' },
    headSha: { type: 'string', description: 'The sha that branch points at, read BEFORE anything was removed.' },
    keptBecause: {
      type: 'string',
      description: 'Empty when you removed it. Otherwise the specific check that stopped you — uncommitted work, a path outside `.claude/worktrees/`, a failed command.',
    },
    error: { type: 'string', description: 'Empty normally. Set it if a command failed outright.' },
  },
}

// ---- finder lenses -------------------------------------------------------
// Exactly two, ported from dev-loop. There is deliberately no quality lens —
// quality is handled by the `simplify` step at the end, not by paying agents to
// argue about it. The "present but ungated" shape is not theoretical: a run once
// fixed a flaky test with a line in `vitest.setup.ts`, but that file sat outside
// the tsconfig `include`, so a typo would have silently reverted the fix with
// every check still green.
const LENSES = [
  {
    key: 'requirements',
    brief: `**Requirements.** Are this task's acceptance criteria actually met by the diff — not "the code looks like it does that", but *met*? Hunt two shapes:

1. **Claimed but absent.** The criterion is asserted in a summary or a comment and nothing in the diff implements it.
2. **Present but ungated.** The behaviour exists but nothing would catch it regressing. Check that the files carrying each criterion are inside the test/lint/typecheck surface \`.claude/qa\` actually runs. An unguarded criterion is a finding even when the behaviour is correct today.

Cite the criterion number on every finding.`,
  },
  {
    key: 'defects',
    brief: `**Defects.** Edge cases and security, merged into one lens.

- Boundaries: empty, null/undefined, zero, negative, max, overflow, unicode, very large inputs.
- Error and failure paths: the thing you called throws, times out, or returns a shape you did not expect.
- Concurrency and ordering: interleaving, re-entrancy, races on shared state, non-atomic read-modify-write.
- Partial failure and retry: half-applied writes, non-idempotent retries, no rollback.
- Injection (SQL/shell/template), authz gaps, path traversal, SSRF, unsafe deserialization, secrets in code, unvalidated input crossing a trust boundary.
- Data loss or corruption in any form.

For each, name the **input → the wrong outcome**. If a bug resists reproduction, use the **diagnosing-bugs** skill to build a reproducer rather than speculating.`,
  },
]

// ---- formatting helpers --------------------------------------------------

const fmtCriteria = (cs) => cs.map((c) => `${c.n}. ${c.text}`).join('\n')

// The optional triage flags on a predicted finding. They never gate anything —
// they are what makes a filed issue closable at a glance.
const fmtFlags = (f) => {
  const xs = []
  if (f.likely) xs.push('likely')
  if (f.expensive) xs.push('expensive')
  if (f.oneWayDoor) xs.push('one-way door')
  return xs.length ? ` {${xs.join(', ')}}` : ''
}

const fmtList = (xs) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '- (none)')

const fmtQueue = (recs) =>
  recs.length
    ? recs
        .map(
          (r) =>
            `- [${r.id}] gen ${r.generation} · ${r.state} — ${r.title}\n  scope: ${(r.scope || []).join(', ') || '(none declared)'}${
              (r.deps || []).length ? `\n  deps: ${r.deps.join(', ')}` : ''
            }${r.description && r.description !== r.title ? `\n  ${String(r.description).split('\n')[0].slice(0, 200)}` : ''}`,
        )
        .join('\n')
    : '- (the queue is empty)'

const fmtFinding = (f) =>
  `- Severity (impact if it happens): ${f.severity}
- Location: ${f.file}${f.line ? `:${f.line}` : ''}
- Summary: ${f.summary}
- Failure scenario: ${f.failureScenario}
- Evidence: ${f.evidence || 'unstated'}${fmtFlags(f)}
- Assertion that should hold: ${f.proposedTest}${f.criterion ? `\n- Acceptance criterion it violates: ${f.criterion}` : ''}${
    f.isCluster ? `\n- This is a **design finding** standing in for several symptoms in one file: ${(f.mergedFrom || []).join('; ')}` : ''
  }${f.needsHumanDecision ? `\n- Needs a human decision: ${f.humanQuestion || '(flagged, but no question was stated)'}` : ''}`

// ---- scope matching ------------------------------------------------------
// Ported from dev-loop. `scope` was prose in a prompt that nobody checked, and
// the sprawl it was meant to prevent happened anyway. Checking it needs matching
// that is deliberately forgiving: agents report paths relative and absolute, and
// a scope entry is written as a glob, a bare directory or a plain path
// interchangeably. A false match costs a stray file nobody flags; a false miss
// costs a bogus finding every task, so tolerance is the cheaper error.
const relPath = (p, root) => {
  let s = String(p || '').trim().replace(/^\.\//, '')
  if (root && s.startsWith(root)) s = s.slice(root.length).replace(/^\/+/, '')
  return s.replace(/^\/+/, '')
}

// Exempt from the scope check. Test files legitimately live outside a
// production-file scope list — this loop REQUIRES them to be written — and the
// gate file and the lockfile a dependency install rewrites belong to the run
// rather than to any task.
const isTestPath = (p) => /(^|\/)(tests?|__tests__|__mocks__|spec|specs|e2e|fixtures?|mocks?)(\/|$)/i.test(p) || /\.(test|spec)\.[a-z]+$/i.test(p)
const isScopeExempt = (p) =>
  isTestPath(p) ||
  /(^|\/)\.claude\//.test(p) ||
  /(^|\/)(bun\.lockb?|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|go\.sum|Gemfile\.lock)$/i.test(p)

// A scope entry matches the path itself and everything under it, so a bare
// directory works without anybody having to remember to write `dir/**`.
const scopeMatcher = (entry) => {
  const s = String(entry || '').trim().replace(/^\.\//, '').replace(/\/+$/, '').replace(/\/\*\*$/, '')
  if (!s) return null
  // One pass, so a `*` produced by an earlier substitution can never be eaten by
  // a later one: `**/` spans directories, `*` and `?` stop at one, and every
  // other regex metacharacter is escaped back to itself.
  const body = s.replace(/\*\*\/|[*?]|[.+^${}()|[\]\\]/g, (m) =>
    m === '**/' ? '(?:[^/]+/)*' : m === '*' ? '[^/]*' : m === '?' ? '[^/]' : `\\${m}`,
  )
  return new RegExp(`^${body}(?:/.*)?$`)
}

const outOfScope = (files, scope, root) => {
  const matchers = (scope || []).map(scopeMatcher).filter(Boolean)
  // No declared scope means nothing to violate. Treating "unspecified" as
  // "nothing is allowed" would make every file in the task a finding.
  if (!matchers.length) return []
  const strays = []
  for (const f of files || []) {
    const p = relPath(f, root)
    if (!p || isScopeExempt(p)) continue
    if (!matchers.some((re) => re.test(p)) && !strays.includes(p)) strays.push(p)
  }
  return strays
}

// Which queued tasks claim this file. `addTask` uses it to derive a new task's
// dependency edges from scope overlap, so a fix-task for a file another task is
// still rewriting waits for that task instead of racing it.
const ownersOf = (file, recs, root) => {
  const p = relPath(file, root)
  if (!p) return []
  return recs
    .filter((r) => {
      const ms = (r.scope || []).map(scopeMatcher).filter(Boolean)
      return ms.some((re) => re.test(p))
    })
    .map((r) => r.id)
}

// ---- the task record -----------------------------------------------------
// One place the record's shape is written down. Every agent that touches the
// queue is handed an instance of this and told to preserve the fields it is not
// changing, so a field added here does not need a schema change anywhere else.
const newRecord = (f) => ({
  id: String(f.id || ''),
  title: String(f.title || ''),
  // What the worker is actually asked to deliver. For a decomposed task this is
  // the rationale; for a task born from a finding it is the finding written out.
  // `merge` appends to it, which is the whole mechanism by which two findings
  // about one thing become one task.
  description: String(f.description || ''),
  criteria: f.criteria || [],
  scope: f.scope || [],
  deps: f.deps || [],
  generation: typeof f.generation === 'number' ? f.generation : 0,
  verificationOnly: !!f.verificationOnly,
  state: f.state || 'queued',
  // `git rev-parse HEAD` at the moment the task started. The authorship test in
  // `addTask` is decided against this sha, so it is written before any of the
  // task's own work and never overwritten.
  taskBase: String(f.taskBase || ''),
  outcome: String(f.outcome || ''),
  detail: String(f.detail || ''),
  commit: String(f.commit || ''),
  source: String(f.source || ''),
})

const parseRecords = (jsons, onBad) => {
  const out = []
  for (const s of jsons || []) {
    try {
      const r = JSON.parse(String(s))
      if (r && r.id) out.push(newRecord(r))
      else onBad(`a queue ref held JSON with no id: ${String(s).slice(0, 120)}`)
    } catch (e) {
      onBad(`a queue ref held unparseable JSON: ${String(s).slice(0, 120)}`)
    }
  }
  return out
}

// ---- graph ---------------------------------------------------------------
// Kahn's algorithm, FIFO among ready nodes, so a graph the decomposer wrote as a
// chain executes in exactly the order it wrote it and a graph with genuine
// parallelism executes breadth-first. Deterministic either way — there is no
// clock and no randomness to make it otherwise.
const toposort = (recs) => {
  const byId = new Map(recs.map((r) => [r.id, r]))
  const indeg = new Map(recs.map((r) => [r.id, 0]))
  const dependents = new Map(recs.map((r) => [r.id, []]))
  for (const r of recs) {
    for (const d of r.deps || []) {
      if (!byId.has(d)) continue
      dependents.get(d).push(r.id)
      indeg.set(r.id, indeg.get(r.id) + 1)
    }
  }
  const order = []
  const ready = recs.filter((r) => indeg.get(r.id) === 0).map((r) => r.id)
  while (ready.length) {
    const id = ready.shift()
    order.push(byId.get(id))
    for (const n of dependents.get(id)) {
      indeg.set(n, indeg.get(n) - 1)
      if (indeg.get(n) === 0) ready.push(n)
    }
  }
  return order
}

// The three validations, run in pure JS before a single agent is spent on
// executing anything. They are cheap, deterministic and they answer the only
// questions that make a graph unrunnable.
//
// A violation is a HARD STOP with the offending ids named, not a silent repair.
// The repairs are all tempting and all wrong: dropping an unknown edge runs a
// task before the code it depends on exists; breaking a cycle on declared order
// picks one of the two edges to violate and cannot say which; falling back to
// serial hides that the decomposer produced something incoherent. Every one of
// them converts "the plan was decomposed wrong" into "the run built the wrong
// thing", which is far more expensive to notice.
const validateGraph = (recs) => {
  const errors = []
  const ids = recs.map((r) => r.id)
  const idSet = new Set(ids)

  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dupes.length) errors.push(`duplicate task id(s): ${[...new Set(dupes)].join(', ')}. Ids key the queue refs, so two tasks sharing one would silently overwrite each other.`)

  // (b) every declared dep id exists.
  for (const r of recs) {
    for (const d of r.deps || []) {
      if (!idSet.has(d)) errors.push(`task \`${r.id}\` depends on \`${d}\`, which is not a task in this graph.`)
      if (d === r.id) errors.push(`task \`${r.id}\` depends on itself.`)
    }
  }

  // (a) acyclic. Kahn's emits every node exactly when a graph has no cycle, so
  // the nodes it did NOT emit are precisely the ones inside or downstream of
  // one. Naming them is the whole value of the check.
  const order = toposort(recs)
  const emitted = new Set(order.map((r) => r.id))
  const stuck = ids.filter((id) => !emitted.has(id))
  if (stuck.length) errors.push(`dependency cycle — these tasks can never start because each waits on another that waits on it: ${stuck.join(', ')}.`)

  // (c) no orphan states, and every task reachable by the walk. A record whose
  // `state` is not one this script knows would be skipped or re-run at random,
  // and a task the topological walk never emits is one nothing will ever
  // schedule. Both are silent stalls rather than errors, which is why they are
  // checked here.
  for (const r of recs) {
    if (!TASK_STATES.includes(r.state)) errors.push(`task \`${r.id}\` is in state \`${r.state}\`, which is not one of: ${TASK_STATES.join(', ')}.`)
  }
  if (!stuck.length && order.length !== recs.length) {
    errors.push(`the execution order covers ${order.length} of ${recs.length} task(s) — ${ids.filter((id) => !emitted.has(id)).join(', ')} would never be scheduled.`)
  }
  if (recs.length && !recs.some((r) => !(r.deps || []).length)) {
    errors.push('every task declares a dependency, so nothing can start. At least one task must have an empty `deps`.')
  }

  return { ok: !errors.length, errors, order }
}

// Longest chain of dependencies, in tasks. Logged at decompose time so a
// degenerate chain — where the graph bought nothing and the simpler tool was the
// right one — is visible immediately rather than inferred from the wall clock
// afterwards. Safe to call only once acyclicity is established.
const criticalPath = (recs) => {
  const byId = new Map(recs.map((r) => [r.id, r]))
  const memo = new Map()
  const depthOf = (id) => {
    if (memo.has(id)) return memo.get(id)
    const r = byId.get(id)
    let best = { n: 0, path: [] }
    for (const d of (r.deps || [])) {
      if (!byId.has(d)) continue
      const sub = depthOf(d)
      if (sub.n > best.n) best = sub
    }
    const here = { n: best.n + 1, path: [...best.path, id] }
    memo.set(id, here)
    return here
  }
  let longest = { n: 0, path: [] }
  for (const r of recs) {
    const d = depthOf(r.id)
    if (d.n > longest.n) longest = d
  }
  return longest
}

// Measured, never enforced. Overlapping scopes are ALLOWED here — forbidding
// them is exactly what forces a graph back into a chain — but past a point the
// number says the plan is not feature-separable and fanning out would produce a
// conflict storm at land time rather than parallelism. Still reported rather
// than acted on: the scheduler does not narrow itself on this number, because
// the cost of being wrong about a plan's separability is one land retry and the
// cost of falling back unnecessarily is the whole wall-clock win.
const scopeOverlapPct = (recs) => {
  const norm = (s) => String(s || '').trim().replace(/^\.\//, '').replace(/\/+$/, '').replace(/\/\*\*$/, '')
  const sets = recs.map((r) => new Set((r.scope || []).map(norm).filter(Boolean)))
  let pairs = 0
  let overlapping = 0
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      pairs++
      for (const s of sets[i]) {
        if (sets[j].has(s)) {
          overlapping++
          break
        }
      }
    }
  }
  return pairs ? Math.round((overlapping / pairs) * 100) : 0
}

// ---- the gate ------------------------------------------------------------
// Runs the repo's own gate and reports the verdict as data. This is what makes
// "green" a fact this workflow observed rather than a claim an agent made.
// Deliberately tiny — a shell invocation with a schema, not a reasoning task —
// so it is worth spending a cheap model and low effort on it.
//
// It replaces a Stop hook on the worker agent type that was supposed to do this
// on the harness side. Across 976 recorded subagent transcripts that hook fired
// zero times, and had it fired it would have run against the repo root rather
// than the run's worktree for 910 of them.
//
// **The agent that wrote the code never certifies its own green.** That is the
// entire reason this is a separate agent rather than a field on WORKER_SCHEMA.
//
// `scoped: true` lets this call fall back to `.claude/qa-scoped` — a cheaper,
// package-filtered stand-in Intake writes only when the repo already has a
// mechanism for it — instead of the full `.claude/qa`. It is a per-round
// optimization only. Neither a land nor the Integrate phase ever passes it: a
// land gates code that has just been rebased onto other tasks' work, and
// Integrate is the run's one full verification of the finished branch. Scoping
// either would be scoping exactly the run that has to see everything.
const runGate = (root, label, phaseName, { scoped = false } = {}) =>
  agent(
    `Your job is to run this workspace's verification gate and report exactly what happened. You are a measuring instrument, not a fixer.

## Workflow

1. \`cd ${root}\`.
2. ${
      scoped
        ? `Check whether \`.claude/qa-scoped\` exists. If it does, it is this round's gate file: collect the paths changed since the base commit (\`git status --porcelain\`, plus \`git diff --name-only\` against the base if the round already committed) and run it as \`bash .claude/qa-scoped <changed paths>\`; report \`gateFile: "qa-scoped"\`. If it does not exist, the gate file is \`.claude/qa\`, run with no arguments; report \`gateFile: "qa"\`.`
        : `The gate file is \`.claude/qa\`, run with no arguments. Report \`gateFile: "qa"\`.`
    }
3. Hash the gate file from step 2: \`shasum -a 256 <that file>\` (or \`sha256sum\`). Return the 64-character hex digest as \`qaHash\`, or an empty string only if it could not be hashed.
4. If \`.claude/dev-graph/blocked\` exists, return its contents as \`blocked\` and then delete it (\`rm -f .claude/dev-graph/blocked\`) — it is a one-shot signal to the orchestrator, and a copy left behind is read as fresh by every later step. Otherwise return an empty string and delete nothing.
5. Run the gate file from step 2 from \`${root}\`. Capture combined stdout and stderr, and the exit code.
6. Report \`exitCode\` as you saw it. \`green\` is true if and only if it is 0 — never judge greenness from the output text, because a gate can print reassuring things and still exit non-zero.
7. Report \`failures\`: empty when green; when red, the failing check names, failing test names, assertion diffs, and compiler and lint errors with their \`file:line\`, quoted **verbatim** — they are handed straight back to the agent that has to fix them. Drop passing output, progress spinners and install noise; keep every error. If the output is enormous, keep the **first** errors and note how many you cut.
8. Report \`error\` only if the gate file could not be run at all (missing, not readable, \`${root}\` missing), and leave \`green\` false.

## Guardrails

1. Fix nothing, commit nothing, and touch no file except the one step 4 names.
2. Never edit \`.claude/qa\` or \`.claude/qa-scoped\`, and never make the gate pass.
3. Never re-run a failing check hoping for a different answer. Report the first result you get.`,
    { schema: GATE_SCHEMA, label, phase: phaseName, model: 'haiku', effort: 'low' },
  )

// Commits whatever the task produced, so that `git diff <base>...HEAD` — the
// command every reviewer downstream is handed — describes this task instead of
// coming back empty. Same shape as `runGate`: a shell invocation with a schema.
//
// Idempotent by construction: step 2 turns an empty `git status` into a no-op
// that returns the unchanged HEAD. A resume replays return values, never the
// filesystem, so this agent can be re-executed against a tree where its commit
// already exists — and when it is, there is nothing left to commit and it says
// so rather than making an empty one.
const runCommit = (root, message, label, phaseName) => {
  // The message reaches the agent inside a `git commit -m "..."` it is told to
  // run, so a quote or a backtick in a task title would be a shell injection
  // against ourselves.
  const safe = String(message).replace(/["`$\\]/g, ' ').replace(/\s+/g, ' ').trim()
  // `--no-verify` is deliberate: the workspace's own gate has already run, and a
  // pre-commit hook that rewrites files would put the tree out of step with the
  // verdict just recorded.
  return agent(
    `Your job is to commit the work already sitting in this workspace and report what landed. You are a bookkeeping step, not an author.

## Workflow

1. \`cd ${root}\`.
2. \`git status --porcelain\`. If it is empty, return \`committed: false\`, \`sha\` = the current \`git rev-parse HEAD\`, an empty \`changedFiles\`, and stop. This is a normal outcome, not an error — it means the work is already committed.
3. Read what it lists before you stage. Leave **unstaged** anything that plainly must never be committed — \`node_modules/\`, a build output directory, a \`.env\` or other secret \`.gitignore\` does not cover — staging the rest explicitly by path, and name them in \`note\`. Everything else is this task's work and belongs in the commit, including new test files.
4. \`git add -A\` (or the explicit paths from step 3), then \`git commit -q --no-verify -m "${safe}"\`.
5. Return \`sha\` from \`git rev-parse HEAD\` and \`changedFiles\` from \`git show --name-only --pretty=format: HEAD\` — repo-relative paths, one per line, blanks dropped.

## Guardrails

1. Write no code, fix nothing, and change no file's contents.
2. Never \`git checkout\`, \`git switch\`, \`git stash\`, \`git reset\`, \`git rebase\`, \`git push\`, or \`git commit --amend\`. Never touch a path outside \`${root}\`.
3. If the commit fails, say exactly what git said in \`error\`, leave \`committed\` false, and return the unchanged HEAD as \`sha\`.`,
    { schema: COMMIT_SCHEMA, label, phase: phaseName, model: 'haiku', effort: 'low' },
  )
}

// Removes ONE finished worktree, behind a guard that is the only thing standing
// between a bug in this file and somebody's uncommitted work. Ported from
// dev-loop, where it guarded a single worktree per run; this workflow creates
// one per task as well, so it is now a function with two callers rather than a
// prompt written out once, and the guard cannot drift between them.
//
// Three refusals, all of them checked before anything is removed: the path must
// sit under `/.claude/worktrees/`, `git status --porcelain` must be empty, and —
// for a task worktree — its branch must already be an ancestor of the run
// branch. That last one is what makes "a task whose work has not landed keeps
// its worktree" a fact rather than an intention.
const removeWorktree = (root, { landedInto = '', label, phaseName }) =>
  agent(
    `Your job is to remove one finished git worktree, and nothing else. You are a bookkeeping step, not a reasoning task.

## Workflow

Run these in order and **stop at the first one that does not pass**, leaving everything as it is.

1. \`cd ${root}\`. Confirm that path contains \`/.claude/worktrees/\`. If it does not, remove nothing and say so in \`keptBecause\` — this run's own worktrees are the only thing you may ever remove.
2. \`git rev-parse --abbrev-ref HEAD\` and \`git rev-parse HEAD\`. Return them as \`branch\` and \`headSha\` **before** you remove anything; they are how the work is found afterwards.
3. \`git status --porcelain\`. It must come back **empty**. Anything at all — a modified file, an untracked file — means work would be destroyed: keep the worktree, name what you saw in \`keptBecause\`, and stop.${
      landedInto
        ? `\n4. \`git merge-base --is-ancestor HEAD ${landedInto}\`. It must exit 0 — every commit here is already on \`${landedInto}\`. If it does not, this work has **not landed**: keep the worktree, say so in \`keptBecause\`, and stop. Removing it would strand the only checkout of unlanded work.`
        : ''
    }
${landedInto ? '5' : '4'}. Find the main checkout: \`git rev-parse --path-format=absolute --git-common-dir\` gives \`<repo>/.git\`, and its parent is the repo root. \`cd\` there — you cannot remove a worktree from inside it.
${landedInto ? '6' : '5'}. \`git worktree remove ${root}\`, then \`git worktree prune\`. If it refuses because of ignored build output (\`node_modules\` and friends) and step 3 came back empty, \`--force\` is fine; if step 3 was not empty you are not here.
${landedInto ? '7' : '6'}. \`git worktree list\` to confirm \`${root}\` is gone, and return \`removed: true\`.

## Guardrails

1. Never delete or move a branch. Removing a worktree deletes a directory and never a branch, and every commit stays reachable from \`branch\` — that is the only reason this is safe.
2. Never \`rm -rf\` anything, never touch another entry in \`git worktree list\`, and never run \`git worktree remove\` on a path that is not the one above.
3. Never delete a git ref. This run's queue lives in refs and is what a later invocation reads to know what was already done.
4. If anything surprises you, keep the worktree and say why. A couple of gigabytes of disk is far cheaper than work nobody can find again.`,
    { schema: CLEANUP_SCHEMA, label, phase: phaseName, model: 'haiku', effort: 'low' },
  )

// ---- return shape --------------------------------------------------------

const RESUME_HINT = `This run's queue is in git refs under \`${REF_ROOT}/\` and survives anything that happens to the orchestrator. Two ways back in:

1. **Re-invoke with the same plan.** The run id is \`fnv1a32(plan)\`, so the same plan text derives the same refs, and the run reconciles from them: landed tasks are skipped, in-flight tasks are re-picked from the top, and tasks added mid-run by \`addTask\` are still queued. Nothing is redone that was already done. **This is the path to use.** It is why the queue is in refs at all, and it is the only one that does not depend on the run having been deterministic.
2. **Resume the journal** — \`Workflow({scriptPath: "<the path this workflow was invoked with>", resumeFromRunId: "<the runId in this run's notification>"})\` — which replays every agent that already returned rather than re-running it. Expect this to replay only a short prefix of a parallel run: the runtime keys the journal on a chained hash of the agent calls in the order they were MADE, and with tasks in flight that order follows whichever task finished first, which is not reproducible. It stays exact for a run that executed serially. A resume replays return values, not the filesystem, so the worktree must still be on disk in the state this run left it either way.

Inspect the queue by hand with \`git for-each-ref '${REF_ROOT}/*'\` and \`git cat-file -p <ref>\`.`

// Collected from every phase, and returned on every exit — including the
// failing ones.
const warnings = []

// Every exit from this workflow returns THIS shape. A failure is a return with
// `status: 'failed'` and a `reason`, never a throw: a thrown error reaches the
// caller as a bare string, and everything the run learned before it died —
// worktree path, criteria, landed tasks, filed issues — is lost with it.
const result = (fields) => ({
  status: 'failed',
  reason: '',
  runId,
  queueRefs: `${REF_ROOT}/`,
  workRoot: '',
  branch: '',
  isolated: false,
  criteria: [],
  tasks: [],
  unmetCriteria: [],
  // Tasks `addTask` created from findings, so the caller can see what the run
  // gave itself to do that the decomposer never asked for.
  queuedFromFindings: [],
  issuesFiled: [],
  // Its own field on purpose. A task can finish with a product question still
  // open — the workflow files it and never waits for an answer — and buried one
  // level down inside `issuesFiled` a `status: "passed"` would hide it.
  openQuestions: [],
  // The worktree is removed only on a genuinely clean run; on every other exit
  // it is still on disk and `workRoot` points at it.
  worktreeRemoved: false,
  branchNote: '',
  resume: RESUME_HINT,
  warnings,
  ...fields,
})

// ---- model floor ---------------------------------------------------------
// A run on an under-powered model does not fail, it goes quiet: the finders stop
// finding, the queue never fills, and the run reports clean. Refusing here costs
// one message; discovering it from a green run that found nothing costs the
// whole run and the trust in it.
if (declaredModel && MODEL_RANK[declaredModel] !== undefined && MODEL_RANK[declaredModel] < MODEL_RANK[MODEL_FLOOR] && !a.allowWeakModel) {
  return result({
    reason: `This run was asked to use \`${declaredModel}\`, which is below this workflow's floor of \`${MODEL_FLOOR}\`. Hunting what the tests forgot, deciding authorship against a base sha and judging whether a criterion is really met all degrade silently on a weak model — the run would come back green having checked nothing. Re-run with \`model: "opus"\` (or omit \`model\` to inherit the session), or pass \`allowWeakModel: true\` if you genuinely want it anyway.`,
  })
}

// ---- Reconcile -----------------------------------------------------------
// Before anything else, look for this run's own refs. Orchestrator memory does
// not survive a crash; the refs do, so they — not this script — are the queue's
// source of truth, and the first thing the script does is find out what they
// already say.

phase('Reconcile')

log(`args parsed as: ${argForm}${argForm === 'json-string' ? ' (structured fields honoured)' : ''}`)
log(`run ${runId} (derived from the plan text, so a re-invocation on the same plan resumes this queue) · refs under ${REF_ROOT}/`)
log(`issueTracker=${issueTracker} maxTasks=${MAX_TASKS}${baseRefOverride ? ` baseRef=${baseRefOverride}` : ''}${branchName ? ` branch=${branchName}` : ''}`)
if (declaredModel) {
  log(`Model: ${declaredModel} (declared by the caller — every reasoning phase is pinned to it).`)
} else {
  warnings.push(`no model declared — every reasoning phase inherits the session model, so the ${MODEL_FLOOR} floor could not be enforced`)
  log(
    `⚠️ Model: inherited from the session — a workflow script cannot read it, so the \`${MODEL_FLOOR}\` floor was NOT enforced. Pass \`model: "opus"\` to pin it. A run on an under-powered model reports clean rather than failing.`,
  )
}

const reconciled = await agent(
  `Your job is to read one run's task queue out of git refs and report what is there. You are a measuring instrument: you create nothing, change nothing and repair nothing.

${REF_HOWTO}

## Workflow

1. \`cd\` to \`git rev-parse --show-toplevel\` and run everything from there.
2. \`git for-each-ref --format='%(refname)' '${REF_ROOT}/*'\`. If it prints nothing, this run has never been started: return \`found: false\`, an empty \`tasksJson\`, an empty \`metaJson\`, and stop.
3. \`git cat-file -p ${META_REF}\` if that ref exists, and return its contents **verbatim** as \`metaJson\`.
4. \`git cat-file -p\` every ref under \`${REF_ROOT}/task/\` and return each blob's contents **verbatim** as one entry in \`tasksJson\`. One entry per ref, in the order \`for-each-ref\` printed them.
5. If \`metaJson\` names a \`workRoot\`, check whether that directory still exists **and** still appears in \`git worktree list\`. Both true → \`workRootExists: true\`. Either false → \`workRootExists: false\`.

## Guardrails

1. Never run \`git update-ref\`, \`git hash-object\`, \`git commit\`, \`git checkout\`, or anything else that writes. This step is read-only in full.
2. Return every blob **exactly as stored**. Do not reformat the JSON, do not fix a field you think is wrong, and do not omit a record you think is stale — deciding that is the orchestrator's job and it needs the raw text to do it.
3. If a ref exists but its blob is not valid JSON, return the text anyway. A corrupt record must surface, not disappear.
4. Set \`error\` only if git itself failed. An empty namespace is a normal first run, not an error.`,
  { schema: RECONCILE_SCHEMA, label: 'reconcile', phase: 'Reconcile', model: 'haiku', effort: 'low' },
)

// A dead reconcile agent is not fatal — it means the run starts from scratch,
// which is wrong only if there was something to resume. Saying so is the whole
// mitigation; guessing would be worse.
let priorMeta = null
let priorTasks = []
if (!reconciled) {
  warnings.push('the reconcile step failed to return — this run starts from an empty queue even if refs already exist')
  log('⚠️ Reconcile failed to return. Starting from an empty queue. If this run has been started before, its refs are still there and a later invocation will find them.')
} else if (reconciled.error) {
  warnings.push(`reconcile could not read the queue refs (${reconciled.error}) — starting from an empty queue`)
  log(`⚠️ Reconcile could not read the refs: ${reconciled.error}. Starting from an empty queue.`)
} else if (reconciled.found) {
  priorTasks = parseRecords(reconciled.tasksJson, (m) => {
    warnings.push(`reconcile: ${m}`)
    log(`⚠️ Reconcile: ${m}`)
  })
  if (reconciled.metaJson) {
    try {
      priorMeta = JSON.parse(reconciled.metaJson)
    } catch (e) {
      warnings.push('the run meta ref held unparseable JSON — the previous worktree could not be identified, so a new one is created')
    }
  }
  const done = priorTasks.filter((t) => t.state === 'done').length
  log(
    `Reconciled: ${priorTasks.length} task(s) already in the queue (${done} done, ${priorTasks.filter((t) => t.state === 'running').length} were in flight, ${
      priorTasks.filter((t) => t.state === 'queued').length
    } queued).`,
  )
  if (priorTasks.some((t) => t.state === 'running')) {
    log('A task left in `running` was in flight when the last invocation stopped. It is re-picked from the top — its tests are already written and already passing, so its test generator reports `alreadySatisfied` and it converges through rather than redoing the work.')
  }
} else {
  log('No refs under this run id — a fresh run.')
}

// ---- Intake --------------------------------------------------------------

phase('Intake')

const priorWorkRoot = priorMeta && reconciled && reconciled.workRootExists ? String(priorMeta.workRoot || '') : ''
const priorBranch = priorMeta ? String(priorMeta.branch || '') : ''
if (priorWorkRoot) log(`Adopting the previous invocation's worktree at ${priorWorkRoot}${priorBranch ? ` (branch ${priorBranch})` : ''} — its commits are this run's landed work.`)

// The gate template below is not decoration. A recorded run shipped a red lint
// as green because its gate was four unchained commands with no `set -e`: the
// exit status was only the last command's.
//
// The "a file list is not a criterion" rule is likewise from a recorded
// failure — a run failed its own Definition of Done for writing test files,
// because "only these files change" had become criterion 4 and this loop
// REQUIRES every task to write a failing test first.
//
// `ciGaps` is a warning rather than a gate because widening the gate on a guess
// is worse than knowing it is narrow — but the gap is real: it is the exact
// mechanism by which a run drove its own gate green and then had the PR
// rejected by CI.
const intake = await agent(
  `Your job is to prepare ONE isolated working copy for this entire run, establish the repo's real verification gate, and extract the Definition of Done.

## Workflow
${
    priorWorkRoot
      ? `
1. **This run has been started before and its worktree is still on disk at \`${priorWorkRoot}\`${priorBranch ? ` on branch \`${priorBranch}\`` : ''}.** Adopt it: \`cd\` there, confirm \`git worktree list\` still shows it and \`git rev-parse --abbrev-ref HEAD\` gives the branch above, and return it as \`workRoot\` with \`isolated: true\`, \`reused: true\`. Create nothing. If it is NOT usable, say so in \`warning\` and fall through to creating a fresh one as below.
2. \`git rev-parse ${priorMeta && priorMeta.baseRef ? String(priorMeta.baseRef) : baseRefStart}\` for the sha this run is based on — the SAME base the first invocation used, so every whole-run diff still describes the whole run.`
      : `
1. \`git rev-parse --show-toplevel\` for the repo root, \`git rev-parse ${baseRefStart}\` for the sha this run is based on.
2. Make sure \`.claude/worktrees\` is matched by \`.gitignore\` before you create anything — append it if it is not, skip if it already is. The worktree goes inside the repo, so without this the shared checkout reports the whole thing as untracked and someone eventually commits it.`
  }
3. Create ONE dedicated worktree on a new branch, **branched from \`${baseRefStart}\`**, at \`<repo root>/.claude/worktrees/<suffix>\`: \`git worktree add <path> -b <branch> ${baseRefStart}\`. Use \`dev-graph-${runId}\` as \`<suffix>\` — it is derived from this run's plan text, so a re-invocation lands on the same path rather than accumulating a new one every time.${
    branchName
      ? `\n4. **The caller named the branch \`${branchName}\`.** Use exactly that. If it already exists (\`git rev-parse --verify ${branchName}\` succeeds) AND no worktree is on it, check it out into the new worktree rather than creating it; if a worktree already holds it, fall back to \`run/dev-graph-${runId}\` and say in \`warning\` that the requested name was taken. Return whichever name you ended on as \`branch\`.`
      : `\n4. Name the branch \`run/dev-graph-${runId}\` so the path and the branch agree. If it already exists and no worktree holds it, check it out rather than creating it — this run has been here before. (A caller can name the branch by passing \`branch\` in the workflow's args; this run did not.) **Return the name you ended on as \`branch\`**, read back with \`git rev-parse --abbrev-ref HEAD\` from inside the worktree.`
  }
5. Install dependencies inside the worktree with whatever the repo uses — \`bun install\`, \`npm ci\`, \`pnpm install\` — and copy over the gitignored files the build genuinely needs (\`.env\`, \`.env.local\`, local config, credentials fixtures) from the repo root. A missing one surfaces much later as an inscrutable failure.
6. Return the worktree's absolute path as \`workRoot\`, \`isolated: true\`, the branch it is on as \`branch\` (\`git rev-parse --abbrev-ref HEAD\` from inside it — never the name you meant to use, always the one git reports), and the sha you branched from as \`baseRef\`. Every one of these is required; a run that gets \`workRoot\` without \`branch\` cannot parallelise anything.${
    baseRefOverride
      ? ` The caller specified base ref "${baseRefOverride}", so branch from **that ref**, not HEAD, and \`baseRef\` is the sha it resolves to. Resolve it first: if \`git rev-parse ${baseRefOverride}\` fails, branch from \`HEAD\` instead, return that sha, and say so in \`warning\` — never guess at what was meant.`
      : ''
  }
7. From \`workRoot\`, read \`package.json\` scripts, any Makefile/justfile, and CI config (\`.github/workflows/*\`) and determine the repo's REAL commands for **test, lint, format, typecheck**.
8. Establish \`<workRoot>/.claude/qa\` per **The gate file** below, \`chmod +x\` it, and **commit it** so future runs in this repo skip discovery entirely.
9. Return the \`run\` lines as \`qaCommands\` (not the boilerplate), the test command alone as \`testCommand\` (empty string only if the repo genuinely has no test suite), and, once the file is final, \`shasum -a 256 .claude/qa\` as \`qaHash\`.
10. Check for a monorepo mechanism that already scopes verification to changed packages — evidence is \`turbo.json\` plus a \`turbo run ... --filter\` script, \`nx.json\` plus \`nx affected\`, or \`pnpm-workspace.yaml\` plus a \`pnpm --filter\` script, confirmed by reading root \`package.json\` scripts rather than guessed from the config file's presence alone. If and only if you find one, also write \`<workRoot>/.claude/qa-scoped\` per **The scoped gate file** below, \`chmod +x\` it, and commit it alongside \`.claude/qa\`; return \`qaScopedWritten: true\` and \`shasum -a 256 .claude/qa-scoped\` as \`qaScopedHash\`. If you find none, write nothing; return \`qaScopedWritten: false\` and \`qaScopedHash: ""\` — the run then gates with the full \`.claude/qa\` throughout.
11. Cross-check the gate against CI, reading the CI config a second time: for **every** command CI runs on a pull request — lint, typecheck, test, build, format check, migration check, anything — is there a counterpart in \`.claude/qa\`? Put each one with no counterpart in \`ciGaps\`, naming the workflow file and the command. Return \`[]\` if the gate covers CI or the repo has no CI config.
12. Extract the Definition of Done from the plan below: a **numbered list of acceptance criteria**, each a testable statement that must be observably true when this run is finished. Every later phase is measured against this list.

## The gate file

If \`<workRoot>/.claude/qa\` **already exists**, do NOT overwrite it — someone tuned it and this run does not know what they knew. Validate it: every command it names must still exist in the repo. Report \`qaFileAction: "validated"\`. You may change it in exactly two ways — repair a line referencing a command that no longer exists, and append a check the repo demonstrably runs that the gate is missing. Either way report \`"repaired"\` and say exactly what you changed in \`warning\`.

Otherwise write it. This one file is what "green" means for the entire run, so it must be **impossible to pass while something is failing** and must **run every check even after one fails**, so a single run surfaces every problem instead of just the first. Adapt this shape to the repo's real commands:

\`\`\`bash
#!/usr/bin/env bash
# Verification gate. Exits non-zero if ANY check fails.
set -euo pipefail
cd "$(dirname "$0")/.."
failed=()
run() {
  local name=\$1; shift
  echo "==> \${name}"
  if "\$@"; then return 0; fi
  failed+=("\${name}")
}
run "lint"      <the repo's real lint command>
run "typecheck" <the repo's real typecheck command>
run "test"      <the repo's real test command>
if ((\${#failed[@]} > 0)); then
  echo; echo "QA gate FAILED (\${#failed[@]}/3): \${failed[*]}" >&2; exit 1
fi
echo; echo "QA gate passed (3/3)."
\`\`\`

- \`set -euo pipefail\` and the \`cd\` are both load-bearing: the gate is invoked from several different working directories over a run and must behave identically from all of them.
- \`run\` takes the command as **separate arguments**, never one quoted string: \`run "test" bun run test\`, not \`run "test" "bun run test"\`.
- One \`run\` line per real check you confirmed. Correct the \`3\` in both messages to however many you actually have.
- No \`|| true\`, no \`set +e\`, nothing that discards an exit status. A check whose failure cannot fail the gate is not a check.

## The scoped gate file (optional)

Only write this if step 10 found a scoping mechanism. \`.claude/qa-scoped\` takes the changed paths as arguments and runs the SAME checks as \`.claude/qa\`, filtered to whichever package(s) those paths touch. The workflow uses it as a cheaper per-round stand-in; the full \`.claude/qa\` still runs unscoped at every land and once at the end of the run, regardless of whether this file exists. Same discipline as the full gate — \`set -euo pipefail\`, run every check even after one fails, exit non-zero if any failed:

\`\`\`bash
#!/usr/bin/env bash
# Scoped verification gate. Exits non-zero if ANY check fails for the affected package(s).
set -euo pipefail
cd "$(dirname "$0")/.."
paths=("$@")
failed=()
run() {
  local name=\$1; shift
  echo "==> \${name}"
  if "\$@"; then return 0; fi
  failed+=("\${name}")
}
run "scoped" <the repo's real scoped command, filtered on "\${paths[@]}">
if ((\${#failed[@]} > 0)); then
  echo; echo "Scoped QA gate FAILED (\${#failed[@]}/1): \${failed[*]}" >&2; exit 1
fi
echo; echo "Scoped QA gate passed."
\`\`\`

Adapt the filter syntax to the mechanism you found — \`turbo run lint typecheck test --filter=...[\${paths[@]}]\`, \`nx affected --target=lint,typecheck,test --files=\${paths[@]}\`, or \`pnpm --filter <affected packages> run <script>\` — and to the same lint/typecheck/test breakdown \`.claude/qa\` uses.

## The plan
${plan}

## Guardrails

1. Other Claude sessions may be working on this branch right now. Do not disturb the shared checkout.
2. **Never invent a command.** Include only one you confirmed by *reading* a script block or config file, not by guessing from the framework.
3. \`ciGaps\` is a **warning, not a gate**: do not block on it, do not add a command you have not confirmed runs in this repo, and do not fold a long end-to-end job into a gate that runs after every task.
4. Each criterion must be checkable by looking at the code or running something. "The API is well designed" is not a criterion; "POST /upload returns 429 once a client exceeds 10 requests per minute" is.
5. Cover the whole plan — a requirement with no criterion will not get built — and add nothing the plan does not ask for. Inventing requirements is how a small task becomes a large one.
6. **A file list is a constraint, not a criterion.** "Touch only these three files", "change nothing outside \`src/api\`", "no new dependencies" bound *where* the work may happen; they are not outcomes. Never turn one into a criterion — the decomposition step turns them into each task's \`scope\`, which is where they are actually enforced.
7. **This step must be safe to run twice.** If the worktree, the branch or \`.claude/qa\` already exists, adopt it rather than recreating it, and never reset or delete a branch — a previous invocation's commits are this run's landed work.
8. If the repo has **no commits yet**, \`git worktree add\` cannot work: return the repo root as \`workRoot\`, \`isolated: false\`, an empty \`baseRef\`, and explain in \`warning\`. Same if dependency install fails.
9. Change no source files beyond \`.claude/qa\` and, only if step 10 applies, \`.claude/qa-scoped\`.`,
  { schema: INTAKE_SCHEMA, label: 'intake', phase: 'Intake', ...MODEL },
)

if (!intake) {
  warnings.push('intake agent failed to return a result')
  log('⚠️ Intake failed to return a result — no worktree, no gate, no criteria. Nothing was changed.')
  return result({ reason: 'Intake agent failed to return a result: no worktree was prepared and no acceptance criteria were extracted.' })
}
if (!intake.testCommand) {
  warnings.push('no test command found in this repo')
  log('⚠️ No test command in this repo — a test-first loop has nothing to verify against.')
  return result({
    reason: `No test command found in this repo. A test-first loop cannot verify anything without one. Add a test script (or a \`.claude/qa\` file naming one) and re-run.${intake.warning ? `\n\nIntake warning: ${intake.warning}` : ''}`,
    workRoot: intake.workRoot || '',
    branch: intake.branch || '',
    isolated: !!intake.isolated,
    criteria: intake.criteria || [],
  })
}

const workRoot = intake.workRoot
// The branch every task lands on, and the only branch this run advances.
const runBranch = intake.branch || ''
const runBase = intake.baseRef || ''
const criteria = intake.criteria || []
const qaCommands = intake.qaCommands || []
const qaScopedWritten = !!intake.qaScopedWritten
const runDiffCmd = runBase ? `git diff ${runBase}...HEAD` : 'git status --porcelain, then read every untracked and modified file'

if (intake.warning) warnings.push(`intake: ${intake.warning}`)

// The gate being narrower than CI is how a run drives itself green and then has
// the PR rejected by CI anyway. A warning, never a gate.
const ciGaps = intake.ciGaps || []
for (const g of ciGaps) warnings.push(`.claude/qa is narrower than CI: ${g}`)

// Pinned to the front of every downstream prompt. Isolation is only real if
// every single agent honours it.
//
// A function of the directory rather than one constant, because tasks no longer
// share a working copy: each one gets its own worktree off the run branch (see
// the worktree seam in `runTask`), and an agent told to work in the run's
// worktree while its task's commits live somewhere else would review an empty
// diff and commit onto the wrong branch. Every agent inside `runTask` is handed
// the brief for ITS task's root; the run-level agents — decompose, simplify,
// the final requirements pass — get `WORK_BRIEF`, which is the run worktree.
const workBriefFor = (root, branch, taskId) => `## Where you work
All work happens in \`${root}\`. **\`cd\` there first and stay there.**${
  intake.isolated
    ? `

A dedicated git worktree${branch ? ` on branch \`${branch}\`` : ''}${
        taskId
          ? `, held by task \`${taskId}\` alone. Other tasks in this run are working in their own worktrees on their own branches at the same time, and other Claude sessions are working on the same repo`
          : `, shared by every agent in this run. Other Claude sessions are working on the same repo in parallel`
      }, so:
- Never \`cd\` to another checkout, and never touch a path outside \`${root}\`.
- Never run \`git checkout\`, \`git switch\`, \`git stash\`, \`git reset --hard\`, or \`git worktree remove\` — they reach beyond this worktree or destroy work other agents in this run depend on.
- Committing inside this worktree is fine; it lands on this worktree's own branch${taskId ? ', and the workflow lands that branch on the run branch for you when the task converges' : ''}.
- Do not start long-running servers on fixed ports. If you must bind a port, pick a high free one and kill the process when you are done.`
    : `

⚠️ This is the SHARED checkout — worktree isolation was not available${intake.warning ? ` (${intake.warning})` : ''}. Another session may be working here. Never run \`git checkout\`, \`git switch\`, \`git stash\`, or \`git reset --hard\`, and touch only files the task requires.`
}

## The verification gate
\`.claude/qa\` is this repo's gate. Run it with \`bash .claude/qa\` from \`${root}\`. It runs:
${qaCommands.map((c) => `- \`${c}\``).join('\n') || '- (empty — this is a bug, report it)'}
${
  qaScopedWritten
    ? `\nThis run also has \`.claude/qa-scoped\`, the same checks filtered to the affected package(s), which the workflow uses for faster per-round gating. It is never the final word — the full \`.claude/qa\` above always runs unscoped when a task lands and once at the end of the run.\n`
    : ''
}
**Never edit \`.claude/qa\`${qaScopedWritten ? ' or `.claude/qa-scoped`' : ''}.** The workflow hashes ${qaScopedWritten ? 'both and compares' : 'it and compares'} after every step; a change to ${qaScopedWritten ? 'either' : 'it'} is treated as a red run whatever the gate then says.`

const WORK_BRIEF = workBriefFor(workRoot, intake.branch || '', '')

log(
  intake.isolated
    ? `${intake.reused ? 'Reusing worktree' : 'Worktree'}: ${workRoot}${intake.branch ? ` (${intake.branch})` : ''} @ ${runBase.slice(0, 8)}`
    : `⚠️ NOT isolated — running in ${workRoot}`,
)
log(`.claude/qa ${intake.qaFileAction || 'ready'}: ${qaCommands.join(' | ')}`)
log(
  qaScopedWritten
    ? `.claude/qa-scoped ready (hash ${(intake.qaScopedHash || '').slice(0, 12)}) — per-round gating will use it; the full .claude/qa still runs at every land and at Integrate.`
    : 'No scoped-verification mechanism found in this repo — every gate this run runs the full .claude/qa.',
)
if (ciGaps.length) log(`⚠️ The gate is NARROWER than CI — ${ciGaps.length} CI check(s) it does not run:\n${fmtList(ciGaps)}\nA run can go green here and still be rejected by CI.`)
log(`Acceptance criteria (${criteria.length}):\n${fmtCriteria(criteria)}`)
if (intake.warning) log(`⚠️ Intake warning: ${intake.warning}`)

// ---- queue writers -------------------------------------------------------
// Every state transition is an agent hop, because the script has no shell. They
// are deliberately tiny — a `git hash-object` and a `git update-ref` with a
// schema — so they run on a cheap model at low effort.
//
// Write-before-return: nothing this script believes about the queue is anything
// but a cache of what is already in the ref store. A kill at any instant loses
// at most one in-flight agent's work, never a state transition that was
// reported as made.
const writeQueue = async (records, label) => {
  if (!records.length) return records
  const written = await agent(
    `Your job is to write ${records.length} task record(s) into this run's queue refs, exactly as given. You are a bookkeeping step: you decide nothing and you change no file.

${REF_HOWTO}

## The records to write

${records.map((r) => `### ${REF_ROOT}/task/${refSafe(r.id)}\n\`\`\`json\n${JSON.stringify(r)}\n\`\`\``).join('\n\n')}

## Workflow

1. \`cd ${workRoot}\`.
2. For each record above: \`git hash-object -w --stdin\` the JSON **byte for byte as printed**, then \`git update-ref\` the ref named above it to the resulting sha.
3. \`git cat-file -p\` each ref you wrote and return the contents as \`recordsJson\`, in the same order, along with the ref names in \`written\`.

## Guardrails

1. **Write the JSON exactly as given.** Do not add a field, drop a field, reorder, reformat, pretty-print, or correct anything you think is wrong. This script is the only author of a task record; you are the pen.
2. Never touch a ref outside \`${REF_ROOT}/\`, never delete a ref, and never create a commit, a branch or a tag.
3. If a ref already holds exactly this content, updating it again is correct and changes nothing. Do it anyway rather than deciding to skip it.
4. If a write fails, say what git said in \`error\` and still return whatever you did manage to write.`,
    { schema: QUEUE_WRITE_SCHEMA, label, phase: 'Queue', model: 'haiku', effort: 'low' },
  )
  if (!written || written.error) {
    const why = written && written.error ? written.error : 'the queue writer failed to return'
    warnings.push(`queue write (${label}) did not confirm: ${why} — the orchestrator's view of the queue may be ahead of the refs`)
    log(`⚠️ Queue write \`${label}\` did not confirm: ${why}. Continuing on this script's own copy of the records; a later reconcile will read whatever actually landed.`)
    return records
  }
  const back = parseRecords(written.recordsJson, (m) => warnings.push(`queue write (${label}): ${m}`))
  if (back.length !== records.length) {
    warnings.push(
      `queue write (${label}) asked for ${records.length} ref(s) and read back ${back.length}: ${(written.written || []).join(', ') || 'no ref names reported'}`,
    )
    // Fall back to this script's own copy. It is what was asked for, and the
    // next reconcile reads whatever actually landed — the refs decide, not this.
    return records
  }
  // Prefer what the ref store says over what this script asked for. They differ
  // only when the agent deviated, and the ref is the truth by definition.
  return back
}

// The orchestrator's copy of the queue. A cache of the refs, never a rival
// source of truth: every mutation goes through `putRecords`, which writes the
// ref first and then updates this from what the ref store read back.
const queue = new Map()
for (const r of priorTasks) queue.set(r.id, r)

const queueList = () => [...queue.values()]

const putRecords = async (recs, label) => {
  const back = await writeQueue(recs, label)
  for (const r of back) queue.set(r.id, r)
  return back
}

// A patch, not a replacement: the caller names the fields it is changing and
// every other field survives. `taskBase` is deliberately not patchable once set
// — see `runTask`.
const setTaskState = async (id, patch, label) => {
  const cur = queue.get(id)
  if (!cur) {
    warnings.push(`tried to transition unknown task \`${id}\``)
    return null
  }
  const next = newRecord({ ...cur, ...patch })
  const back = await putRecords([next], label)
  return back[0] || next
}

// The meta ref is how a fresh invocation on the same plan finds the worktree the
// last one built. It is written once, after Intake, and read by Reconcile.
const writeMeta = () =>
  agent(
    `Your job is to write one git ref holding this run's metadata, and nothing else. You are a bookkeeping step.

## Workflow

1. \`cd ${workRoot}\`.
2. Write this JSON **byte for byte** to a blob and point \`${META_REF}\` at it:
\`\`\`bash
sha=$(git hash-object -w --stdin <<'DEVGRAPH_RECORD'
${JSON.stringify({ runId, workRoot, branch: intake.branch || '', baseRef: runBase, isolated: !!intake.isolated })}
DEVGRAPH_RECORD
)
git update-ref ${META_REF} "$sha"
\`\`\`
3. \`git cat-file -p ${META_REF}\` and return the contents as the single entry in \`recordsJson\`, with the ref name in \`written\`.

## Guardrails

1. Write the JSON exactly as given — no added field, no reformatting.
2. Touch no ref but \`${META_REF}\`. Create no commit, branch or tag.
3. Overwriting an existing meta ref with the same content is correct. Do it rather than skipping it.`,
    { schema: QUEUE_WRITE_SCHEMA, label: 'queue:meta', phase: 'Intake', model: 'haiku', effort: 'low' },
  )

const metaWritten = await writeMeta()
if (!metaWritten || metaWritten.error) {
  warnings.push('the run meta ref could not be written — a fresh re-invocation will build a new worktree instead of adopting this one')
  log('⚠️ Could not write the run meta ref. The task queue is unaffected, but a fresh re-invocation on this plan will create a second worktree rather than adopting this one.')
}

// ---- Decompose -----------------------------------------------------------

phase('Decompose')

// The 200–400 line target is not arbitrary: SmartBear's study of 2,500 code
// reviews at Cisco found defect discovery collapses beyond roughly 200–400 lines
// per review — reviewers keep reading but stop finding things. A task above that
// size does not get reviewed, it gets skimmed, and every later phase inherits
// that blindness. Recorded runs bear it out: small-feature runs converged in one
// round; runs that tried to land a whole subsystem at once produced 60–106
// findings, 78 of them in a single file, and never converged.
//
// What changed from dev-loop is the SHAPE of the split, not its size. dev-loop's
// decomposer is told "ordering is the only dependency mechanism you have — use
// that instead of trying to make tasks independent", which produces a chain by
// construction: every task depends on every task before it, whether or not it
// reads a line of its code. A scheduler handed that graph finds nothing to run
// in parallel, because there is nothing. Inverting it is the single highest-
// leverage change in this workflow, and it costs one prompt.
let decomposed = null
if (!queue.size) {
  decomposed = await agent(
    `${WORK_BRIEF}

Your job is to split this plan into a dependency GRAPH of small tasks. You write no code and change no files.

## The plan
${plan}

## The acceptance criteria (the Definition of Done)
${fmtCriteria(criteria)}

## Workflow

1. Read the repo to ground the split — enough to know where the work lands, not to write it.
2. Split the plan **feature first, layer second**. Two features in the plan is two independent subtrees; splitting one feature into schema → service → UI is a chain and buys nothing.
3. Size each task at **200–400 lines of change or less**. A task above that size gets skimmed rather than reviewed.
4. Give each task \`deps\`: the ids of tasks whose **code it reads, calls or extends**. Nothing else.
5. Give each task a \`scope\`: the files or globs it expects to change.
6. Cite the criterion numbers each task makes true, and give a \`rationale\` for why it is one reviewable unit and why its \`deps\` are exactly those.

## How these tasks execute — this constrains your split

A task starts as soon as every task in its \`deps\` has finished. **\`deps\` is the only ordering that exists** — position in the array means nothing, and a task with an empty \`deps\` starts immediately. Most tasks should have an empty \`deps\`.

So an edge you add for tidiness costs real serialisation. Add one **only** when the later task genuinely cannot be written until the earlier task's output exists: it imports a symbol that task creates, extends a table that task adds, or calls a function that task defines. "It reads more naturally in this order", "they touch the same area", "this one is riskier so do it first" are **not** dependencies.

**Overlapping \`scope\` between independent tasks is allowed and expected.** Two tasks editing the same file is not a dependency — it is a conflict, and conflicts are cheaper than a chain. Do not manufacture an edge to keep file sets disjoint, and do not narrow a task's honest scope to avoid an overlap. Keep \`scope\` truthful anyway: it routes findings and it derives the dependency edges of tasks created later in the run.

Each task gets its own test-generation → implement → adversarial-review cycle, which is where the cost is. That cycle **starts** by writing a test that fails right now and passes once the task lands, so every task needs a red-able behaviour delta. "Document the module", "make sure X is covered", "review Y" are not tasks here. Phrase every task as an observable change a test can pin before and after.

The one exception is a **pure-verification task**, whose entire deliverable is a test — an integration or end-to-end check over behaviour other tasks land, with no production change of its own. It must carry \`verificationOnly: true\`, because its test is expected to pass the moment it is written and the loop skips the failing-test gate for it. Every other task carries \`verificationOnly: false\`.

## Guardrails

1. **Every criterion must be covered by at least one task.** A criterion nobody claims will not get built.
2. **No task may introduce work no criterion asks for.** If you find yourself adding "and also refactor X" or "plus a config option for Y", cut it. YAGNI applies to the plan as hard as it applies to the code.
3. \`deps\` names task ids from this same list, and the graph must be **acyclic**. A cycle, or an edge naming an id that does not exist, stops the run outright — it is not repaired for you, because every available repair silently builds the wrong thing.
4. At least one task must have an empty \`deps\`, or nothing can start.
5. Never reach for \`verificationOnly\` to smuggle through a task you could not phrase as a behaviour delta — split or restate that task instead.
6. Cap: **${MAX_TASKS} tasks**. If the plan genuinely cannot be covered in ${MAX_TASKS}, produce the best ${MAX_TASKS} and say exactly what is left uncovered in \`warning\`. Never silently truncate, and never cram two unrelated units into one task to fit the cap.`,
    { schema: DECOMPOSE_SCHEMA, label: 'decompose', phase: 'Decompose', ...MODEL },
  )

  if (!decomposed || !decomposed.tasks || !decomposed.tasks.length) {
    warnings.push('decomposition agent returned no tasks')
    if (decomposed && decomposed.warning) warnings.push(`decompose: ${decomposed.warning}`)
    log('⚠️ Decomposition returned no tasks — nothing to implement. The worktree is left in place with only `.claude/qa` changed.')
    return result({
      reason: `Decomposition agent returned no tasks. The plan may be too vague to split — restate it with concrete outcomes.${
        decomposed && decomposed.warning ? `\n\nDecompose warning: ${decomposed.warning}` : ''
      }`,
      workRoot,
      branch: intake.branch || '',
      isolated: !!intake.isolated,
      criteria,
    })
  }

  if (decomposed.warning) warnings.push(`decompose: ${decomposed.warning}`)

  // Ids are normalised before anything is written, because they key the refs.
  // Doing it here and once means `deps` and the ref names cannot disagree.
  const raw = decomposed.tasks.slice(0, MAX_TASKS)
  const idMap = new Map(raw.map((t) => [String(t.id), refSafe(t.id)]))
  const seeded = raw.map((t) =>
    newRecord({
      id: idMap.get(String(t.id)),
      title: t.title,
      description: t.rationale || t.title,
      criteria: t.criteria || [],
      scope: t.scope || [],
      // An edge naming a task the cap cut is dropped here rather than failing
      // validation: the referenced task does not exist because THIS script
      // truncated the list, which is the script's own doing and not the
      // decomposer's mistake. Every other unknown edge still stops the run.
      deps: (t.deps || []).map((d) => idMap.get(String(d))).filter(Boolean),
      generation: 0,
      verificationOnly: !!t.verificationOnly,
      state: 'queued',
      source: 'decompose',
    }),
  )
  const cut = raw.some((t) => (t.deps || []).some((d) => !idMap.has(String(d))))
  if (cut) warnings.push(`at least one dependency edge named a task the ${MAX_TASKS}-task cap removed; those edges were dropped`)

  await putRecords(seeded, 'queue:seed')
} else {
  log(`Skipping decomposition — the queue already holds ${queue.size} task(s) from a previous invocation of this run.`)
}

// ---- graph validation ----------------------------------------------------
// Three checks in pure JS, before a single agent is spent on executing anything.
// They run over whatever the queue holds — a fresh decomposition, or a
// reconciled queue that also contains tasks `addTask` created mid-run — which is
// what makes check (c) do real work: a decomposed graph is reachable by
// construction, a reconciled queue is not.
const graph = validateGraph(queueList())

if (!graph.ok) {
  const detail = graph.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')
  warnings.push(`the task graph is invalid: ${graph.errors.join(' | ')}`)
  log(`⚠️ The task graph is invalid and the run stops here:\n${detail}`)
  return result({
    reason:
      `The task graph is invalid, so nothing was executed:\n${detail}\n\n` +
      `No repair was attempted. Dropping an unknown edge runs a task before the code it depends on exists; breaking a cycle on declared order picks one of two edges to violate and cannot say which; falling back to serial hides that the decomposition is incoherent. Each turns "the plan was decomposed wrong" into "the run built the wrong thing".\n\n` +
      `The queue is at \`${REF_ROOT}/\`. Fix the records with \`git update-ref\`, or delete them (\`git for-each-ref --format='%(refname)' '${REF_ROOT}/*' | xargs -n1 git update-ref -d\`) and re-invoke to decompose again.`,
    workRoot,
    branch: intake.branch || '',
    isolated: !!intake.isolated,
    criteria,
    tasks: queueList(),
  })
}

const covered = new Set()
for (const t of queueList()) for (const n of t.criteria || []) covered.add(n)
const uncovered = criteria.filter((c) => !covered.has(c.n))
if (uncovered.length) warnings.push(`criteria with no owning task: ${uncovered.map((c) => c.n).join(', ')}`)

const cp = criticalPath(queueList())
const overlap = scopeOverlapPct(queueList())

log(
  `Task graph — ${queue.size} task(s):\n` +
    graph.order
      .map((t) => `  [${t.id}]${t.verificationOnly ? ' (verification-only)' : ''} ${t.title}\n     deps: ${(t.deps || []).join(', ') || '(none — starts immediately)'} | criteria: ${(t.criteria || []).join(', ') || '—'} | scope: ${(t.scope || []).join(', ')}`)
      .join('\n'),
)
log('Graph validated: acyclic, every declared dependency resolves to a real task, every task reachable by the walk and in a state this script knows.')
// The two numbers the parallel scheduler will act on, logged now so a
// degenerate decomposition is visible immediately rather than inferred from the
// wall clock afterwards.
log(
  `Critical path: ${cp.n} of ${queue.size} task(s) — ${cp.path.join(' → ') || '—'}. ` +
    (cp.n >= queue.size && queue.size > 1
      ? '⚠️ That is every task, so this graph is a chain: the decomposition found no independent features and a graph bought nothing over a serial loop.'
      : `${queue.size - cp.n} task(s) sit off it.`),
)
log(`Scope overlap: ${overlap}% of task pairs share at least one declared scope entry. Measured, not enforced — overlap is allowed here.`)
if (decomposed && decomposed.warning) log(`⚠️ Decompose warning: ${decomposed.warning}`)
if (uncovered.length) log(`⚠️ Uncovered criteria: ${uncovered.map((c) => c.n).join(', ')}`)

// ---- run-wide state ------------------------------------------------------

const issuesFiled = []
// Findings filed because answering them is a product decision, not an
// engineering one. Surfaced at the top of the return value, never waited on.
const openQuestions = []
// Tasks `addTask` put on the queue — what the run gave itself to do that the
// decomposer never asked for.
const queuedFromFindings = []
const taskHistory = []
let trackerOk = issueTracker !== 'none'

// The gate file is the only thing standing between "the agent says green" and
// green. A canary test showed a cornered worker will reach for Edit, `sed` AND
// Write to flip an `exit 1` to `exit 0` even when explicitly forbidden, so the
// hash intake took is re-checked on every gate run.
//
// A mismatch fails the step that caused it. The baseline then moves to whatever
// is now on disk, so one tampered gate degrades one task instead of cascading
// into every task after it — and the next edit is still caught.
//
// Two baselines, not one: a scoped round's `gate.qaHash` is a hash of
// `.claude/qa-scoped`, a different file with a different hash than
// `.claude/qa`, so comparing it against the full gate's baseline would read as
// tampering on every scoped round. `gate.gateFile` says which file this verdict
// actually hashed, so the right baseline gets checked either way.
//
// Two baselines and not two per worktree, even though tasks gate in worktrees
// of their own: every task worktree is branched off the run branch, so they all
// hold the same committed `.claude/qa` and hash identically. A divergence means
// somebody edited one, which is precisely what this exists to catch. Each call
// is synchronous end to end, so concurrent tasks cannot interleave inside one.
let qaHash = intake.qaHash || ''
let qaScopedHash = intake.qaScopedHash || ''
const gateFileChanged = (gate) => {
  if (!gate || !gate.qaHash) return ''
  const isScoped = gate.gateFile === 'qa-scoped'
  const label = isScoped ? '.claude/qa-scoped' : '.claude/qa'
  const baseline = isScoped ? qaScopedHash : qaHash
  const setBaseline = (v) => (isScoped ? (qaScopedHash = v) : (qaHash = v))
  if (!baseline) {
    setBaseline(gate.qaHash)
    return ''
  }
  if (gate.qaHash === baseline) return ''
  const msg = `${label} was MODIFIED during this run (${baseline.slice(0, 12)} → ${gate.qaHash.slice(0, 12)}). The gate that just reported is not the gate this run validated, so its verdict means nothing.`
  setBaseline(gate.qaHash)
  return msg
}

// ---- addTask -------------------------------------------------------------
// This is what replaced dev-loop's find → adjudicate → carry → work-again loop.
// There is no loop here: a finding goes on the queue and competes with every
// other task, or it goes to a human. What dev-loop spent refuter agents deciding
// — is this bug real enough to gate the next round — is decided two cheaper
// ways instead. Authorship answers "is it ours", and the new task's own test
// generator answers "is it real": a queued fix-task whose bug does not exist
// reports `alreadySatisfied` on its first step and closes, which is a stricter
// filter than an agent arguing about it and costs less than a refuter.
//
// `taskDescription` is a string, or an object carrying that string plus the
// context the routing rule needs — the source task, so authorship can be decided
// against its `taskBase`, and the finding's file, so the new task's dependency
// edges can be derived from scope overlap. A bare string is the mid-run
// injection case and routes on severity and evidence alone.
//
// `t.root` is the calling task's own worktree. The authorship test is a `git
// diff` against the source task's `taskBase`, and that diff only exists where
// the task's commits are — which, now that every task has its own worktree, is
// not the run's. A router pointed at the run worktree would diff a branch that
// does not contain the change it is routing a finding about. It falls back to
// the run worktree for a bare mid-run injection, which has no task behind it.
async function addTask(taskDescription) {
  const t = typeof taskDescription === 'string' ? { description: taskDescription } : taskDescription || {}
  const root = t.root || workRoot
  const brief = t.root ? workBriefFor(t.root, t.source ? taskBranchOf(t.source.id) : '', t.source ? t.source.id : '') : WORK_BRIEF
  const description = String(t.description || t.summary || '').trim()
  if (!description) {
    warnings.push('addTask was called with no description; nothing was queued')
    return { outcome: 'drop', reason: 'no description' }
  }

  const source = t.source || null
  const sourceGen = source && typeof source.generation === 'number' ? source.generation : 0
  const gen = sourceGen + 1
  const open = queueList().filter((r) => !isTerminal(r.state))

  // The two mechanical forcings, applied here rather than left to the agent.
  // A cap an agent can talk itself out of is not a cap: if either of these were
  // prompt text, the run's termination would depend on a model declining to
  // create a task it thinks is important.
  const forced =
    gen > GEN_CAP
      ? `it would be generation ${gen}, and the cap is ${GEN_CAP}. A fix-task gets reviewed too, so its findings spawn fix-tasks; this is where that stops.`
      : queue.size >= MAX_QUEUE
        ? `the queue already holds ${queue.size} task(s), which is this run's ceiling of ${MAX_QUEUE}.`
        : ''

  const findingBlock = t.severity
    ? `## The finding\n${fmtFinding(t)}\n`
    : `## What is being proposed\n${description}\n`

  const sourceBlock = source
    ? `## The task whose review produced it
- Task: \`${source.id}\` — ${source.title}
- Generation: ${sourceGen}${source.taskBase ? `\n- \`taskBase\`: \`${source.taskBase}\` — the sha this task started from. **This is what the authorship test is decided against.**` : ''}
- Declared scope: ${(source.scope || []).join(', ') || '(none declared)'}
`
    : '## Source\nThis was proposed directly, not by a task review. There is no `taskBase` to test authorship against, so route it on severity and evidence alone.\n'

  // ---- forced to file: no path to creating a task exists in this branch ----
  if (forced) {
    log(`addTask → forced to file (${forced})`)
    const filedOnly =
      trackerOk && issueTracker !== 'none'
        ? await agent(
            `${brief}

Your job is to file ONE issue for the finding below and then stop. This run will not fix it — ${forced} You are not creating a task and there is no queue operation here.

${findingBlock}
${sourceBlock}
## Workflow

1. **Search first** — \`gh issue list --search "<distinctive terms>" --state all --limit 20\`. If an issue already covers this, do not file a duplicate: return that issue's number as \`issue\` and say so in \`reason\`.
2. \`gh issue create --title "..." --body "..."\`. Title: the one-line summary, prefixed with the file. Body: the failure scenario, the evidence label and what it means, the assertion that should hold, and — if one is stated above — the decision needed, verbatim. Lead the body with the decision if there is one; that is the actionable part.
3. Say in the body that this was found by an automated run which was **not permitted to fix it**, and why: ${forced}
4. Return \`outcome: "file"\`, the issue number in \`issue\`, and \`preExisting\` as your read of whether the failure already existed before this run started.

## Guardrails

1. Change no source file, write no git ref, and create no task. Filing is the only action available here.
2. **File and return — nothing waits for an answer.**
3. If \`gh\` is missing, unauthenticated, or there is no remote: file nothing, return \`outcome: "file"\` with an empty \`issue\`, and explain in \`error\`. Do not fail, do not retry in a loop, do not invent an issue number.`,
            { schema: ADD_TASK_SCHEMA, label: `addtask-file:${refSafe(t.file || description).slice(0, 24)}`, phase: 'Queue', effort: 'low' },
          )
        : null

    const issue = (filedOnly && filedOnly.issue) || ''
    if (filedOnly && filedOnly.error) {
      warnings.push(`addTask filing failed for ${t.file || description.slice(0, 60)}: ${filedOnly.error}`)
      if (/gh|remote|auth/i.test(filedOnly.error)) trackerOk = false
    }
    const entry = { severity: t.severity || '', file: t.file || '', summary: t.summary || description, reason: forced, question: t.humanQuestion || '', issue, task: source ? source.id : '' }
    issuesFiled.push(entry)
    if (t.needsHumanDecision) openQuestions.push(entry)
    warnings.push(`filed rather than queued (${forced}): ${t.file ? `${t.file} — ` : ''}${t.summary || description.slice(0, 100)}`)
    return { outcome: 'file', reason: forced, issue }
  }

  // Derived, not asked for. A new task that will edit a file some queued task is
  // still rewriting depends on that task; anything else races it into a conflict
  // this change has no landing protocol to resolve. The source task is always an
  // edge — the finding is about its diff, so the fix cannot precede it.
  const scopeOwners = t.file ? ownersOf(t.file, open, root) : []
  const derivedDeps = [...new Set([...(source ? [source.id] : []), ...scopeOwners])].filter((id) => {
    const r = queue.get(id)
    return r && !isTerminal(r.state)
  })

  // Deterministic, because there is no clock to make it otherwise, and stable
  // across a replay because it is a function of the queue's current contents.
  const stem = source ? `${source.id}-fix` : 'q'
  const n = queueList().filter((r) => r.id === stem || r.id.startsWith(`${stem}-`)).length + 1
  const newId = refSafe(`${stem}-${n}`)

  const routed = await agent(
    `${brief}

Your job is to route ONE finding into this run's queue. Exactly one of three things happens to it, and you perform whichever you choose before you return.

${REF_HOWTO}

${findingBlock}
${sourceBlock}
## The queue right now (${open.length} open task(s))
${fmtQueue(open)}

## The three outcomes
${DESTINATION_DEF}

## How to decide — authorship, not confidence
${AUTHORSHIP_DEF}

Two more rules sit on top of it:

- **The bar for \`file\` is higher here than in a real pull request.** A filed issue often dies; a queued task in this run actually gets done, and there is no human triaging the backlog. So anything this run can safely do, it queues. \`file\` is for work that genuinely needs a person — not work that is merely awkward.
- **\`merge\` only on a confident match.** A finding merged into an unrelated task evaporates: nobody reads it again and no test pins it. Same defect, same fix, same code — or open a new task. A false \`create\` costs one small task; a false \`merge\` silently deletes a real defect.

A finding needing a human decision goes to \`file\` whatever its authorship. ${HUMAN_DECISION_DEF}

## Workflow

1. **Decide authorship.** ${
      source && source.taskBase
        ? `\`git diff ${source.taskBase}...HEAD -- <the finding's file>\` and \`git show ${source.taskBase}:<the finding's file>\`. Does the failure scenario already hold at that sha? Report your verdict as \`preExisting\` whatever you then do with it.`
        : 'There is no base sha here, so there is no authorship test. Report `preExisting` as your best read and route on severity and evidence.'
    }
2. **Check the queue above** for a task that already covers this, or that is about to rewrite the same code.
3. **Choose one outcome** and say why in \`reason\`, naming what you checked at the base sha.
4. **Perform it:**
   - \`file\` — \`gh issue list --search "..." --state all\` first, then \`gh issue create\`. Do **not** write any git ref: a filed finding is deliberately outside this run's queue. Return the issue number in \`issue\`.
   - \`merge\` — read the target task's record with \`git cat-file -p\`, **append** this finding to its \`description\` field as a new paragraph (keep everything already there, and keep every other field byte-identical), and write the whole record back to its own ref. Return the target's id in \`mergedInto\` and the record you wrote in \`recordJson\`.
   - \`create\` — write this record to \`${REF_ROOT}/task/${newId}\`, changing only \`title\` and \`description\`:
     \`\`\`json
${JSON.stringify(
  newRecord({
    id: newId,
    title: '<one line: what lands when this is done>',
    description: '<what the worker must deliver, and the assertion that should hold>',
    criteria: t.criterion ? [t.criterion] : [],
    scope: t.file ? [relPath(t.file, root)] : [],
    deps: derivedDeps,
    generation: gen,
    verificationOnly: false,
    state: 'queued',
    source: source ? source.id : 'addTask',
  }),
)}
     \`\`\`
     \`deps\`, \`generation\`, \`id\` and \`state\` above are computed by the orchestrator — **do not change them.** Set \`verificationOnly: true\` only if the entire deliverable is a test over behaviour that is already correct ("this assertion is vacuous", "this is right but nothing gates it"); its test is then expected to pass the moment it is written. Return the record you wrote in \`recordJson\`.

## Guardrails

1. Change no source file, run no test, and fix nothing. You are routing, not working.
2. Touch no ref outside \`${REF_ROOT}/task/\`, never delete a ref, and never create a commit, branch or tag.
3. On \`create\`, write to \`${REF_ROOT}/task/${newId}\` and nowhere else, and do not alter \`id\`, \`deps\`, \`generation\`, \`state\` or \`source\`. On \`merge\`, change only the target's \`description\`.
4. Doing this twice must be safe: writing a ref sets it to a value rather than appending, so re-running this step produces the same ref. But **do not merge the same text into a description twice** — read the target first and skip the append if it is already there.
5. If \`gh\` is missing, unauthenticated, or there is no remote, a \`file\` outcome files nothing: return \`outcome: "file"\` with an empty \`issue\` and say so in \`error\`. Never fail, never retry in a loop, never invent an issue number.`,
    { schema: ADD_TASK_SCHEMA, label: `addtask:${newId}`, phase: 'Queue', ...MODEL },
  )

  if (!routed) {
    // A dead router must not lose the finding. Filing it is the outcome that
    // cannot be wrong in a way that matters: it is recorded, a human can see it,
    // and nothing in the run silently proceeds as though it were handled.
    warnings.push(`addTask router died on ${t.file || description.slice(0, 60)}; recorded as an open finding, not queued and not filed`)
    const entry = { severity: t.severity || '', file: t.file || '', summary: t.summary || description, reason: 'the routing agent died', question: t.humanQuestion || '', issue: '', task: source ? source.id : '' }
    issuesFiled.push(entry)
    openQuestions.push(entry)
    return { outcome: 'file', reason: 'the routing agent died before it decided' }
  }

  if (routed.error) warnings.push(`addTask on ${t.file || description.slice(0, 60)}: ${routed.error}`)

  if (routed.outcome === 'create' || routed.outcome === 'merge') {
    const recs = parseRecords(routed.recordJson ? [routed.recordJson] : [], (m) => warnings.push(`addTask: ${m}`))
    if (recs.length) {
      // Re-impose the fields the orchestrator owns. The prompt says not to
      // change them; this is what makes that true rather than requested — a
      // generation the router raised or an edge it removed would defeat the cap
      // and the scheduler respectively.
      const rec =
        routed.outcome === 'create'
          ? newRecord({ ...recs[0], id: newId, deps: derivedDeps, generation: gen, state: 'queued', source: source ? source.id : 'addTask' })
          : newRecord({ ...(queue.get(routed.mergedInto) || recs[0]), description: recs[0].description })
      queue.set(rec.id, rec)
      if (routed.outcome === 'create') queuedFromFindings.push({ id: rec.id, title: rec.title, generation: rec.generation, deps: rec.deps, from: source ? source.id : '', severity: t.severity || '' })
      log(`addTask → ${routed.outcome} \`${rec.id}\` (gen ${rec.generation}${rec.deps.length ? `, deps ${rec.deps.join(', ')}` : ''}) — ${routed.reason}`)
    } else {
      warnings.push(`addTask reported \`${routed.outcome}\` but returned no readable record; the queue may be ahead of this script's copy`)
      log(`⚠️ addTask reported \`${routed.outcome}\` without a readable record. A reconcile on the next invocation will pick up whatever actually landed in the refs.`)
    }
  } else {
    const entry = {
      severity: t.severity || '',
      file: t.file || '',
      summary: t.summary || description,
      reason: routed.reason || (routed.preExisting ? 'pre-existing at the task base — this run did not cause it' : 'needs a human'),
      question: t.humanQuestion || '',
      issue: routed.issue || '',
      task: source ? source.id : '',
    }
    issuesFiled.push(entry)
    if (t.needsHumanDecision) openQuestions.push(entry)
    if (!routed.issue && trackerOk && issueTracker !== 'none' && routed.error) trackerOk = false
    log(`addTask → file${routed.issue ? ` (${routed.issue})` : ' (no tracker)'} — ${routed.reason}`)
  }

  return routed
}

// ---- locks ---------------------------------------------------------------
// A workflow script has no clock: `Date.now()`, `new Date()` and `Math.random()`
// all throw. So a "try again later" lock has no interval it can justify — a
// bare retry loop is a microtask spin that starves the I/O every other task in
// flight is blocked on, and the sandbox's `setTimeout` would only turn that
// spin into a guess, since there is no way to know how long a land takes. Both
// get slower the more tasks are waiting, which is the opposite of the point.
//
// A FIFO queue of promises does the waiting instead, with identical
// first-come-first-served semantics: a waiter appends a resolver and awaits its
// promise, and the holder resolves the head on release. The handover is direct
// rather than a re-check, so there is no lost wakeup and no polling.
//
// `tryAcquire()` is the non-blocking try-acquire — true means the lock is now
// yours and you owe a `release()`. Nothing in this file drives control flow off
// the false branch, because there is nothing useful to do with it: `run()` is
// what every caller wants. It is kept because it is the honest primitive under
// `run()` and it is what makes `waiting` reportable — a task that logs "landing
// now" versus "third in the land queue" is reading it.
const makeLock = (name) => {
  let held = false
  const waiters = []

  const tryAcquire = () => {
    if (held) return false
    held = true
    return true
  }

  // Hand the lock straight to the next waiter rather than clearing `held` and
  // letting it race: between clearing and the waiter waking, a third caller's
  // `tryAcquire` would win and the queue would no longer be FIFO.
  const release = () => {
    const next = waiters.shift()
    if (next) next()
    else held = false
  }

  const acquire = async () => {
    if (tryAcquire()) return
    await new Promise((resolve) => waiters.push(resolve))
  }

  // `finally`, so a body that throws still releases. A failed land must not
  // wedge every task behind it.
  const run = async (fn) => {
    await acquire()
    try {
      return await fn()
    } finally {
      release()
    }
  }

  return { name, tryAcquire, release, acquire, run, get waiting() { return waiters.length }, get held() { return held } }
}

// One task lands at a time. This is the only serialised step in the run, and it
// is serial because it has to be: two tasks cannot both fast-forward the run
// branch onto their own head.
const landLock = makeLock('land')

// Creating a worktree is a separate lock, NOT the land lock. They contend on
// different things — `git worktree add` on the repository's own metadata, a
// land on the run branch — and sharing one would mean a task that just became
// ready cannot even start until the task ahead of it has finished a full gate
// run. That is landing blocking work, which is the exact serialisation this
// whole change exists to remove. Two locks, never nested, so there is no
// ordering between them to deadlock on.
const worktreeLock = makeLock('worktree')

// ---- a worktree per task -------------------------------------------------
// Parallel tasks cannot share a working directory. Two verification runs in one
// checkout collide on build output, coverage directories, `.next`/`dist`, and
// whatever port a test server binds — and the failures that produces look like
// product bugs, which is the expensive way to find out.
//
// Only possible when the run is isolated on a branch of its own. Without that
// there is nothing to branch a task worktree off and nothing to land onto, so
// the run degrades to the serial executor: one working copy, one task at a
// time, commits straight onto whatever is checked out.
// Deliberately NOT also testing `workRoot.includes('/.claude/worktrees/')`.
// That clause used to be here and it inferred, from a path string, a fact
// intake already reports twice — and a relative path, or any convention drift,
// turned it into a silent drop to serial execution. Three sources for one fact
// means three ways to lose it; `isolated` and `branch` are the two that are
// actually load-bearing, and both come straight from intake.
const perTaskWorktrees = !!intake.isolated && !!runBranch
const maxParallel = perTaskWorktrees ? MAX_PARALLEL : 1

// An isolated run with no branch name is a contradiction, not a configuration:
// the worktree exists and is on SOME branch, intake just failed to say which.
// This is the failure that actually happened — a whole 8-task graph ran one
// task at a time because the name never came back — and the reason it went
// unnoticed for a full run is that degrading to serial is invisible unless you
// are looking for it. Say it loudly enough to be caught while the run is young.
if (intake.isolated && !runBranch) {
  warnings.push('intake reported an isolated worktree but no branch name, so tasks could not be isolated and the whole graph ran SERIALLY')
  log(
    `🚨 Intake returned \`isolated: true\` for ${workRoot} but an empty \`branch\`. There is nothing to branch task worktrees off and nothing to land onto, so this run is SERIAL — one task at a time, regardless of \`maxParallel\`. Kill it and re-invoke: the worktree and its refs are reused, so nothing already done is lost.`,
  )
}

// Sibling of the run worktree, not a child of it: a worktree nested inside
// another worktree's working tree shows up in its `git status`, and a dirty
// status is what the cleanup guard refuses to remove over.
const taskRootOf = (id) => `${workRoot}-tasks/${refSafe(id)}`
// `<runBranch>-task-<id>` and not `<runBranch>/task/<id>`: git stores branches
// as ref paths, so it cannot have both `run/dev-graph-x` and a directory named
// `run/dev-graph-x/`, and creating the second fails outright.
const taskBranchOf = (id) => `${runBranch}-task-${refSafe(id)}`

const prepareTaskWorktree = (task) => {
  const root = taskRootOf(task.id)
  const branch = taskBranchOf(task.id)
  return worktreeLock.run(() =>
    agent(
      `Your job is to prepare ONE private working copy for one task and report where it is. You are a setup step: you write no product code and you run no test.

## Workflow

1. \`cd ${workRoot}\` and \`git rev-parse ${runBranch}\` for the run branch's current head. That sha is what this task branches from and what it will later be rebased onto.
2. **If \`${root}\` already exists and \`git worktree list\` still shows it, adopt it.** A previous attempt at this task got this far. \`cd\` there, confirm \`git rev-parse --abbrev-ref HEAD\` is \`${branch}\`, and return that path as \`root\`, \`reused: true\`, and its \`git merge-base ${branch} ${runBranch}\` as \`baseSha\` — the sha it originally branched from, which is what the task's authorship test is decided against. Create nothing and reset nothing: the commits already there are this task's work.
3. Otherwise create it: \`git worktree add ${root} -b ${branch} ${runBranch}\` from \`${workRoot}\`. If the branch \`${branch}\` already exists but no worktree holds it, check it out into the new worktree (\`git worktree add ${root} ${branch}\`) rather than recreating it — that is the same previous attempt, one step earlier.
4. Give it the dependencies it needs to run the gate. **Prefer copying** \`node_modules\` (or the equivalent) from \`${workRoot}\` over a cold install — \`cp -R\` it, or hard-link it with \`cp -al\` if that works here — and only fall back to a full \`bun install\` / \`npm ci\` / \`pnpm install\` if the copy is not possible. Copy over the gitignored files the build genuinely needs (\`.env\`, \`.env.local\`, local config, credentials fixtures) from \`${workRoot}\` too.
5. Return the absolute path as \`root\`, the branch as \`branch\`, and the full sha from step 1 (or step 2) as \`baseSha\`.

## Guardrails

1. **This step must be safe to run twice.** Adopt what is already there rather than failing on it, and never \`git worktree remove\`, \`git branch -D\`, \`git reset\` or \`git checkout\` anything — a previous attempt's commits on \`${branch}\` are this task's landed work.
2. Touch nothing in \`${workRoot}\` except reading it: other tasks are working in their own worktrees off the same repository right now, and the run branch is not yours to move.
3. Never create a commit, and never change a file inside the new worktree beyond the dependency and config copying in step 4.
4. If the worktree cannot be prepared at all, return an empty \`root\` and say exactly what git said in \`error\`. Do not improvise a different location.`,
      { schema: TASK_WORKTREE_SCHEMA, label: `worktree:${task.id}`, phase: 'Implement', model: 'haiku', effort: 'low' },
    ),
  )
}

// ---- landing -------------------------------------------------------------
// A task asks to land the moment it converges, not in a fixed order. There is
// no ordered queue on purpose: an unlanded converged branch accumulates
// conflict surface against every task that lands ahead of it, so making a task
// wait for its turn in a predetermined order manufactures exactly the conflicts
// landing early avoids. First come, first served, and the last task to land
// absorbs the conflicts — the same asymmetry a human merge queue has.
//
// A land is three agents with the workflow's own gate between them, rather than
// one agent that reports its own success: prepare (ancestry, squash, rebase,
// conflicts), then `runGate`, then fast-forward. The gate is the workflow's
// because the agent that resolved the conflict must not be the one that
// certifies the resolution — that is the same rule as the worker's, and a
// resolved conflict is unverified code by construction.
//
// One bounded fix pass. The bar is the brief's: green, and no regression this
// task caused. Authorship is mechanical — did the failure already exist at the
// task's `taskBase` — so the fixer is told to check rather than to introspect.
const MAX_LAND_FIXUPS = 1

// A speculative pre-rebase — task N+1 rebasing onto the result task N is
// expected to produce, so its gate verdict is already in hand when it takes the
// lock — would slot in here, between converging and requesting the lock. Not
// built: it is an optimization on a scheduler that did not exist until now.

const landTask = async (task, root, taskBase) => {
  const out = { landed: false, alreadyLanded: false, unresolvable: false, sha: '', conflicts: [], detail: '' }
  const branch = taskBranchOf(task.id)

  // ---- 1. squash, rebase, resolve -----------------------------------------
  // The already-landed check comes FIRST and is the whole resume story for a
  // land: a resume replays return values, not the filesystem, so a cache-missing
  // land agent re-executes against a branch that is already on the run branch.
  // Without the ancestry check it would try to rebase an already-landed branch
  // onto a run branch that contains it, and either produce an empty rebase or
  // resolve a conflict against its own work.
  const prep = await agent(
    `Your job is to get one task's branch ready to land on this run's branch: one commit, rebased onto the run branch head, with any conflict resolved so that **both** sides' behaviour survives.

## Where you work
\`${root}\` — task \`${task.id}\`'s own worktree, on branch \`${branch}\`. \`cd\` there first and stay there. Every other task in this run is working in its own worktree; nothing you do may reach outside this one, and you never check out or modify \`${runBranch}\` itself.

## What this task built
${task.title}
${task.description}

## Workflow

1. **Is it already landed?** \`git merge-base --is-ancestor ${branch} ${runBranch}\`. If it exits 0, every commit here is already on the run branch: a previous attempt finished this. Return \`alreadyLanded: true\`, \`ready: false\`, \`git rev-parse ${branch}\` as \`headSha\`, and **change nothing at all**. Stop here.
2. \`git rev-parse ${runBranch}\` for the run branch head, and \`git merge-base ${branch} ${runBranch}\` for where this task started. If they are the same sha, nothing landed while this task worked and the rebase in step 4 is a no-op — do it anyway.
3. **Squash to one commit.** \`git reset --soft $(git merge-base ${branch} ${runBranch})\` then commit everything as a single commit. The message is \`dev-graph ${task.id}: ${String(task.title).replace(/["\`$\\]/g, ' ').replace(/\s+/g, ' ').trim()}\`, a blank line, and then this trailer on its own last line, exactly:
   \`\`\`
   dev-graph-task: ${task.id}
   \`\`\`
   The trailer is how a re-invocation reads off the run branch what actually landed, so it must be present and it must be exact. If the branch is already a single commit carrying that trailer, this step is already done — leave it alone.
4. **Rebase onto the run branch head:** \`git rebase ${runBranch}\`. Clean rebase → report \`conflicts: []\` and go to step 6.
5. **Resolve every conflict yourself.** You have the most context on one side of it — this task wrote it. For each conflicting file read **both** sides in full, understand what each was trying to do, and write a version where both behaviours hold. \`git add\` it and \`git rebase --continue\`. List every conflicting path in \`conflicts\` and explain the resolution per file in \`resolution\`.
6. Return \`ready: true\` and \`git rev-parse HEAD\` as \`headSha\`. The workflow runs the full gate against this next; it is the thing that decides whether the resolution was right.

## Guardrails

1. **Never resolve by dropping the incoming side.** Both sides' behaviour survives or it is not a resolution. Never \`git rebase --skip\`, never \`-X ours\` or \`-X theirs\`, never \`git checkout --ours/--theirs\` to make a conflict go away, and never delete or weaken a test to clear one.
2. **If it is not obvious how both survive, do not guess.** \`git rebase --abort\`, return \`unresolvable: true\` with the conflicting paths in \`conflicts\` and both sides written out in \`resolution\`, and stop. A human picks it up from the branch, which stays exactly where it is.
3. Never \`git push\`, never force-push, never delete or move a branch, and never touch \`${runBranch}\` — the workflow fast-forwards it after the gate proves this is green, and only then.
4. Write no new feature and fix no bug here. The only code you may write is the resolution of a conflict this rebase produced.
5. **Doing this twice must be safe.** Step 1 is what makes that true: a branch already on the run branch is left untouched. A branch already squashed and already rebased needs neither done again — check before you act, and say so rather than redoing it.`,
    { schema: LAND_PREP_SCHEMA, label: `land-prep:${task.id}`, phase: 'Land', ...MODEL },
  )

  if (!prep) {
    out.detail = 'the land agent failed to return, so nothing was rebased and nothing was landed'
    return out
  }
  if (prep.alreadyLanded) {
    out.landed = true
    out.alreadyLanded = true
    out.sha = prep.headSha || ''
    out.detail = 'already an ancestor of the run branch — a previous attempt landed it'
    return out
  }
  if (prep.unresolvable) {
    out.unresolvable = true
    out.conflicts = prep.conflicts || []
    out.detail = prep.resolution || 'the rebase conflicted and both sides could not be made to survive'
    return out
  }
  if (prep.error || !prep.ready) {
    out.detail = prep.error || 'the land agent could not get the branch rebased onto the run branch'
    return out
  }
  out.conflicts = prep.conflicts || []
  if (out.conflicts.length) log(`[${task.id}] rebase resolved ${out.conflicts.length} conflict(s): ${out.conflicts.join(', ')}`)

  // ---- 2. the full gate, then one bounded fix pass -------------------------
  // Never scoped. A land gates code that has just been rebased onto other
  // tasks' work, so it is exactly the run that must see everything — a scoped
  // gate would check the package this task touched and miss the semantic clash
  // between two individually-green tasks, which is the only place that clash
  // can surface.
  let gate = await runGate(root, `land-gate:${task.id}`, 'Land')
  let fixups = 0

  while (true) {
    if (!gate) {
      out.detail = "the gate runner failed to return, so this task's rebased branch was never verified and must not move the run branch"
      return out
    }
    const tampered = gateFileChanged(gate)
    if (tampered) {
      out.detail = tampered
      return out
    }
    if (gate.error) {
      out.detail = `the gate could not be run against the rebased branch (${gate.error}), so it was never verified`
      return out
    }
    if (gate.green) break
    if (fixups >= MAX_LAND_FIXUPS) {
      out.detail = `\`.claude/qa\` is red on the rebased branch after ${MAX_LAND_FIXUPS} fix pass(es) — exit ${gate.exitCode}.\n${gate.failures || '(no capturable output)'}`
      return out
    }

    fixups++
    log(`⚠️ [${task.id}] land gate RED (exit ${gate.exitCode}) — one fix pass.`)
    const fix = await agent(
      `${workBriefFor(root, branch, task.id)}

Your job is to make the gate green on a branch that has just been rebased onto other tasks' work. Something this task did no longer holds against what landed while it was being written, and one pass is what you get.

## What this task built
${task.title}
${task.description}

## What the gate says now
The workflow ran the full \`bash .claude/qa\` from \`${root}\` after rebasing this branch onto \`${runBranch}\`, and it exited **${gate.exitCode}**:

\`\`\`
${gate.failures || '(the gate produced no capturable output — run it yourself and read what it says)'}
\`\`\`
${out.conflicts.length ? `\nThe rebase resolved conflicts in: ${out.conflicts.join(', ')}. A failure in or near one of those is the resolution being wrong, and that is the first place to look.\n` : ''}
## Workflow

1. **Decide who owns each failure, mechanically.** Does it already fail at \`${taskBase || runBranch}\`, the sha this task branched from? Read the file as it was there — \`git show ${taskBase || runBranch}:<the file>\` — and run the failing check against that sha if you need to. This is a check, not an introspection: the sha and the diff are both in front of you.
   - **It fails there too** — this task did not cause it. Do **not** fix it here. Say so in \`blocked\`, naming the check, so it can be routed as its own piece of work.
   - **It passes there** — this task caused it, directly or through the rebase. Fix it.
2. Fix the root cause of every failure you own, in production code.
3. Run the failing checks named above to confirm. The workflow runs the full gate again independently the moment you return, and that run is what decides whether this lands.
4. Commit your fix. Leave nothing uncommitted — an uncommitted fix does not land.

## Guardrails

1. **Never weaken, skip, delete or rewrite a test**, and never edit \`.claude/qa\` — it is hashed, and a change to it fails this land outright.
2. Never \`git rebase\`, \`git reset\`, \`git checkout\`, \`git push\` or anything that moves a branch. The branch is already where it needs to be; you are only changing files on it.
3. Fix the root cause, not the symptom. No \`any\` casts, no \`@ts-ignore\`, no lint-disable comments, no try/catch swallowing an error to silence a check.
4. Build only what makes these failures go away. This is not the place to finish the task, improve it, or start anything.`,
      { schema: WORKER_SCHEMA, label: `land-fix:${task.id}`, phase: 'Land', agentType: 'dev-loop-worker', ...MODEL },
    )

    if (!fix) {
      out.detail = 'the land fix agent failed to return while the rebased branch was red'
      return out
    }
    if (fix.blocked) log(`[${task.id}] land fix reports pre-existing failure(s): ${fix.blocked}`)
    gate = await runGate(root, `land-gate:${task.id}.fix${fixups}`, 'Land')
  }

  // ---- 3. fast-forward the run branch --------------------------------------
  // Through the run's own worktree rather than `git update-ref`. The run branch
  // is checked out there, and moving a ref out from under a checkout leaves its
  // working tree describing a commit it no longer points at — which the
  // Integrate phase then reads as the whole run having been deleted.
  const finish = await agent(
    `Your job is to move this run's branch forward onto one task's verified branch. One git command does the work; everything else here is the check that it is the right one.

## Where you work
\`${workRoot}\` — the run's own worktree, which has \`${runBranch}\` checked out. \`cd\` there first. You are the only agent touching it right now.

## Workflow

1. \`git status --porcelain\` in \`${workRoot}\`. If it is **not** empty, stop: report what you saw in \`error\` and leave \`fastForwarded\` false. A fast-forward into a dirty tree would overwrite whatever is sitting there.
2. \`git merge-base --is-ancestor ${branch} ${runBranch}\`. If it exits 0 the run branch already contains this task — return \`fastForwarded: true\` and \`git rev-parse ${runBranch}\` as \`runBranchSha\`, and change nothing. Re-running this step is meant to be a no-op.
3. \`git merge --ff-only ${branch}\`. It must fast-forward. If git refuses it, the run branch has moved since this task was rebased: report exactly what git said in \`error\`, leave \`fastForwarded\` false, and stop.
4. Return \`git rev-parse ${runBranch}\` as \`runBranchSha\`, read after the merge.

## Guardrails

1. **\`--ff-only\`, always.** Never create a merge commit, never \`git merge\` without it, never \`git rebase\`, never \`git reset\`, and never force anything.
2. Never \`git push\`, and never delete or move \`${branch}\` — it is the only record of this task's work until it is on the run branch.
3. Change no file's contents and create no commit of your own.
4. If step 3 is refused, that is a normal outcome to report, not a problem to solve. Do not retry it, do not merge another way, and do not touch the task branch.`,
    { schema: LAND_FINISH_SCHEMA, label: `land-ff:${task.id}`, phase: 'Land', model: 'haiku', effort: 'low' },
  )

  if (!finish || !finish.fastForwarded) {
    out.detail = (finish && finish.error) || 'the fast-forward step failed to return, so the run branch was not moved'
    return out
  }

  out.landed = true
  out.sha = finish.runBranchSha || prep.headSha || ''
  return out
}

// ---- the unit of work ----------------------------------------------------
// ONE task, start to finish, as a single async function over a single task
// record. Nothing outside it decides anything about how a task runs, and it
// touches no shared mutable state except the queue (through `addTask`, which
// writes a ref before it returns) and the two locks.
//
// That is what makes the driver below a scheduler rather than a loop with
// concurrency threaded through it: `maxParallel` of these run at once, and
// nothing in here knows or cares. The only two things it does share a working
// directory over are its own worktree, which no other task can see, and the run
// branch, which it only ever touches under the land lock.
//
// It never throws. A task that dies is a failed task and the run carries on:
// four of ten recorded dev-loop runs threw away every landed task because one
// round threw, one of them 7.5M tokens' worth.
async function runTask(task) {
  const out = { state: 'done', outcome: '', detail: '', failure: '', commit: '', taskBase: '', landedSha: '', testFiles: [], changedFiles: [], strays: [], ungated: [], raw: 0, survivors: [], dropped: [], routed: [] }

  // Filled by the worktree step below and read by everything after it. Declared
  // out here so the `catch` can still name where the wreckage is.
  let root = workRoot
  let brief = WORK_BRIEF

  const taskCriteria = criteria.filter((c) => (task.criteria || []).includes(c.n))
  const criteriaBlock = taskCriteria.length
    ? fmtCriteria(taskCriteria)
    : task.generation > 0
      ? '(this task was created from a review finding, so it pins no acceptance criterion of its own — the description above is what it must make true)'
      : '(this task declares no criteria — treat that as a decomposition bug and report it)'

  const deliverable = `## The task: ${task.title}
${task.description}

Files this task is expected to touch: ${(task.scope || []).join(', ') || '(unspecified)'}${
    (task.deps || []).length ? `\nIt depends on: ${task.deps.join(', ')} — their work has already landed in this workspace.` : ''
  }

## Acceptance criteria this task must make true
${criteriaBlock}`

  try {
    // ---- 0. A working copy of this task's own ------------------------------
    // Inside the try, so a worktree that cannot be prepared fails one task
    // rather than the run — and so a raw `agent()` rejection here (the cap, the
    // budget, a stall) lands in the same place as every other one. `parallel()`
    // converts those to `null`; a bare `agent()` call re-throws them, and this
    // is what makes that harmless.
    if (perTaskWorktrees) {
      const wt = await prepareTaskWorktree(task)
      if (!wt || !wt.root) throw new Error(`Could not prepare a worktree for this task: ${(wt && wt.error) || 'the worktree agent failed to return'}`)
      root = wt.root
      brief = workBriefFor(root, wt.branch || taskBranchOf(task.id), task.id)
      // The run branch head at the moment this task branched. Every authorship
      // verdict is decided against it, so it is written once and never moved —
      // and on a re-picked task the record's own value wins, because
      // re-deriving it from a branch that already holds this task's commits
      // would make every regression it caused look pre-existing.
      out.taskBase = task.taskBase || wt.baseSha || ''
      log(`[${task.id}] ${wt.reused ? 'adopted' : 'worktree'} ${root} on ${wt.branch || taskBranchOf(task.id)} @ ${(out.taskBase || '').slice(0, 8)}`)
    }

    // Called from every exit that has committed something, because every one of
    // them is a task whose code has to reach the run branch: a task that
    // converged, and a task whose tests passed as written (which is also what a
    // re-picked task looks like after a crash — its work is already on its
    // branch and still has to land). A task that never committed lands nothing
    // and only gives its worktree back.
    //
    // The task asks the instant it is ready. It does not wait for a turn in any
    // order — there is no order — it joins the FIFO behind whoever is landing
    // right now and goes as soon as the lock frees. An unlanded branch only
    // accumulates conflict surface, so every moment it waits makes its own land
    // harder, and a task made to wait for a predetermined slot would
    // manufacture exactly the conflicts landing early avoids.
    const sweep = async () => {
      // `removeWorktree` re-checks both facts itself — clean status, and this
      // branch really is an ancestor of the run branch — and keeps the
      // directory if either is false. Reclaimed as each task finishes rather
      // than at the end of the run, because N full checkouts plus N sets of
      // dependencies is the disk cost of running N tasks at once.
      const swept = await removeWorktree(root, { landedInto: runBranch, label: `cleanup:${task.id}`, phaseName: 'Land' })
      if (swept && swept.removed) log(`🧹 [${task.id}] worktree removed; the work is on ${runBranch}.`)
      else if (swept) warnings.push(`${task.id}: its worktree was kept at ${root} (${swept.keptBecause || swept.error || 'no reason given'})`)
    }

    const land = async (committed = true) => {
      // No worktree of its own means no branch of its own: the task committed
      // straight onto whatever is checked out and there is nothing to land.
      if (!perTaskWorktrees) return
      if (!committed) {
        await sweep()
        return
      }

      phase('Land')
      // `tryAcquire` is the non-blocking form: true means the lock was free and
      // is now this task's, and it owes a `release`. False means somebody is
      // landing, so it queues — and `run` is what does the queueing, so calling
      // it here would deadlock behind the lock this branch already holds.
      const clear = landLock.tryAcquire()
      log(
        clear
          ? `[${task.id}] ready to land — the lock was free, landing now.`
          : `[${task.id}] ready to land — ${landLock.waiting + 1} ahead of it in the land queue. Waiting on the queue, not polling: there is no clock here to poll against.`,
      )

      let landed
      try {
        landed = clear ? await landTask(task, root, out.taskBase) : await landLock.run(() => landTask(task, root, out.taskBase))
      } finally {
        if (clear) landLock.release()
      }

      if (!landed.landed) {
        // The branch stays exactly where it is, on disk, with its worktree. A
        // human picks it up from there — which is the whole reason nothing here
        // force-pushes, deletes a branch, or resolves a conflict by discarding
        // one side to make it go away.
        const why = landed.unresolvable
          ? `The rebase onto \`${runBranch}\` conflicted in ${(landed.conflicts || []).join(', ') || '(unnamed files)'} and both sides could not be made to survive, so it was aborted. ${landed.detail}`
          : landed.detail
        await addTask({
          severity: 'P1',
          file: (landed.conflicts || [])[0] || '',
          summary: `task ${task.id} is green on its own branch but could not land on ${runBranch}`,
          description: `Task \`${task.id}\` (${task.title}) passed its own gate on branch \`${taskBranchOf(task.id)}\` but could not be landed on \`${runBranch}\`.\n\n${why}\n\nThe branch and its worktree at \`${root}\` are untouched — nothing was force-pushed, no branch was deleted and no side of the conflict was discarded.`,
          failureScenario: why,
          evidence: 'reproduced',
          proposedTest: `Task ${task.id}'s branch rebases onto ${runBranch} and the full \`.claude/qa\` is green.`,
          needsHumanDecision: true,
          humanQuestion: `Task \`${task.id}\` is green on \`${taskBranchOf(task.id)}\` but will not land on \`${runBranch}\`. ${why}\n\nSomebody has to decide how the two changes coexist — that is a design call, not a merge. The branch is at \`${root}\` with every commit intact.`,
          source: { ...task, taskBase: out.taskBase },
          root,
        })
        throw new Error(`Green on its own branch but could not land on ${runBranch}. ${why}`)
      }

      out.landedSha = landed.sha
      out.detail = out.detail || (landed.alreadyLanded ? 'already on the run branch when the land ran' : '')
      log(`[${task.id}] ${landed.alreadyLanded ? 'was already on' : 'landed on'} ${runBranch} @ ${(landed.sha || '').slice(0, 8)}.`)
      await sweep()
    }

    // ---- 1. Generate Tests -----------------------------------------------
    phase('Generate Tests')

    const testgen = await agent(
      `${brief}

Your job is to write the failing tests for this task. Follow the **tdd** skill — you are writing the Red. Tests only: you write **no production code**.

${deliverable}
${
        task.verificationOnly
          ? `
**This task is verification-only.** Its whole deliverable is the test: the behaviour it checks was landed by other tasks, so there is no production change here to drive. A batch that **passes** is the expected outcome — write the honest test, run it, and report \`alreadySatisfied\`. Report \`red\` only if the test genuinely exposes a gap the other tasks left between them.
`
          : ''
      }
## Test conventions in this repo
${intake.testLayout}

Run tests with: \`${intake.testCommand}\`

## Workflow

1. Before touching anything, run \`git rev-parse HEAD\` and return it as \`baseSha\`. Reviewers diff this task against it, and it is the sha this run's authorship test is decided against.
2. Write a test for each thing above this task must make true, citing the criterion number it pins in the test name or an adjacent comment where there is one. A test that pins nothing is a test nobody will maintain.
3. Run the tests and report \`redState\` — **what you saw**, not what you hoped for.

## \`redState\`
Every value below is a legitimate outcome; only guessing is not. Unless you report \`red\`, say in \`notRedReason\` exactly what you saw and what it applies to.

- \`red\` — the normal path: they fail for the **right reason** (the behaviour is missing or wrong), not an import error, a wrong module path, or a typo. The implementer runs next.
- \`alreadySatisfied\` — an honest test **passes as written**, because the behaviour is already correct. It must still be one that would fail if the behaviour were absent; never weaken it to manufacture a red. Implement is skipped. **This is also what a re-run of an interrupted task looks like**: if the tests you were about to write are already here and already passing, that is the previous attempt's work — say so and report this rather than rewriting them.
- \`cannotBeRed\` — the work **cannot be expressed as a failing test at all**: a coverage gap, not a behaviour delta ("this assertion is vacuous", "this is correct but nothing gates it"). Recorded as ungated; the run moves on. Reporting it honestly beats inventing a test that fails for a reason nobody asked about.
- \`brokenRed\` — they fail for the **wrong** reason and you could not repair them. Repair first; this is the last resort. Before returning it, **delete the broken test files you added** so they cannot redden the gate for the rest of the run. The only value that counts as a failure, and it fails this task alone.

## Guardrails

1. **Preserve every existing test file.** Never delete, rewrite or weaken anything already there.
2. Assert on observable behaviour, not on internals the implementer is free to change.
3. Never write a test you know cannot be satisfied.
4. Scope your tests to THIS task. Other tasks have their own.`,
      { schema: TESTGEN_SCHEMA, label: `testgen:${task.id}`, phase: 'Generate Tests', ...MODEL },
    )

    if (!testgen) throw new Error('Test generation agent failed to return a result.')

    // Written once and never overwritten. The authorship test in `addTask` is
    // decided against this sha, so a task re-picked after a crash must keep the
    // sha it originally started from — re-deriving it from a HEAD that already
    // holds this task's own commits would make every regression it caused look
    // pre-existing, and every one of them would be filed instead of fixed.
    // The worktree step above already set it from the run branch head it
    // branched off, which is the same sha and is available earlier; this is the
    // fallback for a run with no per-task worktrees.
    out.taskBase = out.taskBase || task.taskBase || testgen.baseSha || runBase
    await setTaskState(task.id, { state: 'running', taskBase: out.taskBase }, `queue:start:${task.id}`)

    out.testFiles = testgen.testFiles || []
    const redState = testgen.redState || 'red'
    log(`Tests (${out.testFiles.length} file(s)) [${redState}]: ${testgen.summary}`)

    if (redState === 'brokenRed') {
      throw new Error(
        `Test generator could not produce a usable test batch: the tests fail for the wrong reason (import error, wrong path, typo) and it could not repair them.\n${
          testgen.notRedReason || 'No reason given.'
        }`,
      )
    }

    if (redState === 'cannotBeRed') {
      // A coverage gap, not a behaviour delta. Record what stays ungated so the
      // final requirements pass and the caller both see it, and move on.
      const why = testgen.notRedReason || 'no failing test can express it'
      const items = taskCriteria.length ? taskCriteria.map((c) => `criterion ${c.n}: ${c.text}`) : [task.title]
      for (const item of items) out.ungated.push({ item, why })
      warnings.push(`${task.id}: ${items.length} item(s) left ungated — no failing test could express them (${why}): ${items.join('; ')}`)
      log(`⚠️ ${task.id}: no failing test can express this task (${why}). Recorded ${items.length} item(s) as ungated and moving on.`)
      out.outcome = 'ungated'
      out.detail = why
      // Nothing was written and nothing was committed, so there is nothing to
      // land — but the worktree still has to go back.
      await land(false)
      return out
    }

    // ---- 2. Implement -----------------------------------------------------
    // The workflow runs the gate itself, right here, and the verdict lands in
    // the journal where it can be checked. This replaces a Stop hook on the
    // worker agent type that was supposed to do it: across 976 recorded subagent
    // transcripts the hook fired zero times, and had it fired it would have
    // gated the repo root rather than the run's worktree for 910 of them.
    //
    // Red is not fatal on its own — the worker gets the failures back and
    // MAX_GATE_FIXUPS attempts to clear them, which is the feedback loop the
    // hook was meant to provide. Still red after that fails this task and no
    // other.
    const skipImplement = redState === 'alreadySatisfied'
    let worker = null

    // The prompt below deliberately does NOT mandate a full `bash .claude/qa`
    // run as the worker's definition of done. The `runGate` call right after it
    // runs the gate independently either way, and sends the worker back with
    // the failures if anything is red — so a mandated full run here was a
    // second full run bought for information the fix-up loop already supplies.
    // The worker still verifies itself; it checks the tests it was actually
    // handed, which is the one thing that independent run cannot tell it in
    // advance.
    const workerPrompt = `${brief}

Your job is to make the failing tests pass by changing production code. Follow **earned-abstractions** — no helper, option, layer, or variant this task has not earned — and **codebase-design** when you place a new seam.

${deliverable}

Straying outside the files above means you are doing another task's work, or work nobody asked for.

## Workflow

1. Find the tests you must satisfy: \`git status --porcelain\` from \`${root}\` lists the test files the generator just wrote. They pin: ${testgen.summary}
2. Change production code until they pass.

## Verification — hard completion requirement

**You are done when the tests you found in step 1 pass.** Run them yourself before you return — the specific file(s), or \`${intake.testCommand}\` scoped to them, not the repo's whole test suite.

**The workflow independently runs the gate the moment you return** (\`bash .claude/qa\`, which also runs lint and typecheck):

${qaCommands.map((c) => `- \`${c}\``).join('\n')}

If anything in it is red — your tests or anything else — you are sent straight back here with the failures attached, up to ${MAX_GATE_FIXUPS} times, after which this task is recorded as failed. Returning optimistically buys you nothing but a round trip.

## Guardrails

1. Returning with any of the gate red is a **failed run, not a partial one**. So is getting it green by weakening a test, and so is editing \`.claude/qa\` — that file is hashed and a change to it fails the task outright.
2. **Never weaken, skip, delete, or rewrite a test to make it pass.** If a test is genuinely unsatisfiable or self-contradictory, stop and put it in \`blocked\` rather than working around it or returning as though you had reached green.
3. Fix the root cause, not the symptom. No \`any\` casts, no \`@ts-ignore\`, no lint-disable comments, no try/catch swallowing an error to silence a check.
4. Match the surrounding code's idiom, naming, and comment density.
5. Build only what this task asks for. Nothing extra.`

    if (skipImplement) {
      log(`${task.id}: the tests pass as written — the behaviour is already correct. Skipping Implement. ${testgen.notRedReason || ''}`)
    } else {
      phase('Implement')
      worker = await agent(workerPrompt, { schema: WORKER_SCHEMA, label: `worker:${task.id}`, phase: 'Implement', agentType: 'dev-loop-worker', ...MODEL })
      if (!worker) throw new Error('Worker agent failed to return a result.')
      if (worker.blocked) throw new Error(`Worker reported the tests as unsatisfiable: ${worker.blocked}`)
      log(`Implemented: ${worker.summary}`)
    }

    // ---- 2b. Verify green ourselves ---------------------------------------
    // Nothing below this point is meaningful if the gate is red: the finders
    // would hunt bugs in code that does not compile, and the run would report a
    // green it never saw. It runs on the `alreadySatisfied` path too — that is
    // the resume path, where a crashed task's half-finished production change is
    // on disk and its tests happen to pass, and taking the test batch's word for
    // the whole workspace is exactly the claim this step exists to refuse.
    // `scoped: true` — this is a per-round check, so it may use
    // `.claude/qa-scoped` when Intake found one. The land below and the
    // Integrate phase still run the full, unscoped gate regardless.
    phase('Implement')
    let gate = await runGate(root, `gate:${task.id}`, 'Implement', { scoped: true })
    let fixups = 0

    while (true) {
      if (!gate) {
        // The gate runner dying is not the worker's fault and not worth failing
        // a task over — but the run must not go on claiming a green it did not
        // observe, so it is recorded as unverified.
        warnings.push(`${task.id}: the gate runner failed to return — this task's green is UNVERIFIED`)
        log("⚠️ Gate runner failed to return. This task was not machine-verified — treating the worker's claim as unverified and continuing.")
        break
      }

      const tampered = gateFileChanged(gate)
      if (tampered) throw new Error(`${tampered} What the worker did: ${(worker && worker.summary) || '(no worker ran)'}`)

      // The escape hatch the worker agent is told about. A worker that wrote it
      // is declaring the work impossible, which is the blocked path — not a gate
      // failure to iterate on.
      if (gate.blocked) throw new Error(`Worker declared the work unsatisfiable via .claude/dev-graph/blocked: ${gate.blocked}`)

      if (gate.error) {
        warnings.push(`${task.id}: the gate could not be run (${gate.error}) — this task's green is UNVERIFIED`)
        log(`⚠️ The gate could not be run: ${gate.error}. This task was not machine-verified; continuing.`)
        break
      }

      if (gate.green) {
        log(fixups ? `✅ Gate green after ${fixups} fix-up attempt(s) — verified by the workflow.` : '✅ Gate green — verified by the workflow, not claimed by the worker.')
        break
      }

      if (fixups >= MAX_GATE_FIXUPS) {
        throw new Error(
          `\`.claude/qa\` is still red after the worker's own pass and ${MAX_GATE_FIXUPS} fix-up attempt(s) — exit ${gate.exitCode}.\n${
            gate.failures || '(the gate produced no capturable output)'
          }`,
        )
      }

      fixups++
      log(`⚠️ Gate RED (exit ${gate.exitCode}) — sending the worker back with the failures, fix-up ${fixups}/${MAX_GATE_FIXUPS}.`)

      const again = await agent(
        `${workerPrompt}

## ⚠️ THE GATE IS RED — this is your work and it is not finished

You already made a pass at this task and returned. The workflow then independently ran the gate (\`${gate.gateFile === 'qa-scoped' ? '.claude/qa-scoped' : '.claude/qa'}\`) from \`${root}\` and it exited **${gate.exitCode}**. Everything you changed is still on disk; keep it and fix what is broken. This is attempt ${fixups} of ${MAX_GATE_FIXUPS} — after that this task is recorded as failed.

\`\`\`
${gate.failures || '(the gate produced no capturable output — run it yourself and read what it says)'}
\`\`\`

1. Fix the **root cause** of every failure above, in production code. Every guardrail you were given still holds in full.
2. Verify against the specific failure(s) named above — rerun the failing test, lint check, or typecheck command they name, not the whole gate. The workflow runs the gate again independently either way.
3. If one of these failures is genuinely unsatisfiable rather than merely hard, say so in \`blocked\` instead of working around it.`,
        { schema: WORKER_SCHEMA, label: `worker:${task.id}.fix${fixups}`, phase: 'Implement', agentType: 'dev-loop-worker', ...MODEL },
      )

      if (!again) throw new Error(`Worker agent failed to return a result on gate fix-up ${fixups}.`)
      if (again.blocked) throw new Error(`Worker reported the tests as unsatisfiable on gate fix-up ${fixups}: ${again.blocked}`)

      worker = { summary: `${(worker && worker.summary) || '(no first pass)'}\n\nGate fix-up ${fixups}: ${again.summary}`, blocked: '' }
      log(`Fix-up ${fixups}: ${again.summary}`)

      gate = await runGate(root, `gate:${task.id}.fix${fixups}`, 'Implement', { scoped: true })
    }

    // ---- 2c. Commit --------------------------------------------------------
    // Everything downstream reads this task through `git diff <taskBase>...HEAD`.
    // Nothing in dev-loop ever committed before this step existed, so in every
    // recorded run that diff was empty and the finders reviewed the whole
    // codebase blind. It also makes resume honest: a resume replays return
    // values, never the filesystem, so uncommitted work is the one thing it
    // cannot reconstruct. It runs after the gate, so what lands is verified.
    const commit = await runCommit(root, `dev-graph ${task.id}: ${task.title}`, `commit:${task.id}`, 'Implement')

    let committed = false
    if (!commit) {
      warnings.push(`${task.id}: the commit runner failed to return — the reviewers' diff may be empty`)
      log('⚠️ Commit runner failed to return. The work is on disk but uncommitted; the finders are told to fall back to `git status`.')
    } else if (commit.error) {
      warnings.push(`${task.id}: could not commit (${commit.error}) — the reviewers' diff may be empty`)
      log(`⚠️ Could not commit: ${commit.error}. The finders are told to fall back to \`git status\`.`)
    } else {
      committed = !!commit.committed
      out.commit = commit.sha || ''
      if (commit.note) warnings.push(`${task.id} commit: ${commit.note}`)
      log(
        committed
          ? `Committed ${(commit.changedFiles || []).length} file(s) as ${(commit.sha || '').slice(0, 8)} — this is the diff the reviewers see.`
          : 'Nothing to commit — the work is already on the branch.',
      )
    }

    // ---- 2d. Scope check ---------------------------------------------------
    // `scope` was prose in a prompt nobody checked, and it produced real
    // infrastructure sprawl. A file outside it is a finding against THIS task,
    // so it goes through `addTask` with everything else — which is also what
    // lets the router file it when it is only a lockfile.
    //
    // Overlap between tasks is allowed here, so this checks only that a task
    // stayed inside its OWN declared scope. It says nothing about whether
    // another task claims the same file.
    out.changedFiles = commit && (commit.changedFiles || []).length ? commit.changedFiles : []
    if (!out.changedFiles.length) {
      warnings.push(`${task.id}: the scope check was skipped — nothing could be committed, so there is no record of which files this task touched`)
    }
    out.strays = outOfScope(out.changedFiles, task.scope, root)
    if (out.strays.length) {
      warnings.push(`${task.id}: ${out.strays.length} file(s) changed outside the task's declared scope: ${out.strays.join(', ')}`)
      log(`⚠️ ${out.strays.length} file(s) outside \`${task.id}\`'s scope (${(task.scope || []).join(', ')}): ${out.strays.join(', ')}`)
    }

    // On the `alreadySatisfied` path there is no production change to attack —
    // the diff is a test file — so the adversarial pass is skipped and the task
    // is done. Its tests are committed, which dev-loop's early break skipped.
    if (skipImplement) {
      out.outcome = 'alreadySatisfied'
      out.detail = testgen.notRedReason || testgen.summary
      // Its tests ARE its deliverable and they are committed, so this path
      // lands like any other. It is also the resume path — a task re-picked
      // after a crash finds its own work already on its branch and arrives
      // here — and that work reaching the run branch is the entire point of
      // re-picking it. Not conditioned on `committed`: on the resume path
      // nothing NEW is committed, and the already-landed check is what decides
      // whether there is anything to move. A branch with no commits of its own
      // is an ancestor of the run branch by construction, so it reports as
      // already landed and the land is a no-op.
      await land()
      return out
    }

    // ---- 3. Find -----------------------------------------------------------
    phase('Find')

    const taskDiffCmd = out.taskBase ? `git diff ${out.taskBase}...HEAD` : runDiffCmd
    const openNow = queueList().filter((r) => !isTerminal(r.state) && r.id !== task.id)

    const swept = await parallel(
      LENSES.map((lens) => () =>
        agent(
          `${brief}

Your job is to hunt for **what the tests forgot** in the change below, through one lens, adversarially. You are **read-only**.

## What was just built
${deliverable}

## Your lens — apply only this one
${lens.brief}

## Workflow

1. \`${taskDiffCmd}\` and read every changed file. Read them, do not skim them.${
            committed
              ? ''
              : ` ⚠️ This task could **not** be committed, so that diff may come back empty. If it does, fall back to \`git status --porcelain\` from \`${root}\` and read every modified and untracked file it lists — that is the change you are here to attack. Do not review the rest of the codebase instead.`
          }
2. Read the existing tests. They define what is already guarded, and you must **not** re-report anything a test already covers — the gap around them is your entire job.
3. Attack every file in the diff through your lens with a **specific input or state in mind**, not a general worry.
4. For each attack, either report a finding with its concrete failure scenario, **or** record in \`heldUp\` that it held and why.

## Severity — impact only, never likelihood

How *likely* it is lives in \`evidence\`; folding the two together is how an imagined failure with a large blast radius ends up rated P0. ${SEVERITY_DEF}

Hold a P2 to exactly the same standard as a P1: a concrete failure scenario, or you drop it. Style, naming, structure and duplication are **not** P2s — they are not defects at all, and the refactor pass at the end of the run owns them. An acceptance criterion that is not met takes the severity of what its absence does, not an automatic P0.

## Evidence — where your failure scenario came from

Every finding declares one. Nothing verifies it — it is your own account, and it is what routes the finding:

${EVIDENCE_DEF}

Do not reproduce everything: most of what you find is merged or dropped downstream, and reproduction is the expensive step. When you do reproduce, say what you ran. A \`predicted\` finding is not a lesser finding and not a reason to stay quiet — it is **filed for a human** rather than queued as work, so never inflate the label to get your finding fixed. On a \`predicted\` finding also set \`likely\`, \`expensive\` and \`oneWayDoor\` where you can judge them: they let a human close or accept the filed issue at a glance.

## Who decides — \`needsHumanDecision\`

Set it true, and write the decision out in \`humanQuestion\`, when fixing this needs a judgement the acceptance criteria do not make. **Independent of who owns the file**: a bug in this task's own files can still need a product decision. ${HUMAN_DECISION_DEF}

\`humanQuestion\` states **the decision, the options, and what each one costs** — not "what should we do about X". Nothing waits on the answer: it is filed as an issue and the run carries on.

## Already on this run's queue — do not re-report
${fmtQueue(openNow)}
${issuesFiled.length ? `\nAlready filed as issues:\n${fmtList(issuesFiled.map((d) => `${d.file}: ${d.summary}${d.issue ? ` (${d.issue})` : ''}`))}\n` : ''}
Repeating one of these buys nothing — it is already going to be worked or already filed. **But**: an *incomplete* fix to one IS a finding, and a *new* defect introduced in the same code while fixing one IS a finding. Say explicitly which queued item yours sits next to and why it is not the same defect.

## Guardrails

1. Never edit a file.
2. Every finding carries a **concrete failure scenario** — specific inputs or state → the wrong output. If you cannot state one, drop the finding. No speculative nits. Shape every finding as the assertion that *should* hold.
3. Four shapes are dropped on sight downstream, so do not spend attention on them: an input **no call site in this repo produces** (if you cannot name the caller that passes it, it is not a finding); **style, naming, structure, duplication or preference** (the refactor pass owns those); **this run's own scaffolding** (the test file written minutes ago, turbo/CI wiring, the loop's own bookkeeping — attack the product); and **already true** (the criterion you claim is unmet is in fact met — check before you claim).
4. Be ambitious: a few high-conviction findings beat a flood of nits.
5. An empty \`findings\` array is a legitimate and useful result — but only when \`heldUp\` names what you actually attacked. Returning nothing found with an empty \`heldUp\` is a failed review, and so is "looks good" without genuinely trying to break something.`,
          { schema: FIND_SCHEMA, phase: 'Find', label: `find:${lens.key}.${task.id}`, ...MODEL },
        ),
      ),
    )

    // "A review that finds nothing and holds nothing up is a failed review" is
    // already in the lens prompt, and trusting a reviewer to enforce a rule
    // about its own diligence is how a silent no-op review counts as a clean
    // one. Check it here instead.
    const reviewFailures = []
    for (let li = 0; li < LENSES.length; li++) {
      const r = swept[li]
      if (!r) {
        reviewFailures.push(`${LENSES[li].key} (the agent died without returning)`)
        continue
      }
      const held = String(r.heldUp || '').trim()
      if (!(r.findings || []).length && (!held || /^(none|n\/?a|nothing|nil|-{1,2}|\.)\.?$/i.test(held))) {
        reviewFailures.push(`${LENSES[li].key} (found nothing and named nothing it attacked)`)
      }
    }
    if (reviewFailures.length) {
      warnings.push(`${task.id}: ${reviewFailures.length} of ${LENSES.length} lens(es) returned a failed review — ${reviewFailures.join('; ')}`)
      log(`⚠️ Failed review: ${reviewFailures.join('; ')}. Nothing found by these lenses counts as evidence that anything is clean.`)
    }
    out.reviewFailures = reviewFailures

    const raw = swept.filter(Boolean).flatMap((r) => r.findings || [])

    // A file outside the task's declared scope joins the raw findings rather
    // than being reported separately, so it is deduped and routed with
    // everything else — and so the router can drop it as `runScaffolding` when
    // it is only a lockfile the dependency install touched. It needs a human
    // because the two fixes — widen the scope, or revert the file — are a
    // judgement no acceptance criterion makes.
    for (const p of out.strays) {
      raw.push({
        severity: 'P2',
        file: p,
        summary: `\`${p}\` was changed by task ${task.id}, which does not declare it`,
        failureScenario: `The workflow read this task's own commit and found \`${p}\` in it. Task ${task.id} declares its scope as ${(task.scope || []).join(', ') || '(nothing)'}, so this change is either another task's work landing early, work nobody asked for, or a file the task genuinely needs and whose scope was written too tight.`,
        evidence: 'reproduced',
        proposedTest: `Task ${task.id} changes only the files in its declared scope (test files aside).`,
        needsHumanDecision: true,
        humanQuestion: `\`${p}\` is outside task ${task.id}'s declared scope (${(task.scope || []).join(', ') || 'none declared'}). Either the scope is wrong and should include it, or the change does not belong to this task and should be reverted. Keeping it silently is how a run scoped to three files ends up rewriting the build.`,
      })
    }
    out.raw = raw.length
    log(`${raw.length} raw finding(s) from ${LENSES.length} lenses.`)

    // ---- 4. Dedupe ---------------------------------------------------------
    // The cost saver, and now also the gatekeeper on how many `addTask` hops a
    // task buys. Two lenses reading one diff describe the same defect in
    // different words, and each survivor costs a routing agent.
    //
    // Every drop reason is drawn from a recorded run:
    //   noReachableCaller — six findings were exactly this; each bought a full
    //     adjudication agent and all six were killed.
    //   runScaffolding    — produced real infrastructure sprawl.
    //   alreadyTracked    — one drop read an OPEN tracker issue as proof the bug
    //     was handled when it was not, and the finding disappeared. Hence the
    //     demand that `detail` name the fix in the code, not the issue.
    // The cluster threshold has the same provenance: one run produced 78 of its
    // 106 findings in a single file, another 52 of 60.
    let survivors = []
    let dropped = []

    if (raw.length) {
      phase('Queue')
      const deduped = await agent(
        `${brief}

Your job is to shrink this task's raw findings to the ones worth routing into the run's queue. You are **read-only**: read-only git and \`gh\` commands, and you edit nothing.

## This task's raw findings (${raw.length})
${raw
          .map(
            (f, i) =>
              `[${i + 1}] (${f.severity} · ${f.evidence || 'evidence unstated'}${fmtFlags(f)}) ${f.file}${f.line ? `:${f.line}` : ''} — ${f.summary}\n    Failure: ${f.failureScenario}\n    Should hold: ${f.proposedTest}${
                f.criterion ? `\n    Criterion: ${f.criterion}` : ''
              }${f.needsHumanDecision ? `\n    Needs a human decision: ${f.humanQuestion || '(the finder set the flag but stated no question — write one)'}` : ''}`,
          )
          .join('\n\n')}

## The run's queue right now
${fmtQueue(openNow)}

## Already filed as issues
${fmtList(issuesFiled.map((d) => `${d.file}: ${d.summary}${d.issue ? ` (${d.issue})` : ''}`))}

**This task: \`${task.id}\`** — scope: ${(task.scope || []).join(', ') || '(none declared)'}

## Workflow

1. **Collapse semantic duplicates.** The two lenses read the same diff, so they describe the same defect in different words. Judge by **the underlying defect**, not the phrasing — same root cause and same fix means one finding. Keep the clearest statement, record what you folded in under \`mergedFrom\`, and merge severity **upward** but \`evidence\` **downward**: a \`predicted\` finding merged with a \`traced-to-caller\` one keeps \`predicted\` unless the traced call site really does produce the merged scenario.

2. **Drop anything a queued task above already covers** (\`alreadyQueued\`), naming which task in \`detail\`. That task will be worked; re-routing the same defect just creates a second task for one bug.

3. **Drop anything already tracked as an issue — and only if the fix is actually in the code.** Query the tracker (\`gh issue list --search "<distinctive terms>" --state all --limit 20\`) and check the file path too. A matching issue only proves somebody once wrote the bug down. Before dropping on \`alreadyTracked\`, find the fix in the code and put **why it is present** in \`detail\`: the commit or PR that closed the issue and what it changed, or the guard, branch or test now in the file that makes the reported failure impossible. "Issue #412 covers this" is not a reason; "#412 was closed by 9f2c1a, which added the null check at auth.ts:88" is. If you cannot find the fix, or the issue is open and the code still does the wrong thing, **do not drop it**.

4. **Drop what is not worth anyone's attention** — steps 2 and 3 are "we have seen this", these four are the quality bar:
  - \`noReachableCaller\` — the scenario needs an input **no call site produces**, and the finder never named one. Grep for the callers and look. **Cheap and confident to check — do check it.**
  - \`alreadyTrue\` — the criterion it claims is unmet is in fact met, or the guard it says is missing is right there. Read the code and see. **Also cheap and confident — do check it.**
  - \`notADefect\` — style, naming, structure, duplication, preference. The refactor pass at the end of the run owns those.
  - \`runScaffolding\` — it targets **this run's own machinery** rather than the product: the test file the generator wrote minutes ago, turbo/CI wiring, build config this run touched only to make itself work.

5. **Cluster.** **${CLUSTER_THRESHOLD} or more** surviving findings in the **same file** are one under-designed module re-reported from every angle, not ${CLUSTER_THRESHOLD} independent defects. Collapse them into a **single design finding** against that module: name the deeper seam that is missing or wrong, let the symptoms be the evidence in \`mergedFrom\`, and set \`isCluster: true\`.

## Guardrails

1. **The bar for dropping is asymmetric — read this twice.** A false *keep* costs one routing agent. A false *drop* **silently deletes a real defect**. Worse, a tracked issue is a permanent skip signal, so a finding you wrongly match to an unrelated issue blinds every future run to that code — forever, with no error and no trace.
2. Drop only on a confident match, or a confident rubric hit you actually verified in the code. Same defect, same root cause, same file — not "sounds similar", not "same area of the code"; no caller you looked for and could not find, not "probably unreachable". When unsure, keep it: the routing step downstream files what this run should not do, and that costs nothing and loses nothing.
3. A finding that says "this assertion is vacuous" or "this behaviour is correct but nothing gates it" is **never** a drop. It is a real finding, and the routing step turns it into a task whose whole deliverable is a test.
4. Do **not** decide what happens to a survivor. You are not choosing between fixing, filing and merging — a separate step decides that against this task's base sha, which is information you do not have. Your job ends at "is this one real, distinct finding".
5. Record **every** drop in \`dropped\` with its reason. A silent cap reads as "we found nothing" when it isn't, and that is exactly how a real bug ships.
6. **Degrade quietly** on the tracker arm: no git remote, no \`gh\` binary, or \`gh\` not authenticated → skip it entirely, set \`trackerAvailable: false\`, say so in \`warning\`, and carry on. Never fail, never retry in a loop, never treat a tracker outage as a finding.`,
        { schema: DEDUPE_SCHEMA, label: `dedupe:${task.id}`, phase: 'Queue', effort: 'low' },
      )

      if (deduped) {
        survivors = deduped.survivors || []
        dropped = deduped.dropped || []
        if (deduped.warning) {
          warnings.push(`dedupe on ${task.id}: ${deduped.warning}`)
          log(`⚠️ Dedupe warning: ${deduped.warning}`)
        }
        if (deduped.trackerAvailable === false && trackerOk) {
          trackerOk = false
          warnings.push('issue tracker unavailable — issue filing disabled for the rest of the run')
          log('⚠️ Issue tracker unavailable — filing disabled for the rest of the run.')
        }
        log(`Dedupe: ${raw.length} raw → ${survivors.length} survivor(s), ${dropped.length} dropped (${dropped.map((d) => d.reason).join(', ') || '—'}).`)
      } else {
        // Dedupe dying must not silently discard a task's findings. They go
        // through untriaged; the routing step is where the real decision is
        // made anyway, and it is per-finding.
        survivors = raw
        warnings.push(`dedupe agent failed on ${task.id}; all ${raw.length} raw findings routed untriaged`)
        log(`⚠️ Dedupe agent failed — routing ${raw.length} raw finding(s) untriaged.`)
      }
    } else {
      log('No raw findings.')
    }

    out.survivors = survivors.map((f) => ({ severity: f.severity, file: f.file, summary: f.summary, evidence: f.evidence || '' }))
    out.dropped = dropped.map((d) => ({ file: d.file, summary: d.summary, reason: d.reason, detail: d.detail, issue: d.issue || '' }))

    // ---- 5. Route through the queue ----------------------------------------
    // Every survivor goes through `addTask`. Serially and in severity order: the
    // router is handed the queue as it stands, so routing a P0 before a P2 means
    // the P2 can be merged into the task the P0 just created rather than the
    // other way round. Running these concurrently would hand two routers the
    // same stale queue and produce two tasks for one defect.
    if (survivors.length) {
      phase('Queue')
      const ordered = [...survivors].sort((x, y) => (SEV_RANK[x.severity] ?? 3) - (SEV_RANK[y.severity] ?? 3))
      for (const f of ordered) {
        const r = await addTask({
          ...f,
          description: `${f.summary}\n\nFailure scenario: ${f.failureScenario}\n\nThe assertion that should hold: ${f.proposedTest}${
            (f.mergedFrom || []).length ? `\n\nSymptoms folded into this: ${(f.mergedFrom || []).join('; ')}` : ''
          }`,
          source: { ...task, taskBase: out.taskBase },
          root,
        })
        out.routed.push({ file: f.file, summary: f.summary, severity: f.severity, outcome: (r && r.outcome) || 'unknown' })
      }
      log(
        `Routed ${survivors.length} finding(s): ${out.routed.filter((r) => r.outcome === 'create').length} new task(s), ` +
          `${out.routed.filter((r) => r.outcome === 'merge').length} merged, ${out.routed.filter((r) => r.outcome === 'file').length} filed.`,
      )
    }

    // ---- 6. Land ------------------------------------------------------------
    out.outcome = 'converged'
    await land()
    return out
  } catch (e) {
    // Anything the task threw — a dead agent, an unusable test batch, a worker
    // that could not satisfy its own tests, a bug in this script — stops at the
    // task boundary. Everything already landed stays landed.
    out.state = 'failed'
    out.outcome = 'failed'
    out.failure = (e && e.message) || String(e)
    warnings.push(`${task.id} failed: ${out.failure}`)
    log(`⚠️ ${task.id} failed — ${out.failure}`)
    return out
  }
}

// ---- the driver ----------------------------------------------------------
// The ONLY place that decides when a task runs, and deliberately the whole of
// that decision: `runTask` above knows nothing about ordering, readiness or
// concurrency, which is what lets this be a rolling scheduler rather than a
// loop with concurrency threaded through it.
//
// The queue grows while this runs — `addTask` appends — so readiness is
// recomputed from the queue on every pass rather than from a list fixed up
// front. A task `addTask` creates cannot introduce a cycle: its dependency edges
// are computed in JS from tasks that already exist, and no existing task ever
// gains an edge to a new one, so the graph only ever grows leaves.
//
// **Ready means every dependency has LANDED**, not that it finished. A task's
// work being done is not enough: until it is on the run branch, a dependent
// branching off that branch gets a base without it, and would then be written
// against code that is not there. `state === 'done'` IS that condition, because
// `runTask` only returns `done` after the land succeeded — see the land step.
// A task that converged but could not land comes back `failed`, and its
// dependents cascade to `blocked`, which is correct: the code they read is not
// on the branch they would start from.
//
// `skip` is the set already in flight. Without it `nextReady` would hand the
// same task out on every pass — `running` is not a terminal state, and it must
// not be, because a task left `running` by a crash has to be re-picked by the
// next invocation.
const nextReady = (skip) => {
  const all = queueList()
  const byId = new Map(all.map((r) => [r.id, r]))
  for (const t of toposort(all)) {
    if (isTerminal(t.state) || skip.has(t.id)) continue
    const deps = (t.deps || []).map((d) => byId.get(d)).filter(Boolean)
    const dead = deps.filter((d) => d.state === 'failed' || d.state === 'blocked')
    if (dead.length) return { task: t, blockedBy: dead.map((d) => d.id) }
    if (deps.every((d) => d.state === 'done')) return { task: t, blockedBy: null }
  }
  return null
}

// Bounded independently of the queue's own caps: a bug here that failed to move
// a task into a terminal state would otherwise spin forever, and a workflow
// script has no clock to notice with.
let scheduled = 0
const SCHEDULE_LIMIT = MAX_QUEUE * 4

// The rolling scheduler. `parallel()` is a barrier — it awaits every thunk it
// was given — which is the wrong shape here: it would make every task wait for
// the slowest in its batch, and the whole reason this workflow exists is
// wall-clock. So this races the in-flight tasks and starts a replacement the
// instant one finishes.
//
// Racing raw `agent()` promises was the one assumption worth testing before
// building on it, and it holds. The runtime keys its resume journal on a chained
// hash computed synchronously when `agent()` is CALLED, not when it resolves, so
// awaiting out of order cannot renumber anything; and the concurrency semaphore
// lives inside `agent()` itself rather than inside `parallel()`, so bare calls
// are still capped at min(16, cores - 2) and simply queue past it.
//
// One thing `parallel()` does that a bare call does not: it converts a rejection
// into `null`. A bare `agent()` re-throws — the call cap, the token budget, a
// stalled subagent. Every `agent()` call in a task is inside `runTask`'s own
// try/catch, which turns exactly that into one failed task; the rejection
// handler on the wrapper below is the backstop for anything that is not.
const inflight = new Map()

const startTask = (task) => {
  const settled = (r) => ({ task, r })
  return runTask(task).then(settled, (e) =>
    settled({
      state: 'failed',
      outcome: 'failed',
      detail: '',
      failure: `the task threw outside its own error handling: ${(e && e.message) || String(e)}`,
      commit: '',
      taskBase: task.taskBase || '',
      landedSha: '',
      testFiles: [],
      changedFiles: [],
      strays: [],
      ungated: [],
      raw: 0,
      survivors: [],
      dropped: [],
      routed: [],
    }),
  )
}

// A finding a task routed mid-flight can create a task that depends on it, and
// speculative merging — the next task pre-rebasing onto the result the current
// one is expected to produce — would slot in right here, where a task becomes
// ready. Not built: an optimization on a scheduler that did not exist yet.
log(
  perTaskWorktrees
    ? `Scheduler: up to ${maxParallel} task(s) in flight, each in its own worktree off \`${runBranch}\`, each landing itself first-come-first-served as it converges.`
    : `⚠️ Scheduler: SERIAL. This run has no worktree of its own${runBranch ? '' : ' and no branch of its own'}, so tasks cannot be isolated from each other and there is nothing to land onto. One task at a time, committing straight into ${workRoot}.`,
)

while (true) {
  // Fill every free slot before waiting on anything. A blocked task costs no
  // slot — it is recorded and skipped in the same pass.
  while (inflight.size < maxParallel && scheduled < SCHEDULE_LIMIT) {
    const pick = nextReady(inflight)
    if (!pick) break

    const { task, blockedBy } = pick

    // A dependency failed, so this task cannot legitimately start: the code it
    // reads, calls or extends never reached the run branch. It is not a failure
    // of its own, which is why it gets its own state rather than being recorded
    // as failed.
    if (blockedBy) {
      await setTaskState(task.id, { state: 'blocked', outcome: 'blocked', detail: `depends on ${blockedBy.join(', ')}, which did not land` }, `queue:blocked:${task.id}`)
      warnings.push(`${task.id} was blocked: it depends on ${blockedBy.join(', ')}, which did not land`)
      log(`⚠️ [${task.id}] blocked — depends on ${blockedBy.join(', ')}, which did not land. Skipping it and anything downstream.`)
      taskHistory.push({ id: task.id, title: task.title, generation: task.generation, deps: task.deps, state: 'blocked', outcome: 'blocked', detail: `blocked by ${blockedBy.join(', ')}` })
      continue
    }

    scheduled++
    // Idempotent by design: a task already in a terminal state is never reached
    // here (`nextReady` skips it), so a re-invocation replays nothing it already
    // finished. A task left `running` by a crash IS re-picked, and converges
    // through `alreadySatisfied` rather than redoing the work.
    const done = queueList().filter((t) => t.state === 'done').length
    log(
      `══ [${task.id}] gen ${task.generation} · ${task.title} ══  (${done}/${queue.size} landed${task.deps.length ? `, after ${task.deps.join(', ')}` : ''}` +
        `${inflight.size ? `, alongside ${[...inflight.keys()].join(', ')}` : ''})`,
    )
    inflight.set(task.id, startTask(task))
  }

  if (!inflight.size) break

  // The first to finish, not the first that was started. Its slot is refilled
  // on the next pass, which is what keeps the machine busy while a slow task
  // and a slow land are both still going.
  const { task, r } = await Promise.race(inflight.values())
  inflight.delete(task.id)

  await setTaskState(
    task.id,
    { state: r.state, outcome: r.outcome, detail: r.detail || r.failure, commit: r.commit, taskBase: r.taskBase || task.taskBase },
    `queue:end:${task.id}`,
  )

  taskHistory.push({
    id: task.id,
    title: task.title,
    generation: task.generation,
    deps: task.deps || [],
    criteria: task.criteria || [],
    scope: task.scope || [],
    verificationOnly: !!task.verificationOnly,
    source: task.source,
    state: r.state,
    outcome: r.outcome,
    detail: r.detail,
    failure: r.failure,
    taskBase: r.taskBase,
    commit: r.commit,
    landedSha: r.landedSha || '',
    testsAdded: r.testFiles,
    changedFiles: r.changedFiles,
    outOfScope: r.strays,
    ungated: r.ungated,
    reviewFailures: r.reviewFailures || [],
    rawFindings: r.raw,
    survivors: r.survivors,
    dropped: r.dropped,
    routed: r.routed,
  })

  log(
    r.state === 'failed'
      ? `⚠️ [${task.id}] failed. Continuing — everything already landed stays landed, and the queue is at ${REF_ROOT}/.`
      : `✅ [${task.id}] ${r.outcome}${r.landedSha ? ` @ ${r.landedSha.slice(0, 8)} on ${runBranch}` : r.commit ? ` @ ${r.commit.slice(0, 8)}` : ''}.`,
  )
}

if (scheduled >= SCHEDULE_LIMIT) {
  warnings.push(`the scheduler hit its ${SCHEDULE_LIMIT}-task ceiling and stopped — some queued tasks were never run`)
  log(`⚠️ Scheduler ceiling of ${SCHEDULE_LIMIT} reached. Remaining queued tasks were not run; they are still in the refs and a re-invocation picks them up.`)
}

const stalled = queueList().filter((t) => !isTerminal(t.state))
if (stalled.length && scheduled < SCHEDULE_LIMIT) {
  warnings.push(`${stalled.length} task(s) were never scheduled: ${stalled.map((t) => t.id).join(', ')}`)
  log(`⚠️ ${stalled.length} task(s) never became ready and were never scheduled: ${stalled.map((t) => `${t.id} (deps ${(t.deps || []).join(', ') || 'none'})`).join('; ')}`)
}

// ---- Integrate -----------------------------------------------------------
// Everything here operates on the WHOLE run. No individual task could see any of
// it: cross-task duplication, integration defects, criteria that fall between
// two tasks.

phase('Integrate')

const landed = taskHistory.filter((t) => t.state === 'done')
log(`── Integrate: ${landed.length} of ${taskHistory.length} task(s) landed ──`)

// Step 4 below still mandates a full `bash .claude/qa` run before this agent
// returns, even though `finalGate` runs the same full gate again right after it
// — unlike the worker, this one is deliberately NOT deduplicated. The worker's
// self-run was pure waste because the orchestrator's gate always follows it
// with a fix-up loop regardless of what the worker itself saw; the simplifier
// gets no such loop back ("Simplify never re-runs" below), so its own run is
// the ONLY chance to see red before it returns and revert per guardrail 3.
// Skip it and a refactor that broke something sails past the one agent able to
// undo it.
const simplified = await agent(
  `${WORK_BRIEF}

Your job is a refactor-only pass over the whole run's diff. Follow the **simplify** skill. **No behaviour change, no new features, no new tests.**

## What to look at
\`${runDiffCmd}\` — the **entire** diff of this run, across all ${taskHistory.length} tasks:
${taskHistory.map((t, i) => `${i + 1}. [${t.id}] ${t.title}${t.state === 'done' ? '' : ` — ${t.state}, never landed`}`).join('\n')}

## The Definition of Done — every one of these must still be true when you finish
${fmtCriteria(criteria)}

## Workflow

1. Hunt cross-task duplication. The tasks landed **blind to each other**, so this is the only place it gets caught: the same logic written twice in two tasks' files, two differently-named helpers doing one thing, an abstraction an early task introduced that later tasks routed around instead of using, and dead code an early task added that a later task made unnecessary. This run's tasks were split feature-first and were allowed to overlap in the files they touch, so expect more of this than a strictly-ordered run would produce.
2. Apply the ordinary pass too — dead comments, deep nesting, unearned abstractions (**earned-abstractions**), shallow interfaces (**codebase-design**).
3. Before you collapse a duplicate, delete something you judge dead, or move a helper, check which criterion above the code you are touching serves. The gate does not protect you here — a criterion can be satisfied by code no test pins, so a refactor can break it and still come back green.
4. Run \`bash .claude/qa\` from \`${workRoot}\` yourself before you return. A full gate run is expensive, so make considered changes you have reasoned through rather than exploratory ones you intend to check by leaving. The workflow runs it again the moment you return, so you can neither argue it passed nor skip it.
5. **Commit your refactor as a single separate commit** and return its sha, so it stays revertable wholesale.

## Guardrails

1. **Behaviour must not change.** Not "should not" — must not. If a simplification requires a behaviour change to work, do not make it. A change that breaks one of the criteria above is a behaviour change, not a simplification: do not make it, and revert it if you already have.
2. Never delete or weaken a test.
3. **If the gate goes red, revert — never fix forward.** It was green before this pass started, so red now is proof your refactor changed behaviour. Undo the offending change; do not repair it, do not re-attempt it in another shape, do not touch the test. If you cannot isolate which change broke it, revert the whole pass — a valid and expected outcome, reported as \`reverted: true\`.
4. Doing nothing is a valid outcome. Say so rather than inventing churn.`,
  { schema: SIMPLIFY_SCHEMA, label: 'simplify', phase: 'Integrate', agentType: 'dev-loop-simplifier', ...MODEL },
)

// Simplify never re-runs. Its only sanctioned response to red is to undo its own
// change, so it either lands green or lands nothing. But that is its story about
// itself, so the gate is run here too: this is the last look anybody takes at
// the finished worktree, and a red one must not be reported as a passed run.
if (simplified) {
  log(`Simplify: ${simplified.summary}${simplified.commitSha ? `\nRefactor commit ${simplified.commitSha.slice(0, 8)} — revert it wholesale if it turns out to have changed behaviour.` : ''}`)
  if (simplified.reverted) {
    warnings.push(`simplify pass reverted itself — the refactor changed behaviour: ${simplified.summary}`)
    log("⚠️ Simplify reverted itself: the gate went red, so the refactor was undone. The run's implementation is unchanged and still green.")
  }
} else {
  warnings.push('simplify agent failed; the refactor pass was skipped')
  log('⚠️ Simplify agent failed — skipping the refactor pass. The implementation is unaffected.')
}

// No `scoped` here, deliberately: this is the run's one full, unscoped
// verification of the finished branch, and it must cover everything every task
// touched, not just what the simplify pass itself changed.
const finalGate = await runGate(workRoot, 'gate:integrate', 'Integrate')
let finalGateRed = false

if (!finalGate) {
  warnings.push("the final gate run failed to return — the finished worktree's green is UNVERIFIED")
  log('⚠️ The final gate runner failed to return. The finished worktree was not machine-verified.')
} else {
  const tampered = gateFileChanged(finalGate)
  if (tampered) {
    finalGateRed = true
    warnings.push(tampered)
    log(`⚠️ ${tampered}`)
  }
  if (finalGate.error) {
    warnings.push(`the final gate could not be run (${finalGate.error}) — the finished worktree's green is UNVERIFIED`)
    log(`⚠️ The final gate could not be run: ${finalGate.error}.`)
  } else if (!finalGate.green) {
    finalGateRed = true
    warnings.push(`the finished worktree is RED — \`.claude/qa\` exits ${finalGate.exitCode} after the refactor pass: ${finalGate.failures || '(no detail captured)'}`)
    log(`⚠️ FINAL GATE RED (exit ${finalGate.exitCode}). The worktree at ${workRoot} does not pass its own checks:\n${finalGate.failures || '(no detail captured)'}`)
  } else if (!finalGateRed) {
    log('✅ Final gate green — the finished worktree passes its own checks, verified by the workflow.')
  }
}

const finalReq = await agent(
  `${WORK_BRIEF}

Your job is to check the finished run against every acceptance criterion. You are the last check in this run, and you are **read-only**.

## The Definition of Done — every criterion for the whole run
${fmtCriteria(criteria)}

## What was built
\`${runDiffCmd}\` — the entire diff, across ${taskHistory.length} tasks:
${taskHistory
    .map(
      (t, i) =>
        `${i + 1}. [${t.id}] ${t.title} (criteria ${(t.criteria || []).join(', ') || '—'})${
          t.state === 'failed'
            ? ` — FAILED, never landed: ${t.failure}`
            : t.state === 'blocked'
              ? ` — BLOCKED, never ran: ${t.detail}`
              : t.outcome === 'ungated'
                ? ' — LEFT UNGATED, no failing test could express it'
                : ''
        }`,
    )
    .join('\n')}

## Guardrails on what counts as unmet
This run queues follow-up work rather than looping on it, so some findings became tasks and some became filed issues. A criterion is met if the finished code makes it observably true — not if every finding about the code around it was resolved.

## Workflow

1. For **each** criterion, decide whether it is observably true in the finished code. Read the code; do not trust a task's summary. Anything not met goes in \`unmet\` with what is actually missing.
2. Flag criteria that are satisfied **but ungated** in \`ungatedButPresent\` — nothing would catch them regressing, because no test covers them or the file carrying them sits outside the tsconfig \`include\` / lint / test surface \`.claude/qa\` actually runs, so a typo would silently revert the behaviour with every check still green.
3. Report defects that exist **only between tasks** in \`integrationDefects\`. Every task validated its own criteria in isolation against its own slice of the diff, and tasks in this run were allowed to overlap in the files they touch, so a caller left on an old signature, two half-migrated code paths, or two tasks that each half-changed one seam is invisible from inside any one of them.

## Guardrails

1. Never edit a file.
2. An empty \`unmet\` is the expected outcome and a fine answer — but only if you actually checked each criterion.
3. Do not pad, and do not report style opinions; a dedicated refactor pass already ran.`,
  { schema: REQUIREMENTS_SCHEMA, label: 'final-requirements', phase: 'Integrate', ...MODEL },
)

const unmetCriteria = (finalReq && finalReq.unmet) || []
if (finalReq) {
  for (const s of finalReq.ungatedButPresent || []) warnings.push(`ungated criterion: ${s}`)
  for (const s of finalReq.integrationDefects || []) warnings.push(`integration defect: ${s}`)
} else {
  warnings.push('final requirements agent failed; the finished work was never checked against the full criteria list')
}

// ---- Return --------------------------------------------------------------
// Never throw — not for a blocked task, and not for one that died either.
//   incomplete  — the Definition of Done is not met (work missing, or a task
//                 failed or was blocked).
//   openQueue   — everything ran, but findings are still filed against a human.
//   passed      — criteria met, every task landed, the finished worktree green.
//   failed      — only from the early returns above, where the run never started.
//
// A red final gate cannot be a `passed` run. That is the whole point of running
// the gate here rather than trusting a hook that never fired.
const failedTasks = taskHistory.filter((t) => t.state === 'failed')
const blockedTasks = taskHistory.filter((t) => t.state === 'blocked')
const coverageGap = uncovered.length > 0 || !!(decomposed && decomposed.warning)
const status =
  unmetCriteria.length || coverageGap || failedTasks.length || blockedTasks.length || stalled.length || finalGateRed
    ? 'incomplete'
    : openQuestions.length
      ? 'openQueue'
      : 'passed'

log(
  `${status === 'passed' ? '✅' : '⚠️'} Run ${status}: ${landed.length}/${taskHistory.length} task(s) landed, ` +
    `${failedTasks.length} failed, ${blockedTasks.length} blocked, ${queuedFromFindings.length} task(s) queued from findings, ` +
    `${unmetCriteria.length} unmet criterion/criteria, ${issuesFiled.length} finding(s) filed, ${openQuestions.length} open product question(s), ${warnings.length} warning(s).`,
)

if (queuedFromFindings.length) {
  log(
    `Findings the run turned into work rather than filing:\n` +
      queuedFromFindings.map((q) => `- [${q.id}] gen ${q.generation}${q.severity ? ` ${q.severity}` : ''} from ${q.from || '—'}: ${q.title}`).join('\n'),
  )
}

// A landed task can still leave a product question open — that is the point of
// filing rather than blocking, and it is exactly what a bare `passed` hides.
if (openQuestions.length) {
  log(
    `⚠️ ${openQuestions.length} open product question(s). Each was FILED, not answered, and the run did not wait for anybody:\n` +
      openQuestions.map((q) => `- [${q.task || '—'}] ${q.file}${q.issue ? ` (${q.issue})` : ' (not filed — no tracker)'}: ${q.question || q.summary}`).join('\n'),
  )
}

// ---- Clean up the worktree ------------------------------------------------
// A worktree is a full checkout plus its dependencies — around 2 GB in a typical
// repo — and nothing ever removed one, so 25 GB of abandoned run worktrees had
// piled up, 19 GB of it in a single repo. On a clean run the directory has no
// job left: every commit the run made lives on its branch, and removing a
// worktree never touches a branch. Anything less than clean keeps it, because
// the whole reason to keep it is to go and look at what went wrong.
let worktreeRemoved = false
let branchNote = intake.isolated
  ? `The run's work is committed on branch \`${runBranch || '(unnamed)'}\`, in the worktree at ${workRoot}.`
  : `The run worked directly in ${workRoot} — there was no worktree to isolate it.`

if (status === 'passed' && intake.isolated && workRoot.includes('/.claude/worktrees/')) {
  // No `landedInto` here: this IS the run branch's worktree, so there is
  // nothing further for it to have landed on.
  const cleanup = await removeWorktree(workRoot, { label: 'cleanup-worktree', phaseName: 'Integrate' })

  if (!cleanup) {
    warnings.push(`the worktree cleanup step failed to return — ${workRoot} is still on disk`)
    log(`⚠️ Worktree cleanup failed to return. ${workRoot} is still on disk; remove it by hand with \`git worktree remove\` when you are done with it.`)
  } else if (cleanup.removed) {
    worktreeRemoved = true
    branchNote = `The run passed, so its worktree was removed. Every commit it made is on branch \`${cleanup.branch || runBranch || '(unnamed)'}\`${
      cleanup.headSha ? ` at ${cleanup.headSha.slice(0, 8)}` : ''
    } — check it out or open a PR from it. Nothing was deleted but the directory; the queue refs under \`${REF_ROOT}/\` are still there.`
    log(`🧹 Worktree removed. The work is on branch \`${cleanup.branch || runBranch}\`${cleanup.headSha ? ` @ ${cleanup.headSha.slice(0, 8)}` : ''} — the branch, its commits and the queue refs are untouched.`)
  } else {
    warnings.push(`the worktree was kept: ${cleanup.keptBecause || cleanup.error || 'no reason given'}`)
    log(`⚠️ Worktree kept at ${workRoot}: ${cleanup.keptBecause || cleanup.error || 'no reason given'}`)
  }
} else if (intake.isolated) {
  branchNote += ` It was kept because the run is \`${status}\` — read it, fix it, or remove it yourself with \`git worktree remove ${workRoot}\` once you are done. Removing it would not touch the branch or the queue refs.`
}

return result({
  status,
  reason: [
    failedTasks.length ? `${failedTasks.length} task(s) failed and never landed: ${failedTasks.map((t) => `${t.id} (${t.failure})`).join('; ')}` : '',
    blockedTasks.length ? `${blockedTasks.length} task(s) were blocked by a failed dependency: ${blockedTasks.map((t) => t.id).join(', ')}` : '',
    stalled.length ? `${stalled.length} task(s) were never scheduled: ${stalled.map((t) => t.id).join(', ')}` : '',
    finalGateRed ? 'The finished worktree does not pass `.claude/qa`. Do not open a PR from it until it is green.' : '',
    openQuestions.length && status !== 'incomplete' ? `${openQuestions.length} finding(s) were filed for a human rather than fixed by this run.` : '',
  ]
    .filter(Boolean)
    .join(' '),
  workRoot,
  branch: runBranch,
  isolated: intake.isolated,
  worktreeRemoved,
  branchNote,
  criteria,
  tasks: taskHistory,
  unmetCriteria,
  queuedFromFindings,
  issuesFiled,
  openQuestions,
})
