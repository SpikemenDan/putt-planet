/**
 * The sky behind the main menu and the loading screen (VIS-M1): the view from high in Gaia's atmosphere, with the planet's curved horizon, banks of cumulus sailing
 * round the globe, and a living world below: biomes from polar ice to jungle, mountains and volcanoes, cities, towns, villages, ports,
 * lighthouses, forests, mills, ships, airliners, balloons and satellites. Beyond it, a night sky of stars, clusters and two faint galaxies, a rare shooting star, Luna at its true distance and Ares
 * far away, each with polar ice, signs of life and one tiny base.
 *
 * One Three.js scene, one sun, the game's own toon material and ink hulls (materials.js, outline.js), so everything shares the look of
 * the courses. The camera never moves: the planet turns under it and the clouds circle with it, west to east, so nothing flies at the
 * lens. Reads the live `display.loading` settings each frame (src/shared/display.js). With `reducedMotion` it draws one still frame.
 * Presentation only: no simulation, no React. `THREE`, randomness and the WebGL renderer are injected.
 */

import { createMaterialLibrary } from './materials.js';
import { createInkMaterial, sizeInk, smoothHullGeometry } from './outline.js';
import { ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX, CLOUD_FRAGMENT, CLOUD_SHELL_FRAGMENT, CLOUD_VERTEX, CONTRAIL_FRAGMENT, GALAXY_FRAGMENT, GALAXY_VERTEX, PLANET_FRAGMENT, SPHERE_VERTEX, STAR_FRAGMENT, STAR_VERTEX, STREAK_FRAGMENT, STREAK_VERTEX, TRAIL_VERTEX, WAKE_FRAGMENT, WORLD_FRAGMENT } from './planet-shaders.js';
import { worldMap } from './map-paint.js';
import { MAX_BOATS, MAX_PLANES, MAX_SATELLITES, TEX_W, TEX_H, gaiaPlanet, laneRoutes, shipRoutes, surfaceDir } from './planet-data.js';
import { MODEL_REACH, PLANE_KINDS, PLANT_KINDS, SHIP_KINDS, makeBalloon, makeBase, makeCity, makeMoonlet, makeObservatory, makeRadioDish, makeSpaceport, makeCumulus, makeFlag, makeLighthouse, makeMill, makePeak, makePlane, makePlant, makePort, makeSatellite, makeShip, makeTown, makeVillage, makeVolcano } from './sky-models.js';
import { buildAresTexture, buildLunaTexture, WORLD_TEX_H, WORLD_TEX_W } from './worlds.js';
import { loadPlanetMap } from './planet-maps.js';

export const PLANET_RADIUS = 100;
/** Real distances and sizes in Earth radii, at this planet's radius: the Moon is 60 away and 0.27 across. */
export const LUNA_DISTANCE = 60 * PLANET_RADIUS, LUNA_RADIUS = 0.27 * PLANET_RADIUS;
const ARES_DISTANCE = 24000, ARES_SHARE = 0.0042; // Ares shows as a small far disc: its radius as a share of the screen height
const FOV = 32, SUN = [-0.55, 0.62, 0.56], AXIS_LEAN = 30 * Math.PI / 180;
const CLOUDS = 210;
/**
 * The size audit: one scale per kind of object, so the world keeps a sensible order from trees up to mountains (docs/GAIA_MAP.md has the
 * resulting sizes, tests/ui.test.cjs checks the order). Buildings also follow `loading.citySize`. `cityHeight` is the height of a
 * middle-ranked city in units whatever its building style, so every skyline stays below the mountains (`peakBase` to `peakBase + peakRise`).
 */
export const SIZES = Object.freeze({ cityHeight: 4.6, town: 0.4, village: 0.56, port: 0.5, lighthouse: 0.4, mill: 0.55, flag: 0.5, volcano: [9, 7, 8, 6.5], plant: 0.5, peakBase: 5.5, peakRise: 10, plane: 0.72, balloon: 0.62, satellite: 0.62, ship: { cargo: 0.6, ferry: 0.58, tanker: 0.64, trawler: 0.5, yacht: 0.46 } });
const SHOOTING_GAP = [35, 110]; // seconds between shooting stars

const count = (value, max) => Math.max(0, Math.min(max, Math.round(value)));
const defaultRenderer = (THREE, canvas) => new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });

/**
 * Where the camera sits so the planet's limb crosses the screen at `horizonHeight` (fraction of the height from the top) and the disc
 * is as wide as the screen. Returns the camera's height and distance from the planet, in the planet's units.
 */
export function frameCamera(width, height, horizonHeight, radius = PLANET_RADIUS, altitude = null) {
  const t = Math.tan(FOV * Math.PI / 360), tanA = Math.max(width / height, 1.2) * t, dist = altitude === null ? radius / Math.sin(Math.atan(tanA)) : radius * (1 + altitude);
  const theta = Math.asin(radius / dist) - Math.atan((1 - 2 * horizonHeight) * t);
  return { y: dist * Math.sin(theta), z: dist * Math.cos(theta) };
}

/**
 * Creates the scene on `canvas`. If WebGL is unavailable it stays inert and the CSS sky remains.
 * @param {object} options
 * @param {object} options.THREE
 * @param {HTMLCanvasElement} options.canvas
 * @param {{loading: object}} options.display live settings
 * @param {() => number} options.random seeded generator (same seed, same planet and traffic)
 * @param {object} [options.planet] planet data; defaults to the one Gaia (planet-data.js)
 * @param {boolean} [options.reducedMotion] draw one still frame
 * @param {'city'|'port'|'town'|'ship'|'plane'|'volcano'|'mountain'|'luna'|'ares'|null} [options.focus] preview gallery: look closely at one object
 * @param {Window} [options.win]
 * @param {Function} [options.createWebGLRenderer] renderer seam (tests)
 * @param {Function} [options.loadMap] painted-map loader seam (tests); resolves a texture or null (planet-maps.js)
 */
