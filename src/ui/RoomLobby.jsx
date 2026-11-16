import { useEffect, useState } from 'react';
import { GameModes } from '../shared/session.js';
import { lobbyVehicleFor } from '../render/lobby-models.js';
import { MODE_OPTIONS, UiCommands } from './commands.js';
import { useCommands, useView } from './context.js';
import { LobbyTicket } from './LobbyTicket.jsx';
import { LobbyVehicle } from './LobbyVehicle.jsx';
import { TiePicker } from './TiePicker.jsx';
import app from './App.module.css';
import buttons from './buttons.module.css';
import styles from './RoomLobby.module.css';

/** The party code, big enough to read out to a friend, with Copy invite beside it. Shown only once the party exists. */
function PartyCode({ code, send }) {
  return (
    <div className={styles.code} data-ui="party-code">
      <span className={styles.codeLabel}>Party code</span>
      <strong className={styles.codeValue}>{code}</strong>
      <button type="button" className={buttons.ghost} onClick={() => send(UiCommands.INVITE)}>Copy invite</button>
    </div>
  );
}

/**
 * Party lobby (VIS-M3 #175; vehicles and ticket, owner 2026-11-16): everyone's ball rides one 3D vehicle, the plane for Gaia or the
 * rocket for Ares and Luna, with name tags alternating above and below it. The boarding pass on the right holds the party code, the
 * destination (the host switches it), the host's mode choice, your name and colour badge, Start Game and Leave. Players arrive with
 * a free colour and change it from the badge on their ticket.
 */
export function RoomLobby({ hidden }) {
  const { send, session } = useCommands();
  const lobby = useView(v => v.lobby);
  const [mode, setMode] = useState(GameModes.STANDARD);
  const offered = lobby?.modes || MODE_OPTIONS;
  const available = value => offered.some(o => o.value === value && !o.disabled);
  // A mode the room no longer offers (practice with a second player, Putt Pong without exactly two) falls back to Standard.
  useEffect(() => { if (lobby && !available(mode)) setMode(GameModes.STANDARD); });
  const start = () => {
    if (!available(mode)) return;
    session({ type: 'SET_MODE', mode });
    session({ type: 'START_VOTING' });
  };
  const party = !!lobby?.code;
  const roster = lobby?.roster ?? [];
  const me = roster.find(p => p.you);
  const vehicle = lobbyVehicleFor({ solo: !party, destination: lobby?.destination });
  const seat = roster.findIndex(p => p.you);
  return (
    <div className={app.card + ' ' + styles.lobby} hidden={hidden} data-ui="room-lobby">
      <section className={styles.main}>
        <h1>{party ? 'Party lobby' : 'Room lobby'}</h1>
        <p className={styles.label}>{lobby?.label}</p>
        <LobbyVehicle vehicle={vehicle} passengers={roster} hidden={hidden || !lobby} />
        <p className={app.status}>{lobby?.status}</p>
        <TiePicker tie={lobby?.tie} />
      </section>
      <LobbyTicket vehicle={vehicle} name={me?.name ?? ''} color={lobby?.myColor ?? null} taken={lobby?.takenColors} hidden={hidden || !lobby}
        onPick={c => send(UiCommands.SET_COLOR, { color: c })} destination={lobby?.destination ?? 'gaia'}
        onDestination={lobby?.canPickDestination ? world => session({ type: 'SET_DESTINATION', world }) : null}
        details={[['Seat', seat >= 0 ? String(seat + 1).padStart(2, '0') : '--'], ['Aboard', roster.length + '/8'], ['Class', 'First']]}>
        {party && <PartyCode code={lobby.code} send={send} />}
        <label hidden={!lobby?.showModes}>Game mode<select value={mode} onChange={e => setMode(e.target.value)}>
          {offered.map(o => <option key={o.value} value={o.value} disabled={!!o.disabled}>{o.label}</option>)}
        </select></label>
        <button type="button" className={styles.go} hidden={!lobby?.showStart} onClick={start}>Start Game</button>
        <button type="button" className={buttons.ghost} onClick={() => send(UiCommands.LEAVE)}>Leave room</button>
      </LobbyTicket>
    </div>
  );
}
