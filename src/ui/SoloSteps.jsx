import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GameModes } from '../shared/session.js';
import { lobbyVehicleFor } from '../render/lobby-models.js';
import { WORLDS } from '../shared/worlds.js';
import { UiCommands } from './commands.js';
import { useUiContext, useView } from './context.js';
import { flightOf, LobbyTicket } from './LobbyTicket.jsx';
import { LobbyVehicle } from './LobbyVehicle.jsx';
import solo from './SoloLobby.module.css';
import { ModePicker } from './ModePicker.jsx';
import { PLAYABLE_WORLDS, PlanetPicker, WORLD_ORDER, useLobbySky } from './PlanetPicker.jsx';
import room from './RoomLobby.module.css';

// Moved to PlanetPicker.jsx (owner, 2026-11-18); re-exported for older imports.
export { PLAYABLE_WORLDS, WORLD_ORDER };

/** The modes the Solo steps can start, and how each is described (VIS-M4 #176). */
export const SOLO_MODES = Object.freeze({
  [GameModes.STANDARD]: 'Casual · 1 map',
  [GameModes.TOURNAMENT_3]: 'Tournament · 3 maps',
  [GameModes.TOURNAMENT_5]: 'Tournament · 5 maps',
  [GameModes.TOURNAMENT_7]: 'Tournament · 7 maps',
  [GameModes.PRACTICE]: 'Practice · whole map',
  [GameModes.PUTT_PRACTICE]: 'Practice · one putt',
  [GameModes.PONG]: 'Practice · Putt Pong',
});

/** The Solo lobby's mode bar (owner, 2026-11-17): every Solo mode, changeable right up to Play. */
const SOLO_MODE_OPTIONS = Object.freeze(Object.entries(SOLO_MODES).map(([value, label]) => ({ value, label })));

/**
 * Solo is a party of one (owner, 2026-11-18): the Solo button opens the Solo lobby straight away, the same full-screen lobby as a
 * party's: a 3D helicopter carrying the player's ball over the destination's sky, the planet picker on the left (the one the party
 * lobby uses, without votes), the boarding pass on the right (name, colour badge, the destination, Play Solo and Back) and the mode
 * bar along the bottom, starting on Casual. The menu card steps away for it. Play opens the solo room and goes straight to the level
 * select with the chosen mode and planet. Back (or Escape) leaves Solo. `colorField` is no longer shown here (the ticket's badge
 * replaces it); it stays accepted so Landing.jsx needs no change.
 */
export function SoloSteps({ name, onName, colorField, connecting, send, onExit, overlay = null }) {
  const { stage } = useUiContext();
  const color = useView(v => v.landing?.color ?? null);
  const [mode, setMode] = useState(GameModes.STANDARD);
  const [world, setWorld] = useState('gaia');
  const body = useRef(null), side = useRef(null);
  useEffect(() => { body.current?.ownerDocument.querySelector('[data-ui=solo-play]')?.focus(); }, []);
  // The Solo lobby takes the whole screen: the menu card steps away while it shows (the pass has the name, Play and Back).
  useEffect(() => {
    const card = body.current?.closest('[data-menu-view]');
    card?.setAttribute('data-solo-lobby', '');
    return () => card?.removeAttribute('data-solo-lobby');
  }, []);
  // The big title steps aside for the lobby; the sky follows the chosen planet.
  useEffect(() => { overlay?.setAttribute('data-space', ''); return () => overlay?.removeAttribute('data-space'); }, [overlay]);
  const ownSky = useLobbySky(stage, true, world, body);
  const vehicle = lobbyVehicleFor({ solo: true, destination: world }); // the helicopter over Gaia, the Solo rocket to Luna and Ares
  const { flight } = flightOf('', world);
  // The helicopter is framed between the planet picker on the left, the pass on the right and the mode bar below.
  const insets = () => {
    const view = body.current?.ownerDocument.defaultView;
    if (!view) return null;
    const box = sel => view.document.querySelector('[data-ui=solo-lobby] ' + sel)?.getBoundingClientRect();
    const pass = box('[data-ui=lobby-ticket]'), bar = box('[data-ui=solo-modes]'), planets = side.current?.getBoundingClientRect();
    return { left: planets ? planets.right + 16 : 24, right: pass ? view.innerWidth - pass.left + 16 : 0, top: 8, bottom: bar ? view.innerHeight - bar.top + 8 : 8 };
  };
  const lobby = (
    <div data-ui="solo-lobby" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onExit(); } }}>
      <LobbyVehicle vehicle={vehicle} destination={world} air={world === 'gaia' || (world === 'ares' && ownSky)} passengers={[{ id: 'you', name: name.trim() || 'Player', color: color ?? 0, you: true }]} insets={insets} sun={!ownSky} />
      <div className={room.hiddenText} data-ui="solo-title">
        <h1>Solo lobby</h1>
        <p data-ui="solo-summary" aria-live="polite">{SOLO_MODES[mode]} on {WORLDS.find(w => w.id === world)?.name}</p>
      </div>
      <div ref={side} className={solo.planets}>
        <PlanetPicker value={world} onPick={setWorld} />
      </div>
      <div className={solo.pass}>
        <LobbyTicket vehicle={vehicle} solo name={name} onName={onName} color={color} onPick={c => send(UiCommands.SET_COLOR, { color: c })} destination={world}
          flight={flight} seat={1} onBack={onExit}>
          <button type="button" className={solo.go} disabled={connecting} onClick={() => send(UiCommands.PLAY_SOLO, { name, mode, world })} data-ui="solo-play">Play Solo</button>
        </LobbyTicket>
      </div>
      <div className={solo.dock} data-ui="solo-modes">
        <div className={room.controls}>
          <ModePicker modes={SOLO_MODE_OPTIONS} value={mode} onChange={setMode} pongIsPractice names={{ [GameModes.STANDARD]: 'Casual' }} />
        </div>
      </div>
    </div>
  );
  return (
    <div ref={body} data-ui="solo-steps" data-step="ready">
      {overlay ? createPortal(lobby, overlay) : lobby}
    </div>
  );
}
