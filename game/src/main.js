// Volcano Mail Run — bootstrap, game loop and state machine, plus the
// ?shot= presets the screenshots are taken from (cover / approach /
// rings / landing). The simulation freezes shortly after a preset is
// placed so a headless screenshot catches a composed frame.
(function () {
  var VMR = window.VMR || (window.VMR = {});

  var state = 'title'; // title | flying | paused | crashed | complete
  var lastT = 0;
  var shotHoldAt = null;
  var shotFrozen = false;

  window.__vmrError = null;
  window.addEventListener('error', function (e) {
    window.__vmrError = String(e.message || e.error || 'unknown error');
  });

  function el(id) { return document.getElementById(id); }

  function startMission(index) {
    VMR.audio.resume();
    VMR.missions.start(index);
    state = 'flying';
    VMR.hud.show(null);
    el('missionName').textContent = VMR.config.missionNames[index];
    VMR.render.snapCamera();
  }

  function crash(reason) {
    state = 'crashed';
    el('crashReason').textContent = reason;
    el('finalScore').textContent = 'Score: ' + VMR.util.fmtInt(VMR.missions.score);
    VMR.hud.show('crashed');
    VMR.audio.crash();
  }

  function complete() {
    state = 'complete';
    el('finalTitle').textContent = VMR.config.missionNames[VMR.missions.index] + ' complete!';
    el('finalScore').textContent = 'Final score: ' + VMR.util.fmtInt(VMR.missions.finalScore);
    VMR.hud.show('complete');
  }

  function applyShot(name) {
    var s;
    var hold = 1.2;
    if (name === 'cover' || name === 'rings') {
      var ring = VMR.world.ringSets.run[name === 'cover' ? 0 : 1];
      VMR.missions.start(0);
      var hdg = VMR.util.headingFromVec(ring.nx, ring.nz);
      var back = name === 'cover' ? 40 : 25;
      hold = name === 'cover' ? 0.55 : 1.0;
      // Cover only: angle the flight line 55 degrees off the ring's
      // tangent toward the volcano, so Gunung Api fills the background
      // behind the ring instead of sitting 90 degrees off the camera
      // axis. The flight line still passes through the ring's hole
      // (any line through the centre does), so the plane still threads
      // the torus — now with the cone and its smoke plume behind it.
      var dirX = ring.nx, dirZ = ring.nz;
      if (name === 'cover') {
        var vx = VMR.config.volcano.x - ring.x;
        var vz = VMR.config.volcano.z - ring.z;
        var vl = Math.hypot(vx, vz);
        vx /= vl; vz /= vl;
        var ang = 55 * Math.PI / 180;
        dirX = ring.nx * Math.cos(ang) + vx * Math.sin(ang);
        dirZ = ring.nz * Math.cos(ang) + vz * Math.sin(ang);
        var dl = Math.hypot(dirX, dirZ);
        dirX /= dl; dirZ /= dl;
        hdg = VMR.util.headingFromVec(dirX, dirZ);
      }
      s = VMR.physics.reset({
        x: ring.x - dirX * back,
        y: ring.y,
        z: ring.z - dirZ * back,
        heading: hdg, speed: name === 'cover' ? 55 : 25,
        throttle: name === 'cover' ? 0.7 : 0.35, fuel: 1, airborne: true, gear: true
      });
      state = 'flying';
      VMR.hud.show(null);
      VMR.hud.toast(name === 'cover' ? 'Ring 1 of 8 — Gunung Api ahead' : 'Ring 2 of 8  +100');
    } else if (name === 'approach') {
      VMR.missions.start(0);
      var rw = VMR.world.runwayData[0];
      var fwd = VMR.util.headingVec(rw.heading);
      s = VMR.physics.reset({
        x: rw.x - fwd.x * 420,
        y: rw.elev + 95,
        z: rw.z - fwd.z * 420,
        heading: rw.heading, speed: 46,
        throttle: 0.45, fuel: 0.8, airborne: true, gear: true, flaps: true
      });
      s.pitch = -0.05;
      state = 'flying';
      VMR.hud.show(null);
      VMR.hud.toast('Final approach — Cendana Field, gear down');
    } else if (name === 'landing') {
      VMR.missions.start(0);
      var rw2 = VMR.world.runwayData[0];
      var fwd2 = VMR.util.headingVec(rw2.heading);
      s = VMR.physics.reset({
        x: rw2.x - fwd2.x * 90,
        y: rw2.elev + VMR.config.plane.gearHeight,
        z: rw2.z - fwd2.z * 90,
        heading: rw2.heading, speed: 32,
        throttle: 0.25, fuel: 0.8, airborne: false, gear: true
      });
      state = 'flying';
      VMR.hud.show(null);
      VMR.hud.toast('Touchdown at Cendana Field — smooth landing +180');
    } else {
      return;
    }
    // Freeze the simulation shortly after the preset settles so the
    // screenshot catches the composed frame instead of a fly-past.
    shotHoldAt = s.time + hold;
    VMR.render.snapCamera();
  }

  function loop(t) {
    requestAnimationFrame(loop);
    var dt = Math.min((t - lastT) / 1000 || 0, 0.05);
    lastT = t;
    var input = VMR.input;
    var s = VMR.physics.state;
    // Smooth the axes first: physics and the control surfaces read
    // the eased values from here on.
    input.smooth(dt);

    // Global keys.
    if (input.pressed('KeyM')) {
      VMR.audio.setMuted(!VMR.audio.muted);
      VMR.hud.toast(VMR.audio.muted ? 'Sound off' : 'Sound on');
    }
    if (state === 'title') {
      if (input.pressed('Digit1')) startMission(0);
      else if (input.pressed('Digit2')) startMission(1);
      else if (input.pressed('Digit3')) startMission(2);
      else if (input.pressed('Enter') || input.pressed('Space')) startMission(0);
    } else if (state === 'flying') {
      if (input.pressed('KeyP')) {
        state = 'paused';
        VMR.hud.show('paused');
      } else if (input.pressed('KeyR')) {
        startMission(VMR.missions.index);
      } else if (input.pressed('KeyG')) {
        s.gear = !s.gear;
        VMR.hud.toast(s.gear ? 'Gear down' : 'Gear up');
      } else if (input.pressed('KeyF')) {
        s.flaps = !s.flaps;
        VMR.hud.toast(s.flaps ? 'Flaps down' : 'Flaps up');
      }
    } else if (state === 'paused') {
      if (input.pressed('KeyP')) {
        state = 'flying';
        VMR.hud.show(null);
      } else if (input.pressed('KeyR')) {
        startMission(VMR.missions.index);
      }
    } else if (state === 'crashed' || state === 'complete') {
      if (input.pressed('KeyR') || input.pressed('Enter')) startMission(VMR.missions.index);
    }

    if (state === 'flying' && !shotFrozen) {
      if (shotHoldAt !== null && s.time >= shotHoldAt) {
        shotFrozen = true;
      } else {
        VMR.physics.update(dt, input, VMR.missions.wind);
        var evs = VMR.physics.events;
        VMR.physics.events = [];
        for (var i = 0; i < evs.length; i++) {
          var ev = evs[i];
          if (ev.type === 'landed') {
            VMR.audio.thud();
            VMR.missions.onLanded(ev);
          } else if (ev.type === 'crashed') {
            crash(ev.reason);
          }
        }
        var before = VMR.missions.score;
        VMR.missions.update(dt);
        if (VMR.missions.score > before) VMR.audio.chime();
        if (VMR.missions.complete) complete();
        VMR.audio.setEngine(s.throttle, s.speed);
      }
    }

    VMR.render.update(dt, t / 1000);
    VMR.hud.update(dt);
    input.endFrame();
  }

  function boot() {
    VMR.render.init(el('game-container'));
    VMR.hud.init();
    VMR.input.attach();
    // Title screen: plane parked on the home strip behind the menu.
    VMR.missions.start(0);
    state = 'title';
    VMR.hud.show('title');
    el('missionName').textContent = VMR.config.missionNames[0];

    el('startBtn').addEventListener('click', function () { startMission(0); });
    document.querySelectorAll('.mission-card').forEach(function (card) {
      card.addEventListener('click', function () {
        startMission(parseInt(card.getAttribute('data-mission'), 10));
      });
    });
    el('resumeBtn').addEventListener('click', function () {
      state = 'flying';
      VMR.hud.show(null);
    });
    el('retryBtn').addEventListener('click', function () { startMission(VMR.missions.index); });
    el('againBtn').addEventListener('click', function () { startMission(VMR.missions.index); });
    el('menuBtn').addEventListener('click', function () {
      VMR.missions.start(0);
      state = 'title';
      VMR.hud.show('title');
    });
    el('menuBtn2').addEventListener('click', function () {
      VMR.missions.start(0);
      state = 'title';
      VMR.hud.show('title');
    });

    var params = new URLSearchParams(window.location.search);
    var shot = params.get('shot');
    if (shot) applyShot(shot);

    window.__vmr = {
      get state() { return state; },
      get frozen() { return shotFrozen; },
      get physics() { return VMR.physics.state; },
      get missions() { return VMR.missions; },
      startMission: startMission
    };
    requestAnimationFrame(loop);
    window.__vmrReady = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
