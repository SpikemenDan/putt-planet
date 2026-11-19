/**
 * The lobby rocket's route between planets (owner, 2026-11-18: "the rocket flies across", "curve into orbit"): a real path in the
 * planet scene's world, worked out afresh every frame because Luna keeps moving along its orbit.
 *
 * It leaves from where the rocket is (`start`), flying on the way its nose points (`startDir`). Parked, the rocket is in orbit round
 * the planet it is leaving (`from`), so it first carries on round that orbit (owner, 2026-11-18: "orbit Gaia and then go to the next
 * planet") until its heading points past the planet ahead, then leaves along that heading, bends in one smooth curve toward the planet
 * ahead and meets that planet's orbit side-on, then follows the orbit round to where the rocket will sit when the camera has arrived
 * (`end`), heading the way it will face there (`endDir`). The orbit is the circle through `end` round the planet's
 * centre, in the plane that holds `endDir`; the curve joins it where a line from the start would just graze it, so the rocket never
 * doubles back, and always at least MIN_ARC radians before the end so it visibly curves into orbit. A planet in the way pushes the
 * curve out round it, and the curve never dips below where it leaves a planet or joins an orbit.
 *
 * Pure geometry (three.js maths only), no scene objects: planet-scene.js plans it, lobby-flight.js flies the rocket along it.
 */
const MIN_ARC = 1.0, MAX_ARC = 2.6, SAMPLES = 32;
/** Round the planet it leaves: at least MIN_DEPART radians, so the circling reads, and no more than MAX_DEPART. */
const MIN_DEPART = 0.5, MAX_DEPART = 1.6 * Math.PI;

