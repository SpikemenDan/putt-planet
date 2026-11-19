/**
 * The lobby vehicle flying in the planet scene (owner, 2026-11-18: "make the rocket's movements actually natural"): one helicopter,
 * plane or rocket that is a real object in the planet scene's world, lit by its one sun, carried along with the camera as the camera
 * flies between planets (src/render/planet-scene.js, `setView`). Parked, it sits in the lobby's free area in its calm side-on pose.
 * A trip out into space waits for the helicopter or plane to hand over to a rocket (a quick cartoon dash). Then the rocket flies a real
 * path through the world (src/render/lobby-path.js, shaped by the planet scene): round the planet it leaves, across, and round behind
 * the planet ahead, seen from a wide view that holds all three planets. Hidden behind that planet (`trip.shown` false) while the camera
 * zooms in, it then slides in from the right to its parked spot and stops dead (owner, 2026-11-18). On the route it is drawn where it
 * really is, shrunk when far away and covered by a planet it passes behind; parked, it keeps circling as the planet turns under it. The
 * plane or helicopter takes over
 * again once it is home. Wind lines and wakes show only while it is inside a planet's air.
 *
 * Drawn in its own pass after the planets (depth cleared), so a planet never cuts through it while parked; on a trip the planets stand
 * in that pass as depth only, so it goes behind them. It uses the main camera's pose.
 */
import { createCraftKit, isRocket, BALL_RADIUS, SWAP, DASH, easeIn, easeOut, easeOutBack } from './lobby-craft.js';
import { sizeInk } from './outline.js';

/**
 * The vehicle's heading in its parked pose, before the sway: nose to the left, turned 0.24 toward the viewer. Gaia's horizon turns
 * left to right behind the lobby, so a nose pointing left flies forward over it (owner, 2026-11-17).
 */
const TURN = Math.PI + 0.24;
const CENTRE_PULL = 0.55; // 1 centres the vehicle in the free area between the panels, 0 on the screen
const LOBBY_EYE = [0.1, 0.32, 1]; // where the parked pose is seen from, per unit of distance: a little right and above
/**
 * Flying the route: the rocket is drawn along the line of sight to where it really is, never nearer than its parked distance (so never
 * bigger than parked) and no farther than `space.rocketFar` times it, so far away it reads as a small rocket rather than a speck
 * (owner, 2026-11-18: smaller, it "looks ginormous in perspective"). It banks `bank` per radian a second of turn, up to `maxBank`.
 */
const ROUTE = { near: 1, bank: 0.55, maxBank: 0.6 };

const clamp01 = v => Math.max(0, Math.min(1, v));
const smoother = v => v * v * v * (v * (v * 6 - 15) + 10);

/**
 * @param {object} options
 * @param {object} options.THREE
 * @param {{lobby: object}} options.display live settings (`display.lobby`: zoom, sway, bob, spinSeconds)
 * @param {boolean} [options.reducedMotion]
 */
