/**
 * The lobby vehicle scene (owner, 2026-11-16): one 3D vehicle (helicopter, plane or rocket, lobby-models.js) carrying the players'
 * balls in their colours, with a glowing sun, drawn full screen on a transparent canvas over the planet sky of the main menu
 * (src/render/planet-scene.js, shown by the UI's planet stage). Clean cel shading with ink outlines. Presentation only: it never reads
 * or changes room state. The UI places each name tag from `anchors`, reported once per frame: every occupied seat's screen position,
 * and the point under the vehicle's belly below it.
 *
 * `setInsets` keeps the vehicle centred in the space the lobby's panels leave free. Live settings come from `display.lobby`
 * (src/shared/display.js): zoom, sway, bob and spinSeconds. Reduced motion draws still frames.
 */
import { makeLobbyVehicle, BALL_RADIUS } from './lobby-models.js';
import { createInkMaterial, createInkUniforms, sizeInk, smoothHullGeometry } from './outline.js';

const defaultRenderer = (THREE, canvas) => new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const FOV = 30;
/**
 * The vehicle's heading (radians about y), before the sway: nose to the left, turned 0.24 toward the viewer. Gaia's horizon turns
 * left to right behind the lobby, so a nose pointing left flies forward over it (owner, 2026-11-17: pointing right it flew backwards).
 */
const TURN = Math.PI + 0.24;
const CENTRE_PULL = 0.55; // 1 centres the vehicle in the free area between the panels, 0 on the screen

/**
 * @param {object} options
 * @param {object} options.THREE
 * @param {HTMLCanvasElement} options.canvas
 * @param {{lobby: object}} options.display live settings
 * @param {'helicopter'|'plane'|'rocket'} options.vehicle
 * @param {boolean} [options.reducedMotion]
 * @param {Window} [options.win]
 * @param {Function} [options.createWebGLRenderer] renderer seam (tests)
 */
