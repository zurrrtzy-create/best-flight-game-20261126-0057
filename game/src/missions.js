// Volcano Mail Run — the three sorties: Ring Run (8 rings, then land
// home), Mail Drop (land North Strip and East Strip, deliveries refuel
// you, then return home) and Storm Return (6 rings in gusty wind on half
// a tank). Scoring: rings 100, deliveries 250, smooth landings up to 200.
(function () {
  var VMR = window.VMR || (window.VMR = {});
  var cfg = VMR.config;
  var util = VMR.util;

  var M = {
    index: 0,
    phase: 'idle', // rings | toNorth | toEast | return | done
    rings: [],
    ringIndex: 0,
    score: 0,
    message: '',
    messageAt: 0,
    complete: false,
    finalScore: 0,
    wind: { x: 0, z: 0, gust: 0 }
  };
  VMR.missions = M;

  function say(text) {
    M.message = text;
    M.messageAt = (VMR.physics.state && VMR.physics.state.time) || 0;
    if (VMR.hud) VMR.hud.toast(text);
  }

  function homeSpawn() {
    var rw = VMR.world.runwayData[0];
    var fwd = util.headingVec(rw.heading);
    return {
      x: rw.x - fwd.x * (rw.length / 2 - 60),
      y: rw.elev + cfg.plane.gearHeight,
      z: rw.z - fwd.z * (rw.length / 2 - 60),
      heading: rw.heading, speed: 0, throttle: 0, fuel: 1, airborne: false, gear: true
    };
  }

  M.start = function (index) {
    M.index = index;
    M.score = 0;
    M.complete = false;
    M.finalScore = 0;
    M.ringIndex = 0;
    M.wind = { x: 0, z: 0, gust: 0 };
    var spawn = homeSpawn();
    if (index === 0) {
      M.phase = 'rings';
      M.rings = VMR.world.ringSets.run.map(function (r) {
        return { x: r.x, y: r.y, z: r.z, nx: r.nx, ny: r.ny, nz: r.nz, passed: false, prevSide: null };
      });
      VMR.physics.reset(spawn);
      say('Ring Run — fly all 8 rings around Gunung Api, then land home');
    } else if (index === 1) {
      M.phase = 'toNorth';
      M.rings = [];
      VMR.physics.reset(spawn);
      say('Mail Drop — land at North Strip with the first mailbag');
    } else {
      M.phase = 'rings';
      M.rings = VMR.world.ringSets.storm.map(function (r) {
        return { x: r.x, y: r.y, z: r.z, nx: r.nx, ny: r.ny, nz: r.nz, passed: false, prevSide: null };
      });
      spawn.fuel = 0.5;
      VMR.physics.reset(spawn);
      M.wind = { x: 6, z: -4, gust: 5 };
      say('Storm Return — 6 rings in gusty wind on half a tank');
    }
    VMR.world.setRingStates(index === 2 ? 'storm' : 'run', 0);
  };

  M.update = function (dt) {
    var s = VMR.physics.state;
    if (!s || s.crashed || M.complete) return;
    // Wind gusts breathe slowly.
    if (M.wind.gust > 0) {
      var t = s.time;
      M.wind.x = 6 + Math.sin(t * 0.4) * 3;
      M.wind.z = -4 + Math.cos(t * 0.33) * 3;
    }
    if (M.phase !== 'rings') return;
    var ring = M.rings[M.ringIndex];
    if (!ring) return;
    var dx = s.x - ring.x, dy = s.y - ring.y, dz = s.z - ring.z;
    var side = dx * ring.nx + dy * ring.ny + dz * ring.nz;
    if (ring.prevSide !== null && Math.sign(side) !== Math.sign(ring.prevSide)) {
      var dist = Math.hypot(dx, dy, dz);
      if (dist < cfg.ringRadius + 8) {
        ring.passed = true;
        M.score += cfg.scoring.ring;
        say('Ring ' + (M.ringIndex + 1) + ' of ' + M.rings.length + '  +' + cfg.scoring.ring);
        M.ringIndex++;
        if (M.ringIndex >= M.rings.length) {
          M.phase = 'return';
          say('All rings flown — bring her home to Cendana Field');
        }
        VMR.world.setRingStates(M.index === 2 ? 'storm' : 'run', M.ringIndex);
      }
    }
    ring.prevSide = side;
  };

  M.onLanded = function (ev) {
    var s = VMR.physics.state;
    var bonus = Math.round(util.clamp((4.5 - Math.abs(ev.vspeed)) / 4.5, 0, 1) * cfg.scoring.landingMax);
    if (M.phase === 'toNorth' && ev.runway === 'North Strip') {
      M.score += cfg.scoring.delivery;
      s.fuel = 1;
      M.phase = 'toEast';
      say('Mail delivered at North Strip  +' + cfg.scoring.delivery + ' — tank refuelled, on to East Strip');
    } else if (M.phase === 'toEast' && ev.runway === 'East Strip') {
      M.score += cfg.scoring.delivery;
      s.fuel = 1;
      M.phase = 'return';
      say('Mail delivered at East Strip  +' + cfg.scoring.delivery + ' — return to Cendana Field');
    } else if (M.phase === 'return' && ev.runway === 'Cendana Field') {
      M.score += bonus;
      M.complete = true;
      M.finalScore = M.score;
      M.phase = 'done';
      say('Home safe — smooth landing +' + bonus);
    } else if (ev.runway) {
      say('Landed at ' + ev.runway + ' — take off and follow the objective');
    } else {
      say('Rough-field landing — she still flies, take off again');
    }
  };

  M.objective = function () {
    if (M.complete) return 'Sortie complete — ' + util.fmtInt(M.finalScore) + ' pts';
    if (M.phase === 'rings') return 'Rings ' + M.ringIndex + '/' + M.rings.length + ' — then land home';
    if (M.phase === 'toNorth') return 'Deliver the mail — land at North Strip';
    if (M.phase === 'toEast') return 'Deliver the mail — land at East Strip';
    if (M.phase === 'return') return 'Return — land at Cendana Field';
    return 'Pick a sortie';
  };
})();
