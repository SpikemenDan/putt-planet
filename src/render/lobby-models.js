/**
 * 3D vehicles for the lobbies (owner, 2026-11-16): a helicopter that carries the Solo player's ball, an open-top toy airliner with
 * eight seats for a party bound for Gaia, and an eight-seat rocket for Ares and Luna. Original models in the toon style of the sky
 * models (sky-models.js): one vertex-coloured body per vehicle, drawn with the game's toon material and ink hull.
 *
 * Units: a ball is 1 across (radius 0.5). Local axes: +x forward (nose), +y up, +z toward the viewer's side. Each builder returns
 * { body, glass?, seats, spinners, flame?, radius }: `seats` are ball centres, `spinners` parts that turn about `axis` (rotors and
 * propellers), `flame` the rocket's exhaust (pivot at the nozzle, pointing -x), `radius` how big the whole vehicle is for framing.
 * `THREE` is injected.
 */
import { mergeParts } from './sky-models.js';

export const LOBBY_VEHICLES = Object.freeze(['helicopter', 'plane', 'rocket']);
export const BALL_RADIUS = 0.5;

const at = (THREE, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/** A flat fin from an outline of [x, y] points, `thick` deep, centred on z = 0 (it stands upright in the x/y plane). */
function fin(THREE, points, thick) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false }).translate(0, 0, -thick / 2);
}

/** A flat wing from an outline of [x, z] points, `thick` tall, lying in the x/z plane. */
function wing(THREE, points, thick) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -thick / 2, 0);
}

/** A capsule lying along x: `length` is the straight middle, `r` the radius. */
const capsule = (THREE, r, length, cap = 10, radial = 20) => new THREE.CapsuleGeometry(r, length, cap, radial).rotateZ(Math.PI / 2);

/** A seat cup: a dark ring the ball sits in, on top of a body whose top is at `y`. */
const seatRing = (THREE, x, y, z = 0) => ({ geometry: new THREE.TorusGeometry(BALL_RADIUS + 0.06, 0.09, 8, 24).rotateX(Math.PI / 2), color: 0x2a2346, at: at(THREE, x, y, z) });

/** Two (or `count`) blades round a hub, turning about +y; the caller orients the group. */
function rotor(THREE, span, chord, color, count = 2) {
  const parts = [{ geometry: new THREE.CylinderGeometry(0.16, 0.16, 0.16, 12), color: 0x3b3557 }];
  for (let k = 0; k < count; k++) parts.push({ geometry: new THREE.BoxGeometry(span, 0.05, chord), color, at: at(THREE, 0, 0, 0, 0, k * Math.PI / count, 0) });
  return mergeParts(THREE, parts);
}

/** The Solo helicopter: an orange cabin with a glass bubble at the nose where the ball rides, a long tail and a two-blade rotor. */
export function makeHelicopter(THREE) {
  const orange = 0xff8a1f, deep = 0xe5631a, pink = 0xff3d8b, yellow = 0xffd23f, metal = 0x4b4570;
  const parts = [
    { geometry: new THREE.SphereGeometry(1, 24, 18), color: orange, at: at(THREE, -0.35, 1.45, 0, 0, 0, 0, 1.55, 1.1, 1.05) },
    { geometry: new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), color: deep, at: at(THREE, -0.35, 1.42, 0, 0, 0, 0, 1.57, 1.12, 1.07) }, // darker belly
    { geometry: new THREE.CylinderGeometry(1, 1, 0.24, 28, 1, true), color: pink, at: at(THREE, -0.35, 1.25, 0, 0, 0, 0, 1.56, 1, 1.06) }, // pink belt
    { geometry: new THREE.CylinderGeometry(0.28, 0.14, 3.4, 12).rotateZ(Math.PI / 2), color: orange, at: at(THREE, -3.3, 1.75, 0) }, // tail boom
    { geometry: fin(THREE, [[-5.1, 1.6], [-4.6, 1.6], [-4.75, 3.0], [-5.25, 3.05]], 0.14), color: yellow }, // tail fin
    { geometry: wing(THREE, [[-4.3, -0.9], [-3.8, -0.9], [-3.8, 0.9], [-4.3, 0.9]], 0.1), color: yellow, at: at(THREE, 0, 1.75, 0) }, // stabiliser
    { geometry: new THREE.CylinderGeometry(0.16, 0.2, 0.55, 12), color: metal, at: at(THREE, -0.3, 2.75, 0) }, // mast
    { geometry: new THREE.SphereGeometry(0.38, 14, 10), color: orange, at: at(THREE, -0.3, 2.55, 0, 0, 0, 0, 1.4, 0.7, 1) }, // engine hump
  ];
  for (const z of [0.85, -0.85]) {
    parts.push({ geometry: capsule(THREE, 0.09, 3.2, 4, 8), color: metal, at: at(THREE, -0.2, 0.12, z) }); // skid
    for (const x of [-1.1, 0.6]) parts.push({ geometry: new THREE.CylinderGeometry(0.07, 0.07, 0.75, 8), color: metal, at: at(THREE, x, 0.5, z * 0.8, z > 0 ? 0.35 : -0.35, 0, 0) });
  }
  const seat = new THREE.Vector3(1.05, 1.25, 0);
  return {
    body: mergeParts(THREE, parts),
    glass: new THREE.SphereGeometry(1, 24, 18).applyMatrix4(at(THREE, 0.95, 1.4, 0, 0, 0, 0, 1.0, 0.9, 0.82)),
    seats: [seat],
    spinners: [
      { geometry: rotor(THREE, 7.2, 0.42, 0x3b3557), position: new THREE.Vector3(-0.3, 3.05, 0), axis: 'y', speed: 1 },
      { geometry: rotor(THREE, 1.5, 0.18, 0x3b3557).rotateX(Math.PI / 2), position: new THREE.Vector3(-4.95, 2.35, 0.2), axis: 'z', speed: 1.6 },
    ],
    radius: 4.4,
  };
}

