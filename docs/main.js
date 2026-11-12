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
  // Links a program with its attributes at fixed locations 0, 1, 2…, so switching programs only re-points them.
  const link = (vert, frag, attrs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    attrs.forEach((name, i) => gl.bindAttribLocation(p, i, name));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  // Makes a program current with its buffer; layout lists each attribute's [size, offset] in floats.
  const use = (p, buffer, stride, layout) => {
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (let i = 0; i < 3; i++) {
      if (i < layout.length) {
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, layout[i][0], gl.FLOAT, false, stride * 4, layout[i][1] * 4);
      } else {
        gl.disableVertexAttribArray(i);
      }
    }
  };

  const prog = link(VERT, FRAG, ['aPos', 'aColor', 'aSizeSpin']);
  const galaxyBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, galaxyBuf);
  gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
  const useGalaxy = () => use(prog, galaxyBuf, STRIDE, [[3, 0], [3, 3], [2, 6]]);
  useGalaxy();

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
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // Wide screens: the disc spans a little past the edges. Tall screens: zoom in on the centre.
    const f = (DIST / RADIUS) * Math.max(1.1 * aspect, 1.05);
    proj = { fx: f / aspect, fy: f, dpr };
    useGalaxy();
    gl.uniform1f(uStarCap, 7 * dpr);
    gl.uniform2f(uProj, f / aspect, f);
    gl.uniform1f(uPx, (f * Math.max(h, w * 0.6) * dpr) / 2 * 0.02);
  }


  // ---------------------------------------------------------------------------
  // The solar system: the Sun, the 8 planets where they are on the visitor's date, and their orbits.
  // Positions come from NASA JPL's "Approximate Positions of the Planets" (Keplerian elements at J2000 and
  // their rates per century, good for 1800–2050). Units are AU; distances are true, the dots are not.
  // ---------------------------------------------------------------------------
  // name, colour, dot size in px, [a, e, I, L, long. of perihelion, long. of node], then the rates per century.
  const PLANETS = [
    ['Mercury', [0.75, 0.72, 0.68], 12, [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
      [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
    ['Venus', [1.0, 0.88, 0.62], 16, [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
      [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
    ['Earth', [0.45, 0.72, 1.0], 17, [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
      [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
    ['Mars', [1.0, 0.5, 0.32], 14, [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
      [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
    ['Jupiter', [0.95, 0.8, 0.6], 24, [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
      [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
    ['Saturn', [1.0, 0.88, 0.6], 23, [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
      [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
    ['Uranus', [0.62, 0.92, 0.95], 18, [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
      [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
    ['Neptune', [0.48, 0.62, 1.0], 18, [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
      [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  ];
  const RAD = Math.PI / 180;
  const ORBIT_STEPS = 160;
  const SOLAR_STRIDE = 7; // x, y, z, r, g, b, size

  // Where a planet is for T (Julian centuries since J2000): solves Kepler's equation, or uses the eccentric
  // anomaly E when given (for drawing the orbit). Returns ecliptic x, y, z in AU.
  function orbitPoint(el, rate, T, E) {
    const [a, e, I, L, peri, node] = el.map((v, i) => v + rate[i] * T);
    if (E === undefined) {
      const M = ((((L - peri) % 360) + 540) % 360 - 180) * RAD;
      E = M + e * Math.sin(M);
      for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const w = (peri - node) * RAD, O = node * RAD, i = I * RAD;
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
    return [
      (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
      (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
      sw * si * xp + cw * si * yp,
    ];
  }
  // Ecliptic to the drawing's axes: the ecliptic plane is horizontal (y up), north is up.
  const fromEcliptic = ([x, y, z]) => [x, z, -y];

  const SOLAR_VERT = `
    attribute vec3 aPos;
    attribute vec4 aLook;  // colour, dot size in px
    uniform vec3 uCam;
    uniform mat3 uView;
    uniform vec2 uProj;
    uniform float uDpr;
    uniform float uFade;
    varying vec3 vColor;
    void main() {
      vec3 v = uView * (aPos - uCam);
      gl_Position = vec4(v.x * uProj.x, v.y * uProj.y, 0.0, -v.z);
      gl_PointSize = aLook.w * uDpr;
      vColor = aLook.rgb * uFade;
    }`;
  const SOLAR_FRAG = `
    precision mediump float;
    uniform float uFlat;  // 1 for orbit lines, 0 for dots
    varying vec3 vColor;
    void main() {
      if (uFlat > 0.5) { gl_FragColor = vec4(vColor, 1.0); return; }
      vec2 c = gl_PointCoord * 2.0 - 1.0;
      float d = dot(c, c);
      if (d > 1.0) discard;
      // A solid disc with a soft glow around it.
      gl_FragColor = vec4(vColor * (1.0 - smoothstep(0.22, 0.36, d) + 0.35 * exp(-d * 4.0)), 1.0);
    }`;
  const solarProg = link(SOLAR_VERT, SOLAR_FRAG, ['aPos', 'aLook']);
  const su = (name) => gl.getUniformLocation(solarProg, name);
  const sCam = su('uCam'), sView = su('uView'), sProj = su('uProj'), sDpr = su('uDpr');
  const sFade = su('uFade'), sFlat = su('uFlat');
  const solarBuf = gl.createBuffer();
  const useSolar = () => use(solarProg, solarBuf, SOLAR_STRIDE, [[3, 0], [4, 3]]);
  const solar = { date: null, bodies: [] }; // bodies: { name, pos } for the Sun and each planet

  // Places everything for the given date: the Sun and planets first, then each orbit as a loop of points.
  function buildSolar(date) {
    const T = (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525;
    const data = new Float32Array((1 + PLANETS.length * (1 + ORBIT_STEPS)) * SOLAR_STRIDE);
    let k = 0;
    const put = (p, c, size) => { data.set([p[0], p[1], p[2], c[0], c[1], c[2], size], k); k += SOLAR_STRIDE; };
    solar.bodies = [{ name: 'Sun', pos: [0, 0, 0] }];
    put([0, 0, 0], [1.25, 1.05, 0.7], 34);
    for (const [name, colour, size, el, rate] of PLANETS) {
      const pos = fromEcliptic(orbitPoint(el, rate, T));
      solar.bodies.push({ name, pos });
      put(pos, colour, size);
    }
    for (const [name, , , el, rate] of PLANETS) {
      const c = name === 'Earth' ? [0.22, 0.32, 0.5] : [0.13, 0.15, 0.21];
      for (let j = 0; j < ORBIT_STEPS; j++) {
        put(fromEcliptic(orbitPoint(el, rate, T, (j / ORBIT_STEPS) * Math.PI * 2)), c, 0);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, solarBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    solar.date = date;
  }

  // ---------------------------------------------------------------------------
  // The sky behind the solar system: the real night sky. The stars of the Yale Bright Star Catalogue brighter
  // than magnitude 6 (stars.bin, made by tools/make-stars.py) in their true directions, brightness and colours,
  // a faint Milky Way band along the galactic plane, a few stars twinkling now and then, and every 6–15 seconds
  // a faint comet. Until stars.bin has arrived (or if it can't be read), the galaxy's distant stars stand in.
  // ---------------------------------------------------------------------------
  // Per point: direction x, y, z, r, g, b, size in px (or, when negative, an angle in radians, so the Milky Way's
  // glow keeps its size on the sky on any screen), twinkle phase (0 = steady).
  const SKY_STRIDE = 8;
  const BAND_HAZE = area < 500000 ? 1600 : 2600; // large faint points that blur into the band's glow
  const BAND_STARS = area < 500000 ? 2500 : 5000; // tiny faint ones that give it grain
  const COMET_POINTS = 90;  // the head, then the tail
  const OBLIQUITY = 23.4393 * RAD;
  // An equatorial (J2000) direction to the drawing's axes: tilted to the ecliptic, then as fromEcliptic does.
  const fromEquatorial = ([x, y, z]) => fromEcliptic([x, y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY),
                                                      -y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY)]);
  // Galactic to equatorial: the rows of the standard (Hipparcos) equatorial-to-galactic rotation, weighted.
  const GALACTIC = [[-0.0548755604, -0.8734370902, -0.4838350155],
                    [0.4941094279, -0.4448296300, 0.7469822445],
                    [-0.8676661490, -0.1980763734, 0.4559837762]];
  const fromGalactic = (l, b) => {
    const g = [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
    return fromEquatorial([0, 1, 2].map((i) => g[0] * GALACTIC[0][i] + g[1] * GALACTIC[1][i] + g[2] * GALACTIC[2][i]));
  };
  // Star colours by colour index B-V, from hot blue-white to cool orange.
  const BV_COLOURS = [[-0.3, [0.62, 0.72, 1.0]], [0.0, [0.82, 0.88, 1.0]], [0.6, [1.0, 0.97, 0.9]],
                      [1.1, [1.0, 0.84, 0.64]], [1.8, [1.0, 0.68, 0.44]]];
  function starColour(bv) {
    let i = 1;
    while (i < BV_COLOURS.length - 1 && bv > BV_COLOURS[i][0]) i++;
    const [b0, c0] = BV_COLOURS[i - 1], [b1, c1] = BV_COLOURS[i];
    return mix(c0, c1, Math.min(1, Math.max(0, (bv - b0) / (b1 - b0))));
  }

  const SKY_VERT = `
    attribute vec3 aPos;
    attribute vec3 aColor;
    attribute vec2 aLook;    // size (px, or radians when negative), twinkle phase (0 = steady)
    uniform mat3 uView;
    uniform vec2 uProj;
    uniform float uDpr;
    uniform float uPxPerRad; // CSS px per radian across the middle of the screen
    uniform float uGain;
    uniform float uTime;
    uniform float uTwinkle;  // 0 under reduced motion
    varying vec3 vColor;
    void main() {
      vec3 v = uView * aPos;   // a direction: the sky is seen from its middle
      gl_Position = vec4(v.x * uProj.x, v.y * uProj.y, 0.0, -v.z);
      gl_PointSize = (aLook.x < 0.0 ? -aLook.x * uPxPerRad : aLook.x) * uDpr;
      float glint = 1.0;
      if (aLook.y > 0.0) {
        // Now and then (a few seconds in every half minute or so) the star flickers.
        float bout = pow(max(0.0, sin(uTime * 0.21 + aLook.y)), 12.0);
        glint += uTwinkle * 0.65 * bout * sin(uTime * (5.0 + fract(aLook.y) * 5.0) + aLook.y * 7.0);
      }
      vColor = aColor * uGain * glint;
    }`;
  const skyProg = link(SKY_VERT, FRAG, ['aPos', 'aColor', 'aLook']);
  const ku = (name) => gl.getUniformLocation(skyProg, name);
  const kView = ku('uView'), kProj = ku('uProj'), kDpr = ku('uDpr'), kPxPerRad = ku('uPxPerRad'), kGain = ku('uGain');
  const kTime = ku('uTime'), kTwinkle = ku('uTwinkle');
  const skyBuf = gl.createBuffer(), cometBuf = gl.createBuffer();
  const sky = { count: 0, comet: null, next: 0 };
  const cometData = new Float32Array(COMET_POINTS * SKY_STRIDE);

  // Builds the sky from stars.bin (see tools/make-stars.py for its layout): the Milky Way first, then the stars.
  function buildSky(bytes) {
    const view = new DataView(bytes), count = Math.floor(bytes.byteLength / 6);
    const data = new Float32Array((BAND_HAZE + BAND_STARS + count) * SKY_STRIDE);
    let k = 0;
    const put = (p, c, bright, size, twinkle) => {
      data.set([p[0], p[1], p[2], c[0] * bright, c[1] * bright, c[2] * bright, size, twinkle], k);
      k += SKY_STRIDE;
    };
    // The band: brighter and thicker towards the galactic centre (in Sagittarius), fading to the anticentre.
    for (let i = 0; i < BAND_HAZE + BAND_STARS; i++) {
      let l;
      do { l = (rand() * 2 - 1) * Math.PI; } while (rand() > 0.25 + 0.75 * Math.cos(l / 2) ** 2);
      const bulge = Math.exp(-(l * l) / (2 * 0.4 * 0.4));
      const b = gauss() * (0.05 + 0.09 * bulge);
      const c = mix(WHITE, WARM, 0.15 + 0.4 * bulge);
      const strength = 0.45 + 0.55 * Math.cos(l / 2) ** 2;
      if (i < BAND_HAZE) put(fromGalactic(l, b), c, (0.01 + 0.014 * bulge) * strength, -(0.06 + rand() * 0.05), 0);
      else put(fromGalactic(l, b), c, (0.03 + rand() * 0.06) * strength, 3, 0);
    }
    // The stars, brightest first: brighter ones are drawn larger, and some of them twinkle. Points under 3px
    // would only show the edge of their glow, so the faint ones are 3px and dimmer instead.
    for (let i = 0; i < count; i++) {
      const ra = (view.getUint16(i * 6, true) / 65535) * 2 * Math.PI;
      const dec = (view.getUint16(i * 6 + 2, true) / 65535 - 0.5) * Math.PI;
      const mag = view.getUint8(i * 6 + 4) / 25 - 2, bv = view.getUint8(i * 6 + 5) / 100 - 0.5;
      const p = fromEquatorial([Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]);
      const size = Math.max(3, 5.5 - 0.5 * mag);
      const bright = Math.min(2, 1.5 * 10 ** (-0.13 * mag));
      put(p, starColour(bv), bright, size, mag < 4.5 && rand() < 0.15 ? 1 + rand() * 50 : 0);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, cometBuf);
    gl.bufferData(gl.ARRAY_BUFFER, cometData, gl.DYNAMIC_DRAW);
    sky.count = k / SKY_STRIDE;
  }
  fetch('stars.bin')
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.status))))
    .then(buildSky, () => {}); // no catalogue: the generated stars stay

  // A comet starts somewhere on screen and crosses part of it along a great circle of the sky, fading in and
  // out, with its tail trailing behind it.
  function launchComet(cam, t) {
    const sx = (Math.random() * 1.4 - 0.7) / proj.fx, sy = (Math.random() * 1.2 - 0.6) / proj.fy;
    const mid = norm(cam.right.map((r, i) => r * sx + cam.up[i] * sy - cam.back[i]));
    const a = Math.random() * 2 * Math.PI;
    const way = cam.right.map((r, i) => r * Math.cos(a) + cam.up[i] * Math.sin(a));
    const along = norm(sub(way, mid.map((m) => m * dot(way, mid))));
    const width = 2 * Math.atan(1 / proj.fx); // the screen's width, as an angle
    const life = 2.5 + Math.random() * 1.5;
    sky.comet = { mid, along, born: t, life, travel: width * (0.25 + Math.random() * 0.2), tail: width * (0.1 + Math.random() * 0.06) };
  }
  // Moves the comet to time t; returns false once it has gone.
  function stepComet(t) {
    const c = sky.comet, age = (t - c.born) / c.life;
    if (age >= 1) return false;
    const fade = Math.sin(Math.PI * age);
    const head = c.travel * (age - 0.5);
    for (let k = 0; k < COMET_POINTS; k++) {
      const f = k / (COMET_POINTS - 1), angle = head - f * c.tail;
      const p = c.mid.map((m, i) => m * Math.cos(angle) + c.along[i] * Math.sin(angle));
      const bright = fade * (k === 0 ? 1.2 : 0.5 * (1 - f) ** 1.3);
      const col = mix([0.92, 0.96, 1.0], [0.5, 0.72, 1.0], f);
      cometData.set([p[0], p[1], p[2], col[0] * bright, col[1] * bright, col[2] * bright,
                     k === 0 ? 8 : 5 - 2 * f, 0], k * SKY_STRIDE);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, cometBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, cometData);
    return true;
  }

  // Draws the sky for the solar system camera; fade (0..1) as it fades in.
  function drawSky(cam, view, fade, t) {
    if (!sky.count) {
      // The galaxy's distant stars, seen from the middle of their sphere.
      useGalaxy();
      gl.uniform3f(uCam, 0, 0, 0);
      gl.uniformMatrix3fv(uView, false, view);
      gl.uniform1f(uGain, 1.2 * fade);
      gl.drawArrays(gl.POINTS, n - STAR_POINTS, STAR_POINTS);
      return;
    }
    use(skyProg, skyBuf, SKY_STRIDE, [[3, 0], [3, 3], [2, 6]]);
    gl.uniformMatrix3fv(kView, false, view);
    gl.uniform2f(kProj, proj.fx, proj.fy);
    gl.uniform1f(kDpr, proj.dpr);
    gl.uniform1f(kPxPerRad, (proj.fy * innerHeight) / 2);
    gl.uniform1f(kGain, fade);
    gl.uniform1f(kTime, t);
    gl.uniform1f(kTwinkle, reduced ? 0 : 1);
    gl.drawArrays(gl.POINTS, 0, sky.count);
    if (reduced) return;
    // Comets: the first a few seconds after arriving, then one every 6–15 seconds.
    if (!sky.comet && t >= sky.next) {
      launchComet(cam, t);
      sky.next = t + 6 + Math.random() * 9;
    }
    if (sky.comet && !stepComet(t)) sky.comet = null;
    if (sky.comet) {
      use(skyProg, cometBuf, SKY_STRIDE, [[3, 0], [3, 3], [2, 6]]);
      gl.drawArrays(gl.POINTS, 0, COMET_POINTS);
    }
  }

  // ---------------------------------------------------------------------------
  // The tour: clicking the head flies the camera through the galaxy to the Sun's place in it, dives into the
  // Sun, crossfades to the solar system and eases in towards the Earth: "You are here".
  // ---------------------------------------------------------------------------
  const FLY = 6;    // seconds: the flight through the galaxy to the Sun
  const HOLD = 1.5; // seconds at the Sun, with its marker
  const DIVE = 3;   // seconds diving into the Sun while the galaxy fades out and the solar system fades in
  const ZOOM = 6;   // seconds easing in from the whole solar system towards the Earth
  const AT_SUN = FLY, LEAVE_SUN = AT_SUN + HOLD, IN_SYSTEM = LEAVE_SUN + DIVE, AT_EARTH = IN_SYSTEM + ZOOM;
  // Where the galaxy flight ends, in the disc's own coordinates: outside the Sun's orbit and above the disc,
  // looking at a point a little past the Sun towards the centre, so the Sun sits low with the core beyond.
  const VIEW = { out: 6, ahead: 0.2, up: 5, lead: 0.35 };
  // The solar system views: from above the ecliptic at `wide` (whole system) then `close` (round the Earth),
  // degrees of elevation, and how far towards the Earth the close view looks (0 = the Sun, 1 = the Earth).
  const SOLAR_VIEW = { wideEl: 62, closeEl: 34, lead: 0.55 };
  const head = document.getElementById('head');
  const quote = document.getElementById('quote');
  const banner = document.querySelector('.line--top');
  const back = document.getElementById('back');
  const sunMarker = document.getElementById('sun-marker');
  const earthMarker = document.getElementById('earth-marker');
  const labels = document.getElementById('planet-labels');
  const note = document.getElementById('tour-note');
  const status = document.getElementById('tour-status');
  let tourT = 0;    // seconds along the tour: 0 = landing page, AT_EARTH = "You are here"
  let tourGoal = 0; // 0 or AT_EARTH
  let backRate = 1; // the way back always takes FLY seconds, however far the tour got

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
  const part = (t, from, length) => Math.min(1, Math.max(0, (t - from) / length)); // 0..1 through a stage
  const logLerp = (a, b, t) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
  // A camera looking from eye at look, with up as near to upHint as it can be.
  function lookAt(eye, look, upHint) {
    const back3 = norm(sub(eye, look));
    const right = norm(cross(upHint, back3));
    return { eye, right, up: cross(back3, right), back: back3 };
  }
  // Where a point lands on screen in CSS pixels, or null when it is behind the camera.
  function project(p, cam) {
    const v = sub(p, cam.eye), w = -dot(v, cam.back);
    if (w <= 0) return null;
    return [(dot(v, cam.right) * proj.fx / w + 1) / 2 * innerWidth, (1 - dot(v, cam.up) * proj.fy / w) / 2 * innerHeight];
  }

  // The galaxy camera for flight progress s (0..1) and dive progress d (0..1, into the Sun).
  function galaxyCamera(s, d, angle) {
    const sun = toWorld(Math.cos(SUN.angle) * SUN.r, SUN.y, Math.sin(SUN.angle) * SUN.r, angle);
    const a = SUN.angle + VIEW.ahead, r = SUN.r + VIEW.out;
    const end = toWorld(Math.cos(a) * r, VIEW.up, Math.sin(a) * r, angle);
    const focus = sun.map((v) => v * (1 - VIEW.lead)); // the centre is at the origin
    const endDir = sub(end, focus), endDist = Math.hypot(...endDir);
    // Landing page: straight down -z from DIST away, nudged against the pointer for depth.
    const home = [-current.x * 1.6, current.y * 1.0, 0];
    const look = lerp3(lerp3(home, focus, ease(Math.min(1, s * 1.4))), sun, d);
    const dist = logLerp(logLerp(DIST, endDist, s), 0.02, d);
    const dir = norm(lerp3([0, 0, 1], norm(endDir), s));
    let eye = look.map((v, i) => v + dir[i] * dist);
    // At the Sun the pointer still sways the camera a little (less as it dives in).
    const sway = s * Math.min(1, dist / endDist);
    eye = [eye[0] - current.x * 0.12 * sway, eye[1] + current.y * 0.08 * sway, eye[2]];
    const cam = lookAt(eye, look, norm(lerp3([0, 1, 0], toWorld(0, 1, 0, 0), s)));
    cam.sun = sun;
    return cam;
  }

  // The solar system camera for zoom progress z (0..1); fading (0..1) pulls it further out while it fades in.
  function solarCamera(z, fading) {
    const earth = solar.bodies[3].pos;
    const h = norm([earth[0], 0, earth[2]]); // from the Sun out past the Earth
    const el = (SOLAR_VIEW.wideEl + (SOLAR_VIEW.closeEl - SOLAR_VIEW.wideEl) * z) * RAD;
    // Distance at which a radius of 1 AU fills the screen's narrower way.
    const fit = Math.max(proj.fx, proj.fy * Math.sin(el));
    const wide = 36 * fit * (1 + 1.5 * (1 - fading)), close = 1.3 * fit;
    const dist = logLerp(wide, close, z);
    const look = earth.map((v) => v * SOLAR_VIEW.lead * z);
    // From outside the Earth's side, looking back in at the Sun, so the Earth sits low with the Sun beyond.
    const dir = [h[0] * Math.cos(el), Math.sin(el), h[2] * Math.cos(el)];
    const side = norm(cross([0, 1, 0], dir));
    const eye = look.map((v, i) => v + dir[i] * dist + (side[i] * -current.x * 0.03 + (i === 1 ? current.y * 0.02 : 0)) * dist);
    return lookAt(eye, look, [0, 1, 0]);
  }

  // Lifts the banner to the top edge while touring (offsetTop ignores the lift itself).
  function measureBanner() {
    document.body.style.setProperty('--lift', (12 - banner.offsetTop) + 'px');
  }

  // Planet names, made once.
  const labelEls = PLANETS.map(([name]) => name).concat('Sun').map((name) => {
    const el = document.createElement('span');
    el.className = 'planet-label';
    el.dataset.name = name;
    el.textContent = name;
    labels.appendChild(el);
    return { name, el };
  });

  const KM_PER_AU = 149597870.7, KM_PER_MILE = 1.609344;
  let sunText = '', earthText = '';
  // Call after buildSolar(date): the Earth's distance from the Sun comes from its position (in AU).
  function setDateTexts(date) {
    const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const km = Math.hypot(...solar.bodies[3].pos) * KM_PER_AU;
    const millions = (n) => (n / 1e6).toFixed(1) + ' million';
    const miles = `${millions(km / KM_PER_MILE)} miles`, rest = `(${millions(km)} km) from the Sun`;
    const distance = `${miles} ${rest}`;
    sunText = 'The Sun, about 26,700 light-years from the centre of the Milky Way.';
    earthText = `You are here: the Earth, ${distance}, with the Sun and the planets where they are on ${day}.`;
    document.getElementById('earth-date').textContent = `The Earth, ${day}`;
    // Two parts, so phones can put them on two lines.
    const parts = [miles, rest].map((text) => Object.assign(document.createElement('span'), { textContent: text }));
    document.getElementById('earth-distance').replaceChildren(parts[0], ' ', parts[1]);
    note.textContent = `The planets where they are on ${day}. Distances to scale; planets drawn larger.`;
  }

  // Shows what belongs to the current point of the tour.
  function showStage() {
    const atSun = tourGoal > 0 && tourT >= AT_SUN && tourT < LEAVE_SUN;
    const atEarth = tourT >= AT_EARTH;
    sunMarker.classList.toggle('is-shown', atSun);
    earthMarker.classList.toggle('is-shown', atEarth);
    note.classList.toggle('is-shown', tourGoal > 0 && tourT >= IN_SYSTEM);
    labelEls[2].el.classList.toggle('is-hidden', atEarth); // "You are here" replaces the Earth's name
    const text = atEarth ? earthText : atSun ? sunText : '';
    if (status.textContent !== text) status.textContent = text;
  }

  function landed() {
    document.body.classList.remove('touring');
    head.inert = false;
    quote.inert = false;
    head.focus({ preventScroll: true });
  }

  function go() {
    if (tourGoal) return;
    const now = new Date();
    buildSolar(now);
    setDateTexts(now);
    measureBanner();
    tourGoal = AT_EARTH;
    document.body.classList.add('touring');
    head.inert = true;
    quote.inert = true;
    back.focus({ preventScroll: true });
    kick();
  }
  function goBack() {
    if (!tourGoal) return;
    tourGoal = 0;
    backRate = Math.max(1, tourT / FLY);
    kick();
  }
  // Starts the frame loop if it is idle. Under reduced motion each step cuts instead: to the Sun, a pause,
  // then to the Earth; and straight home.
  let cutTimer = null;
  function kick() {
    if (reduced) {
      clearTimeout(cutTimer);
      tourT = tourGoal ? AT_SUN : 0;
      draw(0);
      if (tourGoal) cutTimer = setTimeout(() => { tourT = AT_EARTH; draw(0); }, 3000);
      else landed();
    } else if (!frame && !document.hidden) {
      frame = requestAnimationFrame(draw);
    }
  }

  // The head becomes a button only here, once WebGL is known to work.
  head.setAttribute('role', 'button');
  head.tabIndex = 0;
  head.setAttribute('aria-label', 'Fly through the Milky Way to the Earth');
  head.addEventListener('click', (e) => { e.stopPropagation(); go(); });
  head.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
  });
  back.addEventListener('click', (e) => { e.stopPropagation(); goBack(); });
  document.addEventListener('click', (e) => {
    if (tourGoal && !e.target.closest('a')) goBack();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') goBack();
  });

  const place = (el, xy) => { el.style.transform = `translate(${xy[0].toFixed(1)}px, ${xy[1].toFixed(1)}px)`; };

  const start = performance.now();
  let frame = null;
  let last = null;
  function draw(now) {
    const t = reduced ? 40 : (now - start) / 1000;
    const dt = last == null ? 0 : Math.min(0.25, (now - last) / 1000); // slow devices skip ahead
    last = now;
    if (!reduced && tourT !== tourGoal) {
      tourT = tourGoal ? Math.min(tourGoal, tourT + dt) : Math.max(0, tourT - dt * backRate);
      if (tourT === 0) landed();
    }
    showStage();
    const angle = t * SPIN;
    const s = ease(part(tourT, 0, FLY));
    const d = ease(part(tourT, LEAVE_SUN, DIVE));
    const galaxyFade = 1 - ease(part(d, 0.35, 0.55));
    const solarFade = ease(part(d, 0.55, 0.45));
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (galaxyFade > 0) {
      const cam = galaxyCamera(s, d, angle);
      useGalaxy();
      gl.uniform1f(uAngle, angle);
      gl.uniform3f(uCam, cam.eye[0], cam.eye[1], cam.eye[2]);
      gl.uniformMatrix3fv(uView, false, viewMatrix(cam));
      gl.uniform1f(uGain, (1.7 - 0.5 * s) * galaxyFade);
      gl.drawArrays(gl.POINTS, 0, n);
      // Keep the Sun's marker on the Sun.
      const xy = tourT > 0 && project(cam.sun, cam);
      if (xy) place(sunMarker, xy);
    }

    if (solarFade > 0 && solar.date) {
      const cam = solarCamera(ease(part(tourT, IN_SYSTEM, ZOOM)), solarFade);
      const view = viewMatrix(cam);
      drawSky(cam, view, solarFade, t);
      // Orbits, then the Sun and planets on top.
      useSolar();
      gl.uniform3f(sCam, cam.eye[0], cam.eye[1], cam.eye[2]);
      gl.uniformMatrix3fv(sView, false, view);
      gl.uniform2f(sProj, proj.fx, proj.fy);
      gl.uniform1f(sDpr, proj.dpr);
      gl.uniform1f(sFade, solarFade);
      gl.uniform1f(sFlat, 1);
      const bodies = 1 + PLANETS.length;
      for (let i = 0; i < PLANETS.length; i++) gl.drawArrays(gl.LINE_LOOP, bodies + i * ORBIT_STEPS, ORBIT_STEPS);
      gl.uniform1f(sFlat, 0);
      gl.drawArrays(gl.POINTS, 0, bodies);
      placeLabels(cam);
      const xy = project(solar.bodies[3].pos, cam);
      if (xy) place(earthMarker, xy);
    }
    // Out of the solar system: no comet, and the first one comes a few seconds after arriving again.
    if (solarFade === 0) { sky.comet = null; sky.next = t + 2 + Math.random() * 3; }
    labels.style.opacity = solarFade.toFixed(3);
    frame = reduced ? null : requestAnimationFrame(draw);
  }

  // The camera's axes as the shader's uView (column-major: its rows are right, up, back).
  const viewMatrix = ({ right: R, up: U, back: B }) => [R[0], U[0], B[0], R[1], U[1], B[1], R[2], U[2], B[2]];

  // Names beside the Sun and planets, the Sun's first, then from the outside in. A name is left out when its
  // body is off screen, close to a body already named, or its text would touch another name or named body
  // (so the inner planets get theirs as the camera comes near).
  function placeLabels(cam) {
    const dots = [], boxes = [];
    for (const k of [8, 7, 6, 5, 4, 3, 2, 1, 0]) { // labelEls: the planets from Mercury, then the Sun
      const { el, name } = labelEls[k];
      const xy = project(solar.bodies[name === 'Sun' ? 0 : k + 1].pos, cam);
      let clear = xy && xy[0] > -20 && xy[0] < innerWidth && xy[1] > 0 && xy[1] < innerHeight;
      if (clear) {
        const x = xy[0] + parseFloat(getComputedStyle(el).marginLeft), h = el.offsetHeight;
        const box = [x, xy[1] - h / 2, x + el.offsetWidth, xy[1] + h / 2];
        clear = box[2] < innerWidth - 4 && dots.every((p) => Math.hypot(p[0] - xy[0], p[1] - xy[1]) > 16 &&
                  !(p[0] > box[0] - 6 && p[0] < box[2] + 6 && p[1] > box[1] - 6 && p[1] < box[3] + 6)) &&
                boxes.every((o) => box[0] > o[2] + 4 || box[2] < o[0] - 4 || box[1] > o[3] || box[3] < o[1]);
        if (clear) { dots.push(xy); boxes.push(box); place(el, xy); }
      }
      el.classList.toggle('is-off', !clear);
    }
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
