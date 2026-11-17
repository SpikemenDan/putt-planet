import { useEffect, useRef, useState } from 'react';
import { UiCommands } from './commands.js';
import { useCommands, useUiContext, useView } from './context.js';
import { ColorPicker } from './ColorPicker.jsx';
import { SoloSteps } from './SoloSteps.jsx';
import { MenuIcon } from './MenuIcons.jsx';
import { CustomRules } from './CustomRules.jsx';
import { Skins } from './Skins.jsx';
import { changedRules, rulesFromPartial } from '../shared/rules.js';
import { CAMERA_PREFS, ORBIT_SPEED_RANGE } from '../shared/preferences.js';
import { CAMERA_VIEW_LABELS } from '../camera/rig.js';
import app from './App.module.css';
import menu from './Landing.module.css';

/** Build label: `vite.config.mjs` defines __APP_VERSION__ (package version plus commit); tests and other loaders show "dev". */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'; // eslint-disable-line no-undef

/** Local storage key for the Custom rules editor's draft (a per-player convenience; rooms never read it). */
export const CUSTOM_RULES_KEY = 'puttplanet.customRules';
const readDraft = () => { try { return rulesFromPartial(JSON.parse(globalThis.window?.localStorage?.getItem(CUSTOM_RULES_KEY) || 'null')); } catch { return rulesFromPartial(null); } };
const writeDraft = rules => { try { globalThis.window?.localStorage?.setItem(CUSTOM_RULES_KEY, JSON.stringify(rules)); } catch { /* not remembered */ } };

/** Main menu views (VIS-M2 #174). Solo and Party hold today's flows until VIS-M4 #176 and VIS-M3 #175 replace them. */
export const MENU_VIEWS = Object.freeze(['home', 'solo', 'party', 'custom', 'skins', 'settings']);

/**
 * Copies `display.menu` onto the menu as CSS variables. The shipped DISPLAY is frozen, so that is done once; the
 * development tuner's live object is not, so it is re-read every frame while the menu shows (presentation only).
 */
function useMenuLook(ref, display, hidden) {
  useEffect(() => {
    const el = ref.current;
    if (!el || hidden) return undefined;
    const apply = () => {
      const m = display.menu;
      el.style.setProperty('--menu-scale', String(m.buttonScale));
      el.style.setProperty('--menu-stagger', m.stagger + 's');
      el.style.setProperty('--menu-bob', m.bob + 'px');
      el.style.setProperty('--menu-tilt', m.tilt + 'deg');
      el.style.setProperty('--menu-shine', Math.max(m.shineSeconds, 0.01) + 's');
      el.style.setProperty('--menu-tint', m.cardTint * 100 + '%');
      el.dataset.shine = m.shineSeconds > 0 ? 'on' : 'off';
    };
    apply();
    const raf = el.ownerDocument.defaultView?.requestAnimationFrame;
    if (Object.isFrozen(display.menu) || !raf) return undefined;
    let id = 0;
    const tick = () => { apply(); id = raf(tick); };
    id = raf(tick);
    return () => el.ownerDocument.defaultView.cancelAnimationFrame(id);
  }, [ref, display, hidden]);
}

/**
 * Main menu over the planet (VIS-M2 #174): Solo, Party and Custom, a smaller Settings button, and the version
 * bottom-left. The title sits where the loading screen's does. A `#room=` link opens straight onto Party.
 */
