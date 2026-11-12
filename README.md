# Winux Nomacs

Source for <https://winuxnomacs.github.io/>: a single page with a gargoyle's head floating in front of a spiral
galaxy that turns slowly in 3D space. The head drifts, its eye glow pulses, and it tilts toward the mouse (or the
phone's tilt, where the browser allows it) while the galaxy shifts behind it for depth. Visitors who have turned
on "reduce motion" in their system settings get a still picture.

The galaxy is drawn with WebGL from about 110,000 generated points (fewer on phones). It uses no images and no
libraries. Without WebGL, the head floats on plain black.

## Files

Everything the site serves is in `docs/`:

- `index.html`: the page
- `style.css`: the layout, the float and the eye-glow animations
- `main.js`: the mouse/tilt effect and the WebGL galaxy
- `assets/img/gargoyle-cutout-707.webp`, `gargoyle-cutout-1414.webp`: the head with its background cut out, at two
  sizes; high-density screens get the larger one
- `assets/img/gargoyle-707.jpg`: the favicon
- `.nojekyll`: tells GitHub Pages to serve the files as they are

The site has no build step and no dependencies.

## Preview locally

```sh
python3 -m http.server 8000 -d docs
```

Then open <http://localhost:8000/>.

## Deploy

GitHub Pages serves `docs/` straight from the `main` branch (Settings → Pages → Deploy from a branch → `main`
/ `/docs`). Pushing to `main` publishes the site, usually within a minute. No GitHub Actions workflow is involved.
