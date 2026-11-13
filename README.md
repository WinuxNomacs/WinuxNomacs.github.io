# Winux Nomacs

Source for <https://winuxnomacs.github.io/>: a single page with a gargoyle's head floating in front of a spiral
galaxy that turns slowly in 3D space. "Winux Nomacs" sits above the head and links to
<https://github.com/winuxnomacs>; pointing at it makes it rise up to meet the pointer. Quotes appear below it one at a time, printed letter by letter by a laser beam from the gargoyle's glowing eye. The head drifts, its eye glow pulses, and it tilts toward the mouse (or the
phone's tilt, where the browser allows it) while the galaxy shifts behind it for depth. Visitors who have turned
on "reduce motion" in their system settings get a still picture.

The galaxy is drawn with WebGL from about 110,000 generated points (fewer on phones). It uses no images and no
libraries. It is laid out like the real Milky Way as astronomers have measured it: the bar, the two major arms
(Scutum–Centaurus and Perseus), the two minor ones (Sagittarius and Norma) and the Orion Spur, where the Sun is. Without WebGL, the head floats on plain black.

The head beats like a heart, a double pulse every 2.9 seconds with a gold aura flaring round its outline, to invite
a click; it rests while the pointer is on it. Clicking the head (or pressing Enter on it) starts a tour. The head and the quote fade away, the banner moves up to
the top edge, and the camera flies through the galaxy to the Sun's real place in it, about 26,700 light-years from
the centre, where a marker appears. Then it flies in among the nearest real stars: the 102 within 20 light-years
of the Sun, at their true distances and colours (brightness squeezed so the faint red dwarfs show), with the Sun and
a few famous neighbours (Alpha Centauri, Barnard's Star, Sirius and others) named with their distance. Then it dives
into the Sun, and the solar system fades in: the Sun, the eight
planets and their orbits, with each planet where it really is on the visitor's date (worked out in the browser from
NASA JPL's Keplerian elements). Behind them is the real night sky: the stars of the Yale Bright Star Catalogue
that can be seen with the naked eye, in their true places, brightness and colours, and a faint Milky Way band. A
few stars twinkle now and then, and every so often a comet streaks past. The note at the bottom credits the
catalogue, with a link to it. The camera eases in towards the Earth, marked "You are here", with the date and how far the Earth is from the Sun that day, in miles and kilometres. Distances are to
scale; the planets are drawn larger.

At the Earth, the camera slowly circles (about one turn in four minutes) round the point it looks at: the Sun when
zoomed out, a point between the Sun and the Earth when close, so the Earth stays in view. Visitors can explore: the mouse wheel, a pinch or the "+"/"−" buttons zoom out to the whole solar
system, past Neptune, and back in. Clicking or tapping the Sun or a planet, or its name, rings it and shows its
distance: the Sun's from the centre of the Milky Way, a planet's from the Sun on that day. The names are buttons, so
the keyboard reaches them too, and "+"/"−" keys zoom.

Between Mars and Jupiter lies the asteroid belt: the 18,000 brightest asteroids, plus the 2,000 brightest of
Jupiter's Trojans, the two swarms sharing Jupiter's orbit 60° ahead of it and 60° behind. Each is a faint point where
it really is on that day, so the belt's spread and the Trojan swarms show. Seen from far off they dim, so the belt
doesn't blur into a solid ring. Ceres (a dwarf planet), Vesta and Pallas, the biggest, have names and can be picked
like the planets.

Close to the Earth, a small gold point is the James Webb Space Telescope, with a faint loop round it. Webb circles
the Sun–Earth L2 point, 1.5 million km beyond the Earth on the side away from the Sun, in a loop that takes about
six months. That is too close to the Earth to see at this scale, so its place and loop are drawn further out. The
loop is modelled: about Webb's size, at a made-up point along it. Picking Webb shows its distance from the Earth
(say "about 1.5 million km") and from the Sun. Zoomed out, it fades into the Earth's dot.

The ring round the Earth beats in time with the head's heartbeat, resting while "You are here" is pointed at.
Clicking the Earth (its dot or "You are here", at any zoom) flies on down to it: the planets fade and the dot
grows into a realistic globe seen from space, turned as it is at that moment, so day and night fall where they
really are, with city lights on the night side, clouds, and the glow of the air round its edge. The camera
circles it slowly. The Moon is there too, in its real place and phase, its distance to scale, so it only comes into
view now and then; a small ring and label mark it, with its phase (such as "Waxing crescent"), distance and how much is lit. Every 10–20 seconds a tiny rocket lifts off from a real launch
site on the side facing you (Cape Canaveral, Vandenberg, Starbase, Kourou, Baikonur, Wenchang and others), its name
showing briefly by the pad. It climbs away on a sweeping arc, stretched far beyond a real ascent so it can be seen
from here, and fades near the screen's edge, its exhaust trail fading after it. The International Space Station
circles just above the surface on its true orbit (about 420 km up, tilted 51.6° to the equator, with a faint line
along it), sped up so a lap takes two minutes rather than 93, and dimmer in the Earth's shadow; its place on the
orbit is made up. A small ring and label mark it. Round it all swarms the space junk: every object tracked in orbit,
about 35,000, as tiny points, working satellites blue-white and debris, spent rocket bodies and dead satellites
orange, hidden behind the Earth and dim in its shadow. About 20,000 have published orbits and start from their true
places; the rest are on their true orbits (height, tilt and shape) at made-up places. They are sped up like the
ISS. Buttons at the bottom right turn the clouds and the space junk off and on (the browser remembers the choice).
"← Back" or Esc returns to the solar system.

"← Back" or Esc flies back from any point; out in the galaxy and among the nearest stars (before the dive into the
Sun), so does a click anywhere. With "reduce
motion" on, each step cuts straight to the next instead of flying, and the sky stays still, with no comets.

## Files

Everything the site serves is in `docs/`:

- `index.html`: the page
- `style.css`: the layout, the float and the eye-glow animations
- `main.js`: the mouse/tilt effect, the WebGL galaxy, the solar system and the tour
- `quotes.md`: the quotes, one per `- ` list line
- `quotes.js`: shows the quotes
- `stars.bin`: the night sky's stars (see below)
- `near-stars.json`: the nearest stars (see below)
- `junk.bin`: the tracked objects round the Earth (see below)
- `asteroids.bin`: the asteroid belt and Jupiter's Trojans (see below)
- `assets/img/earth-day.webp`, `earth-night.webp`, `earth-clouds.webp`, `moon.webp`: the Earth and Moon maps (see
  below)
- `assets/img/gargoyle-cutout-707.webp`, `gargoyle-cutout-1414.webp`: the head with its background cut out, at two
  sizes; high-density screens get the larger one
- `assets/img/gargoyle-707.jpg`: the favicon
- `.nojekyll`: tells GitHub Pages to serve the files as they are

The site has no build step and no dependencies.

## The stars

`docs/stars.bin` holds the 5,023 stars brighter than magnitude 6 from the Yale Bright Star Catalogue, 5th Revised
Edition (Hoffleit & Warren 1991, VizieR catalogue V/50 from CDS, Strasbourg). `tools/make-stars.py` makes it from
the catalogue file (CDS's `catalog.gz`, or the same data as Harvard's
<http://tdc-www.harvard.edu/catalogs/bsc5.dat.gz>); its comments describe the layout:

```sh
curl -O https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz
python3 -I tools/make-stars.py catalog.gz docs/stars.bin
```

`docs/near-stars.json` holds the 102 stars within 20 light-years from the HYG Database v4.1 (David Nash,
<https://github.com/astronexus/HYG-Database>, CC BY-SA 4.0). It is adapted from HYG, so it is under CC BY-SA 4.0
too. `tools/make-near-stars.py` makes it from HYG's `hygdata_v41.csv` and describes the format. It keeps only
stars with a Gliese catalogue number, which leaves out a few with bad parallaxes:

```sh
curl -O https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv
python3 -I tools/make-near-stars.py hygdata_v41.csv docs/near-stars.json
```

## The asteroids

`docs/asteroids.bin` holds the orbits of the 18,000 brightest main-belt asteroids and the 2,000 brightest Jupiter
Trojans (by absolute magnitude), from NASA JPL's [Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_query.html)
(public domain), all at one epoch; the page moves each along its orbit to the visitor's date by Kepler's laws.
That is accurate to a few tens of thousands of km for months, drifting further over the years as the planets
pull on them, so refresh it now and then. `tools/make-asteroids.py` makes it and describes the layout:

```sh
mkdir sbdb && cd sbdb
q='https://ssd-api.jpl.nasa.gov/sbdb_query.api?sb-kind=a&fields=pdes,name,class,H,epoch,a,e,i,om,w,ma&sort=H&full-prec=true&sb-cdata=%7B%22AND%22%3A%5B%22H%7CDF%22%5D%7D'
curl -o belt.json "$q&sb-class=IMB,MBA,OMB&limit=18000"
curl -o trojans.json "$q&sb-class=TJN&limit=2000"
cd .. && python3 -I tools/make-asteroids.py sbdb docs/asteroids.bin
```

## The space junk

`docs/junk.bin` holds the objects tracked in orbit round the Earth, from [CelesTrak](https://celestrak.org): the
catalogue (`satcat.csv`) for every object, and the published orbital elements of the working satellites, the
unidentified "analyst" objects and three big break-up clouds. `tools/make-junk.py` makes it and describes the
layout. The date of the download is shown on the page; positions drift from the truth by more each week, so
refresh it now and then (one download of each file, well within CelesTrak's fair use):

```sh
mkdir celestrak && cd celestrak
curl -o satcat.csv https://celestrak.org/pub/satcat.csv
for g in active analyst fengyun-1c-debris iridium-33-debris cosmos-2251-debris; do
  curl -o "gp-$g.json" "https://celestrak.org/NORAD/elements/gp.php?GROUP=$g&FORMAT=json"; sleep 2
done
cd .. && python3 -I tools/make-junk.py celestrak docs/junk.bin
```

## Quotes

To add, change or remove a quote, edit the list in `docs/quotes.md` and push. The page reads that file when it
loads. It shows the quotes in random order, each one exactly once before any repeats. A laser beam from the eye prints each quote
quickly, letter by letter, each letter glowing hot and then cooling to silver. The quote stays for 10 seconds once
fully printed, then floats up and away. The next one starts 3 seconds later. Clicking or tapping a quote skips it:
it floats away at once, even mid-print, and the next one follows 3 seconds later. After the last quote, a new shuffled
round begins, never starting with the quote that was just shown.

## The Earth and Moon images

The globe uses NASA's public-domain maps, scaled to 2048×1024 (the Moon 1024×512) and saved as WebP:
- **Day:** Blue Marble 2002 (NASA Earth Observatory), from Wikimedia Commons' "Whole world - land and oceans".
- **Night:** Black Marble city lights (NASA Earth Observatory), from Commons' "The earth at night".
- **Clouds:** the difference between the same Blue Marble with and without clouds (Commons' "Land ocean ice cloud
  hires").
- **Moon:** the Lunar Reconnaissance Orbiter colour map from NASA's Scientific Visualization Studio CGI Moon Kit.

`tools/make-earth-images.js` remakes them from those downloads; its comments list the files and how to run it.

## Preview locally

```sh
python3 -m http.server 8000 -d docs
```

Then open <http://localhost:8000/>.

## Deploy

GitHub Pages serves `docs/` straight from the `main` branch (Settings → Pages → Deploy from a branch → `main`
/ `/docs`). Pushing to `main` publishes the site, usually within a minute. No GitHub Actions workflow is involved.
