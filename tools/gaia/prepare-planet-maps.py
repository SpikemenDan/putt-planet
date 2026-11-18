"""
Prepares the owner's hand-painted planet maps for the globes (src/render/planet-maps.js). Offline, run by hand when a painting changes:

    python tools/gaia/prepare-planet-maps.py "<folder with gaia.webp, ares.webp, luna.webp>"

Needs Python 3 with Pillow, NumPy and SciPy, and Node (to read src/shared/gaia-reference.js). Writes src/render/textures/*.webp.

- Every map: the left and right edges are made to meet (the paintings are not quite seamless), so the globe shows no seam line.
- Gaia: the painting follows the Azgaar reference coast only roughly (its continents are stretched sideways and the seam ocean is
  narrower). Gameplay regions, course sites, cities, ships and plants all sit on the reference coast, so the painting is warped onto it:
  a smooth, west-east periodic B-spline displacement is fitted so the painted land matches the reference land (about 95% overlap), and
  the poles are pinned. The result is a 2:1 equirectangular map in reference coordinates (x longitude, y latitude, row 0 at the north),
  the same layout as the flat master map, so the globe shader samples it exactly as it samples that painting.
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, optimize

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'src' / 'render' / 'textures'
GAIA_SIZE = (2048, 1024)
QUALITY = 88
GRID = (32, 16)  # displacement control points west-east, north-south


def seamless(img, band=48):
    """Spreads the jump between the last and first column over `band` columns on each side (colour only; the painting stays put)."""
    a = img.astype(float)
    jump = ndimage.gaussian_filter1d(a[:, 0] - a[:, -1], 6, axis=0)  # (rows, 3)
    ramp = np.clip(1 - np.arange(band) / band, 0, 1)[None, :, None]
    a[:, :band] -= jump[:, None, :] * ramp / 2
    a[:, -band:] += jump[:, None, :] * ramp[:, ::-1] / 2
    return a


def reference_land():
    script = "import('./src/shared/gaia-reference.js').then(m => process.stdout.write(JSON.stringify({ LAND: m.LAND, LAKES: m.LAKES, W: m.MAP_WIDTH, H: m.MAP_HEIGHT })))"
    data = json.loads(subprocess.run(['node', '-e', script], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    im = Image.new('L', (data['W'], data['H']), 0)
    draw = ImageDraw.Draw(im)
    for ring in data['LAND']:
        draw.polygon([(ring[i] / 10, ring[i + 1] / 10) for i in range(0, len(ring), 2)], fill=255)
    for ring in data['LAKES']:  # lakes are water in the painting too, so they pull its lakes into place
        draw.polygon([(ring[i] / 10, ring[i + 1] / 10) for i in range(0, len(ring), 2)], fill=0)
    return np.asarray(im) > 127


def bspline(t):
    t = np.abs(t)
    return np.where(t < 1, 2 / 3 - t * t + t ** 3 / 2, np.where(t < 2, (2 - t) ** 3 / 6, 0))


def basis(coords, n, periodic):
    A = np.zeros((len(coords), n))
    s = coords * (n if periodic else n - 1)
    for k in range(-2, n + 2):
        A[:, k % n if periodic else min(max(k, 0), n - 1)] += bspline(s - k)
    return A


def fit_gaia_warp(painted):
    """Control points of the displacement from reference (u, v) to painting (u, v), fitted coarse to fine on blurred land masks."""
    ref = reference_land()
    land = ~((painted[..., 2] > painted[..., 0] + 60) & (painted[..., 2] > painted[..., 1] + 20))  # not deep-blue sea
    land[:60] = False; land[-90:] = False  # the painted polar ice is not land
    H, W = ref.shape
    Hp, Wp = land.shape
    step = 2
    xs, ys = (np.arange(0, W, step) + .5) / W, (np.arange(0, H, step) + .5) / H
    gx, gy = GRID
    Ax, Ay = basis(xs, gx, True), basis(ys, gy, False)
    U, V = np.meshgrid(xs, ys)
    p = np.zeros(2 * gx * gy)
    p[gx * gy:] = np.repeat(0.045 * (np.arange(gy) / (gy - 1) - .5) - .012, gx)  # start from the rough vertical fit
    for sigma, lam in [(12, 0.1), (6, 0.06), (3, 0.04), (1.5, 0.03)]:
        R = ndimage.gaussian_filter(ref.astype(float), sigma)[::step, ::step]
        P = ndimage.gaussian_filter(land.astype(float), sigma * Wp / W, mode='wrap')
        dPy, dPx = np.gradient(P)

        def loss(q):
            Gx, Gy = q[:gx * gy].reshape(gy, gx), q[gx * gy:].reshape(gy, gx)
            px = ((U + Ay @ Gx @ Ax.T) * Wp - .5) % Wp
            py = np.clip((V + Ay @ Gy @ Ax.T) * Hp - .5, 0, Hp - 1)
            sample = lambda img: ndimage.map_coordinates(img, [py, px], order=1, mode='grid-wrap')
            e = sample(P) - R
            g = 2 * e / e.size
            grads, total = [Ay.T @ (g * sample(dPx) * Wp) @ Ax, Ay.T @ (g * sample(dPy) * Hp) @ Ax], (e * e).mean()
            for i, G in enumerate((Gx, Gy)):  # smoothness: neighbouring control points stay close
                d1, d2 = np.roll(G, -1, 1) - G, np.diff(G, axis=0)
                total += lam * ((d1 ** 2).sum() + (d2 ** 2).sum())
                grads[i] = grads[i] + lam * 2 * (np.roll(d1, 1, 1) - d1)
                grads[i][:-1] -= lam * 2 * d2
                grads[i][1:] += lam * 2 * d2
            return total, np.concatenate([grads[0].ravel(), grads[1].ravel()])

        p = optimize.minimize(loss, p, jac=True, method='L-BFGS-B', options={'maxiter': 500}).x
    Gx, Gy = p[:gx * gy].reshape(gy, gx), p[gx * gy:].reshape(gy, gx)
    fx, fy = U + Ay @ Gx @ Ax.T, V + Ay @ Gy @ Ax.T
    warped = ndimage.map_coordinates(land.astype(float), [np.clip(fy * Hp - .5, 0, Hp - 1), (fx * Wp - .5) % Wp], order=1, mode='grid-wrap') > .5
    r = ref[::step, ::step]
    print('land overlap (IoU) %.3f, smallest west-east stretch %.2f, largest %.2f' % ((warped & r).sum() / (warped | r).sum(), (np.diff(fx, axis=1) * W / step).min(), (np.diff(fx, axis=1) * W / step).max()))
    return p


def warp_gaia(img):
    p = fit_gaia_warp(img)
    gx, gy = GRID
    OW, OH = GAIA_SIZE
    xs, ys = (np.arange(OW) + .5) / OW, (np.arange(OH) + .5) / OH
    Ax, Ay = basis(xs, gx, True), basis(ys, gy, False)
    U, V = np.meshgrid(xs, ys)
    DX = Ay @ p[:gx * gy].reshape(gy, gx) @ Ax.T
    smooth = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - a) / (b - a), 0, 1))
    DY = Ay @ p[gx * gy:].reshape(gy, gx) @ Ax.T * smooth(0, .07, V) * smooth(1, .9, V)  # the poles stay at the poles
    Hp, Wp = img.shape[:2]
    px, py = ((U + DX) * Wp - .5) % Wp, np.clip((V + DY) * Hp - .5, 0, Hp - 1)
    return np.stack([ndimage.map_coordinates(img[..., c], [py, px], order=3, mode='grid-wrap') for c in range(3)], -1)


def save(a, name):
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8)).save(OUT / name, 'WEBP', quality=QUALITY, method=6)
    print('wrote', OUT / name)


def main(folder):
    src = Path(folder)
    load = lambda name: np.asarray(Image.open(src / name).convert('RGB'))
    gaia = load('gaia.webp').astype(float)
    # Lone light specks in the open sea at the painting's very edge would be stretched into dashes by the warp: paint them as sea.
    sea = ndimage.median_filter(gaia, size=(15, 15, 1))
    edge = np.zeros(gaia.shape[:2], bool); edge[60:-90, :10] = True; edge[60:-90, -10:] = True
    gaia[edge & (gaia[..., 0] > 60)] = sea[edge & (gaia[..., 0] > 60)]
    save(warp_gaia(seamless(gaia)), 'gaia.webp')
    for name in ('ares.webp', 'luna.webp'):
        save(seamless(load(name)), name)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT.parent / 'map' / 'planet-textures'))
