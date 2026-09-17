// y2k-effects.js
// Y2K temasi aktifken fare hareketinde kalp/yildiz sparkle izi birakir.
// Diger temalarda tamamen pasif kalir, hicbir DOM elemani olusturmaz.

const SPARKLE_CHARS = ['✧', '★', '♡', '✦', '☆', '♥'];
const SPARKLE_COLORS = ['#ff5fb0', '#b28dff', '#ff8fcf', '#baf2ff', '#d6006f'];

let isY2kActive = false;
let lastSpawn = 0;
const SPAWN_INTERVAL_MS = 60; // throttle so we don't flood the DOM

const isY2kTheme = () => document.documentElement.getAttribute('data-theme') === 'y2k';

const spawnSparkle = (x, y) => {
    const el = document.createElement('span');
    el.className = 'y2k-sparkle';
    el.textContent = SPARKLE_CHARS[Math.floor(Math.random() * SPARKLE_CHARS.length)];
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
    document.body.appendChild(el);

    // Cleanup after the CSS animation finishes (0.9s, see theme-y2k.css)
    setTimeout(() => el.remove(), 950);
};

const handlePointerMove = (e) => {
    if (!isY2kActive) return;
    const now = performance.now();
    if (now - lastSpawn < SPAWN_INTERVAL_MS) return;
    lastSpawn = now;

    const point = e.touches && e.touches.length > 0 ? e.touches[0] : e;
    spawnSparkle(point.clientX, point.clientY);
};

const syncActiveState = () => {
    isY2kActive = isY2kTheme();
};

const init = () => {
    syncActiveState();
    document.addEventListener('mousemove', handlePointerMove, { passive: true });
    document.addEventListener('touchmove', handlePointerMove, { passive: true });
    document.addEventListener('themechange', syncActiveState);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
