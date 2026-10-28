/* Chompkin: intro en video (cámara + noche + niebla + cuenta regresiva + música) */
(function () {
  const $ = (q) => document.querySelector(q);
  const vid = $('#vid'), cv = $('#gc'), ctx = cv.getContext('2d'), A = window.TC_Audio;
  let mode = 'intro', stream = null, W = 0, H = 0, dpr = 1, seq = null;
  const CD0 = 2.6, CDN = 10;   // la cuenta empieza a los 2.6 s de la noche y dura 10 s

  function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  addEventListener('resize', resize); resize();
  function toast(t, ms) { const e = $('#toast'); e.textContent = t; e.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.add('hidden'), ms || 3200); }

  async function camStart() {
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); }
    catch (e) { toast('No pudimos usar la cámara. Permite el acceso y vuelve a intentar.', 5000); return false; }
    vid.srcObject = stream; try { await vid.play(); } catch (e) {}
    return true;
  }
  function setMode(m) { mode = m; $('#intro').classList.toggle('hidden', m !== 'intro'); $('#tools').classList.toggle('hidden', m !== 'play'); }
  function syncMute() { const m = A.isMuted() ? '🔇' : '🔊'; $('#bMute').textContent = m; $('#bMuteI').textContent = m; }
  function wake() { A.start(); const tp = $('#tap'); if (tp) tp.textContent = ''; }
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, wake, { passive: true }));
  try { A.start(); } catch (e) {}   // intenta sonar de inmediato; si el navegador lo bloquea, suena al primer toque
  async function start() {
    A.start(); A.setTheme('normal'); syncMute();
    if (!(await camStart())) return;
    seq = { t0: performance.now() / 1000, cdDone: false };
    A.setTheme('spooky'); vid.classList.add('night'); setMode('play');
  }
  $('#play').onclick = start;
  const tgl = () => { A.setMuted(!A.isMuted()); syncMute(); A.start(); };
  $('#bMute').onclick = tgl; $('#bMuteI').onclick = (e) => { e.stopPropagation(); tgl(); };

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

  function loop() {
    requestAnimationFrame(loop); ctx.clearRect(0, 0, W, H);
    if (mode !== 'play' || !seq) return;
    const t = performance.now() / 1000, seqT = t - seq.t0, nk = Math.min(1, seqT / 2.8) * (seqT < 1.6 && Math.sin(seqT * 34) > 0.55 ? 0.55 : 1);
    ctx.fillStyle = 'rgba(2,4,26,' + (0.5 * nk) + ')'; ctx.fillRect(0, 0, W, H);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,10,0)'); vg.addColorStop(1, 'rgba(0,0,10,' + (0.75 * nk) + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (seqT >= CD0 + CDN && !seq.cdDone) { seq.cdDone = true; A.setTheme('normal'); A.hello(); }
    drawFog(t, nk); drawRun(t, seqT);
  }
  try { document.fonts.load('20px "Arcade Normal"'); } catch (e) {}
  document.querySelectorAll('h1').forEach((h) => { const out = []; h.childNodes.forEach((n) => { const em = n.nodeName === 'EM'; [...n.textContent].forEach((ch, i) => { const sp = document.createElement('span'); sp.textContent = ch; sp.className = 'ltr' + (em ? ' y' : ''); sp.style.animationDelay = (out.length + i) * 0.09 + 's'; out.push(sp); }); }); h.textContent = ''; out.forEach((x) => h.appendChild(x)); });
  requestAnimationFrame(loop); setMode('intro');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
