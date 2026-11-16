// LEVEL_AUDIT.md images: top-down render of every map (all putts numbered, recorded solver routes traced), rasterised by the pre-installed Playwright.
// Usage: node docs/reviews/level-audit/render.mjs [outDir] [map,map,...]. Audit tooling only; it reads course data and fixtures and writes PNGs.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const require = createRequire(import.meta.url);
const { createCourseData } = await import(`${ROOT}/src/courses/index.js`);
const { SimulationEngine } = await import(`${ROOT}/src/simulation/index.js`);
const { courseWorld, worldGravity } = await import(`${ROOT}/src/shared/worlds.js`);
const OUT = process.argv[2] ?? `${ROOT}/docs/reviews/level-audit`;
mkdirSync(OUT, { recursive: true });

const maps = createCourseData().definitions;
const routes = {};
for (const f of ['tests/fixtures/world-maps/par-routes.json', 'tests/fixtures/cup-capture/par-route-gaps.json']) {
  for (const r of JSON.parse(readFileSync(`${ROOT}/${f}`, 'utf8')).results) if (r.route) routes[`${r.map}/${r.putt}`] ??= r.route;
}

function trace(map, putt, route) {
  const hole = maps[map];
  const engine = new SimulationEngine(hole, putt, { hazardTime: 0, gravity: worldGravity(courseWorld(hole)) });
  const p = engine.addPlayer('a', 'A', 0);
  const strokes = [];
  for (const s of route) {
    const pts = [[p.x, p.y]];
    engine.launch('a', (s.deg * Math.PI) / 180, s.power);
    let t = 0;
    while (p.moving && p.mode !== 'sunk' && t < 4800) { engine.step(); t++; if (t % 4 === 0) pts.push([p.x, p.y, p.z]); }
    pts.push([p.x, p.y, p.z]);
    strokes.push(pts);
    if (p.mode === 'sunk') break;
  }
  engine.dispose();
  return strokes;
}

const COL = { tile: '#9ccf6a', tileEdge: '#4d7a2c', wall: '#3b2f2f', sand: '#e8cf8a', ice: '#bfe7f5', slime: '#9be24a', pit: '#1b1b2a', pl: '#b08fd8', rp: '#e59a4d', pd: '#ff4fa3', fan: 'rgba(80,160,255,0.28)', tornado: 'rgba(120,120,160,0.35)', wind: 'rgba(230,120,40,0.18)', tp: '#7a3cff', q: '#ffd23f', mover: '#d33' };
const WORLD_TILE = { ares: ['#d9a07a', '#8a4a2a'], luna: ['#c9ccd8', '#6f7388'], gaia: [COL.tile, COL.tileEdge] };
const rect = (r, fill, extra = '') => `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${fill}" ${extra}/>`;

