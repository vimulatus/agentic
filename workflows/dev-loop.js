export const meta = {
  name: 'dev-loop',
  description:
    'Decomposed test-first implementation loop in one isolated worktree: split the plan into review-sized tasks, then per task write failing tests, implement behind a green gate, hunt bugs through two lenses, dedupe/cluster them, and let only refuted-proof findings gate the next round',
  whenToUse:
    'When you have a plan/spec and want it implemented under a closed feedback loop rather than one-shot. Runs in its own git worktree so it is safe alongside other sessions on the same branch. The plan is decomposed into small ordered tasks that land serially; each task is driven green against the repo\'s own `.claude/qa` gate, then attacked by two adversarial lenses whose findings must survive independent refutation before they gate. A finding that needs a product decision, or that rests on a predicted rather than a traced failure, is filed as an issue instead of being handed to a worker — so is anything outside the run\'s scope. Filing never blocks: the run always finishes without waiting for a human. Pass args as {plan, baseRef, maxTasks, issueTracker} or as a plain string plan.',
  phases: [
    { title: 'Intake', detail: 'one worktree for the run, write/validate .claude/qa, extract acceptance criteria' },
    { title: 'Decompose', detail: 'split the plan into ordered review-sized tasks mapped to criteria' },
    { title: 'Generate Tests', detail: 'write failing tests for this task (plus regressions for carried findings)' },
    { title: 'Implement', detail: 'worker lands the task; the workflow then runs .claude/qa itself and sends red back' },
    { title: 'Find', detail: 'two read-only lenses attack the task diff' },
    { title: 'Dedupe', detail: 'collapse duplicates, drop known/tracked, cluster by file, tag scope' },
    { title: 'Adjudicate', detail: 'refuters try to kill each claim; only survivors gate' },
    { title: 'Integrate', detail: 'simplify the whole run behind its own green gate, check the finished thing against every criterion' },
  ],
}

// ---- args ----------------------------------------------------------------
// 14 of 15 recorded runs passed args as a JSON-encoded STRING. The old script
// checked `typeof args === 'string'` first, so the whole JSON blob became the
// plan text and every structured field was silently discarded. Sniff the shape
// before deciding, and log which form was detected so this can never be silent.
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
// The ref the run's worktree branches FROM. It used to be hardcoded to HEAD in
// the intake prompt while `baseRef` only ever reached the diff commands, so a
// run given a base ref silently built on the wrong commit.
const baseRefStart = baseRefOverride || 'HEAD'
const issueTracker = a.issueTracker || 'gh'
// The branch the run lands on. Left to itself the worktree gets a branch named
// after the epoch seconds its path was derived from, and every recorded run was
// renamed by hand afterwards — `run/1785829418` → `feat/1044-layer1-valuation-
// columns`. The caller can name it up front instead. The worktree PATH stays
// derived: two runs sharing a path collide, two runs sharing a branch merely
// fail to create the second worktree.
const branchName = String(a.branch || a.branchName || '').trim()
// There is no global for the session model — a workflow script cannot see what
// it is running on. So the run's model is whatever the caller declares, and
// declaring it pins every reasoning phase to it instead of inheriting a session
// that may have been downgraded mid-conversation. A run on an under-powered
// model is not a slower run, it is a quieter one: the finders stop finding and
// every phase downstream reports clean.
const declaredModel = String(a.model || '').trim().toLowerCase()

// ---- constants -----------------------------------------------------------
const MAX_OUTER = 3 // harden rounds per task; exhaustion records, it does not throw
const MAX_TASKS = a.maxTasks || 12
const MAX_SWEEPS = 1 // sweep-until-dry never went dry in any recorded run
// Times a worker is sent back with the gate's failures before the task fails.
// Not zero: a red gate is the normal end of a worker's first pass, and throwing
// the whole pass away on the first red discards work that is usually one fix
// from green. Not large: a worker that cannot clear it twice is stuck.
const MAX_GATE_FIXUPS = 2
// One refuter per claim, at a model and effort chosen by SEVERITY alone.
// Across 40 adjudicated claims only 9 ever got a second refuter; on 7 of those
// the two agreed, so the second vote was idle 78% of the time — and it was idle
// on the most expensive claims in the run. Accuracy came from the model, not
// from the quorum: unanimity, majority and a single refuter all scored 8/9 on
// the same corpus. So the money goes into the one refuter instead of a second.
const REFUTERS = {
  P0: { n: 1, model: 'opus', effort: 'high' },
  P1: { n: 1, model: 'opus', effort: 'medium' },
  P2: { n: 1, model: 'sonnet', effort: 'medium' }, // small blast radius; don't spend the session model
}
const CLUSTER_THRESHOLD = 4 // N+ findings in one file => one design finding, not N bugs
// The model floor. Everything this workflow is for — hunting what the tests
// forgot, killing a claim on evidence, judging whether a criterion is really
// met — degrades silently rather than loudly on a weak model, so a run below
// the floor is refused outright unless the caller says otherwise.
const MODEL_RANK = { haiku: 0, sonnet: 1, opus: 2 }
const MODEL_FLOOR = 'sonnet'
// Spread into an agent's opts. Empty when the caller declared no model, so the
// agent inherits the session model exactly as it always did.
const MODEL = declaredModel ? { model: declaredModel } : {}

// ---- shared vocabulary ---------------------------------------------------
// Each of these was written out in full in three or four places — a schema
// description and one or more prompts. Defined once and interpolated, so the
// copies cannot drift apart.

// Impact only. Likelihood lives in `evidence`. The old definitions folded the
// two together ("a crash on a realistic input"), which is how an imagined
// failure with a big blast radius rated P0.
const SEVERITY_DEF =
  'P0 = data loss or a security hole. P1 = user-visible wrong behaviour. P2 = a real defect with a small blast radius.'

// Provenance of a failure scenario, declared by the finder and verified by
// nobody here. It costs the finder nothing — it already did either the tracing
// or the predicting — and it is what decides whether the finding is handed to a
// worker or filed for a human.
const EVIDENCE_DEF = `- \`reproduced\` — you ran it and watched the wrong behaviour happen. Never required.
- \`traced-to-caller\` — you followed the path back to a real call site and named the input it actually passes.
- \`predicted\` — you reasoned it could happen and did neither of the above.`

// Who has to act. Not the same question as who owns the file: only `fixNow`
// buys a refuter and only `fixNow` gates.
const DESTINATION_DEF = `- \`fixNow\` — \`inScope\`, \`evidence\` is \`reproduced\` or \`traced-to-caller\`, and no human decision is needed. A worker fixes it this round. Only these buy a refuter, and only these gate.
- \`strengthenTest\` — the behaviour is correct but nothing would catch it regressing, or the assertion covering it is vacuous, or it asserts the mock rather than the code. No bug to kill, so no refuter is spent; the next round's test generator tightens the assertion. Real findings, never dropped, never gating.
- \`file\` — it needs a human: \`evidence: predicted\`, or \`needsHumanDecision\` is true whatever its scope, or it is \`unscoped\`. Filed as an issue with its evidence, flags and question attached. Filing never blocks.`

// Independent of scope. A finding inside this task's own files can still need a
// decision no acceptance criterion makes, and handing that to a worker is how a
// cosmetic bug got "fixed" by silently destroying stored data: a reproduced,
// user-visible finding (legacy content rendering an error box) went straight to
// a worker, which chose "strip the offending nodes on read". Nothing in the plan
// said what should happen to legacy content and the alternatives had materially
// different consequences.
const HUMAN_DECISION_DEF = `Any one of these is enough:
- The fix changes observable product behaviour that no acceptance criterion specifies.
- The fix needs a data migration, or touches data that is already stored.
- More than one defensible fix exists with materially different consequences, and the criteria do not pick between them.
- The fix would violate or extend an acceptance criterion.
- It lands on pre-existing behaviour that something may already depend on.`

// ---- schemas -------------------------------------------------------------

