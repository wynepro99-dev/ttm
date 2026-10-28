/* Hero 3D: die set (cetakan press) dari baja.
   Komponen dirakit saat halaman dibuka, lalu "dibongkar" sesuai posisi scroll.
   main.js mengatur window.TTM.explode (0 = rakit, 1 = terbongkar). */

window.TTM = window.TTM || { explode: 0, introStart: 0, active: true };

(async function initDieScene() {
  const state = window.TTM;
  const host = document.querySelector('.hero__stage');
  const canvas = document.getElementById('die-canvas');
  if (!host || !canvas) return;

  const finish = (failed) => {
    state.ready = true;
    state.failed = !!failed;
    document.documentElement.classList.add(failed ? 'no-webgl' : 'scene-ready');
    window.dispatchEvent(new Event('ttm:scene-ready'));
  };

  let THREE, RoundedBoxGeometry, renderer;
  try {
    THREE = await import('three');
    ({ RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js'));
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('Scene 3D tidak bisa dimuat:', err);
    return finish(true);
  }

  // Resolusi turun otomatis bila GPU lambat (lihat adaptQuality)
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
  scene.environment = studioEnvironment();

  /* ---------- Materials ---------- */

  const brushed = brushedTexture();
  const M = {
    plate: new THREE.MeshStandardMaterial({ color: 0xc3c7cc, metalness: 1, roughness: 0.55, roughnessMap: brushed }),
    plateDark: new THREE.MeshStandardMaterial({ color: 0x858b92, metalness: 1, roughness: 0.65, roughnessMap: brushed }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xf2f3f5, metalness: 1, roughness: 0.1 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd2a55a, metalness: 1, roughness: 0.3 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb00a0c, metalness: 0.5, roughness: 0.26 }),
    oxide: new THREE.MeshStandardMaterial({ color: 0x1d1d1f, metalness: 0.85, roughness: 0.42 }),
  };

  /* ---------- Geometry helpers ---------- */

  const SLOT = { x: -0.45, len: 1.1, r: 0.3 };
  const PIERCE = [[0.95, 0.52], [0.95, -0.52]];
  const POSTS = [[2.6, 1.5], [-2.6, 1.5], [2.6, -1.5], [-2.6, -1.5]];

  function slotPath(path, cx, cy, len, r) {
    path.moveTo(cx - len / 2, cy - r);
    path.lineTo(cx + len / 2, cy - r);
    path.absarc(cx + len / 2, cy, r, -Math.PI / 2, Math.PI / 2, false);
    path.lineTo(cx - len / 2, cy + r);
    path.absarc(cx - len / 2, cy, r, Math.PI / 2, Math.PI * 1.5, false);
    return path;
  }

  function roundedRect(shape, w, h, r) {
    const x = -w / 2, y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  }

  // Pelat dengan lubang potong (slot + dua lubang pierce), diekstrusi ke atas (+Y)
  function perforatedPlate(w, d, thick, clearance) {
    const shape = roundedRect(new THREE.Shape(), w, d, 0.1);
    shape.holes.push(slotPath(new THREE.Path(), SLOT.x, 0, SLOT.len, SLOT.r + clearance));
    PIERCE.forEach(([px, py]) => {
      const hole = new THREE.Path();
      hole.absarc(px, py, 0.16 + clearance, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    });
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 32 });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  function slotPunch(height) {
    const shape = slotPath(new THREE.Shape(), 0, 0, SLOT.len, SLOT.r - 0.02);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 24 });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  const hexGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 6);
  const mesh = (geo, mat) => new THREE.Mesh(geo, mat);

  /* ---------- Assembly ---------- */

  const assembly = new THREE.Group();
  scene.add(assembly);
  const parts = [];

  // base = posisi saat terakit, off = arah gerak saat dibongkar, order = urutan saat dirakit
  function addPart(obj, { x = 0, y, z = 0, off, ox = 0, oz = 0, order, key, anchor }) {
    obj.position.set(x, y, z);
    assembly.add(obj);
    const part = { obj, base: obj.position.clone(), off: new THREE.Vector3(ox, off, oz), order, key, anchor: anchor && new THREE.Vector3(...anchor) };
    parts.push(part);
    return part;
  }

  const lower = addPart(mesh(new RoundedBoxGeometry(6.2, 0.6, 4, 4, 0.06), M.plateDark), { y: 0.3, off: -1.25, order: 0, key: 'lower', anchor: [3.1, 0, 1.6] });

  const posts = new THREE.Group();
  POSTS.forEach(([px, pz]) => {
    const post = mesh(new THREE.CylinderGeometry(0.17, 0.17, 3.7, 40), M.chrome);
    post.position.set(px, 0, pz);
    posts.add(post);
  });
  addPart(posts, { y: 2.25, off: -1.25, order: 1, key: 'post', anchor: [2.6, 1.6, 1.5] });

  addPart(mesh(perforatedPlate(3.6, 2.6, 0.5, 0), M.plate), { y: 0.62, off: -0.45, order: 2, key: 'die', anchor: [1.8, 0.25, 1.3] });

  const dieBolts = new THREE.Group();
  [[1.5, 1.05], [-1.5, 1.05], [1.5, -1.05], [-1.5, -1.05]].forEach(([bx, bz]) => {
    const b = mesh(hexGeo, M.oxide);
    b.position.set(bx, 0, bz);
    dieBolts.add(b);
  });
  addPart(dieBolts, { y: 1.21, off: 0.12, order: 3 });

  addPart(mesh(perforatedPlate(3.4, 2.4, 0.22, 0.03), M.red), { y: 1.42, off: 0.75, order: 4, key: 'stripper', anchor: [1.7, 0.11, 1.2] });

  const punches = new THREE.Group();
  const slot = mesh(slotPunch(1.5), M.chrome);
  slot.position.set(SLOT.x, 0, 0);
  punches.add(slot);
  PIERCE.forEach(([px, py]) => {
    const pin = mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.5, 32), M.chrome);
    pin.position.set(px, 0.75, -py);
    punches.add(pin);
  });
  addPart(punches, { y: 1.48, off: 1.55, order: 5, key: 'punch', anchor: [SLOT.x + SLOT.len / 2 + SLOT.r, 0.9, 0] });

  addPart(mesh(new RoundedBoxGeometry(6.2, 0.55, 4, 4, 0.06), M.plate), { y: 3.275, off: 2.05, order: 6, key: 'upper', anchor: [3.1, 0, 1.6] });

  const bushings = new THREE.Group();
  POSTS.forEach(([px, pz]) => {
    const body = mesh(new THREE.CylinderGeometry(0.31, 0.31, 1.1, 40), M.brass);
    const flange = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 40), M.brass);
    body.position.set(px, 0, pz);
    flange.position.set(px, 0.6, pz);
    bushings.add(body, flange);
  });
  addPart(bushings, { y: 3.3, off: 2.5, order: 7, key: 'bushing', anchor: [2.6, 0.62, 1.92] });

  const topBolts = new THREE.Group();
  [[1.3, 1.05], [-1.3, 1.05], [1.3, -1.05], [-1.3, -1.05]].forEach(([bx, bz]) => {
    const b = mesh(hexGeo, M.oxide);
    b.position.set(bx, 0, bz);
    topBolts.add(b);
  });
  addPart(topBolts, { y: 3.62, off: 2.6, order: 8 });

  const shank = new THREE.Group();
  const collar = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 48), M.oxide);
  const stem = mesh(new THREE.CylinderGeometry(0.42, 0.42, 1, 48), M.chrome);
  collar.position.y = 0.06;
  stem.position.y = 0.62;
  shank.add(collar, stem);
  addPart(shank, { y: 3.55, off: 2.95, order: 9, key: 'shank', anchor: [0.42, 0.8, 0] });

  // Bayangan lembut di bawah pelat bawah
  const shadow = mesh(new THREE.PlaneGeometry(10, 7.5), new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.75)'), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  assembly.add(shadow);

  /* ---------- Lights & particles ---------- */

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a0405, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(6, 10, 8);
  const rim = new THREE.DirectionalLight(0xff3a26, 2.6);
  rim.position.set(-8, 2, -7);
  const glow = new THREE.PointLight(0xff2414, 16, 16, 2);
  glow.position.set(4, -0.5, -4);
  scene.add(key, rim, glow);

  const N = 240;
  const dust = new Float32Array(N * 3);
  const speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    dust[i * 3] = (Math.random() - 0.5) * 18;
    dust[i * 3 + 1] = Math.random() * 12 - 3;
    dust[i * 3 + 2] = (Math.random() - 0.5) * 12;
    speed[i] = 0.08 + Math.random() * 0.3;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const sparks = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.07, map: radialTexture('rgba(255,255,255,1)'), color: 0xff7a62,
    transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(sparks);

  /* ---------- Callouts (label gambar teknik) ---------- */

  const NS = 'http://www.w3.org/2000/svg';
  const svg = host.querySelector('.callout-lines');
  const calloutWrap = host.querySelector('.callouts');
  const callouts = parts.filter((p) => p.key).map((p) => {
    const el = calloutWrap.querySelector(`[data-key="${p.key}"]`);
    const line = document.createElementNS(NS, 'polyline');
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', '2.5');
    svg.append(line, dot);
    return { p, el, line, dot, x: 0, y: 0, ly: 0 };
  }).filter((c) => c.el);

  /* ---------- Loop ---------- */

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const smooth = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
  const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  let W = 1, H = 1;
  function resize() {
    W = host.clientWidth || window.innerWidth;
    H = host.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
  }
  new ResizeObserver(resize).observe(host);
  resize();

  const target = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const v = new THREE.Vector3();
  const clock = new THREE.Clock();
  let last = 0;
  let readyAt = Infinity;

  function update() {
    const t = clock.getElapsedTime();
    const dt = Math.min(t - last, 0.05);
    last = t;
    const e = state.explode || 0;
    const mobile = W < 900;
    // Rakit dimulai setelah preloader selesai DAN scene siap, mana yang lebih akhir
    const introStart = state.introStart ? Math.max(state.introStart, readyAt) : 0;
    const intro = introStart ? (performance.now() - introStart) / 1000 : 0;

    for (const p of parts) {
      const local = state.reduced ? 1 : easeOutExpo(clamp01((intro - 0.25 - p.order * 0.085) / 1.35));
      p.obj.position.copy(p.base).addScaledVector(p.off, e + (1 - local) * 3.4);
    }
    shadow.position.y = lower.obj.position.y - 0.31;
    shadow.material.opacity = 0.8 - e * 0.45;

    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    const sway = state.reduced ? 0 : Math.sin(t * 0.32) * 0.14 * (1 - e);
    assembly.rotation.y = lerp(-0.42, -0.18, e) + sway + pointer.sx * 0.35;
    assembly.rotation.x = pointer.sy * 0.1;
    assembly.position.y = state.reduced ? 0 : Math.sin(t * 0.8) * 0.05;

    const pos = dustGeo.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = pos.array[i * 3 + 1] + speed[i] * dt;
      if (y > 9) y = -3;
      pos.array[i * 3 + 1] = y;
    }
    pos.needsUpdate = true;

    // Kamera: sedikit mundur dan lebih frontal saat terbongkar.
    // Di layar sempit, jarak ditambah supaya lebar die set tetap muat.
    const fitWidth = 15.5 / (W / H);
    const radius = Math.max(22, fitWidth) + e * 7;
    dir.set(0.66, lerp(0.36, 0.2, e), 0.72).normalize();
    target.set(0, lerp(2.2, 3.05, e), 0);
    camera.position.copy(target).addScaledVector(dir, radius);
    camera.lookAt(target);
    const shiftX = mobile ? 0 : -lerp(0.2, 0.06, e) * W;
    const shiftY = mobile ? -lerp(0.29, 0.12, e) * H : 0;
    camera.setViewOffset(W, H, shiftX, shiftY, W, H);
    camera.updateProjectionMatrix();

    placeCallouts(smooth(0.6, 0.95, e), mobile);
  }

  function placeCallouts(alpha, mobile) {
    calloutWrap.style.opacity = alpha;
    svg.style.opacity = alpha;
    if (alpha <= 0.001 || W < 700) return;

    let maxX = 0;
    for (const c of callouts) {
      v.copy(c.p.anchor);
      c.p.obj.localToWorld(v);
      v.project(camera);
      c.x = (v.x * 0.5 + 0.5) * W;
      c.y = (-v.y * 0.5 + 0.5) * H;
      maxX = Math.max(maxX, c.x);
    }
    // Label disusun satu kolom di kanan, seperti daftar komponen pada gambar kerja
    const colX = Math.min(maxX + (mobile ? 30 : 64), W - 170);
    const sorted = [...callouts].sort((a, b) => a.y - b.y);
    let prev = -Infinity;
    for (const c of sorted) {
      c.ly = Math.max(c.y, prev + 34);
      prev = c.ly;
    }
    for (const c of callouts) {
      c.el.style.transform = `translate(${colX.toFixed(1)}px, ${c.ly.toFixed(1)}px)`;
      c.line.setAttribute('points', `${c.x.toFixed(1)},${c.y.toFixed(1)} ${(colX - 26).toFixed(1)},${c.ly.toFixed(1)} ${(colX - 4).toFixed(1)},${c.ly.toFixed(1)}`);
      c.dot.setAttribute('cx', c.x.toFixed(1));
      c.dot.setAttribute('cy', c.y.toFixed(1));
    }
  }

  // Ukur waktu per frame; bila rata-rata terlalu lambat, kurangi resolusi render
  let sampleStart = 0;
  let samples = 0;
  function adaptQuality(now) {
    if (pixelRatio <= 1) return;
    if (!sampleStart) sampleStart = now;
    samples++;
    if (samples < 45) return;
    const avg = (now - sampleStart) / samples;
    sampleStart = now;
    samples = 0;
    if (avg > 24) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
      resize();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (state.active === false || document.hidden) {
      sampleStart = 0;
      samples = 0;
      return;
    }
    update();
    renderer.render(scene, camera);
    adaptQuality(now);
  }

  update();
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  readyAt = performance.now();
  finish(false);
  requestAnimationFrame(frame);

  /* ---------- Procedural textures & environment ---------- */

  function studioEnvironment() {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x0d0909, side: THREE.BackSide })));
    const panel = (hex, power, w, h, pos) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(power), side: THREE.DoubleSide }));
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(0xffffff, 4, 10, 4, [0, 12, 3]);       // softbox atas
    panel(0xffffff, 3, 2.2, 14, [12, 2, 6]);     // strip kanan
    panel(0xffffff, 2.2, 1.6, 14, [5, 2, 12]);   // strip depan-kanan (kilau pada chrome)
    panel(0xffffff, 1.6, 1.6, 14, [-9, 2, 9]);   // strip depan-kiri
    panel(0xffffff, 1.5, 10, 6, [-8, 9, -8]);    // softbox belakang (pantulan sisi atas pelat)
    panel(0xff2b1f, 3, 3, 6, [-12, -2, -3]);     // strip merah rendah, hanya menyentuh sisi pelat
    panel(0x8a0607, 1.4, 18, 3, [0, -2, -13]);   // pantulan maroon belakang
    const pmrem = new THREE.PMREMGenerator(renderer);
    const tex = pmrem.fromScene(env, 0.035).texture;
    pmrem.dispose();
    return tex;
  }

  function brushedTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#8a8a8a';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const y = Math.random() * 256;
      const x = Math.random() * 256;
      const shade = (100 + Math.random() * 110) | 0;
      g.strokeStyle = `rgba(${shade},${shade},${shade},${0.25 + Math.random() * 0.35})`;
      g.lineWidth = 0.3 + Math.random() * 1.3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 40 + Math.random() * 200, y);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  function radialTexture(inner) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
})();
