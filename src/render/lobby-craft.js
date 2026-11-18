/**
 * The lobby vehicles as objects in the planet scene (owner, 2026-11-18: a real 3D vehicle in real space, not a picture laid over it).
 * One helicopter, plane or rocket (lobby-models.js) carrying the players' balls in their colours, with its rotors, wakes, flame and
 * the faint wind lines of flight in air. Clean cel shading with ink outlines. src/render/planet-scene.js places and flies it; this
 * module only builds and animates the parts. Presentation only: it never reads or changes room state.
 */
import { makeLobbyVehicle, BALL_RADIUS, isRocket } from './lobby-models.js';
import { createInkMaterial, createInkUniforms, smoothHullGeometry } from './outline.js';

export { BALL_RADIUS, isRocket };

/** Seconds and reach (vehicle units) of a vehicle change: the old one speeds off ahead, the new one glides in from behind. */
export const SWAP = Object.freeze({ out: 0.9, in: 1.3, gap: 0.25, reach: 46 });
/** The quicker cartoon dash used when a trip changes the vehicle (owner, 2026-11-18). */
export const DASH = Object.freeze({ out: 0.32, in: 0.6, gap: 0.06, reach: 46 });

export const easeOutBack = x => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
export const easeIn = x => x * x * x;
export const easeOut = x => 1 - Math.pow(1 - x, 3);

const seeded = k => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Wakes (owner, 2026-11-17; 2026-11-18: subtler and smoother, like real air): a soft ribbon off each engine, wing, rotor tip, fin and
// nozzle that streams back on a slow, gentle wave, widening and fading as it goes, with mild gusts running down it. Two crossed strips,
// so it reads from any angle. Shown only in air. Built once (1 long, trailing back from 0); each trail bends it in the vertex shader.
const TRAIL_STEPS = 48;
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
const STREAK_SPAN = 30; // wind lines wrap across this width (vehicle units) around the vehicle

/**
 * The shared materials and builders for lobby craft.
 * @param {object} THREE
 * @param {{reducedMotion?: boolean}} [options]
 */
