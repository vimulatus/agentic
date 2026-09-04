#!/usr/bin/env bash
# Route a prompt to the skill its words name. UserPromptSubmit.
# A description fires when the model chooses. This fires every time the words match.
# First match wins. A prompt that starts with / or ! is already routed.
set -u
payload=$(cat)
prompt=$(jq -r '.prompt // ""' <<<"$payload" 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr '\n' ' ')
[ -n "$prompt" ] || exit 0
case "$prompt" in /*|!*) exit 0 ;; esac

route() {   # route <regex> <skill> <what it reads as>
  grep -qE "$1" <<<"$prompt" || return 1
  jq -n --arg t "This reads as $3. Load \`vimulatus:$2\` before you act." \
    '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$t}}'
  exit 0
}

route '\b(review|look at|go through)\b.*\b(pr|prs|pull request|#[0-9]+)\b'                                   review     'a review of a PR someone else opened'
route '\b(deploy|release|cut a (new )?(release|version)|publish (the|a|to)|ship it)\b'                       ship       'a change to take to users'
route '\b(file|create|open|raise|log) (an? |the |new )?(issue|ticket)s?\b'                                   to-tickets 'an issue to file'
route '\b(what.?s left|what is left|where (are|were) we|remind me|what was this|catch me up|resume)\b'       status     'a return to a project'
route '\b(i.?m (completely )?blank|i am (completely )?blank|explain .* (basics|from scratch)|teach me|walk me through)\b' teach 'a topic to teach, not code to write'
route '\b(landing page|(design|style|restyle|redesign|polish|mock ?up) (the |a |an |this |my |me a |our )?([a-z-]+ ){0,2}(page|screen|ui|component|layout|dashboard|form|hero|nav|homepage|site))\b' taste 'a screen to design'
route '\b(looks?|feels?) (too |very |kinda |a bit )?(generic|boring|ugly|templated|dated|bland|off|like ai)\b|\bmake it (look|feel) (better|nicer|good|great|premium|polished|less generic)\b' taste 'a screen to design'
route '\b(new feature|build (a|an|the|me) |plan (this|the|a|it|out)|break (this|it) (down|into)|in phases|roadmap|slices?)\b' wayfinder 'work bigger than one ticket'
route '\b(bug|broken|not working|doesn.?t work|fail(s|ing|ed)|regression|flaky|crash(es|ed|ing)?)\b'         red-green  'a bug or a failing check'
exit 0
