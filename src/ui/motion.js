/**
 * Reduced motion (owner, 2026-11-16): true when the player chose "Reduce motion" in Settings (the app marks the page
 * with data-motion="reduce" on <html>) or the system asks for reduced motion. Scenes and transitions read it when they
 * start; CSS follows the same attribute in global.css.
 */
export const reducedMotion = win => win?.document?.documentElement?.dataset?.motion === 'reduce' || !!win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
