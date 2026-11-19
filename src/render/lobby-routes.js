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
 * Trips flown as a hop (owner, 2026-11-19: "it just zooms out and zooms into the other planet and the vehicle comes in from the right"):
 * no route, the camera pulls back to the wide view and pushes in to the planet ahead while the rocket flies off the left of the screen
 * and back in from the right. Gaia to Ares first, for the owner's approval before the rest.
 */
export const HOPS = Object.freeze(['gaia>ares']);

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
