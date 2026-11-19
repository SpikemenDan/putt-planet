import { WORLDS } from '../shared/worlds.js';
import { NAME_LIMIT } from './commands.js';
import { ColorBadge } from './BadgePicker.jsx';
import { colorHex } from '../shared/colors.js';
import styles from './LobbyTicket.module.css';

const CODES = Object.freeze({ gaia: 'GAI', luna: 'LUN', ares: 'ARS' });

/**
 * The destination code (owner, 2026-11-18; no boxes, owner 2026-11-19): three letters in the planet's colour (Gaia green, Luna purple,
 * Ares red), keyed by the destination so a new planet flips them in one after another (`--look-flip` sets how long each takes). The
 * text stays the plain code for screen readers and tests.
 */
function Flaps({ text, world }) {
  return [...text].map((ch, i) => <span key={world + i} className={styles.flap} style={{ '--i': i }}>{ch}</span>);
}
/** What each vehicle's pass calls itself. */
export const PASS = Object.freeze({
  plane: { title: 'Plane Boarding Pass' },
  helicopter: { title: 'Helicopter Boarding Pass' },
  rocket: { title: 'Rocket Boarding Pass' },
  minirocket: { title: 'Rocket Boarding Pass' }, // the Solo rocket to Luna and Ares
});

const KEYPAD = { a: 2, b: 2, c: 2, d: 3, e: 3, f: 3, g: 4, h: 4, i: 4, j: 5, k: 5, l: 5, m: 6, n: 6, o: 6, p: 7, q: 7, r: 7, s: 7, t: 8, u: 8, v: 8, w: 9, x: 9, y: 9, z: 9 };
/** Each letter or digit as typed on a phone keypad (A–C → 2 … W–Z → 9). */
const keypad = text => [...String(text).toLowerCase()].map(ch => /\d/.test(ch) ? ch : KEYPAD[ch] ?? '').join('');

/**
 * The flight number, an easter egg (owner, 2026-11-17): a party's flight is its code, airline style. The first two characters are
 * the airline and the next four are typed on a phone keypad, so code TB3JWZDQ flies as TB 3599. Solo (`code` empty) flies Putt
 * Planet Air to its planet's name on the keypad: Gaia is PP 4242, Ares PP 2737, Luna PP 5862.
 */
export function flightOf(code = '', world = 'gaia') {
  const clean = String(code).replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (clean.length >= 3) return { flight: clean.slice(0, 2) + ' ' + keypad(clean.slice(2, 6)) };
  return { flight: 'PP ' + (keypad(world).slice(0, 4) || '1000') };
}

/**
 * The passenger's name on the pass. With `onName` it is edited right there, like the colour badge beside it: the name is a field that
 * reads as printed text until you click it. `onNameDone` runs when editing ends (Enter, Escape or clicking away): a party sends the
 * rename to the room then, not on every key. Without `onName` it is plain text. An empty name nudges (owner, 2026-11-17): the
 * blank reads NAME on a soft highlighter stripe and the pencil wiggles, so players name themselves on the pass.
 */
function PassengerName({ name, onName, onNameDone }) {
  const shown = String(name).trim().slice(0, NAME_LIMIT) || 'Player';
  if (!onName) return <strong className={styles.name} data-ui="ticket-name">{shown}</strong>;
  return (
    <label className={styles.nameEdit} data-ui="ticket-name-edit" data-empty={String(name).trim() ? undefined : ''}>
      <input className={styles.name} data-ui="ticket-name" aria-label="Your name" maxLength={NAME_LIMIT} autoComplete="off" spellCheck={false}
        placeholder="NAME" value={name} onChange={e => onName(e.target.value)} onBlur={() => onNameDone?.()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur(); } }} />
      <svg className={styles.pencil} viewBox="0 0 24 24" aria-hidden="true"><path className={styles.pencilBody} d="M15.2 3.6l5.2 5.2L9.6 19.6l-5.2-5.2z" /><path className={styles.pencilTip} d="M4.4 14.4l5.2 5.2-6.6 1.4z" /><path className={styles.pencilEnd} d="M15.2 3.6l1.6-1.6a1.6 1.6 0 0 1 2.3 0l2.9 2.9a1.6 1.6 0 0 1 0 2.3l-1.6 1.6z" /></svg>
    </label>
  );
}

