// Volcano Mail Run — arcade flight model: throttle, pitch and bank targets
// chased with lags, banked turns, stall sink, ground roll, rotation,
// touchdown / crash detection and fuel burn. Kinematic on purpose: it has
// to feel good on a keyboard, not simulate a real airfoil.
(function () {
  var VMR = window.VMR || (window.VMR = {});
  var cfg = VMR.config;
  var util = VMR.util;

  var phys = {
    state: null,
    events: []
  };
  VMR.physics = phys;

  function freshState() {
    return {
      x: 0, y: 0, z: 0,
      heading: 90, pitch: 0, bank: 0,
      pitchVel: 0, bankVel: 0, gustSm: 0,
      speed: 0, vspeed: 0, throttle: 0,
      flaps: false, gear: true, flapsAmount: 0, gearAmount: 1,
      fuel: 1, damage: 0,
      airborne: false, airborneSince: 0, crashed: false, crashReason: '',
      landedRunway: null, landingVspeed: 0, time: 0
    };
  }

  phys.reset = function (spawn) {
    var s = freshState();
    s.x = spawn.x; s.y = spawn.y; s.z = spawn.z;
    s.heading = spawn.heading;
    s.speed = spawn.speed || 0;
    s.throttle = spawn.throttle || 0;
    s.fuel = (spawn.fuel !== undefined) ? spawn.fuel : 1;
    s.airborne = !!spawn.airborne;
    s.gear = spawn.gear !== undefined ? spawn.gear : true;
    s.flaps = !!spawn.flaps;
    s.flapsAmount = s.flaps ? 1 : 0;
    s.gearAmount = s.gear ? 1 : 0;
    phys.state = s;
    phys.events = [];
    return s;
  };

  function runwayAt(x, z) {
    var list = VMR.world.runwayData;
    for (var i = 0; i < list.length; i++) {
      var rw = list[i];
      var h = util.rad(rw.heading);
      var dx = x - rw.x, dz = z - rw.z;
      var lx = dx * Math.sin(h) + dz * -Math.cos(h);
      var lz = dx * Math.cos(h) + dz * Math.sin(h);
      if (Math.abs(lx) <= rw.length / 2 + 30 && Math.abs(lz) <= rw.width / 2 + 12) return rw;
    }
    return null;
  }

  phys.update = function (dt, input, wind) {
    var s = phys.state;
    if (!s || s.crashed) return;
    s.time += dt;
    var P = cfg.plane;
    var events = phys.events;

    // --- throttle ---
    s.throttle = util.clamp(s.throttle + input.throttleAxis * 0.55 * dt + input.consumeWheel(), 0, 1);
    if (s.fuel <= 0) s.throttle = 0;

    // --- flaps and gear deploy gradually, not instantly ---
    var flapTarget = s.flaps ? 1 : 0;
    s.flapsAmount += (flapTarget - s.flapsAmount) * Math.min(1, 2.2 * dt);
    var gearTarget = s.gear ? 1 : 0;
    s.gearAmount += (gearTarget - s.gearAmount) * Math.min(1, 2.2 * dt);

    // --- attitude targets from the controls ---
    var pitchTarget = util.clamp(input.pitchAxis, -1, 1);
    var targetFpa = pitchTarget >= 0
      ? pitchTarget * P.climbAngle
      : pitchTarget * -P.diveAngle;
    var bankTarget = util.clamp(input.rollAxis, -1, 1) * P.maxBank;
    // Second-order spring-damper: the nose and wings ease into the
    // target with a soft settle instead of chasing it on a fixed lag.
    var springK = s.airborne ? 10 : 14;
    var damp = 4.5;
    s.pitchVel += ((targetFpa - s.pitch) * springK - s.pitchVel * damp) * dt;
    s.pitch += s.pitchVel * dt;
    s.bankVel += ((bankTarget - s.bank) * springK - s.bankVel * damp) * dt;
    s.bank += s.bankVel * dt;

    // --- speed toward its target ---
    var stall = util.lerp(P.stallClean, P.stallFlaps, s.flapsAmount);
    var top = P.maxSpeed * util.lerp(1, 0.72, s.flapsAmount) * util.lerp(1, 0.92, s.gearAmount);
    if (s.fuel <= 0) top = Math.min(top, 26);
    var targetSpeed = s.throttle * top;
    if (!s.airborne && s.throttle < 0.05) targetSpeed = 0;
    var accel = targetSpeed > s.speed ? P.accel : (input.brake ? P.brakeDecel : P.decel);
    if (targetSpeed > s.speed) s.speed = Math.min(targetSpeed, s.speed + accel * dt);
    else s.speed = Math.max(targetSpeed, s.speed - accel * dt);

    // --- heading from bank + rudder ---
    var turnRate = 9.81 * Math.tan(s.bank) / Math.max(s.speed, 12);
    s.heading += util.deg(turnRate * dt) + input.rudderAxis * 7 * dt;
    if (s.heading >= 360) s.heading -= 360;
    if (s.heading < 0) s.heading += 360;

    // --- vertical motion ---
    var groundY = VMR.world.heightAt(s.x, s.z) + P.gearHeight;
    if (s.airborne) {
      var targetV;
      if (s.speed > stall) {
        targetV = s.speed * Math.sin(s.pitch);
      } else {
        // Stalled: mush down instead of lawn-darting, so a slow
        // approach can still be saved with power.
        targetV = -3.5 - (stall - s.speed) * 0.3;
        s.pitch += (-0.05 - s.pitch) * Math.min(1, dt);
      }
      // Ease toward the target climb/sink rate instead of setting it
      // instantly, so a stall mushes in gradually.
      s.vspeed += (targetV - s.vspeed) * Math.min(1, 3 * dt);
      s.y += s.vspeed * dt;
      // Wind drift + a little turbulence when the wind is up.
      s.x += wind.x * dt;
      s.z += wind.z * dt;
      // Gusts swell and fade slowly instead of hammering the wings
      // with a raw sine every frame.
      var gustTarget = Math.sin(s.time * 0.35) * Math.sin(s.time * 0.13 + 1.7);
      s.gustSm += (gustTarget - s.gustSm) * Math.min(1, 0.8 * dt);
      if (wind.gust > 0) {
        s.y += s.gustSm * wind.gust * 0.35 * dt;
        s.bank += s.gustSm * wind.gust * 0.012 * dt;
      }
    } else {
      s.y = groundY;
      s.vspeed = 0;
      if (s.speed > P.rotateSpeed && input.pitchAxis > 0.25) {
        s.airborne = true;
        s.airborneSince = s.time;
        s.pitch = 0.06;
        s.y = groundY + 3; // small hop: the same frame's ground-contact
        // check must not read this as an instant touchdown.
      }
    }

    // --- horizontal motion ---
    var fwd = util.headingVec(s.heading);
    var flat = Math.cos(s.pitch);
    s.x += fwd.x * flat * s.speed * dt;
    s.z += fwd.z * flat * s.speed * dt;

    // --- fuel ---
    if (s.airborne) s.fuel = Math.max(0, s.fuel - (0.0009 + s.throttle * 0.0013) * dt);
    else s.fuel = Math.max(0, s.fuel - s.throttle * 0.0004 * dt);

    // --- ground contact (not in the first moments after rotation) ---
    if (s.airborne && s.time - (s.airborneSince || 0) > 0.6) {
      var gy = VMR.world.heightAt(s.x, s.z);
      if (s.y <= gy + P.gearHeight) {
        s.y = gy + P.gearHeight;
        var rw = runwayAt(s.x, s.z);
        var gentle = s.vspeed > -5.5;
        if (gy < 0.5) {
          crash(s, 'Ditched in the sea');
        } else if (rw && s.gear && gentle && s.speed > 22) {
          s.airborne = false;
          s.landedRunway = rw.name;
          s.landingVspeed = s.vspeed;
          s.vspeed = 0;
          events.push({ type: 'landed', runway: rw.name, vspeed: s.landingVspeed });
        } else if (!s.gear || s.vspeed <= -4.5) {
          crash(s, !s.gear ? 'Belly landing — gear was up' : 'Hard impact with the ground');
        } else {
          // Gentle off-runway touchdown: a rough-field landing.
          s.airborne = false;
          s.damage = Math.min(1, s.damage + 0.15);
          s.landedRunway = null;
          s.landingVspeed = s.vspeed;
          s.vspeed = 0;
          events.push({ type: 'landed', runway: null, vspeed: s.landingVspeed });
        }
      }
    }
    if (s.damage >= 1) crash(s, 'Airframe damage');
  };

  function crash(s, reason) {
    s.crashed = true;
    s.crashReason = reason;
    s.speed = 0;
    phys.events.push({ type: 'crashed', reason: reason });
  }
})();