const INTAKE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['workRoot', 'isolated', 'baseRef', 'testLayout', 'testCommand', 'qaCommands', 'qaHash', 'criteria'],
  properties: {
    workRoot: {
      type: 'string',
      description: 'Absolute path every downstream agent works in for the WHOLE run: the worktree, or the repo root if isolation was impossible.',
    },
    isolated: { type: 'boolean', description: 'True if workRoot is a dedicated worktree, false if it is the shared checkout.' },
    branch: { type: 'string', description: 'Empty string if not isolated.' },
    baseRef: {
      type: 'string',
      description: 'Sha the worktree branched from; every whole-run diff is taken against it. Empty string only if the repo has no commits.',
    },
    testLayout: { type: 'string', description: 'Where tests live and what convention they follow (framework, file naming, directory).' },
    testCommand: {
      type: 'string',
      description: 'Exact command that runs the suite from workRoot, confirmed in package.json / Makefile / CI config. Empty string if the repo genuinely has none.',
    },
    // Every commit a run makes used to be labelled `dev-loop <task> round N:
    // <title>`, which matches no repo's convention and had to be reworded by
    // hand before every PR. Discovering it once, here, is the same shape of work
    // as discovering the commands.
    commitConvention: {
      type: 'string',
      description:
        "The repo's commit message convention, in one line an agent can follow — e.g. \"conventional commits, scoped, issue number in parens: (feat|fix|chore|refactor|ci): description (#ISSUE)\". Empty string if the repo has no discernible convention.",
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
      description: 'Ordered. Task i may assume every task before it has already landed in the shared worktree.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'criteria', 'scope', 'rationale', 'verificationOnly'],
        properties: {
          id: { type: 'string', description: 'Short stable slug, e.g. "t1-rate-limit-store".' },
          title: { type: 'string', description: 'One line: what lands when this task is done.' },
          criteria: { type: 'array', description: 'Criterion numbers this task makes true. Never empty.', items: { type: 'number' } },
          verificationOnly: {
            type: 'boolean',
            // The loop skips the failing-test gate for these, because their
            // tests are expected to pass the moment they are written.
            description: 'False for every ordinary task. True only for a task whose entire deliverable is a test over behaviour earlier tasks already landed, with no production change of its own.',
          },
          scope: {
            type: 'array',
            description: 'Files or globs this task may change. Used later to decide whether a finding belongs to this task, a later one, or nobody.',
            items: { type: 'string' },
          },
          rationale: { type: 'string', description: 'Why this is one reviewable unit, and why it sits at this position in the order.' },
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
    // Not printed into the worker prompt any more — the worker finds the tests
    // via `git status`. It feeds `rounds[].testsAdded` in the return value, and
    // is what the two early-exit paths report alongside the files their own
    // commit actually landed.
    testFiles: { type: 'array', items: { type: 'string' }, description: 'Test files created or extended this round.' },
    summary: { type: 'string', description: 'What behaviour the new tests pin down, and which criterion number each one pins.' },
    // Was a `confirmedRed` boolean, and a false there aborted the entire run.
    // Two of ten recorded runs died on it while being completely right: a
    // criterion that was already satisfied, and a "this assertion is vacuous"
    // finding that has no failing test by construction. Both are outcomes, not
    // failures, so they get their own state.
    redState: {
      type: 'string',
      enum: ['red', 'alreadySatisfied', 'cannotBeRed', 'brokenRed'],
      description:
        'What you actually saw when you ran the new tests. red = they fail for the RIGHT reason (missing or wrong behaviour). alreadySatisfied = an honest test passes as written because the behaviour is already correct. cannotBeRed = a coverage gap, not a behaviour delta, so no failing test can express it. brokenRed = they fail for the WRONG reason (import error, wrong path, typo) and you could not repair them — the only value that counts as a failure.',
    },
    notRedReason: {
      type: 'string',
      description: 'Empty only when redState is "red". Otherwise: what you saw, and which criterion or carried finding it applies to.',
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
      description: 'Contents of `.claude/dev-loop/blocked` if it existed, else empty. Its presence means an agent declared the work unsatisfiable.',
    },
    error: {
      type: 'string',
      description: 'Empty normally. Set only if the gate could not be run at all — no `.claude/qa`, unreadable, or the directory is missing.',
    },
  },
}

// Nothing in this workflow ever committed, and every reviewer is handed
// `git diff <base>...HEAD`. So in every recorded run that diff came back empty
// and every finder reviewed the whole codebase blind instead of the change it
// was commissioned to attack. The workflow commits each round itself, the same
// way it runs the gate: a tiny agent with a schema. It also makes pause/resume
// honest — resume memoizes return values, never the filesystem.
const COMMIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['committed', 'sha', 'changedFiles'],
  properties: {
    committed: { type: 'boolean', description: 'True if you created a commit. False if there was genuinely nothing to commit.' },
    sha: { type: 'string', description: 'Full sha of HEAD after you finished — the new commit, or the unchanged HEAD if there was nothing to commit.' },
    changedFiles: {
      type: 'array',
      // Ground truth about what this round touched.
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

const DEDUPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['survivors', 'dropped', 'trackerAvailable'],
  properties: {
    survivors: {
      type: 'array',
      description: 'The findings that should proceed to adjudication, after collapsing, dropping and clustering.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'summary', 'failureScenario', 'evidence', 'proposedTest', 'scope', 'destination', 'needsHumanDecision'],
        properties: {
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'], description: `Impact only. ${SEVERITY_DEF}` },
          file: { type: 'string' },
          line: { type: 'number' },
          summary: { type: 'string' },
          failureScenario: { type: 'string' },
          evidence: { type: 'string', enum: ['reproduced', 'traced-to-caller', 'predicted'], description: 'Carried through from the finder unchanged; if you merged findings, take the WEAKEST of the merged labels, never the strongest.' },
          likely: { type: 'boolean' },
          expensive: { type: 'boolean' },
          oneWayDoor: { type: 'boolean' },
          proposedTest: { type: 'string' },
          criterion: { type: 'number' },
          needsHumanDecision: { type: 'boolean', description: 'Carried through from the finder. Set it yourself if the finder missed it and the fix plainly needs a decision no criterion makes.' },
          humanQuestion: { type: 'string', description: 'Required when needsHumanDecision is true: the decision, the options, and what each costs.' },
          scope: {
            type: 'string',
            enum: ['inScope', 'laterTask', 'unscoped'],
            description: 'inScope = inside the CURRENT task\'s scope. laterTask = inside another task\'s declared scope. unscoped = inside no task\'s scope.',
          },
          destination: {
            type: 'string',
            enum: ['fixNow', 'strengthenTest', 'file'],
            description: `Who has to act.\n${DESTINATION_DEF}`,
          },
          laterTaskId: { type: 'string', description: 'Set only when scope is laterTask: the id of the task that owns this file.' },
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
          // The first five are all "we have seen this". The last four are the
          // quality bar — each one is a shape that actually reached a refuter
          // in a recorded run and should never have.
          reason: {
            type: 'string',
            enum: [
              'duplicateInRound',
              'alreadySeen',
              'alreadyDeferred',
              'alreadyTracked',
              'clustered',
              'noReachableCaller',
              'notADefect',
              'runScaffolding',
              'alreadyTrue',
            ],
          },
          detail: {
            type: 'string',
            description:
              'The specific match: which finding it duplicates, which seen entry, or — for `alreadyTracked` — which issue AND how you established the fix is actually in the code (the commit that closed it and what it changed, or the guard now in the file).',
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

// `refuted` used to be a boolean, and survival was `every(v => !v.refuted)`.
// The one confirmed false kill in the recorded corpus went that way: the
// refuter's actual finding was "the bug is real AND the proposed test cannot
// pass as written", the schema had no slot for it, so a real bug was scored as
// killed. `restate` is that slot.
const REFUTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'evidence'],
  properties: {
    verdict: {
      type: 'string',
      enum: ['refuted', 'stands', 'restate'],
      description:
        'refuted = this bug is NOT real; default to it when uncertain, because the burden of proof is on the bug. stands = you genuinely tried to kill it and failed. restate = the bug is real but the assertion proposed for it is wrong or unsatisfiable as written — supply the corrected one in `correctedTest`.',
    },
    evidence: {
      type: 'string',
      description:
        'What killed it (the guard, the type, the existing test, the unreachable path) — or, if you could not kill it, exactly how you demonstrated it is real.',
    },
    correctedTest: {
      type: 'string',
      description: 'Required when the verdict is "restate", empty otherwise. The assertion that SHOULD have been proposed; it replaces the original and the claim re-enters the round with it.',
    },
    // A correction adjusts severity; only a refutation kills. This is read only
    // from a verdict that failed to kill the claim, so it can never become a
    // second, silent way to remove a finding.
    severityCorrection: {
      type: 'string',
      enum: ['P0', 'P1', 'P2'],
      description: `Optional. Set only if the reported severity is wrong on the impact scale — ${SEVERITY_DEF} Ignored when your verdict is "refuted".`,
    },
  },
}

const ISSUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['filed'],
  properties: {
    filed: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'file'],
        properties: {
          summary: { type: 'string' },
          file: { type: 'string' },
          issue: { type: 'string', description: 'Issue number or URL. Empty string if filing failed for this one.' },
          error: { type: 'string', description: 'Empty normally. Why this one could not be filed.' },
        },
      },
    },
    warning: { type: 'string', description: 'Empty normally. Say here if the tracker was unusable and nothing was filed.' },
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
// Exactly two. There is deliberately no quality lens — quality is handled by
// the `simplify` step at the end, not by paying refuters to argue about it.
// The "present but ungated" shape is not theoretical: a run once fixed a flaky
// test with a line in `vitest.setup.ts`, but that file sat outside the tsconfig
// `include`, so a typo would have silently reverted the fix with every check
// still green.
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

// ---- helpers -------------------------------------------------------------

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

const fmtFindings = (fs) =>
  fs
    .map(
      (f, i) =>
        `${i + 1}. [${f.severity}] ${f.file}${f.line ? `:${f.line}` : ''} — ${f.summary}\n   Failure: ${f.failureScenario}${f.evidence ? ` (${f.evidence})` : ''}\n   Should hold: ${f.proposedTest}${
          f.restated ? '\n   ↑ restated by the refuter: the originally proposed assertion could not hold as written, this one replaces it.' : ''
        }${f.survivedBecause ? `\n   Survived refutation: ${f.survivedBecause}` : ''}`,
    )
    .join('\n')

const fmtList = (xs) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '- (none yet)')

const seenKey = (f) => `${f.file} :: ${f.summary}`

const SEV_RANK = { P0: 0, P1: 1, P2: 2 }

// `scope` was prose in a prompt that nobody checked, and the sprawl it was meant
// to prevent happened anyway. Checking it needs matching that is deliberately
// forgiving: agents report paths relative and absolute, and a scope entry is
// written as a glob, a bare directory or a plain path interchangeably. A false
// match here costs a stray file nobody flags; a false miss costs a bogus finding
// in every single round, so tolerance is the cheaper error.
const relPath = (p, root) => {
  let s = String(p || '').trim().replace(/^\.\//, '')
  if (root && s.startsWith(root)) s = s.slice(root.length).replace(/^\/+/, '')
  return s.replace(/^\/+/, '')
}

// Exempt from the scope check. Test files legitimately live outside a
// production-file scope list — this loop REQUIRES them to be written — and the
// gate file and the lockfile a dependency install rewrites belong to the run
// rather than to any task. Without these three, every round of every task would
// report the same strays.
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

// Runs the repo's own gate and reports the verdict as data. This is what makes
// "green" a fact this workflow observed rather than a claim an agent made, and
// it lands in `journal.jsonl` where it can be checked afterwards. Deliberately
// tiny — a shell invocation with a schema, not a reasoning task — so it is worth
// spending a cheap model and low effort on it.
//
// It replaces a Stop hook on the worker and simplifier agent types that was
// supposed to do this on the harness side. Across 976 recorded subagent
// transcripts that hook fired zero times, and had it fired it would have run
// against the repo root rather than this run's worktree for 910 of them.
//
// `scoped: true` lets this call fall back to `.claude/qa-scoped` — a cheaper,
// package-filtered stand-in Intake writes only when the repo already has a
// mechanism for it — instead of the full `.claude/qa`. It is a per-round
// optimization only. The Integrate phase never passes it: the run's one
// full, unscoped verification happens there, at the end, regardless of what
// gated any earlier round.
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
4. If \`.claude/dev-loop/blocked\` exists, return its contents as \`blocked\` and then delete it (\`rm -f .claude/dev-loop/blocked\`) — it is a one-shot signal to the orchestrator, and a copy left behind is read as fresh by every later step. Otherwise return an empty string and delete nothing.
5. Run the gate file from step 2. Capture combined stdout and stderr, and the exit code.
6. Report \`exitCode\` as you saw it. \`green\` is true if and only if it is 0 — never judge greenness from the output text, because a gate can print reassuring things and still exit non-zero.
7. Report \`failures\`: empty when green; when red, the failing check names, failing test names, assertion diffs, and compiler and lint errors with their \`file:line\`, quoted **verbatim** — they are handed straight back to the agent that has to fix them. Drop passing output, progress spinners and install noise; keep every error. If the output is enormous, keep the **first** errors and note how many you cut.
8. Report \`error\` only if the gate file could not be run at all (missing, not readable, \`${root}\` missing), and leave \`green\` false.

## Guardrails

1. Fix nothing, commit nothing, and touch no file except the one step 4 names.
2. Never edit \`.claude/qa\` or \`.claude/qa-scoped\`, and never make the gate pass.
3. Never re-run a failing check hoping for a different answer. Report the first result you get.`,
    { schema: GATE_SCHEMA, label, phase: phaseName, model: 'haiku', effort: 'low' },
  )

// Commits whatever the round produced, so that `git diff <base>...HEAD` — the
// command every reviewer downstream is handed — describes this round instead of
// coming back empty. Same shape as `runGate`: a shell invocation with a schema,
// not a reasoning task.
const runCommit = (root, message, label, phaseName, convention = '') => {
  // The message reaches the agent inside a `git commit -m "..."` it is told to
  // run, so a quote or a backtick in a task title would be a shell injection
  // against ourselves. The convention comes from the repo rather than from a
  // task title, but it lands in the same prompt, so it is sanitised the same way.
  const safe = String(message).replace(/["`$\\]/g, ' ').replace(/\s+/g, ' ').trim()
  const conv = String(convention || '').replace(/["`$\\]/g, ' ').replace(/\s+/g, ' ').trim()
  // `--no-verify` is deliberate: the workspace's own gate has already run, and a
  // pre-commit hook that rewrites files would put the tree out of step with the
  // verdict just recorded.
  return agent(
    `Your job is to commit the work already sitting in this workspace and report what landed. You are a bookkeeping step, not an author.

## Workflow

1. \`cd ${root}\`.
2. \`git status --porcelain\`. If it is empty, return \`committed: false\`, \`sha\` = the current \`git rev-parse HEAD\`, an empty \`changedFiles\`, and stop.
3. Read what it lists before you stage. Leave **unstaged** anything that plainly must never be committed — \`node_modules/\`, a build output directory, a \`.env\` or other secret \`.gitignore\` does not cover — staging the rest explicitly by path, and name them in \`note\`. Everything else is this round's work and belongs in the commit, including new test files.
4. \`git add -A\` (or the explicit paths from step 3), then commit.${
      conv
        ? ` This repo's commit convention is: **${conv}**. Write the subject in that convention, describing this change: "${safe}". Then \`git commit -q --no-verify -m "<the subject you wrote>"\`. Follow the convention exactly — a message that ignores it has to be reworded by hand before the branch can be reviewed.`
        : ` \`git commit -q --no-verify -m "${safe}"\`.`
    }
5. Return \`sha\` from \`git rev-parse HEAD\` and \`changedFiles\` from \`git show --name-only --pretty=format: HEAD\` — repo-relative paths, one per line, blanks dropped.

## Guardrails

1. Write no code, fix nothing, and change no file's contents.
2. Never \`git checkout\`, \`git switch\`, \`git stash\`, \`git reset\`, \`git rebase\`, \`git push\`, or \`git commit --amend\`. Never touch a path outside \`${root}\`.
3. If the commit fails, say exactly what git said in \`error\`, leave \`committed\` false, and return the unchanged HEAD as \`sha\`.`,
    { schema: COMMIT_SCHEMA, label, phase: phaseName, model: 'haiku', effort: 'low' },
  )
}

const DIRTY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['clean', 'entries'],
  properties: {
    clean: { type: 'boolean', description: 'True if and only if `git status --porcelain` printed nothing at all.' },
    entries: { type: 'array', items: { type: 'string' }, description: 'Every line `git status --porcelain` printed, verbatim. Empty when clean.' },
    error: { type: 'string', description: 'Empty normally. Set it only if the command could not be run at all.' },
  },
}

// The run's last chance to notice work that never reached a commit. Every phase
// that produces files is supposed to commit them, but a phase that exits early
// can skip its commit entirely, and nothing downstream can tell the difference:
// `git diff <base>...HEAD` shows the same thing either way, and a resume replays
// return values rather than the filesystem, so uncommitted work cannot be
// recovered from one. The cleanup step below already runs this exact command,
// but only to decide whether deleting a directory is safe, and only on a passing
// run — so on every other run the fact goes unreported.
const runDirtyCheck = (root) =>
  agent(
    `Your job is to report whether this workspace has uncommitted work. You are a measuring instrument: change nothing, stage nothing, commit nothing.

## Workflow

1. \`cd ${root}\`.
2. Run \`git status --porcelain\`.
3. If it printed nothing at all, return \`clean: true\` and an empty \`entries\`. Otherwise return \`clean: false\` and every line it printed, verbatim, in \`entries\`.
4. Set \`error\` only if the command could not be run at all.

## Guardrails

1. Never run \`git add\`, \`git commit\`, \`git checkout\`, \`git stash\`, \`git reset\`, or \`git clean\`.
2. Never create, edit, or delete a file.
3. Report what you saw. Do not decide whether any of it matters.`,
    { schema: DIRTY_SCHEMA, label: 'dirty-check', phase: 'Integrate', model: 'haiku', effort: 'low' },
  )

// Resume is cheap and it works — a 33-agent replay of a paused run cost 67k
// tokens against roughly 5.5M for the run it replayed — but today it is only
// discoverable from the notification the harness prints on failure. The runId is
// not visible from inside the script, so this is worded as an instruction the
// caller can act on rather than a command that can be pasted.
const RESUME_HINT =
  'If this run was interrupted, paused, or you want to re-run it after editing the script, resume it instead of starting over: `Workflow({scriptPath: "<the path this workflow was invoked with>", resumeFromRunId: "<the runId in this run\'s notification>"})`. Every agent that already returned is replayed from the journal rather than re-run, so a resume costs a small fraction of the original run. Note that a resume replays return values, not the filesystem — the worktree must still be on disk in the state this run left it.'

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
  workRoot: '',
  branch: '',
  isolated: false,
  criteria: [],
  tasks: [],
  unmetCriteria: [],
  deferred: [],
  issuesFiled: [],
  // Its own field on purpose. A task can converge with a product question still
  // open — the workflow files it and never waits for an answer — and buried one
  // level down inside `deferred` a `status: "passed"` would hide it completely.
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
// finding, the refuters kill everything, and the run reports clean. Refusing
// here costs one message; discovering it from a green run that found nothing
// costs the whole run and the trust in it.
if (declaredModel && MODEL_RANK[declaredModel] !== undefined && MODEL_RANK[declaredModel] < MODEL_RANK[MODEL_FLOOR] && !a.allowWeakModel) {
  return result({
    reason: `This run was asked to use \`${declaredModel}\`, which is below this workflow's floor of \`${MODEL_FLOOR}\`. Hunting what the tests forgot, killing a claim on evidence and judging whether a criterion is really met all degrade silently on a weak model — the run would come back green having checked nothing. Re-run with \`model: "opus"\` (or omit \`model\` to inherit the session), or pass \`allowWeakModel: true\` if you genuinely want it anyway.`,
  })
}

// ---- Intake --------------------------------------------------------------

phase('Intake')

log(`args parsed as: ${argForm}${argForm === 'json-string' ? ' (structured fields honoured)' : ''}`)
log(`issueTracker=${issueTracker} maxTasks=${MAX_TASKS}${baseRefOverride ? ` baseRef=${baseRefOverride}` : ''}${branchName ? ` branch=${branchName}` : ''}`)
// The one number nobody can read off the transcript afterwards. Refuters and the
// gate runner pin their own models; everything else runs on this.
if (declaredModel) {
  log(`Model: ${declaredModel} (declared by the caller — every reasoning phase is pinned to it).`)
} else {
  warnings.push(`no model declared — every reasoning phase inherits the session model, so the ${MODEL_FLOOR} floor could not be enforced`)
  log(
    `⚠️ Model: inherited from the session — a workflow script cannot read it, so the \`${MODEL_FLOOR}\` floor was NOT enforced. Pass \`model: "opus"\` to pin it. A run on an under-powered model reports clean rather than failing.`,
  )
}

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

1. \`git rev-parse --show-toplevel\` for the repo root, \`git rev-parse ${baseRefStart}\` for the sha this run is based on.
2. Make sure \`.claude/worktrees\` is matched by \`.gitignore\` before you create anything — append it if it is not, skip if it already is. The worktree goes inside the repo, so without this the shared checkout reports the whole thing as untracked and someone eventually commits it.
3. Create ONE dedicated worktree on a new branch, **branched from \`${baseRefStart}\`**, at \`<repo root>/.claude/worktrees/<suffix>\`: \`git worktree add <path> -b <branch> ${baseRefStart}\`. Derive \`<suffix>\` from \`date +%s\` in bash — never invent one and never reuse a fixed name.${
    branchName
      ? `\n4. **The caller named the branch \`${branchName}\`.** Use exactly that. If it already exists (\`git rev-parse --verify ${branchName}\` succeeds), do not reuse or reset it — fall back to \`run/<the same suffix>\` and say in \`warning\` that the requested name was taken. Return whichever name you created as \`branch\`.`
      : `\n4. Name the branch \`run/<the same suffix>\` so the path and the branch agree. (A caller can name it by passing \`branch\` in the workflow's args; this run did not.)`
  }
5. Install dependencies inside the worktree with whatever the repo uses — \`bun install\`, \`npm ci\`, \`pnpm install\` — and copy over the gitignored files the build genuinely needs (\`.env\`, \`.env.local\`, local config, credentials fixtures) from the repo root. A missing one surfaces much later as an inscrutable failure.
6. Return the worktree's absolute path as \`workRoot\`, \`isolated: true\`, and the sha you branched from as \`baseRef\`.${
    baseRefOverride
      ? ` The caller specified base ref "${baseRefOverride}", so branch from **that ref**, not HEAD, and \`baseRef\` is the sha it resolves to. Resolve it first: if \`git rev-parse ${baseRefOverride}\` fails, branch from \`HEAD\` instead, return that sha, and say so in \`warning\` — never guess at what was meant.`
      : ''
  }
7. From \`workRoot\`, read \`package.json\` scripts, any Makefile/justfile, and CI config (\`.github/workflows/*\`) and determine the repo's REAL commands for **test, lint, format, typecheck**. While you have the repo's conventions open, establish its **commit message convention** too and return it as \`commitConvention\` — from \`CONTRIBUTING\`, \`CLAUDE.md\`, \`AGENTS.md\`, a commitlint config, or failing all of those the last 20 subjects of \`git log --oneline\`. Every commit this run makes is written in it, so the branch does not arrive at review needing every message reworded.
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

Only write this if step 10 found a scoping mechanism. \`.claude/qa-scoped\` takes the changed paths as arguments and runs the SAME checks as \`.claude/qa\`, filtered to whichever package(s) those paths touch. The workflow uses it as a cheaper per-round stand-in; the full \`.claude/qa\` still runs once, unscoped, at the end of the run regardless of whether this file exists. Same discipline as the full gate — \`set -euo pipefail\`, run every check even after one fails, exit non-zero if any failed:

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

1. Other Claude sessions may be working on this branch right now. Do not disturb the shared checkout, and never reuse a fixed worktree path — parallel runs collide on it.
2. **Never invent a command.** Include only one you confirmed by *reading* a script block or config file, not by guessing from the framework.
3. \`ciGaps\` is a **warning, not a gate**: do not block on it, do not add a command you have not confirmed runs in this repo, and do not fold a long end-to-end job into a gate that runs after every task.
4. Each criterion must be checkable by looking at the code or running something. "The API is well designed" is not a criterion; "POST /upload returns 429 once a client exceeds 10 requests per minute" is.
5. Cover the whole plan — a requirement with no criterion will not get built — and add nothing the plan does not ask for. Inventing requirements is how a small task becomes a large one.
6. **A file list is a constraint, not a criterion.** "Touch only these three files", "change nothing outside \`src/api\`", "no new dependencies" bound *where* the work may happen; they are not outcomes. Never turn one into a criterion — the decomposition step turns them into each task's \`scope\`, which is where they are actually enforced.
7. If the repo has **no commits yet**, \`git worktree add\` cannot work: return the repo root as \`workRoot\`, \`isolated: false\`, an empty \`baseRef\`, and explain in \`warning\`. Same if dependency install fails.
8. Change no source files beyond \`.claude/qa\` and, only if step 10 applies, \`.claude/qa-scoped\`.`,
  { schema: INTAKE_SCHEMA, label: 'intake', ...MODEL },
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
const runBase = intake.baseRef || ''
const criteria = intake.criteria || []
const qaCommands = intake.qaCommands || []
const qaScopedWritten = !!intake.qaScopedWritten
const runDiffCmd = runBase ? `git diff ${runBase}...HEAD` : 'git status --porcelain, then read every untracked and modified file'

if (intake.warning) warnings.push(`intake: ${intake.warning}`)

// The gate being narrower than CI is how a run drives itself green and then has
// the PR rejected by CI anyway. A warning, never a gate: widening the gate on a
// guess is worse than knowing it is narrow.
const ciGaps = intake.ciGaps || []
for (const g of ciGaps) warnings.push(`.claude/qa is narrower than CI: ${g}`)

// Pinned to the front of every downstream prompt. Isolation is only real if
// every single agent honours it.
const WORK_BRIEF = `## Where you work
All work happens in \`${workRoot}\`. **\`cd\` there first and stay there.**${
  intake.isolated
    ? `

A dedicated git worktree${intake.branch ? ` on branch \`${intake.branch}\`` : ''}, shared by every agent in this run. Other Claude sessions are working on the same repo in parallel, so:
- Never \`cd\` to another checkout, and never touch a path outside \`${workRoot}\`.
- Never run \`git checkout\`, \`git switch\`, \`git stash\`, \`git reset --hard\`, or \`git worktree remove\` — they reach beyond this worktree or destroy work other agents in this run depend on.
- Committing inside this worktree is fine; it lands on this worktree's own branch.
- Do not start long-running servers on fixed ports. If you must bind a port, pick a high free one and kill the process when you are done.`
    : `

⚠️ This is the SHARED checkout — worktree isolation was not available${intake.warning ? ` (${intake.warning})` : ''}. Another session may be working here. Never run \`git checkout\`, \`git switch\`, \`git stash\`, or \`git reset --hard\`, and touch only files the task requires.`
}

## The verification gate
\`.claude/qa\` is this repo's gate. Run it with \`bash .claude/qa\` from \`${workRoot}\`. It runs:
${qaCommands.map((c) => `- \`${c}\``).join('\n') || '- (empty — this is a bug, report it)'}
${
  qaScopedWritten
    ? `\nThis run also has \`.claude/qa-scoped\`, the same checks filtered to the affected package(s), which the workflow uses for faster per-round gating. It is never the final word — the full \`.claude/qa\` above always runs once, unscoped, at the end of the run.`
    : ''
}
**Never edit \`.claude/qa\`${qaScopedWritten ? ' or `.claude/qa-scoped`' : ''}.** The workflow hashes ${qaScopedWritten ? 'both and compares' : 'it and compares'} after every step; a change to either is treated as a red run whatever the gate then says.`

