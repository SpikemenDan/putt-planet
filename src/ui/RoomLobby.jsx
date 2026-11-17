import { useEffect, useRef, useState } from 'react';
import { GameModes } from '../shared/session.js';
import { WORLDS } from '../shared/worlds.js';
import { lobbyVehicleFor } from '../render/lobby-models.js';
import { MODE_OPTIONS, UiCommands } from './commands.js';
import { useCommands, useUiContext, useView } from './context.js';
import { LobbyManifest } from './LobbyManifest.jsx';
import { flightOf, LobbyTicket } from './LobbyTicket.jsx';
import { LobbyVehicle, VEHICLE_SEATS } from './LobbyVehicle.jsx';
import { ModePicker } from './ModePicker.jsx';
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
 * Party lobby (VIS-M3 #175; vehicles, ticket and manifest, owner 2026-11-16), full screen over the planet sky: everyone's ball rides
 * one 3D vehicle, the plane through Gaia's air or the rocket in space for Ares and Luna, with name tags alternating above and below.
 * On the left, the title and the passenger manifest; on the right, your boarding pass (party code, destination the host switches,
 * your name and colour badge, Leave); along the bottom, the host's colourful mode tiles and Start Game. Players arrive with a free
 * colour and change it from the badge on their pass.
 */
export function RoomLobby({ hidden }) {
  const { send, session } = useCommands();
  const { stage } = useUiContext();
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
  const destination = lobby?.destination ?? 'gaia';
  const vehicle = lobbyVehicleFor({ solo: !party, destination });
  const seat = roster.findIndex(p => p.you) + 1;
  const { flight, gate } = flightOf(lobby?.code || 'solo');
  const planet = WORLDS.find(w => w.id === destination)?.name ?? 'Gaia';
  // The sky behind: Gaia's air for the plane, space around the destination for the rocket.
  const shown = !hidden && !!lobby;
  useEffect(() => {
    if (!shown) return undefined;
    stage?.setView({ space: vehicle === 'rocket', target: vehicle === 'rocket' ? destination : 'gaia' });
    return () => stage?.setView({ space: false, target: 'gaia' });
  }, [stage, shown, vehicle, destination]);
  const left = useRef(null), right = useRef(null), dock = useRef(null);
  const insets = () => {
    const view = left.current?.ownerDocument.defaultView;
    if (!view) return null;
    const box = el => el?.getBoundingClientRect();
    const l = box(left.current), r = box(right.current), d = box(dock.current);
    return { left: l ? l.right + 16 : 0, right: r ? view.innerWidth - r.left + 16 : 0, top: 8, bottom: d && d.height ? view.innerHeight - d.top + 8 : 0 };
  };
  return (
    <div className={styles.lobby} hidden={hidden} data-ui="room-lobby">
      <LobbyVehicle vehicle={vehicle} passengers={roster} hidden={hidden || !lobby} insets={insets} />
      <div ref={left} className={styles.left}>
        <div className={styles.titleCard}>
          <h1>{party ? 'Party lobby' : 'Room lobby'}</h1>
          <p className={styles.label}>{lobby?.label}</p>
        </div>
        <LobbyManifest passengers={roster} seats={VEHICLE_SEATS[vehicle] ?? 8} flight={flight} destination={planet} />
      </div>
      <div ref={right} className={styles.right}>
        <LobbyTicket vehicle={vehicle} name={me?.name ?? ''} color={lobby?.myColor ?? null} taken={lobby?.takenColors} hidden={hidden || !lobby}
          onPick={c => send(UiCommands.SET_COLOR, { color: c })} destination={destination}
          onDestination={lobby?.canPickDestination ? world => session({ type: 'SET_DESTINATION', world }) : null}
          flight={flight} gate={gate} seat={seat > 0 ? seat : 1}>
          {party && <PartyCode code={lobby.code} send={send} />}
          <button type="button" className={buttons.ghost} onClick={() => send(UiCommands.LEAVE)}>Leave room</button>
        </LobbyTicket>
      </div>
      <div ref={dock} className={styles.dock}>
        <p className={app.status + ' ' + styles.status} data-ui="lobby-status">{lobby?.status}</p>
        <TiePicker tie={lobby?.tie} />
        {lobby?.showModes && <div className={styles.controls}>
          <ModePicker modes={offered} value={mode} onChange={setMode} />
          <button type="button" className={styles.go} hidden={!lobby?.showStart} onClick={start}>Start Game</button>
        </div>}
      </div>
    </div>
  );
}
