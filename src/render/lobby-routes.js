/**
 * The rocket's routes between planets in the planet menu (owner, 2026-11-18: "how can i make the path myself for the rocket"). The owner
 * draws each one with the dev route editor (src/devtools/route-editor.js), exports it, and the cleaned-up points are saved here.
 *
 * A route is keyed 'from>to' and is a list of points [a, s, u] in the pair's own frame, in units of the distance between the planets:
 * `a` along the line from the planet left behind (0) to the planet ahead (1), `s` to the side (right of that line, seen from above)
 * and `u` up. So a route keeps its shape however the planets sit. A pair drawn one way only is flown backwards the other way.
 * The trip adds the rocket's parked spot at each end, so a route only holds the part in between.
 */
export const ROUTES = Object.freeze({});

/**
 * Routes traced from the owner's reference sketch (2026-11-19), laid out as the wide view sees them rather than in space. Each point is
 * [gx, gy, a, s]: near the planet left behind, (gx, gy) in its radii from its centre on the screen (x right, y up); further out,
 * (a, s) along the screen line to the planet ahead (0 to 1) and to the left of it, in that line's lengths. The trip blends from one
 * to the other as the point leaves the planet behind. Gaia to Ares: off Gaia's upper left, down round its left side and under it,
 * then a long climb up and right to Ares.
 */
export const SKETCHES = Object.freeze({
  'gaia>ares': [[-1.069, 0.737, -0.142, 0.175], [-1.463, 0.013, -0.243, 0.074], [-1.241, -0.786, -0.245, -0.07], [-0.457, -1.18, -0.134, -0.174], [0.405, -1.205, 0.009, -0.221], [1.198, -1.067, 0.147, -0.236], [2.005, -0.79, 0.295, -0.23], [2.803, -0.426, 0.446, -0.208], [3.551, -0.006, 0.591, -0.175], [4.239, 0.465, 0.729, -0.13], [4.903, 0.994, 0.866, -0.074]],
});

/**
 * Trips that dive behind the planet ahead and rise over its horizon (owner, 2026-11-19, from the reference sketch): the route ends
 * behind that planet instead of at the parked spot. Gaia to Ares first, for the owner's approval before the rest.
 */
export const DIVES = Object.freeze(['gaia>ares']);

/** A gentle arc, for a pair with no drawn route. */
export const DEFAULT_ROUTE = Object.freeze([[0.5, 0.18, 0.06]]);

/** The points for a trip from `from` to `to`: `overrides` (the editor's, live) first, then the shipped routes, either way round. */
export function routeFor(from, to, overrides = {}) {
  const key = from + '>' + to, back = to + '>' + from;
  const own = overrides[key] ?? ROUTES[key];
  if (own) return own;
  const other = overrides[back] ?? ROUTES[back];
  if (other) return [...other].reverse().map(([a, s, u]) => [1 - a, -s, u]);
  return DEFAULT_ROUTE;
}