log(
  intake.isolated
    ? `Worktree: ${workRoot}${intake.branch ? ` (${intake.branch})` : ''} @ ${runBase.slice(0, 8)}`
    : `⚠️ NOT isolated — running in ${workRoot}`,
)
log(`.claude/qa ${intake.qaFileAction || 'ready'}: ${qaCommands.join(' | ')}`)
log(
  qaScopedWritten
    ? `.claude/qa-scoped ready (hash ${(intake.qaScopedHash || '').slice(0, 12)}) — per-round gating will use it; the full .claude/qa still runs at Integrate.`
    : 'No scoped-verification mechanism found in this repo — every gate this run runs the full .claude/qa.',
)
if (ciGaps.length) log(`⚠️ The gate is NARROWER than CI — ${ciGaps.length} CI check(s) it does not run:\n${fmtList(ciGaps)}\nA run can go green here and still be rejected by CI.`)
log(`Acceptance criteria (${criteria.length}):\n${fmtCriteria(criteria)}`)
if (intake.warning) log(`⚠️ Intake warning: ${intake.warning}`)

// ---- Decompose -----------------------------------------------------------

phase('Decompose')

// The 200–400 line target is not arbitrary: SmartBear's study of 2,500 code
// reviews at Cisco found defect discovery collapses beyond roughly 200–400 lines
// per review — reviewers keep reading but stop finding things. A task above that
// size does not get reviewed, it gets skimmed, and every later phase in this
// workflow inherits that blindness. Recorded runs bear it out — small-feature
// runs converged in one round; runs that tried to land a whole subsystem at once
// produced 60–106 findings, 78 of them in a single file, and never converged.
const decomposed = await agent(
  `${WORK_BRIEF}

Your job is to split this plan into an ordered list of small tasks. You write no code and change no files.

## The plan
${plan}

## The acceptance criteria (the Definition of Done)
${fmtCriteria(criteria)}

## Workflow

1. Read the repo to ground the split — enough to know where the work lands, not to write it.
2. Split the plan into tasks of **200–400 lines of change or less** each. A task above that size gets skimmed rather than reviewed.
3. Order by dependency, then by risk: the thing everything else sits on goes first.
4. Give each task a \`scope\`: the files or globs it may change, honest and reasonably tight.
5. Cite the criterion numbers each task makes true, and give a \`rationale\` for why it is one reviewable unit at that position.

## How these tasks execute — this constrains your split

Tasks run **serially, in order, in one shared worktree**, so ordering is the *only* dependency mechanism you have: a task may freely assume every earlier task has landed. Use that instead of trying to make tasks independent. Each task then gets its own test-generation → implement → adversarial-review cycle, which is where the cost is.

That cycle **starts** by writing a test that fails right now and passes once the task lands, so every task needs a red-able behaviour delta. "Document the module", "make sure X is covered", "review Y" are not tasks here. Phrase every task as an observable change a test can pin before and after.

The one exception is a **pure-verification task**, whose entire deliverable is a test — an integration or end-to-end check over behaviour earlier tasks already land, with no production change of its own. It must carry \`verificationOnly: true\`, because its test is expected to pass the moment it is written and the loop skips the failing-test gate for it. Every other task carries \`verificationOnly: false\`.

## Guardrails

1. **Every criterion must be covered by at least one task.** A criterion nobody claims will not get built.
2. **No task may introduce work no criterion asks for.** If you find yourself adding "and also refactor X" or "plus a config option for Y", cut it. YAGNI applies to the plan as hard as it applies to the code.
3. Keep \`scope\` tight. Later phases use it to decide whether a bug belongs to the current task, a future one, or nobody, and an over-broad scope makes everything look in-scope.
4. Never reach for \`verificationOnly\` to smuggle through a task you could not phrase as a behaviour delta — split or restate that task instead.
5. Cap: **${MAX_TASKS} tasks**. If the plan genuinely cannot be covered in ${MAX_TASKS}, produce the best ${MAX_TASKS} and say exactly what is left uncovered in \`warning\`. Never silently truncate, and never cram two unrelated units into one task to fit the cap.`,
  { schema: DECOMPOSE_SCHEMA, label: 'decompose', ...MODEL },
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

const tasks = decomposed.tasks.slice(0, MAX_TASKS)
if (decomposed.warning) warnings.push(`decompose: ${decomposed.warning}`)

const covered = new Set()
for (const t of tasks) for (const n of t.criteria || []) covered.add(n)
const uncovered = criteria.filter((c) => !covered.has(c.n))
if (uncovered.length) warnings.push(`criteria with no owning task: ${uncovered.map((c) => c.n).join(', ')}`)

log(
  `Decomposed into ${tasks.length} task(s):\n` +
    tasks
      .map(
        (t, i) =>
          `  ${i + 1}. [${t.id}] ${t.title}${t.verificationOnly ? ' (verification-only)' : ''}\n     criteria: ${(t.criteria || []).join(', ') || '—'} | scope: ${(t.scope || []).join(', ')}`,
      )
      .join('\n'),
)
if (decomposed.warning) log(`⚠️ Decompose warning: ${decomposed.warning}`)
if (uncovered.length) log(`⚠️ Uncovered criteria: ${uncovered.map((c) => c.n).join(', ')}`)

const taskListForDedupe = tasks.map((t) => `- ${t.id}: ${t.title}\n  scope: ${(t.scope || []).join(', ') || '(none declared)'}`).join('\n')

// ---- run-wide state (outside BOTH loops) ---------------------------------
// The old script reset `seen` every outer round, so dropped findings were
// re-found and re-adjudicated from scratch every single round.
const seen = new Set()
const deferred = []
const issuesFiled = []
// Findings that were filed because answering them is a product decision, not an
// engineering one. Surfaced at the top of the return value, never waited on.
const openQuestions = []
let trackerOk = issueTracker !== 'none'
const taskHistory = []

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
// tampering on every scoped round. `gate.gateFile` says which file this
// verdict actually hashed, so the right baseline gets checked either way.
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

// ---- per-task loop -------------------------------------------------------

for (let ti = 0; ti < tasks.length; ti++) {
  const task = tasks[ti]
  const taskCriteria = criteria.filter((c) => (task.criteria || []).includes(c.n))
  const criteriaBlock = taskCriteria.length ? fmtCriteria(taskCriteria) : '(this task declares no criteria — treat that as a decomposition bug and report it)'

  log(`══ Task ${ti + 1}/${tasks.length}: [${task.id}] ${task.title} ══`)

  let carried = null // findings that need a NEW failing test next round
  let strengthen = null // findings whose remedy is tightening an assertion that already exists
  let taskBase = ''
  let unresolved = []
  let converged = false
  let outcome = 'unconverged'
  let failure = ''
  const ungated = []
  const rounds = []

  // Nothing inside a task may destroy the run. Four of ten recorded runs threw
  // away every landed task because one round threw — one of them 7.5M tokens'
  // worth. A task that throws degrades to a failed task and the loop moves on;
  // the worktree still holds everything the earlier tasks landed.
  try {
    for (let outer = 1; outer <= MAX_OUTER; outer++) {
      log(`── ${task.id} round ${outer}/${MAX_OUTER} ──`)

      // ---- 1. Generate Tests -------------------------------------------------
      phase('Generate Tests')

      const testgen = await agent(
        `${WORK_BRIEF}

Your job is to write the failing tests for this task. Follow the **tdd** skill — you are writing the Red. Tests only: you write **no production code**.

## Task ${ti + 1} of ${tasks.length}: ${task.title}
${task.rationale}

Files this task may touch: ${(task.scope || []).join(', ') || '(unspecified)'}

## Acceptance criteria this task must make true
${criteriaBlock}
${
    task.verificationOnly
      ? `
**This task is verification-only.** Its whole deliverable is the test: the behaviour it checks was landed by earlier tasks, so there is no production change here to drive. A batch that **passes** is the expected outcome — write the honest integration test, run it, and report \`alreadySatisfied\`. Report \`red\` only if the test genuinely exposes a gap the earlier tasks left between them.
`
      : ''
  }
## Test conventions in this repo
${intake.testLayout}

Run tests with: \`${intake.testCommand}\`

## Workflow

1. Before touching anything, run \`git rev-parse HEAD\` and return it as \`baseSha\`. Reviewers diff this task against it.
2. Write a test for each acceptance criterion above, citing the criterion number it pins in the test name or an adjacent comment. A test that pins nothing is a test nobody will maintain.
3. Do the work in every extra section below, if there is one.
4. Run the tests and report \`redState\` — **what you saw**, not what you hoped for.
${
    carried
      ? `
## Regression tests required this round (round ${outer})

The previous round shipped green, but these bugs were found and **survived independent refutation**. ADD a test for each one, encoding the assertion that should hold:

${fmtFindings(carried)}
`
      : ''
  }${
    strengthen && strengthen.length
      ? `
## Assertions to strengthen this round (${strengthen.length})

These are not "the behaviour is wrong" — they are "**nothing would catch it if it broke**": a vacuous assertion, a test that asserts the mock instead of the code, a criterion no test pins. Tighten what is already there rather than writing a new failing test: rewrite each assertion so it would fail if the behaviour it names were absent, then run it.

${fmtFindings(strengthen)}

A strengthened assertion is **expected to pass** — it is not part of the red batch and never counts toward \`redState\`. If one fails once tightened, that is a real behaviour bug: leave it failing, say so in \`summary\`, and report \`red\`. The criteria's own tests were written in an earlier round and are already green; tighten what these findings name and change nothing else.${
          carried ? '' : ' There are no new bugs to pin this round, so tightening these is the whole job — do it, run the suite, and report `alreadySatisfied` with what you tightened.'
        }
`
      : ''
  }
## \`redState\`
It describes the tests written for the criteria and the carried findings above. Every value below is a legitimate outcome; only guessing is not. Unless you report \`red\`, say in \`notRedReason\` exactly what you saw and which criterion or finding it applies to.

- \`red\` — the normal path: they fail for the **right reason** (the behaviour is missing or wrong), not an import error, a wrong module path, or a typo. The implementer runs next.
- \`alreadySatisfied\` — an honest test **passes as written**, because the behaviour is already correct. It must still be one that would fail if the behaviour were absent; never weaken it to manufacture a red. Implement is skipped and the round is recorded as done.
- \`cannotBeRed\` — the work **cannot be expressed as a failing test at all**: a coverage gap, not a behaviour delta ("this assertion is vacuous", "this is correct but nothing gates it"). Recorded as an ungated criterion; the run moves on. Reporting it honestly beats inventing a test that fails for a reason nobody asked about.
- \`brokenRed\` — they fail for the **wrong** reason and you could not repair them. Repair first; this is the last resort. Before returning it, **delete the broken test files you added** so they cannot redden the gate for the rest of the run. The only value that counts as a failure, and it fails this task alone.

## Guardrails

1. **Preserve every existing test file.** Never delete, rewrite, or weaken anything already there — the only exception is an assertion an "Assertions to strengthen" section above explicitly names.
2. Assert on observable behaviour, not on internals the implementer is free to change.
3. Never write a test you know cannot be satisfied.
4. Scope your tests to THIS task. Earlier tasks have landed and are already tested; later tasks are not your problem.`,
        { schema: TESTGEN_SCHEMA, label: `testgen:${task.id}.r${outer}`, ...MODEL },
      )

      if (!testgen) throw new Error(`Test generation agent failed to return a result (round ${outer}).`)
      if (!taskBase) taskBase = testgen.baseSha || runBase

      const testFiles = testgen.testFiles || []
      const redState = testgen.redState || 'red'
      log(`Tests (${testFiles.length} file(s)) [${redState}]: ${testgen.summary}`)

      // Only a batch that is red for the WRONG reason is a failure. The other
      // two non-red states are outcomes: the behaviour is already correct, or
      // the thing being pinned is a coverage gap that no failing test can
      // express. The requirements lens is commissioned to produce exactly that
      // second class of finding, and the old boolean gate had nowhere to put it.
      if (redState === 'brokenRed') {
        throw new Error(
          `Test generator could not produce a usable test batch: the tests fail for the wrong reason (import error, wrong path, typo) and it could not repair them.\n` +
            `${testgen.notRedReason || 'No reason given.'}`,
        )
      }

      // Both paths below skip Implement — and Implement is where the round gets
      // committed. By this point the generator has already WRITTEN its test
      // files, so breaking straight out leaves them untracked while the task
      // still reports converged. A verification-only task is the worst case: its
      // own prompt above instructs it to report `alreadySatisfied`, so it loses
      // its entire deliverable every single time. One run dropped three
      // integration-test files that way, along with a repair to a test an
      // earlier task had left red.
      const commitEarlyExit = async (exitKind) => {
        const c = await runCommit(workRoot, `${task.title} (tests only)`, `commit:${task.id}.r${outer}.${exitKind}`, 'Generate Tests', intake.commitConvention)
        if (!c || c.error) {
          const detail = (c && c.error) || 'the commit runner failed to return'
          warnings.push(`${task.id} round ${outer}: the tests written this round could NOT be committed (${detail}) — they are on disk but untracked`)
          log(`⚠️ Could not commit this round's tests: ${detail}. They are on disk but untracked.`)
          return []
        }
        const files = c.changedFiles || []
        if (c.note) warnings.push(`${task.id} round ${outer} commit: ${c.note}`)
        log(c.committed ? `Committed ${files.length} file(s) as ${(c.sha || '').slice(0, 8)} — an early-exit round still lands what it wrote.` : 'Nothing to commit — the generator wrote no file git can see.')
        return files
      }

      if (redState === 'alreadySatisfied') {
        const landed = await commitEarlyExit('alreadySatisfied')
        outcome = 'alreadySatisfied'
        converged = true
        unresolved = []
        rounds.push({
          round: outer,
          outcome: 'alreadySatisfied',
          detail: testgen.notRedReason || testgen.summary,
          testsAdded: testFiles,
          changedFiles: landed,
          raw: 0,
          afterDedupe: 0,
          dropped: [],
          adjudicated: 0,
          survivors: [],
          ignoredLaterTask: [],
        })
        log(`✅ ${task.id}: the tests pass as written — the behaviour is already correct. Skipping Implement. ${testgen.notRedReason || ''}`)
        break
      }

      if (redState === 'cannotBeRed') {
        // A coverage gap, not a behaviour delta. Record what stays ungated so
        // the final requirements pass and the caller both see it, and move on.
        // Name whatever this round was actually asked to pin — the carried
        // findings, or the assertions it was sent to tighten, or, on a first
        // round, the criteria themselves.
        const pending = carried || (strengthen && strengthen.length ? strengthen : null)
        const ungatedItems = pending ? pending.map((f) => `${f.file}: ${f.summary}`) : taskCriteria.map((c) => `criterion ${c.n}: ${c.text}`)
        const why = testgen.notRedReason || 'no failing test can express it'
        for (const item of ungatedItems) ungated.push({ item, why })
        const landed = await commitEarlyExit('cannotBeRed')
        outcome = 'ungated'
        converged = true
        unresolved = []
        rounds.push({
          round: outer,
          outcome: 'cannotBeRed',
          detail: why,
          testsAdded: testFiles,
          changedFiles: landed,
          raw: 0,
          afterDedupe: 0,
          dropped: [],
          adjudicated: 0,
          survivors: [],
          ignoredLaterTask: [],
        })
        warnings.push(`${task.id}: ${ungatedItems.length} item(s) left ungated — no failing test could express them (${why}): ${ungatedItems.join('; ')}`)
        log(`⚠️ ${task.id}: no failing test can express this round's work (${why}). Recorded ${ungatedItems.length} item(s) as ungated and moving on.`)
        break
      }

      // ---- 2. Implement ------------------------------------------------------
      // The worker's agent type used to carry a Stop hook that was supposed to
      // re-run .claude/qa and refuse a red return, and this comment used to claim
      // a worker that returns is green by construction. It was not: across 976
      // recorded subagent transcripts the hook fired zero times, and had it fired
      // it would have gated the repo root rather than this run's worktree.
      //
      // So the workflow runs the gate itself, right here, and the verdict lands
      // in journal.jsonl where it can be checked. Red is not fatal on its own —
      // the worker gets the failures back and MAX_GATE_FIXUPS attempts to clear
      // them, which is the feedback loop the hook was meant to provide. Still red
      // after that is a task failure, which degrades this task and no more.
      //
      // The prompt below no longer mandates a full `bash .claude/qa` run as the
      // worker's own definition of done — this `runGate` call happens right
      // after either way, so a mandated full run here was a second full run
      // paying for information the worker's own return already gets checked
      // against. The worker still verifies itself; it just checks the tests it
      // was actually handed, which is the one thing this `runGate` call cannot
      // tell it in advance.
      phase('Implement')

      const workerPrompt = `${WORK_BRIEF}

Your job is to make the failing tests pass by changing production code. Follow **earned-abstractions** — no helper, option, layer, or variant this task has not earned — and **codebase-design** when you place a new seam.

## Task ${ti + 1} of ${tasks.length}: ${task.title}
${task.rationale}

Files this task may touch: ${(task.scope || []).join(', ') || '(unspecified)'}. Straying outside this list means you are doing a later task's work early, or work nobody asked for.

## Acceptance criteria this task must make true
${criteriaBlock}

## Workflow

1. Find the tests you must satisfy: \`git status --porcelain\` from \`${workRoot}\` lists the test files the generator just wrote. They pin: ${testgen.summary}
2. Change production code until they pass.${
    carried
      ? `\n3. Fix the **root cause** of each bug below. They survived independent refutation and there is now a regression test for each; a fix that only satisfies the new test's exact input will be found again next round.\n\n${fmtFindings(carried)}\n`
      : ''
  }
## Verification — hard completion requirement

**You are done when the tests you found in step 1 pass.** Run them yourself before you return — the specific file(s), or \`${intake.testCommand}\` scoped to them, not the repo's whole test suite.

**The workflow independently runs the full gate the moment you return** (\`bash .claude/qa\`, which also runs lint and typecheck):

${qaCommands.map((c) => `- \`${c}\``).join('\n')}

