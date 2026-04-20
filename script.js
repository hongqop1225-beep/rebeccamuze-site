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

    // ---- audio reactivity — pulse with the vibe loop's bass ----
    const vibe = (window.__getVibeLevel ? window.__getVibeLevel() : 0);
    // smooth the value (avoid jittery snaps)
    if (typeof animTargets._vibeSmooth !== 'number') animTargets._vibeSmooth = 0;
    animTargets._vibeSmooth += (vibe - animTargets._vibeSmooth) * 0.18;
    const vibeS = animTargets._vibeSmooth;

    // ---- orbital rings — slow contemplative drift on their tilt axes ----
    // additive deltas so the initial tilts we set above are preserved
    ring1.rotation.z += 0.0015 + vibeS * 0.012;
    ring2.rotation.z -= 0.0011 + vibeS * 0.009;
    ring3.rotation.y += 0.0008 + vibeS * 0.007;
    // rings glow brighter on the beat
    ring1.material.opacity = 0.55 + vibeS * 0.4;
    ring2.material.opacity = 0.38 + vibeS * 0.32;
    ring3.material.opacity = 0.28 + vibeS * 0.26;

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

    // breathing scale — gets pumped by the music when vibe is on
    const breath = 1 + Math.sin(t * 1.2) * 0.025 + vibeS * 0.18;
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

/* ============================================
   BACKGROUND VIBE LOOP
   - browsers block autoplay, so we wait for first click
   - fade-in on play, fade-out on pause (smooth, not jarring)
   - remembers state across scrolls (audio element persists)
   ============================================ */
(function initVibeLoop() {
  const audio = document.getElementById('vibeAudio');
  const btn = document.getElementById('vibeToggle');
  if (!audio || !btn) return;

  const TARGET_VOLUME = 0.55; // not too loud — background vibe
  const FADE_MS = 900;
  audio.volume = 0;

  let fadeRAF = null;
  let audioCtx = null;
  let analyser = null;
  let freqData = null;

  /* lazy-init audio analyser (only after first user gesture, browser policy) */
  function initAnalyser() {
    if (audioCtx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
      const source = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      // expose normalized 0..1 level so the 3D skull can react
      window.__getVibeLevel = function () {
        if (!analyser || audio.paused) return 0;
        analyser.getByteFrequencyData(freqData);
        // bass band ~ first 8 bins
        let sum = 0;
        for (let i = 0; i < 8; i++) sum += freqData[i];
        return Math.min(1, (sum / 8) / 200);
      };
    } catch (err) {
      console.warn('audio analyser init failed:', err);
    }
  }

  function fadeTo(target, onDone) {
    if (fadeRAF) cancelAnimationFrame(fadeRAF);
    const start = audio.volume;
    const diff = target - start;
    const startTime = performance.now();
    function step(now) {
      const t = Math.min(1, (now - startTime) / FADE_MS);
      audio.volume = Math.max(0, Math.min(1, start + diff * t));
      if (t < 1) {
        fadeRAF = requestAnimationFrame(step);
      } else {
        fadeRAF = null;
        if (onDone) onDone();
      }
    }
    fadeRAF = requestAnimationFrame(step);
  }

  async function play() {
    try {
      initAnalyser(); // first-click gesture unlocks AudioContext
      if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      await audio.play();
      btn.classList.add('is-playing');
      btn.classList.remove('vibe-toggle--pulse');
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', 'pause background music');
      fadeTo(TARGET_VOLUME);
    } catch (err) {
      // autoplay blocked or file missing — silently fail, user can retry
      console.warn('vibe loop play blocked:', err);
    }
  }

  function pause() {
    fadeTo(0, () => {
      audio.pause();
    });
    btn.classList.remove('is-playing');
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'play background music');
  }

  // ----- skull pop burst ------------------------------------------
  // little skull emoji puffs up from the button on every click,
  // wobbles, then disappears. pure CSS keyframe driven.
  // builds the full burst: 2 shockwave rings + 8 spark lines + realistic skull.
  // everything starts together so the electric buzz and the skull pop happen
  // simultaneously, then fade softly.
  function spawnSkullPop() {
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height * 0.35;
    const tilt = (Math.random() - 0.5) * 16;

    const burst = document.createElement('div');
    burst.className = 'skull-burst';
    burst.style.left = x + 'px';
    burst.style.top = y + 'px';
    burst.style.setProperty('--tilt', tilt + 'deg');

    // 2 expanding shockwave rings
    burst.insertAdjacentHTML('beforeend', '<div class="skull-burst__ring"></div>');
    burst.insertAdjacentHTML('beforeend', '<div class="skull-burst__ring skull-burst__ring--2"></div>');

    // 8 electric spark lines radiating outward (rotated with conic math)
    for (let i = 0; i < 8; i++) {
      const angle = (360 / 8) * i + (Math.random() - 0.5) * 14;
      burst.insertAdjacentHTML(
        'beforeend',
        `<div class="skull-burst__spark" style="--angle:${angle}deg;--delay:${i * 12}ms"></div>`
      );
    }

    // the realistic skull image (soft pop, slight glitch, fade)
    burst.insertAdjacentHTML(
      'beforeend',
      '<img class="skull-burst__skull" src="skull.png?v=1" alt="" aria-hidden="true" />'
    );

    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 1500);
  }

  btn.addEventListener('click', () => {
    spawnSkullPop();
    if (audio.paused) {
      play();
    } else {
      pause();
    }
  });

  // expose play() so the press-play gate can trigger music with its own
  // user-gesture (browsers require a gesture to start audio — the gate
  // click counts as one).
  window.__vibePlay = play;

  // gentle keyboard shortcut: press "M" to mute/unmute
  document.addEventListener('keydown', (e) => {
    if (e.key && e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // don't hijack typing
      btn.click();
    }
  });
})();

