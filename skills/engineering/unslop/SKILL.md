---
name: unslop
description: "Cut the tells that mark code as machine written: narrating comments, unearned abstraction, defensive scaffolding. Use whenever you write or edit code, and on the diff before you report done."
---

# Unslop

Remove comments, abstractions and defensive code that add no useful information or behavior. Follow the repo's conventions and the standards below.

## Comments

The density rule stands: a concise line above a function, a class, or an exported type, saying how it is used. Inside the body, the code speaks.

| Keep | Cut |
|---|---|
| The doc line above a function, class, or exported type | Narration of the next statement |
| A constraint from outside our code: a vendor bug, a protocol quirk, a platform limit. Link the issue. | A banner or a section divider |
| A legal or license header | Commented-out code |
| A lint suppression whose rule is style-only | Change history: "was X, now Y", "updated to handle Z" |
| | A sermon defending a workaround |

A comment that explains our own code is a bug report against the code. Rename the symbol, extract the function, or add the type until the comment says nothing new. Then delete the comment.

`@ts-ignore`, `# type: ignore`, `eslint-disable`: read the rule first. If it catches real bugs, fix the code. If you cannot fix it, say so in your report, not in a comment.

## Code

| Slop | Instead |
|---|---|
| `try`/`catch` around code with no known failure | Let it throw. Catch only the failure you can name. |
| A fallback that swallows the error and returns a default | Fail loud, where the caller sees it |
| A guard for a state that cannot happen | Trust the type |
| An interface, a factory, or a config object justified only by hypothetical reuse | Write the one thing |
| `processV2`, `enhanced_parse`, `SmartCache`, `parse_new` | Edit the original in place |
| A parameter or a flag nobody passes yet | Add it when the second caller arrives |
| A compat shim for an API with no external user | Delete the old path |
| A hand-rolled copy of something the repo or the stdlib has | Search first, then call it |
| `✅ Done!`, emoji log lines, progress banners | The value, or nothing |
| A new `SUMMARY.md` or `IMPLEMENTATION_NOTES.md` after a change | The commit message |

Derive a test from the requirement. A test that asserts a mock returned what the mock was told to return proves nothing.

## Words

Every string you write is copy: comments, commit messages, log lines, error text, UI text.

Keep text that helps its intended reader understand the behavior or make a decision. Remove narration of the agent's process.

Your own reasoning is the usual offender. You settle something while building, then ship the rationale as a caption, a log line, or a paragraph in the PR body. The reader was not in the room and does not need to be. Ship the conclusion.

Load the `copy` skill for the two tests and the table of tells. It owns them.

## Before you report done

Check the diff against the comment, code and copy standards above; remove unsupported additions.
