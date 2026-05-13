const stage = document.getElementById('stage');
const scenes = [...document.querySelectorAll('.scene')];
const dots = document.getElementById('dots');
const chapterNo = document.getElementById('chapterNo');
const chapterName = document.getElementById('chapterName');
const toast = document.getElementById('toast');
const fxCanvas = document.getElementById('fxCanvas');
const fx = fxCanvas.getContext('2d');
const scratchCanvas = document.getElementById('scratchCanvas');
const scratch = scratchCanvas.getContext('2d');
const hasGsap = () => Boolean(window.gsap);
let current = 0;
let gestureStart = null;
let flowerCount = 0;
let twistScore = 0;
let cardCount = 0;
let particles = [];
let audioCtx, drone, shimmer, master;
let autoAdvance = false;

function viewport() {
  return stage.getBoundingClientRect();
}

function fitCanvas(canvas, ctx) {
  const rect = viewport();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function init() {
  dots.innerHTML = scenes.map((_, index) => `<span class="${index === 0 ? 'on' : ''}"></span>`).join('');
  fitCanvas(fxCanvas, fx);
  fitCanvas(scratchCanvas, scratch);
  paintScratchFog();
  updateHud();
  bindInteractions();
  animateParticles();
  enterScene(0);
  window.addEventListener('resize', () => {
    fitCanvas(fxCanvas, fx);
    fitCanvas(scratchCanvas, scratch);
    if (current === 3) paintScratchFog();
  });
}

function updateHud() {
  chapterNo.textContent = String(current + 1).padStart(2, '0');
  chapterName.textContent = scenes[current].dataset.name;
  [...dots.children].forEach((dot, index) => dot.classList.toggle('on', index === current));
}

function goTo(index) {
  if (index < 0 || index >= scenes.length || index === current) return;
  const from = scenes[current];
  const to = scenes[index];
  to.classList.add('active');
  if (hasGsap()) {
    gsap.set(to, { autoAlpha: 0, scale: 1.08, y: index > current ? 90 : -90, filter: 'blur(18px)' });
    gsap.timeline({ defaults: { duration: 0.9, ease: 'power3.inOut' } })
      .to(from, { autoAlpha: 0, scale: 0.95, y: index > current ? -75 : 75, filter: 'blur(18px)' }, 0)
      .to(to, { autoAlpha: 1, scale: 1, y: 0, filter: 'blur(0px)' }, 0)
      .add(() => from.classList.remove('active'));
  } else {
    from.classList.remove('active');
  }
  current = index;
  autoAdvance = false;
  updateHud();
  burst((scenes[current].dataset.tone || '#ffffff'), 46);
  enterScene(index);
}

function next() {
  goTo(current + 1);
}

function scheduleNext(delay = 600) {
  if (autoAdvance) return;
  autoAdvance = true;
  setTimeout(() => {
    autoAdvance = false;
    next();
  }, delay);
}

function enterScene(index) {
  scratchCanvas.style.display = index === 3 ? 'block' : 'none';
  scratchCanvas.style.pointerEvents = index === 3 ? 'auto' : 'none';
  if (index === 3) paintScratchFog();
  if (index === 7) revealProduct();
  if (!hasGsap()) return;
  const scene = scenes[index];
  gsap.fromTo(scene.querySelectorAll('.story > *'), { y: 42, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.8, ease: 'power3.out' });
  if (index === 1) gsap.fromTo('.bloom', { scale: .5, opacity: .3 }, { scale: 1, opacity: 1, stagger: .13, duration: .8, ease: 'back.out(2)' });
  if (index === 4) gsap.fromTo('.garment', { y: -170, opacity: 0 }, { y: 0, opacity: 1, stagger: .08, duration: .9, ease: 'elastic.out(1,.8)' });
  if (index === 9) gsap.fromTo('#poster', { y: 110, rotateX: 12, opacity: 0 }, { y: 0, rotateX: 0, opacity: 1, duration: .9, ease: 'power3.out' });
}

function bindInteractions() {
  document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => { startAudio(); next(); }));
  document.getElementById('shirtCorner').addEventListener('click', () => {
    startAudio();
    if (hasGsap()) gsap.to('.sky-shirt', { y: -260, rotate: -9, duration: .85, ease: 'power3.in' });
    scheduleNext(520);
  });

  stage.addEventListener('pointerdown', event => {
    startAudio();
    gestureStart = { x: event.clientX, y: event.clientY };
  });
  stage.addEventListener('pointermove', event => {
    const rect = viewport();
    const x = ((event.clientX - rect.left) / rect.width - .5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - .5) * 2;
    document.querySelectorAll('.scene.active .parallax').forEach(layer => {
      const depth = Number(layer.dataset.depth || .1);
      layer.style.transform = `translate3d(${x * depth * 54}px, ${y * depth * 54}px, 0)`;
    });
  });
  stage.addEventListener('pointerup', event => {
    if (!gestureStart) return;
    const dx = event.clientX - gestureStart.x;
    if (current === 1 && Math.abs(dx) > 95) {
      if (hasGsap()) gsap.to('.fiber-canyon', { x: dx > 0 ? 70 : -70, duration: .35, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      burst('#8dff9e', 18);
    }
    gestureStart = null;
  });

  document.querySelectorAll('.flower').forEach(flower => flower.addEventListener('click', () => {
    if (flower.classList.contains('lit')) return;
    flower.classList.add('lit');
    flowerCount += 1;
    document.getElementById('fiberProgress').style.width = `${flowerCount / 3 * 100}%`;
    burst('#8dff9e', 36, flower);
    if (flowerCount >= 3) scheduleNext(650);
  }));

  bindTwist();
  bindScratch();
  bindGarments();
  bindShake();
  bindMachineHold();
  bindCards();
  bindPosterActions();
}

function bindTwist() {
  const target = document.getElementById('twistTarget');
  const pointers = new Map();
  let lastAngle = null;
  target.addEventListener('pointerdown', event => {
    target.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  });
  target.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.values()];
    const rect = target.getBoundingClientRect();
    const angle = pts.length > 1
      ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x)
      : Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2);
    if (lastAngle !== null && current === 2) {
      twistScore = Math.min(100, twistScore + Math.abs(Math.atan2(Math.sin(angle - lastAngle), Math.cos(angle - lastAngle))) * 24);
      target.style.transform = `rotate(${twistScore * 5}deg) scale(${1 - twistScore / 700})`;
      document.getElementById('twistProgress').style.width = `${twistScore}%`;
      document.querySelector('.gold-rain').style.opacity = twistScore / 100;
      if (twistScore > 38) target.classList.add('color');
      if (twistScore >= 100) {
        bloomEarth();
        scheduleNext(850);
      }
    }
    lastAngle = angle;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => target.addEventListener(type, event => {
    pointers.delete(event.pointerId);
    lastAngle = null;
  }));
}

