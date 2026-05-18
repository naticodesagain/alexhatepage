/* ============================================================
   STICK FIGURE SNACK DASH — script.js
   Canvas game featuring Alemayehu "Chair Force" Nigussie
   ============================================================ */

'use strict';

// ──────────────────────────────────────────────────────────────
// CANVAS DIMENSIONS (logical / internal resolution)
// ──────────────────────────────────────────────────────────────
const CANVAS_W      = 480;
const CANVAS_H      = 660;
const GAME_DURATION = 60;    // seconds per round
const PLAYER_SPEED  = 270;   // px/s horizontal speed

// ──────────────────────────────────────────────────────────────
// HEAD IMAGE — crop tuning
//
// Selected photo: aleximg/IMG_7695.jpg  (1179 × 1675 px)
// It's an extreme close-up with bug eyes and open mouth. Perfect.
//
// Adjust these three constants to re-center the face in the circle:
//
//   headCropX     — X pixel in the SOURCE image to place at the
//                   circle center.  (0 = left edge, 1179 = right)
//
//   headCropY     — Y pixel in the SOURCE image to place at the
//                   circle center.  (0 = top edge, 1675 = bottom)
//                   Lower → shows more chin/mouth
//                   Higher → shows more forehead
//
//   headCropScale — Source pixels per canvas pixel.
//                   Higher → zooms out (shows more face / background)
//                   Lower  → zooms in  (tighter crop)
//
// Current values center between the eyes and open mouth.
// ──────────────────────────────────────────────────────────────
const HEAD_IMG_SRC  = 'aleximg/IMG_7695.jpg';
const headCropX     = 590;   // face centered horizontally in the 1179px-wide image
const headCropY     = 850;   // slightly below midpoint — includes eyes + open mouth
const headCropScale = 18;    // 18 source px per canvas px → fills the head circle nicely
const HEAD_RADIUS   = 28;    // canvas radius of the circular head (px)

// ──────────────────────────────────────────────────────────────
// ITEM DEFINITIONS
// w = spawn weight (higher = more frequent)
// ──────────────────────────────────────────────────────────────
const ITEM_DEFS = [
  // ── GOOD: catch these for points ──
  { kind: 'good', emoji: '🏅', label: 'Medal',   pts:  25, w: 3 },
  { kind: 'good', emoji: '👟', label: 'Sneaker',  pts:  20, w: 4 },
  { kind: 'good', emoji: '💧', label: 'Water',    pts:  15, w: 5 },
  { kind: 'good', emoji: '⭐', label: 'Star',     pts:  20, w: 4 },
  { kind: 'good', emoji: '☕', label: 'Coffee',   pts:  10, w: 6 },
  { kind: 'good', emoji: '🎖️', label: 'Badge',   pts:  30, w: 2 },
  // ── BAD: dodge these ──
  { kind: 'bad',  emoji: '🍔', label: 'Burger',   pts: -15, w: 4 },
  { kind: 'bad',  emoji: '🍟', label: 'Fries',    pts: -10, w: 4 },
  { kind: 'bad',  emoji: '🍕', label: 'Pizza',    pts: -10, w: 3 },
  { kind: 'bad',  emoji: '🛋️', label: 'Couch',   pts: -20, w: 2 },
  { kind: 'bad',  emoji: '🥱', label: 'Yawn',     pts:  -5, w: 5 },
];

// Weighted pool for random selection
const ITEM_POOL = ITEM_DEFS.flatMap(d => Array(d.w).fill(d));

