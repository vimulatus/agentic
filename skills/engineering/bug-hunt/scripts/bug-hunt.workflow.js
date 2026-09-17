// Bug hunt as a Workflow: environment and personas in parallel, one hunter per persona, one dedupe.
// Called from references/claude.md with args:
//   { task, app, area, repo, skillDir, evidenceDir, taskDir, maxPersonas }
// Every worker reads its own brief from <skillDir>/references/; this script only carries the run.
export const meta = {
  name: 'bug-hunt',
  description: 'Hunt a running web app for bugs with one agent per persona, then dedupe into one report',
  phases: [
    { title: 'Prepare', detail: 'environment and personas, in parallel', model: 'opus' },
    { title: 'Hunt', detail: 'one hunter per persona', model: 'sonnet' },
    { title: 'Report', detail: 'dedupe and write the report', model: 'sonnet' },
  ],
}

const { task, app, area, repo, skillDir, evidenceDir, taskDir } = args
const maxPersonas = args.maxPersonas ?? 5
const refs = `${skillDir}/references`
const common = [
  `Task: ${task}. Repo: ${repo}. Task directory: ${taskDir}.`,
  `<skill-dir> is ${skillDir}. <evidence-dir> is ${evidenceDir}. Skill scripts live under those two directories.`,
  'Read-only on the repo. Nothing lands in it; everything lands under the task directory.',
  'Do not read the app\'s source.',
].join('\n')

const ENV_SCHEMA = {
  type: 'object',
  properties: {
    baseUrl: { type: 'string' },
    startedBy: { type: 'string', enum: ['me', 'user'] },
    stopCommand: { type: ['string', 'null'] },
    authState: { type: 'string', enum: ['restored', 'saved', 'none', 'required'] },
    authStatePath: { type: ['string', 'null'] },
    landing: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['baseUrl', 'startedBy', 'stopCommand', 'authState', 'authStatePath', 'landing', 'notes'],
}

const PERSONAS_SCHEMA = {
  type: 'object',
  properties: {
    personas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          who: { type: 'string' },
          goals: { type: 'array', items: { type: 'string' } },
          startsAt: { type: 'string' },
          traits: { type: 'array', items: { type: 'string' } },
        },
        required: ['slug', 'who', 'goals', 'startsAt', 'traits'],
      },
    },
    coverage: { type: 'string' },
  },
  required: ['personas', 'coverage'],
}

const FINDING = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    class: { type: 'string', enum: ['functional', 'performance', 'navigation', 'visual', 'content'] },
    where: { type: 'string' },
    current: { type: 'string' },
    expected: { type: 'string' },
  },
  required: ['title', 'class', 'where', 'current', 'expected'],
}

const HUNT_SCHEMA = {
  type: 'object',
  properties: {
    persona: { type: 'string' },
    findingsPath: { type: 'string' },
    findings: { type: 'array', items: FINDING },
    goals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          goal: { type: 'string' },
          outcome: { type: 'string', enum: ['reached', 'reached slowly', 'not found', 'blocked'] },
        },
        required: ['goal', 'outcome'],
      },
    },
    blocked: { type: ['string', 'null'] },
  },
  required: ['persona', 'findingsPath', 'findings', 'goals', 'blocked'],
}

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    reportPath: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          class: { type: 'string' },
          where: { type: 'string' },
          seenBy: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'class', 'where', 'seenBy'],
      },
    },
    merged: { type: 'number' },
    dropped: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, why: { type: 'string' } },
        required: ['title', 'why'],
      },
    },
  },
  required: ['reportPath', 'findings', 'merged', 'dropped'],
}

// Barrier: a hunter needs the environment and its persona together.
const [env, cast] = await parallel([
  () => agent(
    `${common}\nApp: ${app}.\nRead ${refs}/environment.md and do what it says. Return exactly its Return object.`,
    { label: 'environment', phase: 'Prepare', model: 'opus', schema: ENV_SCHEMA },
  ),
  () => agent(
    `${common}\nArea named by Vasu: ${area || 'none'}. Maximum personas: ${maxPersonas}.\nRead ${refs}/personas.md and do what it says. Return exactly its Return object.`,
    { label: 'personas', phase: 'Prepare', model: 'opus', schema: PERSONAS_SCHEMA },
  ),
])

if (!env) {
  log('The environment worker returned nothing. No hunt.')
  return { env: null, personas: cast?.personas ?? [], hunts: [], report: null }
}
if (!cast?.personas?.length) {
  log('The personas worker returned nothing. No hunt.')
  return { env, personas: [], hunts: [], report: null }
}

const personas = cast.personas.slice(0, maxPersonas)
if (cast.personas.length > personas.length) {
  log(`Dropped ${cast.personas.length - personas.length} persona(s) past the maximum of ${maxPersonas}: ${cast.personas.slice(maxPersonas).map(p => p.slug).join(', ')}`)
}
log(`${env.baseUrl}, server started by ${env.startedBy}, auth ${env.authState}. ${personas.length} persona(s): ${personas.map(p => p.slug).join(', ')}`)

// Barrier: dedupe needs every hunter's findings at once.
const hunts = (await parallel(personas.map(p => () => agent(
  [
    common,
    `Environment: ${JSON.stringify(env)}`,
    `Your persona: ${JSON.stringify(p)}`,
    `Your directory: ${taskDir}/${p.slug}/`,
    `Read ${refs}/hunter.md and do what it says. Return exactly its Return object.`,
  ].join('\n'),
  { label: `hunt:${p.slug}`, phase: 'Hunt', model: 'sonnet', schema: HUNT_SCHEMA },
)))).filter(Boolean)

const lost = personas.length - hunts.length
if (lost) log(`${lost} hunter(s) returned nothing; their findings are not in the report.`)
const raw = hunts.reduce((n, h) => n + h.findings.length, 0)
log(`${raw} finding(s) from ${hunts.length} hunter(s), before dedupe.`)

if (!raw) {
  return { env, personas, hunts, report: null }
}

const report = await agent(
  [
    common,
    `Hunter returns: ${JSON.stringify(hunts)}`,
    `Report path: ${taskDir}/report.md`,
    `Read ${refs}/dedupe.md and do what it says. Return exactly its Return object.`,
  ].join('\n'),
  { label: 'dedupe', phase: 'Report', model: 'sonnet', schema: REPORT_SCHEMA },
)

return { env, personas, hunts, report }
