import { useEffect, useRef, useState } from 'react';
import { colorHex, PLAYER_COLOR_NAMES } from '../shared/colors.js';
import { ColorPicker } from './ColorPicker.jsx';
import styles from './BadgePicker.module.css';

/** How long the picker takes to close (its exit animation), in ms. Matches `.closing` in BadgePicker.module.css. */
export const PICKER_CLOSE_MS = 140;

/**
 * The colour picker that opens from the player's own colour badge (owner, 2026-11-14), on the Solo and party lobby tickets. Closes
 * on Escape, on a click outside it, or from the badge again; focus moves into it on open and back to the badge on close. Colours
 * other players hold are crossed out (`taken`); alone (`solo`) nothing is.
 */
function Picker({ selected, taken, onPick, onClose, badge, closing, solo }) {
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
 * The player's own colour badge and the picker it opens. One colour system for Solo and party: picking calls `onPick` with the
 * palette index, which the lobbies send as SET_COLOR, so the choice is saved the same way everywhere.
 */
export function ColorBadge({ color = null, taken = {}, onPick, hidden = false, solo = false }) {
  const root = useRef(null);
  const badge = useRef(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);
  const close = useRef(null);
  close.current = refocus => {
    if (!open || closing) return;
    setClosing(true);
    const view = root.current?.ownerDocument.defaultView ?? globalThis;
    timer.current = view.setTimeout(() => { setOpen(false); setClosing(false); if (refocus) badge.current?.focus(); }, PICKER_CLOSE_MS);
  };
  const [onClose] = useState(() => refocus => close.current(refocus));
  useEffect(() => () => { if (timer.current !== null) (root.current?.ownerDocument.defaultView ?? globalThis).clearTimeout(timer.current); }, []);
  useEffect(() => { if (hidden) { setOpen(false); setClosing(false); } }, [hidden]);
  const shown = color ?? 0;
  return (
    <span ref={root} className={styles.wrap}>
      <button ref={badge} type="button" className={styles.badge} style={{ '--ball': colorHex(shown) }} data-color={shown}
        aria-label={'Change your ball colour (now ' + (PLAYER_COLOR_NAMES[shown] ?? '') + ')'} aria-haspopup="dialog" aria-expanded={open && !closing}
        onClick={() => (open ? onClose(true) : setOpen(true))} data-ui="my-color-badge" />
      {open && <Picker selected={shown} taken={taken} onPick={onPick} onClose={onClose} badge={badge} closing={closing} solo={solo} />}
    </span>
  );
}
