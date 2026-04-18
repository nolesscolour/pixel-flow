"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ========================================================================
   NOISE
   ======================================================================== */
class SimplexNoise {
  constructor(seed) {
    if (seed === undefined) seed = Math.random();
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    this.p = [];
    for (let i = 0; i < 256; i++) this.p[i] = Math.floor(seed * 256 + i * 131.7) & 255;
    this.perm = new Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
  }
  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = x - X0, y0 = y - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const dot = (g, x, y) => g[0] * x + g[1] * y;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * dot(this.grad3[this.perm[ii + this.perm[jj]] % 12], x0, y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * dot(this.grad3[this.perm[ii + i1 + this.perm[jj + j1]] % 12], x1, y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * dot(this.grad3[this.perm[ii + 1 + this.perm[jj + 1]] % 12], x2, y2); }
    return 70 * (n0 + n1 + n2);
  }
  noise3D(x, y, z) {
    return (this.noise2D(x, y) + this.noise2D(y + 31.416, z)) * 0.5;
  }
}

/* ========================================================================
   COLOR (HSL)
   ======================================================================== */
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgba(h, s, l, a) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return "rgba(" + Math.round((r + m) * 255) + "," + Math.round((g + m) * 255) + "," + Math.round((b + m) * 255) + "," + a + ")";
}

function sampleHsl(paletteHsl, t) {
  const n = paletteHsl.length;
  const pos = ((t % 1) + 1) % 1 * n;
  const i0 = Math.floor(pos) % n;
  const i1 = (i0 + 1) % n;
  const f = pos - Math.floor(pos);
  const a = paletteHsl[i0];
  const b = paletteHsl[i1];
  let dh = b[0] - a[0];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return [a[0] + dh * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function drawRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, rr);
  } else {
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}

/* ========================================================================
   PALETTES
   ======================================================================== */
const PALETTES = {
  "Dusk":   { hex: ["#7B2D8E", "#9B4DCA", "#E8735A", "#F4A261", "#F28482", "#D4A5FF"], bg: "#0A0714" },
  "Cyber":  { hex: ["#00F5FF", "#FF006E", "#8338EC", "#3A86FF", "#FFBE0B", "#00FF87"], bg: "#05050A" },
  "Ocean":  { hex: ["#023E8A", "#0077B6", "#00B4D8", "#48CAE4", "#90E0EF", "#CAF0F8"], bg: "#020A14" },
  "Ember":  { hex: ["#E63946", "#FF4500", "#FF6B35", "#F7C948", "#FFB703", "#FF8C42"], bg: "#140300" },
  "Moss":   { hex: ["#1B4332", "#2D6A4F", "#40916C", "#52B788", "#95D5B2", "#B7E4C7"], bg: "#040D08" },
  "Mono":   { hex: ["#FAFAFA", "#D0D0D0", "#A0A0A0", "#707070", "#E0E0E0", "#BDBDBD"], bg: "#050505" }
};
const PALETTE_NAMES = Object.keys(PALETTES);
PALETTE_NAMES.forEach(function (name) {
  PALETTES[name].hsl = PALETTES[name].hex.map(hexToHsl);
});

const FLOW_NAMES = ["Waves", "Spiral", "Rain", "Breathe", "Chaos"];
const INTERACTION_NAMES = ["Ripple", "Scatter", "Bloom", "Magnet", "Glow"];
const RENDER_NAMES = ["Grid", "Stipple", "Hybrid"];

// Fast deterministic pseudo-random from integer coords (for stable stipple positions)
function hash2(a, b) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/* ========================================================================
   CODE GENERATION TEMPLATES
   Used by the "Download Code Component" feature. Each snippet contains
   ONLY the logic for one mode; the generator stitches together a
   self-contained JSX file with just the selected combo baked in.
   ======================================================================== */

const FLOW_TEMPLATES = {
  "Waves": `          const waveY = Math.sin(row * 0.25 + t * 1.2);
          const waveX = Math.sin(col * 0.1 + t * 0.7 + row * 0.15);
          scale = 0.35 + (waveY * 0.5 + 0.5) * 0.95;
          colorT = row * 0.04 - t * 0.12 + waveX * 0.12;
          offX = Math.sin(row * 0.35 + t * 1.3) * 10;
          offY = Math.cos(col * 0.2 + t * 0.9) * 5;`,
  "Spiral": `          const dxC = origX - cx, dyC = origY - cy;
          const dist = Math.hypot(dxC, dyC);
          const ang = Math.atan2(dyC, dxC);
          const armPhase = ang * 3 + dist * 0.028 - t * 1.6;
          const armFactor = Math.sin(armPhase) * 0.5 + 0.5;
          scale = 0.22 + armFactor * 1.1;
          colorT = ang / (Math.PI * 2) + dist * 0.0015 - t * 0.1;
          const rot = 9 * Math.sin(t * 1.2 + dist * 0.008);
          offX = -Math.sin(ang) * rot;
          offY = Math.cos(ang) * rot;`,
  "Rain": `          const colSpeed = 1 + Math.abs(noise.noise2D(col * 0.17, 0)) * 1.8;
          const colOff = noise.noise2D(col * 0.33, 5) * 400;
          const dropY = ((t * 220 * colSpeed + colOff) % (h + 300)) - 150;
          const distToDrop = origY - dropY;
          let streak = 0;
          if (distToDrop > 0 && distToDrop < 180) {
            const f = 1 - distToDrop / 180;
            streak = f * f * (3 - 2 * f);
          } else if (distToDrop > -20 && distToDrop <= 0) {
            streak = 1 + distToDrop / 20;
          }
          scale = 0.18 + streak * 1.15;
          colorT = col * 0.05 + t * 0.08 + streak * 0.35;
          offX = noise.noise2D(col * 0.1, t * 0.2) * 3;`,
  "Breathe": `          const dxC = origX - cx, dyC = origY - cy;
          const dist = Math.hypot(dxC, dyC);
          const distNorm = dist / maxDist;
          const breath = Math.sin(t * 1.1) * 0.5 + 0.5;
          const ringPhase = dist * 0.015 - t * 2.5;
          const ring = Math.sin(ringPhase) * 0.5 + 0.5;
          scale = 0.22 + breath * 0.35 + ring * 0.75;
          colorT = distNorm * 0.7 + breath * 0.3 + t * 0.03;
          const pulse = 7 * breath * Math.sin(t * 2);
          const dd = dist || 1;
          offX = (dxC / dd) * pulse;
          offY = (dyC / dd) * pulse;`,
  "Chaos": `          const n1 = noise.noise3D(col * 0.13, row * 0.13, t * 0.4);
          const n2 = noise.noise2D(col * 0.08 + t * 0.35, row * 0.08 - t * 0.25);
          colorT = n1 * 0.8 + t * 0.04;
          scale = 0.2 + (n2 * 0.5 + 0.5) * 1.3;
          offX = noise.noise2D(col * 0.2 + t * 0.5, row * 0.2) * 22;
          offY = noise.noise2D(col * 0.2, row * 0.2 + t * 0.5) * 22;`
};

