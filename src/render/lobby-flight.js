/**
 * The lobby vehicle flying in the planet scene (owner, 2026-11-18: "make the rocket's movements actually natural"): one helicopter,
 * plane or rocket that is a real object in the planet scene's world, lit by its one sun, carried along with the camera as the camera
 * flies between planets (src/render/planet-scene.js, `setView`). Parked, it sits in the lobby's free area in its calm side-on pose.
 * When a trip starts it accelerates away, turns smoothly to point its nose at the planet ahead, banks into the turns, and as the
 * camera comes round into the destination view it swings back side-on and settles, both coming to rest together. A rocket takes the
 * trips out into space and the plane or helicopter takes over again once it is home, with a cartoon poof (the old one squashes away in a puff of cloud, the new one pops out of it). Wind lines and wakes
 * show only while it is inside a planet's air.
 *
 * Drawn in its own pass after the planets (depth cleared), so a planet never cuts through it; it uses the main camera's pose.
 */
import { createCraftKit, isRocket, BALL_RADIUS, SWAP, DASH, easeIn, easeOutBack } from './lobby-craft.js';
import { sizeInk } from './outline.js';

/**
 * The vehicle's heading in its parked pose, before the sway: nose to the left, turned 0.24 toward the viewer. Gaia's horizon turns
 * left to right behind the lobby, so a nose pointing left flies forward over it (owner, 2026-11-17).
 */
const TURN = Math.PI + 0.24;
const CENTRE_PULL = 0.55; // 1 centres the vehicle in the free area between the panels, 0 on the screen
const LOBBY_EYE = [0.1, 0.32, 1]; // where the parked pose is seen from, per unit of distance: a little right and above
const HOP_LEAVE = 0.8; // seconds a hopping vehicle takes to zip off the left of the screen, once any vehicle change is done
const CHASE = { depth: 0.95, drop: 0.16, side: 0.35, turn: 3, bank: 0.55, maxBank: 0.7, spring: 7, rise: 0.9 };

const clamp01 = v => Math.max(0, Math.min(1, v));
const smoother = v => v * v * v * (v * (v * 6 - 15) + 10);

