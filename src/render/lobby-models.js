/**
 * 3D vehicles for the lobbies (owner, 2026-11-16): a helicopter that carries the Solo player's ball, a toy airliner with eight seats
 * for a party bound for Gaia, and an eight-seat rocket for Ares and Luna. Original models in the toon style of the sky models
 * (sky-models.js): one vertex-coloured body per vehicle, drawn with clean cel shading and an ink hull.
 *
 * The plane and rocket seat their passengers in a row under a long glass canopy along the top, each ball in front of its own seat
 * back, so every ball is easy to see. Units: a ball is 1 across (radius 0.5). Local axes: +x forward (nose), +y up, +z toward the
 * viewer's side. Each builder returns { body, glass, seats, spinners, flame?, flameAt?, tilt?, drop }: `seats` are ball centres,
 * `spinners` parts that turn about `axis` (rotors and fans), `flame` the rocket's exhaust, `drop` how far below a seat the belly is.
 * `THREE` is injected.
 */
import { mergeParts } from './sky-models.js';

export const LOBBY_VEHICLES = Object.freeze(['helicopter', 'plane', 'rocket']);
export const BALL_RADIUS = 0.5;
const SEAT_STEP = 1.4;

const at = (THREE, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/** A flat fin from an outline of [x, y] points, `thick` deep, centred on z = 0 (it stands upright in the x/y plane). */
function fin(THREE, points, thick) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }).translate(0, 0, -thick / 2);
}

/** A flat wing from an outline of [x, z] points, `thick` tall, lying in the x/z plane. */
function wing(THREE, points, thick) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 2 }).rotateX(-Math.PI / 2).translate(0, -thick / 2, 0);
}

/** A capsule lying along x: `length` is the straight middle, `r` the radius. */
const capsule = (THREE, r, length, cap = 12, radial = 28) => new THREE.CapsuleGeometry(r, length, cap, radial).rotateZ(Math.PI / 2);

/** Blades round a hub, turning about +y; the caller orients it. */
function rotor(THREE, span, chord, color, count = 2) {
  const parts = [{ geometry: new THREE.CylinderGeometry(0.16, 0.16, 0.16, 14), color: 0x3b3557 }];
  for (let k = 0; k < count; k++) parts.push({ geometry: new THREE.BoxGeometry(span, 0.05, chord), color, at: at(THREE, 0, 0, 0, 0, k * Math.PI / count, 0) });
  return mergeParts(THREE, parts);
}

/** `count` seats in a row, `SEAT_STEP` apart, centred on `cx`, balls resting at height `y`. */
const seatRow = (THREE, count, cx, y) => Array.from({ length: count }, (_, i) => new THREE.Vector3(cx + (i - (count - 1) / 2) * SEAT_STEP, y, 0));

/** The cabin under a canopy: a dark floor strip, and a coloured seat back behind each ball. */
function cabin(THREE, seats, floorY, length, seatColor) {
  const parts = [{ geometry: new THREE.BoxGeometry(length, 0.1, 1.05), color: 0x2a2346, at: at(THREE, seats.reduce((s, p) => s + p.x, 0) / seats.length, floorY, 0) }];
  for (const s of seats) parts.push({ geometry: new THREE.BoxGeometry(0.2, 0.9, 0.9), color: seatColor, at: at(THREE, s.x - 0.62, floorY + 0.48, 0, 0, 0, -0.12) });
  return parts;
}