const INTERACTION_TEMPLATES = {
  "Ripple": `              const rip = Math.sin(md * 0.08 - t * 6);
              scale += rip * eased * 0.85;
              lightShift += rip * eased * 18;
              colorT += rip * eased * 0.18;`,
  "Scatter": `              const push = eased * 55;
              px += (mdx / dd) * push;
              py += (mdy / dd) * push;
              scale *= (1 + eased * 0.5);`,
  "Bloom": `              hueShift = eased * 180;
              lightShift = eased * 25;
              satShift = eased * 30;
              scale *= (1 + eased * 0.7);`,
  "Magnet": `              const pull = eased * 45;
              px -= (mdx / dd) * pull;
              py -= (mdy / dd) * pull;
              scale *= (1 + eased * 0.35);
              lightShift += eased * 12;`,
  "Glow": `              lightShift = eased * 42;
              satShift = eased * 15;
              scale *= (1 + eased * 0.28);`
};

const CLICK_BURST_TEMPLATES = {
  "Ripple": `                scale += eF * 1.0;
                colorT += eF * 0.25;
                lightShift += eF * 22;`,
  "Scatter": `                const push = eF * 90;
                px += (cdx / dd) * push;
                py += (cdy / dd) * push;
                scale += eF * 0.6;`,
  "Bloom": `                hueShift += eF * 220;
                lightShift += eF * 30;
                satShift += eF * 40;
                scale += eF * 0.9;`,
  "Magnet": `                const pull = eF * 65;
                px -= (cdx / dd) * pull;
                py -= (cdy / dd) * pull;
                scale += eF * 0.5;
                lightShift += eF * 15;`,
  "Glow": `                lightShift += eF * 55;
                satShift += eF * 20;
                scale += eF * 0.7;`
};

const RENDER_TEMPLATES = {
  "Grid": `          if (scale >= 0.05) {
            const size = PIXEL_SIZE * scale;
            const rad = Math.min(ROUNDNESS, size / 2);
            ctx.fillStyle = hslToRgba(finalH, finalS, finalL, 0.96);
            drawRoundRect(ctx, centerX - size/2, centerY - size/2, size, size, rad);
            ctx.fill();
            if (SHOW_DOT) {
              const dotSize = size * 0.2;
              ctx.fillStyle = hslToRgba(finalH, finalS * 0.85, Math.max(8, finalL - 28), 0.92);
              ctx.beginPath();
              ctx.arc(centerX, centerY, dotSize, 0, Math.PI * 2);
              ctx.fill();
            }
          }`,
  "Stipple": `          const density = Math.max(0, Math.min(1.35, scale));
          const dotCount = Math.min(4, Math.floor(density * 3.4));
          for (let di = 0; di < dotCount; di++) {
            const hx = hash2(col * 37 + di * 127, row * 53 + di * 311);
            const hy = hash2(col * 71 + di * 401, row * 89 + di * 653);
            const sizeVar = 0.85 + hash2(col + di * 7, row + di * 11) * 0.35;
            const dotBaseSize = PIXEL_SIZE * 0.46 * sizeVar;
            const spread = step * 0.95;
            const dx = centerX + (hx - 0.5) * spread;
            const dy = centerY + (hy - 0.5) * spread;
            const dotRad = Math.min(ROUNDNESS * 0.55, dotBaseSize / 2);
            ctx.fillStyle = hslToRgba(finalH, finalS, finalL, 0.94);
            drawRoundRect(ctx, dx - dotBaseSize/2, dy - dotBaseSize/2, dotBaseSize, dotBaseSize, dotRad);
            ctx.fill();
            if (SHOW_DOT && dotBaseSize > 4) {
              ctx.fillStyle = hslToRgba(finalH, finalS * 0.85, Math.max(8, finalL - 28), 0.88);
              ctx.beginPath();
              ctx.arc(dx, dy, dotBaseSize * 0.22, 0, Math.PI * 2);
              ctx.fill();
            }
          }`,
  "Hybrid": `          const gridScale = scale * 0.72;
          if (gridScale >= 0.05) {
            const size = PIXEL_SIZE * gridScale;
            const rad = Math.min(ROUNDNESS, size / 2);
            ctx.fillStyle = hslToRgba(finalH, finalS, finalL, 0.55);
            drawRoundRect(ctx, centerX - size/2, centerY - size/2, size, size, rad);
            ctx.fill();
            if (SHOW_DOT) {
              ctx.fillStyle = hslToRgba(finalH, finalS * 0.85, Math.max(8, finalL - 28), 0.5);
              ctx.beginPath();
              ctx.arc(centerX, centerY, size * 0.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          const density = Math.max(0, Math.min(1.35, scale));
          const dotCount = Math.min(2, Math.floor(density * 2.0));
          for (let di = 0; di < dotCount; di++) {
            const hx = hash2(col * 37 + di * 127, row * 53 + di * 311);
            const hy = hash2(col * 71 + di * 401, row * 89 + di * 653);
            const sizeVar = 0.85 + hash2(col + di * 7, row + di * 11) * 0.35;
            const dotBaseSize = PIXEL_SIZE * 0.4 * sizeVar;
            const dx = centerX + (hx - 0.5) * step * 0.95;
            const dy = centerY + (hy - 0.5) * step * 0.95;
            const dotRad = Math.min(ROUNDNESS * 0.55, dotBaseSize / 2);
            ctx.fillStyle = hslToRgba(finalH, finalS, finalL, 0.94);
            drawRoundRect(ctx, dx - dotBaseSize/2, dy - dotBaseSize/2, dotBaseSize, dotBaseSize, dotRad);
            ctx.fill();
          }`
};

