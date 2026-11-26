/**
 * Core constants for Putt Pals.
 * Shared across headless simulation, session management, networking, rendering, and CLI tools.
 */

import { TUNING } from './tuning.js';

// --- Ball & Cup Physics Constants (P32 baseline; values live in ./tuning.js) ---
export const BALL_RADIUS = TUNING.ball.radius;

export const DEFAULT_CUP_RADIUS = TUNING.cup.defaultRadius;

export const MIN_CUP_RADIUS = TUNING.cup.minRadius;

export const TURF_FRICTION = TUNING.surface.turf.friction;

export const SHOT_POWER = TUNING.shotPower;

// Simulation timestep (240 Hz fixed tick)
export const FIXED_TIMESTEP = 1 / 240;

// --- Course & Rule Constants ---
export const MIN_TIMEOUT_SECONDS = 120;
export const MAX_TIMEOUT_SECONDS = 600;
export const DEFAULT_PAR = 2;
export const DEFAULT_PENALTY = 3;

// Starter courses in official tournament order
export const STARTER_COURSE_INDICES = Object.freeze([0, 8, 20, 21, 5, 19, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]); // the playable maps: 22 and 23 are Gaia's Sandstorm Spire and Obsidian Spiral (owner, 2026-11-12), 24-31 Ares and 32-39 Luna (VIS-G #165)

// --- Multiplayer & Protocol Constants ---
export const PROTOCOL_VERSION = 7; // 6: map indices run to MAP_COUNT (24) with the VIS-G maps; 7: MAP_COUNT 40 with the Ares and Luna maps
export const MAX_PLAYERS = 8;
export const MAX_DEPLOYABLES = 200; // wire safety bound only (G1e): keeps a snapshot far under MAX_MESSAGE_BYTES; no game limit applies below it
export const SNAPSHOT_INTERVAL_MS = 70;
export const VOTING_COUNTDOWN_SECONDS = 15;
// A party's Start (owner, 2026-11-19): a launch countdown (ms) that a join cancels; its end makes the planet vote final, then
// everyone's lobby flies to the winning planet (ms) before the map vote opens there.
export const LAUNCH_COUNTDOWN_MS = 5000;
export const LAUNCH_LANDING_MS = 4000;
export const RECONNECT_GRACE_PERIOD_MS = 30000;

// Maximum name length
export const MAX_PLAYER_NAME_LENGTH = 14;
