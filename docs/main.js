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
  // Spiral galaxy: tens of thousands of glowing points drawn with WebGL, turning slowly
  // behind the head. Seen tilted (about 30° above the disc) and slightly rolled.
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById('space');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return; // no WebGL: the page stays black behind the head

  const TILT = 0.52;        // radians above the disc plane
  const ROLL = -0.28;       // radians of roll, so the disc runs diagonally
  const SPIN = 0.024;       // radians per second (one turn in about 4.4 minutes)
  const DIST = 24;          // camera distance from the galaxy's centre
  const RADIUS = 11;        // galaxy radius in the same units

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

  // Logarithmic spiral arms starting from the ends of a central bar: two major arms, two minor.
  const ARMS = [
    { base: 0, weight: 0.36 },
    { base: Math.PI, weight: 0.36 },
    { base: Math.PI / 2, weight: 0.14 },
    { base: Math.PI * 1.5, weight: 0.14 },
  ];
  const WIND = 1 / Math.tan((13 * Math.PI) / 180); // 13° pitch angle
  const BAR = 1.8;

  for (let i = 0; i < GALAXY_POINTS; i++) {
    const kind = rand();
    if (kind < 0.16) {
      // Bulge and bar: warm, dense, elongated along x.
      const x = gauss() * 1.35, z = gauss() * 0.55, y = gauss() * 0.42;
      put(x, y, z, WARM, 0.32 + rand() * 0.35, 1.1 + rand() * 1.3, 1);
    } else if (kind < 0.40) {
      // Diffuse disc between the arms.
      const r = Math.min(RADIUS, -Math.log(1 - rand() * 0.985) * 3.2 + 0.6);
      const a = rand() * Math.PI * 2;
      const y = gauss() * 0.12 * (1 + r / RADIUS);
      put(Math.cos(a) * r, y, Math.sin(a) * r, mix(WARM, BLUE, Math.min(1, r / 7)), 0.16 + rand() * 0.24, 0.9 + rand() * 1.0, 1);
    } else {
      // Arm stars.
      let pick = rand(), arm = ARMS[0];
      for (const A of ARMS) { if ((pick -= A.weight) <= 0) { arm = A; break; } }
      const r = BAR + Math.min(RADIUS - BAR, -Math.log(1 - rand() * 0.99) * 2.6);
      const theta = arm.base + WIND * Math.log(r / BAR) + gauss() * (0.1 + 0.35 / r);
      const spread = gauss() * 0.2 * (0.6 + r / RADIUS);
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
    uniform vec3 uCam;
    uniform vec2 uProj;   // focal length / aspect, focal length
    uniform float uPx;    // point size scale, includes device pixel ratio
    uniform float uGain;  // overall brightness
    varying vec3 vColor;
    void main() {
      float a = uAngle * aSizeSpin.y;
      vec3 p = vec3(cos(a) * aPos.x - sin(a) * aPos.z, aPos.y, sin(a) * aPos.x + cos(a) * aPos.z);
      float ct = cos(uTiltRoll.x), st = sin(uTiltRoll.x);
      p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);
      float cr = cos(uTiltRoll.y), sr = sin(uTiltRoll.y);
      p = vec3(p.x * cr - p.y * sr, p.x * sr + p.y * cr, p.z);
      vec3 v = p - uCam;                 // camera looks down -z
      gl_Position = vec4(v.x * uProj.x, v.y * uProj.y, 0.0, -v.z);
      float size = aSizeSpin.x * uPx / max(-v.z, 0.1);
      // Points smaller than ~1.5px get dimmer instead of smaller, so they don't flicker.
      float shown = max(size, 1.5);
      gl_PointSize = min(shown, 160.0);
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
  const uAngle = u('uAngle'), uTiltRoll = u('uTiltRoll'), uCam = u('uCam'), uProj = u('uProj'), uPx = u('uPx');
  gl.uniform2f(uTiltRoll, TILT, ROLL);
  gl.uniform1f(u('uGain'), 1.7);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // additive: overlapping stars add up to glow
  gl.clearColor(0, 0, 0, 1);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight, aspect = w / h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // Wide screens: the disc spans a little past the edges. Tall screens: zoom in on the centre.
    const f = (DIST / RADIUS) * Math.max(1.1 * aspect, 1.05);
    gl.uniform2f(uProj, f / aspect, f);
    gl.uniform1f(uPx, (f * Math.max(h, w * 0.6) * dpr) / 2 * 0.02);
  }

  const start = performance.now();
  let frame = null;
  function draw(now) {
    const t = reduced ? 40 : (now - start) / 1000;
    gl.uniform1f(uAngle, t * SPIN);
    // Camera drifts against the pointer, so the galaxy sits behind the head in depth.
    gl.uniform3f(uCam, -current.x * 1.6, current.y * 1.0, DIST);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, n);
    frame = reduced ? null : requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    resize();
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