// ──────────────────────────────────────────────────────────────
// FUNNY CATCH MESSAGES
// ──────────────────────────────────────────────────────────────
const MSGS = {
  good: [
    'Chair Force maneuver complete!',
    'Hydration bonus unlocked!',
    'Elite sidestep detected!',
    'Runway cleared for snack landing!',
    'Precision catch certified!',
    'Air Force reflexes: activated!',
    'Outstanding! Probably.',
    'Snack radar: OFFLINE. Good catch!',
    'Tactical excellence in motion.',
    'The couch didn\'t see that coming.',
  ],
  bad: [
    'Burger intercepted. Risky strategy.',
    'Snack radar activated… too late.',
    'Distraction successfully obtained.',
    'The couch called. You answered.',
    'Strategic nap loading…',
    'Sir, this is a Wendy\'s.',
    'Caloric mission: compromised.',
    'The burger wins this round.',
    'Training delayed. Indefinitely.',
  ],
};

// ──────────────────────────────────────────────────────────────
// CANVAS & CONTEXT
// ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// Set internal (logical) resolution
canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;

// Scale the CSS display size to fit the viewport while keeping aspect ratio.
// The internal CANVAS_W × CANVAS_H stays fixed, so game coordinates never change.
function resizeCanvas() {
  const maxW  = Math.min(window.innerWidth - 20, CANVAS_W);
  const scale = maxW / CANVAS_W;
  canvas.style.width  = maxW + 'px';
  canvas.style.height = Math.round(CANVAS_H * scale) + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ──────────────────────────────────────────────────────────────
// HEAD IMAGE
// ──────────────────────────────────────────────────────────────
const headImg     = new Image();
headImg.src       = HEAD_IMG_SRC;
let headImgReady  = false;
headImg.onload    = () => { headImgReady = true; };

// ──────────────────────────────────────────────────────────────
// GAME STATE
// ──────────────────────────────────────────────────────────────
// Possible values: 'start' | 'playing' | 'paused' | 'gameover'
let gameState  = 'start';
let score      = 0;
let highScore  = parseInt(localStorage.getItem('snackDashHS') || '0', 10);
let timeLeft   = GAME_DURATION;
let lastTime   = 0;       // timestamp of last frame (ms)
let animTime   = 0;       // total elapsed time (s) — for decorative animations
let elapsed    = 0;       // time played this round (s) — for difficulty
let spawnTimer = 0;       // countdown to next item spawn
let spawnRate  = 1.5;     // seconds between spawns (decreases → harder)
let fallSpeed  = 120;     // item fall speed px/s (increases → harder)
let newHighScore = false; // did the player beat their record this round?

// ──────────────────────────────────────────────────────────────
// PLAYER
// ──────────────────────────────────────────────────────────────
const player = {
  x:         CANVAS_W / 2,
  y:         CANVAS_H - 148,  // head center Y (feet land ~124px below)
  walkPhase: 0,               // 0–1, drives limb swing animation
  isMoving:  false,
  direction: 1,               // 1 = right, -1 = left
};

// ──────────────────────────────────────────────────────────────
// INPUT
// ──────────────────────────────────────────────────────────────
const keys = { left: false, right: false };

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;

  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    handleSpaceOrTap();
  }
  if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && gameState === 'playing') pauseGame();
  else if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && gameState === 'paused') resumeGame();
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});

function handleSpaceOrTap() {
  if      (gameState === 'start'    ) startGame();
  else if (gameState === 'gameover' ) startGame();
  else if (gameState === 'playing'  ) pauseGame();
  else if (gameState === 'paused'   ) resumeGame();
}

// Mobile touch controls — left / right buttons
const btnLeft  = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

function bindHold(btn, dir) {
  btn.addEventListener('touchstart',  (e) => { e.preventDefault(); keys[dir] = true;  }, { passive: false });
  btn.addEventListener('touchend',    (e) => { e.preventDefault(); keys[dir] = false; }, { passive: false });
  btn.addEventListener('touchcancel', (e) => { e.preventDefault(); keys[dir] = false; }, { passive: false });
  btn.addEventListener('mousedown',   () => { keys[dir] = true;  });
  btn.addEventListener('mouseup',     () => { keys[dir] = false; });
  btn.addEventListener('mouseleave',  () => { keys[dir] = false; });
}

bindHold(btnLeft,  'left');
bindHold(btnRight, 'right');