export function createLobbyFlight({ THREE, display, reducedMotion = false }) {
  const kit = createCraftKit(THREE, { reducedMotion });
  const vScene = new THREE.Scene(), vCamera = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 4000);
  vScene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const light = new THREE.DirectionalLight(0xffffff, 2.6);
  vScene.add(light, light.target);
  const follow = new THREE.Group(); // stands where the camera stands, turned as it is: the vehicle's place is measured from the lens
  const body = new THREE.Group(); // the vehicle's own position and heading
  const frameOf = new THREE.Group(); // the parked lobby frame at the vehicle, for the wind lines
  follow.add(body, frameOf);
  frameOf.add(kit.wind);
  vScene.add(follow);
  // The planets, as depth only (owner, 2026-11-18: "physically make it go behind the planets"): drawn first and invisible, they cover
  // the rocket wherever a planet stands in front of it, a part at a time as it slips behind the limb. The rocket is drawn nearer than
  // it really is, so they are too: the whole world shrunk toward the lens by the same factor, which looks the same from the lens.
  const occluderShape = new THREE.SphereGeometry(1, 48, 32), occluderLook = new THREE.MeshBasicMaterial({ colorWrite: false });
  const occluders = [0, 1, 2].map(() => {
    const mesh = new THREE.Mesh(occluderShape, occluderLook);
    mesh.renderOrder = -10; mesh.visible = false; mesh.frustumCulled = false;
    follow.add(mesh);
    return mesh;
  });

  // The parked pose's view: seen from LOBBY_EYE, looking at the vehicle.
  const eye = new THREE.Vector3(...LOBBY_EYE), eyeDistance = eye.length();
  const lobbyView = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)));
  const lobbyViewInverse = lobbyView.clone().invert();

  let lobby = null, colors = [], craft = null, leaving = null, swap = SWAP, arriveAt = -1, frameHalf = null, frames = 0;
  let w = 0, bank = 0, airLevel = 1, lastInsets = -1, clock = 0;
  const insets = { left: 0, right: 0, top: 0, bottom: 0 }, screenSize = { width: 0, height: 0 };
  const stats = { vehicle: null, passengers: 0, swapping: false, trip: null, air: 0, chase: 0, frames: 0, nose: [-1, 0, 0], hidden: false, size: 1 };
  const noseC = new THREE.Vector3(-1, 0, 0), lastHeading = new THREE.Vector3(), atW = new THREE.Vector3(), ray = new THREE.Vector3(), m = new THREE.Vector3();
  /** The parked pose, camera space, before the bob: where a trip sets off from and which way the nose points. */
  const parked = { p: new THREE.Vector3(0, 0, -12), nose: new THREE.Vector3(-1, 0, 0.24).normalize() };
  const parkedTurn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, TURN, 0));
  const camQInv = new THREE.Quaternion();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const parkedQ = new THREE.Quaternion(), chaseQ = new THREE.Quaternion(), offAxis = new THREE.Quaternion(), rigQ = new THREE.Quaternion(), q1 = new THREE.Quaternion();
  const euler = new THREE.Euler(), basis = new THREE.Matrix4(), forward = new THREE.Vector3(0, 0, -1);
  const parkedP = new THREE.Vector3(), chaseP = new THREE.Vector3(), worldInv = new THREE.Matrix4();

  const setCraft = (kind, glide, timing = SWAP) => {
    swap = timing;
    if (glide && craft) { kit.disposeCraft(leaving?.craft); leaving = { craft, start: null }; } else kit.disposeCraft(craft);
    arriveAt = glide ? null : -1; // a glide starts on the next frame, from its clock
    craft = kit.makeCraft(kind, colors);
    craft.holder.visible = !glide; // a gliding arrival shows once its slide begins
    body.add(craft.holder);
    stats.vehicle = kind;
    stats.passengers = craft.balls.length;
  };
  const clear = () => {
    kit.disposeCraft(leaving?.craft); leaving = null;
    kit.disposeCraft(craft); craft = null;
    stats.vehicle = null; stats.passengers = 0;
  };

  /** The vehicle a trip needs: out in space it is always a rocket, staying one until it is home (owner, 2026-11-18). */
  const rideFor = (wanted, trip) => {
    if (isRocket(wanted) || !trip.inSpace) return wanted;
    if (craft && isRocket(craft.kind)) return craft.kind;
    return wanted === 'helicopter' ? 'minirocket' : 'rocket';
  };

  /** The rotation (camera space) that points a craft's nose (+x) along `dir`, its top toward the camera's up. */
  const facing = (dir, out) => {
    const x = v1.copy(dir).normalize(), z = v2.crossVectors(x, up);
    if (z.lengthSq() < 1e-6) z.set(0, 0, 1);
    z.normalize();
    return out.setFromRotationMatrix(basis.makeBasis(x, v3.crossVectors(z, x), z));
  };

  /**
   * One frame. `view` = { camera, sun (the sun's world position), width, height, ratio, dt, trip: { travelling, land, inSpace, weight,
   * shown (false hides it), position, heading (world, along the route), blockers: [{ centre, radius }] },
   * airAt(position) -> boolean }.
   */
  function update(view) {
    if (!lobby) { follow.visible = false; return; }
    follow.visible = true;
    const { camera, width, height, trip } = view;
    screenSize.width = width; screenSize.height = height;
    const l = display.lobby, dt = reducedMotion ? 1 : Math.min(0.1, Math.max(0, view.dt));
    clock += reducedMotion ? 0 : dt;
    const t = reducedMotion ? 0 : clock;
    const still = reducedMotion || frames === 0;
    // Which vehicle: the one asked for, or the rocket while out in space.
    const want = rideFor(lobby.vehicle, trip);
    if (!craft) setCraft(want, false);
    else if (want !== craft.kind && !leaving && arriveAt === -1) setCraft(want, !still, trip.travelling || trip.inSpace ? DASH : SWAP);
    if (still && leaving) { kit.disposeCraft(leaving.craft); leaving = null; arriveAt = -1; craft.holder.visible = true; }
    // The swap: the old vehicle speeds off ahead, the new one glides in from behind once the old one has started to go.
    if (leaving) {
      if (leaving.start === null) leaving.start = clock;
      const p = (clock - leaving.start) / swap.out;
      leaving.craft.holder.position.x = easeIn(Math.min(1, p)) * swap.reach;
      if (p >= 1) { kit.disposeCraft(leaving.craft); leaving = null; }
    }
    if (arriveAt === null) arriveAt = clock + (leaving ? swap.gap : 0);
    if (craft && arriveAt > 0) {
      const p = (clock - arriveAt) / swap.in;
      craft.holder.visible = p >= 0;
      craft.holder.position.x = -(1 - (swap === DASH ? easeOutBack : easeOut)(clamp01(p))) * swap.reach;
      if (p >= 1) { craft.holder.position.x = 0; arriveAt = -1; }
    }
    const swapping = !!leaving || arriveAt !== -1;

    // Panels can grow (a picker opens, a player joins): keep the framing current, a few times a second.
    if (lobby.insets && (still || clock - lastInsets > 0.4 || lastInsets < 0)) {
      lastInsets = clock;
      const next = lobby.insets();
      if (next) for (const k of ['left', 'right', 'top', 'bottom']) insets[k] = Math.max(0, Number(next[k]) || 0);
    }
    // The framing eases to the new vehicle's size rather than jumping.
    const half = craft.model.half;
    if (!frameHalf || still) frameHalf = { ...half };
    const fit = Math.min(1, dt * 2.2);
    frameHalf.x += (half.x - frameHalf.x) * fit; frameHalf.y += (half.y - frameHalf.y) * fit;
    const tan = Math.tan(camera.fov * Math.PI / 360), aspect = width / height;
    const freeW = Math.max(120, width - insets.left - insets.right), freeH = Math.max(120, height - insets.top - insets.bottom);
    const dist = Math.max(frameHalf.x / (tan * freeW / height), frameHalf.y / (tan * freeH / height)) * 1.08 / l.zoom;
    const depth = dist * eyeDistance;
    // Parked: centred between the panels (pulled part of the way toward the middle of the screen), seen as the lobby always saw it.
    const offX = (insets.right - insets.left) / 2 * CENTRE_PULL, offY = (insets.bottom - insets.top) / 2 * CENTRE_PULL;
    parkedP.set(-offX / width * 2 * depth * tan * aspect, offY / height * 2 * depth * tan, -depth);
    offAxis.setFromUnitVectors(forward, v1.copy(parkedP).normalize());
    // Calm flight (owner, 2026-11-17/18): one long slow swell, the nose easing up as it climbs and down as it sinks, a slow wide sway,
    // and in air a faint unhurried roll.
    const swell = Math.sin(t * 0.6), drift = Math.sin(t * 0.23 + 0.7);
    euler.set((Math.sin(t * 0.31 + 0.4) * 0.008 + Math.sin(t * 0.53 + 2.0) * 0.004) * (0.35 + 0.65 * airLevel),
      TURN + (Math.sin(t * 0.27) * 0.8 + Math.sin(t * 0.11 + 1.1) * 0.2) * l.sway * Math.PI / 180, Math.cos(t * 0.6) * l.bob * 0.22);
    rigQ.setFromEuler(euler);
    frameOf.quaternion.copy(offAxis).multiply(lobbyViewInverse);
    frameOf.position.copy(parkedP);
    parkedQ.copy(frameOf.quaternion).multiply(rigQ);
    parked.p.copy(parkedP);
    parked.nose.set(1, 0, 0).applyQuaternion(parkedTurn).applyQuaternion(frameOf.quaternion);
    parkedP.add(v1.set(0, (swell * 0.85 + drift * 0.15) * l.bob, 0).applyQuaternion(frameOf.quaternion));

    // Flying: how far from the parked pose onto the route (0 parked, 1 on it), as the planet scene eases it.
    w = trip.weight > 0 && trip.position ? clamp01(trip.weight) : 0;
    camera.updateMatrixWorld();
    worldInv.copy(camera.matrixWorld).invert();
    camQInv.copy(camera.quaternion).invert();
    let hidden = false, size = 1;
    for (const o of occluders) o.visible = false;
    if (w > 0) {
      // Where it really is, seen along the line of sight at a drawable distance.
      chaseP.copy(trip.position).applyMatrix4(worldInv);
      const far = Math.max(ROUTE.near, display.space?.rocketFar ?? 8);
      const real = chaseP.length(), shown = Math.max(depth * ROUTE.near, Math.min(real, depth * far));
      chaseP.multiplyScalar(shown / Math.max(1e-6, real));
      size = 1 + (depth / shown - 1) * w; // drawn size against parked
      chaseP.y += Math.sin(t * 1.1 + 0.5) * 0.015 * depth; // a bob the size of the parked one, so far away it never lifts it out from behind a planet
      // Nose along the route; banking into the turn from how fast the heading swings round.
      noseC.copy(trip.heading).applyQuaternion(camQInv).normalize();
      const upW = v1.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const yawRate = dt > 0 && lastHeading.lengthSq() > 0 ? v3.crossVectors(lastHeading, trip.heading).dot(upW) / dt : 0;
      lastHeading.copy(trip.heading);
      const bankTo = reducedMotion ? 0 : Math.max(-ROUTE.maxBank, Math.min(ROUTE.maxBank, -yawRate * ROUTE.bank));
      bank += (bankTo - bank) * Math.min(1, dt * 3);
      facing(noseC, chaseQ);
      chaseQ.multiply(q1.setFromAxisAngle(v1.set(1, 0, 0), bank + Math.sin(t * 0.9) * 0.04));
      chaseQ.multiply(q1.setFromAxisAngle(v1.set(0, 0, 1), Math.sin(t * 0.7 + 1) * 0.03));
      // The planets it can pass behind, shrunk toward the lens as the rocket is; and, for checks, whether its centre is behind one.
      const shrink = shown / Math.max(1e-6, real);
      ray.subVectors(trip.position, camera.position).divideScalar(Math.max(1e-6, real));
      (trip.blockers ?? []).forEach(({ centre, radius }, k) => {
        const o = occluders[k];
        if (!o) return;
        o.visible = true;
        o.position.copy(centre).applyMatrix4(worldInv).multiplyScalar(shrink);
        o.scale.setScalar(radius * shrink);
        m.subVectors(camera.position, centre);
        const b = m.dot(ray), c = m.lengthSq() - radius * radius, disc = b * b - c;
        if (c > 0 && disc > 0 && -b - Math.sqrt(disc) > 0 && -b - Math.sqrt(disc) < real) hidden = true;
      });
    } else { lastHeading.set(0, 0, 0); bank = 0; }
    body.position.lerpVectors(parkedP, chaseP, w);
    if (w > 0) body.quaternion.slerpQuaternions(parkedQ, chaseQ, w); else body.quaternion.copy(parkedQ);
    follow.position.copy(camera.position);
    follow.quaternion.copy(camera.quaternion);
    frameOf.visible = w < 0.5;
    body.visible = !(w > 0 && trip.shown === false); // out of sight behind the planet ahead while the camera zooms in
    vScene.updateMatrixWorld(true);

    // Air: only inside a planet's air shell, from where the vehicle really is.
    const at = atW.copy(parkedP).applyMatrix4(camera.matrixWorld);
    if (w > 0) at.lerp(trip.position, w);
    const inAir = view.airAt(at);
    airLevel += ((inAir ? 1 : 0) - airLevel) * (reducedMotion ? 1 : Math.min(1, dt * 1.2));
    kit.animateWind(t, airLevel * (1 - w), craft.kind);
    animate(craft, t, l, w);
    if (leaving) animate(leaving.craft, t, l, w);

    // The one sun lights the vehicle, from wherever it is.
    light.position.copy(view.sun).sub(at).normalize().multiplyScalar(100).add(at);
    light.target.position.copy(at);
    light.target.updateMatrixWorld();
    // The lens: the main camera's pose, a near plane for small things.
    vCamera.position.copy(camera.position);
    vCamera.quaternion.copy(camera.quaternion);
    if (vCamera.fov !== camera.fov || vCamera.aspect !== aspect) { vCamera.fov = camera.fov; vCamera.aspect = aspect; vCamera.updateProjectionMatrix(); }
    vCamera.updateMatrixWorld();
    sizeInk(kit.inkUniforms, width * view.ratio, height * view.ratio);
    kit.inkUniforms.ink.value = Math.max(2, Math.min(width, 1600) * view.ratio * 3.2 / 1280);

    stats.swapping = swapping || w > 0.01;
    stats.trip = trip.travelling ? (trip.land > 0 ? 'arriving' : 'travelling') : null;
    stats.air = airLevel; stats.chase = w; stats.hidden = hidden; stats.size = size; stats.out = !body.visible; stats.covers = occluders.filter(o => o.visible).length;
    const ahead = Math.max(1e-6, -body.position.z);
    stats.screen = [body.position.x / ahead / (tan * aspect), body.position.y / ahead / tan]; // where it is drawn, -1..1 across the view
    // Whether the rocket, as drawn, has a planet in front of its centre (what the viewer sees, not where it really is).
    stats.covered = occluders.some(o => {
      if (!o.visible) return false;
      const d = body.position.length(), along = o.position.dot(body.position) / Math.max(1e-6, d), r = o.scale.x;
      return along < d && o.position.lengthSq() - along * along < r * r && o.position.length() - r < d;
    });
    const seen = v2.set(1, 0, 0).applyQuaternion(body.quaternion);
    stats.nose = [seen.x, seen.y, seen.z];
    stats.frames = ++frames;
    if (lobby.onAnchors) lobby.onAnchors(anchors(width, height), { width, height });
  }
  const animate = (c, t, l, thrust) => {
    kit.animateCraft(c, t, l, airLevel, thrust);
    c.balls.forEach((b, k) => { b.position.y = c.model.seats[b.userData.seat].y + (reducedMotion ? 0 : (0.5 - 0.5 * Math.cos(t * 1.2 + k * 0.9)) * 0.025); });
  };
  /** Each ball's place on screen, for the name tags; none while the vehicle is flying (seen from behind) or not yet in. */
  function anchors(width, height) {
    const out = [];
    if (!craft || !craft.holder.visible || w > 0.02) return out;
    const toScreen = p => { p.project(vCamera); return { x: (p.x + 1) / 2 * width, y: (1 - p.y) / 2 * height }; };
    const upW = new THREE.Vector3(0, 1, 0).applyQuaternion(frameOf.getWorldQuaternion(new THREE.Quaternion()));
    for (const b of craft.balls) {
      const p = b.getWorldPosition(new THREE.Vector3());
      const centre = toScreen(p.clone()), top = toScreen(p.clone().addScaledVector(upW, BALL_RADIUS));
      const below = toScreen(p.clone().addScaledVector(upW, -craft.model.drop)), above = toScreen(p.clone().addScaledVector(upW, BALL_RADIUS + (craft.model.rise ?? 0)));
      out.push({ seat: b.userData.seat, x: centre.x, y: centre.y, r: Math.max(4, centre.y - top.y), below, above });
    }
    return out;
  }

  return {
    stats,
    get active() { return !!lobby && !!craft; },
    /** The parked pose (camera space, `p` and `nose`), once it has been drawn, for a trip to set off from. */
    get parked() { return lobby && frames > 0 ? parked : null; },
    /**
     * The part of the view no lobby panel covers (owner, 2026-11-18: the rocket went behind the boarding pass), as its centre
     * (`x`, `y`) and half size (`w`, `h`) in -1..1 view units, for a trip to keep the rocket inside; null with no lobby.
     */
    get free() {
      const { width, height } = screenSize;
      if (!lobby || !width || !height) return null;
      const w = Math.max(120, width - insets.left - insets.right) / width, h = Math.max(120, height - insets.top - insets.bottom) / height;
      return { x: (insets.left - insets.right) / width, y: (insets.bottom - insets.top) / height, w, h };
    },
    /**
     * Shows the lobby vehicle (`{vehicle, colors, insets(), onAnchors(anchors, {width, height})}`), updates it, or (null) removes it.
     * `colors` is one CSS colour per seat, null for an empty seat.
     */
    set(next) {
      if (!next) { if (lobby?.onAnchors) lobby.onAnchors([], { width: 0, height: 0 }); lobby = null; clear(); frames = 0; w = 0; bank = 0; frameHalf = null; lastInsets = -1; return; }
      const fresh = !lobby;
      lobby = { ...lobby, ...next };
      if (fresh) lastInsets = -1;
      if (next.colors) {
        colors = [...next.colors];
        if (craft) { kit.seatBalls(craft, colors); stats.passengers = craft.balls.length; }
      }
    },
    update,
    /**
     * True while a trip should wait for the vehicle: it is changing, or (`goingOut`, bound for space) it still has to become a rocket.
     */
    holds(goingOut) {
      if (!lobby || !craft || reducedMotion) return false;
      if (leaving || arriveAt !== -1) return true;
      return !!goingOut && rideFor(lobby.vehicle, { inSpace: true }) !== craft.kind;
    },
    /** Draws the vehicle over what is already drawn, keeping the colour and clearing only depth. */
    render(renderer) {
      if (!lobby || !craft) return;
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth?.();
      renderer.render(vScene, vCamera);
      renderer.autoClear = auto;
    },
    dispose() { clear(); kit.dispose(); occluderShape.dispose(); occluderLook.dispose(); lobby = null; },
  };
}
