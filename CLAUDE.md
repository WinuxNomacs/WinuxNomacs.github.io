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
  screen readers. `place()` sets each letter's `--x` and the slot's `--qw`, so one band of light (`--sweep`, shared with the banner's shine) can cross all the letters. `laser()` moves a `.laser` print head from letter to letter in step with the typing and aims an `.eye-beam` at it from the eye glow every frame (both skipped under reduced motion; the beam hides while touring), while each letter's `cool` animation fades its glow. Then it adds `is-out` so the quote floats away; a click on the quote while it is shown (`is-skippable`) ends
  that wait early (`skip`) and removes the laser. Its `CHAR_MS`, `FADE_MS` and `EXIT` constants must
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
  and the `#tour-status` live region are in `index.html`. At the Earth the visitor can zoom (`zoom.z`, which scales the tour's
  own zoom, via wheel, pinch, `#zoom` buttons or keys) and pick a body (`select()`, `#body-marker`; the names in
  `#planet-labels` are buttons). The camera circles slowly (`orbit`, `ORBIT_SPEED`, the `turn` of
  `solarCamera`), and `fitLabel()` keeps the markers' labels on screen as it does. In the solar system only "← Back" and Esc go back; a click anywhere does so only
  before the dive. Playwright clicks on the head need `force: true`, because
  the head never stops drifting; a full tour takes about 17 s in headless Chromium.
- **Solar system:** `main.js` (the solar system section) has its own small WebGL program (`solarProg`, dots and
  `LINE_LOOP` orbits) and places the planets for the visitor's date from `PLANETS`, NASA JPL's "Approximate
  Positions of the Planets" Table 1 (valid 1800–2050; units are AU, distances true, dot sizes in px). Both programs
  bind their attributes at fixed locations, and `use()` switches between them.
- **Sky:** behind the solar system, `main.js` (the sky section) draws `docs/stars.bin` (the Yale Bright Star
  Catalogue's stars brighter than magnitude 6, made by `tools/make-stars.py`, which documents the 6-byte layout)
  with its own program (`skyProg`), plus the Milky Way band, twinkling and the comets. Directions are J2000
  equatorial turned onto the ecliptic (`fromEquatorial`), so they match the planets. Sky point sizes are px, or
  radians when negative (the band's glow). `tools/` is not served.
- **Head pulse:** once the head is a button it beats (`heartbeat` on `.tilt`'s `scale`, `aura` on `.tilt::before`,
  `eye-beat` on the eye glow, 2.9 s), stopping on hover, focus and touring. The Earth's marker ring beats the same way (`ring-beat`), resting
  while its label is hovered or focused. The aura is a blackened copy of
  `gargoyle-cutout-707.webp` with a gold drop-shadow; if the image changes, update its URL and edge fade there.
- **The Earth up close:** `main.js` (the globe section) draws the Earth and the Moon as textured spheres
  (`globeProg`, plus `airProg` for the Earth's glow) at true size and place, in AU like the solar system but each
  in units of its own radius relative to the camera (`uRel`), so floats stay precise. `earthAxes()` turns the Earth
  by Greenwich sidereal time; `moonPlace()` is the Astronomical Almanac's low-precision Moon. The tour section's
  `visit` (0..`EARTH_DIVE` s) runs the dive: `diveCamera()` carries on from the solar camera and ends over the
  visitor's time zone, then circles (`visit.turn`). The images (`assets/img/earth-*.webp`, `moon.webp`, made by
  `tools/make-earth-images.js`) load when the tour reaches the Earth. "← Back" and Esc from there go back to the
  solar system (`leaveEarth()`).
- **Rockets:** the rockets section of `main.js` (after the globe section) launches one every 10–20 s at the Earth
  up close from `LAUNCH_SITES` (name, latitude, longitude, heading) on the side facing the camera, and names the
  site (`#launch-site`). `rocketPath()` makes the whole flight in the Earth's own axes once; `drawRockets()` draws
  its trail and the rocket as points for `skyProg`, relative to the camera in Earth radii, hiding what the Earth
  hides and fading near the screen's edge. None under reduced motion.
- **Eye glow position:** the glow is placed at the lit eye, which sits at 53.0% / 32.8% of the image.
  If the image changes, measure the eye again.
