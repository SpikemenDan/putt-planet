/**
 * One lobby canvas per page, kept for the page's life so the lobby vehicle takes one WebGL context slot in total rather than one
 * per visit. Browsers cap the contexts a page may hold (WebKit counts a context against its cap until it is garbage collected,
 * even after it was force-lost), and the lobby opens several times a game: before the map select, after Exit and in every party.
 *
 * Between visits the context is still released: the scene force-loses it on dispose, as every backdrop does. The next visit
 * restores that same context (WEBGL_lose_context.restoreContext) before building its scene, instead of creating a new one. If
 * the context cannot be restored (no extension, a real loss, a browser that refuses), the pool falls back to a fresh canvas.
 */

/** How long a restore may take before the pool gives up on it and starts a fresh canvas, in ms. */
export const RESTORE_TIMEOUT_MS = 600;

const slots = new WeakMap(); // Document -> slot

/** The page's lobby canvas slot, made on first use. `className` is applied to the canvas. */
export function lobbyCanvasSlot(doc, className = '') {
  let slot = slots.get(doc);
  if (!slot) { slot = makeSlot(doc, className); slots.set(doc, slot); }
  return slot;
}

function makeSlot(doc, className) {
  const win = doc.defaultView;
  let canvas = null, gl = null, ext = null, lostSeen = false, pending = null;
  const fresh = () => {
    canvas = doc.createElement('canvas');
    canvas.className = className;
    canvas.dataset.ui = 'lobby-canvas';
    canvas.setAttribute('role', 'img');
    gl = null; ext = null; lostSeen = false;
  };
  fresh();

  return {
    get canvas() { return canvas; },

    /**
     * Calls `begin` once the canvas is ready for a new scene: at once for a canvas that never held a context or still holds a
     * live one, or once its released context is restored. Returns a function that cancels a wait (or null when `begin` ran).
     */
    ready(begin) {
      if (!gl || !gl.isContextLost()) { begin(); return null; }
      if (!ext) { fresh(); begin(); return null; }
      let timer = 0, done = false;
      const stop = () => { done = true; pending = null; canvas.removeEventListener('webglcontextrestored', onRestored); if (timer) win.clearTimeout(timer); timer = 0; };
      const onRestored = () => { if (done) return; stop(); begin(); };
      const restore = () => {
        pending = null;
        if (done) return;
        canvas.addEventListener('webglcontextrestored', onRestored);
        try { ext.restoreContext(); } catch { stop(); fresh(); begin(); }
      };
      timer = win.setTimeout(() => { if (done) return; stop(); fresh(); begin(); }, RESTORE_TIMEOUT_MS);
      // A context can only be restored after its loss event has been dispatched (and cancelled, below).
      if (lostSeen) restore(); else pending = restore;
      return stop;
    },

    /** Records the context a scene drew with, so a later visit can restore it. `context` may be null (no WebGL, tests). */
    adopt(context) {
      if (!context || typeof context.isContextLost !== 'function') return;
      gl = context;
      ext = gl.getExtension?.('WEBGL_lose_context') ?? null; // asked while live: a lost context answers null
      lostSeen = false;
    },

    /**
     * Call just before the scene disposes (and so force-loses) the context: the loss event is cancelled, which marks the
     * context as restorable. The listener removes itself when the event arrives.
     */
    release() {
      if (!gl || !ext) return;
      if (gl.isContextLost()) { ext = null; return; } // already lost (evicted): no loss event will come, so start fresh next time
      const target = canvas;
      const onLost = event => {
        event.preventDefault();
        target.removeEventListener('webglcontextlost', onLost);
        if (target !== canvas) return;
        lostSeen = true;
        pending?.();
      };
      target.addEventListener('webglcontextlost', onLost);
    },
  };
}
