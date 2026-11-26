// Volcano Mail Run — the Kancil K-9 mail plane, built from Three.js
// primitives: capsule fuselage, tapered wings, tail, spinning propeller,
// retractable gear and navigation lights. Nose points along local +Z.
(function () {
  var VMR = window.VMR || (window.VMR = {});

  function phong(color, extra) {
    var opts = { color: color, shininess: 45 };
    if (extra) for (var k in extra) opts[k] = extra[k];
    return new THREE.MeshPhongMaterial(opts);
  }

  function buildPlane() {
    var group = new THREE.Group();
    group.rotation.order = 'YXZ';
    var cream = phong(0xf2e6c9);
    var red = phong(0xc23b2e);
    var dark = phong(0x2a2f36, { shininess: 90 });
    var glass = phong(0x18242e, { shininess: 140, specular: 0x88aacc });

    function add(mesh, x, y, z) {
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    }

    // Fuselage: capsule along Z, nose cone, tail cone.
    var fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 5.2, 6, 12), cream);
    fuselage.rotation.x = Math.PI / 2;
    add(fuselage, 0, 0, 0);
    var nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.2, 12), cream);
    nose.rotation.x = Math.PI / 2;
    add(nose, 0, 0, 3.6);
    var tailCone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.6, 12), red);
    tailCone.rotation.x = -Math.PI / 2;
    add(tailCone, 0, 0, -3.8);
    // Red cheatline stripe along the fuselage.
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.5, 5.4), red);
    add(stripe, 0, -0.15, 0.2);
    // Glass canopy: a transparent bubble, not a flat box, with dark
    // frame bars along its base so it reads as a real cockpit.
    var canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 16, 12),
      new THREE.MeshPhongMaterial({
        color: 0x9fd4e8, transparent: true, opacity: 0.55,
        shininess: 200, specular: 0xffffff
      })
    );
    canopy.scale.set(1, 0.62, 1.2);
    add(canopy, 0, 0.95, 1.5);
    [-1, 1].forEach(function (side) {
      var frame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.4), dark);
      add(frame, side * 1.02, 0.72, 1.5);
    });
    // Engine cowling ring around the nose.
    var cowl = new THREE.Mesh(new THREE.CylinderGeometry(1.56, 1.5, 1.2, 12), red);
    cowl.rotation.x = Math.PI / 2;
    add(cowl, 0, 0, 3.2);
    // Panel seams: thin dark lines along the fuselage sides.
    [-1, 1].forEach(function (side) {
      var seam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 5.0), dark);
      add(seam, side * 1.52, 0.35, 0);
    });
    // Wing struts: fuselage belly to wing underside, both sides.
    [-1, 1].forEach(function (side) {
      var strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.75, 6), dark);
      strut.rotation.z = -side * 1.14;
      add(strut, side * 2.15, -0.65, 0.6);
    });

    // Main wing with red tips, slight dihedral via two angled halves.
    var wingGeo = new THREE.BoxGeometry(6.6, 0.35, 2.6);
    var wingL = new THREE.Mesh(wingGeo, cream);
    wingL.rotation.z = 0.06;
    add(wingL, -3.35, 0.05, 0.6);
    var wingR = new THREE.Mesh(wingGeo, cream);
    wingR.rotation.z = -0.06;
    add(wingR, 3.35, 0.05, 0.6);
    var tipGeo = new THREE.BoxGeometry(1.1, 0.36, 2.6);
    var tipL = new THREE.Mesh(tipGeo, red);
    tipL.rotation.z = 0.06;
    add(tipL, -6.75, 0.42, 0.6);
    var tipR = new THREE.Mesh(tipGeo, red);
    tipR.rotation.z = -0.06;
    add(tipR, 6.75, 0.42, 0.6);

    // Tail: stabiliser + fin.
    var stab = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.25, 1.6), cream);
    add(stab, 0, 0.35, -4.6);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 2.0), red);
    add(fin, 0, 1.15, -4.6);

    // Propeller: spinner + two blades, spinning around the Z axis.
    var prop = new THREE.Group();
    prop.position.set(0, 0, 4.9);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.9, 10), dark);
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = true;
    prop.add(hub);
    var spinner = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 10), red);
    spinner.rotation.x = Math.PI / 2;
    spinner.position.z = 0.4;
    spinner.castShadow = true;
    prop.add(spinner);
    var bladeGeo = new THREE.BoxGeometry(0.3, 4.6, 0.14);
    var blade1 = new THREE.Mesh(bladeGeo, dark);
    blade1.castShadow = true;
    prop.add(blade1);
    var blade2 = new THREE.Mesh(bladeGeo, dark);
    blade2.rotation.z = Math.PI / 2;
    blade2.castShadow = true;
    prop.add(blade2);
    group.add(prop);
    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.35, 24),
      new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
    );
    disc.position.set(0, 0, 4.95);
    group.add(disc);

    // Landing gear: nose leg + two mains, folding back when retracted.
    var gearGroup = new THREE.Group();
    var legMat = dark;
    function leg(x, y, z, len) {
      var l = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, len, 8), legMat);
      l.position.set(x, y, z);
      l.castShadow = true;
      gearGroup.add(l);
      return l;
    }
    function wheel(x, y, z) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.32, 12), dark);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, y, z);
      w.castShadow = true;
      gearGroup.add(w);
      return w;
    }
    leg(0, -1.7, 2.6, 1.1); wheel(0, -2.35, 2.6);
    leg(-1.9, -1.5, 0.4, 1.4); wheel(-1.9, -2.3, 0.4);
    leg(1.9, -1.5, 0.4, 1.4); wheel(1.9, -2.3, 0.4);
    group.add(gearGroup);

    // Navigation lights: red left, green right, white strobe on the tail.
    // Each lamp gets a soft additive glow sprite so it shines in 3D.
    function glowTexture() {
      var cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      var ctx = cv.getContext('2d');
      var g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(cv);
    }
    var navTex = glowTexture();
    function lamp(color, x, y, z) {
      var s = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshBasicMaterial({ color: color })
      );
      s.position.set(x, y, z);
      group.add(s);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: navTex, color: color, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.scale.set(2.4, 2.4, 1);
      glow.position.set(x, y, z);
      group.add(glow);
      return s;
    }
    lamp(0xff2a2a, -6.9, 0.1, 0.6);
    lamp(0x2aff5a, 6.9, 0.1, 0.6);
    var strobe = lamp(0xffffff, 0, 0.5, -5.3);
    // The strobe's glow is bigger and toggled with the lamp itself.
    var strobeGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: navTex, color: 0xffffff, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    strobeGlow.scale.set(4.5, 4.5, 1);
    strobeGlow.position.set(0, 0.5, -5.3);
    group.add(strobeGlow);

    VMR.plane = {
      group: group,
      prop: prop,
      disc: disc,
      gearGroup: gearGroup,
      strobe: strobe,
      strobeGlow: strobeGlow,
      ailL: tipL,
      ailR: tipR,
      elevator: stab,
      rudder: fin,
      gearAngle: 0,
      _propRpm: 0,
      _ailDef: 0,
      _elevDef: 0,
      _rudDef: 0,
      // Ease the control surfaces toward their deflections, so the
      // ailerons, elevator and rudder move instead of snapping.
      updateSurfaces: function (pitchS, rollS, rudderS, dt) {
        var k = Math.min(1, dt * 8);
        this._ailDef += (rollS * 0.35 - this._ailDef) * k;
        this._elevDef += (pitchS * 0.3 - this._elevDef) * k;
        this._rudDef += (-rudderS * 0.4 - this._rudDef) * k;
        this.ailL.rotation.x = -this._ailDef;
        this.ailR.rotation.x = this._ailDef;
        this.elevator.rotation.x = this._elevDef;
        this.rudder.rotation.y = this._rudDef;
      },
      // Animate the gear from the eased gear amount (1 = down, 0 = up),
      // smoothed over about a second.
      updateGear: function (gearAmount) {
        var ga = (gearAmount === undefined) ? 1 : gearAmount;
        var g = ga * ga * (3 - 2 * ga);
        this.gearGroup.rotation.x = -1.15 * (1 - g);
      },
      spinProp: function (rpm, dt) {
        // Spin up gradually; the blur disc fades in with the RPM.
        this._propRpm += (rpm - this._propRpm) * Math.min(1, 1.5 * dt);
        this.prop.rotation.z -= this._propRpm * 42 * dt;
        this.disc.visible = this._propRpm > 0.45;
        this.disc.material.opacity = 0.10 + this._propRpm * 0.10;
      }
    };
    return group;
  }

  VMR.buildPlane = buildPlane;
})();
