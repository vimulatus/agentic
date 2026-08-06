---
name: grilling
description: A relentless interview that stress-tests a plan or design before you build it — walking the decision tree until you reach shared understanding. Use when the user wants to pressure-test a plan, think through a design, or uses any 'grill' trigger phrase.
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.

Put the questions to me in **rounds**. A round is a set of **orthogonal** decisions — no answer changes another's options — asked together in one AskUserQuestion call, at most four. If answering one would make another moot or reword it, they belong in different rounds.

Most rounds are one question. That is the honest size of a dependent chain; never pad a round to fill it. Wait for the whole round before continuing, then re-walk the tree — answers prune branches and surface decisions that weren't visible before.

Everything the plan turns on falls into three piles:

- **Facts** — findable in the codebase, the project's docs, or a primary source. Look them up; don't ask me.
- **Decisions** — mine, but only the **load-bearing** ones: where the other option leads to a materially different plan. Put those to me with your recommendation. Everything else you settle yourself on your own recommendation — state what you took and why in the message alongside the round, so I can overturn any I care about. A round I'd answer by shrugging is a round you shouldn't have asked.
- **Lessons** — a concept a decision rests on that I may not hold: a domain concept, a system-design concept, a UI pattern. A decision I can't make isn't a decision yet — it's a lesson I haven't had.

**Teach the lesson before you put the decision.** Ground it from any resources you have available — the codebase, the project's own docs, primary sources, design references — never hand-waved from your own memory. Make it concrete: a worked example, a reference to react to, a throwaway prototype, over an abstract description. Keep it to the one idea the decision turns on. Then check it landed — I should be able to say the concept and its tradeoff back in my own words — before you put the decision to me. A decision resting on a lesson never shares a round.

Never put a **what-if** to me — a failure you imagined and want defended against. *Possible* is a bar everything clears, so pointing at the line of code that produces one earns it nothing. A what-if is load-bearing only when it is likely in normal use, expensive when it lands — data lost, money wrong, user stuck, not a retry — and a one-way door: materially cheaper to handle now than on the day it bites. Almost none are all three; assume those away and let them break, at most one line in the plan as a known gap. We are building the smallest thing that is good enough, not a system without holes. The rare what-if that clears all three still isn't a question — say what happens, how often, what it costs, and what you'd do, then let me overturn you.

When an answer kills an assumption the plan's structure rests on, do not patch around it — that is how a grill starts circling. Invoke the `reset` skill.

Do not enact the plan until I confirm we have reached a shared understanding.