/**
 * @param {object} options
 * @param {object} options.THREE
 * @param {{lobby: object, space: object}} options.display live settings (`display.lobby`: zoom, sway, bob, spinSeconds; `display.space.hopSlide`)
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

  // The parked pose's view: seen from LOBBY_EYE, looking at the vehicle.
  const eye = new THREE.Vector3(...LOBBY_EYE), eyeDistance = eye.length();
  const lobbyView = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)));
  const lobbyViewInverse = lobbyView.clone().invert();

  let lobby = null, colors = [], craft = null, leaving = null, swap = SWAP, arriveAt = -1, frameHalf = null, frames = 0;
  let hopFrom = -1, hopOff = 0, hopAway = false, hopIn = -1; // hopAway: off the left edge, waiting; hopIn: when it began to fly back in
  let w = 0, wv = 0, chaseIn = 0, bank = 0, airLevel = 1, lastInsets = -1, clock = 0;
  const insets = { left: 0, right: 0, top: 0, bottom: 0 };
  const stats = { vehicle: null, passengers: 0, swapping: false, trip: null, air: 0, chase: 0, frames: 0, hop: null, nose: [-1, 0, 0] };
  const noseC = new THREE.Vector3(-1, 0, 0), lastNoseW = new THREE.Vector3(), haveNose = { on: false };
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const parkedQ = new THREE.Quaternion(), chaseQ = new THREE.Quaternion(), offAxis = new THREE.Quaternion(), rigQ = new THREE.Quaternion(), q1 = new THREE.Quaternion();
  const euler = new THREE.Euler(), basis = new THREE.Matrix4(), forward = new THREE.Vector3(0, 0, -1);
  const parkedP = new THREE.Vector3(), chaseP = new THREE.Vector3(), aimC = new THREE.Vector3(), worldInv = new THREE.Matrix4();

  // The poof's cloud: a handful of soft white balls that billow out from the vehicle and fade.
  const puffLook = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
  const puffShape = new THREE.IcosahedronGeometry(1, 2);
  const PUFFS = 9;
  const puffs = Array.from({ length: PUFFS }, (_, k) => {
    const a = k / PUFFS * Math.PI * 2 + (k % 2) * 0.4;
    const mesh = new THREE.Mesh(puffShape, puffLook.clone());
    mesh.visible = false; mesh.renderOrder = 5;
    body.add(mesh);
    return { mesh, dir: new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.7, ((k * 7) % 5 - 2) * 0.18), size: 0.55 + ((k * 5) % 4) * 0.15 };
  });
  let puffAt = -1, puffHalf = 1;
  /** One frame of the cloud, `p` 0..1 through it: the balls burst out fast, grow, then thin away. */
  const stepPuff = p => {
    const on = p >= 0 && p < 1;
    for (const { mesh, dir, size } of puffs) {
      mesh.visible = on;
      if (!on) continue;
      const out = 1 - Math.pow(1 - p, 3), r = puffHalf * (0.25 + 0.75 * out);
      mesh.position.copy(dir).multiplyScalar(r);
      mesh.scale.setScalar(puffHalf * size * (0.35 + 0.55 * Math.sin(Math.min(1, p * 1.4) * Math.PI / 2)) * (1 - 0.4 * p));
      mesh.material.opacity = 0.95 * (1 - p * p);
    }
  };
  const setCraft = (kind, glide, timing = SWAP) => {
    swap = timing;
    if (glide && craft) { kit.disposeCraft(leaving?.craft); leaving = { craft, start: null }; puffAt = null; puffHalf = Math.max(craft.model.half.x, craft.model.half.y) * 0.9; } else kit.disposeCraft(craft);
    arriveAt = glide ? null : -1; // a glide starts on the next frame, from its clock
    craft = kit.makeCraft(kind, colors);
    craft.holder.visible = !glide; // a poofed arrival shows once it starts to pop out
    body.add(craft.holder);
    stats.vehicle = kind;
    stats.passengers = craft.balls.length;
  };
  const clear = () => {
    hopAway = false; hopFrom = -1; hopIn = -1;
    kit.disposeCraft(leaving?.craft); leaving = null; puffAt = -1; stepPuff(-1);
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
   * One frame. `view` = { camera, sun (the sun's world position), width, height, ratio, dt, trip: { travelling, land, inSpace, aim (world) },
   * airAt(position) -> boolean }.
   */
  function update(view) {
    if (!lobby) { follow.visible = false; return; }
    follow.visible = true;
    const { camera, width, height, trip } = view, l = display.lobby, dt = reducedMotion ? 1 : Math.min(0.1, Math.max(0, view.dt));
    clock += reducedMotion ? 0 : dt;
    const t = reducedMotion ? 0 : clock;
    const still = reducedMotion || frames === 0;
    // Which vehicle: the one asked for, or the rocket while out in space.
    const want = rideFor(lobby.vehicle, trip);
    if (!craft) setCraft(want, false);
    // A hop (planet-scene.js): the vehicle leaves as it is, changes while out of sight, and flies back in from the right at the end.
    if (!trip.hop && hopAway) {
      hopAway = false; hopFrom = -1;
      if (want !== craft.kind) setCraft(want, false);
      hopIn = still ? -1 : clock;
    }
    if (trip.hop) hopIn = -1;
    if (trip.hop && !hopAway) { /* leaving: no change on screen */ }
    else if (want !== craft.kind && !leaving && arriveAt === -1) setCraft(want, !still && !hopAway, trip.travelling || trip.inSpace ? DASH : SWAP);
    if (still && leaving) { kit.disposeCraft(leaving.craft); leaving = null; arriveAt = -1; puffAt = -1; craft.holder.visible = true; craft.holder.scale.set(1, 1, 1); }
    // The poof: the old vehicle squashes flat and wide, then shrinks to nothing in a puff of cloud; the new one pops out of the puff,
    // overshooting and wobbling, taller then wider, as it settles.
    if (puffAt === null) puffAt = clock;
    if (leaving) {
      if (leaving.start === null) leaving.start = clock;
      const p = clamp01((clock - leaving.start) / swap.out), s = 1 - easeIn(p), squash = Math.sin(Math.min(1, p * 1.6) * Math.PI / 2);
      leaving.craft.holder.scale.set(s * (1 + 0.45 * squash), s * (1 - 0.4 * squash), s * (1 + 0.45 * squash));
      if (p >= 1) { kit.disposeCraft(leaving.craft); leaving = null; }
    }
    if (arriveAt === null) arriveAt = clock + swap.out * 0.6 + swap.gap;
    if (craft && arriveAt > 0) {
      const p = (clock - arriveAt) / swap.in, u = clamp01(p), g = easeOutBack(u), wob = Math.sin(u * Math.PI * 2.5) * (1 - u) * 0.18;
      craft.holder.visible = p >= 0;
      craft.holder.scale.set(Math.max(1e-3, g * (1 - wob)), Math.max(1e-3, g * (1 + wob)), Math.max(1e-3, g * (1 - wob)));
      if (p >= 1) { craft.holder.scale.set(1, 1, 1); arriveAt = -1; }
    }
    if (puffAt >= 0) { const p = (clock - puffAt) / swap.puff; stepPuff(p); if (p >= 1) puffAt = -1; } else stepPuff(-1);
    const swapping = !!leaving || arriveAt !== -1 || puffAt >= 0;

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
    parkedP.add(v1.set(0, (swell * 0.85 + drift * 0.15) * l.bob, 0).applyQuaternion(frameOf.quaternion));

    // Flying: how far into the chase pose (0 parked, 1 chasing). It eases in once any vehicle change is done, and back out in step with
    // the camera settling into the destination view (`land`), so both come to rest together. A spring keeps every change soft.
    if (trip.travelling && !swapping) chaseIn = Math.min(1, chaseIn + dt / CHASE.rise);
    if (!trip.travelling) chaseIn = 0;
    const target = smoother(chaseIn) * (1 - trip.land);
    if (reducedMotion) { w = target; wv = 0; } else {
      const k = CHASE.spring;
      wv += (k * k * (target - w) - 2 * k * wv) * dt;
      w = clamp01(w + wv * dt);
    }
    if (w < 1e-4 && target === 0) { w = 0; wv = 0; }
    // A hop (planet-scene.js, HOPS): no chase. The vehicle keeps its parked pose, nose left, and slides off the left edge (speeding up)
    // while the camera holds still, then stays out of sight until it is revealed.
    const hop = trip.hop;
    if (hop) { w = 0; wv = 0; chaseIn = 0; } else hopFrom = -1;
    // Chasing: ahead of the camera and a little below, nose turned toward the planet it is bound for, banking into the turns.
    camera.updateMatrixWorld();
    worldInv.copy(camera.matrixWorld).invert();
    chaseP.set(parkedP.x * CHASE.side, -CHASE.drop * depth, -depth * CHASE.depth);
    aimC.copy(trip.aim).applyMatrix4(worldInv);
    const wantNose = aimC.z < -1 ? v2.copy(aimC).sub(chaseP).normalize() : v2.set(0, 0, -1);
    if (!haveNose.on || w === 0) { noseC.set(1, 0, 0).applyQuaternion(parkedQ); haveNose.on = true; }
    noseC.lerp(wantNose, Math.min(1, dt * CHASE.turn)).normalize();
    // Bank from how fast the nose swings round in the world: turning left, the left wing dips.
    const noseW = v3.copy(noseC).applyQuaternion(camera.quaternion);
    const upW = v1.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const yaw = dt > 0 && lastNoseW.lengthSq() > 0 ? new THREE.Vector3().crossVectors(lastNoseW, noseW).dot(upW) / dt : 0;
    lastNoseW.copy(noseW);
    const bankTo = Math.max(-CHASE.maxBank, Math.min(CHASE.maxBank, -yaw * CHASE.bank)) * (reducedMotion ? 0 : 1);
    bank += (bankTo - bank) * Math.min(1, dt * 2.5);
    facing(noseC, chaseQ);
    chaseQ.multiply(q1.setFromAxisAngle(v1.set(1, 0, 0), bank + Math.sin(t * 0.9) * 0.05));
    chaseQ.multiply(q1.setFromAxisAngle(v1.set(0, 0, 1), Math.sin(t * 0.7 + 1) * 0.04)); // the nose bobs gently as it flies
    chaseP.x += Math.sin(t * 0.8) * 0.03 * depth;
    chaseP.y += Math.sin(t * 1.1 + 0.5) * 0.02 * depth;
    body.position.lerpVectors(parkedP, chaseP, w);
    body.quaternion.slerpQuaternions(parkedQ, chaseQ, w);
    hopOff = 0;
    if (hop || hopIn >= 0) {
      const span = 2 * depth * tan * aspect * 1.15; // a little over the screen's width at the parked distance: fully off either edge
      if (hop) { // leaving: off the left edge, speeding up
        if (hopFrom < 0 && !swapping) hopFrom = clock;
        const q = hopAway ? 1 : hopFrom < 0 ? 0 : reducedMotion ? 1 : clamp01((clock - hopFrom) / HOP_LEAVE);
        if (q >= 1) hopAway = true;
        hopOff = -q * q * q * span;
      } else { // arriving: in from the right edge, easing to rest in its spot
        const p = reducedMotion ? 1 : clamp01((clock - hopIn) / Math.max(0.05, display.space?.hopSlide ?? 0.8));
        hopOff = Math.pow(1 - p, 3) * span;
        if (p >= 1) hopIn = -1;
      }
      body.position.x += hopOff;
      hopOff /= span / 1.15; // in screen widths, for the stats
    }
    follow.position.copy(camera.position);
    follow.quaternion.copy(camera.quaternion);
    frameOf.visible = w < 0.5;
    vScene.updateMatrixWorld(true);

    // Air: only inside a planet's air shell, from where the vehicle really is.
    const at = body.getWorldPosition(new THREE.Vector3());
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
    stats.air = airLevel; stats.chase = w;
    stats.hop = trip.hop || hopOff !== 0 ? hopOff : null; // screen widths from the parked spot (negative: off to the left, positive: coming in from the right)
    stats.nose = v1.set(1, 0, 0).applyQuaternion(body.quaternion).toArray(); // camera space: x < 0 points left
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
    if (!craft || !craft.holder.visible || w > 0.02 || hopOff !== 0) return out;
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
    /**
     * Shows the lobby vehicle (`{vehicle, colors, insets(), onAnchors(anchors, {width, height})}`), updates it, or (null) removes it.
     * `colors` is one CSS colour per seat, null for an empty seat.
     */
    set(next) {
      if (!next) { if (lobby?.onAnchors) lobby.onAnchors([], { width: 0, height: 0 }); lobby = null; clear(); frames = 0; w = 0; wv = 0; chaseIn = 0; frameHalf = null; lastInsets = -1; return; }
      const fresh = !lobby;
      lobby = { ...lobby, ...next };
      if (fresh) lastInsets = -1;
      if (next.colors) {
        colors = [...next.colors];
        if (craft) { kit.seatBalls(craft, colors); stats.passengers = craft.balls.length; }
      }
    },
    update,
    /** Draws the vehicle over what is already drawn, keeping the colour and clearing only depth. */
    render(renderer) {
      if (!lobby || !craft) return;
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth?.();
      renderer.render(vScene, vCamera);
      renderer.autoClear = auto;
    },
    dispose() { clear(); kit.dispose(); puffShape.dispose(); for (const { mesh } of puffs) mesh.material.dispose(); puffLook.dispose(); lobby = null; },
  };
}