export function createLobbyScene({ THREE, canvas, display, vehicle = 'plane', reducedMotion = false, win = canvas.ownerDocument.defaultView, createWebGLRenderer = defaultRenderer }) {
  let renderer = null;
  try { renderer = createWebGLRenderer(THREE, canvas); } catch { renderer = null; }
  if (!renderer) return { setVehicle() {}, setSun() {}, setPassengers() {}, setInsets() {}, onAnchors() {}, start() {}, dispose() {}, stats: { webgl: false } };
  renderer.setClearColor?.(0x000000, 0);
  const owned = new Set(), own = r => { owned.add(r); return r; };
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(FOV, 2, 0.1, 400);
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const light = new THREE.DirectionalLight(0xffffff, 2.6);
  light.position.set(5, 9, 7);
  scene.add(camera, light);

  // Clean cel shading: three flat bands from a tiny gradient map, no halftone. The ink hulls draw the outlines.
  const bands = own(new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat));
  Object.assign(bands, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, needsUpdate: true });
  const toon = (color, extra = {}) => own(new THREE.MeshToonMaterial({ color, gradientMap: bands, ...extra }));
  const painted = toon(0xffffff, { vertexColors: true });
  const glassMaterial = toon(0xd4f1ff, { transparent: true, opacity: 0.28, depthWrite: false });
  const inkUniforms = createInkUniforms(THREE);
  const inkMaterial = own(createInkMaterial(THREE, inkUniforms));
  const ink = mesh => { mesh.add(new THREE.Mesh(own(smoothHullGeometry(THREE, mesh.geometry)), inkMaterial)); return mesh; };

  // ---- The sun (owner, 2026-11-17: smaller and cartoonish, dimpled like a golf ball): a warm yellow ball in flat toon bands, lit
  // from the top left, covered in dimples that each catch a little shade on the lit side and light on the other, with an ink outline
  // and two flat halo rings behind it. Unlit by the scene: it is the light. Fixed to the camera at the top right of the free area.
  const sun = new THREE.Group();
  const DIMPLES = 150;
  const dimplePoints = Array.from({ length: DIMPLES }, (_, i) => { // an even Fibonacci spread over the ball
    const y = 1 - 2 * (i + 0.5) / DIMPLES, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  });
  const photosphere = ink(new THREE.Mesh(own(new THREE.SphereGeometry(1.6, 64, 48)), own(new THREE.ShaderMaterial({
    uniforms: { pts: { value: dimplePoints }, light: { value: new THREE.Vector3(-0.55, 0.6, 0.58).normalize() } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 pts[${DIMPLES}]; uniform vec3 light; varying vec3 vN;
      void main(){
        vec3 n = normalize(vN), c = pts[0];
        float best = 10.0;
        for (int i = 0; i < ${DIMPLES}; i++) { float d = distance(n, pts[i]); if (d < best) { best = d; c = pts[i]; } }
        float R = 0.135, k = 1.0 - smoothstep(R * 0.8, R, best);
        // Inside a dimple the surface bowls in: its normal leans toward the dimple's centre.
        vec3 o = n - c;
        vec3 m = normalize(n - o * 3.2 * k);
        float lam = dot(m, light);
        vec3 col = lam > 0.45 ? vec3(1.0, 0.85, 0.27) : lam > -0.05 ? vec3(1.0, 0.74, 0.2) : vec3(0.98, 0.6, 0.16);
        if (k < 0.5 && dot(n, normalize(light + vec3(0.0, 0.0, 0.6))) > 0.94) col = vec3(1.0, 0.94, 0.6);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }))));
  const halo = (radius, opacity) => {
    const mesh = new THREE.Mesh(own(new THREE.CircleGeometry(radius, 64)), own(new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity, depthWrite: false })));
    return mesh;
  };
  const glow = new THREE.Group();
  const ring = halo(2.25, 1); // opaque, so the sky's blue never muddies it (owner, 2026-11-17: less khaki)
  ring.material.color.set(0xffeb8a);
  ring.material.transparent = false;
  // Slight rays (owner, 2026-11-17): twelve slim rounded spikes, mostly see-through, slowly turning, long and short in turn.
  const rays = new THREE.Group();
  // Solid sunny yellow at the base, fading to clear at the tip: colourful by the sun, see-through beyond it, on sky or space alike.
  const rayMaterial = own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying float h; void main(){ h = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float h; void main(){ gl_FragColor = vec4(1.0, 0.78, 0.12, 0.95 * (1.0 - smoothstep(2.5, 3.9, h))); }',
  }));
  for (let k = 0; k < 12; k++) {
    const long = k % 2 === 0, shape = new THREE.Shape();
    const w = long ? 0.26 : 0.2, from = 2.45, to = long ? 3.9 : 3.3;
    shape.moveTo(-w, from);
    shape.quadraticCurveTo(-w * 0.5, (from + to) / 2, 0, to);
    shape.quadraticCurveTo(w * 0.5, (from + to) / 2, w, from);
    shape.lineTo(-w, from);
    const ray = new THREE.Mesh(own(new THREE.ShapeGeometry(shape, 8)), rayMaterial);
    ray.rotation.z = k / 12 * Math.PI * 2;
    rays.add(ray);
  }
  glow.add(rays, ring);
  sun.add(glow, photosphere);
  camera.add(sun);

  const rig = new THREE.Group(); // sways and bobs
  scene.add(rig);

  // ---- Flying (owner, 2026-11-17: the vehicles should look like they are really flying): the air streams past from nose to tail.
  // Slim wind streaks rush by around the vehicle (pale blue starlight streaks in space), and over Gaia a few puffy toon clouds drift
  // past below and behind it. The vehicles face left, so the air moves to the right. Still with reduced motion.
  const flight = new THREE.Group();
  scene.add(flight);
  const SPAN = 30; // streaks and clouds wrap across this width (scene units) around the vehicle
  const seeded = k => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const streakMaterial = own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
  const streakGeometry = own(new THREE.CapsuleGeometry(0.025, 2.0, 2, 6).rotateZ(Math.PI / 2));
  const streaks = Array.from({ length: 12 }, (_, k) => {
    const mesh = new THREE.Mesh(streakGeometry, streakMaterial);
    mesh.userData = { x0: seeded(k) * SPAN, y: (seeded(k + 40) - 0.5) * 7, z: -1 - seeded(k + 80) * 7, speed: 22 + seeded(k + 120) * 14, length: 0.6 + seeded(k + 160) * 0.9 };
    mesh.scale.x = mesh.userData.length;
    flight.add(mesh);
    return mesh;
  });
  const cloudMaterial = toon(0xffffff);
  const puff = (k) => {
    const parts = [[0, 0, 0, 1.3], [1.3, -0.2, 0.1, 1.0], [-1.25, -0.25, 0, 0.95], [0.5, 0.65, -0.1, 0.9], [-0.55, 0.5, 0.15, 0.8]];
    const group = new THREE.Group();
    for (const [x, y, z, r] of parts) {
      const geometry = own(new THREE.SphereGeometry(r, 18, 12));
      group.add(ink(new THREE.Mesh(geometry, cloudMaterial)));
      group.children[group.children.length - 1].position.set(x, y, z);
    }
    group.scale.set(0.75, 0.5, 0.6);
    group.userData = { x0: seeded(k + 200) * SPAN, y: -5.5 - seeded(k + 240) * 2, z: -12 - seeded(k + 280) * 10, speed: 3 + seeded(k + 320) * 2 };
    return group;
  };
  const clouds = Array.from({ length: 4 }, (_, k) => puff(k));
  for (const c of clouds) flight.add(c);
  const wrap = (x0, speed, t) => ((x0 + speed * t) % SPAN + SPAN) % SPAN - SPAN / 2;
  const ballGeometry = own(new THREE.SphereGeometry(BALL_RADIUS, 32, 22));
  const ballHull = own(smoothHullGeometry(THREE, ballGeometry));
  let model = null, built = null, balls = [], spinners = [], trails = [], flame = null, colors = [];
  // Wind trails (owner, 2026-11-17: smoother, like real wind, very faint): a soft ribbon from each engine, tip and fin that streams back
  // and curls on a slow travelling wave, widening and fading as it goes, with gusts of brighter air running down it. Two crossed strips,
  // so it reads from any angle. The shape is built once (1 long, trailing back from 0); each trail bends it in the vertex shader.
  const TRAIL_STEPS = 48;
  const trailGeometry = own((() => {
    const g = new THREE.BufferGeometry(), rib = [], cross = [], index = [];
    for (let plane = 0; plane < 2; plane++) {
      const base = rib.length / 2;
      for (let i = 0; i <= TRAIL_STEPS; i++) for (const side of [-1, 1]) { rib.push(i / TRAIL_STEPS, side); cross.push(plane); }
      for (let i = 0; i < TRAIL_STEPS; i++) { const a = base + i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(rib.length / 2 * 3), 3));
    g.setAttribute('rib', new THREE.Float32BufferAttribute(rib, 2));
    g.setAttribute('cross', new THREE.Float32BufferAttribute(cross, 1));
    g.setIndex(index);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4); // bent in the shader: never culled
    return g;
  })());
  const TRAIL_VERTEX = `attribute vec2 rib; attribute float cross; uniform float time, len, width, amp, phase, speed; varying vec2 vRib;
    void main() {
      float u = rib.x, a = amp * u * u, w = width * (0.4 + u * 1.6);
      vec3 p = vec3(-u * len, 0.0, 0.0);
      p.y += a * (sin(u * 5.5 - time * speed * 1.3 + phase) * 0.7 + sin(u * 11.0 - time * speed * 2.1 + phase * 1.7) * 0.3);
      p.z += a * 0.8 * cos(u * 4.3 - time * speed + phase * 1.3);
      if (cross < 0.5) p.y += rib.y * w; else p.z += rib.y * w;
      vRib = rib;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const TRAIL_FRAGMENT = `uniform vec3 color; uniform float time, phase, speed, opacity; varying vec2 vRib;
    void main() {
      float u = vRib.x, edge = 1.0 - vRib.y * vRib.y;
      float gust = 0.55 + 0.45 * sin(u * 9.0 - time * speed * 3.0 + phase);
      float a = opacity * edge * smoothstep(0.0, 0.08, u) * pow(1.0 - u, 1.5) * gust;
      if (a < 0.003) discard;
      gl_FragColor = vec4(color, a);
    }`;
  const TRAIL_LOOK = { helicopter: { width: 0.05, amp: 0.55, speed: 1.6, opacity: 0.38 }, plane: { width: 0.08, amp: 0.7, speed: 2.0, opacity: 0.34 }, rocket: { width: 0.1, amp: 0.6, speed: 2.6, opacity: 0.34 } };
  let vehicleOwned = new Set();
  const mine = r => { vehicleOwned.add(r); return r; };
  // Switching vehicles (owner, 2026-11-17: a smoother switch): the old one speeds away ahead (off to the left, nose first) while the new
  // one glides in from behind and settles, and the framing eases between their sizes. `holder` carries that slide; `leaving` is the old
  // vehicle on its way out, disposed once it is gone.
  const SWAP = { out: 0.9, in: 1.3, gap: 0.25, reach: 46 };
  let holder = null, leaving = null, arriveAt = -1, frameHalf = null, lastNow = null;
  const easeIn = x => x * x * x, easeOut = x => 1 - Math.pow(1 - x, 3);
  const disposeLeaving = () => {
    if (!leaving) return;
    rig.remove(leaving.holder);
    for (const b of leaving.balls) b.material.dispose();
    for (const r of leaving.owned) r.dispose();
    leaving = null;
  };
  const stats = { webgl: true, vehicle: null, passengers: 0, frames: 0, swapping: false };

  const clear = () => {
    if (!built) return;
    rig.remove(holder);
    for (const b of balls) b.material.dispose();
    for (const r of vehicleOwned) r.dispose();
    vehicleOwned.clear();
    built = null; holder = null; balls = []; spinners = []; trails = []; flame = null;
  };
  const buildBalls = () => {
    for (const b of balls) { built.remove(b); b.material.dispose(); }
    balls = model.seats.map((seat, i) => {
      if (colors[i] == null) return null;
      const mesh = new THREE.Mesh(ballGeometry, toonBall(colors[i]));
      mesh.add(new THREE.Mesh(ballHull, inkMaterial));
      mesh.position.copy(seat);
      mesh.userData.seat = i;
      built.add(mesh);
      return mesh;
    }).filter(Boolean);
    stats.passengers = balls.length;
  };
  const toonBall = color => new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: bands });
  const inkMine = mesh => { mesh.add(new THREE.Mesh(mine(smoothHullGeometry(THREE, mesh.geometry)), inkMaterial)); return mesh; };
  const build = (kind, glide = false) => {
    if (glide && built) {
      disposeLeaving(); // a third switch mid-swap: the one already leaving just goes
      leaving = { holder, owned: vehicleOwned, balls, start: null };
      vehicleOwned = new Set();
      built = null; holder = null; balls = []; spinners = []; trails = []; flame = null;
      arriveAt = null; // set on the next frame, from its clock
    } else { clear(); arriveAt = -1; }
    model = makeLobbyVehicle(THREE, kind);
    built = new THREE.Group();
    built.rotation.z = model.tilt ?? 0;
    built.add(inkMine(new THREE.Mesh(mine(model.body), painted)));
    if (model.inner) built.add(new THREE.Mesh(mine(model.inner), painted)); // the cabin seen through an opening: no ink inside
    spinners = model.spinners.map(s => {
      const mesh = inkMine(new THREE.Mesh(mine(s.geometry), painted));
      mesh.position.copy(s.position);
      mesh.userData.spin = s;
      built.add(mesh);
      return mesh;
    });
    if (model.flame) {
      flame = new THREE.Mesh(mine(model.flame), mine(new THREE.MeshBasicMaterial({ vertexColors: true })));
      flame.position.copy(model.flameAt);
      built.add(flame);
    }
    // Centre the vehicle on its real extent (rotor tips and tail included), so nothing hangs out of the frame.
    const box = new THREE.Box3().setFromObject(built), centre = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    built.position.set(-centre.x, -centre.y, -centre.z);
    const room = model.room ?? 1;
    model.half = { x: (size.x * 0.5 + size.z * 0.12) * room, y: (size.y * 0.5 + size.z * 0.1) * room };
    const glass = new THREE.Mesh(mine(model.glass), glassMaterial); // after the box: glass never sets the frame
    glass.renderOrder = 2;
    built.add(glass); // no ink hull: through clear glass it would read as a dark tint
    // Trails (owner, 2026-11-17): from each engine, exhaust and tip a few thin dashes stream back toward the tail, stretching and
    // fading as they go, so the air visibly pours off the vehicle. In its own frame, so they follow its gentle motion.
    const look = TRAIL_LOOK[kind] ?? TRAIL_LOOK.plane;
    trails = (model.trails ?? []).map(([x, y, z, length], k) => {
      const material = mine(new THREE.ShaderMaterial({
        vertexShader: TRAIL_VERTEX, fragmentShader: TRAIL_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { color: { value: new THREE.Color(kind === 'rocket' ? 0xfff1c9 : 0xffffff) }, time: { value: 0 }, len: { value: length * 1.6 },
          width: { value: look.width }, amp: { value: look.amp * (0.8 + seeded(k + 520) * 0.4) }, phase: { value: seeded(k + 500) * 6.28 },
          speed: { value: look.speed * (0.85 + seeded(k + 540) * 0.3) }, opacity: { value: look.opacity } },
      }));
      const ribbon = new THREE.Mesh(trailGeometry, material);
      ribbon.position.set(x, y, z);
      ribbon.frustumCulled = false;
      ribbon.renderOrder = 1;
      built.add(ribbon);
      return ribbon;
    });
    holder = new THREE.Group();
    holder.add(built);
    holder.visible = arriveAt !== null; // a gliding arrival shows once its slide begins
    rig.add(holder);
    stats.vehicle = kind;
    const space = kind === 'rocket';
    for (const c of clouds) c.visible = !space; // clouds over Gaia only
    streakMaterial.color.set(space ? 0xbfe3ff : 0xffffff);
    buildBalls();
  };
  build(vehicle);

  let anchorListener = null;
  let sunWanted = true, sunLevel = 1; // the corner sun, shrunk away when the sky behind already has one
  const v = new THREE.Vector3();
  let width = 0, height = 0;
  const insets = { left: 0, right: 0, top: 0, bottom: 0 };
  const resize = () => {
    const w = canvas.clientWidth || canvas.width || 600, h = canvas.clientHeight || canvas.height || 300;
    if (w === width && h === height) return;
    width = w; height = h;
    const ratio = Math.min(win?.devicePixelRatio || 1, 2);
    renderer.setPixelRatio?.(ratio);
    renderer.setSize(w, h, false);
    sizeInk(inkUniforms, w * ratio, h * ratio);
    inkUniforms.ink.value = Math.max(2, Math.min(w, 1600) * ratio * 3.2 / 1280);
    camera.aspect = w / h;
  };
  const toScreen = p => { p.project(camera); return { x: (p.x + 1) / 2 * width, y: (1 - p.y) / 2 * height }; };
  const frame = time => {
    resize();
    const l = display.lobby, t = reducedMotion ? 0 : time / 1000, now = time / 1000;
    const dt = lastNow === null ? 0 : Math.min(0.1, Math.max(0, now - lastNow));
    lastNow = now;
    // The swap: the old vehicle speeds off ahead, the new one glides in from behind once it has started to go.
    if (leaving) {
      if (leaving.start === null) leaving.start = now;
      const p = (now - leaving.start) / SWAP.out;
      leaving.holder.position.x = easeIn(Math.min(1, p)) * SWAP.reach;
      if (p >= 1) disposeLeaving();
    }
    if (arriveAt === null) arriveAt = now + SWAP.gap;
    if (holder && arriveAt > 0) {
      const p = (now - arriveAt) / SWAP.in;
      holder.visible = p >= 0;
      holder.position.x = -(1 - easeOut(Math.max(0, Math.min(1, p)))) * SWAP.reach;
      if (p >= 1) { holder.position.x = 0; arriveAt = -1; }
    }
    stats.swapping = !!leaving || arriveAt !== -1;
    // The framing eases to the new vehicle's size rather than jumping.
    if (!frameHalf) frameHalf = { ...model.half };
    const ease = Math.min(1, dt * 2.2);
    frameHalf.x += (model.half.x - frameHalf.x) * ease; frameHalf.y += (model.half.y - frameHalf.y) * ease;
    // Fit the vehicle into the free area between the panels, then shift the view so it is centred there.
    const freeW = Math.max(120, width - insets.left - insets.right), freeH = Math.max(120, height - insets.top - insets.bottom);
    const tan = Math.tan((FOV * Math.PI / 180) / 2);
    // At distance d the view is 2·d·tan tall and 2·d·tan·aspect wide; the free area is that much of it.
    const dist = Math.max(frameHalf.x / (tan * freeW / height), frameHalf.y / (tan * freeH / height)) * 1.08 / l.zoom;
    // Centred between the panels, pulled part of the way toward the middle of the screen (owner, 2026-11-17: more centred).
    const offX = (insets.right - insets.left) / 2 * CENTRE_PULL, offY = (insets.bottom - insets.top) / 2 * CENTRE_PULL;
    camera.setViewOffset(width, height, offX, offY, width, height);
    camera.position.set(dist * 0.1, dist * 0.32, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    // The sun sits at the top right of the free area, far behind the vehicle.
    const sunZ = dist * 2.4, halfH = sunZ * tan, halfW = halfH * camera.aspect;
    // In the top-left corner of the free area (owner, 2026-11-17), ahead of the vehicle's nose, its rays clear of the edges.
    const corner = Math.max(56, Math.min(width, height) * 0.08);
    sun.position.set((-1 + 2 * (insets.left + corner + offX) / width) * halfW, (1 - 2 * (insets.top + corner + offY) / height) * halfH, -sunZ);
    sunLevel += ((sunWanted ? 1 : 0) - sunLevel) * (reducedMotion ? 1 : Math.min(1, dt * 3));
    sun.visible = sunLevel > 0.01;
    sun.scale.setScalar(sunZ / 90 * sunLevel); // small in the sky (owner, 2026-11-17)
    glow.position.copy(sun.position).normalize().multiplyScalar(1.8); // the halo sits behind the ball on the line of sight, centred on it
    glow.scale.setScalar(1 + Math.sin(t * 1.3) * 0.04); // the halo breathes
    rays.rotation.z = t * 0.12;
    const rush = stats.vehicle === 'rocket' ? 1.8 : stats.vehicle === 'helicopter' ? 0.7 : 1;
    for (const s of streaks) { const u = s.userData; s.position.set(wrap(u.x0, u.speed * rush, t), u.y, u.z); }
    for (const c of clouds) { const u = c.userData; c.position.set(wrap(u.x0, u.speed * rush, t), u.y, u.z); }
    // Calm flight (owner, 2026-11-17: less shake): one slow swell up and down with the nose easing down as it sinks, a slow sway,
    // and over that a very slight breeze, a few small unrelated slow waves, so the motion never repeats mechanically.
    const breeze = (a, b, c) => Math.sin(t * a) * 0.5 + Math.sin(t * b + 1.3) * 0.3 + Math.sin(t * c + 2.1) * 0.2;
    const swell = Math.sin(t * 0.9);
    rig.rotation.y = TURN + (Math.sin(t * 0.35) + breeze(0.53, 0.89, 1.37) * 0.25) * l.sway * Math.PI / 180;
    rig.position.y = (swell + breeze(0.71, 1.13, 1.61) * 0.2) * l.bob;
    rig.rotation.z = Math.cos(t * 0.9) * l.bob * 0.25 + breeze(0.61, 0.97, 1.49) * 0.006; // nose follows the swell, a breath of roll
    rig.rotation.x = breeze(0.47, 0.83, 1.21) * 0.008;
    for (const d of trails) d.material.uniforms.time.value = t;
    for (const mesh of spinners) {
      const s = mesh.userData.spin;
      if (l.spinSeconds > 0 && !reducedMotion) mesh.rotation[s.axis] = (t / l.spinSeconds) * Math.PI * 2 * s.speed;
    }
    if (flame) flame.scale.set(reducedMotion ? 1 : 1 + Math.sin(t * 31) * 0.12 + Math.sin(t * 17) * 0.08, 1 + Math.sin(t * 23) * 0.06, 1 + Math.sin(t * 23) * 0.06);
    balls.forEach((b, k) => { b.position.y = model.seats[b.userData.seat].y + (reducedMotion ? 0 : (0.5 - 0.5 * Math.cos(t * 1.6 + k * 0.9)) * 0.03); });
    rig.updateMatrixWorld(true);
    renderer.render(scene, camera);
    stats.frames++;
    if (anchorListener) {
      const out = [];
      for (const b of balls) {
        const centre = toScreen(b.getWorldPosition(v));
        const top = toScreen(b.getWorldPosition(v).add(new THREE.Vector3(0, BALL_RADIUS, 0)));
        const below = toScreen(b.getWorldPosition(v).add(new THREE.Vector3(0, -model.drop, 0)));
        const above = toScreen(b.getWorldPosition(v).add(new THREE.Vector3(0, BALL_RADIUS + (model.rise ?? 0), 0)));
        out.push({ seat: b.userData.seat, x: centre.x, y: centre.y, r: Math.max(4, centre.y - top.y), below, above });
      }
      anchorListener(out, { width, height });
    }
  };

  let raf = 0, disposed = false;
  const loop = time => { if (disposed) return; frame(time); raf = win.requestAnimationFrame(loop); };
  return {
    stats,
    /** The WebGL context drawn with, so the lobby can keep its canvas and restore this context next visit (src/ui/lobby-canvas.js). */
    context: renderer.getContext?.() ?? null,
    setVehicle(kind) { if (kind !== stats.vehicle) build(kind, !reducedMotion && stats.frames > 0); },
    /** Shows or hides the corner sun (it shrinks away): off when the planet sky behind draws its own sun, as in Ares's air. */
    setSun(on) { sunWanted = !!on; },
    /** One colour (CSS hex) per seat, null for an empty seat. */
    setPassengers(list) { colors = [...list]; if (built) buildBalls(); },
    /** Pixels the lobby's panels cover on each side; the vehicle is framed in the rest. */
    setInsets(next) { for (const k of ['left', 'right', 'top', 'bottom']) insets[k] = Math.max(0, Number(next?.[k]) || 0); },
    onAnchors(fn) { anchorListener = fn; },
    start() { if (!raf && !disposed) raf = win.requestAnimationFrame(loop); },
    dispose() {
      disposed = true;
      if (raf) win.cancelAnimationFrame(raf);
      disposeLeaving();
      clear();
      for (const r of owned) r.dispose?.();
      renderer.dispose?.();
      if (!renderer.getContext?.()?.isContextLost?.()) renderer.forceContextLoss?.(); // release the context now: browsers cap live contexts and drop the oldest, which can be the game's; an evicted one is already gone
    },
  };
}
