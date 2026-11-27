// DX2 development gameplay tuning: startup overrides in tuning.js, the staged gameplay tuner, the boot reader,
// and the editable panel section. The party-room refusal is covered in tests/app.test.cjs.
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), data };
}
function fakeLocation(href) {
  const loc = { href, assigned: [], assign(url) { loc.assigned.push(url); } };
  return loc;
}

async function run() {
  const { DEFAULT_TUNING, TUNING, TUNING_STARTUP, TUNING_OVERRIDES_GLOBAL } = await import('../src/shared/tuning.js');
  const boot = await import('../src/devtools/tuning-boot.js');
  const { createGameplayTuner } = await import('../src/devtools/gameplay-tuner.js');
  const { mountTuningPanel } = await import('../src/devtools/panel.js');
  const { createDisplayTuner } = await import('../src/devtools/display-tuner.js');

  // Normal loads: no global, shipped values, not overridden. The boot module does nothing outside a dev browser.
  assert.equal(TUNING_STARTUP.overridden, false);
  assert.equal(TUNING_STARTUP.problem, null);
  assert.equal(TUNING.gravity, DEFAULT_TUNING.gravity);
  assert.equal(globalThis[TUNING_OVERRIDES_GLOBAL], undefined);

  // Startup overrides: a fresh module instance built while the global is set uses them; invalid ones fall back whole.
  globalThis[TUNING_OVERRIDES_GLOBAL] = { gravity: DEFAULT_TUNING.gravity * 2, cup: { minRadius: 3 } };
  const over = await import('../src/shared/tuning.js?dx2-valid');
  assert.equal(over.TUNING.gravity, DEFAULT_TUNING.gravity * 2);
  assert.equal(over.TUNING.cup.minRadius, 3);
  assert.equal(over.TUNING.shotPower, DEFAULT_TUNING.shotPower, 'unlisted fields keep shipped values');
  assert.deepEqual(over.TUNING_STARTUP, { overridden: true, problem: null });
  assert.ok(Object.isFrozen(over.TUNING));
  globalThis[TUNING_OVERRIDES_GLOBAL] = { gravity: -5, cup: { minRadius: 99 } };
  const bad = await import('../src/shared/tuning.js?dx2-invalid');
  assert.equal(bad.TUNING.gravity, DEFAULT_TUNING.gravity, 'invalid overrides are ignored as a whole');
  assert.equal(bad.TUNING.cup.minRadius, DEFAULT_TUNING.cup.minRadius);
  assert.equal(bad.TUNING_STARTUP.overridden, false);
  assert.match(bad.TUNING_STARTUP.problem, /gravity/);
  // Unknown or misshapen fields (for example from a build where a field was later removed) also refuse the whole set,
  // instead of the valid part applying while the rest is dropped.
  globalThis[TUNING_OVERRIDES_GLOBAL] = { gravity: DEFAULT_TUNING.gravity * 2, surfaceDragMultiplier: { sand: 2 }, cup: 5 };
  const unknown = await import('../src/shared/tuning.js?dx2-unknown');
  assert.equal(unknown.TUNING.gravity, DEFAULT_TUNING.gravity, 'the valid gravity is not applied on its own');
  assert.equal(unknown.TUNING_STARTUP.overridden, false);
  assert.match(unknown.TUNING_STARTUP.problem, /unknown field\(s\) surfaceDragMultiplier\.sand, cup$/);
  delete globalThis[TUNING_OVERRIDES_GLOBAL];

  // Boot reader: only a versioned object is accepted, and it never throws.
  const stored = JSON.stringify({ version: 1, tuning: { gravity: 1234 } });
  assert.deepEqual(boot.readStoredOverrides(memoryStorage({ [boot.GAMEPLAY_OVERRIDES_STORAGE_KEY]: stored })), { gravity: 1234 });
  assert.equal(boot.readStoredOverrides(memoryStorage({ [boot.GAMEPLAY_OVERRIDES_STORAGE_KEY]: '{bad' })), null);
  assert.equal(boot.readStoredOverrides(memoryStorage({ [boot.GAMEPLAY_OVERRIDES_STORAGE_KEY]: JSON.stringify({ version: 2, tuning: {} }) })), null);
  assert.equal(boot.readStoredOverrides(memoryStorage({ [boot.GAMEPLAY_OVERRIDES_STORAGE_KEY]: JSON.stringify({ version: 1, tuning: [1] }) })), null);
  assert.equal(boot.readStoredOverrides({ getItem() { throw new Error('blocked'); } }), null);
  assert.equal(boot.readStoredOverrides(null), null);

  // Tuner on a normal page: stored values are ignored (they did not apply without ?tune), so it starts from what runs.
  const storage = memoryStorage({ [boot.GAMEPLAY_OVERRIDES_STORAGE_KEY]: stored });
  const location = fakeLocation('http://localhost:5173/?map=ares');
  const tuner = createGameplayTuner({ storage, location });
  assert.equal(tuner.active, false);
  assert.deepEqual(tuner.overrides, {});
  assert.deepEqual(tuner.pending, []);

  // Staging: valid edits are staged, not running; invalid ones (range, cross-field, unknown) change nothing.
  let notified = 0;
  tuner.onChange(() => { notified++; });
  tuner.set('gravity', 900);
  assert.equal(tuner.get('gravity'), 900);
  assert.equal(tuner.current('gravity'), DEFAULT_TUNING.gravity, 'the running value is unchanged until reload');
  assert.deepEqual(tuner.pending, ['gravity']);
  assert.equal(TUNING.gravity, DEFAULT_TUNING.gravity);
  assert.throws(() => tuner.set('gravity', -1), /gravity must be within/);
  assert.throws(() => tuner.set('cup.minRadius', DEFAULT_TUNING.cup.defaultRadius + 1), /must not exceed/);
  assert.throws(() => tuner.set('gravty', 5), /unknown field/);
  assert.throws(() => tuner.set('gravity', NaN), /must be within/);
  assert.deepEqual(tuner.overrides, { gravity: 900 });
  assert.equal(notified, 1);
  tuner.set('gravity', DEFAULT_TUNING.gravity);
  assert.deepEqual(tuner.overrides, {}, 'staging the shipped value clears the override');
  tuner.set('gravity', 900);
  tuner.set('shotPower', DEFAULT_TUNING.shotPower + 10);
  tuner.reset('shotPower');
  assert.deepEqual(tuner.overrides, { gravity: 900 });

  // Export and import: round trip; invalid imports (JSON, shape, unknown field, range) change nothing.
  const exported = tuner.exportJson();
  assert.deepEqual(JSON.parse(exported), { version: 1, tuning: { gravity: 900 } });
  tuner.reset();
  tuner.importJson(exported);
  assert.deepEqual(tuner.overrides, { gravity: 900 });
  assert.throws(() => tuner.importJson('{nope'), /not valid JSON/);
  assert.throws(() => tuner.importJson('{"tuning":{}}'), /version/);
  assert.throws(() => tuner.importJson('{"version":1,"tuning":{"gravty":5}}'), /unknown field gravty/);
  assert.throws(() => tuner.importJson('{"version":1,"tuning":{"gravity":-5}}'), /gravity/);
  assert.deepEqual(tuner.overrides, { gravity: 900 });

  // Apply and reload: stores the overrides for this tab and reloads with ?tune, keeping the other parameters.
  tuner.applyAndReload();
  assert.deepEqual(boot.readStoredOverrides(storage), { gravity: 900 });
  const reloaded = new URL(location.assigned.at(-1));
  assert.ok(reloaded.searchParams.has('tune'));
  assert.equal(reloaded.searchParams.get('map'), 'ares');
  // With nothing staged it clears them and drops ?tune, back to shipped values.
  const tunedLocation = fakeLocation('http://localhost:5173/?tune=&map=ares');
  const running = { ...DEFAULT_TUNING, gravity: 900 };
  const activeTuner = createGameplayTuner({ storage, location: tunedLocation, running, startup: { overridden: true, problem: null } });
  assert.equal(activeTuner.active, true);
  assert.deepEqual(activeTuner.overrides, { gravity: 900 }, 'an active page edits from the stored overrides');
  assert.deepEqual(activeTuner.pending, []);
  activeTuner.reset();
  assert.deepEqual(activeTuner.pending, ['gravity']);
  activeTuner.applyAndReload();
  assert.equal(storage.getItem(boot.GAMEPLAY_OVERRIDES_STORAGE_KEY), null);
  assert.equal(new URL(tunedLocation.assigned.at(-1)).searchParams.has('tune'), false);
  assert.throws(() => createGameplayTuner().applyAndReload(), /not available/);
  const blocked = createGameplayTuner({ storage: { getItem: () => null, setItem() { throw new Error('quota'); } }, location: fakeLocation('http://x/') });
  blocked.set('gravity', 900);
  assert.throws(() => blocked.applyAndReload(), /storage is blocked/);

  // Panel: an editable, grouped section replaces the read-only list; staging shows what still runs; the badge shows activity.
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
  const doc = dom.window.document;
  const panelTuner = createGameplayTuner({ storage: memoryStorage(), location: fakeLocation('http://localhost/'), running: { ...DEFAULT_TUNING, gravity: 900 }, startup: { overridden: true, problem: null } });
  const panel = mountTuningPanel(doc, createDisplayTuner(), { gameplay: panelTuner });
  const section = doc.querySelector('.pp-tune-gameplay');
  assert.ok(section, 'the editable section is present');
  assert.equal(doc.querySelectorAll('.pp-tune-ro').length, 0, 'no read-only list alongside it');
  assert.equal(section.querySelectorAll('input[type=range]').length, 110);
  assert.ok([...section.querySelectorAll('.pp-tune-group > summary')].some(s => s.textContent === 'surface'), 'grouped by domain');
  assert.equal([...doc.querySelectorAll('.pp-tune-badge')].find(b => /TEMP PHYSICS/.test(b.textContent)).hidden, false);
  assert.match(section.textContent, /Party rooms are refused/);
  const gravityRow = [...section.querySelectorAll('.pp-tune-row')].find(r => r.title === 'gravity');
  assert.match(gravityRow.textContent, /range 0–5000 · shipped/);
  assert.match(gravityRow.textContent, new RegExp(`running 900 until Apply and reload`), 'the stage starts at shipped values, so the running 900 is flagged');
  const number = gravityRow.querySelector('input[type=number]');
  number.value = '700';
  number.dispatchEvent(new dom.window.Event('change'));
  assert.equal(panelTuner.get('gravity'), 700);
  assert.match(section.querySelector('.pp-tune-pending').textContent, /1 staged change\(s\) not running yet: gravity/);
  number.value = '-3';
  number.dispatchEvent(new dom.window.Event('change'));
  assert.equal(panelTuner.get('gravity'), 700, 'an invalid entry changes nothing');
  assert.match(section.querySelector('.pp-tune-status').textContent, /gravity must be within/);
  assert.equal(number.value, '700', 'the field shows the staged value again');
  number.value = '';
  number.dispatchEvent(new dom.window.Event('change'));
  assert.equal(panelTuner.get('gravity'), 700, 'an emptied box is refused, not read as 0');
  assert.match(section.querySelector('.pp-tune-status').textContent, /gravity needs a number/);
  assert.equal(number.value, '700');
  panel.dispose();
  // Without a gameplay tuner the read-only list stays and nothing is editable.
  const readOnly = mountTuningPanel(doc, createDisplayTuner(), { tuning: { fields: panelTuner.fields, values: TUNING, defaults: DEFAULT_TUNING } });
  assert.ok(doc.querySelector('.pp-tune-ro'));
  assert.equal(doc.querySelectorAll('.pp-tune-ro input').length, 0);
  assert.equal(doc.querySelector('.pp-tune-gameplay'), null);
  readOnly.dispose();
  // A refused startup is reported in the panel.
  const refused = mountTuningPanel(doc, createDisplayTuner(), { gameplay: createGameplayTuner({ startup: { overridden: false, problem: 'Invalid tuning: gravity must be within [0, 5000], got -5' } }) });
  assert.match(doc.querySelector('.pp-tune-gameplay').textContent, /Stored overrides were refused: Invalid tuning: gravity/);
  refused.dispose();
  dom.window.close();

  console.log('ALL DX2 GAMEPLAY TUNING TESTS PASSED');
}

run().catch(error => { console.error('FAILED with error:', error); process.exitCode = 1; });
