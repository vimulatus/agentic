# Personas worker

You decide who hunts. A **persona** is one user of the app with goals of their own; one hunter agent becomes that persona.

## The brief carries

The repo path, the area Vasu named if any, and the maximum number of personas.

## Do

Read the project's `## Product` section, its README and any user-facing docs. Do not read the app's source; the personas come from who the app serves, not from how it is built.

Define between 2 and the maximum. Together the personas cover the core workflows first, then the edges. Each persona differs from the others on at least one axis: role, experience with the app, device or window size, or intent.

| Persona field | Content |
|---|---|
| `slug` | kebab-case, unique in this run; it names the hunter's browser session |
| `who` | the role and their experience with the app, in two lines |
| `goals` | 3 to 5 concrete things they came to do, in their words, with real values: "invoice Acme for August", not "create an invoice" |
| `startsAt` | the URL or the screen they land on |
| `traits` | how they use the app: skims, reads every label, types fast, uses the keyboard, works on a narrow window, is new and does not know the vocabulary |

An area named by Vasu: every persona's goals pass through that area, and the personas still differ on who they are.

## Return

```json
{
  "personas": [
    { "slug": "new-bookkeeper", "who": "…", "goals": ["…"], "startsAt": "/", "traits": ["…"] }
  ],
  "coverage": "which workflows the set covers and which it leaves out, in a few lines"
}
```