If anything in it is red — your tests or anything else — you are sent straight back here with the failures attached, up to ${MAX_GATE_FIXUPS} times, after which this task is recorded as failed. Returning optimistically buys you nothing but a round trip.

## Guardrails

1. Returning with any of the gate red is a **failed run, not a partial one**. So is getting it green by weakening a test, and so is editing \`.claude/qa\` — that file is hashed and a change to it fails the task outright.
2. **Never weaken, skip, delete, or rewrite a test to make it pass.** If a test is genuinely unsatisfiable or self-contradictory, stop and put it in \`blocked\` rather than working around it or returning as though you had reached green.
3. Fix the root cause, not the symptom. No \`any\` casts, no \`@ts-ignore\`, no lint-disable comments, no try/catch swallowing an error to silence a check.
4. Match the surrounding code's idiom, naming, and comment density.
5. Build only what the criteria above ask for. Nothing extra.`

      let worker = await agent(workerPrompt, { schema: WORKER_SCHEMA, label: `worker:${task.id}.r${outer}`, agentType: 'dev-loop-worker', ...MODEL })

      if (!worker) throw new Error(`Worker agent failed to return a result (round ${outer}).`)
      if (worker.blocked) throw new Error(`Worker reported the tests as unsatisfiable (round ${outer}): ${worker.blocked}`)
      log(`Implemented: ${worker.summary}`)

      // ---- 2b. Verify green ourselves ----------------------------------------
      // Nothing below this point is meaningful if the gate is red: the finders
      // would hunt bugs in code that does not compile, and the run would report
      // a green it never saw.
      //
      // `scoped: true` — this is a per-round check, so it may use
      // `.claude/qa-scoped` when Intake found one. The Integrate phase below
      // still runs the full, unscoped gate once at the end regardless.
      let gate = await runGate(workRoot, `gate:${task.id}.r${outer}`, 'Implement', { scoped: true })
      let fixups = 0

      while (true) {
        if (!gate) {
          // The gate runner dying is not the worker's fault and not worth failing
          // a task over — but the run must not go on claiming a green it did not
          // observe, so it is recorded as unverified.
          warnings.push(`${task.id} round ${outer}: the gate runner failed to return — this round's green is UNVERIFIED`)
          log('⚠️ Gate runner failed to return. This round was not machine-verified — treating the worker\'s claim as unverified and continuing.')
          break
        }

        const tampered = gateFileChanged(gate)
        if (tampered) throw new Error(`${tampered} What the worker did this round: ${worker.summary || '(nothing reported)'}`)

        // The escape hatch the worker agent is told about. A worker that wrote it
        // is declaring the work impossible, which is the existing blocked path —
        // not a gate failure to iterate on.
        if (gate.blocked) throw new Error(`Worker declared the work unsatisfiable via .claude/dev-loop/blocked (round ${outer}): ${gate.blocked}`)

        if (gate.error) {
          warnings.push(`${task.id} round ${outer}: the gate could not be run (${gate.error}) — this round's green is UNVERIFIED`)
          log(`⚠️ The gate could not be run: ${gate.error}. This round was not machine-verified; continuing.`)
          break
        }

        if (gate.green) {
          log(fixups ? `✅ Gate green after ${fixups} fix-up attempt(s) — verified by the workflow.` : '✅ Gate green — verified by the workflow, not claimed by the worker.')
          break
        }

        if (fixups >= MAX_GATE_FIXUPS) {
          throw new Error(
            `\`.claude/qa\` is still red after the worker's own pass and ${MAX_GATE_FIXUPS} fix-up attempt(s) — exit ${gate.exitCode} (round ${outer}).\n${
              gate.failures || '(the gate produced no capturable output)'
            }`,
          )
        }

        fixups++
        log(`⚠️ Gate RED (exit ${gate.exitCode}) — sending the worker back with the failures, fix-up ${fixups}/${MAX_GATE_FIXUPS}.`)

        const again = await agent(
          `${workerPrompt}

## ⚠️ THE GATE IS RED — this is your work and it is not finished

You already made a pass at this task and returned. The workflow then independently ran the gate (\`${gate.gateFile === 'qa-scoped' ? '.claude/qa-scoped' : '.claude/qa'}\`) from \`${workRoot}\` and it exited **${gate.exitCode}**. Everything you changed is still on disk; keep it and fix what is broken. This is attempt ${fixups} of ${MAX_GATE_FIXUPS} — after that this task is recorded as failed.

\`\`\`
${gate.failures || '(the gate produced no capturable output — run it yourself and read what it says)'}
\`\`\`

1. Fix the **root cause** of every failure above, in production code. Every guardrail you were given still holds in full.
2. Verify against the specific failure(s) named above — rerun the failing test, lint check, or typecheck command they name, not the whole gate. The workflow runs the full gate again independently either way.
3. If one of these failures is genuinely unsatisfiable rather than merely hard, say so in \`blocked\` instead of working around it.`,
          { schema: WORKER_SCHEMA, label: `worker:${task.id}.r${outer}.fix${fixups}`, agentType: 'dev-loop-worker', ...MODEL },
        )

        if (!again) throw new Error(`Worker agent failed to return a result on gate fix-up ${fixups} (round ${outer}).`)
        if (again.blocked) throw new Error(`Worker reported the tests as unsatisfiable on gate fix-up ${fixups} (round ${outer}): ${again.blocked}`)

        // The finders diff against `taskBase` and the round record reads the
        // commit, so a fix-up that touched a new file shows up either way. Only
        // the narrative has to be merged.
        worker = {
          summary: `${worker.summary}\n\nGate fix-up ${fixups}: ${again.summary}`,
          blocked: '',
        }
        log(`Fix-up ${fixups}: ${again.summary}`)

        gate = await runGate(workRoot, `gate:${task.id}.r${outer}.fix${fixups}`, 'Implement', { scoped: true })
      }

      // ---- 2c. Commit --------------------------------------------------------
      // Everything downstream reads this round through `git diff <base>...HEAD`,
      // and nothing in this workflow ever committed — so in every recorded run
      // that diff was empty and the finders reviewed the whole codebase blind.
      // Committing here also makes resume safe: a resume replays return values,
      // never the filesystem, so uncommitted work is the one thing it cannot
      // reconstruct. It happens after the gate, so what lands is verified.
      const commit = await runCommit(
        workRoot,
        // With a convention to follow the description is the whole input; without
        // one the run's own provenance is the most useful thing a subject can carry.
        intake.commitConvention ? task.title : `dev-loop ${task.id} round ${outer}: ${task.title}`,
        `commit:${task.id}.r${outer}`,
        'Implement',
        intake.commitConvention,
      )

      let committed = false
      if (!commit) {
        warnings.push(`${task.id} round ${outer}: the commit runner failed to return — the reviewers' diff may be empty`)
        log('⚠️ Commit runner failed to return. The round is on disk but uncommitted; the finders are told to fall back to `git status`.')
      } else if (commit.error) {
        warnings.push(`${task.id} round ${outer}: could not commit (${commit.error}) — the reviewers' diff may be empty`)
        log(`⚠️ Could not commit this round: ${commit.error}. The finders are told to fall back to \`git status\`.`)
      } else {
        committed = !!commit.committed
        if (commit.note) warnings.push(`${task.id} round ${outer} commit: ${commit.note}`)
        log(
          committed
            ? `Committed ${(commit.changedFiles || []).length} file(s) as ${(commit.sha || '').slice(0, 8)} — this is the diff the reviewers see.`
            : '⚠️ Nothing to commit this round — the worker changed no file that git can see.',
        )
      }

      // ---- 2d. Scope check ---------------------------------------------------
      // `scope` was prose in a prompt nobody checked, and it produced real
      // infrastructure sprawl. A file outside it is a finding against THIS task,
      // not somebody else's problem: it goes into this round's findings so it is
      // triaged with everything else — which is also what lets the triage agent
      // drop it as `runScaffolding` when it is only a lockfile.
      //
      // The commit is the only account of what landed — the worker's own memory
      // of what it touched is not one — so a round that could not be committed
      // simply is not scope-checked, and says so rather than guessing.
      const landedFiles = commit && (commit.changedFiles || []).length ? commit.changedFiles : []
      if (!landedFiles.length) {
        warnings.push(`${task.id} round ${outer}: the scope check was skipped — this round could not be committed, so there is no record of which files it touched`)
      }
      const strays = outOfScope(landedFiles, task.scope, workRoot)
      if (strays.length) {
        warnings.push(`${task.id} round ${outer}: ${strays.length} file(s) changed outside the task's declared scope: ${strays.join(', ')}`)
        log(`⚠️ ${strays.length} file(s) outside \`${task.id}\`'s scope (${(task.scope || []).join(', ')}): ${strays.join(', ')}`)
      }

      // ---- 3. Find -----------------------------------------------------------
      phase('Find')

      const taskDiffCmd = taskBase ? `git diff ${taskBase}...HEAD` : runDiffCmd
      const raw = []
      // Lenses that came back with nothing found AND nothing held up. Their own
      // prompt calls that a failed review; this is where it stops being advice.
      const reviewFailures = []

      for (let sweep = 1; sweep <= MAX_SWEEPS; sweep++) {
        const swept = await parallel(
          LENSES.map((lens) => () =>
            agent(
              `${WORK_BRIEF}

Your job is to hunt for **what the tests forgot** in the change below, through one lens, adversarially. You are **read-only**.

## What was just built — task ${ti + 1} of ${tasks.length}: ${task.title}
${task.rationale}

## Acceptance criteria this task was supposed to make true
${criteriaBlock}

## Your lens — apply only this one
${lens.brief}

## Workflow

1. \`${taskDiffCmd}\` and read every changed file. Read them, do not skim them.${
                committed
                  ? ''
                  : ` ⚠️ This round could **not** be committed, so that diff may come back empty. If it does, fall back to \`git status --porcelain\` from \`${workRoot}\` and read every modified and untracked file it lists — that is the change you are here to attack. Do not review the rest of the codebase instead.`
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

Do not reproduce everything: most of what you find is merged, dropped or killed downstream, and reproduction is the expensive step. When you do reproduce, say what you ran. A \`predicted\` finding is not a lesser finding and not a reason to stay quiet — it is **filed for a human** rather than handed to a worker, so never inflate the label to get your finding fixed; an inflated one buys a wasted round and dies to a refuter. On a \`predicted\` finding also set \`likely\`, \`expensive\` and \`oneWayDoor\` where you can judge them: they let a human close or accept the filed issue at a glance.

## Who decides — \`needsHumanDecision\`

Set it true, and write the decision out in \`humanQuestion\`, when fixing this needs a judgement the acceptance criteria do not make. **Independent of scope**: a bug in this task's own files can still need a product decision. ${HUMAN_DECISION_DEF}

\`humanQuestion\` states **the decision, the options, and what each one costs** — not "what should we do about X". Nothing waits on the answer: it is filed as an issue and the run carries on.

## Already known — do not re-report
${fmtList([...seen])}
${deferred.length ? `\nFiled as issues and deliberately deferred:\n${fmtList(deferred.map((d) => `${d.file}: ${d.summary}`))}\n` : ''}
Repeating these wastes a refuter and buys nothing. **But**: an *incomplete* fix to one IS a finding, and a *new* defect introduced in the same code while fixing one IS a finding. Say explicitly which known item yours sits next to and why it is not the same defect.
${
    carried
      ? `
## Fixed this round — verify the fix, don't re-report the bug
${carried.map((f) => `- ${f.file}: ${f.summary}`).join('\n')}
`
      : ''
  }
## Guardrails

1. Never edit a file.
2. Every finding carries a **concrete failure scenario** — specific inputs or state → the wrong output. If you cannot state one, drop the finding. No speculative nits. Shape every finding as the assertion that *should* hold.
3. Four shapes are dropped on sight by the triage step, so do not spend attention on them: an input **no call site in this repo produces** (if you cannot name the caller that passes it, it is not a finding); **style, naming, structure, duplication or preference** (the refactor pass owns those); **this run's own scaffolding** (the test file written minutes ago, turbo/CI wiring, the loop's own bookkeeping — attack the product); and **already true** (the criterion you claim is unmet is in fact met — check before you claim).
4. Be ambitious: a few high-conviction findings beat a flood of nits. Every claim you make is handed to independent agents whose entire job is to kill it, so a padded finding costs you and buys nothing.
5. An empty \`findings\` array is a legitimate and useful result — but only when \`heldUp\` names what you actually attacked. Returning nothing found with an empty \`heldUp\` is a failed review, and so is "looks good" without genuinely trying to break something.`,
              { schema: FIND_SCHEMA, phase: 'Find', label: `find:${lens.key}.${task.id}.r${outer}`, ...MODEL },
            ),
          ),
        )

        // "A review that finds nothing and holds nothing up is a failed review"
        // is already in the lens prompt, and trusting a reviewer to enforce a
        // rule about its own diligence is how a silent no-op review counts as a
        // clean one. Check it here instead: no findings and no `heldUp` means
        // nobody looked, whatever the empty findings array implies.
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

        const fresh = swept.filter(Boolean).flatMap((r) => r.findings || [])
        log(`Sweep ${sweep}: ${fresh.length} raw finding(s) from ${LENSES.length} lenses.`)
        raw.push(...fresh)
        if (!fresh.length) break
      }

      if (reviewFailures.length) {
        warnings.push(`${task.id} round ${outer}: ${reviewFailures.length} of ${LENSES.length} lens(es) returned a failed review — ${reviewFailures.join('; ')}`)
        log(`⚠️ Failed review this round: ${reviewFailures.join('; ')}. Nothing found by these lenses counts as evidence that anything is clean.`)
      }

      // A file outside the task's declared scope is a finding against this task.
      // It joins the round's raw findings rather than being reported separately,
      // so it is deduped, clustered and routed with everything else — and so the
      // triage agent can drop it as `runScaffolding` when it is only a lockfile
      // the dependency install touched. It needs a human because the two fixes —
      // widen the task's scope, or revert the file — are a judgement no
      // acceptance criterion makes.
      for (const p of strays) {
        raw.push({
          severity: 'P2',
          file: p,
          summary: `\`${p}\` was changed by task ${task.id}, which is not allowed to touch it`,
          failureScenario: `The workflow read this round's own commit and found \`${p}\` in it. Task ${task.id} declares its scope as ${(task.scope || []).join(', ') || '(nothing)'}, so this change is either a later task's work landing early, work nobody asked for, or a file the task genuinely needs and whose scope was written too tight.`,
          evidence: 'reproduced',
          proposedTest: `Task ${task.id} changes only the files in its declared scope (test files aside).`,
          needsHumanDecision: true,
          humanQuestion: `\`${p}\` is outside task ${task.id}'s scope (${(task.scope || []).join(', ') || 'none declared'}). Either the scope is wrong and should include it, or the change does not belong to this task and should be reverted. Keeping it silently is how a run that was scoped to three files ends up rewriting the build.`,
        })
      }

      // ---- 4. Dedupe ---------------------------------------------------------
      // The main cost saver. The old script's keyOf() slug only caught near-
      // identical wording, so two lenses describing one defect differently both
      // survived and each bought refuters. 69% of all refuter votes failed to
      // refute; the cheapest fix is to send fewer claims.
      //
      // Every drop reason below is drawn from a recorded run:
      //   noReachableCaller — six findings were exactly this; each bought a full
      //     refuter and all six were killed.
      //   runScaffolding    — produced real infrastructure sprawl.
      //   alreadyTracked    — one drop read an OPEN tracker issue as proof the
      //     bug was handled when it was not, and the finding disappeared. Hence
      //     the demand that `detail` name the fix in the code, not the issue.
      // The cluster threshold has the same provenance: one run produced 78 of
      // its 106 findings in a single file, another 52 of 60.
      let survivors = []
      let dropped = []

      if (raw.length) {
        phase('Dedupe')

        const deduped = await agent(
          `${WORK_BRIEF}

Your job is to shrink this round's raw findings to the ones worth paying an adversarial refuter to attack, and **route** the rest to where they can actually be acted on. You are **read-only**: read-only git and \`gh\` commands, and you edit nothing.

## This round's raw findings (${raw.length})
${raw
            .map(
              (f, i) =>
                `[${i + 1}] (${f.severity} · ${f.evidence || 'evidence unstated'}${fmtFlags(f)}) ${f.file}${f.line ? `:${f.line}` : ''} — ${f.summary}\n    Failure: ${f.failureScenario}\n    Should hold: ${f.proposedTest}${f.criterion ? `\n    Criterion: ${f.criterion}` : ''}${
                  f.needsHumanDecision ? `\n    Needs a human decision: ${f.humanQuestion || '(the finder set the flag but stated no question — write one)'}` : ''
                }`,
            )
            .join('\n\n')}

## Already adjudicated in this run (\`seen\`)
${fmtList([...seen])}

## Already filed as issues and deferred
${fmtList(deferred.map((d) => `${d.file}: ${d.summary}${d.issue ? ` (${d.issue})` : ''}`))}

## The full task list for this run
${taskListForDedupe}

**Current task: \`${task.id}\`** — scope: ${(task.scope || []).join(', ') || '(none declared)'}

## Workflow

1. **Collapse semantic duplicates within this round.** The two lenses read the same diff, so they describe the same defect in different words. Judge by **the underlying defect**, not the phrasing — same root cause and same fix means one finding. Keep the clearest statement, record what you folded in under \`mergedFrom\`, and merge severity **upward** but \`evidence\` **downward**: a \`predicted\` finding merged with a \`traced-to-caller\` one keeps \`predicted\` unless the traced call site really does produce the merged scenario.

2. **Drop anything already in \`seen\` or \`deferred\`** above.

3. **Drop anything already tracked as an issue — and only if the fix is actually in the code.** Query the tracker (\`gh issue list --search "<distinctive terms>" --state all --limit 20\`), and check the file path too. A matching issue only proves somebody once wrote the bug down. Before dropping on \`alreadyTracked\`, find the fix in the code and put **why it is present** in \`detail\`: the commit or PR that closed the issue and what it changed, or the guard, branch or test now in the file that makes the reported failure impossible. "Issue #412 covers this" is not a reason; "#412 was closed by 9f2c1a, which added the null check at auth.ts:88" is. If you cannot find the fix, or the issue is open and the code still does the wrong thing, **do not drop it**.

4. **Drop what is not worth anyone's attention** — steps 2 and 3 are "we have seen this", these four are the quality bar:
  - \`noReachableCaller\` — the scenario needs an input **no call site produces**, and the finder never named one. Grep for the callers and look. **Cheap and confident to check — do check it.**
  - \`alreadyTrue\` — the criterion it claims is unmet is in fact met, or the guard it says is missing is right there. Read the code and see. **Also cheap and confident — do check it.**
  - \`notADefect\` — style, naming, structure, duplication, preference. The refactor pass at the end of the run owns those.
  - \`runScaffolding\` — it targets **this run's own machinery** rather than the product: the test file the generator wrote minutes ago, turbo/CI wiring, build config this run touched only to make itself work.

5. **Cluster.** **${CLUSTER_THRESHOLD} or more** surviving findings in the **same file** are one under-designed module re-reported from every angle, not ${CLUSTER_THRESHOLD} independent defects. Collapse them into a **single design finding** against that module: name the deeper seam that is missing or wrong, let the symptoms be the evidence in \`mergedFrom\`, and set \`isCluster: true\`.

6. **Tag \`scope\`** by matching the finding's \`file\` against the task scopes above:
  - \`inScope\` — inside the **current** task's scope.
  - \`laterTask\` — inside some **other** task's declared scope. Set \`laterTaskId\`. These are ignored entirely; that task's own review catches them, on code that has stopped moving.
  - \`unscoped\` — inside **no** task's scope. Pre-existing code nobody in this run owns.

7. **Then set \`destination\`** — who has to *decide*, which is a different question from who owns the file:
${DESTINATION_DEF}

  Set \`needsHumanDecision\` yourself if the finder missed it and the fix plainly needs a call nobody's criteria make. ${HUMAN_DECISION_DEF}
  When you set it, write the \`humanQuestion\`: the decision, the options, what each costs.

## Guardrails

1. **The bar for dropping is asymmetric — read this twice.** A false *keep* costs one refuter agent. A false *drop* **silently deletes a real defect**. Worse, a tracked issue is a permanent skip signal, so a finding you wrongly match to an unrelated issue blinds every future run to that code — forever, with no error and no trace.
2. Drop only on a confident match, or a confident rubric hit you actually verified in the code. Same defect, same root cause, same file — not "sounds similar", not "same area of the code"; no caller you looked for and could not find, not "probably unreachable". When unsure, keep it and route it: \`file\` costs nothing and loses nothing, and a refuter kills a \`fixNow\` claim cheaply and honestly.
3. A finding that says "this assertion is vacuous" or "this behaviour is correct but nothing gates it" is **never** a drop. It is a real finding — route it to \`strengthenTest\`.
4. Record **every** drop in \`dropped\` with its reason and, where applicable, the issue number. A silent cap reads as "we found nothing" when it isn't, and that is exactly how a real bug ships.
5. **Degrade quietly** on the tracker arm: no git remote, no \`gh\` binary, or \`gh\` not authenticated → skip it entirely, set \`trackerAvailable: false\`, say so in \`warning\`, and carry on. Never fail, never retry in a loop, never treat a tracker outage as a finding.`,
          { schema: DEDUPE_SCHEMA, label: `dedupe:${task.id}.r${outer}`, effort: 'low' },
        )

        if (deduped) {
          survivors = deduped.survivors || []
          dropped = deduped.dropped || []
          // Unconditionally. It used to be read only when the tracker was down,
          // so every other thing triage had to say about a round — an arm it
          // skipped, a match it was unsure of — was discarded.
          if (deduped.warning) {
            warnings.push(`triage on ${task.id} round ${outer}: ${deduped.warning}`)
            log(`⚠️ Triage warning: ${deduped.warning}`)
          }
          if (deduped.trackerAvailable === false && trackerOk) {
            trackerOk = false
            warnings.push('issue tracker unavailable — issue filing disabled for the rest of the run')
            log('⚠️ Issue tracker unavailable — filing disabled for the rest of the run.')
          }
          log(`Dedupe: ${raw.length} raw → ${survivors.length} survivor(s), ${dropped.length} dropped (${dropped.map((d) => d.reason).join(', ') || '—'}).`)
        } else {
          // Dedupe dying must not silently discard a round's findings. They go
          // through with no destination tag; the routing below is mechanical
          // enough to place them from what the finder itself reported.
          survivors = raw.map((f) => ({ ...f, scope: 'inScope' }))
          warnings.push(`dedupe agent failed on ${task.id} round ${outer}; all ${raw.length} raw findings passed through untriaged`)
          log(`⚠️ Dedupe agent failed — passing ${raw.length} raw finding(s) through as inScope.`)
        }
      } else {
        log('No raw findings this round.')
      }

      // ---- 5. Route ----------------------------------------------------------
      // Four destinations, and only one of them gates or costs anything:
      //   fixNow         — in scope, evidence-backed, no product decision open.
      //                    Buys a refuter and, if it survives, gates the round.
      //   strengthenTest — the behaviour is right but nothing would catch it
      //                    regressing. There is no bug to kill, so no refuter.
      //   file           — predicted, or needs a human decision (at ANY scope),
      //                    or unscoped. Filed as an issue. Never blocks.
      //   drop           — the triage agent already removed it, with a reason.
      // The triage agent tags `destination`; the mechanical half of the rule is
      // re-applied here because it IS mechanical, and because nothing an agent
      // forgets to tag should be able to hand a product decision to a worker.
      // The re-application is deliberately one-directional — it can move a
      // finding AWAY from a worker but never toward one, so the agent's own
      // "I am not sure enough about this to have it fixed" always stands.
      //
      // A `laterTask` finding is ignored on one promise: the task that owns the
      // file has not run yet, so its own review will see it on code that has
      // stopped moving. The promise only holds if the id points FORWARD. An id
      // naming a task that already ran, or naming no task at all, means nobody
      // will ever look at it — so it is routed here like any other finding
      // instead of being dropped on the floor.
      const laterIds = new Set(tasks.slice(ti + 1).map((t) => t.id))
      const pointsForward = (f) => f.scope === 'laterTask' && laterIds.has(f.laterTaskId || '')
      const ignoredLater = survivors.filter(pointsForward)
      const misrouted = survivors.filter((f) => f.scope === 'laterTask' && !pointsForward(f))
      const toFix = []
      const toStrengthen = []
      const toFile = []

      for (const f of survivors) {
        if (pointsForward(f)) continue // that task's own review sees it, on code that has stopped moving
        const traced = f.evidence === 'reproduced' || f.evidence === 'traced-to-caller'
        if (f.destination === 'strengthenTest') toStrengthen.push(f)
        else if (f.destination === 'file' || f.scope === 'unscoped' || f.needsHumanDecision || !traced) toFile.push(f)
        else toFix.push(f)
      }

      if (misrouted.length) {
        warnings.push(
          `${task.id} round ${outer}: ${misrouted.length} finding(s) were tagged for a task that is not ahead of this one — adjudicated here instead of being ignored: ${misrouted
            .map((f) => `${f.file} → ${f.laterTaskId || '(no task id given)'}`)
            .join(', ')}`,
        )
        log(`⚠️ ${misrouted.length} finding(s) tagged \`laterTask\` name a task that has already run or does not exist — routing them now rather than trusting a review that will never happen.`)
      }

      if (survivors.length) {
        log(
          `Routed ${survivors.length} survivor(s): ${toFix.length} fix now, ${toStrengthen.length} strengthen a test, ${toFile.length} file` +
            `${toFile.filter((f) => f.needsHumanDecision).length ? ` (${toFile.filter((f) => f.needsHumanDecision).length} needing a human decision)` : ''}, ${ignoredLater.length} laterTask ignored.`,
        )
      }

      // ---- 6. Adjudicate -----------------------------------------------------
      // Refuters run on the fix-now bucket ALONE. That is where a refutation
      // changes an outcome: everywhere else the finding is already headed
      // somewhere that neither gates nor commits anyone to a fix, so killing it
      // buys nothing. Severity picks the model and the effort; scope is a
      // routing question and was already answered above. (It used to be tested
      // first, which quietly sent an unscoped P0 to one low-effort refuter.)
      const docket = toFix.map((f) => ({ f, ...(REFUTERS[f.severity] || REFUTERS.P1) }))

      let alive = []
      let killed = []

      // Refuting and filing are both the Adjudicate phase, and filing now
      // happens on rounds where nothing bought a refuter at all.
      if (docket.length || toFile.length) phase('Adjudicate')

      if (docket.length) {
        const judged = await parallel(
          docket.map((d) => () =>
            parallel(
              Array.from({ length: d.n }, (_, k) => () =>
                agent(
                  `${WORK_BRIEF}

Someone claims the code has this bug. **You did not find it and you do not believe it.** Your job is to **kill it**. The burden of proof is on the bug, not on you.

## The claim
- Severity (impact if it happens): ${d.f.severity}
- Location: ${d.f.file}${d.f.line ? `:${d.f.line}` : ''}
- Summary: ${d.f.summary}
- Claimed failure: ${d.f.failureScenario}
- The finder says it ${d.f.evidence === 'reproduced' ? '**reproduced** this — it ran it and watched it happen. Nothing checked that claim; check it.' : '**traced this to a real call site** and named the input that arrives there. Nothing checked that claim; check it — the caller may not exist, or may not pass what the finder says it does.'}
- Assertion that should hold: ${d.f.proposedTest}${d.f.isCluster ? `\n- This is a **design finding** covering several symptoms: ${(d.f.mergedFrom || []).join('; ')}. Refute it by showing the seam it names is not actually missing or not actually load-bearing — refuting one symptom does not refute the claim.` : ''}

If this survives, a worker fixes it and a regression test pins it — so a claim you let through wrongly costs a round of real work, and one you kill wrongly deletes a real defect with no trace but this evidence field.

## Workflow

1. Attack it. ${
    d.n === 1
      ? `You are the only refuter on this claim, so use both angles.
  - **Reachability.** Trace backwards from the claimed line to every caller. Can the claimed input actually arrive there? Look for the guard, the type, the validation, the caller invariant, or the framework behaviour that makes it impossible.
  - **Novelty and evidence.** Search the test suite for a test that already covers this behaviour — if one exists, the claim is void. Then try to *reproduce* it: write a throwaway script or scratch test and run it (\`${intake.testCommand}\`). If the reproduction comes back clean, the claim is dead.`
      : k % 2 === 0
        ? `**Attack reachability (angle ${k + 1}).** Trace backwards from the claimed line to every caller. Can the claimed input actually arrive there? Look for the guard, the type, the validation, the caller invariant, or the framework behaviour that makes it impossible. Find the thing that already prevents this.`
        : `**Attack novelty and evidence (angle ${k + 1}).** Search the test suite for a test that already covers this behaviour — if one exists, the claim is void. Then try to *reproduce* it: write a throwaway script or scratch test and run it (\`${intake.testCommand}\`). If the reproduction comes back clean, the claim is dead.`
  }
2. Use whichever angle proves decisive; the one above is just where to start.
3. Return a verdict:
  - \`refuted\` — the bug is not real. **This is your default.** If you cannot demonstrate the broken behaviour, or you are simply unsure, refute it.
  - \`stands\` — only when you genuinely tried to kill it and **failed**, and you can show the concrete path or output that proves it is real.
  - \`restate\` — the bug **is** real, but the assertion above is wrong: unsatisfiable as written, asserting the wrong thing, or pinning an implementation detail instead of the behaviour. Write the assertion that *should* have been proposed into \`correctedTest\`; the claim survives and re-enters the loop with yours in place of the original. It is not a softer refutation — reach for it only when the defect is real and the assertion is not.
4. Put what actually happened in \`evidence\`: the guard that prevents it, the test that covers it, or the command and output that proved it real.
5. Set \`severityCorrection\` if the reported severity is wrong on the impact scale: ${SEVERITY_DEF} It only adjusts severity: a correction never removes a finding, and it is ignored entirely when your verdict is \`refuted\`, because a refuted claim has no severity to correct.

## Guardrails

1. "I reviewed the code and it looks like a bug" is not evidence, and is not a reason to let a claim through.
2. Do not fix the bug. Do not modify production code.
3. Clean up any scratch files.`,
                  {
                    schema: REFUTE_SCHEMA,
                    phase: 'Adjudicate',
                    effort: d.effort,
                    model: d.model,
                    label: `refute:${(d.f.file || 'x').split('/').pop()}#${k + 1}`,
                  },
                ),
              ),
            ).then((votes) => {
              const cast = votes.filter(Boolean)
              const kills = cast.filter((v) => v.verdict === 'refuted')
              // Survives only if every refuter tried and failed to kill it.
              // A missing vote counts as a refutation — silence never promotes a bug.
              const survived = cast.length === d.n && !kills.length
              // `restate` is a survival with a corrected assertion: the bug goes
              // back into the round, but pinned by the refuter's test instead of
              // the one that could not hold.
              const restated = cast.find((v) => v.verdict === 'restate' && v.correctedTest)
              // A correction adjusts severity; only a refutation kills. Read it
              // from the votes that FAILED to kill the claim — a refuter that
              // killed it has by its own account established nothing about how
              // bad it would have been — and take the most severe, so a
              // correction can never demote a finding out of existence. It used
              // to be applied unconditionally and resolved by array order, which
              // made it a silent second kill path.
              const corrections = cast
                .filter((v) => v.verdict !== 'refuted' && v.severityCorrection)
                .map((v) => v.severityCorrection)
                .sort((x, y) => SEV_RANK[x] - SEV_RANK[y])
              return {
                ...d.f,
                severity: corrections.length ? corrections[0] : d.f.severity,
                proposedTest: restated ? restated.correctedTest : d.f.proposedTest,
                restated: !!restated,
                survived,
                survivedBecause: (cast.find((v) => v.verdict !== 'refuted') || {}).evidence || '',
                killedBy: (kills[0] || {}).evidence || (cast.length < d.n ? 'a refuter agent died without returning a verdict; a missing vote counts as a refutation' : ''),
              }
            }),
          ),
        )

        const adjudicated = judged.filter(Boolean)
        alive = adjudicated.filter((f) => f.survived)
        // Kept, with the evidence that killed each one. A wrongly killed finding
        // used to leave no trace anywhere outside `journal.jsonl`.
        killed = adjudicated.filter((f) => !f.survived)
        for (const f of adjudicated) seen.add(seenKey(f))
        const restatedCount = alive.filter((f) => f.restated).length
        log(
          `Adjudicated ${docket.length} claim(s) (${docket.reduce((s, d) => s + d.n, 0)} refuter agents) — ${alive.length} survived, ${killed.length} killed` +
            `${restatedCount ? `, ${restatedCount} restated by the refuter` : ''}. Ignored: ${ignoredLater.length} laterTask.`,
        )
      } else if (survivors.length) {
        log(`Nothing to adjudicate — no fix-now finding this round, and nothing else buys a refuter.`)
      }

      // ---- 7. File -----------------------------------------------------------
      // Filing used to fire for `unscoped` survivors ONLY, which meant scope
      // alone decided whether a human ever saw a finding — so an in-scope bug
      // whose fix needed a product decision was decided unilaterally by a
      // worker. It now fires for the whole File bucket whatever its scope, and
      // it still never blocks: the question is recorded, not waited on.
      const deferEntry = (f, issue) => ({
        severity: f.severity,
        file: f.file,
        summary: f.summary,
        evidence: f.evidence || '',
        reason: f.needsHumanDecision ? 'needs a human decision' : f.scope === 'unscoped' ? 'outside every task\'s scope' : 'predicted, not traced to a caller',
        question: f.needsHumanDecision ? f.humanQuestion || '(flagged as needing a decision, but no question was stated)' : '',
        issue: issue || '',
        task: task.id,
      })
      const recordFiled = (f, issue) => {
        const entry = deferEntry(f, issue)
        deferred.push(entry)
        if (issue) issuesFiled.push(entry)
        // A task can converge with this still open. It must not be reachable
        // only by digging through `deferred`, or a `passed` status hides it.
        if (f.needsHumanDecision) openQuestions.push(entry)
      }

      if (toFile.length && issueTracker !== 'none' && trackerOk) {
        const filed = await agent(
          `${WORK_BRIEF}

Your job is to file one issue per finding below, then stop. None of these is going to be fixed by this run — each needs a person. Write each issue so a human can **close it or accept it at a glance**.

## Findings to file (${toFile.length})
${toFile
            .map(
              (f, i) =>
                `### ${i + 1}. [${f.severity}] ${f.file}${f.line ? `:${f.line}` : ''}\n${f.summary}\n\n**Evidence:** ${f.evidence || 'unstated'}${
                  f.evidence === 'reproduced' ? ' — the finder ran it and saw it' : f.evidence === 'traced-to-caller' ? ' — the finder found a real call site passing the input' : ' — nobody traced this to a caller; it is reasoned, not observed'
                }${fmtFlags(f)}\n\n**Why it is filed rather than fixed:** ${
                  f.needsHumanDecision ? 'it needs a decision nobody in this run can make' : f.scope === 'unscoped' ? "it is outside the scope of every task in this run" : 'the failure was predicted rather than traced to a caller'
                }\n\n**Failure scenario:** ${f.failureScenario}\n\n**Assertion that should hold:** ${f.proposedTest}${
                  f.needsHumanDecision ? `\n\n**Decision needed:** ${f.humanQuestion || '(flagged as needing a decision, but no question was stated — say so in the issue rather than inventing one)'}` : ''
                }`,
            )
            .join('\n\n')}

## Workflow

1. **Search first** — \`gh issue list --search "..." --state all\`. If an issue already covers a finding, do not file a duplicate; return that issue's number instead.
2. \`gh issue create --title "..." --body "..."\`. Title: the one-line summary, prefixed with the file. Body: everything above for that finding — the evidence label and flags, why it is filed rather than fixed, the failure scenario, the assertion that should hold, and the decision needed — **verbatim**. The evidence label says how much the report is worth, the flags say whether it is worth acting on, and the question is the whole reason it is here rather than fixed.
3. Where a finding carries a **decision needed**, lead the body with it. That is the actionable part and the only thing blocking a fix.

## Guardrails

1. Change no source files.
2. **File and return — nothing waits for an answer.** Filing is how these stop being lost, and how future runs know to skip them instead of re-discovering and re-adjudicating them.
3. If \`gh\` is missing, unauthenticated, or there is no remote: file nothing, return an empty \`filed\` array, and explain in \`warning\`. Do not fail, do not retry in a loop, do not invent an issue number.`,
          { schema: ISSUE_SCHEMA, phase: 'Adjudicate', label: `file-issues:${task.id}.r${outer}`, effort: 'low' },
        )

        if (filed && filed.filed) {
          for (let i = 0; i < toFile.length; i++) {
            const f = toFile[i]
            const rec = filed.filed.find((x) => x.file === f.file && x.summary === f.summary) || filed.filed[i] || {}
            recordFiled(f, rec.issue || '')
            if (!rec.issue && rec.error) warnings.push(`issue filing failed for ${f.file}: ${rec.error}`)
          }
          if (filed.warning) {
            warnings.push(`issue filing: ${filed.warning}`)
            trackerOk = false
          }
          log(`Filed ${issuesFiled.length} issue(s) so far; ${toFile.length} finding(s) deferred this round.`)
        } else {
          for (const f of toFile) recordFiled(f, '')
          warnings.push(`issue filing agent failed on ${task.id} round ${outer}; ${toFile.length} finding(s) deferred without an issue`)
        }
      } else if (toFile.length) {
        for (const f of toFile) recordFiled(f, '')
        log(`${toFile.length} finding(s) deferred without filing (tracker ${issueTracker === 'none' ? 'disabled' : 'unavailable'}).`)
      }

      for (const f of toFile.filter((x) => x.needsHumanDecision)) {
        warnings.push(`${task.id}: open product question in ${f.file} — ${f.humanQuestion || f.summary} (filed, not answered; the run did not wait)`)
      }

      rounds.push({
        round: outer,
        outcome: 'reviewed',
        detail: '',
        testsAdded: testFiles,
        changedFiles: landedFiles,
        commit: commit && committed ? commit.sha || '' : '',
        outOfScope: strays,
        reviewFailures,
        raw: raw.length,
        afterDedupe: survivors.length,
        dropped: dropped.map((d) => ({ file: d.file, summary: d.summary, reason: d.reason, detail: d.detail, issue: d.issue || '' })),
        adjudicated: docket.length,
        survivors: alive.map((f) => ({ severity: f.severity, file: f.file, summary: f.summary, scope: f.scope, evidence: f.survivedBecause, restated: !!f.restated })),
        // A claim a refuter killed is a claim this run decided not to fix. When
        // that decision is wrong there is nothing left of the finding, so the
        // refuter's own evidence is kept here to be argued with afterwards.
        killed: killed.map((f) => ({ severity: f.severity, file: f.file, summary: f.summary, failureScenario: f.failureScenario, evidence: f.evidence || '', killedBy: f.killedBy })),
        strengthenTest: toStrengthen.map((f) => ({ file: f.file, summary: f.summary, proposedTest: f.proposedTest })),
        filed: toFile.map((f) => ({ severity: f.severity, file: f.file, summary: f.summary, scope: f.scope, evidence: f.evidence || '', needsHumanDecision: !!f.needsHumanDecision })),
        ignoredLaterTask: ignoredLater.map((f) => ({ file: f.file, summary: f.summary, task: f.laterTaskId || '' })),
      })

      // The strengthen bucket has been triaged, so a later round must not
      // re-find and re-route the same items.
      for (const f of toStrengthen) seen.add(seenKey(f))

      // Only the fix-now bucket gates. The strengthen bucket does not — but it
      // is still real work, and the only place it can be done is the next
      // round's test generator, so an otherwise-clean round with a strengthen
      // item still runs one more. That round writes no new red test and comes
      // back `alreadySatisfied`, which is convergence.
      if (!alive.length && !toStrengthen.length) {
        converged = true
        outcome = 'converged'
        // Convergence means this round left nothing open. `unresolved` still
        // holds the previous round's carried findings — every one of which was
        // just fixed and re-reviewed — and leaving them there reported a clean
        // task as having open findings.
        unresolved = []
        if (reviewFailures.length === LENSES.length) {
          warnings.push(`${task.id} converged on a round in which EVERY lens returned a failed review — nothing actually reviewed this task's final state`)
          log('⚠️ Every lens failed its review this round, so this convergence rests on no review at all.')
        }
        log(`✅ ${task.id} clean after ${outer} round${outer === 1 ? '' : 's'}: gate green, no finding survived refutation, nothing left to tighten.`)
        break
      }

      // Carry EVERY surviving fix-now finding. The old script carried only the
      // top 5, which throttled the fix rate below the discovery rate and is what
      // stalled the large runs.
      alive.sort((x, y) => SEV_RANK[x.severity] - SEV_RANK[y.severity])

      carried = alive.length ? alive : null
      strengthen = toStrengthen

      unresolved = alive
      log(
        `Carrying into ${task.id} round ${outer + 1}: ${alive.length} finding(s) to fix` +
          `${toStrengthen.length ? `, ${toStrengthen.length} assertion(s) to strengthen` : ''}.`,
      )
    }
  } catch (e) {
    // Anything the task threw — a dead agent, an unusable test batch, a worker
    // that could not satisfy its own tests, a bug in this script — stops at the
    // task boundary. Everything already landed stays landed.
    converged = false
    outcome = 'failed'
    failure = (e && e.message) || String(e)
    warnings.push(`${task.id} failed: ${failure}`)
    log(`⚠️ ${task.id} failed — ${failure}`)
    log(`Continuing to the next task. Worktree left at ${workRoot}${intake.branch ? ` (branch ${intake.branch})` : ''} for inspection.`)
  }

  if (outcome === 'unconverged') {
    // Do NOT throw. A task that did three rounds of real work and still has open
    // findings is unconverged, not an error — one recorded run threw away five
    // green rounds by reporting exhaustion as a failure.
    warnings.push(`${task.id} exhausted ${MAX_OUTER} rounds with ${unresolved.length} unresolved in-scope finding(s)`)
    log(`⚠️ ${task.id} unconverged after ${MAX_OUTER} rounds — ${unresolved.length} finding(s) still open. Continuing to the next task.`)
  }

  taskHistory.push({
    id: task.id,
    title: task.title,
    criteria: task.criteria || [],
    scope: task.scope || [],
    verificationOnly: !!task.verificationOnly,
    baseSha: taskBase,
    converged,
    outcome,
    failure,
    roundsRun: rounds.length,
    ungated,
    unresolved: unresolved.map((f) => ({ severity: f.severity, file: f.file, summary: f.summary, failureScenario: f.failureScenario, proposedTest: f.proposedTest })),
    rounds,
  })
}