// Pause button (HTML, floats over canvas)
const pauseBtn = document.getElementById('pauseBtn');
pauseBtn.addEventListener('click', () => {
  if      (gameState === 'playing') pauseGame();
  else if (gameState === 'paused' ) resumeGame();
});

// Canvas tap / click — for start & restart buttons drawn on canvas
function handleCanvasTap(clientX, clientY) {
  const rect  = canvas.getBoundingClientRect();
  const sx    = CANVAS_W / rect.width;
  const sy    = CANVAS_H / rect.height;
  const cx    = (clientX - rect.left) * sx;
  const cy    = (clientY - rect.top)  * sy;

  if (gameState === 'start' || gameState === 'gameover') {
    // Big button is centered; detect hit by proximity to center-bottom area
    const btnY = CANVAS_H - 110;
    const btnH = 48;
    const btnW = 180;
    const btnX = CANVAS_W / 2 - btnW / 2;
    if (cx >= btnX && cx <= btnX + btnW && cy >= btnY && cy <= btnY + btnH) {
      startGame();
    }
  }
}

canvas.addEventListener('click',    (e) => handleCanvasTap(e.clientX, e.clientY));
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  handleCanvasTap(t.clientX, t.clientY);
}, { passive: false });

// ──────────────────────────────────────────────────────────────
// ITEMS  [ {x, y, emoji, kind, pts, vy, size} ]
// ──────────────────────────────────────────────────────────────
let items = [];

function spawnItem() {
  const def = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
  items.push({
    x:     30 + Math.random() * (CANVAS_W - 60),
    y:     -24,
    emoji: def.emoji,
    kind:  def.kind,
    pts:   def.pts,
    vy:    fallSpeed * (0.85 + Math.random() * 0.3),  // slight per-item variance
    size:  34,
  });
}

// ──────────────────────────────────────────────────────────────
// PARTICLES  [ {x, y, vx, vy, r, life, maxLife, color} ]
// ──────────────────────────────────────────────────────────────
let particles = [];

function spawnParticles(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 130;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 70,
      r:  2 + Math.random() * 4,
      life:    1,
      maxLife: 0.55 + Math.random() * 0.35,
      color,
    });
  }
}

// ──────────────────────────────────────────────────────────────
// FLOATING MESSAGES  [ {x, y, text, color, life, maxLife} ]
// ──────────────────────────────────────────────────────────────
let messages = [];

function spawnMessage(x, y, text, color) {
  // Clamp x so the message doesn't spill off-screen
  const clampedX = Math.max(80, Math.min(CANVAS_W - 80, x));
  messages.push({ x: clampedX, y, text, color, life: 1, maxLife: 1.9 });
}

// ──────────────────────────────────────────────────────────────
// BACKGROUND STARS (pre-generated once, never changed)
// ──────────────────────────────────────────────────────────────
const BG_STARS = Array.from({ length: 45 }, () => ({
  x: Math.random() * CANVAS_W,
  y: Math.random() * CANVAS_H * 0.68,
  r: 0.4 + Math.random() * 1.6,
  a: 0.15 + Math.random() * 0.5,
}));

// ──────────────────────────────────────────────────────────────
// DECORATIVE START-SCREEN ITEMS (animated rain behind the UI)
// ──────────────────────────────────────────────────────────────
const DECO_ITEMS = '🏅👟💧⭐☕🍔🍟⭐🏅💧'.split('').filter(Boolean);
// Actually build separate array:
const DECO_LIST = ['🏅','👟','💧','⭐','☕','🍔','🍟','⭐','🏅','💧','☕','🎖️'];
let decoRain = [];
function resetDecoRain() {
  decoRain = DECO_LIST.map((e, i) => ({
    emoji: e,
    x:     40 + (i / DECO_LIST.length) * (CANVAS_W - 80),
    y:     -40 - Math.random() * 300,
    vy:    40 + Math.random() * 40,
  }));
}
resetDecoRain();

