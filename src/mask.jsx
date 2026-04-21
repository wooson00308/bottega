// Sprite mask painter — channel defs, loading, and pixel ops.

// Pure channel colors (exact PNG values we must export)
export const CHANNELS = [
  { id: 'primary',   name: 'Primary',   sub: '메인',   rgb: [255, 0, 0],   hex: '#ff0000', key: '1' },
  { id: 'secondary', name: 'Secondary', sub: '보조',   rgb: [0, 255, 0],   hex: '#00ff00', key: '2' },
  { id: 'accent',    name: 'Accent',    sub: '포인트', rgb: [0, 0, 255],   hex: '#0000ff', key: '3' },
  { id: 'detail',    name: 'Detail',    sub: '원본 유지', rgb: [0, 0, 0], hex: '#000000', key: '4' },
];

export const channelByRgb = (r, g, b) => {
  if (r === 255 && g === 0 && b === 0) return 'primary';
  if (r === 0 && g === 255 && b === 0) return 'secondary';
  if (r === 0 && g === 0 && b === 255) return 'accent';
  if (r === 0 && g === 0 && b === 0) return 'detail';
  return null;
};

// Load image file → HTMLImageElement + alpha map.
// `sourcePath` is the native filesystem path (null when loaded via browser-only APIs).
export async function loadSprite(file, sourcePath = null) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  const alpha = new Uint8Array(w * h);
  let opaqueCount = 0;
  for (let i = 0; i < w * h; i++) {
    alpha[i] = data[i * 4 + 3];
    if (alpha[i] > 0) opaqueCount++;
  }
  return {
    url, img, w, h, alpha, opaqueCount,
    name: file.name, size: file.size, blob: file,
    sourcePath,
  };
}

// Create a blank mask canvas (transparent)
export function createMaskCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Snap a mask canvas: force pixels to pure channel values OR transparent.
export function snapMask(maskCanvas, spriteAlpha) {
  const w = maskCanvas.width, h = maskCanvas.height;
  const ctx = maskCanvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < w * h; i++) {
    const off = i * 4;
    if (spriteAlpha[i] === 0) { d[off + 3] = 0; continue; }
    const r = d[off], g = d[off + 1], b = d[off + 2], a = d[off + 3];
    if (a < 32) { d[off + 3] = 0; continue; }
    const channels = [
      { v: r, rgb: [255, 0, 0] },
      { v: g, rgb: [0, 255, 0] },
      { v: b, rgb: [0, 0, 255] },
    ];
    const maxC = channels.reduce((a, b) => b.v > a.v ? b : a);
    if (maxC.v < 32) {
      d[off] = 0; d[off + 1] = 0; d[off + 2] = 0; d[off + 3] = 255;
    } else {
      d[off] = maxC.rgb[0]; d[off + 1] = maxC.rgb[1]; d[off + 2] = maxC.rgb[2]; d[off + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// Compute coverage stats
export function computeStats(maskCanvas, spriteAlpha) {
  const w = maskCanvas.width, h = maskCanvas.height;
  const ctx = maskCanvas.getContext('2d');
  const d = ctx.getImageData(0, 0, w, h).data;
  let opaque = 0, uncovered = 0;
  const counts = { primary: 0, secondary: 0, accent: 0, detail: 0 };
  for (let i = 0; i < w * h; i++) {
    if (spriteAlpha[i] === 0) continue;
    opaque++;
    const off = i * 4;
    const r = d[off], g = d[off + 1], b = d[off + 2], a = d[off + 3];
    if (a < 16) { uncovered++; continue; }
    const ch = channelByRgb(r, g, b);
    if (ch) counts[ch]++;
    else uncovered++;
  }
  return { opaque, uncovered, counts };
}

// Flood fill on mask canvas using sprite image as a soft barrier.
export function floodFill(maskCanvas, spriteImg, spriteAlpha, seedX, seedY, fillRgb, tolerance = 32) {
  const w = maskCanvas.width, h = maskCanvas.height;
  const sc = document.createElement('canvas');
  sc.width = w; sc.height = h;
  const sctx = sc.getContext('2d');
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(spriteImg, 0, 0);
  const spriteData = sctx.getImageData(0, 0, w, h).data;

  const maskCtx = maskCanvas.getContext('2d');
  const maskData = maskCtx.getImageData(0, 0, w, h);
  const md = maskData.data;

  const seedIdx = (seedY * w + seedX) * 4;
  if (spriteAlpha[seedY * w + seedX] === 0) return 0;
  const seedR = spriteData[seedIdx], seedG = spriteData[seedIdx + 1], seedB = spriteData[seedIdx + 2];

  const visited = new Uint8Array(w * h);
  const stack = [seedY * w + seedX];
  let filled = 0;
  while (stack.length) {
    const p = stack.pop();
    if (visited[p]) continue;
    visited[p] = 1;
    if (spriteAlpha[p] === 0) continue;
    const po = p * 4;
    const dr = spriteData[po] - seedR, dg = spriteData[po + 1] - seedG, db = spriteData[po + 2] - seedB;
    if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) > tolerance * 3) continue;
    md[po] = fillRgb[0]; md[po + 1] = fillRgb[1]; md[po + 2] = fillRgb[2]; md[po + 3] = 255;
    filled++;
    const x = p % w, y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  maskCtx.putImageData(maskData, 0, 0);
  return filled;
}

// Stamp a circular brush (hard edge) onto mask canvas.
export function stampBrush(maskCanvas, spriteAlpha, cx, cy, radius, fillRgb, erase = false) {
  const w = maskCanvas.width, h = maskCanvas.height;
  const ctx = maskCanvas.getContext('2d');
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(w, Math.ceil(cx + radius) + 1);
  const y1 = Math.min(h, Math.ceil(cy + radius) + 1);
  if (x1 <= x0 || y1 <= y0) return;
  const bw = x1 - x0, bh = y1 - y0;
  const region = ctx.getImageData(x0, y0, bw, bh);
  const rd = region.data;
  const r2 = radius * radius;
  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const gx = x0 + px, gy = y0 + py;
      const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy;
      if (dx * dx + dy * dy > r2) continue;
      const gIdx = gy * w + gx;
      if (spriteAlpha[gIdx] === 0) continue;
      const off = (py * bw + px) * 4;
      if (erase) {
        rd[off + 3] = 0;
      } else {
        rd[off] = fillRgb[0]; rd[off + 1] = fillRgb[1]; rd[off + 2] = fillRgb[2]; rd[off + 3] = 255;
      }
    }
  }
  ctx.putImageData(region, x0, y0);
}