// ---- Integrate -----------------------------------------------------------
// Everything here operates on the WHOLE run. No individual task could see any
// of it: cross-task duplication, integration defects, criteria that fall
// between two tasks.

phase('Integrate')

log(`── Integrate: ${taskHistory.length} task(s) landed ──`)

// Step 4 below still mandates a full `bash .claude/qa` run before this agent
// returns, even though `finalGate` runs the same full gate again right after
// it — unlike the worker, this one is deliberately NOT deduplicated. The
// worker's self-run was pure waste because the orchestrator's gate always
// follows it with a fix-up loop regardless of what the worker itself saw; the
// simplifier gets no such loop back (comment below: "Simplify never
// re-runs"), so its own run is the ONLY chance to see red before it returns
// and revert per guardrail 3. Skip it and a refactor that broke something
// would sail past this agent and only surface after it can no longer act.
const simplified = await agent(
  `${WORK_BRIEF}

Your job is a refactor-only pass over the whole run's diff. Follow the **simplify** skill. **No behaviour change, no new features, no new tests.**

## What to look at
\`${runDiffCmd}\` — the **entire** diff of this run, across all ${taskHistory.length} tasks:
${taskHistory.map((t, i) => `${i + 1}. [${t.id}] ${t.title}`).join('\n')}

## The Definition of Done — every one of these must still be true when you finish
${fmtCriteria(criteria)}

## Workflow

1. Hunt cross-task duplication. The tasks landed **serially and blind to each other**, so this is the only place it gets caught: the same logic written twice in two tasks' files, two differently-named helpers doing one thing, an abstraction an early task introduced that later tasks routed around instead of using, and dead code an early task added that a later task made unnecessary.
2. Apply the ordinary pass too — dead comments, deep nesting, unearned abstractions (**earned-abstractions**), shallow interfaces (**codebase-design**).
3. Before you collapse a duplicate, delete something you judge dead, or move a helper, check which criterion above the code you are touching serves. The gate does not protect you here — a criterion can be satisfied by code no test pins, so a refactor can break it and still come back green.
4. Run \`bash .claude/qa\` from \`${workRoot}\` yourself before you return. A full gate run is expensive, so make considered changes you have reasoned through rather than exploratory ones you intend to check by leaving. The workflow runs it again the moment you return, so you can neither argue it passed nor skip it.
5. **Commit your refactor as a single separate commit** and return its sha, so it stays revertable wholesale.

## Guardrails

1. **Behaviour must not change.** Not "should not" — must not. If a simplification requires a behaviour change to work, do not make it. A change that breaks one of the criteria above is a behaviour change, not a simplification: do not make it, and revert it if you already have.
2. Never delete or weaken a test.
3. **If the gate goes red, revert — never fix forward.** It was green before this pass started, so red now is proof your refactor changed behaviour. Undo the offending change; do not repair it, do not re-attempt it in another shape, do not touch the test. If you cannot isolate which change broke it, revert the whole pass — a valid and expected outcome, reported as \`reverted: true\`.
4. Doing nothing is a valid outcome. Say so rather than inventing churn.`,
  { schema: SIMPLIFY_SCHEMA, label: 'simplify', agentType: 'dev-loop-simplifier', ...MODEL },
)

