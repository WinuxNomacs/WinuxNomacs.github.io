# Upcoming changes

## Phases (current and upcoming)

- **Later:** 1. Nearest real stars between the galaxy and the solar system (tour phase 4, optional)

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
4. **Later, optional:** an in-between stage with the ~100 nearest real stars (HYG catalogue, CC BY-SA 4.0).

**Decisions** (user, 2026-11-12):
- **Planet style:** glowing dots with thin orbit rings, in plain WebGL. No libraries; the site stays
  dependency-free.
- **Getting back:** both a visible "← Back" button and a click anywhere / Esc.
- **Banner and quotes during the tour:** the quotes are hidden; the banner stays but moves up to the top edge,
  out of the way.
- **Planet positions:** live, for the visitor's date.

## Done

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
