/**
 * A real Code 39 barcode (owner, 2026-11-17): the bars on the lobby pass spell the party code (or, on a Solo pass, the flight), so a
 * barcode scanner reads the code back. Code 39 covers 0-9, A-Z, space, '-' and '.'; letters are upper-cased and anything else is
 * dropped. Each character is nine elements (bar, space, bar, …), three of them wide, framed by the '*' start and stop character.
 */
const PATTERNS = Object.freeze({
  0: '000110100', 1: '100100001', 2: '001100001', 3: '101100000', 4: '000110001', 5: '100110000', 6: '001110000', 7: '000100101', 8: '100100100', 9: '001100100',
  A: '100001001', B: '001001001', C: '101001000', D: '000011001', E: '100011000', F: '001011000', G: '000001101', H: '100001100', I: '001001100', J: '000011100',
  K: '100000011', L: '001000011', M: '101000010', N: '000010011', O: '100010010', P: '001010010', Q: '000000111', R: '100000110', S: '001000110', T: '000010110',
  U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000', Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
});
const WIDE = 2.5;

/** The bars of `text` in Code 39, as [x, width] in narrow-bar units, and the total width. Pure, for tests. */
export function code39(text) {
  const chars = ['*', ...String(text).toUpperCase().split('').filter(c => c !== '*' && Object.hasOwn(PATTERNS, c)), '*'];
  const bars = [];
  let x = 0;
  chars.forEach((c, i) => {
    [...PATTERNS[c]].forEach((bit, k) => {
      const w = bit === '1' ? WIDE : 1;
      if (k % 2 === 0) bars.push([x, w]);
      x += w;
    });
    if (i < chars.length - 1) x += 1; // the narrow gap between characters
  });
  return { bars, width: x, text: chars.slice(1, -1).join('') };
}
