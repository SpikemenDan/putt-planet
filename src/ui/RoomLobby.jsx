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
import buttons from './buttons.module.css';
import styles from './RoomLobby.module.css';

/** The party code, big enough to read out to a friend, with Copy invite beside it. Shown only once the party exists. */
function PartyCode({ code, send }) {
  return (
    <div className={styles.code} data-ui="party-code">
      <span className={styles.codeText}><span className={styles.codeLabel}>Party code</span><strong className={styles.codeValue}>{code}</strong></span>
      <button type="button" className={styles.copy} onClick={() => send(UiCommands.INVITE)}>Copy invite</button>
    </div>
  );
}

/**
 * Party lobby (VIS-M3 #175; vehicles, ticket and manifest, owner 2026-11-16), full screen over the planet sky: everyone's ball rides
 * one 3D vehicle, the plane through Gaia's air or the rocket in space for Ares and Luna, with name tags alternating above and below.
 * On the left, the passenger manifest (no title board; the start countdown shows above the mode bar); on the right, your boarding pass (your name and colour badge,
 * the destination, the party code, the host's Start Game, Leave room on the stub); along the bottom, one bar of colourful mode tiles.
 * In a party everyone votes for the mode (the tiles) and the planet (the pass) (owner, 2026-11-17): each voter's ball sits in the
 * corner of their choice, the vehicle follows the leading planet, and Start Game plays the leading mode. Players arrive with a free
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
  const party = !!lobby?.code;
  const voting = !!lobby?.voting;
  const vote = choice => session({ type: 'LOBBY_VOTE', mode: choice.mode ?? null, world: choice.world ?? null });
  const start = () => {
    const chosen = voting ? lobby.leadingMode : mode;
    if (!available(chosen)) return;
    session({ type: 'SET_MODE', mode: chosen });
    session({ type: 'START_VOTING' });
  };
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
    // The rocket flies over Ares or Luna: the planet sits low, along the bottom of the screen (owner, 2026-11-17).
    const sky = left.current?.ownerDocument.querySelector('[data-ui=planet-stage]');
    const view = sky?.ownerDocument.defaultView;
    const resized = () => view?.dispatchEvent(new view.Event('resize')); // a still (reduced-motion) planet scene redraws only on resize
    sky?.toggleAttribute('data-low', vehicle === 'rocket');
    resized();
    return () => { stage?.setView({ space: false, target: 'gaia' }); sky?.removeAttribute('data-low'); resized(); };
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
        {/* No title board (owner, 2026-11-17): the heading and room line stay for screen readers only. */}
        <div className={styles.hiddenText}>
          <h1>{party ? 'Party lobby' : 'Room lobby'}</h1>
          <p>{lobby?.label}</p>
        </div>
        <LobbyManifest passengers={roster} seats={VEHICLE_SEATS[vehicle] ?? 8} flight={flight} destination={planet} />
      </div>
      <div ref={right} className={styles.right}>
        <LobbyTicket vehicle={vehicle} name={me?.name ?? ''} color={lobby?.myColor ?? null} taken={lobby?.takenColors} hidden={hidden || !lobby}
          onPick={c => send(UiCommands.SET_COLOR, { color: c })} destination={destination}
          onDestination={voting ? world => vote({ world }) : lobby?.canPickDestination ? world => session({ type: 'SET_DESTINATION', world }) : null}
          worldVoters={voting ? lobby.votes.world : null} myWorld={lobby?.myVote?.world ?? null}
          flight={flight} gate={gate} seat={seat > 0 ? seat : 1} onBack={() => send(UiCommands.LEAVE)} backLabel="Leave room">
          {party && <PartyCode code={lobby.code} send={send} />}
          {lobby?.showStart && <button type="button" className={styles.go} onClick={start} data-ui="start-game">Start Game</button>}
        </LobbyTicket>
      </div>
      <div ref={dock} className={styles.dock}>
        {/* The room's status: read out to screen readers; shown only for the start countdown ("… starts in 3…"). */}
        <p className={lobby?.countdown ? styles.countdown : styles.hiddenText} data-ui="lobby-status" aria-live="polite">{lobby?.status}</p>
        <TiePicker tie={lobby?.tie} />
        {(voting || lobby?.showModes) && <div className={styles.controls}>
          {voting
            ? <ModePicker modes={offered} value={lobby.myVote.mode} onChange={m => vote({ mode: m })} voters={lobby.votes.mode} leading={lobby.leadingMode} />
            : <ModePicker modes={offered} value={mode} onChange={setMode} />}
        </div>}
      </div>
    </div>
  );
}
