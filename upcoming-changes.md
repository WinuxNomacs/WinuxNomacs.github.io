# Upcoming changes

## Phases (current and upcoming)

- **Up next:** nothing planned; new requests go in `new.md`.

## The Moon's phase in its label

**Request** (from `new.md`, 2026-11-13): add the Moon's current phase to its description text.

**Builds on:** the Moon's marker at the Earth up close (`#moon-marker`, `placeMoonMarker()` in `docs/main.js`),
whose label reads "The Moon" over "238,900 miles (384,400 km) away, 63% lit"; the lit fraction comes from the
Sun–Moon–Earth angle in `drawGlobe()`.

**Proposed phase (a small change):**
- Name the phase from the Moon's angle from the Sun as seen from the Earth (its elongation, measured along the
  ecliptic, so waxing and waning are told apart): New Moon, Waxing crescent, First quarter, Waxing gibbous, Full
  Moon, Waning gibbous, Last quarter, Waning crescent. The four main phases are moments, so each is named only
  within about a day of it (12° of elongation); between them the in-between names apply.
- It uses the same visitor's moment as the rest of the Earth up close, so it agrees with the lit side drawn.

**Decided** (user, 2026-11-13):
- **Where in the label:** on its own small line under "The Moon", above the distance and % lit.

## Rockets launching from the Earth up close

**Request** (user, 2026-11-13): at the Earth up close, small rockets take off from Houston, Cape Canaveral and
other known launch sites, and fade away as they reach the screen edges. They stay small so they don't detract from
the Earth, and each rocket's trail fades away after it.

**Builds on:**
- The globe section of `docs/main.js`. `earthAxes()` turns the Earth to the real moment, and spheres are drawn
  relative to the camera in their own radii (`uRel`), so a point fixed on the surface can be placed the same way.
- The sky's comets (`launchComet`, `stepComet`): a random launch every few seconds and a trail that fades along its
  length.
- `atGlobe()` and `visit` in the tour section, for when the Earth is up close; `#moon-marker` for a small label
  placed on screen each frame.

**Phase** (done, see below):
- **Sites:** real launch sites at their true latitude and longitude, turning with the globe. Only sites on the
  side facing the camera launch, and never right at the edge of the disc.
- **The rocket:** a tiny bright point (2–3 px), warm white like an engine flame. It rises straight up, then tips
  over in its site's usual direction (east from Florida, south from Vandenberg for polar orbits), speeding up.
- **The path:** a real rocket reaching orbit climbs only about 3% of the Earth's radius, which would be invisible
  from here. So the climb is stretched into a sweeping arc that leaves the globe and fades near the screen edge,
  about 6–10 s per launch.
- **The trail:** a thin, faint exhaust line, brightest near the rocket and fading along its length. It dissolves
  over a few seconds after the rocket is gone.
- **Behind the Earth:** a rocket or trail that passes behind the globe is hidden.
- **Reduced motion:** no rockets.

**Decisions** (user, 2026-11-13):
- **Houston:** it has no launch pad (it is Mission Control), so Starbase at Boca Chica, Texas, stands in for it.
- **Sites:** major spaceports worldwide: Cape Canaveral/Kennedy, Vandenberg, Wallops, Starbase, Kourou, Baikonur,
  Plesetsk, Vostochny, Jiuquan, Taiyuan, Wenchang, Xichang, Sriharikota, Tanegashima, Mahia (New Zealand).
- **How often:** about one launch every 10–20 s, so usually one rocket at a time.
- **Labels:** the site's name, e.g. "Cape Canaveral", shows small and faint by the site at liftoff and fades after
  a few seconds.

## Dive into a realistic Earth seen from space

**Request** (user, 2026-11-12): clicking the Earth zooms the scene into the Earth. Google Earth zooming to the
visitor's location was considered first, but it can't be embedded, and Google's 3D maps need an API key with
billing. The user chose our own realistic globe in the same WebGL scene instead, with no location prompt.

**Builds on:**
- The solar system stage in `docs/main.js`: the Earth is `solar.bodies[3]`. The camera's zoom `zoom.z` (1 = at the
  Earth) and its slow `orbit` already exist. A click on the Earth's dot currently just lets go of a picked body
  (`select(3)`). The Earth's name is hidden behind "You are here" (`#earth-marker`, which takes no clicks).
- The Sun's direction from the Earth for the visitor's date, from `PLANETS`, which gives the real day/night line.
- Its own small WebGL programs (`solarProg`, `skyProg`), so the globe can be another one. No libraries.

**Proposed phase** (done, see below):
- **The dive:** from the solar system, the camera flies on into the Earth's dot, which grows into a globe filling
  most of the screen. The sky's stars and the Milky Way stay behind it, and the Sun's light comes from the Sun's
  real direction.
