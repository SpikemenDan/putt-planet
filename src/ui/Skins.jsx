import { useState } from 'react';
import { BALL_SKINS, CELEBRATIONS, TRAIL_SKINS } from '../cosmetics/catalog.js';
import { PLAYER_COLORS } from '../shared/colors.js';
import { UiCommands } from './commands.js';
import css from './Skins.module.css';

/**
 * Skins menu (owner, 2026-11-16): ball finish, trail and celebration, each on its own tab, with a live preview of the
 * player's ball at the top. Every card draws its catalog record in CSS (no extra assets), and picking one sends
 * SET_COSMETIC with a catalog id, exactly as the old Settings dropdowns did. Cosmetics never affect physics.
 */
const TABS = Object.freeze([
  { kind: 'ball', label: 'Ball', records: BALL_SKINS },
  { kind: 'trail', label: 'Trail', records: TRAIL_SKINS },
  { kind: 'celebration', label: 'Celebration', records: CELEBRATIONS },
]);

const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');

/** CSS variables that draw one record (and the chosen ones in the preview). */
function looks(kind, record, ball) {
  if (kind === 'ball') return { '--glow': record.emissiveIntensity > 0 ? hex(record.emissive) : 'transparent', '--glow-k': record.emissiveIntensity };
  if (kind === 'trail') {
    const tint = record.color === 'player' ? ball : record.color === 'rainbow' ? null : hex(record.color);
    return { '--trail': tint ? `linear-gradient(to left,${tint},transparent)` : 'linear-gradient(to left,#ff3d8b,#ffd23f,#2fbf5b,#27c8ff,#8a5cff,transparent)', '--trail-size': record.size };
  }
  const p = record.palette.map(hex);
  return Object.fromEntries(Array.from({ length: 8 }, (_, i) => ['--c' + i, p[i % p.length]]).concat([['--burst', record.lift * 1.0], ['--speed', 1 / record.speed]]));
}

function Swatch({ kind, record, ball }) {
  return (
    <span className={css.swatch} data-kind={kind} style={{ '--ball': ball, ...looks(kind, record, ball) }} aria-hidden="true">
      {kind === 'celebration' && Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i }} />)}
      <b />
    </span>
  );
}

export function Skins({ cosmetics, color, send, colorField }) {
  const [tab, setTab] = useState('ball');
  const [replay, setReplay] = useState(0); // remounts the preview's celebration so it plays again on a pick
  const ball = PLAYER_COLORS[Number.isInteger(color) ? color : 0] || '#ffffff';
  const current = TABS.find(t => t.kind === tab);
  const record = (kind, id) => TABS.find(t => t.kind === kind).records.find(r => r.id === id) || TABS.find(t => t.kind === kind).records[0];
  const pick = (kind, id) => { send(UiCommands.SET_COSMETIC, { kind, id }); if (kind === 'celebration') setReplay(n => n + 1); };
  const chosen = { ball: record('ball', cosmetics.ball), trail: record('trail', cosmetics.trail), celebration: record('celebration', cosmetics.celebration) };

  return (
    <div className={css.skins} data-ui="skins">
      <div className={css.stage} aria-hidden="true" style={{ '--ball': ball, ...looks('ball', chosen.ball, ball), ...looks('trail', chosen.trail, ball), ...looks('celebration', chosen.celebration, ball) }}>
        <span className={css.green} />
        <span className={css.trail} />
        <span className={css.ball} />
        <span key={replay} className={css.burst} data-replay={replay}>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</span>
      </div>
      <p className={css.now} data-ui="skins-current">{chosen.ball.name} ball · {chosen.trail.name} trail · {chosen.celebration.name}</p>
      <div className={css.tabs} role="tablist" aria-label="Skin type">
        {TABS.map(t => (
          <button key={t.kind} type="button" role="tab" id={'skins-tab-' + t.kind} aria-selected={tab === t.kind} aria-controls="skins-panel" className={css.tab} data-kind={t.kind} onClick={() => setTab(t.kind)}>{t.label}</button>
        ))}
      </div>
      <div id="skins-panel" role="tabpanel" aria-labelledby={'skins-tab-' + tab} className={css.panel} data-kind={tab}>
        <div className={css.grid} role="radiogroup" aria-label={current.label} data-ui="cosmetics" data-kind={tab}>
          {current.records.map(r => (
            <button key={r.id} type="button" role="radio" aria-checked={cosmetics[tab] === r.id} className={css.card} data-id={r.id} onClick={() => pick(tab, r.id)}>
              <Swatch kind={tab} record={r} ball={ball} />
              <span className={css.name}>{r.name}</span>
            </button>
          ))}
        </div>
        {tab === 'ball' && <div className={css.colour}>{colorField}</div>}
      </div>
    </div>
  );
}
