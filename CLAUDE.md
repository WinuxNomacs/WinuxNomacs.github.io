# CLAUDE.md

A static GitHub Pages site (<https://winuxnomacs.github.io/>): one page, plain HTML/CSS/JS, no build, no dependencies.

- **What is served:** everything in `docs/` (`index.html`, `style.css`, `main.js`, `assets/`). Pages deploys
  from `main` / `/docs`, and `docs/.nojekyll` turns off Jekyll processing.
- **What a push publishes:** a push to `main` puts the site live within about a minute. There are no
  workflows, so a push uses no Actions minutes.
- **Preview:** `python3 -m http.server <port> -d docs`.
- **Motion:** every animation must stop under `prefers-reduced-motion: reduce` (in both `style.css` and
  `main.js`).
- **Eye glow position:** the glow is placed at the lit eye, which sits at 53.2% / 32.7% of
  `Gargoyle.jpg`. If the image changes, measure the eye again.
