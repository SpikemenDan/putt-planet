import { WORLDS } from '../shared/worlds.js';
import { NAME_LIMIT } from './commands.js';
import { ColorBadge } from './BadgePicker.jsx';
import styles from './LobbyTicket.module.css';

/** The planets a ticket can name, in the destination carousel's order. */
export const TICKET_WORLDS = Object.freeze(['gaia', 'luna', 'ares']);
const VEHICLE_LABEL = Object.freeze({ helicopter: 'Helicopter', plane: 'Plane', rocket: 'Rocket' });

/**
 * The lobby ticket (owner, 2026-11-16): a bright boarding pass on the right of the Solo and party lobbies. It names the passenger
 * with their colour badge (click it to change colour: the same picker and palette everywhere), the route to the destination
 * planet, the flight details and the lobby's buttons (`children`). In a party the host can switch the destination on the ticket
 * (`onDestination`); everyone else sees it change. Names render as React text only, cut to NAME_LIMIT characters.
 */
export function LobbyTicket({ vehicle = 'plane', name = '', color = null, taken = {}, onPick, solo = false, destination = 'gaia', onDestination = null, details = [], hidden = false, children }) {
  const planet = WORLDS.find(w => w.id === destination)?.name ?? 'Gaia';
  const shown = String(name).trim().slice(0, NAME_LIMIT) || 'Player';
  return (
    <aside className={styles.ticket} data-ui="lobby-ticket" data-world={destination} aria-label="Boarding pass">
      <header className={styles.head}>
        <span className={styles.brand}>Putt Planet</span>
        <span className={styles.kind}>Boarding pass</span>
        <span className={styles.vehicle} data-ui="ticket-vehicle">{VEHICLE_LABEL[vehicle] ?? 'Plane'}</span>
      </header>
      <div className={styles.route}>
        <div><small>From</small><b>Home</b></div>
        <span className={styles.path} aria-hidden="true" />
        <div className={styles.to}><small>To</small><b data-ui="ticket-destination">{planet}</b></div>
      </div>
      {onDestination && (
        <div className={styles.worlds} role="radiogroup" aria-label="Destination" data-ui="destination-pick">
          {TICKET_WORLDS.map(id => (
            <button key={id} type="button" role="radio" aria-checked={id === destination} data-world={id} className={styles.world}
              onClick={() => { if (id !== destination) onDestination(id); }}>{WORLDS.find(w => w.id === id).name}</button>
          ))}
        </div>
      )}
      <div className={styles.passenger}>
        <small>Passenger</small>
        <div className={styles.who}>
          <ColorBadge color={color} taken={taken} onPick={onPick} hidden={hidden} solo={solo} />
          <strong data-ui="ticket-name">{shown}</strong>
        </div>
        <span className={styles.tip}>Tap your colour to change it</span>
      </div>
      {details.length > 0 && (
        <dl className={styles.details}>
          {details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      )}
      <div className={styles.actions}>{children}</div>
      <div className={styles.stub} aria-hidden="true"><span className={styles.barcode} /></div>
    </aside>
  );
}
