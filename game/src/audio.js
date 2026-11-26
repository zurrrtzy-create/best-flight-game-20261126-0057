// Volcano Mail Run — synthesised WebAudio: engine drone pitched by
// throttle, wind rush by speed, a chime for rings, a thud for touchdown
// and a noise burst for a crash. No audio files, nothing over the network.
(function () {
  var VMR = window.VMR || (window.VMR = {});

  var A = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineFilter: null,
    engineGain: null,
    windSrc: null,
    windGain: null,
    muted: false
  };
  VMR.audio = A;

  function noiseBuffer(ctx, seconds) {
    var buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  A.resume = function () {
    try {
      if (!A.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        var ctx = new AC();
        A.ctx = ctx;
        A.master = ctx.createGain();
        A.master.gain.value = 0.5;
        A.master.connect(ctx.destination);
        // Engine: two detuned oscillators through a low-pass.
        A.engineFilter = ctx.createBiquadFilter();
        A.engineFilter.type = 'lowpass';
        A.engineFilter.frequency.value = 500;
        A.engineGain = ctx.createGain();
        A.engineGain.gain.value = 0;
        A.engineOsc = ctx.createOscillator();
        A.engineOsc.type = 'sawtooth';
        A.engineOsc.frequency.value = 60;
        A.engineOsc2 = ctx.createOscillator();
        A.engineOsc2.type = 'square';
        A.engineOsc2.frequency.value = 30;
        var g2 = ctx.createGain();
        g2.gain.value = 0.5;
        A.engineOsc.connect(A.engineFilter);
        A.engineOsc2.connect(g2);
        g2.connect(A.engineFilter);
        A.engineFilter.connect(A.engineGain);
        A.engineGain.connect(A.master);
        A.engineOsc.start();
        A.engineOsc2.start();
        // Wind: looped noise through a band-pass.
        A.windSrc = ctx.createBufferSource();
        A.windSrc.buffer = noiseBuffer(ctx, 2);
        A.windSrc.loop = true;
        var bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 520;
        bp.Q.value = 0.6;
        A.windGain = ctx.createGain();
        A.windGain.gain.value = 0;
        A.windSrc.connect(bp);
        bp.connect(A.windGain);
        A.windGain.connect(A.master);
        A.windSrc.start();
      }
      if (A.ctx.state === 'suspended') A.ctx.resume();
    } catch (err) { /* audio is optional; the game plays on silently */ }
  };

  A.setEngine = function (throttle, speed) {
    if (!A.ctx) return;
    try {
      var t = A.ctx.currentTime;
      var rpm = 55 + throttle * 80 + speed * 0.2;
      A.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
      A.engineOsc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
      A.engineFilter.frequency.setTargetAtTime(380 + throttle * 950, t, 0.1);
      A.engineGain.gain.setTargetAtTime(0.04 + throttle * 0.09, t, 0.1);
      A.windGain.gain.setTargetAtTime(Math.min(0.14, speed * 0.0016), t, 0.15);
    } catch (err) { /* ignore */ }
  };

  function blip(freq, at, dur, vol, type) {
    if (!A.ctx) return;
    try {
      var t = A.ctx.currentTime + at;
      var o = A.ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      var g = A.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(A.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (err) { /* ignore */ }
  }

  A.chime = function () {
    blip(880, 0, 0.35, 0.25);
    blip(1318.5, 0.09, 0.4, 0.22);
  };

  A.thud = function () {
    blip(70, 0, 0.3, 0.5, 'sine');
    if (!A.ctx) return;
    try {
      var t = A.ctx.currentTime;
      var src = A.ctx.createBufferSource();
      src.buffer = noiseBuffer(A.ctx, 0.2);
      var f = A.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 300;
      var g = A.ctx.createGain();
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      src.connect(f); f.connect(g); g.connect(A.master);
      src.start(t); src.stop(t + 0.2);
    } catch (err) { /* ignore */ }
  };

  A.crash = function () {
    if (!A.ctx) return;
    try {
      var t = A.ctx.currentTime;
      var src = A.ctx.createBufferSource();
      src.buffer = noiseBuffer(A.ctx, 0.7);
      var g = A.ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      src.connect(g); g.connect(A.master);
      src.start(t); src.stop(t + 0.7);
    } catch (err) { /* ignore */ }
    blip(55, 0, 0.5, 0.5, 'sine');
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (A.master) A.master.gain.value = m ? 0 : 0.5;
  };
})();
