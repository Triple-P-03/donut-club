// A self-contained, transparent Three.js hero; the CSS donut stays visible until ready.
(async () => {
  const canvas = document.querySelector('#donut-canvas');
  const host = canvas?.closest('.hero-art') || canvas?.parentElement;
  if (!canvas || !host) return;

  let renderer;
  let frame = 0;
  let failed = false;
  let resizeObserver;
  const fail = () => {
    failed = true;
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    host.dataset.renderError = 'true';
    delete host.dataset.renderReady;
    canvas.style.visibility = 'hidden';
    renderer?.dispose();
  };

  try {
    const THREE = await import('https://esm.sh/three@0.170.0');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    scene.add(new THREE.HemisphereLight(0xfff3e9, 0x96613f, 2.3));
    const key = new THREE.DirectionalLight(0xffefd9, 4.2);
    key.position.set(-3.5, 5, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -3;
    key.shadow.camera.right = key.shadow.camera.top = 3;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 18;
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.0002;
    key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffc4d8, 1.5);
    fill.position.set(4, -1, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 2.7);
    rim.position.set(1, 4, -3);
    scene.add(rim);

    const donut = new THREE.Group();
    scene.add(donut);
    const TAU = Math.PI * 2;
    const major = 1.18;
    const minor = 0.545;
    let seed = 38129;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const radiusAt = (u, v) => minor * (
      1 + 0.022 * Math.sin(u * 7 + 0.7) * Math.sin(v * 3)
      + 0.012 * Math.cos(u * 11 - v * 5)
      + 0.009 * Math.sin(u * 19 + v * 9)
    );
    const surface = (u, v, lift = 0) => {
      const r = radiusAt(u, v) + lift;
      const ring = major + 0.015 * Math.sin(3 * u);
      return new THREE.Vector3(
        (ring + r * Math.cos(v)) * Math.cos(u),
        (ring + r * Math.cos(v)) * Math.sin(u),
        r * Math.sin(v) * 0.94,
      );
    };

    const drips = Array.from({ length: 13 }, (_, i) => ({
      center: (i + random() * 0.6) * TAU / 13,
      width: 0.045 + random() * 0.07,
      depth: 0.23 + random() * 0.52,
    }));
    const icingBounds = (u) => {
      let outer = 0.17 + 0.08 * Math.sin(u * 6) + 0.045 * Math.cos(u * 13);
      for (const drip of drips) {
        const distance = Math.atan2(Math.sin(u - drip.center), Math.cos(u - drip.center));
        outer -= drip.depth * Math.exp(-Math.pow(distance / drip.width, 2));
      }
      const inner = Math.PI - 0.11 + 0.1 * Math.sin(u * 5 + 1) + 0.055 * Math.cos(u * 9);
      return [outer, inner];
    };
    const icingLift = (t) => 0.014 + 0.042 * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.32);
    const makeSurface = (iced) => {
      const around = 224;
      const across = iced ? 72 : 96;
      const positions = [];
      const colors = [];
      const indices = [];
      const golden = new THREE.Color('#d78b42');
      const pale = new THREE.Color('#f6cb83');
      const baked = new THREE.Color('#ab5225');
      const color = new THREE.Color();
      for (let i = 0; i <= around; i++) {
        const u = i / around * TAU;
        const [start, end] = iced ? icingBounds(u) : [0, TAU];
        for (let j = 0; j <= across; j++) {
          const t = j / across;
          const v = start + (end - start) * t;
          const p = surface(u, v, iced ? icingLift(t) : 0);
          positions.push(p.x, p.y, p.z);
          if (!iced) {
            // The pale equatorial proofing band and toasted patches make the dough feel baked.
            const band = Math.exp(-Math.pow(Math.sin(v) / 0.23, 2));
            const toast = 0.16 + 0.14 * Math.sin(u * 4 + v * 3) * Math.cos(u * 7 - v * 2);
            color.copy(golden).lerp(baked, toast).lerp(pale, band * 0.58);
            color.multiplyScalar(0.96 + 0.04 * Math.sin(u * 91 + v * 53));
            colors.push(color.r, color.g, color.b);
          }
          if (i < around && j < across) {
            const a = i * (across + 1) + j;
            const b = a + across + 1;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      if (!iced) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    const doughMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.88, metalness: 0,
    });
    const dough = new THREE.Mesh(makeSurface(false), doughMaterial);
    dough.castShadow = dough.receiveShadow = true;
    donut.add(dough);
    const icingMaterial = new THREE.MeshPhysicalMaterial({
      color: '#f18ba9', roughness: 0.29, metalness: 0,
      clearcoat: 0.38, clearcoatRoughness: 0.25,
      sheen: 0.22, sheenColor: '#ffd4e4', sheenRoughness: 0.65,
      side: THREE.DoubleSide,
    });
    const icing = new THREE.Mesh(makeSurface(true), icingMaterial);
    icing.castShadow = icing.receiveShadow = true;
    donut.add(icing);

    // Rounded sugar rods are instanced: hundreds of sprinkles, only six draw calls.
    const palette = ['#fff4d8', '#ffce50', '#f75a79', '#78cfc5', '#8661b8', '#693722'];
    const sprinkleGeometry = new THREE.CapsuleGeometry(0.017, 0.075, 3, 6);
    const dummy = new THREE.Object3D();
    const axis = new THREE.Vector3(0, 1, 0);
    for (const shade of palette) {
      const sprinkles = new THREE.InstancedMesh(sprinkleGeometry, new THREE.MeshStandardMaterial({
        color: shade, roughness: 0.43,
      }), 58);
      for (let i = 0; i < sprinkles.count; i++) {
        const u = random() * TAU;
        const t = 0.1 + random() * 0.8;
        const [start, end] = icingBounds(u);
        const v = start + (end - start) * t;
        dummy.position.copy(surface(u, v, icingLift(t) + 0.018));
        const along = new THREE.Vector3(-Math.sin(u), Math.cos(u), 0);
        const across = new THREE.Vector3(-Math.sin(v) * Math.cos(u), -Math.sin(v) * Math.sin(u), Math.cos(v) * 0.94).normalize();
        const angle = random() * TAU;
        const tangent = along.multiplyScalar(Math.cos(angle)).addScaledVector(across, Math.sin(angle)).normalize();
        dummy.quaternion.setFromUnitVectors(axis, tangent);
        dummy.scale.setScalar(0.8 + random() * 0.45);
        dummy.updateMatrix();
        sprinkles.setMatrixAt(i, dummy.matrix);
      }
      sprinkles.castShadow = true;
      donut.add(sprinkles);
    }

    const pointer = { x: 0, y: 0 };
    const smoothed = { x: 0, y: 0 };
    const targetColor = icingMaterial.color.clone();
    let scroll = 0;
    let width = 0;
    let height = 0;
    let previous = performance.now();
    let elapsed = 0;
    const draw = (now) => {
      frame = 0;
      if (failed || !width || !height) return;
      try {
        const delta = Math.min(Math.max((now - previous) / 1000, 0), 0.05);
        previous = now;
        if (!motion.matches) elapsed += delta;
        const easing = motion.matches ? 1 : 1 - Math.exp(-delta * 7);
        smoothed.x += (pointer.x - smoothed.x) * easing;
        smoothed.y += (pointer.y - smoothed.y) * easing;
        donut.rotation.set(
          -0.2 + (motion.matches ? 0 : smoothed.y * 0.12 + Math.sin(elapsed * 0.65) * 0.035),
          -0.28 + (motion.matches ? 0 : smoothed.x * 0.18),
          -0.18 + (motion.matches ? 0 : Math.sin(elapsed * 0.4) * 0.045 + scroll * 0.16),
        );
        donut.position.y = motion.matches ? 0 : Math.sin(elapsed * 1.2) * 0.075;
        icingMaterial.color.lerp(targetColor, easing);
        renderer.render(scene, camera);
        host.dataset.renderReady = 'true';
        delete host.dataset.renderError;
        if (!motion.matches && !document.hidden) frame = requestAnimationFrame(draw);
      } catch {
        fail();
      }
    };
    const requestDraw = () => {
      if (!failed && !frame) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      width = host.clientWidth;
      height = host.clientHeight;
      if (!width || !height || failed) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = 2.12 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(camera.aspect, 1)) + 0.35;
      camera.updateProjectionMatrix();
      requestDraw();
    };
    host.addEventListener('pointermove', (event) => {
      if (motion.matches) return;
      const rect = host.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1;
      pointer.y = (event.clientY - rect.top) / Math.max(rect.height, 1) * 2 - 1;
    }, { passive: true });
    host.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; });
    const onScroll = () => {
      scroll = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 2);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('flavorchange', (event) => {
      const value = event.detail?.color;
      if (typeof value !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) return;
      targetColor.set(value);
      requestDraw();
    });
    motion.addEventListener('change', () => {
      previous = performance.now();
      requestDraw();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        previous = performance.now();
        requestDraw();
      }
    });
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      fail();
    });
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    window.addEventListener('resize', resize, { passive: true });
    onScroll();
    resize();
  } catch {
    fail();
  }
})();
