const stage = document.getElementById('stage');
const scenes = [...document.querySelectorAll('.scene')];
const dots = document.getElementById('dots');
const chapterNo = document.getElementById('chapterNo');
const chapterName = document.getElementById('chapterName');
let current = 0;
let audio, oscillator, filter, gain;
let parallax = { x: 0, y: 0 };
let touchStart = null;
let twistScore = 0;
let mazeStep = 0;
let cardsFlipped = 0;

const hasGsap = () => window.gsap;

function initDots() {
  dots.innerHTML = scenes.map((_, index) => `<span class="${index === 0 ? 'on' : ''}"></span>`).join('');
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
    gsap.set(to, { autoAlpha: 0, scale: 1.08, y: index > current ? 80 : -80, filter: 'blur(18px)' });
    gsap.timeline({ defaults: { duration: 0.85, ease: 'power3.inOut' } })
      .to(from, { autoAlpha: 0, scale: 0.94, y: index > current ? -70 : 70, filter: 'blur(18px)' }, 0)
      .to(to, { autoAlpha: 1, scale: 1, y: 0, filter: 'blur(0px)' }, 0)
      .add(() => from.classList.remove('active'));
  } else {
    from.classList.remove('active');
  }
  current = index;
  updateHud();
  burst(index % 2 ? '#45ff99' : '#ff3ea5', 30);
  enterScene(index);
}

function next() { goTo(current + 1); }

function enterScene(index) {
  if (!hasGsap()) return;
  const scene = scenes[index];
  gsap.fromTo(scene.querySelectorAll('.copy > *'), { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.8, ease: 'power3.out' });
  if (scene.classList.contains('product')) gsap.fromTo('.packshot', { y: 120, rotate: -8, scale: .75 }, { y: 0, rotate: 0, scale: 1, duration: 1.2, ease: 'elastic.out(1,.65)' });
  if (scene.classList.contains('result')) gsap.fromTo('#posterCard', { y: 100, rotateX: 16, opacity: 0 }, { y: 0, rotateX: 0, opacity: 1, duration: 1, ease: 'power3.out' });
}

document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => { startAudio(); next(); }));
document.getElementById('restart').addEventListener('click', () => { mazeStep = 0; cardsFlipped = 0; twistScore = 0; document.querySelectorAll('.feature-card').forEach(c => c.classList.remove('flipped')); goTo(0); });

stage.addEventListener('pointerdown', event => {
  startAudio();
  touchStart = { x: event.clientX, y: event.clientY, t: Date.now() };
});
stage.addEventListener('pointerup', event => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx) && dy < 0 && current === 1) next();
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) && current === 4) moveMaze(dx > 0 ? 1 : -1);
  touchStart = null;
});

stage.addEventListener('pointermove', event => {
  const rect = stage.getBoundingClientRect();
  parallax.x = ((event.clientX - rect.left) / rect.width - .5) * 2;
  parallax.y = ((event.clientY - rect.top) / rect.height - .5) * 2;
  applyParallax();
});

function applyParallax() {
  document.querySelectorAll('.scene.active .parallax').forEach(el => {
    const depth = Number(el.dataset.depth || .1);
    el.style.transform = `translate3d(${parallax.x * depth * 44}px, ${parallax.y * depth * 44}px, 0)`;
  });
}

function moveMaze(direction) {
  mazeStep = Math.max(0, Math.min(4, mazeStep + direction));
  const progress = mazeStep / 4;
  document.getElementById('mazeProgress').style.width = `${progress * 100}%`;
  if (hasGsap()) gsap.to('#avatar', { left: `${8 + progress * 72}%`, duration: .55, ease: 'back.out(1.8)' });
  burst('#ffd86b', 16);
  if (mazeStep >= 4) setTimeout(next, 550);
}

