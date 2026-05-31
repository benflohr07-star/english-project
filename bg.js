// bg.js — Animated canvas background
// Layer 1: ~60 floating particles (bounce off edges)
// Layer 2: 3 large gradient orbs on Lissajous paths
// Uses Page Visibility API to skip rendering when tab is hidden.
(function () {
  'use strict';

  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  let accTime = 0;     // time that only advances while the tab is visible
  let lastTs  = null;  // previous rAF timestamp (null = first visible frame)

  // ── Helpers ──────────────────────────────────────────────────────────────
  const rnd  = (a, b) => a + Math.random() * (b - a);
  const sign = ()     => Math.random() < 0.5 ? 1 : -1;

  /** Convert a 6-digit hex colour + alpha [0–1] → rgba() string */
  function rgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // ── Canvas resize ─────────────────────────────────────────────────────────
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    // Keep particles inside the new bounds
    for (const p of particles) {
      p.x = Math.min(p.x, W - p.r);
      p.y = Math.min(p.y, H - p.r);
    }
  }
  window.addEventListener('resize', resize, { passive: true });

  // ── Layer 1 — Particles ───────────────────────────────────────────────────
  const P_COLORS = ['#2563EB', '#7C3AED', '#ffffff'];

  // Initialise with placeholder positions; resize() will be called below
  const particles = Array.from({ length: 60 }, () => ({
    x:  0, y:  0,          // set after first resize()
    r:  rnd(1, 3),
    color:   P_COLORS[Math.floor(Math.random() * P_COLORS.length)],
    opacity: rnd(0.10, 0.30),
    vx: rnd(0.10, 0.40) * sign(),
    vy: rnd(0.10, 0.40) * sign(),
  }));

  // Spread particles across the initial viewport
  resize();                // sets W, H and clamps existing positions (all 0,0)
  for (const p of particles) { p.x = rnd(p.r, W - p.r); p.y = rnd(p.r, H - p.r); }

  /**
   * Advance particles by `dt` ms.
   * Movement is normalised to a 60 fps baseline so speed is frame-rate-independent.
   */
  function stepParticles(dt) {
    const s = dt / 16.667;
    for (const p of particles) {
      p.x += p.vx * s;
      p.y += p.vy * s;
      // Bounce off all four edges
      if (p.x - p.r < 0)  { p.x = p.r;     p.vx =  Math.abs(p.vx); }
      if (p.x + p.r > W)  { p.x = W - p.r; p.vx = -Math.abs(p.vx); }
      if (p.y - p.r < 0)  { p.y = p.r;     p.vy =  Math.abs(p.vy); }
      if (p.y + p.r > H)  { p.y = H - p.r; p.vy = -Math.abs(p.vy); }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Layer 2 — Gradient orbs ───────────────────────────────────────────────
  //
  // Each orb moves on a Lissajous-like path:
  //   x(t) = W/2  +  axFrac·W · cos(ωx·t + φx)
  //   y(t) = H/2  +  ayFrac·H · sin(ωy·t + φy)
  //
  // tx / ty = period in milliseconds for a full cycle on each axis.
  // Using different primes keeps the path non-repeating for a long time.
  //
  // "Taking 15–20 s to cross the screen" ≈ half-period ≈ tx/2.
  // tx = 30 000 ms → half-period 15 s, full amplitude = axFrac · W.
  //
  const ORB_DEFS = [
    { hex: '#1E40AF', r: 330, axFrac: 0.30, ayFrac: 0.28, tx: 28000, ty: 33000 },
    { hex: '#4C1D95', r: 290, axFrac: 0.34, ayFrac: 0.30, tx: 37000, ty: 22000 },
    { hex: '#0F766E', r: 310, axFrac: 0.27, ayFrac: 0.34, tx: 31000, ty: 27000 },
  ];

  const orbs = ORB_DEFS.map(def => ({
    hex:    def.hex,
    r:      def.r,
    axFrac: def.axFrac,
    ayFrac: def.ayFrac,
    wx: (2 * Math.PI) / def.tx,
    wy: (2 * Math.PI) / def.ty,
    px: rnd(0, Math.PI * 2),   // random starting phase so they don't cluster
    py: rnd(0, Math.PI * 2),
    x: 0, y: 0,
  }));

  function stepOrbs(t) {
    for (const o of orbs) {
      o.x = W / 2 + o.axFrac * W * Math.cos(o.wx * t + o.px);
      o.y = H / 2 + o.ayFrac * H * Math.sin(o.wy * t + o.py);
    }
  }

  function drawOrbs() {
    ctx.globalAlpha = 1;
    for (const o of orbs) {
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      // Opacity at centre ≈ 0.11, fades to 0 at radius edge
      g.addColorStop(0,    rgba(o.hex, 0.11));
      g.addColorStop(0.50, rgba(o.hex, 0.05));
      g.addColorStop(1,    rgba(o.hex, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Animation loop ────────────────────────────────────────────────────────
  function frame(ts) {
    requestAnimationFrame(frame);

    // ── Page Visibility API ───────────────────────────────────────────────
    // When the tab is hidden, browsers throttle rAF (or stop it entirely).
    // We reset lastTs so the orbs don't jump when the tab becomes visible again.
    if (document.hidden) {
      lastTs = null;
      return;        // skip all rendering
    }

    // dt: elapsed ms since last visible frame, capped at 50 ms to prevent
    // a large jump after the tab was briefly hidden.
    const dt = lastTs === null ? 0 : Math.min(ts - lastTs, 50);
    lastTs   = ts;
    accTime += dt;

    ctx.clearRect(0, 0, W, H);

    // Draw order: orbs first (bottom), particles on top
    stepOrbs(accTime);
    drawOrbs();

    stepParticles(dt);
    drawParticles();

    ctx.globalAlpha = 1; // always reset at the end
  }

  requestAnimationFrame(frame);
}());