- **The globe:** a sphere drawn with NASA's public-domain images: Blue Marble for day and Black Marble city lights
  on the night side. A soft blue atmosphere glows round the edge, sunlight glints on the oceans, and the day/night
  line is blended.
- **True for now:** the Earth is turned as it really is at the visitor's current time (Greenwich sidereal time),
  tilted 23.4°, so day and night fall where they are at that moment. The camera circles slowly round it, as it
  does round the Sun, rather than spinning the Earth, which would make the day/night line false.
- **Text:** a label and the status line read "The Earth now: day and night as they are at <time> your time".
  A credit line at the bottom names NASA's images, with a link.
- **Images:** about 2048×1024 JPEGs of a few hundred KB each, kept in `docs/assets/img/`. They load only when the
  dive starts, and the dive waits briefly if they haven't arrived yet.
- **Keyboard:** "You are here" becomes a button that starts the dive.
- **Reduced motion:** the dive cuts straight to the globe, and the camera doesn't circle.
- **Fallback:** if the images can't load, the dive doesn't start.

**Decisions** (user, 2026-11-12):
- **What starts the dive:** clicking the Earth's dot or "You are here", at any zoom. The camera eases in to the Earth
  first, then on into the globe.
- **Clouds:** yes, a still cloud layer (NASA's public-domain cloud map, a typical day rather than today's weather),
  just above the surface.
- **The Moon:** yes, in its real place and phase for the visitor's moment, textured and lit by the Sun. Its distance
  is to scale, so it's often off to one side or out of view.
- **"← Back" and Esc from the globe:** back to the solar system at the Earth. From there, "← Back" flies home as now.

## The head pulses to invite a click

**Request** (from `new.md`, 2026-11-12): make the gargoyle head pulse rhythmically, as if enticing the visitor to
click it.

**Builds on:** in `docs/style.css`, the head (`.float`, which becomes a button, `.float[role="button"]`, once WebGL
works) already drifts up and down every 7 s, and its eye glow (`.eye-glow`) swells every 3.2 s. Clicking the head
starts the tour.

**Proposed phase** (done, see below): a rhythmic pulse on the head only while it is a button (no WebGL, no tour, so no pulse), the eye
glow flaring on each beat, stopped while touring and under reduced motion.

**Decisions** (user, 2026-11-12):
- **Rhythm:** a heartbeat: a double beat ("lub-dub") every 2.4 s, then a rest; later slowed to 2.9 s (user, 2026-11-12).
- **What pulses:** the head swells about 3% and a soft gold aura flares around its outline (following the cut-out's
  shape), with the eye flaring too.
- **Hover or keyboard focus:** the pulse stops while the pointer is on the head or it has focus.

## Solar system: a livelier sky, and exploring it

**Requests** (from `new.md`, 2026-11-12):
- While in the solar system, show distant stars in the background as particles, some twinkling lightly and
  randomly.
- At the Earth, let the user click the Sun and the planets, and zoom out to see the whole solar system. The Sun
  shows its distance from the centre of the Milky Way; each planet shows its distance from the Sun. Only the Earth
  says "You are here".
- Random comets streak across the background, so space looks less empty.

**Builds on:**
- The solar stage in `docs/main.js`. Its sky is already the galaxy's distant-star sphere (`STAR_POINTS`, 1,800 on
  phones, 3,500 otherwise), drawn faint and still, with no twinkling.
- `solarCamera(z)`, which already runs from the whole solar system (z = 0) to the Earth (z = 1). Zooming can drive
  that same z.
- The Earth's marker (`#earth-marker`, "You are here", the date and the distance from the Sun) and the planet
  names (`#planet-labels`).

**Conflict:** during the tour, a click anywhere goes back to the landing page, so clicking a planet would leave the
solar system. That behaviour has to change at this stage (see the decisions).

**Proposed phases** (both done, see below):
1. **A livelier sky:** the real night sky behind the solar system (catalogue stars and a faint Milky Way band), a
   few stars twinkling gently at random; now and then a faint comet with a glowing tail streaks across the background, behind the
   planets. Under reduced motion: stars stay still, no comets.
2. **Explore the solar system:** once at the Earth, the mouse wheel, a pinch, or "+"/"−" buttons zoom between the
   Earth and the whole solar system out past Neptune. Clicking or tapping the Sun or a planet (or its name) rings it
   and shows its name and distance: the Sun "26,700 light-years from the centre of the Milky Way", a planet "X
   million miles (Y million km) from the Sun" for that day. The Earth's "You are here" stays. The names become
   buttons, so the keyboard can reach them too.