// Simplify never re-runs. Its only sanctioned response to red is to undo its own
// change, so it either lands green or lands nothing — there is nothing to send it
// back to fix. But that is its story about itself, so the gate is run here too:
// this is the last look anybody takes at the finished worktree, and a red one
// must not be reported as a passed run.
//
// It is also the only phase that changes code and used not to be handed the
// criteria list, and it showed: a recorded pass broke a criterion because it had
// never been told the criterion existed.
if (simplified) {
  log(`Simplify: ${simplified.summary}`)
  if (simplified.reverted) {
    warnings.push(`simplify pass reverted itself — the refactor changed behaviour: ${simplified.summary}`)
    log("⚠️ Simplify reverted itself: the gate went red, so the refactor was undone. The run's implementation is unchanged and still green.")
  }
} else {
  warnings.push('simplify agent failed; the refactor pass was skipped')
  log('⚠️ Simplify agent failed — skipping the refactor pass. The implementation is unaffected.')
}

// No `scoped` here, deliberately: this is the run's one full, unscoped
// verification, and it must cover everything every task touched, not just
// what the simplify pass itself changed.
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

// Anything still uncommitted here is work this run produced and then lost: it is
// not on the branch, it is invisible to `git diff <base>...HEAD`, and a resume
// cannot reconstruct it. Cheap to ask, and it closes the whole class rather than
// the one path that caused it.
const dirty = await runDirtyCheck(workRoot)
let uncommittedWork = []
if (!dirty) {
  warnings.push('the uncommitted-work check failed to return — the branch may not hold everything this run produced')
} else if (dirty.error) {
  warnings.push(`the uncommitted-work check could not run (${dirty.error}) — the branch may not hold everything this run produced`)
} else if (!dirty.clean) {
  uncommittedWork = dirty.entries || []
  warnings.push(`${uncommittedWork.length} path(s) left UNCOMMITTED — not on the branch, invisible to every diff downstream, and unrecoverable by a resume: ${uncommittedWork.join('; ')}`)
  log(`⚠️ ${uncommittedWork.length} path(s) left uncommitted in ${workRoot}:\n${fmtList(uncommittedWork)}\nThis work is NOT on \`${intake.branch || 'the branch'}\`. Commit it or lose it.`)
} else {
  log('✅ Nothing uncommitted — the branch holds everything this run produced.')
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
          t.outcome === 'failed' ? ` — FAILED, never landed: ${t.failure}` : t.outcome === 'ungated' ? ' — LEFT UNGATED, no failing test could express it' : t.converged ? '' : ' — UNCONVERGED, has open findings'
        }`,
    )
    .join('\n')}

## Workflow

1. For **each** criterion, decide whether it is observably true in the finished code. Read the code; do not trust a task's summary. Anything not met goes in \`unmet\` with what is actually missing.
2. Flag criteria that are satisfied **but ungated** in \`ungatedButPresent\` — nothing would catch them regressing, because no test covers them or the file carrying them sits outside the tsconfig \`include\` / lint / test surface \`.claude/qa\` actually runs, so a typo would silently revert the behaviour with every check still green.
3. Report defects that exist **only between tasks** in \`integrationDefects\`. Every task validated its own criteria in isolation against its own slice of the diff, so a caller left on an old signature, two half-migrated code paths, or a criterion that needed two tasks and got half of each is invisible from inside any one of them.

## Guardrails

1. Never edit a file.
2. An empty \`unmet\` is the expected outcome and a fine answer — but only if you actually checked each criterion.
3. Do not pad, and do not report style opinions; a dedicated refactor pass already ran.`,
  { schema: REQUIREMENTS_SCHEMA, label: 'final-requirements', ...MODEL },
)

