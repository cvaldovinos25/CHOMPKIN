/* ============================================================
   Chompkin: música y efectos (WebAudio, todo generado por código)
   Melodía y bajo originales, estilo chiptune "casa embrujada".
   Hay que iniciarlo con un toque del usuario (regla de los navegadores).
   ============================================================ */
(function () {
  const A = (window.TC_Audio = {});
  let ctx = null, master = null, musicGain = null, sfxGain = null, timer = 0, step = 0, nextT = 0, muted = false, fast = false, playing = false;

  // Temas (todo original): 'normal' = arcade alegre; 'spooky' = misma idea, lenta, menor, desafinada y con eco
  const sf = (n) => 261.63 * Math.pow(2, n / 12);
  const LEADN = [0, null, 4, null, 7, null, 12, 7, 9, null, 5, null, 9, null, 12, null, 7, null, 11, null, 14, null, 11, 7, 9, 7, 5, 4, 2, null, 0, null];
  const ROOTS = [-12, -7, -5, -12], BASSN = [];
  ROOTS.forEach((r) => [r, null, r + 7, null, r, null, r + 7, null].forEach((x) => BASSN.push(x)));
  const minor = (n) => { const m = ((n % 12) + 12) % 12; return (m === 4 || m === 9 || m === 11) ? n - 1 : n; };
  let theme = 'normal', spookBus = null;

  function note(freq, t, dur, type, vol, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  function thump(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.3);
  }
  function schedule() {
    const sp = theme === 'spooky', bpm = sp ? 70 : (fast ? 176 : 142), sd = 60 / bpm / 2;
    while (nextT < ctx.currentTime + 0.25) {
      const i = step % BASSN.length;
      if (!sp) {
        if (BASSN[i] != null) note(sf(BASSN[i]), nextT, sd * 1.6, 'triangle', 0.5, musicGain);
        if (LEADN[i] != null) note(sf(LEADN[i]), nextT, sd * 1.1, 'square', 0.13, musicGain);
        if (step % 2 === 0) { // pulso de percusión suave
          const b = ctx.createBufferSource(), buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate), d = buf.getChannelData(0);
          for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length);
          b.buffer = buf; const g = ctx.createGain(); g.gain.value = step % 8 === 0 ? 0.2 : 0.07; b.connect(g); g.connect(musicGain); b.start(nextT);
        }
      } else {
        if (BASSN[i] != null && i % 4 === 0) note(sf(minor(BASSN[i]) - 12), nextT, sd * 3.6, 'sine', 0.55, musicGain);                   // bajo profundo
        if (LEADN[i] != null) { const f = sf(minor(LEADN[i]) - 12 - (i % 8 === 6 ? 1 : 0)); note(f, nextT, sd * 2.2, 'sawtooth', 0.1, spookBus); note(f * 1.0595, nextT, sd * 2.2, 'square', 0.05, spookBus); }   // melodía menor y desafinada
        if (step % 8 === 0) thump(nextT, 0.7); if (step % 8 === 1) thump(nextT, 0.4);                                                      // latido
        if (step % 32 === 16) note(sf(24) * (1 + Math.random() * 0.05), nextT, sd * 5, 'sine', 0.05, spookBus);                           // chillido lejano
      }
      nextT += sd; step++;
    }
  }
  A.start = function () {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      ctx = new C(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 4; spookBus = ctx.createGain(); spookBus.connect(lp); lp.connect(musicGain);
      const dl = ctx.createDelay(1); dl.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.45; lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(musicGain);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.35; lg.gain.value = 250; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (!playing) { playing = true; nextT = ctx.currentTime + 0.1; step = 0; timer = setInterval(schedule, 40); }
  };
  A.setTheme = function (n) { if (theme === n) return; theme = n; step = 0; if (ctx) nextT = ctx.currentTime + 0.05; };
  A.theme = () => theme;
  A.stop = function () { playing = false; clearInterval(timer); };
  A.setMuted = function (m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02); };
  A.isMuted = () => muted;
  A.fast = (f) => { fast = !!f; };

  const sfx = (fn) => () => { if (ctx && !muted) fn(ctx.currentTime); };
  let alt = 0;
  A.chomp = sfx((t) => { alt ^= 1; note(alt ? 520 : 390, t, 0.07, 'square', 0.22, sfxGain); });
  A.power = sfx((t) => { for (let i = 0; i < 6; i++) note(260 * Math.pow(1.19, i), t + i * 0.05, 0.1, 'square', 0.2, sfxGain); });
  A.eatBat = sfx((t) => { [392, 523, 659, 784].forEach((f, i) => note(f, t + i * 0.06, 0.12, 'square', 0.22, sfxGain)); });
  A.scare = sfx((t) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.5);
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.6);
  });
  A.win = sfx((t) => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => note(f, t + i * 0.1, 0.16, 'square', 0.22, sfxGain)); });
  A.anchor = sfx((t) => { note(330, t, 0.1, 'triangle', 0.4, sfxGain); note(660, t + 0.09, 0.18, 'triangle', 0.4, sfxGain); });
  A.hello = sfx((t) => { [440, 554, 659].forEach((f, i) => note(f, t + i * 0.08, 0.14, 'square', 0.18, sfxGain)); });
})();
