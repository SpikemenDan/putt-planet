import { useEffect, useRef, useState } from 'react';
import { colorHex, PLAYER_COLOR_NAMES } from '../shared/colors.js';
import { useUiContext } from './context.js';
import { ColorPicker } from './ColorPicker.jsx';
import styles from './LobbyPlane.module.css';

/** How long the picker takes to close (its exit animation), in ms. Matches `.closing` in LobbyPlane.module.css. */
export const PICKER_CLOSE_MS = 140;

/**
 * Copies `display.lobby` onto the plane as CSS variables. The shipped DISPLAY is frozen, so that is done once; the development
 * tuner's live object is not, so it is re-read every frame while the lobby shows (presentation only, never room state).
 */
export function useLobbyLook(ref, display, hidden, extra = null) {
  useEffect(() => {
    const el = ref.current;
    if (!el || hidden) return undefined;
    const apply = () => {
      const l = display.lobby;
      el.style.setProperty('--lobby-ball', l.ballSize + 'px');
      el.style.setProperty('--lobby-tilt', l.tilt + 'deg');
      el.style.setProperty('--lobby-spacing', String(l.spacing));
      el.style.setProperty('--lobby-bob', l.bob + 'px');
      extra?.(el, display);
    };
    apply();
    const raf = el.ownerDocument.defaultView?.requestAnimationFrame;
    if (Object.isFrozen(display.lobby) || !raf) return undefined;
    let id = 0;
    const tick = () => { apply(); id = raf(tick); };
    id = raf(tick);
    return () => el.ownerDocument.defaultView.cancelAnimationFrame(id);
  }, [ref, display, hidden, extra]);
}

/**
 * The colour picker that opens from the player's own colour badge (owner, 2026-11-14). Closes on Escape, on a click
 * outside it, or from the badge again; focus moves into it on open and back to the badge on close.
 */
export function BadgePicker({ selected, taken, onPick, onClose, badge, closing, solo = false }) {
  const root = useRef(null);
  useEffect(() => {
    const el = root.current;
    el?.querySelector('[aria-checked=true]:not(:disabled), button:not(:disabled)')?.focus();
    const doc = el?.ownerDocument;
    const outside = e => { if (!el.contains(e.target) && !badge.current?.contains(e.target)) onClose(false); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(true); } };
    doc?.addEventListener('pointerdown', outside, true);
    doc?.addEventListener('keydown', key, true);
    return () => { doc?.removeEventListener('pointerdown', outside, true); doc?.removeEventListener('keydown', key, true); };
  }, [onClose, badge]);
  return (
    <div ref={root} className={styles.picker + (closing ? ' ' + styles.closing : '')} role="dialog" aria-label="Your ball colour" data-ui="lobby-color-picker">
      <p className={styles.pickerTitle}>Your ball colour</p>
      <ColorPicker selected={selected} taken={taken} onPick={onPick} />
      <p className={styles.pickerFoot}><span data-ui="colour-name">{PLAYER_COLOR_NAMES[selected] ?? ''}</span><span>{solo ? 'Esc closes' : '✕ taken · Esc closes'}</span></p>
    </div>
  );
}

/**
 * The party lobby (VIS-M3 #175): every player's ball together on one plane, drawn in their colour, with their name on a
 * caption and a colour badge. Only the player's own badge is a button; it opens the colour picker, where colours other
 * players hold (or keep reserved while away) are crossed out. Names render as React text only.
 */
/**
 * Open/close state of the badge colour picker, shared by the party plane and the Solo helicopter (one colour system). The
 * picker closes with a short exit animation; `root` is the lobby element (for its window's timers).
 */
export function useBadgePicker(root, hidden) {
  const badge = useRef(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);
  const close = useRef(null);
  close.current = (refocus) => {
    if (!open || closing) return;
    setClosing(true);
    const view = root.current?.ownerDocument.defaultView ?? globalThis;
    timer.current = view.setTimeout(() => { setOpen(false); setClosing(false); if (refocus) badge.current?.focus(); }, PICKER_CLOSE_MS);
  };
  const [onClose] = useState(() => refocus => close.current(refocus));
  useEffect(() => () => { if (timer.current !== null) (root.current?.ownerDocument.defaultView ?? globalThis).clearTimeout(timer.current); }, [root]);
  useEffect(() => { if (hidden) { setOpen(false); setClosing(false); } }, [hidden]);
  const toggle = () => { if (open) onClose(true); else setOpen(true); };
  return { badge, open, closing, onClose, toggle };
}

export function LobbyPlane({ players = [], hidden = false, myColor = null, taken = {}, onPick }) {
  const { display } = useUiContext();
  const root = useRef(null);
  useLobbyLook(root, display, hidden);
  const { badge, open, closing, onClose, toggle } = useBadgePicker(root, hidden);
  return (
    <div ref={root} className={styles.wrap} data-ui="lobby-plane">
      <div className={styles.stage}>
      <div className={styles.plane} aria-hidden="true" />
      <div className={styles.balls} role="list" aria-label="Players in the party">
        {players.map((p, i) => (
          <div key={p.id} className={styles.player + (p.you ? ' ' + styles.you : '')} role="listitem" data-color={p.color} style={{ '--ball': colorHex(p.color), '--delay': (i * 0.37) + 's' }}>
            <span className={styles.ball} />
            <span className={styles.shadow} aria-hidden="true" />
            <span className={styles.name}>
              {p.you
                ? <button ref={badge} type="button" className={styles.badge + ' ' + styles.mine} aria-label={'Change your ball colour (now ' + (PLAYER_COLOR_NAMES[p.color] ?? '') + ')'} aria-haspopup="dialog" aria-expanded={open && !closing} onClick={toggle} data-ui="my-color-badge" />
                : <span className={styles.badge} aria-hidden="true" />}
              <span className={styles.label}>{p.name}</span>
            </span>
          </div>
        ))}
      </div>
      </div>
      {open && <BadgePicker selected={myColor} taken={taken} onPick={onPick} onClose={onClose} badge={badge} closing={closing} />}
    </div>
  );
}