export function createLobbyRoute(THREE) {
  const V = () => new THREE.Vector3();
  const S = V(), TS = V(), C = V(), E = V(), TE = V(), rHat = V(), along = V(), normal = V(), O = V(), TO = V();
  const P1 = V(), P2 = V(), a = V(), b = V(), c = V(), push = V();
  const R = V(), dHat = V(), dAlong = V(), L = V(), TL = V(); // the orbit it leaves (centre, its start and forward), where it leaves it
  const table = new Float64Array(SAMPLES + 1); // cumulative length along the curve, per sample
  let radius = 1, arc = MIN_ARC, curveLength = 0, total = 0, dRadius = 0, depart = 0, departLength = 0;

  const bezier = (u, out) => {
    const v = 1 - u;
    return out.copy(L).multiplyScalar(v * v * v).addScaledVector(P1, 3 * v * v * u).addScaledVector(P2, 3 * v * u * u).addScaledVector(O, u * u * u);
  };
  const bezierDir = (u, out) => {
    const v = 1 - u;
    out.subVectors(P1, L).multiplyScalar(3 * v * v).addScaledVector(a.subVectors(P2, P1), 6 * v * u).addScaledVector(b.subVectors(O, P2), 3 * u * u);
    return out.lengthSq() > 1e-12 ? out.normalize() : out.copy(TO);
  };
  /** A point on the orbit `s` radians before the end (s <= 0), and its heading. */
  const orbitAt = (s, out, dir) => {
    out.copy(rHat).multiplyScalar(Math.cos(s)).addScaledVector(along, Math.sin(s)).multiplyScalar(radius).add(C);
    if (dir) dir.copy(rHat).multiplyScalar(-Math.sin(s)).addScaledVector(along, Math.cos(s)).normalize();
    return out;
  };
  /** A point on the orbit it leaves, `s` radians on from the start, and its heading. */
  const departAt = (s, out, dir) => {
    out.copy(dHat).multiplyScalar(Math.cos(s)).addScaledVector(dAlong, Math.sin(s)).multiplyScalar(dRadius).add(R);
    if (dir) dir.copy(dHat).multiplyScalar(-Math.sin(s)).addScaledVector(dAlong, Math.cos(s)).normalize();
    return out;
  };

  return {
    /** The orbit's axis: the planet turns round it (the other way) to keep the parked rocket circling. */
    normal,
    get length() { return total; },
    /**
     * Plans the route. `from` is the centre of the planet the rocket is in orbit round (none when it is already on its way);
     * `blockers` is a list of `{ centre, radius }` planets the curve must keep out of.
     */
    plan({ start, startDir, from = null, centre, end, endDir, blockers = [] }) {
      S.copy(start); TS.copy(startDir).normalize(); C.copy(centre); E.copy(end);
      // Round the orbit it is in, until its heading points past the planet ahead (a line on from it just grazes that planet's centre).
      depart = 0; L.copy(S); TL.copy(TS);
      if (from) {
        R.copy(from);
        dRadius = dHat.subVectors(S, R).length();
        if (dRadius > 1e-3) {
          dHat.divideScalar(dRadius);
          dAlong.copy(TS).addScaledVector(dHat, -TS.dot(dHat));
          if (dAlong.lengthSq() > 1e-8) {
            dAlong.normalize();
            a.subVectors(C, R); a.addScaledVector(b.crossVectors(dHat, dAlong).normalize(), -a.dot(b));
            const d = a.length(), phi = Math.atan2(a.dot(dAlong), a.dot(dHat));
            const leave = d > dRadius * 1.001 ? phi - Math.acos(dRadius / d) : MIN_DEPART;
            depart = Math.min(MAX_DEPART, Math.max(MIN_DEPART, ((leave % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)));
            departAt(depart, L, TL);
          }
        }
      }
      departLength = dRadius * depart;
      radius = Math.max(1e-3, rHat.subVectors(E, C).length());
      rHat.divideScalar(radius);
      // The orbit's heading at the end: the rocket's final heading, laid flat onto the orbit.
      along.copy(endDir).addScaledVector(rHat, -endDir.dot(rHat));
      if (along.lengthSq() < 1e-8) along.crossVectors(rHat, Math.abs(rHat.y) < 0.9 ? a.set(0, 1, 0) : a.set(1, 0, 0));
      along.normalize();
      TE.copy(along);
      normal.crossVectors(rHat, along).normalize();
      // Where the curve meets the orbit: the grazing point from the start, as an angle back from the end.
      a.subVectors(L, C); a.addScaledVector(normal, -a.dot(normal));
      const d = a.length(), sigma = Math.atan2(a.dot(along), a.dot(rHat));
      let back = Math.PI / 2;
      if (d > radius * 1.001) {
        const meet = sigma + Math.acos(radius / d); // angle of the grazing point, measured forward from the end
        back = ((-meet) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      }
      arc = Math.min(MAX_ARC, Math.max(MIN_ARC, back));
      orbitAt(-arc, O, TO);
      // The curve: leaves along the start heading, arrives along the orbit.
      const span = Math.max(1e-3, L.distanceTo(O));
      P1.copy(L).addScaledVector(TL, span * 0.55);
      P2.copy(O).addScaledVector(TO, -span * 0.4);
      // Out round any planet in the way (not one the route starts or ends inside).
      for (let pass = 0; pass < 8; pass++) {
        let moved = false;
        for (const { centre: k, radius: r } of blockers) {
          // Clear of it by a quarter of its radius; leaving or reaching it, at least as high as the route starts or meets the orbit.
          const ends = Math.min(L.distanceTo(k), O.distanceTo(k)) * 0.98;
          if (ends < r * 1.02) continue; // starts or ends inside it: nothing to keep out of
          const keep = Math.min(r * 1.25, ends);
          // The deepest the curve goes into it, and out from there.
          let worst = keep, wu = 0;
          for (let i = 1; i < 24; i++) { const gap = bezier(i / 24, c).distanceTo(k); if (gap < worst) { worst = gap; wu = i / 24; } }
          if (!wu) continue;
          push.subVectors(bezier(wu, c), k);
          if (push.lengthSq() < 1e-8) push.copy(normal);
          push.normalize().multiplyScalar((keep - worst) * 1.6);
          P1.add(push); P2.add(push); moved = true;
          // The curve still meets the orbit along it: the end handle stays on the orbit's line, only lengthening.
          P2.copy(O).addScaledVector(TO, -Math.max(span * 0.4, a.subVectors(O, P2).dot(TO)));
        }
        if (!moved) break;
      }
      curveLength = 0;
      bezier(0, a);
      for (let i = 1; i <= SAMPLES; i++) { bezier(i / SAMPLES, b); curveLength += a.distanceTo(b); table[i] = curveLength; a.copy(b); }
      total = departLength + curveLength + radius * arc;
      return this;
    },
    /** The point `f` (0..1) of the way along the route, by distance, and its heading. */
    at(f, out, dir) {
      let s = Math.max(0, Math.min(1, f)) * total;
      if (s < departLength) return departAt(s / dRadius, out, dir);
      s -= departLength;
      if (s >= curveLength) return orbitAt(-arc + (s - curveLength) / radius, out, dir);
      let i = 1;
      while (i < SAMPLES && table[i] < s) i++;
      const u = (i - 1 + (s - table[i - 1]) / Math.max(1e-9, table[i] - table[i - 1])) / SAMPLES;
      bezier(u, out);
      if (dir) bezierDir(u, dir);
      return out;
    },
  };
}