function generateFramerComponent(opts) {
  const pal = PALETTES[opts.palette];
  const flowCode = FLOW_TEMPLATES[opts.flowMode];
  const renderCode = RENDER_TEMPLATES[opts.renderMode];
  const needsHash = opts.renderMode !== "Grid";
  const cursor = opts.cursor;
  const interactionCode = cursor ? INTERACTION_TEMPLATES[opts.interaction] : "";
  const clickBurstCode = cursor ? CLICK_BURST_TEMPLATES[opts.interaction] : "";
  const autoRipple = cursor && opts.interaction === "Ripple";

  return `import { useEffect, useRef } from "react";

/* ============================================================================
   PIXEL FLOW · Generated Component
   ----------------------------------------------------------------------------
   Flow:     ${opts.flowMode}
   Render:   ${opts.renderMode}
   Palette:  ${opts.palette}
   Cursor:   ${cursor ? opts.interaction : "Disabled"}
   ----------------------------------------------------------------------------
   Drop this file into Framer (Code Components), Next.js, CRA, or any React
   project. The canvas fills 100% of its parent container.
   ============================================================================ */

// === Config (edit these to tweak) ===
const PALETTE_HSL = ${JSON.stringify(pal.hsl)};
const BG_COLOR = ${JSON.stringify(pal.bg)};
const PIXEL_SIZE = ${opts.pixelSize};
const GAP = ${opts.gap};
const ROUNDNESS = ${opts.roundness};
const SPEED = ${opts.speed};
const SHOW_DOT = ${opts.showDot};

// === Simplex noise ===
class SimplexNoise {
  constructor(seed) {
    if (seed === undefined) seed = Math.random();
    this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    this.p = [];
    for (let i = 0; i < 256; i++) this.p[i] = Math.floor(seed * 256 + i * 131.7) & 255;
    this.perm = new Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
  }
  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const tt = (i + j) * G2;
    const X0 = i - tt, Y0 = j - tt;
    const x0 = x - X0, y0 = y - Y0;
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const dot = (g, x, y) => g[0] * x + g[1] * y;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * dot(this.grad3[this.perm[ii + this.perm[jj]] % 12], x0, y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * dot(this.grad3[this.perm[ii + i1 + this.perm[jj + j1]] % 12], x1, y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * dot(this.grad3[this.perm[ii + 1 + this.perm[jj + 1]] % 12], x2, y2); }
    return 70 * (n0 + n1 + n2);
  }
  noise3D(x, y, z) { return (this.noise2D(x, y) + this.noise2D(y + 31.416, z)) * 0.5; }
}

// === HSL interpolation ===
function hslToRgba(h, s, l, a) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return "rgba(" + Math.round((r+m)*255) + "," + Math.round((g+m)*255) + "," + Math.round((b+m)*255) + "," + a + ")";
}

function sampleHsl(pal, t) {
  const n = pal.length;
  const pos = ((t % 1) + 1) % 1 * n;
  const i0 = Math.floor(pos) % n;
  const i1 = (i0 + 1) % n;
  const f = pos - Math.floor(pos);
  const a = pal[i0], b = pal[i1];
  let dh = b[0] - a[0];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return [a[0] + dh * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

${needsHash ? `function hash2(a, b) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
` : ""}
function drawRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, rr); }
  else {
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}

export default function PixelFlow() {
  const canvasRef = useRef(null);${cursor ? `
  const mouseRef = useRef({ x: -9999, y: -9999, active: false, clicks: [] });` : ""}

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const noise = new SimplexNoise();
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width || window.innerWidth;
      h = rect.height || window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
${cursor ? `
    const handleMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      mouseRef.current.x = touch.clientX - rect.left;
      mouseRef.current.y = touch.clientY - rect.top;
      mouseRef.current.active = true;
    };
    const handleLeave = () => { mouseRef.current.active = false; };
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      mouseRef.current.clicks.push({ x: touch.clientX - rect.left, y: touch.clientY - rect.top, time: timeRef });
    };
    const handleTouchStart = (e) => { if (e.cancelable) e.preventDefault(); handleMove(e); handleClick(e); };
    const handleTouchMove = (e) => { if (e.cancelable) e.preventDefault(); handleMove(e); };
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseleave", handleLeave);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleLeave);
` : ""}
    let timeRef = 0;
    let lastFrame = 0;
    const loadStart = performance.now();${autoRipple ? "\n    let lastAutoRipple = 0;" : ""}
    let raf;

    const draw = (now) => {
      if (!lastFrame) lastFrame = now;
      let dt = (now - lastFrame) / 1000;
      if (dt > 0.1) dt = 0.1;
      lastFrame = now;
      timeRef += dt * SPEED;
      const t = timeRef;
      const elapsed = (now - loadStart) / 1000;
      const step = PIXEL_SIZE + GAP;
      const cols = Math.ceil(w / step) + 1;
      const rows = Math.ceil(h / step) + 1;
      const cx = w / 2, cy = h / 2;
      const maxDist = Math.hypot(cx, cy);${cursor ? `
      const mouse = mouseRef.current;` : ""}${autoRipple ? `
      if (!mouse.active && now - lastAutoRipple > 3500) {
        mouse.clicks.push({
          x: cx + (Math.random() - 0.5) * w * 0.7,
          y: cy + (Math.random() - 0.5) * h * 0.7,
          time: t
        });
        lastAutoRipple = now;
      }` : ""}${cursor ? `
      mouse.clicks = mouse.clicks.filter(c => t - c.time < 3.5);` : ""}

      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, w, h);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const origX = col * step;
          const origY = row * step;
          let colorT = 0, scale = 0.7, offX = 0, offY = 0;

${flowCode}

          let px = origX + offX;
          let py = origY + offY;
          let hueShift = 0, lightShift = 0, satShift = 0;
${cursor ? `
          if (mouse.active) {
            const mdx = origX - mouse.x;
            const mdy = origY - mouse.y;
            const md = Math.hypot(mdx, mdy);
            const radius = 220;
            if (md < radius) {
              const f = 1 - md / radius;
              const eased = f * f;
              const dd = md || 1;
${interactionCode}
            }
          }

          for (let i = 0; i < mouse.clicks.length; i++) {
            const click = mouse.clicks[i];
            const cdx = origX - click.x, cdy = origY - click.y;
            const cd = Math.hypot(cdx, cdy);
            const age = t - click.time;
            const rippleR = age * 340;
            const rippleW = 110;
            const rDist = Math.abs(cd - rippleR);
            if (rDist < rippleW) {
              const fade = Math.max(0, 1 - age / 2.5);
              const ff = (1 - rDist / rippleW) * fade;
              const eF = ff * ff;
              const dd = cd || 1;
${clickBurstCode}
            }
          }
