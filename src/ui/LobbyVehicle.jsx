import { useEffect, useRef } from 'react';
import { colorHex } from '../shared/colors.js';
import { NAME_LIMIT } from './commands.js';
import { useUiContext } from './context.js';
import { lobbyCanvasSlot } from './lobby-canvas.js';
import styles from './LobbyVehicle.module.css';

/** Seats per vehicle: the Solo helicopter and Solo rocket carry one ball, the party plane and rocket eight (the room cap). */
export const VEHICLE_SEATS = Object.freeze({ helicopter: 1, minirocket: 1, plane: 8, rocket: 8 });
const VEHICLE_NAMES = Object.freeze({ helicopter: 'helicopter', minirocket: 'rocket', plane: 'plane', rocket: 'rocket' });

/** Where each planet roughly sits on screen, when the sky cannot say: Luna up and right, Ares up and left, Gaia below. */
const TOWARD = Object.freeze({ luna: { x: 0.8, y: 0.6 }, ares: { x: -0.8, y: 0.6 }, gaia: { x: 0.25, y: -1 } });

/**
 * True once the planet sky has finished flying to `destination`: the camera is there and settled (VIS-M4, src/render/planet-scene.js).
 * Without a live sky there is nothing to wait for.
 */
export function skyArrived(scene, destination) {
  const s = scene?.space;
  if (!s || typeof s.t !== 'number') return true;
  const settled = Math.abs(s.t - s.goal) < 0.02 && s.travel >= 1 && Math.abs(s.near - (s.nearGoal ?? s.near)) < 0.02;
  return settled && (destination === 'gaia' ? s.goal === 0 : s.to === destination);
}

/** A tag's place: tags alternate between a lane above the vehicle and a lane below it, seat by seat (owner, 2026-11-16). */
export const tagSide = seat => (seat % 2 === 0 ? 'top' : 'bottom');

/** Gap between a lane and the nearest ball (top) or the belly (bottom), in CSS px. */
const LANE_GAP = { top: 34, bottom: 26 };

/** Height of one row of tags, and the smallest gap between two tags on a row, in CSS px. */
const ROW = 36, ROOM = 8;

/**
 * Where the tags go this frame: a lane above the highest ball and a lane below the lowest belly point, each tag at its ball's x
 * (kept on screen), with a leader line from the tag to its ball (top) or to the belly under it (bottom). When the vehicle is small
 * and two tags of a lane would touch, the later one moves out to the next row, so tags never overlap. `widths[seat]` is each tag's
 * width in px (100 when unknown). Pure, for tests.
 */
export function layoutTags(anchors, width, widths = []) {
  if (!anchors.length) return [];
  const lane = { top: Math.min(...anchors.map(a => (a.above ? a.above.y : a.y - a.r))) - LANE_GAP.top, bottom: Math.max(...anchors.map(a => (a.below ? a.below.y : a.y + a.r * 4))) + LANE_GAP.bottom };
  const rows = { top: [], bottom: [] }; // the right edge of the last tag on each row
  return [...anchors].sort((a, b) => a.x - b.x).map(a => {
    const side = tagSide(a.seat), w = widths[a.seat] || 100;
    const x = Math.min(Math.max(a.x, w / 2 + 8), Math.max(w / 2 + 8, width - w / 2 - 8));
    let row = rows[side].findIndex(edge => edge + ROOM <= x - w / 2);
    if (row < 0) row = rows[side].push(-Infinity) - 1;
    rows[side][row] = x + w / 2;
    const y = side === 'top' ? lane.top - row * ROW : lane.bottom + row * ROW;
    return side === 'top'
      ? { seat: a.seat, side, row, x, y, line: [x, y, a.x, a.y - a.r - 3] }
      : { seat: a.seat, side, row, x, y, line: [x, y, a.below ? a.below.x : a.x, a.below ? a.below.y : a.y + a.r] };
  }).sort((a, b) => a.seat - b.seat);
}

/**
 * The lobby vehicle (owner, 2026-11-16): a 3D helicopter, plane or rocket carrying every player's ball in their colour, drawn full
 * screen by the injected `createLobbyScene` (src/render/lobby-scene.js) over the planet sky. Each ball has a name tag with a colour
 * dot; tags alternate between a lane above and a lane below the vehicle, joined to their ball by a leader line, and follow it every
 * frame through direct style writes, never React state. `insets()` reports the pixels the lobby's panels cover, so the vehicle is
 * framed in the space between them. Without a scene (no WebGL, tests) the tags show as a plain row. Names render as React text only
 * and are cut to NAME_LIMIT characters.
 */
