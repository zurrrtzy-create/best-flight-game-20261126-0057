// Volcano Mail Run — keyboard + mouse input. Arrows pitch and roll, A/D
// rudder, W/S throttle, G gear, F flaps, B brakes, P pause, R restart,
// M mute. Dragging the mouse steers; the wheel trims the throttle.
(function () {
  var VMR = window.VMR || (window.VMR = {});

  var I = {
    keys: {},
    justPressed: {},
    mouseDX: 0,
    mouseDY: 0,
    wheel: 0,
    dragging: false,
    // Smoothed axes: the stick eases toward the raw input instead of
    // snapping between -1/0/1, so the plane never jerks.
    _pitchSm: 0,
    _rollSm: 0,
    _rudSm: 0,
    _mouseXSm: 0,
    _mouseYSm: 0
  };
  VMR.input = I;

  I.attach = function () {
    window.addEventListener('keydown', function (e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
      if (!I.keys[e.code]) I.justPressed[e.code] = true;
      I.keys[e.code] = true;
    });
    window.addEventListener('keyup', function (e) { I.keys[e.code] = false; });
    var canvasHost = document.getElementById('game-container');
    canvasHost.addEventListener('mousedown', function () { I.dragging = true; });
    window.addEventListener('mouseup', function () { I.dragging = false; });
    window.addEventListener('mousemove', function (e) {
      if (!I.dragging) return;
      I.mouseDX += e.movementX || 0;
      I.mouseDY += e.movementY || 0;
    });
    canvasHost.addEventListener('wheel', function (e) {
      e.preventDefault();
      I.wheel += (e.deltaY < 0 ? 1 : -1) * 0.06;
    }, { passive: false });
  };

  I.endFrame = function () {
    I.justPressed = {};
    I.mouseDX = 0;
    I.mouseDY = 0;
  };

  I.pressed = function (code) { return !!I.justPressed[code]; };
  I.down = function (code) { return !!I.keys[code]; };

  // Raw (instant) keyboard axes, before smoothing.
  function rawPitch() {
    return (I.keys.ArrowUp ? 1 : 0) - (I.keys.ArrowDown ? 1 : 0);
  }
  function rawRoll() {
    return (I.keys.ArrowRight ? 1 : 0) - (I.keys.ArrowLeft ? 1 : 0);
  }
  function rawRudder() {
    return (I.keys.KeyD ? 1 : 0) - (I.keys.KeyA ? 1 : 0);
  }
  // Exponential approach: quick to engage, slower to release, so the
  // stick feels weighted instead of snapping between -1/0/1.
  function easeAxis(cur, target, dt) {
    var rate = Math.abs(target) > Math.abs(cur) ? 6 : 3.5;
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }

  // Ease every axis toward its raw value. Called once per frame, before
  // physics, so physics and control surfaces always read smoothed axes.
  I.smooth = function (dt) {
    I._pitchSm = easeAxis(I._pitchSm, rawPitch(), dt);
    I._rollSm = easeAxis(I._rollSm, rawRoll(), dt);
    I._rudSm = easeAxis(I._rudSm, rawRudder(), dt);
    I._mouseXSm = easeAxis(I._mouseXSm, VMR.util.clamp(I.mouseDX * 0.004, -1, 1), dt);
    I._mouseYSm = easeAxis(I._mouseYSm, VMR.util.clamp(-I.mouseDY * 0.004, -1, 1), dt);
  };

  // Per-frame control axes, in -1..1 (smoothed).
  Object.defineProperty(I, 'pitchAxis', {
    get: function () {
      return VMR.util.clamp(I._pitchSm + I._mouseYSm, -1, 1);
    }
  });
  Object.defineProperty(I, 'rollAxis', {
    get: function () {
      return VMR.util.clamp(I._rollSm + I._mouseXSm, -1, 1);
    }
  });
  Object.defineProperty(I, 'rudderAxis', {
    get: function () {
      return I._rudSm;
    }
  });
  Object.defineProperty(I, 'throttleAxis', {
    get: function () {
      return (I.keys.KeyW ? 1 : 0) - (I.keys.KeyS ? 1 : 0);
    }
  });
  Object.defineProperty(I, 'brake', {
    get: function () { return !!I.keys.KeyB; }
  });
  I.consumeWheel = function () {
    var w = I.wheel;
    I.wheel = 0;
    return w;
  };
})();
