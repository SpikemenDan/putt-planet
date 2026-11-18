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
import { makeLobbyVehicle, BALL_RADIUS, isRocket } from './lobby-models.js';
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
 * @param {'helicopter'|'plane'|'rocket'|'minirocket'} options.vehicle
 * @param {'gaia'|'luna'|'ares'} [options.destination] the planet the vehicle is flying at
 * @param {boolean} [options.air] in an atmosphere: wind lines and wakes show
 * @param {boolean} [options.reducedMotion]
 * @param {Window} [options.win]
 * @param {Function} [options.createWebGLRenderer] renderer seam (tests)
 */
export function createLobbyScene({ THREE, canvas, display, vehicle = 'plane', destination = 'gaia', air = destination !== 'luna', reducedMotion = false, win = canvas.ownerDocument.defaultView, createWebGLRenderer = defaultRenderer }) {
  let renderer = null;
  try { renderer = createWebGLRenderer(THREE, canvas); } catch { renderer = null; }
  if (!renderer) return { setVehicle() {}, setTrip() {}, setSkyProbe() {}, setAir() {}, setSun() {}, setPassengers() {}, setInsets() {}, onAnchors() {}, start() {}, dispose() {}, stats: { webgl: false } };
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

  // ---- Flying (owner, 2026-11-17: the vehicles should look like they are really flying; 2026-11-18: subtler, smoother, and only where
  // there is air). In an atmosphere (Gaia, or low in Ares's dusty air) a few faint, thin wind lines slide past from nose to tail, fading
  // in at their head and out along their tail and at the edges of the view, and over Gaia a few puffy toon clouds drift by below. In
  // space there is no wind at all: no lines, no clouds, no wakes. `airLevel` eases between the two. Still with reduced motion.
  const flight = new THREE.Group();
  scene.add(flight);
  const SPAN = 30; // streaks and clouds wrap across this width (scene units) around the vehicle
  const seeded = k => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const streakMaterial = own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { level: { value: 0 }, span: { value: SPAN / 2 } },
    vertexShader: 'varying float vU; varying float vX; void main(){ vU = position.x; vec4 w = modelMatrix * vec4(position, 1.0); vX = w.x; gl_Position = projectionMatrix * viewMatrix * w; }',
    // Faint at the head (+x, downwind), longest and softest at the tail, and gone near the wrap edges so none ever pops in.
    fragmentShader: `uniform float level, span; varying float vU, vX;
      void main(){
        float a = level * 0.16 * smoothstep(-1.02, 0.35, vU) * (1.0 - smoothstep(0.7, 1.02, vU)) * (1.0 - smoothstep(span * 0.55, span * 0.95, abs(vX)));
        if (a < 0.003) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
      }`,
  }));
  const streakGeometry = own(new THREE.CapsuleGeometry(0.014, 2.0, 2, 6).rotateZ(Math.PI / 2));
  const streaks = Array.from({ length: 10 }, (_, k) => {
    const mesh = new THREE.Mesh(streakGeometry, streakMaterial);
    mesh.userData = { x0: seeded(k) * SPAN, y: (seeded(k + 40) - 0.5) * 7, z: -1 - seeded(k + 80) * 7, speed: 13 + seeded(k + 120) * 8, length: 0.8 + seeded(k + 160) * 1.1, phase: seeded(k + 180) * 6.28 };
    mesh.scale.x = mesh.userData.length;
    flight.add(mesh);
    return mesh;
  });
  const cloudMaterial = toon(0xffffff);
  const CLOUD_SCALE = [0.75, 0.5, 0.6];
  const puff = (k) => {
    const parts = [[0, 0, 0, 1.3], [1.3, -0.2, 0.1, 1.0], [-1.25, -0.25, 0, 0.95], [0.5, 0.65, -0.1, 0.9], [-0.55, 0.5, 0.15, 0.8]];
    const group = new THREE.Group();
    for (const [x, y, z, r] of parts) {
      const geometry = own(new THREE.SphereGeometry(r, 18, 12));
      group.add(ink(new THREE.Mesh(geometry, cloudMaterial)));
      group.children[group.children.length - 1].position.set(x, y, z);
    }
    group.scale.set(...CLOUD_SCALE);
    group.userData = { x0: seeded(k + 200) * SPAN, y: -5.5 - seeded(k + 240) * 2, z: -12 - seeded(k + 280) * 10, speed: 3 + seeded(k + 320) * 2 };
    return group;
  };
  const clouds = Array.from({ length: 4 }, (_, k) => puff(k));
  for (const c of clouds) flight.add(c);
  const wrap = (x0, speed, t) => ((x0 + speed * t) % SPAN + SPAN) % SPAN - SPAN / 2;
  const ballGeometry = own(new THREE.SphereGeometry(BALL_RADIUS, 32, 22));
  const ballHull = own(smoothHullGeometry(THREE, ballGeometry));
  let colors = [];
  // Wakes (owner, 2026-11-17; 2026-11-18: subtler and smoother, like real air): a soft ribbon off each engine, wing, rotor tip, fin and
  // nozzle that streams back on a slow, gentle wave, widening and fading as it goes, with mild gusts running down it. Two crossed
  // strips, so it reads from any angle. Shown only in an atmosphere (`air`). Built once (1 long, trailing back from 0); each trail
  // bends it in the vertex shader.
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
      float u = rib.x, a = amp * u * u, w = width * (0.35 + u * 1.9);
      vec3 p = vec3(-u * len, 0.0, 0.0);
      p.y += a * (sin(u * 4.2 - time * speed + phase) * 0.8 + sin(u * 7.5 - time * speed * 1.4 + phase * 1.7) * 0.2);
      p.z += a * 0.6 * cos(u * 3.4 - time * speed * 0.8 + phase * 1.3);
      if (cross < 0.5) p.y += rib.y * w; else p.z += rib.y * w;
      vRib = rib;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const TRAIL_FRAGMENT = `uniform vec3 color; uniform float time, phase, speed, opacity, air; varying vec2 vRib;
    void main() {
      float u = vRib.x, edge = 1.0 - vRib.y * vRib.y;
      float gust = 0.78 + 0.22 * sin(u * 6.0 - time * speed * 2.0 + phase);
      float a = air * opacity * edge * edge * smoothstep(0.0, 0.12, u) * pow(1.0 - u, 1.8) * gust;
      if (a < 0.003) discard;
      gl_FragColor = vec4(color, a);
    }`;
  const TRAIL_LOOK = {
    helicopter: { width: 0.04, amp: 0.28, speed: 1.3, opacity: 0.2 },
    plane: { width: 0.06, amp: 0.32, speed: 1.5, opacity: 0.18 },
    rocket: { width: 0.08, amp: 0.3, speed: 2.0, opacity: 0.2 },
    minirocket: { width: 0.06, amp: 0.26, speed: 2.0, opacity: 0.2 },
  };
  // Switching vehicles without a trip (owner, 2026-11-17: a smoother switch): the old one speeds away ahead while the new one glides in
  // from behind and settles, and the framing eases between their sizes. `leaving` is the old craft on its way out, disposed once gone.
  const SWAP = { out: 0.9, in: 1.3, gap: 0.25, reach: 46 };
  // A trip to another planet (owner, 2026-11-18): the vehicle flies off screen (a plane or helicopter straight ahead, a rocket first
  // turning to point at its destination), a rocket launches from Gaia when the party leaves its air, and once the sky behind has flown
  // there the next vehicle glides in. Seconds.
  const TRIP = { exit: 1.15, rocketExit: 1.8, turn: 0.6, launch: 2.2, launchAt: 0.55, settle: 0.3, maxWait: 6.5 };
  const FALLBACK = { luna: { x: 0.8, y: 0.6 }, ares: { x: -0.8, y: 0.6 }, gaia: { x: 0.25, y: -1 } };
  let craft = null, leaving = null, trip = null, arriveAt = -1, frameHalf = null, lastNow = null;
  const easeIn = x => x * x * x, easeOut = x => 1 - Math.pow(1 - x, 3), easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const stats = { webgl: true, vehicle: null, passengers: 0, frames: 0, swapping: false, trip: null, air: 0 };

  const toonBall = color => new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: bands });
  const seatBalls = c => {
    for (const b of c.balls) { c.built.remove(b); b.material.dispose(); }
    c.balls = c.model.seats.map((seat, i) => {
      if (colors[i] == null) return null;
      const mesh = new THREE.Mesh(ballGeometry, toonBall(colors[i]));
      mesh.add(new THREE.Mesh(ballHull, inkMaterial));
      mesh.position.copy(seat);
      mesh.userData.seat = i;
      c.built.add(mesh);
      return mesh;
    }).filter(Boolean);
  };
  const disposeCraft = c => {
    if (!c) return;
    c.holder.parent?.remove(c.holder);
    for (const b of c.balls) b.material.dispose();
    for (const r of c.owned) r.dispose();
  };
  const disposeLeaving = () => { disposeCraft(leaving?.craft); leaving = null; };
  /** One vehicle with its passengers, trails and flame, in a `holder` group that carries its slide or flight. */
  const makeCraft = kind => {
    const owned = new Set(), mine = r => { owned.add(r); return r; };
    const inkMine = mesh => { mesh.add(new THREE.Mesh(mine(smoothHullGeometry(THREE, mesh.geometry)), inkMaterial)); return mesh; };
    const model = makeLobbyVehicle(THREE, kind);
    const built = new THREE.Group();
    built.rotation.z = model.tilt ?? 0;
    built.add(inkMine(new THREE.Mesh(mine(model.body), painted)));
    if (model.inner) built.add(new THREE.Mesh(mine(model.inner), painted)); // the cabin seen through an opening: no ink inside
    const spinners = model.spinners.map(s => {
      const mesh = inkMine(new THREE.Mesh(mine(s.geometry), painted));
      mesh.position.copy(s.position);
      mesh.userData.spin = s;
      built.add(mesh);
      return mesh;
    });
    let flame = null;
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
    const look = TRAIL_LOOK[kind] ?? TRAIL_LOOK.plane, rocket = isRocket(kind);
    const trails = (model.trails ?? []).map(([x, y, z, length], k) => {
      const material = mine(new THREE.ShaderMaterial({
        vertexShader: TRAIL_VERTEX, fragmentShader: TRAIL_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { color: { value: new THREE.Color(rocket ? 0xfff4dc : 0xffffff) }, time: { value: 0 }, len: { value: length * 1.6 },
          width: { value: look.width }, amp: { value: look.amp * (0.8 + seeded(k + 520) * 0.4) }, phase: { value: seeded(k + 500) * 6.28 },
          speed: { value: look.speed * (0.85 + seeded(k + 540) * 0.3) }, opacity: { value: look.opacity }, air: { value: 0 } },
      }));
      const ribbon = new THREE.Mesh(trailGeometry, material);
      ribbon.position.set(x, y, z);
      ribbon.frustumCulled = false;
      ribbon.renderOrder = 1;
      built.add(ribbon);
      return ribbon;
    });
    const holder = new THREE.Group();
    holder.add(built);
    const c = { kind, model, built, holder, owned, balls: [], spinners, trails, flame };
    seatBalls(c);
    return c;
  };
  /** Puts `kind` in the rig: at once, or (`glide`) gliding in from behind, the current one speeding off ahead. */
  const setCraft = (kind, glide) => {
    if (glide && craft) { disposeLeaving(); leaving = { craft, start: null }; } else disposeCraft(craft);
    arriveAt = glide ? null : -1; // a glide starts on the next frame, from its clock
    craft = makeCraft(kind);
    craft.holder.visible = !glide; // a gliding arrival shows once its slide begins
    rig.add(craft.holder);
    stats.vehicle = kind;
    stats.passengers = craft.balls.length;
  };
  /** Rotors turn, wakes flow and the flame flickers, on every craft in view (the one aboard, or one leaving or launching). */
  const animateCraft = (c, t, l, air) => {
    for (const d of c.trails) { d.material.uniforms.time.value = t; d.material.uniforms.air.value = air; }
    for (const mesh of c.spinners) {
      const s = mesh.userData.spin;
      if (l.spinSeconds > 0 && !reducedMotion) mesh.rotation[s.axis] = (t / l.spinSeconds) * Math.PI * 2 * s.speed;
    }
    if (c.flame) c.flame.scale.set(reducedMotion ? 1 : 1 + Math.sin(t * 31) * 0.12 + Math.sin(t * 17) * 0.08, 1 + Math.sin(t * 23) * 0.06, 1 + Math.sin(t * 23) * 0.06);
  };

  // Air: wanted now, and the eased level everything uses. Clouds only over Gaia.
  let place = destination, airWanted = !!air, airLevel = airWanted ? 1 : 0, cloudLevel = airWanted && place === 'gaia' ? 1 : 0;
  let skyProbe = null;
  setCraft(vehicle, false);

  const basis = new THREE.Matrix4(), right = new THREE.Vector3(), up = new THREE.Vector3(), back = new THREE.Vector3();
  /** The rotation that points a craft's nose (+x) along `dir`, its top kept toward the camera's side of it. */
  const facing = (dir, out = new THREE.Quaternion()) => {
    const x = dir.clone().normalize(), y = new THREE.Vector3().crossVectors(back, x);
    if (y.lengthSq() < 1e-6) y.copy(up);
    y.normalize();
    return out.setFromRotationMatrix(basis.makeBasis(x, y, new THREE.Vector3().crossVectors(x, y)));
  };
  const pitch = (angle, out = new THREE.Quaternion()) => out.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
  /** Fixes a trip's directions from the camera as it is now: on screen toward the destination, and a little into the distance. */
  const aim = (to, toward, reach) => {
    right.set(1, 0, 0).applyQuaternion(camera.quaternion); up.set(0, 1, 0).applyQuaternion(camera.quaternion); back.set(0, 0, 1).applyQuaternion(camera.quaternion);
    let { x, y } = (toward && Number.isFinite(toward.x) && Number.isFinite(toward.y) && Math.hypot(toward.x, toward.y) > 1e-3) ? toward : FALLBACK[to] ?? FALLBACK.luna;
    let n = Math.hypot(x, y); x /= n; y /= n;
    y = to === 'gaia' ? Math.min(y, -0.5) : Math.max(y, 0.45); // home is below, the others above: never skim along the horizon
    n = Math.hypot(x, y); x /= n; y /= n;
    const screen = right.clone().multiplyScalar(x).addScaledVector(up, y);
    return { screen, dir: screen.clone().addScaledVector(back, -0.35).normalize(), reach };
  };
  /** Starts a trip to `to` on the next frame: the craft aboard leaves the rig for the open scene, where it flies off. */
  const depart = ({ kind, to, air: nextAir, toward }) => {
    disposeLeaving();
    const out = craft;
    craft = null; arriveAt = -1;
    out.holder.visible = true;
    rig.updateMatrixWorld(true);
    scene.attach(out.holder); // keeps where it is on screen
    trip = { kind, to, air: nextAir, toward, out, from: out.holder.position.clone(), q0: out.holder.quaternion.clone(), qDir: null, t0: null, launch: isRocket(kind) && !isRocket(out.kind) && to !== 'gaia', launcher: null, waitAt: null, path: null };
    stats.vehicle = kind;
  };
  const arrive = () => {
    const { kind, to, air: nextAir } = trip;
    disposeCraft(trip.out); disposeCraft(trip.launcher?.craft);
    trip = null;
    airWanted = !!nextAir; place = to;
    setCraft(kind, true);
  };

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
  /** A trip, frame by frame: the old craft flies off, a rocket may launch, then the next craft arrives once the sky is there. */
  const fly = (now, t, l, reach) => {
    if (trip.t0 === null) {
      trip.t0 = now;
      trip.path = aim(trip.to, trip.toward, reach);
      trip.qDir = facing(trip.path.dir);
    }
    const e = now - trip.t0, { out, path } = trip;
    if (out) {
      const h = out.holder;
      if (isRocket(out.kind)) {
        // A rocket swings round to point at the planet it is off to, then fires away toward it, speeding up all the while.
        h.quaternion.slerpQuaternions(trip.q0, trip.qDir, easeInOut(clamp01(e / TRIP.turn)));
        const s = easeIn(clamp01((e - TRIP.turn * 0.4) / (TRIP.rocketExit - TRIP.turn * 0.4)));
        h.position.copy(trip.from).addScaledVector(path.dir, s * path.reach * 1.6);
      } else {
        // A plane lifts its nose and climbs away ahead; a helicopter dips its nose to speed off, as real ones do.
        const p = clamp01(e / TRIP.exit), s = easeIn(p);
        const nose = new THREE.Vector3(1, 0, 0).applyQuaternion(trip.q0);
        h.quaternion.copy(trip.q0).multiply(pitch(easeInOut(clamp01(e / 0.7)) * (out.kind === 'helicopter' ? -0.2 : 0.16)));
        h.position.copy(trip.from).addScaledVector(nose, s * path.reach * 1.5).addScaledVector(up, s * path.reach * (out.kind === 'helicopter' ? 0.08 : 0.16));
      }
      animateCraft(out, t, l, airLevel);
      if (e >= (isRocket(out.kind) ? TRIP.rocketExit : TRIP.exit)) { disposeCraft(out); trip.out = null; }
    }
    // Leaving Gaia's air for space: once the plane or helicopter is on its way, a rocket rises from below and streaks off toward the planet.
    if (trip.launch && !trip.launcher && e >= TRIP.exit * TRIP.launchAt) {
      const c = makeCraft(trip.kind);
      const start = path.screen.clone().multiplyScalar(-path.reach * 1.05).addScaledVector(up, -path.reach * 0.25);
      const end = path.dir.clone().multiplyScalar(path.reach * 1.5);
      c.holder.quaternion.copy(facing(end.clone().sub(start)));
      c.holder.position.copy(start);
      scene.add(c.holder);
      trip.launcher = { craft: c, start, end, t0: now };
    }
    const launcher = trip.launcher;
    if (launcher?.craft) {
      const p = clamp01((now - launcher.t0) / TRIP.launch);
      launcher.craft.holder.position.lerpVectors(launcher.start, launcher.end, 0.3 * p + 0.7 * p * p);
      animateCraft(launcher.craft, t, l, airLevel);
      if (p >= 1) { disposeCraft(launcher.craft); launcher.craft = null; }
    }
    // Both gone: out in space between the planets, no wind, until the sky has arrived.
    if (!trip.out && (!trip.launch || (launcher && !launcher.craft))) {
      if (trip.waitAt === null) trip.waitAt = now;
      airWanted = false;
      const there = skyProbe ? !!skyProbe(trip.to) : true;
      if ((there && now - trip.waitAt >= TRIP.settle) || e >= TRIP.maxWait) arrive();
    }
  };
  const frame = time => {
    resize();
    const l = display.lobby, t = reducedMotion ? 0 : time / 1000, now = time / 1000;
    const dt = lastNow === null ? 0 : Math.min(0.1, Math.max(0, now - lastNow));
    lastNow = now;
    // The swap: the old vehicle speeds off ahead, the new one glides in from behind once it has started to go.
    if (leaving) {
      if (leaving.start === null) leaving.start = now;
      const p = (now - leaving.start) / SWAP.out;
      leaving.craft.holder.position.x = easeIn(Math.min(1, p)) * SWAP.reach;
      if (p >= 1) disposeLeaving();
    }
    if (arriveAt === null) arriveAt = now + (leaving ? SWAP.gap : 0);
    if (craft && arriveAt > 0) {
      const p = (now - arriveAt) / SWAP.in;
      craft.holder.visible = p >= 0;
      craft.holder.position.x = -(1 - easeOut(clamp01(p))) * SWAP.reach;
      if (p >= 1) { craft.holder.position.x = 0; arriveAt = -1; }
    }
    // The framing eases to the new vehicle's size rather than jumping (and holds while none is aboard).
    const half = craft?.model.half ?? frameHalf;
    if (!frameHalf) frameHalf = { ...half };
    const ease = Math.min(1, dt * 2.2);
    frameHalf.x += (half.x - frameHalf.x) * ease; frameHalf.y += (half.y - frameHalf.y) * ease;
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
    camera.updateMatrixWorld();
    if (trip) fly(now, t, l, Math.hypot(1, camera.aspect) * dist * tan * 1.25);
    stats.swapping = !!leaving || arriveAt !== -1 || !!trip;
    stats.trip = trip ? (trip.out ? 'leaving' : trip.launcher?.craft ? 'launching' : 'between') : arriveAt !== -1 ? 'arriving' : null;
    // The air fades in and out over about a second.
    const airEase = reducedMotion ? 1 : Math.min(1, dt * 1.2);
    airLevel += ((airWanted ? 1 : 0) - airLevel) * airEase;
    cloudLevel += ((airWanted && place === 'gaia' ? 1 : 0) - cloudLevel) * airEase;
    stats.air = airLevel;
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
    const kind = craft?.kind ?? stats.vehicle;
    const rush = isRocket(kind) ? 1.5 : kind === 'helicopter' ? 0.7 : 1;
    streakMaterial.uniforms.level.value = airLevel;
    for (const s of streaks) { const u = s.userData; s.visible = airLevel > 0.01; s.position.set(wrap(u.x0, u.speed * rush, t), u.y + Math.sin(t * 0.35 + u.phase) * 0.25, u.z); }
    for (const c of clouds) {
      const u = c.userData;
      c.visible = cloudLevel > 0.01;
      c.scale.set(CLOUD_SCALE[0] * cloudLevel, CLOUD_SCALE[1] * cloudLevel, CLOUD_SCALE[2] * cloudLevel);
      c.position.set(wrap(u.x0, u.speed * rush, t), u.y, u.z);
    }
    // Calm flight (owner, 2026-11-17: less shake; 2026-11-18: smoother): one long slow swell, the nose easing up as it climbs and down
    // as it sinks, a slow wide sway, and in an atmosphere a faint unhurried roll as the air lifts one wing then the other. Every wave is
    // slow and low, so the motion glides rather than jitters.
    const swell = Math.sin(t * 0.6), drift = Math.sin(t * 0.23 + 0.7);
    rig.rotation.y = TURN + (Math.sin(t * 0.27) * 0.8 + Math.sin(t * 0.11 + 1.1) * 0.2) * l.sway * Math.PI / 180;
    rig.position.y = (swell * 0.85 + drift * 0.15) * l.bob;
    rig.rotation.z = Math.cos(t * 0.6) * l.bob * 0.22; // the nose follows the climb
    rig.rotation.x = (Math.sin(t * 0.31 + 0.4) * 0.008 + Math.sin(t * 0.53 + 2.0) * 0.004) * (0.35 + 0.65 * airLevel);
    if (craft) {
      animateCraft(craft, t, l, airLevel);
      craft.balls.forEach((b, k) => { b.position.y = craft.model.seats[b.userData.seat].y + (reducedMotion ? 0 : (0.5 - 0.5 * Math.cos(t * 1.2 + k * 0.9)) * 0.025); });
    }
    if (leaving) animateCraft(leaving.craft, t, l, airLevel);
    scene.updateMatrixWorld(true);
    renderer.render(scene, camera);
    stats.frames++;
    if (anchorListener) {
      const out = [];
      // Tags follow the craft aboard; while none is (between planets, or before it glides in) there are no anchors.
      if (craft && craft.holder.visible) {
        for (const b of craft.balls) {
          const centre = toScreen(b.getWorldPosition(v));
          const top = toScreen(b.getWorldPosition(v).add(new THREE.Vector3(0, BALL_RADIUS, 0)));
          const below = toScreen(b.getWorldPosition(v).add(new THREE.Vector3(0, -craft.model.drop, 0)));
          const above = toScreen(b.getWorldPosition(v).add(new THREE.Vector3(0, BALL_RADIUS + (craft.model.rise ?? 0), 0)));
          out.push({ seat: b.userData.seat, x: centre.x, y: centre.y, r: Math.max(4, centre.y - top.y), below, above });
        }
      }
      anchorListener(out, { width, height });
    }
  };

  let raf = 0, disposed = false;
  const loop = time => { if (disposed) return; frame(time); raf = win.requestAnimationFrame(loop); };
  const still = () => reducedMotion || stats.frames === 0;
  const api = {
    stats,
    /** The WebGL context drawn with, so the lobby can keep its canvas and restore this context next visit (src/ui/lobby-canvas.js). */
    context: renderer.getContext?.() ?? null,
    /** A new vehicle on the same planet: it glides in as the old one speeds off. */
    setVehicle(kind) { if (kind !== stats.vehicle) { if (trip) trip.kind = kind; else setCraft(kind, !still()); } },
    /**
     * A trip (owner, 2026-11-18): `vehicle` to `destination`, whose air (`air`) shows on arrival, flying off toward `toward` (where the
     * destination is on screen, x right and y up; a default per planet otherwise). The same planet only changes the vehicle or the air.
     * Reduced motion, or before the first frame, switches at once.
     */
    setTrip({ vehicle: kind = stats.vehicle, destination: to = place, air: nextAir = airWanted, toward = null } = {}) {
      if (trip) { // already flying: the next craft and planet change, the flight goes on
        Object.assign(trip, { kind, to, air: nextAir, toward });
        if (!trip.launcher) trip.launch = isRocket(kind) && !isRocket(trip.out?.kind ?? kind) && to !== 'gaia';
        stats.vehicle = kind;
        return;
      }
      if (to === place) { api.setVehicle(kind); airWanted = !!nextAir; return; }
      if (still() || !craft) {
        place = to; airWanted = !!nextAir;
        if (still()) { airLevel = airWanted ? 1 : 0; cloudLevel = airWanted && place === 'gaia' ? 1 : 0; }
        if (kind !== stats.vehicle || !craft) setCraft(kind, false);
        return;
      }
      depart({ kind, to, air: nextAir, toward });
    },
    /** `fn(destination)` is true once the planet sky behind has arrived there; the next craft waits for it (6.5 s at most). */
    setSkyProbe(fn) { skyProbe = typeof fn === 'function' ? fn : null; },
    /** Wind and wakes on (an atmosphere: Gaia, or low over Ares) or off (space). During a trip it applies on arrival. */
    setAir(on) { if (trip) trip.air = !!on; else airWanted = !!on; },
    /** Shows or hides the corner sun (it shrinks away): off when the planet sky behind draws its own sun, as in Ares's air. */
    setSun(on) { sunWanted = !!on; },
    /** One colour (CSS hex) per seat, null for an empty seat. */
    setPassengers(list) { colors = [...list]; if (craft) { seatBalls(craft); stats.passengers = craft.balls.length; } },
    /** Pixels the lobby's panels cover on each side; the vehicle is framed in the rest. */
    setInsets(next) { for (const k of ['left', 'right', 'top', 'bottom']) insets[k] = Math.max(0, Number(next?.[k]) || 0); },
    onAnchors(fn) { anchorListener = fn; },
    start() { if (!raf && !disposed) raf = win.requestAnimationFrame(loop); },
    dispose() {
      disposed = true;
      if (raf) win.cancelAnimationFrame(raf);
      disposeLeaving();
      if (trip) { disposeCraft(trip.out); disposeCraft(trip.launcher?.craft); trip = null; }
      disposeCraft(craft); craft = null;
      for (const r of owned) r.dispose?.();
      renderer.dispose?.();
      if (!renderer.getContext?.()?.isContextLost?.()) renderer.forceContextLoss?.(); // release the context now: browsers cap live contexts and drop the oldest, which can be the game's; an evicted one is already gone
    },
  };
  return api;
}
