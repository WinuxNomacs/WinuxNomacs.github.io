# CLAUDE.md

A static GitHub Pages site (<https://winuxnomacs.github.io/>): one page, plain HTML/CSS/JS, no build, no dependencies.

- **What is served:** everything in `docs/` (`index.html`, `style.css`, `main.js`, `assets/`). Pages deploys
  from `main` / `/docs`, and `docs/.nojekyll` turns off Jekyll processing.
- **What a push publishes:** a push to `main` puts the site live within about a minute. There are no
  workflows, so a push uses no Actions minutes.
- **Preview:** `python3 -m http.server <port> -d docs`. Opening `index.html` as a file shows no quotes, because
  the browser blocks reading `quotes.md` that way.
- **Quotes:** `docs/quotes.md` is the list (every `- ` or `* ` line is a quote; other lines are ignored).
  `docs/quotes.js` reads it and shuffles it into rounds with no repeats. It types each quote as one span per
  letter (`.ch`, with `--i` as the letter's position, grouped in no-wrap `.word` spans), plus an `.sr-only` copy for
  screen readers. Then it adds `is-out` so the quote floats away. Its `CHAR_MS`, `FADE_MS` and `EXIT` constants must
  match the `animation-delay`, the animation and the transition in `style.css`.
- **Motion:** every animation must stop under `prefers-reduced-motion: reduce` (in both `style.css` and
  `main.js`).
- **Image:** `docs/assets/img/gargoyle-cutout-707.webp` and `-1414.webp` (for 2× screens) are the head with its
  black background made transparent, so the galaxy shows around it. Both are made from a 2048 px original that is
  kept out of the repo: the near-black area connected to the image border is flood-filled, the dark fringe beside
  it is faded, and the edge is softened. Check a new cut-out over a bright background, especially in the dark
  jaw/neck shadow. `gargoyle-707.jpg` (black background) is the favicon.
- **Galaxy:** `main.js` generates the points with a fixed seed, so every visit looks the same. Its shape and
  look are set by the constants at the top of the galaxy section (`TILT`, `ROLL`, `SPIN`, the point counts) and
  the `uGain` brightness. The arms, the bar and `SUN` follow the measured Milky Way (1 unit = 1.36 kpc; the comments
  give the sources' numbers), so keep them consistent if the layout changes: the tour flies to `SUN`. Headless Chromium renders it in software at about 30 fps, so judge speed on a real GPU.
- **Tour:** `main.js` (the tour section) makes the head a button once WebGL works. The tour is one timeline in
  seconds (`tourT`): `FLY` to the Sun (final view `VIEW`, in the disc's coordinates), `HOLD` there with its marker,
  `DIVE` into it while the galaxy fades out and the solar system fades in, then `ZOOM` towards the Earth
  (`SOLAR_VIEW`). The way back always takes `FLY` seconds. The galaxy shader's `uView` is the camera's orientation
  (identity on the landing page) and `uStarCap` keeps nearby stars small. `body.touring` fades the head and the
  quote and lifts the banner by `--lift`; `#back`, `#sun-marker`, `#earth-marker`, `#planet-labels`, `#tour-note`
  and the `#tour-status` live region are in `index.html`. Playwright clicks on the head need `force: true`, because
  the head never stops drifting; a full tour takes about 17 s in headless Chromium.
- **Solar system:** `main.js` (the solar system section) has its own small WebGL program (`solarProg`, dots and
  `LINE_LOOP` orbits) and places the planets for the visitor's date from `PLANETS`, NASA JPL's "Approximate
  Positions of the Planets" Table 1 (valid 1800–2050; units are AU, distances true, dot sizes in px). Both programs
  bind their attributes at fixed locations, and `use()` switches between them.
- **Eye glow position:** the glow is placed at the lit eye, which sits at 53.0% / 32.8% of the image.
  If the image changes, measure the eye again.
