// Putt Pong (1v1) integration in a real browser: mode selection, 3D cup racks, HUD tracker, and match flow.
const { test, expect } = require('@playwright/test');
const { openApp, until, partyCode } = require('./support/app.cjs');
const { pickMap } = require('./support/maps.cjs');

// Putt Pong left Solo (owner, 2026-11-19): it is a 1v1 party mode only, so it is covered by the two-player test below.

test('putt pong 2-player lobby: Putt Pong is offered with exactly two players; controller selects it, both clients see mode', async ({ browser }, testInfo) => {
  const code = 'PP' + Date.now().toString(36).slice(-4).toUpperCase();
  const context1 = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 800, height: 600 } });
  const context2 = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 800, height: 600 } });

  try {
    const ana = await openApp(await context1.newPage(), 'Ana');
    const ben = await openApp(await context2.newPage(), 'Ben');

    await ana.join(code);
    // Owner, 2026-11-11: a party offers Putt Pong only with exactly two players.
    await expect(ana.ui('room-lobby').locator('[data-ui=mode-picker] [data-mode=pong]')).toHaveCount(0);
    await ben.join(code);
    await expect(ana.ui('room-lobby').locator('[data-ui=mode-picker] [data-mode=pong]')).toHaveCount(1);

    await expect(ana.ui('room-lobby').locator('p').first()).toHaveText(`Room ${partyCode(code)} · 2 players · You control the room`, { timeout: 30_000 });
    await expect(ben.ui('room-lobby').locator('p').first()).toHaveText(`Room ${partyCode(code)} · 2 players · Waiting for room controller`);

    // Host selects Putt Pong
    await ana.ui('room-lobby').locator('[data-ui=mode-picker] [data-mode=pong]').click();
    await expect(ana.ui('room-lobby').locator('[data-ui=mode-picker] [data-mode=pong]')).toHaveAttribute('data-leading', 'true'); // the vote reaches the room

    // Host starts voting
    await ana.button('Start Game').click();
    await expect(ana.ui('map-select')).toBeVisible();
    await expect(ben.ui('map-select')).toBeVisible();

    expect(ana.errors, 'Ana: no errors').toEqual([]);
    expect(ben.errors, 'Ben: no errors').toEqual([]);
  } finally {
    await context1.close();
    await context2.close();
  }
});
