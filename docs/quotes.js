// Types the quotes from quotes.md in under the head, one at a time, in random order.
// Each round shows every quote once before any repeats; then a new shuffled round starts.
(() => {
  const el = document.getElementById('quote');
  const CHAR_MS = 30;  // ms between letters starting to appear (matches the CSS animation-delay)
  const FADE_MS = 250; // ms each letter takes to fade in (matches the CSS animation)
  const HOLD = 10000;  // ms fully on screen, counted from the last letter
  const EXIT = 1600;   // ms to float away (matches the CSS transition)
  const GAP = 3000;    // ms of empty space before the next quote

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Every "- text" or "* text" line of the markdown list is a quote; anything else is ignored.
  const parse = (md) => [...new Set(
    md.split('\n')
      .map((line) => line.match(/^\s*[-*]\s+(.+?)\s*$/))
      .filter(Boolean)
      .map((m) => m[1])
  )];

  const shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  // Fills the slot with one span per letter, grouped by word, plus a plain copy for screen readers.
  // Returns how long the typing takes in ms.
  function type(quote) {
    const spoken = document.createElement('span');
    spoken.className = 'sr-only';
    spoken.textContent = quote;
    const shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    let i = 0;
    quote.split(' ').forEach((word, w) => {
      if (w > 0) { shown.append(' '); i++; }
      const span = document.createElement('span');
      span.className = 'word';
      for (const ch of word) {
        const letter = document.createElement('span');
        letter.className = 'ch';
        letter.style.setProperty('--i', i++);
        letter.textContent = ch;
        span.append(letter);
      }
      shown.append(span);
    });
    el.replaceChildren(spoken, shown);
    place();
    const ms = Math.max(0, i - 1) * CHAR_MS + FADE_MS;
    if (!still.matches) laser();
    return ms;
  }

  // Moves a laser along the letters as they appear, as if it were printing them, then fades it out.
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  function laser() {
    const letters = [...el.querySelectorAll('.ch')];
    if (!letters.length) return;
    const beam = document.createElement('span');
    beam.className = 'laser';
    beam.setAttribute('aria-hidden', 'true');
    el.append(beam);
    const box = el.getBoundingClientRect();
    const end = Number(letters[letters.length - 1].style.getPropertyValue('--i')) * CHAR_MS;
    const frames = letters.map((letter) => {
      const r = letter.getBoundingClientRect();
      const x = r.left - box.left + r.width / 2, y = r.top - box.top + r.height / 2;
      return { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
               offset: end ? Number(letter.style.getPropertyValue('--i')) * CHAR_MS / end : 0 };
    });
    if (frames.length === 1) frames.push({ ...frames[0], offset: 1 });
    beam.animate(frames, { duration: Math.max(1, end), easing: 'linear', fill: 'forwards' });
    // On in 80ms, held while printing, off over 300ms after the last letter.
    const total = end + 380;
    beam.animate([{ opacity: 0 }, { opacity: 1, offset: 80 / total }, { opacity: 1, offset: (end + 80) / total },
                  { opacity: 0 }], { duration: total, fill: 'forwards' })
      .finished.then(() => beam.remove(), () => {});

    // The beam from the gargoyle's eye to the laser's point, re-aimed every frame until the laser is gone.
    const ray = document.createElement('span');
    ray.className = 'eye-beam';
    ray.setAttribute('aria-hidden', 'true');
    document.body.append(ray);
    const follow = () => {
      if (!beam.isConnected) { ray.remove(); return; }
      const e = eye.getBoundingClientRect(), h = beam.getBoundingClientRect();
      const ex = e.left + e.width / 2, ey = e.top + e.height / 2;
      const dx = h.left + h.width / 2 - ex, dy = h.top + h.height * 0.3 - ey;
      ray.style.width = Math.hypot(dx, dy).toFixed(1) + 'px';
      ray.style.transform = `translate(${ex.toFixed(1)}px, ${ey.toFixed(1)}px) rotate(${Math.atan2(dy, dx).toFixed(4)}rad)`;
      ray.style.opacity = getComputedStyle(beam).opacity;
      requestAnimationFrame(follow);
    };
    follow();
  }
  const eye = document.querySelector('.eye-glow');

  // Tells each letter where it sits in the slot, so one band of light can sweep across them all (see style.css).
  function place() {
    const box = el.getBoundingClientRect();
    el.style.setProperty('--qw', box.width.toFixed(1) + 'px');
    for (const letter of el.querySelectorAll('.ch')) {
      letter.style.setProperty('--x', (letter.getBoundingClientRect().left - box.left).toFixed(1) + 'px');
    }
  }
  addEventListener('resize', place); // the lines may wrap differently

  async function run() {
    let quotes;
    try {
      const res = await fetch('quotes.md', { cache: 'no-cache' });
      if (!res.ok) return;
      quotes = parse(await res.text());
    } catch {
      return; // no quotes: the slot stays empty
    }
    if (!quotes.length) return;

    let last = null;
    for (;;) {
      const round = shuffle([...quotes]);
      // Don't show the same quote twice in a row where one round ends and the next begins.
      if (round.length > 1 && round[0] === last) {
        [round[0], round[round.length - 1]] = [round[round.length - 1], round[0]];
      }
      for (const quote of round) {
        el.className = 'line quote';
        await wait(type(quote) + HOLD);
        el.className = 'line quote is-out';
        await wait(EXIT);
        el.replaceChildren();
        el.className = 'line quote';
        await wait(GAP);
        last = quote;
      }
    }
  }

  run();
})();
