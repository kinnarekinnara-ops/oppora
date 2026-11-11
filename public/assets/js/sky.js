// =============================================================
// sky.js — OPPORA night sky: 3D parallax starfield + drone show.
// One <canvas>, no libraries, ~60fps on phones.
//
//   const sky = OpporaSky.mount(canvas, {
//     stars: 320,                       // twinkling 3D stars (parallax)
//     drones: 260,                      // glowing drones (0 = stars only)
//     shapes: ['logo', 'OPPORA', 'APU', 'star'],
//     hold: 3600,                       // ms each formation is held
//     area: (w, h) => ({ x, y, w, h }), // where drones draw (CSS px)
//   });
//   await sky.warp(1300);  // hyperspace jump (used by the login transition)
//
// Performance: pauses when the tab is hidden or the canvas is off-screen,
// caps devicePixelRatio, pre-renders glow sprites, and respects
// prefers-reduced-motion (draws one still frame, no loop).
// =============================================================
(function () {
  const COLORS = {
    amber: '#FFB81C', coral: '#FF5A3C', leaf: '#22B573', lagoon: '#12B5CB', cream: '#FFF7EC', blush: '#FFD3C4',
  };
  const DRONE_MIX = ['amber', 'amber', 'amber', 'cream', 'cream', 'coral', 'lagoon', 'leaf', 'blush'];
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // Soft glow sprite per colour, drawn once and reused for every drone
  function glowSprite(hex, size = 48) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.1, rgba(hex, 1));
    grad.addColorStop(0.3, rgba(hex, 0.35));
    grad.addColorStop(1, rgba(hex, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  // ---------------- Formation shapes ----------------
  // Each draws white on a transparent canvas; we then sample lit pixels.
  const SHAPES = {
    logo(g, w, h) {
      // OPPORA "Orbit O": ring + core + tilted orbit + comet
      const R = Math.min(w, h) * 0.3;
      const cx = w / 2 - R * 0.12;
      const cy = h / 2 + R * 0.08;
      g.lineCap = 'round';
      g.lineWidth = R * 0.34;
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, cy, R * 0.28, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(cx, cy); g.rotate(-0.49);
      g.lineWidth = R * 0.13;
      g.beginPath(); g.ellipse(0, 0, R * 1.75, R * 0.56, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(R * 1.6, -R * 0.2, R * 0.27, 0, Math.PI * 2); g.fill();
      g.restore();
    },
    star(g, w, h) {
      const cx = w / 2; const cy = h / 2; const R = Math.min(w, h) * 0.42;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? R * 0.42 : R;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath(); g.fill();
    },
    heart(g, w, h) {
      const s = Math.min(w, h) / 2.4; const cx = w / 2; const cy = h / 2 - s * 0.15;
      g.beginPath();
      g.moveTo(cx, cy + s * 0.95);
      g.bezierCurveTo(cx - s * 1.55, cy - s * 0.1, cx - s * 0.65, cy - s * 1.05, cx, cy - s * 0.35);
      g.bezierCurveTo(cx + s * 0.65, cy - s * 1.05, cx + s * 1.55, cy - s * 0.1, cx, cy + s * 0.95);
      g.fill();
    },
    rocket(g, w, h) {
      const s = Math.min(w, h) / 2.2; const cx = w / 2; const cy = h / 2;
      g.save(); g.translate(cx, cy); g.rotate(0.6);
      g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 0.5, -s * 0.4, s * 0.32, s * 0.55); g.lineTo(-s * 0.32, s * 0.55); g.quadraticCurveTo(-s * 0.5, -s * 0.4, 0, -s); g.fill();
      g.beginPath(); g.moveTo(-s * 0.32, s * 0.2); g.lineTo(-s * 0.62, s * 0.75); g.lineTo(-s * 0.3, s * 0.55); g.fill();
      g.beginPath(); g.moveTo(s * 0.32, s * 0.2); g.lineTo(s * 0.62, s * 0.75); g.lineTo(s * 0.3, s * 0.55); g.fill();
      g.beginPath(); g.moveTo(-s * 0.18, s * 0.66); g.lineTo(0, s * 1.05); g.lineTo(s * 0.18, s * 0.66); g.fill();
      g.restore();
    },
  };

  function drawText(g, w, h, text) {
    let size = h * 0.62;
    const font = (px) => `800 ${px}px "Bricolage Grotesque", "Figtree", system-ui, sans-serif`;
    g.font = font(size);
    const width = g.measureText(text).width;
    if (width > w * 0.94) { size *= (w * 0.94) / width; g.font = font(size); }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + size * 0.04);
  }

  // Render a shape and pick `n` points from its lit pixels
  function sampleShape(name, w, h, n) {
    const scale = Math.min(1, 420 / Math.max(w, h)); // sample on a small canvas for speed
    const sw = Math.max(40, Math.round(w * scale));
    const sh = Math.max(30, Math.round(h * scale));
    const c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = g.strokeStyle = '#fff';
    if (SHAPES[name]) SHAPES[name](g, sw, sh);
    else drawText(g, sw, sh, name.replace(/^text:/, ''));
    const data = g.getImageData(0, 0, sw, sh).data;
    const pts = [];
    const step = Math.max(1, Math.floor(Math.sqrt((sw * sh) / (n * 9))));
    for (let y = 0; y < sh; y += step) {
      for (let x = 0; x < sw; x += step) {
        if (data[(y * sw + x) * 4 + 3] > 140) pts.push([x / scale, y / scale]);
      }
    }
    if (!pts.length) return Array.from({ length: n }, () => [w / 2, h / 2]);
    // Evenly spread selection so outlines stay crisp
    const out = [];
    const stride = pts.length / n;
    for (let i = 0; i < n; i++) {
      const p = pts[Math.floor(i * stride) % pts.length];
      const jitter = stride < 1 ? 2.5 : 0.6; // fewer pixels than drones → nudge duplicates apart
      out.push([p[0] + (Math.random() - 0.5) * jitter, p[1] + (Math.random() - 0.5) * jitter]);
    }
    return out;
  }

  // ---------------- The sky ----------------
  class Sky {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      const small = Math.min(window.innerWidth, window.innerHeight) < 600;
      this.opts = {
        stars: small ? 180 : 320,
        drones: small ? 150 : 260,
        shapes: ['logo', 'OPPORA', 'APU', 'star'],
        hold: 3600,
        speed: 0.018,
        parallax: true,
        area: (w, h) => ({ x: w * 0.1, y: h * 0.12, w: w * 0.8, h: h * 0.5 }),
        ...opts,
      };
      if (typeof opts.stars === 'number' && small) this.opts.stars = Math.round(opts.stars * 0.6);
      if (typeof opts.drones === 'number' && small) this.opts.drones = Math.round(opts.drones * 0.65);
      this.reduce = reduceMotion();
      this.sprites = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, glowSprite(v)]));
      this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      this.shapeCache = {};
      this.shapeIndex = 0;
      this.lastSwitch = 0;
      this.warpState = null;
      this.visible = true;
      this.running = false;
      this.t = 0;

      this.initStars();
      this.resize();
      this.initDrones();
      this.retarget(false);

      this.onResize = () => { this.resize(); this.retarget(true); if (this.reduce) this.frame(0); };
      this.onPointer = (e) => {
        const p = e.touches ? e.touches[0] : e;
        this.pointer.tx = (p.clientX / window.innerWidth) * 2 - 1;
        this.pointer.ty = (p.clientY / window.innerHeight) * 2 - 1;
      };
      this.onVisibility = () => (document.hidden ? this.stop() : this.start());
      window.addEventListener('resize', this.onResize);
      if (this.opts.parallax) window.addEventListener('pointermove', this.onPointer, { passive: true });
      document.addEventListener('visibilitychange', this.onVisibility);
      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; this.visible ? this.start() : this.stop(); });
        this.io.observe(canvas);
      }

      // Wait for the display font so text formations use Bricolage
      const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      Promise.race([ready, new Promise((r) => setTimeout(r, 900))]).then(() => {
        this.shapeCache = {};
        this.retarget(false);
        if (this.reduce) { this.snapDrones(); this.frame(0); } else this.start();
      });
      if (this.reduce) this.frame(0); else this.start();
    }

    // ---------- setup ----------
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      this.w = w; this.h = h;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.shapeCache = {};
    }

    initStars() {
      this.stars = Array.from({ length: this.opts.stars }, () => this.newStar(Math.random()));
    }

    newStar(z) {
      const r = Math.random();
      return {
        x: (Math.random() * 2 - 1) * 1.2,
        y: (Math.random() * 2 - 1) * 1.2,
        z: z || 1,
        pz: z || 1,
        tw: Math.random() * Math.PI * 2,
        sp: 0.6 + Math.random() * 2.2,
        c: r < 0.82 ? '#FFF7EC' : r < 0.9 ? '#FFB81C' : r < 0.96 ? '#12B5CB' : '#FFD3C4',
      };
    }

    initDrones() {
      const n = this.opts.drones;
      this.drones = Array.from({ length: n }, (_, i) => ({
        // Take off from the "ground" (below the skyline)
        x: this.w * (0.15 + Math.random() * 0.7),
        y: this.h + 20 + Math.random() * 120,
        vx: 0, vy: 0, tx: 0, ty: 0,
        k: 5 + Math.random() * 4,         // spring stiffness — varied so they arrive at different times
        ph: Math.random() * Math.PI * 2,
        color: DRONE_MIX[i % DRONE_MIX.length],
        size: 9 + Math.random() * 7,
        blink: Math.random() * 6,
      }));
    }

    area() {
      return this.opts.area(this.w, this.h);
    }

    targetsFor(name) {
      const a = this.area();
      const key = `${name}|${Math.round(a.w)}x${Math.round(a.h)}`;
      if (!this.shapeCache[key]) {
        this.shapeCache[key] = sampleShape(name, a.w, a.h, this.drones.length).map(([x, y]) => [x + a.x, y + a.y]);
      }
      return this.shapeCache[key];
    }

    // Assign targets by angle around the centre → drones swirl into the new shape instead of crossing chaotically
    retarget(keepIndex) {
      if (!this.drones.length || !this.opts.shapes.length) return;
      if (!keepIndex) this.lastSwitch = performance.now();
      const name = this.opts.shapes[this.shapeIndex % this.opts.shapes.length];
      const pts = this.targetsFor(name);
      const a = this.area();
      const cx = a.x + a.w / 2; const cy = a.y + a.h / 2;
      const ang = (x, y) => Math.atan2(y - cy, x - cx);
      const dIdx = this.drones.map((d, i) => [ang(d.x, d.y), i]).sort((p, q) => p[0] - q[0]);
      const tIdx = pts.map((p, i) => [ang(p[0], p[1]), i]).sort((p, q) => p[0] - q[0]);
      dIdx.forEach(([, di], j) => {
        const t = pts[tIdx[j][1]];
        this.drones[di].tx = t[0];
        this.drones[di].ty = t[1];
      });
    }

    snapDrones() {
      this.drones.forEach((d) => { d.x = d.tx; d.y = d.ty; d.vx = d.vy = 0; });
    }

    setShapes(shapes) {
      this.opts.shapes = shapes;
      this.shapeIndex = 0;
      this.retarget(false);
    }

    // ---------- loop ----------
    start() {
      if (this.running || this.reduce || document.hidden || !this.visible) return;
      this.running = true;
      this.prev = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        const dt = Math.min(0.05, (now - this.prev) / 1000);
        this.prev = now;
        this.frame(dt, now);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }

    frame(dt, now = performance.now()) {
      const { ctx, w, h } = this;
      this.t += dt;

      // Formation timer
      if (!this.warpState && this.opts.shapes.length > 1 && now - this.lastSwitch > this.opts.hold) {
        this.shapeIndex = (this.shapeIndex + 1) % this.opts.shapes.length;
        this.retarget(false);
      }

      // Warp progress (0 → 1)
      let warp = 0;
      if (this.warpState) {
        warp = Math.min(1, (now - this.warpState.t0) / this.warpState.ms);
        if (warp >= 1 && !this.warpState.done) { this.warpState.done = true; this.warpState.resolve(); }
      }
      const ease = warp * warp * (3 - 2 * warp);

      ctx.clearRect(0, 0, w, h);

      // ----- Stars (3D projected, parallax with pointer) -----
      this.pointer.x += (this.pointer.tx - this.pointer.x) * 0.04;
      this.pointer.y += (this.pointer.ty - this.pointer.y) * 0.04;
      const cx = w / 2; const cy = h / 2;
      const s = Math.max(w, h) * 0.5;
      const speed = this.opts.speed + ease * ease * 2.8;
      ctx.lineCap = 'round';
      for (const st of this.stars) {
        st.pz = st.z;
        st.z -= speed * dt;
        if (st.z <= 0.03) { Object.assign(st, this.newStar(1)); continue; }
        const px = this.pointer.x * 22 * (1 - st.z);
        const py = this.pointer.y * 16 * (1 - st.z);
        const x = cx + (st.x / st.z) * s + px;
        const y = cy + (st.y / st.z) * s + py;
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) { if (warp) Object.assign(st, this.newStar(1)); continue; }
        const depth = 1 - st.z;
        const twinkle = this.reduce ? 0.8 : 0.55 + 0.45 * Math.sin(this.t * st.sp + st.tw);
        const alpha = Math.min(1, (0.25 + depth * 0.9) * twinkle + ease);
        if (warp > 0.05) {
          const ox = cx + (st.x / st.pz) * s + px;
          const oy = cy + (st.y / st.pz) * s + py;
          ctx.strokeStyle = rgba(st.c, alpha);
          ctx.lineWidth = 0.6 + depth * 2.2;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x, y); ctx.stroke();
        } else {
          const r = 0.35 + depth * 1.5;
          ctx.fillStyle = rgba(st.c, alpha);
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      }

      // ----- Drones -----
      if (!this.drones.length) return;
      ctx.globalCompositeOperation = 'lighter';
      const portalR = Math.min(w, h) * (0.16 + ease * 1.4);
      const fade = 1 - Math.max(0, (warp - 0.55) / 0.45);
      this.drones.forEach((d, i) => {
        let tx = d.tx; let ty = d.ty;
        if (warp) {
          // Fly into a portal ring that expands past the screen edge
          const a = (i / this.drones.length) * Math.PI * 2 + ease * 2.4;
          tx = cx + Math.cos(a) * portalR;
          ty = cy + Math.sin(a) * portalR;
        } else {
          // Gentle hover wobble like real drones holding position
          tx += Math.sin(this.t * 1.3 + d.ph) * 1.4;
          ty += Math.cos(this.t * 1.1 + d.ph) * 1.4;
        }
        if (dt) {
          const k = warp ? 14 : d.k;
          d.vx += ((tx - d.x) * k - d.vx * 4.2) * dt;
          d.vy += ((ty - d.y) * k - d.vy * 4.2) * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
        }
        const pulse = 0.75 + 0.25 * Math.sin(this.t * 2.2 + d.blink);
        const size = d.size * (warp ? 1 + ease : pulse);
        ctx.globalAlpha = fade;
        ctx.drawImage(this.sprites[d.color], d.x - size / 2, d.y - size / 2, size, size);
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /** Hyperspace jump. Resolves when the warp finishes. */
    warp(ms = 1300) {
      if (this.reduce) return new Promise((r) => setTimeout(r, 200));
      this.start();
      return new Promise((resolve) => { this.warpState = { t0: performance.now(), ms, resolve, done: false }; });
    }

    destroy() {
      this.stop();
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('pointermove', this.onPointer);
      document.removeEventListener('visibilitychange', this.onVisibility);
      if (this.io) this.io.disconnect();
    }
  }

  window.OpporaSky = { mount: (canvas, opts) => new Sky(canvas, opts) };
})();
