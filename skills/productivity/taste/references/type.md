# Type details

Three adjustments the eye notices and the math misses: which digits a number uses, where an icon actually sits, and how wide a word gets when it turns bold.

## Tabular figures

Proportional figures take each digit's natural width: `1` is narrow, `8` is wide. Tabular figures give every digit one width.

| The number | Figures |
|---|---|
| inside a sentence | proportional. They read as text |
| changes while shown: a clock, a counter, a score, a price, a live metric | tabular. The width holds, so nothing beside it moves |
| in a column | tabular, right-aligned. Repeated places line up and the eye scans the differences |

```css
.numeric { font-variant-numeric: tabular-nums; }
```

Do not reach for a monospace face to steady a number. It changes the voice of the whole interface; the figures are enough. When `tabular-nums` changes nothing, the face lacks the `tnum` feature: drop the file into wakamaifondue.com to check, and pick a face that has it for the numeric roles.

## Optical alignment

Aligning an icon by its bounding box is often wrong, because the box is not where the ink is. Nudge it until it looks right, then keep the nudge.

| Case | The rule |
|---|---|
| An icon centred in a button | Blur it heavily in the inspector, or squint. The blob sits at the icon's weight, not its box; move it back to centre by that distance. A play triangle moves left; a star or a download arrow moves up. The amount is per icon, one or two pixels, never a global rule |
| A button with an icon and a label | The icon has air inside its box, and that air adds to the padding beside it. Shave a few pixels off the padding on the icon side |
| Shapes in one row | A circle or a triangle drawn in the same box as a square looks smaller. Draw it slightly larger so the weights match |

```css
.play-icon { transform: translateX(1px); }
```

## Weight without shift

Bold is wider than regular. A nav link that turns bold when selected pushes its neighbours over. Reserve the bold width at both weights: an invisible `::after` carries the same text at the bold weight, so the box is always bold-sized.

```html
<nav class="nav"><a data-text="Projects">Projects</a></nav>
```

```css
.nav a { display: inline-flex; flex-direction: column; }
.nav a::after { content: attr(data-text); font-weight: 600; /* the selected weight */ height: 0; overflow: hidden; visibility: hidden; }
```