function svgFor(index) {
  const h = maps[index];
  const world = courseWorld(h);
  const putts = h.putts ?? [{ tee: h.tee, hole: h.hole, par: h.par }];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of h.tiles) { x0 = Math.min(x0, t[0]); y0 = Math.min(y0, t[1]); x1 = Math.max(x1, t[0] + t[2]); y1 = Math.max(y1, t[1] + t[3]); }
  for (const w of h.w ?? []) { x0 = Math.min(x0, w[0]); y0 = Math.min(y0, w[1]); x1 = Math.max(x1, w[0] + w[2]); y1 = Math.max(y1, w[1] + w[3]); }
  x0 -= 14; y0 -= 30; x1 += 14; y1 += 14;
  const W = Math.round(x1 - x0), H = Math.round(y1 - y0);
  const [tile, edge] = WORLD_TILE[world];
  const s = [];
  s.push(`<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="#f4f1e8"/>`);
  for (const t of h.tiles) s.push(rect(t, tile, `stroke="${edge}" stroke-width="2"`));
  for (const r of h.sand ?? []) s.push(rect(r, COL.sand));
  for (const r of h.ice ?? []) s.push(rect(r, COL.ice));
  for (const r of h.slime ?? []) s.push(rect(r, COL.slime));
  for (const r of h.pit ?? []) s.push(rect(r, COL.pit));
  for (const p of h.pl ?? []) s.push(rect(p, COL.pl, 'stroke="#5a3a8a" stroke-width="2"') + `<text x="${p[0] + 3}" y="${p[1] + 11}" font-size="10" fill="#2a1a4a">z${p[4]}</text>`);
  for (const r of h.rp ?? []) {
    s.push(rect(r, COL.rp, 'stroke="#8a4a10" stroke-width="2"'));
    const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2, sign = r[4][0] === '-' ? -1 : 1, ax = r[4][1] === 'x';
    const dx = ax ? sign * r[2] * 0.3 : 0, dy = ax ? 0 : sign * r[3] * 0.3;
    s.push(`<line x1="${cx - dx}" y1="${cy - dy}" x2="${cx + dx}" y2="${cy + dy}" stroke="#5a2a00" stroke-width="3" marker-end="url(#ar)"/><text x="${r[0] + 3}" y="${r[1] + r[3] - 4}" font-size="10" fill="#5a2a00">${r[5]}→${r[6]}${r[7] === 'launch' ? ' L' : ''}</text>`);
  }
  for (const f of h.fan ?? []) {
    s.push(rect(f, COL.fan, 'stroke="#2a70d0" stroke-dasharray="4 3"'));
    const cx = f[0] + f[2] / 2, cy = f[1] + f[3] / 2;
    s.push(`<line x1="${cx}" y1="${cy}" x2="${cx + f[4] * 30}" y2="${cy + f[5] * 30}" stroke="#2a70d0" stroke-width="3" marker-end="url(#ar)"/>`);
  }
  for (const wz of h.wind ?? []) {
    const b = wz.bounds; s.push(rect(b, COL.wind, 'stroke="#c06010" stroke-dasharray="6 4"'));
    const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2, m = Math.hypot(wz.force[0], wz.force[1]) || 1;
    s.push(`<line x1="${cx}" y1="${cy}" x2="${cx + wz.force[0] / m * 28}" y2="${cy + wz.force[1] / m * 28}" stroke="#c06010" stroke-width="3" marker-end="url(#ar)"/>`);
  }
  for (const v of h.tornado ?? []) s.push(`<circle cx="${v[0]}" cy="${v[1]}" r="${v[2]}" fill="${COL.tornado}" stroke="#555" stroke-dasharray="3 3"/><circle cx="${v[0]}" cy="${v[1]}" r="${v[2] * 0.4}" fill="none" stroke="#555"/>`);
  for (const w of h.w ?? []) s.push(rect(w, COL.wall));
  for (const m of h.movers ?? []) {
    const a = [m[0] - m[4] * m[6], m[1] - m[5] * m[6]], b = [m[0] + m[4] * m[6], m[1] + m[5] * m[6]];
    s.push(`<rect x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(b[0] - a[0]) + m[2]}" height="${Math.abs(b[1] - a[1]) + m[3]}" fill="rgba(220,40,40,0.15)" stroke="${COL.mover}" stroke-dasharray="4 3"/>` + rect(m, COL.mover));
  }
  for (const p of h.pd ?? []) s.push(`<circle cx="${p[0]}" cy="${p[1]}" r="18" fill="${COL.pd}" stroke="#7a0040" stroke-width="2"/><text x="${p[0]}" y="${p[1] + 4}" font-size="11" text-anchor="middle" fill="#fff" font-weight="bold">J</text>`);
  for (const [k, t] of (h.tp ?? []).entries()) for (const [px, py] of [[t[0], t[1]], [t[2], t[3]]]) s.push(`<circle cx="${px}" cy="${py}" r="16" fill="none" stroke="${COL.tp}" stroke-width="4"/><text x="${px}" y="${py + 4}" font-size="11" text-anchor="middle" fill="${COL.tp}" font-weight="bold">P${k + 1}</text>`);
  for (const q of h.q ?? []) s.push(`<rect x="${q[0] - 9}" y="${q[1] - 9}" width="18" height="18" fill="${COL.q}" stroke="#7a5a00" stroke-width="2"/><text x="${q[0]}" y="${q[1] + 4}" font-size="11" text-anchor="middle" font-weight="bold">?</text>`);
  // routes
  const routeColors = ['#0b57d0', '#d0168b', '#0f8a5f', '#b45309', '#6d28d9', '#be123c'];
  putts.forEach((p, i) => {
    const route = routes[`${index}/${i}`];
    if (!route) return;
    trace(index, i, route).forEach((pts, k) => {
      const d = pts.map((q, j) => `${j ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ');
      s.push(`<path d="${d}" fill="none" stroke="${routeColors[i % 6]}" stroke-width="2.2" stroke-dasharray="${k ? '2 3' : '7 4'}" opacity="0.85"/>`);
    });
  });
  putts.forEach((p, i) => {
    const [tx, ty] = p.tee, [hx, hy] = p.hole;
    s.push(`<circle cx="${hx}" cy="${hy}" r="15" fill="#fff" stroke="#000" stroke-width="2.5"/><circle cx="${hx}" cy="${hy}" r="6" fill="#000"/><text x="${hx + 15}" y="${hy - 12}" font-size="14" font-weight="bold" fill="#000" stroke="#fff" stroke-width="3" paint-order="stroke">H${i + 1}</text>`);
    s.push(`<rect x="${tx - 9}" y="${ty - 9}" width="18" height="18" fill="#fff" stroke="#000" stroke-width="2.5"/><text x="${tx}" y="${ty + 5}" font-size="13" font-weight="bold" text-anchor="middle">${i + 1}</text>`);
  });
  const title = `${index} · ${h.name} · ${world} · par ${putts.map(p => p.par).join('/')}`;
  s.push(`<text x="${x0 + 6}" y="${y0 + 20}" font-size="16" font-weight="bold" fill="#14102a">${title}</text>`);
  // coordinate ticks every 100
  for (let gx = Math.ceil(x0 / 100) * 100; gx < x1; gx += 100) s.push(`<text x="${gx}" y="${y1 - 2}" font-size="9" fill="#888" text-anchor="middle">${gx}</text>`);
  for (let gy = Math.ceil((y0 + 30) / 100) * 100; gy < y1; gy += 100) s.push(`<text x="${x0 + 2}" y="${gy}" font-size="9" fill="#888">${gy}</text>`);
  return { W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x0} ${y0} ${W} ${H}" font-family="Arial, sans-serif"><defs><marker id="ar" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="context-stroke"/></marker></defs>${s.join('')}</svg>` };
}

const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : maps.map((_, i) => i);
for (const i of only) {
  const { W, H, svg } = svgFor(i);
  await page.setViewportSize({ width: W, height: H });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  const slug = maps[i].name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await page.screenshot({ path: `${OUT}/${String(i).padStart(2, '0')}-${slug}.png`, clip: { x: 0, y: 0, width: W, height: H } });
}
await browser.close();