export function createPlanetScene({ THREE, canvas, display, random, planet: prebuilt = null, reducedMotion = false, focus = null, win = canvas.ownerDocument.defaultView, createWebGLRenderer = defaultRenderer, loadMap = loadPlanetMap }) {
  const doc = canvas.ownerDocument, settings = () => display.loading;
  let renderer = null;
  try { renderer = createWebGLRenderer(THREE, canvas); } catch { renderer = null; }
  if (!renderer) return { start() {}, step() {}, dispose() {} }; // no WebGL: nothing to draw or build; the CSS sky stays
  const planet = prebuilt ?? gaiaPlanet();
  renderer.setClearColor?.(0x000000, 0);
  const library = createMaterialLibrary({ THREE, createCanvas: () => doc.createElement('canvas'), random, maxAnisotropy: renderer?.capabilities?.getMaxAnisotropy?.() ?? 1 });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 1, 60000);
  const sun = new THREE.Vector3(...SUN).normalize();
  const owned = new Set(), own = r => { owned.add(r); return r; };
  scene.add(camera, new THREE.AmbientLight(0xffffff, 2.8));
  const light = new THREE.DirectionalLight(0xffffff, 5.4);
  light.position.copy(sun).multiplyScalar(1000);
  scene.add(light);

  // ---- Textures
  const data = (bytes, w, h, srgb = false) => {
    const texture = own(new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat));
    Object.assign(texture, { wrapS: THREE.RepeatWrapping, magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true, anisotropy: renderer?.capabilities?.getMaxAnisotropy?.() ?? 1, needsUpdate: true });
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  const rgba = rgb => { const out = new Uint8Array(rgb.length / 3 * 4); for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) { out[j] = rgb[i]; out[j + 1] = rgb[i + 1]; out[j + 2] = rgb[i + 2]; out[j + 3] = 255; } return out; };
  const grey = bytes => { const out = new Uint8Array(bytes.length * 4); for (let i = 0; i < bytes.length; i++) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = bytes[i]; out[i * 4 + 3] = 255; } return out; };
  const fieldTexture = data(planet.field, TEX_W, TEX_H), landTexture = data(planet.landRgb, TEX_W, TEX_H), cloudTexture = data(grey(planet.cloud), TEX_W, TEX_H);

  // ---- Planet: the axis stands up, leaning a little away from us, so the world turns west to east and the far land stays on the horizon.
  const tilt = new THREE.Group(), spinner = new THREE.Group(), cloudSpinner = new THREE.Group(), deck = new THREE.Group();
  tilt.add(spinner, cloudSpinner, deck);
  tilt.rotation.x = -AXIS_LEAN;
  scene.add(tilt);
  const shared = { sun: { value: sun }, time: { value: 0 }, dotCell: library.inkUniforms.dot, atmosphere: { value: 0.75 }, cloudGate: { value: 0.5 }, cloudShift: { value: 0 }, inkPx: { value: 1.2 } };
  const sphere = (radius, a, b) => own(new THREE.SphereGeometry(radius, a, b));
  const surface = own(new THREE.ShaderMaterial({ vertexShader: SPHERE_VERTEX, fragmentShader: PLANET_FRAGMENT, uniforms: { ...shared, field: { value: fieldTexture }, landMap: { value: landTexture }, paintMap: { value: null }, paintOn: { value: 0 }, mapTex: { value: null }, mapOn: { value: 0 }, cloudMap: { value: cloudTexture }, texel: { value: new THREE.Vector2(1.5 / TEX_W, 1.5 / TEX_H) } } }));
  spinner.add(new THREE.Mesh(sphere(PLANET_RADIUS, 192, 128), surface));
  // The land takes the flat map's painting (4096 wide, painted in a worker) as soon as it arrives; until then the 1024-wide colours show.
  if (!prebuilt) worldMap().then(bitmap => {
    if (!bitmap || disposed) return;
    const paint = own(new THREE.Texture(bitmap));
    Object.assign(paint, { flipY: false, anisotropy: renderer.capabilities?.getMaxAnisotropy?.() ?? 1, needsUpdate: true });
    surface.uniforms.paintMap.value = paint; surface.uniforms.paintOn.value = 1;
    stats.painted = true;
  });
  // The owner's painted maps (planet-maps.js) load lazily; `loading.paintedMaps` picks them over the procedural surfaces once they arrive.
  const paintedMaps = { gaia: null, ares: null, luna: null };
  const anisotropy = renderer.capabilities?.getMaxAnisotropy?.() ?? 1;
  for (const [name, options] of [['gaia', { flipY: false }], ['ares', { srgb: true }], ['luna', { srgb: true }]]) {
    loadMap({ THREE, doc, name, anisotropy, ...options }).then(texture => {
      if (!texture) return;
      if (disposed) { texture.dispose(); return; }
      paintedMaps[name] = own(texture);
      if (name === 'gaia') surface.uniforms.mapTex.value = texture;
      usePaintedMaps(paintedMapsOn);
      if (reducedMotion) draw(); // the still frame has no loop to pick the map up
    });
  }
  const shellMaterial = own(new THREE.ShaderMaterial({ vertexShader: SPHERE_VERTEX, fragmentShader: CLOUD_SHELL_FRAGMENT, transparent: true, depthWrite: false, uniforms: { ...shared, cloudMap: { value: cloudTexture } } }));
  const shell = new THREE.Mesh(sphere(PLANET_RADIUS + 1.1, 128, 96), shellMaterial);
  cloudSpinner.add(shell);
  // The air is a full-view sheet far behind the planet; its shader traces each view ray past the planet to find how much air it crosses.
  const air = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)), own(new THREE.ShaderMaterial({ vertexShader: ATMOSPHERE_VERTEX, fragmentShader: ATMOSPHERE_FRAGMENT, transparent: true, premultipliedAlpha: true, depthWrite: false, uniforms: { sun: shared.sun, atmosphere: shared.atmosphere, radius: { value: PLANET_RADIUS }, shell: { value: PLANET_RADIUS * 1.5 }, ahead: { value: 0 } } })));
  air.position.z = -30000;
  air.scale.setScalar(200000);
  air.frustumCulled = false;
  air.renderOrder = -1; // over the stars, under everything else: the planet and clouds hide it by depth
  camera.add(air);

  // Ink hulls: built once per shape, as every city, ship and cloud reuses a handful of geometries.
  const outlined = [], hulls = new Map();
  const inked = (mesh, material = library.ink.solid) => {
    if (!hulls.has(mesh.geometry)) hulls.set(mesh.geometry, own(smoothHullGeometry(THREE, mesh.geometry)));
    const hull = new THREE.Mesh(hulls.get(mesh.geometry), material);
    mesh.add(hull);
    outlined.push(hull);
    return mesh;
  };
  const yAxis = new THREE.Vector3(0, 1, 0);
  const standUp = (object, dir) => { object.quaternion.setFromUnitVectors(yAxis, new THREE.Vector3(...dir)); return object; };
  const painted = own(library.toon(0xffffff));
  painted.vertexColors = true;

  // ---- Settlements. A few shapes per kind, reused with a turn, so no two neighbours match.
  const pick = (list, k) => list[k % list.length];
  const settle = (site, geometry, unit, parent = spinner) => {
    const dir = surfaceDir(site.u, site.lat), mesh = inked(new THREE.Mesh(geometry, painted));
    mesh.position.set(...dir).multiplyScalar(PLANET_RADIUS);
    standUp(mesh, dir).rotateY(random() * Math.PI * 2);
    parent.add(mesh);
    return { mesh, dir, unit, top: geometry.userData.top ?? 0 };
  };
  const shapeCache = new Map();
  /** A shape from a small pool per key, so places of one kind and climate come in a few designs. */
  const variant = (key, designs, make) => {
    if (!shapeCache.has(key)) shapeCache.set(key, Array.from({ length: designs }, () => own(make())));
    return pick(shapeCache.get(key), Math.floor(random() * designs));
  };
  const cities = planet.cities.map(c => { const shape = variant('city:' + c.culture, 3, () => makeCity(THREE, random, c.tint, c.culture)); return settle(c, shape, SIZES.cityHeight * (c.tier ?? 1) / (shape.userData.top || 1)); });
  const towns = planet.towns.map(c => settle(c, variant('town:' + c.culture, 3, () => makeTown(THREE, random, c.culture)), SIZES.town));
  const villages = planet.villages.map(c => settle(c, variant('village:' + c.culture, 2, () => makeVillage(THREE, random, c.culture)), SIZES.village));
  const portShapes = [0, 1].map(k => own(makePort(THREE, k)));
  const ports = planet.ports.map((p, k) => {
    const place = settle(p, pick(portShapes, k), SIZES.port), up = new THREE.Vector3(...place.dir), out = new THREE.Vector3(...p.sea).sub(up);
    out.addScaledVector(up, -out.dot(up)).normalize(); // the pier points out to sea
    place.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(out, up, new THREE.Vector3().crossVectors(out, up)));
    return place;
  });
  // Lighthouses: one or two tall towers on bare headlands.
  const lighthouseShape = own(makeLighthouse(THREE));
  const lighthouses = planet.lighthouses.map(site => settle(site, lighthouseShape, SIZES.lighthouse));
  // Volcanoes on their basalt fields, each with a small plume.
  // A model's foot must fit its land: the size whose reach equals the distance to the sea, on the globe's surface (degrees to units).
  const fits = (site, reach) => site.room === undefined ? Infinity : site.room * 180 / TEX_H * Math.max(0.3, Math.cos(site.lat * Math.PI / 180)) * Math.PI / 180 * PLANET_RADIUS / reach;
  const volcanoes = planet.volcanoes.map((site, k) => settle(site, own(makeVolcano(THREE, random)), Math.min(pick(SIZES.volcano, k), fits(site, MODEL_REACH.volcano))));
  // A small flag on every map of the world map (src/shared/gaia-map.js).
  const flagShapes = [0xff2e88, 0xffd640].map(colour => own(makeFlag(THREE, colour)));
  const flags = planet.flags.map((site, k) => settle(site, pick(flagShapes, k), SIZES.flag));
  const places = [...cities, ...towns, ...villages, ...ports, ...lighthouses, ...flags];

  // ---- Plants and peaks: instanced, far too many for separate meshes, each with a little variety of size, turn and shade.
  const scatter = (geometry, list, size) => {
    const mesh = new THREE.InstancedMesh(geometry, painted, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), spinQ = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), d = new THREE.Vector3(), c = new THREE.Color();
    list.forEach((item, i) => {
      d.set(...surfaceDir(item.u, item.lat));
      const k = size(item), shade = (item.shade ?? 1) * (0.9 + random() * 0.2);
      q.setFromUnitVectors(yAxis, d).multiply(spinQ.setFromAxisAngle(yAxis, random() * Math.PI * 2));
      mesh.setMatrixAt(i, m.compose(p.copy(d).multiplyScalar(PLANET_RADIUS - 0.05), q, sc.set(k, k * (0.9 + random() * 0.3), k)));
      mesh.setColorAt(i, c.setRGB(shade, shade, shade));
    });
    spinner.add(mesh);
    instanced.push(mesh);
    return mesh;
  };
  const instanced = [];
  for (const kind of PLANT_KINDS) {
    const list = planet.plants.filter(plant => plant.kind === kind);
    if (list.length) scatter(own(makePlant(THREE, kind)), list, () => SIZES.plant * (0.8 + random() * 0.5));
  }
  const peakHeights = []; // as placed, for the size audit
  [0, 1, 2].forEach(k => scatter(own(makePeak(THREE, random, k)), planet.peaks.filter((_, i) => i % 3 === k), peak => { const size = Math.min(SIZES.peakBase + peak.height * SIZES.peakRise * (0.85 + random() * 0.15), fits(peak, MODEL_REACH.peak)); peakHeights.push(size); return size; }));
  peakHeights.sort((a, b) => a - b);

  // ---- Mills on open ground: classic windmills in farm and marsh country, wind turbines elsewhere. Both turn by themselves.
  const millKinds = { windmill: makeMill(THREE, 'windmill'), turbine: makeMill(THREE, 'turbine') };
  for (const m of Object.values(millKinds)) { own(m.mast); own(m.blades); }
  const turbines = planet.mills.map((site, k) => {
    const mill = millKinds[['temperate', 'wetland'].includes(site.biome) && k % 3 ? 'windmill' : 'turbine'];
    const place = settle(site, mill.mast, SIZES.mill), blades = inked(new THREE.Mesh(mill.blades, painted));
    blades.position.y = mill.hub;
    place.mesh.add(blades);
    return { ...place, blades, speed: 1.1 + random() * 1.4 };
  });

  /** A body riding a circle `rho` around `centre`: its nose (+x) always points along its travel, its top (+y) away from the planet. */
  const rig = (parent, { centre, rho, speed }, radius, body, phase) => {
    const pivot = standUp(new THREE.Group(), centre), turn = new THREE.Group();
    const at = new THREE.Vector3(Math.sin(rho), Math.cos(rho), 0), forward = new THREE.Vector3(0, 0, speed > 0 ? -1 : 1), side = new THREE.Vector3().crossVectors(forward, at);
    body.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, at, side));
    body.position.copy(at).multiplyScalar(radius);
    turn.add(body); pivot.add(turn); parent.add(pivot);
    turn.rotation.y = phase;
    return { pivot, turn, body, speed, phase, radius, rho, sign: Math.sign(speed) };
  };

  // ---- Ships: hull sunk into the sphere, so the sea really cuts it at the waterline; a foaming wake trails behind.
  const wakeMaterial = own(new THREE.ShaderMaterial({ vertexShader: TRAIL_VERTEX, fragmentShader: WAKE_FRAGMENT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide, uniforms: { time: shared.time } }));
  const wakeGeometry = (() => {
    const position = [], trail = [], index = [], rows = 14, cols = 8;
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
      const f = i / rows, s = j / cols * 2 - 1;
      position.push(3 - f * 20, 0.12, s * (0.75 + f * 3.4)); trail.push(f, s);
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const a = i * (cols + 1) + j, b = a + cols + 1; index.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute('trail', new THREE.Float32BufferAttribute(trail, 2));
    g.setIndex(index);
    return own(g);
  })();
  const shipShapes = SHIP_KINDS.flatMap((kind, k) => [0xffa726, 0x2fbf5b, 0x36a2ff].slice(0, k < 2 ? 2 : 1).map(c => ({ kind, geometry: own(makeShip(THREE, kind, c)) })));
  const ships = shipRoutes(planet, random).slice(0, MAX_BOATS).map((route, k) => {
    const { kind, geometry } = pick(shipShapes, k), body = inked(new THREE.Mesh(geometry, painted));
    body.scale.setScalar(SIZES.ship[kind]);
    body.add(new THREE.Mesh(wakeGeometry, wakeMaterial));
    return rig(spinner, route, PLANET_RADIUS, body, random() * Math.PI * 2);
  });

  // ---- Planes, satellites and balloons: their orbits do not turn with the planet.
  const axis = [0.16, 0.85, -0.5]; // roughly the planet's own pole, so lanes run across the view
  const planeShapes = PLANE_KINDS.flatMap(kind => [0xff3d6e, 0x36a2ff, 0x2fbf5b].map(c => own(makePlane(THREE, kind, c))));
  const satelliteShapes = ['panel', 'dish'].map(kind => own(makeSatellite(THREE, kind)));
  const contrailMaterial = own(new THREE.ShaderMaterial({ vertexShader: TRAIL_VERTEX, fragmentShader: CONTRAIL_FRAGMENT, transparent: true, depthWrite: false }));
  /** A thin tube bending back along the orbit behind the plane, in the orbit's own frame, so it curves round the planet. */
  const contrail = (radius, rho, sign) => {
    const position = [], trail = [], index = [], rows = 26, ring = 6;
    for (let i = 0; i <= rows; i++) for (let j = 0; j < ring; j++) {
      const f = i / rows, a = sign * (0.02 + f * 0.3), w = 0.14 + f * 0.34, q = j / ring * Math.PI * 2, r = radius + Math.cos(q) * w, flat = Math.sin(rho) * r;
      position.push(Math.cos(a) * flat, Math.cos(rho) * r + Math.sin(q) * w, Math.sin(a) * flat); trail.push(f, 0);
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < ring; j++) { const a = i * ring + j, b = i * ring + (j + 1) % ring, c = a + ring, d = b + ring; index.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute('trail', new THREE.Float32BufferAttribute(trail, 2));
    g.setIndex(index);
    return new THREE.Mesh(own(g), contrailMaterial);
  };
  const planes = laneRoutes(MAX_PLANES, axis, 0.1).map((route, k) => {
    const body = inked(new THREE.Mesh(pick(planeShapes, k * 4), painted)), radius = PLANET_RADIUS + 24 + (k % 3) * 1.4;
    body.scale.setScalar(SIZES.plane);
    const r = rig(scene, route, radius, body, k * 2.4 + random() * 0.6);
    r.turn.add(contrail(radius - 0.2, route.rho, r.sign));
    return r;
  });
  const satellites = laneRoutes(MAX_SATELLITES, axis, -0.05).map((route, k) => {
    const body = inked(new THREE.Mesh(pick(satelliteShapes, k), painted));
    body.scale.setScalar(SIZES.satellite);
    return rig(scene, route, PLANET_RADIUS * 1.46 + k * 3, body, k * 2.1 + 1);
  });
  const balloonShapes = [[0xff3d6e, 0xffd640], [0x36a2ff, 0xf8f8fc], [0x2fbf5b, 0xff9d3c], [0xa55eea, 0xffd640]].map(([c, b]) => own(makeBalloon(THREE, c, b)));
  // Balloons hang over open country and turn with the ground, so they never drift into anything.
  const balloons = planet.towns.filter(t => ['temperate', 'grassland'].includes(t.biome)).filter((_, k) => k % 4 === 0).slice(0, 4).map((site, k) => {
    const body = inked(new THREE.Mesh(pick(balloonShapes, k), painted)), dir = surfaceDir(site.u + 0.012, site.lat - 1.6);
    body.scale.setScalar(SIZES.balloon);
    body.position.set(...dir).multiplyScalar(PLANET_RADIUS + 11);
    standUp(body, dir);
    spinner.add(body);
    return { body, dir, phase: k * 1.7 };
  });

  // ---- Clouds circle the globe in layers of their own, above the mountains and clear of the air lanes: many small soft bodies, all
  // see-through to some degree, with no outline, spaced so none run through each other. Each draws after a depth pass, so only its nearest
  // surface shows: a rounded volume rather than a jumble of lobes. They are drawn far to near each frame, and melt away near the horizon.
  const cloudMaterial = (opacity, tint = [1, 1, 1]) => own(new THREE.ShaderMaterial({ vertexShader: CLOUD_VERTEX, fragmentShader: CLOUD_FRAGMENT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, uniforms: { sun: shared.sun, haze: { value: 0.06 }, opacity: { value: opacity }, tint: { value: new THREE.Vector3(...tint) } } }));
  const cloudShapes = Array.from({ length: 5 }, (_, k) => own(makeCumulus(THREE, random, { puffs: 9 + k, detail: 2, stretch: 1.6 + k * 0.3 })));
  const cloudSkins = [0.42, 0.6, 0.76, 0.88].map(o => cloudMaterial(o));
  // The depth pass runs the same vertex shader as the colour pass: two different shaders round depth differently and the passes flicker.
  const depthOnly = own(new THREE.ShaderMaterial({ vertexShader: CLOUD_VERTEX, fragmentShader: 'void main(){gl_FragColor=vec4(0.);}', colorWrite: false, transparent: true }));
  const spots = [], deckClouds = [];
  for (let k = 0; k < CLOUDS; k++) {
    let dir = null;
    for (let tries = 0; tries < 60 && !dir; tries++) { // clouds gather where the cloud map is dense, so they come in loose groups
      const u = random(), lat = -60 + random() * 124, d = surfaceDir(u, lat);
      if (planet.cloud[Math.floor((0.5 - lat / 180) * TEX_H) * TEX_W + Math.floor(u * TEX_W)] > 110 && spots.every(q => q[0] * d[0] + q[1] * d[1] + q[2] * d[2] < 0.99)) dir = d;
    }
    if (!dir) continue;
    spots.push(dir);
    const thin = k % 4 === 0, altitude = thin ? 31 + random() * 5 : 15.5 + random() * 5, size = thin ? 3.6 + random() * 2.6 : 2.4 + random() * 2.6, shape = pick(cloudShapes, k);
    const mesh = new THREE.Mesh(shape, depthOnly), skin = new THREE.Mesh(shape, cloudSkins[thin ? 0 : 1 + k % 3]);
    mesh.add(skin);
    mesh.position.set(...dir).multiplyScalar(PLANET_RADIUS + altitude);
    standUp(mesh, dir).rotateY(Math.PI / 2 + (random() - 0.5) * 0.9);
    mesh.scale.set(size * 1.2, size * (thin ? 0.42 : 0.62 + random() * 0.28), size);
    deck.add(mesh);
    deckClouds.push(mesh);
  }
  // Smoke over the two biggest volcanoes: soft puffs that grow as they rise, then fade out by shrinking away.
  const smokeSkin = cloudMaterial(0.55, [0.62, 0.6, 0.66]);
  const smoke = volcanoes.slice(0, 2).flatMap(v => [0, 1, 2, 3, 4].map(k => {
    const puff = new THREE.Mesh(cloudShapes[0], smokeSkin);
    puff.renderOrder = 4;
    spinner.add(puff);
    return { puff, dir: new THREE.Vector3(...v.dir), top: PLANET_RADIUS + v.unit, phase: k / 5 };
  }));
  const placeSmoke = () => {
    for (const s of smoke) {
      const t = (clock * 0.07 + s.phase) % 1, grow = Math.sin(t * Math.PI) * 2.1 + 0.02;
      s.puff.position.copy(s.dir).multiplyScalar(s.top + t * 12);
      s.puff.quaternion.setFromUnitVectors(yAxis, s.dir);
      s.puff.scale.setScalar(grow);
    }
  };

  // ---- The night sky, drawn far behind everything in the camera's frame.
  const sky = new THREE.Group();
  camera.add(sky);
  const skyDistance = 50000, skyT = Math.tan(FOV * Math.PI / 360) * skyDistance;
  const starMaterial = own(new THREE.ShaderMaterial({ vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT, transparent: true, premultipliedAlpha: true, depthWrite: false, uniforms: { time: shared.time, pixel: { value: 1 } } }));
  {
    const position = [], size = [], tone = [], phase = [];
    const tints = [[1, 1, 1], [0.8, 0.88, 1], [1, 0.9, 0.72], [1, 0.76, 0.66], [0.76, 0.82, 1]];
    const star = (x, y, s) => { position.push(x * skyT * 2.6, y * skyT, -skyDistance); size.push(s); tone.push(...tints[Math.floor(random() * tints.length)]); phase.push(random()); };
    for (let k = 0; k < 900; k++) { const b = random(); star(random() * 2 - 1, random() * 1.3 - 0.3, 1 + b * b * b * 2.6); }
    for (const [cx, cy, n, spread] of [[-0.22, 0.72, 90, 0.05], [0.26, 0.6, 70, 0.04], [0.1, 0.9, 60, 0.03]]) { // star clusters
      for (let k = 0; k < n; k++) { const r = spread * Math.sqrt(-2 * Math.log(1 - random() * 0.99)), a = random() * Math.PI * 2; star(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r, 0.9 + random() * 1.2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
    g.setAttribute('tone', new THREE.Float32BufferAttribute(tone, 3));
    g.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
    const stars = new THREE.Points(own(g), starMaterial);
    stars.frustumCulled = false;
    stars.renderOrder = -2;
    sky.add(stars);
  }
  const galaxy = (x, y, size, roll, lean, tone) => {
    const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)), own(new THREE.ShaderMaterial({ vertexShader: GALAXY_VERTEX, fragmentShader: GALAXY_FRAGMENT, transparent: true, premultipliedAlpha: true, depthWrite: false, uniforms: { tone: { value: new THREE.Color(...tone) }, strength: { value: 0.5 } } })));
    mesh.position.set(x * skyT * 1.78, y * skyT, -skyDistance * 0.98);
    mesh.rotation.set(lean, 0, roll);
    mesh.scale.setScalar(size * skyT);
    mesh.renderOrder = -2;
    sky.add(mesh);
  };
  galaxy(0.5, 0.86, 0.075, 0.6, 0.9, [0.72, 0.78, 1]);
  galaxy(-0.46, 0.5, 0.05, -0.8, 1.1, [1, 0.8, 0.9]);
  const streak = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)), own(new THREE.ShaderMaterial({ vertexShader: STREAK_VERTEX, fragmentShader: STREAK_FRAGMENT, transparent: true, premultipliedAlpha: true, depthWrite: false, uniforms: { life: { value: 0 } } })));
  streak.visible = false;
  streak.renderOrder = -2;
  sky.add(streak);
  let nextStreak = SHOOTING_GAP[0] + random() * (SHOOTING_GAP[1] - SHOOTING_GAP[0]), streakAge = -1, streakCount = 0;
  const streakPath = { x: 0, y: 0, dx: 0, dy: 0 };

  // ---- Luna and Ares, real spheres in the scene, each with its ice, its signs of life and one tiny base.
  // Lit by Gaia's own sun shader (WORLD_FRAGMENT), not the game's Lambert toon, so all three worlds share one light; `map` and `opacity`
  // stay ordinary properties (the painted-map switch and the space view set them).
  const worldDim = { value: 1 };
  const world = (rgb, distance, opacity = 1) => {
    const uniforms = { sun: shared.sun, dotCell: shared.dotCell, dim: worldDim, map: { value: data(rgba(rgb), WORLD_TEX_W, WORLD_TEX_H, true) }, alpha: { value: opacity } };
    const material = own(new THREE.ShaderMaterial({ vertexShader: SPHERE_VERTEX, fragmentShader: WORLD_FRAGMENT, uniforms, transparent: opacity < 1 }));
    Object.defineProperty(material, 'map', { get: () => uniforms.map.value, set: v => { uniforms.map.value = v; } });
    Object.defineProperty(material, 'opacity', { get: () => uniforms.alpha.value, set: v => { uniforms.alpha.value = v; } });
    const mesh = new THREE.Mesh(sphere(1, 64, 48), material);
    scene.add(mesh);
    return { mesh, distance };
  };
  const ares = world(buildAresTexture(random), ARES_DISTANCE, 0.78), luna = world(buildLunaTexture(random), LUNA_DISTANCE);
  const proceduralMaps = { ares: ares.mesh.material.map, luna: luna.mesh.material.map };
  let paintedMapsOn = true;
  /** Shows the painted maps that have arrived (`on`), or the procedural surfaces. */
  function usePaintedMaps(on) {
    paintedMapsOn = on;
    surface.uniforms.mapOn.value = on && paintedMaps.gaia ? 1 : 0;
    for (const [name, body] of [['ares', ares], ['luna', luna]]) {
      const map = on && paintedMaps[name] ? paintedMaps[name] : proceduralMaps[name];
      if (body.mesh.material.map !== map) { body.mesh.material.map = map; body.mesh.material.needsUpdate = true; }
    }
    stats.paintedMaps = Object.keys(paintedMaps).filter(name => on && paintedMaps[name]);
  }
  inked(luna.mesh);
  const baseOn = ({ mesh }, dir, size, dome) => {
    const base = new THREE.Mesh(own(makeBase(THREE, dome)), painted), d = new THREE.Vector3(...dir).normalize();
    base.position.copy(d);
    base.quaternion.setFromUnitVectors(yAxis, d);
    base.scale.setScalar(size);
    mesh.add(base);
  };
  baseOn(luna, [-0.45, 0.42, 0.79], 0.034, 0x8fe6ff); // on the side facing Gaia: barely visible
  baseOn(ares, [-0.3, 0.3, 0.9], 0.012, 0xa8ffcc); // far tinier still
  // Signs of life for the destination view: Luna's observatories, radio dishes and a spaceport on the side the camera sees, satellites
  // round both worlds, and two small lumpy moons for Ares. All are children of their world, so they shrink with it on the horizon.
  const lunaSites = [makeObservatory, makeRadioDish, makeSpaceport].map(make => own(make(THREE)));
  const placeOn = ({ mesh }, shape, dir, size) => {
    const d = new THREE.Vector3(...dir).normalize(), body = new THREE.Mesh(shape, painted); // no ink: at this size an outline is just a dark blot
    body.position.copy(d).multiplyScalar(0.985); // the foot sinks a little, so it sits in the ground on the curve
    body.quaternion.setFromUnitVectors(yAxis, d);
    body.rotateY(dir[0] * 7);
    body.scale.setScalar(size);
    mesh.add(body);
  };
  placeOn(luna, lunaSites[0], [0.32, 0.3, 0.9], 0.07);
  placeOn(luna, lunaSites[0], [0.62, -0.18, 0.76], 0.055);
  placeOn(luna, lunaSites[1], [0.12, -0.32, 0.94], 0.06);
  placeOn(luna, lunaSites[1], [0.24, -0.44, 0.87], 0.045);
  placeOn(luna, lunaSites[2], [0.5, 0.12, 0.86], 0.06);
  placeOn(luna, lunaSites[0], [-0.6, -0.2, 0.77], 0.055);
  const orbiters = [];
  const orbit = ({ mesh }, body, radius, lean, phase, speed) => {
    const pivot = new THREE.Group();
    pivot.rotation.set(lean, 0, lean * 0.6);
    const turn = new THREE.Group();
    turn.rotation.y = phase;
    body.position.set(radius, 0, 0);
    turn.add(body); pivot.add(turn); mesh.add(pivot);
    orbiters.push({ turn, speed });
    return body;
  };
  const satellite = (k, size) => { const body = inked(new THREE.Mesh(pick(satelliteShapes, k), painted)); body.scale.setScalar(size); body.rotation.set(0.4, k, 0.2); return body; };
  orbit(luna, satellite(0, 0.014), 1.32, 0.35, -1.2, 0.09);
  orbit(luna, satellite(1, 0.012), 1.55, -0.55, 2.2, -0.06);
  orbit(ares, satellite(0, 0.01), 1.3, -0.3, -1.6, 0.08);
  orbit(ares, satellite(1, 0.009), 1.45, 0.6, 1.9, -0.05);
  const moonRock = own(library.toon(0x9a8778)), moonDust = own(library.toon(0xb7a08a));
  [[makeMoonlet(THREE, random, { stretch: [1.4, 0.85, 1.05] }), moonRock, 0.2, 1.9, 0.1, -1.1, 0.05], [makeMoonlet(THREE, random, { stretch: [1.2, 0.95, 0.9] }), moonDust, 0.12, 2.7, -0.06, 0.7, 0.025]].map(([g, material, size, radius, lean, phase, speed]) => {
    const body = inked(new THREE.Mesh(own(g), material));
    body.scale.setScalar(size);
    orbit(ares, body, radius, lean, phase, speed);
  });

  // ---- The destination view (VIS-M4): the camera pulls back from the horizon into space, where Gaia hangs with Luna slowly orbiting it (framed on Gaia alone: Luna shows only when its orbit brings it into view)
  // and Ares stands far off. Sizes and distances are staged for the view, not real. `setView` picks the planet; the camera flies between
  // them, and the long trips to and from Ares widen the lens and then zoom in. Reads the live `display.space` settings.
  const spaceSettings = () => display.space ?? { orbitSeconds: 120, travelSeconds: 1.8, aresZoom: 0.5, nebula: 0.6, distance: 1, revolveSeconds: 180 };
  // The little solar system (owner, 2026-11-17): the sun shines from where the light comes from, Gaia orbits it, and Ares orbits further
  // out, behind Gaia as seen from the sun and a little to the side, so from Ares the sun and Gaia both show in the sky beyond it. In
  // space everything revolves slightly and softly: a few degrees back and forth around the sun (`space.revolveSeconds`). Gaia stays the
  // centre of the scene, so its revolving shows as the sun (and its light) easing around it. The horizon view never moves.
  const SUN_HOME = sun.clone(), SUN_ORBIT_NORMAL = new THREE.Vector3(), SUN_SIDE = new THREE.Vector3().crossVectors(SUN_HOME, yAxis).normalize();
  SUN_ORBIT_NORMAL.crossVectors(SUN_HOME, SUN_SIDE).normalize();
  const SPACE_SUN = { distance: 7000, radius: 300, revolve: 4 * Math.PI / 180 };
  const SPACE_LUNA = { orbit: 520, radius: 34, lean: 0.12 }, SPACE_ARES = { position: SUN_HOME.clone().multiplyScalar(-2400).addScaledVector(SUN_SIDE, 1400), radius: 62 };
  const ARES_FROM_SUN = SPACE_ARES.position.clone().addScaledVector(SUN_HOME, -SPACE_SUN.distance); // Ares relative to the sun
  const sunNow = new THREE.Vector3().copy(SUN_HOME).multiplyScalar(SPACE_SUN.distance), aresNow = SPACE_ARES.position.clone();
  /** Where the sun and Ares are `seconds` into the revolve, blended in by `k` (0 is the fixed home layout). */
  function revolve(seconds, k) {
    const turn = reducedMotion ? 0 : Math.PI * 2 * seconds / spaceSettings().revolveSeconds;
    const gaiaAngle = SPACE_SUN.revolve * Math.sin(turn) * k, aresAngle = SPACE_SUN.revolve * 0.7 * Math.sin(turn * 0.8 + 1.2) * k;
    sunNow.copy(SUN_HOME).multiplyScalar(SPACE_SUN.distance).applyAxisAngle(SUN_ORBIT_NORMAL, gaiaAngle);
    aresNow.copy(ARES_FROM_SUN).applyAxisAngle(SUN_ORBIT_NORMAL, aresAngle).add(sunNow);
    sun.copy(sunNow).normalize(); // the light follows (shared.sun is this vector)
    light.position.copy(sun).multiplyScalar(1000);
  }
  const SPACE_FRAME = { gaia: 700, luna: 240, ares: 400 }; // camera distance from each planet's centre, before `space.distance`: each about 7 radii, so every planet fills the view alike
  const SPACE_VIEW_DIR = new THREE.Vector3(0.42, 0.16, 1).normalize(); // seen a little from the right and above: the sun lights the near side
  const SPACE_BACKDROP = 0x03050f; // the darkest tone of the page's own backdrop, so the fade in is seamless
  const space = { goal: 0, t: 0, from: 'gaia', to: 'gaia', travel: 1, orbit: 0.96, near: 0, nearGoal: 0 };
  // A change of planet mid-flight (owner, 2026-11-17: smoother switching) starts from where the camera is, not from the planet it left:
  // `snap` holds that pose, and the new flight leaves it already moving.
  const snap = { on: false, pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(), fov: FOV };
  // Close in (owner, 2026-11-17: the lobby rocket flies in Mars's atmosphere): with `near`, Ares and Luna are seen from just above
  // their surface instead of from far out. The ground curves away along the bottom of the screen and the camera looks out over the
  // horizon toward the sky the planet sees: Gaia and the sun for Ares, Gaia for Luna. `alt` is the height above the ground and `dip`
  // how far the view tips down, both in planet radii and radians.
  const NEAR = { ares: { alt: 0.07, dip: 0.2 }, luna: { alt: 0.12, dip: 0.22 } };
  // Ares's air (owner, 2026-11-17: gradual, like Gaia's): butterscotch dust that thins smoothly with height, so from far out it is a
  // soft glow hugging the rim and fading gently into space, and from inside it is a sky: deep and clear overhead, thick and dusty
  // toward the horizon, warmest toward the sun. Each pixel marches its line of sight through the air (density falling off by `scale`,
  // a fraction of the radius, up to `top`), stopping at the ground; the colour follows the height the light mostly came through,
  // pale near the ground and deepening above, as Gaia's does.
  const ARES_AIR = { top: 1.6, scale: 0.12, density: 1.9 };
  const aresAir = new THREE.Mesh(sphere(1, 64, 32), own(new THREE.ShaderMaterial({
    uniforms: { centre: { value: new THREE.Vector3() }, ground: { value: 1 }, top: { value: ARES_AIR.top }, scale: { value: ARES_AIR.scale }, density: { value: ARES_AIR.density }, toSun: { value: new THREE.Vector3(0, 1, 0) }, fade: { value: 0 } },
    vertexShader: 'varying vec3 vWorld; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 centre; uniform float ground; uniform float top; uniform float scale; uniform float density; uniform vec3 toSun; uniform float fade;
      varying vec3 vWorld;
      vec2 hit(vec3 o, vec3 d, float r) { float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c; if (h < 0.0) return vec2(1e9, -1e9); h = sqrt(h); return vec2(-b - h, -b + h); }
      void main() {
        vec3 o = cameraPosition - centre, d = normalize(vWorld - cameraPosition);
        vec2 air = hit(o, d, top), land = hit(o, d, ground);
        float from = max(air.x, 0.0), to = air.y;
        bool onGround = land.x < land.y && land.x > 0.0;
        if (onGround) to = min(to, land.x);
        if (to <= from) discard;
        float stepLength = (to - from) / 24.0, tau = 0.0, heightSum = 0.0;
        vec3 lit = vec3(0.0);
        for (int i = 0; i < 24; i++) {
          vec3 p = o + d * (from + (float(i) + 0.5) * stepLength);
          float h = max(0.0, length(p) / ground - 1.0), rho = exp(-h / scale) * stepLength;
          tau += rho; heightSum += rho * h; lit += rho * normalize(p);
        }
        float h = heightSum / max(tau, 1e-6) / (top / ground - 1.0) * 2.0; // 0 at the ground, about 1 well up
        float a = (1.0 - exp(-tau / ground * density)) * fade;
        a *= 0.6 + 0.4 * smoothstep(-0.3, 0.7, dot(normalize(lit), toSun)); // the night side glows less
        vec3 col = mix(vec3(0.46, 0.18, 0.13), vec3(0.94, 0.58, 0.34), exp(-h * 2.4));
        col = mix(col, vec3(1.0, 0.86, 0.66), exp(-h * 9.0));
        col += vec3(1.0, 0.88, 0.62) * pow(max(0.0, dot(d, toSun)), 3.0) * 0.3;
        // Dust lies on the ground too: seen from inside the air, the surface takes a rusty veil, so Ares always reads red below.
        float settle = onGround ? 0.62 * fade * smoothstep(1.25, 1.02, length(o) / ground) : 0.0;
        vec3 rust = vec3(0.78, 0.38, 0.22);
        float total = 1.0 - (1.0 - a) * (1.0 - settle);
        if (total < 0.003) discard;
        vec3 mixed = (col * a + rust * settle * (1.0 - a)) / max(total, 1e-4);
        gl_FragColor = vec4(mixed * total, total);
      }`,
    // No depth test: the far wall of the shell lies behind the ground, and the path length already stops at the ground.
    side: THREE.BackSide, transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: false,
  })));
  aresAir.visible = false;
  aresAir.renderOrder = 1;
  scene.add(aresAir);
  const nearUp = new THREE.Vector3(), nearAhead = new THREE.Vector3();
  const home = { luna: { position: new THREE.Vector3(), scale: 1 } };
  function lunaSpacePosition(phase, out) {
    const a = phase * Math.PI * 2;
    return out.set(Math.cos(a) * SPACE_LUNA.orbit, -Math.sin(a) * SPACE_LUNA.orbit * Math.sin(SPACE_LUNA.lean), Math.sin(a) * SPACE_LUNA.orbit * Math.cos(SPACE_LUNA.lean)); // the near side of the orbit passes below Gaia
  }
  const bodyCentre = (id, out) => id === 'luna' ? lunaSpacePosition(space.orbit, out) : id === 'ares' ? out.copy(aresNow) : out.set(0, 0, 0);
  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const longTrip = () => space.from === 'ares' || space.to === 'ares';
  // Extra space for the whole frame: stars below the horizon line (hidden by the planet in the horizon view) and soft nebula clouds.
  const deepSky = new THREE.Group();
  deepSky.visible = false;
  sky.add(deepSky);
  {
    const position = [], size = [], tone = [], phase = [];
    const tints = [[1, 1, 1], [0.8, 0.88, 1], [1, 0.9, 0.72], [0.9, 0.8, 1]];
    for (let k = 0; k < 1100; k++) { const b = random(); position.push((random() * 2 - 1) * skyT * 2.6, (random() * 1.6 - 1.25) * skyT, -skyDistance); size.push(0.8 + b * b * b * 2.4); tone.push(...tints[Math.floor(random() * tints.length)]); phase.push(random()); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
    g.setAttribute('tone', new THREE.Float32BufferAttribute(tone, 3));
    g.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
    const lower = new THREE.Points(own(g), starMaterial);
    lower.frustumCulled = false;
    lower.renderOrder = -2;
    deepSky.add(lower);
  }
  // The sun in space (owner, 2026-11-17): the same cartoon golf-ball sun as the lobbies, a warm yellow ball in flat toon bands with
  // dimples and a dark rim, an opaque pale halo and slim rays that fade to clear. It always faces the camera and shows only in space.
  const sunBody = new THREE.Group();
  sunBody.visible = false;
  scene.add(sunBody);
  {
    const R = SPACE_SUN.radius, DIMPLES = 150;
    const points = Array.from({ length: DIMPLES }, (_, i) => {
      const y = 1 - 2 * (i + 0.5) / DIMPLES, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
      return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    });
    const ball = new THREE.Mesh(own(new THREE.SphereGeometry(R, 64, 48)), own(new THREE.ShaderMaterial({
      uniforms: { pts: { value: points }, light: { value: new THREE.Vector3(-0.55, 0.6, 0.58).normalize() } },
      vertexShader: 'varying vec3 vN; void main(){ vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 pts[${DIMPLES}]; uniform vec3 light; varying vec3 vN;
        void main(){
          vec3 n = normalize(vN), c = pts[0];
          if (n.z < 0.2) { gl_FragColor = vec4(0.1, 0.07, 0.14, 1.0); return; } // the ink rim
          float best = 10.0;
          for (int i = 0; i < ${DIMPLES}; i++) { float d = distance(n, pts[i]); if (d < best) { best = d; c = pts[i]; } }
          float k = 1.0 - smoothstep(0.108, 0.135, best);
          vec3 m = normalize(n - (n - c) * 3.2 * k);
          float lam = dot(m, light);
          vec3 col = lam > 0.45 ? vec3(1.0, 0.85, 0.27) : lam > -0.05 ? vec3(1.0, 0.74, 0.2) : vec3(0.98, 0.6, 0.16);
          if (k < 0.5 && dot(n, normalize(light + vec3(0.0, 0.0, 0.6))) > 0.94) col = vec3(1.0, 0.94, 0.6);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })));
    const halo = new THREE.Mesh(own(new THREE.CircleGeometry(R * 1.4, 64)), own(new THREE.MeshBasicMaterial({ color: 0xffeb8a })));
    const rayMaterial = own(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { from: { value: R * 1.56 }, to: { value: R * 2.44 } },
      vertexShader: 'varying float h; void main(){ h = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float from; uniform float to; varying float h; void main(){ gl_FragColor = vec4(1.0, 0.78, 0.12, 0.95 * (1.0 - smoothstep(from, to, h))); }',
    }));
    const rays = new THREE.Group();
    for (let k = 0; k < 12; k++) {
      const long = k % 2 === 0, shape = new THREE.Shape(), w = R * (long ? 0.16 : 0.125), from = R * 1.53, to = R * (long ? 2.44 : 2.06);
      shape.moveTo(-w, from);
      shape.quadraticCurveTo(-w * 0.5, (from + to) / 2, 0, to);
      shape.quadraticCurveTo(w * 0.5, (from + to) / 2, w, from);
      shape.lineTo(-w, from);
      const ray = new THREE.Mesh(own(new THREE.ShapeGeometry(shape, 8)), rayMaterial);
      ray.rotation.z = k / 12 * Math.PI * 2;
      rays.add(ray);
    }
    sunBody.add(rays, halo, ball);
    sunBody.userData.rays = rays;
  }
  const nebulae = [];
  {
    const paint = (w, h, blobs) => { // soft clouds of colour, painted once into a small canvas
      const c = doc.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext?.('2d');
      if (!g) return null;
      for (const [x, y, r, rgb, a] of blobs) {
        const grad = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
        grad.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); grad.addColorStop(1, 'rgba(' + rgb + ',0)');
        g.fillStyle = grad; g.fillRect(x * w - r * w, y * h - r * w, 2 * r * w, 2 * r * w); // only the puff's own square: outside it the gradient is clear
      }
      return c;
    };
    // One calm band of light crossing the sky, like the edge of a galaxy seen from inside: many faint puffs along a gentle curve, thickest
    // in the middle, their colour drifting slowly from blue through violet to a little rose. No scattered patches.
    const band = (count, tones) => Array.from({ length: count }, () => {
      const s = random(), across = (random() + random() + random() - 1.5) * 0.16 * (0.5 + Math.sin(Math.PI * s));
      const tone = tones[Math.min(tones.length - 1, Math.floor(s * tones.length + (random() - 0.5) * 0.8))] ?? tones[0];
      return [0.14 + s * 0.72, 0.5 + (s - 0.5) * 0.18 + across + Math.sin(s * 5) * 0.03, 0.05 + random() * 0.07, tone, 0.04 + 0.07 * Math.sin(Math.PI * s)];
    });
    for (const [x, y, sx, sy, roll, tones, count] of [[0, -0.15, 3.4, 1.5, 0.32, ['70,110,230', '100,90,220', '140,90,220', '190,100,200'], 160], [0.15, -0.35, 2.4, 0.9, 0.26, ['60,90,200', '90,120,240'], 40]]) {
      const canvasTexture = paint(512, 192, band(count, tones));
      if (!canvasTexture) continue;
      const texture = own(new THREE.CanvasTexture(canvasTexture));
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)), material);
      mesh.position.set(x * skyT * 1.6, y * skyT, -skyDistance * 0.99);
      mesh.scale.set(sx * skyT, sy * skyT, 1);
      mesh.rotation.z = roll;
      mesh.renderOrder = -3;
      deepSky.add(mesh);
      nebulae.push(material);
    }
  }

  // ---- Per-frame state
  let lastCloudSort = -1, slowFrames = 0, quality = 1, frameId = null, last = null, spin = 0, cloudSpin = 0, clock = 0, disposed = false, sizeKey = '', framing = { y: 0, z: 0 };
  const stats = { limb: 0, deckClouds: 0, tallestCity: 0, ink: 0, lunaPixels: 0, paintedMaps: [] };
  const scratch = new THREE.Vector3(), scratch2 = new THREE.Vector3();

  const viewport = () => { const rect = canvas.getBoundingClientRect?.(); return { w: rect?.width || win?.innerWidth || 1280, h: rect?.height || win?.innerHeight || 720 }; };

  function fit(w, h, s) {
    const key = `${w}x${h}:${s.horizonHeight}:${s.lunaSize}`;
    if (key === sizeKey) return;
    sizeKey = key;
    const ratio = Math.min(win?.devicePixelRatio || 1, 1.5) * quality;
    renderer?.setPixelRatio?.(ratio);
    renderer?.setSize?.(w, h, false);
    sizeInk(library.inkUniforms, w * ratio, h * ratio);
    starMaterial.uniforms.pixel.value = ratio * Math.max(1, h / 720);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    framing = frameCamera(w, h, s.horizonHeight, PLANET_RADIUS, s.cameraAltitude);
    camera.position.set(0, framing.y, framing.z);
    // With the camera in the air, a cloud's orbit can pass right by the lens: those clouds sit out. Each orbits the axis on a circle, so its
    // closest approach is exact: the distance from the camera to that circle.
    tilt.updateMatrixWorld(true);
    const lens = tilt.worldToLocal(camera.position.clone()), lensR = Math.hypot(lens.x, lens.z);
    for (const mesh of deckClouds) mesh.userData.clear = Math.hypot(lensR - Math.hypot(mesh.position.x, mesh.position.z), lens.y - mesh.position.y) > 60 + mesh.scale.x * 2;
    camera.rotation.set(0, 0, 0);
    const t = Math.tan(FOV * Math.PI / 360);
    const place = ({ mesh, distance }, nx, ny, radius) => { mesh.position.set(nx * distance * t * camera.aspect, framing.y + ny * distance * t, framing.z - distance); mesh.scale.setScalar(radius); };
    place(luna, 0.86, 0.5, LUNA_RADIUS * s.lunaSize);
    place(ares, -0.6, 0.8, ARES_SHARE * ARES_DISTANCE * t * 1.4); // smaller than before (owner, 2026-11-18): a background world, not a rival to Gaia
    home.luna.position.copy(luna.mesh.position); home.luna.scale = luna.mesh.scale.x;
    stats.lunaPixels = LUNA_RADIUS * s.lunaSize / (LUNA_DISTANCE * t) * h;
    stats.limb = 1 - 2 * s.horizonHeight;
  }

  /** Applies the live settings that need no rebuild. */
  function applySettings(s, w) {
    tilt.rotation.z = -s.axisTilt * Math.PI / 180;
    spinner.rotation.y = spin * Math.PI / 180;
    cloudSpinner.rotation.y = cloudSpin * Math.PI / 180;
    deck.rotation.y = cloudSpin * 0.8 * Math.PI / 180;
    shared.cloudShift.value = -(cloudSpin - spin) / 360;
    shared.cloudGate.value = 1.1 - s.cloudCover * 0.58;
    shared.atmosphere.value = s.atmosphere;
    if ((s.paintedMaps >= 0.5) !== paintedMapsOn) usePaintedMaps(s.paintedMaps >= 0.5);
    shared.time.value = clock;
    air.material.uniforms.shell.value = stats.airTop = PLANET_RADIUS * (1 + s.atmosphereHeight);
    const ratio = renderer?.getPixelRatio?.() ?? 1;
    library.inkUniforms.ink.value = stats.ink = s.outlineWidth * w * ratio / 1280;
    shared.inkPx.value = Math.max(0.8, s.outlineWidth * 0.8);
    for (const hull of outlined) hull.visible = s.outlineWidth > 0;
    stats.tallestCity = 0;
    for (const c of [...places, ...turbines]) c.mesh.scale.setScalar(c.unit * s.citySize);
    for (const c of cities) stats.tallestCity = Math.max(stats.tallestCity, c.top * c.unit * s.citySize);
    for (const c of volcanoes) c.mesh.scale.setScalar(c.unit);
    const show = (list, n) => list.forEach((item, i) => { (item.pivot ?? item).visible = i < n; });
    show(planes, count(s.planes, MAX_PLANES)); show(ships, count(s.boats, MAX_BOATS)); show(satellites, count(s.satellites, MAX_SATELLITES));
    stats.deckClouds = count(s.cloudCover * 1.6 * deckClouds.length, deckClouds.length);
    show(deckClouds, focus ? 0 : stats.deckClouds);
    for (const mesh of deckClouds) if (mesh.userData.clear === false) mesh.visible = false;
    placeSmoke();
    if (clock - lastCloudSort > 0.5 || lastCloudSort < 0) { // far to near, so a near cloud never blanks one behind it; clouds move slowly, so twice a second is plenty
      lastCloudSort = clock;
      deck.updateMatrixWorld(true);
      deckClouds.map(mesh => ({ mesh, gap: mesh.getWorldPosition(scratch).distanceToSquared(camera.position) })).sort((a, b) => b.gap - a.gap).forEach(({ mesh }, i) => {
        mesh.renderOrder = 10 + i * 2;
        mesh.children[0].renderOrder = 11 + i * 2;
      });
    }
    shell.visible = s.cloudCover > 0;
  }

  /** Gallery close-ups: hold the camera near one object. */
  function followFocus() {
    if (!focus) return;
    if (focus === 'luna' || focus === 'ares') {
      const { mesh } = focus === 'luna' ? luna : ares, r = mesh.scale.x;
      mesh.getWorldPosition(scratch);
      camera.up.set(0, 1, 0);
      camera.position.copy(scratch).add(new THREE.Vector3(-0.3, 0.3, 0.9).normalize().multiplyScalar(r * 3.4));
      camera.lookAt(scratch);
      return;
    }
    const pool = { ship: ships.map(m => m.body), plane: planes.map(m => m.body), port: ports.map(m => m.mesh), town: towns.map(m => m.mesh), city: cities.map(m => m.mesh), volcano: volcanoes.map(m => m.mesh), mountain: flags.map(m => m.mesh) }[focus];
    const target = pool?.[0];
    if (!target) return;
    target.updateWorldMatrix(true, false);
    target.getWorldPosition(scratch);
    const out = scratch2.copy(scratch).normalize(), span = { city: 34, ship: 13, plane: 15, port: 15, town: 12, volcano: 26, mountain: 40 }[focus];
    camera.up.copy(out);
    camera.position.copy(scratch).addScaledVector(out, span * 0.42).add(new THREE.Vector3().crossVectors(out, yAxis).normalize().multiplyScalar(span));
    camera.lookAt(scratch.addScaledVector(out, focus === 'city' ? 6 : 0));
  }

  const horizonQuat = new THREE.Quaternion(), poseQuat = new THREE.Quaternion(), lookAtMatrix = new THREE.Matrix4();
  const upFrom = new THREE.Vector3(), upTo = new THREE.Vector3(), upNow = new THREE.Vector3();
  const camFrom = new THREE.Vector3(), camTo = new THREE.Vector3(), lookFrom = new THREE.Vector3(), lookTo = new THREE.Vector3(), spacePos = new THREE.Vector3(), spaceLook = new THREE.Vector3(), tmpA = new THREE.Vector3();
  const toGaia = new THREE.Vector3(), toSun = new THREE.Vector3(), across = new THREE.Vector3(), mid = new THREE.Vector3(), lift = new THREE.Vector3();
  /**
   * Where the camera stands to show planet `id` in space, the point it looks at and the camera's up. At Ares it looks past the planet
   * toward the sun: Gaia on one side and the sun on the other, both a little above Ares, so they still show when the planet sits low.
   */
  function spaceCamera(id, pos, look, up) {
    bodyCentre(id, look);
    up.copy(yAxis);
    const near = id === 'gaia' ? 0 : ease(space.near);
    if (near > 0) {
      far(id, tmpPos, tmpLook, tmpUp);
      nearCamera(id, look, pos, nearLook, up);
      pos.lerpVectors(tmpPos, pos, near); look.lerpVectors(tmpLook, nearLook, near); up.lerpVectors(tmpUp, up, near).normalize();
      return;
    }
    far(id, pos, look, up);
  }
  const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3(), tmpUp = new THREE.Vector3(), nearLook = new THREE.Vector3();
  /** The close-in view of Ares or Luna (centred at `centre`): camera `pos`, the point it looks at and its up. */
  function nearCamera(id, centre, pos, look, up) {
    const r = id === 'ares' ? SPACE_ARES.radius : SPACE_LUNA.radius, { alt, dip } = NEAR[id];
    toGaia.copy(centre).negate().normalize();
    if (id === 'ares') nearAhead.copy(toSun.copy(sunNow).sub(centre).normalize()).add(toGaia).normalize(); // between the sun and Gaia
    else nearAhead.copy(toGaia);
    nearUp.copy(yAxis).addScaledVector(nearAhead, -yAxis.dot(nearAhead)).normalize(); // straight up, square to the view
    // Stand over the ground on the side away from the sky we look at, a little back, so the horizon arcs ahead and below.
    pos.copy(centre).addScaledVector(nearUp, r * (1 + alt)).addScaledVector(nearAhead, -r * 0.35);
    look.copy(pos).addScaledVector(nearAhead, 1000).addScaledVector(nearUp, -1000 * Math.tan(dip));
    up.copy(nearUp);
  }
  /** The far view of planet `id`: camera `pos`, the point it looks at and its up. */
  function far(id, pos, look, up) {
    bodyCentre(id, look);
    up.copy(yAxis);
    if (id === 'ares') {
      toGaia.copy(look).negate().normalize();
      toSun.copy(sunNow).sub(look).normalize();
      across.copy(toSun).sub(toGaia).normalize(); // screen right: from Gaia to the sun
      mid.copy(toGaia).add(toSun).normalize();
      lift.crossVectors(across, mid).normalize();
      if (lift.y < 0) { across.negate(); lift.negate(); } // keep the sky's up roughly up
      const tilt = 10 * Math.PI / 180;
      mid.multiplyScalar(Math.cos(tilt)).addScaledVector(lift, -Math.sin(tilt)).normalize(); // look a little below them
      up.crossVectors(across, mid).normalize();
      pos.copy(look).addScaledVector(mid, -SPACE_FRAME.ares * spaceSettings().distance);
      return;
    }
    pos.copy(look).addScaledVector(SPACE_VIEW_DIR, SPACE_FRAME[id] * spaceSettings().distance); // the planet sits centred, like Luna and Ares
  }
  /** The lens on a long trip: gently wider through the middle of the flight. */
  function tripFov(e) {
    if (!longTrip() || space.travel >= 1) return FOV;
    return FOV + Math.sin(Math.PI * e) * 16 * spaceSettings().aresZoom; // widens through the middle and eases back: no snap zoom on arrival
  }
  /** Blends the horizon view into the space view (`space.t`) and flies between planets (`space.travel`). */
  function applySpace() {
    if (focus) return;
    const k = ease(space.t), x = Math.min(1, space.travel), e = snap.on ? 1 - Math.pow(1 - x, 3) : ease(x); // a redirected flight is already moving
    worldDim.value = 1 + ((settings().backgroundDim ?? 1) - 1) * (1 - k); // Luna and Ares sit back in the horizon sky, full bright in space
    revolve(clock, k);
    sunBody.visible = k > 0.001;
    if (sunBody.visible) { sunBody.position.copy(sunNow); sunBody.userData.rays.rotation.z = reducedMotion ? 0 : clock * 0.12; }
    lunaSpacePosition(space.orbit, tmpA);
    luna.mesh.position.lerpVectors(home.luna.position, tmpA, k);
    luna.mesh.scale.setScalar(home.luna.scale + (SPACE_LUNA.radius - home.luna.scale) * k);
    // Ares stays put (owner, 2026-11-17): one planet at its place in the little solar system, behind Gaia from the sun, so from the
    // horizon it is out of sight below the limb, and going out into space only moves the camera. (The preview gallery's close look
    // still uses the stand-in placed in the sky.)
    ares.mesh.position.copy(aresNow);
    ares.mesh.scale.setScalar(SPACE_ARES.radius);
    ares.mesh.material.opacity = 1;
    aresAir.visible = k > 0.001;
    if (aresAir.visible) {
      const r = ares.mesh.scale.x, u = aresAir.material.uniforms;
      aresAir.position.copy(ares.mesh.position);
      aresAir.scale.setScalar(r * ARES_AIR.top * 1.01);
      u.centre.value.copy(ares.mesh.position); u.ground.value = r; u.top.value = r * ARES_AIR.top;
      u.toSun.value.copy(sunNow).sub(ares.mesh.position).normalize();
      u.fade.value = k;
    }
    deepSky.visible = k > 0.001;
    air.material.uniforms.ahead.value = k;
    renderer?.setClearColor?.(k > 0 ? SPACE_BACKDROP : 0x000000, k); // in space the canvas turns opaque deep space, hiding the page's blue horizon backdrop
    library.inkUniforms.ink.value = stats.ink * (1 - 0.75 * k); // tiny far objects would be all outline: thin the ink in space
    const ns = spaceSettings().nebula;
    for (const m of nebulae) m.opacity = ns * k * 0.9;
    if (k <= 0) { // the approved horizon view, untouched
      camera.position.set(0, framing.y, framing.z); camera.quaternion.identity();
      if (camera.fov !== FOV) { camera.fov = FOV; camera.updateProjectionMatrix(); }
      sky.quaternion.identity();
      return;
    }
    if (snap.on && space.travel >= 1) snap.on = false;
    if (snap.on) { camFrom.copy(snap.pos); lookFrom.copy(snap.look); upFrom.copy(snap.up); } else spaceCamera(space.from, camFrom, lookFrom, upFrom);
    spaceCamera(space.to, camTo, lookTo, upTo);
    spacePos.lerpVectors(camFrom, camTo, e); spaceLook.lerpVectors(lookFrom, lookTo, e); upNow.lerpVectors(upFrom, upTo, e).normalize();
    if (longTrip() && space.travel < 1) spacePos.addScaledVector(SPACE_VIEW_DIR, Math.sin(Math.PI * e) * (snap.on ? 1 - e : 1) * 900 * spaceSettings().aresZoom); // pull back mid-flight
    lookAtMatrix.lookAt(spacePos, spaceLook, upNow);
    poseQuat.setFromRotationMatrix(lookAtMatrix);
    camera.position.set(0, framing.y, framing.z).lerp(spacePos, k);
    camera.quaternion.slerpQuaternions(horizonQuat, poseQuat, k);
    const lens = snap.on ? snap.fov + (FOV - snap.fov) * e : tripFov(x); // the lens follows the flight's own clock, so it is wide while the camera travels
    camera.fov = FOV + (lens - FOV) * k;
    camera.updateProjectionMatrix();
    // The stars follow part of the camera's turn, so the sky drifts as it flies but its painted field never runs out.
    sky.quaternion.copy(poseQuat).invert().slerp(horizonQuat, 1 - 0.35 * k);
    sunBody.quaternion.copy(camera.quaternion); // the sun's disc faces the camera
  }

  function draw() {
    const { w, h } = viewport(), s = settings();
    fit(w, h, s);
    applySettings(s, w);
    followFocus();
    applySpace();
    renderer?.render?.(scene, camera);
  }

  /** A rare shooting star: waits a long random while, then crosses part of the upper sky in about a second. */
  function stepStreak(dt) {
    if (streakAge < 0) {
      nextStreak -= dt;
      if (nextStreak > 0) return;
      streakAge = 0; streakCount++;
      const a = Math.PI + 0.2 + random() * 0.5;
      Object.assign(streakPath, { x: (random() - 0.2) * 1.2, y: 0.5 + random() * 0.45, dx: Math.cos(a) * 0.9, dy: Math.sin(a) * 0.9 });
      streak.rotation.z = a + Math.PI;
      streak.scale.set(skyT * 0.26, skyT * 0.006, 1);
      streak.visible = true;
    }
    streakAge += dt;
    const life = streakAge / 1.1;
    streak.material.uniforms.life.value = Math.min(1, life);
    streak.position.set((streakPath.x + streakPath.dx * life) * skyT * 1.78, (streakPath.y + streakPath.dy * life) * skyT, -skyDistance * 0.97);
    if (life >= 1) { streak.visible = false; streakAge = -1; nextStreak = SHOOTING_GAP[0] + random() * (SHOOTING_GAP[1] - SHOOTING_GAP[0]); }
  }

  /** Advances the scene by `dt` seconds and redraws. Exposed so tests and the animation loop share one path. */
  function step(dt) {
    if (disposed) return;
    const s = settings();
    clock += dt;
    if (!reducedMotion) {
      spin = (spin + s.spinSpeed * dt) % 360;
      cloudSpin = (cloudSpin + s.spinSpeed * s.cloudDrift * dt) % 360;
      for (const m of [...planes, ...satellites, ...ships]) m.turn.rotation.y += m.speed * dt;
      for (const b of balloons) b.body.position.set(...b.dir).multiplyScalar(PLANET_RADIUS + 11 + Math.sin(clock * 0.5 + b.phase) * 0.5);
      for (const t of turbines) t.blades.rotation.x += t.speed * dt;
      luna.mesh.rotation.y += dt * 0.01;
      for (const o of orbiters) o.turn.rotation.y += o.speed * dt;
      stepStreak(dt);
    }
    const sp = spaceSettings();
    if (reducedMotion) { space.t = space.goal; space.travel = 1; space.near = space.nearGoal; }
    else {
      const homing = space.goal < space.t && (space.travel < 0.55 || space.near > 0.4); // back to the horizon: fly home first, then settle
      if (!homing) space.t = Math.max(0, Math.min(1, space.t + Math.sign(space.goal - space.t) * dt / 1.4));
      if (space.travel < 1) space.travel = Math.min(1, space.travel + dt / (sp.travelSeconds * (longTrip() ? 1.6 : 1)));
      if (space.t > 0) space.orbit = (space.orbit + dt / sp.orbitSeconds) % 1;
      space.near = Math.max(0, Math.min(1, space.near + Math.sign(space.nearGoal - space.near) * dt / (sp.travelSeconds * 1.2)));
    }
    draw();
  }

  // Frame budget: when two drawn frames land more than SLOW_FRAME_MS apart (software WebGL, an overloaded
  // machine), rest for RESTING times that gap before drawing again so input, timers and other pages still
  // get the main thread. The gap, not the time inside step(), is measured because the GPU work finishes
  // after step() returns. A real GPU never comes near the budget, so this never engages there.
  const SLOW_FRAME_MS = 100, RESTING = 6;
  let restUntil = 0, rested = false;

  function frame(now) {
    frameId = null;
    if (disposed) return;
    if (now < restUntil) { rested = true; frameId = win.requestAnimationFrame(frame); return; }
    const gap = last === null || rested ? 0 : now - last;
    rested = false;
    const dt = last === null ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    slowFrames = dt > 1 / 40 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
    if (slowFrames > 45 && quality > 0.6) { quality -= 0.2; slowFrames = 0; sizeKey = ''; } // a struggling machine draws fewer pixels rather than stutter
    step(dt);
    restUntil = gap > SLOW_FRAME_MS ? now + gap * RESTING : 0;
    frameId = win.requestAnimationFrame(frame);
  }

  return {
    /** Draws the first frame and, unless motion is reduced, starts the animation loop. */
    start() {
      if (disposed || frameId !== null) return;
      if (reducedMotion || !win?.requestAnimationFrame) { draw(); win?.addEventListener?.('resize', draw); return; }
      frameId = win.requestAnimationFrame(frame);
    },
    step,
    /**
     * The destination view (VIS-M4): `space` pulls the camera back from the horizon into space (or returns it), `target` flies to Gaia,
     * Luna or Ares, and `near` (off unless asked for, each call) brings the camera down to just above Ares or Luna, inside Ares's dusty air (owner, 2026-11-17: the
     * lobby rocket). Safe to call at any time; a still frame (reduced motion) jumps straight there.
     */
    setView({ space: inSpace = space.goal === 1, target = space.to, near = false } = {}) {
      if (!['gaia', 'luna', 'ares'].includes(target)) return;
      if (!inSpace) target = 'gaia'; // the horizon is Gaia's: leaving space always flies home first
      space.goal = inSpace ? 1 : 0;
      space.nearGoal = near ? 1 : 0;
      if (target !== space.to) {
        if (space.t > 0 && space.travel < 1) { // redirected mid-flight: leave from right here
          snap.on = true; snap.pos.copy(spacePos); snap.look.copy(spaceLook); snap.up.copy(upNow); snap.fov = FOV + (camera.fov - FOV) / Math.max(0.05, ease(space.t));
        } else snap.on = false;
        space.from = space.to;
        space.to = target;
        space.travel = space.t > 0 || inSpace ? 0 : 1;
      }
      if (reducedMotion) { space.t = space.goal; space.travel = 1; space.near = space.nearGoal; snap.on = false; draw(); }
    },
    /** Destination view state, for checks: blend into space (0..1), the planet shown, trip progress, Luna's orbit phase, lens and camera. */
    get space() { return { t: space.t, goal: space.goal, near: space.near, air: aresAir.visible ? aresAir.material.uniforms.fade.value : 0, from: space.from, to: space.to, travel: space.travel, orbit: space.orbit, fov: camera.fov, camera: camera.position.toArray(), luna: luna.mesh.position.toArray(), ares: ares.mesh.position.toArray(), aresRadius: ares.mesh.scale.x, sun: sunBody.visible ? sunBody.position.toArray() : null, light: sun.toArray(), nebula: nebulae[0]?.opacity ?? 0 }; },
    /** How many planes, ships and satellites the current settings show. */
    get traffic() { const s = settings(); return { planes: count(s.planes, MAX_PLANES), boats: Math.min(count(s.boats, MAX_BOATS), ships.length), satellites: count(s.satellites, MAX_SATELLITES) }; },
    /** What the last frame used, for checks. */
    get stats() { return { ...stats, cameraHeight: framing.y, shootingStars: streakCount, places: { cities: cities.length, towns: towns.length, villages: villages.length, ports: ports.length, plants: planet.plants.length, peaks: planet.peaks.length, volcanoes: volcanoes.length, flags: flags.length, lighthouses: lighthouses.length, turbines: turbines.length, balloons: balloons.length } }; },
    /** Measured size of one of each kind, in planet units: its tallest extent (or longest, for ships and planes), for the size audit. */
    get sizes() {
      scene.updateMatrixWorld(true);
      const measure = (mesh, axis = 'y') => { mesh.geometry.computeBoundingBox(); const b = mesh.geometry.boundingBox; return (b.max[axis] - Math.max(b.min[axis], axis === 'y' ? 0 : -1e9)) * mesh.getWorldScale(new THREE.Vector3()).x; };
      return { house: measure(villages[0].mesh), city: Math.max(...cities.map(c => measure(c.mesh))), town: measure(towns[0].mesh), mill: measure(turbines[0].mesh), lighthouse: measure(lighthouses[0].mesh), flag: measure(flags[0].mesh), volcano: measure(volcanoes[0].mesh), ship: measure(ships[0].body, 'x'), plane: measure(planes[0].body, 'x'), balloon: measure(balloons[0].body), tree: 2 * SIZES.plant, peak: SIZES.peakBase + SIZES.peakRise, peakMedian: peakHeights[Math.floor(peakHeights.length / 2)] ?? 0 };
    },
    /** Camera position: it never moves during a load. */
    get cameraPosition() { return camera.position.toArray(); },
    /** World positions of the clouds in the high deck that are showing. */
    get deck() { scene.updateMatrixWorld(true); return deckClouds.filter(m => m.visible).map(m => m.getWorldPosition(new THREE.Vector3()).toArray()); },
    /** Moving bodies, for checks: world position, forward (nose) and up of each. */
    bodies(kind) {
      scene.updateMatrixWorld(true);
      return ({ planes, ships, satellites })[kind].map(m => {
        const e = m.body.matrixWorld.elements, n = v => { const l = Math.hypot(...v); return v.map(q => q / l); };
        return { position: [e[12], e[13], e[14]], forward: n([e[0], e[1], e[2]]), up: n([e[4], e[5], e[6]]) };
      });
    },
    get cities() { return planet.cities; },
    get spin() { return spin; },
    get land() { return planet.land; },
    get texture() { return planet.rgb; },
    dispose() {
      disposed = true;
      win?.removeEventListener?.('resize', draw);
      if (frameId !== null) win?.cancelAnimationFrame?.(frameId);
      frameId = null;
      for (const resource of owned) resource.dispose?.();
      owned.clear();
      for (const mesh of instanced) mesh.dispose();
      library.dispose();
      renderer?.dispose?.();
      renderer?.forceContextLoss?.(); // release the context now: browsers cap live contexts and drop the oldest, which can be the game's
    },
  };
}
