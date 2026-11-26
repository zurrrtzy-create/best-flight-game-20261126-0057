// Volcano Mail Run — Three.js renderer: chase camera, sun that follows
// the plane so shadows stay local, and per-frame updates of the plane,
// propeller, gear, strobe and ring pulses.
(function () {
  var VMR = window.VMR || (window.VMR = {});
  var util = VMR.util;

  var R = {
    renderer: null,
    scene: null,
    camera: null,
    camPos: null,
    lookTarget: null,
    distSm: 24,
    heightSm: 5.5,
    fovCur: 62
  };
  VMR.render = R;

  R.init = function (container) {
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    R.renderer = renderer;

    var scene = new THREE.Scene();
    R.scene = scene;
    R.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 12000);
    R.camPos = new THREE.Vector3(0, 60, -60);
    R.lookTarget = new THREE.Vector3(0, 60, -60);

    // Speed-line dust: points streaming past the plane when it is low
    // and fast, for a sense of depth and speed.
    var pCount = 140;
    var pGeo = new THREE.BufferGeometry();
    var pPos = new Float32Array(pCount * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    var pMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, transparent: true, opacity: 0,
      depthWrite: false, sizeAttenuation: true
    });
    var points = new THREE.Points(pGeo, pMat);
    points.frustumCulled = false;
    scene.add(points);
    R.particles = { points: points, mat: pMat, pos: pPos, count: pCount, local: [] };
    for (var pi = 0; pi < pCount; pi++) {
      R.particles.local.push({
        x: (Math.random() - 0.5) * 90,
        y: (Math.random() - 0.5) * 36,
        z: (Math.random() - 0.5) * 90
      });
    }

    VMR.world.build(scene);
    scene.add(VMR.buildPlane());

    window.addEventListener('resize', function () {
      R.camera.aspect = window.innerWidth / window.innerHeight;
      R.camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  };

  // Place the camera exactly at its chase position: no swoop-in
  // when a mission starts or a screenshot preset is applied.
  // The camera sits slightly to the side so the plane reads off-centre
  // with a wingtip near the frame edge: parallax, not a flat cutout.
  R.snapCamera = function () {
    var s = VMR.physics.state;
    if (!s) return;
    var fwd = util.headingVec(s.heading);
    var right = { x: -fwd.z, z: fwd.x };
    var dist = s.airborne ? 24.5 : 23;
    var height = s.airborne ? 7.6 : 5.0;
    R.camPos.set(
      s.x - fwd.x * dist + right.x * 3.5,
      s.y + height,
      s.z - fwd.z * dist + right.z * 3.5
    );
    R.distSm = dist;
    R.heightSm = height;
    R.lookTarget.set(s.x + fwd.x * 24 + right.x * 1.2, s.y + 1.5, s.z + fwd.z * 24 + right.z * 1.2);
    R.camera.position.copy(R.camPos);
    R.camera.lookAt(R.lookTarget);
    R.camera.rotateZ(s.bank * 0.35);
  };

  R.update = function (dt, t) {
    var s = VMR.physics.state;
    if (!s) return;
    var plane = VMR.plane;

    // Plane transform: yaw, then pitch, then bank.
    plane.group.position.set(s.x, s.y, s.z);
    plane.group.rotation.y = util.rad(s.heading);
    plane.group.rotation.x = -s.pitch;
    plane.group.rotation.z = -s.bank;
    plane.updateGear(s.gearAmount);
    plane.updateSurfaces(VMR.input.pitchAxis, VMR.input.rollAxis, VMR.input.rudderAxis, dt);
    plane.spinProp(s.airborne ? (0.35 + s.throttle * 0.65) : s.throttle, dt);
    var strobeOn = (t % 1.2) < 0.12;
    plane.strobe.visible = strobeOn;
    if (plane.strobeGlow) plane.strobeGlow.visible = strobeOn;

    // Chase camera: behind and above, eased so it never fights the pilot.
    // Distance and height ease between ground and airborne values
    // instead of switching instantly. The camera sits slightly to the
    // side so the plane reads off-centre with parallax.
    var fwd = util.headingVec(s.heading);
    var right = { x: -fwd.z, z: fwd.x };
    var distT = s.airborne ? 24.5 : 23;
    var heightT = s.airborne ? 7.6 : 5.0;
    var kd = 1 - Math.exp(-2 * dt);
    R.distSm += (distT - R.distSm) * kd;
    R.heightSm += (heightT - R.heightSm) * kd;
    var want = new THREE.Vector3(
      s.x - fwd.x * R.distSm + right.x * 3.5,
      s.y + R.heightSm,
      s.z - fwd.z * R.distSm + right.z * 3.5
    );
    var k = 1 - Math.exp(-3.2 * dt);
    R.camPos.lerp(want, k);
    R.camera.position.copy(R.camPos);
    // Damped look target, and the camera rolls gently with the plane.
    var lookWant = new THREE.Vector3(
      s.x + fwd.x * 24 + right.x * 1.2, s.y + 1.5, s.z + fwd.z * 24 + right.z * 1.2
    );
    R.lookTarget.lerp(lookWant, 1 - Math.exp(-5 * dt));
    R.camera.lookAt(R.lookTarget);
    R.camera.rotateZ(s.bank * 0.35);
    // Field of view widens a little with speed, eased.
    var fovTarget = 62 + util.clamp(s.speed / 78, 0, 1) * 7;
    R.fovCur += (fovTarget - R.fovCur) * Math.min(1, 2 * dt);
    if (Math.abs(R.fovCur - R.camera.fov) > 0.05) {
      R.camera.fov = R.fovCur;
      R.camera.updateProjectionMatrix();
    }

    // Speed-line dust: when low and fast, points stream past the plane
    // in a box ahead of it, fading in and out with speed and height.
    var parts = R.particles;
    if (parts) {
      var agl = s.y - VMR.world.heightAt(s.x, s.z);
      var targetOp = (s.airborne && s.speed > 38 && agl < 70) ? 0.5 : 0;
      parts.mat.opacity += (targetOp - parts.mat.opacity) * Math.min(1, 3 * dt);
      var cx = s.x + fwd.x * 25, cy = s.y, cz = s.z + fwd.z * 25;
      for (var pi2 = 0; pi2 < parts.count; pi2++) {
        var lp = parts.local[pi2];
        lp.z -= s.speed * dt;
        if (lp.z < -45) {
          lp.z = 45;
          lp.x = (Math.random() - 0.5) * 90;
          lp.y = (Math.random() - 0.5) * 36;
        }
        parts.pos[pi2 * 3] = cx + right.x * lp.x + fwd.x * lp.z;
        parts.pos[pi2 * 3 + 1] = cy + lp.y;
        parts.pos[pi2 * 3 + 2] = cz + right.z * lp.x + fwd.z * lp.z;
      }
      parts.points.geometry.attributes.position.needsUpdate = true;
    }

    VMR.world.update(dt, t, plane.group.position);
    VMR.world.pulseRings(t);
    R.renderer.render(R.scene, R.camera);
  };
})();
