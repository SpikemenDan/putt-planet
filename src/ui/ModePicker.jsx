import { GameModes } from '../shared/session.js';
import { MenuIcon } from './MenuIcons.jsx';
import styles from './ModePicker.module.css';

/** Colour, icon and words for each party mode tile (owner, 2026-11-16), matching the Solo choices' colours. Presentation only. */
export const MODE_LOOK = Object.freeze({
  [GameModes.STANDARD]: { tone: '#2fbf5b', icon: 'flag', title: 'Standard', sub: '1 map' },
  [GameModes.PONG]: { tone: '#ffd23f', icon: 'pong', title: 'Putt Pong', sub: '1 v 1' },
  [GameModes.TOURNAMENT_3]: { tone: '#ffb547', icon: 'trophy', title: 'Tournament', sub: '3 maps' },
  [GameModes.TOURNAMENT_5]: { tone: '#ff8a1f', icon: 'trophy', title: 'Tournament', sub: '5 maps' },
  [GameModes.TOURNAMENT_7]: { tone: '#f2560b', icon: 'trophy', title: 'Tournament', sub: '7 maps' },
  [GameModes.PRACTICE]: { tone: '#8b5cf6', icon: 'map', title: 'Practice', sub: 'any map' },
  [GameModes.PUTT_PRACTICE]: { tone: '#ff3d8b', icon: 'putt', title: 'Practice', sub: 'one putt' },
});

/**
 * The host's game mode choice as colourful tiles (owner, 2026-11-16): one per mode the room offers, each in its own colour with an
 * icon. Modes the room cannot run now (solo practice with friends aboard) are left out. A radio group of native buttons.
 */
export function ModePicker({ modes = [], value, onChange, hidden = false }) {
  return (
    <div className={styles.picker} role="radiogroup" aria-label="Game mode" data-ui="mode-picker" hidden={hidden}>
      {modes.filter(o => !o.disabled).map(o => {
        const look = MODE_LOOK[o.value] ?? { tone: '#27c8ff', icon: 'flag', title: o.label, sub: '' };
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} disabled={!!o.disabled} data-mode={o.value} className={styles.tile}
            style={{ '--tone': look.tone }} title={o.disabled ? 'Solo only' : o.label} onClick={() => onChange?.(o.value)}>
            <MenuIcon name={look.icon} className={styles.icon} />
            <span className={styles.title}>{look.title}</span>
            <small>{o.disabled ? 'solo only' : look.sub}</small>
          </button>
        );
      })}
    </div>
  );
}