function bloomEarth() {
  const earth = document.querySelector('.cracked-earth');
  if (hasGsap()) gsap.to(earth, { background: 'linear-gradient(#69ffaf,#ff4bb6,#ffe06d)', duration: .55 });
  burst('#ffe06d', 90);
}

function paintScratchFog() {
  const rect = viewport();
  scratch.globalCompositeOperation = 'source-over';
  const gradient = scratch.createLinearGradient(0, 0, rect.width, rect.height);
  gradient.addColorStop(0, '#d2d7df');
  gradient.addColorStop(.38, '#6e7280');
  gradient.addColorStop(1, '#171922');
  scratch.fillStyle = gradient;
  scratch.fillRect(0, 0, rect.width, rect.height);
  scratch.fillStyle = 'rgba(255,255,255,.22)';
  scratch.font = `900 ${Math.max(34, rect.width * .09)}px sans-serif`;
  ['焦虑', '内耗', '加班', '失眠', '疲惫'].forEach((word, i) => scratch.fillText(word, rect.width * (.16 + (i % 2) * .44), rect.height * (.32 + i * .11)));
  scratch.fillStyle = 'rgba(255,255,255,.12)';
  for (let i = 0; i < 90; i++) scratch.fillRect(Math.random() * rect.width, Math.random() * rect.height, 40 + Math.random() * 150, 2);
  scratch._count = 0;
}

