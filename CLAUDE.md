# CLAUDE.md

A static GitHub Pages site (<https://winuxnomacs.github.io/>): one page, plain HTML/CSS/JS, no build, no dependencies.

- **What is served:** everything in `docs/` (`index.html`, `style.css`, `main.js`, `assets/`). Pages deploys
  from `main` / `/docs`, and `docs/.nojekyll` turns off Jekyll processing.
- **What a push publishes:** a push to `main` puts the site live within about a minute. There are no
  workflows, so a push uses no Actions minutes.
- **Preview:** `python3 -m http.server <port> -d docs`. Opening `index.html` as a file shows no quotes, because
  the browser blocks reading `quotes.md` that way.
- **Quotes:** `docs/quotes.md` is the list (every `- ` or `* ` line is a quote; other lines are ignored).
  `docs/quotes.js` reads it, shuffles it into rounds with no repeats, and sets the `.quote` element's class
  (`is-in`, then `is-out`). The CSS transitions in `style.css` do the movement. Its timing constants must match the
  1.6 s transition in `style.css`.
- **Motion:** every animation must stop under `prefers-reduced-motion: reduce` (in both `style.css` and
  `main.js`).
- **Image:** `docs/assets/img/gargoyle-cutout-707.webp` and `-1414.webp` (for 2× screens) are the head with its
  black background made transparent, so the galaxy shows around it. Both are made from a 2048 px original that is
  kept out of the repo: the near-black area connected to the image border is flood-filled, the dark fringe beside
  it is faded, and the edge is softened. Check a new cut-out over a bright background, especially in the dark
  jaw/neck shadow. `gargoyle-707.jpg` (black background) is the favicon.
- **Galaxy:** `main.js` generates the points with a fixed seed, so every visit looks the same. Its shape and
  look are set by the constants at the top of the galaxy section (`TILT`, `ROLL`, `SPIN`, the point counts) and
  the `uGain` brightness. Headless Chromium renders it in software at about 30 fps, so judge speed on a real GPU.
- **Eye glow position:** the glow is placed at the lit eye, which sits at 53.0% / 32.8% of the image.
  If the image changes, measure the eye again.
