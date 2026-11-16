import { useRef } from 'react';
import { colorHex, PLAYER_COLOR_NAMES } from '../shared/colors.js';
import { useUiContext } from './context.js';
import { BadgePicker, useBadgePicker, useLobbyLook } from './LobbyPlane.jsx';
import plane from './LobbyPlane.module.css';
import styles from './LobbyHelicopter.module.css';

/** Copies `display.helicopter` onto the craft as CSS variables, alongside the shared `display.lobby` ball size and bob. */
const helicopterLook = (el, display) => {
  const h = display.helicopter;
  el.style.setProperty('--heli-rotor', h.rotorSeconds + 's');
  el.style.setProperty('--heli-rotor-state', h.rotorSeconds > 0 ? 'running' : 'paused');
  el.style.setProperty('--heli-hover', h.hover + 'px');
};

/**
 * The Solo lobby (owner, 2026-11-16): a hovering helicopter carrying the player's one ball in its bubble window, drawn in the
 * same comic CSS technique as the party plane (src/ui/LobbyPlane.jsx). The caption under it carries the player's name and their
 * colour badge, which opens the same picker and palette as the party lobby; alone, no colour is ever crossed out. Picking sends
 * the same SET_COLOR command as the party lobby, so the choice is saved the same way. The name renders as React text only.
 */
export function LobbyHelicopter({ name, color = null, onPick, hidden = false }) {
  const { display } = useUiContext();
  const root = useRef(null);
  useLobbyLook(root, display, hidden, helicopterLook);
  const { badge, open, closing, onClose, toggle } = useBadgePicker(root, hidden);
  const shown = color ?? 0; // the room gives a solo player Pink (index 0) until they choose
  return (
    <div ref={root} className={plane.wrap + ' ' + styles.wrap} data-ui="lobby-helicopter">
      <div className={styles.sky} aria-hidden="true"><span className={styles.cloud} /><span className={styles.cloud} /><span className={styles.cloud} /></div>
      <div className={styles.craft} role="img" aria-label={'A helicopter carrying your ' + (PLAYER_COLOR_NAMES[shown] ?? '') + ' ball'} style={{ '--ball': colorHex(shown) }} data-color={shown}>
        <span className={styles.rotor} />
        <span className={styles.mast} />
        <span className={styles.boom} />
        <span className={styles.fin} />
        <span className={styles.tailRotor} />
        <span className={styles.body}><span className={styles.stripe} /><span className={styles.door} /></span>
        <span className={styles.window}><span className={plane.ball + ' ' + styles.ball} /></span>
        <span className={styles.skids} />
      </div>
      <span className={styles.shadow} aria-hidden="true" />
      <div className={styles.caption} style={{ '--ball': colorHex(shown) }}>
        <span className={plane.name + ' ' + styles.name}>
          <button ref={badge} type="button" className={plane.badge + ' ' + plane.mine} aria-label={'Change your ball colour (now ' + (PLAYER_COLOR_NAMES[shown] ?? '') + ')'} aria-haspopup="dialog" aria-expanded={open && !closing} onClick={toggle} data-ui="my-color-badge" />
          <span className={plane.label}>{name.trim() || 'You'}</span>
        </span>
      </div>
      {open && <BadgePicker selected={color ?? 0} taken={{}} onPick={onPick} onClose={onClose} badge={badge} closing={closing} solo />}
    </div>
  );
}
