import { useEffect } from 'react';
import { WORLDS } from '../shared/worlds.js';
import { OFFWORLD_REGIONS } from '../shared/world-regions.js';
import { Voters } from './ModePicker.jsx';
import styles from './PlanetPicker.module.css';

/** Worlds with playable courses: Gaia, plus every world with a region of maps (VIS-G #165: Ares and Luna). Others show as coming soon. */
export const PLAYABLE_WORLDS = Object.freeze(['gaia', ...Object.keys(OFFWORLD_REGIONS).filter(id => OFFWORLD_REGIONS[id].some(r => r.maps.length))]);

/** Arrow order (owner, 2026-11-12): left goes Gaia → Luna → Ares → Gaia, right goes back the other way. */
export const WORLD_ORDER = Object.freeze(['gaia', 'luna', 'ares']);
export const WORLD_BLURB = Object.freeze({ gaia: 'Home: six regions of courses', luna: 'Low gravity: long, floaty putts', ares: 'Lighter gravity: red canyons and highlands' });

/** The next planet from `id` in the arrow's direction, skipping planets that cannot be picked. */
export function nextWorld(id, dir, open = PLAYABLE_WORLDS) {
  const step = dir === 'left' ? 1 : WORLD_ORDER.length - 1;
  let k = WORLD_ORDER.indexOf(id);
  for (let n = 0; n < WORLD_ORDER.length; n++) {
    k = (k + step) % WORLD_ORDER.length;
    if (open.includes(WORLD_ORDER[k])) return WORLD_ORDER[k];
  }
  return id;
}

/**
 * The one planet picker of both lobbies (owner, 2026-11-18): Solo is a party of one. Arrows (or ← →) fly between the planets and
 * every planet has a chip; the lobby's sky behind follows the destination. `value` is the checked planet (Solo's destination, or
 * your own vote in a party); `voters` (planet -> players) puts each voter's ball on their planet and `leading` stars the planet the
 * vote leads with. Without `onPick` the picker only shows the destination (a guest in a room where the host picks).
 */
export function PlanetPicker({ value = 'gaia', onPick = null, open = PLAYABLE_WORLDS, voters = null, leading = null }) {
  const shown = WORLDS.find(w => w.id === value) ?? WORLDS[0];
  const turn = dir => onPick?.(nextWorld(value, dir, open));
  const onKeyDown = e => {
    if (!onPick || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    turn(e.key === 'ArrowLeft' ? 'left' : 'right');
  };
  return (
    <section className={styles.card} data-ui="planet-picker" data-world={value} data-voting={voters ? '' : undefined} onKeyDown={onKeyDown} aria-label="Destination">
      <div className={styles.head}>
        {onPick && <button type="button" className={styles.arrow} onClick={() => turn('left')} aria-label="Previous planet" data-ui="world-left">&lsaquo;</button>}
        <div className={styles.name} aria-live="polite"><small>Destination</small><b data-ui="planet-name">{shown.name}</b><span>{WORLD_BLURB[shown.id]}</span></div>
        {onPick && <button type="button" className={styles.arrow} onClick={() => turn('right')} aria-label="Next planet" data-ui="world-right">&rsaquo;</button>}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="Planet" data-ui="destination-pick">
        {WORLD_ORDER.map(id => {
          const can = open.includes(id);
          return (
            <button key={id} type="button" role="radio" aria-checked={id === value} disabled={!onPick || !can} title={can ? undefined : 'Coming soon'} data-world={id}
              data-leading={(voters && id === leading) || undefined} className={styles.chip} onClick={() => { if (id !== value) onPick(id); }}>
              {WORLDS.find(w => w.id === id).name}{voters && <Voters list={voters[id]} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The lobby sky follows the destination (both lobbies, owner 2026-11-17, 2026-11-18): Gaia's air for Gaia; for Ares and Luna the
 * planet scene brings its camera down to that planet's sky when it can (`near`), its own sun showing in place of the lobby's corner
 * sun, or else shows the planet from space, low along the bottom of the screen. `anchor` is any element in the lobby's document.
 * Returns whether the planet's own sky shows (so the lobby hides its corner sun).
 */
export function useLobbySky(stage, shown, destination, anchor) {
  const offworld = destination !== 'gaia';
  const nearSky = typeof stage?.scene?.space?.near === 'number';
  useEffect(() => {
    if (!shown) return undefined;
    stage?.setView({ space: offworld, target: offworld ? destination : 'gaia', near: offworld && nearSky });
    const sky = anchor.current?.ownerDocument.querySelector('[data-ui=planet-stage]');
    const view = sky?.ownerDocument.defaultView;
    const resized = () => view?.dispatchEvent(new view.Event('resize')); // a still (reduced-motion) planet scene redraws only on resize
    sky?.toggleAttribute('data-low', offworld && !nearSky);
    resized();
    return () => { stage?.setView({ space: false, target: 'gaia', near: false }); sky?.removeAttribute('data-low'); resized(); };
  }, [stage, shown, offworld, destination, nearSky]);
  return offworld && nearSky;
}
