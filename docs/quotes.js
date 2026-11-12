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
    return Math.max(0, i - 1) * CHAR_MS + FADE_MS;
  }

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
