/**
 * 3D vehicles for the lobbies (owner, 2026-11-16): a helicopter that carries the Solo player's ball, a toy airliner with eight seats
 * for a party bound for Gaia, and an eight-seat rocket for Ares and Luna. Original models in the toon style of the sky models
 * (sky-models.js): one vertex-coloured body per vehicle, drawn with clean cel shading and an ink hull.
 *
 * The plane and rocket seat their passengers in a row under a long glass canopy along the top, each ball in front of its own seat
 * back, so every ball is easy to see. Units: a ball is 1 across (radius 0.5). Local axes: +x forward (nose), +y up, +z toward the
 * viewer's side. Each builder returns { body, glass, seats, spinners, flame?, flameAt?, tilt?, drop }: `seats` are ball centres,
 * `spinners` parts that turn about `axis` (rotors and fans), `flame` the rocket's exhaust, `drop` how far below a seat the belly is,
 * `rise` how far above it the roof is (0 when the ball rides on top).
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

/**
 * `count` seats in a row, `SEAT_STEP` apart, centred on `cx`, balls resting at height `y`. Seat 1 is at the front (nose, +x) and the
 * row fills toward the tail (owner, 2026-11-17), so the first player to join sits up front.
 */
const seatRow = (THREE, count, cx, y) => Array.from({ length: count }, (_, i) => new THREE.Vector3(cx - (i - (count - 1) / 2) * SEAT_STEP, y, 0));

/** The cabin under a canopy: a dark floor strip, and a coloured seat back behind each ball. */
function cabin(THREE, seats, floorY, length, seatColor) {
  const parts = [{ geometry: new THREE.BoxGeometry(length, 0.1, 1.05), color: 0x2a2346, at: at(THREE, seats.reduce((s, p) => s + p.x, 0) / seats.length, floorY, 0) }];
  for (const s of seats) parts.push({ geometry: new THREE.BoxGeometry(0.2, 0.9, 0.9), color: seatColor, at: at(THREE, s.x - 0.62, floorY + 0.48, 0, 0, 0, -0.12) });
  return parts;
}

/**
 * The Solo helicopter, in the party plane's livery: a white cabin with a blue belly and a pink cheatline, a clear bubble at the nose
 * over a blue tub where the ball rides, a white tail boom with a blue band, a yellow fin and stabiliser, skids and a rotor with
 * yellow tips.
 */
