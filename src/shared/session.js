/**
 * Session management contracts and lifecycle definitions.
 * Defines the states, transitions, commands, and events for game sessions.
 */

import {
  STARTER_COURSE_INDICES,
  MAX_PLAYERS,
  VOTING_COUNTDOWN_SECONDS,
} from './constants.js';
import { DEFAULT_RULES } from './rules.js';

export const SessionPhases = Object.freeze({
  LOBBY: 'lobby',
  SELECT: 'select',
  PLAY: 'play',
  RESULTS: 'results',
});

export const GameModes = Object.freeze({
  STANDARD: 'standard', // 1 starter map
  TOURNAMENT_3: 'tournament_3', // 3 starter maps
  TOURNAMENT_5: 'tournament_5', // 5 starter maps
  TOURNAMENT_7: 'tournament_7', // 7 starter maps
  PRACTICE: 'practice', // Solo course practice
  PUTT_PRACTICE: 'putt_practice', // Single-putt practice replay
  PONG: 'pong', // Putt Pong 1v1 (GM2)
});

export const SessionCommands = Object.freeze({
  JOIN_ROOM: 'JOIN_ROOM',
  LEAVE_ROOM: 'LEAVE_ROOM',
  SET_MODE: 'SET_MODE',
  SET_POWERUPS: 'SET_POWERUPS', // host: power-ups on or off for the room (GM1)
  SET_DESTINATION: 'SET_DESTINATION', // host, lobby only: the party's planet (Gaia, Ares or Luna), shown as the lobby's plane or rocket
  SET_COLOR: 'SET_COLOR', // any member, lobby only: choose an unused ball colour (#161)
  SET_NAME: 'SET_NAME', // any member, lobby only: rename yourself on your boarding pass (owner, 2026-11-17)
  LOBBY_VOTE: 'LOBBY_VOTE', // any member, lobby only: vote for a game mode and/or a planet (owner, 2026-11-17)
  LAUNCH: 'LAUNCH', // host only, lobby: start the party's launch countdown (owner, 2026-11-19); a join cancels it
  START_VOTING: 'START_VOTING',
  CAST_VOTE: 'CAST_VOTE',
  START_ROUND: 'START_ROUND',
  ADVANCE_PUTT: 'ADVANCE_PUTT',
  FINISH_ROUND: 'FINISH_ROUND',
  RETURN_TO_LOBBY: 'RETURN_TO_LOBBY',
  PONG_SHOT: 'PONG_SHOT', // Putt Pong turn-based shot (GM2b)
});

/**
 * Creates initial room state.
 *
 * @param {object} [options]
 * @returns {object}
 */
export function createInitialSessionState(options = {}) {
  return {
    phase: SessionPhases.LOBBY,
    mode: options.mode ?? GameModes.STANDARD,
    destination: 'gaia', // the party's planet, voted for on the lobby ticket (owner, 2026-11-16, 2026-11-17); the map vote opens on it
    lobbyVotes: {}, // playerId -> { mode?, world? }: each player's lobby vote (owner, 2026-11-17)
    launchAt: 0, // room-clock ms the party's launch countdown ends (0: not counting down); its end locks the planet
    powerups: options.powerups ?? options.rules?.powerups ?? true, // false = No Power-Ups: no boxes, no inventory (GM1)
    rules: { ...(options.rules ?? DEFAULT_RULES) }, // Custom rules (VIS-U #168), fixed when the room is created
    mapIndex: 0,
    puttIndex: 0,
    roundNumber: 0,
    roundLimitSeconds: 120,
    roundStartTime: 0,
    votingDeadline: 0,
    votes: {}, // playerId -> mapIndex
    tie: null, // { options: number[], winner: number } | null when a vote is tied (VIS-V #163)
    roster: options.roster ? [...options.roster] : [],
    players: {}, // playerId -> playerInfo
    isHost: options.isHost ?? true,
    completedMaps: [],
  };
}

/**
 * Resolves map voting with details on whether a tie occurred (VIS-V, #163).
 *
 * Only integer votes for eligible maps count, and (when `connectedIds` is
 * given) only votes from connected players.
 * If there is a tie among the top-voted options, injected `options.random`
 * picks randomly among the tied options only. If no `random` is provided,
 * it falls back to the deterministic legacy rotation formula.
 *
 * @param {Record<string, number>} votes Map of playerId -> mapIndex
 * @param {readonly number[]} [eligibleMaps=STARTER_COURSE_INDICES]
 * @param {{ round?: number, connectedIds?: Iterable<string>, random?: () => number }} [options]
 * @returns {{ winner: number, tie: { options: number[], winner: number } | null }}
 */
export function resolveVoteDetailed(votes, eligibleMaps = STARTER_COURSE_INDICES, options = {}) {
  const round = Number.isInteger(options.round) && options.round >= 0 ? options.round : 0;
  const connected = options.connectedIds ? new Set(options.connectedIds) : null;
  const eligible = new Set(eligibleMaps);
  const random = typeof options.random === 'function' ? options.random : null;

  const counts = new Map();
  let validVotes = 0;
  for (const [playerId, map] of Object.entries(votes || {})) {
    if (connected && !connected.has(playerId)) continue;
    if (!Number.isInteger(map) || !eligible.has(map)) continue;
    counts.set(map, (counts.get(map) || 0) + 1);
    validVotes++;
  }

  if (validVotes === 0) return { winner: eligibleMaps[0], tie: null };

  const top = Math.max(...counts.values());
  const tied = [...counts.keys()].filter((m) => counts.get(m) === top).sort((a, b) => a - b);

  if (tied.length === 1) {
    return { winner: tied[0], tie: null };
  }

  // Tie: pick randomly among tied options only
  const winnerIndex = random
    ? Math.min(tied.length - 1, Math.max(0, Math.floor(random() * tied.length)))
    : (round * 7 + validVotes) % tied.length;
  const winner = tied[winnerIndex];

  return {
    winner,
    tie: {
      options: tied,
      winner,
    },
  };
}