**Decisions** (user, 2026-11-12):
- **Star sky:** the real night sky: the naked-eye stars of the Yale Bright Star Catalogue (5th edition, about
  5,000 stars brighter than magnitude 6, with true positions, brightness and colours), so the constellations are
  real, plus a faint Milky Way band along the galactic plane. Kept as a small data file in `docs/` (about 60 KB),
  with the source credited in the README. The galaxy stage keeps its generated stars.
- **Going back from the solar system:** only "← Back" and Esc. Clicking empty space there does nothing, so a missed
  tap on a planet doesn't end the tour. During the flight through the galaxy, a click anywhere still goes back.
- **Navigation:** zoom only, by wheel, pinch, or "+"/"−" buttons, along the path the tour flew (between the Earth
  and the whole solar system). No dragging to rotate.
- **Comets:** occasional: one every 6–15 seconds at random, faint, with a glowing tail.

## Tour: from the galaxy to "You are here"

**Request** (user, 2026-11-12): clicking the gargoyle fades it away, and the Milky Way zooms into our solar system
with a pointer on the Earth that says "You are here". Use real data where it exists.

**Builds on:** the WebGL galaxy in `docs/main.js` (already 2 major and 2 minor arms with a bar), the head in
`docs/index.html`, the banner and the quote slot.

**What real data exists:**
- No true 3D map of the whole Milky Way exists (we are inside it, and dust hides the far side), but its layout
  is well measured: a barred spiral about 100,000 light-years across; major arms Perseus and Scutum–Centaurus,
  minor arms Sagittarius and Norma; a bar about 27° from the Sun–centre line; the Sun about 26,700 light-years
  (8.2 kpc) from the centre, in the Orion Spur between the Sagittarius and Perseus arms.
- Planet positions: NASA JPL "Approximate Positions of the Planets" (Keplerian elements, good for 1800–2050).
- The galaxy and the solar system differ in size by about 10^8, so the zoom is staged with crossfades
  (galaxy → the Sun's spot → solar system), not one continuous zoom. Planets are drawn larger than true scale,
  and labelled so.

**Phases** (phases 1–3 are done, see below):
1. **Match the real Milky Way:** tune the generated galaxy's arms and bar to the measured layout, make the arms
   trail as the real ones do, add the Orion Spur, and fix the Sun's real position (used by phase 2, where it gets
   its marker). The landing page looks nearly the same.
2. **Click the head to fly to the Sun:** clicking (or Enter on) the head fades it and the quotes out; the banner
   moves up to the top edge. The camera flies through the galaxy to the Sun's spot, where a marker appears.
   A "← Back" button, a click anywhere or Esc flies back and brings the head and quotes back. Under reduced
   motion each step cuts instead of flying.
3. **Solar system with "You are here":** crossfade into the Sun, the orbits and the 8 planets at their real
   positions for the visitor's date, then ease in towards the Earth, with a "You are here" label pointing at it.
4. **Later, optional:** an in-between stage with the ~100 nearest real stars (HYG catalogue, CC BY-SA 4.0). Built 2026-11-13
   (see Done).

**Decisions** (user, 2026-11-12):
- **Planet style:** glowing dots with thin orbit rings, in plain WebGL. No libraries; the site stays
  dependency-free.
- **Getting back:** both a visible "← Back" button and a click anywhere / Esc.
- **Banner and quotes during the tour:** the quotes are hidden; the banner stays but moves up to the top edge,
  out of the way.
- **Planet positions:** live, for the visitor's date.

## Done

### The asteroid belt and Jupiter's Trojans in the solar system (2026-11-13)

**Decided** (user):
- **Data:** real asteroids from JPL's Small-Body Database, each at its true place for the date.
- **Count:** about 20,000 (the brightest).
- **Extras:** Ceres, Vesta and Pallas get name buttons like the planets (picked: ringed, with the distance from
  the Sun, Ceres noted as a dwarf planet); Jupiter's Trojans (the two swarms 60° ahead of and behind Jupiter) are
  included. No on/off button.
**Built** in `tools/make-asteroids.py` (two JPL Small-Body Database queries to `docs/asteroids.bin`: 17,991 belt
asteroids and 1,999 Trojans by absolute magnitude, all at epoch JD 2461200.5; 10 long-lost ones with other epochs
left out; 280 KB), `docs/main.js` (the asteroids section after Webb: `loadAsteroids()`, `placeAsteroids()` through
`orbitPoint()`, `drawAsteroids()` dimming them as the belt shrinks on screen; Ceres, Pallas and Vesta as
`solar.bodies[CERES..]` with name buttons, Ceres "a dwarf planet"; the note counts them), `docs/index.html` and
`docs/style.css` (the JPL credit, hidden at the globe).
**Checked** against JPL Horizons for 13 November 2026: Ceres and Vesta within about 25,000 km; the Trojans
average 67° ahead of and 58° behind Jupiter's mean longitude. In headless Chromium (scratch `asteroids.js`) at
1100×750, 390×844 and with reduced motion: the belt and both swarms show at every zoom without blurring into a
solid ring, the three names appear where there is room, picking Ceres and Vesta shows their distances; the
Webb and space junk checks still pass; no console errors.

