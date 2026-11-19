/**
 * 3D vehicles for the lobbies (owner, 2026-11-16): a helicopter that carries the Solo player's ball, a toy airliner with eight seats
 * for a party bound for Gaia, and an eight-seat rocket for Ares and Luna. Original models in the toon style of the sky models
 * (sky-models.js): one vertex-coloured body per vehicle, drawn with clean cel shading and an ink hull.
 *
 * The plane and rocket seat their passengers in a row under a long glass canopy along the top, each ball in front of its own seat
 * back, so every ball is easy to see. Units: a ball is 1 across (radius 0.5). Local axes: +x forward (nose), +y up, +z toward the
 * viewer's side. Each builder returns { body, glass, seats, spinners, flame?, flameAt?, tilt?, drop }: `seats` are ball centres,
 * `spinners` parts that turn about `axis` (rotors and fans), `flame` the rocket's exhaust, `inner` an optional cabin interior drawn without ink, `trails`
 * [x, y, z, length] points the air streams back from (engines, exhausts, tips), `drop` how far below a seat the belly is,
 * `rise` how far above it the roof is (0 when the ball rides on top).
 * `room` (optional, default 1) scales the space framed round the vehicle.
 * `THREE` is injected.
 */
import { mergeParts } from './sky-models.js';

export const LOBBY_VEHICLES = Object.freeze(['helicopter', 'plane', 'rocket', 'minirocket']);
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

/** `color` mixed toward ink by `k` (0..1): the darker partner of an accent colour. */
const shade = (THREE, color, k) => new THREE.Color(color).lerp(new THREE.Color(0x2a2346), k).getHex();

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

/** The same geometry seen from inside: winding and normals reversed, so a lining shows its inner face. */
function inward(THREE, geometry) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = flat.attributes.position.array, n = flat.attributes.normal.array;
  for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) {
    [p[i + 3 + k], p[i + 6 + k]] = [p[i + 6 + k], p[i + 3 + k]];
    [n[i + 3 + k], n[i + 6 + k]] = [n[i + 6 + k], n[i + 3 + k]];
  }
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  return flat;
}

/**
 * The Solo helicopter (owner, 2026-11-17: cleaner, the player in an opening in the side): a smooth white pod with a blue belly that
 * tapers into a slim tail boom, a dark wraparound windscreen and a rounded engine housing under a two-blade rotor. A wide doorway
 * on the viewer's side stands open, framed in yellow, and the ball sits out in it on a blue floor
 * against a violet seat back, inside a soft lilac cabin. A blue fin and stabiliser with yellow tips, a pink tail rotor, slim skids.
 * `accent` (owner, 2026-11-19) paints the coloured parts (the belly, boom band, fin, stabiliser and cabin floor) in the player's ball
 * colour; the blue is the default.
 */