// ──────────────────────────────────────────────────────────────
// GAME CONTROL FUNCTIONS
// ──────────────────────────────────────────────────────────────
function startGame() {
  score         = 0;
  timeLeft      = GAME_DURATION;
  elapsed       = 0;
  spawnTimer    = 0;
  spawnRate     = 1.5;
  fallSpeed     = 120;
  newHighScore  = false;
  items         = [];
  particles     = [];
  messages      = [];
  player.x      = CANVAS_W / 2;
  player.walkPhase  = 0;
  player.isMoving   = false;
  gameState     = 'playing';

  pauseBtn.style.display = 'flex';
  pauseBtn.textContent   = '⏸';
  pauseBtn.title         = 'Pause';
}

function pauseGame() {
  gameState            = 'paused';
  pauseBtn.textContent = '▶';
  pauseBtn.title       = 'Resume';
}

function resumeGame() {
  gameState            = 'playing';
  pauseBtn.textContent = '⏸';
  pauseBtn.title       = 'Pause';
  lastTime             = performance.now(); // prevent giant dt jump after pause
}

function endGame() {
  if (score > highScore) {
    highScore    = score;
    newHighScore = true;
    localStorage.setItem('snackDashHS', String(highScore));
  }
  gameState = 'gameover';
  pauseBtn.style.display = 'none';
  resetDecoRain(); // reset decorative rain for game-over screen
}

// ──────────────────────────────────────────────────────────────
// UPDATE
// ──────────────────────────────────────────────────────────────
function update(dt) {
  elapsed  += dt;
  timeLeft -= dt;

  if (timeLeft <= 0) {
    timeLeft = 0;
    endGame();
    return;
  }

  // ── Difficulty scaling (linear 0→1 over the round) ──
  const t   = Math.min(elapsed / GAME_DURATION, 1);
  spawnRate = 1.5  - t * 1.05;    // 1.5s → 0.45s
  fallSpeed = 120  + t * 200;     // 120  → 320 px/s

  // ── Player movement ──
  const movingLeft  = keys.left  && !keys.right;
  const movingRight = keys.right && !keys.left;
  const moving      = movingLeft || movingRight;

  if (movingLeft)  { player.x -= PLAYER_SPEED * dt; player.direction = -1; }
  if (movingRight) { player.x += PLAYER_SPEED * dt; player.direction =  1; }

  // Clamp to canvas bounds
  player.x = Math.max(HEAD_RADIUS + 5, Math.min(CANVAS_W - HEAD_RADIUS - 5, player.x));

  player.isMoving = moving;
  if (moving) player.walkPhase = (player.walkPhase + dt * 4.5) % 1;

  // ── Item spawning ──
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnItem();
    spawnTimer = spawnRate * (0.75 + Math.random() * 0.5);
  }

  // ── Item physics & collision ──
  // Catch zone: centered at torso (player.x, player.y + HEAD_RADIUS + 28)
  // Generous hitbox feels fair and fun on mobile.
  const catchCX = player.x;
  const catchCY = player.y + HEAD_RADIUS + 28;
  const catchHW = 38;   // half-width
  const catchHH = 32;   // half-height

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    item.y += item.vy * dt;

    const dx = Math.abs(item.x - catchCX);
    const dy = Math.abs(item.y - catchCY);

    if (dx < catchHW && dy < catchHH) {
      // Caught!
      score += item.pts;
      const color = item.kind === 'good' ? '#f5c518' : '#ff5533';
      spawnParticles(item.x, item.y, color);
      spawnMessage(
        item.x,
        item.y - 22,
        (item.pts >= 0 ? '+' : '') + item.pts + '  ' + rnd(MSGS[item.kind]),
        color
      );
      items.splice(i, 1);
      continue;
    }

    if (item.y > CANVAS_H + 40) items.splice(i, 1);
  }

  // ── Particles ──
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    p.vy   += 280 * dt;   // gravity
    p.life -= dt / p.maxLife;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // ── Floating messages ──
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    m.y    -= 48 * dt;
    m.life -= dt / m.maxLife;
    if (m.life <= 0) messages.splice(i, 1);
  }
}