// Draw line of stamps between two points
export function strokeLine(maskCanvas, spriteAlpha, x0, y0, x1, y1, radius, fillRgb, erase, mirror) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const step = Math.max(1, radius * 0.5);
  const steps = Math.max(1, Math.ceil(dist / step));
  const w = maskCanvas.width, h = maskCanvas.height;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    stampBrush(maskCanvas, spriteAlpha, x, y, radius, fillRgb, erase);
    if (mirror === 'x' || mirror === 'xy') stampBrush(maskCanvas, spriteAlpha, w - x, y, radius, fillRgb, erase);
    if (mirror === 'y' || mirror === 'xy') stampBrush(maskCanvas, spriteAlpha, x, h - y, radius, fillRgb, erase);
    if (mirror === 'xy') stampBrush(maskCanvas, spriteAlpha, w - x, h - y, radius, fillRgb, erase);
  }
}

// Prefill the mask with Detail (black) wherever the sprite has any alpha.
// Gives you "keep original everywhere" as the starting state — then you only
// paint the team-color regions.
export function prefillDetail(sprite, maskCanvas) {
  const w = sprite.w, h = sprite.h;
  const ctx = maskCanvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    if (sprite.alpha[i] === 0) continue;
    const off = i * 4;
    d[off] = 0; d[off + 1] = 0; d[off + 2] = 0; d[off + 3] = 255;
  }
  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(img, 0, 0);
}

// Import an external guide PNG, run the hardening rule, and paint into maskCanvas.
// Rule (matches GMLM Tools/harden_mask.py):
//   dominant > 100 AND dominant - second > 40  →  pure channel (R/G/B = 255)
//   otherwise                                 →  Detail (black, if sprite alpha > 0)
// Sprite alpha is always honored: pixels outside the sprite silhouette stay transparent.
export async function hardenGuideIntoMask(guideBlob, sprite, maskCanvas) {
  const w = sprite.w, h = sprite.h;
  const url = URL.createObjectURL(guideBlob);
  const img = new Image();
  img.src = url;
  try {
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  } finally {
    URL.revokeObjectURL(url);
  }
  if (img.naturalWidth !== w || img.naturalHeight !== h) {
    throw new Error(
      `가이드 해상도 불일치: ${img.naturalWidth}×${img.naturalHeight} (원본 ${w}×${h})`
    );
  }

  const tc = document.createElement('canvas');
  tc.width = w; tc.height = h;
  const tctx = tc.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(img, 0, 0);
  const guide = tctx.getImageData(0, 0, w, h).data;

  const mctx = maskCanvas.getContext('2d');
  const out = mctx.createImageData(w, h);
  const od = out.data;

  const DOMINANT_MIN = 100;
  const MARGIN = 40;

  const counts = { primary: 0, secondary: 0, accent: 0, detail: 0 };
  for (let i = 0; i < w * h; i++) {
    const off = i * 4;
    if (sprite.alpha[i] === 0) continue; // stay transparent
    const r = guide[off], g = guide[off + 1], b = guide[off + 2], a = guide[off + 3];
    if (a < 16) {
      od[off] = 0; od[off + 1] = 0; od[off + 2] = 0; od[off + 3] = 255;
      counts.detail++;
      continue;
    }
    let dominant, second, pick;
    if (r >= g && r >= b) { dominant = r; second = Math.max(g, b); pick = 'r'; }
    else if (g >= b)      { dominant = g; second = Math.max(r, b); pick = 'g'; }
    else                  { dominant = b; second = Math.max(r, g); pick = 'b'; }

    if (dominant > DOMINANT_MIN && dominant - second > MARGIN) {
      if (pick === 'r')      { od[off] = 255; counts.primary++; }
      else if (pick === 'g') { od[off + 1] = 255; counts.secondary++; }
      else                   { od[off + 2] = 255; counts.accent++; }
      od[off + 3] = 255;
    } else {
      od[off] = 0; od[off + 1] = 0; od[off + 2] = 0; od[off + 3] = 255;
      counts.detail++;
    }
  }

  mctx.clearRect(0, 0, w, h);
  mctx.putImageData(out, 0, 0);
  return counts;
}

// Clone mask canvas (for history)
export function cloneCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}
