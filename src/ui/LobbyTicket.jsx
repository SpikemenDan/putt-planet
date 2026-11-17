import { WORLDS } from '../shared/worlds.js';
import { NAME_LIMIT } from './commands.js';
import { ColorBadge } from './BadgePicker.jsx';
import { MenuIcon } from './MenuIcons.jsx';
import styles from './LobbyTicket.module.css';

/** The planets a ticket can name, in the destination carousel's order, with airport-style codes. */
export const TICKET_WORLDS = Object.freeze(['gaia', 'luna', 'ares']);
const CODES = Object.freeze({ gaia: 'GAI', luna: 'LUN', ares: 'ARS' });
/** What each vehicle's pass calls itself and where it boards, as on a real pass: a gate, a helipad or a launch pad. */
export const PASS = Object.freeze({
  plane: { title: 'Plane Boarding Pass', gate: 'Gate' },
  helicopter: { title: 'Helicopter Boarding Pass', gate: 'Helipad' },
  rocket: { title: 'Rocket Boarding Pass', gate: 'Launch pad' },
});

/** A flight number and gate from any text (the party code), stable for the party: PP 1000–9999 and a gate like B7. */
export function flightOf(text = '') {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { flight: 'PP ' + (1000 + (h % 9000)), gate: 'ABCDEF'[(h >>> 8) % 6] + (1 + ((h >>> 16) % 9)) };
}

/**
 * The passenger's name on the pass. With `onName` it is edited right there, like the colour badge beside it: the name is a field that
 * reads as printed text until you click it. Without `onName` (a party: names are set when you join) it is plain text.
 */
function PassengerName({ name, onName }) {
  const shown = String(name).trim().slice(0, NAME_LIMIT) || 'Player';
  if (!onName) return <strong className={styles.name} data-ui="ticket-name">{shown}</strong>;
  return (
    <label className={styles.nameEdit} data-ui="ticket-name-edit">
      <input className={styles.name} data-ui="ticket-name" aria-label="Your name" maxLength={NAME_LIMIT} autoComplete="off" spellCheck={false}
        placeholder="Player" value={name} onChange={e => onName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur(); } }} />
      <svg className={styles.pencil} viewBox="0 0 24 24" aria-hidden="true"><path className={styles.pencilBody} d="M15.2 3.6l5.2 5.2L9.6 19.6l-5.2-5.2z" /><path className={styles.pencilTip} d="M4.4 14.4l5.2 5.2-6.6 1.4z" /><path className={styles.pencilEnd} d="M15.2 3.6l1.6-1.6a1.6 1.6 0 0 1 2.3 0l2.9 2.9a1.6 1.6 0 0 1 0 2.3l-1.6 1.6z" /></svg>
    </label>
  );
}

/**
 * The lobby ticket (owner, 2026-11-16, 2026-11-17): a bright boarding pass on the right of the Solo and party lobbies, laid out like a
 * real one: the vehicle's pass title, the passenger with their colour badge (click it to change colour: the same picker and palette
 * everywhere) and name (`onName`: click it to edit), the route in airport-style codes, the game mode (`mode`: a coloured strip), then
 * flight, gate and seat, the lobby's buttons (`children`) and, on the stub, Back (`onBack`). In a party the host switches the
 * destination on the pass (`onDestination`); everyone else sees it change. Names render as React text only, cut to NAME_LIMIT.
 */
export function LobbyTicket({ vehicle = 'plane', name = '', onName = null, color = null, taken = {}, onPick, solo = false, destination = 'gaia', onDestination = null, flight = 'PP 1000', gate = 'A1', seat = 1, mode = null, onBack = null, backLabel = 'Back', hidden = false, children }) {
  const planet = WORLDS.find(w => w.id === destination)?.name ?? 'Gaia';
  const pass = PASS[vehicle] ?? PASS.plane;
  const fields = [['Flight', flight], [pass.gate, gate], ['Seat', String(seat).padStart(2, '0')]];
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
          <PassengerName name={name} onName={onName} />
        </div>
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
      {mode && (
        <div className={styles.mode} style={{ '--tone': mode.tone }} data-ui="ticket-mode">
          <MenuIcon name={mode.icon} className={styles.modeIcon} />
          <span className={styles.modeText}><small>Game mode</small><b>{mode.title}</b></span>
          {mode.sub && <span className={styles.modeSub}>{mode.sub}</span>}
        </div>
      )}
      <dl className={styles.details}>
        {fields.map(([label, value]) => <div key={label} data-field={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className={styles.actions}>{children}</div>
      <div className={styles.stub}>
        <span className={styles.barcode} aria-hidden="true" />
        {onBack && <button type="button" className={styles.back} onClick={onBack} data-ui={solo ? 'menu-back' : 'pass-leave'} data-kind={solo ? 'back' : 'leave'}>{backLabel}</button>}
      </div>
    </aside>
  );
}