export function makeHelicopter(THREE, accent = null) {
  const white = 0xf8f6ff, blue = accent ?? 0x3e8ef7, pink = 0xff3d8b, yellow = 0xffd23f, metal = 0x8f8bb3, dark = 0x3b3557, screen = 0x2c5cb8, seatColor = 0x5a4fb0;
  const Y = 1.5; // the fuselage axis height: the skids rest on y = 0
  const R = 1.1; // the cabin's radius, constant through the doorway
  const DOOR = [-0.85, 0.98], A = 1.05; // the doorway along x, and its half-angle around the side facing the viewer (-z)
  // The pod's radius along the fuselage (x, nose at +x): a round nose, a straight cabin, then a smooth taper into the boom.
  const profile = [[2.05, 0], [2.0, 0.42], [1.86, 0.72], [1.64, 0.92], [1.34, 1.05], [1.0, R], [-0.9, R], [-1.35, 1.0], [-1.8, 0.76],
    [-2.25, 0.44], [-2.65, 0.29], [-4.4, 0.2], [-4.8, 0.17], [-4.9, 0]];
  const radiusAt = x => {
    for (let k = 1; k < profile.length; k++) {
      const [x0, r0] = profile[k - 1], [x1, r1] = profile[k];
      if (x <= x0 && x >= x1) return r0 + (r1 - r0) * (x0 - x) / (x0 - x1);
    }
    return 0;
  };
  /**
   * A lathe of the profile between x = from and x = to around the fuselage axis, over angles [start, start + length]. After the
   * turn onto x, angle 0 faces the viewer (-z: the lobby turns the nose to the left, so -z is the near side), π/2 down, π away
   * and 3π/2 up.
   */
  const shell = (from, to, start, length, grow = 1) => {
    const pts = profile.filter(([x]) => x <= from + 1e-6 && x >= to - 1e-6);
    if (!pts.length || pts[0][0] < from) pts.unshift([from, radiusAt(from)]);
    if (pts[pts.length - 1][0] > to) pts.push([to, radiusAt(to)]);
    return new THREE.LatheGeometry(pts.reverse().map(([x, r]) => new THREE.Vector2(r * grow, x)), 56, Math.PI - start - length, length)
      .rotateZ(-Math.PI / 2).translate(0, Y, 0);
  };
  const UP = [Math.PI, Math.PI], DOWN = [0, Math.PI]; // the top and bottom halves
  /** The pod in two colours with the doorway left open: top white, belly blue (or one colour, for the lining). */
  const pod = (grow, top, belly) => [
    { geometry: shell(2.05, DOOR[1], ...UP, grow), color: top }, { geometry: shell(2.05, DOOR[1], ...DOWN, grow), color: belly },
    { geometry: shell(DOOR[0], -4.9, ...UP, grow), color: top }, { geometry: shell(DOOR[0], -4.9, ...DOWN, grow), color: belly },
    { geometry: shell(DOOR[1], DOOR[0], Math.PI, Math.PI - A, grow), color: top }, // above and behind the doorway
    { geometry: shell(DOOR[1], DOOR[0], A, Math.PI - A, grow), color: belly }, // below it
  ];
  const side = phi => [-Math.sin(phi), -Math.cos(phi)]; // [y, z] of angle phi on the fuselage, per unit radius
  const [railTop, railZ] = side(-A), [railLow] = side(A);
  const doorLength = DOOR[1] - DOOR[0], doorMid = (DOOR[0] + DOOR[1]) / 2;
  const arc = () => new THREE.TorusGeometry(R * 1.01, 0.04, 8, 24, 2 * A).rotateZ(-A).rotateY(Math.PI / 2);
  const parts = [
    ...pod(1, white, blue),
    // The doorway's yellow frame: an arc at each end and a rail along the top and bottom.
    ...DOOR.map(x => ({ geometry: arc(), color: yellow, at: at(THREE, x, Y, 0) })),
    ...[railTop, railLow].map(y => ({ geometry: new THREE.CylinderGeometry(0.04, 0.04, doorLength, 10).rotateZ(Math.PI / 2), color: yellow, at: at(THREE, doorMid, Y + y * R * 1.01, railZ * R * 1.01) })),
    // The wraparound windscreen over the nose.
    { geometry: shell(1.97, 1.0, Math.PI + 0.25, Math.PI - 0.55, 1.008), color: screen },
    { geometry: shell(1.72, 1.52, Math.PI + 0.35, Math.PI - 0.75, 1.012), color: 0x9fd0ff }, // a glint across it
    // The engine housing and mast.
    { geometry: capsule(THREE, 0.4, 1.3, 10, 24), color: white, at: at(THREE, -0.25, Y + 0.95, 0, 0, 0, 0, 1, 0.8, 0.85) },
    { geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.12, 18).rotateZ(Math.PI / 2), color: dark, at: at(THREE, -1.2, Y + 0.97, 0) }, // exhaust
    { geometry: new THREE.CylinderGeometry(0.09, 0.12, 0.4, 14), color: metal, at: at(THREE, -0.1, Y + 1.38, 0) },
    // The boom: a blue band where it leaves the pod.
    { geometry: new THREE.TorusGeometry(0.29, 0.055, 8, 24).rotateY(Math.PI / 2), color: blue, at: at(THREE, -2.65, Y, 0) },
    // Tail fin and stabiliser, blue with yellow tips.
    { geometry: fin(THREE, [[-4.9, Y - 0.05], [-4.3, Y - 0.05], [-4.5, Y + 1.15], [-4.98, Y + 1.25]], 0.14), color: blue },
    { geometry: fin(THREE, [[-4.98, Y + 0.95], [-4.46, Y + 0.95], [-4.5, Y + 1.15], [-4.98, Y + 1.25]], 0.18), color: yellow },
    { geometry: wing(THREE, [[-4.15, -0.8], [-3.75, -0.8], [-3.6, 0.8], [-4.0, 0.8]], 0.09), color: blue, at: at(THREE, 0, Y + 0.05, 0) },
    ...[1, -1].map(s => ({ geometry: wing(THREE, [[-4.15, 0.65], [-3.62, 0.65], [-3.6, 0.82], [-4.0, 0.82]], 0.12), color: yellow, at: at(THREE, 0, Y + 0.05, 0, s < 0 ? Math.PI : 0, 0, 0) })),
  ];
  for (const s of [1, -1]) {
    parts.push({ geometry: capsule(THREE, 0.06, 2.6, 4, 12), color: metal, at: at(THREE, -0.05, 0.2, s * 0.85) }); // skid
    parts.push({ geometry: capsule(THREE, 0.06, 0.26, 4, 12), color: metal, at: at(THREE, 1.4, 0.29, s * 0.85, 0, 0, 0.5) }); // its upturned toe
    for (const x of [-0.75, 0.7]) parts.push({ geometry: new THREE.CylinderGeometry(0.045, 0.045, 0.75, 10), color: metal, at: at(THREE, x, 0.55, s * 0.74, s * 0.3, 0, 0) });
  }
  // The cabin, seen through the doorway (no ink): a lilac lining, a blue floor and a violet seat back against the far wall.
  const FLOOR = Y - 0.5, d = Y - FLOOR, outline = [];
  for (let x = -1.2; x <= 1.75; x += 0.05) outline.push([x, Math.sqrt(Math.max(0, (radiusAt(x) * 0.95) ** 2 - d * d))]);
  const floorShape = new THREE.Shape(outline.map(([x, w]) => new THREE.Vector2(x, w)).concat([...outline].reverse().map(([x, w]) => new THREE.Vector2(x, -w))));
  const inner = mergeParts(THREE, [
    ...pod(0.95, 0xd9dcf2, 0xb3b6dc).map(p => ({ ...p, geometry: inward(THREE, p.geometry) })),
    { geometry: new THREE.ShapeGeometry(floorShape).rotateX(Math.PI / 2), color: accent === null ? 0x3a5fae : shade(THREE, accent, 0.35), at: at(THREE, 0, FLOOR, 0) },
    { geometry: new THREE.BoxGeometry(1.05, 1.0, 0.16), color: seatColor, at: at(THREE, 0.1, Y + 0.05, 0.62, -0.1, 0, 0) }, // seat back
    { geometry: new THREE.BoxGeometry(1.05, 0.16, 0.5), color: seatColor, at: at(THREE, 0.1, FLOOR + 0.08, 0.38) }, // seat base
  ]);
  const blades = (span, chord, tip) => {
    const list = [{ geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.16, 16), color: yellow }, { geometry: new THREE.BoxGeometry(span, 0.06, chord), color: dark }];
    for (const end of [1, -1]) list.push({ geometry: new THREE.BoxGeometry(tip, 0.07, chord * 1.02).translate(end * (span - tip) / 2, 0, 0), color: yellow });
    return mergeParts(THREE, list);
  };
  const tail = mergeParts(THREE, [
    { geometry: new THREE.CylinderGeometry(0.12, 0.12, 0.12, 14), color: yellow },
    { geometry: new THREE.BoxGeometry(1.0, 0.05, 0.16), color: pink },
  ]).rotateX(Math.PI / 2);
  const seat = new THREE.Vector3(0.05, FLOOR + 0.5, -0.6); // out in the doorway, well proud of the hull
  return {
    body: mergeParts(THREE, parts),
    inner,
    glass: shell(1.97, 1.0, Math.PI + 0.25, Math.PI - 0.55, 1.02),
    seats: [seat],
    spinners: [
      { geometry: blades(6.2, 0.3, 0.5), position: new THREE.Vector3(-0.1, Y + 1.62, 0), axis: 'y', speed: 1 },
      { geometry: tail, position: new THREE.Vector3(-4.45, Y + 0.55, -0.2), axis: 'z', speed: 1.6 },
    ],
    // Air off the exhaust, the tail, the tail rotor, the belly, the fin tip and both ends of the rotor's sweep.
    trails: [[-1.35, Y + 0.97, 0, 2.2], [-4.95, Y + 0.4, 0, 2.6], [-4.45, Y + 0.55, -0.3, 1.8], [-2.4, Y - 0.35, -0.2, 2.0], [-4.98, Y + 1.25, 0, 2.2],
      [-0.4, Y + 1.62, -3.0, 3.0], [-0.4, Y + 1.62, 3.0, 3.0]],
    tilt: -0.1, // nose down, as a helicopter flies forward
    room: 1.2, // framed with more sky round it, so it reads as a small craft in the air rather than filling the view
    drop: seat.y - 0.05, // the skids below the ball
    rise: Y + 1.62 - seat.y - 0.5, // the rotor above it
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
    // Air off each engine, wing tip, the middle of each wing's trailing edge and the stabilisers, and the fin tip.
    trails: [1, -1].flatMap(side => [[-1.3, -1.05, 2.9 * side, 4.6], [-1.7, -0.55, 6.6 * side, 3.6], [-1.0, -0.55, 4.4 * side, 2.6], [-mid / 2 - 1.5, 0.2, 2.5 * side, 2.4]]).concat([[-mid / 2 - 1.4, 3.3, 0, 3.0]]),
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
    // Off each fin tip, and round the nozzle's rim beside the flame.
    trails: [0, 1, 2, 3].map(k => { const a = Math.PI / 4 + k * Math.PI / 2; return [-mid / 2 - 1.6, 2.7 * Math.cos(a), 2.7 * Math.sin(a), 4.5]; })
      .concat([[-mid / 2 - 1.9, 0.9, 0, 5.5], [-mid / 2 - 1.9, -0.9, 0, 5.5], [-mid / 2 - 1.9, 0, 0.9, 5.5]]),
  };
}

