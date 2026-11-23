import { GameModes } from '../shared/session.js';
import { colorHex } from '../shared/colors.js';
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

/** Modes that share one tile, as small chips: the tournament lengths, and the practice kinds. */
const GROUPS = Object.freeze([
  { id: 'tournament', title: 'Tournament', look: GameModes.TOURNAMENT_5, members: [GameModes.TOURNAMENT_3, GameModes.TOURNAMENT_5, GameModes.TOURNAMENT_7], chip: { [GameModes.TOURNAMENT_3]: '3', [GameModes.TOURNAMENT_5]: '5', [GameModes.TOURNAMENT_7]: '7' } },
  { id: 'practice', title: 'Practice', look: GameModes.PRACTICE, members: [GameModes.PRACTICE, GameModes.PUTT_PRACTICE], chip: { [GameModes.PRACTICE]: 'Map', [GameModes.PUTT_PRACTICE]: 'Putt' } },
]);

/** The balls of the players who voted for an option, stacked in its corner. Presentation only. */
export function Voters({ list = [] }) {
  if (!list.length) return null;
  return (
    <span className={styles.voters} data-ui="voters" aria-label={list.length === 1 ? '1 vote' : list.length + ' votes'}>
      {list.map(v => <span key={v.id} className={styles.voter + (v.you ? ' ' + styles.mine : '')} style={{ '--ball': colorHex(v.color) }} title={v.name} data-color={v.color} />)}
    </span>
  );
}

/**
 * The game mode choice as colourful tiles in one row (owner, 2026-11-16, 2026-11-17): one tile per mode the room offers, each in its
 * own colour with an icon; the tournament lengths share one Tournament tile and the practice kinds one Practice tile, as chips. Modes
 * the room cannot run now are left out. `names` renames a mode's tile (Solo calls Standard Casual). In a party everyone votes: `voters`
 * (mode -> players) puts each voter's ball in the corner of their choice, `leading` marks the mode the vote has chosen so far, and the
 * checked choice is your own vote. Every choice is a native radio button with its `data-mode`.
 */
export function ModePicker({ modes = [], value, onChange, hidden = false, voters = null, leading = null, names = {} }) {
  const open = modes.filter(o => !o.disabled);
  const groupOf = v => GROUPS.find(g => g.members.includes(v));
  const radio = (o, className, children, tone, extra = null) => (
    <button key={o.value} type="button" role="radio" aria-checked={o.value === value} aria-label={o.label} data-mode={o.value} className={className}
      data-leading={o.value === leading || undefined} style={tone ? { '--tone': tone } : undefined} onClick={() => onChange?.(o.value)}>{children}{extra}</button>
  );
  const tiles = [], done = new Set();
  for (const o of open) {
    const group = groupOf(o.value);
    if (group) {
      if (done.has(group.id)) continue;
      done.add(group.id);
      const members = open.filter(m => groupOf(m.value) === group);
      const look = MODE_LOOK[group.look];
      const on = members.some(m => m.value === value), lead = members.some(m => m.value === leading);
      tiles.push(
        <div key={group.id} className={styles.tile + ' ' + styles.group} data-group={group.id} data-on={on || undefined} data-leading={lead || undefined} style={{ '--tone': look.tone }}
          onClick={e => { if (!on && e.target === e.currentTarget) onChange?.(members[0].value); }}>
          <MenuIcon name={look.icon} className={styles.icon} />
          <span className={styles.words}><span className={styles.title}>{group.title}</span>
            <span className={styles.chips}>{members.map(m => radio(m, styles.chip, group.chip[m.value], MODE_LOOK[m.value].tone, voters && <Voters list={voters[m.value]} />))}</span>
          </span>
        </div>,
      );
      continue;
    }
    const look = { ...(MODE_LOOK[o.value] ?? { tone: '#27c8ff', icon: 'flag', title: o.label, sub: '' }), ...(names[o.value] && { title: names[o.value] }) };
    tiles.push(radio(o, styles.tile, <>
      <MenuIcon name={look.icon} className={styles.icon} />
      <span className={styles.words}><span className={styles.title}>{look.title}</span><small>{look.sub}</small></span>
    </>, look.tone, voters && <Voters list={voters[o.value]} />));
  }
  return <div className={styles.picker} role="radiogroup" aria-label="Game mode" data-ui="mode-picker" data-voting={voters ? '' : undefined} hidden={hidden}>{tiles}</div>;
}
