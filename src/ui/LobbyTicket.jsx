import { WORLDS } from '../shared/worlds.js';
import { NAME_LIMIT } from './commands.js';
import { Barcode } from './Barcode.jsx';
import { ColorBadge } from './BadgePicker.jsx';
import styles from './LobbyTicket.module.css';

const CODES = Object.freeze({ gaia: 'GAI', luna: 'LUN', ares: 'ARS' });
/** What each vehicle's pass calls itself and where it boards, as on a real pass: a gate, a helipad or a launch pad. */
export const PASS = Object.freeze({
  plane: { title: 'Plane Boarding Pass', gate: 'Gate' },
  helicopter: { title: 'Helicopter Boarding Pass', gate: 'Helipad' },
  rocket: { title: 'Rocket Boarding Pass', gate: 'Launch pad' },
  minirocket: { title: 'Rocket Boarding Pass', gate: 'Launch pad' }, // the Solo rocket to Luna and Ares
});

/**
 * Themed gates (owner, 2026-11-17): the party plane boards at Cloud 9, rockets launch from a Luna crater or an Ares canyon (numbered
 * from the flight, so a party keeps its pad), and the Solo helicopter lifts off from a lily pad on Gaia's lakes (owner, 2026-11-17).
 */
export function gateFor(vehicle, destination, flight = '') {
  const n = 1 + (Number(String(flight).replace(/\D/g, '')) || 0) % 9;
  if (vehicle === 'helicopter') return { kind: 'lily', text: 'Lily Pad ' + n };
  if (vehicle === 'rocket' || vehicle === 'minirocket') {
    return destination === 'luna' ? { kind: 'crater', text: 'Crater ' + n } : { kind: 'canyon', text: 'Canyon ' + n };
  }
  return { kind: 'cloud', text: 'Cloud 9' };
}

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
 * The lobby ticket (owner, 2026-11-16, 2026-11-17): a bright boarding pass on the right of the Solo and party lobbies, laid out like a
 * real one: the vehicle's pass title, the passenger with their colour badge (click it to change colour: the same picker and palette
 * everywhere) and name (`onName`: click it to edit), the route in airport-style codes, then flight, gate and seat, then
 * the lobby's buttons (`children`: Play or Start Game) and, on the stub, a real Code 39 barcode of the party code (the flight on a
 * Solo pass) with the code printed under it like a booking reference
 * (`code`, with a copy-invite icon: `onCopy`) and Back (`onBack`). The route shows the destination only: both lobbies pick the planet
 * on their planet picker (PlanetPicker.jsx, owner 2026-11-18). Names render as React text only, cut to NAME_LIMIT.
 */
export function LobbyTicket({ vehicle = 'plane', name = '', onName = null, onNameDone = null, color = null, taken = {}, onPick, solo = false, destination = 'gaia', code = '', onCopy = null, flight = 'PP 1000', seat = 1, onBack = null, backLabel = 'Back', hidden = false, children }) {
  const planet = WORLDS.find(w => w.id === destination)?.name ?? 'Gaia';
  const pass = PASS[vehicle] ?? PASS.plane;
  const gateMark = gateFor(vehicle, destination, flight);
  const fields = [['Flight', flight], [pass.gate, gateMark.text], ['Seat', String(seat).padStart(2, '0')]];
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
      <div className={styles.route}>
        <div><b>HOM</b><small>Home</small></div>
        <span className={styles.path} aria-hidden="true" />
        <div className={styles.to}><b data-ui="ticket-code">{CODES[destination] ?? 'GAI'}</b><small data-ui="ticket-destination">{planet}</small></div>
      </div>
      <dl className={styles.details}>
        {fields.map(([label, value]) => <div key={label} data-field={label}><dt>{label}</dt><dd data-gate={label === pass.gate ? gateMark.kind : undefined}>{value}</dd></div>)}
      </dl>
      <div className={styles.actions}>{children}</div>
      <div className={styles.stub}>
        <Barcode className={styles.barcode} value={code || flight.replace(/\s/g, '')} />
        {onBack && <button type="button" className={styles.back} onClick={onBack} data-ui={solo ? 'menu-back' : 'pass-leave'} data-kind={solo ? 'back' : 'leave'}>{backLabel}</button>}
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

