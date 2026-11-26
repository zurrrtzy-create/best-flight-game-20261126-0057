// Volcano Mail Run — Pulau Api: heightfield island with a volcano cone,
// coastline, three flattened airstrips, villages, pine forest, drifting
// clouds, crater smoke and the glowing target rings.
(function () {
  var VMR = window.VMR || (window.VMR = {});
  var cfg = VMR.config;
  var util = VMR.util;
  var noise = VMR.noise;

  var world = {
    scene: null,
    sun: null,
    clouds: [],
    smoke: [],
    ringSets: { run: [], storm: [] },
    ringMeshes: [],
    runwayData: []
  };
  VMR.world = world;

  // Distance from (x, z) to a runway rectangle, in the runway's local frame.
  function runwayRectDist(x, z, rw) {
    var h = util.rad(rw.heading);
    var dx = x - rw.x, dz = z - rw.z;
    // Rotate into runway frame: local +X runs along the runway.
    var lx = dx * Math.sin(h) + dz * -Math.cos(h);
    var lz = dx * Math.cos(h) + dz * Math.sin(h);
    var ox = Math.max(Math.abs(lx) - rw.length / 2, 0);
    var oz = Math.max(Math.abs(lz) - rw.width / 2, 0);
    return Math.hypot(ox, oz);
  }

  // Raw island height before runway flattening. Sharper relief than
  // a smooth hill: a steep cone, ridged crests for valleys between
  // them, and a raised cliff rim where the land meets the sea, so the
  // island reads as layered 3D terrain instead of a flat mound.
  function rawHeight(x, z) {
    var r = Math.hypot(x, z);
    var land = 1 - util.smoothstep(1500, 2150, r);
    var hills = noise.fbm(x * 0.0016 + 7.3, z * 0.0016 + 2.9, 11, 4) * 95;
    // Ridged noise: sharp crests with V valleys between them.
    var ridge = Math.pow(1 - Math.abs(2 * noise.fbm(x * 0.0009 + 11.7, z * 0.0009 + 5.1, 7, 3) - 1), 2.2) * 130;
    var dv = Math.hypot(x - cfg.volcano.x, z - cfg.volcano.z);
    var cone = Math.pow(Math.max(0, 1 - dv / cfg.volcano.radius), 2.1) * cfg.volcano.height;
    var crater = cfg.volcano.craterDip * (1 - util.smoothstep(40, 160, dv));
    // Coastal cliff rim: peaks where the land factor is mid-shore.
    var shore = land * (1 - land) * 4;
    return (hills + ridge + cone - crater) * land + shore * 22 + (-26) * (1 - land);
  }

  // Final height: raw island, flattened smoothly around every runway.
  function heightAt(x, z) {
    var h = rawHeight(x, z);
    for (var i = 0; i < cfg.runways.length; i++) {
      var rw = cfg.runways[i];
      var d = runwayRectDist(x, z, rw);
      var f = 1 - util.smoothstep(0, 90, d);
      if (f > 0) h = util.lerp(h, rw.elev, f);
    }
    return h;
  }
  world.heightAt = heightAt;
  world.runwayRectDist = runwayRectDist;

  function slopeAt(x, z) {
    var e = 6;
    var dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
    var dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  }

  function buildTerrain(scene) {
    var size = cfg.worldSize;
    var seg = 180;
    var geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var sand = new THREE.Color(0xd9c08a);
    var grassA = new THREE.Color(0x5d8a3c);
    var grassB = new THREE.Color(0x7da050);
    var rock = new THREE.Color(0x6e6156);
    var ash = new THREE.Color(0x554a41);
    var cliff = new THREE.Color(0x5d5348);
    var c = new THREE.Color();
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var h = heightAt(x, z);
      pos.setY(i, h);
      var n = noise.fbm(x * 0.01 + 3, z * 0.01 + 8, 5, 3);
      var dv = Math.hypot(x - cfg.volcano.x, z - cfg.volcano.z);
      var sl = slopeAt(x, z);
      if (h < 3.5) {
        c.copy(sand).offsetHSL(0, 0, (n - 0.5) * 0.06);
      } else if (dv < 300) {
        c.copy(ash).offsetHSL(0, 0, (n - 0.5) * 0.08);
      } else if (sl > 0.85) {
        // Near-vertical faces read as dark cliff, not grass.
        c.copy(cliff).offsetHSL(0, 0, (n - 0.5) * 0.06);
      } else if (h > 380 || sl > 0.55) {
        c.copy(rock).offsetHSL(0, 0, (n - 0.5) * 0.07);
      } else {
        c.copy(grassA).lerp(grassB, n).offsetHSL(0, 0, (n - 0.5) * 0.05);
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  function buildSea(scene) {
    // A segmented plane, not a flat disc: the vertices undulate so the
    // water has real wave relief and catches the light in 3D.
    var geo = new THREE.PlaneGeometry(13000, 13000, 56, 56);
    geo.rotateX(-Math.PI / 2);
    var mat = new THREE.MeshPhongMaterial({
      color: 0x1f6f9f, transparent: true, opacity: 0.88,
      shininess: 90, specular: 0x99ccff
    });
    world.seaMat = mat;
    var sea = new THREE.Mesh(geo, mat);
    sea.position.y = 0.2;
    sea.receiveShadow = true;
    scene.add(sea);
    world.seaGeo = geo;
    world.seaBase = new Float32Array(geo.attributes.position.array);
  }

  function buildRunways(scene) {
    cfg.runways.forEach(function (rw) {
      rw.elev = rawHeight(rw.x, rw.z);
      var g = new THREE.Group();
      g.position.set(rw.x, rw.elev + 0.6, rw.z);
      g.rotation.y = util.rad(90 - rw.heading);
      var strip = new THREE.Mesh(
        new THREE.BoxGeometry(rw.length, 1.2, rw.width),
        new THREE.MeshLambertMaterial({ color: 0x3a3f45 })
      );
      strip.receiveShadow = true;
      g.add(strip);
      var markMat = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
      var dashGeo = new THREE.BoxGeometry(26, 0.25, 2.2);
      for (var i = -5; i <= 5; i++) {
        var dash = new THREE.Mesh(dashGeo, markMat);
        dash.position.set(i * 56, 0.75, 0);
        g.add(dash);
      }
      [-1, 1].forEach(function (side) {
        var edge = new THREE.Mesh(new THREE.BoxGeometry(rw.length, 0.25, 1.6), markMat);
        edge.position.set(0, 0.75, side * (rw.width / 2 - 2));
        g.add(edge);
        for (var k = -2; k <= 2; k++) {
          var bar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 7), markMat);
          bar.position.set(side * (rw.length / 2 - 16), 0.75, k * 8);
          g.add(bar);
        }
      });
      // 3D edge lights: short posts with glowing lamps down both sides,
      // so the strip reads as a built runway at a glance.
      var lightCount = Math.floor(rw.length / 55);
      var postGeo = new THREE.CylinderGeometry(0.16, 0.16, 2.2, 6);
      var postMat = new THREE.MeshLambertMaterial({ color: 0x2a2f36 });
      var lampGeo = new THREE.SphereGeometry(0.85, 8, 8);
      var lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
      var posts = new THREE.InstancedMesh(postGeo, postMat, lightCount * 2);
      var lamps = new THREE.InstancedMesh(lampGeo, lampMat, lightCount * 2);
      var pm = new THREE.Matrix4(), lm = new THREE.Matrix4();
      var li = 0;
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        for (var n2 = 0; n2 < lightCount; n2++) {
          var lx = -rw.length / 2 + 30 + n2 * 55;
          var lz = s2 * (rw.width / 2 + 3);
          pm.makeTranslation(lx, 1.7, lz);
          posts.setMatrixAt(li, pm);
          lm.makeTranslation(lx, 2.9, lz);
          lamps.setMatrixAt(li, lm);
          li++;
        }
      }
      g.add(posts);
      g.add(lamps);
      // Windsock at the home strip: pole + orange cone, swaying gently.
      if (rw.home) {
        var sock = new THREE.Group();
        sock.position.set(rw.length / 2 - 45, 0, rw.width / 2 + 14);
        var pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.3, 8, 8),
          new THREE.MeshLambertMaterial({ color: 0xd8d8d8 })
        );
        pole.position.y = 4;
        pole.castShadow = true;
        sock.add(pole);
        var cone = new THREE.Mesh(
          new THREE.ConeGeometry(1.1, 4.2, 10),
          new THREE.MeshLambertMaterial({ color: 0xff7a1a })
        );
        cone.rotation.z = -Math.PI / 2;
        cone.position.set(2.2, 7.6, 0);
        cone.castShadow = true;
        sock.add(cone);
        g.add(sock);
        world.windsock = cone;
      }
      scene.add(g);
      world.runwayData.push({
        name: rw.name, x: rw.x, z: rw.z, heading: rw.heading,
        length: rw.length, width: rw.width, elev: rw.elev, home: !!rw.home
      });
    });
  }

  function buildVillages(scene) {
    var rng = noise.rng(20261126);
    var wallColors = [0xf6e8c8, 0xf2d8a0, 0xe8b8a0, 0xcfe0f0, 0xf0f0e0];
    var roofColors = [0xa8442e, 0x8a5a2e, 0x74553a, 0x9a3a3a];
    // Dark openings (windows + doors) and chimneys are collected across
    // every house into two shared instanced meshes: 3D detail for the
    // cost of two draw calls.
    var openings = [];
    var chimneys = [];
    cfg.villages.forEach(function (v) {
      for (var i = 0; i < v.houses; i++) {
        var hx = v.x + (rng() - 0.5) * 170;
        var hz = v.z + (rng() - 0.5) * 170;
        var hy = heightAt(hx, hz);
        var w = 6 + rng() * 4, d = 5 + rng() * 4, hh = 3.5 + rng() * 2;
        var rot = rng() * Math.PI;
        var house = new THREE.Group();
        var walls = new THREE.Mesh(
          new THREE.BoxGeometry(w, hh, d),
          new THREE.MeshLambertMaterial({ color: wallColors[(rng() * wallColors.length) | 0] })
        );
        walls.position.y = hh / 2;
        walls.castShadow = true;
        house.add(walls);
        var roof = new THREE.Mesh(
          new THREE.ConeGeometry(Math.max(w, d) * 0.75, 3 + rng() * 1.5, 4),
          new THREE.MeshLambertMaterial({ color: roofColors[(rng() * roofColors.length) | 0] })
        );
        roof.position.y = hh + 1.6;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        house.add(roof);
        house.position.set(hx, hy, hz);
        house.rotation.y = rot;
        scene.add(house);
        // Openings on the front face (local +Z): two windows, one door.
        var sin = Math.sin(rot), cos = Math.cos(rot);
        function front(lx, ly, lz, sx, sy) {
          openings.push({
            x: hx + lx * cos + lz * sin,
            y: hy + ly,
            z: hz - lx * sin + lz * cos,
            rot: rot, sx: sx, sy: sy
          });
        }
        front(-w * 0.25, hh * 0.55, d / 2 + 0.08, 1.3, 1.5);
        front(w * 0.25, hh * 0.55, d / 2 + 0.08, 1.3, 1.5);
        front(0, 1.3, d / 2 + 0.08, 1.5, 2.6);
        // Chimney poking out of the roof slope.
        chimneys.push({
          x: hx + (w * 0.22) * cos, y: hy + hh + 2.4,
          z: hz - (w * 0.22) * sin, rot: rot
        });
      }
    });
    var openGeo = new THREE.BoxGeometry(1, 1, 0.18);
    var openMat = new THREE.MeshLambertMaterial({ color: 0x2a2f36 });
    var openMesh = new THREE.InstancedMesh(openGeo, openMat, openings.length);
    var om = new THREE.Matrix4(), oq = new THREE.Quaternion(), oe = new THREE.Euler();
    var ov = new THREE.Vector3(), os = new THREE.Vector3();
    openings.forEach(function (o, i) {
      oe.set(0, o.rot, 0); oq.setFromEuler(oe);
      ov.set(o.x, o.y, o.z); os.set(o.sx, o.sy, 1);
      om.compose(ov, oq, os);
      openMesh.setMatrixAt(i, om);
    });
    scene.add(openMesh);
    var chimGeo = new THREE.BoxGeometry(0.9, 2.2, 0.9);
    var chimMat = new THREE.MeshLambertMaterial({ color: 0x8a5a3a });
    var chimMesh = new THREE.InstancedMesh(chimGeo, chimMat, chimneys.length);
    chimneys.forEach(function (c, i) {
      oe.set(0, c.rot, 0); oq.setFromEuler(oe);
      ov.set(c.x, c.y, c.z); os.set(1, 1, 1);
      om.compose(ov, oq, os);
      chimMesh.setMatrixAt(i, om);
    });
    chimMesh.castShadow = true;
    scene.add(chimMesh);
  }

  function buildForest(scene) {
    var rng = noise.rng(777);
    var spots = [];
    var tries = 0;
    while (spots.length < 650 && tries < 8000) {
      tries++;
      var x = (rng() - 0.5) * 3800, z = (rng() - 0.5) * 3800;
      var h = heightAt(x, z);
      if (h < 35 || h > 320) continue;
      if (slopeAt(x, z) > 0.5) continue;
      if (Math.hypot(x - cfg.volcano.x, z - cfg.volcano.z) < 320) continue;
      var clear = true;
      for (var i = 0; i < cfg.runways.length; i++) {
        if (runwayRectDist(x, z, cfg.runways[i]) < 95) { clear = false; break; }
      }
      if (!clear) continue;
      for (var j = 0; j < cfg.villages.length; j++) {
        if (Math.hypot(x - cfg.villages[j].x, z - cfg.villages[j].z) < 150) { clear = false; break; }
      }
      if (!clear) continue;
      spots.push({ x: x, z: z, h: h, s: 0.8 + rng() * 0.6, r: rng() * Math.PI * 2 });
    }
    var trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 6);
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2e });
    var canopyGeo = new THREE.ConeGeometry(4.5, 12, 7);
    var canopyMat = new THREE.MeshLambertMaterial({ color: 0x2e5d2a });
    // A second, smaller cone stacked on top: layered canopies instead
    // of a single flat triangle silhouette.
    var canopy2Geo = new THREE.ConeGeometry(3.1, 8, 7);
    var canopy2Mat = new THREE.MeshLambertMaterial({ color: 0x3a7034 });
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    var canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);
    var canopies2 = new THREE.InstancedMesh(canopy2Geo, canopy2Mat, spots.length);
    var m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    var v = new THREE.Vector3(), s = new THREE.Vector3();
    spots.forEach(function (p, i) {
      e.set(0, p.r, 0); q.setFromEuler(e);
      v.set(p.x, p.h + 2.5 * p.s, p.z); s.set(p.s, p.s, p.s);
      m.compose(v, q, s); trunks.setMatrixAt(i, m);
      v.set(p.x, p.h + (5 + 6) * p.s, p.z);
      m.compose(v, q, s); canopies.setMatrixAt(i, m);
      v.set(p.x, p.h + (5 + 11) * p.s, p.z);
      m.compose(v, q, s); canopies2.setMatrixAt(i, m);
    });
    trunks.castShadow = true; canopies.castShadow = true; canopies2.castShadow = true;
    scene.add(trunks); scene.add(canopies); scene.add(canopies2);
  }

  function buildClouds(scene) {
    var rng = noise.rng(4242);
    for (var i = 0; i < 18; i++) {
      // Each cloud gets its own material so its opacity can vary.
      var mat = new THREE.MeshLambertMaterial({
        color: 0xffffff, transparent: true, opacity: 0.85 + rng() * 0.1
      });
      var cloud = new THREE.Group();
      // Puffy 3D clusters: more puffs, stacked in height, only mildly
      // squashed — the old 0.32 squash is what made them read flat.
      var puffs = 5 + ((rng() * 4) | 0);
      for (var j = 0; j < puffs; j++) {
        var r = 34 + rng() * 62;
        var puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
        puff.position.set((rng() - 0.5) * 200, (rng() - 0.5) * 56, (rng() - 0.5) * 110);
        puff.scale.y = 0.55 + rng() * 0.2;
        cloud.add(puff);
      }
      cloud.position.set((rng() - 0.5) * 5200, 520 + rng() * 300, (rng() - 0.5) * 5200);
      scene.add(cloud);
      // Each cloud drifts at its own speed and bobs gently.
      world.clouds.push({
        group: cloud, speed: 4 + rng() * 4,
        baseY: cloud.position.y, phase: rng() * Math.PI * 2
      });
    }
  }

  function buildSmoke(scene) {
    var mat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.32 });
    var top = rawHeight(cfg.volcano.x, cfg.volcano.z);
    for (var i = 0; i < 5; i++) {
      // Each puff gets its own material so it can fade independently.
      var puff = new THREE.Mesh(new THREE.SphereGeometry(16 + i * 5, 10, 8), mat.clone());
      puff.position.set(cfg.volcano.x, top + 20 + i * 34, cfg.volcano.z);
      puff.scale.y = 0.7;
      scene.add(puff);
      world.smoke.push(puff);
    }
  }

  // Soft radial gradient texture for glow sprites (ring halos, sun
  // glare, nav lights). One shared canvas texture, reused everywhere.
  var _radialTex = null;
  // Annulus glow for the rings: bright only in a band around the
  // torus, transparent in the middle, so the halo never washes out
  // whatever sits behind the ring's hole (the volcano, the sky).
  var _ringTex = null;
  function ringTexture() {
    if (_ringTex) return _ringTex;
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    var ctx = cv.getContext('2d');
    var g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.addColorStop(0.78, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    _ringTex = new THREE.CanvasTexture(cv);
    return _ringTex;
  }
  function radialTexture() {
    if (_radialTex) return _radialTex;
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    var ctx = cv.getContext('2d');
    var g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    _radialTex = new THREE.CanvasTexture(cv);
    return _radialTex;
  }

  function buildRocks(scene) {
    var rng = noise.rng(31337);
    var spots = [];
    var tries = 0;
    while (spots.length < 140 && tries < 4000) {
      tries++;
      var x = (rng() - 0.5) * 4000, z = (rng() - 0.5) * 4000;
      var h = heightAt(x, z);
      var beach = h > -2 && h < 3.5;
      var slopeRock = false;
      if (!beach && h > 30 && h < 380) slopeRock = slopeAt(x, z) > 0.35;
      if (!beach && !slopeRock) continue;
      if (Math.hypot(x - cfg.volcano.x, z - cfg.volcano.z) < 300) continue;
      var clear = true;
      for (var i = 0; i < cfg.runways.length; i++) {
        if (runwayRectDist(x, z, cfg.runways[i]) < 80) { clear = false; break; }
      }
      if (!clear) continue;
      spots.push({ x: x, z: z, h: h, s: 1 + rng() * 3.5, r: rng() * Math.PI * 2, sq: 0.6 + rng() * 0.8 });
    }
    var geo = new THREE.DodecahedronGeometry(1, 0);
    var mat = new THREE.MeshLambertMaterial({ color: 0x7a7066, flatShading: true });
    var rocks = new THREE.InstancedMesh(geo, mat, spots.length);
    var m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    var v = new THREE.Vector3(), s = new THREE.Vector3();
    spots.forEach(function (p, i) {
      e.set(rng() * 0.6, p.r, rng() * 0.6); q.setFromEuler(e);
      v.set(p.x, p.h + p.s * 0.3, p.z); s.set(p.s, p.s * p.sq, p.s);
      m.compose(v, q, s); rocks.setMatrixAt(i, m);
    });
    rocks.castShadow = true;
    scene.add(rocks);
  }

  function buildRings(scene, key, count, radius, alt, angleOffset) {
    var set = [];
    for (var i = 0; i < count; i++) {
      var a = angleOffset + i * (Math.PI * 2 / count);
      var cx = cfg.volcano.x + Math.cos(a) * radius;
      var cz = cfg.volcano.z + Math.sin(a) * radius;
      var cy = heightAt(cx, cz) + alt;
      var tangent = { x: -Math.sin(a), y: 0, z: Math.cos(a) };
      var ring = { x: cx, y: cy, z: cz, nx: tangent.x, ny: 0, nz: tangent.z, passed: false };
      set.push(ring);
      var group = new THREE.Group();
      group.position.set(cx, cy, cz);
      group.lookAt(cx + tangent.x, cy, cz + tangent.z);
      var torus = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.ringRadius, 3.4, 14, 48),
        new THREE.MeshBasicMaterial({ color: 0xffb020 })
      );
      group.add(torus);
      var glow = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.ringRadius + 5, 1.2, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.5 })
      );
      group.add(glow);
      // Light halo: a soft additive sprite so the ring glows in 3D
      // instead of reading as a flat painted circle.
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: ringTexture(), color: 0xffc860, transparent: true,
        opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      halo.scale.set(85, 85, 1);
      group.add(halo);
      scene.add(group);
      world.ringMeshes.push({ group: group, torus: torus, glow: glow, halo: halo, ring: ring, setKey: key, index: i, glowBase: 0.35 });
    }
    world.ringSets[key] = set;
  }

  world.build = function (scene) {
    world.scene = scene;
    // Runway elevations must be known before the terrain is displaced,
    // because heightAt() flattens the ground around every strip.
    cfg.runways.forEach(function (rw) { rw.elev = rawHeight(rw.x, rw.z); });
    scene.background = new THREE.Color(0x8ec3ea);
    scene.fog = new THREE.Fog(0xa8c8e8, 800, 10000);
    // Stronger hemisphere contrast so sunlit faces pop against shade.
    var hemi = new THREE.HemisphereLight(0xbfd9ff, 0x54663f, 0.7);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff2d8, 1.35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -140; sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140; sun.shadow.camera.bottom = -140;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 1600;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    scene.add(sun.target);
    world.sun = sun;
    // Sun glare sprite: a bright halo in the sky toward the sun.
    var glare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture(), color: 0xfff6d8, transparent: true,
      opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    glare.scale.set(1500, 1500, 1);
    scene.add(glare);
    world.sunGlare = glare;
    buildTerrain(scene);
    buildSea(scene);
    buildRunways(scene);
    buildVillages(scene);
    buildForest(scene);
    buildRocks(scene);
    buildClouds(scene);
    buildSmoke(scene);
    buildRings(scene, 'run', cfg.ringRunCount, 720, 150, 0.35);
    buildRings(scene, 'storm', cfg.stormRingCount, 860, 185, 0.9);
  };

  world.update = function (dt, t, planePos) {
    for (var i = 0; i < world.clouds.length; i++) {
      var cl = world.clouds[i];
      cl.group.position.x += cl.speed * dt;
      cl.group.position.y = cl.baseY + Math.sin(t * 0.25 + cl.phase) * 12;
      if (cl.group.position.x > 2800) cl.group.position.x = -2800;
    }
    var top = rawHeight(cfg.volcano.x, cfg.volcano.z);
    for (var j = 0; j < world.smoke.length; j++) {
      var p = world.smoke[j];
      var cycle = (t * 9 + j * 34) % 170;
      p.position.y = top + 20 + cycle;
      // The plume rises and curls sideways as it ages.
      p.position.x = cfg.volcano.x + Math.sin(cycle * 0.05 + j) * cycle * 0.08;
      var s = 0.7 + cycle / 170;
      p.scale.set(s, s * 0.7, s);
      // Fade in at the crater, fade out as it disperses: no pop-in.
      p.material.opacity = 0.32 * util.smoothstep(0, 25, cycle) * (1 - util.smoothstep(120, 170, cycle));
    }
    // Sea shimmer: the light on the water breathes gently, and the
    // segmented surface itself undulates so the sea has wave relief.
    if (world.seaMat) {
      world.seaMat.color.setHSL(0.565, 0.65, 0.37 + 0.03 * Math.sin(t * 0.6));
      world.seaMat.opacity = 0.88 + 0.02 * Math.sin(t * 0.6 + 1);
    }
    if (world.seaGeo) {
      var sp = world.seaGeo.attributes.position;
      var sb = world.seaBase;
      for (var w = 0; w < sp.count; w++) {
        var sx = sb[w * 3], sz = sb[w * 3 + 2];
        sp.setY(w, Math.sin(sx * 0.008 + t * 0.9) * 0.7 + Math.cos(sz * 0.006 + t * 0.6) * 0.7);
      }
      sp.needsUpdate = true;
      world.seaGeo.computeVertexNormals();
    }
    // Windsock sways gently at the home strip.
    if (world.windsock) {
      world.windsock.rotation.z = -Math.PI / 2 + Math.sin(t * 0.8) * 0.08;
      world.windsock.rotation.y = Math.sin(t * 0.35) * 0.2;
    }
    if (planePos && world.sun) {
      // Lower sun angle than before: longer, softer shadows that
      // model the terrain in 3D.
      world.sun.position.set(planePos.x + 900, planePos.y + 430, planePos.z + 520);
      world.sun.target.position.set(planePos.x, planePos.y, planePos.z);
      world.sun.target.updateMatrixWorld();
      if (world.sunGlare) {
        var gd = new THREE.Vector3(900, 430, 520).normalize();
        world.sunGlare.position.set(
          planePos.x + gd.x * 5500,
          planePos.y + gd.y * 5500,
          planePos.z + gd.z * 5500
        );
      }
    }
  };

  // Ring visuals: pulse the next target, dim the ones already flown.
  world.setRingStates = function (setKey, currentIndex) {
    for (var i = 0; i < world.ringMeshes.length; i++) {
      var rm = world.ringMeshes[i];
      if (rm.setKey !== setKey) { rm.group.visible = false; continue; }
      rm.group.visible = true;
      if (rm.ring.passed) {
        rm.torus.material.color.setHex(0x37d67a);
        rm.glowBase = 0.18;
        if (rm.halo) rm.halo.material.color.setHex(0x37d67a);
      } else if (rm.index === currentIndex) {
        rm.torus.material.color.setHex(0xffb020);
        rm.glowBase = 0.6;
        if (rm.halo) rm.halo.material.color.setHex(0xffc860);
      } else {
        rm.torus.material.color.setHex(0xffb020);
        rm.glowBase = 0.35;
        if (rm.halo) rm.halo.material.color.setHex(0xffc860);
      }
      rm.glow.material.opacity = rm.glowBase;
    }
  };

  world.pulseRings = function (t) {
    for (var i = 0; i < world.ringMeshes.length; i++) {
      var rm = world.ringMeshes[i];
      if (!rm.group.visible) continue;
      var pulse = Math.sin(t * 2.4 + rm.index * 1.3);
      var s = 1 + 0.035 * pulse;
      rm.group.scale.set(s, s, s);
      // The glow breathes in sync with the scale pulse.
      rm.glow.material.opacity = rm.glowBase * (0.85 + 0.15 * pulse);
      if (rm.halo) rm.halo.material.opacity = rm.glowBase * (0.85 + 0.15 * pulse);
    }
  };
})();
