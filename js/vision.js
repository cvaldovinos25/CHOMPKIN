/* ============================================================
   Chompkin: detección de disfraces amarillos
   Busca "manchas" amarillas grandes en la cámara (el disfraz).
   No identifica personas ni guarda imágenes: solo color y posición.
   ============================================================ */
(function () {
  const V = (window.TC_Vision = {});
  const W = 160; let cv = null, cx = null, H = 90, lab = null, last = [];

  V.detect = function (video) {
    const vw = video.videoWidth, vh = video.videoHeight; if (!vw || video.readyState < 2) return last;
    if (!cv || H !== Math.round(W * vh / vw)) { H = Math.round(W * vh / vw); cv = document.createElement('canvas'); cv.width = W; cv.height = H; cx = cv.getContext('2d', { willReadFrequently: true }); lab = new Int16Array(W * H); }
    cx.drawImage(video, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < W * H; i++, j += 4) {
      const r = d[j], g = d[j + 1], b = d[j + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx < 140 || mx - mn < 0.45 * mx) continue;        // brillante y saturado
      let h; const dd = mx - mn;
      if (mx === r) h = 60 * (((g - b) / dd) % 6); else if (mx === g) h = 60 * ((b - r) / dd + 2); else h = 60 * ((r - g) / dd + 4);
      if (h < 0) h += 360;
      if (h >= 38 && h <= 68 && g > 0.7 * r) mask[i] = 1;     // amarillo (no naranja ni verde)
    }
    // manchas conectadas
    lab.fill(0); const blobs = []; let id = 0; const st = [];
    for (let s = 0; s < W * H; s++) {
      if (!mask[s] || lab[s]) continue;
      id++; let n = 0, sx = 0, sy = 0, x0 = W, x1 = 0, y0 = H, y1 = 0; st.length = 0; st.push(s); lab[s] = id;
      while (st.length) {
        const p = st.pop(), x = p % W, y = (p / W) | 0; n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && mask[p - 1] && !lab[p - 1]) { lab[p - 1] = id; st.push(p - 1); }
        if (x < W - 1 && mask[p + 1] && !lab[p + 1]) { lab[p + 1] = id; st.push(p + 1); }
        if (y > 0 && mask[p - W] && !lab[p - W]) { lab[p - W] = id; st.push(p - W); }
        if (y < H - 1 && mask[p + W] && !lab[p + W]) { lab[p + W] = id; st.push(p + W); }
      }
      if (n >= W * H * 0.012) blobs.push({ x: sx / n / W, y: sy / n / H, r: Math.max(x1 - x0, y1 - y0) / 2 / W, area: n / (W * H) });
    }
    blobs.sort((a, b) => b.area - a.area);
    const cur = blobs.slice(0, 3);
    // suavizado: une cada mancha con la anterior más cercana
    cur.forEach((b) => { let best = null, bd = 0.2; last.forEach((o) => { const dd = Math.hypot(o.x - b.x, o.y - b.y); if (dd < bd) { bd = dd; best = o; } }); if (best) { b.x = best.x * 0.45 + b.x * 0.55; b.y = best.y * 0.45 + b.y * 0.55; b.r = best.r * 0.5 + b.r * 0.5; b.id = best.id; } else b.id = Math.random(); });
    last = cur; return cur;           // coordenadas normalizadas del video (0 a 1)
  };
})();