const unmetCriteria = (finalReq && finalReq.unmet) || []
if (finalReq) {
  for (const s of finalReq.ungatedButPresent || []) warnings.push(`ungated criterion: ${s}`)
  for (const s of finalReq.integrationDefects || []) warnings.push(`integration defect: ${s}`)
} else {
  warnings.push('final requirements agent failed; the finished work was never checked against the full criteria list')
}

// ---- Return --------------------------------------------------------------
// Never throw — not for non-convergence, and not for a task that died either.
//   incomplete  — the Definition of Done is not met (work missing, or a task failed).
//   unconverged — the work landed, but a task still has open findings.
//   passed      — criteria met, every task converged, the finished worktree is green.
//   failed      — only from the early returns above, where the run never started.
//
// A red final gate cannot be a `passed` run. That is the whole point of running
// the gate here rather than trusting a hook that never fired.
const failedTasks = taskHistory.filter((t) => t.outcome === 'failed')
const anyUnconverged = taskHistory.some((t) => !t.converged)
const coverageGap = uncovered.length > 0 || !!decomposed.warning
const status =
  unmetCriteria.length || coverageGap || failedTasks.length || finalGateRed || uncommittedWork.length ? 'incomplete' : anyUnconverged ? 'unconverged' : 'passed'

log(
  `${status === 'passed' ? '✅' : '⚠️'} Run ${status}: ${taskHistory.filter((t) => t.converged).length}/${taskHistory.length} task(s) converged, ` +
    `${failedTasks.length} failed, ${unmetCriteria.length} unmet criterion/criteria, ${deferred.length} deferred, ${issuesFiled.length} issue(s) filed, ${openQuestions.length} open product question(s), ${warnings.length} warning(s).`,
)

