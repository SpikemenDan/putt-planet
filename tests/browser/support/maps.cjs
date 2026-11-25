// Choosing a course in the map select. With WebGL the picker is the 3D atlas (src/ui/WorldSelect.jsx): each region button
// lists its maps' card indexes in data-maps, and a course button (data-map) shows once that region is open and the camera
// has settled. Without WebGL it is the plain card list. Both are handled here, so specs say which map they want, not how
// the picker lays it out.
const { expect } = require('@playwright/test');

const ATLAS = '[data-ui=world-select]';

/** Waits for either picker and says which one is up. */
async function inAtlas(page) {
  const either = page.locator(`${ATLAS} button[data-region], [data-ui=map-select] button[data-v]`).locator('visible=true').first();
  await expect(either, 'a map picker is shown').toBeVisible({ timeout: 60_000 });
  return (await page.locator(ATLAS).count()) > 0;
}

/** The course indexes the atlas offers, in card order. data-maps holds course indexes, which skip numbers when a
 *  mode offers only some courses (Practice lists the starters), so a card position is not a course index.
 *  Read with getAttribute, not evaluateAll: evaluating in the page's main world installs Playwright's injected script,
 *  whose event listeners the lifecycle spec's leak probe would count. */
async function atlasCourses(page) {
  const lists = await Promise.all((await page.locator(`${ATLAS} button[data-region]`).all()).map(button => button.getAttribute('data-maps')));
  return lists.flatMap(list => (list ? list.split(' ').map(Number) : [])).sort((a, b) => a - b);
}

/** Votes for map `index` (its card order, as the plain list shows it). */
async function pickMap(page, index = 0) {
  if (!(await inAtlas(page))) {
    await page.locator('[data-ui=map-select] button[data-v]').nth(index).click();
    return;
  }
  const course = (await atlasCourses(page))[index];
  expect(course, `the atlas offers a map at card ${index}`).toBeDefined();
  const world = page.locator(ATLAS);
  await world.locator(`button[data-region][data-maps~="${course}"]`).click();
  await world.locator(`button[data-map="${course}"]`).click({ timeout: 60_000 }); // shown once the camera settles on the region
}

/** How many maps the picker offers. */
async function mapCount(page) {
  if (!(await inAtlas(page))) return page.locator('[data-ui=map-select] button[data-v]').count();
  return (await atlasCourses(page)).length;
}

module.exports = { pickMap, mapCount };
