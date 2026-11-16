# UI

React screens for the lobby, room status and countdown, map voting, practice selection, HUD, scorecard, results, banners and toasts, styled with CSS Modules. Wording, layout and visuals are ported from the legacy page and checked pixel for pixel in Chromium (see Verification). The browser still runs the legacy embedded game until I1 integrates this module.

## Using it

```js
import { createCourseData } from './src/courses/index.js';
import { createCourseInfo, createUiStore, createUiDispatcher, mountUi, parseJoinRequest, UiCommands } from './src/ui/index.js';

const courses = createCourseInfo(createCourseData());
const store = createUiStore({ courses, clock: window });          // clock: setTimeout/clearTimeout for toasts and banners
const dispatch = createUiDispatcher(store, command => app.handle(command));
const unmount = mountUi(element, { store, dispatch, aim: input, onCanvas, initialName, initialRoomCode });

store.setLocal({ active: true, id, isHost, roomCode, mode, strokes, inventory, soundOn, qualityHigh, viewLabel, connected, connecting, colors });
session.subscribe(snapshot => store.setRoom(snapshot, roomNow()));  // L1 snapshot shape, guest snapshots included
setInterval(() => store.tick(roomNow()), 100);                      // countdowns and the putt timer, as the legacy 100 ms tick
store.toast('Hole Magnet armed for this shot.');
store.announce(name, 'HOLE MAGNET ACTIVATED', 'power');
```

`roomNow()` must use the same time base as `roundStartTime` and `votingDeadline` (local time for solo; service time synchronized by the online WebSocket client).

## Commands

The UI never mutates game or session state. Buttons dispatch the same command objects the input adapter does (`src/input` `InputCommands`), plus:

| Command | Meaning |
| --- | --- |
| `{ type: 'session', event }` | An L1 `SessionEvents` command without `playerId`; the app binds the local player identity and the room service validates controller permissions. |
| `create-party` / `join` / `play-solo` | Main menu (VIS-M3 #175): Party has Create (no code until the room exists) and a Join code box with a Join button; `parseJoinRequest()` normalizes the name and code. |
| `leave`, `invite`, `toggle-quality` | Legacy Leave room, Invite/Copy invite and Quality buttons. |

`createUiDispatcher` applies `toggle-card`/`close-card` to the store first (the scorecard is UI state), then forwards every command. Give the same dispatcher to the input adapter so K and Escape behave like the buttons.

## Snapshots and React

`createUiStore` publishes one deeply frozen view snapshot. Sections (`screens`, `lobby`, `voting`, `hud`, `scorecard`, `results`, `banner`, …) keep their identity when unchanged, so `useSyncExternalStore` selectors re-render only affected screens. Physics and per-frame values never pass through React: the power meter subscribes to the input adapter and writes its bar and caption through refs. The canvas is always mounted (screens toggle `hidden`, as in the legacy DOM), so the renderer's WebGL context survives phase changes; `onCanvas` receives the element.

The view models in `model.js` are pure functions of the room snapshot, local state, room time and course info, ported from the legacy `syncRoom`, `tick`, `cardData`, `renderCard`, `showResults` and `fin`. Player names render as React text only.

## Legacy behaviour kept, and deliberate differences

- Notification timing is legacy: toasts clear after 3 s; banners queue, show 1.9 s (2.8 s for hole-in-one and champion), with 0.35 s gaps. A putt banner appears on every round start of a multi-putt map, a hole-in-one banner once per player and round, and winner/champion banners on results.
- The scorecard closes when a putt starts and on lobby/selection, as before.
- **Focus management (new, intentional):** opening the scorecard moves keyboard focus to its Close button and closing returns focus to the opener. The Close button therefore shows a focus ring that the legacy page did not; this is the only visual difference in the parity run.
- Accessibility attributes that render nothing were added: `role="dialog"` on the scorecard, `role="meter"` with live `aria-valuenow` on the power bar, `aria-pressed` on map cards, `role="status"` live regions for toasts and banners, `role="alert"` for the disconnect notice and a label for the canvas.
- The legacy "Play selected map" button was permanently hidden and is not ported. The unused `#warp` overlay is not ported.
- Party flow (VIS-M3 #175): Create and Join land straight in the lobby with a free colour (owner, 2026-11-14). `RoomLobby` shows the party code with Copy invite and everyone's balls on one plane (`LobbyPlane`, tuned by `display.lobby`). Your own colour badge on the plane opens the colour picker (a dialog; Escape or an outside click closes it, focus returns to the badge); colours others hold, including seats reserved for disconnected players (`room.reserved`, online rooms), are crossed out and update live. The lobby has no No power-ups box (a Custom rule since 2026-11-11), and a party offers Putt Pong only with exactly two players.
- Player colours (#161): each player record carries a palette index (`players[id].color`), chosen by the player and unique in the room. The palette is `PLAYER_COLORS` / `PLAYER_COLOR_NAMES` in `src/shared/colors.js` (12 easy-to-tell-apart colours since 2026-11-14). `colorOf` reads the room's colour and only falls back to join order for old fixtures. `ColorPicker` (Solo steps and the lobby badge picker) disables and crosses out (X) colours other players hold or keep reserved; picks go out as the `set-color` UI command, which the app saves locally and sends to the room as `SET_COLOR`.
- Legacy reports join errors with `alert()`. The UI leaves that to the application through `parseJoinRequest()` messages.

## Verification

- `npm run test:ui` builds this module with Vite's production JSX/CSS Modules transforms and renders it with React DOM in jsdom. It compares the HUD line, scoreboard (including a spectator and tied totals), every scorecard cell and highlight, and results text with the legacy game in the same state. It drives the real L1 session through landing, lobby, a two-player three-map tournament (voting countdown, start countdown, banners, hole in one, results, champion, guest and spectator views), course and putt practice, scorecard focus, HUD controls, name escaping, store caching and timing, the power meter (no React commits for aim updates) and repeated mount/unmount cleanup.
