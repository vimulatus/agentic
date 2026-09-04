# Page

A landing page, a marketing page, a portfolio. The reader gives it one glance, then decides.

## The hero

The hero is one moment, not a feature list.

| Part | The rule |
|---|---|
| Fit | The headline, the subtext and the buttons fit the first viewport at 1280. Nobody scrolls to find the call to action |
| Headline | Two lines at most. Four lines is a font-size error, never a copy error |
| Subtext | 20 words at most. If the value needs more, the value is unclear, not the rule |
| Buttons | One primary, at most one secondary. The label fits on one line |
| Count | At most four text elements: one small label or none, the headline, the subtext, the buttons |
| Visual | A real image, a real screenshot, or a live piece of the product. Text over a gradient blob is a placeholder, not a hero |
| Top padding | Six rem at most. More reads as a layout bug |

The logo wall, the trust line, the pricing teaser and the avatar row live in their own sections under the hero.

## The sections

- One layout family appears once. Eight sections use at least four families: full width, split, stacked, grid, marquee, quote.
- Two image-and-text splits in a row is the cap. The third is a different family.
- A small label above a heading appears on at most one section in three. The heading alone is enough; the section's place on the page already categorises it.
- A grid has exactly as many cells as there is content. An empty cell means the grid is the wrong shape.
- A grid of six identical text cards is a wall. Two or three cells carry an image, a tint or a pattern.
- A quote is three lines at most, with a name and a role.
- One label per intent. "Get in touch" in the nav and "Contact us" in the footer are the same button; give them the same words.

## The chrome

- The navigation renders on one line at 1024 and stands at most 80 pixels tall.
- Images are real. A product preview built from `<div>` rectangles is a tell. When no image exists, leave a labelled slot and say so in the report.
- One theme for the whole page. A cream section inside a dark page is a different website mid-scroll.