// ──────────────────────────────────────────────────────────────
// DRAW — BACKGROUND
// ──────────────────────────────────────────────────────────────
function drawBackground() {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  sky.addColorStop(0,   '#080818');
  sky.addColorStop(0.72,'#0d1b2a');
  sky.addColorStop(1,   '#152515');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars
  BG_STARS.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.fill();
  });

  // Ground strip
  const groundY = CANVAS_H - 22;
  const ground  = ctx.createLinearGradient(0, groundY, 0, CANVAS_H);
  ground.addColorStop(0, '#2d5a27');
  ground.addColorStop(1, '#0e2b09');
  ctx.fillStyle = ground;
  ctx.fillRect(0, groundY, CANVAS_W, CANVAS_H - groundY);

  // Dashed track line
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([18, 18]);
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(CANVAS_W, groundY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────
// DRAW — CIRCULAR PHOTO HEAD
// ──────────────────────────────────────────────────────────────
function drawHead(x, y) {
  const r = HEAD_RADIUS;

  // Fallback skin-tone fill (shows briefly before image loads, or if it fails)
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#c8955a';
  ctx.fill();

  // Photo — clipped to circle
  if (headImgReady) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    // Map (headCropX, headCropY) in the source image to (x, y) on canvas.
    // Adjust headCropX / headCropY / headCropScale at the top of this file
    // to re-center the face if needed.
    ctx.drawImage(
      headImg,
      x - headCropX / headCropScale,          // dest left edge
      y - headCropY / headCropScale,           // dest top edge
      headImg.naturalWidth  / headCropScale,   // dest width
      headImg.naturalHeight / headCropScale    // dest height
    );

    ctx.restore();
  }

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(x, y, r + 5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,77,0,0.18)';
  ctx.lineWidth   = 8;
  ctx.stroke();

  // Crisp border ring
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#ff4d00';
  ctx.lineWidth   = 2.5;
  ctx.stroke();
}

