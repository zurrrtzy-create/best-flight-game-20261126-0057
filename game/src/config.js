// Volcano Mail Run — tuning constants, island layout and small helpers.
// Everything is in metres / seconds; the HUD converts to feet and knots.
(function () {
  var VMR = window.VMR || (window.VMR = {});

  VMR.config = {
    worldSize: 4200,
    volcano: { x: -300, z: -400, height: 600, radius: 980, craterDip: 90 },
    runways: [
      { name: 'Cendana Field', x: 1000, z: 800, heading: 90, length: 700, width: 46, home: true },
      { name: 'North Strip', x: -800, z: -1400, heading: 0, length: 520, width: 36 },
      { name: 'East Strip', x: 1500, z: -900, heading: 90, length: 520, width: 36 }
    ],
    villages: [
      { x: 1250, z: 1250, houses: 11 },
      { x: -1250, z: 950, houses: 9 },
      { x: 350, z: -1550, houses: 10 }
    ],
    plane: {
      maxSpeed: 78, stallClean: 27, stallFlaps: 21, rotateSpeed: 33,
      climbAngle: 0.21, diveAngle: -0.17, maxBank: 0.8,
      accel: 7, decel: 9, brakeDecel: 16,
      gearHeight: 1.6
    },
    scoring: { ring: 100, delivery: 250, landingMax: 200 },
    ringRadius: 30,
    ringRunCount: 8,
    stormRingCount: 6,
    missionNames: ['Ring Run', 'Mail Drop', 'Storm Return']
  };

  VMR.util = {
    clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    smoothstep: function (a, b, x) {
      var t = VMR.util.clamp((x - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    },
    deg: function (r) { return r * 180 / Math.PI; },
    rad: function (d) { return d * Math.PI / 180; },
    // Heading in degrees, clockwise from north (-Z). Returns {x, z}.
    headingVec: function (deg) {
      var h = VMR.util.rad(deg);
      return { x: Math.sin(h), z: -Math.cos(h) };
    },
    headingFromVec: function (x, z) {
      return VMR.util.deg(Math.atan2(x, -z));
    },
    fmtInt: function (n) { return Math.round(n).toLocaleString('en-US'); }
  };
})();