### The cloud of space junk round the Earth up close (2026-11-13)

**Decided** (user): everything tracked, colour-coded (working satellites against debris, rocket bodies and dead
satellites); a snapshot refreshed by hand, its date on the page; sped up like the ISS. After the data was checked
(of 35,504 tracked objects only about 19,600 have freely published elements; Space-Track's full set may not be
republished): the rest shown on their true orbits from CelesTrak's catalogue at made-up places, said in the note.
**Built** in `tools/make-junk.py` (CelesTrak's `satcat.csv` and five GP groups to `docs/junk.bin`: 16,881 working,
3,253 other with elements, 15,294 modelled, data of 13 November 2026), `docs/main.js` (the space junk section after
the ISS: `junkProg`, Kepler plus J2 in the vertex shader, hidden behind the Earth, dimmed in its shadow;
`loadJunk()`, `drawJunk()`, `setJunkNote()`), `docs/index.html` (the "Space junk" layer button, `#junk-note`, the
CelesTrak credit) and `docs/style.css` (`.tour-note.is-junk`). The layer row sits just above the note, however
long it is. Not measured against SGP4 (no `sgp4` package here): the left-out short-period terms are of the order
of 10–20 km in low orbit.
**Checked** in headless Chromium (scratch `junk.js`, `clouds.js`) at 1100×750, 390×844 and with reduced motion: the
swarm shows round the globe and streams on, hides behind the Earth, the button turns it and its note line off
and on; under reduced motion it appears once loaded and the note says it moves at real speed; no console errors.

### A clouds on/off control at the Earth up close (2026-11-13)

**Decided** (user): a row of small layer buttons at the bottom right, "Clouds" now and "Space junk" next; the
choice is remembered in the browser.
**Built** in `docs/index.html` (`#layers`, a `data-layer="clouds"` button with `aria-pressed`), `docs/main.js` (the
globe section's `layers`, `stepLayers()`, the shader's `uCloudGain`; `showStage()` shows the row only at the globe)
and `docs/style.css` (`.layers`, a gold light when on). Off, the clouds fade out in about half a second and the
ocean glint and city lights show unclouded; under reduced motion they cut.
**Checked** in headless Chromium (scratch `clouds.js`) at 1100×750, 390×844 and with reduced motion: the row shows
only at the globe, Enter and a click toggle it, the choice survives a reload, Esc back hides it; no console errors.

### Nearest real stars between the galaxy and the solar system (2026-11-13)

**Decided** (user): the HYG catalogue (CC BY-SA 4.0); stars within 20 light-years; passed through, adding about 5 s,
with a few famous stars named with their distance; a click anywhere still goes back.
**Built** in `tools/make-near-stars.py` (HYG v4.1 to `docs/near-stars.json`: 102 stars with a Gliese number within
20 light-years, in galactic coordinates, 6 named), `docs/main.js` (the nearest-stars section after Webb: `loadNear()`,
`drawNear()`; the tour's `NEAR` stage and `INTO_SUN`, `galaxyCamera()`'s `n`, the reduced-motion cuts),
`docs/index.html` (`#near-labels`, the note's `near-note` and HYG credit) and `docs/style.css` (`.near-label`,
`.tour-note.is-near`). The stars sit round the galaxy's Sun with galactic north out of the disc, so the camera flies
on from the galaxy into them, circling a little; the galaxy fades out; the Sun and the named stars get labels (left
of the dot when the right would run off screen); then the dive into the Sun as before.
**Checked** in headless Chromium (scratch `near.js`) at 1100×750, 390×844, with reduced motion (Sun, stars, Earth
cuts) and a click among the stars (flies home); the names, note, credit and status text show during the stage only;
the Webb and ISS checks still pass with the longer tour; no console errors.

### The James Webb Space Telescope in the solar system (2026-11-13)