function bindScratch() {
  const erase = event => {
    if (current !== 3) return;
    const rect = scratchCanvas.getBoundingClientRect();
    scratch.globalCompositeOperation = 'destination-out';
    scratch.beginPath();
    scratch.arc(event.clientX - rect.left, event.clientY - rect.top, rect.width * .085, 0, Math.PI * 2);
    scratch.fill();
    scratch._count = (scratch._count || 0) + 1;
    burst('#ff6bc8', 5);
    if (scratch._count > 28) scheduleNext(500);
  };
  scratchCanvas.addEventListener('pointerdown', erase);
  scratchCanvas.addEventListener('pointermove', event => { if (event.buttons) erase(event); });
}

function bindGarments() {
  document.querySelectorAll('.garment').forEach(garment => garment.addEventListener('click', () => {
    showToast(`${garment.dataset.note} 香雾被打开`);
    if (hasGsap()) gsap.to(garment, { scaleX: 1.35, scaleY: .92, opacity: .28, duration: .55, ease: 'power3.inOut' });
    burst('#d8a2ff', 80, garment);
    scheduleNext(700);
  }));
}

function bindShake() {
  let last = { x: 0, y: 0, z: 0, t: 0 };
  window.addEventListener('devicemotion', event => {
    const a = event.accelerationIncludingGravity || {};
    const now = Date.now();
    const delta = Math.abs((a.x || 0) - last.x) + Math.abs((a.y || 0) - last.y) + Math.abs((a.z || 0) - last.z);
    if (current === 5 && delta > 24 && now - last.t > 650) wakeCoat();
    last = { x: a.x || 0, y: a.y || 0, z: a.z || 0, t: now };
  });
  let timer;
  const coatButton = document.getElementById('coatButton');
  coatButton.addEventListener('pointerdown', () => { timer = setTimeout(wakeCoat, 800); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => coatButton.addEventListener(type, () => clearTimeout(timer)));
}

function wakeCoat() {
  if (current !== 5) return;
  document.getElementById('coat').classList.add('awake');
  burst('#77ffbb', 110);
  scheduleNext(950);
}

function bindMachineHold() {
  const holdButton = document.getElementById('machineHold');
  let timer;
  const begin = () => {
    holdButton.textContent = '启动中…';
    timer = setTimeout(() => {
      if (hasGsap()) gsap.to('.memory-orbit i', { x: 0, y: 0, left: '44%', top: '44%', scale: .2, opacity: 0, stagger: .05, duration: .7, ease: 'power3.in' });
      burst('#5cd7ff', 120);
      scheduleNext(650);
    }, 900);
  };
  const cancel = () => { clearTimeout(timer); holdButton.textContent = '长按启动'; };
  holdButton.addEventListener('pointerdown', begin);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => holdButton.addEventListener(type, cancel));
}

function revealProduct() {
  if (hasGsap()) {
    gsap.timeline()
      .fromTo('.mega-drop', { scale: 1, opacity: 1 }, { scale: 1.8, opacity: 0, duration: .75, ease: 'power3.in' })
      .to('.product-altar', { opacity: 1, duration: .2 }, .45)
      .fromTo('.product-pack', { y: 150, scale: .72, rotate: -8 }, { y: 0, scale: 1, rotate: 0, duration: 1.1, ease: 'elastic.out(1,.65)' }, .5);
  } else {
    document.querySelector('.product-altar').style.opacity = 1;
  }
}

function bindCards() {
  document.querySelectorAll('.feature-card').forEach(card => card.addEventListener('click', () => {
    if (!card.classList.contains('flipped')) cardCount += 1;
    card.classList.add('flipped');
    scenes[8].classList.add('brighten');
    burst('#ffd66f', 44, card);
    if (cardCount >= 4) scheduleNext(760);
  }));
}

