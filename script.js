// year placeholders
const year = new Date().getFullYear();
document.getElementById('year').textContent = year;
document.querySelectorAll('body *').forEach(el => {
  if (el.children.length === 0 && el.textContent.includes('{{YEAR}}')) {
    el.textContent = el.textContent.replace('{{YEAR}}', year);
  }
});

// 3D interactive hero title
const hero = document.querySelector('.hero');
const title = document.querySelector('.hero__title');
const spans = document.querySelectorAll('.hero__title span');

// split each line into per-letter spans (for individual letter animation)
spans.forEach((line) => {
  const text = line.dataset.text || line.textContent;
  line.innerHTML = '';
  // wrap each char in a span with index
  Array.from(text).forEach((ch, i) => {
    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.style.setProperty('--i', i);
    letter.textContent = ch === ' ' ? '\u00A0' : ch;
    letter.setAttribute('data-text', ch);
    line.appendChild(letter);
  });
});

// HALO MODE — compute global letter index across both spans so
// the CSS can lay them out around a circle (REBECCA on top arc, MUZE on bottom)
{
  const titleEl = document.querySelector('.hero__title');
  if (titleEl) {
    const wordEls = titleEl.querySelectorAll('span[data-text]');
    let total = 0;
    // include a one-slot gap between the two words for breathing room
    const GAP = 1;
    wordEls.forEach((w, wi) => {
      const ls = w.querySelectorAll('.letter');
      total += ls.length;
      if (wi < wordEls.length - 1) total += GAP;
    });
    titleEl.style.setProperty('--total', total);

    let gi = 0;
    wordEls.forEach((w, wi) => {
      const ls = w.querySelectorAll('.letter');
      ls.forEach((l) => {
        l.style.setProperty('--gi', gi++);
      });
      if (wi < wordEls.length - 1) gi += GAP;
    });
  }
}

// glitchy/robotic per-letter motion + scramble
const allLetters = document.querySelectorAll('.hero__title .letter');
let scrollY = 0;
window.addEventListener('scroll', () => {
  scrollY = window.scrollY;
}, { passive: true });

// per-letter glitch state
const letterStates = Array.from(allLetters).map((l) => ({
  el: l,
  originalChar: l.textContent,
  glitchUntil: 0,        // timestamp ms when glitch ends
  glitchOffsetX: 0,
  glitchOffsetY: 0,
  glitchSkew: 0,
  glitchScale: 1,
  scrambleUntil: 0,
  scrambleChar: '',
}));

// scramble character pool — sci-fi/robotic looking
const scramblePool = '!@#$%^&*<>{}[]/\\|~|=+-_01ΛΣΔΩΦΨΞ█▓▒░';

function triggerGlitch(state, now) {
  // burst duration: 70-150ms (snappy/digital)
  state.glitchUntil = now + 70 + Math.random() * 80;
  state.glitchOffsetX = (Math.random() - 0.5) * 8;
  state.glitchOffsetY = (Math.random() - 0.5) * 6;
  state.glitchSkew = (Math.random() - 0.5) * 14;
  state.glitchScale = 0.92 + Math.random() * 0.18;
  // 50% chance to also scramble the character briefly
  if (Math.random() < 0.5 && state.originalChar !== '\u00A0') {
    state.scrambleChar = scramblePool[Math.floor(Math.random() * scramblePool.length)];
    state.scrambleUntil = now + 60 + Math.random() * 80;
  }
}

// occasionally trigger a "burst" — multiple letters glitch at once
function triggerBurst(now) {
  const count = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const target = letterStates[Math.floor(Math.random() * letterStates.length)];
    triggerGlitch(target, now);
  }
}

let lastBurst = 0;
let nextBurstIn = 800; // ms