/** Eight seats in a row along the top of a body whose seat ring sits at `y`, `step` apart, centred on `cx`. */
const seatRow = (THREE, count, cx, y, step) => Array.from({ length: count }, (_, i) => new THREE.Vector3(cx + (i - (count - 1) / 2) * step, y + 0.18, 0));

/** The party plane for Gaia: an open-top toy airliner with eight seats in a row, four propellers, a pink livery and a yellow nose. */
export function makeLobbyPlane(THREE, seatsCount = 8) {
  const white = 0xf8f6ff, pink = 0xff3d8b, blue = 0x3e8ef7, yellow = 0xffd23f, glass = 0x2a4a86, metal = 0x4b4570;
  const r = 1.05, mid = 9.6;
  const seats = seatRow(THREE, seatsCount, 0.2, r - 0.08, 1.2);
  const parts = [
    { geometry: capsule(THREE, r, mid, 12, 24), color: white },
    { geometry: capsule(THREE, r * 1.012, mid, 12, 24), color: pink, at: at(THREE, 0, -0.42, 0, 0, 0, 0, 1, 0.62, 1.01) }, // livery belly
    { geometry: new THREE.ConeGeometry(r * 0.72, 1.1, 20).rotateZ(-Math.PI / 2), color: yellow, at: at(THREE, mid / 2 + r + 0.2, -0.05, 0) }, // nose
    { geometry: new THREE.SphereGeometry(0.55, 14, 10), color: glass, at: at(THREE, mid / 2 + 0.55, 0.42, 0, 0, 0, 0, 1.2, 0.6, 1.5) }, // windscreen
    { geometry: fin(THREE, [[-mid / 2 - 0.6, 0.4], [-mid / 2 + 0.9, 0.4], [-mid / 2 - 0.4, 2.7], [-mid / 2 - 1.3, 2.7]], 0.16), color: blue }, // tail fin
    { geometry: wing(THREE, [[-mid / 2 + 0.4, -0.3], [-mid / 2 - 0.6, -2.2], [-mid / 2 - 1.2, -2.2], [-mid / 2 - 0.9, -0.3]], 0.14), color: blue, at: at(THREE, 0, 0.35, 0) },
    { geometry: wing(THREE, [[-mid / 2 + 0.4, 0.3], [-mid / 2 - 0.6, 2.2], [-mid / 2 - 1.2, 2.2], [-mid / 2 - 0.9, 0.3]], 0.14), color: blue, at: at(THREE, 0, 0.35, 0) },
  ];
  for (const s of seats) parts.push(seatRing(THREE, s.x, r - 0.12));
  const spinners = [];
  for (const side of [1, -1]) {
    parts.push({ geometry: wing(THREE, [[1.6, 0.6 * side], [-0.2, 6.2 * side], [-1.2, 6.2 * side], [-0.6, 0.6 * side]], 0.18), color: white, at: at(THREE, 0, -0.35, 0) });
    parts.push({ geometry: wing(THREE, [[-0.15, 5.4 * side], [-1.25, 5.4 * side], [-1.25, 6.25 * side], [-0.25, 6.25 * side]], 0.2), color: pink, at: at(THREE, 0, -0.35, 0) }); // wing tips
    for (const z of [2.3, 4.2]) {
      const x = 1.15 - z * 0.24;
      parts.push({ geometry: capsule(THREE, 0.32, 1.0, 6, 14), color: yellow, at: at(THREE, x, -0.55, z * side) });
      spinners.push({ geometry: rotor(THREE, 1.6, 0.16, metal, 3).rotateZ(Math.PI / 2), position: new THREE.Vector3(x + 0.95, -0.55, z * side), axis: 'x', speed: side * (z > 3 ? 1.1 : 1) });
    }
  }
  for (const z of [0.55, -0.55]) parts.push({ geometry: new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8), color: metal, at: at(THREE, 3.5, -r - 0.2, z) }, { geometry: new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14).rotateX(Math.PI / 2), color: 0x2a2346, at: at(THREE, 3.5, -r - 0.55, z) });
  return { body: mergeParts(THREE, parts), seats, spinners, radius: 7.6 };
}

