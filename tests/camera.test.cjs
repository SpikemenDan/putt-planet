// Putt-to-putt camera transition, checked against absolute properties instead of the legacy game (which
// render.test.cjs still uses as an oracle until it is retired). Ports the legacy smoke assertions
// "ball arcs above the floor mid-flight", "ends within about 1.5 s" and "camera never jumps, including the
// hand-off to the normal camera".
const assert = require('node:assert/strict');

(async () => {
  const { createCameraRig, PUTT_TRANSITION_MS } = await import('../src/camera/rig.js');

  const from = [240, 5, 80], to = [320, 5, 210];
  const frameMs = 1000 / 60;
  const settled = (rig, now) => {
    // Let the follow camera settle on the first tee before the transition starts.
    for (let i = 0; i < 120; i++) rig.update({ now: now += frameMs, dt: frameMs / 1000, ball: from, hole: [300, 0, 80] });
    return now;
  };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  const rig = createCameraRig();
  let now = settled(rig, 0);
  const before = rig.update({ now: now += frameMs, dt: frameMs / 1000, ball: from, hole: [300, 0, 80] });
  assert.equal(rig.transitioning, false);

  rig.startPuttTransition({ from, to, now });
  assert.equal(rig.transitioning, true, 'a transition starts at the next putt');
  const start = now;
  let previous = before, largestStep = 0, peak = -Infinity, last = null, frames = 0, ended = null;
  while (rig.transitioning) {
    now += frameMs;
    last = rig.update({ now, dt: frameMs / 1000, ball: to, hole: [400, 0, 210] });
    frames++;
    assert.ok(frames < 200, 'the transition ends');
    largestStep = Math.max(largestStep, dist(last.position, previous.position));
    peak = Math.max(peak, last.ball[1]);
    previous = last;
    if (!rig.transitioning) ended = now - start;
  }
  assert.ok(last.events.includes('transition-end'), 'the last transition frame reports its end');
  assert.ok(Math.abs(ended - PUTT_TRANSITION_MS) <= frameMs + 1e-6, `the transition ends within one frame of ${PUTT_TRANSITION_MS} ms, took ${ended}`);
  assert.ok(ended <= 1600, 'about 1.5 s');
  assert.ok(peak > Math.max(from[1], to[1]) + 50, `the ball arcs well above the floor mid-flight (peak ${peak})`);
  assert.ok(dist(last.ball, to) < 1e-6, 'the ball lands on the next tee');

  // The camera never jumps: per-frame travel stays small through the whole transition.
  assert.ok(largestStep < 40, `largest camera step per frame during the transition is small (${largestStep.toFixed(2)})`);
  // And through the hand-off to the normal follow camera.
  let handoff = 0;
  for (let i = 0; i < 90; i++) {
    now += frameMs;
    const next = rig.update({ now, dt: frameMs / 1000, ball: to, hole: [400, 0, 210] });
    handoff = Math.max(handoff, dist(next.position, previous.position));
    previous = next;
    assert.equal(next.transitioning, false);
  }
  assert.ok(handoff < 40, `largest camera step per frame after the hand-off is small (${handoff.toFixed(2)})`);

  // Reduced motion shortens the transition to a single frame's worth.
  const quick = createCameraRig();
  let t = settled(quick, 0);
  quick.startPuttTransition({ from, to, now: t, reducedMotion: true });
  let q = 0;
  while (quick.transitioning && q++ < 10) quick.update({ now: t += frameMs, dt: frameMs / 1000, ball: to, hole: [400, 0, 210] });
  assert.equal(quick.transitioning, false);
  assert.ok(q <= 2, 'reduced motion ends at once');

  // Player camera preferences (owner, 2026-11-16): rotation speed, inverted up/down and a chosen view.
  const base = createCameraRig(), fast = createCameraRig(), inverted = createCameraRig();
  fast.state.orbitSpeed = 2; inverted.state.invertY = true;
  const drag = { x: 0, y: 0, azimuth: 1, elevation: 0.5 };
  for (const r of [base, fast, inverted]) r.orbitDrag(drag, 50, 20);
  assert.ok(Math.abs(base.state.azimuth - 1.3) < 1e-12 && Math.abs(base.state.elevation - 0.62) < 1e-12, 'default speed keeps the legacy 0.006 rad per px');
  assert.ok(Math.abs((fast.state.azimuth - 1) - 2 * (base.state.azimuth - 1)) < 1e-12, 'double speed turns twice as far');
  assert.ok(Math.abs((inverted.state.elevation - 0.5) + (base.state.elevation - 0.5)) < 1e-12, 'inverted up/down tilts the other way');
  assert.ok(Math.abs(inverted.state.azimuth - base.state.azimuth) < 1e-12, 'inverting leaves left/right alone');
  const keys = createCameraRig(); keys.state.invertY = true; keys.state.orbitSpeed = 0.5;
  const el0 = keys.state.elevation; keys.orbitKey('ArrowUp');
  assert.ok(Math.abs(keys.state.elevation - (el0 + 0.03)) < 1e-12, 'arrow keys follow speed and inversion');
  const views = createCameraRig();
  assert.deepEqual(views.setView(2), { changed: true, view: 'strategic', label: 'World view' });
  assert.equal(views.setView(2).changed, false, 'same view: no change');
  assert.equal(views.setView(7).changed, false, 'unknown index ignored');
  assert.equal(views.mode, 'strategic');

  const { normalizeCameraPrefs, normalizeMotionPref } = await import('../src/shared/preferences.js');
  assert.deepEqual({ ...normalizeCameraPrefs(null) }, { view: 0, orbitSpeed: 1, invertY: false }, 'defaults');
  assert.deepEqual({ ...normalizeCameraPrefs({ view: 1, orbitSpeed: 1.53, invertY: true }) }, { view: 1, orbitSpeed: 1.5, invertY: true }, 'valid values kept, speed rounded to its 0.1 step');
  assert.deepEqual({ ...normalizeCameraPrefs({ view: 9, orbitSpeed: 40, invertY: 'yes' }) }, { view: 0, orbitSpeed: 1, invertY: false }, 'junk falls back');
  assert.equal(normalizeMotionPref('reduce'), 'reduce');
  assert.equal(normalizeMotionPref('<img>'), 'auto');

  console.log('ALL CAMERA TRANSITION TESTS PASSED');
})().catch(error => { console.error('FAILED with error:', error); process.exitCode = 1; });
