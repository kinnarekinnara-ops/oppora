// =============================================================
// transition.js — login → portal: "you become part of the OPPORA network"
//
// LEAVE (login / register page, ~1.35 s):
//   1. the login card slowly fades away
//   2. small golden stars appear around the screen
//   3. the stars connect into a constellation network
//   4. one bright star travels across the screen to a glowing point
// ARRIVE (portal, ~0.5 s):
//   5. the same constellation + glowing point are redrawn, and the
//      dashboard emerges from that point as a widening circle.
//
// The constellation comes from a seed saved in sessionStorage, so both
// pages draw exactly the same picture and the hand-over is seamless.
// Load this file in <head> so the cover is in place before first paint.
// =============================================================
(function () {
  var KEY = 'oppora:warp';
  var NAVY = '#0A1438';
  var html = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var arriving = null;

  try {
    var raw = sessionStorage.getItem(KEY);
    if (raw) {
      sessionStorage.removeItem(KEY);
      if (!reduce) {
        try { arriving = JSON.parse(raw); } catch (e) { arriving = {}; }
        if (!arriving || typeof arriving !== 'object') arriving = {};
        html.classList.add('oppora-arrive');
      }
    }
  } catch (e) { /* storage blocked: just skip the effect */ }

  // ---------- Shared constellation ----------
  function rng(seed) { // mulberry32
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function build(seed, w, h) {
    var r = rng(seed);
    var end = { x: w * 0.5, y: h * 0.46 };
    var stars = [];
    var cols = 8, rows = 5;
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        var x = (i + 0.15 + r() * 0.7) / cols * w;
        var y = (j + 0.15 + r() * 0.7) / rows * h;
        if (Math.hypot(x - end.x, y - end.y) < Math.min(w, h) * 0.12) continue; // keep the centre clear
        stars.push({ x: x, y: y, s: 1.2 + r() * 1.8, t: r(), tw: r() * 6.28 });
      }
    }
    // connect each star to its two nearest neighbours
    var edges = [], seen = {};
    stars.forEach(function (a, ai) {
      stars.map(function (b, bi) { return [bi, Math.hypot(a.x - b.x, a.y - b.y)]; })
        .sort(function (p, q) { return p[1] - q[1]; }).slice(1, 3)
        .forEach(function (p) {
          var k = Math.min(ai, p[0]) + '-' + Math.max(ai, p[0]);
          if (!seen[k]) { seen[k] = 1; edges.push([ai, p[0], r()]); }
        });
    });
    // the bright star's route: a far star → two stars along the way → the centre
    var startIdx = 0, best = -1;
    stars.forEach(function (s, i) { var d = Math.hypot(s.x - end.x, s.y - end.y) + (s.x < w * 0.3 ? 200 : 0); if (d > best) { best = d; startIdx = i; } });
    var a = stars[startIdx];
    var route = [{ x: a.x, y: a.y }];
    [0.38, 0.7].forEach(function (f) {
      var px = a.x + (end.x - a.x) * f, py = a.y + (end.y - a.y) * f, near = null, nd = 1e9;
      stars.forEach(function (s) { var d = Math.hypot(s.x - px, s.y - py); if (d < nd) { nd = d; near = s; } });
      route.push({ x: near.x, y: near.y });
    });
    route.push(end);
    return { stars: stars, edges: edges, route: route, end: end, w: w, h: h };
  }

  function canvasLayer(z) {
    var c = document.createElement('canvas');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    c.className = 'warp-canvas';
    c.style.zIndex = z;
    c.setAttribute('aria-hidden', 'true');
    var ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    return { el: c, ctx: ctx };
  }
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

  function glowDot(ctx, x, y, r, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, 'rgba(255,240,200,' + a + ')');
    g.addColorStop(0.25, 'rgba(255,196,77,' + a * 0.8 + ')');
    g.addColorStop(1, 'rgba(255,184,28,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(255,248,230,' + a + ')'; ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, 6.283); ctx.fill();
  }
  function pointOnRoute(route, t) {
    var lens = [], total = 0;
    for (var i = 1; i < route.length; i++) { var l = Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y); lens.push(l); total += l; }
    var d = t * total;
    for (var k = 0; k < lens.length; k++) {
      if (d <= lens[k] || k === lens.length - 1) {
        var f = lens[k] ? Math.min(1, d / lens[k]) : 1;
        return { x: route[k].x + (route[k + 1].x - route[k].x) * f, y: route[k].y + (route[k + 1].y - route[k].y) * f };
      }
      d -= lens[k];
    }
    return route[route.length - 1];
  }

  // Draws one frame. p = {wash, stars, lines, travel, flare, fade} each 0..1
  function draw(ctx, net, p, time) {
    var w = net.w, h = net.h;
    ctx.clearRect(0, 0, w, h);
    if (p.wash > 0) { ctx.globalAlpha = p.wash; ctx.fillStyle = NAVY; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    var fade = 1 - (p.fade || 0);
    // lines
    ctx.lineWidth = 1;
    net.edges.forEach(function (e) {
      var lt = clamp((p.lines - e[2] * 0.5) / 0.5);
      if (lt <= 0) return;
      var a = net.stars[e[0]], b = net.stars[e[1]];
      ctx.strokeStyle = 'rgba(255,205,110,' + 0.45 * fade + ')';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (b.x - a.x) * ease(lt), a.y + (b.y - a.y) * ease(lt)); ctx.stroke();
    });
    // stars
    net.stars.forEach(function (s) {
      var st = clamp((p.stars - s.t * 0.6) / 0.4);
      if (st <= 0) return;
      var tw = 0.75 + 0.25 * Math.sin(time / 260 + s.tw);
      glowDot(ctx, s.x, s.y, s.s * (0.4 + 0.6 * ease(st)), st * tw * fade);
    });
    // travelling star + trail
    if (p.travel > 0) {
      var t = ease(p.travel);
      for (var k = 14; k >= 0; k--) {
        var q = pointOnRoute(net.route, Math.max(0, t - k * 0.018));
        glowDot(ctx, q.x, q.y, 2.2 * (1 - k / 16), (1 - k / 15) * 0.7 * fade);
      }
      var head = pointOnRoute(net.route, t);
      glowDot(ctx, head.x, head.y, 4.5 + (p.flare || 0) * 5, fade);
    }
  }

  // ---------- LEAVE ----------
  function leave(url, opts) {
    opts = opts || {};
    var seed = (Math.random() * 1e9) | 0;
    try { sessionStorage.setItem(KEY, JSON.stringify({ seed: seed })); } catch (e) { /* ignore */ }
    if (reduce) { location.href = url; return; }

    if (opts.card) {
      opts.card.style.transition = 'opacity .5s ease, transform .6s ease, filter .5s ease';
      opts.card.style.opacity = '0';
      opts.card.style.transform = 'translateY(14px) scale(.96)';
      opts.card.style.filter = 'blur(4px)';
    }
    var layer = canvasLayer(3000);
    document.body.appendChild(layer.el);
    var net = build(seed, innerWidth, innerHeight);
    var t0 = performance.now(), TOTAL = 1350, gone = false;
    function frame(now) {
      var t = now - t0;
      draw(layer.ctx, net, {
        wash: ease(clamp((t - 100) / 800)),
        stars: clamp((t - 150) / 450),
        lines: clamp((t - 450) / 450),
        travel: clamp((t - 850) / 450),
        flare: clamp((t - 1250) / 100),
      }, now);
      if (t >= TOTAL && !gone) { gone = true; location.href = url; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    setTimeout(function () { if (!gone) { gone = true; location.href = url; } }, TOTAL + 800); // never strand the user
  }

  // ---------- ARRIVE ----------
  var layerIn = null, netIn = null, revealAt = 0, done = false;
  function mountArrival() {
    if (!arriving || layerIn || !document.body) return;
    layerIn = canvasLayer(3001);
    netIn = build(arriving.seed || 7, innerWidth, innerHeight);
    document.body.appendChild(layerIn.el);
    html.classList.add('oppora-arrive-canvas');
    requestAnimationFrame(arriveFrame);
  }
  function arriveFrame(now) {
    if (done) return;
    var ctx = layerIn.ctx, net = netIn;
    var pr = revealAt ? clamp((now - revealAt) / 520) : 0;
    draw(ctx, net, { wash: 1, stars: 1, lines: 1, travel: 1, flare: 1, fade: ease(pr) }, now);
    if (pr > 0) {
      // the dashboard emerges from the glowing point
      var R = Math.hypot(net.w, net.h) * ease(pr) + 1;
      var e = net.end;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      var g = ctx.createRadialGradient(e.x, e.y, R * 0.7, e.x, e.y, R);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, R, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(e.x, e.y, R * 0.7, 0, 6.283); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,200,90,' + (0.9 * (1 - pr)) + ')';
      ctx.lineWidth = 3; ctx.shadowColor = 'rgba(255,184,28,.9)'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(e.x, e.y, R * 0.84, 0, 6.283); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (pr >= 1) { finish(); return; }
    requestAnimationFrame(arriveFrame);
  }
  function finish() {
    done = true;
    if (layerIn) layerIn.el.remove();
    html.classList.remove('oppora-arrive', 'oppora-arrive-canvas');
  }
  if (arriving) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountArrival);
    else mountArrival();
  }

  var revealed = false;
  function reveal() {
    if (!arriving || revealed) return;
    revealed = true;
    mountArrival();
    // a short beat on the glowing point, then open
    setTimeout(function () { revealAt = performance.now(); }, 60);
    setTimeout(function () { if (!done) finish(); }, 1500); // safety
  }
  // Pages call OpporaTransition.reveal() once their navbar is drawn; this is the safety net
  if (arriving) setTimeout(reveal, 900);

  window.OpporaTransition = { leave: leave, reveal: reveal, isArriving: function () { return !!arriving; } };
})();