/**
 * Resolves map voting, returning the winning map index.
 *
 * @param {Record<string, number>} votes Map of playerId -> mapIndex
 * @param {readonly number[]} [eligibleMaps=STARTER_COURSE_INDICES]
 * @param {{ round?: number, connectedIds?: Iterable<string>, random?: () => number }} [options]
 * @returns {number} Winning map index
 */
export function resolveVote(votes, eligibleMaps = STARTER_COURSE_INDICES, options = {}) {
  return resolveVoteDetailed(votes, eligibleMaps, options).winner;
}

/**
 * Generic option voting resolver for format, length, world, and maps (VIS-V #163).
 *
 * @template T
 * @param {Record<string, T>} votes Map of playerId -> choice
 * @param {readonly T[]} eligibleOptions
 * @param {{ connectedIds?: Iterable<string>, random?: () => number }} [options]
 * @returns {{ winner: T, tie: { options: T[], winner: T } | null }}
 */
export function resolveOptionVote(votes, eligibleOptions, options = {}) {
  const connected = options.connectedIds ? new Set(options.connectedIds) : null;
  const eligible = new Set(eligibleOptions);
  const random = typeof options.random === 'function' ? options.random : null;

  const counts = new Map();
  let validVotes = 0;
  for (const [playerId, choice] of Object.entries(votes || {})) {
    if (connected && !connected.has(playerId)) continue;
    if (!eligible.has(choice)) continue;
    counts.set(choice, (counts.get(choice) || 0) + 1);
    validVotes++;
  }

  if (validVotes === 0) return { winner: eligibleOptions[0], tie: null };

  const top = Math.max(...counts.values());
  const tied = [...counts.keys()].filter((m) => counts.get(m) === top);
  if (typeof tied[0] === 'number') tied.sort((a, b) => a - b);
  else tied.sort();

  if (tied.length === 1) return { winner: tied[0], tie: null };

  const winnerIndex = random
    ? Math.min(tied.length - 1, Math.max(0, Math.floor(random() * tied.length)))
    : validVotes % tied.length;
  const winner = tied[winnerIndex];

  return {
    winner,
    tie: {
      options: tied,
      winner,
    },
  };
}

/**
 * The winner of a lobby vote (owner, 2026-11-17): every player in `voters` may vote for a mode and a planet (`key` 'mode' or 'world').
 * The option with the most votes wins; a tie goes to the host's pick when it is one of the tied options, else to the first tied option
 * in `order`. Votes for options not in `order` are ignored. With no valid vote, `fallback`.
 *
 * @param {Record<string, {mode?: string, world?: string}>} lobbyVotes
 * @param {'mode'|'world'} key
 * @param {string[]} voters
 * @param {string} hostId
 * @param {string[]} order
 * @param {string} fallback
 */
export function lobbyWinner(lobbyVotes, key, voters, hostId, order, fallback) {
  const counts = new Map();
  for (const id of voters) {
    const pick = lobbyVotes?.[id]?.[key];
    if (order.includes(pick)) counts.set(pick, (counts.get(pick) ?? 0) + 1);
  }
  if (!counts.size) return fallback;
  const top = Math.max(...counts.values());
  const tied = order.filter(option => counts.get(option) === top);
  const hostPick = voters.includes(hostId) ? lobbyVotes?.[hostId]?.[key] : undefined;
  return tied.includes(hostPick) ? hostPick : tied[0];
}

/**
 * Validates whether a command is permissible in the given phase.
 *
 * @param {string} phase Current phase
 * @param {string} commandType Command type
 * @param {boolean} isHost Whether the requester is the host
 * @returns {boolean}
 */
export function canExecuteCommand(phase, commandType, isHost) {
  // Only hosts can trigger room transitions
  const hostOnlyCommands = [
    SessionCommands.SET_DESTINATION,
    SessionCommands.LAUNCH,
    SessionCommands.START_VOTING,
    SessionCommands.START_ROUND,
    SessionCommands.ADVANCE_PUTT,
    SessionCommands.FINISH_ROUND,
    SessionCommands.RETURN_TO_LOBBY,
  ];

  if (hostOnlyCommands.includes(commandType) && !isHost) {
    return false;
  }

  switch (phase) {
    case SessionPhases.LOBBY:
      return [
        SessionCommands.JOIN_ROOM,
        SessionCommands.LEAVE_ROOM,
        SessionCommands.SET_MODE,
        SessionCommands.SET_POWERUPS,
        SessionCommands.SET_DESTINATION,
        SessionCommands.SET_COLOR,
        SessionCommands.SET_NAME,
        SessionCommands.LOBBY_VOTE,
        SessionCommands.LAUNCH,
        SessionCommands.START_VOTING,
      ].includes(commandType);

    case SessionPhases.SELECT:
      return [
        SessionCommands.CAST_VOTE,
        SessionCommands.START_ROUND,
        SessionCommands.LEAVE_ROOM,
      ].includes(commandType);

    case SessionPhases.PLAY:
      return [
        SessionCommands.ADVANCE_PUTT,
        SessionCommands.FINISH_ROUND,
        SessionCommands.LEAVE_ROOM,
      ].includes(commandType);

    case SessionPhases.RESULTS:
      return [
        SessionCommands.RETURN_TO_LOBBY,
        SessionCommands.LEAVE_ROOM,
      ].includes(commandType);

    default:
      return false;
  }
}