**Request** (from `new.md`): show Webb and its orbit round the Sun in the solar system view, with its distances
from the Earth and the Sun when picked. **Decided** (user): L2 for the date plus a modelled halo loop at a made-up
point (no data file); drawn further out from the Earth than true, with a "James Webb" name button; a faint loop
line at the same enlarged scale.
**Built** in `docs/main.js` (the Webb section after the ISS: `webbLoopPoint()`, `webbPlace()`, `drawWebb()`; Webb
is `solar.bodies[WEBB]` with `true` and drawn `pos`; `distanceParts()`, `select()` and `placeLabels()` handle it)
and `docs/style.css` (`.planet-label.is-left`/`.is-up`, `.marker--body.is-webb`). A gold point 60 px out from the
Earth on screen (at most 25 times its true offset) with its loop; zoomed out it fades and can't be picked. Its name
goes right of its dot, else left, else left and raised, clear of "You are here". Picked: "James Webb Space
Telescope", "About 1,060,000 miles (1.7 million km) from the Earth," then its distance from the Sun.
**Checked** in headless Chromium (scratch `webb.js`) at 1100×750, 390×844 and with reduced motion: its name shows
on arrival, picking it shows the distances (two lines on desktop, four on a phone) and the status text, zooming
out three steps fades it and hides its marker; the Earth dive (scratch `iss.js`) still works; no console errors.

### The International Space Station round the Earth up close (2026-11-13)

**Built** in `docs/main.js` (the ISS section after the rockets: `issAt()`, `issOrbit`, `drawIss()`; `earthView()`
now shared with the rockets), `#iss-marker` in `docs/index.html` and `.marker--iss` in `docs/style.css`. At the
Earth up close a bright point circles 420 km up on an orbit tilted 51.6° (made-up node, a lap in 120 s), with a
faint dotted line along the orbit; both hide behind the Earth, and the point dims in the Earth's shadow. Its label:
"International Space Station", "260 miles (420 km) up, 17,100 mph (27,600 km/h)". Still under reduced motion.
**Checked** in headless Chromium (scratch `iss.js`) at 1100×750 and 390×844: the marker moves across the globe and
hides as the ISS goes behind it, the line's far side is hidden, the label fits on a phone; under reduced motion it
stands still with its label; no console errors.

### The Moon's phase in its label (2026-11-13)

**Built** in `docs/main.js` (`moonPhase()`, called from `drawGlobe()`; `placeMoonMarker()` fills it in) and
`#moon-phase` in `docs/index.html`. The Moon's label at the Earth up close reads "The Moon", then its phase on its
own small line, then its distance and how much is lit. The phase comes from the Moon's angle east of the Sun along
the ecliptic; the four main phases are named within 12° (about a day) of the moment.
**Checked** in headless Chromium (scratch `phase.js`, the page's clock shifted) for today (Waxing crescent, 17% lit),
+4 days (First quarter), +22 (Waning crescent) and +26 (New Moon), and with the page's own formulas (scratch
`phasefn.js`) across the month, including Waxing gibbous, Full Moon on 24 November and Waning gibbous; no console
errors.

### Rockets launching from the Earth up close (2026-11-13)

**Built** in `docs/main.js` (the rockets section: `LAUNCH_SITES`, `rocketPath()`, `launchRocket()`,
`drawRockets()`), `#launch-site` in `docs/index.html` and `.marker--launch` in `docs/style.css`. At the Earth up
close, 2–4 s after arriving and then every 10–20 s, a rocket lifts off from one of 15 sites well inside the
visible disc (never the same site twice running), with a brief glow at the pad. It tips over towards the site's
heading and arcs away, a 3 px flickering point fading near the screen's edge; its trail is drawn from the flight's
path points, dimmed where they crowd together on screen so it is evenly bright, and fades over a few seconds.
Points the Earth hides are not drawn. The site's name shows for 4 s and fades over 1.5 s. Rockets fade out as the
camera leaves; none under reduced motion.
**Checked** in headless Chromium (scratch `rockets.js`) at 1280×800 and 390×844: launches from Vandenberg
(south, over the Pacific and off the bottom), Kourou (east, off the right) and Cape Canaveral with their names
by the pads; trails fade after the rockets; the name hides after Esc; 50–58 fps in software rendering; no console
errors.

### Dive into a realistic Earth seen from space (2026-11-12)

**Built** in `docs/main.js` (the globe section: `sphereMesh`, `globeProg`/`airProg`, `loadGlobe`, `earthAxes`,
`moonPlace`, `moonAxes`, `drawGlobe`; and in the tour section `visit`, `visitEarth`, `leaveEarth`, `slerp`,
`diveCamera`, `placeMoonMarker`), `docs/index.html` (`#earth-dive`, which "You are here" now is, `#moon-marker`,
`#globe-caption`, the globe note and NASA credit), `docs/style.css`, `docs/assets/img/earth-day.webp`,
`earth-night.webp`, `earth-clouds.webp`, `moon.webp` (1.1 MB together, loaded when the tour reaches the Earth) and
`tools/make-earth-images.js`.

What it does:
- **Starting the dive:** a click on the Earth's dot, or on "You are here" (by mouse or keyboard), at any zoom, flies
  on in over 5 s. The planets fade and the dot grows into a globe filling 62% of the screen's narrower half.
