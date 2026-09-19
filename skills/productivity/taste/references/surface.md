# Surface

Two finishing lines for a surface: an edge on an image, and grain on a flat colour. Both sit on top of the pixels and take no layout space.

## Image edge

An image does not know what is behind it. A pale sky on a white card has no edge; a light avatar floats on the surface. Paint one line just inside every image and avatar, too faint to read as a border: the image gains a shape, not a frame.

| Rule | Value |
|---|---|
| Colour | black at 10% on light, white at 10% on dark. Tune per theme when the images call for it |
| Range | under 5% it vanishes against pale content; above 20% it reads as a frame and becomes a design element |
| Placement | inside the image, so the box does not grow. `outline` with a negative offset, or an inset `box-shadow` when the corners need a radius. Never `border`: it sits between padding and margin and moves the layout |

```css
img { outline: 1px solid rgb(0 0 0 / 0.1); outline-offset: -1px; }
.dark img { outline-color: rgb(255 255 255 / 0.1); }
```

Avatars are where it matters most: small, round, and often mostly white.

## Grain

Grain is a layer of random light and dark pixels over a flat colour. It hides gradient banding and gives the colour texture. It is decoration, so it spends the boldness budget: at most on the distinctive element, never on a data surface, a reading surface or a control.

| Rule | Value |
|---|---|
| Layer | an empty overlay filling the container, `opacity: 0.08`, `mix-blend-mode: overlay`, `pointer-events: none`, `aria-hidden` |
| Container | `position: relative; isolation: isolate; overflow: hidden`. Without `isolate` the blend reaches the page behind the card, and the grain changes with where the card sits |
| Grain size | `baseFrequency` on `feTurbulence`: `0.8` is film grain, lower values give soft blobs. `numOctaves="3"`, `stitchTiles="stitch"`, then `feColorMatrix type="saturate" values="0"` |
| Live filter | small surfaces only: a card, a demo. `feTurbulence` is computed per pixel and re-renders on every repaint |
| Tiled image | anything large, scrolling or animating. A 200px tile as an SVG data URI repeats without visible seams under the blend and costs nothing after the first paint. Seams visible: export the tile as a PNG at 2x |
| Blend engines | Blink and WebKit blend slightly differently. Look at both when the grain is on a shipped surface |

```css
.hero { position: relative; isolation: isolate; overflow: hidden; }
.hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
  background-size: 200px 200px;
  background-repeat: repeat;
  opacity: 0.08;
  mix-blend-mode: overlay;
  pointer-events: none;
}
```

For the live filter, put the `<filter id="grain">` in one `<svg class="absolute size-0" aria-hidden="true">` on the page and give the overlay `filter: url(#grain)` in place of the background image.
