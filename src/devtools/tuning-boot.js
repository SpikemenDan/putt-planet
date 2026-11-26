/**
 * DX2: hands the development gameplay overrides to src/shared/tuning.js before it is evaluated. It must stay the first
 * import of src/app/main.js and must not import tuning.js (or anything that does), because TUNING is built once, when
 * tuning.js first loads.
 *
 * Overrides apply only in development builds and only when the URL has ?tune, so stored values can never apply unseen.
 * They come from sessionStorage (one tab), written by the panel's "Apply and reload" (src/devtools/gameplay-tuner.js).
 * tuning.js validates them; anything invalid is ignored as a whole and reported in the panel.
 */

export const GAMEPLAY_OVERRIDES_STORAGE_KEY = 'putt-pals.gameplay-overrides';
export const GAMEPLAY_OVERRIDES_VERSION = 1;
export const GAMEPLAY_OVERRIDES_PARAM = 'tune';

/** The nested overrides stored for this tab, or null. Never throws. */
export function readStoredOverrides(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(GAMEPLAY_OVERRIDES_STORAGE_KEY) ?? 'null');
    return parsed && parsed.version === GAMEPLAY_OVERRIDES_VERSION && parsed.tuning && typeof parsed.tuning === 'object' && !Array.isArray(parsed.tuning) ? parsed.tuning : null;
  } catch { return null; }
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  try {
    if (new URLSearchParams(window.location.search).has(GAMEPLAY_OVERRIDES_PARAM)) {
      const overrides = readStoredOverrides(window.sessionStorage);
      if (overrides) globalThis.__PP_DEV_TUNING__ = overrides; // the name is TUNING_OVERRIDES_GLOBAL in tuning.js
    }
  } catch { /* storage blocked: shipped values */ }
}