- **Where it ends:** over the visitor's time zone (from the browser's UTC offset, 25° north), with north up. The
  camera then circles westward (about one turn in 3.5 minutes), so the Earth seems to turn the right way.
- **The globe:** turned by Greenwich sidereal time, with day and night blended across the terminator, city lights,
  clouds, sunlight glinting on the sea, and the air's glow inside and outside the edge.
- **The Moon:** in its real place and phase, 1:1 in size and distance. Its marker (distance in miles and km, % lit)
  shows when it's on screen and not behind the Earth.
- **Text:** a caption and the status line read "The Earth now: day and night as they are at <time> your time". The
  note credits NASA alongside the stars.
- **Going back:** "← Back" or Esc goes back to the solar system; from there it flies home as before.
- **Reduced motion:** cuts both ways, and the camera doesn't circle.

The cloud layer was made from the Blue Marble with and without clouds, because the old Visible Earth image
server (eoimages.gsfc.nasa.gov) no longer answers.

**Checked** in headless Chromium (scratch `globe.js`, `globe2.js`, `moon.js`):
- Frames of the dive and of the globe. The day/night line was where it really was (22:44 UTC: the US East Coast
  lit up at dusk, the Pacific in daylight; Europe and Asia at night).
- The Moon came into view after about 108 s of circling: 12% lit, which matches today's crescent, 41° from the Sun.
- Esc steps out to the solar system, then home.
- A reduced-motion phone cuts in by a tap on the dot, and "← Back" cuts out.
- The exploring walk-through (`explore.js`) still passes.
- No console errors.

### The head pulses to invite a click (2026-11-12)

**Built** in `docs/style.css` (`heartbeat`, `aura`, `eye-beat` and `.tilt::before`): while the head is a button, it
beats "lub-dub" every 2.9 s (first 2.4 s, slowed on request to feel more relaxed): it swells 3% (the `scale` property, so it adds to the tilt), a gold aura flares round
the cut-out's outline (a blackened copy of the image with a gold drop-shadow, 6% larger up and left so the horns'
glow isn't clipped, faded at the cropped right and bottom edges), and the eye flares. Hover or focus stops it (the
eye goes back to its slow pulse); so do the tour and reduced motion.
**Checked** in headless Chromium (scratch `pulse.js`, `pulsefocus.js`): frames frozen at the beat's peak and at
rest (aura on the outline only, no straight edges); hover and keyboard focus stop the beat, moving away restarts
it; no head animations under reduced motion; no console errors.

### Solar system: exploring it (2026-11-12)

**Built** in `docs/main.js` (the tour section: `zoom`, `setZoom`, `select`, `placeBodyMarker`, the wheel, pinch,
key and click handlers), `docs/index.html` (`#body-marker`, `#zoom`) and `docs/style.css`. Once the tour reaches
the Earth, the wheel (or a trackpad pinch), a two-finger pinch, the "+"/"−" buttons (bottom right) or the +/− keys
zoom along the tour's own path, from the Earth out to the whole system; the tour's zoom is scaled by the visitor's,
so going back starts from wherever they are. The planet names are now buttons (`aria-pressed`, hidden ones can't be
reached). Picking a body (its name, or a click within 24px of its dot) rings it and shows its name and distance,
which the status line also reads out: the Sun "26,700 light-years from the centre of the Milky Way", a planet "X
million (or billion) miles (Y km) from the Sun". Picking it again or picking the Earth lets go. While another body
is picked, the Earth's label shrinks to "You are here", and the picked one's label moves to the other side of its
ring when it would cover it. In the solar system only "← Back" and Esc go back; before the dive, a click anywhere
still does.
**Checked** in headless Chromium (scratch `explore.js`): picking by name and by dot, an empty click doing nothing,
zooming out by wheel to the limits (buttons dimmed), Neptune's distance, "+" keys, Esc and a click during the
flight going back, the Tab order (visible names, then the zoom buttons); a 390 px phone with reduced motion: taps on
"−" and a name, labels flipped clear of each other, no overflow; no console errors.

### Solar system: a livelier sky (2026-11-12)