export function Landing({ hidden, initialName = '', initialRoomCode = '', initialView = 'home' }) {
  const { send } = useCommands();
  const { display } = useUiContext();
  const { connecting, error, cosmetics, color, soundOn, volume, qualityHigh, camera: cameraPrefs, motion } = useView(v => v.landing);
  const camera = cameraPrefs || CAMERA_PREFS;
  const setCamera = partial => send(UiCommands.SET_CAMERA, { camera: partial });
  const [name, setName] = useState(initialName);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [view, setView] = useState(MENU_VIEWS.includes(initialView) ? initialView : 'home');
  const [rules, setRules] = useState(readDraft); // Custom editor draft (VIS-U #168)
  const [hostRules, setHostRules] = useState(null); // rules a Party opened from Custom creates its room with; null = standard
  const editRules = next => { setRules(next); writeDraft(next); };
  const root = useRef(null);
  const homeButtons = useRef({});
  useMenuLook(root, display, hidden);
  const wasShown = useRef(!hidden);
  useEffect(() => { // once a room opens (the menu goes from shown to hidden), coming back starts from the main buttons
    if (hidden && wasShown.current) setView('home');
    wasShown.current = !hidden;
  }, [hidden]);

  const open = next => { if (next === 'party') setHostRules(null); setView(next); };
  const back = () => {
    const from = view;
    setView('home');
    setTimeout(() => homeButtons.current[from]?.focus(), 0);
  };
  useEffect(() => { // focus the first control of a sub-menu when it opens
    if (view !== 'home') root.current?.querySelector('[data-menu-view] input, [data-menu-view] button')?.focus();
  }, [view]);

  const nameField = <label>Your name<input maxLength={14} autoComplete="off" value={name} onChange={e => setName(e.target.value)} /></label>;
  const colorField = <div className={menu.field}>Ball colour<ColorPicker selected={color} onPick={c => send(UiCommands.SET_COLOR, { color: c })} /></div>;
  const backButton = <button type="button" className={menu.back} onClick={back} data-ui="menu-back">Back</button>;
  const homeButton = (id, label, sub, cls, icon) => (
    <button type="button" ref={el => { homeButtons.current[id] = el; }} className={menu.big + ' ' + cls} disabled={connecting} onClick={() => open(id)} data-menu={id} aria-label={label}>
      <span className={menu.label}>{label}</span><span className={menu.sub} aria-hidden="true">{sub}</span>
      {icon && <MenuIcon name={icon} className={menu.bigIcon} />}
    </button>
  );

  return (
    <div ref={root} className={menu.menu} hidden={hidden} data-ui="landing" data-view={view} data-connecting={connecting || undefined}>
      <h1 className={menu.brand}>Putt Planet</h1>
      {view === 'home' ? (
        <nav className={menu.stack} aria-label="Main menu">
          {homeButton('solo', 'Solo', 'Practice and play alone', menu.solo, 'solo')}
          {homeButton('party', 'Party', 'Play with friends', menu.party, 'party')}
          {homeButton('custom', 'Custom', 'Make your own rules', menu.custom, 'custom')}
          <div className={menu.minorRow}>
            <button type="button" ref={el => { homeButtons.current.skins = el; }} className={menu.settings + ' ' + menu.skinsButton} onClick={() => open('skins')} data-menu="skins"><MenuIcon name="skins" className={menu.settingsIcon} />Skins</button>
            <button type="button" ref={el => { homeButtons.current.settings = el; }} className={menu.settings} onClick={() => open('settings')} data-menu="settings"><MenuIcon name="settings" className={menu.settingsIcon} />Settings</button>
          </div>
        </nav>
      ) : (
        <section className={menu.panel} data-menu-view={view} aria-label={view[0].toUpperCase() + view.slice(1)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); back(); } }}>
          {view === 'solo' && <SoloSteps name={name} onName={setName} colorField={colorField} connecting={connecting} send={send} onExit={back} overlay={root.current} />}
          {view === 'party' && <>
            <h2 className={menu.heading}><MenuIcon name="party" className={menu.headingIcon} />Party</h2>
            {nameField}
            {/* VIS-M3 #175: Host creates the party and only then gets its code; opening this menu makes no room and no code. */}
            {/* Cleaner Party menu (owner, 2026-11-17): one big pink Create party, then "or join with a code" and a sky Join card whose code
                box uses the boarding pass's code font. */}
            <div className={menu.partyHost} data-ui="party-host">
              <button type="button" className={menu.go} disabled={connecting} onClick={() => send(UiCommands.CREATE_PARTY, { name, rules: hostRules })}>Create party</button>
              {hostRules && <p className={app.small} data-ui="party-custom-rules">Your party uses your Custom rules ({changedRules(hostRules).length} changed); everyone who joins plays them. <button type="button" className={menu.inline} onClick={() => setHostRules(null)}>Use standard</button></p>}
            </div>
            <form className={menu.partyJoin} data-ui="party-join" onSubmit={e => { e.preventDefault(); if (!connecting && roomCode.trim()) send(UiCommands.JOIN, { name, roomCode }); }}>
              <p className={menu.or} aria-hidden="true"><span>or join with a code</span></p>
              <div className={menu.joinRow}>
                <label className={menu.joinCode}><span className={menu.hiddenLabel}>Party code</span><input maxLength={12} autoComplete="off" spellCheck={false} placeholder="CODE" value={roomCode} onChange={e => setRoomCode(e.target.value)} /></label>
                <button type="submit" className={menu.joinGo} disabled={connecting || !roomCode.trim()}>Join</button>
              </div>
            </form>
          </>}
          {view === 'custom' && <>
            <h2 className={menu.heading}><MenuIcon name="custom" className={menu.headingIcon} />Custom</h2>
            <CustomRules rules={rules} onChange={editRules} busy={connecting}
              onPlaySolo={() => send(UiCommands.PLAY_SOLO, { name, rules })}
              onHostParty={() => { setHostRules(rules); setView('party'); }} />
          </>}
          {view === 'skins' && <>
            <h2 className={menu.heading}><MenuIcon name="skins" className={menu.headingIcon} />Skins</h2>
            <Skins cosmetics={cosmetics} color={color} send={send} colorField={colorField} />
          </>}
          {view === 'settings' && <>
            <h2 className={menu.heading}><MenuIcon name="settings" className={menu.headingIcon} />Settings</h2>
            {/* Owner, 2026-11-16: sound and graphics here (the same commands as the in-game Settings); skins have their own menu. */}
            <section className={menu.card} data-tone="sound" aria-label="Sound" data-ui="settings-sound">
              <h3 className={menu.cardHead}><MenuIcon name="sound" className={menu.cardIcon} />Sound</h3>
              <div className={menu.setRow}>
                <span className={menu.setLabel} id="set-sound">Sound effects</span>
                <button type="button" role="switch" aria-checked={soundOn} aria-labelledby="set-sound" className={menu.switch} onClick={() => send(UiCommands.TOGGLE_SOUND)} data-ui="set-sound"><span className={menu.knob} aria-hidden="true" /></button>
                <output className={menu.setValue}>{soundOn ? 'On' : 'Off'}</output>
              </div>
              <div className={menu.setRow}>
                <label className={menu.setLabel} htmlFor="set-volume">Volume</label>
                <input id="set-volume" type="range" className={menu.slider} min="0" max="100" step="5" value={Math.round(volume * 100)} disabled={!soundOn}
                  style={{ '--fill': volume }} onChange={e => send(UiCommands.SET_VOLUME, { volume: Number(e.target.value) / 100 })} data-ui="set-volume" />
                <output className={menu.setValue} htmlFor="set-volume">{Math.round(volume * 100)}%</output>
              </div>
            </section>
            <section className={menu.card} data-tone="graphics" aria-label="Graphics" data-ui="settings-graphics">
              <h3 className={menu.cardHead}><MenuIcon name="graphics" className={menu.cardIcon} />Graphics</h3>
              <div className={menu.setRow}>
                <span className={menu.setLabel} id="set-quality">Quality</span>
                <div className={menu.segment} role="radiogroup" aria-labelledby="set-quality" data-ui="set-quality">
                  {[[true, 'High'], [false, 'Low']].map(([high, label]) => (
                    <button key={label} type="button" role="radio" aria-checked={qualityHigh === high} onClick={() => { if (qualityHigh !== high) send(UiCommands.TOGGLE_QUALITY); }}>{label}</button>
                  ))}
                </div>
              </div>
              <p className={menu.cardText + ' ' + app.small}>{qualityHigh ? 'High: sharp on high-resolution screens, with soft shadows.' : 'Low: no shadows and standard pixel density, for smoother play on slower computers.'}</p>
              <div className={menu.setRow}>
                <span className={menu.setLabel} id="set-motion">Reduce motion</span>
                <div className={menu.segment} role="radiogroup" aria-labelledby="set-motion" data-ui="set-motion">
                  {[['auto', 'Auto'], ['reduce', 'On']].map(([value, label]) => (
                    <button key={value} type="button" role="radio" aria-checked={motion === value} onClick={() => { if (motion !== value) send(UiCommands.SET_MOTION, { motion: value }); }}>{label}</button>
                  ))}
                </div>
              </div>
              <p className={menu.cardText + ' ' + app.small}>{motion === 'reduce' ? 'On: menus stop bouncing and sliding, and camera flights cut straight to the view. The planet backdrop stays still from the next time it loads.' : 'Auto: follows your system’s reduced-motion setting.'}</p>
            </section>
            <section className={menu.card} data-tone="camera" aria-label="Camera" data-ui="settings-camera">
              <h3 className={menu.cardHead}><MenuIcon name="camera" className={menu.cardIcon} />Camera</h3>
              <div className={menu.setRow}>
                <span className={menu.setLabel} id="set-view">Starting view</span>
                <div className={menu.segment} role="radiogroup" aria-labelledby="set-view" data-ui="set-camera-view">
                  {CAMERA_VIEW_LABELS.map((label, index) => (
                    <button key={label} type="button" role="radio" aria-checked={camera.view === index} onClick={() => { if (camera.view !== index) setCamera({ view: index }); }}>{label}</button>
                  ))}
                </div>
              </div>
              <div className={menu.setRow}>
                <label className={menu.setLabel} htmlFor="set-orbit">Rotate speed</label>
                <input id="set-orbit" type="range" className={menu.slider} min={ORBIT_SPEED_RANGE.min} max={ORBIT_SPEED_RANGE.max} step={ORBIT_SPEED_RANGE.step} value={camera.orbitSpeed}
                  style={{ '--fill': (camera.orbitSpeed - ORBIT_SPEED_RANGE.min) / (ORBIT_SPEED_RANGE.max - ORBIT_SPEED_RANGE.min) }} onChange={e => setCamera({ orbitSpeed: Number(e.target.value) })} data-ui="set-orbit" />
                <output className={menu.setValue} htmlFor="set-orbit">{camera.orbitSpeed.toFixed(1)}×</output>
              </div>
              <div className={menu.setRow}>
                <span className={menu.setLabel} id="set-invert">Invert up/down</span>
                <button type="button" role="switch" aria-checked={camera.invertY} aria-labelledby="set-invert" className={menu.switch} onClick={() => setCamera({ invertY: !camera.invertY })} data-ui="set-invert"><span className={menu.knob} aria-hidden="true" /></button>
                <output className={menu.setValue}>{camera.invertY ? 'On' : 'Off'}</output>
              </div>
              <p className={menu.cardText + ' ' + app.small}>Right-drag or the arrow keys rotate the camera; C switches view during a game.</p>
            </section>
            <details className={menu.card} data-tone="help"><summary><MenuIcon name="help" className={menu.cardIcon} />How to play</summary>
              <p className={menu.cardText}>3D party mini golf. Everyone plays the same hole at once, and the next hole starts when all players finish. Ride ramps, jump pads and teleporters, dodge fans and water, and mess with your friends.</p>
              <ul className={menu.keys}>
                <li><kbd>Drag</kbd> back anywhere, release to putt</li>
                <li><kbd>Esc</kbd> cancel a shot</li>
                <li><kbd>1</kbd>–<kbd>3</kbd> use a power-up</li>
                <li><kbd>C</kbd> change camera</li>
                <li><kbd>Right-drag</kbd> or <kbd>←</kbd> <kbd>→</kbd> rotate</li>
                <li><kbd>M</kbd> sound on or off</li>
              </ul>
              <p className={menu.cardText + ' ' + app.small}>Longer pulls add power and widen a sine sway; release as the arrow crosses center for a perfectly straight shot.</p>
            </details>
          </>}
          <p className={app.status} role="status" data-ui="connect-error" hidden={!error}>{error}</p>
          {view !== 'solo' && backButton}
        </section>
      )}
      {view === 'home' && <p className={app.status} role="status" data-ui="connect-error" hidden={!error}>{error}</p>}
      <p className={menu.version} data-ui="version">v{APP_VERSION}</p>
    </div>
  );
}