// Twist sky: supports both two-finger rotation and one-finger circular dragging.
const skyDisc = document.getElementById('skyDisc');
let activePointers = new Map();
let lastAngle = null;
skyDisc.addEventListener('pointerdown', e => { skyDisc.setPointerCapture(e.pointerId); activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
skyDisc.addEventListener('pointermove', e => {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const points = [...activePointers.values()];
  const rect = skyDisc.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let angle;
  if (points.length >= 2) angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
  else angle = Math.atan2(e.clientY - cy, e.clientX - cx);
  if (lastAngle !== null && current === 2) {
    const delta = Math.abs(shortAngle(angle - lastAngle));
    twistScore = Math.min(100, twistScore + delta * 23);
    const hue = Math.round(twistScore * 2.4);
    skyDisc.style.background = `conic-gradient(from ${twistScore * 8}deg, hsl(${hue},100%,58%), #00f0ff, #fff15d, #ff3ea5, hsl(${hue},100%,58%))`;
    document.getElementById('twistProgress').style.width = `${twistScore}%`;
    if (twistScore >= 100) setTimeout(next, 450);
  }
  lastAngle = angle;
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(type => skyDisc.addEventListener(type, e => { activePointers.delete(e.pointerId); lastAngle = null; }));
function shortAngle(angle) { return Math.atan2(Math.sin(angle), Math.cos(angle)); }

// Scratch scene.
const scratchCanvas = document.getElementById('scratchCanvas');
const sctx = scratchCanvas.getContext('2d');
let scratched = 0;
function setupScratch() {
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  scratchCanvas.width = Math.round(rect.width * dpr);
  scratchCanvas.height = Math.round(rect.height * dpr);
  scratchCanvas.style.width = `${rect.width}px`;
  scratchCanvas.style.height = `${rect.height}px`;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const grad = sctx.createLinearGradient(0, 0, rect.width, rect.height);
  grad.addColorStop(0, '#9b9ba6'); grad.addColorStop(.45, '#31313c'); grad.addColorStop(1, '#050505');
  sctx.globalCompositeOperation = 'source-over';
  sctx.fillStyle = grad; sctx.fillRect(0, 0, rect.width, rect.height);
  sctx.fillStyle = 'rgba(255,255,255,.14)';
  for (let i = 0; i < 80; i++) sctx.fillRect(Math.random() * rect.width, Math.random() * rect.height, Math.random() * 120, 2);
  scratched = 0;
}
function scratchAt(event) {
  if (current !== 3) return;
  const rect = scratchCanvas.getBoundingClientRect();
  sctx.globalCompositeOperation = 'destination-out';
  sctx.beginPath();
  sctx.arc(event.clientX - rect.left, event.clientY - rect.top, rect.width * .075, 0, Math.PI * 2);
  sctx.fill();
  scratched += 1;
  if (scratched > 24) next();
}
scratchCanvas.addEventListener('pointerdown', scratchAt);
scratchCanvas.addEventListener('pointermove', event => { if (event.buttons) scratchAt(event); });
window.addEventListener('resize', setupScratch);

// Shake and long press fragrance release.
let lastShake = { x: 0, y: 0, z: 0, t: 0 };
window.addEventListener('devicemotion', e => {
  const a = e.accelerationIncludingGravity || {};
  const now = Date.now();
  const diff = Math.abs((a.x || 0) - lastShake.x) + Math.abs((a.y || 0) - lastShake.y) + Math.abs((a.z || 0) - lastShake.z);
  if (current === 5 && diff > 26 && now - lastShake.t > 700) releaseFragrance();
  lastShake = { x: a.x || 0, y: a.y || 0, z: a.z || 0, t: now };
});
let pressTimer;
const shakeFallback = document.getElementById('shakeFallback');
shakeFallback.addEventListener('pointerdown', () => { pressTimer = setTimeout(releaseFragrance, 850); });
shakeFallback.addEventListener('pointerup', () => clearTimeout(pressTimer));
function releaseFragrance() {
  burst('#45ff99', 90);
  if (hasGsap()) gsap.fromTo('.leaf', { scale: .5, opacity: .5 }, { scale: 2.4, opacity: 0, stagger: .04, duration: 1.1, ease: 'power2.out' });
  setTimeout(next, 700);
}

document.querySelectorAll('.feature-card').forEach(card => {
  card.addEventListener('click', () => {
    if (!card.classList.contains('flipped')) cardsFlipped++;
    card.classList.add('flipped');
    burst('#fff15d', 12);
    if (cardsFlipped >= 4) setTimeout(next, 700);
  });
});

// Canvas particles.
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function resizeParticles() {
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function burst(color = '#ffffff', count = 24) {
  const rect = stage.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    particles.push({ x: rect.width * (.35 + Math.random() * .3), y: rect.height * (.35 + Math.random() * .3), vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8, life: 1, size: 3 + Math.random() * 8, color });
  }
}
function animateParticles() {
  const rect = stage.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.globalCompositeOperation = 'lighter';
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += .025; p.life -= .015;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
  });
  if (particles.length < 70) particles.push({ x: Math.random() * rect.width, y: rect.height + 10, vx: (Math.random() - .5) * .6, vy: -(.4 + Math.random() * 1.2), life: .6 + Math.random() * .4, size: 1 + Math.random() * 4, color: ['#45ff99', '#00f0ff', '#ff3ea5', '#ffd86b'][Math.floor(Math.random() * 4)] });
  requestAnimationFrame(animateParticles);
}

function startAudio() {
  if (audio) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio = new AudioContext();
  oscillator = audio.createOscillator();
  filter = audio.createBiquadFilter();
  gain = audio.createGain();
  oscillator.type = 'sawtooth'; oscillator.frequency.value = 72;
  filter.type = 'lowpass'; filter.frequency.value = 620;
  gain.gain.value = .025;
  oscillator.connect(filter); filter.connect(gain); gain.connect(audio.destination); oscillator.start();
}
document.getElementById('soundToggle').addEventListener('click', () => {
  startAudio();
  if (!gain) return;
  gain.gain.value = gain.gain.value > 0 ? 0 : .025;
});

initDots(); updateHud(); setupScratch(); resizeParticles(); animateParticles(); enterScene(0);
window.addEventListener('resize', resizeParticles);
if (hasGsap()) {
  gsap.to('.giant-shirt', { y: 18, rotate: .8, duration: 3.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  gsap.to('.botanical-bottle', { y: -22, rotate: 2, duration: 2.1, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  gsap.to('.floating-pods span', { y: -38, x: 16, duration: 2.8, repeat: -1, yoyo: true, stagger: .22, ease: 'sine.inOut' });
}
