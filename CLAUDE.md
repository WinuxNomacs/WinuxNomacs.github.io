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
  `NEAR` among the nearest stars while the galaxy fades out, `DIVE` into the Sun while the solar system fades in, then `ZOOM` towards the Earth
  (`SOLAR_VIEW`). The way back always takes `FLY` seconds. The galaxy shader's `uView` is the camera's orientation
  (identity on the landing page) and `uStarCap` keeps nearby stars small. `body.touring` fades the head and the
  quote and lifts the banner by `--lift`; `#back`, `#sun-marker`, `#earth-marker`, `#planet-labels`, `#tour-note`
  and the `#tour-status` live region are in `index.html`. At the Earth the visitor can zoom (`zoom.z`, which scales the tour's
  own zoom, via wheel, pinch, `#zoom` buttons or keys) and pick a body (`select()`, `#body-marker`; the names in
  `#planet-labels` are buttons). The camera circles slowly (`orbit`, `ORBIT_SPEED`, the `turn` of
  `solarCamera`), and `fitLabel()` keeps the markers' labels on screen as it does. In the solar system only "← Back" and Esc go back; a click anywhere does so only
  before the dive. Playwright clicks on the head need `force: true`, because
  the head never stops drifting; a full tour takes about 22 s in headless Chromium.
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
  solar system (`leaveEarth()`). Its layer buttons (`#layers`, each a `data-layer` button with `aria-pressed`) set
  `layers[name].on`, remembered in `localStorage` (`layer-<name>`); `stepLayers()` fades `shown`, which the
  shaders use (`uCloudGain` for the clouds, the gain of the space junk).
- **Space junk:** the space junk section of `main.js` (after the ISS) draws `docs/junk.bin` (made by
  `tools/make-junk.py` from CelesTrak's catalogue and elements, which documents the layout) at the Earth up close
  with its own program (`junkProg`): each object's orbit is a vertex's attributes, and the vertex shader moves it
  (Kepler plus J2 drift), hides it behind the Earth and dims it in the shadow. Time runs `JUNK_SPEED` times faster
  from the moment of the visit (real time under reduced motion). It loads on the first visit (`loadJunk()`); the
  note's `#junk-note` gives the counts and the data's date. The ISS and the modules docked to it are left out
  of the file, since the page draws its own ISS.
- **Rockets:** the rockets section of `main.js` (after the globe section) launches one every 10–20 s at the Earth
  up close from `LAUNCH_SITES` (name, latitude, longitude, heading) on the side facing the camera, and names the
  site (`#launch-site`). `rocketPath()` makes the whole flight in the Earth's own axes once; `drawRockets()` draws
  its trail and the rocket as points for `skyProg`, relative to the camera in Earth radii, hiding what the Earth
  hides and fading near the screen's edge. None under reduced motion. `earthView()` (shared with the ISS) gives
  the camera from the Earth's centre, where a point lands on screen and whether the Earth hides it.
- **ISS:** the ISS section of `main.js` (after the rockets) draws the ISS and a faint orbit line (`issOrbit`,
  dots for `skyProg`) at the Earth up close, on its true orbit (`ISS_HEIGHT`, `ISS_TILT`) at a made-up node
  (`ISS_NODE`) and sped up (`ISS_LAP` seconds a lap), dimmed in the Earth's shadow, with `#iss-marker`. Under
  reduced motion it stands still.
- **Webb:** the Webb section of `main.js` (after the ISS) adds the James Webb Space Telescope to the solar system
  view as `solar.bodies[WEBB]`. Its `true` place is L2 for the date plus a modelled halo loop (`webbLoopPoint()`,
  `WEBB_LOOP`, `WEBB_DAYS`, a made-up `WEBB_START`). Its `pos` is where it is drawn: `drawWebb()` sets it each frame
  further out from the Earth (`WEBB_PX` on screen, at most `WEBB_MAX` times), with its loop, and it fades out and
  can't be picked when that gap is too small. Its name button may go on its dot's left, or raised
  (`.planet-label.is-left`, `.is-up`), to clear the Earth's label. Picked, its marker shows its distances from the
  Earth and from the Sun (`distanceParts()`).
- **Asteroids:** the asteroids section of `main.js` (after Webb) draws `docs/asteroids.bin` (made by
  `tools/make-asteroids.py` from NASA JPL's Small-Body Database, which documents the layout) in the solar system:
  `placeAsteroids()` (called by `buildSolar()`, and on load) moves each from the file's epoch to the date with
  `orbitPoint()` into its own buffer for `solarProg`; `drawAsteroids()` dims them as the belt shrinks on screen
  (`ASTEROID_CROWD`, `ASTEROID_TINY`). Ceres, Pallas and Vesta, first in the file, are `solar.bodies[CERES..]`
  after Webb, with name buttons. Loaded by `go()` (`loadAsteroids()`); credited in `#tour-note`.
- **Nearest stars:** the nearest-stars section of `main.js` (after Webb) draws `docs/near-stars.json` (made by
  `tools/make-near-stars.py` from the HYG Database, CC BY-SA 4.0, credited in `#tour-note` while it shows) round the
  galaxy's `SUN`, in galactic coordinates turned into the disc's (`LY_PER_UNIT`), so the galaxy camera flies on
  into them (`galaxyCamera()`'s `n`). The tour's `NEAR` stage sits between `HOLD` and `DIVE` (`INTO_SUN`): the
  galaxy fades out, the stars fade in and a few are named (`#near-labels`, the names in the JSON). A click anywhere
  still goes back until `INTO_SUN`. Under reduced motion the tour cuts to the Sun, the stars, then the Earth.
- **Eye glow position:** the glow is placed at the lit eye, which sits at 53.0% / 32.8% of the image.
  If the image changes, measure the eye again.
