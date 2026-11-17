import { useEffect, useRef } from 'react';
import { colorHex } from '../shared/colors.js';
import { NAME_LIMIT } from './commands.js';
import { useUiContext } from './context.js';
import styles from './LobbyVehicle.module.css';

/** Seats per vehicle: the Solo helicopter carries one ball, the party plane and rocket eight (the room cap). */
export const VEHICLE_SEATS = Object.freeze({ helicopter: 1, plane: 8, rocket: 8 });
const VEHICLE_NAMES = Object.freeze({ helicopter: 'helicopter', plane: 'plane', rocket: 'rocket' });

/** A tag's place: tags alternate between a lane above the vehicle and a lane below it, seat by seat (owner, 2026-11-16). */
export const tagSide = seat => (seat % 2 === 0 ? 'top' : 'bottom');

/** Gap between a lane and the nearest ball (top) or the belly (bottom), in CSS px. */
const LANE_GAP = { top: 34, bottom: 26 };

/**
 * Where the tags go this frame: one lane above the highest ball and one below the lowest belly point, each tag at its ball's x
 * (kept on screen), with a leader line from the tag to its ball (top) or to the belly under it (bottom). Pure, for tests.
 */
export function layoutTags(anchors, width) {
  if (!anchors.length) return [];
  const top = Math.min(...anchors.map(a => a.y - a.r)) - LANE_GAP.top;
  const bottom = Math.max(...anchors.map(a => (a.below ? a.below.y : a.y + a.r * 4))) + LANE_GAP.bottom;
  return anchors.map(a => {
    const side = tagSide(a.seat), x = Math.min(Math.max(a.x, 64), Math.max(64, width - 64));
    return side === 'top'
      ? { seat: a.seat, side, x, y: top, line: [x, top, a.x, a.y - a.r - 3] }
      : { seat: a.seat, side, x, y: bottom, line: [x, bottom, a.below ? a.below.x : a.x, a.below ? a.below.y : a.y + a.r] };
  });
}

/**
 * The lobby vehicle (owner, 2026-11-16): a 3D helicopter, plane or rocket carrying every player's ball in their colour, drawn full
 * screen by the injected `createLobbyScene` (src/render/lobby-scene.js) over the planet sky. Each ball has a name tag with a colour
 * dot; tags alternate between a lane above and a lane below the vehicle, joined to their ball by a leader line, and follow it every
 * frame through direct style writes, never React state. `insets()` reports the pixels the lobby's panels cover, so the vehicle is
 * framed in the space between them. Without a scene (no WebGL, tests) the tags show as a plain row. Names render as React text only
 * and are cut to NAME_LIMIT characters.
 */
export function LobbyVehicle({ vehicle = 'plane', passengers = [], hidden = false, insets = null }) {
  const { display, createLobbyScene } = useUiContext();
  const canvas = useRef(null);
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

  useEffect(() => {
    const el = canvas.current;
    if (hidden || !el || !createLobbyScene) return undefined;
    const win = el.ownerDocument.defaultView;
    const reducedMotion = !!win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let made = null;
    try { made = createLobbyScene({ canvas: el, display, vehicle, reducedMotion, win }); } catch { made = null; }
    if (!made?.stats?.webgl) { made?.dispose?.(); return undefined; }
    scene.current = made;
    wrap.current?.setAttribute('data-mode', '3d');
    const fit = () => { const box = measure.current?.(); if (box) made.setInsets?.(box); };
    fit();
    const refit = win.setInterval(fit, 400); // panels can grow (a picker opens, a player joins): keep the framing current
    made.onAnchors((anchors, { width }) => {
      for (const t of layoutTags(anchors, width)) {
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
    made.setPassengers(latest.current);
    made.start();
    return () => { win.clearInterval(refit); made.dispose(); scene.current = null; wrap.current?.removeAttribute('data-mode'); };
  }, [createLobbyScene, display, hidden]); // eslint-disable-line react-hooks/exhaustive-deps -- vehicle and riders are pushed below

  useEffect(() => { scene.current?.setVehicle(vehicle); }, [vehicle]);
  const key = colors.join(',');
  useEffect(() => { scene.current?.setPassengers(colors); }, [key, vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrap} className={styles.wrap} data-ui="lobby-vehicle" data-vehicle={vehicle}>
      {!hidden && <canvas ref={canvas} className={styles.canvas} data-ui="lobby-canvas" role="img" aria-label={`A ${VEHICLE_NAMES[vehicle] ?? 'vehicle'} carrying ${riders.length === 1 ? 'one ball' : riders.length + ' balls'}`} />}
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
