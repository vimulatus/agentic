# Project design record

`DESIGN.md` at the project root records the design the product actually uses. It is the shared memory for future UI work. Read it alongside the implementation; tokens and components supply exact values, and discrepancies need resolving within the changed scope.

For an existing product, inspect representative screens, shared components and theme tokens before creating the file. Record the established system, including meaningful inconsistencies; do not turn documentation work into a redesign. For a new product, record the chosen direction before building, then reconcile it with the rendered result.

## What belongs in it

| Area | Record |
|---|---|
| Direction | Audience and primary task, intended feel, the distinctive choice and what the design deliberately avoids. Link product context rather than duplicating it |
| Typography | Font families and sources, role scale, weights, leading, tracking and numeric styles; behavior at enlarged text sizes |
| Color and themes | Semantic roles for text, surfaces, borders, accent and feedback; supported themes and contrast requirements |
| Layout and space | Content widths, spacing scale, density, responsive behavior and recurring page structures |
| Shape and elevation | Radius and elevation scales, overlay hierarchy, scrims and any material/transparency treatment |
| Components | Canonical components and variants, their implementation paths and when to use them |
| Motion | Purposes, timing and easing tokens, gesture behavior and reduced-motion equivalents. An intentional absence of animation is a decision |
| UX principles | Product-specific navigation, disclosure, feedback, recovery and state conventions; preserve work and provide clear exits |

Use exact token names and source paths where they exist. Record values here only when the document is their source; avoid a second copy of a theme stylesheet. Explain exceptions that affect future choices. Distinguish adopted decisions from proposals or known gaps.

Keep the record proportional to the product. Unknown areas can remain explicitly undecided until a task reaches them. Update the affected entry when a decision changes; do not append session logs, completed todos or generic design advice. If the project already maintains a design system elsewhere, make `DESIGN.md` a concise entrypoint to that source and keep each decision in one place.