function letterTick() {
  const tMs = performance.now();
  const t = tMs / 1000;

  // scheduled glitch bursts
  if (tMs - lastBurst > nextBurstIn) {
    triggerBurst(tMs);
    lastBurst = tMs;
    nextBurstIn = 600 + Math.random() * 2200; // varied intervals
  }

  // continuous low-level random per-letter glitch chance
  letterStates.forEach((s) => {
    if (Math.random() < 0.0015) triggerGlitch(s, tMs);
  });

  letterStates.forEach((s, i) => {
    // letters PINNED in place — only glitch bursts move them briefly
    let tx = 0;
    let ty = 0;
    let rot = 0;
    let skew = 0;
    let scale = 1;

    // active glitch overrides — brief shake, then snap back to pinned position
    if (tMs < s.glitchUntil) {
      tx = s.glitchOffsetX;
      ty = s.glitchOffsetY;
      skew = s.glitchSkew;
      scale = s.glitchScale;
      rot = (Math.random() - 0.5) * 6;
    }

    // write to CSS variables so the circular layout transform composes with glitch
    s.el.style.setProperty('--tx', `${tx}px`);
    s.el.style.setProperty('--ty', `${ty}px`);
    s.el.style.setProperty('--rot', `${rot}deg`);
    s.el.style.setProperty('--skew', `${skew}deg`);
    s.el.style.setProperty('--scale', scale);

    // character scramble swap
    if (tMs < s.scrambleUntil) {
      if (s.el.textContent !== s.scrambleChar) s.el.textContent = s.scrambleChar;
    } else {
      if (s.el.textContent !== s.originalChar) s.el.textContent = s.originalChar;
    }
  });

  requestAnimationFrame(letterTick);
}
letterTick();

let targetX = 0, targetY = 0;
let currentX = 0, currentY = 0;

function updateTilt(clientX, clientY) {
  const rect = hero.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  // -1 to 1
  targetX = (clientX - cx) / (rect.width / 2);
  targetY = (clientY - cy) / (rect.height / 2);
}

function animate() {
  // TITLE PINNED — no mouse-tilt, no bob, no span depth transforms.
  // (Old horizontal title had these effects; vertical columns stay fixed.)
  // We still update currentX/Y for the particle parallax to use.
  currentX += (targetX - currentX) * 0.06;
  currentY += (targetY - currentY) * 0.06;

  requestAnimationFrame(animate);
}

// mouse
window.addEventListener('mousemove', (e) => updateTilt(e.clientX, e.clientY));

