(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  // Tilt toward the pointer (or the device's tilt where the browser allows it without asking).
  const tilt = document.getElementById('tilt');
  const MAX = 8; // degrees
  let target = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };
  let tiltFrame = null;

  function stepTilt() {
    current.x += (target.x - current.x) * 0.08;
    current.y += (target.y - current.y) * 0.08;
    tilt.style.setProperty('--rx', current.x.toFixed(2) + 'deg');
    tilt.style.setProperty('--ry', current.y.toFixed(2) + 'deg');
    const settled = Math.abs(target.x - current.x) < 0.01 && Math.abs(target.y - current.y) < 0.01;
    tiltFrame = settled ? null : requestAnimationFrame(stepTilt);
  }

  function aim(nx, ny) { // nx, ny in -1..1
    target.x = -ny * MAX;
    target.y = nx * MAX;
    if (!tiltFrame) tiltFrame = requestAnimationFrame(stepTilt);
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    aim((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  });
  document.documentElement.addEventListener('pointerleave', () => aim(0, 0));

  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta == null || e.gamma == null) return;
      const clamp = (v) => Math.max(-1, Math.min(1, v));
      aim(clamp(e.gamma / 30), clamp((e.beta - 45) / 30));
    });
  }

  // Ambient embers drifting slowly upward.
  const canvas = document.getElementById('ambient');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let specks = [];

  function makeSpeck(anywhere) {
    const gold = Math.random() < 0.25;
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      r: 0.5 + Math.random() * 1.6,
      vy: 0.15 + Math.random() * 0.45,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.003 + Math.random() * 0.006,
      alpha: 0.15 + Math.random() * 0.45,
      color: gold ? '255, 205, 110' : '170, 160, 200',
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(80, Math.max(40, (w * h) / 18000)));
    specks = Array.from({ length: count }, () => makeSpeck(true));
  }

  let ambientFrame = null;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const s of specks) {
      s.y -= s.vy;
      s.sway += s.swaySpeed;
      const x = s.x + Math.sin(s.sway) * 12;
      if (s.y < -10) Object.assign(s, makeSpeck(false));
      // Fade in from the bottom and out toward the top.
      const life = Math.min(1, (h - s.y) / 120, s.y / (h * 0.5));
      ctx.beginPath();
      ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.color}, ${(s.alpha * Math.max(0, life)).toFixed(3)})`;
      ctx.fill();
    }
    ambientFrame = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(ambientFrame);
      ambientFrame = null;
    } else if (!ambientFrame) {
      ambientFrame = requestAnimationFrame(draw);
    }
  });

  resize();
  ambientFrame = requestAnimationFrame(draw);
})();
