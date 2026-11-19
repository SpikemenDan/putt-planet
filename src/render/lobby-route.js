/**
 * The lobby rocket's route between planets (owner, 2026-11-18: "the rocket flies across", "curve into orbit"): a real path in the
 * planet scene's world, worked out afresh every frame because Luna keeps moving along its orbit.
 *
 * It leaves from where the rocket is (`start`), flying on the way its nose points (`startDir`). Parked, the rocket is in orbit round
 * the planet it is leaving (`from`), so it first swings a short way round that orbit, on the camera's side, then bends in one smooth
 * curve across to the planet ahead, building up speed and shedding it evenly, and joins that planet's orbit where the finished view
 * can see it, then sweeps round the front to where the rocket will sit when the camera has arrived (`end`), heading the way it will
 * face there (`endDir`), and stops dead. The orbit is the circle through `end` round the planet's centre, in the plane that holds
 * `endDir`. A planet in the way pushes the curve out round it, and the curve is pushed out from behind the planet ahead as seen
 * from the camera (`eyes`), so the rocket never hides behind it and pops back out.
 *
 * Pure geometry (three.js maths only), no scene objects: planet-scene.js plans it, lobby-flight.js flies the rocket along it.
 */
// Round each planet on the camera's side only (owner, 2026-11-18: it went behind Ares and stayed there, then popped back in front; picked
// "front-side arrival"): a short swing off the planet it leaves, a gentle arc across, then a sweep round the front of the planet ahead,
// all of it in the finished view, and a dead stop. The sweep is at least MIN_ARC radians and at most MAX_ARC.
const MIN_ARC = 0.02, MAX_ARC = 1.6, SAMPLES = 32;
/** Round the planet it leaves: at least MIN_DEPART radians, so the swing reads, and no more than MAX_DEPART, so it stays in front. */
const MIN_DEPART = 0.35, MAX_DEPART = 1.2;
/**
 * Pace: round a planet the rocket turns at an even rate, so it covers each orbit in about the same time whatever the planet's size;
 * across, it speeds up smoothly in between, taking about as long as CROSS radians of orbit, longer on a long way (by the square root
 * of how many times FAR it is), so it never streaks across the picture. Times are in those radians.
 */
const CROSS = 1.6, FAR = 1200;
/** The sweep in front of the planet ahead lasts at least SEEN, so the rocket is seen coming in before it stops dead. */
const SEEN = 0.6;
/** Across, it never turns faster than TURN times the rate it turns round an orbit, so it never whips through a bend. */
const TURN = 2.5;
/**
 * Off a planet its speed grows by GROW times its distance out (and toward the planet ahead it falls the same way), so it builds up
 * and sheds speed evenly in time instead of bursting across the middle (owner, 2026-11-18: the path from Ares to Luna looked weird).
 */
const GROW = 2.5;

