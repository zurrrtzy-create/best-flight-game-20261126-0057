// Volcano Mail Run — deterministic randomness: a small seeded PRNG plus
// 2D value noise with fractal octaves. The island looks the same every load,
// which keeps the screenshots and the physics in agreement.
(function () {
  var VMR = window.VMR || (window.VMR = {});

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Deterministic lattice hash -> [0, 1).
  function hash2(ix, iz, seed) {
    var h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (((h ^ (h >>> 16)) >>> 0) % 100000) / 100000;
  }

  function fade(t) { return t * t * (3 - 2 * t); }

  function valueNoise(x, z, seed) {
    var ix = Math.floor(x), iz = Math.floor(z);
    var fx = x - ix, fz = z - iz;
    var a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
    var c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
    var u = fade(fx), v = fade(fz);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
  }

  function fbm(x, z, seed, octaves) {
    var sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (var i = 0; i < octaves; i++) {
      sum += amp * valueNoise(x * freq, z * freq, seed + i * 101);
      norm += amp;
      amp *= 0.5; freq *= 2.03;
    }
    return sum / norm; // 0..1
  }

  VMR.noise = { rng: mulberry32, hash2: hash2, valueNoise: valueNoise, fbm: fbm };
})();