// touch
window.addEventListener('touchmove', (e) => {
  if (e.touches[0]) updateTilt(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

// reset when leaving
window.addEventListener('mouseleave', () => { targetX = 0; targetY = 0; });
window.addEventListener('touchend', () => { targetX = 0; targetY = 0; });

animate();

// ---- particles (drifting space dust) ----
const canvas = document.querySelector('.hero__particles');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let w, h;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initParticles();
  }

  function initParticles() {
    const isMobile = w < 720;
    const count = isMobile
      ? Math.min(30, Math.floor(w * h / 20000))
      : Math.min(80, Math.floor(w * h / 12000));
    particles = [];
    for (let i = 0; i < count; i++) {
      // ~40% lime "galaxy stars" — slow twinkle, bright pop
      // ~60% cyan/pink ambient dust
      const roll = Math.random();
      const isLimeStar = roll < 0.4;
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 1 + 0.2,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        kind: isLimeStar ? 'star' : 'dust',
        hue: isLimeStar ? 73 : (Math.random() < 0.5 ? 195 : 320),
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: isLimeStar
          ? 0.5 + Math.random() * 0.6   // slow, breathing
          : 1.6 + Math.random() * 0.8,  // faster, jittery
      });
    }
  }

  function drawParticles() {
    ctx.clearRect(0, 0, w, h);
    const t = performance.now() / 1000;
    for (const p of particles) {
      // parallax with mouse
      const px = p.x + currentX * 30 * p.z;
      const py = p.y + currentY * 30 * p.z;

      const tw = 0.5 + 0.5 * Math.sin(t * p.twinkleSpeed + p.twinkle);

      let r, alpha, glow;
      if (p.kind === 'star') {
        // lime stars: shape it so they really fade IN and OUT (low base, bright peak)
        const eased = Math.pow(tw, 2.4); // 0..1, sharper rise & fall
        r = p.z * 2.0;
        alpha = 0.05 + eased * 0.85 * p.z;
        glow = 14 * p.z;
      } else {
        r = p.z * 1.6;
        alpha = 0.35 * tw * p.z;
        glow = 8 * p.z;
      }

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 100%, ${p.kind === 'star' ? 65 : 75}%, ${alpha})`;
      ctx.shadowColor = `hsla(${p.hue}, 100%, ${p.kind === 'star' ? 60 : 70}%, 0.85)`;
      ctx.shadowBlur = glow;
      ctx.fill();

      // drift
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
    }
    ctx.shadowBlur = 0;
    requestAnimationFrame(drawParticles);
  }

  resize();
  drawParticles();
  window.addEventListener('resize', resize);
}

// ---- 3D wireframe skull hero (Three.js) ----
(function init3D() {
  if (typeof THREE === 'undefined') return;
  const canvas3d = document.querySelector('.hero__3d');
  if (!canvas3d) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 6;

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas3d,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  function resize3D() {
    const rect = canvas3d.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  resize3D();
  window.addEventListener('resize', resize3D);

  // master group — whole skull system
  const group = new THREE.Group();
  scene.add(group);

  // ---- materials ----
  const wireMat = (color, opacity = 0.9) => new THREE.MeshBasicMaterial({
    color, wireframe: true, transparent: true, opacity,
  });
  const limeWire = wireMat(0xd4ff3a, 0.95);
  const pinkWire = wireMat(0xff5ebc, 0.35);
  const cyanWire = wireMat(0x5ee5ff, 0.85);
  const ghostPink = wireMat(0xff5ebc, 0.55);
  const ghostCyan = wireMat(0x5ee5ff, 0.55);
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // ---- LOAD REAL SKULL GLTF ----
  const skullGroup = new THREE.Group();
  group.add(skullGroup);
  const isMobile3D = window.innerWidth < 720;

  const loader = new THREE.GLTFLoader();
  loader.load(
    'assets/skull/scene.gltf',
    (gltf) => {
      const skull = gltf.scene;

      // material — keep original textures + lime wireframe overlay on top
      const limeEdgeMat = new THREE.LineBasicMaterial({
        color: 0xd4ff3a, transparent: true, opacity: 0.75,
      });

      // walk the imported meshes — KEEP original PBR texture, add edge overlay
      skull.traverse((child) => {
        if (child.isMesh) {
          // tweak the original material so lime reads clearly on top
          if (child.material) {
            child.material.transparent = true;
            child.material.opacity = 0.95;
            // a hint of lime tint into the texture (subtle)
            if (child.material.color) {
              child.material.color.multiplyScalar(0.9);
            }
            // polygonOffset so edges sit cleanly on top of faces
            child.material.polygonOffset = true;
            child.material.polygonOffsetFactor = 1;
            child.material.polygonOffsetUnits = 1;
          }

          // build edge geometry on top so we get clean wireframe lines
          const edges = new THREE.EdgesGeometry(child.geometry, 25);
          const lineSeg = new THREE.LineSegments(edges, limeEdgeMat);
          child.add(lineSeg);

          // chromatic ghosts (desktop only)
          if (!isMobile3D) {
            const pinkGhost = new THREE.LineSegments(
              edges.clone(),
              new THREE.LineBasicMaterial({
                color: 0xff5ebc, transparent: true, opacity: 0.45,
              })
            );
            pinkGhost.position.set(0.02, 0, 0);
            const cyanGhost = new THREE.LineSegments(
              edges.clone(),
              new THREE.LineBasicMaterial({
                color: 0x5ee5ff, transparent: true, opacity: 0.45,
              })
            );
            cyanGhost.position.set(-0.02, 0, 0);
            child.add(pinkGhost, cyanGhost);
            animTargets.ghosts.push({ pink: pinkGhost, cyan: cyanGhost });
          }
        }
      });

      // center & scale the skull to fit our scene
      const box = new THREE.Box3().setFromObject(skull);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const targetSize = 3.2;
      const scale = targetSize / Math.max(size.x, size.y, size.z);
      skull.scale.setScalar(scale);
      skull.position.sub(center.multiplyScalar(scale));

      skullGroup.add(skull);
      animTargets.skullLoaded = true;
    },
    undefined,
    (err) => {
      console.error('[skull] failed to load:', err);
    }
  );

  // glowing inner eye-socket pupils — small cyan diamonds floating where eyes would be
  const pupilGeo = new THREE.OctahedronGeometry(0.07, 0);
  const pupilL = new THREE.Mesh(pupilGeo, cyanWire);
  const pupilR = new THREE.Mesh(pupilGeo, cyanWire);
  pupilL.position.set(-0.35, 0.2, 1.1);
  pupilR.position.set( 0.35, 0.2, 1.1);
  // skullGroup.add(pupilL, pupilR); // removed — cleaner skull, no glowing eyes

  // ---- ORBITAL RINGS — thin lime solar-system around the skull ----
  // three rings, all lime, varied sizes + tilts, super thin tubes, smooth (not wireframe)
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(2.5, 0.005, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xd4ff3a, transparent: true, opacity: 0.55 })
  );
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(3.0, 0.004, 8, 180),
    new THREE.MeshBasicMaterial({ color: 0xd4ff3a, transparent: true, opacity: 0.38 })
  );
  const ring3 = new THREE.Mesh(
    new THREE.TorusGeometry(3.7, 0.003, 8, 200),
    new THREE.MeshBasicMaterial({ color: 0xd4ff3a, transparent: true, opacity: 0.28 })
  );
  // varied tilts — different orbital planes, like a messy solar system
  ring1.rotation.x = Math.PI / 2.4;
  ring1.rotation.y = Math.PI / 6;
  ring2.rotation.x = Math.PI / 3.2;
  ring2.rotation.z = Math.PI / 4;
  ring3.rotation.x = Math.PI / 7;
  ring3.rotation.y = -Math.PI / 5;
  ring3.rotation.z = Math.PI / 3;
  group.add(ring1, ring2, ring3);

  // ---- ORBITING CRYSTALS — small diamond shapes circling the skull ----
  // disabled for cleaner hero — skull stands alone
  const orbiters = [];
  const crystalCount = 0;
  for (let i = 0; i < crystalCount; i++) {
    const isLime = i % 2 === 0;
    // wireframe crystal (icosahedron — small floating diamond)
    const crystal = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.11, 0),
      new THREE.MeshBasicMaterial({
        color: isLime ? 0xd4ff3a : 0xff5ebc,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      })
    );
    // solid inner core for glow
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.05, 0),
      new THREE.MeshBasicMaterial({
        color: isLime ? 0xd4ff3a : 0xff5ebc,
      })
    );
    crystal.add(core);

    const orbit = {
      mesh: crystal,
      radius: 2.4 + Math.random() * 0.8,
      speed: 0.25 + Math.random() * 0.3,
      offset: (i / crystalCount) * Math.PI * 2,  // evenly spaced
      tiltY: (Math.random() - 0.5) * 1.2,
      spin: 0.6 + Math.random() * 0.8,
    };
    orbiters.push(orbit);
    group.add(crystal);
  }

  // ---- ENERGY HALO outer wireframe ----
  const halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.5, 0),
    new THREE.MeshBasicMaterial({
      color: 0xff5ebc, wireframe: true, transparent: true, opacity: 0.12,
    })
  );
  // group.add(halo); // removed — cleaner hero

  // tilt slightly forward
  group.rotation.x = -0.05;

  // animation targets
  const animTargets = {
    skullGroup, halo,
    pupilL, pupilR,
    ring1, ring2, ring3, orbiters,
    ghosts: [],          // populated when GLTF loads
    skullLoaded: false,
  };

  // lighting — neutral key light to render the textures, colored fill for atmosphere
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);
  const limeFill = new THREE.PointLight(0xd4ff3a, 1.2, 25);
  limeFill.position.set(4, 2, 3);
  scene.add(limeFill);
  const pinkRim = new THREE.PointLight(0xff5ebc, 1.0, 25);
  pinkRim.position.set(-4, -2, 2);
  scene.add(pinkRim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  // animation loop
  let mx = 0, my = 0;
  window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();

    // ---- glitch shake (occasional) ----
    let glitchX = 0, glitchY = 0;
    const glitchPhase = (t % 7);
    if (glitchPhase > 6.7 && glitchPhase < 6.95) {
      glitchX = (Math.random() - 0.5) * 0.15;
      glitchY = (Math.random() - 0.5) * 0.15;
    }

    // whole skull rotates slowly + reacts to mouse
    group.rotation.y = t * 0.18 + mx * 0.5 + glitchX;
    group.rotation.x = -0.05 + Math.sin(t * 0.4) * 0.1 + my * 0.25 + glitchY;

    // chromatic ghost offset — wobble pink/cyan ghost lines
    const chromAmt = 0.025 + Math.sin(t * 3) * 0.015;
    for (const g of animTargets.ghosts) {
      g.pink.position.x =  chromAmt;
      g.pink.position.y =  chromAmt * 0.4;
      g.cyan.position.x = -chromAmt;
      g.cyan.position.y = -chromAmt * 0.4;
    }

    // pupils pulse like a heartbeat
    const pulse = 1 + Math.sin(t * 3) * 0.5;
    animTargets.pupilL.scale.setScalar(pulse);
    animTargets.pupilR.scale.setScalar(pulse);

    // ---- orbital rings — slow contemplative drift on their tilt axes ----
    // additive deltas so the initial tilts we set above are preserved
    ring1.rotation.z += 0.0015;
    ring2.rotation.z -= 0.0011;
    ring3.rotation.y += 0.0008;

    // ---- orbiting crystals — circle the skull, each spinning ----
    for (const o of animTargets.orbiters) {
      const a = t * o.speed + o.offset;
      o.mesh.position.set(
        Math.cos(a) * o.radius,
        Math.sin(a) * o.radius * 0.4 + o.tiltY,  // slight vertical orbit
        Math.sin(a) * o.radius * 0.6
      );
      // each crystal rotates on its own axis
      o.mesh.rotation.x = t * o.spin;
      o.mesh.rotation.y = t * o.spin * 0.7;
    }

    // halo counter-spin
    animTargets.halo.rotation.y = -t * 0.15;
    animTargets.halo.rotation.x =  t * 0.1;

    // breathing scale
    const breath = 1 + Math.sin(t * 1.2) * 0.025;
    group.scale.setScalar(breath);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
})();

/* ============================================================
   EQUALIZER — fake-but-convincing audio-reactive bars
   (Spotify iframe is cross-origin, so we simulate the vibe.
    Bass-heavy on the left, treble on the right, with the
    occasional beat pulse and idle sway.)
   ============================================================ */
(function initEqualizer(){
  const canvases = document.querySelectorAll('.equalizer');
  if (!canvases.length) return;

  const BAR_COUNT = 48;
  const GAP = 2;

  // per-bar state — one shared array so top + bottom mirror nicely
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const norm = i / (BAR_COUNT - 1); // 0 = bass, 1 = treble
    return {
      norm,
      // bass bars are taller on average, treble are shorter + jitterier
      base: 0.55 - norm * 0.25,
      jitter: 0.35 + norm * 0.4,
      phase: Math.random() * Math.PI * 2,
      speed: 1.6 + norm * 3.5 + Math.random() * 0.8,
      value: 0,
    };
  });

  // beat pulse — fires every ~0.45–0.85s, decays fast
  let beatEnergy = 0;
  let nextBeat = performance.now() + 400 + Math.random() * 400;

  function resize(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas._dpr = dpr;
  }

  canvases.forEach(resize);
  window.addEventListener('resize', () => canvases.forEach(resize));

  function drawCanvas(canvas, mirror, t) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const dpr = canvas._dpr || 1;
    const gap = GAP * dpr;
    const totalGap = gap * (BAR_COUNT - 1);
    const barW = (w - totalGap) / BAR_COUNT;

    // ---- 1. rolling sci-fi gradient (cooler, electric) ----
    const palette = [
      [40,  180, 255],   // electric blue
      [180, 240, 255],   // ice white-cyan flash
      [120, 80,  255],   // deep violet
      [255, 60,  200],   // hot magenta
    ];
    const colorAt = (p, a = 1) => {
      const n = palette.length;
      const x = ((p % 1) + 1) % 1 * n;
      const i = Math.floor(x);
      const f = x - i;
      const c1 = palette[i % n];
      const c2 = palette[(i + 1) % n];
      const r = Math.round(c1[0] + (c2[0] - c1[0]) * f);
      const g = Math.round(c1[1] + (c2[1] - c1[1]) * f);
      const bl = Math.round(c1[2] + (c2[2] - c1[2]) * f);
      return `rgba(${r},${g},${bl},${a})`;
    };
    const shift = t * 0.18;
    const SAMPLES = 16;
    // translucent fill (glass) + bright outline (etched edge)
    const fillGrad   = ctx.createLinearGradient(0, 0, w, 0);
    const strokeGrad = ctx.createLinearGradient(0, 0, w, 0);
    for (let s = 0; s <= SAMPLES; s++) {
      const p = s / SAMPLES;
      fillGrad.addColorStop(p,   colorAt(p + shift, 0.22));
      strokeGrad.addColorStop(p, colorAt(p + shift, 0.95));
    }

    // collect bar geometry so we can re-paint caps later
    const geo = [];
    ctx.lineWidth = 1.2 * dpr;
    ctx.shadowColor = 'rgba(150, 210, 255, 0.55)';
    ctx.shadowBlur = 10 * dpr;
    for (let i = 0; i < BAR_COUNT; i++) {
      const b = bars[i];
      let v = Math.max(0.04, Math.min(1, b.value));
      const barH = Math.max(2 * dpr, v * h * 0.95);
      const x = i * (barW + gap);
      const y = mirror ? 0 : h - barH;
      const r = Math.min(barW * 0.45, 3 * dpr);
      ctx.beginPath();
      if (mirror) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + barW, 0);
        ctx.lineTo(x + barW, barH - r);
        ctx.quadraticCurveTo(x + barW, barH, x + barW - r, barH);
        ctx.lineTo(x + r, barH);
        ctx.quadraticCurveTo(x, barH, x, barH - r);
      } else {
        ctx.moveTo(x, h);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, h);
      }
      ctx.closePath();
      // translucent fill — this is the "glass" body
      ctx.fillStyle = fillGrad;
      ctx.fill();
      // bright etched outline
      ctx.strokeStyle = strokeGrad;
      ctx.stroke();
      geo.push({ x, barW, barH, tipY: mirror ? barH : y });
    }
    ctx.shadowBlur = 0;

    // ---- 2. glossy vertical highlight (only on bar pixels) ----
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const gloss = ctx.createLinearGradient(0, 0, 0, h);
    if (mirror) {
      gloss.addColorStop(0,    'rgba(255,255,255,0.0)');
      gloss.addColorStop(0.6,  'rgba(255,255,255,0.0)');
      gloss.addColorStop(1,    'rgba(255,255,255,0.28)');
    } else {
      gloss.addColorStop(0,    'rgba(255,255,255,0.28)');
      gloss.addColorStop(0.4,  'rgba(255,255,255,0.0)');
      gloss.addColorStop(1,    'rgba(255,255,255,0.0)');
    }
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // ---- 3. moving scanner sweep — narrow vertical shine traveling sideways ----
    const period = 3.2;
    const phase = ((t / period) % 1.25) - 0.125; // -0.125..1.125 with idle pause
    if (phase >= -0.05 && phase <= 1.05) {
      const cx = phase * w;
      const sweepW = w * 0.14;
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const sweep = ctx.createLinearGradient(cx - sweepW, 0, cx + sweepW, 0);
      sweep.addColorStop(0,   'rgba(255,255,255,0)');
      sweep.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      sweep.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // ---- 4. bright tip-cap on each bar (classic VU meter cherry) ----
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(220, 240, 255, 0.9)';
    ctx.shadowColor = 'rgba(180, 220, 255, 0.8)';
    ctx.shadowBlur = 6 * dpr;
    const capH = Math.max(1.5 * dpr, 2 * dpr);
    for (const g of geo) {
      const yy = mirror ? g.tipY - capH : g.tipY;
      ctx.fillRect(g.x, yy, g.barW, capH);
    }
    ctx.restore();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    // beat scheduling
    if (now >= nextBeat) {
      beatEnergy = 1;
      nextBeat = now + 380 + Math.random() * 520;
    }
    beatEnergy *= Math.pow(0.001, dt); // fast decay

    for (const b of bars) {
      // baseline sine sway (per-bar)
      const sway = (Math.sin(t * b.speed + b.phase) * 0.5 + 0.5);
      // beats hit bass bars hardest
      const beatHit = beatEnergy * (1 - b.norm * 0.7) * 0.55;
      // small random shimmer for treble
      const shimmer = (Math.random() - 0.5) * b.norm * 0.18;
      const target = b.base * 0.4 + sway * b.jitter + beatHit + shimmer;
      // smooth toward target
      b.value += (target - b.value) * Math.min(1, dt * 14);
    }

    canvases.forEach((c) => {
      const isTop = c.classList.contains('equalizer--top');
      drawCanvas(c, isTop, t); // top mirrors (grows down), bottom grows up
    });

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

/* ============================================================
   SHARE BUTTON — native share on mobile, copy-to-clipboard on desktop
   (frictionless shares = more streams = stronger algorithm signal)
   ============================================================ */
(function initShare() {
  const btn = document.getElementById('shareBtn');
  if (!btn) return;
  const url = btn.dataset.shareUrl;
  const title = btn.dataset.shareTitle || document.title;
  const text = btn.dataset.shareText || '';
  const original = btn.textContent;

  btn.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      btn.textContent = 'link copied ✓';
      btn.classList.add('is-copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('is-copied');
      }, 1800);
    } catch (err) {
      // user cancelled the share — silent
    }
  });
})();

/* ============================================================
   EMAIL SIGNUP — Netlify Forms AJAX submit
   Intercepts the form, posts to Netlify, swaps in success message
   (avoids full page redirect, keeps the vibe)
   ============================================================ */
(function initSignup() {
  const form = document.getElementById('signupForm');
  const success = document.getElementById('signupSuccess');
  if (!form || !success) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('.signup-form__submit');
    const originalLabel = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'sending…';
    }

    const data = new FormData(form);
    // Netlify forms require urlencoded body with form-name
    const body = new URLSearchParams();
    for (const [k, v] of data.entries()) body.append(k, v);

    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!res.ok) throw new Error('Network response was not ok');
      // swap in success state
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
      alert("something broke — please try again or DM @rebecca_9muses on instagram.");
    }
  });
})();
