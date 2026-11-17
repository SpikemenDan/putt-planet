import { colorHex } from '../shared/colors.js';
import { NAME_LIMIT } from './commands.js';
import styles from './LobbyManifest.module.css';

/**
 * The passenger manifest (owner, 2026-11-16): everyone in the party on an airport departures board, one row per seat. A taken seat
 * shows its number, the player's ball, their name and BOARDED, with HOST and YOU tags; open seats wait in grey. Names render as
 * React text only, cut to NAME_LIMIT characters.
 */
export function LobbyManifest({ passengers = [], seats = 8, flight = '', destination = '' }) {
  const rows = Array.from({ length: seats }, (_, i) => passengers[i] ?? null);
  return (
    <section className={styles.board} aria-label="Passenger manifest" data-ui="lobby-manifest">
      <header className={styles.head}>
        <b>Passenger manifest</b>
        <span>{flight} · to {destination}</span>
      </header>
      <ol className={styles.rows}>
        {rows.map((p, i) => (
          <li key={p?.id ?? 'open-' + i} className={p ? styles.row : styles.row + ' ' + styles.open} data-seat={i + 1} style={p ? { '--ball': colorHex(p.color), '--delay': (i * 0.06) + 's' } : { '--delay': (i * 0.06) + 's' }}>
            <span className={styles.seat}>{String(i + 1).padStart(2, '0')}</span>
            {p ? <>
              <span className={styles.ball} aria-hidden="true" />
              <span className={styles.name}>{String(p.name).slice(0, NAME_LIMIT)}</span>
              {p.host && <span className={styles.host}>Host</span>}
              {p.you && <span className={styles.you}>You</span>}
              <span className={styles.status}>Boarded</span>
            </> : <span className={styles.name}>Open seat</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