**Built** in `docs/main.js` (the sky section: `buildSky`, `skyProg`, the comets and `drawSky`), `docs/stars.bin`
and `tools/make-stars.py`. The solar system's background is now the real night sky: the 5,023 stars of the Yale
Bright Star Catalogue (5th edition) brighter than magnitude 6, in their true directions (J2000, tilted onto the
ecliptic the planets use), sized and dimmed by magnitude and coloured by B-V, from a 30 KB file (6 bytes a star).
The Milky Way is a band of large faint points (sized as an angle on the sky, so it looks the same on any screen)
and tiny ones along the galactic plane, brighter and thicker towards the centre in Sagittarius. About 15% of the
stars brighter than magnitude 4.5 flicker for a few seconds now and then. A comet with a glowing tail crosses part
of the screen a few seconds after arriving, then every 6–15 s, behind the planets. Under reduced motion the stars
stay still and there are no comets. Until `stars.bin` loads (or if it can't), the galaxy's generated stars stand in.
The galaxy stage is unchanged.
**Checked** in headless Chromium (scratch `sky.js`, `diff.js`): `stars.bin` decodes (Sirius, Canopus, Arcturus at
their catalogue positions); desktop frames over 17 s at the Earth show twinkles and two comets; a phone at 390 px
with reduced motion shows the same sky with identical frames; no console errors.

### Small changes (2026-11-12)

- **The Earth's ring beats** (2026-11-13): the ring round the Earth in the solar system view beats like the
  head (2.9 s "lub-dub", swelling 22% with a brighter glow) to invite a click; it rests, lit, while "You are
  here" is hovered or focused, and under reduced motion (`ring-beat` in `docs/style.css`).

- **Star credit:** the note at the bottom of the solar system view ends "Real stars thanks to Yale's Bright Star
  Catalogue", linking to Harvard's page for the catalogue in a new tab (`.tour-credit` in `docs/index.html`); the note is no
  longer hidden from screen readers, and on phones the zoom buttons sit higher to clear it.

- **Title rises on hover:** pointing at (or focusing) "Winux Nomacs" makes it grow 15% and lift, with its shadow
  falling further and spreading, as if it rose off the page (`.banner-link:hover` in `docs/style.css`); it only
  brightens under reduced motion.

- **Skip a quote:** clicking or tapping the quote makes it float away at once, even mid-print, and the next one
  follows after the usual 3 s gap (`shown()` and `skip` in `docs/quotes.js`).

- **Slow orbit:** at the Earth the solar system camera circles round the point it looks at, about one turn in four
  minutes, easing in after arrival and out on the way back; none under reduced motion. The Earth's and the picked
  body's labels stay on screen as it turns (`fitLabel()` in `docs/main.js`).

- **Custom domain:** the site is served at <https://winuxnomacs.com/> (`docs/CNAME`, added by GitHub).
- **More quotes**, and the head's alt text no longer shows while the image loads.
- **Silver text:** the banner and quotes are gleaming silver 3D text with a band of light sweeping across them.
- **Laser printing:** a beam from the gargoyle's eye prints each quote, letter by letter (`laser()` in
  `docs/quotes.js`).
- **Earth's distance:** "You are here" shows the Earth's distance from the Sun for the day, in miles and km.

### Tour phase 3: the solar system with "You are here"

**Built** in `docs/main.js` (the solar system section with `PLANETS` and `solarProg`, and the tour section, now one
timeline: fly 6 s, hold 1.5 s at the Sun, dive 3 s, zoom 6 s), `docs/index.html` (`#earth-marker`,
`#planet-labels`, `#tour-note`; the markers share `.marker` classes) and `docs/style.css`. After the Sun's marker,
the camera dives into the Sun while the galaxy fades out, and the solar system fades in from a wide view of all 8
orbits, then eases in from above and outside the Earth's side, looking back at the Sun. The planets are at their
real positions for the visitor's date (JPL Keplerian elements; checked against today's sky: the Earth at
heliocentric longitude 49.7°, the Sun at 229.7° as seen from Earth, and against J2000). Names are shown where they
fit without clashing; at the end "You are here — The Earth, <date>" marks the Earth, and a note says distances are
to scale and planets drawn larger. Going back from any point takes 6 s. Under reduced motion it cuts to the Sun,
then after 3 s to the Earth.
**Checked** in headless Chromium (scratch `solar/walk.js`, `solar/check.js`): screenshots of every stage on desktop
and phone; back by Esc from the Earth, by a click during the dive, by "← Back" at the Sun, each landing home with
the focus on the head; status texts; markers, labels and note shown only at their stage; no overflow; reduced-motion
cuts, including no late cut after going back early; no console errors.

### Tour phase 2: click the head to fly to the Sun

