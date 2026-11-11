// =============================================================
// campus.js — 3D tilt for the APU photo scene on login/register.
// Moves CSS variables only (no layout), throttled to one update per
// animation frame, and switched off for reduced-motion users.
// =============================================================
(function () {
  const tilt = document.querySelector('.campus-tilt');
  if (!tilt) return;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  let x = 0;
  let y = 0;
  let pending = false;
  const apply = () => {
    tilt.style.setProperty('--ry', `${(x * 3).toFixed(2)}deg`);
    tilt.style.setProperty('--rx', `${(-y * 2).toFixed(2)}deg`);
    pending = false;
  };
  window.addEventListener('pointermove', (e) => {
    x = e.clientX / innerWidth - 0.5;
    y = e.clientY / innerHeight - 0.5;
    if (!pending) { pending = true; requestAnimationFrame(apply); }
  }, { passive: true });
  // Phones: follow the device tilt gently if available (no permission prompt is triggered)
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    x = Math.max(-0.5, Math.min(0.5, e.gamma / 60));
    y = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 90));
    if (!pending) { pending = true; requestAnimationFrame(apply); }
  }, { passive: true });
})();