/** The party rocket for Ares and Luna: a red-and-white rocket with eight seats along its back, portholes, fins and a live flame. */
export function makeLobbyRocket(THREE, seatsCount = 8) {
  const white = 0xf8f6ff, red = 0xe5484d, violet = 0x8e4ec6, yellow = 0xffd23f, cyan = 0x25d1e6, metal = 0x4b4570;
  const r = 1.15, mid = 9.4;
  const seats = seatRow(THREE, seatsCount, 0.1, r - 0.08, 1.2);
  const parts = [
    { geometry: capsule(THREE, r, mid, 12, 24), color: white },
    { geometry: new THREE.ConeGeometry(r * 0.98, 2.6, 24).rotateZ(-Math.PI / 2), color: red, at: at(THREE, mid / 2 + 1.25, 0, 0) }, // nose cone
    { geometry: new THREE.ConeGeometry(0.75, 1.1, 20).rotateZ(Math.PI / 2), color: metal, at: at(THREE, -mid / 2 - 1.15, 0, 0) }, // nozzle
  ];
  for (const x of [-3.2, 2.6]) parts.push({ geometry: new THREE.CylinderGeometry(r * 1.015, r * 1.015, 0.55, 24, 1, true).rotateZ(Math.PI / 2), color: red, at: at(THREE, x, 0, 0) }); // bands
  for (const x of [-1.8, -0.2, 1.4]) parts.push({ geometry: new THREE.CylinderGeometry(0.3, 0.3, 0.12, 16).rotateX(Math.PI / 2), color: cyan, at: at(THREE, x, -0.25, r - 0.02) }, { geometry: new THREE.TorusGeometry(0.32, 0.07, 8, 18), color: yellow, at: at(THREE, x, -0.25, r + 0.02) }); // portholes
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) parts.push({ geometry: fin(THREE, [[-mid / 2 + 0.6, 0.8], [-mid / 2 - 1.1, 2.4], [-mid / 2 - 1.5, 2.4], [-mid / 2 - 1.2, 0.8]], 0.18), color: a % Math.PI ? violet : red, at: at(THREE, 0, 0, 0, a + Math.PI / 4, 0, 0) });
  for (const s of seats) parts.push(seatRing(THREE, s.x, r - 0.12));
  const flame = mergeParts(THREE, [
    { geometry: new THREE.ConeGeometry(0.62, 2.4, 16).rotateZ(Math.PI / 2).translate(-1.2, 0, 0), color: 0xff8a1f },
    { geometry: new THREE.ConeGeometry(0.36, 1.5, 14).rotateZ(Math.PI / 2).translate(-0.85, 0, 0), color: 0xffe36b },
  ]);
  return { body: mergeParts(THREE, parts), seats, spinners: [], flame, flameAt: new THREE.Vector3(-mid / 2 - 1.65, 0, 0), radius: 8.2, tilt: 0.14 };
}

/** The vehicle for a kind: 'helicopter' (Solo), 'plane' (a party bound for Gaia) or 'rocket' (Ares and Luna). */
export function makeLobbyVehicle(THREE, kind) {
  if (kind === 'helicopter') return makeHelicopter(THREE);
  if (kind === 'rocket') return makeLobbyRocket(THREE);
  return makeLobbyPlane(THREE);
}

/** Which vehicle a lobby shows: Solo flies the helicopter; a party takes the plane to Gaia and the rocket to Ares or Luna. */
export function lobbyVehicleFor({ solo = false, destination = 'gaia' } = {}) {
  if (solo) return 'helicopter';
  return destination === 'ares' || destination === 'luna' ? 'rocket' : 'plane';
}