// ──────────────────────────────────────────────────────────────
// DRAW — STICK FIGURE BODY
//
// x, y     = head center
// phase    = walk cycle 0–1
// isMoving = drives limb swing amplitude
// ──────────────────────────────────────────────────────────────
function drawBody(x, y, phase, isMoving) {
  const swing     = isMoving ? Math.sin(phase * Math.PI * 2) : 0;
  const shoulderY = y + HEAD_RADIUS + 8;   // top of torso
  const hipY      = shoulderY + 44;        // bottom of torso
  const armOriY   = shoulderY + 10;        // arm attachment point
  const armLen    = 26;                    // arm length
  const legLen    = 44;                    // leg length

  ctx.strokeStyle = '#e0d0c0';
  ctx.lineWidth   = 3.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  // Torso
  ctx.beginPath();
  ctx.moveTo(x, shoulderY);
  ctx.lineTo(x, hipY);
  ctx.stroke();

  // Left arm (swings forward when right leg swings forward)
  ctx.beginPath();
  ctx.moveTo(x, armOriY);
  ctx.lineTo(x - armLen * 0.6 + swing * 10, armOriY + armLen * 0.88);
  ctx.stroke();

  // Right arm (opposite swing)
  ctx.beginPath();
  ctx.moveTo(x, armOriY);
  ctx.lineTo(x + armLen * 0.6 - swing * 10, armOriY + armLen * 0.88);
  ctx.stroke();

  // Left leg
  const lFootX = x - 13 + swing * 17;
  const rFootX = x + 13 - swing * 17;
  const footY  = hipY + legLen;

  ctx.beginPath();
  ctx.moveTo(x, hipY);
  ctx.lineTo(lFootX, footY);
  ctx.stroke();

  // Right leg (opposite)
  ctx.beginPath();
  ctx.moveTo(x, hipY);
  ctx.lineTo(rFootX, footY);
  ctx.stroke();

  // Small shoes (filled ellipses)
  ctx.fillStyle = '#e0d0c0';
  ctx.beginPath();
  ctx.ellipse(lFootX, footY + 5, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(rFootX, footY + 5, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ──────────────────────────────────────────────────────────────
// DRAW — FALLING ITEMS
// ──────────────────────────────────────────────────────────────
function drawItems() {
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  items.forEach(item => {
    // Glow shadow: gold for good, red for bad
    ctx.shadowColor = item.kind === 'good'
      ? 'rgba(245,197,24,0.6)'
      : 'rgba(255,60,0,0.65)';
    ctx.shadowBlur  = 14;
    ctx.font        = `${item.size}px serif`;
    ctx.fillText(item.emoji, item.x, item.y);
  });
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
}

// ──────────────────────────────────────────────────────────────
// DRAW — PARTICLES
// ──────────────────────────────────────────────────────────────
function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.1, p.r * p.life), 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ──────────────────────────────────────────────────────────────
// DRAW — FLOATING MESSAGES
// ──────────────────────────────────────────────────────────────
function drawMessages() {
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = 'bold 12px "Segoe UI", sans-serif';

  messages.forEach(m => {
    const a = Math.min(m.life * 2, 1);
    ctx.globalAlpha = Math.max(0, a);
    // Drop shadow for readability over any background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(m.text, m.x + 1, m.y + 1);
    ctx.fillStyle = m.color;
    ctx.fillText(m.text, m.x, m.y);
  });
  ctx.globalAlpha = 1;
}

// ──────────────────────────────────────────────────────────────
// DRAW — HUD (score / timer / high score)
// ──────────────────────────────────────────────────────────────
function drawHUD() {
  const HUD_H = 50;
  const pad   = 14;

  // Semi-transparent panel
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);

  // Separator line
  ctx.strokeStyle = 'rgba(255,77,0,0.3)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, HUD_H);
  ctx.lineTo(CANVAS_W, HUD_H);
  ctx.stroke();

  ctx.textBaseline = 'middle';

  // High score (left)
  ctx.textAlign = 'left';
  ctx.font      = 'bold 13px "Segoe UI", sans-serif';
  ctx.fillStyle = '#f5c518';
  ctx.fillText(`🏆 ${highScore}`, pad, HUD_H / 2);

  // Current score (center)
  ctx.textAlign = 'center';
  ctx.font      = 'bold 24px "Segoe UI", sans-serif';
  ctx.fillStyle = score < 0 ? '#ff5533' : '#ffffff';
  ctx.fillText(score, CANVAS_W / 2, HUD_H / 2 - 3);

  ctx.font      = '9px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('SCORE', CANVAS_W / 2, HUD_H - 7);

  // Timer (right)
  const t = Math.ceil(timeLeft);
  ctx.textAlign = 'right';
  ctx.font      = `bold 18px "Segoe UI", sans-serif`;
  ctx.fillStyle = timeLeft <= 10 ? '#ff5533' : '#7ecfff';
  // Pulse text when time is low
  if (timeLeft <= 10 && Math.sin(animTime * 6) > 0) ctx.fillStyle = '#ff0000';
  ctx.fillText(`⏱ ${t}`, CANVAS_W - pad, HUD_H / 2);
}

// ──────────────────────────────────────────────────────────────
// DRAW — START SCREEN
// ──────────────────────────────────────────────────────────────
function drawStartScreen(dt) {
  drawBackground();

  // Animate the decorative item rain in the background
  updateAndDrawDecoRain(dt, 0.3);

  // Dark overlay
  ctx.fillStyle = 'rgba(6,6,18,0.72)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Idle player — bobs up and down gently
  const bob = Math.sin(animTime * 2.2) * 5;
  const px  = CANVAS_W / 2;
  const py  = CANVAS_H * 0.44 + bob;
  drawBody(px, py, animTime * 0.35 % 1, true);  // slow idle walk cycle
  drawHead(px, py);

  // Title
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.font      = `bold 30px "Segoe UI", sans-serif`;
  ctx.fillStyle = '#f5c518';
  ctx.shadowColor = 'rgba(245,197,24,0.5)';
  ctx.shadowBlur  = 20;
  ctx.fillText('🏃 STICK FIGURE', CANVAS_W / 2, 72);
  ctx.fillText('SNACK DASH', CANVAS_W / 2, 110);
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';

  ctx.font      = '12px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('feat. Alemayehu "Chair Force" Nigussie', CANVAS_W / 2, 138);

  // Instructions card
  const cardX = 52, cardY = CANVAS_H - 210, cardW = CANVAS_W - 104, cardH = 106;
  ctx.fillStyle   = 'rgba(255,255,255,0.06)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth   = 1;
  roundRect(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.stroke();

  ctx.font      = 'bold 12px "Segoe UI", sans-serif';
  ctx.fillStyle = '#7ecfff';
  ctx.fillText('← → or A/D to move', CANVAS_W / 2, cardY + 22);
  ctx.fillStyle = '#aaffaa';
  ctx.fillText('Catch 🏅 👟 💧 ⭐ ☕', CANVAS_W / 2, cardY + 46);
  ctx.fillStyle = '#ffaaaa';
  ctx.fillText('Dodge 🍔 🍟 🍕 🛋️ 🥱', CANVAS_W / 2, cardY + 68);
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.fillText('60 seconds on the clock. Go!', CANVAS_W / 2, cardY + 92);

  // Start button
  drawActionButton(CANVAS_W / 2 - 90, CANVAS_H - 110, 180, 48, '🔥 START GAME');

  // High score badge
  if (highScore > 0) {
    ctx.font      = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = '#f5c518';
    ctx.fillText(`Best: ${highScore}  ·  SPACE to start`, CANVAS_W / 2, CANVAS_H - 44);
  } else {
    ctx.font      = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillText('SPACE or tap START to play', CANVAS_W / 2, CANVAS_H - 44);
  }
}

// ──────────────────────────────────────────────────────────────
// DRAW — GAME-OVER SCREEN
// ──────────────────────────────────────────────────────────────
function drawGameOverScreen(dt) {
  drawBackground();
  updateAndDrawDecoRain(dt, 0.5);

  ctx.fillStyle = 'rgba(6,6,18,0.76)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Idle player (sagging posture — same idle walk)
  const bob = Math.sin(animTime * 1.6) * 3;
  drawBody(CANVAS_W / 2, CANVAS_H * 0.42 + bob, 0, false);
  drawHead(CANVAS_W / 2, CANVAS_H * 0.42 + bob);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.font      = 'bold 34px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ff4d00';
  ctx.shadowColor = 'rgba(255,77,0,0.55)';
  ctx.shadowBlur  = 18;
  ctx.fillText("TIME'S UP!", CANVAS_W / 2, 72);
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';

  ctx.font      = '13px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('The snack dash has concluded.', CANVAS_W / 2, 106);

  // Score panel
  const panX = 78, panY = 130, panW = CANVAS_W - 156, panH = 96;
  ctx.fillStyle = newHighScore ? 'rgba(245,197,24,0.1)' : 'rgba(255,255,255,0.06)';
  roundRect(ctx, panX, panY, panW, panH, 14);
  ctx.fill();
  ctx.strokeStyle = newHighScore ? 'rgba(245,197,24,0.45)' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth   = 1.5;
  roundRect(ctx, panX, panY, panW, panH, 14);
  ctx.stroke();

  ctx.font      = 'bold 44px "Segoe UI", sans-serif';
  ctx.fillStyle = score < 0 ? '#ff5533' : '#f5c518';
  ctx.fillText(score, CANVAS_W / 2, panY + 40);

  ctx.font      = '11px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.fillText('FINAL SCORE', CANVAS_W / 2, panY + 72);

  // New high score / previous best
  if (newHighScore) {
    ctx.font      = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = '#f5c518';
    ctx.fillText('⭐ NEW HIGH SCORE! ⭐', CANVAS_W / 2, panY + 112);
  } else {
    ctx.font      = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText(`Best: ${highScore}`, CANVAS_W / 2, panY + 112);
  }

  // Funny result commentary
  const verdict =
    score > 100 ? '"Certified Air Force precision. Outstanding."' :
    score > 60  ? '"Solid performance. The burgers were a setback."' :
    score > 20  ? '"The couch would be proud of your effort."' :
    score > 0   ? '"You tried. The snacks prevailed."' :
                  '"You have been claimed by the snack dimension."';

  ctx.font      = 'italic 12px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(verdict, CANVAS_W / 2, panY + 138);

  // Restart button
  drawActionButton(CANVAS_W / 2 - 90, CANVAS_H - 110, 180, 48, '🔄 PLAY AGAIN');

  ctx.font      = '11px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillText('SPACE or tap PLAY AGAIN', CANVAS_W / 2, CANVAS_H - 44);
}

// ──────────────────────────────────────────────────────────────
// DRAW — PAUSE OVERLAY
// ──────────────────────────────────────────────────────────────
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = 'bold 38px "Segoe UI", sans-serif';
  ctx.fillStyle    = '#ffffff';
  ctx.shadowColor  = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur   = 12;
  ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 18);
  ctx.shadowBlur   = 0;
  ctx.shadowColor  = 'transparent';

  ctx.font      = '15px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('SPACE or ▶ button to resume', CANVAS_W / 2, CANVAS_H / 2 + 24);
}

