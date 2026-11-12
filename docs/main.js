(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------------------
  // Pointer / device tilt, eased. Drives the head's 3D tilt and the camera's parallax.
  // ---------------------------------------------------------------------------
  const tilt = document.getElementById('tilt');
  const MAX = 8; // degrees of head tilt at the screen edge
  const target = { x: 0, y: 0 }; // -1..1
  const current = { x: 0, y: 0 };
  let tiltFrame = null;

  function stepTilt() {
    current.x += (target.x - current.x) * 0.08;
    current.y += (target.y - current.y) * 0.08;
    tilt.style.setProperty('--rx', (-current.y * MAX).toFixed(2) + 'deg');
    tilt.style.setProperty('--ry', (current.x * MAX).toFixed(2) + 'deg');
    const settled = Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
    tiltFrame = settled ? null : requestAnimationFrame(stepTilt);
  }

  function aim(nx, ny) {
    target.x = nx;
    target.y = ny;
    if (!tiltFrame) tiltFrame = requestAnimationFrame(stepTilt);
  }

  if (!reduced) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      aim((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    });
    document.documentElement.addEventListener('pointerleave', () => aim(0, 0));

    // iOS asks for permission before sharing device tilt, so it simply gets no tilt.
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', (e) => {
        if (e.beta == null || e.gamma == null) return;
        const clamp = (v) => Math.max(-1, Math.min(1, v));
        aim(clamp(e.gamma / 30), clamp((e.beta - 45) / 30));
      });
    }
  }

  // ---------------------------------------------------------------------------
  // The Milky Way: tens of thousands of glowing points drawn with WebGL, turning slowly
  // behind the head. Seen tilted (about 30° above the disc) and slightly rolled.
  // Its layout follows the measured one (1 unit = 1.36 kpc, about 4,400 light-years): a bar about 4.6 kpc
  // long from centre to end, two major arms (Scutum–Centaurus, Perseus) from its ends, two minor ones
  // (Sagittarius, Norma) between them, 12° pitch, all trailing the rotation, and the Sun 8.2 kpc out
  // in the Orion Spur, 27° from the bar's near end.
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById('space');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return; // no WebGL: the page stays black behind the head

  const TILT = 0.52;        // radians above the disc plane
  const ROLL = -0.28;       // radians of roll, so the disc runs diagonally
  const SPIN = 0.024;       // radians per second (one turn in about 4.4 minutes)
  const DIST = 24;          // camera distance from the galaxy's centre
  const RADIUS = 11;        // galaxy radius in the same units (15 kpc)
  // The Sun, in the disc's own coordinates before it turns: radius, angle (the galaxy turns towards +angle),
  // height above the mid-plane (about 20 pc). The tour flies here.
  const SUN = { r: 6.0, angle: -0.471, y: 0.015 };

  // Deterministic random numbers, so the galaxy looks the same on every visit.
  let seed = 20261112;
  const rand = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  const WARM = [1.0, 0.8, 0.55];
  const BLUE = [0.62, 0.74, 1.0];
  const PINK = [1.0, 0.45, 0.62];
  const WHITE = [0.95, 0.95, 1.0];

  // Fewer points on small or high-density screens (phones).
  const area = innerWidth * innerHeight;
  const GALAXY_POINTS = area < 500000 ? 50000 : 110000;
  const STAR_POINTS = area < 500000 ? 1800 : 3500;
  const HAZE_POINTS = 420;

  // Per point: x, y, z, r, g, b, size, spins (1 = turns with the galaxy, 0 = fixed background star)
  const STRIDE = 8;
  const total = GALAXY_POINTS + STAR_POINTS + HAZE_POINTS;
  const buf = new Float32Array(total * STRIDE);
  let n = 0;
  const put = (x, y, z, c, bright, size, spins) => {
    const o = n++ * STRIDE;
    buf[o] = x; buf[o + 1] = y; buf[o + 2] = z;
    buf[o + 3] = c[0] * bright; buf[o + 4] = c[1] * bright; buf[o + 5] = c[2] * bright;
    buf[o + 6] = size; buf[o + 7] = spins;
  };

  // Logarithmic spiral arms starting from the ends of the bar (which lies along +x, near end at angle 0),
  // winding back against the rotation. With these numbers the arms cross the Sun's line at the measured
  // radii: Scutum–Centaurus 5.1 kpc, Sagittarius 7.1, Perseus 10.0. The Orion Spur is drawn separately.
  const ARMS = [
    { base: 0, weight: 0.35 },           // Scutum–Centaurus
    { base: Math.PI, weight: 0.35 },     // Perseus
    { base: Math.PI / 2, weight: 0.13 }, // Sagittarius
    { base: Math.PI * 1.5, weight: 0.13 }, // Norma
  ];
  const SPUR = 0.02; // share of arm stars in the Orion Spur
  const WIND = 1 / Math.tan((12 * Math.PI) / 180); // 12° pitch angle
  const BAR = 3.4;

  for (let i = 0; i < GALAXY_POINTS; i++) {
    const kind = rand();
    if (kind < 0.08) {
      // Bulge: warm, dense, nearly round.
      const x = gauss() * 1.0, z = gauss() * 0.8, y = gauss() * 0.45;
      put(x, y, z, WARM, 0.32 + rand() * 0.35, 1.1 + rand() * 1.3, 1);
    } else if (kind < 0.16) {
      // Bar: warm, long and thin along x.
      const x = gauss() * 1.7, z = gauss() * 0.45, y = gauss() * 0.3;
      put(x, y, z, WARM, 0.3 + rand() * 0.3, 1.0 + rand() * 1.2, 1);
    } else if (kind < 0.40) {
      // Diffuse disc between the arms.
      const r = Math.min(RADIUS, -Math.log(1 - rand() * 0.985) * 3.2 + 0.6);
      const a = rand() * Math.PI * 2;
      const y = gauss() * 0.12 * (1 + r / RADIUS);
      put(Math.cos(a) * r, y, Math.sin(a) * r, mix(WARM, BLUE, Math.min(1, r / 7)), 0.16 + rand() * 0.24, 0.9 + rand() * 1.0, 1);
    } else {
      // Arm stars, or the Orion Spur: a short, fainter arm piece through the Sun, about 4 kpc long.
      let pick = rand() - SPUR, r, theta, spread;
      if (pick < 0) {
        const along = (rand() - 0.5) * 0.6;
        theta = SUN.angle + along;
        r = SUN.r * Math.exp(-along * Math.tan((11 * Math.PI) / 180));
        spread = gauss() * 0.22;
      } else {
        let arm = ARMS[0];
        for (const A of ARMS) { if ((pick -= A.weight) <= 0) { arm = A; break; } }
        r = BAR + Math.min(RADIUS - BAR, -Math.log(1 - rand() * 0.99) * 2.6);
        theta = arm.base - WIND * Math.log(r / BAR) + gauss() * (0.1 + 0.35 / r);
        spread = gauss() * 0.2 * (0.6 + r / RADIUS);
      }
      const x = Math.cos(theta) * r + Math.cos(theta + Math.PI / 2) * spread;
      const z = Math.sin(theta) * r + Math.sin(theta + Math.PI / 2) * spread;
      const y = gauss() * 0.1 * (1 + r / RADIUS);
      const special = rand();
      if (special < 0.012) put(x, y, z, PINK, 0.5 + rand() * 0.3, 1.8 + rand() * 1.4, 1);      // glowing gas clouds
      else if (special < 0.04) put(x, y, z, WHITE, 0.7 + rand() * 0.3, 1.6 + rand() * 1.2, 1); // bright young stars
      else put(x, y, z, mix(WARM, BLUE, Math.min(1, (r - BAR) / 5)), 0.22 + rand() * 0.34, 0.9 + rand() * 1.1, 1);
    }
  }

  // Soft glow around the core: a few large, faint points.
  for (let i = 0; i < HAZE_POINTS; i++) {
    const r = Math.abs(gauss()) * 3.2, a = rand() * Math.PI * 2;
    put(Math.cos(a) * r * 1.3, gauss() * 0.4, Math.sin(a) * r * 0.8, mix(WARM, BLUE, Math.min(1, r / 6)), 0.05, 50 + rand() * 60, 1);
  }

  // Distant stars all around, on a big sphere that doesn't turn.
  for (let i = 0; i < STAR_POINTS; i++) {
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u), R = 90;
    const c = rand() < 0.15 ? WARM : rand() < 0.3 ? BLUE : WHITE;
    put(s * Math.cos(a) * R, u * R, s * Math.sin(a) * R, c, 0.25 + rand() * 0.6, 1.4 + rand() * 1.6, 0);
  }

  const VERT = `
    attribute vec3 aPos;
    attribute vec3 aColor;
    attribute vec2 aSizeSpin;
    uniform float uAngle;
    uniform vec2 uTiltRoll;
    uniform vec3 uCam;    // camera position
    uniform mat3 uView;   // camera orientation (identity on the landing page: looking down -z)
    uniform vec2 uProj;   // focal length / aspect, focal length
    uniform float uPx;    // point size scale, includes device pixel ratio
    uniform float uGain;  // overall brightness
    uniform float uStarCap; // largest a star may be drawn, in pixels
    varying vec3 vColor;
    void main() {
      float a = uAngle * aSizeSpin.y;
      vec3 p = vec3(cos(a) * aPos.x - sin(a) * aPos.z, aPos.y, sin(a) * aPos.x + cos(a) * aPos.z);
      float ct = cos(uTiltRoll.x), st = sin(uTiltRoll.x);
      p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);
      float cr = cos(uTiltRoll.y), sr = sin(uTiltRoll.y);
      p = vec3(p.x * cr - p.y * sr, p.x * sr + p.y * cr, p.z);
      vec3 v = uView * (p - uCam);       // camera looks down its own -z
      gl_Position = vec4(v.x * uProj.x, v.y * uProj.y, 0.0, -v.z);
      float size = aSizeSpin.x * uPx / max(-v.z, 0.1);
      // Points smaller than ~1.5px get dimmer instead of smaller, so they don't flicker.
      float shown = max(size, 1.5);
      // Stars stay small however close the camera flies; only the big soft core glow may grow.
      gl_PointSize = min(shown, aSizeSpin.x > 20.0 ? 160.0 : uStarCap);
      vColor = aColor * uGain * min(1.0, (size * size) / (shown * shown));
    }`;
  const FRAG = `
    precision mediump float;
    varying vec3 vColor;
    void main() {
      vec2 c = gl_PointCoord * 2.0 - 1.0;
      float d = dot(c, c);
      if (d > 1.0) discard;
      gl_FragColor = vec4(vColor * exp(-d * 4.0), 1.0);
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
  const attr = (name, size, offset) => {
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
  };
  attr('aPos', 3, 0);
  attr('aColor', 3, 3);
  attr('aSizeSpin', 2, 6);

  const u = (name) => gl.getUniformLocation(prog, name);
  const uAngle = u('uAngle'), uTiltRoll = u('uTiltRoll'), uCam = u('uCam'), uView = u('uView');
  const uProj = u('uProj'), uPx = u('uPx'), uGain = u('uGain'), uStarCap = u('uStarCap');
  gl.uniform2f(uTiltRoll, TILT, ROLL);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // additive: overlapping stars add up to glow
  gl.clearColor(0, 0, 0, 1);

  let proj = { fx: 1, fy: 1 };
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight, aspect = w / h;
    gl.uniform1f(uStarCap, 7 * dpr);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // Wide screens: the disc spans a little past the edges. Tall screens: zoom in on the centre.
    const f = (DIST / RADIUS) * Math.max(1.1 * aspect, 1.05);
    gl.uniform2f(uProj, f / aspect, f);
    proj = { fx: f / aspect, fy: f };
    gl.uniform1f(uPx, (f * Math.max(h, w * 0.6) * dpr) / 2 * 0.02);
  }

  // ---------------------------------------------------------------------------
  // The tour: clicking the head flies the camera through the galaxy to the Sun's place in it.
  // ---------------------------------------------------------------------------
  const FLY = 6; // seconds for the flight out (or back)
  // Where the camera ends up, in the disc's own coordinates: outside the Sun's orbit and above the disc,
  // looking at a point a little past the Sun towards the centre, so the Sun sits low with the core beyond.
  const VIEW = { out: 6, ahead: 0.2, up: 5, lead: 0.35 };
  const head = document.getElementById('head');
  const quote = document.getElementById('quote');
  const banner = document.querySelector('.line--top');
  const back = document.getElementById('back');
  const marker = document.getElementById('sun-marker');
  const status = document.getElementById('tour-status');
  let tourP = 0;    // 0 = landing page, 1 = at the Sun
  let tourGoal = 0; // where the flight is heading

  // A point in the disc's coordinates, turned with the galaxy and tilted/rolled as the shader does it.
  function toWorld(x, y, z, angle) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    let px = ca * x - sa * z, py = y, pz = sa * x + ca * z;
    const ct = Math.cos(TILT), st = Math.sin(TILT);
    [py, pz] = [py * ct - pz * st, py * st + pz * ct];
    const cr = Math.cos(ROLL), sr = Math.sin(ROLL);
    [px, py] = [px * cr - py * sr, px * sr + py * cr];
    return [px, py, pz];
  }
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const ease = (p) => p * p * p * (p * (p * 6 - 15) + 10); // starts and ends gently

  // The camera for a tour progress s (0..1): eye position and its right/up/back axes.
  function camera(s, angle) {
    const sun = toWorld(Math.cos(SUN.angle) * SUN.r, SUN.y, Math.sin(SUN.angle) * SUN.r, angle);
    const a = SUN.angle + VIEW.ahead, r = SUN.r + VIEW.out;
    const end = toWorld(Math.cos(a) * r, VIEW.up, Math.sin(a) * r, angle);
    const focus = sun.map((v) => v * (1 - VIEW.lead)); // the centre is at the origin
    const endDir = sub(end, focus), endDist = Math.hypot(...endDir);
    // Landing page: straight down -z from DIST away, nudged against the pointer for depth.
    const home = [-current.x * 1.6, current.y * 1.0, 0];
    const look = lerp3(home, focus, ease(Math.min(1, s * 1.4)));
    const dist = Math.exp(Math.log(DIST) + (Math.log(endDist) - Math.log(DIST)) * s);
    const dir = norm(lerp3([0, 0, 1], norm(endDir), s));
    let eye = look.map((v, i) => v + dir[i] * dist);
    // At the Sun the pointer still sways the camera a little.
    eye = [eye[0] - current.x * 0.12 * s, eye[1] + current.y * 0.08 * s, eye[2]];
    const back3 = norm(sub(eye, look));
    const upHint = norm(lerp3([0, 1, 0], toWorld(0, 1, 0, 0), s));
    const right = norm(cross(upHint, back3));
    const up = cross(back3, right);
    return { eye, right, up, back: back3, sun };
  }

  // Lifts the banner to the top edge while touring (offsetTop ignores the lift itself).
  function measureBanner() {
    document.body.style.setProperty('--lift', (12 - banner.offsetTop) + 'px');
  }

  function arrived() {
    marker.classList.add('is-shown');
    status.textContent = 'The Sun, about 26,700 light-years from the centre of the Milky Way.';
  }
  function landed() {
    document.body.classList.remove('touring');
    head.inert = false;
    quote.inert = false;
    head.focus({ preventScroll: true });
  }

  function go() {
    if (tourGoal === 1) return;
    measureBanner();
    tourGoal = 1;
    document.body.classList.add('touring');
    head.inert = true;
    quote.inert = true;
    back.focus({ preventScroll: true });
    kick();
  }
  function goBack() {
    if (tourGoal === 0) return;
    tourGoal = 0;
    marker.classList.remove('is-shown');
    status.textContent = '';
    kick();
  }
  // Starts the frame loop if it is idle (under reduced motion each step simply cuts).
  function kick() {
    if (reduced) {
      tourP = tourGoal;
      draw(0);
      if (tourP === 1) arrived(); else landed();
    } else if (!frame && !document.hidden) {
      frame = requestAnimationFrame(draw);
    }
  }

  // The head becomes a button only here, once WebGL is known to work.
  head.setAttribute('role', 'button');
  head.tabIndex = 0;
  head.setAttribute('aria-label', 'Fly to the Sun’s place in the Milky Way');
  head.addEventListener('click', (e) => { e.stopPropagation(); go(); });
  head.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
  });
  back.addEventListener('click', (e) => { e.stopPropagation(); goBack(); });
  document.addEventListener('click', (e) => {
    if (tourGoal === 1 && !e.target.closest('a')) goBack();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') goBack();
  });

  const start = performance.now();
  let frame = null;
  let last = null;
  function draw(now) {
    const t = reduced ? 40 : (now - start) / 1000;
    const dt = last == null ? 0 : Math.min(0.25, (now - last) / 1000); // slow devices skip ahead
    last = now;
    if (!reduced && tourP !== tourGoal) {
      tourP = tourGoal ? Math.min(1, tourP + dt / FLY) : Math.max(0, tourP - dt / FLY);
      if (tourP === tourGoal) { if (tourP === 1) arrived(); else landed(); }
    }
    const angle = t * SPIN;
    const s = ease(tourP);
    const cam = camera(s, angle);
    gl.uniform1f(uAngle, angle);
    gl.uniform3f(uCam, cam.eye[0], cam.eye[1], cam.eye[2]);
    const { right: R, up: U, back: B } = cam;
    gl.uniformMatrix3fv(uView, false, [R[0], U[0], B[0], R[1], U[1], B[1], R[2], U[2], B[2]]);
    gl.uniform1f(uGain, 1.7 - 0.5 * s);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, n);

    // Keep the Sun's marker on the Sun.
    if (tourP > 0) {
      const v = sub(cam.sun, cam.eye);
      const vx = dot(v, R), vy = dot(v, U), w = -dot(v, B);
      if (w > 0) {
        const x = (vx * proj.fx / w + 1) / 2 * innerWidth;
        const y = (1 - vy * proj.fy / w) / 2 * innerHeight;
        marker.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      }
    }
    frame = reduced ? null : requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    resize();
    measureBanner();
    if (reduced) draw(0);
  });
  document.addEventListener('visibilitychange', () => {
    if (reduced) return;
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = null;
    } else if (!frame) {
      frame = requestAnimationFrame(draw);
    }
  });

  resize();
  if (reduced) draw(0);
  else frame = requestAnimationFrame(draw);
})();
