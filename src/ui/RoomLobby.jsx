import { useEffect, useRef, useState } from 'react';
import { GameModes } from '../shared/session.js';
import { lobbyVehicleFor } from '../render/lobby-models.js';
import { MODE_OPTIONS, sanitizeName, UiCommands } from './commands.js';
import { useCommands, useUiContext, useView } from './context.js';
import { LobbyTicket } from './LobbyTicket.jsx';
import { LobbyVehicle, VEHICLE_SEATS } from './LobbyVehicle.jsx';
import { ModePicker } from './ModePicker.jsx';
import { PlanetPicker, useLobbySky } from './PlanetPicker.jsx';
import { TiePicker } from './TiePicker.jsx';
import styles from './RoomLobby.module.css';

/**
 * Party lobby (VIS-M3 #175; vehicles, ticket and manifest, owner 2026-11-16), full screen over the planet sky: everyone's ball rides
 * one 3D vehicle, the plane through Gaia's air or the rocket in space for Ares and Luna, with name tags alternating above and below.
 * On the left, the planet picker (no title board; the start countdown shows above the mode bar); on the right, your boarding pass (your name and colour badge,
 * everyone aboard (the passenger list moved onto the pass, owner 2026-11-19), the destination, the host's Start Game, the party code and Leave room on the stub); along the bottom, one bar of colourful mode tiles.
 * In a party everyone votes for the mode (the tiles) and the planet (the planet picker on the left, owner 2026-11-17, 2026-11-18): each voter's ball sits in the
 * corner of their choice, and Start Game plays the leading mode. Players arrive with a free colour and change it from the badge on their pass.
 * The planet preview is your own (owner, 2026-11-19): the sky, vehicle, ticket and manifest follow your vote (the room's planet until you
 * vote). The host's Start runs a launch countdown that a join cancels; when it ends the vote is final, everyone's lobby flies to the
 * winning planet, and then the host's client opens the map vote there.
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
  const openMapVote = () => {
    const chosen = voting || lobby?.launch ? lobby.leadingMode : mode;
    if (!available(chosen)) return;
    session({ type: 'SET_MODE', mode: chosen });
    session({ type: 'START_VOTING' });
  };
  // A party's Start begins the launch countdown; a room without a party code opens the map vote at once.
  const start = () => party ? session({ type: 'LAUNCH' }) : openMapVote();
  // Once everyone has flown to the planet, the host opens the map vote (again each second, should the room not be ready yet).
  const ready = !!lobby?.launchReady && !!lobby?.showModes;
  const opener = useRef(openMapVote);
  opener.current = openMapVote;
  useEffect(() => {
    if (!ready) return undefined;
    opener.current();
    const again = setInterval(() => opener.current(), 1000);
    return () => clearInterval(again);
  }, [ready]);
  const roster = lobby?.roster ?? [];
  const me = roster.find(p => p.you);
  // Rename on the pass (owner, 2026-11-17): typed into a draft, sent to the room once when editing ends.
  const [nameDraft, setNameDraft] = useState(null);
  const commitName = () => {
    if (nameDraft === null) return;
    setNameDraft(null);
    const next = sanitizeName(nameDraft);
    if (next !== me?.name) send(UiCommands.SET_NAME, { name: next });
  };
  // Your preview: your own planet vote until the countdown ends, then the planet everyone flies to.
  // The pick shows at once, before the room echoes the vote back.
  const [pick, setPick] = useState(null);
  const votePlanet = world => { setPick(world); vote({ world }); };
  const echoed = lobby?.myVote?.world ?? null;
  useEffect(() => setPick(null), [echoed]); // the room has my vote now
  const destination = lobby?.launch === 'landing' ? lobby.leadingWorld : (voting && (pick ?? lobby?.myVote?.world)) || (lobby?.destination ?? 'gaia');
  const vehicle = lobbyVehicleFor({ solo: !party, destination });
  // The sky behind follows the destination (useLobbySky): Gaia's air for the plane, Ares's or Luna's sky for the rocket.
  const shown = !hidden && !!lobby;
  const left = useRef(null), right = useRef(null), dock = useRef(null);
  useLobbySky(stage, shown, destination, left);
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
        <PlanetPicker value={destination} voters={voting || lobby?.launch ? lobby.votes.world : null} leading={party ? lobby.leadingWorld : destination}
          onPick={voting ? votePlanet : lobby?.canPickDestination ? world => session({ type: 'SET_DESTINATION', world }) : null} />
      </div>
      <div ref={right} className={styles.right}>
        <LobbyTicket vehicle={vehicle} name={nameDraft ?? me?.name ?? ''} onName={setNameDraft} onNameDone={commitName} color={lobby?.myColor ?? null} taken={lobby?.takenColors} hidden={hidden || !lobby}
          onPick={c => send(UiCommands.SET_COLOR, { color: c })} destination={destination}
          passengers={roster} seats={VEHICLE_SEATS[vehicle] ?? 8}
          code={party ? lobby.code : ''} onCopy={() => send(UiCommands.INVITE)}
          onBack={() => send(UiCommands.LEAVE)} backLabel="Leave room">
          {lobby?.showStart && <button type="button" className={styles.go} onClick={start} data-ui="start-game">Start Game</button>}
        </LobbyTicket>
      </div>
      <div ref={dock} className={styles.dock}>
        {/* The room's status: read out to screen readers; shown only for the launch ("Take-off in 3…") and start ("… starts in 3…") countdowns. */}
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
