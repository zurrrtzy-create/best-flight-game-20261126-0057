// Volcano Mail Run — HUD: big readable flight numbers, fuel and score,
// a toast line, and a lit instrument panel drawn on a 2D canvas:
// artificial horizon, airspeed, altimeter, compass tape and fuel gauge.
(function () {
  var VMR = window.VMR || (window.VMR = {});
  var util = VMR.util;

  var H = {
    el: {},
    toastTimer: null,
    panel: null,
    pctx: null,
    // Eased display values: the numbers glide instead of flickering
    // with every frame's raw reading.
    _alt: 0,
    _spd: 0,
    _hdg: 90,
    _fuel: 1,
    _score: 0
  };
  VMR.hud = H;

  H.init = function () {
    ['alt', 'spd', 'hdg', 'score', 'fuelFill', 'fuelText', 'objective', 'toast',
     'title', 'paused', 'crashed', 'complete', 'crashReason', 'finalScore',
     'finalTitle', 'missionName'].forEach(function (id) {
      H.el[id] = document.getElementById(id);
    });
    H.panel = document.getElementById('panel');
    H.pctx = H.panel.getContext('2d');
  };

  H.toast = function (text) {
    if (!H.el.toast) return;
    H.el.toast.textContent = text;
    H.el.toast.classList.add('show');
    clearTimeout(H.toastTimer);
    H.toastTimer = setTimeout(function () { H.el.toast.classList.remove('show'); }, 3200);
  };

  H.show = function (which) {
    ['title', 'paused', 'crashed', 'complete'].forEach(function (k) {
      if (H.el[k]) H.el[k].classList.remove('show');
    });
    if (which && H.el[which]) {
      // The paused/crashed/complete overlays start with the 'hidden'
      // class (display:none); 'show' alone only fades opacity, so the
      // class has to come off or the overlay never appears at all.
      H.el[which].classList.remove('hidden');
      H.el[which].classList.add('show');
    }
  };

  H.update = function (dt) {
    var s = VMR.physics.state;
    var M = VMR.missions;
    if (!s) return;
    var step = dt || 0.016;
    var k = 1 - Math.exp(-6 * step);
    H._alt += (s.y * 3.28084 - H._alt) * k;
    H._spd += (s.speed * 1.94384 - H._spd) * k;
    // Heading eases along the shortest arc, so 359° -> 001° glides
    // forward instead of spinning all the way back.
    var dh = ((s.heading - H._hdg + 540) % 360) - 180;
    H._hdg = (H._hdg + dh * k + 360) % 360;
    H._fuel += (s.fuel - H._fuel) * k;
    // Score counts up toward the real total.
    var ds = M.score - H._score;
    if (ds > 0) H._score += Math.min(ds, Math.max(ds * Math.min(1, 5 * step), 60 * step));
    else H._score = M.score;
    H.el.alt.textContent = util.fmtInt(H._alt);
    H.el.spd.textContent = util.fmtInt(H._spd);
    var hdg = Math.round(H._hdg) % 360;
    H.el.hdg.textContent = ('00' + hdg).slice(-3) + '°';
    H.el.score.textContent = util.fmtInt(H._score);
    H.el.fuelFill.style.width = Math.round(H._fuel * 100) + '%';
    H.el.fuelFill.classList.toggle('low', H._fuel < 0.22);
    H.el.fuelText.textContent = Math.round(H._fuel * 100) + '%';
    H.el.objective.textContent = M.objective();
    // Dial needles read the eased values, not the raw ones.
    drawPanel({
      speed: H._spd / 1.94384, y: H._alt / 3.28084, heading: H._hdg,
      bank: s.bank, pitch: s.pitch, fuel: H._fuel,
      gear: s.gear, flaps: s.flaps
    });
  };

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
  }

  function drawPanel(s) {
    var ctx = H.pctx;
    var W = 520, Hh = 150;
    ctx.clearRect(0, 0, W, Hh);
    // Panel body.
    ctx.fillStyle = 'rgba(10, 18, 28, 0.88)';
    roundRect(ctx, 4, 4, W - 8, Hh - 8, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 180, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = '#7fd4ff';
    ctx.shadowBlur = 6;

    drawHorizon(ctx, 82, 75, 56, s);
    drawDial(ctx, 212, 75, 52, s.speed * 1.94384, 160, 'KT', 'SPD');
    drawDial(ctx, 330, 75, 52, s.y * 3.28084, 9000, 'FT', 'ALT');
    drawCompass(ctx, 448, 75, s.heading);
    ctx.restore();

    // Fuel bar + gear/flaps lamps.
    ctx.save();
    ctx.fillStyle = '#9fb6cc';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FUEL', 448, 138);
    ctx.fillStyle = '#12303f';
    ctx.fillRect(490, 128, 22, 10);
    ctx.fillStyle = s.fuel < 0.22 ? '#ff5040' : '#37d67a';
    ctx.fillRect(490, 128, 22 * s.fuel, 10);
    ctx.fillStyle = s.gear ? '#37d67a' : '#556';
    ctx.fillRect(20, 132, 12, 12);
    ctx.fillStyle = '#9fb6cc';
    ctx.fillText('GEAR', 36, 142);
    ctx.fillStyle = s.flaps ? '#37d67a' : '#556';
    ctx.fillRect(84, 132, 12, 12);
    ctx.fillStyle = '#9fb6cc';
    ctx.fillText('FLAPS', 100, 142);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawHorizon(ctx, cx, cy, r, s) {
    ctx.save();
    circle(ctx, cx, cy, r);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-s.bank);
    var pitchPx = util.clamp(s.pitch, -0.35, 0.35) * 150;
    ctx.translate(0, pitchPx);
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-r - 4, -r - 4, (r + 4) * 2, r + 4);
    ctx.fillStyle = '#8a5a33';
    ctx.fillRect(-r - 4, 0, (r + 4) * 2, r + 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    [-24, -12, 12, 24].forEach(function (off) {
      ctx.beginPath(); ctx.moveTo(-16, off); ctx.lineTo(16, off); ctx.stroke();
    });
    ctx.restore();
    ctx.save();
    circle(ctx, cx, cy, r);
    ctx.strokeStyle = '#dfe9f2';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffb020';
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy + 2); ctx.lineTo(cx - 8, cy + 2); ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx + 8, cy + 2); ctx.lineTo(cx + 26, cy + 2); ctx.lineTo(cx + 26, cy + 6);
    ctx.lineTo(cx, cy + 14); ctx.lineTo(cx - 26, cy + 6);
    ctx.closePath(); ctx.fill();
    // Bank pointer.
    ctx.translate(cx, cy);
    ctx.rotate(-s.bank);
    ctx.fillStyle = '#ffb020';
    ctx.beginPath();
    ctx.moveTo(0, -r + 2); ctx.lineTo(-6, -r + 12); ctx.lineTo(6, -r + 12);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawDial(ctx, cx, cy, r, value, max, unit, label) {
    ctx.save();
    circle(ctx, cx, cy, r);
    ctx.fillStyle = '#0e1a26';
    ctx.fill();
    ctx.strokeStyle = '#dfe9f2';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#dfe9f2';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy - r + 16);
    // Ticks.
    for (var i = 0; i <= 10; i++) {
      var a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      var x1 = cx + Math.cos(a) * (r - 6), y1 = cy + Math.sin(a) * (r - 6);
      var x2 = cx + Math.cos(a) * (r - 13), y2 = cy + Math.sin(a) * (r - 13);
      ctx.strokeStyle = '#9fb6cc';
      ctx.lineWidth = i % 5 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // Needle.
    var frac = util.clamp(value / max, 0, 1);
    var na = -Math.PI * 0.75 + frac * Math.PI * 1.5;
    ctx.strokeStyle = '#ffb020';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(na) * (r - 16), cy + Math.sin(na) * (r - 16)); ctx.stroke();
    ctx.fillStyle = '#eaf4ff';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(util.fmtInt(value), cx, cy + 26);
    ctx.fillStyle = '#9fb6cc';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(unit, cx, cy + 40);
    ctx.restore();
  }

  function drawCompass(ctx, cx, cy, heading) {
    ctx.save();
    ctx.fillStyle = '#0e1a26';
    roundRect(ctx, cx - 58, cy - 26, 116, 52, 8);
    ctx.fill();
    ctx.strokeStyle = '#dfe9f2';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    roundRect(ctx, cx - 58, cy - 26, 116, 52, 8);
    ctx.clip();
    var marks = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    marks.forEach(function (m) {
      var d = ((m[0] - heading + 540) % 360) - 180; // -180..180
      var x = cx + d * 0.9;
      if (x < cx - 70 || x > cx + 70) return;
      ctx.fillStyle = m[0] % 90 === 0 ? '#ffb020' : '#dfe9f2';
      ctx.fillText(m[1], x, cy + 5);
    });
    ctx.restore();
    // Centre caret.
    ctx.fillStyle = '#ff5040';
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 26); ctx.lineTo(cx + 7, cy - 26); ctx.lineTo(cx, cy - 16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9fb6cc';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText('HDG', cx, cy + 24);
    ctx.restore();
  }
})();