export function makeHelicopter(THREE) {
  const white = 0xf8f6ff, blue = 0x3e8ef7, pink = 0xff3d8b, yellow = 0xffd23f, metal = 0x4b4570, dark = 0x2a2346, glassDark = 0x23407a;
  const cabin = (x, y, sx, sy, sz) => at(THREE, x, y, 0, 0, 0, 0, sx, sy, sz);
  const bubble = at(THREE, 0.95, 1.45, 0, 0, 0, 0, 1.05, 0.95, 0.9);
  const parts = [
    { geometry: new THREE.SphereGeometry(1, 32, 22), color: white, at: cabin(-0.65, 1.45, 1.35, 1.05, 1.0) }, // cabin
    { geometry: new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42), color: blue, at: cabin(-0.65, 1.44, 1.36, 1.06, 1.01) }, // blue belly
    { geometry: new THREE.CylinderGeometry(1, 1, 0.16, 32, 1, true), color: pink, at: cabin(-0.65, 1.3, 1.335, 1, 0.995) }, // cheatline
    { geometry: new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, Math.PI * 0.7, Math.PI * 0.3), color: blue, at: bubble }, // the tub under the bubble
    { geometry: new THREE.TorusGeometry(1, 0.05, 8, 40).rotateX(Math.PI / 2), color: pink, at: at(THREE, 0.95, 1.45 - 0.95 * Math.cos(Math.PI * 0.3), 0, 0, 0, 0, 1.05 * Math.sin(Math.PI * 0.3), 1, 0.9 * Math.sin(Math.PI * 0.3)) }, // tub rim
    { geometry: new THREE.CylinderGeometry(0.34, 0.16, 3.6, 20).rotateZ(Math.PI / 2), color: white, at: at(THREE, -3.5, 1.75, 0) }, // tail boom
    { geometry: new THREE.CylinderGeometry(0.29, 0.255, 0.55, 20, 1, true).rotateZ(Math.PI / 2), color: blue, at: at(THREE, -2.75, 1.75, 0, 0, 0, 0, 1, 1.03, 1.03) }, // boom band
    { geometry: new THREE.CylinderGeometry(0.235, 0.215, 0.3, 20, 1, true).rotateZ(Math.PI / 2), color: pink, at: at(THREE, -3.6, 1.75, 0, 0, 0, 0, 1, 1.03, 1.03) }, // boom stripe
    { geometry: fin(THREE, [[-5.35, 1.6], [-4.75, 1.6], [-4.95, 3.0], [-5.5, 3.1]], 0.16), color: yellow }, // tail fin
    { geometry: fin(THREE, [[-5.5, 2.75], [-4.98, 2.75], [-4.95, 3.0], [-5.5, 3.1]], 0.2), color: pink }, // fin tip
    { geometry: wing(THREE, [[-4.4, -1.0], [-3.9, -1.0], [-3.75, 1.0], [-4.25, 1.0]], 0.12), color: yellow, at: at(THREE, 0, 1.72, 0) }, // stabiliser
    { geometry: new THREE.SphereGeometry(0.5, 20, 14), color: white, at: at(THREE, -0.75, 2.45, 0, 0, 0, 0, 1.7, 0.7, 1.0) }, // engine cowling
    { geometry: new THREE.CylinderGeometry(0.12, 0.12, 0.3, 14).rotateZ(Math.PI / 2), color: dark, at: at(THREE, -1.65, 2.45, 0) }, // exhaust
    { geometry: new THREE.CylinderGeometry(0.13, 0.17, 0.5, 14), color: metal, at: at(THREE, -0.6, 2.85, 0) }, // mast
  ];
  for (const side of [1, -1]) {
    parts.push({ geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16).rotateX(Math.PI / 2), color: glassDark, at: at(THREE, -1.05, 1.62, side * 0.985) }); // cabin window
    parts.push({ geometry: capsule(THREE, 0.1, 3.0, 4, 12), color: metal, at: at(THREE, -0.3, 0.12, side * 0.9) }); // skid
    for (const x of [-1.25, 0.55]) parts.push({ geometry: new THREE.CylinderGeometry(0.075, 0.075, 0.8, 10), color: metal, at: at(THREE, x, 0.5, side * 0.72, side * 0.4, 0, 0) });
  }
  const blades = (span, chord, tip) => {
    const list = [{ geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.18, 16), color: yellow }];
    for (let k = 0; k < 2; k++) {
      const turn = at(THREE, 0, 0, 0, 0, k * Math.PI / 2, 0);
      list.push({ geometry: new THREE.BoxGeometry(span, 0.06, chord).applyMatrix4(turn), color: dark });
      for (const end of [1, -1]) list.push({ geometry: new THREE.BoxGeometry(tip, 0.07, chord * 1.02).translate(end * (span - tip) / 2, 0, 0).applyMatrix4(turn), color: yellow });
    }
    return mergeParts(THREE, list);
  };
  // Built at 1.3 times the scale above, so the ball sits snugly inside the bubble with room around it.
  const grow = 1.3, scale = new THREE.Matrix4().makeScale(grow, grow, grow);
  return {
    body: mergeParts(THREE, parts).applyMatrix4(scale),
    glass: new THREE.SphereGeometry(1, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.72).applyMatrix4(bubble).applyMatrix4(scale),
    seats: [new THREE.Vector3(1.0 * grow, 1.18 * grow + 0.15, 0)],
    spinners: [
      { geometry: blades(7.4, 0.4, 0.7).applyMatrix4(scale), position: new THREE.Vector3(-0.6, 3.15, 0).multiplyScalar(grow), axis: 'y', speed: 1 },
      { geometry: blades(1.5, 0.18, 0.3).rotateX(Math.PI / 2).applyMatrix4(scale), position: new THREE.Vector3(-5.2, 2.35, 0.22).multiplyScalar(grow), axis: 'z', speed: 1.6 },
    ],
    drop: 1.7, // the skids below the ball
    rise: 1.9, // the rotor above it
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