export function createCraftKit(THREE, { reducedMotion = false } = {}) {
  const owned = new Set(), own = r => { owned.add(r); return r; };
  // Clean cel shading: three flat bands from a tiny gradient map, no halftone. The ink hulls draw the outlines.
  const bands = own(new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat));
  Object.assign(bands, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, needsUpdate: true });
  const toon = (color, extra = {}) => own(new THREE.MeshToonMaterial({ color, gradientMap: bands, ...extra }));
  const painted = toon(0xffffff, { vertexColors: true });
  const glassMaterial = toon(0xd4f1ff, { transparent: true, opacity: 0.28, depthWrite: false });
  const inkUniforms = createInkUniforms(THREE);
  const inkMaterial = own(createInkMaterial(THREE, inkUniforms));
  const ballGeometry = own(new THREE.SphereGeometry(BALL_RADIUS, 32, 22));
  const ballHull = own(smoothHullGeometry(THREE, ballGeometry));
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

  // Wind lines (owner, 2026-11-17; 2026-11-18: subtler, smoother, and only where there is air): a few faint, thin lines slide past
  // from nose to tail, fading in at their head and out along their tail and toward the edges. Laid out in the vehicle's own frame.
  const streakMaterial = own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { level: { value: 0 }, span: { value: STREAK_SPAN / 2 } },
    vertexShader: 'varying float vU; varying float vX; void main(){ vU = position.x; vec4 l = modelMatrix * vec4(position, 1.0); vX = l.x; gl_Position = projectionMatrix * viewMatrix * l; }',
    fragmentShader: `uniform float level, span; varying float vU, vX;
      void main(){
        float a = level * 0.16 * smoothstep(-1.02, 0.35, vU) * (1.0 - smoothstep(0.7, 1.02, vU));
        if (a < 0.003) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
      }`,
  }));
  const streakGeometry = own(new THREE.CapsuleGeometry(0.014, 2.0, 2, 6).rotateZ(Math.PI / 2));
  const wind = new THREE.Group();
  const streaks = Array.from({ length: 10 }, (_, k) => {
    const mesh = new THREE.Mesh(streakGeometry, streakMaterial);
    mesh.userData = { x0: seeded(k) * STREAK_SPAN, y: (seeded(k + 40) - 0.5) * 7, z: -1 - seeded(k + 80) * 7, speed: 13 + seeded(k + 120) * 8, length: 0.8 + seeded(k + 160) * 1.1, phase: seeded(k + 180) * 6.28 };
    mesh.scale.x = mesh.userData.length;
    mesh.frustumCulled = false;
    wind.add(mesh);
    return mesh;
  });
  const wrap = (x0, speed, t) => ((x0 + speed * t) % STREAK_SPAN + STREAK_SPAN) % STREAK_SPAN - STREAK_SPAN / 2;
  /** Slides the wind lines; `air` 0..1 fades them, `kind` sets how fast the air rushes by. Off-screen lines fade by distance from centre. */
  const animateWind = (t, air, kind) => {
    const rush = isRocket(kind) ? 1.5 : kind === 'helicopter' ? 0.7 : 1;
    streakMaterial.uniforms.level.value = air;
    wind.visible = air > 0.01;
    for (const s of streaks) {
      const u = s.userData, x = wrap(u.x0, u.speed * rush, t);
      s.position.set(x, u.y + Math.sin(t * 0.35 + u.phase) * 0.25, u.z);
      // Gone near the wrap edges, so none ever pops in.
      const edge = 1 - Math.min(1, Math.max(0, (Math.abs(x) - STREAK_SPAN * 0.275) / (STREAK_SPAN * 0.2)));
      s.scale.set(u.length * Math.max(0.001, edge), Math.max(0.001, edge), Math.max(0.001, edge));
    }
  };

  const toonBall = color => new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: bands });
  /** Puts one ball per coloured seat (`colors[i]`, CSS hex, null for an empty seat) in craft `c`. */
  const seatBalls = (c, colors) => {
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
  /** One vehicle with its passengers, trails and flame, in a `holder` group that carries its slide. Its nose points along +x. */
  const makeCraft = (kind, colors = []) => {
    const mine = new Set(), keep = r => { mine.add(r); return r; };
    const inkMine = mesh => { mesh.add(new THREE.Mesh(keep(smoothHullGeometry(THREE, mesh.geometry)), inkMaterial)); return mesh; };
    const model = makeLobbyVehicle(THREE, kind);
    const built = new THREE.Group();
    built.rotation.z = model.tilt ?? 0;
    built.add(inkMine(new THREE.Mesh(keep(model.body), painted)));
    if (model.inner) built.add(new THREE.Mesh(keep(model.inner), painted)); // the cabin seen through an opening: no ink inside
    const spinners = model.spinners.map(s => {
      const mesh = inkMine(new THREE.Mesh(keep(s.geometry), painted));
      mesh.position.copy(s.position);
      mesh.userData.spin = s;
      built.add(mesh);
      return mesh;
    });
    let flame = null;
    if (model.flame) {
      flame = new THREE.Mesh(keep(model.flame), keep(new THREE.MeshBasicMaterial({ vertexColors: true })));
      flame.position.copy(model.flameAt);
      built.add(flame);
    }
    // Centre the vehicle on its real extent (rotor tips and tail included), so nothing hangs out of the frame.
    const box = new THREE.Box3().setFromObject(built), centre = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    built.position.set(-centre.x, -centre.y, -centre.z);
    const room = model.room ?? 1;
    model.half = { x: (size.x * 0.5 + size.z * 0.12) * room, y: (size.y * 0.5 + size.z * 0.1) * room };
    const glass = new THREE.Mesh(keep(model.glass), glassMaterial); // after the box: glass never sets the frame
    glass.renderOrder = 2;
    built.add(glass); // no ink hull: through clear glass it would read as a dark tint
    const look = TRAIL_LOOK[kind] ?? TRAIL_LOOK.plane, rocket = isRocket(kind);
    const trails = (model.trails ?? []).map(([x, y, z, length], k) => {
      const material = keep(new THREE.ShaderMaterial({
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
    const c = { kind, model, built, holder, owned: mine, balls: [], spinners, trails, flame };
    seatBalls(c, colors);
    return c;
  };
  /** Rotors turn, wakes flow (as much as `air`, 0..1) and the flame flickers, `thrust` (0..1) lengthening it. */
  const animateCraft = (c, t, l, air, thrust = 0) => {
    for (const d of c.trails) { d.material.uniforms.time.value = t; d.material.uniforms.air.value = air; }
    for (const mesh of c.spinners) {
      const s = mesh.userData.spin;
      if (l.spinSeconds > 0 && !reducedMotion) mesh.rotation[s.axis] = (t / l.spinSeconds) * Math.PI * 2 * s.speed;
    }
    if (c.flame) {
      const flicker = reducedMotion ? 0 : 1, grow = 1 + thrust * 0.7;
      c.flame.scale.set((1 + flicker * (Math.sin(t * 31) * 0.12 + Math.sin(t * 17) * 0.08)) * grow, 1 + flicker * Math.sin(t * 23) * 0.06, 1 + flicker * Math.sin(t * 23) * 0.06);
    }
  };
  return {
    inkUniforms, wind, makeCraft, seatBalls, disposeCraft, animateCraft, animateWind,
    dispose() { for (const r of owned) r.dispose?.(); owned.clear(); },
  };
}
