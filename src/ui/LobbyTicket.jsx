import { WORLDS } from '../shared/worlds.js';
import { NAME_LIMIT } from './commands.js';
import { ColorBadge } from './BadgePicker.jsx';
import styles from './LobbyTicket.module.css';

/** The planets a ticket can name, in the destination carousel's order, with airport-style codes. */
export const TICKET_WORLDS = Object.freeze(['gaia', 'luna', 'ares']);
const CODES = Object.freeze({ gaia: 'GAI', luna: 'LUN', ares: 'ARS' });
/** What each vehicle's pass calls itself and where it boards, as on a real pass: a gate, a helipad or a launch pad. */
export const PASS = Object.freeze({
  plane: { title: 'Plane Boarding Pass', gate: 'Gate', boards: 'Boarding' },
  helicopter: { title: 'Helicopter Boarding Pass', gate: 'Helipad', boards: 'Boarding' },
  rocket: { title: 'Rocket Boarding Pass', gate: 'Launch pad', boards: 'Launch' },
});

/** A flight number and gate from any text (the party code), stable for the party: PP 1000–9999 and a gate like B7. */
export function flightOf(text = '') {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { flight: 'PP ' + (1000 + (h % 9000)), gate: 'ABCDEF'[(h >>> 8) % 6] + (1 + ((h >>> 16) % 9)) };
}

/**
 * The lobby ticket (owner, 2026-11-16): a bright boarding pass on the right of the Solo and party lobbies, laid out like a real one:
 * the vehicle's pass title, the passenger with their colour badge (click it to change colour: the same picker and palette
 * everywhere), the route in airport-style codes, then flight, gate, seat, boarding, zone and class, and the lobby's buttons
 * (`children`). In a party the host switches the destination on the pass (`onDestination`); everyone else sees it change. Names
 * render as React text only, cut to NAME_LIMIT characters.
 */
export function LobbyTicket({ vehicle = 'plane', name = '', color = null, taken = {}, onPick, solo = false, destination = 'gaia', onDestination = null, flight = 'PP 1000', gate = 'A1', seat = 1, extra = [], hidden = false, children }) {
  const planet = WORLDS.find(w => w.id === destination)?.name ?? 'Gaia';
  const pass = PASS[vehicle] ?? PASS.plane;
  const shown = String(name).trim().slice(0, NAME_LIMIT) || 'Player';
  const fields = [['Flight', flight], [pass.gate, gate], ['Seat', String(seat).padStart(2, '0')], [pass.boards, 'Now'], ['Zone', '1'], ['Class', 'First'], ...extra];
  return (
    <aside className={styles.ticket} data-ui="lobby-ticket" data-world={destination} data-vehicle={vehicle} aria-label={pass.title}>
      <header className={styles.head}>
        <span className={styles.brand}>Putt Planet Air</span>
        <span className={styles.title} data-ui="ticket-title">{pass.title}</span>
      </header>
      <div className={styles.passenger}>
        <small>Passenger</small>
        <div className={styles.who}>
          <ColorBadge color={color} taken={taken} onPick={onPick} hidden={hidden} solo={solo} />
          <strong data-ui="ticket-name">{shown}</strong>
        </div>
        <span className={styles.tip}>Tap your ball to change its colour</span>
      </div>
      <div className={styles.route}>
        <div><b>HOM</b><small>Home</small></div>
        <span className={styles.path} aria-hidden="true" />
        <div className={styles.to}><b data-ui="ticket-code">{CODES[destination] ?? 'GAI'}</b><small data-ui="ticket-destination">{planet}</small></div>
      </div>
      {onDestination && (
        <div className={styles.worlds} role="radiogroup" aria-label="Destination" data-ui="destination-pick">
          {TICKET_WORLDS.map(id => (
            <button key={id} type="button" role="radio" aria-checked={id === destination} data-world={id} className={styles.world}
              onClick={() => { if (id !== destination) onDestination(id); }}>{WORLDS.find(w => w.id === id).name}</button>
          ))}
        </div>
      )}
      <dl className={styles.details}>
        {fields.map(([label, value]) => <div key={label} data-field={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className={styles.actions}>{children}</div>
      <div className={styles.stub} aria-hidden="true"><span className={styles.barcode} /><span className={styles.stubText}>{flight} · {shown.toUpperCase()}</span></div>
    </aside>
  );
}
