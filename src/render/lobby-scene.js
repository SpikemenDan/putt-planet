/**
 * The lobby vehicle scene (owner, 2026-11-16): one 3D vehicle (helicopter, plane or rocket, lobby-models.js) carrying the players'
 * balls in their colours, drawn on a canvas in the game's toon style with ink outlines. Presentation only: it never reads or changes
 * room state. The UI places each name tag from `anchors`, the screen positions of every occupied seat, reported once per frame.
 *
 * Live settings come from `display.lobby` (src/shared/display.js): zoom, sway, bob and spinSeconds. Reduced motion draws still frames.
 */
import { makeLobbyVehicle, BALL_RADIUS } from './lobby-models.js';
import { createMaterialLibrary } from './materials.js';
import { smoothHullGeometry, sizeInk } from './outline.js';

const defaultRenderer = (THREE, canvas) => new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const FOV = 30;

/**
 * @param {object} options
 * @param {object} options.THREE
 * @param {HTMLCanvasElement} options.canvas
 * @param {{lobby: object}} options.display live settings
 * @param {'helicopter'|'plane'|'rocket'} options.vehicle
 * @param {boolean} [options.reducedMotion]
 * @param {Window} [options.win]
 * @param {Function} [options.createWebGLRenderer] renderer seam (tests)
 * @returns {{ setVehicle(kind: string): void, setPassengers(colors: (string|null)[]): void, onAnchors(fn: Function): void, start(): void, dispose(): void, stats: object }}
 */
