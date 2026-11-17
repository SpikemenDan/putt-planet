import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GameModes } from '../shared/session.js';
import { WORLDS } from '../shared/worlds.js';
import { OFFWORLD_REGIONS } from '../shared/world-regions.js';
import { UiCommands } from './commands.js';
import { useUiContext, useView } from './context.js';
import { flightOf, LobbyTicket } from './LobbyTicket.jsx';
import { LobbyVehicle } from './LobbyVehicle.jsx';
import solo from './SoloLobby.module.css';
import menu from './Landing.module.css';
import { MenuIcon } from './MenuIcons.jsx';
import { ModePicker } from './ModePicker.jsx';
import room from './RoomLobby.module.css';

/** Colour and icon of each Solo choice (owner, 2026-11-14). Presentation only. */
const TONES = Object.freeze({
  casual: { tone: '#2fbf5b', icon: 'flag' },
  tournament: { tone: '#ff8a1f', icon: 'trophy' },
  practice: { tone: '#8b5cf6', icon: 'target' },
  wholeMap: { tone: '#27c8ff', icon: 'map' },
  onePutt: { tone: '#ff3d8b', icon: 'putt' },
  pong: { tone: '#ffd23f', icon: 'pong' },
});

/** Worlds with playable courses: Gaia, plus every world with a region of maps (VIS-G #165: Ares and Luna). Others show as coming soon. */
export const PLAYABLE_WORLDS = Object.freeze(['gaia', ...Object.keys(OFFWORLD_REGIONS).filter(id => OFFWORLD_REGIONS[id].some(r => r.maps.length))]);

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

const STEPS = ['mode', 'world', 'ready'];

/** The Solo lobby's mode bar (owner, 2026-11-17): every Solo mode, changeable right up to Play. */
const SOLO_MODE_OPTIONS = Object.freeze(Object.entries(SOLO_MODES).map(([value, label]) => ({ value, label })));

/** Arrow order in the destination view (owner, 2026-11-12): left goes Gaia → Luna → Ares → Gaia, right goes back the other way. */
export const WORLD_ORDER = Object.freeze(['gaia', 'luna', 'ares']);
const WORLD_BLURB = Object.freeze({ gaia: 'Home: six regions of courses', luna: 'Low gravity: long, floaty putts in two regions', ares: 'Lighter gravity: red canyons and highlands' });

/**
 * Solo, one question per screen (owner, 2026-11-12, layout A): how to play (Casual, Tournament and its length, or the
 * smaller Practice button), then the destination, then the Solo lobby (owner, 2026-11-16, 2026-11-17): full screen, a 3D helicopter
 * carrying the player's ball, and on the right a boarding pass with their name (edited on the pass), the colour badge that opens the
 * party lobby's colour picker, the flight, Play Solo and Back; along the bottom, the same mode bar as the party lobby. The menu card steps away for it. Play opens the solo room and
 * goes straight to the level select with the chosen mode. Back (or Escape) steps back; from the first step it leaves Solo. `colorField` is no longer shown here (the ticket's badge replaces it);
 * it stays accepted so Landing.jsx needs no change.
 */