` : ""}
          const distC = Math.hypot(origX - cx, origY - cy) / maxDist;
          const activation = distC * 0.8 + 0.05;
          let loadProg = (elapsed - activation) / 0.35;
          if (loadProg < 0) loadProg = 0;
          if (loadProg > 1) loadProg = 1;
          loadProg = loadProg * loadProg * (3 - 2 * loadProg);
          scale *= loadProg;
          if (scale < 0.05) continue;

          const hsl = sampleHsl(PALETTE_HSL, colorT);
          const finalH = hsl[0] + hueShift;
          const finalS = Math.max(0, Math.min(100, hsl[1] + satShift));
          const finalL = Math.max(5, Math.min(88, hsl[2] + lightShift));
          const centerX = px + PIXEL_SIZE / 2;
          const centerY = py + PIXEL_SIZE / 2;

${renderCode}
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();${cursor ? `
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseleave", handleLeave);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleLeave);` : ""}
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        background: BG_COLOR,
        touchAction: "none"
      }}
    />
  );
}
`;
}

/* ========================================================================
   COMPONENT
   ======================================================================== */
export default function PixelVisualizer() {
  const [palette, setPalette] = useState("Dusk");
  const [flowMode, setFlowMode] = useState("Waves");
  const [interaction, setInteraction] = useState("Ripple");
  const [pixelSize, setPixelSize] = useState(14);
  const [gap, setGap] = useState(3);
  const [roundness, setRoundness] = useState(4);
  const [speed, setSpeed] = useState(1);
  const [renderMode, setRenderMode] = useState("Grid");
  const [showDot, setShowDot] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [codeCursor, setCodeCursor] = useState(true);

  const canvasRef = useRef(null);
  const noiseRef = useRef(new SimplexNoise());
  const mouseRef = useRef({ x: -9999, y: -9999, active: false, clicks: [] });
  const stateRef = useRef({
    palette: "Dusk", flowMode: "Waves", interaction: "Ripple",
    pixelSize: 14, gap: 3, roundness: 4, speed: 1,
    renderMode: "Grid", showDot: true
  });
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const loadStartRef = useRef(0);
  const lastAutoRippleRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(function () {
    stateRef.current.palette = palette;
    stateRef.current.flowMode = flowMode;
    stateRef.current.interaction = interaction;
    stateRef.current.pixelSize = pixelSize;
    stateRef.current.gap = gap;
    stateRef.current.roundness = roundness;
    stateRef.current.speed = speed;
    stateRef.current.renderMode = renderMode;
    stateRef.current.showDot = showDot;
  }, [palette, flowMode, interaction, pixelSize, gap, roundness, speed, renderMode, showDot]);

  useEffect(function () {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const noise = noiseRef.current;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = function () {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMove = function (e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      mouseRef.current.x = touch.clientX - rect.left;
      mouseRef.current.y = touch.clientY - rect.top;
      mouseRef.current.active = true;
    };
    const handleLeave = function () { mouseRef.current.active = false; };
    const handleClick = function (e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      mouseRef.current.clicks.push({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
        time: timeRef.current,
        mode: stateRef.current.interaction
      });
    };
    const handleTouchStart = function (e) {
      if (e.cancelable) e.preventDefault();
      handleMove(e);
      handleClick(e);
    };
    const handleTouchMove = function (e) {
      if (e.cancelable) e.preventDefault();
      handleMove(e);
    };

    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseleave", handleLeave);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleLeave);

    loadStartRef.current = performance.now();

    const draw = function (now) {
      if (!lastFrameRef.current) lastFrameRef.current = now;
      let dt = (now - lastFrameRef.current) / 1000;
      if (dt > 0.1) dt = 0.1;
      lastFrameRef.current = now;

      const s = stateRef.current;
      timeRef.current += dt * s.speed;
      const t = timeRef.current;

      const elapsed = (now - loadStartRef.current) / 1000;
      const pal = PALETTES[s.palette];
      const mouse = mouseRef.current;
      const step = s.pixelSize + s.gap;
      const cols = Math.ceil(w / step) + 1;
      const rows = Math.ceil(h / step) + 1;
      const cx = w / 2, cy = h / 2;
      const maxDist = Math.hypot(cx, cy);

      if (s.interaction === "Ripple" && !mouse.active) {
        if (now - lastAutoRippleRef.current > 3500) {
          mouse.clicks.push({
            x: cx + (Math.random() - 0.5) * w * 0.7,
            y: cy + (Math.random() - 0.5) * h * 0.7,
            time: t,
            mode: "Ripple"
          });
          lastAutoRippleRef.current = now;
        }
      }

      mouse.clicks = mouse.clicks.filter(function (c) { return t - c.time < 3.5; });

      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, w, h);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const origX = col * step;
          const origY = row * step;

          let colorT = 0;
          let scale = 0.7;
          let offX = 0, offY = 0;

          // ====== FLOW MODES ======
          if (s.flowMode === "Waves") {
            const waveY = Math.sin(row * 0.25 + t * 1.2);
            const waveX = Math.sin(col * 0.1 + t * 0.7 + row * 0.15);
            scale = 0.35 + (waveY * 0.5 + 0.5) * 0.95;
            colorT = row * 0.04 - t * 0.12 + waveX * 0.12;
            offX = Math.sin(row * 0.35 + t * 1.3) * 10;
            offY = Math.cos(col * 0.2 + t * 0.9) * 5;
          } else if (s.flowMode === "Spiral") {
            const dxC = origX - cx, dyC = origY - cy;
            const dist = Math.hypot(dxC, dyC);
            const ang = Math.atan2(dyC, dxC);
            const armPhase = ang * 3 + dist * 0.028 - t * 1.6;
            const armFactor = Math.sin(armPhase) * 0.5 + 0.5;
            scale = 0.22 + armFactor * 1.1;
            colorT = ang / (Math.PI * 2) + dist * 0.0015 - t * 0.1;
            const rot = 9 * Math.sin(t * 1.2 + dist * 0.008);
            offX = -Math.sin(ang) * rot;
            offY = Math.cos(ang) * rot;
          } else if (s.flowMode === "Rain") {
            const colSpeed = 1 + Math.abs(noise.noise2D(col * 0.17, 0)) * 1.8;
            const colOff = noise.noise2D(col * 0.33, 5) * 400;
            const dropY = ((t * 220 * colSpeed + colOff) % (h + 300)) - 150;
            const distToDrop = origY - dropY;
            let streak = 0;
            if (distToDrop > 0 && distToDrop < 180) {
              const f = 1 - distToDrop / 180;
              streak = f * f * (3 - 2 * f);
            } else if (distToDrop > -20 && distToDrop <= 0) {
              streak = 1 + distToDrop / 20;
            }
            scale = 0.18 + streak * 1.15;
            colorT = col * 0.05 + t * 0.08 + streak * 0.35;
            offX = noise.noise2D(col * 0.1, t * 0.2) * 3;
          } else if (s.flowMode === "Breathe") {
            const dxC = origX - cx, dyC = origY - cy;
            const dist = Math.hypot(dxC, dyC);
            const distNorm = dist / maxDist;
            const breath = Math.sin(t * 1.1) * 0.5 + 0.5;
            const ringPhase = dist * 0.015 - t * 2.5;
            const ring = Math.sin(ringPhase) * 0.5 + 0.5;
            scale = 0.22 + breath * 0.35 + ring * 0.75;
            colorT = distNorm * 0.7 + breath * 0.3 + t * 0.03;
            const pulse = 7 * breath * Math.sin(t * 2);
            const dd = dist || 1;
            offX = (dxC / dd) * pulse;
            offY = (dyC / dd) * pulse;
          } else if (s.flowMode === "Chaos") {
            const n1 = noise.noise3D(col * 0.13, row * 0.13, t * 0.4);
            const n2 = noise.noise2D(col * 0.08 + t * 0.35, row * 0.08 - t * 0.25);
            colorT = n1 * 0.8 + t * 0.04;
            scale = 0.2 + (n2 * 0.5 + 0.5) * 1.3;
            offX = noise.noise2D(col * 0.2 + t * 0.5, row * 0.2) * 22;
            offY = noise.noise2D(col * 0.2, row * 0.2 + t * 0.5) * 22;
          }

          let px = origX + offX;
          let py = origY + offY;

          // ====== HOVER INTERACTION ======
          let hueShift = 0, lightShift = 0, satShift = 0;
          if (mouse.active) {
            const mdx = origX - mouse.x;
            const mdy = origY - mouse.y;
            const md = Math.hypot(mdx, mdy);
            const radius = 220;
            if (md < radius) {
              const f = 1 - md / radius;
              const eased = f * f;
              const dd = md || 1;
              if (s.interaction === "Ripple") {
                const rip = Math.sin(md * 0.08 - t * 6);
                scale += rip * eased * 0.85;
                lightShift += rip * eased * 18;
                colorT += rip * eased * 0.18;
              } else if (s.interaction === "Scatter") {
                const push = eased * 55;
                px += (mdx / dd) * push;
                py += (mdy / dd) * push;
                scale *= (1 + eased * 0.5);
              } else if (s.interaction === "Bloom") {
                hueShift = eased * 180;
                lightShift = eased * 25;
                satShift = eased * 30;
                scale *= (1 + eased * 0.7);
              } else if (s.interaction === "Magnet") {
                const pull = eased * 45;
                px -= (mdx / dd) * pull;
                py -= (mdy / dd) * pull;
                scale *= (1 + eased * 0.35);
                lightShift += eased * 12;
              } else if (s.interaction === "Glow") {
                lightShift = eased * 42;
                satShift = eased * 15;
                scale *= (1 + eased * 0.28);
              }
            }
          }

          // ====== CLICK BURSTS ======
          for (let i = 0; i < mouse.clicks.length; i++) {
            const click = mouse.clicks[i];
            const cdx = origX - click.x, cdy = origY - click.y;
            const cd = Math.hypot(cdx, cdy);
            const age = t - click.time;
            const rippleR = age * 340;
            const rippleW = 110;
            const rDist = Math.abs(cd - rippleR);
            if (rDist < rippleW) {
              const fade = Math.max(0, 1 - age / 2.5);
              const f = (1 - rDist / rippleW) * fade;
              const eF = f * f;
              const dd = cd || 1;
              if (click.mode === "Scatter") {
                const push = eF * 90;
                px += (cdx / dd) * push;
                py += (cdy / dd) * push;
                scale += eF * 0.6;
              } else if (click.mode === "Bloom") {
                hueShift += eF * 220;
                lightShift += eF * 30;
                satShift += eF * 40;
                scale += eF * 0.9;
              } else if (click.mode === "Magnet") {
                const pull = eF * 65;
                px -= (cdx / dd) * pull;
                py -= (cdy / dd) * pull;
                scale += eF * 0.5;
                lightShift += eF * 15;
              } else if (click.mode === "Glow") {
                lightShift += eF * 55;
                satShift += eF * 20;
                scale += eF * 0.7;
              } else {
                scale += eF * 1.0;
                colorT += eF * 0.25;
                lightShift += eF * 22;
              }
            }
          }

          // ====== LOAD CASCADE ======
          const distC = Math.hypot(origX - cx, origY - cy) / maxDist;
          const activation = distC * 0.8 + 0.05;
          let loadProg = (elapsed - activation) / 0.35;
          if (loadProg < 0) loadProg = 0;
          if (loadProg > 1) loadProg = 1;
          loadProg = loadProg * loadProg * (3 - 2 * loadProg);
          scale *= loadProg;

          if (scale < 0.05) continue;

          // ====== DRAW ======
          const hsl = sampleHsl(pal.hsl, colorT);
          const finalH = hsl[0] + hueShift;
          const finalS = Math.max(0, Math.min(100, hsl[1] + satShift));
          const finalL = Math.max(5, Math.min(88, hsl[2] + lightShift));

          const centerX = px + s.pixelSize / 2;
          const centerY = py + s.pixelSize / 2;
          const rm = s.renderMode;

          // Grid layer (Grid + Hybrid both render this)
          if (rm === "Grid" || rm === "Hybrid") {
            const gridScale = rm === "Hybrid" ? scale * 0.72 : scale;
            if (gridScale >= 0.05) {
              const size = s.pixelSize * gridScale;
              const rad = Math.min(s.roundness, size / 2);
              const rectX = centerX - size / 2;
              const rectY = centerY - size / 2;
              const gridAlpha = rm === "Hybrid" ? 0.55 : 0.96;

              ctx.fillStyle = hslToRgba(finalH, finalS, finalL, gridAlpha);
              drawRoundRect(ctx, rectX, rectY, size, size, rad);
              ctx.fill();

              if (s.showDot) {
                const dotSize = size * 0.2;
                const dotL = Math.max(8, finalL - 28);
                ctx.fillStyle = hslToRgba(finalH, finalS * 0.85, dotL, rm === "Hybrid" ? 0.5 : 0.92);
                ctx.beginPath();
                ctx.arc(centerX, centerY, dotSize, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }

          // Stipple layer (Stipple + Hybrid both render this)
          if (rm === "Stipple" || rm === "Hybrid") {
            const density = Math.max(0, Math.min(1.35, scale));
            const maxDots = rm === "Stipple" ? 4 : 2;
            const densityMult = rm === "Stipple" ? 3.4 : 2.0;
            const dotCount = Math.min(maxDots, Math.floor(density * densityMult));

            for (let di = 0; di < dotCount; di++) {
              const hx = hash2(col * 37 + di * 127, row * 53 + di * 311);
              const hy = hash2(col * 71 + di * 401, row * 89 + di * 653);
              const sizeVar = 0.85 + hash2(col + di * 7, row + di * 11) * 0.35;
              const dotBaseSize = s.pixelSize * (rm === "Stipple" ? 0.46 : 0.4) * sizeVar;
              const spread = step * 0.95;
              const dx = centerX + (hx - 0.5) * spread;
              const dy = centerY + (hy - 0.5) * spread;
              const dotRad = Math.min(s.roundness * 0.55, dotBaseSize / 2);

              ctx.fillStyle = hslToRgba(finalH, finalS, finalL, 0.94);
              drawRoundRect(ctx, dx - dotBaseSize / 2, dy - dotBaseSize / 2, dotBaseSize, dotBaseSize, dotRad);
              ctx.fill();

              if (s.showDot && dotBaseSize > 4) {
                const innerDotSize = dotBaseSize * 0.22;
                ctx.fillStyle = hslToRgba(finalH, finalS * 0.85, Math.max(8, finalL - 28), 0.88);
                ctx.beginPath();
                ctx.arc(dx, dy, innerDotSize, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return function () {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseleave", handleLeave);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleLeave);
    };
  }, []);

  const shuffle = useCallback(function () {
    setPalette(PALETTE_NAMES[Math.floor(Math.random() * PALETTE_NAMES.length)]);
    setFlowMode(FLOW_NAMES[Math.floor(Math.random() * FLOW_NAMES.length)]);
    setInteraction(INTERACTION_NAMES[Math.floor(Math.random() * INTERACTION_NAMES.length)]);
    const rm = RENDER_NAMES[Math.floor(Math.random() * RENDER_NAMES.length)];
    setRenderMode(rm);
    setShowDot(rm !== "Stipple");
  }, []);

  // Download current canvas frame as PNG
  const handleDownloadPNG = useCallback(function () {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "pixel-flow-" + palette.toLowerCase() + "-" + flowMode.toLowerCase() + "-" + Date.now() + ".png";
    link.href = url;
    link.click();
    setShowDownload(false);
  }, [palette, flowMode]);

  // Download a self-contained JSX component with current settings baked in
  const handleDownloadCode = useCallback(function () {
    const code = generateFramerComponent({
      palette: palette,
      flowMode: flowMode,
      interaction: interaction,
      renderMode: renderMode,
      showDot: showDot,
      pixelSize: pixelSize,
      gap: gap,
      roundness: roundness,
      speed: speed,
      cursor: codeCursor
    });
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "PixelFlow-" + palette + "-" + flowMode + (codeCursor ? "-Interactive" : "-Static") + ".jsx";
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setShowDownload(false);
  }, [palette, flowMode, interaction, renderMode, showDot, pixelSize, gap, roundness, speed, codeCursor]);

  const accentColor = PALETTES[palette].hex[0];
  const accentColor2 = PALETTES[palette].hex[2];

  return (
    <div className="pf-root">
      <canvas ref={canvasRef} className="pf-canvas" />

      <div className="pf-header">
        <div className="pf-wordmark">
          <div className="pf-wordmark-row">
            <span className="pf-wordmark-dot" style={{ background: accentColor }} />
            <span className="pf-wordmark-title">PIXEL FLOW</span>
          </div>
          <div className="pf-wordmark-sub">
            {flowMode.toUpperCase()} <span className="pf-sep">/</span> {interaction.toUpperCase()} <span className="pf-sep">/</span> {renderMode.toUpperCase()}
          </div>
        </div>
        <div className="pf-actions">
          <button onClick={function () { setShowInfo(true); }} className="pf-icon-btn" title="About" aria-label="About">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
          <button onClick={function () { setShowDownload(true); }} className="pf-icon-btn" title="Download" aria-label="Download">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button onClick={shuffle} className="pf-icon-btn" title="Shuffle" aria-label="Shuffle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
          </button>
          <button onClick={function () { setShowUI(!showUI); }} className="pf-icon-btn" title="Toggle UI" aria-label="Toggle UI">
            {showUI ? "×" : "≡"}
          </button>
        </div>
      </div>

      {showUI && (
        <div className="pf-controls">
          <div className="pf-section">
            <div className="pf-label">Palette</div>
            <div className="pf-row">
              {PALETTE_NAMES.map(function (name) {
                return (
                  <button
                    key={name}
                    onClick={function () { setPalette(name); }}
                    className={"pf-pill" + (palette === name ? " active" : "")}
                  >
                    <span className="pf-swatches">
                      {PALETTES[name].hex.slice(0, 4).map(function (c, i) {
                        return <span key={i} className="pf-swatch" style={{ background: c }} />;
                      })}
                    </span>
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pf-section">
            <div className="pf-label">Flow</div>
            <div className="pf-row">
              {FLOW_NAMES.map(function (name) {
                return (
                  <button
                    key={name}
                    onClick={function () { setFlowMode(name); }}
                    className={"pf-pill" + (flowMode === name ? " active" : "")}
                  >
                    <span className="pf-pixel" style={flowMode === name ? { background: accentColor, boxShadow: "0 0 10px " + accentColor } : {}} />
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pf-section">
            <div className="pf-label">Touch</div>
            <div className="pf-row">
              {INTERACTION_NAMES.map(function (name) {
                return (
                  <button
                    key={name}
                    onClick={function () { setInteraction(name); }}
                    className={"pf-pill" + (interaction === name ? " active" : "")}
                  >
                    <span className="pf-pixel" style={interaction === name ? { background: accentColor2, boxShadow: "0 0 10px " + accentColor2 } : {}} />
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pf-section">
            <div className="pf-label">Render</div>
            <div className="pf-row">
              {RENDER_NAMES.map(function (name) {
                return (
                  <button
                    key={name}
                    onClick={function () {
                      setRenderMode(name);
                      if (name === "Stipple") setShowDot(false);
                      else setShowDot(true);
                    }}
                    className={"pf-pill" + (renderMode === name ? " active" : "")}
                  >
                    <span className="pf-pixel" style={renderMode === name ? { background: accentColor, boxShadow: "0 0 10px " + accentColor } : {}} />
                    <span>{name}</span>
                  </button>
                );
              })}
              <button
                onClick={function () { setShowDot(!showDot); }}
                className={"pf-pill pf-pill-toggle" + (showDot ? " active" : "")}
                title="Toggle inner dot"
              >
                <span className="pf-pixel pf-pixel-small" style={showDot ? { background: accentColor2 } : {}} />
                <span>Dot</span>
              </button>
            </div>
          </div>

          <div className="pf-sliders">
            <SliderRow label="Size" value={pixelSize} min={6} max={28} step={1} onChange={setPixelSize} accent={accentColor} display={pixelSize.toString()} />
            <SliderRow label="Gap" value={gap} min={0} max={10} step={1} onChange={setGap} accent={accentColor} display={gap.toString()} />
            <SliderRow label="Round" value={roundness} min={0} max={14} step={1} onChange={setRoundness} accent={accentColor} display={roundness.toString()} />
            <SliderRow label="Speed" value={speed} min={0.2} max={3} step={0.1} onChange={setSpeed} accent={accentColor} display={speed.toFixed(1) + "\u00D7"} />
          </div>
        </div>
      )}

      {showInfo && (
        <div className="pf-modal-backdrop" onClick={function () { setShowInfo(false); }}>
          <div className="pf-modal" onClick={function (e) { e.stopPropagation(); }}>
            {/* =====================================================================
                EDIT YOUR INFO HERE
                Replace the placeholder values below with your own details.
                - pf-modal-title: the app/brand name
                - pf-modal-author: your name / handle
                - pf-modal-body <p>: short description / bio
                - pf-modal-links <a>: your social / contact URLs
                - pf-modal-foot: credits line
                ===================================================================== */}
            <div className="pf-modal-header">
              <div>
                <div className="pf-modal-title">PIXEL FLOW</div>
                <div className="pf-modal-author">v2.1 · by YOUR NAME</div>
              </div>
              <button onClick={function () { setShowInfo(false); }} className="pf-icon-btn" aria-label="Close">×</button>
            </div>

            <div className="pf-modal-body">
              <p>
                A generative pixel visualizer with interactive flow fields and
                stipple rendering. Drag to shape the flow, tap to burst.
              </p>

              <div className="pf-modal-row">
                <span className="pf-modal-label">Flow</span>
                <span className="pf-modal-value">5 modes · Waves, Spiral, Rain, Breathe, Chaos</span>
              </div>
              <div className="pf-modal-row">
                <span className="pf-modal-label">Touch</span>
                <span className="pf-modal-value">5 modes · Ripple, Scatter, Bloom, Magnet, Glow</span>
              </div>
              <div className="pf-modal-row">
                <span className="pf-modal-label">Render</span>
                <span className="pf-modal-value">Grid · Stipple · Hybrid</span>
              </div>

              <div className="pf-modal-links">
                <a href="https://twitter.com/YOUR_HANDLE" target="_blank" rel="noreferrer">Twitter</a>
                <a href="https://YOUR_WEBSITE.com" target="_blank" rel="noreferrer">Website</a>
                <a href="mailto:YOUR@EMAIL.com">Contact</a>
              </div>
            </div>

            <div className="pf-modal-foot">
              Inspired by Nigina's ASCII Graphic series.
            </div>
          </div>
        </div>
      )}

      {showDownload && (
        <div className="pf-modal-backdrop" onClick={function () { setShowDownload(false); }}>
          <div className="pf-modal" onClick={function (e) { e.stopPropagation(); }}>
            <div className="pf-modal-header">
              <div>
                <div className="pf-modal-title">DOWNLOAD</div>
                <div className="pf-modal-author">
                  {flowMode.toUpperCase()} · {renderMode.toUpperCase()} · {palette.toUpperCase()}
                </div>
              </div>
              <button onClick={function () { setShowDownload(false); }} className="pf-icon-btn" aria-label="Close">×</button>
            </div>

            <div className="pf-dl-card">
              <div className="pf-dl-card-head">
                <div className="pf-dl-card-title">Image</div>
                <div className="pf-dl-card-sub">Current frame · PNG</div>
              </div>
              <button onClick={handleDownloadPNG} className="pf-dl-btn">
                Download PNG
              </button>
            </div>

            <div className="pf-dl-card">
              <div className="pf-dl-card-head">
                <div className="pf-dl-card-title">Code Component</div>
                <div className="pf-dl-card-sub">Single-file JSX · Framer-ready</div>
              </div>
              <div className="pf-dl-toggle-label">Cursor Interaction</div>
              <div className="pf-dl-toggle-row">
                <button
                  onClick={function () { setCodeCursor(false); }}
                  className={"pf-dl-toggle" + (!codeCursor ? " active" : "")}
                >
                  Off
                </button>
                <button
                  onClick={function () { setCodeCursor(true); }}
                  className={"pf-dl-toggle" + (codeCursor ? " active" : "")}
                >
                  On · {interaction}
                </button>
              </div>
              <button onClick={handleDownloadCode} className="pf-dl-btn">
                Download JSX
              </button>
            </div>

            <div className="pf-modal-foot">
              Video loop export coming soon.
            </div>
          </div>
        </div>
      )}

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }

        .pf-root {
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #000;
          position: relative;
          font-family: var(--font-geist-sans), system-ui, -apple-system, sans-serif;
          -webkit-user-select: none;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .pf-canvas {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          cursor: crosshair;
          touch-action: none;
        }

        .pf-header {
          position: absolute;
          top: 12px; left: 12px; right: 12px;
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          pointer-events: none;
        }
        .pf-wordmark { pointer-events: none; }
        .pf-wordmark-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pf-wordmark-dot {
          width: 7px;
          height: 7px;
          border-radius: 2px;
          transition: background 0.4s;
        }
        .pf-wordmark-title {
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.95);
          letter-spacing: 0.14em;
        }
        .pf-wordmark-sub {
          margin-top: 4px;
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 9.5px;
          font-weight: 400;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.15em;
          padding-left: 15px;
        }
        .pf-sep { color: rgba(255,255,255,0.2); margin: 0 4px; }

        .pf-actions {
          display: flex;
          gap: 8px;
          pointer-events: auto;
        }
        .pf-icon-btn {
          background: rgba(15,15,20,0.7);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: all 0.2s;
          font-family: var(--font-geist-mono), ui-monospace, monospace;
        }
        .pf-icon-btn:hover {
          background: rgba(25,25,30,0.9);
          border-color: rgba(255,255,255,0.25);
          color: #fff;
        }
        .pf-icon-btn:active { transform: scale(0.94); }

        .pf-controls {
          position: absolute;
          bottom: 12px;
          left: 12px;
          right: 12px;
          z-index: 10;
          padding: 16px 16px 14px;
          background: rgba(10,10,14,0.72);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          backdrop-filter: blur(20px) saturate(1.2);
          -webkit-backdrop-filter: blur(20px) saturate(1.2);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset;
          display: flex;
          flex-direction: column;
          gap: 12px;
          animation: pfFadeUp 0.5s ease-out;
          max-height: calc(100vh - 100px);
          overflow-y: auto;
        }
        @keyframes pfFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .pf-section { display: flex; flex-direction: column; gap: 8px; }
        .pf-label {
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 9.5px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
        }
        .pf-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .pf-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px 7px 9px;
          border-radius: 8px;
          background: rgba(20,20,25,0.55);
          border: 1px solid rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.55);
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 10.5px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          white-space: nowrap;
        }
        .pf-pill:hover {
          border-color: rgba(255,255,255,0.18);
          color: rgba(255,255,255,0.85);
          background: rgba(30,30,35,0.7);
        }
        .pf-pill.active {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.4);
          color: #fff;
        }
        .pf-pill:active { transform: scale(0.97); }

        .pf-pixel {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          background: rgba(255,255,255,0.15);
          position: relative;
          transition: all 0.25s;
        }
        .pf-pixel::after {
          content: '';
          position: absolute;
          top: 50%; left: 50%;
          width: 3px; height: 3px;
          border-radius: 50%;
          background: rgba(0,0,0,0.35);
          transform: translate(-50%, -50%);
        }
        .pf-pixel-small {
          width: 8px;
          height: 8px;
        }
        .pf-pixel-small::after {
          width: 2px;
          height: 2px;
        }
        .pf-pill-toggle {
          margin-left: auto;
        }

        .pf-swatches {
          display: inline-flex;
          gap: 2px;
        }
        .pf-swatch {
          width: 5px;
          height: 11px;
          border-radius: 1.5px;
        }

        .pf-sliders {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 2px;
        }
        .pf-slider {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .pf-slider-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .pf-slider-value {
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 10px;
          font-weight: 500;
          color: rgba(255,255,255,0.85);
          letter-spacing: 0.04em;
        }
        .pf-slider input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 3px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .pf-slider input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(255,255,255,0.4);
          transition: transform 0.15s;
        }
        .pf-slider input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.3);
        }
        .pf-slider input[type="range"]::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
        }

        @media (max-width: 640px) {
          .pf-sliders { grid-template-columns: repeat(2, 1fr); }
          .pf-wordmark-sub { font-size: 8.5px; }
          .pf-pill { font-size: 10px; padding: 6px 10px 6px 8px; }
        }

        /* Modal */
        .pf-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: pfModalFade 0.25s ease-out;
        }
        @keyframes pfModalFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .pf-modal {
          width: 100%;
          max-width: 380px;
          background: rgba(14,14,18,0.92);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset;
          animation: pfModalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes pfModalSlide {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .pf-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .pf-modal-title {
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.14em;
          color: #fff;
        }
        .pf-modal-author {
          margin-top: 4px;
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.45);
        }
        .pf-modal-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pf-modal-body p {
          font-family: var(--font-geist-sans), system-ui, sans-serif;
          font-size: 13px;
          line-height: 1.55;
          color: rgba(255,255,255,0.78);
          margin-bottom: 4px;
        }
        .pf-modal-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          padding: 8px 0;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 10px;
        }
        .pf-modal-label {
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .pf-modal-value {
          color: rgba(255,255,255,0.8);
          text-align: right;
          letter-spacing: 0.04em;
        }
        .pf-modal-links {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .pf-modal-links a {
          display: inline-block;
          padding: 7px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.85);
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 10.5px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-decoration: none;
          transition: all 0.2s;
        }
        .pf-modal-links a:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.25);
        }
        .pf-modal-foot {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 9.5px;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.35);
          text-align: center;
        }

        /* Download cards */
        .pf-dl-card {
          margin-top: 10px;
          padding: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
        }
        .pf-dl-card-head {
          margin-bottom: 10px;
        }
        .pf-dl-card-title {
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 11.5px;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .pf-dl-card-sub {
          margin-top: 3px;
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 9.5px;
          color: rgba(255,255,255,0.45);
          letter-spacing: 0.08em;
        }
        .pf-dl-toggle-label {
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 9.5px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
          margin: 10px 0 6px;
        }
        .pf-dl-toggle-row {
          display: flex;
          gap: 6px;
          margin-bottom: 12px;
        }
        .pf-dl-toggle {
          flex: 1;
          padding: 8px 10px;
          background: rgba(20,20,25,0.55);
          border: 1px solid rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.55);
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 10.5px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pf-dl-toggle:hover {
          border-color: rgba(255,255,255,0.18);
          color: rgba(255,255,255,0.85);
        }
        .pf-dl-toggle.active {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.4);
          color: #fff;
        }
        .pf-dl-btn {
          width: 100%;
          padding: 11px 14px;
          background: #fff;
          color: #000;
          border: none;
          border-radius: 10px;
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pf-dl-btn:hover {
          background: rgba(255,255,255,0.92);
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(255,255,255,0.15);
        }
        .pf-dl-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}

function SliderRow(props) {
  return (
    <div className="pf-slider">
      <div className="pf-slider-head">
        <span className="pf-label">{props.label}</span>
        <span className="pf-slider-value">{props.display}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={function (e) { props.onChange(parseFloat(e.target.value)); }}
        style={{ accentColor: props.accent }}
      />
    </div>
  );
}
