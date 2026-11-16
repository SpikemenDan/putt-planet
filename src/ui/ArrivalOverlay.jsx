import { useView } from './context.js';
import { colorHex } from '../shared/colors.js';
import styles from './ArrivalOverlay.module.css';

function CloudSvg({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 50 Q10 50 10 40 Q10 25 25 25 Q30 10 45 15 Q60 5 70 20 Q85 15 90 30 Q95 40 90 50 Z" />
    </svg>
  );
}

/**
 * Arrival sequence overlay (VIS-A #167).
 * Displays falling ball(s) with speed trails, rushing cloud cover,
 * waiting for crew badge when ready, and comic countdown (3-2-1-PUTT!).
 */
export function ArrivalOverlay({ hidden = false }) {
  const arrival = useView(v => v.arrival);

  if (hidden || !arrival) return null;

  const {
    courseName,
    awaitingArrival,
    waitingForOthers,
    inStartCountdown,
    countdownLabel,
    players = [],
  } = arrival;

  const readyCount = players.filter(p => p.ready).length;
  const totalCount = players.length;

  return (
    <div className={styles.overlay} data-ui="arrival-overlay">
      {/* Rushing clouds layer during arrival presentation */}
      {awaitingArrival && (
        <div className={styles.cloudsLayer} aria-hidden="true">
          <CloudSvg className={`${styles.cloud} ${styles.cloud1}`} />
          <CloudSvg className={`${styles.cloud} ${styles.cloud2}`} />
          <CloudSvg className={`${styles.cloud} ${styles.cloud3}`} />
          <CloudSvg className={`${styles.cloud} ${styles.cloud4}`} />
          <CloudSvg className={`${styles.cloud} ${styles.cloud5}`} />
        </div>
      )}

      {/* Skydive stage: course header and falling golf balls */}
      {awaitingArrival && (
        <div className={styles.skydiveStage}>
          <div className={styles.courseHeader}>
            <span className={styles.tagline}>Arriving at</span>
            <h1 className={styles.courseTitle}>{courseName}</h1>
          </div>

          <div className={styles.ballsRow} data-ui="skydive-formation">
            {players.map(p => (
              <div key={p.id} className={styles.diver} data-ui="skydive-diver" data-player={p.id}>
                <div className={styles.windTrail} />
                <div
                  className={styles.ballGraphic}
                  style={{ backgroundColor: colorHex(p.color) }}
                  title={p.name}
                >
                  <div className={styles.ballDimples} />
                </div>
                <span className={styles.diverName}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiting for crew status badge if local player is ready */}
      {waitingForOthers && (
        <div className={styles.waitingBadge} data-ui="waiting-crew" role="status">
          <span>WAITING FOR CREW... ({readyCount}/{totalCount})</span>
        </div>
      )}

      {/* Comic countdown numbers (3, 2, 1, PUTT!) */}
      {inStartCountdown && countdownLabel && (
        <div className={styles.countdownBox} data-ui="arrival-countdown">
          <span
            key={countdownLabel}
            className={`${styles.countdownNumber} ${countdownLabel === 'PUTT!' ? styles.countdownPutt : ''}`}
          >
            {countdownLabel}
          </span>
        </div>
      )}
    </div>
  );
}
