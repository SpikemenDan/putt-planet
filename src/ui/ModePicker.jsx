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

const TOURNAMENTS = Object.freeze([GameModes.TOURNAMENT_3, GameModes.TOURNAMENT_5, GameModes.TOURNAMENT_7]);

/**
 * The host's game mode choice as colourful tiles in one row (owner, 2026-11-16, 2026-11-17): one tile per mode the room offers, each in
 * its own colour with an icon; the three tournament lengths share one Tournament tile with 3, 5 and 7 chips. Modes the room cannot run
 * now (solo practice with friends aboard) are left out. Every choice is a native radio button with its `data-mode`.
 */
export function ModePicker({ modes = [], value, onChange, hidden = false }) {
  const open = modes.filter(o => !o.disabled);
  const lengths = open.filter(o => TOURNAMENTS.includes(o.value));
  const radio = (o, className, children, tone) => (
    <button key={o.value} type="button" role="radio" aria-checked={o.value === value} aria-label={o.label} data-mode={o.value} className={className}
      style={tone ? { '--tone': tone } : undefined} onClick={() => onChange?.(o.value)}>{children}</button>
  );
  const tiles = [];
  for (const o of open) {
    if (TOURNAMENTS.includes(o.value)) {
      if (o !== lengths[0]) continue;
      const look = MODE_LOOK[GameModes.TOURNAMENT_5];
      const on = lengths.some(l => l.value === value);
      tiles.push(
        <div key="tournament" className={styles.tile + ' ' + styles.group} data-group="tournament" data-on={on || undefined} style={{ '--tone': look.tone }}
          onClick={e => { if (!on && e.target === e.currentTarget) onChange?.(lengths[0].value); }}>
          <MenuIcon name={look.icon} className={styles.icon} />
          <span className={styles.words}><span className={styles.title}>Tournament</span>
            <span className={styles.chips}>{lengths.map(l => radio(l, styles.chip, MODE_LOOK[l.value].sub.split(' ')[0], MODE_LOOK[l.value].tone))}</span>
          </span>
        </div>,
      );
      continue;
    }
    const look = MODE_LOOK[o.value] ?? { tone: '#27c8ff', icon: 'flag', title: o.label, sub: '' };
    tiles.push(radio(o, styles.tile, <>
      <MenuIcon name={look.icon} className={styles.icon} />
      <span className={styles.words}><span className={styles.title}>{look.title}</span><small>{look.sub}</small></span>
    </>, look.tone));
  }
  return <div className={styles.picker} role="radiogroup" aria-label="Game mode" data-ui="mode-picker" hidden={hidden}>{tiles}</div>;
}
