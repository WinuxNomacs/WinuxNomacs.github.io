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
  const KM_PER_AU = 149597870.7, KM_PER_MILE = 1.609344;
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
  const solar = { date: null, bodies: [] }; // bodies: { name, pos } for the Sun, each planet, Webb, then Ceres, Pallas, Vesta

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
    // Webb last (index WEBB): pos is where it is drawn, set each frame by drawWebb(); true is where it is.
    solar.bodies.push({ name: 'James Webb', full: 'James Webb Space Telescope', pos: solar.bodies[3].pos,
                        true: webbPlace(date, solar.bodies[3].pos) });
    for (const [name, , , el, rate] of PLANETS) {
      const c = name === 'Earth' ? [0.22, 0.32, 0.5] : [0.13, 0.15, 0.21];
      for (let j = 0; j < ORBIT_STEPS; j++) {
        put(fromEcliptic(orbitPoint(el, rate, T, (j / ORBIT_STEPS) * Math.PI * 2)), c, 0);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, solarBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    solar.date = date;
    placeAsteroids(date);
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
  // The Earth up close, and the Moon: textured spheres at their true sizes and places, lit from the Sun. The Earth
  // is turned as it is at this moment (Greenwich sidereal time) on its tilted axis, so day and night fall where
  // they really are: NASA's Blue Marble by day, Black Marble city lights by night, a cloud layer and a glow of air
  // round the edge. The Moon is where it is now (a short lunar theory, good to a fraction of a degree), its near
  // side towards the Earth. Units are AU as in the solar system, but each sphere is drawn in units of its own radius
  // relative to the camera, so the numbers stay precise this close in. The images load once the tour reaches the
  // Earth.
  // ---------------------------------------------------------------------------
  const EARTH_RADIUS = 6371 / KM_PER_AU, MOON_RADIUS = 1737.4 / KM_PER_AU;
  const GLOBE_FILL = 0.62; // the globe's radius at the end of the dive, as a share of the screen's narrower half

  // A sphere of unit radius: x towards latitude 0° longitude 0°, y towards 0° 90°E, z towards the North Pole, with
  // the image coordinates of an equirectangular map (the seam's column is doubled so the map wraps cleanly).
  function sphereMesh(seg, rings) {
    const verts = [], idx = [];
    for (let j = 0; j <= rings; j++) {
      const lat = Math.PI / 2 - (j / rings) * Math.PI;
      for (let i = 0; i <= seg; i++) {
        const lon = -Math.PI + (i / seg) * 2 * Math.PI;
        verts.push(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat), i / seg, j / rings);
      }
    }
    // Counter-clockwise seen from outside, so the far side can be culled.
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    return { verts: new Float32Array(verts), idx: new Uint16Array(idx) };
  }
  const sphere = sphereMesh(96, 48);
  const sphereBuf = gl.createBuffer(), sphereIdx = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuf);
  gl.bufferData(gl.ARRAY_BUFFER, sphere.verts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIdx);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.idx, gl.STATIC_DRAW);

  const SPHERE_VERT = `
    attribute vec3 aPos;   // on the unit sphere, in the body's own axes
    attribute vec2 aUv;
    uniform mat3 uModel;   // the body's axes in the drawing's
    uniform vec3 uRel;     // the body's centre relative to the camera, in body radii
    uniform mediump float uShell;  // 1 for the surface, a little more for the air (same precision as AIR_FRAG's)
    uniform mat3 uView;
    uniform vec2 uProj;
    varying vec3 vNormal;
    varying vec3 vToCam;
    varying vec2 vUv;
    void main() {
      vec3 n = uModel * aPos;
      vec3 p = uRel + uShell * n;  // relative to the camera; the projection doesn't mind the units
      vec3 v = uView * p;
      gl_Position = vec4(v.x * uProj.x, v.y * uProj.y, 0.0, -v.z);
      vNormal = n;
      vToCam = -p;
      vUv = aUv;
    }`;
  const SPHERE_FRAG = `
    precision mediump float;
    uniform sampler2D uDay;
    uniform sampler2D uNight;
    uniform sampler2D uClouds;
    uniform vec3 uSun;      // towards the Sun
    uniform float uEarth;   // 1 for the Earth (lights, clouds, glint, air), 0 for the Moon
    uniform float uCloudGain; // 0..1: the clouds layer, turned off and on by its button
    uniform float uFade;
    varying vec3 vNormal;
    varying vec3 vToCam;
    varying vec2 vUv;
    void main() {
      vec3 n = normalize(vNormal), v = normalize(vToCam);
      float ndl = dot(n, uSun), light = max(ndl, 0.0);
      vec3 day = texture2D(uDay, vUv).rgb;
      if (uEarth < 0.5) {
        // The Moon: sunlit, with a trace of earthshine on its dark side.
        gl_FragColor = vec4(day * (light * 1.15 + 0.02) * uFade, 1.0);
        return;
      }
      float cloud = texture2D(uClouds, vUv).r * 0.9 * uCloudGain;
      vec3 col = day * light * 1.2;
      // Sunlight glints on open water (the map's oceans are a flat deep blue).
      float ocean = smoothstep(0.05, 0.12, day.b - max(day.r, day.g));
      float glint = pow(max(dot(reflect(-uSun, n), v), 0.0), 60.0) * ocean * (1.0 - cloud) * step(0.0, ndl);
      col += vec3(1.0, 0.95, 0.85) * glint * 0.7;
      col = mix(col, vec3(light * 1.15), cloud);
      // The night image (city lights over dim land and sea), dimmed under cloud. It fades in while daylight fades
      // out, so there's no dark gap between them; a faint warm band runs along the line between day and night.
      float night = 1.0 - smoothstep(-0.02, 0.22, ndl);
      col += texture2D(uNight, vUv).rgb * vec3(1.0, 0.85, 0.6) * 1.4 * night * (1.0 - 0.7 * cloud);
      col += vec3(1.0, 0.55, 0.3) * exp(-ndl * ndl * 600.0) * 0.03;
      // Air towards the edge, blue where the Sun lights it.
      float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
      col += vec3(0.3, 0.55, 1.0) * rim * (0.08 + 0.9 * smoothstep(-0.2, 0.4, ndl)) * 0.6;
      gl_FragColor = vec4(col * uFade, 1.0);
    }`;
  // The air: the back of a slightly larger shell, brightest where a sight line skims the surface, fading to
  // nothing at the shell's edge.
  const AIR_FRAG = `
    precision mediump float;
    uniform vec3 uSun;
    uniform float uShell;
    uniform float uFade;
    varying vec3 vNormal;
    varying vec3 vToCam;
    void main() {
      vec3 n = normalize(vNormal);
      float h = length(cross(n * uShell, normalize(vToCam))); // the sight line's closest pass to the centre
      float a = clamp((uShell - h) / (uShell - 1.0), 0.0, 1.0);
      float sun = 0.1 + 0.9 * smoothstep(-0.25, 0.45, dot(n, uSun));
      gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * a * a * sun * 0.9 * uFade, 1.0);
    }`;
  const AIR_SHELL = 1.06;
  const globeProg = link(SPHERE_VERT, SPHERE_FRAG, ['aPos', 'aUv']);
  const airProg = link(SPHERE_VERT, AIR_FRAG, ['aPos', 'aUv']);
  const uniforms = (p, names) => Object.fromEntries(names.map((k) => [k, gl.getUniformLocation(p, k)]));
  const SPHERE_UNIFORMS = ['uModel', 'uRel', 'uShell', 'uView', 'uProj', 'uSun', 'uFade'];
  const gu = uniforms(globeProg, [...SPHERE_UNIFORMS, 'uEarth', 'uDay', 'uNight', 'uClouds', 'uCloudGain']);
  const au = uniforms(airProg, SPHERE_UNIFORMS);
  gl.useProgram(globeProg);
  gl.uniform1i(gu.uDay, 0);
  gl.uniform1i(gu.uNight, 1);
  gl.uniform1i(gu.uClouds, 2);

  const globe = { loading: false, ready: false, tex: {} };
  // The Earth up close's layer buttons (#layers): each layer is on or off (remembered in this browser where it
  // can be) and fades between them (shown, 0..1; stepped in the frame loop).
  const layers = {};
  for (const el of document.querySelectorAll('#layers [data-layer]')) {
    const name = el.dataset.layer, key = `layer-${name}`;
    let on = true;
    try { on = localStorage.getItem(key) !== 'off'; } catch (e) { /* no storage: on */ }
    const layer = layers[name] = { el, on, shown: on ? 1 : 0 };
    el.setAttribute('aria-pressed', String(on));
    el.addEventListener('click', () => {
      layer.on = !layer.on;
      el.setAttribute('aria-pressed', String(layer.on));
      try { localStorage.setItem(key, layer.on ? 'on' : 'off'); } catch (e) { /* not remembered */ }
      if (reduced) { layer.shown = layer.on ? 1 : 0; draw(0); }
    });
  }
  function stepLayers(dt) {
    for (const l of Object.values(layers)) l.shown = reduced ? +l.on : l.shown + (+l.on - l.shown) * (1 - Math.exp(-dt * 8));
  }
  function loadGlobe() {
    if (globe.loading) return;
    globe.loading = true;
    const files = { day: 'earth-day', night: 'earth-night', clouds: 'earth-clouds', moon: 'moon' };
    Promise.all(Object.entries(files).map(([key, file]) => new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok([key, img]);
      img.onerror = fail;
      img.src = `assets/img/${file}.webp`;
    }))).then((list) => {
      for (const [key, img] of list) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        globe.tex[key] = t;
      }
      globe.ready = true;
    }, () => {}); // no images: the Earth can't be visited, and its dot behaves as before
  }

  const daysSinceJ2000 = (date) => date.getTime() / 86400000 + 2440587.5 - 2451545;
  // The Earth's axes in the drawing's at this moment: towards 0° 0°, towards 0° 90°E, towards the North Pole.
  function earthAxes(date) {
    const gmst = (280.46061837 + 360.98564736629 * daysSinceJ2000(date)) * RAD;
    const c = Math.cos(gmst), s = Math.sin(gmst);
    return [fromEquatorial([c, s, 0]), fromEquatorial([-s, c, 0]), fromEquatorial([0, 0, 1])];
  }
  // Where the Moon is from the Earth now (the Astronomical Almanac's low-precision formulae): its direction in the
  // drawing's axes, its distance in AU and km.
  function moonPlace(date) {
    const T = daysSinceJ2000(date) / 36525;
    const S = (a, b) => Math.sin((a + b * T) * RAD), C = (a, b) => Math.cos((a + b * T) * RAD);
    const lon = (218.32 + 481267.881 * T + 6.29 * S(135.0, 477198.87) - 1.27 * S(259.3, -413335.36) +
                 0.66 * S(235.7, 890534.22) + 0.21 * S(269.9, 954397.74) - 0.19 * S(357.5, 35999.05) -
                 0.11 * S(186.5, 966404.03)) * RAD;
    const lat = (5.13 * S(93.3, 483202.02) + 0.28 * S(228.2, 960400.89) - 0.28 * S(318.3, 6003.15) -
                 0.17 * S(217.6, -407332.21)) * RAD;
    const parallax = (0.9508 + 0.0518 * C(135.0, 477198.87) + 0.0095 * C(259.3, -413335.36) +
                      0.0078 * C(235.7, 890534.22) + 0.0028 * C(269.9, 954397.74)) * RAD;
    const dist = EARTH_RADIUS / Math.sin(parallax);
    return { dir: fromEcliptic([Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]),
             dist, km: dist * KM_PER_AU };
  }
  // The Moon keeps its near side (the map's longitude 0°) towards the Earth, its north up.
  function moonAxes(dir) {
    const x = dir.map((v) => -v);
    const z = norm(sub([0, 1, 0], x.map((v) => v * x[1])));
    return [x, cross(z, x), z];
  }

  // Draws the Earth (with its air) and the Moon for the camera, the farther one first; fade (0..1) as they appear.
  // Returns the Moon's place, for its marker.
  function drawGlobe(cam, view, axes, fade, date) {
    const E = solar.bodies[3].pos, sun = norm(E.map((v) => -v));
    const moon = moonPlace(date);
    const M = E.map((e, i) => e + moon.dir[i] * moon.dist);
    const bodies = [{ c: E, r: EARTH_RADIUS, axes, earth: true }, { c: M, r: MOON_RADIUS, axes: moonAxes(moon.dir) }]
      .sort((a, b) => Math.hypot(...sub(b.c, cam.eye)) - Math.hypot(...sub(a.c, cam.eye)));
    const set = (u, b, shell) => {
      gl.uniformMatrix3fv(u.uModel, false, b.axes.flat());
      const rel = sub(b.c, cam.eye).map((v) => v / b.r);
      gl.uniform3f(u.uRel, rel[0], rel[1], rel[2]);
      gl.uniform1f(u.uShell, shell);
      gl.uniformMatrix3fv(u.uView, false, view);
      gl.uniform2f(u.uProj, proj.fx, proj.fy);
      gl.uniform3f(u.uSun, sun[0], sun[1], sun[2]);
      gl.uniform1f(u.uFade, fade);
    };
    gl.enable(gl.CULL_FACE);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIdx);
    for (const b of bodies) {
      if (b.earth) {
        use(airProg, sphereBuf, 5, [[3, 0], [2, 3]]);
        set(au, b, AIR_SHELL);
        gl.cullFace(gl.FRONT);
        gl.drawElements(gl.TRIANGLES, sphere.idx.length, gl.UNSIGNED_SHORT, 0);
      }
      use(globeProg, sphereBuf, 5, [[3, 0], [2, 3]]);
      set(gu, b, 1);
      gl.uniform1f(gu.uEarth, b.earth ? 1 : 0);
      gl.uniform1f(gu.uCloudGain, layers.clouds.shown);
      [b.earth ? globe.tex.day : globe.tex.moon, globe.tex.night, globe.tex.clouds].forEach((t, i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, t);
      });
      gl.activeTexture(gl.TEXTURE0);
      gl.cullFace(gl.BACK);
      gl.disable(gl.BLEND); // solid: it hides the stars behind it
      gl.drawElements(gl.TRIANGLES, sphere.idx.length, gl.UNSIGNED_SHORT, 0);
      gl.enable(gl.BLEND);
    }
    gl.disable(gl.CULL_FACE);
    // How much of the Moon is lit: half the cosine of the Sun–Moon–Earth angle, plus a half.
    return { pos: M, km: moon.km, lit: (1 + dot(sun, moon.dir.map((v) => -v))) / 2, phase: moonPhase(sun, moon.dir) };
  }

  // The Moon's phase from its angle east of the Sun along the ecliptic (the drawing's y is the ecliptic's north).
  // The four main phases are moments, so each is named only within about a day of it (12°).
  function moonPhase(sun, dir) {
    const d = (Math.atan2(sun[2] * dir[0] - sun[0] * dir[2], sun[0] * dir[0] + sun[2] * dir[2]) / RAD + 360) % 360;
    const near = (a) => Math.abs(d - a) < 12;
    if (near(0) || near(360)) return 'New Moon';
    if (near(90)) return 'First quarter';
    if (near(180)) return 'Full Moon';
    if (near(270)) return 'Last quarter';
    return ['Waxing crescent', 'Waxing gibbous', 'Waning gibbous', 'Waning crescent'][Math.floor(d / 90)];
  }

  // ---------------------------------------------------------------------------
  // Rockets: at the Earth up close, every 10–20 seconds a small rocket lifts off from a real launch site on the side
  // facing the camera, the site's name showing briefly. It rises, tips over towards its site's usual heading and
  // climbs away on a sweeping arc, fading as it nears the screen's edge, and its exhaust trail fades after it. A real
  // climb to orbit would be too small to see from here (about 3% of the Earth's radius), so the climb is stretched.
  // The rockets are points for the sky's program, placed relative to the camera in Earth radii.
  // ---------------------------------------------------------------------------
  // Name, latitude and longitude (degrees), and the usual launch heading (degrees from north: east for most orbits,
  // south for polar ones). Starbase stands in for Houston, which is Mission Control and has no launch pad.
  const LAUNCH_SITES = [
    ['Cape Canaveral', 28.5, -80.6, 90], ['Vandenberg', 34.7, -120.6, 180], ['Wallops', 37.9, -75.5, 120],
    ['Starbase, Texas', 26.0, -97.2, 95], ['Kourou', 5.2, -52.8, 90], ['Baikonur', 45.9, 63.3, 65],
    ['Plesetsk', 62.9, 40.6, 15], ['Vostochny', 51.9, 128.3, 40], ['Jiuquan', 41.0, 100.3, 140],
    ['Taiyuan', 38.8, 111.6, 180], ['Wenchang', 19.6, 111.0, 100], ['Xichang', 28.2, 102.0, 100],
    ['Sriharikota', 13.7, 80.2, 100], ['Tanegashima', 30.4, 131.0, 105], ['Mahia, New Zealand', -39.3, 177.9, 100],
  ];
  const ROCKET_STEP = 1 / 120;  // seconds between the points of a rocket's path (its trail is drawn from them)
  const ROCKET_FLIGHT = 14;     // seconds at most: by then it has left the screen
  const TRAIL_FADE = 1.8;       // seconds for the exhaust to fade to a third
  const TRAIL_LINGER = 5;       // seconds the trail lasts once the rocket has gone
  const ROCKETS_MAX = 3;
  const SITE_LABEL = 4;         // seconds the site's name shows
  const FLAME = [1.0, 0.86, 0.62], EXHAUST = [1.0, 0.68, 0.4], SMOKE = [0.72, 0.78, 0.9];
  const ROCKET_POINTS = Math.ceil(ROCKET_FLIGHT / ROCKET_STEP) + 3;
  const rocketData = new Float32Array(ROCKETS_MAX * ROCKET_POINTS * SKY_STRIDE);
  const rocketBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rocketBuf);
  gl.bufferData(gl.ARRAY_BUFFER, rocketData.byteLength, gl.DYNAMIC_DRAW);
  const rockets = { list: [], next: 0, last: null, named: null };
  const launchSite = document.getElementById('launch-site');

  // A point in the Earth's own axes (in Earth radii) in the drawing's axes.
  const onEarth = (axes, p) => [0, 1, 2].map((i) => axes[0][i] * p[0] + axes[1][i] * p[1] + axes[2][i] * p[2]);
  const siteUp = ([, lat, lon]) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD),
                                    Math.sin(lat * RAD)];

  // The camera seen from the Earth's centre (eye, in Earth radii): where a point relative to the camera lands on
  // screen (null behind it), and whether the sight line to a point q (from the Earth's centre) meets the Earth first.
  function earthView(cam) {
    const eye = sub(cam.eye, solar.bodies[3].pos).map((v) => v / EARTH_RADIUS);
    const W = innerWidth, H = innerHeight;
    const screen = (v) => {
      const w = -dot(v, cam.back);
      return w > 0 ? [(dot(v, cam.right) * proj.fx / w + 1) / 2 * W, (1 - dot(v, cam.up) * proj.fy / w) / 2 * H] : null;
    };
    const hidden = (q) => {
      const d = sub(q, eye), a = dot(d, d), b = dot(eye, d), disc = b * b - a * (dot(eye, eye) - 0.998);
      if (disc <= 0) return false;
      const s = (-b - Math.sqrt(disc)) / a;
      return s > 0 && s < 1;
    };
    return { eye, screen, hidden };
  }

  // The whole flight from a site, in the Earth's own axes: straight up at first, then tipping over towards the
  // heading while it speeds up, so it arcs away from the Earth.
  function rocketPath(site) {
    const lat = site[1] * RAD, lon = site[2] * RAD, h = site[3] * RAD, up = siteUp(site);
    const east = [-Math.sin(lon), Math.cos(lon), 0];
    const north = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)];
    const ahead = east.map((e, i) => e * Math.sin(h) + north[i] * Math.cos(h));
    const tilt = (65 + Math.random() * 15) * RAD, top = 0.5 + Math.random() * 0.2; // top speed, radii per second
    const pts = [];
    let p = up;
    for (let k = 0; k < ROCKET_POINTS - 2; k++) {
      pts.push(p);
      const a = (k * ROCKET_STEP) / 10;
      const pitch = tilt * ease(part(a, 0.05, 0.45));
      const v = (0.004 + top * Math.min(1, a) ** 1.6) * ROCKET_STEP;
      p = p.map((x, i) => x + (up[i] * Math.cos(pitch) + ahead[i] * Math.sin(pitch)) * v);
    }
    return pts;
  }

  // Lifts off from a site well inside the disc the camera sees (eye: the camera from the Earth's centre, in Earth
  // radii), not the last one used; returns false when there is none.
  function launchRocket(t, axes, eye) {
    const toCam = norm(eye);
    const open = LAUNCH_SITES.filter((s) => s !== rockets.last && dot(onEarth(axes, siteUp(s)), toCam) > 0.5);
    if (!open.length) return false;
    const site = open[Math.floor(Math.random() * open.length)];
    const rocket = { site, born: t, pts: rocketPath(site), gone: null };
    rockets.list.push(rocket);
    rockets.last = site;
    rockets.named = rocket;
    document.getElementById('launch-name').textContent = site[0];
    return true;
  }

  function clearRockets(t) {
    rockets.list = [];
    rockets.named = null;
    rockets.next = t + 2 + Math.random() * 2; // the first one a few seconds after arriving
    launchSite.classList.remove('is-shown');
  }

  // Launches, moves and draws the rockets and their trails; gain (0..1) fades them as the camera leaves.
  function drawRockets(cam, view, axes, t, gain) {
    const { eye, screen, hidden } = earthView(cam);
    if (!atGlobe()) rockets.next = Math.max(rockets.next, t + 2 + Math.random() * 2);
    else if (t >= rockets.next && rockets.list.length < ROCKETS_MAX) {
      rockets.next = t + (launchRocket(t, axes, eye) ? 10 + Math.random() * 10 : 2);
    }
    const W = innerWidth, H = innerHeight, margin = 0.12 * Math.min(W, H);
    // How far a point on screen is from fading at the edge (0..1).
    const edge = (xy) => (xy ? Math.max(0, Math.min(1, Math.min(xy[0], W - xy[0], xy[1], H - xy[1]) / margin)) : 0);
    let k = 0;
    const put = (v, c, bright, size) => {
      rocketData.set([v[0], v[1], v[2], c[0] * bright, c[1] * bright, c[2] * bright, size, 0], k);
      k += SKY_STRIDE;
    };
    rockets.list = rockets.list.filter((r) => r.gone === null || t - r.gone < TRAIL_LINGER);
    for (const r of rockets.list) {
      const age = t - r.born, n = Math.min(r.pts.length - 1, Math.floor(age / ROCKET_STEP));
      // The trail: hot just behind the rocket, then pale smoke fading away. Where the points crowd together on
      // screen (slow at first, or seen end on) each is dimmer, so the trail is evenly bright along its length.
      let prev = null;
      for (let i = Math.max(0, n - Math.floor(TRAIL_FADE * 5 / ROCKET_STEP)); i <= n; i++) {
        const q = onEarth(axes, r.pts[i]), v = sub(q, eye), xy = screen(v);
        const step = prev && xy ? Math.hypot(xy[0] - prev[0], xy[1] - prev[1]) : 1;
        prev = xy;
        const since = age - i * ROCKET_STEP;
        const b = 0.3 * Math.exp(-since / TRAIL_FADE) * Math.min(1, step) * edge(xy);
        if (b > 0.002 && !hidden(q)) put(v, mix(EXHAUST, SMOKE, Math.min(1, since / 0.6)), b, 3);
      }
      if (r.gone !== null) continue;
      // The rocket, flickering a little, and the glow of liftoff at the pad.
      const q = onEarth(axes, r.pts[n]), v = sub(q, eye), e = edge(screen(v));
      if ((age > 1 && e === 0) || n === r.pts.length - 1) { r.gone = t; continue; }
      if (!hidden(q)) put(v, FLAME, e * (1.4 + 0.3 * Math.sin(t * 37)) * Math.min(1, age * 3), 3);
      if (age < 2) put(sub(onEarth(axes, r.pts[0]), eye), FLAME, 0.35 * (1 - age / 2) * Math.min(1, age * 3), 9);
    }
    // The newest site's name, beside the pad for a few seconds (then it fades while still following the pad).
    const named = rockets.named && rockets.list.includes(rockets.named) ? rockets.named : null;
    if (named) {
      const pad = onEarth(axes, named.pts[0]), xy = screen(sub(pad, eye));
      const on = !!xy && !hidden(pad) && gain === 1 && t - named.born < SITE_LABEL;
      launchSite.classList.toggle('is-shown', on);
      if (xy) { place(launchSite, xy); fitLabel(launchSite, xy); }
      if (t - named.born > SITE_LABEL + 2) rockets.named = null;
    } else launchSite.classList.remove('is-shown');
    if (!k) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, rocketBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, rocketData.subarray(0, k));
    use(skyProg, rocketBuf, SKY_STRIDE, [[3, 0], [3, 3], [2, 6]]);
    gl.uniformMatrix3fv(kView, false, view);
    gl.uniform2f(kProj, proj.fx, proj.fy);
    gl.uniform1f(kDpr, proj.dpr);
    gl.uniform1f(kGain, gain);
    gl.uniform1f(kTwinkle, 0);
    gl.drawArrays(gl.POINTS, 0, k / SKY_STRIDE);
  }

  // ---------------------------------------------------------------------------
  // The International Space Station: at the Earth up close, a bright point on the ISS's true orbit (about 420 km up,
  // tilted 51.6° to the equator) with a faint line along it. Its place on the orbit is made up, and it is sped up so
  // a lap takes two minutes rather than 93. Both hide behind the Earth, and the ISS dims in the Earth's shadow.
  // Like the rockets, they are points for the sky's program, placed relative to the camera in Earth radii.
  // ---------------------------------------------------------------------------
  const ISS_HEIGHT = 420;         // km
  const ISS_TILT = 51.6 * RAD;
  const ISS_NODE = 40 * RAD;      // where it crosses the equator going north (right ascension): made up
  const ISS_LAP = 120;            // seconds a lap takes here
  const ISS_ORBIT_POINTS = 2400;  // dots along its orbit line, close enough to read as a line
  const ISS_COLOUR = [0.93, 0.96, 1.0], ISS_LINE = [0.5, 0.66, 0.95];
  const issData = new Float32Array((ISS_ORBIT_POINTS + 1) * SKY_STRIDE);
  const issBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, issBuf);
  gl.bufferData(gl.ARRAY_BUFFER, issData.byteLength, gl.DYNAMIC_DRAW);
  const issMarker = document.getElementById('iss-marker');

  // The point u (radians) along the orbit from where it crosses the equator going north, from the Earth's centre in
  // Earth radii and the drawing's axes. The orbit stays put among the stars while the Earth turns under it.
  function issAt(u) {
    const r = 1 + ISS_HEIGHT / (EARTH_RADIUS * KM_PER_AU), c = Math.cos(u) * r, s = Math.sin(u) * r;
    return fromEquatorial([c * Math.cos(ISS_NODE) - s * Math.sin(ISS_NODE) * Math.cos(ISS_TILT),
                           c * Math.sin(ISS_NODE) + s * Math.cos(ISS_NODE) * Math.cos(ISS_TILT), s * Math.sin(ISS_TILT)]);
  }
  const issOrbit = Array.from({ length: ISS_ORBIT_POINTS }, (_, i) => issAt((i / ISS_ORBIT_POINTS) * 2 * Math.PI));

  // Draws the orbit line and the ISS, and places its marker; gain (0..1) fades them as the camera leaves.
  function drawIss(cam, view, t, gain) {
    const { eye, screen, hidden } = earthView(cam);
    let k = 0;
    const put = (v, c, bright, size) => {
      issData.set([v[0], v[1], v[2], c[0] * bright, c[1] * bright, c[2] * bright, size, 0], k);
      k += SKY_STRIDE;
    };
    // The line: where its dots crowd together on screen each is dimmer, so it is evenly faint all round.
    let prev = null;
    for (const q of issOrbit) {
      const v = sub(q, eye), xy = screen(v);
      const step = prev && xy ? Math.hypot(xy[0] - prev[0], xy[1] - prev[1]) : 1;
      prev = xy;
      if (xy && !hidden(q)) put(v, ISS_LINE, 0.45 * Math.min(1, step / 1.5), 2);
    }
    // The ISS, dimmed inside the Earth's shadow (a cylinder behind the Earth, away from the Sun).
    const q = issAt(2 * Math.PI * ((t / ISS_LAP) % 1)), v = sub(q, eye), xy = screen(v);
    const sun = norm(solar.bodies[3].pos.map((x) => -x)), along = dot(q, sun);
    const off = Math.hypot(...sub(q, sun.map((x) => x * along)));
    const lit = along > 0 ? 1 : Math.min(1, Math.max(0, (off - 1) / 0.03));
    const seen = !!xy && !hidden(q);
    if (seen) put(v, ISS_COLOUR, 0.3 + 1.3 * lit, 4);
    const on = seen && atGlobe() && gain === 1 && xy[0] > 0 && xy[0] < innerWidth && xy[1] > 0 && xy[1] < innerHeight;
    issMarker.classList.toggle('is-shown', on);
    if (on) { place(issMarker, xy); fitLabel(issMarker, xy); }
    if (!k) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, issBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, issData.subarray(0, k));
    use(skyProg, issBuf, SKY_STRIDE, [[3, 0], [3, 3], [2, 6]]);
    gl.uniformMatrix3fv(kView, false, view);
    gl.uniform2f(kProj, proj.fx, proj.fy);
    gl.uniform1f(kDpr, proj.dpr);
    gl.uniform1f(kGain, gain);
    gl.uniform1f(kTwinkle, 0);
    gl.drawArrays(gl.POINTS, 0, k / SKY_STRIDE);
  }

  // ---------------------------------------------------------------------------
  // Space junk: at the Earth up close, every object tracked in orbit round it (junk.bin, made from CelesTrak's
  // data by tools/make-junk.py, which describes it), as tiny points: working satellites blue-white, debris, spent
  // rocket bodies and dead satellites orange. Those with published elements are at their true places at the
  // moment the visitor arrives; the rest are on their true orbits at made-up places. Each moves on its orbit by
  // Kepler's laws plus the drift the Earth's flattening (J2) gives it, worked out in the vertex shader; that is
  // within tens of km of the full model (SGP4) near the data's date, and the elements go stale by more than that
  // as weeks pass. Like the ISS they run JUNK_SPEED times faster than real (under reduced motion, real time),
  // hide behind the Earth, and dim in its shadow. The "Space junk" layer button turns them off and on.
  // ---------------------------------------------------------------------------
  const JUNK_SPEED = 92.9 * 60 / ISS_LAP; // the ISS's real lap over its lap here
  const JUNK_STRIDE = 9; // a (Earth radii), e, i, n (radians a day), node, perigee, mean anomaly, epoch (days), kind
  const JUNK_VERT = `
    attribute vec4 aOrbit;  // a, e, i, n
    attribute vec4 aPlace;  // node, argument of perigee, mean anomaly at the epoch, epoch (days from the file's)
    attribute float aKind;  // 0 working satellite, 1 junk
    uniform float uDays;    // now, in days from the file's epoch
    uniform mat3 uEq;       // equatorial axes to the drawing's
    uniform vec3 uEye;      // the camera from the Earth's centre, in Earth radii
    uniform vec3 uSun;      // towards the Sun
    uniform mat3 uView;
    uniform vec2 uProj;
    uniform float uDpr;
    uniform float uGain;
    varying vec3 vColor;
    void main() {
      float a = aOrbit.x, e = aOrbit.y, inc = aOrbit.z, n = aOrbit.w, dt = uDays - aPlace.w;
      // The Earth's flattening turns the orbit's node back and its perigee round, and changes the mean motion.
      float si = sin(inc), ci = cos(inc), q = sqrt(1.0 - e * e), p = a * q * q;
      float k = 1.5 * 1.08263e-3 * n / (p * p);
      float node = aPlace.x - k * ci * dt;
      float w = aPlace.y + k * (2.0 - 2.5 * si * si) * dt;
      float M = mod(aPlace.z + (n + k * q * (1.0 - 1.5 * si * si)) * dt, 6.2831853);
      float E = e > 0.8 ? 3.14159265 : M; // Kepler's equation by Newton's method
      for (int j = 0; j < 8; j++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
      vec2 o = vec2(a * (cos(E) - e), a * q * sin(E)); // in the orbit's plane, from perigee
      float cw = cos(w), sw = sin(w), cn = cos(node), sn = sin(node);
      vec3 P = vec3(o.x * cw - o.y * sw, o.x * sw + o.y * cw, 0.0);
      P = vec3(P.x, P.y * ci, P.y * si);
      P = uEq * vec3(P.x * cn - P.y * sn, P.x * sn + P.y * cn, P.z);
      // Hidden when the sight line from the camera meets the Earth first.
      vec3 d = P - uEye;
      float dd = dot(d, d), b = dot(uEye, d), disc = b * b - dd * (dot(uEye, uEye) - 0.998);
      float s = disc > 0.0 ? (-b - sqrt(disc)) / dd : -1.0;
      float hidden = (s > 0.0 && s < 1.0) ? 1.0 : 0.0;
      // Dim in the Earth's shadow: the cylinder behind it, away from the Sun.
      float along = dot(P, uSun);
      float lit = along > 0.0 ? 1.0 : clamp((length(P - uSun * along) - 1.0) / 0.03, 0.0, 1.0);
      vec3 v = uView * d;
      gl_Position = vec4(v.x * uProj.x, v.y * uProj.y, 0.0, -v.z);
      gl_PointSize = 2.0 * uDpr;
      vec3 c = aKind < 0.5 ? vec3(0.55, 0.7, 1.0) : vec3(1.0, 0.55, 0.28);
      vColor = c * (0.08 + 0.32 * lit) * uGain * (1.0 - hidden);
    }`;
  const junkProg = link(JUNK_VERT, FRAG, ['aOrbit', 'aPlace', 'aKind']);
  const ju = uniforms(junkProg, ['uDays', 'uEq', 'uEye', 'uSun', 'uView', 'uProj', 'uDpr', 'uGain']);
  const junkBuf = gl.createBuffer();
  const junk = { loading: false, count: 0, epoch: 0, counts: null, start: 0, t0: 0 };
  // Loads junk.bin into the buffer once, the first time the Earth is visited.
  function loadJunk() {
    if (junk.loading) return;
    junk.loading = true;
    fetch('junk.bin').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((buf) => {
      const dv = new DataView(buf), count = dv.getUint32(8, true);
      const counts = [0, 1, 2].map((i) => dv.getUint32(12 + 4 * i, true));
      const data = new Float32Array(count * JUNK_STRIDE), U = (o) => dv.getUint16(o, true) / 65535;
      for (let i = 0, o = 24; i < count; i++, o += 18) {
        const rev = dv.getFloat32(o, true), n = rev * 2 * Math.PI;
        // From the mean motion, by Kepler's third law: GM is 398600.4418 km³/s², the radius 6378.137 km.
        const a = Math.cbrt(398600.4418 / ((rev / 86400) * 2 * Math.PI) ** 2) / 6378.137;
        data.set([a, U(o + 8), U(o + 10) * Math.PI, n, U(o + 12) * 2 * Math.PI, U(o + 14) * 2 * Math.PI,
                  U(o + 16) * 2 * Math.PI, dv.getFloat32(o + 4, true), i < counts[0] ? 0 : 1], i * JUNK_STRIDE);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, junkBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      Object.assign(junk, { count, counts, epoch: dv.getFloat64(0, true) });
      setJunkNote();
      if (reduced && atGlobe()) draw(0); // no frame loop to show them
    }).catch(() => { junk.loading = false; }); // tried again on the next visit
  }
  const uEqAxes = [...fromEquatorial([1, 0, 0]), ...fromEquatorial([0, 1, 0]), ...fromEquatorial([0, 0, 1])];
  // Draws the objects; t is the page's clock (s), gain (0..1) fades them.
  function drawJunk(cam, view, t, gain) {
    if (!junk.count || gain <= 0) return;
    if (!junk.start) { junk.start = Date.now(); junk.t0 = t; }
    const now = reduced ? Date.now() : junk.start + (t - junk.t0) * 1000 * JUNK_SPEED;
    const { eye } = earthView(cam);
    use(junkProg, junkBuf, JUNK_STRIDE, [[4, 0], [4, 4], [1, 8]]);
    gl.uniform1f(ju.uDays, (now - junk.epoch) / 86400000);
    gl.uniformMatrix3fv(ju.uEq, false, uEqAxes);
    gl.uniform3f(ju.uEye, eye[0], eye[1], eye[2]);
    const sun = norm(solar.bodies[3].pos.map((x) => -x));
    gl.uniform3f(ju.uSun, sun[0], sun[1], sun[2]);
    gl.uniformMatrix3fv(ju.uView, false, view);
    gl.uniform2f(ju.uProj, proj.fx, proj.fy);
    gl.uniform1f(ju.uDpr, proj.dpr);
    gl.uniform1f(ju.uGain, gain);
    gl.drawArrays(gl.POINTS, 0, junk.count);
  }
  // The note's words about the objects, once their counts and date are known.
  function setJunkNote() {
    const [working, exact, modelled] = junk.counts, all = working + exact + modelled;
    const day = new Date(junk.epoch).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    document.getElementById('junk-note').textContent = `${all.toLocaleString('en-US')} tracked objects as of ${day}: ` +
      `working satellites blue, junk orange (${modelled.toLocaleString('en-US')} at made-up places on their true ` +
      `orbits), ${reduced ? 'moving at their real speed' : 'sped up like the ISS'}.`;
  }

  // ---------------------------------------------------------------------------
  // The James Webb Space Telescope in the solar system view. It circles the Sun–Earth L2 point, about 1.5 million km
  // beyond the Earth on the side away from the Sun, in a halo loop that takes about six months, so it goes round
  // the Sun with the Earth. The loop here is modelled: about the size NASA gives (its long way about as long as
  // the Earth–L2 distance, up to about 520,000 km out of the ecliptic), at a made-up point along it, so its
  // distances are close but not exact. At the solar system's scale it would sit inside the Earth's dot, so its
  // offset from the Earth, and its loop, are drawn larger: WEBB_PX on screen, but never more than WEBB_MAX times.
  // ---------------------------------------------------------------------------
  const WEBB = 9; // its index in solar.bodies
  const L2_AU = 1.5e6 / KM_PER_AU;
  // The loop's half-sizes in km: away from the Sun, along the Earth's path, and out of the ecliptic.
  const WEBB_LOOP = [120000, 750000, 450000];
  const WEBB_DAYS = 180;  // a loop
  const WEBB_START = 2.0; // radians along the loop at J2000, made up
  const WEBB_PX = 60, WEBB_MAX = 25;
  const WEBB_STEPS = 96;
  const WEBB_COLOUR = [1.0, 0.8, 0.42], WEBB_LINE = [0.3, 0.24, 0.12];
  const webbData = new Float32Array((WEBB_STEPS + 1) * SOLAR_STRIDE);
  const webbBuf = gl.createBuffer();

  // A point on the loop (u in radians along it) for an Earth at E (AU): L2, then the loop's offset along the axes
  // away from the Sun (x), along the Earth's path (y) and north of the ecliptic (z).
  function webbLoopPoint(E, u) {
    const x = norm(E), z = [0, 1, 0], y = cross(z, x);
    const k = [Math.cos(u) * WEBB_LOOP[0], Math.sin(u) * WEBB_LOOP[1], Math.cos(u) * WEBB_LOOP[2]];
    return [0, 1, 2].map((i) => E[i] + x[i] * L2_AU + (x[i] * k[0] + y[i] * k[1] + z[i] * k[2]) / KM_PER_AU);
  }
  // Where Webb is on the date.
  function webbPlace(date, E) {
    const days = date.getTime() / 86400000 + 2440587.5 - 2451545;
    return webbLoopPoint(E, WEBB_START + (days / WEBB_DAYS) * Math.PI * 2);
  }

  // Draws Webb and its loop with the solar system's program (already in use, its uniforms set), set out from the
  // Earth as far as WEBB_PX on screen. It fades out, and can't be picked, when that gap is too small to see.
  // Returns whether it is drawn.
  function drawWebb(cam) {
    const E = solar.bodies[3].pos, w = -dot(sub(E, cam.eye), cam.back);
    if (w <= 0) return false;
    const perAU = (proj.fx / w) * innerWidth / 2; // px per AU at the Earth
    const scale = Math.min(WEBB_PX / (L2_AU * perAU), WEBB_MAX);
    const gap = scale * L2_AU * perAU, fade = Math.min(1, Math.max(0, (gap - 14) / 14));
    const out = (p) => [0, 1, 2].map((i) => E[i] + (p[i] - E[i]) * scale);
    const body = solar.bodies[WEBB];
    body.pos = out(body.true);
    if (fade === 0) return false;
    let k = 0;
    const put = (p, c, size) => {
      webbData.set([p[0], p[1], p[2], c[0] * fade, c[1] * fade, c[2] * fade, size], k);
      k += SOLAR_STRIDE;
    };
    for (let j = 0; j < WEBB_STEPS; j++) put(out(webbLoopPoint(E, (j / WEBB_STEPS) * Math.PI * 2)), WEBB_LINE, 0);
    put(body.pos, WEBB_COLOUR, 9);
    use(solarProg, webbBuf, SOLAR_STRIDE, [[3, 0], [4, 3]]);
    gl.bufferData(gl.ARRAY_BUFFER, webbData, gl.DYNAMIC_DRAW);
    gl.uniform1f(sFlat, 1);
    gl.drawArrays(gl.LINE_LOOP, 0, WEBB_STEPS);
    gl.uniform1f(sFlat, 0);
    gl.drawArrays(gl.POINTS, WEBB_STEPS, 1);
    return true;
  }

  // ---------------------------------------------------------------------------
  // The asteroids: the brightest of the main belt between Mars and Jupiter and of Jupiter's Trojans (the swarms
  // 60° ahead of and behind it), from asteroids.bin (made by tools/make-asteroids.py from NASA JPL's Small-Body
  // Database, which documents the layout). Each is where it is on the visitor's date, by Kepler's laws from its
  // orbit, as a faint dot for the solar system's program. Ceres, Pallas and Vesta, first in the file, join
  // solar.bodies after Webb (from CERES on), so they get names and can be picked.
  // ---------------------------------------------------------------------------
  const CERES = WEBB + 1;
  const BIG_THREE = [{ name: 'Ceres', full: 'Ceres, a dwarf planet' }, { name: 'Pallas' }, { name: 'Vesta' }];
  const ASTEROID_COLOUR = [0.34, 0.31, 0.27], ASTEROID_SIZE = 2.4;
  const BIG_COLOUR = [0.8, 0.74, 0.64], BIG_SIZE = 6;
  const asteroids = { orbits: null, count: 0, belt: 0, epoch: 0, drawn: 0 };
  const asteroidBuf = gl.createBuffer();
  function loadAsteroids() {
    if (asteroids.orbits || asteroids.loading) return;
    asteroids.loading = true;
    fetch('asteroids.bin').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((buf) => {
      const v = new DataView(buf), u = (p) => v.getUint16(p, true) / 65535;
      asteroids.epoch = v.getFloat64(0, true);
      asteroids.belt = v.getUint32(8, true);
      asteroids.count = asteroids.belt + v.getUint32(12, true);
      // a, e, inclination, node, argument of perihelion, mean anomaly at the epoch (degrees)
      const o = new Float32Array(asteroids.count * 6);
      for (let i = 0, p = 16; i < asteroids.count; i++, p += 14) {
        o.set([v.getFloat32(p, true), u(p + 4), u(p + 6) * 180, u(p + 8) * 360, u(p + 10) * 360, u(p + 12) * 360], i * 6);
      }
      asteroids.orbits = o;
      if (solar.date) { placeAsteroids(solar.date); setDateTexts(solar.date); redraw(); }
    }).catch(() => {}); // without the file the solar system has no asteroids
  }
  // Places them for the date (call after buildSolar(date), which empties the bodies after Webb).
  function placeAsteroids(date) {
    if (!asteroids.orbits) return;
    const days = date.getTime() / 86400000 + 2440587.5 - asteroids.epoch, o = asteroids.orbits;
    const data = new Float32Array(asteroids.count * SOLAR_STRIDE), none = [0, 0, 0, 0, 0, 0];
    solar.bodies.length = CERES;
    for (let i = 0; i < asteroids.count; i++) {
      const [a, e, inc, node, w, m] = o.subarray(i * 6, i * 6 + 6);
      const M = m + (0.9856076686 / Math.pow(a, 1.5)) * days; // degrees a day by Kepler's third law
      // In orbitPoint's form: [a, e, I, mean longitude, longitude of perihelion, node], not changing.
      const pos = fromEcliptic(orbitPoint([a, e, inc, M + w + node, w + node, node], none, 0));
      const big = i < BIG_THREE.length, c = big ? BIG_COLOUR : ASTEROID_COLOUR;
      data.set([pos[0], pos[1], pos[2], c[0], c[1], c[2], big ? BIG_SIZE : ASTEROID_SIZE], i * SOLAR_STRIDE);
      if (big) solar.bodies.push({ ...BIG_THREE[i], pos });
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, asteroidBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    asteroids.drawn = asteroids.count;
  }
  // Draws them with the solar system's program (in use, its uniforms set, faded by fade); the three named ones
  // last, on top. Seen from far off the dots crowd into a solid ring, so they dim as the belt shrinks on screen
  // (below ASTEROID_CROWD px per AU at the Sun's distance), and faster once it is tiny (below ASTEROID_TINY).
  const ASTEROID_CROWD = 80, ASTEROID_TINY = 30;
  function drawAsteroids(cam, fade) {
    const w = dot(cam.eye, cam.back); // the Sun's distance in front of the camera
    if (!asteroids.drawn || w <= 0) return;
    const perAU = (proj.fx / w) * innerWidth / 2;
    use(solarProg, asteroidBuf, SOLAR_STRIDE, [[3, 0], [4, 3]]);
    gl.uniform1f(sFade, fade * Math.min(1, perAU / ASTEROID_CROWD) * Math.min(1, perAU / ASTEROID_TINY));
    gl.drawArrays(gl.POINTS, BIG_THREE.length, asteroids.drawn - BIG_THREE.length);
    gl.uniform1f(sFade, fade);
    gl.drawArrays(gl.POINTS, 0, BIG_THREE.length);
  }

  // ---------------------------------------------------------------------------
  // The nearest stars: the tour's stage between the galaxy and the solar system. near-stars.json (made from the
  // HYG Database by tools/make-near-stars.py, which describes it) holds the stars within 20 light-years, in
  // galactic coordinates. They are set round the galaxy's Sun with the galactic centre towards the galaxy's
  // centre and galactic north up out of the disc, so they turn with the galaxy and the camera flies on into them.
  // Brightness follows each star's true brightness as seen from the camera, squeezed so the faint red dwarfs
  // still show; a few are named with their distance (#near-labels).
  // ---------------------------------------------------------------------------
  const LY_PER_UNIT = 1360 * 3.26156; // the galaxy's unit is 1.36 kpc
  const NEAR_SUN = [0, 0, 0, 4.83, 0.65]; // the Sun itself, in the file's form
  const near = { stars: null, offsets: null, colours: null, labels: [] };
  const nearData = new Float32Array(120 * SKY_STRIDE);
  const nearBuf = gl.createBuffer();
  const nearLabels = document.getElementById('near-labels');
  function loadNear() {
    if (near.stars || near.loading) return;
    near.loading = true;
    fetch('near-stars.json').then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((d) => {
      // Galactic axes in the disc's coordinates (before it turns): x towards the centre, y the way the Sun moves
      // round it (the galaxy turns towards +angle), z out of the disc.
      const c = Math.cos(SUN.angle), s = Math.sin(SUN.angle);
      const X = [-c, 0, -s], Y = [-s, 0, c], Z = [0, 1, 0];
      near.stars = [NEAR_SUN, ...d.stars.slice(0, nearData.length / SKY_STRIDE - 1)];
      near.offsets = near.stars.map(([x, y, z]) => [0, 1, 2].map((i) => (x * X[i] + y * Y[i] + z * Z[i]) / LY_PER_UNIT));
      near.colours = near.stars.map((st) => starColour(st[4]));
      const label = (body, name, html) => {
        const el = document.createElement('span');
        el.className = 'near-label';
        el.innerHTML = html;
        nearLabels.append(el);
        return { el, body, name };
      };
      near.labels = [label(0, 'The Sun', 'The Sun'), ...Object.entries(d.names).map(([i, name]) => {
        const st = near.stars[+i + 1];
        return label(+i + 1, name, `${name}<small>${Math.hypot(st[0], st[1], st[2]).toFixed(1)} light-years</small>`);
      })];
      const [first, second, third] = near.labels.slice(1, 4).map((l) => l.name);
      nearText = `The nearest stars: ${d.stars.length} within 20 light-years of the Sun, among them ${first}, ` +
                 `${second} and ${third}.`;
    }).catch(() => {}); // without the file the tour goes straight on to the Sun
  }
  let nearText = '';
  // Draws the nearest stars round the galaxy camera's Sun, faded by fade (0..1), and places the names when named.
  function drawNear(cam, angle, fade, named) {
    if (!near.stars || fade <= 0) { nearLabels.classList.remove('is-shown'); return; }
    const sunV = sub(cam.sun, cam.eye);
    const where = near.offsets.map((o) => {
      const w = toWorld(o[0], o[1], o[2], angle);
      return [sunV[0] + w[0], sunV[1] + w[1], sunV[2] + w[2]];
    });
    let k = 0;
    near.stars.forEach((st, i) => {
      const v = where[i], ly = Math.max(0.3, Math.hypot(...v) * LY_PER_UNIT);
      const mag = st[3] + 5 * Math.log10(ly / 32.6156); // as seen from the camera
      const size = Math.min(16, Math.max(4.5, 11 - 0.5 * mag)), bright = Math.min(1.6, Math.max(0.5, 1.5 - 0.06 * mag));
      const col = near.colours[i];
      nearData.set([v[0], v[1], v[2], col[0] * bright, col[1] * bright, col[2] * bright, size, 0], k);
      k += SKY_STRIDE;
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, nearBuf);
    gl.bufferData(gl.ARRAY_BUFFER, nearData.subarray(0, k), gl.DYNAMIC_DRAW);
    use(skyProg, nearBuf, SKY_STRIDE, [[3, 0], [3, 3], [2, 6]]);
    gl.uniformMatrix3fv(kView, false, viewMatrix(cam));
    gl.uniform2f(kProj, proj.fx, proj.fy);
    gl.uniform1f(kDpr, proj.dpr);
    gl.uniform1f(kGain, fade);
    gl.uniform1f(kTwinkle, 0);
    gl.drawArrays(gl.POINTS, 0, k / SKY_STRIDE);
    // Names, the Sun's then nearest star first, on the dot's right or else its left; each left out when off screen
    // or crowding one already placed.
    nearLabels.classList.toggle('is-shown', named);
    const placed = [], W = innerWidth, H = innerHeight, bottom = H - (W <= 600 ? 120 : 70); // clear of the note
    for (const l of near.labels) {
      const v = where[l.body], xy = project([cam.eye[0] + v[0], cam.eye[1] + v[1], cam.eye[2] + v[2]], cam);
      l.w = l.w || l.el.offsetWidth || 150; // measured once
      const left = !!xy && xy[0] + 10 + l.w > W - 8;
      const ok = !!xy && (left ? xy[0] - 10 - l.w > 8 : xy[0] > 8) && xy[1] > 70 && xy[1] < bottom &&
                 placed.every((p) => Math.abs(p[0] - xy[0]) > 130 || Math.abs(p[1] - xy[1]) > 40);
      l.el.classList.toggle('is-off', !ok);
      if (ok) { placed.push(xy); place(l.el, xy); l.el.classList.toggle('is-left', left); }
    }
  }

  // ---------------------------------------------------------------------------
  // The tour: clicking the head flies the camera through the galaxy to the Sun's place in it, dives into the
  // Sun, crossfades to the solar system and eases in towards the Earth: "You are here".
  // ---------------------------------------------------------------------------
  const FLY = 6;    // seconds: the flight through the galaxy to the Sun
  const HOLD = 1.5; // seconds at the Sun, with its marker
  const NEAR = 5;   // seconds flying in among the nearest stars while the galaxy dims
  const DIVE = 3;   // seconds diving into the Sun while the stars fade out and the solar system fades in
  const ZOOM = 6;   // seconds easing in from the whole solar system towards the Earth
  const AT_SUN = FLY, LEAVE_SUN = AT_SUN + HOLD, INTO_SUN = LEAVE_SUN + NEAR, IN_SYSTEM = INTO_SUN + DIVE;
  const AT_EARTH = IN_SYSTEM + ZOOM;
  // Among the nearest stars: the camera comes in from the galaxy view to NEAR_FAR from the Sun, then drifts on to
  // NEAR_CLOSE (light-years), circling NEAR_TURN radians round the galaxy's axis so the stars move past in depth.
  const NEAR_FAR = 60, NEAR_CLOSE = 9, NEAR_TURN = 0.7;
  // Where the galaxy flight ends, in the disc's own coordinates: outside the Sun's orbit and above the disc,
  // looking at a point a little past the Sun towards the centre, so the Sun sits low with the core beyond.
  const VIEW = { out: 6, ahead: 0.2, up: 5, lead: 0.35 };
  // The solar system views: from above the ecliptic at `wide` (whole system) then `close` (round the Earth),
  // degrees of elevation, and how far towards the Earth the close view looks (0 = the Sun, 1 = the Earth).
  const SOLAR_VIEW = { wideEl: 62, closeEl: 34, lead: 0.55 };
  // Exploring at the Earth: zoom runs from the whole system (0) to the Earth (1) along the tour's path;
  // ZOOM_RANGE is that span in log distance (see solarCamera), so a pinch can follow the fingers.
  const ZOOM_RANGE = Math.log(36 / 1.3);
  const ZOOM_STEP = 0.2; // per "+" or "−"
  // At the Earth the camera slowly circles (radians per second: one turn in about 4 minutes), easing in and out.
  const ORBIT_SPEED = 0.026;
  const orbit = { angle: 0, rate: 0 };
  const zoom = { z: 1, target: 1 };
  // Visiting the Earth up close: t runs 0..EARTH_DIVE seconds into the globe and back out; there the camera circles
  // it (turn, at rate), starting over the visitor's time zone (lon, Earth longitude in radians).
  const EARTH_DIVE = 5;
  const GLOBE_SPEED = 0.03; // radians per second
  const visit = { t: 0, goal: 0, turn: 0, rate: 0, lon: 0 };
  let selected = null; // the picked body (index into solar.bodies), or null
  let bodyXY = [];     // where each body is on screen, for picking by click
  const head = document.getElementById('head');
  const quote = document.getElementById('quote');
  const banner = document.querySelector('.line--top');
  const back = document.getElementById('back');
  const sunMarker = document.getElementById('sun-marker');
  const earthMarker = document.getElementById('earth-marker');
  const labels = document.getElementById('planet-labels');
  const note = document.getElementById('tour-note');
  const noteText = document.getElementById('tour-note-text');
  const status = document.getElementById('tour-status');
  const bodyMarker = document.getElementById('body-marker');
  const zoomBox = document.getElementById('zoom');
  const layersBox = document.getElementById('layers');
  const zoomIn = document.getElementById('zoom-in'), zoomOut = document.getElementById('zoom-out');
  const earthDive = document.getElementById('earth-dive');
  const moonMarker = document.getElementById('moon-marker');
  const moonPhaseEl = document.getElementById('moon-phase');
  const globeCaption = document.getElementById('globe-caption');
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
    return { eye, look, right, up: cross(back3, right), back: back3 };
  }
  // Where a point lands on screen in CSS pixels, or null when it is behind the camera.
  function project(p, cam) {
    const v = sub(p, cam.eye), w = -dot(v, cam.back);
    if (w <= 0) return null;
    return [(dot(v, cam.right) * proj.fx / w + 1) / 2 * innerWidth, (1 - dot(v, cam.up) * proj.fy / w) / 2 * innerHeight];
  }

  // The galaxy camera for flight progress s (0..1), progress n among the nearest stars (0..1) and dive progress d
  // (0..1, into the Sun).
  function galaxyCamera(s, n, d, angle) {
    const sun = toWorld(Math.cos(SUN.angle) * SUN.r, SUN.y, Math.sin(SUN.angle) * SUN.r, angle);
    const a = SUN.angle + VIEW.ahead, r = SUN.r + VIEW.out;
    const end = toWorld(Math.cos(a) * r, VIEW.up, Math.sin(a) * r, angle);
    const focus = sun.map((v) => v * (1 - VIEW.lead)); // the centre is at the origin
    const endDir = sub(end, focus), endDist = Math.hypot(...endDir);
    // Landing page: straight down -z from DIST away, nudged against the pointer for depth.
    const home = [-current.x * 1.6, current.y * 1.0, 0];
    const inward = ease(part(n, 0, 0.45)); // from the galaxy view in to the nearest stars
    const look = lerp3(lerp3(home, focus, ease(Math.min(1, s * 1.4))), sun, inward);
    const nearFar = NEAR_FAR / LY_PER_UNIT, nearClose = NEAR_CLOSE / LY_PER_UNIT;
    let dist = logLerp(logLerp(DIST, endDist, s), nearFar, inward);
    if (n > 0.45) dist = logLerp(nearFar, nearClose, (n - 0.45) / 0.55);
    if (d > 0) dist = logLerp(nearClose, 0.05 / LY_PER_UNIT, d * d);
    let dir = norm(lerp3([0, 0, 1], norm(endDir), s));
    if (n > 0) { // circling round the galaxy's axis through the Sun
      const a = NEAR_TURN * (n + 0.25 * d), axis = toWorld(0, 1, 0, angle);
      const ca = Math.cos(a), sa = Math.sin(a), along = dot(axis, dir), side = cross(axis, dir);
      dir = norm(dir.map((v, i) => v * ca + side[i] * sa + axis[i] * along * (1 - ca)));
    }
    let eye = look.map((v, i) => v + dir[i] * dist);
    // At the Sun the pointer still sways the camera a little (less as it dives in).
    const sway = s * Math.min(1, dist / endDist);
    eye = [eye[0] - current.x * 0.12 * sway, eye[1] + current.y * 0.08 * sway, eye[2]];
    const cam = lookAt(eye, look, norm(lerp3([0, 1, 0], toWorld(0, 1, 0, 0), s)));
    cam.sun = sun;
    return cam;
  }

  // The solar system camera for zoom progress z (0..1); fading (0..1) pulls it further out while it fades in;
  // turn (radians) circles it round the point it looks at (the Sun when zoomed out), so zoomed in the Earth stays in view.
  function solarCamera(z, fading, turn) {
    const earth = solar.bodies[3].pos;
    const h0 = norm([earth[0], 0, earth[2]]); // from the Sun out past the Earth
    const h = [h0[0] * Math.cos(turn) - h0[2] * Math.sin(turn), 0, h0[0] * Math.sin(turn) + h0[2] * Math.cos(turn)];
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

  // Turns direction a towards b by t (0..1) along the great circle between them.
  function slerp(a, b, t) {
    const w = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
    if (w < 1e-5) return b;
    if (Math.PI - w < 1e-3) { // opposite: by way of a direction square to both
      const m = norm(cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      return t < 0.5 ? slerp(a, m, t * 2) : slerp(m, b, t * 2 - 1);
    }
    const ka = Math.sin((1 - t) * w) / Math.sin(w), kb = Math.sin(t * w) / Math.sin(w);
    return [0, 1, 2].map((i) => a[i] * ka + b[i] * kb);
  }

  // From the solar system camera (base) on into the Earth, for dive progress p (0..1): it turns to the Earth and
  // closes in until the globe fills GLOBE_FILL of the screen, ending over the visitor's time zone, 25° north, with
  // north up. There it circles (visit.turn) westward over the ground, so the Earth seems to turn the way it does.
  function diveCamera(base, p, axes) {
    const E = solar.bodies[3].pos;
    const lon = visit.lon - visit.turn, lat = 25 * RAD;
    const f = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    const end = norm([0, 1, 2].map((i) => axes[0][i] * f[0] + axes[1][i] * f[1] + axes[2][i] * f[2]));
    const off = sub(base.eye, E);
    const near = (EARTH_RADIUS * Math.max(proj.fx, proj.fy)) / GLOBE_FILL;
    const dir = slerp(norm(off), end, ease(Math.min(1, p * 1.2)));
    const eye = E.map((e, i) => e + dir[i] * logLerp(Math.hypot(...off), near, p));
    const look = lerp3(base.look, E, ease(Math.min(1, p * 2.5)));
    return lookAt(eye, look, norm(lerp3([0, 1, 0], axes[2], ease(p))));
  }

  // The Moon's marker: shown at the Earth up close while the Moon is on screen and not behind the Earth.
  function placeMoonMarker(m, cam) {
    const toE = sub(solar.bodies[3].pos, cam.eye), toM = sub(m.pos, cam.eye);
    const behind = Math.hypot(...toM) > Math.hypot(...toE) &&
      Math.acos(Math.min(1, dot(norm(toE), norm(toM)))) < Math.asin(Math.min(1, EARTH_RADIUS / Math.hypot(...toE)));
    const xy = atGlobe() && !behind && project(m.pos, cam);
    const on = !!xy && xy[0] > 0 && xy[0] < innerWidth && xy[1] > 0 && xy[1] < innerHeight;
    moonMarker.classList.toggle('is-shown', on);
    if (!on) return;
    place(moonMarker, xy);
    fitLabel(moonMarker, xy);
    const round = (n) => (Math.round(n / 100) * 100).toLocaleString('en-GB');
    const info = `${round(m.km / KM_PER_MILE)} miles (${round(m.km)} km) away, ${Math.round(m.lit * 100)}% lit`;
    const el = document.getElementById('moon-info');
    if (el.textContent !== info) el.textContent = info;
    if (moonPhaseEl.textContent !== m.phase) moonPhaseEl.textContent = m.phase;
  }

  // Lifts the banner to the top edge while touring (offsetTop ignores the lift itself).
  function measureBanner() {
    document.body.style.setProperty('--lift', (12 - banner.offsetTop) + 'px');
  }

  // Planet names, made once. Each is a button that picks its body (body: its index in solar.bodies).
  const labelEls = PLANETS.map(([name]) => name).concat('Sun', 'James Webb', ...BIG_THREE.map((b) => b.name)).map((name, k) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'planet-label';
    el.dataset.name = name;
    el.textContent = name;
    el.setAttribute('aria-pressed', 'false');
    const body = name === 'Sun' ? 0 : k <= PLANETS.length ? k + 1 : k; // the Sun's and Webb's names follow the planets'
    el.addEventListener('click', (e) => { e.stopPropagation(); select(body); });
    labels.appendChild(el);
    return { name, el, body };
  });

  let sunText = '', earthText = '', bodyText = '';
  // A body's distance from the Sun for the day, from its position (in AU): "X million miles", "(Y million km) from
  // the Sun", in two parts so phones can put them on two lines.
  // Webb's starts with its distance from the Earth.
  function distanceParts(body) {
    const b = solar.bodies[body], pos = b.true || b.pos;
    const km = Math.hypot(...pos) * KM_PER_AU;
    const big = (n) => (n < 1e9 ? (n / 1e6).toFixed(1) + ' million' : (n / 1e9).toFixed(2) + ' billion');
    const parts = [`${big(km / KM_PER_MILE)} miles`, `(${big(km)} km) from the Sun`];
    if (body !== WEBB) return parts;
    const near = Math.hypot(...sub(pos, solar.bodies[3].pos)) * KM_PER_AU;
    const miles = (Math.round(near / KM_PER_MILE / 10000) * 10000).toLocaleString('en-GB');
    return [`About ${miles} miles`, `(${big(near)} km) from the Earth,`, ...parts];
  }
  const spans = (parts) => parts.flatMap((text, i) => [i ? ' ' : '', Object.assign(document.createElement('span'), { textContent: text })]);
  // Call after buildSolar(date).
  function setDateTexts(date) {
    const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const parts = distanceParts(3), distance = parts.join(' ');
    sunText = 'The Sun, about 26,700 light-years from the centre of the Milky Way.';
    earthText = `You are here: the Earth, ${distance}, with the Sun and the planets where they are on ${day}.`;
    document.getElementById('earth-date').textContent = `The Earth, ${day}`;
    document.getElementById('earth-distance').replaceChildren(...spans(parts));
    const many = asteroids.drawn ? ` and ${asteroids.drawn.toLocaleString('en-GB')} asteroids` : '';
    noteText.textContent = `The planets${many} where they are on ${day}. Distances to scale; planets drawn larger. ` +
                       'Pick one, or the Sun, to see its distance.';
  }

  // Picks a body (or picks it again to let go): its marker shows its name and distance. The Earth always has
  // "You are here", so picking it just lets go of the others.
  function select(body) {
    selected = body === null || body === 3 || body === selected ? null : body;
    if (selected !== null) {
      const sun = selected === 0;
      const name = sun ? 'The Sun' : solar.bodies[selected].full || solar.bodies[selected].name;
      const parts = sun ? ['26,700 light-years from the centre of the Milky Way'] : distanceParts(selected);
      document.getElementById('body-name').textContent = name;
      document.getElementById('body-distance').replaceChildren(...spans(parts));
      bodyMarker.classList.toggle('is-sun', sun);
      bodyText = sun ? sunText.replace('about ', '') : `${name}, ${parts.join(' ').replace('About', 'about')}.`;
      bodyMarker.classList.toggle('is-webb', selected === WEBB);
    }
    for (const { el, body: b } of labelEls) el.setAttribute('aria-pressed', String(b === selected));
    redraw();
  }

  function setZoom(target) {
    zoom.target = Math.min(1, Math.max(0, target));
    if (reduced) zoom.z = zoom.target;
    zoomIn.setAttribute('aria-disabled', String(zoom.target >= 1));
    zoomOut.setAttribute('aria-disabled', String(zoom.target <= 0));
    redraw();
  }
  // At the Earth, once the tour has arrived (and not visiting it up close): zooming and picking work.
  const diving = () => visit.goal > 0 || visit.t > 0;
  const atGlobe = () => visit.goal > 0 && visit.t === EARTH_DIVE;
  const exploring = () => tourGoal > 0 && tourT >= AT_EARTH && !diving();

  // Flies on into the Earth, from any zoom; the images must have arrived.
  function visitEarth() {
    if (!exploring() || !globe.ready) return;
    select(null);
    setZoom(1);
    // Start over the visitor's time zone (15° of longitude an hour), 25° north.
    visit.lon = (-new Date().getTimezoneOffset() / 4) * RAD;
    visit.turn = visit.rate = 0;
    visit.goal = 1;
    loadJunk();
    junk.start = 0; // the objects start from their true places now
    back.focus({ preventScroll: true });
    if (reduced) { visit.t = EARTH_DIVE; draw(0); } else kick();
  }
  // Back out to the solar system at the Earth.
  function leaveEarth() {
    if (!visit.goal) return;
    visit.goal = 0;
    if (reduced) { visit.t = 0; draw(0); } else kick();
  }
  let globeText = '';
  // Under reduced motion nothing draws on its own, so changes draw once.
  const redraw = () => { if (reduced) draw(0); };

  // Shows what belongs to the current point of the tour.
  function showStage() {
    const atSun = tourGoal > 0 && tourT >= AT_SUN && tourT < LEAVE_SUN;
    const amongNear = tourGoal > 0 && near.stars && tourT >= LEAVE_SUN + NEAR * 0.4 && tourT < INTO_SUN + DIVE * 0.3;
    const atEarth = tourT >= AT_EARTH;
    const close = diving(), globeView = atGlobe();
    sunMarker.classList.toggle('is-shown', atSun);
    earthMarker.classList.toggle('is-shown', atEarth && !close);
    earthMarker.classList.toggle('is-compact', selected !== null); // just "You are here" while another is picked
    earthMarker.inert = !exploring();
    bodyMarker.classList.toggle('is-shown', atEarth && selected !== null);
    zoomBox.classList.toggle('is-shown', exploring());
    layersBox.classList.toggle('is-shown', globeView);
    layersBox.inert = !globeView;
    labels.inert = !exploring();
    note.classList.toggle('is-shown', amongNear || (tourGoal > 0 && tourT >= IN_SYSTEM));
    note.classList.toggle('is-near', tourT < IN_SYSTEM); // kept while it fades, so its words don't change
    note.classList.toggle('is-globe', close);
    note.classList.toggle('is-junk', close && layers.junk.on && junk.count > 0);
    if (globeView) layersBox.style.bottom = `${note.offsetHeight + 26}px`; // just above the note, however long
    globeCaption.classList.toggle('is-shown', globeView);
    if (exploring()) loadGlobe(); // the Earth's images, ready for a visit
    if (globeView) {
      const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (globeCaption.dataset.time !== time) {
        globeCaption.dataset.time = time;
        document.getElementById('globe-time').textContent = `Day and night as they are at ${time} your time`;
        globeText = `The Earth now, with day and night as they are at ${time} your time.`;
      }
    }
    // "You are here" replaces the Earth's name, and the picked body's marker its own.
    for (const { el, body } of labelEls) el.classList.toggle('is-hidden', atEarth && (body === 3 || body === selected));
    const text = globeView ? globeText : close ? '' :
                 atEarth ? (selected !== null ? bodyText : earthText) : atSun ? sunText : amongNear ? nearText : '';
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
    loadNear();
    loadAsteroids();
    measureBanner();
    zoom.z = 1;
    setZoom(1);
    orbit.angle = orbit.rate = 0;
    visit.t = visit.goal = 0;
    tourGoal = AT_EARTH;
    document.body.classList.add('touring');
    head.inert = true;
    quote.inert = true;
    back.focus({ preventScroll: true });
    kick();
  }
  function goBack() {
    if (!tourGoal) return;
    // From the Earth up close, one step: back out to the solar system.
    if (diving()) { leaveEarth(); return; }
    tourGoal = 0;
    select(null);
    backRate = Math.max(1, tourT / FLY);
    kick();
  }
  // Starts the frame loop if it is idle. Under reduced motion each step cuts instead: to the Sun, a pause, to
  // the nearest stars (when they have loaded), another, then to the Earth; and straight home.
  let cutTimer = null;
  function kick() {
    if (reduced) {
      clearTimeout(cutTimer);
      tourT = tourGoal ? AT_SUN : 0;
      draw(0);
      const cut = (to, wait, then) => { cutTimer = setTimeout(() => { tourT = to; draw(0); if (then) then(); }, wait); };
      const toEarth = () => cut(AT_EARTH, 4000);
      if (tourGoal) cut(INTO_SUN - 0.25, 3000, () => { if (!near.stars) { tourT = AT_EARTH; draw(0); } else toEarth(); });
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
    if (!tourGoal || e.target.closest('a, button')) return;
    // Out in the galaxy and among the nearest stars, a click anywhere goes back. In the solar system only "← Back" and Esc do.
    if (tourT < INTO_SUN) { goBack(); return; }
    if (!exploring()) return;
    // A click on or near the Sun or a planet picks it; anywhere else does nothing.
    let best = null, bestGap = 24;
    bodyXY.forEach((xy, i) => {
      const gap = xy ? Math.hypot(xy[0] - e.clientX, xy[1] - e.clientY) - (i === 0 ? 10 : 0) : Infinity;
      if (gap < bestGap) { best = i; bestGap = gap; }
    });
    if (best === 3 && globe.ready) visitEarth();
    else if (best !== null) select(best);
  });
  earthDive.addEventListener('click', visitEarth);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') goBack();
    else if (exploring() && (e.key === '+' || e.key === '=')) setZoom(zoom.target + ZOOM_STEP);
    else if (exploring() && (e.key === '-' || e.key === '_')) setZoom(zoom.target - ZOOM_STEP);
  });
  zoomIn.addEventListener('click', () => setZoom(zoom.target + ZOOM_STEP));
  zoomOut.addEventListener('click', () => setZoom(zoom.target - ZOOM_STEP));
  // The wheel (and a trackpad pinch, which arrives as a wheel with ctrlKey) zooms instead of zooming the page.
  window.addEventListener('wheel', (e) => {
    if (!exploring()) return;
    e.preventDefault();
    const step = e.deltaMode === 1 ? 0.04 : e.deltaMode === 2 ? 0.5 : 0.0015;
    setZoom(zoom.target - e.deltaY * step * (e.ctrlKey ? 4 : 1));
  }, { passive: false });
  // A two-finger pinch zooms so the view follows the fingers' spread.
  const touches = new Map();
  let pinch = null;
  const spread = () => { const [a, b] = [...touches.values()]; return Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])); };
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    pinch = touches.size === 2 && exploring() ? { from: spread(), z: zoom.target } : null;
  });
  window.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch) setZoom(pinch.z + Math.log(spread() / pinch.from) / ZOOM_RANGE);
  });
  const untouch = (e) => { touches.delete(e.pointerId); pinch = null; };
  window.addEventListener('pointerup', untouch);
  window.addEventListener('pointercancel', untouch);

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
    stepLayers(dt);
    const angle = t * SPIN;
    const s = ease(part(tourT, 0, FLY));
    const nearP = part(tourT, LEAVE_SUN, NEAR);
    const d = ease(part(tourT, INTO_SUN, DIVE));
    // The galaxy fades as the camera reaches the nearest stars (its made-up stars would mix with the real ones),
    // and they fade as it dives into the Sun. Without them, the galaxy stays until the dive.
    const intoSun = 1 - ease(part(d, 0.35, 0.55));
    const galaxyFade = near.stars ? 1 - ease(part(nearP, 0.25, 0.35)) : intoSun;
    const nearFade = ease(part(nearP, 0.3, 0.3)) * intoSun;
    const solarFade = ease(part(d, 0.55, 0.45));
    let solarDim = 1;
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (galaxyFade > 0 || nearFade > 0) {
      const cam = galaxyCamera(s, nearP, d, angle);
      if (galaxyFade > 0) {
        useGalaxy();
        gl.uniform1f(uAngle, angle);
        gl.uniform3f(uCam, cam.eye[0], cam.eye[1], cam.eye[2]);
        gl.uniformMatrix3fv(uView, false, viewMatrix(cam));
        gl.uniform1f(uGain, (1.7 - 0.5 * s) * galaxyFade);
        gl.drawArrays(gl.POINTS, 0, n);
      }
      // Keep the Sun's marker on the Sun.
      const xy = tourT > 0 && project(cam.sun, cam);
      if (xy) place(sunMarker, xy);
      drawNear(cam, angle, nearFade, tourGoal > 0 && nearP > 0.5 && d < 0.15);
    } else nearLabels.classList.remove('is-shown');

    if (solarFade > 0 && solar.date) {
      if (!reduced) zoom.z += (zoom.target - zoom.z) * (1 - Math.exp(-dt * 8));
      // The tour's zoom, scaled by the visitor's, so going back starts from wherever they zoomed to.
      if (!reduced) {
        orbit.rate += ((exploring() ? ORBIT_SPEED : 0) - orbit.rate) * (1 - Math.exp(-dt * 0.5));
        orbit.angle += orbit.rate * dt;
      }
      let cam = solarCamera(ease(part(tourT, IN_SYSTEM, ZOOM)) * zoom.z, solarFade, orbit.angle);
      // Visiting the Earth: on from there into the globe.
      if (!reduced && visit.t !== visit.goal * EARTH_DIVE) {
        visit.t = visit.goal ? Math.min(EARTH_DIVE, visit.t + dt) : Math.max(0, visit.t - dt);
      }
      const p = ease(visit.t / EARTH_DIVE), now = new Date();
      const axes = p > 0 ? earthAxes(now) : null;
      if (p > 0) {
        if (!reduced) {
          visit.rate += ((atGlobe() ? GLOBE_SPEED : 0) - visit.rate) * (1 - Math.exp(-dt * 0.5));
          visit.turn += visit.rate * dt;
        }
        cam = diveCamera(cam, p, axes);
      }
      const view = viewMatrix(cam);
      solarDim = 1 - part(p, 0.25, 0.35); // the planets and orbits fade as the Earth grows
      drawSky(cam, view, solarFade, t);
      bodyXY = [];
      if (solarDim > 0) {
        // Orbits, then the Sun and planets on top.
        useSolar();
        gl.uniform3f(sCam, cam.eye[0], cam.eye[1], cam.eye[2]);
        gl.uniformMatrix3fv(sView, false, view);
        gl.uniform2f(sProj, proj.fx, proj.fy);
        gl.uniform1f(sDpr, proj.dpr);
        gl.uniform1f(sFade, solarFade * solarDim);
        gl.uniform1f(sFlat, 1);
        const bodies = 1 + PLANETS.length;
        for (let i = 0; i < PLANETS.length; i++) gl.drawArrays(gl.LINE_LOOP, bodies + i * ORBIT_STEPS, ORBIT_STEPS);
        gl.uniform1f(sFlat, 0);
        gl.drawArrays(gl.POINTS, 0, bodies);
        drawAsteroids(cam, solarFade * solarDim);
        const webbShown = drawWebb(cam);
        bodyXY = solar.bodies.map((b) => project(b.pos, cam));
        if (!webbShown) bodyXY[WEBB] = null;
        if (bodyXY[3]) { place(earthMarker, bodyXY[3]); fitLabel(earthMarker, bodyXY[3]); }
        if (selected !== null) placeBodyMarker(bodyXY[selected]);
        placeLabels();
      }
      // The Earth and the Moon up close, over the Earth's dot.
      if (p > 0 && globe.ready) placeMoonMarker(drawGlobe(cam, view, axes, part(p, 0, 0.12), now), cam);
      else moonMarker.classList.remove('is-shown');
      // Rockets lifting off, fading out as the camera leaves the Earth.
      if (p > 0 && globe.ready && !reduced) drawRockets(cam, view, axes, t, part(p, 0.85, 0.15));
      else if (rockets.list.length || rockets.named || launchSite.classList.contains('is-shown')) clearRockets(t);
      // The ISS on its orbit (standing still under reduced motion).
      if (p > 0 && globe.ready) drawJunk(cam, view, t, part(p, 0.85, 0.15) * layers.junk.shown);
      if (p > 0 && globe.ready) drawIss(cam, view, t, part(p, 0.85, 0.15));
      else issMarker.classList.remove('is-shown');
    }
    // Out of the solar system: no comet, and the first one comes a few seconds after arriving again.
    if (solarFade === 0) { sky.comet = null; sky.next = t + 2 + Math.random() * 3; }
    labels.style.opacity = (solarFade * solarDim).toFixed(3);
    if (solarFade === 0) [moonMarker, launchSite, issMarker].forEach((m) => m.classList.remove('is-shown'));
    frame = reduced ? null : requestAnimationFrame(draw);
  }

  // The camera's axes as the shader's uView (column-major: its rows are right, up, back).
  const viewMatrix = ({ right: R, up: U, back: B }) => [R[0], U[0], B[0], R[1], U[1], B[1], R[2], U[2], B[2]];

  // Names beside the Sun and planets, the Sun's first, then from the outside in. A name is left out when its
  // body is off screen, close to a body already named, or its text would touch another name or named body
  // (so the inner planets get theirs as the camera comes near).
  function placeLabels() {
    // The markers' labels come first: names keep clear of them.
    const dots = [], boxes = [earthMarker, bodyMarker].filter((m) => m.classList.contains('is-shown')).map((m) => {
      const r = m.querySelector('.marker-label').getBoundingClientRect();
      return [r.left, r.top, r.right, r.bottom];
    });
    const fits = (xy, box) => box[2] < innerWidth - 4 &&
      dots.every((p) => Math.hypot(p[0] - xy[0], p[1] - xy[1]) > 16 &&
        !(p[0] > box[0] - 6 && p[0] < box[2] + 6 && p[1] > box[1] - 6 && p[1] < box[3] + 6)) &&
      boxes.every((o) => box[0] > o[2] + 4 || box[2] < o[0] - 4 || box[1] > o[3] || box[3] < o[1]);
    // labelEls: the Sun, the planets from Neptune in, then Webb, whose name may go on its dot's left (it sits just
    // by the Earth, whose marker's label is on the right), then Ceres, Pallas and Vesta.
    for (const k of [8, 7, 6, 5, 4, 3, 2, 1, 0, 9, 10, 11, 12]) {
      const { el, body } = labelEls[k];
      const xy = bodyXY[body];
      let clear = xy && xy[0] > -20 && xy[0] < innerWidth && xy[1] > 0 && xy[1] < innerHeight, left = false, up = false;
      if (clear) {
        const gap = parseFloat(getComputedStyle(el).marginLeft), w = el.offsetWidth, h = el.offsetHeight;
        let box = [xy[0] + gap, xy[1] - h / 2, xy[0] + gap + w, xy[1] + h / 2];
        clear = fits(xy, box);
        // Webb's other places: on the left, then on the left and raised half its height (on phones the Earth's
        // label is under its ring, where Webb often is).
        for (const raise of body === WEBB && !clear ? [0, h / 2 + 2] : []) {
          box = [xy[0] - gap - w, xy[1] - h / 2 - raise, xy[0] - gap, xy[1] + h / 2 - raise];
          if (box[0] > 4 && fits(xy, box)) { clear = left = true; up = raise > 0; break; }
        }
        if (clear) { dots.push(xy); boxes.push(box); place(el, xy); }
      }
      el.classList.toggle('is-off', !clear);
      el.classList.toggle('is-left', left);
      el.classList.toggle('is-up', up);
    }
  }

  // Keeps a marker's label on screen as the camera circles: on wide screens it goes to the left of the ring near
  // the right edge; on phones, where it is centred under the ring, it slides sideways (--nudge).
  function fitLabel(marker, xy) {
    const label = marker.querySelector('.marker-label');
    if (innerWidth > 600) {
      marker.classList.toggle('is-left', xy[0] + label.offsetWidth + 50 > innerWidth);
      return;
    }
    marker.style.setProperty('--nudge', '0px');
    const r = label.getBoundingClientRect();
    const nudge = Math.max(0, 8 - r.left) - Math.max(0, r.right - (innerWidth - 8));
    marker.style.setProperty('--nudge', nudge.toFixed(1) + 'px');
  }

  // The picked body's marker; off screen it hides. Its label goes to the left of the ring near the right edge,
  // and to the other side (above the ring on phones) when it would cover "You are here".
  function placeBodyMarker(xy) {
    const on = xy && xy[0] > 0 && xy[0] < innerWidth && xy[1] > 0 && xy[1] < innerHeight;
    bodyMarker.classList.toggle('is-off', !on);
    if (!on) return;
    place(bodyMarker, xy);
    const label = bodyMarker.querySelector('.marker-label');
    bodyMarker.classList.remove('is-flip');
    fitLabel(bodyMarker, xy);
    if (!earthMarker.classList.contains('is-shown')) return;
    const a = label.getBoundingClientRect(), b = earthMarker.querySelector('.marker-label').getBoundingClientRect();
    if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) bodyMarker.classList.add('is-flip');
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
