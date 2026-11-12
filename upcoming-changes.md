# Upcoming changes

## Phases (current and upcoming)

- **Up next:** 1. Banner link, larger and bolder text, quotes typed in
- **Then:** nothing planned
- **Later:** nothing planned

## 1. Banner link, larger and bolder text, quotes typed in

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

## Done

- **Animated single-page site:** plain HTML/CSS/JS in `docs/`, served from `main` `/docs`. MkDocs and its
  workflow were removed.
- **Higher-quality image:** two sizes made from the 2048 px original.
- **3D galaxy background:** WebGL galaxy in `docs/main.js`, and the cut-out head in
  `docs/assets/img/gargoyle-cutout-*.webp`.
- **Floating quotes:** `docs/quotes.md` and `docs/quotes.js`, and the "Winux Nomacs" banner.
- **Checks:** all of these were checked in headless Chromium with scratch scripts, since the repo has no test
  suite.
