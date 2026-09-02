---
name: grilling
description: Grill Vasu relentlessly about a plan, a decision, or an idea. Use when Vasu wants a plan stress-tested, or says grill.
---

# Grilling

Interview Vasu relentlessly until you reach a shared understanding.

Map the work as a **design tree**: every decision branches into the decisions that hang off it. The **frontier** is every decision whose prerequisites are settled. Ask the whole frontier in one **round**, then wait.

| Rule | Because |
|---|---|
| One round holds the whole frontier | Vasu answers once, not question by question |
| Every question carries your recommended answer | Vasu answers by exception |
| A question that waits on another open question goes to a later round | Its answer would be a guess |
| A fact from the environment goes to a subagent, never to Vasu | Facts are your job. Decisions are Vasu's |
| A running subagent blocks only the questions downstream of it | Ask the rest of the frontier now |

```
❓ **Q1** - **<title>**: <question, with the choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<title>**: ...
```

Each answered round pushes the frontier outward. Recompute it and ask the next round.

Done when the frontier is empty: every branch visited, nothing left silently assumed. Act only after Vasu confirms the shared understanding.