function bindPosterActions() {
  document.getElementById('restart').addEventListener('click', () => {
    flowerCount = 0;
    twistScore = 0;
    cardCount = 0;
    document.querySelectorAll('.flower').forEach(item => item.classList.remove('lit'));
    document.querySelectorAll('.feature-card').forEach(item => item.classList.remove('flipped'));
    document.getElementById('fiberProgress').style.width = '0%';
    document.getElementById('twistProgress').style.width = '0%';
    document.getElementById('twistTarget').classList.remove('color');
    document.getElementById('coat').classList.remove('awake');
    document.querySelector('.product-altar').style.opacity = 0;
    document.querySelector('.mega-drop').removeAttribute('style');
    document.querySelector('.product-pack').removeAttribute('style');
    document.querySelector('.gold-rain').style.opacity = 0;
    scenes[8].classList.remove('brighten');
    goTo(0);
  });
  document.getElementById('savePoster').addEventListener('click', () => showToast('已生成结果海报，可接入 html2canvas 保存长图'));
  document.getElementById('shareFriend').addEventListener('click', () => showToast('分享好友：可接入微信 JS-SDK'));
}

function burst(color = '#ffffff', count = 28, source) {
  const rect = viewport();
  let x = rect.width / 2;
  let y = rect.height / 2;
  if (source) {
    const s = source.getBoundingClientRect();
    x = s.left - rect.left + s.width / 2;
    y = s.top - rect.top + s.height / 2;
  }
  for (let i = 0; i < count; i++) {
    particles.push({ x, y, vx: (Math.random() - .5) * 9, vy: (Math.random() - .5) * 9, life: 1, size: 2 + Math.random() * 8, color });
  }
}

function animateParticles() {
  const rect = viewport();
  fx.clearRect(0, 0, rect.width, rect.height);
  fx.globalCompositeOperation = 'lighter';
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += .025;
    p.life -= .016;
    fx.globalAlpha = Math.max(0, p.life);
    fx.fillStyle = p.color;
    fx.beginPath();
    fx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    fx.fill();
  });
  if (particles.length < 95) particles.push({ x: Math.random() * rect.width, y: rect.height + 8, vx: (Math.random() - .5) * .5, vy: -(.35 + Math.random() * 1.1), life: .7, size: 1 + Math.random() * 4, color: ['#69ffaf', '#36d8ff', '#ff4bb6', '#ffe06d'][Math.floor(Math.random() * 4)] });
  requestAnimationFrame(animateParticles);
}

function startAudio() {
  if (audioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioCtx = new AudioContext();
  master = audioCtx.createGain();
  master.gain.value = .026;
  drone = audioCtx.createOscillator();
  shimmer = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  drone.type = 'sawtooth';
  shimmer.type = 'sine';
  drone.frequency.value = 64;
  shimmer.frequency.value = 196;
  filter.type = 'lowpass';
  filter.frequency.value = 720;
  drone.connect(filter);
  shimmer.connect(filter);
  filter.connect(master);
  master.connect(audioCtx.destination);
  drone.start();
  shimmer.start();
}

document.getElementById('soundToggle').addEventListener('click', () => {
  startAudio();
  if (!master) return;
  master.gain.value = master.gain.value > 0 ? 0 : .026;
});

function showToast(message) {
  toast.textContent = message;
  if (hasGsap()) {
    gsap.killTweensOf(toast);
    gsap.fromTo(toast, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .25, onComplete: () => gsap.to(toast, { opacity: 0, y: -10, delay: 1.2, duration: .35 }) });
  } else {
    toast.style.opacity = 1;
    setTimeout(() => { toast.style.opacity = 0; }, 1400);
  }
}

if (hasGsap()) {
  gsap.to('.cloth-clouds span', { x: 36, y: -18, duration: 4, repeat: -1, yoyo: true, stagger: .4, ease: 'sine.inOut' });
  gsap.to('.memory-orbit i', { rotation: 360, duration: 6, repeat: -1, ease: 'none' });
  gsap.to('.bloom', { y: -14, duration: 1.8, repeat: -1, yoyo: true, stagger: .2, ease: 'sine.inOut' });
}

init();
