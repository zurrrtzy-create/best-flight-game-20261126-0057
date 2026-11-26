# Volcano Mail Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/zurrrtzy-create/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/zurrrtzy-create/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Fly the mail plane **Kancil K-9** around Pulau Api, a volcanic island in a warm
afternoon sea. Thread the glowing rings, put the mail down on mountain
airstrips, and bring her home before the fuel runs dry.

## The game

A complete 3D flight game that runs from static files in a desktop browser —
no network, no build step, one vendored library (Three.js r147 in
game/vendor/). The world is a procedural volcanic island (a cone volcano,
hills, coastline, villages, pine forest, drifting clouds) rendered with
Three.js, with a chase camera, a lit instrument panel, and a HUD showing
altitude, speed and heading.

**Three sorties:**
1. **Ring Run** — fly 8 glowing rings around the volcano, then land home.
2. **Mail Drop** — land at North Strip and East Strip to deliver the mail
   (each delivery refuels you), then return to Cendana Field.
3. **Storm Return** — 6 rings in gusty wind on half a tank, then land home
   before the fuel runs out.

**Flying matters:** throttle and turn discipline, stall behaviour, flaps and
landing gear, fuel that burns with the throttle, hard landings that damage the
airframe, and landings scored on how gently you put her down.

## Controls

- **W / S** — throttle up / down
- **Arrow keys** — pitch and roll
- **A / D** — rudder
- **G** — landing gear, **F** — flaps, **B** — brakes
- **Mouse** — hold and move to steer, wheel = throttle
- **P** — pause, **R** — restart sortie, **M** — mute

Sound is synthesised with WebAudio (engine, wind, ring chimes, touchdown
thud) — no audio files.

## Play it

Serve `game/` with any static server and open `index.html`:

```sh
python3 -m http.server 8000 --directory game
# open http://localhost:8000
```

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with `buildDossier`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `game/index.html` — page shell, HUD and overlays.
- `game/src/config.js` — tuning constants.
- `game/src/world.js` — the island: terrain, airstrips, villages, trees, clouds.
- `game/src/plane.js` — the Kancil K-9, built from polygons.
- `game/src/physics.js` — the flight model: lift, stall, turns, landings, crashes.
- `game/src/render.js` — the software 3D renderer: camera, projection, painter's sort, fog.
- `game/src/hud.js` — HUD readouts and the lit instrument panel.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — synthesised WebAudio sound.
- `game/src/missions.js` — the three sorties, objectives and scoring.
- `game/src/main.js` — bootstrap, state machine and game loop.
- `screenshots/` — real renders of the game's own code.
