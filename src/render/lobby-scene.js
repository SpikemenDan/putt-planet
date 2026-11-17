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

  // ---- The sun (owner, 2026-11-17: realistic, not cartoon): a glowing photosphere with slowly boiling granulation and limb darkening
  // (white-hot in the middle, deep orange at the edge), wrapped in a soft corona with faint streamers that drift. No outline: it is
  // the light. Fixed to the camera at the top right of the free area.
  const sun = new THREE.Group();
  const sunTime = { value: 0 };
  const NOISE = `
    float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * n3(p); p = p * 2.03 + 1.7; a *= 0.5; } return v; }`;
  const photosphere = new THREE.Mesh(own(new THREE.SphereGeometry(1.6, 64, 48)), own(new THREE.ShaderMaterial({
    uniforms: { time: sunTime },
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vP = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float time; varying vec3 vN; varying vec3 vP; ${NOISE}
      void main(){
        float mu = clamp(vN.z, 0.0, 1.0);
        float cells = fbm(vP * 4.2 + vec3(0.0, time * 0.05, time * 0.03));
        float fine = n3(vP * 13.0 - time * 0.1);
        float g = cells * 0.75 + fine * 0.25;
        float limb = 0.55 + 0.45 * pow(mu, 0.4);
        vec3 hot = vec3(1.0, 0.98, 0.9), warm = vec3(1.0, 0.84, 0.42), edge = vec3(1.0, 0.52, 0.12);
        vec3 col = mix(edge, mix(warm, hot, smoothstep(0.45, 1.0, mu)), smoothstep(0.0, 0.55, mu));
        col *= 0.9 + 0.2 * g;
        gl_FragColor = vec4(min(col * limb * 1.08, vec3(1.0)), 1.0);
      }`,
  })));
  const corona = new THREE.Mesh(own(new THREE.PlaneGeometry(9, 9)), own(new THREE.ShaderMaterial({
    uniforms: { time: sunTime },
    transparent: true, depthWrite: false, premultipliedAlpha: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float time; varying vec2 vUv; ${NOISE}
      void main(){
        float r = length(vUv) * 4.5 / 1.6;
        if (r < 0.98) discard;
        float a = atan(vUv.y, vUv.x);
        float streak = fbm(vec3(cos(a) * 3.0, sin(a) * 3.0, time * 0.08)) ;
        float glow = exp(-(r - 1.0) * 2.6) * 0.85 + exp(-(r - 1.0) * 0.9) * 0.22 * (0.55 + streak);
        glow *= smoothstep(2.8, 1.6, r) * 0.6 + 0.4 * smoothstep(2.8, 1.0, r);
        glow = clamp(glow, 0.0, 1.0);
        vec3 col = mix(vec3(1.0, 0.7, 0.3), vec3(1.0, 0.95, 0.78), exp(-(r - 1.0) * 3.0));
        gl_FragColor = vec4(col * glow, glow);
      }`,
  })));
  corona.position.z = -0.01;
  sun.add(corona, photosphere);
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
    sun.scale.setScalar(sunZ / 58);
    sunTime.value = t; // the granulation boils and the corona streamers drift (still with reduced motion)
    photosphere.rotation.y = t * 0.02;
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
