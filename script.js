/* ============================================================
   THE UNOFFICIAL ALEMAYEHU NIGUSSIE ROAST MUSEUM
   script.js
   ============================================================ */

// ──────────────────────────────────────────────────────────────
// IMAGE DATA
// Update src/alt/caption here if filenames change
// ──────────────────────────────────────────────────────────────
const IMAGES = [
  {
    src: 'aleximg/IMG_7695.jpg',
    alt: 'Alemayehu looking distinguished and slightly suspicious',
    caption: '"The look of a man calculating optimal drive-thru queue strategy."'
  },
  {
    src: 'aleximg/IMG_7696.jpg',
    alt: 'Alemayehu exuding unearned confidence',
    caption: '"This is his \'I definitely meant to do that\' face."'
  },
  {
    src: 'aleximg/IMG_7697.jpg',
    alt: 'Alemayehu in peak form',
    caption: '"Moments before he declared the couch his \'home office\'."'
  },
  {
    src: 'aleximg/IMG_7698.jpg',
    alt: 'Alemayehu being suspiciously photogenic',
    caption: '"He asked for retakes until the lighting was \'correct.\' Four hours later…"'
  }
];

// ──────────────────────────────────────────────────────────────
// ROAST GENERATOR
// ──────────────────────────────────────────────────────────────
const ROASTS = [
  "Alemayehu doesn't take snack breaks. Snack breaks take Alemayehu.",
  "His strategic planning now mostly involves locating the nearest drive-thru.",
  "Once Air Force. Now Chair Force. The trajectory is remarkable.",
  "He doesn't walk into a room. He makes an entrance and negotiates with gravity.",
  "His burger loyalty program has him listed as next of kin.",
  "Sources say he once parallel-parked a shopping cart with military precision. Witnesses wept.",
  "He retired from the Air Force and the Air Force has been trying to recover ever since.",
  "His nap schedule is the most organized document he has ever produced.",
  "He can smell a Five Guys from two zip codes away. It's a gift. Maybe a curse.",
  "Alemayehu doesn't watch sports. He observes them tactically.",
  "His couch cushions have a permanent impression that could be used as evidence in court.",
  "He treats every meal like a mission briefing. The debrief happens in the car on the way home.",
  "Scientists have not yet been able to explain how he found the TV remote after three weeks. He will not share the method.",
  "He once rated a parking lot 4.5 stars on Google Maps. The lot had no idea.",
  "His official title is 'Retired,' but his passion project is fully funded.",
  "The man has a system. Nobody knows what the system is. Possibly not even him.",
  "He describes himself as 'between naps.' This has been going on for two years.",
  "The Air Force gave him discipline. Retirement gave him a Costco membership. He is thriving.",
  "He doesn't multitask. He single-tasks at maximum intensity, one burger at a time.",
  "His superpower: he can fall asleep in any chair within 90 seconds. Documented. Verified."
];

let roastCount = 0;
let lastRoastIndex = -1;

function generateRoast() {
  const output = document.getElementById('roast-output');
  const countEl = document.getElementById('roast-count');

  // Pick a roast that isn't the same as the last one
  let idx;
  do {
    idx = Math.floor(Math.random() * ROASTS.length);
  } while (idx === lastRoastIndex && ROASTS.length > 1);
  lastRoastIndex = idx;

  roastCount++;
  countEl.textContent = roastCount;

  // Animate out, swap text, animate in
  output.classList.remove('roast-text-enter', 'firing');
  void output.offsetWidth; // trigger reflow

  output.innerHTML = `<span class="roast-text-enter">${ROASTS[idx]}</span>`;
  output.classList.add('firing');

  // Remove firing glow after a moment
  clearTimeout(output._fireTimer);
  output._fireTimer = setTimeout(() => output.classList.remove('firing'), 1800);
}

// ──────────────────────────────────────────────────────────────
// LIGHTBOX
// ──────────────────────────────────────────────────────────────
let lightboxIndex = 0;

function openLightbox(index) {
  lightboxIndex = index;
  renderLightbox();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

function shiftLightbox(direction) {
  lightboxIndex = (lightboxIndex + direction + IMAGES.length) % IMAGES.length;
  renderLightbox();
}

function renderLightbox() {
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');
  const data = IMAGES[lightboxIndex];
  img.src = data.src;
  img.alt = data.alt;
  cap.textContent = data.caption;
}

// Keyboard navigation for lightbox
document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('lightbox');
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape')       closeLightbox();
  if (e.key === 'ArrowRight')   shiftLightbox(1);
  if (e.key === 'ArrowLeft')    shiftLightbox(-1);
});

// ──────────────────────────────────────────────────────────────
// SCROLL REVEAL
// ──────────────────────────────────────────────────────────────
function initScrollReveal() {
  const targets = document.querySelectorAll(
    '.about-card, .gallery-item, .timeline-card, .hof-card, .hero-quote, .roast-machine'
  );

  targets.forEach(el => el.classList.add('reveal'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger siblings slightly
        const siblings = [...entry.target.parentElement.children];
        const delay = siblings.indexOf(entry.target) * 80;
        setTimeout(() => entry.target.classList.add('visible'), delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  targets.forEach(el => observer.observe(el));
}

// ──────────────────────────────────────────────────────────────
// SMOOTH SCROLL for anchor buttons
// ──────────────────────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ──────────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
});
