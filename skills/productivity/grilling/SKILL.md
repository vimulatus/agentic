---
name: grilling
description: Grill Vasu relentlessly about a plan, a decision, or an idea. Use when Vasu wants a plan stress-tested, or says grill.
---

# Grilling

Grill Vasu relentlessly on the decisions that carry weight. Decide the rest yourself.

Map the work as a **design tree**: every decision branches into the decisions that hang off it. The **frontier** is every decision whose prerequisites are settled. Split the frontier: the load-bearing decisions go to Vasu in one **round**, the rest you settle.

## Load-bearing

A decision is load-bearing when a wrong answer is expensive to undo, or when only Vasu holds the answer.

| Ask Vasu | Settle it yourself |
|---|---|
| What the product does, and for whom | How the code does it |
| The data model, the contract, who owns what | The library, the file layout, the naming |
| A one-way door: a migration, a vendor, a public API | Anything a later diff can change |
| A trade-off Vasu prices: cost, scope, who gets cut | An edge case with a safe default |
| Where the plan contradicts itself, or the product | A gap a reasonable assumption closes |

Vasu does not hold the tech stack, and does not want to. A question he would answer with "you decide" was never load-bearing.

The filter cuts the volume, not the depth. Grill hard on what passes it: push back, take the other side, find the contradiction.

## Words

Use the words Vasu typed, and the names the code already has. A word Vasu has to ask about costs a round.

## The round

| Rule | Because |
|---|---|
| One round holds the whole load-bearing frontier | Vasu answers once, not question by question |
| Every question carries your recommended answer | Vasu answers by exception |
| A question that waits on another open question goes to a later round | Its answer would be a guess |
| A fact from the environment goes to a subagent, never to Vasu | Facts are your job. Decisions are Vasu's |
| A running subagent blocks only the questions downstream of it | Ask the rest of the frontier now |

Present the questions with recommended answers and any assumptions whose consequences Vasu should know. Use the available question interface when it suits the decision.

Each answered round pushes the frontier outward. Recompute it and ask the next round.

Proceed when the load-bearing decisions needed for the action are settled. Record material assumptions and continue independent work while an answer is pending. Do not seek another confirmation for decisions Vasu has already made.
