// Floats the quotes from quotes.md in under the head, one at a time, in random order.
// Each round shows every quote once before any repeats; then a new shuffled round starts.
(() => {
  const el = document.getElementById('quote');
  const ENTER = 1600;  // ms to float in (matches the CSS transition)
  const HOLD = 10000;  // ms fully on screen
  const EXIT = 1600;   // ms to float away
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
        el.textContent = quote;
        el.className = 'line quote is-in';
        await wait(ENTER + HOLD);
        el.className = 'line quote is-out';
        await wait(EXIT);
        el.className = 'line quote';
        await wait(GAP);
        last = quote;
      }
    }
  }

  run();
})();
