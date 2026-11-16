/**
 * Player ball colours (Putt Planet, #161). Presentation data shared by the renderer, UI and room contracts. It lives
 * outside constants.js so that palette edits stay out of the simulation fingerprint (src/simulation imports constants.js).
 */

// Player colour palette (Putt Planet, #161; pruned by the owner on 2026-11-14, VIS-M3 #175). Twelve colours chosen so every pair
// stays easy to tell apart: CIEDE2000 at least 20 in normal vision and at least 6 under simulated deuteranopia, protanopia
// and tritanopia (Machado 2009). That is enough for the eight-player room cap with spares. A player's colour is an index into
// this list; the order is part of the wire contract (SERVER_ROOM_VERSION 10) and must only be appended to. The legacy peer
// protocol (test transport only) keeps PROTOCOL_VERSION 6: it lives in constants.js, inside the simulation fingerprint, and
// validates every colour with isColorIndex.
// Colours are unique within a room.
const COLOR_DEFS = Object.freeze([
  ['Pink', '#ff4fb8'], ['Blue', '#3e8ef7'], ['Yellow', '#ffd23f'], ['Violet', '#8e4ec6'], ['Cyan', '#25d1e6'],
  ['Red', '#e5484d'], ['Lime', '#c4ec7a'], ['White', '#e8e8e8'], ['Green', '#5f8f12'], ['Brown', '#8b5a2b'],
  ['Gray', '#8a8f98'], ['Black', '#1d1d1f'],
].map(([name, hex]) => Object.freeze({ name, hex })));
export const PLAYER_COLORS = Object.freeze(COLOR_DEFS.map(c => c.hex));
export const PLAYER_COLOR_NAMES = Object.freeze(COLOR_DEFS.map(c => c.name));
export const PLAYER_COLOR_COUNT = PLAYER_COLORS.length;
/** True for a valid palette index. */
export const isColorIndex = n => Number.isInteger(n) && n >= 0 && n < PLAYER_COLOR_COUNT;
/** Hex colour for a palette index; out-of-range or non-integer values wrap so a renderer never gets undefined. */
export const colorHex = n => PLAYER_COLORS[((Number.isInteger(n) ? n : 0) % PLAYER_COLOR_COUNT + PLAYER_COLOR_COUNT) % PLAYER_COLOR_COUNT];
