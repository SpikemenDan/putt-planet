/**
 * The lobby rocket's route between planets in the Solo planet menu, seen from the wide view that holds Gaia, Luna and Ares together
 * (owner, 2026-11-18: "we zoom out and we see Gaia, Luna and Ares and the rocket spins around Gaia goes to Ares and then orbits and goes
 * BEHIND"). Three parts, each flat in its planet's orbit plane (square to the world's up):
 *
 * 1. It spirals in from where it is (its parked spot) to an orbit round the planet it leaves, `orbit` planet radii out, and goes round
 *    it about `spin` times, leaving along the line toward the planet ahead.
 * 2. It crosses to the planet ahead, arriving along that line.
 * 3. It curves round the near side of that planet (the side facing `eye`, the wide view's camera; arriving on that side already, round the side) and on round behind it, sinking in
 *    toward the middle, so it ends hidden behind the planet. There the planet scene stops drawing it and zooms in.
 *
 * Built as a dense polyline and measured by length, so the rocket keeps an even pace along it. The same trip gives the same route.
 */

const PER_TURN = 72; // samples per full turn of an orbit
const CROSS = 48; // samples across
const TAU = Math.PI * 2;
const mod = (v, m) => ((v % m) + m) % m;
const easeInOut = v => v * v * (3 - 2 * v);

