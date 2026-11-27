const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'release', 'putt-planet');
const htmlPath = path.join(outDir, 'index.html');

// Builds made before the Putt Planet rename (VIS-R) went to release/putt-pals; remove them so a stale copy is not shared.
for (const legacy of ['putt-pals', 'putt-pals.zip']) fs.rmSync(path.join(root, 'release', legacy), { recursive: true, force: true });

// Browsers block module scripts and CORS-mode loads from file://, so use a classic deferred script.
let html = fs.readFileSync(htmlPath, 'utf8');
html = html
  .replace(/<script\s+type="module"\s+crossorigin\s+src=/g, '<script defer src=')
  .replace(/<script\s+type="module"\s+src=/g, '<script defer src=')
  .replace(/(<link\b[^>]*?)\s+crossorigin(?:="[^"]*")?/g, '$1');
fs.writeFileSync(htmlPath, html);

assert.ok(!/type="module"/.test(html), 'module script remains in portable index.html');
assert.ok(!/crossorigin/.test(html), 'crossorigin attribute remains in portable index.html');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
assert.ok(refs.length > 0, 'portable index.html references its assets');
for (const ref of refs) {
  assert.ok(!ref.startsWith('/'), `absolute asset path: ${ref}`);
  assert.ok(fs.existsSync(path.join(outDir, ref)), `missing asset: ${ref}`);
}

fs.writeFileSync(path.join(outDir, 'HOW TO PLAY.txt'), [
  'Putt Planet',
  '',
  '1. Unzip this folder (do not run it from inside the zip).',
  '2. Double-click index.html. Use Chrome or Edge on a desktop.',
  '3. Solo play works offline. Rooms need an internet connection:',
  '   one player creates a room and shares the room code with friends.',
  '',
].join('\r\n'));

const zip = path.join(root, 'release', 'putt-planet.zip');
if (process.platform === 'win32') {
  fs.rmSync(zip, { force: true });
  // Paths travel as environment variables into .NET's ZipFile, so quotes or brackets in the checkout path stay literal
  // (Compress-Archive treats brackets in its destination as wildcards). The zip holds the putt-planet folder itself.
  const result = spawnSync('powershell', ['-NoProfile', '-Command',
    "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:PORTABLE_SOURCE, $env:PORTABLE_ZIP, 'Optimal', $true)"],
    { stdio: 'inherit', env: { ...process.env, PORTABLE_SOURCE: outDir, PORTABLE_ZIP: zip } });
  assert.equal(result.status, 0, 'zip creation failed');
  console.log(`PORTABLE_OK: ${zip}`);
} else {
  console.log(`PORTABLE_OK: ${outDir} (zip it yourself; Compress-Archive is Windows-only)`);
}