/** The Solo helicopter: an orange cabin with a glass bubble at the nose where the ball rides, a striped tail and a two-blade rotor. */
export function makeHelicopter(THREE) {
  const orange = 0xff8a1f, deep = 0xe5631a, pink = 0xff3d8b, yellow = 0xffd23f, metal = 0x4b4570;
  const parts = [
    { geometry: new THREE.SphereGeometry(1, 28, 20), color: orange, at: at(THREE, -0.35, 1.45, 0, 0, 0, 0, 1.55, 1.1, 1.05) },
    { geometry: new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4), color: deep, at: at(THREE, -0.35, 1.44, 0, 0, 0, 0, 1.56, 1.11, 1.06) }, // darker belly
    { geometry: new THREE.CylinderGeometry(0.3, 0.15, 3.4, 16).rotateZ(Math.PI / 2), color: orange, at: at(THREE, -3.3, 1.75, 0) }, // tail boom
    { geometry: new THREE.CylinderGeometry(0.235, 0.205, 0.9, 16).rotateZ(Math.PI / 2), color: pink, at: at(THREE, -2.6, 1.75, 0) }, // boom stripe
    { geometry: fin(THREE, [[-5.1, 1.6], [-4.6, 1.6], [-4.75, 3.0], [-5.25, 3.05]], 0.14), color: yellow }, // tail fin
    { geometry: wing(THREE, [[-4.3, -0.9], [-3.8, -0.9], [-3.8, 0.9], [-4.3, 0.9]], 0.1), color: yellow, at: at(THREE, 0, 1.75, 0) }, // stabiliser
    { geometry: new THREE.CylinderGeometry(0.16, 0.2, 0.55, 14), color: metal, at: at(THREE, -0.3, 2.75, 0) }, // mast
    { geometry: new THREE.SphereGeometry(0.4, 16, 12), color: orange, at: at(THREE, -0.3, 2.5, 0, 0, 0, 0, 1.5, 0.75, 1) }, // engine hump
    { geometry: new THREE.BoxGeometry(0.16, 0.85, 0.8), color: pink, at: at(THREE, 0.35, 1.2, 0, 0, 0, -0.12) }, // seat back
  ];
  for (const z of [0.85, -0.85]) {
    parts.push({ geometry: capsule(THREE, 0.09, 3.2, 4, 10), color: metal, at: at(THREE, -0.2, 0.12, z) }); // skid
    for (const x of [-1.1, 0.6]) parts.push({ geometry: new THREE.CylinderGeometry(0.07, 0.07, 0.75, 8), color: metal, at: at(THREE, x, 0.5, z * 0.8, z > 0 ? 0.35 : -0.35, 0, 0) });
  }
  return {
    body: mergeParts(THREE, parts),
    glass: new THREE.SphereGeometry(1, 28, 20).applyMatrix4(at(THREE, 0.95, 1.4, 0, 0, 0, 0, 1.0, 0.9, 0.82)),
    seats: [new THREE.Vector3(1.0, 1.15, 0)],
    spinners: [
      { geometry: rotor(THREE, 7.2, 0.42, 0x3b3557), position: new THREE.Vector3(-0.3, 3.05, 0), axis: 'y', speed: 1 },
      { geometry: rotor(THREE, 1.5, 0.18, 0x3b3557).rotateX(Math.PI / 2), position: new THREE.Vector3(-4.95, 2.35, 0.2), axis: 'z', speed: 1.6 },
    ],
    drop: 1.6,
  };
}

/** The party plane for Gaia: a toy airliner with a glass canopy over eight seats, swept wings, two jet engines and a blue tail. */
export function makeLobbyPlane(THREE, seatsCount = 8) {
  const white = 0xf8f6ff, blue = 0x3e8ef7, pink = 0xff3d8b, yellow = 0xffd23f, ink = 0x2a2346, glassDark = 0x23407a;
  const r = 1.15, mid = 11.6, floor = 0.62;
  const seats = seatRow(THREE, seatsCount, 0.1, floor + 0.55);
  const parts = [
    { geometry: capsule(THREE, r, mid), color: white },
    { geometry: capsule(THREE, r * 1.01, mid), color: blue, at: at(THREE, 0, -0.5, 0, 0, 0, 0, 1, 0.55, 1.01) }, // blue belly
    { geometry: capsule(THREE, r * 1.02, mid), color: pink, at: at(THREE, 0, -0.08, 0, 0, 0, 0, 1, 0.09, 1.02) }, // pink cheatline
    { geometry: new THREE.SphereGeometry(0.62, 18, 12), color: glassDark, at: at(THREE, mid / 2 + 0.55, 0.5, 0, 0, 0, -0.35, 1.0, 0.45, 1.45) }, // cockpit windscreen
    { geometry: fin(THREE, [[-mid / 2 - 0.4, 0.5], [-mid / 2 + 1.3, 0.5], [-mid / 2 - 0.4, 3.3], [-mid / 2 - 1.4, 3.3]], 0.2), color: blue }, // tail fin
    { geometry: new THREE.CylinderGeometry(0.38, 0.38, 0.26, 20).rotateX(Math.PI / 2), color: yellow, at: at(THREE, -mid / 2 - 0.35, 2.35, 0) }, // ball logo on the fin
    ...cabin(THREE, seats, floor, SEAT_STEP * seatsCount + 0.4, pink),
  ];
  for (const side of [1, -1]) {
    for (let k = 0; k < 9; k++) parts.push({ geometry: new THREE.CylinderGeometry(0.15, 0.15, 0.1, 12).rotateX(Math.PI / 2), color: glassDark, at: at(THREE, -4.6 + k * 1.15, 0.12, side * (r - 0.02)) }); // cabin windows
    parts.push({ geometry: wing(THREE, [[1.8, 0.7 * side], [-0.6, 6.6 * side], [-1.6, 6.6 * side], [-0.9, 0.7 * side]], 0.2), color: white, at: at(THREE, 0, -0.55, 0) });
    parts.push({ geometry: wing(THREE, [[-0.55, 5.9 * side], [-1.55, 5.9 * side], [-1.62, 6.65 * side], [-0.62, 6.65 * side]], 0.22), color: pink, at: at(THREE, 0, -0.55, 0) }); // wing tips
    parts.push({ geometry: wing(THREE, [[-mid / 2 + 0.2, 0.3 * side], [-mid / 2 - 0.9, 2.5 * side], [-mid / 2 - 1.5, 2.5 * side], [-mid / 2 - 1.2, 0.3 * side]], 0.14), color: blue, at: at(THREE, 0, 0.2, 0) }); // stabilisers
    parts.push({ geometry: capsule(THREE, 0.5, 1.3, 8, 20), color: blue, at: at(THREE, 0.6, -1.05, 2.9 * side) }); // jet engine
    parts.push({ geometry: new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20).rotateZ(Math.PI / 2), color: ink, at: at(THREE, 1.62, -1.05, 2.9 * side) }); // intake
  }
  const fan = () => rotor(THREE, 0.78, 0.14, 0xd8dce8, 3).rotateZ(Math.PI / 2);
  return {
    body: mergeParts(THREE, parts),
    glass: capsule(THREE, 0.7, SEAT_STEP * seatsCount - 0.2).applyMatrix4(at(THREE, 0.1, floor + 0.45, 0, 0, 0, 0, 1, 1.0, 1.0)),
    seats,
    spinners: [1, -1].map(side => ({ geometry: fan(), position: new THREE.Vector3(1.7, -1.05, 2.9 * side), axis: 'x', speed: 2 })),
    drop: 2.5,
  };
}

