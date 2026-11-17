/**
 * Player preferences kept on this device (owner, 2026-11-16): camera and motion. Presentation only: they never reach
 * the simulation or the room, so online play stays identical whatever each player picks. Values from storage or the
 * UI are untrusted; normalize* turns anything invalid into the default.
 */
import { CAMERA_VIEW_LABELS } from '../camera/rig.js';

/** Camera: `view` is the view index (0 Ball cam, 1 Hole view, 2 World view), `orbitSpeed` multiplies right-drag and
 * arrow-key rotation (0.5 to 2), `invertY` flips up/down rotation. */
export const CAMERA_PREFS = Object.freeze({ view: 0, orbitSpeed: 1, invertY: false });
export const ORBIT_SPEED_RANGE = Object.freeze({ min: 0.5, max: 2, step: 0.1 });
export const CAMERA_PREFS_KEY = 'pp_camera';

/** Motion: 'auto' follows the system's reduced-motion setting, 'reduce' always reduces motion. */
export const MOTION_PREFS = Object.freeze(['auto', 'reduce']);
export const MOTION_PREFS_KEY = 'pp_motion';

export function normalizeCameraPrefs(value) {
  const v = value && typeof value === 'object' ? value : {};
  const speed = Number(v.orbitSpeed);
  return Object.freeze({
    view: Number.isInteger(v.view) && v.view >= 0 && v.view < CAMERA_VIEW_LABELS.length ? v.view : CAMERA_PREFS.view,
    orbitSpeed: Number.isFinite(speed) && speed >= ORBIT_SPEED_RANGE.min && speed <= ORBIT_SPEED_RANGE.max ? Math.round(speed * 10) / 10 : CAMERA_PREFS.orbitSpeed,
    invertY: typeof v.invertY === 'boolean' ? v.invertY : CAMERA_PREFS.invertY,
  });
}

export const normalizeMotionPref = value => (MOTION_PREFS.includes(value) ? value : 'auto');

/** Reads a stored JSON value; storage may be missing, denied or hold junk. */
export function readPref(storage, key) {
  try { const raw = storage?.getItem(key); return raw == null ? null : JSON.parse(raw); } catch { return null; }
}
export function writePref(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* not remembered */ }
}
