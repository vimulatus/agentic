import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, chmodSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promote, publish, stage, writePatch } from "./promote"

const categories = ["engineering", "productivity"]

describe("publish", () => {
  test.each([
    ["Ask Vasu when progress requires a decision.", "Ask the user when progress requires a decision."],
    ["Vasu merges, never you.", "The user merges, never you."],
    ["| Vasu corrects you once | Apply it |", "| The user corrects you once | Apply it |"],
    ['Smallest first. Vasu: "pick the small ones."', 'Smallest first. The user: "pick the small ones."'],
    ["**Stage:** <where it is, in Vasu's words>", "**Stage:** <where it is, in the user's words>"],
    ["- Vasu and the agents", "- The user and the agents"],
    ["description: Grill Vasu relentlessly", "description: Grill the user relentlessly"],
    ["[Claude Code](../../engineering/orchestrate/references/claude.md)", "[Claude Code](../orchestrate/references/claude.md)"],
    ["[Codex](../orchestrate/references/codex.md)", "[Codex](../orchestrate/references/codex.md)"],
  ])("%s", (source, expected) => {
    expect(publish(source, categories)).toBe(expected)
  })

  test("is idempotent", () => {
    const once = publish("Vasu says stop. Vasu's call.", categories)
    expect(publish(once, categories)).toBe(once)
  })
})

describe("promote", () => {
  const scratch = () => mkdtempSync(join(tmpdir(), "promote-"))

  const seed = (dir: string) => {
    mkdirSync(join(dir, "scripts"), { recursive: true })
    writeFileSync(join(dir, "SKILL.md"), "# Coding\n\nHow Vasu wants code written.\n")
    writeFileSync(join(dir, "scripts", "run.sh"), "#!/bin/sh\necho hi\n")
    chmodSync(join(dir, "scripts", "run.sh"), 0o755)
  }

  test("writes the published tree once, then reports it unchanged", () => {
    const source = scratch()
    const target = join(scratch(), "coding")
    seed(source)

    expect(promote(source, target, categories)).toBe("updated")
    expect(readFileSync(join(target, "SKILL.md"), "utf8")).toBe("# Coding\n\nHow the user wants code written.\n")
    expect(statSync(join(target, "scripts", "run.sh")).mode & 0o111).not.toBe(0)

    expect(promote(source, target, categories)).toBe("unchanged")
  })

  test("a source edit or a stale target file makes the copy stale", () => {
    const source = scratch()
    const target = join(scratch(), "coding")
    seed(source)
    promote(source, target, categories)

    writeFileSync(join(target, "stale.md"), "left over\n")
    expect(promote(source, target, categories)).toBe("updated")
    expect(readdirSync(target)).not.toContain("stale.md")

    writeFileSync(join(source, "SKILL.md"), "# Coding\n\nA new line.\n")
    expect(promote(source, target, categories)).toBe("updated")
    expect(readFileSync(join(target, "SKILL.md"), "utf8")).toBe("# Coding\n\nA new line.\n")
  })
})

describe("stage", () => {
  test("applies the patch written from an edited copy, deletions included", async () => {
    const source = mkdtempSync(join(tmpdir(), "promote-"))
    mkdirSync(join(source, "scripts"))
    writeFileSync(join(source, "SKILL.md"), "# Evidence\n\nHost it with fs.\n")
    writeFileSync(join(source, "scripts", "host.sh"), "fs put\n")

    const edited = mkdtempSync(join(tmpdir(), "promote-"))
    writeFileSync(join(edited, "SKILL.md"), "# Evidence\n\nAttach it with gh.\n")

    const patch = join(mkdtempSync(join(tmpdir(), "promote-")), "evidence.patch")
    await writePatch(source, edited, patch)
    const staged = await stage(source, patch)

    expect(readFileSync(join(staged, "SKILL.md"), "utf8")).toBe("# Evidence\n\nAttach it with gh.\n")
    expect(existsSync(join(staged, "scripts", "host.sh"))).toBe(false)
    expect(await stage(source)).not.toBe(source)
  })
})
