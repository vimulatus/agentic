# App

A dashboard, a list, a resource view, a form, a settings page. The reader has a job. The screen answers the job, then gets out of the way.

## The one job

Name it in the plan: the one question the screen answers, or the one action it takes. The primary action sits where the eye lands first, top right of the header or the end of the form. One primary button per screen.

## The pages

| Page | What it shows first | What waits one tap away |
|---|---|---|
| Dashboard | The three to five comparisons that change what the reader does next, each as a chart, then the one list they act on | the breakdown, the history, the definition of each metric |
| List, table | The rows. A search, the filters the reader uses weekly, the row's status and its one action. Tabular figures, hairline rules, no card per row | the rest of the filters, the columns nobody sorts by |
| Resource view | The title, the status, the primary action, then the facts in a definition list | the log, the related records, the settings |
| Form | One column, the label above the field, one action at the end. The error sits under its field | the advanced fields, in a closed section with a summary |
| Settings | Sections in the order the reader changes them. Each section saves itself, or one save for the page. Never both | the danger zone, at the end, behind its own confirmation |

## Disclosure

`copy` holds the model: the What on the screen, the Why one tap away, the How never. This table picks the container.

| The reader needs | The container | It opens on |
|---|---|---|
| a term or a number explained | a popover, anchored to its trigger | tap, click and keyboard. It closes on an outside tap or Escape |
| a section they may skip | an accordion, closed. The summary states the outcome | tap |
| to create or edit without leaving the list | a sheet from the side, or a dialog for a form under five fields | the row's action |
| to confirm a loss | a dialog that names what goes away, in numbers | the destructive action |

Optional explanations open on tap and on keyboard. Hover has no thumb, so a hover reveals nothing the reader needs.

## Components

shadcn/ui is the house look: neutral surfaces, hairline borders, one radius, colour on state, `Popover`, `Sheet`, `Dialog` and `Accordion` as the disclosure set. On React, install the component. Elsewhere, borrow the look. The build takes its exact tokens from the project's own install, never from memory.

## Data

A screen that shows data measures a value the reader wants to move. Derive the metrics top-down, then combine them bottom-up.

1. Name the value: how much am I selling.
2. Name the KPIs that move it: leads ingested, leads converted.
3. Split a KPI where the reader can act on the split: leads by source, so the reader can invest in the best source or fix the worst.
4. Combine metrics that answer one question on one axis into one chart: the sources as series on one area chart. Source A alone says nothing; next to source B it says which to fund.

A total does not change a decision. Show every metric as a comparison: this period against the last, one source against another, the actual against the target. Prefer a rate of change over time on an area chart to a total on a stat card: "leads today against yesterday, and by how much", not "Total leads".

### Charts

One chart answers one question. The title states the finding, not the metric: "Sign-ups fell 12% this week", not "Sign-ups".

| The reader asks | The chart |
|---|---|
| is it growing, and how fast | an area chart of the rate over time, with the previous period as the comparison series |
| how did it change | a line. One series, four at most |
| how do these compare | horizontal bars, sorted, from zero |
| how much of the whole | a stacked bar. A pie only for two or three parts |
| which one is off | a table sorted by the gap, with the threshold as a rule |

- Annotate every incline or decline the reader will ask about, in place on the chart: the release, the campaign, the outage, with the cause in a few words.
- Bars start at zero. A line labels its last point, in place of a legend.
- One series in ink, the comparison in the accent, the rest muted. Flat fills: no gradient, no glow, no 3D.
- The data table sits under disclosure, for the reader who wants the numbers.
