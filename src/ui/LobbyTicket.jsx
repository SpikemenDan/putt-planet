import { WORLDS } from '../shared/worlds.js';
import { NAME_LIMIT } from './commands.js';
import { ColorBadge } from './BadgePicker.jsx';
import { Voters } from './ModePicker.jsx';
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

/**
 * Themed gates (owner, 2026-11-17): the party plane boards at Cloud 9, rockets launch from a Luna crater or an Ares canyon (numbered
 * from the flight, so a party keeps its pad), and the Solo helicopter lifts off from the H of its helipad.
 */
export function gateFor(vehicle, destination, flight = '') {
  if (vehicle === 'helicopter') return { kind: 'helipad', text: 'H' };
  if (vehicle === 'rocket') {
    const n = 1 + (Number(String(flight).replace(/\D/g, '')) || 0) % 9;
    return destination === 'luna' ? { kind: 'crater', text: 'Crater ' + n } : { kind: 'canyon', text: 'Canyon ' + n };
  }
  return { kind: 'cloud', text: 'Cloud 9' };
}

/** A flight number from any text (the party code), stable for the party: PP 1000–9999. */
export function flightOf(text = '') {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { flight: 'PP ' + (1000 + (h % 9000)) };
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
 * everywhere) and name (`onName`: click it to edit), the route in airport-style codes, then flight, gate and seat, then
 * the lobby's buttons (`children`: Play or Start Game) and, on the stub, the party code under the barcode like a booking reference
 * (`code`, with a copy-invite icon: `onCopy`) and Back (`onBack`). In a party everyone
 * votes for the destination on the pass (`onDestination`, `worldVoters`: each voter's ball sits on their planet; `myWorld` is checked);
 * the route shows the planet the vote leads with. Names render as React text only, cut to NAME_LIMIT.
 */
export function LobbyTicket({ vehicle = 'plane', name = '', onName = null, color = null, taken = {}, onPick, solo = false, destination = 'gaia', onDestination = null, worldVoters = null, myWorld = null, code = '', onCopy = null, flight = 'PP 1000', seat = 1, onBack = null, backLabel = 'Back', hidden = false, children }) {
  const planet = WORLDS.find(w => w.id === destination)?.name ?? 'Gaia';
  const pass = PASS[vehicle] ?? PASS.plane;
  const gateMark = gateFor(vehicle, destination, flight);
  const fields = [['Flight', flight], [pass.gate, gateMark.kind === 'helipad' ? <span className={styles.helipad} aria-label="H">H</span> : gateMark.text], ['Seat', String(seat).padStart(2, '0')]];
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
        <div className={styles.worlds} role="radiogroup" aria-label="Destination" data-ui="destination-pick" data-voting={worldVoters ? '' : undefined}>
          {TICKET_WORLDS.map(id => {
            const mine = worldVoters ? id === myWorld : id === destination;
            return (
              <button key={id} type="button" role="radio" aria-checked={mine} data-world={id} data-leading={(worldVoters && id === destination) || undefined} className={styles.world}
                onClick={() => { if (!mine) onDestination(id); }}>{WORLDS.find(w => w.id === id).name}{worldVoters && <Voters list={worldVoters[id]} />}</button>
            );
          })}
        </div>
      )}
      <dl className={styles.details}>
        {fields.map(([label, value]) => <div key={label} data-field={label}><dt>{label}</dt><dd data-gate={label === pass.gate ? gateMark.kind : undefined}>{value}</dd></div>)}
      </dl>
      <div className={styles.actions}>{children}</div>
      <div className={styles.stub}>
        <span className={styles.barcode} aria-hidden="true" />
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