export function createLobbyPath(THREE) {
  const V = () => new THREE.Vector3();
  const pts = [];
  let used = 0, total = 1, lengths = new Float64Array(0);
  const n = V().set(0, 1, 0), e1 = V().set(1, 0, 0), e2 = V().set(0, 0, -1); // e1 x e2 = n: angles grow anticlockwise about up
  const flat = V(), d = V(), a = V(), b = V(), t0 = V(), t1 = V(), p0 = V(), p1 = V();
  const angle = v => Math.atan2(v.dot(e2), v.dot(e1));
  const ring = (c, r, th, h, out) => out.copy(c).addScaledVector(e1, r * Math.cos(th)).addScaledVector(e2, r * Math.sin(th)).addScaledVector(n, h);
  const push = () => { if (used === pts.length) pts.push(V()); return pts[used++]; };

  const path = {
    /** The orbit planes' up (the planet the rocket arrives at turns about it once it is parked). */
    normal: n,
    /** Length of the whole route, in world units. */
    get length() { return total; },
    /**
     * Builds the route.
     * @param {object} o
     * @param {THREE.Vector3} o.start Where the rocket sets off, and `o.startDir` its heading (unit).
     * @param {THREE.Vector3} o.from Centre of the planet it leaves, `o.fromR` its radius; `o.to` and `o.toR` the planet ahead.
     * @param {THREE.Vector3} o.eye The wide view's camera: the route passes the near side of the planet ahead and ends behind it.
     * @param {number} o.spin About how many times it goes round the planet it leaves (0 leaves at once, part way round).
     * @param {number} o.orbit The orbits' size, in planet radii.
     */
    plan({ start, startDir, from, fromR, to, toR, eye, spin, orbit }) {
      used = 0;
      // 1. Round the planet it leaves: from where it is, spiralling onto the orbit, turning the way its nose points.
      const r1 = fromR * orbit, r2 = toR * orbit;
      a.subVectors(start, from);
      const h0 = a.dot(n);
      flat.copy(a).addScaledVector(n, -h0);
      const rho0 = flat.length();
      const th0 = rho0 > 1e-3 ? angle(flat) : angle(startDir);
      const s1 = rho0 > 1e-3 && b.crossVectors(flat, startDir).dot(n) < 0 ? -1 : 1;
      d.subVectors(to, from).addScaledVector(n, -d.subVectors(to, from).dot(n));
      if (d.lengthSq() < 1e-6) d.copy(e1);
      d.normalize();
      const thX = angle(d) - s1 * Math.PI / 2; // where its way round points at the planet ahead
      const part = mod(s1 * (thX - th0), TAU);
      const sweep1 = part + TAU * Math.max(0, Math.round(spin - part / TAU));
      const k1 = Math.max(2, Math.ceil(sweep1 / TAU * PER_TURN));
      for (let i = 0; i <= k1; i++) {
        const u = i / k1, settle = easeInOut(Math.min(1, u / 0.5));
        const p = ring(from, rho0 + (r1 - rho0) * settle, th0 + s1 * sweep1 * u, h0 * (1 - settle), push());
        const out = p.distanceTo(from);
        if (out < fromR * 1.15) p.sub(from).multiplyScalar(fromR * 1.15 / Math.max(1e-3, out)).add(from); // never through the planet
      }
      // 3 (planned first, to know where it arrives): round the near side of the planet ahead, on round behind it.
      flat.subVectors(eye, to).addScaledVector(n, -flat.subVectors(eye, to).dot(n));
      const thF = flat.lengthSq() > 1e-6 ? angle(flat) : angle(d) + Math.PI, thB = thF + Math.PI;
      // Past the front first when it can; arriving already on the near side (flying away from `eye`), the shorter way round the
      // side to the back.
      let s2 = 0, sweep2 = 0, short = 1, shortSweep = Infinity;
      for (const s of [1, -1]) {
        const thE = angle(d) - s * Math.PI / 2, toFront = mod(s * (thF - thE), TAU), toBack = mod(s * (thB - thE), TAU);
        if (toFront < toBack) { s2 = s; sweep2 = toBack; break; }
        if (toBack < shortSweep) { short = s; shortSweep = toBack; }
      }
      if (!s2) { s2 = short; sweep2 = shortSweep; }
      const thE = angle(d) - s2 * Math.PI / 2;
      // 2. Across: leaving and arriving along the line between them.
      p0.copy(pts[used - 1]);
      ring(to, r2, thE, 0, p1);
      const span = p0.distanceTo(p1);
      t0.copy(d).multiplyScalar(span); t1.copy(d).multiplyScalar(span);
      for (let i = 1; i < CROSS; i++) {
        const u = i / CROSS, u2 = u * u, u3 = u2 * u;
        push().copy(p0).multiplyScalar(2 * u3 - 3 * u2 + 1).addScaledVector(t0, u3 - 2 * u2 + u).addScaledVector(p1, -2 * u3 + 3 * u2).addScaledVector(t1, u3 - u2);
      }
      const k2 = Math.max(2, Math.ceil(sweep2 / TAU * PER_TURN));
      for (let i = 0; i <= k2; i++) {
        const u = i / k2, sink = easeInOut(Math.max(0, (u - 0.55) / 0.45));
        ring(to, r2 + (toR * 0.6 - r2) * sink, thE + s2 * sweep2 * u, 0, push());
      }
      if (lengths.length < used) lengths = new Float64Array(used * 2);
      total = 0; lengths[0] = 0;
      for (let i = 1; i < used; i++) { total += pts[i].distanceTo(pts[i - 1]); lengths[i] = total; }
      total = Math.max(total, 1e-6);
      return path;
    },
    /** The point `s` (0..1) of the way along the route by length, into `pos`, and its heading into `dir` (unit) when given. */
    at(s, pos, dir) {
      const want = Math.max(0, Math.min(1, s)) * total;
      let lo = 0, hi = used - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lengths[m] < want) lo = m; else hi = m; }
      const seg = lengths[hi] - lengths[lo], k = seg > 1e-9 ? (want - lengths[lo]) / seg : 0;
      pos.lerpVectors(pts[lo], pts[hi], k);
      if (dir) { // along the route, smoothed across neighbouring samples so it never ticks from one to the next
        dir.subVectors(pts[Math.min(used - 1, hi + 1)], pts[Math.max(0, lo - 1)]);
        if (dir.lengthSq() < 1e-12) dir.copy(e1);
        dir.normalize();
      }
      return pos;
    },
  };
  return path;
}