export function LobbyVehicle({ vehicle = 'plane', destination = 'gaia', air = true, passengers = [], hidden = false, insets = null, sun = true }) {
  const { display, createLobbyScene, stage } = useUiContext();
  const host = useRef(null); // the pooled canvas is attached here while the lobby shows; React never renders it
  const label = useRef(null); // that canvas while attached, for its aria-label
  const scene = useRef(null);
  const tags = useRef([]);
  const lines = useRef([]);
  const wrap = useRef(null);
  const measure = useRef(insets);
  measure.current = insets;
  const seats = VEHICLE_SEATS[vehicle] ?? 8;
  const riders = passengers.slice(0, seats);
  const colors = Array.from({ length: seats }, (_, i) => (riders[i] ? colorHex(riders[i].color) : null));
  const latest = useRef(colors);
  latest.current = colors;
  const now = useRef(null);
  now.current = { vehicle, sun, destination, air, stage };
  const ariaLabel = useRef('');
  ariaLabel.current = `A ${VEHICLE_NAMES[vehicle] ?? 'vehicle'} carrying ${riders.length === 1 ? 'one ball' : riders.length + ' balls'}`;
  useEffect(() => { label.current?.setAttribute('aria-label', ariaLabel.current); });

  useEffect(() => {
    const box = host.current;
    if (hidden || !box || !createLobbyScene) return undefined;
    const doc = box.ownerDocument, win = doc.defaultView;
    const reducedMotion = !!win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // One canvas for every visit, so the lobby holds one WebGL context slot per page, not one per visit (src/ui/lobby-canvas.js).
    const slot = lobbyCanvasSlot(doc, styles.canvas);
    let made = null, refit = 0, el = null;
    const begin = () => {
      el = slot.canvas;
      box.append(el);
      label.current = el;
      el.setAttribute('aria-label', ariaLabel.current);
      try { made = createLobbyScene({ canvas: el, display, vehicle: now.current.vehicle, destination: now.current.destination, air: now.current.air, reducedMotion, win }); } catch { made = null; }
      if (!made?.stats?.webgl) { made?.dispose?.(); made = null; el.remove(); label.current = null; return; }
      slot.adopt(made.context);
      scene.current = made;
      wrap.current?.setAttribute('data-mode', '3d');
      const fit = () => { const panels = measure.current?.(); if (panels) made.setInsets?.(panels); };
      fit();
      refit = win.setInterval(fit, 400); // panels can grow (a picker opens, a player joins): keep the framing current
      made.onAnchors((anchors, { width }) => {
        const widths = tags.current.map(tag => tag?.offsetWidth ?? 0); // read every width before any write, so layout runs once
        const placed = layoutTags(anchors, width, widths), seated = new Set(placed.map(t => t.seat));
        // Nobody aboard on screen (the vehicle is flying between planets): the tags wait out of sight.
        tags.current.forEach((tag, seat) => { if (tag && !seated.has(seat)) { tag.style.visibility = 'hidden'; if (lines.current[seat]) lines.current[seat].style.visibility = 'hidden'; } });
        for (const t of placed) {
          const tag = tags.current[t.seat], line = lines.current[t.seat];
          if (!tag) continue;
          tag.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, ${t.side === 'top' ? '-100%' : '0'})`;
          tag.style.visibility = 'visible';
          if (line) {
            const [x1, y1, x2, y2] = t.line;
            line.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`);
            line.style.visibility = 'visible';
          }
        }
      });
      made.setSkyProbe?.(to => skyArrived(now.current.stage?.scene, to));
      made.setAimProbe?.(to => now.current.stage?.scene?.screenOf?.(to) ?? null);
      made.setSun?.(now.current.sun); // a restored canvas starts a moment later: catch up with what changed meanwhile
      made.setTrip?.({ vehicle: now.current.vehicle, destination: now.current.destination, air: now.current.air });
      made.setPassengers(latest.current);
      made.start();
    };
    const stopWaiting = slot.ready(begin);
    return () => {
      stopWaiting?.();
      if (made) { win.clearInterval(refit); slot.release(); made.dispose(); scene.current = null; wrap.current?.removeAttribute('data-mode'); }
      el?.remove();
      label.current = null;
    };
  }, [createLobbyScene, display, hidden]); // eslint-disable-line react-hooks/exhaustive-deps -- vehicle and riders are pushed below

  // A new planet or vehicle: the vehicle leaves and the next one arrives once the sky has flown there (lobby-scene.js, setTrip).
  // This child effect runs before the parent's sky move (useLobbySky), so the sky still shows where the destination lies from here.
  useEffect(() => {
    const made = scene.current;
    if (!made) return;
    if (!made.setTrip) { made.setVehicle(vehicle); return; }
    const toward = stage?.scene?.screenOf?.(destination) ?? TOWARD[destination];
    made.setTrip({ vehicle, destination, air, toward });
  }, [vehicle, destination]); // eslint-disable-line react-hooks/exhaustive-deps -- air follows on its own
  useEffect(() => { scene.current?.setAir?.(air); }, [air]);
  useEffect(() => { scene.current?.setSun?.(sun); }, [sun, hidden]);
  const key = colors.join(',');
  useEffect(() => { scene.current?.setPassengers(colors); }, [key, vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrap} className={styles.wrap} data-ui="lobby-vehicle" data-vehicle={vehicle}>
      <div ref={host} className={styles.host} />
      <svg className={styles.lines} aria-hidden="true">
        {riders.map((p, i) => <path key={p.id} ref={el => { lines.current[i] = el; }} style={{ '--ball': colorHex(p.color) }} />)}
      </svg>
      <div className={styles.tags} role="list" aria-label="Passengers" data-ui="lobby-passengers">
        {riders.map((p, i) => (
          <div key={p.id} ref={el => { tags.current[i] = el; }} role="listitem" data-side={tagSide(i)} data-color={p.color}
            className={styles.tag + (p.you ? ' ' + styles.you : '')} style={{ '--ball': colorHex(p.color), '--delay': (i * 0.08) + 's' }}>
            <span className={styles.dot} aria-hidden="true" /><span className={styles.name}>{String(p.name).slice(0, NAME_LIMIT)}</span>{p.you && <span className={styles.me}>you</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
