/**
 * DX2: development-only editing of the gameplay settings (TUNING: physics, dimensions, shot mapping, hazards, scoring).
 *
 * Unlike DISPLAY, nothing here applies live: the simulation reads TUNING when its modules load, and changing physics
 * mid-putt would leave the running state inconsistent. Edits are staged and validated as a whole; "Apply and reload"
 * stores them for this tab and reloads with ?tune, so the game restarts with them (src/devtools/tuning-boot.js).
 * While they are active the app refuses party rooms (src/app/app.js), because every player must simulate the same
 * physics. Shipped defaults stay in src/shared/tuning.js and are never changed here: export the overrides and have them
 * made defaults deliberately, then re-run the affected solver checks (docs/TUNING.md).
 */

import { DEFAULT_TUNING, TUNING, TUNING_FIELDS, TUNING_STARTUP, createTuning } from '../shared/tuning.js';
import { GAMEPLAY_OVERRIDES_PARAM, GAMEPLAY_OVERRIDES_STORAGE_KEY, GAMEPLAY_OVERRIDES_VERSION, readStoredOverrides } from './tuning-boot.js';

const FIELDS = new Map(TUNING_FIELDS.map(([path, min, max]) => [path, { min, max }]));
const read = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
function write(obj, path, value) {
  const keys = path.split('.');
  let target = obj;
  for (const k of keys.slice(0, -1)) target = target[k] ??= {};
  target[keys.at(-1)] = value;
}
const nest = flat => { const out = {}; for (const [path, value] of Object.entries(flat)) write(out, path, value); return out; };
function leaves(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, path, out); else out.push([path, v]);
  }
  return out;
}

/** Flat overrides from a nested object. Throws on unknown fields or invalid values, naming them. */
function flatten(nested) {
  const flat = {};
  for (const [path, value] of leaves(nested)) {
    if (!FIELDS.has(path)) throw new Error('Invalid tuning: unknown field ' + path);
    if (value !== read(DEFAULT_TUNING, path)) flat[path] = value;
  }
  createTuning(nest(flat)); // range and cross-field checks, every problem listed
  return flat;
}

/**
 * @param {{storage?: Storage|null, location?: {href: string, assign: (url: string) => void}|null, running?: object, startup?: {overridden: boolean, problem: string|null}}} [options]
 *   `running` and `startup` are what this page loaded with (TUNING and TUNING_STARTUP); tests inject them.
 */
export function createGameplayTuner({ storage = null, location = null, running = TUNING, startup = TUNING_STARTUP } = {}) {
  const listeners = new Set();
  let staged = {};
  try { const stored = readStoredOverrides(storage); if (stored) staged = flatten(stored); } catch { staged = {}; }
  // Without ?tune the stored values did not apply, so the editor starts from what is running.
  if (!startup.overridden) staged = {};

  const notify = () => { for (const l of [...listeners]) l(api); };
  function commit(flat) { flatten(nest(flat)); staged = flat; notify(); }

  const api = {
    fields: TUNING_FIELDS,
    defaults: DEFAULT_TUNING,
    running,
    /** True when this page is running with development overrides (party rooms are refused). */
    get active() { return startup.overridden; },
    /** Why stored overrides were refused at startup, or null. */
    get problem() { return startup.problem; },
    get overrides() { return { ...staged }; },
    isOverridden: path => path in staged,
    /** Staged value (what applies after reload). */
    get: path => (path in staged ? staged[path] : read(DEFAULT_TUNING, path)),
    /** Value the running game uses. */
    current: path => read(running, path),
    /** Paths whose staged value differs from what is running: they need "Apply and reload". */
    get pending() { return TUNING_FIELDS.map(([p]) => p).filter(p => api.get(p) !== api.current(p)); },
    /** Stages one field. A value equal to its default clears it. Throws and changes nothing when invalid. */
    set(path, value) {
      const field = FIELDS.get(path);
      if (!field) throw new Error('Invalid tuning: unknown field ' + path);
      if (typeof value !== 'number' || !Number.isFinite(value) || value < field.min || value > field.max) throw new Error(path + ' must be within [' + field.min + ', ' + field.max + '], got ' + value);
      const flat = { ...staged };
      if (value === read(DEFAULT_TUNING, path)) delete flat[path]; else flat[path] = value;
      commit(flat);
    },
    reset(path) {
      if (path === undefined) return commit({});
      const flat = { ...staged };
      delete flat[path];
      return commit(flat);
    },
    exportJson: () => JSON.stringify({ version: GAMEPLAY_OVERRIDES_VERSION, tuning: nest(staged) }, null, 2),
    /** Replaces the staged overrides from exported JSON. Validated first; throws and changes nothing when invalid. */
    importJson(text) {
      let parsed;
      try { parsed = JSON.parse(text); } catch { throw new Error('Import is not valid JSON'); }
      if (!parsed || typeof parsed !== 'object' || parsed.version !== GAMEPLAY_OVERRIDES_VERSION || !parsed.tuning || typeof parsed.tuning !== 'object' || Array.isArray(parsed.tuning)) {
        throw new Error('Import must be {"version": ' + GAMEPLAY_OVERRIDES_VERSION + ', "tuning": {...}}');
      }
      staged = flatten(parsed.tuning);
      notify();
    },
    /**
     * Restarts the game with the staged overrides: stores them for this tab and reloads with ?tune. With nothing staged
     * it clears them and reloads without ?tune, back to shipped values.
     */
    applyAndReload() {
      if (!location) throw new Error('Reload is not available here');
      const url = new URL(location.href);
      const any = Object.keys(staged).length > 0;
      try {
        if (any) storage?.setItem(GAMEPLAY_OVERRIDES_STORAGE_KEY, api.exportJson()); else storage?.removeItem(GAMEPLAY_OVERRIDES_STORAGE_KEY);
      } catch { throw new Error('Could not store the overrides (storage is blocked)'); }
      if (any) url.searchParams.set(GAMEPLAY_OVERRIDES_PARAM, ''); else url.searchParams.delete(GAMEPLAY_OVERRIDES_PARAM);
      location.assign(url.toString());
    },
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
  return api;
}