**Built** in `docs/main.js` (the tour section, and `uView` / `uStarCap` in the shader), `docs/index.html` (`#head`,
`#back`, `#sun-marker`, `#tour-status`) and `docs/style.css` (the tour block). The head becomes a button only when
WebGL works. Clicking it or pressing Enter fades the head and quote, lifts the banner to 12px below the top edge,
moves the focus to "← Back" and flies the camera for 6 s, keeping the Sun's spot steady as the galaxy turns. It ends
outside and above the Sun's orbit, with the Sun low on the right and the bulge, bar and arms beyond it. Then the
marker ("The Sun, 26,700 light-years from the centre") fades in, and screen readers hear the same in a status line.
"← Back", a click anywhere (except the banner link) or Esc flies back, even mid-flight, and the focus returns to the
head. Under reduced motion each step cuts. Phones put the marker's label under the ring.
**Checked** in headless Chromium (scratch `tour-check.js`, `view-try.js`): flying out and back by mouse, Enter, Esc,
a click anywhere and "← Back"; marker position, status text, focus and banner position; phone size with no
overflow; reduced motion cuts; no console errors. The landing page is unchanged (same frame rate as `main` within
SwiftShader's noise, galaxy still under reduced motion).

### Tour phase 1: match the real Milky Way

**Built** in `docs/main.js` (galaxy section): 1 unit = 1.36 kpc; bar along +x, about 4.6 kpc from centre to
end (round bulge plus a long thin bar); arms at 12° pitch from the bar's ends, now trailing the rotation; their
crossings of the Sun's line match the measured radii (Scutum–Centaurus 5.1 kpc, Sagittarius 7.1, Perseus 10.0);
an Orion Spur through the Sun; `SUN` = radius 6.0 units (8.2 kpc), angle −27° from the bar's near end, 20 pc
above the plane. The Sun's marker comes with phase 2. Checked in headless Chromium with scratch scripts: a
top-down view with a debug dot at `SUN` (between Sagittarius and Perseus, in the spur), the landing page before
and after (nearly the same look), phone size, the galaxy still under reduced motion, no console errors.

### Banner link, larger and bolder text, quotes typed in

**Requests** (from `new.md`, 2026-11-12):
- Clicking the "Winux Nomacs" banner opens <https://github.com/winuxnomacs>.
- Make the text 10% larger and bolder so it stands out more.
- Quotes fade in as if typed quickly, left to right.

**Builds on:** the banner (`<h1 class="line line--top">` in `docs/index.html`), the shared `.line` text style
and the quote float in `docs/style.css`, and the quote cycle in `docs/quotes.js`.

**Current state:**
- The banner is plain text.
- All text is light weight (300), grey, at 75% opacity. The banner is `clamp(1.1rem, 3.2vmin, 1.8rem)` and the
  quotes are `clamp(0.95rem, 2.5vmin, 1.2rem)`, with the quotes at 85% opacity while shown.
- A quote rises out of a blur over 1.6 s, holds for 10 s, then rises away over 1.6 s, with a 3 s gap before the
  next. The longest quote is 57 characters.

**Design:**
- **Banner link:** the banner text becomes a link to <https://github.com/winuxnomacs>. It opens in the same tab,
  the usual behaviour for a personal landing page. It brightens slightly on hover and shows a visible keyboard
  focus ring. It has no underline, so it still reads as a title.
- **Larger text:** every `clamp()` value of the chosen text is multiplied by 1.1. The quote slot keeps room for
  two lines, so the head doesn't jump.
- **Typed quotes:** each character fades in quickly, in order, left to right, at about 30 ms per character (the
  longest quote types in about 1.7 s). The 10 s hold starts once the last character is in. Screen readers get the
  whole quote at once rather than letter by letter. Words never break mid-word across lines.
- **Under reduced motion:** the typing still plays, because it doesn't move anything on screen. Nothing floats.

**Decisions** (user, 2026-11-12):
- **Which text:** both the banner and the quotes get 10% larger and bolder.
- **Weight:** medium (500), up from light (300).
- **Quote motion:** typing replaces the rise-from-blur entrance. After its 10 s, the quote still floats up and
  fades away as it does now.
- **Cursor:** none. The letters just fade in left to right.

**Built:** the banner link is in `docs/index.html`, the styles in `docs/style.css` (`.banner-link`, `.line`,
`.quote .ch`, `.sr-only`), and the typing in `type()` in `docs/quotes.js`. It was checked in headless Chromium: the
href and the click, the hover colour, the computed sizes (exactly 1.1×) and weight 500, three fast-forwarded rounds
(each quote once per round; 10 s hold after typing, 1.6 s exit, 3 s gap), the screen-reader copy, and screenshots
on desktop and phone mid-typing and fully typed.

### Earlier

- **Animated single-page site:** plain HTML/CSS/JS in `docs/`, served from `main` `/docs`. MkDocs and its
  workflow were removed.
- **Higher-quality image:** two sizes made from the 2048 px original.
- **3D galaxy background:** WebGL galaxy in `docs/main.js`, and the cut-out head in
  `docs/assets/img/gargoyle-cutout-*.webp`.
- **Floating quotes:** `docs/quotes.md` and `docs/quotes.js`, and the "Winux Nomacs" banner.
- **Checks:** all of these were checked in headless Chromium with scratch scripts, since the repo has no test
  suite.