export function SoloSteps({ name, onName, colorField, connecting, send, onExit, overlay = null }) {
  const { stage } = useUiContext();
  const color = useView(v => v.landing?.color ?? null);
  const [step, setStep] = useState('mode');
  const [focus, setFocus] = useState('gaia'); // the planet the destination view is showing
  const [pick, setPick] = useState(null); // 'tournament' | 'practice' while choosing a length or practice kind
  const [mode, setMode] = useState(null);
  const [world, setWorld] = useState('gaia');
  const body = useRef(null);
  useEffect(() => {
    const doc = body.current?.ownerDocument;
    (step === 'ready' ? doc?.querySelector('[data-ui=solo-play]') : body.current?.querySelector('button:not(:disabled), input'))?.focus();
  }, [step, pick]);
  // The Solo lobby takes the whole screen: the menu card steps away while it shows (the pass has the name, Play and Back).
  useEffect(() => {
    const card = body.current?.closest('[data-menu-view]');
    card?.toggleAttribute('data-solo-lobby', step === 'ready');
    return () => card?.removeAttribute('data-solo-lobby');
  }, [step]);
  // The destination step shows space; the Solo lobby flies the helicopter through Gaia's air (owner, 2026-11-16); the first step and
  // leaving Solo bring the horizon back. The big title steps aside for both the destination and the lobby.
  const inSpace = step === 'world';
  const titleAside = step === 'world' || step === 'ready';
  useEffect(() => { stage?.setView({ space: inSpace, target: inSpace ? focus : 'gaia' }); }, [stage, inSpace, focus]);
  useEffect(() => { if (overlay) overlay.toggleAttribute('data-space', titleAside); return () => overlay?.removeAttribute('data-space'); }, [overlay, titleAside]);
  useEffect(() => () => stage?.setView({ space: false, target: 'gaia' }), [stage]);
  const turn = dir => setFocus(f => WORLD_ORDER[(WORLD_ORDER.indexOf(f) + (dir === 'left' ? 1 : WORLD_ORDER.length - 1)) % WORLD_ORDER.length]);
  const onKeyDown = e => {
    if (step !== 'world') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); turn('left'); }
    if (e.key === 'ArrowRight') { e.preventDefault(); turn('right'); }
  };

  const choose = next => { setMode(next); setPick(null); setStep('world'); };
  const back = () => {
    if (pick) setPick(null);
    else if (step === 'ready') setStep('world');
    else if (step === 'world') setStep('mode');
    else onExit();
  };
  // Each choice has its own colour (--tone) and icon (owner, 2026-11-14); the label stays the first <span>.
  const option = (label, sub, onClick, look, props = {}) => (
    <button type="button" className={menu.option} style={{ '--tone': look.tone }} data-tone={look.icon} onClick={onClick} {...props}>
      <MenuIcon name={look.icon} className={menu.icon} /><span>{label}</span>{sub && <small>{sub}</small>}
    </button>
  );
  const index = STEPS.indexOf(step);

  return (
    <div ref={body} data-ui="solo-steps" data-step={pick ? step + ':' + pick : step} onKeyDown={onKeyDown}>
      <h2 className={menu.heading}>Solo</h2>
      <ol className={menu.steps} aria-label={`Step ${index + 1} of ${STEPS.length}`}>
        {STEPS.map((s, k) => <li key={s} data-on={k <= index || undefined} />)}
      </ol>

      {step === 'mode' && !pick && <>
        <p className={menu.question}>How do you want to play?</p>
        {option('Casual', 'One map, just for fun', () => choose(GameModes.STANDARD), TONES.casual)}
        {option('Tournament', '3, 5 or 7 maps; your scores add up', () => setPick('tournament'), TONES.tournament)}
        <button type="button" className={menu.minor} style={{ '--tone': TONES.practice.tone }} onClick={() => setPick('practice')}><MenuIcon name="target" className={menu.icon} />Practice</button>
      </>}
      {step === 'mode' && pick === 'tournament' && <>
        <p className={menu.question}>How many maps?</p>
        <div className={menu.lengths}>
          {[[3, GameModes.TOURNAMENT_3, '#ffb547'], [5, GameModes.TOURNAMENT_5, '#ff8a1f'], [7, GameModes.TOURNAMENT_7, '#f2560b']].map(([n, m, tone]) => (
            <button key={n} type="button" className={menu.option} style={{ '--tone': tone }} data-length={n} onClick={() => choose(m)} aria-label={n + ' maps'}><span>{n}</span><small>maps</small></button>
          ))}
        </div>
        <p className={menu.hint}>After each map you pick the next one.</p>
      </>}
      {step === 'mode' && pick === 'practice' && <>
        <p className={menu.question}>What do you want to practice?</p>
        {option('Whole map', 'Play a map with no timer or score', () => choose(GameModes.PRACTICE), TONES.wholeMap)}
        {option('One putt', 'Replay a single hole as often as you like', () => choose(GameModes.PUTT_PRACTICE), TONES.onePutt)}
        {option('Putt Pong', 'Practice the 1v1 cup game on your own', () => choose(GameModes.PONG), TONES.pong)}
      </>}

      {step === 'world' && (() => {
        const shown = WORLDS.find(w => w.id === focus), open = PLAYABLE_WORLDS.includes(focus);
        const carousel = (
          <div className={menu.carousel} data-ui="world-carousel" data-world={focus}>
            <button type="button" className={menu.arrow} onClick={() => turn('left')} aria-label="Previous planet" data-ui="world-left">&lsaquo;</button>
            <div className={menu.planetName} aria-live="polite"><b>{shown.name}</b><small>{open ? WORLD_BLURB[focus] : 'Coming soon: no courses yet'}</small></div>
            <button type="button" className={menu.arrow} onClick={() => turn('right')} aria-label="Next planet" data-ui="world-right">&rsaquo;</button>
          </div>
        );
        return <>
          <p className={menu.question}>Where to?</p>
          <p className={menu.hint}>Use the arrows (or ← →) to fly between planets.</p>
          <button type="button" className={menu.go} disabled={!open} onClick={() => { setWorld(focus); setStep('ready'); }} data-world={focus} data-ui="world-choose">
            {open ? 'Choose ' + shown.name : shown.name + ': coming soon'}
          </button>
          {overlay ? createPortal(carousel, overlay) : carousel}
        </>;
      })()}

      {step === 'ready' && (() => {
        const { flight } = flightOf('', world);
        // The helicopter is framed between the left edge, the pass on the right and the mode bar below.
        const insets = () => {
          const view = body.current?.ownerDocument.defaultView;
          if (!view) return null;
          const box = sel => view.document.querySelector('[data-ui=solo-lobby] ' + sel)?.getBoundingClientRect();
          const pass = box('[data-ui=lobby-ticket]');
          const bar = box('[data-ui=solo-modes]');
          return { left: 24, right: pass ? view.innerWidth - pass.left + 16 : 0, top: 8, bottom: bar ? view.innerHeight - bar.top + 8 : 8 };
        };
        const lobby = (
          <div data-ui="solo-lobby" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); back(); } }}>
            <LobbyVehicle vehicle="helicopter" passengers={[{ id: 'you', name: name.trim() || 'Player', color: color ?? 0, you: true }]} insets={insets} />
            <div className={room.hiddenText} data-ui="solo-title">
              <h1>Solo lobby</h1>
              <p data-ui="solo-summary" aria-live="polite">{SOLO_MODES[mode]} on {WORLDS.find(w => w.id === world)?.name}</p>
            </div>
            <div className={solo.pass}>
              <LobbyTicket vehicle="helicopter" solo name={name} onName={onName} color={color} onPick={c => send(UiCommands.SET_COLOR, { color: c })} destination={world}
                flight={flight} seat={1} onBack={back}>
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
        return overlay ? createPortal(lobby, overlay) : lobby;
      })()}

      {step !== 'ready' && <button type="button" className={menu.back} onClick={back} data-ui="menu-back">Back</button>}
    </div>
  );
}