export function createLobbyRoute(THREE) {
  const V = () => new THREE.Vector3();
  const S = V(), TS = V(), C = V(), E = V(), TE = V(), rHat = V(), along = V(), normal = V(), O = V(), TO = V();
  const P1 = V(), P2 = V(), a = V(), b = V(), c = V(), push = V(), da = V(), db = V();
  const R = V(), dHat = V(), dAlong = V(), L = V(), TL = V(); // the orbit it leaves (centre, its start and forward), where it leaves it
  const table = new Float64Array(SAMPLES + 1); // cumulative length along the curve, per sample
  const times = new Float64Array(SAMPLES + 1); // cumulative time along the curve, per sample
  const bend = new Float64Array(SAMPLES + 1); // how sharply the curve turns (radians per unit length), per sample
  const speeds = new Float64Array(SAMPLES + 1); // speed at each sample of the curve
  /**
   * The time to each sample when the speed changes evenly with distance from one sample's to the next's (`len` cumulative distance,
   * `v` speed per sample), so speed never jumps and neither does the camera that follows the rocket.
   */
  const paceTimes = (len, v, out) => {
    for (let i = 1; i <= SAMPLES; i++) {
      const d = len[i] - len[i - 1], v0 = v[i - 1], v1 = v[i];
      out[i] = out[i - 1] + (Math.abs(v1 - v0) < 1e-9 * v0 ? d / v0 : d * Math.log(v1 / v0) / (v1 - v0));
    }
    return out[SAMPLES];
  };
  /** How far it has gone `t` into such a stretch. */
  const paceAt = (len, v, times, t) => {
    let i = 1;
    while (i < SAMPLES && times[i] < t) i++;
    const d = len[i] - len[i - 1], v0 = v[i - 1], k = (v[i] - v0) / Math.max(1e-12, d), tau = Math.max(0, t - times[i - 1]);
    return len[i - 1] + Math.min(d, Math.abs(k) < 1e-12 ? v0 * tau : v0 * (Math.exp(k * tau) - 1) / k);
  };
  let radius = 1, arc = MIN_ARC, curveLength = 0, total = 0, dRadius = 0, depart = 0, departLength = 0, reach = 0;
  let departTime = 0, crossTime = 0, sweepTime = 0, totalTime = 1;

  const bezier = (u, out) => {
    const v = 1 - u;
    return out.copy(L).multiplyScalar(v * v * v).addScaledVector(P1, 3 * v * v * u).addScaledVector(P2, 3 * v * u * u).addScaledVector(O, u * u * u);
  };
  const bezierDir = (u, out) => {
    const v = 1 - u;
    out.subVectors(P1, L).multiplyScalar(3 * v * v).addScaledVector(da.subVectors(P2, P1), 6 * v * u).addScaledVector(db.subVectors(O, P2), 3 * u * u);
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
     * `blockers` is a list of `{ centre, radius }` planets the curve must keep out of. `eye` (optional) is where the camera ends up and
     * `ground` the radius of the planet ahead: the way round its orbit then starts where that camera can see it, never over its
     * horizon (owner, 2026-11-18: close in at Ares the rocket stayed behind the planet a moment before it settled), and `inView`
     * (optional) says whether a point is inside that camera's picture, so the last stretch is one the camera can show. `eyes` (optional, default `[eye]`) are
     * the camera places the curve must not pass behind the planet ahead from.
     */
    plan({ start, startDir, from = null, centre, end, endDir, blockers = [], eye = null, ground = 0, inView = null, eyes = null }) {
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
      reach = MAX_ARC;
      if (eye && ground > 0) { // how much of its end is in sight of the camera, clear of the ground by a margin
        const clear = ground * 1.04, seen = s => { // whether the line from the eye to the orbit point `s` back misses the ground
          orbitAt(-s, c); a.subVectors(c, eye); b.subVectors(C, eye);
          const t = Math.max(0, Math.min(1, b.dot(a) / Math.max(1e-9, a.lengthSq())));
          return b.addScaledVector(a, -t).length() > clear && (!inView || inView(c));
        };
        reach = 0;
        while (reach < MAX_ARC && seen(reach + 0.05)) reach += 0.05;
        if (reach < MAX_ARC) { // then exactly where it goes out of sight, so the route changes smoothly as the view does
          let hi = reach + 0.05;
          for (let i = 0; i < 12; i++) { const mid = (reach + hi) / 2; if (seen(mid)) reach = mid; else hi = mid; }
        }
      }
      // The sweep: from where a line from the start grazes the orbit, but never from out of the finished view.
      arc = Math.min(MAX_ARC, Math.max(MIN_ARC, Math.min(back, reach)));
      orbitAt(-arc, O, TO);
      // The curve: leaves along the start heading, arrives along the orbit.
      // Each handle is long when its end already points along the way across and short when not, so a rocket leaving or arriving
      // heading off to the side turns soon instead of flying a wide loop out (and round behind a planet).
      const span = Math.max(1e-3, L.distanceTo(O));
      a.subVectors(O, L).divideScalar(span);
      const h1 = span * (0.15 + 0.4 * Math.max(0, TL.dot(a))), h2 = span * (0.15 + 0.25 * Math.max(0, TO.dot(a)));
      P1.copy(L).addScaledVector(TL, h1);
      P2.copy(O).addScaledVector(TO, -h2);
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
          // The curve still leaves and meets the orbits along them: each handle stays on its orbit's line, only lengthening, so the
          // heading never jumps where the curve begins or ends.
          // (no longer than the span either, so a planet it cannot get round never stretches the curve out into a huge loop).
          P1.copy(L).addScaledVector(TL, Math.min(span, Math.max(h1, a.subVectors(P1, L).dot(TL))));
          P2.copy(O).addScaledVector(TO, -Math.min(span, Math.max(h2, a.subVectors(O, P2).dot(TO))));
        }
        // Never behind the planet ahead, seen from the finished view (owner, 2026-11-18: it went behind Ares and popped back out):
        // the curve is pushed sideways, out of that planet's shadow from the eye.
        if (ground > 0) for (const at of eyes ?? (eye ? [eye] : [])) {
          const keep = ground * 1.1;
          let worst = keep, wu = 0;
          for (let i = 1; i < 24; i++) {
            bezier(i / 24, c); a.subVectors(c, at); b.subVectors(C, at);
            const t = Math.max(0, Math.min(1, b.dot(a) / Math.max(1e-9, a.lengthSq())));
            const gap = b.addScaledVector(a, -t).length();
            if (gap < worst) { worst = gap; wu = i / 24; push.copy(b).negate(); if (t > 0) push.multiplyScalar(1 / t); }
          }
          if (wu) {
            if (push.lengthSq() < 1e-8) push.copy(normal);
            push.normalize().multiplyScalar((keep - worst) * 1.6);
            P1.add(push); P2.add(push); moved = true;
            P1.copy(L).addScaledVector(TL, Math.min(span, Math.max(h1, a.subVectors(P1, L).dot(TL))));
            P2.copy(O).addScaledVector(TO, -Math.min(span, Math.max(h2, a.subVectors(O, P2).dot(TO))));
          }
        }
        if (!moved) break;
      }
      curveLength = 0;
      bezier(0, a); bezierDir(0, c);
      for (let i = 1; i <= SAMPLES; i++) {
        bezier(i / SAMPLES, b); const step = a.distanceTo(b); curveLength += step; table[i] = curveLength; a.copy(b);
        bezierDir(i / SAMPLES, push); bend[i] = Math.acos(Math.max(-1, Math.min(1, c.dot(push)))) / Math.max(1e-9, step); c.copy(push);
      }
      total = departLength + curveLength + radius * arc;
      // The time across: speed builds up off the planet it leaves and falls toward the planet ahead (GROW), up to a top speed found so
      // the crossing takes about CROSS, but never so fast through a bend that it turns quicker than TURN.
      const r0 = depart > 0 ? dRadius : radius;
      sweepTime = Math.max(arc, SEEN);
      const r1 = radius * arc / sweepTime; // the sweep's speed, which the crossing ends at
      const cross = top => {
        for (let i = 0; i <= SAMPLES; i++) {
          const sharp = Math.max(bend[i], i < SAMPLES ? bend[i + 1] : 0), ends = Math.min(r0 + GROW * table[i], r1 + GROW * (curveLength - table[i]));
          speeds[i] = Math.max(Math.min(r0, r1), Math.min(top, ends, TURN / Math.max(1e-9, sharp)));
        }
        for (let pass = 0; pass < 3; pass++) for (let i = 1; i < SAMPLES; i++) speeds[i] = (speeds[i - 1] + 2 * speeds[i] + speeds[i + 1]) / 4;
        return paceTimes(table, speeds, times);
      };
      const goal = CROSS * Math.max(1, Math.sqrt(curveLength / FAR));
      let lo = Math.min(r0, r1), hi = Math.max(lo, curveLength * 4);
      if (cross(hi) < goal) { for (let i = 0; i < 40; i++) { const mid = Math.sqrt(lo * hi); if (cross(mid) > goal) lo = mid; else hi = mid; } cross(hi); }
      // Round the front of the planet ahead at the orbit's even pace, to a dead stop.
      departTime = depart; crossTime = times[SAMPLES];
      totalTime = departTime + crossTime + sweepTime;
      return this;
    },
    /** How far along the route (0..1, by distance) it is `x` (0..1) of the way through the trip's time. */
    timed(x) {
      let t = Math.max(0, Math.min(1, x)) * totalTime, s;
      if (t < departTime) s = t * dRadius;
      else if ((t -= departTime) < crossTime) {
        s = departLength + paceAt(table, speeds, times, t);
      } else s = departLength + curveLength + radius * Math.min(arc, (t - crossTime) * arc / sweepTime);
      return total > 0 ? Math.min(1, s / total) : 1;
    },
    /** How far across (0..1, by distance along the crossing) it is `x` (0..1) of the way through the trip's time. */
    crossAt(x) { return curveLength > 0 ? Math.max(0, Math.min(1, (this.timed(x) * total - departLength) / curveLength)) : 1; },
    /** When (0..1 of the trip's time) the rocket reaches the planet ahead's orbit, and when it comes into the arriving camera's sight. */
    get arrives() { return (departTime + crossTime) / totalTime; },
    /** When (0..1 of the trip's time) it leaves the orbit it started in. */
    get leaves() { return departTime / totalTime; },
    get inSight() { return (departTime + crossTime) / totalTime; },
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