/* ============================================
   CUSTOM LIME CURSOR (desktop only)
   - dot snaps to mouse, ring lags with easing
   - grows on interactive elements (a, button, input)
   ============================================ */
(function initCursor() {
  // skip on touch devices
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const cursor = document.querySelector('.cursor');
  if (!cursor) return;
  const dot = cursor.querySelector('.cursor__dot');
  const ring = cursor.querySelector('.cursor__ring');

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let rx = mx, ry = my;     // ring (lagged)
  let dx = mx, dy = my;     // dot (instant)

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
  });

  // detect hover over interactive elements
  const interactiveSelector = 'a, button, input, textarea, [role="button"], .letter, .ig-link, .vibe-toggle';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(interactiveSelector)) cursor.classList.add('is-hover');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(interactiveSelector)) cursor.classList.remove('is-hover');
  });

  document.addEventListener('mousedown', () => cursor.classList.add('is-down'));
  document.addEventListener('mouseup',   () => cursor.classList.remove('is-down'));
  document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { cursor.style.opacity = '1'; });

  function tick() {
    // dot: snap
    dx = mx; dy = my;
    // ring: ease toward mouse (snappier lag — 0.35 keeps feel but not sluggish)
    rx += (mx - rx) * 0.35;
    ry += (my - ry) * 0.35;

    dot.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ============================================
   TITLE GLITCH BURSTS
   - random ~every 6-12 sec, the title shudders briefly
   - also triggers on any hover
   ============================================ */
(function initGlitch() {
  const title = document.querySelector('.hero__title');
  if (!title) return;

  function burst() {
    title.classList.add('is-glitching');
    setTimeout(() => title.classList.remove('is-glitching'), 240);
    // schedule next burst at a random interval
    const next = 6000 + Math.random() * 6000;
    setTimeout(burst, next);
  }
  // first burst after 4-7 sec (lets user notice the title first)
  setTimeout(burst, 4000 + Math.random() * 3000);
})();

/* ============================================
   STATUS TEXT ROTATION
   - cycles between vibey "current state" messages
   - changes every ~7 seconds with a fade
   ============================================ */
(function initStatus() {
  const el = document.getElementById('statusText');
  if (!el) return;

  const messages = [
    'in the studio',
    'mixing the next one',
    'vibing in sydney',
    'something is cooking',
    'on the verge of a drop',
    'no thoughts just sound',
    'turning feelings into noise',
  ];
  let i = 0;
  setInterval(() => {
    el.style.opacity = '0';
    setTimeout(() => {
      i = (i + 1) % messages.length;
      el.textContent = messages[i];
      el.style.opacity = '1';
    }, 400);
  }, 7000);
})();

/* ============================================
   PRESS PLAY GATE
   - shown on first load, dismissed on click
   - click also kicks off the vibe music (uses the
     user gesture browsers require for audio).
   ============================================ */
(function initEnterGate() {
  const gate = document.getElementById('enterGate');
  const btn = document.getElementById('enterGateBtn');
  if (!gate || !btn) return;

  // skip the gate within the same browser session (so internal refresh
  // / back navigation doesn't re-show it). first visit = always shown.
  if (sessionStorage.getItem('rm_gate_dismissed') === '1') {
    gate.remove();
    document.body.classList.remove('enter-gate-locked');
    return;
  }

  document.body.classList.add('enter-gate-locked');

  function dismiss() {
    if (gate.classList.contains('is-dismissed')) return;
    gate.classList.add('is-dismissed');
    document.body.classList.remove('enter-gate-locked');
    sessionStorage.setItem('rm_gate_dismissed', '1');
    // start the vibe music using this click as the user gesture
    if (typeof window.__vibePlay === 'function') {
      try { window.__vibePlay(); } catch (e) { /* ignore */ }
    }
    // remove from DOM after fade-out so it doesn't intercept anything
    setTimeout(() => gate.remove(), 900);
  }

  // primary trigger: click the button
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dismiss();
  });
  // also dismiss on click anywhere in the gate (more forgiving on mobile)
  gate.addEventListener('click', dismiss);
  // keyboard: Enter / Space activates it too
  document.addEventListener('keydown', (e) => {
    if (gate.classList.contains('is-dismissed')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dismiss();
    }
  });
})();

