# Level audit: all 40 maps before the redesign

Audit only. No geometry, course data or `src/` file was changed. The owner asked for an honest look at every map before redesigning all of them once the current visual work lands. This document records what each map is today, what the existing solver evidence says about it, and where its design falls short. It ends with a proposed redesign order and design principles for the owner to approve.

## Method and evidence

- **Course data:** `createCourseData()` from `src/courses/index.js` on main `a315407`. Coordinates are simulation units: x right, y down in the images, z up. Chambers in the 3 × 2 maps are about 228 × 192 inside their walls. Lane maps (2 × 3) use lanes of about 348 × 128.
- **Images:** one top-down PNG per map in [level-audit/](level-audit/), rendered by [level-audit/render.mjs](level-audit/render.mjs) (SVG rasterised by Playwright at deviceScaleFactor 1 and reduced to 48 colours; 428 KB in total). White squares mark tees and black-centred circles mark cups, numbered by putt. Dashed lines trace the recorded solver route at hazard time 0: long dashes for the first stroke, short dots for later strokes. Only maps 22–39 and Grand Finale putts 1 and 3 have recorded routes. Key: dark brown = wall, near-black = pit or crater, orange = ramp (the arrow points uphill; `0→30 L` means rising from z 0 to z 30 with a launch profile), violet = raised platform (`z24` is its height), pink J = jump pad, purple ring = portal (pairs share a number), blue dashed box = fan (arrow shows the push), orange dashed box = wind zone, grey disc = tornado (inner ring = lift core), red bar = moving block (pale box = its travel), sand / pale blue ice / lime slime, yellow `?` = power-up block.
- **Par evidence (not re-measured):**
  - Maps 22–39: [tests/fixtures/world-maps/par-routes.json](../../tests/fixtures/world-maps/par-routes.json) (SV1 fast search, each map at its own world's gravity). `node tests/world-maps.test.cjs` passed on this branch: the report is current and replays (Gaia 12 putts, 11 one-stroke; Ares 48, 42 one-stroke; Luna 48, 41 one-stroke).
  - Maps 0–21: the Q1 fast sweep summarised in [Q1_RELEASE.md](Q1_RELEASE.md) (robust 1-stroke routes unless listed), and the B4 full-grid hit counts in [tests/fixtures/difficulty-b4.json](../../tests/fixtures/difficulty-b4.json) for the six legacy starter maps. A B4 count is the number of grid shots (720 angles × 15 powers = 10,800 per putt) that sink in one stroke. B4 predates the S3 physics retune, so the counts show relative forgiveness only.
  - Known gaps: Comet Run (18) has no robust route with the full grid exhausted; Clockwork Maze (4) ran out of its trial budget. Hourglass (13) needs 3 strokes against par 3, and Crescent Coast (16) needs 4 against par 5 (both found only with `--full`).
- **No solver sweeps were run for this audit.** The facts that needed no new measurement came from course data (`node tools/cli/main.mjs check` passes on all 40 maps).
- **Playable pool:** `STARTER_COURSE_INDICES` (src/shared/constants.js) is 0, 5, 8, 19, 20, 21 and 22–39. The 16 single-putt legacy maps (1–4, 6, 7, 9–18) sit on the Gaia atlas (`REGION_COURSES`), but map cards and votes do not offer them (Q1_RELEASE.md).

**Scores** are 1–5 (5 is best) on four axes. **Fun:** would a group enjoy replaying it? **Clarity:** can a player read the route, tee and cup from the tee? **Fairness:** are failures caused by the player, not by unseen, timing-based or off-edge hazards? **Variety:** do the six putts differ from each other and from other maps? These are design judgements from the data and images, not playtest results. **Verdicts:** *keep with tweaks*, *rework* (keep the theme and some putts, rebuild the layout) or *replace* (start again; reuse the name or idea at most).

**Par notation:** "R" is the recorded robust route length, so `R 1/1/1/1/1/1` means every putt has a robust hole-in-one. `*` marks a putt whose route has no slack (route length equals par).

## Gaia

Gaia has 24 maps in six regions. Only 8 of them are six-putt maps that players can actually choose: 0, 5, 8, 19, 20 and 21 (legacy) and 22 and 23 (VIS-G). The other 16 are legacy single-putt holes on bare floating tiles. They do not fit the six-putt match format and no mode offers them. Gaia's real playable content is therefore 8 maps, and 5 of those share one chamber template (see "Cross-map findings").

### 0 · Switchback Garden: temperate

![Switchback Garden](level-audit/00-switchback-garden.png)

- **Mechanics:** walls; one pit (376,322 60×66).
- **Par:** 2 on all six putts (12). R 1 on every putt (Q1). B4: 768–1251 of 10,800 grid shots sink per putt, the most forgiving map in the game.
- **Problems:**
  - All six putts use one idea: tee on the left of a chamber, cup on the right, and one wall stub between them. Putts 1, 3 and 5 are 160 units straight across; putts 2, 4 and 6 are the same 206-unit diagonal.
  - The pit in putt 5 sits beside the line, not on it, so it never threatens.
  - Most of each chamber is dead lawn: putt 1 uses the top 60 units of a 192-unit chamber.
  - It is a fine first tutorial hole but repeats the lesson six times.
- **Scores:** fun 2 · clarity 5 · fairness 5 · variety 1.
- **Verdict:** **rework**. Keep it as the gentle opener, with six different teaching putts (bank, pit carry, gentle slope, chicane).

### 1 · Clover Crossing: temperate (single putt, not in pool)

![Clover Crossing](level-audit/01-clover-crossing.png)

- **Mechanics:** a crosswind fan over the hub (280,185 240×130, pushing north at 170); two staggered walls (365,180) and (435,235) form a chicane.
- **Par:** 3; R 2.
- **Problems:**
  - The north and south lobes (290,40 and 290,325, each 220×135) hold only the two `?` blocks: about 60,000 square units of dead space.
  - There are no edge walls. The fan's only effect is to push the ball north off the line, so the hole is "fight the fan" once.
- **Scores:** fun 2 · clarity 3 · fairness 3 · variety 1.
- **Verdict:** **replace**. The chicane-under-crosswind idea is worth one putt in a six-putt map.

### 2 · Moonshot: polar (single putt)

![Moonshot](level-audit/02-moonshot.png)

- **Mechanics:** a launch ramp (170,150 150×200, 0→75) over a 120-unit gap (x 320–440).
- **Par:** 3; R 1.
- **Problems:**
  - One full-power shot is the whole hole.
  - It sits in the polar region but has no ice and no cold identity.
- **Scores:** fun 2 · clarity 5 · fairness 3 · variety 1.
- **Verdict:** **replace** (the idea becomes one putt).

### 3 · Portal Archipelago: tropical (single putt)

![Portal Archipelago](level-audit/03-portal-archipelago.png)

- **Mechanics:** three unwalled islands; portal pairs P1 (180,150)→(350,210) and P2 (450,290)→(610,350).
- **Par:** 4; R 1.
- **Problems:**
  - No island has a guard wall, so every overshoot is out of bounds.
  - The portals chain into a single straight line, so the hole is "roll into the ring" twice.
  - Nothing tells the player where P2's exit lands until they try it.
- **Scores:** fun 2 · clarity 2 · fairness 2 · variety 2.
- **Verdict:** **replace**.

### 4 · Clockwork Maze: temperate (single putt) · *known gap*

![Clockwork Maze](level-audit/04-clockwork-maze.png)

- **Mechanics:** three long walls (x 184, 364 and 544) that make a serpentine; two moving blocks: (270,390), sweeping 30 in y, and (480,100), sweeping 28.
- **Par:** 6; **no robust route** (trial budget exhausted, Q1).
- **Problems:**
  - It is a 725-unit serpentine with no perimeter walls (the whole 720×420 tile edge is open).
  - The movers sit in the turns, so success depends on when the ball arrives, which the player cannot plan from the tee.
  - Long corridors with nothing in them.
  - It is the slowest map in the set, for little decision-making.
- **Scores:** fun 1 · clarity 3 · fairness 1 · variety 1.
- **Verdict:** **replace**.

### 5 · Cyclone Ring: wetland

![Cyclone Ring](level-audit/05-cyclone-ring.png)

- **Mechanics:** four fans and four tornadoes; cups shrunk to radius 14, 9, 11, 11, 10 and 8 (default 15).
- **Par:** 4, 3, 4, 4, 4, 4 (23). R 1 on every putt (Q1), so par is 2–3 strokes generous. B4: 222–649 sinking shots per putt.
- **Problems:**
  - Fans sit directly on top of cups. Putt 1's fan (164,46 110×60) covers H1 (224,72) and pushes south; putt 3's fan (676,146 78×98) covers H3 (724,216) and pushes west; putt 6's narrow fan (644,366 32×88, strength 200) blows up a slot beside H6. A fan on the cup reads as noise, not a route choice.
  - Putt 2's tornado (426,136 r60) does straddle its line, but putt 5's (342,416 r40) sits about 100 units below its line and never comes into play.
  - The 8–11 unit cups make the difficulty come from cup size, not from course reading.
  - It uses the shared chamber template (tee/cup pairs identical to Dune Serpent, Frost Hollow and Grand Finale).
- **Scores:** fun 3 · clarity 2 · fairness 3 · variety 2.
- **Verdict:** **rework**. Keep the wind theme, move fans and tornadoes onto the route, and restore readable cups.

### 6 · Skybridge: polar (single putt)

![Skybridge](level-audit/06-skybridge.png)

- **Mechanics:** a ramp (160,170, 0→50) up to a narrow 80-wide bridge at z 50; a crosswind fan (330,210 180×80, pushing south at 85) along the bridge; a raised green at z 50.
- **Par:** 4; R 1.
- **Problems:**
  - It is the only legacy hole that uses height well, and it is the most "Putt Planet" idea in the old set.
  - The bridge has no guard walls, and the fan pushes straight off its south edge into the void: a cheap fail until the player learns to aim north.
  - It is in the polar region with no ice.
- **Scores:** fun 3 · clarity 4 · fairness 2 · variety 2.
- **Verdict:** **rework**, as a putt inside a six-putt map, with a lip on the downwind side or a visible wind cue.

### 7 · Pinwheel: temperate (single putt)

![Pinwheel](level-audit/07-pinwheel.png)

- **Mechanics:** a cross; a moving block (390,240 80×20) sweeping ±100 in x across the main lane; a fan in the north lobe (pushing south at 220).
- **Par:** 3; R 2.
- **Problems:**
  - The mover crosses the only line to the cup, so it is a timing gate the player cannot see coming.
  - The north and south lobes are dead space apart from `?` blocks.
- **Scores:** fun 2 · clarity 3 · fairness 2 · variety 1.
- **Verdict:** **replace**.

### 8 · Dune Serpent: desert

![Dune Serpent](level-audit/08-dune-serpent.png)

- **Mechanics:** walls and six small sand patches (40–50 units).
- **Par:** 2, 3, 2, 3, 3, 2 (15). R 1 on every putt. B4: 626–1040.
- **Problems:**
  - It is Switchback Garden with sand dots: tee/cup pairs are identical to Frost Hollow and match Cyclone Ring's on putts 1, 5 and 6.
  - Most sand patches sit off the line: putt 1's (196,116 50×60) is beside the bank, putt 6's (571,356) is behind the wall.
  - Only putt 3's long strip (626,46 30×198) crosses the route.
  - There is no "serpent": no winding path and no dune slopes.
- **Scores:** fun 2 · clarity 4 · fairness 5 · variety 1.
- **Verdict:** **replace**. The desert region needs real dunes: ramps, long sand traps and the Sandstorm Spire wind.

### 9 · Twin Peaks: polar (single putt)

![Twin Peaks](level-audit/09-twin-peaks.png)

- **Mechanics:** four ramps making two ridges: 0→60→0 and 0→45→0.
- **Par:** 4; R 2.
- **Problems:**
  - A straight lane with two humps. Reading pace over a crest is a good idea, but here it is the only one.
  - It has no walls, so an off-line shot rolls off the 220-wide lane.
  - Polar, no ice.
- **Scores:** fun 2 · clarity 5 · fairness 3 · variety 1.
- **Verdict:** **replace** (keep "pace over a crest" as one putt).

### 10 · Wind Tunnel: wetland (single putt)

![Wind Tunnel](level-audit/10-wind-tunnel.png)

- **Mechanics:** a C-shaped track of three unwalled strips; a tailwind fan (180,50, pushing east at 220) and a headwind fan (660,190, pushing north at 220) on the down leg.
- **Par:** 4; R 2.
- **Problems:**
  - The headwind on the right-hand leg pushes the ball back up toward the start, and nothing guards the inner edge, so most misses fall off.
  - The bottom strip (40,350 720×110) is 600 units of empty runway.
- **Scores:** fun 2 · clarity 3 · fairness 2 · variety 2.
- **Verdict:** **replace**.

### 11 · Fortress Spiral: desert (single putt)

![Fortress Spiral](level-audit/11-fortress-spiral.png)

- **Mechanics:** five walls forming a two-turn spiral to H1 (400,298).
- **Par:** 6; R 3.
- **Problems:**
  - A maze for its own sake: three careful straight putts along corridors.
  - The open lawn outside the spiral (the whole north strip and the east side) is dead space, and the tile edge has no walls.
  - The desert setting is unused.
- **Scores:** fun 2 · clarity 4 · fairness 4 · variety 1.
- **Verdict:** **replace**. A spiral works as one putt; Obsidian Spiral putt 2 already does it better.

### 12 · Bounce Harbor: tropical (single putt)

![Bounce Harbor](level-audit/12-bounce-harbor.png)

- **Mechanics:** two jump pads (220,250) and (445,250) in front of two 90-wide pits; three unwalled islands.
- **Par:** 4; R 1.
- **Problems:**
  - Pad, pit, pad, pit on one straight line: the shot is "aim at the pads".
  - The pads are 18-radius targets on the centreline, so the hole is solved by its symmetry.
- **Scores:** fun 2 · clarity 5 · fairness 3 · variety 1.
- **Verdict:** **replace**.

### 13 · Hourglass: desert (single putt) · *zero slack*

![Hourglass](level-audit/13-hourglass.png)

- **Mechanics:** a narrow neck (280,210 240×80) with a moving block (390,225 18×55, sweeping ±45 in y); a sand patch near the cup.
- **Par:** 3; route 3 (`--full` only).
- **Problems:**
  - The whole hole is the timing gate in the neck. The player cannot judge the block's phase from the tee on a 600-unit putt, so failure is luck.
  - The two bulbs are mostly empty.
- **Scores:** fun 1 · clarity 3 · fairness 1 · variety 1.
- **Verdict:** **replace**.

### 14 · Thunder Basin: wetland (single putt)

![Thunder Basin](level-audit/14-thunder-basin.png)

- **Mechanics:** two huge tornadoes of radius 125 (300,170 and 500,330, opposite spins); two wall stubs at x 364.
- **Par:** 4; R 1.
- **Problems:**
  - The tornadoes cover about 40% of the basin, and their pull is strongest where nothing is drawn (the visual reads as clouds, not forces).
  - It has a robust hole-in-one, so the big storm decides little.
- **Scores:** fun 3 · clarity 2 · fairness 3 · variety 2.
- **Verdict:** **rework** into one wetland putt with smaller, readable vortices.

### 15 · Portal Labyrinth: tropical (single putt)

![Portal Labyrinth](level-audit/15-portal-labyrinth.png)

- **Mechanics:** three walls; portal pairs P1 (180,140)↔(610,100) and P2 (400,350)↔(650,350).
- **Par:** 4; R 2.
- **Problems:**
  - The portals are two-way and unlabelled in-game by destination.
  - P2's two ends are 250 apart on the same open floor, so it is a shortcut nobody needs.
  - The labyrinth is three walls.
- **Scores:** fun 2 · clarity 2 · fairness 3 · variety 2.
- **Verdict:** **replace**.

### 16 · Crescent Coast: tropical (single putt) · *needs --full*

![Crescent Coast](level-audit/16-crescent-coast.png)

- **Mechanics:** a U of three unwalled strips; a sand trap (250,340 160×110); a fan on the final leg (640,180 110×140, pushing west at 120).
- **Par:** 5; route 4 (`--full` only).
- **Problems:**
  - The fan on the return leg pushes west, straight off the strip's open inner edge (x 630) into the void. It is the clearest cheap hazard in the game: the player does nothing wrong and the ball leaves the island.
  - The bottom strip is long and empty apart from the sand.
- **Scores:** fun 1 · clarity 3 · fairness 1 · variety 2.
- **Verdict:** **replace**.

### 17 · Elevator Alley: volcanic (single putt)

![Elevator Alley](level-audit/17-elevator-alley.png)

- **Mechanics:** a ramp (220,160, 0→65) to a z 65 deck; a moving block (510,230 24×75, sweeping ±45 in y) on the deck.
- **Par:** 4; R 2.
- **Problems:**
  - It has no elevator; the name promises a moving platform.
  - The mover is a timing gate on the deck, and the 180-wide alley has no walls.
  - Volcanic region, no lava or heat identity.
- **Scores:** fun 2 · clarity 4 · fairness 2 · variety 1.
- **Verdict:** **replace**.

### 18 · Comet Run: volcanic (single putt) · *known gap*

![Comet Run](level-audit/18-comet-run.png)

- **Mechanics:** a launch ramp (150,160 170×180, 0→95) that throws the ball across a void to a middle island; a portal P1 (550,280)→(680,380) next to the cup.
- **Par:** 4; **no robust route** (full grid exhausted, Q1).
- **Problems:**
  - The launch has to land on a 150×250 island 140 units away with no backstop, so tiny pace errors go out of bounds; this is why no shot is robust.
  - The portal exit (680,380) is beside H1 (700,400), so the portal does the putting.
- **Scores:** fun 1 · clarity 3 · fairness 1 · variety 2.
- **Verdict:** **replace**.

### 19 · Grand Finale: volcanic

![Grand Finale](level-audit/19-grand-finale.png)

- **Mechanics:** everything: three fans, five tornadoes, two portal pairs, two pads, ice and slime; cups radius 8–10.
- **Par:** 4 on every putt (24). Routes: putts 1 and 3 take 2 strokes (Q1; recorded in [par-route-gaps.json](../../tests/fixtures/cup-capture/par-route-gaps.json)); the rest are R 1. B4: 125–329, the hardest legacy starter.
- **Problems:**
  - It is a mechanic sampler, not a finale. Each chamber stacks two or three unrelated elements: putt 1 has ice, a cup fan and a wall; putt 6 has portals, a tornado, a pad and slime.
  - The recorded route for putt 1 (image) zig-zags off four walls through the fan. It is robust for the solver, but no player would read it from the tee.
  - Putt 2 has a pad (418,146) 68 units short of the cup and a tornado (476,216 r40) just below the cup.
  - Its interior walls largely repeat Slime Springs: 13 of 16 wall rectangles are identical.
- **Scores:** fun 3 · clarity 1 · fairness 2 · variety 3.
- **Verdict:** **rework**. Keep "everything at once" as a deliberate finale built around one or two readable set pieces per putt.

### 20 · Frost Hollow: polar

![Frost Hollow](level-audit/20-frost-hollow.png)

- **Mechanics:** walls and six ice sheets.
- **Par:** 4, 3, 3, 3, 2, 3 (18). R 1 on every putt. B4: 287–1084.
- **Problems:**
  - Its tee/cup pairs are exactly Dune Serpent's.
  - Ice mostly sits under the tee or in a corner: putt 1 tees on ice (46,146); putt 4's sheet (46,356) is under the tee; putt 6's (526,356) is under the tee. Ice under the tee changes almost nothing.
  - Putt 3 is the best idea in the map: an ice channel (586,46 108×198) around a central pillar.
  - Par 4 on putt 1 with a robust ace is three strokes of slack.
- **Scores:** fun 2 · clarity 4 · fairness 4 · variety 2.
- **Verdict:** **rework**. Keep the polar slot and putt 3, and make the ice the route (lanes, banks and slick downhills).

### 21 · Slime Springs: wetland

![Slime Springs](level-audit/21-slime-springs.png)

- **Mechanics:** five slime patches, four portal pairs and two pads.
- **Par:** 2, 4, 4, 3, 3, 3 (19). R 1 on every putt. B4: 211–1062.
- **Problems:**
  - Its interior walls are Grand Finale's, and so are its pads and two of its portal pairs.
  - Putts 1, 4, 5 and 6 each have their own portal pair beside the tee, and every one is optional.
  - Slime sits in corners (putt 1's 168,146 106×98) rather than on lines.
  - Par 4 on putts 2 and 3 with robust aces.
- **Scores:** fun 2 · clarity 3 · fairness 4 · variety 2.
- **Verdict:** **replace**. The wetland region needs its own layout; slime should be a sticky choice on the route.

### 22 · Sandstorm Spire: desert (VIS-G)

![Sandstorm Spire](level-audit/22-sandstorm-spire.png)

- **Mechanics:** pillar slalom, a ramp over a dry wash (pit), a wind gully (586,46 108×198, pushing south at 150), a pad onto a walled cup box, and a dust devil.
- **Par:** 2 on all six (12). R 1/1/1/1/1/1.
- **Problems:**
  - The best-themed Gaia map, with a different idea on every putt.
  - Every putt is an ace for a precise player, so par 2 everywhere means no putt asks for a plan.
  - Putt 2 is a min-power straight tap over the ramp (route 0°, power 0.45).
  - Putt 6's tornado (638,360 r44) sits on the line, but the route goes straight through it.
- **Scores:** fun 3 · clarity 4 · fairness 4 · variety 4.
- **Verdict:** **keep with tweaks**. Add one or two genuine par-3 putts (longer, with a lay-up choice) and give the gully wind a visible cue.

### 23 · Obsidian Spiral: volcanic (VIS-G)

![Obsidian Spiral](level-audit/23-obsidian-spiral.png)

- **Mechanics:** lava lanes (pits), a wall spiral, a ramp over a lava river, a pad over a basalt flow, an ice bridge between lava, and a cup inside a broken lava ring.
- **Par:** 3, 2, 2, 2, 2, 2 (13). R 2/1/1/1/1/1.
- **Problems:**
  - Putt 5 is an ice bridge (326,318 150×74) between two lava pits, played as a straight min-power shot (0°, 0.3).
  - Putt 3 is the same ramp-over-pit straight shot as Sandstorm Spire putt 2.
  - Putt 6's broken lava ring around the cup (596–684, 311–399) is the most interesting cup in Gaia.
  - Lava is only a black pit; it does not look or behave like lava.
- **Scores:** fun 3 · clarity 4 · fairness 4 · variety 4.
- **Verdict:** **keep with tweaks**. Replace putt 3 (duplicate idea) and make putt 5 diagonal or curved so the ice matters.

## Ares

Ares (gravity 490) has eight six-putt maps in two regions, Rustfall Canyons (24–27) and Ironcrown Highlands (28–31). All are in the playable pool, and all were built at the same time on two templates: the 3 × 2 chamber grid and the 2 × 3 long-lane layout.

**Gravity check.** Each recorded route was replayed once at its own gravity and once at Gaia's 700, with the nominal shot only (not the test's nine perturbations). Every Ares route still sinks at Gaia gravity on Redrock Rebound, Dust Devil Draw, Basalt Bounce and Ironstone Ridge, so **half of Ares does not use Ares gravity**. Across Ares, 15 of 48 nominal routes fail at Gaia gravity. `tests/world-maps.test.cjs` reports 21, because it replays each route robustly (with the finishing perturbations) and skips the putts it re-solves after rounding. Flat rolling distance is the same on every world by design (MODERNIZATION_PLAN.md, gravity decision), so a map built from banks, sand and ice plays exactly as it would on Gaia.

**Note:** MODERNIZATION_PLAN.md says ambient Ares wind is visual-only scenery. Dust Devil Draw and Scarlet Summit use gameplay wind zones (the W3 course element), which is a different thing, but the owner should confirm that Ares courses are meant to have gameplay wind, because players will not easily tell the two kinds apart.

In the route notes below, "straight" means the recorded hole-in-one leaves within 2° of the direct tee-to-cup line, and "min-power" means it uses the lowest power in the solver grid (0.3).

### 24 · Redrock Rebound: Rustfall

![Redrock Rebound](level-audit/24-redrock-rebound.png)

- **Mechanics:** walls, four sand drifts, five crevasse pits.
- **Par:** 2, 3, 2, 2, 2, 2 (13). R 1/2/1/1/1/1.
- **Problems:**
  - It is a bank-shot map with nothing Martian about it except colour, and every route works at Gaia gravity.
  - Putt 3 is a min-power straight tap (0°, 0.3) through the gaps between two wall stubs and two crevasses (656,46 and 656,174). The crevasses never matter at that pace.
  - Putt 4 frames a sand box (126,326 70×54) with two walls, and the route simply goes around it.
  - Putt 2 is the good one: a two-bank route over a crevasse (436,136 78×22).
  - The sand drifts all sit off the routes.
- **Scores:** fun 3 · clarity 4 · fairness 4 · variety 3.
- **Verdict:** **rework**. Keep the bank-shot character for one or two putts and add slopes or ramps that use the lower gravity.

### 25 · Canyon Leap: Rustfall

![Canyon Leap](level-audit/25-canyon-leap.png)

- **Mechanics:** seven launch ramps (0→26 to 0→34) and ten canyon pits.
- **Par:** 2, 2, 2, 2, 2, 3 (13). R 1/1/1/1/1/2.
- **Problems:**
  - All six putts are the same shot: tee, ramp, canyon, cup, in a straight lane. Putts 1–5 are straight aces at power 0.45–0.55, and putt 4 is putt 1 mirrored.
  - Putt 3 adds a wall stub (256,232); putt 6 adds a second ramp (616,360) and canyon.
  - It does use the gravity (five of six routes fail at 700), but one idea six times is the clearest repetition among the new maps.
  - Rimwalker Ridge (37) reuses this layout: 7 of its 8 wall rectangles and all six tee/cup pairs are identical.
- **Scores:** fun 2 · clarity 5 · fairness 3 · variety 1.
- **Verdict:** **rework**. Keep two jump putts and build different ones: a jump to a raised mesa, a jump with a choice of landing shelves, a jump into a bowl.

### 26 · Dust Devil Draw: Rustfall

![Dust Devil Draw](level-audit/26-dust-devil-draw.png)

- **Mechanics:** five dust devils (tornadoes) and four wind zones: a gusting draft east (326,46 140×198), a gust north (46,336 228×50), and an opposed swirl pair in putt 6.
- **Par:** 2 on all six (12). R 1/1/1/1/1/1.
- **Problems:**
  - Every route is a straight ace (within 2° of the direct line), and three are min-power (putts 1, 3 and 5).
  - A dust devil centred on the line is neutral for a centred shot. Putt 5's devil (400,355 r40) sits exactly on the tee-to-cup line, and the route goes straight through it at 0°, 0.3.
  - Putt 1's devil (160,106) and putt 3's two (596,186 and 686,106) sit off the line.
  - The theme is "read the wind", but no putt needs the wind read.
  - The pit in putt 4 (106,406 110×48) sits below the gust zone, so the gust pushes the ball away from it.
- **Scores:** fun 2 · clarity 3 · fairness 4 · variety 2.
- **Verdict:** **rework**. Put devils beside the line so they bend it, make one putt need an upwind aim with a visible wind cue, and keep the gust periods readable.

### 27 · Ochre Overlook: Rustfall

![Ochre Overlook](level-audit/27-ochre-overlook.png)

- **Mechanics:** seven jump pads, three pits and one sand patch.
- **Par:** 2 on all six (12). R 1/1/1/1/1/1.
- **Problems:**
  - **Every route is a minimum-power (0.3) ace, and five are straight at the cup.** The pad sits on the line (136,110; 486,110; 656,250; 516,390), so the player taps the ball into the pad and the hop does the rest.
  - Putts 3 and 6 share tee/cup positions with Moondust Mile and Starlight Skip.
  - The "overlook" has no height: the pads hop wall stubs and pits on flat ground.
  - It is the most trivial map in the game.
- **Scores:** fun 1 · clarity 5 · fairness 4 · variety 1.
- **Verdict:** **replace**.

### 28 · Basalt Bounce: Ironcrown

![Basalt Bounce](level-audit/28-basalt-bounce.png)

- **Mechanics:** walls, four pads, one lava bar (326,316 148×20) and one sand patch.
- **Par:** 2, 2, 2, 2, 2, 3 (13). R 1/1/1/1/1/2.
- **Problems:**
  - It has the best bank-shot puzzles on Ares. Putt 4 banks into a three-sided cup box (176–236, 302–400); putt 6 snakes between two staggered walls.
  - The pads are optional: no recorded route uses them. Putt 1's pad (106,145) sits right in front of the tee, and the route banks past it.
  - Every route works at Gaia gravity, so on Ares this is a Gaia map.
  - The theme says "bounce a pad hop clean over them", and nothing requires that.
- **Scores:** fun 3 · clarity 4 · fairness 4 · variety 3.
- **Verdict:** **keep with tweaks**. Give one or two putts a pad route that beats the bank (a higher wall, or a cup on a ledge).

### 29 · Caldera Climb: Ironcrown

![Caldera Climb](level-audit/29-caldera-climb.png)

- **Mechanics:** six ramps up to five raised rims (z 20–24) with cups on top; four pits.
- **Par:** 2, 2, 3, 2, 2, 3 (14). R 1/1/2/1/1/2.
- **Problems:**
  - It is the strongest new map. It has real height, a different ramp direction on most putts and a cup on a mesa, and five of six routes depend on Ares gravity.
  - Putt 4 (ramp up and over a 40-wide mesa at 156,316 between two ramps) is a good small idea.
  - Putt 6 has no ramp at all: a wall-and-pit bank that duplicates Basalt Bounce putt 6.
  - Putt 3 drops to a z 20 rim between two pits (526,166 and 704,166), and its route has to come back from the top wall. It is hard to read from the tee.
  - Regolith Rise (33) reuses this layout: 8 of its 9 wall rectangles are identical.
- **Scores:** fun 4 · clarity 3 · fairness 4 · variety 4.
- **Verdict:** **keep with tweaks**. Replace putt 6 with a climbing putt and add a visible path for putt 3.

### 30 · Ironstone Ridge: Ironcrown

![Ironstone Ridge](level-audit/30-ironstone-ridge.png)

- **Mechanics:** three ice runs, a moving gate (206,230 14×40, sweeping ±40), a portal pair (506,286)↔(656,216), two pits and sand.
- **Par:** 2 on all six (12). R 1/1/1/1/1/1.
- **Problems:**
  - Putts 1 and 5 are straight min-power aces along an ice run (126,76 180×68; 106,346 220×88). The ice speeds a ball that is already on line.
  - Putt 4's portal does the putting: a firm straight shot (354.75°, 0.7) rolls into the entry (506,286) and leaves the exit (656,216) 70 units from the cup on the same line, as in Comet Run.
  - Putt 3's gate is a moving block, a timing hazard the solver tests at hazard time 0 only.
  - Every route works at Gaia gravity.
  - Putt 6 (an ice zig-zag across 546,326) has the best feel.
- **Scores:** fun 2 · clarity 3 · fairness 3 · variety 3.
- **Verdict:** **rework**. Turn the ice runs into curving lanes or downhill runs, make the portal the better route, and replace the moving gate or make its timing visible.

### 31 · Scarlet Summit: Ironcrown

![Scarlet Summit](level-audit/31-scarlet-summit.png)

- **Mechanics:** a launch ramp over a canyon, three pads, two dust devils, a gusting updraft and three pits.
- **Par:** 2, 2, 2, 2, 2, 3 (13). R 1/1/1/1/1/2.
- **Problems:**
  - Putt 1 is the ramp-over-canyon straight ace again (the same shot as Sandstorm Spire 2, Obsidian Spiral 3 and Gaiarise Run 3).
  - Putt 4's gusting updraft (126,256 70×198, pushing south with period 3) blows toward the pit directly beneath it (126,416 70×38). Whether the ball is pushed in depends on the gust phase when it arrives, which the player cannot plan.
  - Putt 5 is a min-power straight tap (270°, 0.3) through the dust devil sitting on the line (400,326).
  - As a "summit" it has no climb.
- **Scores:** fun 2 · clarity 3 · fairness 2 · variety 3.
- **Verdict:** **rework**. It should be Ares' finale: height, a long multi-shot putt and one fair wind putt.

## Luna

Luna (gravity 315) has eight six-putt maps in two regions, Hushed Mare (32–35) and Craterpeak Highlands (36–39). All are playable. They were built with Ares, on the same two templates, and four of them reuse an Ares or Luna layout.

**Gravity check** (nominal replay, as for Ares): 21 of 48 routes fail at Gaia gravity; the test, by its own rule, reports 18. They are concentrated in Moondust Mile (3), Regolith Rise (5), Starlight Skip (6) and Rimwalker Ridge (4). **Gaiarise Run, Crater Hop, Ghostlight Basin and Polar Hollow each have at most one route that needs Luna gravity.** The low-gravity world's defining feature is missing from half its maps.

### 32 · Moondust Mile: Hushed Mare

![Moondust Mile](level-audit/32-moondust-mile.png)

- **Mechanics:** six moondust (sand) patches, three pads and two craters.
- **Par:** 2, 2, 2, 2, 3, 2 (13). R 1/1/1/1/2/1.
- **Problems:**
  - Putts 2, 4 and 6 are pad-over-crater min-power aces. All three recorded routes are taps *away* from the cup (power 0.3) that rebound off the wall behind the tee onto the pad. Tees 24–44 units in front of a wall with a pad just ahead make the backward tap the most forgiving shot, which says the pad does all the work.
  - The description promises that "rolling putts drag in the dust", but moondust is ordinary sand.
  - Putt 1 is a straight ace over a sand patch (146,66 80×88).
  - Putt 5 (a long sand strip, 106,326 230×60, beside a wall) is the only putt that needs a plan.
  - It shares tee/cup layouts with Starlight Skip (all six) and Ochre Overlook (putts 3 and 6).
- **Scores:** fun 2 · clarity 4 · fairness 4 · variety 2.
- **Verdict:** **rework**. Make the long lanes into long, multi-shot Luna putts (par 3–4) with floaty hops between dust fields.

### 33 · Regolith Rise: Hushed Mare

![Regolith Rise](level-audit/33-regolith-rise.png)

- **Mechanics:** six ramps and five raised plateaus (z 18–22); two craters.
- **Par:** 2, 3, 2, 3, 2, 2 (14). R 1/2/1/2/1/1.
- **Problems:**
  - It is Caldera Climb on Luna: 8 of 9 wall rectangles are identical, and putts 1, 3 and 6 repeat Caldera's ramp-to-mesa shots (Caldera putts 1, 4 and 5).
  - Unlike Caldera, it does feel lunar: five of six routes fail at Gaia gravity. Putt 4 (a ramp onto an 80×98 mesa at 120,356 between craters 46,376 and 224,376) needs two strokes and is a good use of float.
  - Putt 5 (a bank between two walls) ignores the theme.
- **Scores:** fun 3 · clarity 3 · fairness 4 · variety 3.
- **Verdict:** **rework**. Keep the plateau idea, but give it a layout of its own so it stops being a Caldera copy (wider terraces, longer floats).

### 34 · Starlight Skip: Hushed Mare

![Starlight Skip](level-audit/34-starlight-skip.png)

- **Mechanics:** seven pads and eight craters.
- **Par:** 2, 2, 2, 2, 2, 3 (13). R 1/1/1/1/1/2.
- **Problems:**
  - Every putt is "tap into the pad, float over the crater". All five aces are min-power (0.3) taps, and all five go *away* from the cup into the wall behind the tee. It fully depends on Luna gravity (no route sinks at 700), but the pad does the shot.
  - Its tee/cup positions are identical to Moondust Mile's.
  - Putt 6 has two pads (466,356 and 466,424) and is the only putt with a choice.
- **Scores:** fun 2 · clarity 5 · fairness 4 · variety 1.
- **Verdict:** **replace**. "Skip from pad to pad" is a good Luna theme, but it needs chains of pads, landing choices and pads the player must aim at with pace.

### 35 · Gaiarise Run: Hushed Mare

![Gaiarise Run](level-audit/35-gaiarise-run.png)

- **Mechanics:** walls, five craters, one launch ramp, one pad and sand.
- **Par:** 2 on all six (12). R 1/1/1/1/1/1.
- **Problems:**
  - It is a set of bank shots that play the same on Gaia: only putt 3 (a ramp over a crater, again the Obsidian Spiral 3 / Sandstorm Spire 2 shot) needs Luna gravity.
  - Putt 5's pad (356,355) is beside a wall (396,286 14×138) that the route simply banks under.
  - The theme ("under the rising blue face of Gaia") is skybox only.
  - Putt 6's two small craters (586,316 and 656,376) in an open chamber make a nice diamond bank.
- **Scores:** fun 2 · clarity 4 · fairness 4 · variety 2.
- **Verdict:** **replace**.

### 36 · Crater Hop: Craterpeak

![Crater Hop](level-audit/36-crater-hop.png)

- **Mechanics:** five pads and nine craters.
- **Par:** 2, 3, 2, 4, 2, 2 (15). R 1/2/1/3/1/1.
- **Problems:**
  - The name says hop, but only putt 2's route needs Luna gravity. Pads are bypassed: putt 1 banks around the crater (136,96 70×98) instead of using the pad (106,145); putt 5 banks right (318.75°) around the crater bar (326,316 148×50) instead of using the pad (400,396).
  - **Putt 4 is the most frustrating putt in the new maps.** The pad (102,355) sits 32 units in front of the tee on the only straight line, between two big craters (126,256 90×80 and 126,374 90×80). Any direct shot is launched into the air. The recorded route takes 3 strokes (258°, 135°, 358°) and par is 4 for a 176-unit putt.
- **Scores:** fun 2 · clarity 2 · fairness 2 · variety 3.
- **Verdict:** **rework**. Make hopping the best route (craters too wide to roll round), and remove the tee-side pad trap on putt 4.

### 37 · Rimwalker Ridge: Craterpeak

![Rimwalker Ridge](level-audit/37-rimwalker-ridge.png)

- **Mechanics:** four launch ramps and eleven crater pits that leave thin rims.
- **Par:** 2, 2, 2, 2, 4, 2 (14). R 1/1/1/1/3/1.
- **Problems:**
  - It is Canyon Leap's layout (all six tee/cup pairs and 7 of 8 wall rectangles are the same) with craters for canyons.
  - Putt 2 is a straight ace along a 28-unit rim between craters (506,46 and 506,124). That is a real "rim walk" and a good idea, but at power 0.4 it is not demanding.
  - Putt 5 squeezes a 20-unit gap between craters (136,326 and 136,400), then a thin crater bar (266,366 128×24). It takes 3 strokes, and par is 4.
  - Putts 1, 3, 4 and 6 are ramp-over-crater lanes, the same as Canyon Leap.
- **Scores:** fun 2 · clarity 4 · fairness 3 · variety 2.
- **Verdict:** **rework**. Keep the rim-walking putts (2 and 5) and drop the Canyon Leap copies.

### 38 · Ghostlight Basin: Craterpeak

![Ghostlight Basin](level-audit/38-ghostlight-basin.png)

- **Mechanics:** four ice sheets, two portal pairs (346,186)↔(466,106) and (326,416)↔(476,296), three pits and sand.
- **Par:** 2 on all six (12). R 1/1/1/1/1/1.
- **Problems:**
  - **No route needs Luna gravity.** It is a flat ice-and-portal map.
  - Putt 1 is a min-power straight tap across an ice sheet (106,86 120×118), and putt 6 a min-power diagonal across the ice band (526,316 228×80).
  - Putts 2 and 5 use their portals well: the portal is the way past a dividing wall (putt 2) or a central crater bar, 346,316 110×30 (putt 5).
  - The "dim basin" theme is visual only.
- **Scores:** fun 2 · clarity 3 · fairness 4 · variety 3.
- **Verdict:** **rework**. Keep the two portal putts, and add slopes into the basin so the ice and the low gravity combine (long, curving slides).

### 39 · Polar Hollow: Craterpeak

![Polar Hollow](level-audit/39-polar-hollow.png)

- **Mechanics:** five ice sheets, two pads, three pits and a launch ramp.
- **Par:** 2 on all six (12). R 1/1/1/1/1/1.
- **Problems:**
  - Only putt 4 (a ramp over a crater, 126,256 70×198) needs Luna gravity.
  - Putt 5 is a min-power straight tap (270°, 0.3) over ice through a gap between two walls.
  - Putts 1 and 3 are ice banks that play like Frost Hollow on Gaia.
  - The pads (346,145 and 586,316) are bypassed by putts 2 and 6, whose routes bank around the pits.
  - It overlaps Ghostlight Basin's theme (polar ice) in the same region.
- **Scores:** fun 2 · clarity 4 · fairness 4 · variety 2.
- **Verdict:** **replace**. Merge the polar-ice idea into Ghostlight Basin, and give Craterpeak a different fourth map (for example a crater-bowl or lunar-installation map).