/** The party rocket for Ares and Luna: red and white, a glass canopy over eight seats, portholes, four fins and a live flame. */
export function makeLobbyRocket(THREE, seatsCount = 8) {
  const white = 0xf8f6ff, red = 0xe5484d, violet = 0x8e4ec6, yellow = 0xffd23f, cyan = 0x25d1e6, metal = 0x4b4570;
  const r = 1.25, mid = 11.6, floor = 0.72;
  const seats = seatRow(THREE, seatsCount, -0.2, floor + 0.55);
  const parts = [
    { geometry: capsule(THREE, r, mid), color: white },
    { geometry: new THREE.ConeGeometry(r * 0.98, 3.0, 28).rotateZ(-Math.PI / 2), color: red, at: at(THREE, mid / 2 + 1.45, 0, 0) }, // nose cone
    { geometry: new THREE.ConeGeometry(0.85, 1.2, 22).rotateZ(Math.PI / 2), color: metal, at: at(THREE, -mid / 2 - 1.25, 0, 0) }, // nozzle
    ...cabin(THREE, seats, floor, SEAT_STEP * seatsCount + 0.4, violet),
  ];
  for (const x of [-4.4, 4.0]) parts.push({ geometry: new THREE.CylinderGeometry(r * 1.015, r * 1.015, 0.6, 28, 1, true).rotateZ(Math.PI / 2), color: red, at: at(THREE, x, 0, 0) }); // bands
  for (const side of [1, -1]) for (const x of [-2.6, -0.4, 1.8]) {
    parts.push({ geometry: new THREE.CylinderGeometry(0.34, 0.34, 0.1, 18).rotateX(Math.PI / 2), color: cyan, at: at(THREE, x, -0.35, side * (r - 0.03)) });
    parts.push({ geometry: new THREE.TorusGeometry(0.36, 0.07, 8, 20), color: yellow, at: at(THREE, x, -0.35, side * (r + 0.02)) }); // portholes
  }
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) parts.push({ geometry: fin(THREE, [[-mid / 2 + 0.8, 0.9], [-mid / 2 - 1.2, 2.7], [-mid / 2 - 1.7, 2.7], [-mid / 2 - 1.3, 0.9]], 0.2), color: a % Math.PI ? violet : red, at: at(THREE, 0, 0, 0, a + Math.PI / 4, 0, 0) });
  const flame = mergeParts(THREE, [
    { geometry: new THREE.ConeGeometry(0.7, 2.8, 18).rotateZ(Math.PI / 2).translate(-1.4, 0, 0), color: 0xff8a1f },
    { geometry: new THREE.ConeGeometry(0.42, 1.8, 16).rotateZ(Math.PI / 2).translate(-1.0, 0, 0), color: 0xffe36b },
  ]);
  return {
    body: mergeParts(THREE, parts),
    glass: capsule(THREE, 0.72, SEAT_STEP * seatsCount - 0.2).applyMatrix4(at(THREE, -0.2, floor + 0.45, 0)),
    seats, spinners: [], flame, flameAt: new THREE.Vector3(-mid / 2 - 1.85, 0, 0), tilt: 0.1, drop: 2.6,
  };
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