/**
 * The passenger list on the pass (owner, 2026-11-19: "put the passenger list on the ticket", replacing the separate manifest card):
 * everyone aboard with their ball and name (the host wears a star, your own name is pink), two to a row, and how many seats are still open. Names render as React
 * text only, cut to NAME_LIMIT.
 */
function Passengers({ list, seats }) {
  const open = Math.max(0, seats - list.length);
  return (
    <section className={styles.manifest} aria-label="Passenger manifest" data-ui="lobby-manifest">
      <small>Passengers · {list.length}/{seats}</small>
      <ol className={styles.aboard}>
        {list.map(p => (
          <li key={p.id} data-you={p.you || undefined} style={{ '--ball': colorHex(p.color) }}>
            <span className={styles.ball} aria-hidden="true" />
            <span className={styles.who2}>{String(p.name).slice(0, NAME_LIMIT)}</span>
            {p.host && <span className={styles.host} title="Host"><span className={styles.hiddenText}>Host</span></span>}
            {p.you && <span className={styles.hiddenText}>You</span>}
          </li>
        ))}
      </ol>
      {open > 0 && <p className={styles.openSeats} data-ui="open-seats">{open === 1 ? '1 seat open' : open + ' seats open'}</p>}
    </section>
  );
}

/**
 * The lobby ticket (owner, 2026-11-16; simpler, owner 2026-11-18: "make the ticket simpler it looks like too much"): a bright boarding
 * pass on the right of the Solo and party lobbies with the vehicle's pass title, the passenger with their colour badge (click it to
 * change colour) and name (`onName`: click it to edit), the route in airport-style codes, the lobby's buttons (`children`: Play or
 * Start Game) and, on the stub, Back (`onBack`) and the party code (`code`, with a copy-invite icon: `onCopy`) or, Solo, its flight number in the same place (owner, 2026-11-19: Solo's pass matches the party's). The route shows the
 * destination only: both lobbies pick the planet on their planet picker (PlanetPicker.jsx). Names render as React text only, cut to
 * NAME_LIMIT. A party passes `passengers` (and `seats`) to list everyone aboard under your name.
 */
export function LobbyTicket({ vehicle = 'plane', name = '', onName = null, onNameDone = null, color = null, taken = {}, onPick, solo = false, destination = 'gaia', code = '', onCopy = null, onBack = null, backLabel = 'Back', hidden = false, passengers = null, seats = 8, children }) {
  const planet = WORLDS.find(w => w.id === destination)?.name ?? 'Gaia';
  const pass = PASS[vehicle] ?? PASS.plane;
  return (
    <aside className={styles.ticket} data-ui="lobby-ticket" data-world={destination} data-vehicle={vehicle} aria-label={pass.title}>
      <header className={styles.head}>
        <span className={styles.brand}>Putt Planet Air</span>
        <span className={styles.title} data-ui="ticket-title">{pass.title}</span>
      </header>
      <div className={styles.passenger}>
        <small>Passenger</small>
        <div className={styles.who}>
          <ColorBadge color={color} taken={taken} onPick={onPick} hidden={hidden} />
          <PassengerName name={name} onName={onName} onNameDone={onNameDone} />
        </div>
      </div>
      {passengers && <Passengers list={passengers} seats={seats} />}
      <div className={styles.route}>
        <div><b>HOM</b><small>Home</small></div>
        <span className={styles.path} aria-hidden="true"><span className={styles.dots} /><svg className={styles.arrow} viewBox="0 0 16 16"><path d="M5 3l6 5-6 5" /></svg></span>
        <div className={styles.to}><b data-ui="ticket-code"><Flaps text={CODES[destination] ?? 'GAI'} world={destination} /></b><small data-ui="ticket-destination">{planet}</small></div>
      </div>
      <div className={styles.actions}>{children}</div>
      <div className={styles.stub}>
        {onBack && <button type="button" className={styles.back} onClick={onBack} data-ui={solo ? 'menu-back' : 'pass-leave'} data-kind={solo ? 'back' : 'leave'}>{backLabel}</button>}
        {solo && !code && (
          <span className={styles.code} data-ui="solo-flight"><small>Flight</small><strong>{flightOf('', destination).flight}</strong></span>
        )}
        {code && (
          <span className={styles.code} data-ui="party-code">
            <small>Party code</small><strong>{code}</strong>
            {onCopy && <button type="button" className={styles.copy} onClick={onCopy} title="Copy invite"><span className={styles.hiddenText}>Copy invite</span></button>}
          </span>
        )}
      </div>
    </aside>
  );
}

