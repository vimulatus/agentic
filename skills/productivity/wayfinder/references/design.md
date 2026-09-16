# Design direction

Vasu picks how a new screen looks and moves. He picks from a prototype, never from a question, and the UI tickets wait for the pick: ten UI tickets built on ten private guesses cost a full redesign.

## Before the pick

1. Build it with `prototype`, on its UI branch: 3 to 5 variants, each a canvas of every screen the map needs. Build it whether or not Vasu has time to look.
2. Put it in the `grilling` round, with the variant you recommend.
3. Write it into the map: `open: design direction — <url>, recommended ?v=<n>; holds <the UI tickets>`.
4. File the rest of the slice with `to-tickets`. Hold the tickets whose body depends on the pick.

## After the pick

Replace the `open:` line with the decision. File the held tickets under the slice's parent. Each names the prototype URL and the variant, and the first creates `DESIGN.md` from it, so later slices and `dev` inherit the direction. A later slice prototypes again only for a screen `DESIGN.md` does not cover.
