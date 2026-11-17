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
  if (!renderer) return { setVehicle() {}, setPassengers() {}, setInsets() {}, onAnchors() {}, start() {}, dispose() {}, stats: { webgl: false } };
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
  glow.add(halo(2.25, 0.85));
  sun.add(glow, photosphere);
  camera.add(sun);

  const rig = new THREE.Group(); // sways and bobs
  scene.add(rig);
  const ballGeometry = own(new THREE.SphereGeometry(BALL_RADIUS, 32, 22));
  const ballHull = own(smoothHullGeometry(THREE, ballGeometry));
  let model = null, built = null, balls = [], spinners = [], flame = null, colors = [];
  const vehicleOwned = new Set();
  const mine = r => { vehicleOwned.add(r); return r; };
  const stats = { webgl: true, vehicle: null, passengers: 0, frames: 0 };

  const clear = () => {
    if (!built) return;
    rig.remove(built);
    for (const b of balls) b.material.dispose();
    for (const r of vehicleOwned) r.dispose();
    vehicleOwned.clear();
    built = null; balls = []; spinners = []; flame = null;
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
  const build = kind => {
    clear();
    model = makeLobbyVehicle(THREE, kind);
    built = new THREE.Group();
    built.rotation.z = model.tilt ?? 0;
    built.add(inkMine(new THREE.Mesh(mine(model.body), painted)));
    spinners = model.spinners.map(s => {
      const mesh = inkMine(new THREE.Mesh(mine(s.geometry), painted));
      mesh.position.copy(s.position);
      mesh.userData.spin = s;
      built.add(mesh);
      return mesh;
    });
    if (model.flame) {
      flame = new THREE.Mesh(mine(model.flame), own(new THREE.MeshBasicMaterial({ vertexColors: true })));
      flame.position.copy(model.flameAt);
      built.add(flame);
    }
    // Centre the vehicle on its real extent (rotor tips and tail included), so nothing hangs out of the frame.
    const box = new THREE.Box3().setFromObject(built), centre = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    built.position.set(-centre.x, -centre.y, -centre.z);
    model.half = { x: size.x * 0.5 + size.z * 0.12, y: size.y * 0.5 + size.z * 0.1 };
    const glass = new THREE.Mesh(mine(model.glass), glassMaterial); // after the box: glass never sets the frame
    glass.renderOrder = 2;
    built.add(glass); // no ink hull: through clear glass it would read as a dark tint
    rig.add(built);
    stats.vehicle = kind;
    buildBalls();
  };
  build(vehicle);

  let anchorListener = null;
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
    const l = display.lobby, t = reducedMotion ? 0 : time / 1000;
    // Fit the vehicle into the free area between the panels, then shift the view so it is centred there.
    const freeW = Math.max(120, width - insets.left - insets.right), freeH = Math.max(120, height - insets.top - insets.bottom);
    const tan = Math.tan((FOV * Math.PI / 180) / 2);
    // At distance d the view is 2·d·tan tall and 2·d·tan·aspect wide; the free area is that much of it.
    const dist = Math.max(model.half.x / (tan * freeW / height), model.half.y / (tan * freeH / height)) * 1.08 / l.zoom;
    const offX = (insets.right - insets.left) / 2, offY = (insets.bottom - insets.top) / 2;
    camera.setViewOffset(width, height, offX, offY, width, height);
    camera.position.set(dist * 0.1, dist * 0.32, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    // The sun sits at the top right of the free area, far behind the vehicle.
    const sunZ = dist * 2.4, halfH = sunZ * tan, halfW = halfH * camera.aspect;
    sun.position.set((-1 + 2 * (insets.left + freeW * 0.76 + offX) / width) * halfW, (1 - 2 * (insets.top + freeH * 0.14 + offY) / height) * halfH, -sunZ);
    sun.scale.setScalar(sunZ / 90); // small in the sky (owner, 2026-11-17)
    glow.position.copy(sun.position).normalize().multiplyScalar(1.8); // the halo sits behind the ball on the line of sight, centred on it
    glow.scale.setScalar(1 + Math.sin(t * 1.3) * 0.04); // the halo breathes
    rig.rotation.y = TURN + Math.sin(t * 0.6) * l.sway * Math.PI / 180;
    rig.position.y = Math.sin(t * 1.7) * l.bob;
    rig.rotation.x = Math.sin(t * 1.1) * 0.02;
    for (const mesh of spinners) {
      const s = mesh.userData.spin;
      if (l.spinSeconds > 0 && !reducedMotion) mesh.rotation[s.axis] = (t / l.spinSeconds) * Math.PI * 2 * s.speed;
    }
    if (flame) flame.scale.set(reducedMotion ? 1 : 1 + Math.sin(t * 31) * 0.12 + Math.sin(t * 17) * 0.08, 1 + Math.sin(t * 23) * 0.06, 1 + Math.sin(t * 23) * 0.06);
    balls.forEach((b, k) => { b.position.y = model.seats[b.userData.seat].y + (reducedMotion ? 0 : Math.abs(Math.sin(t * 2.4 + k * 0.9)) * 0.06); });
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
    setVehicle(kind) { if (kind !== stats.vehicle) build(kind); },
    /** One colour (CSS hex) per seat, null for an empty seat. */
    setPassengers(list) { colors = [...list]; if (built) buildBalls(); },
    /** Pixels the lobby's panels cover on each side; the vehicle is framed in the rest. */
    setInsets(next) { for (const k of ['left', 'right', 'top', 'bottom']) insets[k] = Math.max(0, Number(next?.[k]) || 0); },
    onAnchors(fn) { anchorListener = fn; },
    start() { if (!raf && !disposed) raf = win.requestAnimationFrame(loop); },
    dispose() {
      disposed = true;
      if (raf) win.cancelAnimationFrame(raf);
      clear();
      for (const r of owned) r.dispose?.();
      renderer.dispose?.();
    },
  };
}