/* ============================================
   FLAPPY SKULL — classic Flappy Bird gameplay.
   Tap / click / space to flap. Dodge neon pipes.
   Each pipe = +1 point. One hit = game over.
   Leaderboard via Netlify Function.
   ============================================ */
(function initFlappyGame() {
  const trigger = document.getElementById('gameTrigger');
  const mode = document.getElementById('gameMode');
  const canvas = document.getElementById('flappyCanvas');
  if (!trigger || !mode || !canvas) return;

  const ctx = canvas.getContext('2d');
  const closeBtn = document.getElementById('gameClose');
  const introScreen = document.getElementById('gameIntro');
  const countdownScreen = document.getElementById('gameCountdown');
  const countNum = document.getElementById('gameCountNum');
  const overScreen = document.getElementById('gameOver');
  const startBtn = document.getElementById('gameStart');
  const retryBtn = document.getElementById('gameRetry');
  const shareBtn = document.getElementById('gameShare');
  const scoreEl = document.getElementById('gameScore');
  const finalScoreEl = document.getElementById('gameFinalScore');
  const bestLineEl = document.getElementById('gameBestLine');
  const nameForm = document.getElementById('gameNameForm');
  const nameInput = document.getElementById('gameNameInput');
  const boardIntro = document.getElementById('gameLeaderboardIntro');
  const boardOver = document.getElementById('gameLeaderboardOver');

  // ---- state --------------------------------------------------
  const STATE = { IDLE: 'idle', COUNT: 'count', PLAY: 'play', OVER: 'over' };
  let state = STATE.IDLE;

  // world sized dynamically on resize
  let W = 0, H = 0, dpr = 1;

  // physics constants (tuned for 60fps feel)
  const GRAVITY = 0.55;
  const FLAP = -9.2;
  const MAX_FALL = 14;
  const SKULL_SIZE = 56;
  const SKULL_X_RATIO = 0.28; // skull stays at 28% from left
  const PIPE_W = 68;
  const PIPE_GAP_BASE = 180;
  const PIPE_SPACING = 260;   // horizontal distance between pipes
  const SCROLL_BASE = 3.2;

  // entities
  const bird = { y: 0, vy: 0, rot: 0 };
  let pipes = [];
  let stars = [];
  let score = 0, best = 0;
  let scroll = SCROLL_BASE;
  let shakeUntil = 0;
  let lastFrame = 0;
  let flashBurst = [];
  let lastFinalScore = 0;

  // skull sprite
  const skullImg = new Image();
  skullImg.src = 'skull.png?v=1';

  // ---- sizing -------------------------------------------------
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const r = mode.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { if (state !== STATE.IDLE) resize(); });

  // ---- best score ---------------------------------------------
  function loadBest() {
    try { best = parseInt(localStorage.getItem('rm_flappy_best') || '0', 10); }
    catch (_) { best = 0; }
  }
  function saveBest() {
    try { localStorage.setItem('rm_flappy_best', String(best)); } catch (_) {}
  }
  loadBest();

  // ---- audio — flap + crash ----------------------------------
  let audioCtx = null;
  function ensureAudio() {
    if (audioCtx) return audioCtx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    } catch (_) { audioCtx = null; }
    return audioCtx;
  }
  function flapSound() {
    const ac = ensureAudio();
    if (!ac) return;
    if (ac.state === 'suspended') { try { ac.resume(); } catch (_) {} }
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(820, now + 0.08);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }
  function scoreSound() {
    const ac = ensureAudio();
    if (!ac) return;
    if (ac.state === 'suspended') { try { ac.resume(); } catch (_) {} }
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }
  function crashSound() {
    const ac = ensureAudio();
    if (!ac) return;
    if (ac.state === 'suspended') { try { ac.resume(); } catch (_) {} }
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.45);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  // ---- leaderboard (Netlify Function) -------------------------
  const LB_ENDPOINT = '/.netlify/functions/leaderboard';
  let cachedLeaderboard = [];

  async function fetchLeaderboard() {
    try {
      const res = await fetch(LB_ENDPOINT, { method: 'GET' });
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      cachedLeaderboard = Array.isArray(data.scores) ? data.scores : [];
    } catch (e) {
      cachedLeaderboard = [];
    }
  }

  async function submitScore(name, scr) {
    try {
      await fetch(LB_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.slice(0, 12), score: scr }),
      });
      await fetchLeaderboard();
    } catch (e) { /* ignore */ }
  }

  function renderLeaderboard(container, myScore) {
    if (!container) return;
    if (!cachedLeaderboard.length) {
      container.innerHTML = '<div class="game-screen__leaderboard-title">— leaderboard —</div><div class="leaderboard-empty">be the first to make the board 🏆</div>';
      return;
    }
    const rows = cachedLeaderboard.slice(0, 10).map((s, i) => {
      const isMe = myScore != null && s.score === myScore && s._me;
      return `<div class="leaderboard-row${isMe ? ' is-me' : ''}">
        <span class="leaderboard-row__rank">${i + 1}</span>
        <span class="leaderboard-row__name">${escapeHtml(s.name)}</span>
        <span class="leaderboard-row__score">${s.score}</span>
      </div>`;
    }).join('');
    container.innerHTML = `<div class="game-screen__leaderboard-title">— leaderboard —</div>${rows}`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function cracksLeaderboard(scr) {
    if (scr <= 0) return false;
    if (cachedLeaderboard.length < 10) return true;
    const lowest = cachedLeaderboard[cachedLeaderboard.length - 1];
    return scr > (lowest ? lowest.score : 0);
  }

  // ---- game control ------------------------------------------
  async function openGame() {
    mode.classList.add('is-active');
    mode.setAttribute('aria-hidden', 'false');
    document.body.classList.add('game-active');
    // canvas needs to size after layout
    requestAnimationFrame(() => resize());
    await fetchLeaderboard();
    renderLeaderboard(boardIntro, null);
    showIntro();
    // boost vibe music if paused
    if (typeof window.__vibePlay === 'function') {
      try { window.__vibePlay(); } catch (_) {}
    }
  }

  function closeGame() {
    state = STATE.IDLE;
    mode.classList.remove('is-active');
    mode.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('game-active');
  }

  function showIntro() {
    introScreen.hidden = false;
    introScreen.style.display = '';
    countdownScreen.hidden = true;
    overScreen.hidden = true;
    nameForm.hidden = true;
    state = STATE.IDLE;
  }

  function startCountdown() {
    introScreen.hidden = true;
    overScreen.hidden = true;
    countdownScreen.hidden = false;
    state = STATE.COUNT;
    let n = 3;
    countNum.textContent = n;
    // restart the animation
    countNum.style.animation = 'none';
    countNum.offsetHeight;
    countNum.style.animation = '';
    const tick = () => {
      n--;
      if (n > 0) {
        countNum.textContent = n;
        countNum.style.animation = 'none';
        countNum.offsetHeight;
        countNum.style.animation = '';
        setTimeout(tick, 900);
      } else {
        countNum.textContent = 'GO';
        countNum.style.animation = 'none';
        countNum.offsetHeight;
        countNum.style.animation = '';
        setTimeout(() => {
          countdownScreen.hidden = true;
          startGame();
        }, 700);
      }
    };
    setTimeout(tick, 900);
  }

  function startGame() {
    resize();
    score = 0;
    bird.y = H * 0.4;
    bird.vy = 0;
    bird.rot = 0;
    pipes = [];
    flashBurst = [];
    scroll = SCROLL_BASE;
    // seed a couple of pipes ahead
    for (let i = 0; i < 3; i++) {
      spawnPipe(W + i * PIPE_SPACING);
    }
    // init starfield
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.3,
        vx: 0.2 + Math.random() * 0.8,
      });
    }
    scoreEl.textContent = '0';
    state = STATE.PLAY;
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  }

  function spawnPipe(xPos) {
    const minGapY = 90;
    const maxGapY = H - 90;
    const gap = Math.max(140, PIPE_GAP_BASE - score * 1.2);
    const gapCenter = minGapY + gap/2 + Math.random() * (maxGapY - minGapY - gap);
    pipes.push({
      x: xPos,
      gapTop: gapCenter - gap/2,
      gapBot: gapCenter + gap/2,
      scored: false,
    });
  }

  function flap() {
    if (state !== STATE.PLAY) return;
    bird.vy = FLAP;
    flapSound();
    // little puff
    for (let i = 0; i < 6; i++) {
      flashBurst.push({
        x: W * SKULL_X_RATIO - 14,
        y: bird.y + 12,
        vx: -Math.random() * 2 - 1,
        vy: Math.random() * 2 + 1,
        life: 1,
      });
    }
  }

  function gameOver() {
    state = STATE.OVER;
    crashSound();
    shakeUntil = performance.now() + 400;
    // brief delay so crash shake can be seen before game-over screen
    setTimeout(showGameOver, 650);
  }

  function showGameOver() {
    const isNewBest = score > best;
    if (isNewBest) { best = score; saveBest(); }
    lastFinalScore = score;
    finalScoreEl.textContent = score;
    bestLineEl.textContent = 'best: ' + best;
    bestLineEl.classList.toggle('is-new', isNewBest);

    if (cracksLeaderboard(score)) {
      nameForm.hidden = false;
      try {
        const prev = localStorage.getItem('rm_game_name');
        if (prev) nameInput.value = prev;
      } catch (_) {}
      setTimeout(() => nameInput.focus(), 300);
    } else {
      nameForm.hidden = true;
    }
    renderLeaderboard(boardOver, null);
    overScreen.hidden = false;
  }

  // ---- main loop ---------------------------------------------
  function loop(now) {
    if (state !== STATE.PLAY) return;
    const dt = Math.min(32, now - lastFrame) || 16;
    lastFrame = now;
    const step = dt / 16.67; // normalize to 60fps

    // ---- background (black fade for light trail) ----
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    // screen shake on crash
    let shakeX = 0, shakeY = 0;
    if (now < shakeUntil) {
      shakeX = (Math.random() - 0.5) * 10;
      shakeY = (Math.random() - 0.5) * 10;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // ---- starfield ----
    for (const s of stars) {
      s.x -= s.vx * step;
      if (s.x < -5) { s.x = W + 5; s.y = Math.random() * H; }
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#f4f4f0';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // ---- difficulty ramp ----
    scroll = SCROLL_BASE + Math.min(2.2, score * 0.08);

    // ---- update + draw pipes ----
    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.x -= scroll * step;

      // top pipe
      drawPipe(p.x, 0, PIPE_W, p.gapTop, 'top');
      // bottom pipe
      drawPipe(p.x, p.gapBot, PIPE_W, H - p.gapBot, 'bot');

      // score when bird passes
      const bx = W * SKULL_X_RATIO;
      if (!p.scored && p.x + PIPE_W < bx - SKULL_SIZE/2) {
        p.scored = true;
        score++;
        scoreEl.textContent = String(score);
        scoreSound();
      }

      // off-screen cleanup + spawn
      if (p.x + PIPE_W < -10) {
        pipes.splice(i, 1);
      }
    }
    // keep spawning
    const last = pipes[pipes.length - 1];
    if (!last || last.x < W - PIPE_SPACING) {
      spawnPipe((last ? last.x : W) + PIPE_SPACING);
    }

    // ---- update bird ----
    bird.vy += GRAVITY * step;
    if (bird.vy > MAX_FALL) bird.vy = MAX_FALL;
    bird.y += bird.vy * step;
    bird.rot = Math.max(-0.4, Math.min(1.2, bird.vy * 0.08));

    // collide with floor / ceiling
    if (bird.y + SKULL_SIZE/2 >= H - 4) {
      bird.y = H - 4 - SKULL_SIZE/2;
      ctx.restore();
      gameOver();
      return;
    }
    if (bird.y - SKULL_SIZE/2 < 0) {
      bird.y = SKULL_SIZE/2;
      bird.vy = 0;
    }

    // collide with pipes (AABB)
    const bx = W * SKULL_X_RATIO;
    const by = bird.y;
    const br = SKULL_SIZE * 0.42; // slightly forgiving
    for (const p of pipes) {
      if (bx + br > p.x && bx - br < p.x + PIPE_W) {
        if (by - br < p.gapTop || by + br > p.gapBot) {
          ctx.restore();
          gameOver();
          return;
        }
      }
    }

    // ---- draw ground glow ----
    const grd = ctx.createLinearGradient(0, H - 30, 0, H);
    grd.addColorStop(0, 'rgba(212,255,58,0)');
    grd.addColorStop(1, 'rgba(212,255,58,0.18)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, H - 30, W, 30);

    // ---- draw flap puffs ----
    for (let i = flashBurst.length - 1; i >= 0; i--) {
      const f = flashBurst[i];
      f.x += f.vx * step;
      f.y += f.vy * step;
      f.life -= 0.04 * step;
      if (f.life <= 0) { flashBurst.splice(i, 1); continue; }
      ctx.globalAlpha = f.life * 0.8;
      ctx.fillStyle = '#d4ff3a';
      ctx.fillRect(f.x, f.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    // ---- draw skull ----
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(bird.rot);
    ctx.shadowColor = 'rgba(212,255,58,0.9)';
    ctx.shadowBlur = 24;
    if (skullImg.complete && skullImg.naturalWidth) {
      ctx.filter = 'brightness(0.8) contrast(1.5) sepia(1) saturate(5) hue-rotate(38deg)';
      ctx.drawImage(skullImg, -SKULL_SIZE/2, -SKULL_SIZE/2, SKULL_SIZE, SKULL_SIZE);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#d4ff3a';
      ctx.beginPath();
      ctx.arc(0, 0, SKULL_SIZE/2, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();

    // ---- big score text in center-top ----
    ctx.save();
    ctx.font = '700 48px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(244,244,240,0.85)';
    ctx.shadowColor = 'rgba(212,255,58,0.6)';
    ctx.shadowBlur = 18;
    ctx.fillText(String(score), W / 2, 90);
    ctx.restore();

    ctx.restore();
    requestAnimationFrame(loop);
  }

  function drawPipe(x, y, w, h, which) {
    if (h <= 0) return;
    ctx.save();
    // body
    const grd = ctx.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, '#0c1a00');
    grd.addColorStop(0.5, '#1a3a00');
    grd.addColorStop(1, '#0c1a00');
    ctx.fillStyle = grd;
    ctx.fillRect(x, y, w, h);
    // lime outline + glow
    ctx.strokeStyle = 'rgba(212,255,58,0.85)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(212,255,58,0.9)';
    ctx.shadowBlur = 14;
    ctx.strokeRect(x + 1, y, w - 2, h);
    // lip
    const lipH = 14;
    const lipY = which === 'top' ? y + h - lipH : y;
    ctx.fillStyle = '#1f4500';
    ctx.fillRect(x - 4, lipY, w + 8, lipH);
    ctx.strokeRect(x - 4, lipY, w + 8, lipH);
    ctx.restore();
  }

  // ---- input --------------------------------------------------
  function handleFlap(e) {
    if (e) e.preventDefault();
    ensureAudio();
    if (state === STATE.PLAY) flap();
  }
  canvas.addEventListener('mousedown', handleFlap);
  canvas.addEventListener('touchstart', handleFlap, { passive: false });
  document.addEventListener('keydown', (e) => {
    if (!mode.classList.contains('is-active')) return;
    if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') {
      e.preventDefault();
      handleFlap();
    }
  });

  // ---- buttons -----------------------------------------------
  trigger.addEventListener('click', () => { openGame(); });
  closeBtn.addEventListener('click', () => { closeGame(); });
  startBtn.addEventListener('click', () => {
    ensureAudio();
    startCountdown();
  });
  retryBtn.addEventListener('click', () => {
    ensureAudio();
    overScreen.hidden = true;
    startCountdown();
  });
  // back-to-site buttons (data-close-game)
  document.querySelectorAll('[data-close-game]').forEach((b) => {
    b.addEventListener('click', () => closeGame());
  });

  shareBtn.addEventListener('click', async () => {
    const url = 'https://rebeccamuze.club';
    const text = `I hit ROUND ${lastFinalScore} in Rebecca Muze's SIMON 🎶 beat me: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'REBECCA MUZE — SIMON', text, url }); return; } catch (_) {}
    }
    try { await navigator.clipboard.writeText(text); shareBtn.textContent = 'COPIED!'; setTimeout(()=> shareBtn.textContent = 'SHARE', 1400); }
    catch (_) { alert(text); }
  });

  nameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (nameInput.value || 'anon').trim().toUpperCase().replace(/[^A-Z0-9 _-]/g, '').slice(0, 12) || 'ANON';
    try { localStorage.setItem('rm_game_name', name); } catch (_) {}
    nameForm.hidden = true;
    await submitScore(name, lastFinalScore);
    cachedLeaderboard = cachedLeaderboard.map(s => {
      if (s.name === name && s.score === lastFinalScore) return { ...s, _me: true };
      return s;
    });
    renderLeaderboard(boardOver, lastFinalScore);
  });

  // escape closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mode.classList.contains('is-active')) closeGame();
  });
})();
