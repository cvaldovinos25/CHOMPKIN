/* ============================================================
   Chompkin: anclaje de la arena a un punto del mundo
   Guarda un recorte de la imagen alrededor del punto elegido y lo
   sigue cuadro a cuadro (template matching, con cambios de tamaño),
   así la arena se queda "pegada" al piso o la pared aunque muevas el celular.
   ============================================================ */
(function () {
  const T = (window.TC_Track = { has: false, x: 0, y: 0, s: 1, ok: true, lost: false });
  const SW = 200, COLS = 36, ROWS = 27, SCALES = [0.9, 0.95, 1.05, 1.1], OK = 26;
  let vid = null, small = null, sctx = null, mid = null, mctx = null, sw = 0, sh = 0, lastVW = 0;
  let tpl = null, px = 0, py = 0, vx = 0, vy = 0, fp = 64, lostN = 0, okN = 0;

  function grab() {
    const vw = vid.videoWidth, vh = vid.videoHeight; if (!vw || vid.readyState < 2) return null;
    if (!small || lastVW !== vw) {
      sw = SW; sh = Math.round(SW * vh / vw); lastVW = vw;
      small = document.createElement('canvas'); small.width = sw; small.height = sh; sctx = small.getContext('2d', { willReadFrequently: true });
      mid = document.createElement('canvas'); mid.width = sw * 2; mid.height = sh * 2; mctx = mid.getContext('2d');
      sctx.imageSmoothingQuality = mctx.imageSmoothingQuality = 'high';
    }
    mctx.drawImage(vid, 0, 0, sw * 2, sh * 2); sctx.drawImage(mid, 0, 0, sw, sh);
    const d = sctx.getImageData(0, 0, sw, sh).data, g0 = new Uint8Array(sw * sh), g = new Uint8Array(sw * sh), m = new Uint8Array(sw * sh);
    for (let i = 0, j = 0; i < g0.length; i++, j += 4) { g0[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8; if (d[j] > 150 && d[j + 1] > 120 && d[j + 2] < 0.55 * d[j + 1] && d[j + 1] > 0.7 * d[j]) m[i] = 1; }   // amarillo = disfraz: se ignora al seguir el fondo
    for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) { const i = y * sw + x; g[i] = (g0[i - sw - 1] + 2 * g0[i - sw] + g0[i - sw + 1] + 2 * g0[i - 1] + 4 * g0[i] + 2 * g0[i + 1] + g0[i + sw - 1] + 2 * g0[i + sw] + g0[i + sw + 1]) >> 4; }
    for (let i = 0; i < m.length; i++) if (m[i] === 1) { const x = i % sw, y = (i / sw) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < sw && yy < sh) m[yy * sw + xx] |= 2; } }
    return { g, m, w: sw, h: sh };
  }
  function make(f, cx, cy) {
    const tw = fp, th = fp * 0.75;
    if (cx - tw / 2 < 1 || cy - th / 2 < 1 || cx + tw / 2 >= f.w - 1 || cy + th / 2 >= f.h - 1) return null;
    const t = new Uint8Array(COLS * ROWS), mk = new Uint8Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const ix = Math.round(cy + ((r + .5) / ROWS - .5) * th) * f.w + Math.round(cx + ((c + .5) / COLS - .5) * tw); t[r * COLS + c] = f.g[ix]; mk[r * COLS + c] = f.m[ix]; }
    return { t, mk, tw, th };
  }
  function sad(f, cx, cy, sc, best) {
    const tw = tpl.tw * sc, th = tpl.th * sc, stw = tw / COLS, sth = th / ROWS, x0 = cx - tw / 2 + stw / 2, y0 = cy - th / 2 + sth / 2; let s = 0, n = 0;
    for (let r = 0; r < ROWS; r++) { const base = Math.round(y0 + r * sth) * f.w, tb = r * COLS; for (let c = 0; c < COLS; c++) { const ix = base + Math.round(x0 + c * stw); if (f.m[ix] || tpl.mk[tb + c]) continue; const d = f.g[ix] - tpl.t[tb + c]; s += d < 0 ? -d : d; n++; } if (s >= best) return s; }
    return n < COLS * ROWS * 0.2 ? 1e11 : s * (COLS * ROWS) / n;
  }
  function inside(f, cx, cy, sc) { const hw = tpl.tw * sc / 2 + 1, hh = tpl.th * sc / 2 + 1; return cx - hw >= 0 && cy - hh >= 0 && cx + hw < f.w && cy + hh < f.h; }
  function search(f, x, y, R) {
    let bx = Math.round(x), by = Math.round(y), bs = 1e12, bsc = 1;
    const tryAt = (cx, cy, sc) => { if (!inside(f, cx, cy, sc)) return; const v = sad(f, cx, cy, sc, bs); if (v < bs) { bs = v; bx = cx; by = cy; bsc = sc; } };
    const x0 = Math.round(x), y0 = Math.round(y);
    for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) tryAt(x0 + dx, y0 + dy, 1);
    const rx = bx, ry = by; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tryAt(rx + dx, ry + dy, 1);
    const base = bs; bs *= 0.9;
    for (const sc of SCALES) for (let dy = -2; dy <= 2; dy += 2) for (let dx = -2; dx <= 2; dx += 2) tryAt(rx + dx, ry + dy, sc);
    if (bsc === 1) bs = base;
    return { x: bx, y: by, sc: bsc, score: bs / (COLS * ROWS) };
  }

  /* nx, ny: punto elegido en coordenadas normalizadas del video (0 a 1) */
  T.set = function (video, nx, ny) {
    vid = video; const f = grab(); if (!f) return false;
    px = nx * f.w; py = ny * f.h; fp = 64; vx = vy = 0; lostN = 0; okN = 0; T.s = 1;
    const t = make(f, px, py); if (!t) { px = Math.max(40, Math.min(f.w - 40, px)); py = Math.max(30, Math.min(f.h - 30, py)); tpl = make(f, px, py); } else tpl = t;
    T.has = !!tpl; T.x = px / f.w; T.y = py / f.h; T.lost = false; T.ok = true; return T.has;
  };
  T.clear = function () { T.has = false; tpl = null; };
  T.update = function () {
    if (!T.has || !vid) return T;
    const f = grab(); if (!f) return T;
    const r = search(f, px + vx, py + vy, lostN > 2 ? 30 : 16), ok = r.score < OK; T.sc = r.score;
    if (ok) {
      vx = vx * 0.4 + (r.x - px) * 0.6; vy = vy * 0.4 + (r.y - py) * 0.6; px += (r.x - px) * 0.8; py += (r.y - py) * 0.8; lostN = 0; okN++;
      if (r.sc !== 1) { T.s = Math.max(0.35, Math.min(3, T.s * r.sc)); fp = Math.max(40, Math.min(150, 64 * T.s)); const t = make(f, px, py); if (t) tpl = t; }
      else if (okN % 10 === 0 && r.score < 14) { const t = make(f, px, py); if (t) tpl = t; }
    } else { lostN++; vx *= 0.7; vy *= 0.7; }
    T.x = px / f.w; T.y = py / f.h; T.ok = ok; T.lost = lostN > 12; return T;
  };
})();
