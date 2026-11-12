# CLAUDE.md

A static GitHub Pages site (<https://winuxnomacs.github.io/>): one page, plain HTML/CSS/JS, no build, no dependencies.

- **What is served:** everything in `docs/` (`index.html`, `style.css`, `main.js`, `assets/`). Pages deploys
  from `main` / `/docs`, and `docs/.nojekyll` turns off Jekyll processing.
- **What a push publishes:** a push to `main` puts the site live within about a minute. There are no
  workflows, so a push uses no Actions minutes.
- **Preview:** `python3 -m http.server <port> -d docs`.
- **Motion:** every animation must stop under `prefers-reduced-motion: reduce` (in both `style.css` and
  `main.js`).
- **Image:** `docs/assets/img/gargoyle-707.jpg` and `gargoyle-1414.jpg` (for 2× screens) are downscaled
  from a 2048 px original that is kept out of the repo. The page never shows it wider than 707 px.
- **Eye glow position:** the glow is placed at the lit eye, which sits at 53.0% / 32.8% of the image.
  If the image changes, measure the eye again.
