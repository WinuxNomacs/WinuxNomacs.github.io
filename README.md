# Winux Nomacs

Source for <https://winuxnomacs.github.io/>: a single page with a gargoyle floating in the centre of a black
screen. The gargoyle drifts slowly, its eye glow pulses, it tilts toward the mouse (or the phone's tilt, where
the browser allows it), and faint embers drift up behind it. All motion stops for visitors who have turned on
"reduce motion" in their system settings.

## Files

Everything the site serves is in `docs/`:

- `index.html`: the page
- `style.css`: the layout, the float and the eye-glow animations
- `main.js`: the mouse/tilt effect and the ember background
- `assets/img/gargoyle-707.jpg`, `gargoyle-1414.jpg`: the image at two sizes; high-density screens get the larger one
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