/**
 * The Solo rocket for Ares and Luna (owner, 2026-11-18): a small red and white rocket with the player's ball riding inside a glass
 * dome on top, a yellow rim round the dome, a porthole, four fins and a live flame. One seat. `accent` (owner, 2026-11-19) paints the
 * nose cone and fins in the player's ball colour (the fins alternate with a darker shade of it); red and violet are the default.
 */
export function makeSoloRocket(THREE, accent = null) {
  const white = 0xf8f6ff, red = 0xe5484d, violet = 0x8e4ec6, cone = accent ?? red, finA = accent ?? red, finB = accent === null ? violet : shade(THREE, accent, 0.3), yellow = 0xffd23f, cyan = 0x25d1e6, metal = 0x4b4570, dark = 0x2a2346;
  const r = 0.95, mid = 2.4, domeY = 0.78, domeR = 0.8;
  const seat = new THREE.Vector3(0.1, 1.02, 0);
  const parts = [
    { geometry: capsule(THREE, r, mid), color: white },
    { geometry: new THREE.ConeGeometry(r * 0.98, 1.9, 28).rotateZ(-Math.PI / 2), color: cone, at: at(THREE, mid / 2 + 0.9, 0, 0) }, // nose cone
    { geometry: new THREE.ConeGeometry(0.62, 0.8, 22).rotateZ(Math.PI / 2), color: metal, at: at(THREE, -mid / 2 - 0.95, 0, 0) }, // nozzle
    { geometry: new THREE.CylinderGeometry(r * 1.015, r * 1.015, 0.36, 28, 1, true).rotateZ(Math.PI / 2), color: red, at: at(THREE, -0.95, 0, 0) }, // band
    { geometry: new THREE.TorusGeometry(domeR, 0.08, 10, 36).rotateX(Math.PI / 2), color: yellow, at: at(THREE, seat.x, domeY, 0) }, // the dome's rim
    { geometry: new THREE.CylinderGeometry(domeR * 0.96, domeR * 0.96, 0.08, 28), color: dark, at: at(THREE, seat.x, domeY - 0.02, 0) }, // its floor
  ];
  for (const side of [1, -1]) {
    parts.push({ geometry: new THREE.CylinderGeometry(0.22, 0.22, 0.1, 18).rotateX(Math.PI / 2), color: cyan, at: at(THREE, -0.3, -0.3, side * (r - 0.03)) });
    parts.push({ geometry: new THREE.TorusGeometry(0.24, 0.05, 8, 20), color: yellow, at: at(THREE, -0.3, -0.3, side * (r + 0.02)) }); // portholes
  }
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) parts.push({ geometry: fin(THREE, [[-mid / 2 + 0.3, 0.7], [-mid / 2 - 0.9, 1.75], [-mid / 2 - 1.25, 1.75], [-mid / 2 - 1.0, 0.7]], 0.16), color: a % Math.PI ? finB : finA, at: at(THREE, 0, 0, 0, a + Math.PI / 4, 0, 0) });
  const flame = mergeParts(THREE, [
    { geometry: new THREE.ConeGeometry(0.46, 1.8, 18).rotateZ(Math.PI / 2).translate(-0.9, 0, 0), color: 0xff8a1f },
    { geometry: new THREE.ConeGeometry(0.28, 1.2, 16).rotateZ(Math.PI / 2).translate(-0.65, 0, 0), color: 0xffe36b },
  ]);
  const fins = [0, 1, 2, 3].map(k => { const a = Math.PI / 4 + k * Math.PI / 2; return [-mid / 2 - 1.2, 1.75 * Math.cos(a), 1.75 * Math.sin(a), 2.6]; });
  return {
    body: mergeParts(THREE, parts),
    glass: new THREE.SphereGeometry(domeR, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).translate(seat.x, domeY, 0),
    seats: [seat], spinners: [], flame, flameAt: new THREE.Vector3(-mid / 2 - 1.3, 0, 0), tilt: 0.1,
    trails: fins.concat([[-mid / 2 - 1.35, 0.55, 0, 3.4], [-mid / 2 - 1.35, -0.55, 0, 3.4]]),
    room: 1.45, // a small craft: more sky round it
    drop: seat.y + r + 0.15, // the belly below the ball
    rise: domeY + domeR - seat.y - 0.5, // the dome above it
  };
}

