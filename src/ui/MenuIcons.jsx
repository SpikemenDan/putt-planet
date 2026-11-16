/**
 * Small original comic icons for the main menu and the Solo steps (owner, 2026-11-14): flat shapes with an ink outline, drawn
 * in a 32-unit box. Decorative only (aria-hidden); every button keeps its own text label.
 */
const INK = 'var(--ink)';
const line = { fill: 'none', stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

const PATHS = {
  /** Casual: a hole flag in the turf. */
  flag: <>
    <ellipse cx="16" cy="27" rx="10" ry="3" fill="#2fbf5b" stroke={INK} strokeWidth="2.2" />
    <path d="M12 27V5" {...line} />
    <path d="M12 5l13 4.5L12 14z" fill="#ff3d8b" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
  </>,
  /** Tournament: a cup trophy. */
  trophy: <>
    <path d="M9 5h14v6a7 7 0 0 1-14 0z" fill="#ffd23f" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M9 8H5.5a3.5 3.5 0 0 0 4 4.5M23 8h3.5a3.5 3.5 0 0 1-4 4.5" {...line} />
    <path d="M16 18v4" {...line} />
    <path d="M10.5 27.5h11l-1.5-5h-8z" fill="#ffd23f" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
  </>,
  /** Practice: a target with a ball on the bullseye. */
  target: <>
    <circle cx="16" cy="16" r="12" fill="#fff" stroke={INK} strokeWidth="2.4" />
    <circle cx="16" cy="16" r="7.5" fill="#ff3d8b" stroke={INK} strokeWidth="2.2" />
    <circle cx="16" cy="16" r="3" fill="#fff" stroke={INK} strokeWidth="2" />
  </>,
  /** Whole map: a folded map with a dotted route to a flag. */
  map: <>
    <path d="M4 8l7-3 10 3 7-3v19l-7 3-10-3-7 3z" fill="#fff8e4" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M11 5v19M21 8v19" fill="none" stroke={INK} strokeWidth="1.6" opacity=".45" />
    <path d="M7 21c3-1 5-6 9-5s4-5 8-6" fill="none" stroke="#ff3d8b" strokeWidth="2.2" strokeDasharray="2.4 2.6" strokeLinecap="round" />
  </>,
  /** One putt: a golf ball rolling toward a cup. */
  putt: <>
    <ellipse cx="22" cy="25" rx="7" ry="3" fill={INK} />
    <circle cx="11" cy="16" r="7" fill="#fff" stroke={INK} strokeWidth="2.4" />
    <circle cx="9.5" cy="14.5" r="1" fill={INK} opacity=".35" /><circle cx="13" cy="15" r="1" fill={INK} opacity=".35" /><circle cx="11" cy="18.5" r="1" fill={INK} opacity=".35" />
    <path d="M3 25h7" {...line} strokeWidth="2" opacity=".6" />
  </>,
  /** Putt Pong: three cups with a ball dropping in. */
  pong: <>
    <path d="M4 15h8l-1.4 12h-5.2zM12 15h8l-1.4 12h-5.2zM20 15h8l-1.4 12h-5.2z" fill="#d7261e" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M4 15h24" {...line} strokeWidth="2.2" />
    <circle cx="16" cy="7" r="4" fill="#fff" stroke={INK} strokeWidth="2.2" />
  </>,
  /** Solo (main menu, owner 2026-11-16): one clean golf ball, a soft shade on its lower right, a glint and six tidy dimples. */
  solo: <>
    <circle cx="16" cy="16" r="12" fill="#fff" />
    <path d="M25.5 9.5A12 12 0 0 1 9.5 26.1 10.5 10.5 0 0 0 25.5 9.5z" fill="#d9d4ea" />
    <circle cx="16" cy="16" r="12" fill="none" stroke={INK} strokeWidth="2.4" />
    <g fill="#bdb6d6"><circle cx="13" cy="12" r="1.3" /><circle cx="18" cy="11" r="1.3" /><circle cx="21.5" cy="15" r="1.3" /><circle cx="11" cy="17" r="1.3" /><circle cx="16" cy="16.5" r="1.3" /><circle cx="19.5" cy="20" r="1.3" /><circle cx="14" cy="21.5" r="1.3" /></g>
    <ellipse cx="11" cy="9.5" rx="2.6" ry="1.5" fill="#fff" transform="rotate(-35 11 9.5)" />
  </>,
  /** Party (main menu): two friends' balls side by side, each in its own colour, with three even rays above, like a cheer. */
  party: <>
    <circle cx="11" cy="19" r="8" fill="#ffd23f" stroke={INK} strokeWidth="2.4" />
    <circle cx="21.5" cy="20" r="7.5" fill="#ff3d8b" stroke={INK} strokeWidth="2.4" />
    <circle cx="8.5" cy="16.5" r="2" fill="#fff" opacity=".8" /><circle cx="19.2" cy="17.6" r="1.8" fill="#fff" opacity=".8" />
    <path d="M16 7.5V3.5M11.2 9.3 8.6 6.2M20.8 9.3l2.6-3.1" {...line} strokeWidth="2.2" />
  </>,
  /** Custom (main menu): three rule sliders, each knob at a different setting. */
  custom: <>
    <rect x="4" y="4" width="24" height="24" rx="6" fill="#fff8e4" stroke={INK} strokeWidth="2.4" />
    <path d="M9 11h14M9 16h14M9 21h14" {...line} strokeWidth="2.2" />
    <circle cx="19" cy="11" r="2.8" fill="#ff3d8b" stroke={INK} strokeWidth="2" />
    <circle cx="12" cy="16" r="2.8" fill="#2f7cf0" stroke={INK} strokeWidth="2" />
    <circle cx="17" cy="21" r="2.8" fill="#2fbf5b" stroke={INK} strokeWidth="2" />
  </>,
  /** Settings (main menu): a rounded gear. */
  settings: <>
    <path d="M14 3h4l.8 3.4 2.4 1 3-1.8 2.8 2.8-1.8 3 1 2.4L29 14v4l-3.4.8-1 2.4 1.8 3-2.8 2.8-3-1.8-2.4 1L18 29h-4l-.8-3.4-2.4-1-3 1.8-2.8-2.8 1.8-3-1-2.4L3 18v-4l3.4-.8 1-2.4-1.8-3 2.8-2.8 3 1.8 2.4-1z" fill="#ffd23f" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
    <circle cx="16" cy="16" r="4.5" fill="#fff" stroke={INK} strokeWidth="2.2" />
  </>,
  /** Skins (main menu): a ball half painted, with a brush tip on it. */
  skins: <>
    <circle cx="14" cy="18" r="10" fill="#fff" stroke={INK} strokeWidth="2.4" />
    <path d="M5.3 13.2A10 10 0 0 1 22.8 13.4c-3 1.8-6.4.4-9-.6-2.8-1.1-5.4-.6-8.5.4z" fill="#ff3d8b" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    <path d="M21 9.5l6.5-6.5 2 2-6.5 6.5z" fill="#ffd23f" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    <path d="M21 9.5l2 2-1.8 1.4-1.6-1.6z" fill={INK} />
  </>,
  /** Settings sub-menu: a speaker with sound waves. */
  sound: <>
    <path d="M5 12h5l7-6v20l-7-6H5z" fill="#ffd23f" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M21.5 11.5a6 6 0 0 1 0 9M25 8a11 11 0 0 1 0 16" {...line} strokeWidth="2.4" />
  </>,
  /** Settings sub-menu: a monitor with a sparkle. */
  graphics: <>
    <rect x="3.5" y="5" width="25" height="17" rx="3" fill="#fff" stroke={INK} strokeWidth="2.4" />
    <path d="M12 27.5h8M16 22v5" {...line} strokeWidth="2.4" />
    <path d="M16 8.5l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#2f7cf0" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
  </>,
  /** Settings sub-menu, "Your style": a paint palette. */
  palette: <>
    <path d="M16 4C9 4 4 9 4 15.5S9 28 15 28c2.5 0 3-1.6 2.2-3.2-.8-1.6 0-3.3 2-3.3H23c3 0 5-2 5-5C28 9.5 22.6 4 16 4z" fill="#fff8e4" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <circle cx="10" cy="15" r="2.3" fill="#ff3d8b" stroke={INK} strokeWidth="1.6" /><circle cx="13" cy="9.5" r="2.3" fill="#ffd23f" stroke={INK} strokeWidth="1.6" />
    <circle cx="19.5" cy="9.5" r="2.3" fill="#2f7cf0" stroke={INK} strokeWidth="1.6" /><circle cx="23" cy="14.5" r="2.3" fill="#2fbf5b" stroke={INK} strokeWidth="1.6" />
  </>,
  /** Settings sub-menu, "How to play": a speech bubble with a question mark. */
  help: <>
    <path d="M6 5h20a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H14l-6 5v-5H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M12.5 11a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3" {...line} strokeWidth="2.4" />
    <circle cx="16" cy="19.6" r="1.4" fill={INK} />
  </>,
};

/** One icon by name (see PATHS). */
export function MenuIcon({ name, className }) {
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false" data-icon={name}>{PATHS[name]}</svg>;
}
