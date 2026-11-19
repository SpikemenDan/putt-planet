/**
 * The lobby rocket's path between planets in the Solo planet menu: a fixed, hand-shaped curve per trip (owner, 2026-11-18:
 * "Hand-drawn paths", after the planned route kept slipping behind planets). No planning, no guessing: the rocket always flies
 * the same curve for the same trip, and the developer panel's `trip.*` sliders reshape it.
 *
 * The curve runs from where the rocket is (its parked spot, heading along its nose) through two points, then into its parked spot
 * in the view of the planet ahead, heading along the parked nose, where it stops dead. The two points sit a third and two thirds of
 * the way from the planet it leaves to the planet ahead, pushed toward the camera by `out` and up by `up`, both as fractions of the
 * distance between the planets. Positive `out` keeps the rocket on the near side, in front of both planets.
 *
 * It is a Hermite spline through the four points (Catmull-Rom tangents inside), measured by length so the rocket's pace is even.
 */

const SAMPLES = 32; // per span, three spans
const TURN_IN = 0.8; // how strongly the curve leaves and arrives along the nose, as a share of the first and last span's length

export function createLobbyPath(THREE) {
  const V = () => new THREE.Vector3();
  const pts = [V(), V(), V(), V()], tans = [V(), V(), V(), V()];
  const table = Array.from({ length: SAMPLES * 3 + 1 }, () => V());
  const lengths = new Float64Array(SAMPLES * 3 + 1);
  const across = V(), out = V(), up = V(), a = V(), b = V();
  let total = 1;

  /** Point `u` (0..1) along span `i` of the spline, into `res`. */
  function span(i, u, res) {
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    return res.copy(pts[i]).multiplyScalar(h00).addScaledVector(tans[i], h10).addScaledVector(pts[i + 1], h01).addScaledVector(tans[i + 1], h11);
  }

  const path = {
    /** The leg's up: square to the line between the planets, toward the sky. The parked planet turns about it. */
    normal: V(),
    /** Which way `out` leans (1 or -1), as chosen by the last plan. */
    side: 1,
    /** Length of the whole curve, in world units. */
    get length() { return total; },
    /**
     * Shapes the curve for one frame (Luna moves, so it is reshaped every frame).
     * @param {object} o
     * @param {THREE.Vector3} o.start Where the rocket sets off, and `o.startDir` its heading (unit).
     * @param {THREE.Vector3} o.from Centre of the planet it leaves; `o.to` centre of the planet ahead.
     * @param {THREE.Vector3} o.end Its parked spot in the finished view, and `o.endDir` its parked heading (unit).
     * @param {THREE.Vector3} o.eye A point on the camera side (the cameras of both views), which `out` leans toward.
     * @param {number} [o.side] 1 or -1 to keep the side chosen earlier in the trip (`path.side`), so it never flips mid-flight; 0 picks it from `eye`.
     * @param {{out1:number, up1:number, out2:number, up2:number}} o.shape The two points, as fractions of the planets' distance.
     */
    plan({ start, startDir, from, to, end, endDir, eye, shape, side = 0 }) {
      across.subVectors(to, from);
      const dist = Math.max(1e-3, across.length());
      across.divideScalar(dist);
      up.set(0, 1, 0).addScaledVector(across, -across.y);
      if (up.lengthSq() < 1e-6) up.set(1, 0, 0).addScaledVector(across, -across.x);
      up.normalize();
      out.crossVectors(across, up);
      a.addVectors(from, to).multiplyScalar(0.5);
      path.side = side || (out.dot(b.subVectors(eye, a)) < 0 ? -1 : 1);
      out.multiplyScalar(path.side);
      path.normal.copy(up);
      pts[0].copy(start);
      pts[1].copy(from).addScaledVector(across, dist / 3).addScaledVector(out, shape.out1 * dist).addScaledVector(up, shape.up1 * dist);
      pts[2].copy(from).addScaledVector(across, dist * 2 / 3).addScaledVector(out, shape.out2 * dist).addScaledVector(up, shape.up2 * dist);
      pts[3].copy(end);
      tans[0].copy(startDir).multiplyScalar(pts[0].distanceTo(pts[1]) * TURN_IN);
      tans[1].subVectors(pts[2], pts[0]).multiplyScalar(0.5);
      tans[2].subVectors(pts[3], pts[1]).multiplyScalar(0.5);
      tans[3].copy(endDir).multiplyScalar(pts[2].distanceTo(pts[3]) * TURN_IN);
      total = 0;
      for (let i = 0; i < table.length; i++) {
        const s = Math.min(2, Math.floor(i / SAMPLES)), u = i === table.length - 1 ? 1 : (i - s * SAMPLES) / SAMPLES;
        span(s, u, table[i]);
        if (i > 0) total += table[i].distanceTo(table[i - 1]);
        lengths[i] = total;
      }
      total = Math.max(total, 1e-6);
      return path;
    },
    /** The point `s` (0..1) of the way along the curve by length, into `pos`, and its heading into `dir` (unit) when given. */
    at(s, pos, dir) {
      const want = Math.max(0, Math.min(1, s)) * total;
      let lo = 0, hi = table.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lengths[m] < want) lo = m; else hi = m; }
      const seg = lengths[hi] - lengths[lo], k = seg > 1e-9 ? (want - lengths[lo]) / seg : 0;
      pos.lerpVectors(table[lo], table[hi], k);
      if (dir) {
        // The heading: along the curve here, smoothed across neighbouring samples so it never ticks from one to the next.
        const i0 = Math.max(0, lo - 1), i1 = Math.min(table.length - 1, hi + 1);
        dir.subVectors(table[i1], table[i0]);
        if (dir.lengthSq() < 1e-12) dir.copy(tans[3]);
        dir.normalize();
      }
      return pos;
    },
    /** How far across from the planet it leaves to the planet ahead a point is (0..1), measured along the line between them. */
    across(p, from, to) {
      a.subVectors(to, from);
      const d2 = a.lengthSq();
      return d2 > 1e-9 ? Math.max(0, Math.min(1, b.subVectors(p, from).dot(a) / d2)) : 1;
    },
  };
  return path;
}