/**
 * The vehicle for a kind: 'helicopter' (Solo on Gaia), 'minirocket' (Solo to Ares or Luna), 'plane' (a party bound for Gaia) or 'rocket' (a party to Ares or Luna).
 * `accent` (a colour, or null) paints the Solo vehicles in the player's ball colour; the party vehicles keep their own.
 */
export function makeLobbyVehicle(THREE, kind, accent = null) {
  if (kind === 'helicopter') return makeHelicopter(THREE, accent);
  if (kind === 'minirocket') return makeSoloRocket(THREE, accent);
  if (kind === 'rocket') return makeLobbyRocket(THREE);
  return makeLobbyPlane(THREE);
}

/** The Solo vehicles, which wear the player's ball colour. */
export const isSoloCraft = kind => kind === 'helicopter' || kind === 'minirocket';

/** Rockets fly between planets; the plane and helicopter stay in Gaia's air. */
export const isRocket = kind => kind === 'rocket' || kind === 'minirocket';

/** Which vehicle a lobby shows: Gaia gets the helicopter (Solo) or the plane (a party); Ares and Luna the Solo rocket or the party rocket. */
export function lobbyVehicleFor({ solo = false, destination = 'gaia' } = {}) {
  const space = destination === 'ares' || destination === 'luna';
  if (solo) return space ? 'minirocket' : 'helicopter';
  return space ? 'rocket' : 'plane';
}
