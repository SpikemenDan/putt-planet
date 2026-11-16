import { useEffect, useRef } from 'react';
import { colorHex } from '../shared/colors.js';
import { NAME_LIMIT } from './commands.js';
import { useUiContext } from './context.js';
import styles from './LobbyVehicle.module.css';

/** Seats per vehicle: the Solo helicopter carries one ball, the party plane and rocket eight (the room cap). */
export const VEHICLE_SEATS = Object.freeze({ helicopter: 1, plane: 8, rocket: 8 });
const VEHICLE_NAMES = Object.freeze({ helicopter: 'helicopter', plane: 'plane', rocket: 'rocket' });

/** A tag's place: tags alternate above and below the vehicle, seat by seat, so neighbours never overlap (owner, 2026-11-16). */
export const tagSide = seat => (seat % 2 === 0 ? 'top' : 'bottom');

/**
 * The lobby vehicle (owner, 2026-11-16): a 3D helicopter, plane or rocket carrying every player's ball in their colour, drawn by
 * the injected `createLobbyScene` (src/render/lobby-scene.js). Each ball has a name tag with a colour dot; tags alternate above and
 * below the vehicle and follow their ball every frame through direct style writes, never React state. Without a scene (no WebGL,
 * tests) the tags show as a plain row. Names render as React text only and are cut to NAME_LIMIT characters.
 */
export function LobbyVehicle({ vehicle = 'plane', passengers = [], hidden = false }) {
  const { display, createLobbyScene } = useUiContext();
  const canvas = useRef(null);
  const scene = useRef(null);
  const tags = useRef([]);
  const wrap = useRef(null);
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
    made.onAnchors((anchors) => {
      for (const a of anchors) {
        const tag = tags.current[a.seat];
        if (!tag) continue;
        const below = tag.dataset.side === 'bottom';
        // Above: the tag's foot sits just over the ball. Below: it hangs under the vehicle's belly (the scene's `below` point).
        // Each side staggers its tags over two rows, so tags on the same row are four seats apart and never overlap.
        const stagger = Math.floor(a.seat / 2) % 2 ? 30 : 0;
        const x = below && a.below ? a.below.x : a.x, y = below ? (a.below ? a.below.y : a.y + a.r * 4.4) + stagger : a.y - a.r - 6 - stagger;
        tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${below ? '0' : '-100%'})`;
        tag.style.visibility = 'visible';
      }
    });
    made.setPassengers(latest.current);
    made.start();
    return () => { made.dispose(); scene.current = null; wrap.current?.removeAttribute('data-mode'); };
  }, [createLobbyScene, display, hidden]); // eslint-disable-line react-hooks/exhaustive-deps -- vehicle and riders are pushed below

  useEffect(() => { scene.current?.setVehicle(vehicle); }, [vehicle]);
  const key = colors.join(',');
  useEffect(() => { scene.current?.setPassengers(colors); }, [key, vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrap} className={styles.wrap} data-ui="lobby-vehicle" data-vehicle={vehicle}>
      <div className={styles.sky} aria-hidden="true"><span /><span /><span /></div>
      {!hidden && <canvas ref={canvas} className={styles.canvas} data-ui="lobby-canvas" role="img" aria-label={`A ${VEHICLE_NAMES[vehicle] ?? 'vehicle'} carrying ${riders.length === 1 ? 'one ball' : riders.length + ' balls'}`} />}
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
