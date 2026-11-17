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
 * The Solo helicopter (owner, 2026-11-17: cleaner), in the party plane's livery: one smooth teardrop fuselage that tapers into the
 * tail boom, white above and blue below with a pink cheatline. Its nose is a clear glass dome over a blue tub where the ball rides,
 * like a bubble cockpit. A yellow fin and stabiliser, a pink tail rotor, slim skids and a two-blade rotor with yellow tips.
 */
export function makeHelicopter(THREE) {
  const white = 0xf8f6ff, blue = 0x3e8ef7, pink = 0xff3d8b, yellow = 0xffd23f, metal = 0x4b4570, dark = 0x2a2346;
  const Y = 1.45; // the fuselage axis height: the skids rest on y = 0
  const SEAM = 0.15; // where the glass nose meets the painted body (x)
  // The teardrop's radius along the fuselage (x, nose at +x): a round nose, a full cabin, then a long taper into the boom.
  const profile = [[1.75, 0], [1.68, 0.42], [1.5, 0.72], [1.2, 0.95], [0.75, 1.08], [SEAM, 1.12], [-0.5, 1.08], [-1.1, 0.9], [-1.6, 0.6],
    [-2.1, 0.36], [-2.6, 0.27], [-4.3, 0.2], [-4.75, 0.17], [-4.85, 0]];
  const radiusAt = x => {
    for (let k = 1; k < profile.length; k++) {
      const [x0, r0] = profile[k - 1], [x1, r1] = profile[k];
      if (x <= x0 && x >= x1) return r0 + (r1 - r0) * (x0 - x) / (x0 - x1);
    }
    return 0;
  };
  /** A lathe of the profile between x = from and x = to, around the fuselage axis; `half` 'low', 'high' or 'all'. */
  const shell = (from, to, half, grow = 1, phi = null) => {
    const pts = [];
    for (const [x, r] of profile) if (x <= from + 1e-6 && x >= to - 1e-6) pts.push([x, r]);
    if (pts[0][0] < from) pts.unshift([from, radiusAt(from)]);
    if (pts[pts.length - 1][0] > to) pts.push([to, radiusAt(to)]);
    // Lathe points run along y; after rotateZ(-π/2) y becomes +x, and phi 0..π faces down.
    const lathe = new THREE.LatheGeometry(pts.reverse().map(([x, r]) => new THREE.Vector2(r * grow, x)), 48,
      phi ? phi[0] : half === 'high' ? Math.PI : 0, phi ? phi[1] : half === 'all' ? Math.PI * 2 : Math.PI);
    return lathe.rotateZ(-Math.PI / 2).translate(0, Y, 0);
  };
  // The cabin floor: the fuselage's cross-section at the floor's height, from the canopy frame to the nose.
  const cabinFloor = () => {
    const d = 0.42, outline = [];
    for (let x = SEAM; x <= 1.7; x += 0.05) outline.push([x, Math.sqrt(Math.max(0, radiusAt(x) ** 2 - d * d)) * 0.98]);
    const shape = new THREE.Shape(outline.map(([x, w]) => new THREE.Vector2(x, w)).concat(outline.reverse().map(([x, w]) => new THREE.Vector2(x, -w))));
    return new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2).translate(0, Y - d, 0);
  };
  const parts = [
    { geometry: shell(SEAM, -4.85, 'high'), color: white }, // body and boom, top
    { geometry: shell(SEAM, -4.85, 'low'), color: blue }, // belly
    { geometry: shell(1.75, SEAM, 'low'), color: blue }, // the tub the ball rides in
    { geometry: new THREE.TorusGeometry(1.12, 0.05, 10, 48).rotateY(Math.PI / 2), color: blue, at: at(THREE, SEAM, Y, 0) }, // the canopy frame
    ...[-0.13, Math.PI - 0.13].map(start => ({ geometry: shell(SEAM, -2.2, 'all', 1.012, [start, 0.26]), color: pink })), // cheatline, both sides
    { geometry: cabinFloor(), color: 0x2d6fd0 }, // the tub's floor, under the ball
    { geometry: new THREE.CircleGeometry(1.1, 48).rotateY(Math.PI / 2), color: white, at: at(THREE, SEAM - 0.02, Y, 0) }, // the cabin's back wall behind the ball
    { geometry: new THREE.TorusGeometry(0.27, 0.06, 8, 24).rotateY(Math.PI / 2), color: pink, at: at(THREE, -2.6, Y, 0) }, // boom band
    { geometry: new THREE.TorusGeometry(0.235, 0.06, 8, 24).rotateY(Math.PI / 2), color: blue, at: at(THREE, -3.2, Y, 0) }, // boom band
    { geometry: fin(THREE, [[-4.85, Y - 0.1], [-4.25, Y - 0.1], [-4.45, Y + 1.25], [-4.95, Y + 1.35]], 0.16), color: yellow }, // tail fin
    { geometry: fin(THREE, [[-4.95, Y + 1.0], [-4.48, Y + 1.0], [-4.45, Y + 1.25], [-4.95, Y + 1.35]], 0.2), color: pink }, // fin tip
    { geometry: wing(THREE, [[-4.15, -0.85], [-3.7, -0.85], [-3.55, 0.85], [-4.0, 0.85]], 0.1), color: yellow, at: at(THREE, 0, Y + 0.05, 0) }, // stabiliser
    { geometry: new THREE.CylinderGeometry(0.35, 0.55, 0.32, 24), color: white, at: at(THREE, -0.45, Y + 1.12, 0) }, // rotor fairing
    { geometry: new THREE.CylinderGeometry(0.1, 0.13, 0.4, 14), color: metal, at: at(THREE, -0.45, Y + 1.45, 0) }, // mast
  ];
  for (const side of [1, -1]) {
    parts.push({ geometry: capsule(THREE, 0.09, 2.9, 4, 12), color: metal, at: at(THREE, -0.25, 0.1, side * 0.85) }); // skid
    for (const x of [-1.05, 0.55]) parts.push({ geometry: new THREE.CylinderGeometry(0.065, 0.065, 0.95, 10), color: metal, at: at(THREE, x, 0.52, side * 0.68, side * 0.42, 0, 0) });
  }
  const blades = (span, chord, tip) => {
    const list = [{ geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.16, 16), color: yellow }];
    const turn = at(THREE, 0, 0, 0, 0, 0, 0);
    list.push({ geometry: new THREE.BoxGeometry(span, 0.06, chord).applyMatrix4(turn), color: dark });
    for (const end of [1, -1]) list.push({ geometry: new THREE.BoxGeometry(tip, 0.07, chord * 1.02).translate(end * (span - tip) / 2, 0, 0).applyMatrix4(turn), color: yellow });
    return mergeParts(THREE, list);
  };
  const tail = mergeParts(THREE, [
    { geometry: new THREE.CylinderGeometry(0.12, 0.12, 0.12, 14), color: yellow },
    { geometry: new THREE.BoxGeometry(1.0, 0.05, 0.16), color: pink },
  ]).rotateX(Math.PI / 2);
  return {
    body: mergeParts(THREE, parts),
    glass: shell(1.75, SEAM - 0.02, 'high', 1.0),
    seats: [new THREE.Vector3(0.75, Y + 0.12, 0)],
    spinners: [
      { geometry: blades(7.2, 0.38, 0.65), position: new THREE.Vector3(-0.45, Y + 1.7, 0), axis: 'y', speed: 1 },
      { geometry: tail, position: new THREE.Vector3(-4.45, Y + 0.55, -0.22), axis: 'z', speed: 1.6 },
    ],
    drop: Y + 0.12 - 0.05, // the skids below the ball
    rise: Y + 1.7 - (Y + 0.12) - 0.5, // the rotor above it
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
