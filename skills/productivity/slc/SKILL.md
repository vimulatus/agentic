---
name: slc
description: Define and preserve Simple, Lovable, Complete product releases. Use when shaping a product, scoping an MVP or first release, cutting features, or judging release readiness. Not for a bug or an infrastructure chore.
---

# SLC

SLC is Vasu's default for product work. Use it to choose the destination of a release and to judge changes to that destination.

Based on Jason Cohen's [Your customers hate MVPs. Make a SLC instead.](https://longform.asmartbear.com/slc/), adapted to Vasu's planning and building skills.

## The standard

- **Simple:** narrow the users and the job until the release ships quickly. Be clear about its limits.
- **Lovable:** give those users a reason to prefer it now: ease, relief, identity, service or design. Visual polish is only one option.
- **Complete:** finish the promised job within those limits. The release stays useful if no more features are added. Maintenance, bugs and later expansion are still allowed.

All three are release requirements. Cut breadth before the experience that makes the job worth doing here.

## Shape the destination

Describe the users' path from their starting situation to a usable result. A cut that strands them on that path is out. Keep only the capabilities that path or the reason to prefer needs. Explain each consequential exclusion so Vasu can price it.

Make lovability concrete: the frustrating alternative, the moment this product improves, and the behavior that shows users value it. An untested claim about preference is a hypothesis.

Load `grilling` for what the Product section and the existing plan do not settle.

## The brief

Write the brief into the existing plan, spec or map, never into a second artifact that can drift. In a discussion, put it in the answer.

<brief-template>

## SLC brief

- **Destination** — the outcome, and who benefits
- **Journey** — the path from starting situation to usable result
- **Reason to prefer** — the alternative, the moment this wins, the behavior that shows it
- **Acceptance checks** — one observable check per promised step
- **Out of scope** — each exclusion, with what it costs the user
- **Open decisions** — one line per open question, with the recommended answer

</brief-template>

## Carry it through

Load [wayfinder](../wayfinder/SKILL.md) when the request includes cutting the work into slices and tickets. The brief's Destination, Reason to prefer, Acceptance checks and Out of scope go into the map. Tickets may be smaller than a release; judge the experience after the proposed release lands.

During building, compare each scope change with the brief. A shortcut that breaks an acceptance check needs a fix or an explicit change to the brief. Load [taste](../taste/SKILL.md) when the reason to prefer needs interaction design, and [copy](../copy/SKILL.md) for user-facing language.

At review, walk the journey against the acceptance checks. Report observed gaps separately from untested assumptions. Recommend the smallest change per gap, and name one user observation that would inform the next release. An internal review never proves customer affection.
