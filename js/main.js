/* Chompkin: flujo principal (cámara, anclaje, detección, juego, HUD) */
(function () {
  const $ = (s) => document.querySelector(s);
  const vid = $('#vid'), cv = $('#gc'), ctx = cv.getContext('2d');
  const G = window.TC_Game, T = window.TC_Track, V = window.TC_Vision, A = window.TC_Audio;
  const DEBUG = new URLSearchParams(location.search).has('debug');
  let mode = 'intro', facing = 'environment', stream = null, W = 0, H = 0, dpr = 1, last = 0, frame = 0, humans = [], prevCell = {}, lastChomp = 0, anchorPt = null;

  function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  addEventListener('resize', resize); resize();

  function toast(t, ms) { const e = $('#toast'); e.textContent = t; e.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.add('hidden'), ms || 3200); }

  async function camStart() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); }
    catch (e) { toast('No pudimos usar la cámara. Permite el acceso y vuelve a intentar.', 5000); return false; }
    vid.srcObject = stream; vid.classList.toggle('mirror', facing === 'user'); try { await vid.play(); } catch (e) {}
    return true;
  }
  // coordenadas normalizadas del video -> pantalla (object-fit: cover, con espejo si es cámara frontal)
  function toScreen(nx, ny) {
    const vw = vid.videoWidth || 1280, vh = vid.videoHeight || 720, s = Math.max(W / vw, H / vh);
    let x = nx * vw * s + (W - vw * s) / 2; const y = ny * vh * s + (H - vh * s) / 2;
    if (facing === 'user') x = W - x; return { x, y, s };
  }
  function toVideoNorm(sx, sy) {
    const vw = vid.videoWidth || 1280, vh = vid.videoHeight || 720, s = Math.max(W / vw, H / vh);
    if (facing === 'user') sx = W - sx; return { x: Math.max(0.05, Math.min(0.95, (sx - (W - vw * s) / 2) / (vw * s))), y: Math.max(0.05, Math.min(0.95, (sy - (H - vh * s) / 2) / (vh * s))) };
  }

  function setMode(m) {
    mode = m;
    $('#intro').classList.toggle('hidden', m !== 'intro');
    $('#anchorUI').classList.toggle('hidden', m !== 'anchor');
    $('#hud').classList.toggle('hidden', m !== 'play');
    $('#tools').classList.toggle('hidden', m === 'intro' || m === 'wait');
    $('#msg').classList.toggle('hidden', m !== 'play');
  }
  let seq = null;
  const CD0 = 3.2, CDN = 10;   // la cuenta regresiva empieza a los 3.2 s de la noche y dura 10 s
  function syncMute() { const m = A.isMuted() ? '🔇' : '🔊'; $('#bMute').textContent = m; $('#bMuteI').textContent = m; }
  function wake() { A.start(); A.setTheme(seq ? A.theme() : 'normal'); const tp = $('#tap'); if (tp) tp.textContent = ''; }
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, wake, { once: false, passive: true }));
  try { A.start(); } catch (e) {}   // intenta sonar de inmediato; si el navegador lo bloquea, suena al primer toque
  async function start() {
    A.start(); A.setTheme('normal'); syncMute();
    if (!(await camStart())) return;
    setMode('wait'); anchorPt = { x: 0.5, y: 0.6 };
    await new Promise((r) => setTimeout(r, 900));
    doAnchor();
  }
  $('#play').onclick = start;
  $('#anchorBtn').onclick = doAnchor;
  cv.addEventListener('pointerdown', (e) => { if (mode === 'anchor') { anchorPt = toVideoNorm(e.clientX, e.clientY); doAnchor(); } });
  function beginSeq() {
    seq = { t0: performance.now() / 1000, cdDone: false };
    A.setTheme('spooky'); vid.classList.add('night'); setMode('play');
  }
  function doAnchor() {
    const p = anchorPt || { x: 0.5, y: 0.6 };
    if (!T.set(vid, p.x, p.y)) { setMode('anchor'); toast('Mueve el celular hacia un lugar con más detalle (piso o pared) y toca anclar.', 3800); return; }
    A.anchor(); if (!seq) beginSeq(); else setMode('play');
  }
  $('#bRe').onclick = () => { T.clear(); setMode('anchor'); anchorPt = { x: 0.5, y: 0.6 }; };
  $('#bFlip').onclick = async () => { facing = facing === 'environment' ? 'user' : 'environment'; await camStart(); if (mode === 'play') { T.clear(); setMode('anchor'); } };
  const tgl = () => { A.setMuted(!A.isMuted()); syncMute(); A.start(); };
  $('#bMute').onclick = tgl; $('#bMuteI').onclick = (e) => { e.stopPropagation(); tgl(); };
  $('#bPhoto').onclick = () => {
    const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const c = o.getContext('2d');
    const vw = vid.videoWidth, vh = vid.videoHeight, s = Math.max(o.width / vw, o.height / vh);
    c.save(); c.filter = getComputedStyle(vid).filter; if (facing === 'user') { c.translate(o.width, 0); c.scale(-1, 1); } c.drawImage(vid, (o.width - vw * s) / 2, (o.height - vh * s) / 2, vw * s, vh * s); c.restore();
    c.drawImage(cv, 0, 0); c.font = Math.round(o.width * 0.05) + 'px "Creepster",fantasy'; c.fillStyle = '#ff7a00'; c.shadowColor = '#000'; c.shadowBlur = 8; c.fillText('Chompkin', o.width * 0.04, o.height * 0.96);
    o.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'chompkin.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast('Foto guardada 📸'); }, 'image/png');
  };

  let lastMsg = '';
  function hud() {
    const s = G.state; if (!s) return;
    let hi = 0; try { hi = +localStorage.tcHi || 0; if (s.score > hi) { hi = s.score; localStorage.tcHi = hi; } } catch (e) { hi = Math.max(hi, s.score); } $('#hi').textContent = hi; $('#score').textContent = s.score; $('#lvl').textContent = s.level; $('#left').textContent = G.dotsLeft();
    $('#lives').textContent = '🎃'.repeat(Math.max(0, s.lives));
    const m = $('#msg'), txt = s.phase === 'over' ? 'FIN DEL JUEGO\n(toca para reiniciar)' : (s.msgT > 0 ? s.msg : '');
    if (txt !== lastMsg) { m.textContent = ''; txt.split('\n').forEach((t, i) => { const d = document.createElement('div'); d.textContent = t; if (i) d.style.fontSize = '.5em'; m.appendChild(d); }); m.classList.remove('pop'); void m.offsetWidth; if (txt) m.classList.add('pop'); lastMsg = txt; }
  }
  function drawReticle(t) {
    const p = anchorPt ? toScreen(anchorPt.x, anchorPt.y) : { x: W / 2, y: H * 0.6 }, r = Math.min(W, H) * 0.16;
    ctx.save(); ctx.translate(p.x, p.y); ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 4; ctx.shadowColor = '#ff9d00'; ctx.shadowBlur = 16; ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(-r * 0.3, 0); ctx.lineTo(r * 0.3, 0); ctx.moveTo(0, -r * 0.3); ctx.lineTo(0, r * 0.3); ctx.stroke();
    G.drawPumpkin(ctx, 0, -r - 34, 20, 0, t * 6, true); ctx.restore();
  }

  function loop(ts) {
    requestAnimationFrame(loop); const t = ts / 1000, dt = Math.min(0.05, t - last || 0.016); last = t; frame++;
    ctx.clearRect(0, 0, W, H);
    if (mode === 'anchor') { drawReticle(t); return; }
    if (mode !== 'play' || !T.has) return;
    T.update();
    drawPlay(dt, t);
  }
  const fogC = document.createElement('canvas'); fogC.width = fogC.height = 256; (function () { const f = fogC.getContext('2d'), g = f.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(190,210,255,.55)'); g.addColorStop(0.5, 'rgba(150,170,230,.22)'); g.addColorStop(1, 'rgba(150,170,230,0)'); f.fillStyle = g; f.fillRect(0, 0, 256, 256); })();
  function drawFog(t, k) {
    ctx.save(); ctx.globalAlpha = k * 0.55;
    for (let i = 0; i < 10; i++) {
      const sz = W * (0.8 + (i % 3) * 0.35), x = (((i * 0.37 + t * 0.012 * (1 + (i % 3) * 0.6)) % 1.5) - 0.25) * W, y = H * (0.08 + ((i * 0.173) % 0.85)) + Math.sin(t * 0.35 + i) * 24;
      ctx.drawImage(fogC, x - sz / 2, y - sz / 2, sz, sz * 0.7);
    }
    const g = ctx.createLinearGradient(0, H * 0.6, 0, H); g.addColorStop(0, 'rgba(160,180,230,0)'); g.addColorStop(1, 'rgba(160,180,230,.3)'); ctx.globalAlpha = k; ctx.fillStyle = g; ctx.fillRect(0, H * 0.6, W, H * 0.4);
    ctx.restore();
  }
  function drawRun(t, seqT) {
    const e = seqT - CD0; if (e < 0) return;
    const out = e > CDN ? Math.max(0, 1 - (e - CDN) / 0.9) : 1; if (out <= 0) return;
    const inn = Math.min(1, e / 0.5), cx = W / 2, left = Math.max(0, CDN - e), n = Math.ceil(left), fr = n - left;
    ctx.save(); ctx.globalAlpha = out * inn; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const jx = (Math.random() - 0.5) * 3, jy = (Math.random() - 0.5) * 3, fl = Math.sin(t * 23) > 0.9 ? 0.6 : 1;
    ctx.globalAlpha *= fl; ctx.lineJoin = 'round';
    const f1 = Math.min(W * 0.115, 64); ctx.font = f1 + 'px "Arcade Normal",monospace'; ctx.shadowColor = '#ff1a1a'; ctx.shadowBlur = 26; ctx.lineWidth = f1 * 0.2; ctx.strokeStyle = '#2a0000'; ctx.fillStyle = '#ff2b2b';
    ctx.strokeText('CORRE...', cx + jx, H * 0.17 + jy); ctx.fillText('CORRE...', cx + jx, H * 0.17 + jy);
    const f2 = Math.min(W * 0.068, 40); ctx.font = f2 + 'px "Arcade Normal",monospace'; ctx.lineWidth = f2 * 0.2; ctx.fillStyle = '#fff';
    ctx.strokeText('O TE ATRAPAN', cx - jx, H * 0.17 + f1 * 0.95 - jy); ctx.fillText('O TE ATRAPAN', cx - jx, H * 0.17 + f1 * 0.95 - jy);
    if (left > 0) {
      const f3 = Math.min(W * 0.3, 150) * (1 + 0.25 * Math.pow(1 - fr, 3)), red = n <= 3; ctx.font = f3 + 'px "Arcade Normal",monospace'; ctx.lineWidth = f3 * 0.12;
      ctx.shadowColor = red ? '#ff1a1a' : '#8a3dff'; ctx.shadowBlur = 30; ctx.fillStyle = red ? '#ff3b3b' : '#e8d9ff'; ctx.globalAlpha *= 0.55 + 0.45 * fr;
      ctx.strokeText(String(n), cx, H * 0.78); ctx.fillText(String(n), cx, H * 0.78);
    }
    ctx.restore();
  }
  const tcv = document.createElement('canvas'), tctx = tcv.getContext('2d');
  function drawTitle(t, Ar, ah, age, human) {
    const top = Ar.ay - ah / 2, bw = Math.min(W * 0.94, Ar.aw * 1.1), bh = bw * 0.42, k = Math.min(1, Math.max(0, (age - 0.5) / 0.9)), e = 1 - Math.pow(1 - k, 3);
    if (k > 0) {
      const sc = 2, pw = Math.round(bw / sc), ph = Math.round(bh / sc); if (tcv.width !== pw) { tcv.width = pw; tcv.height = ph; }
      const c = tctx, u = pw / 100; c.imageSmoothingEnabled = false; c.clearRect(0, 0, pw, ph);
      c.fillStyle = '#08031c'; c.fillRect(0, 0, pw, ph);
      const g0 = c.createLinearGradient(0, 0, 0, ph); g0.addColorStop(0, 'rgba(140,70,255,.18)'); g0.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g0; c.fillRect(0, 0, pw, ph);
      // borde rojo con luces que corren
      c.fillStyle = '#9b5cff'; const bt = Math.max(2, u * 1.6); c.fillRect(0, 0, pw, bt); c.fillRect(0, ph - bt, pw, bt); c.fillRect(0, 0, bt, ph); c.fillRect(pw - bt, 0, bt, ph);
      const per = 2 * (pw + ph), step = u * 4.5; for (let d = 0; d < per; d += step) { const q = ((d / step) | 0), on = (q + Math.floor(t * 8)) % 3 === 0; c.fillStyle = on ? '#7ff6ff' : '#3b1a8f'; let x, y, dd = d; if (dd < pw) { x = dd; y = 0; } else if (dd < pw + ph) { x = pw - bt; y = dd - pw; } else if (dd < 2 * pw + ph) { x = 2 * pw + ph - dd; y = ph - bt; } else { x = 0; y = per - dd; } c.fillRect(x, y, bt, bt); }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const word = 'CHOMPKIN', fs = u * 10.6, y0 = ph * 0.4, adv = fs * 0.98; c.font = fs + 'px "Arcade Normal",monospace';
      const sx = pw / 2 - adv * (word.length - 1) / 2;
      for (let i = 0; i < word.length; i++) {
        const drop = Math.max(0, 1 - Math.min(1, Math.max(0, (age - 0.5 - i * 0.07) / 0.45))), x = sx + i * adv, y = y0 + Math.sin(t * 4.2 + i * 0.7) * fs * 0.09 - drop * ph;
        for (let z = 5; z >= 1; z--) { c.fillStyle = z > 3 ? '#1a0a5a' : '#4b24c0'; c.fillText(word[i], x + z * u * 0.28, y + z * u * 0.28); }
        c.lineWidth = u * 0.9; c.strokeStyle = '#12063d'; c.strokeText(word[i], x, y);
        const g = c.createLinearGradient(0, y - fs / 2, 0, y + fs / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#6ff3ff'); g.addColorStop(1, '#9b5cff'); c.fillStyle = g; c.fillText(word[i], x, y);
      }
      // brillo que cruza
      c.save(); c.globalCompositeOperation = 'source-atop'; const sh = ((t * 0.55) % 2.2 - 0.6) * pw; c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.moveTo(sh, 0); c.lineTo(sh + u * 9, 0); c.lineTo(sh + u * 3, ph); c.lineTo(sh - u * 6, ph); c.fill(); c.restore();
      // subtítulo que cambia de color
      const cols = ['#35e6ee', '#d6b4ff', '#ffffff', '#ff9be6'], sub = 'NOCHE DE DULCES'; c.font = u * 4.2 + 'px "Arcade Normal",monospace'; c.globalCompositeOperation = 'source-over';
      const sw = c.measureText(sub).width / sub.length; for (let i = 0; i < sub.length; i++) { c.fillStyle = '#000'; c.fillText(sub[i], pw / 2 - sw * (sub.length - 1) / 2 + i * sw + u * 0.3, ph * 0.8 + u * 0.3); c.fillStyle = cols[(i + Math.floor(t * 6)) % 4]; c.fillText(sub[i], pw / 2 - sw * (sub.length - 1) / 2 + i * sw, ph * 0.8); }
      // líneas de pantalla CRT
      c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < ph; y += 2) c.fillRect(0, y, pw, 1);
      ctx.save(); ctx.globalAlpha = k; ctx.imageSmoothingEnabled = false; const flick = (Math.sin(t * 40) > 0.97) ? 0.85 : 1; ctx.globalAlpha = k * flick;
      ctx.shadowColor = '#8a3dff'; ctx.shadowBlur = bw * 0.05; ctx.drawImage(tcv, Ar.ax - bw / 2, top - bh - bw * 0.04 - (1 - e) * bh * 1.2, bw, bh); ctx.restore();
    }
    if (age > 2.2) {
      ctx.save(); ctx.textAlign = 'center'; ctx.font = Math.max(9, Math.min(15, W * 0.032)) + 'px "Arcade Normal",monospace';
      const txt = human ? 'CUIDADO CON LOS MURCIELAGOS!' : 'ENTRA AL LABERINTO!';
      if (human || Math.floor(t * 2) % 2) { ctx.fillStyle = '#ffd400'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6; ctx.fillText(txt, Ar.ax, Ar.ay + ah / 2 + 34); }
      ctx.restore();
    }
  }
  let blobsCache = [];
  function drawPlay(dt, t) {
    const seqT = performance.now() / 1000 - seq.t0, nk = Math.min(1, seqT / 2.8) * (seqT < 1.6 && Math.sin(seqT * 34) > 0.55 ? 0.55 : 1);
    ctx.fillStyle = 'rgba(2,4,26,' + (0.5 * nk) + ')'; ctx.fillRect(0, 0, W, H);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,10,0)'); vg.addColorStop(1, 'rgba(0,0,10,' + (0.75 * nk) + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (seqT >= CD0 + CDN && !seq.cdDone) { seq.cdDone = true; A.setTheme('normal'); A.hello(); }
    if (frame % 3 === 0) blobsCache = V.detect(vid);
    const ap = toScreen(T.x, T.y), s = ap.s;
    const aw = Math.max(W * 0.28, Math.min(W * 1.5, Math.min(W * 0.82, (H * 0.66) * G.COLS / G.ROWS) * T.s)), cs = aw / G.COLS, ah = cs * G.ROWS;
    const Ar = { ax: ap.x, ay: ap.y, aw };
    humans = blobsCache.map((b) => {
      const p = toScreen(b.x, b.y), rpx = b.r * (vid.videoWidth || 1280) * s;
      const u = (p.x - (Ar.ax - aw / 2)) / aw, v = (p.y - (Ar.ay - ah / 2)) / ah, inside = u > -0.03 && u < 1.03 && v > -0.03 && v < 1.03;
      const cell = G.nearestOpen(Math.floor(u * G.COLS), Math.floor(v * G.ROWS)) || { c: 6, r: 5 };
      const pc = prevCell[b.id]; let d = pc ? pc.d : 0; if (pc && (pc.c !== cell.c || pc.r !== cell.r)) { const dx = cell.c - pc.c, dy = cell.r - pc.r; d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3); }
      prevCell[b.id] = { c: cell.c, r: cell.r, d };
      return { x: p.x, y: p.y, rpx, u, v, in: inside, c: cell.c, r: cell.r, d, rad: Math.min(1.4, rpx / cs * 0.38) };
    });
    const gh = humans;
    const ev = seqT > 2 ? G.update(dt, gh, Ar) : [];
    ev.forEach((e) => { if (e === 'chomp') { if (performance.now() - lastChomp > 90) { A.chomp(); lastChomp = performance.now(); } } else if (A[e]) A[e](); if (e === 'power') A.fast(true); if (e === 'powerEnd') A.fast(false); });
    if (gh.some((h) => h.in) && !drawPlay.seen) { drawPlay.seen = true; toast('🎃 ¡Disfraz amarillo detectado! Tú eres la calabaza hambrienta.', 3800); }
    if (seqT > 2) G.draw(ctx, Ar, gh.map((h) => ({ x: h.x, y: h.y, r: h.rpx, in: h.in })), t);
    if (T.lost) { ctx.fillStyle = 'rgba(20,0,43,.55)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ffd400'; ctx.font = '12px "Arcade Normal",monospace'; ctx.textAlign = 'center'; ctx.fillText('Perdimos el punto de anclaje', W / 2, H * 0.5); ctx.fillText('Toca 📍 para volver a anclar', W / 2, H * 0.5 + 24); ctx.textAlign = 'start'; }
    drawFog(t, nk);
    drawRun(t, seqT);
    if (DEBUG) window.__TC = { T, G, humans: gh, blobs: blobsCache, Ar };
  }
  if (DEBUG) { window.__TC = { T, G, setMode, doAnchor }; }
  document.querySelectorAll('h1').forEach((h) => { const out = []; h.childNodes.forEach((n) => { const em = n.nodeName === 'EM'; const txt = n.textContent; out.push(...[...txt].map((ch, i) => { const sp = document.createElement('span'); sp.textContent = ch; sp.className = 'ltr' + (em ? ' y' : ''); sp.style.animationDelay = (out.length + i) * 0.09 + 's'; return sp; })); }); h.textContent = ''; out.forEach((x) => h.appendChild(x)); });
  try { document.fonts.load('20px "Arcade Normal"'); } catch (e) {}
  requestAnimationFrame(loop);
  setMode('intro');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
