/**
 * The owner's hand-painted surface maps of Gaia, Ares and Luna (2:1 equirectangular, row 0 at the north). They are prepared offline by
 * tools/gaia/prepare-planet-maps.py: every map is made seamless west to east, and Gaia's painting is warped onto the Azgaar reference
 * coast, so it lines up with the regions, course sites, cities, ships and plants that are placed from that reference.
 *
 * Vite fingerprints the files into /assets. Loading is lazy and never blocks: until a map arrives (or where it cannot load, e.g. a page
 * opened from file://, whose images would taint WebGL) the procedural surfaces show. `loading.paintedMaps` (src/shared/display.js)
 * switches between the two.
 */

export const PLANET_MAP_URLS = Object.freeze({
  gaia: new URL('./textures/gaia.webp', import.meta.url).href,
  ares: new URL('./textures/ares.webp', import.meta.url).href,
  luna: new URL('./textures/luna.webp', import.meta.url).href,
});

/**
 * Loads one map as a Three.js texture. `flipY` false keeps row 0 at uv.y 0 (Gaia's shader flips v itself, as for the flat master map);
 * true is the usual image layout for a material `map` on a SphereGeometry. `srgb` marks it sRGB for built-in (toon) materials; the
 * Gaia shader writes display values directly, so it reads the raw bytes. Resolves null when the image cannot be loaded here.
 */
export function loadPlanetMap({ THREE, doc, name, flipY = true, srgb = false, anisotropy = 1 }) {
  const win = doc?.defaultView;
  if (!doc || !PLANET_MAP_URLS[name] || win?.location?.protocol === 'file:') return Promise.resolve(null);
  return new Promise(resolve => {
    const img = doc.createElement('img');
    img.decoding = 'async';
    img.onload = () => {
      const texture = new THREE.Texture(img);
      Object.assign(texture, { flipY, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true, anisotropy, needsUpdate: true });
      if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
      resolve(texture);
    };
    img.onerror = () => resolve(null);
    img.src = PLANET_MAP_URLS[name];
  });
}