// ──────────────────────────────────────────────────────────────
// DRAW — FULL PLAY FRAME
// ──────────────────────────────────────────────────────────────
function drawPlayFrame() {
  drawBackground();
  drawItems();
  drawBody(player.x, player.y, player.walkPhase, player.isMoving);
  drawHead(player.x, player.y);
  drawParticles();
  drawMessages();
  drawHUD();
}

// ──────────────────────────────────────────────────────────────
// DECORATIVE RAIN (used on start + game-over screens)
// ──────────────────────────────────────────────────────────────
function updateAndDrawDecoRain(dt, alpha) {
  ctx.globalAlpha  = alpha;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = '28px serif';

  decoRain.forEach(item => {
    item.y += item.vy * dt;
    if (item.y > CANVAS_H + 40) item.y = -40 - Math.random() * 80;
    ctx.fillText(item.emoji, item.x, item.y);
  });

  ctx.globalAlpha = 1;
}

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

// Pick a random element from an array
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Draw a rounded-rect path (does not fill/stroke — caller does that)
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

// Draw a polished gradient button
function drawActionButton(x, y, w, h, label) {
  const r = h / 2;

  // Base gradient (dark-to-fire)
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#ff6620');
  g.addColorStop(1, '#cc2800');
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  // Shine highlight on top half
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, x + 2, y + 2, w - 4, h / 2 - 2, r - 2);
  ctx.fill();

  // Label
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = 'bold 16px "Segoe UI", sans-serif';
  ctx.fillStyle    = '#fff';
  ctx.fillText(label, x + w / 2, y + h / 2);
}

// ──────────────────────────────────────────────────────────────
// GAME LOOP
// ──────────────────────────────────────────────────────────────
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime  = timestamp;
  animTime += dt;

  switch (gameState) {
    case 'playing':
      update(dt);
      drawPlayFrame();
      break;
    case 'paused':
      drawPlayFrame();
      drawPauseOverlay();
      break;
    case 'start':
      drawStartScreen(dt);
      break;
    case 'gameover':
      drawGameOverScreen(dt);
      break;
  }

  requestAnimationFrame(gameLoop);
}

// ──────────────────────────────────────────────────────────────
// INIT — kick off the loop once the first frame timestamp arrives
// ──────────────────────────────────────────────────────────────
requestAnimationFrame((ts) => {
  lastTime = ts;
  requestAnimationFrame(gameLoop);
});