export function createLobbyScene({ THREE, canvas, display, vehicle = 'plane', reducedMotion = false, win = canvas.ownerDocument.defaultView, createWebGLRenderer = defaultRenderer }) {
  const doc = canvas.ownerDocument;
  let renderer = null;
  try { renderer = createWebGLRenderer(THREE, canvas); } catch { renderer = null; }
  if (!renderer) return { setVehicle() {}, setPassengers() {}, onAnchors() {}, start() {}, dispose() {}, stats: { webgl: false } };
  renderer.setClearColor?.(0x000000, 0);
  const library = createMaterialLibrary({ THREE, createCanvas: () => doc.createElement('canvas'), random: Math.random });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(FOV, 2, 0.1, 200);
  scene.add(new THREE.AmbientLight(0xffffff, 2.6));
  const sun = new THREE.DirectionalLight(0xffffff, 4.6);
  sun.position.set(4, 10, 8);
  scene.add(camera, sun);
  const painted = library.toon(0xffffff);
  painted.vertexColors = true;
  const glassMaterial = library.toon(0xbfe9ff, { transparent: true, opacity: 0.38 });
  glassMaterial.depthWrite = false;
  const owned = new Set([painted, glassMaterial]);
  const own = r => { owned.add(r); return r; };
  const ink = (mesh, material = library.ink.solid) => { mesh.add(new THREE.Mesh(own(smoothHullGeometry(THREE, mesh.geometry)), material)); return mesh; };

  const rig = new THREE.Group(); // sways and bobs
  scene.add(rig);
  const ballGeometry = own(new THREE.SphereGeometry(BALL_RADIUS, 28, 20));
  const ballHull = own(smoothHullGeometry(THREE, ballGeometry));
  let model = null, built = null, balls = [], spinners = [], flame = null, colors = [];
  const stats = { webgl: true, vehicle: null, passengers: 0, frames: 0 };

  const clear = () => {
    if (!built) return;
    rig.remove(built);
    built.traverse(o => { if (o.geometry && o.geometry !== ballGeometry && o.geometry !== ballHull) { o.geometry.dispose(); owned.delete(o.geometry); } if (o.material && o.material !== painted && o.material !== glassMaterial && !o.material.userData?.ink) o.material.dispose(); });
    built = null; balls = []; spinners = []; flame = null;
  };
  const buildBalls = () => {
    for (const b of balls) { built.remove(b); b.material.dispose(); }
    balls = model.seats.map((seat, i) => {
      const color = colors[i];
      if (color == null) return null;
      const mesh = new THREE.Mesh(ballGeometry, library.toon(new THREE.Color(color)));
      mesh.add(new THREE.Mesh(ballHull, library.ink.solid)); // one hull for every ball
      mesh.position.copy(seat);
      mesh.userData.seat = i;
      built.add(mesh);
      return mesh;
    }).filter(Boolean);
    stats.passengers = balls.length;
  };
  const build = kind => {
    clear();
    model = makeLobbyVehicle(THREE, kind);
    built = new THREE.Group();
    built.rotation.z = model.tilt ?? 0;
    built.add(ink(new THREE.Mesh(own(model.body), painted)));
    if (model.glass) built.add(new THREE.Mesh(own(model.glass), glassMaterial));
    spinners = model.spinners.map(s => {
      const mesh = ink(new THREE.Mesh(own(s.geometry), painted));
      mesh.position.copy(s.position);
      mesh.userData.spin = s;
      built.add(mesh);
      return mesh;
    });
    if (model.flame) {
      flame = new THREE.Mesh(own(model.flame), painted);
      flame.position.copy(model.flameAt);
      built.add(flame);
    }
    // Centre the vehicle on its real extent (rotor tips and tail included), so nothing hangs out of the frame.
    const box = new THREE.Box3().setFromObject(built), centre = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    built.position.set(-centre.x, -centre.y, -centre.z);
    model.half = { x: size.x * 0.5 + size.z * 0.08, y: size.y * 0.5 + size.z * 0.12 }; // the turn toward the viewer shows some depth
    rig.add(built);
    stats.vehicle = kind;
    buildBalls();
  };
  build(vehicle);

  let anchorListener = null;
  const v = new THREE.Vector3();
  let width = 0, height = 0;
  const resize = () => {
    const w = canvas.clientWidth || canvas.width || 600, h = canvas.clientHeight || canvas.height || 300;
    if (w === width && h === height) return;
    width = w; height = h;
    const ratio = Math.min(win?.devicePixelRatio || 1, 2);
    renderer.setPixelRatio?.(ratio);
    renderer.setSize(w, h, false);
    sizeInk(library.inkUniforms, w * ratio, h * ratio);
    library.inkUniforms.ink.value = Math.max(2, w * ratio * 3 / 1280);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const frame = time => {
    resize();
    const l = display.lobby, t = reducedMotion ? 0 : time / 1000;
    // Frame the vehicle: far enough back that its radius fills the narrower view direction, then zoom.
    const tan = Math.tan((FOV * Math.PI / 180) / 2);
    const dist = Math.max(model.half.x / (tan * camera.aspect), model.half.y / tan) * 0.92 / l.zoom;
    camera.position.set(dist * 0.12, dist * 0.42, dist);
    camera.lookAt(0, 0, 0);
    rig.rotation.y = -0.38 + Math.sin(t * 0.6) * l.sway * Math.PI / 180;
    rig.position.y = Math.sin(t * 1.7) * l.bob;
    rig.rotation.x = Math.sin(t * 1.1) * 0.02;
    for (const mesh of spinners) {
      const s = mesh.userData.spin;
      if (l.spinSeconds > 0 && !reducedMotion) mesh.rotation[s.axis] = (t / l.spinSeconds) * Math.PI * 2 * s.speed;
    }
    if (flame) flame.scale.set(reducedMotion ? 1 : 1 + Math.sin(t * 31) * 0.12 + Math.sin(t * 17) * 0.08, 1 + Math.sin(t * 23) * 0.06, 1 + Math.sin(t * 23) * 0.06);
    balls.forEach((b, k) => { b.position.y = model.seats[b.userData.seat].y + (reducedMotion ? 0 : Math.abs(Math.sin(t * 2.4 + k * 0.9)) * 0.08); });
    renderer.render(scene, camera);
    stats.frames++;
    if (anchorListener) {
      const out = [];
      for (const b of balls) {
        b.getWorldPosition(v); v.project(camera);
        const x = (v.x + 1) / 2 * width, y = (1 - v.y) / 2 * height;
        b.getWorldPosition(v); v.y += BALL_RADIUS; v.project(camera);
        const top = (1 - v.y) / 2 * height;
        out.push({ seat: b.userData.seat, x, y, r: Math.max(4, y - top) });
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
    onAnchors(fn) { anchorListener = fn; },
    start() { if (!raf && !disposed) raf = win.requestAnimationFrame(loop); },
    dispose() {
      disposed = true;
      if (raf) win.cancelAnimationFrame(raf);
      for (const b of balls) b.material.dispose();
      clear();
      for (const r of owned) r.dispose?.();
      library.dispose?.();
      renderer.dispose?.();
    },
  };
}
