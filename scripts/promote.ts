#!/usr/bin/env bun
// Promote one skill to the public checkout of vimulatus/skills, then commit it there.
//   bun run scripts/promote.ts <skill>                  SKILLS_REPO overrides the checkout path
//   bun run scripts/promote.ts <skill> --stage          copy the skill to a temp dir, patch applied, and print it
//   bun run scripts/promote.ts <skill> --patch <dir>    write public/<skill>.patch from the edited copy
// The public copy is derived: "Vasu" becomes "the user", the category level folds away, and
// public/<skill>.patch holds what the public copy says differently. Edit the source here or the patch.
import { $ } from "bun"
import { createHash } from "node:crypto"
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

type Entry = { rel: string; bytes: Uint8Array; exec: boolean }

const utf8 = new TextDecoder("utf-8", { fatal: true })

// "Vasu" becomes "the user", capitalized where a sentence starts. Idempotent.
export function rename(text: string): string {
  return text.replace(/\bVasu\b/g, (_, offset: number, whole: string) => {
    const sentenceStart = /(?:^|[\n.!?|])[ \t]*(?:[-*]|\d+\.)?[ \t]*(?:\*\*|_)?$/.test(whole.slice(0, offset))
    return sentenceStart ? "The user" : "the user"
  })
}

// Rewrite one file's text for the public repo: the rename, and links that fold the category level away.
export function publish(text: string, categories: string[]): string {
  const crossCategory = new RegExp(`\\.\\./\\.\\./(?:${categories.join("|")})/`, "g")
  return rename(text).replace(crossCategory, "../")
}

function walk(dir: string, rel = ""): Entry[] {
  return readdirSync(join(dir, rel), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((d) => {
      const path = join(rel, d.name)
      if (d.isDirectory()) return walk(dir, path)
      const bytes = readFileSync(join(dir, path))
      return [{ rel: path, bytes, exec: (statSync(join(dir, path)).mode & 0o111) !== 0 }]
    })
}

function publishEntry(entry: Entry, categories: string[]): Entry {
  try {
    return { ...entry, bytes: Buffer.from(publish(utf8.decode(entry.bytes), categories)) }
  } catch {
    return entry
  }
}

function treeHash(entries: Entry[]): string {
  const h = createHash("sha256")
  for (const e of entries) h.update(`${e.rel}\0${e.exec ? "x" : "-"}\0`).update(e.bytes).update("\0")
  return h.digest("hex")
}

// Write the published form of `source` into `target` when the two differ.
export function promote(source: string, target: string, categories: string[]): "updated" | "unchanged" {
  const wanted = walk(source).map((e) => publishEntry(e, categories))
  const current = existsSync(target) ? walk(target) : []
  if (treeHash(wanted) === treeHash(current)) return "unchanged"

  rmSync(target, { recursive: true, force: true })
  for (const e of wanted) {
    mkdirSync(dirname(join(target, e.rel)), { recursive: true })
    writeFileSync(join(target, e.rel), e.bytes)
    if (e.exec) chmodSync(join(target, e.rel), 0o755)
  }
  return "updated"
}

// Copy `source` to a fresh dir and apply `patch` to it. With `reject`, hunks that fail land as .rej files.
export async function stage(source: string, patch?: string, reject = false): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "promote-"))
  cpSync(source, dir, { recursive: true })
  if (patch) await $`git -C ${dir} apply -p2 ${reject ? ["--reject"] : []} ${patch}`.quiet()
  return dir
}

// Write the diff from `source` to `edited` as a patch that `stage` applies.
export async function writePatch(source: string, edited: string, out: string) {
  const dir = mkdtempSync(join(tmpdir(), "promote-"))
  cpSync(source, join(dir, "a"), { recursive: true })
  cpSync(edited, join(dir, "b"), { recursive: true })
  const diff = await $`git -C ${dir} diff --no-index a b`.nothrow().quiet()
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, diff.stdout)
}

// Every markdown link in `dir` that leaves the file and lands nowhere.
function danglingLinks(dir: string): string[] {
  return walk(dir).flatMap((e) => {
    if (!e.rel.endsWith(".md")) return []
    const text = utf8.decode(e.bytes)
    return [...text.matchAll(/\]\(([^)#:</][^)#:<]*)\)/g)]
      .map((m) => m[1])
      .filter((link) => !existsSync(resolve(dir, dirname(e.rel), link)))
      .map((link) => `${e.rel} -> ${link}`)
  })
}

if (import.meta.main) {
  const [name, flag, edited] = process.argv.slice(2)
  if (!name || (flag === "--patch" && !edited)) {
    console.error("usage: bun run scripts/promote.ts <skill> [--stage | --patch <dir>]")
    process.exit(2)
  }

  const root = resolve(import.meta.dir, "..")
  const categories = readdirSync(join(root, "skills"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  const sources = categories.map((c) => join(root, "skills", c, name)).filter((p) => existsSync(join(p, "SKILL.md")))
  if (sources.length !== 1) {
    console.error(sources.length ? `${name} is in more than one category` : `no skill named ${name} under skills/`)
    process.exit(1)
  }

  const patchPath = join(root, "public", `${name}.patch`)
  const patch = existsSync(patchPath) ? patchPath : undefined
  if (flag === "--stage") {
    console.log(await stage(sources[0], patch, true))
    process.exit(0)
  }
  if (flag === "--patch") {
    await writePatch(sources[0], edited, patchPath)
    console.log(`wrote ${patchPath}`)
    process.exit(0)
  }
  const staged = await stage(sources[0], patch).catch(() => {
    console.error(`${patchPath} no longer applies. Rebuild it: --stage, resolve the .rej files in that dir, then --patch <dir>`)
    process.exit(1)
  })

  const repo = process.env.SKILLS_REPO ?? resolve(root, "..", "skills")
  if (!existsSync(repo)) await $`gh repo clone vimulatus/skills ${repo}`
  const branch = (await $`git -C ${repo} branch --show-current`.text()).trim()
  if (branch !== "main") {
    console.error(`${repo} is on ${branch}, not main`)
    process.exit(1)
  }
  if ((await $`git -C ${repo} status --porcelain`.text()).trim()) {
    console.error(`${repo} has uncommitted changes`)
    process.exit(1)
  }
  await $`git -C ${repo} pull -q --ff-only`

  const target = join(repo, "skills", name)
  if (promote(staged, target, categories) === "unchanged") {
    console.log(`${name} is up to date`)
    process.exit(0)
  }

  for (const link of danglingLinks(target)) console.warn(`dangling link: ${link}`)
  const sha = (await $`git -C ${root} rev-parse --short HEAD`.text()).trim()
  await $`git -C ${repo} add ${target}`
  await $`git -C ${repo} commit -q -m ${`feat(${name}): promote from agentic@${sha}`}`
  console.log(`promoted ${name}; run scripts/release.sh in ${repo} to push`)
}
