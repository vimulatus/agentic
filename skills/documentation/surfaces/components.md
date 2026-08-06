# Surface: Components

The component surface has the two layers in their sharpest form:

- **Breadth — the catalog.** An agent-facing index (`COMPONENTS.md`) an agent reads to know *what components exist and which one to reach for*, before building anything. This is the piece that lets a large library be used without reading every doc.
- **Depth — the component doc.** A human-facing doc per component: anatomy, states, variants, accessibility. Read when you need to actually use one component well.

The catalog links down into the docs. Keep them distinct: the catalog is for orientation at scale, the doc is for correct use of one component.

---

## Breadth — `COMPONENTS.md`

An agent-facing index. Each entry is the **non-derivable semantic layer** — never a prop list (that's in the code), never a screenshot (that's in the doc):

```md
**Button** — triggers an action or submits. Reach for it for any click-to-act control.
When *not*: for navigation between pages, use a link. → [doc](../apps/storybook/stories/button.mdx)

**Combobox** — select one option from a searchable list. Reach for it when the list is long
enough to need filtering. When *not*: for a short fixed list, use Select. → [doc](…)
```

Each entry: **name** + one-line **role** + **when to reach for it vs its neighbours** + a **link down** to the depth doc.

### Location and split axis

- One `COMPONENTS.md` at the component package root (e.g. `packages/ui/COMPONENTS.md`), as plain markdown — cheap for an agent to read, no rendering machinery.
- The split axis is **role** (how you reach for a component mid-task), not file location. Group entries under role headings — Forms, Overlays, Navigation, Feedback, Data Display, Layout, etc.
- **Split lazily.** Keep it a single flat file while it's cheap to read. When it outgrows a cheap read (many dozens of components), split into per-role catalog files and leave a thin map on top:

  ```md
  # Components

  - [Forms](./components/forms.md) — inputs, selects, fields, validation
  - [Overlays](./components/overlays.md) — dialogs, popovers, sheets, tooltips
  - [Feedback](./components/feedback.md) — toasts, alerts, progress, skeletons
  ```

- A **package-level outer map** (per-package `COMPONENTS.md`) is only warranted once components span more than one package. Don't build it before then.

---

## Depth — the per-component doc

Written for the **person who has to use the component** — not the person who built it. They have the code; what they lack is *when to reach for this, when not to, and how to not misuse it*.

Authored as **Storybook MDX** (alongside the stories), so examples are live.

### Principles

- **Usage over decoration.** *When to use* and *when not to use* are the highest-value content. Lead with them.
- **Show, don't tell.** Every rule pairs with a real visual example; every *do* has a matching *don't* — people learn faster from the mistake they were about to make. Prefer real product screenshots over idealised mockups.
- **Name the parts.** The **anatomy** — a labelled picture plus a name for each part — is the shared vocabulary the rest of the doc uses. Establish it early.
- **No gaps.** The doc is a promise about what exists. Every variant and every state gets covered; the states you leave out are where misuse happens.
- **Accessibility and content are sections, not footnotes.** Give each its own heading.
- **Definition of done.** A component isn't shipped until its doc exists, and the doc stays living as the component changes.

### Template

Copy this and fill **every** placeholder. Drop a section only when it genuinely doesn't apply — and say so in one line (`_No variants._`) rather than leaving it empty, so the reader knows it was considered.

```md
# <ComponentName>

<One or two sentences: what this component is and the single job it does. Name the problem it solves for the user — not how it's built.>

## When to use

<The situations where this is the right choice, stated concretely. If there's a decision between this and a sibling component, give the rule that settles it.>

## When not to use

<Where to reach for something else instead — and name the alternative. This section prevents more misuse than any other; don't skip it.>

## Anatomy

<A labelled image with every part named, followed by a short list: each part → what it's for. These names are the vocabulary the rest of this doc uses.>

## Variants

<Each variant and the situation it's for — one line each, `name → when to use it`. Cover appearance variants and any size or density options.>

## States

<Every state and what triggers each: default, hover, focus, active, disabled, loading, error, empty, selected. A reader should find any state they can produce.>

## Behavior

<How it responds to interaction and environment: keyboard, click / tap, and overflow, truncation, long content, small screens, other edge cases.>

## Props / API

<The public contract: each prop → type, default, and what it does. Keep it complete and current.>

## Do's and don'ts

<Paired examples, each with a real visual. For every do, the matching don't. State the rule and its reason in one line.>

**Do** — <the rule>. <why it matters>
**Don't** — <the mistake this prevents>.

## Accessibility

<Keyboard operation and focus order; roles and labels exposed to assistive tech; contrast and target size; motion. Describe what a screen-reader user hears and can do.>

## Content

<How to write the text inside it: label length and casing, tone, truncation, localisation gotchas. Include one good and one bad example label.>

## Related

<Components used alongside this one, and any it's easily confused with — each with the one-line difference that tells them apart.>
```

When **reviewing** an existing doc, read it against this template and principles: name each section that's missing, thin, or telling-instead-of-showing, and treat every uncovered state or variant as a defect.