// A converged task can still leave a product question open — that is the point
// of filing rather than blocking, and it is exactly what a bare `passed` hides.
if (openQuestions.length) {
  log(
    `⚠️ ${openQuestions.length} open product question(s). Each was FILED, not answered, and the run did not wait for anybody:\n` +
      openQuestions.map((q) => `- [${q.task}] ${q.file}${q.issue ? ` (${q.issue})` : ' (not filed — no tracker)'}: ${q.question || q.summary}`).join('\n'),
  )
}

// ---- Clean up the worktree ------------------------------------------------
// A worktree is a full checkout plus its dependencies — around 2 GB in a typical
// repo — and nothing ever removed one, so 25 GB of abandoned run worktrees had
// piled up, 19 GB of it in a single repo. On a clean run the directory has no
// job left: every commit the run made lives on its branch, and removing a
// worktree never touches a branch. Anything less than clean keeps it, because
// the whole reason to keep it is to go and look at what went wrong.
const runBranch = intake.branch || ''
let worktreeRemoved = false
let branchNote = intake.isolated
  ? `The run's work is committed on branch \`${runBranch || '(unnamed)'}\`, in the worktree at ${workRoot}.`
  : `The run worked directly in ${workRoot} — there was no worktree to isolate it.`

if (status === 'passed' && intake.isolated && workRoot.includes('/.claude/worktrees/')) {
  const cleanup = await agent(
    `Your job is to remove one finished git worktree, and nothing else. You are a bookkeeping step, not a reasoning task.

## Workflow

Run these in order and **stop at the first one that does not pass**, leaving everything as it is.

1. \`cd ${workRoot}\`. Confirm that path contains \`/.claude/worktrees/\`. If it does not, remove nothing and say so in \`keptBecause\` — this run's own worktree is the only thing you may ever remove.
2. \`git rev-parse --abbrev-ref HEAD\` and \`git rev-parse HEAD\`. Return them as \`branch\` and \`headSha\` **before** you remove anything; they are how the work is found afterwards.
3. \`git status --porcelain\`. It must come back **empty**. Anything at all — a modified file, an untracked file — means work would be destroyed: keep the worktree, name what you saw in \`keptBecause\`, and stop.
4. Find the main checkout: \`git rev-parse --path-format=absolute --git-common-dir\` gives \`<repo>/.git\`, and its parent is the repo root. \`cd\` there — you cannot remove a worktree from inside it.
5. \`git worktree remove ${workRoot}\`, then \`git worktree prune\`. If it refuses because of ignored build output (\`node_modules\` and friends) and step 3 came back empty, \`--force\` is fine; if step 3 was not empty you are not here.
6. \`git worktree list\` to confirm \`${workRoot}\` is gone, and return \`removed: true\`.

## Guardrails

1. Never delete or move a branch. Removing a worktree deletes a directory and never a branch, and every commit this run made stays reachable from \`branch\` — that is the only reason this is safe.
2. Never \`rm -rf\` anything, never touch another entry in \`git worktree list\`, and never run \`git worktree remove\` on a path that is not the one above.
3. If anything surprises you, keep the worktree and say why. A couple of gigabytes of disk is far cheaper than work nobody can find again.`,
    { schema: CLEANUP_SCHEMA, label: 'cleanup-worktree', phase: 'Integrate', model: 'haiku', effort: 'low' },
  )

  if (!cleanup) {
    warnings.push(`the worktree cleanup step failed to return — ${workRoot} is still on disk`)
    log(`⚠️ Worktree cleanup failed to return. ${workRoot} is still on disk; remove it by hand with \`git worktree remove\` when you are done with it.`)
  } else if (cleanup.removed) {
    worktreeRemoved = true
    branchNote = `The run passed, so its worktree was removed. Every commit it made is on branch \`${cleanup.branch || runBranch || '(unnamed)'}\`${
      cleanup.headSha ? ` at ${cleanup.headSha.slice(0, 8)}` : ''
    } — check it out or open a PR from it. Nothing was deleted but the directory.`
    log(`🧹 Worktree removed. The work is on branch \`${cleanup.branch || runBranch}\`${cleanup.headSha ? ` @ ${cleanup.headSha.slice(0, 8)}` : ''} — the branch and its commits are untouched.`)
  } else {
    warnings.push(`the worktree was kept: ${cleanup.keptBecause || cleanup.error || 'no reason given'}`)
    log(`⚠️ Worktree kept at ${workRoot}: ${cleanup.keptBecause || cleanup.error || 'no reason given'}`)
  }
} else if (intake.isolated) {
  branchNote += ` It was kept because the run is \`${status}\` — read it, fix it, or remove it yourself with \`git worktree remove ${workRoot}\` once you are done. Removing it would not touch the branch.`
}

return result({
  status,
  // `reason` used to read from failed tasks and the final gate alone, so a run
  // held back purely by an unmet criterion returned `incomplete` with an EMPTY
  // reason and the explanation reachable only by digging into `unmetCriteria`.
  // Every condition that can produce a non-passing status now says so here.
  reason: [
    failedTasks.length ? `${failedTasks.length} task(s) failed and never landed: ${failedTasks.map((t) => `${t.id} (${t.failure})`).join('; ')}` : '',
    finalGateRed ? 'The finished worktree does not pass `.claude/qa`. Do not open a PR from it until it is green.' : '',
    uncommittedWork.length
      ? `${uncommittedWork.length} path(s) were left uncommitted and are NOT on the branch: ${uncommittedWork.join('; ')}. Commit them before doing anything else — a resume cannot recover them.`
      : '',
    unmetCriteria.length ? `${unmetCriteria.length} acceptance criterion/criteria not met (${unmetCriteria.map((c) => `#${c.n}`).join(', ')}) — see \`unmetCriteria\` for what is missing.` : '',
    uncovered.length ? `${uncovered.length} criterion/criteria had no owning task: ${uncovered.map((c) => `#${c.n}`).join(', ')}.` : '',
    decomposed.warning ? `Decomposition could not cover the whole plan: ${decomposed.warning}` : '',
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
  uncommittedWork,
  deferred,
  issuesFiled,
  openQuestions,
})
