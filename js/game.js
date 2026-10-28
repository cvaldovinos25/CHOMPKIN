/* ============================================================
   Chompkin: reglas del juego y dibujo
   Laberinto tipo arcade: caramelos, pastillas de poder, 4 murciélagos
   perseguidores con personalidad propia, vidas y niveles.
   El "chomper" es la persona disfrazada de amarillo (o una calabaza demo).
   Personajes y dibujos originales.
   ============================================================ */
(function () {
  const G = (window.TC_Game = {});
  const MAP = [
    '#############',
    '#o....#....o#',
    '#.###.#.###.#',
    '#...........#',
    '#.##.#.#.##.#',
    '#....#.#....#',
    '#.##.#.#.##.#',
    '#...........#',
    '#.###.#.###.#',
    '#o....#....o#',
    '#############'];
  const COLS = 13, ROWS = 11;
  const open = (c, r) => r >= 0 && r < ROWS && c >= 0 && c < COLS && MAP[r][c] !== '#';
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const BAT_COL = ['#ff3b30', '#ff7ac8', '#25d9ff', '#ff9f1a'];
  const HOME = [[6, 4], [6, 5], [6, 6], [6, 3]];

  let dots = [], bats = [], pumpkin = null, st = null;
  G.state = null;

  function resetDots() { dots = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const ch = MAP[r][c]; if (ch === '.' || ch === 'o') { if (c === 6 && r >= 3 && r <= 7 && ch === '.' && r !== 3 && r !== 7) { /* centro libre */ } dots.push({ c, r, p: ch === 'o', on: true }); } } }
  function resetBats() {
    bats = HOME.map((h, i) => ({ i, c: h[0], r: h[1], fx: h[0], fy: h[1], d: i % 2 ? 2 : 0, prog: 0, nc: h[0], nr: h[1], fright: 0, wait: 1.5 + i * 1.1, home: h, flap: Math.random() * 6 }));
  }
  G.init = function () { st = G.state = { score: 0, lives: 3, level: 1, phase: 'ready', t: 2.4, power: 0, msg: '', msgT: 0, shake: 0, flash: 0, eaten: 0, combo: 0 }; resetDots(); resetBats(); pumpkin = { fx: 6, fy: 7, c: 6, r: 7, nc: 6, nr: 7, prog: 0, d: 0, mouth: 0 }; };
  const left = () => dots.filter((d) => d.on).length;
  G.dotsLeft = left; G.total = () => dots.length;
  const say = (m, t) => { st.msg = m; st.msgT = t || 1.6; };

  // posición de pantalla <-> celda
  function cellOf(u, v) { return { c: Math.max(0, Math.min(COLS - 1, Math.floor(u * COLS))), r: Math.max(0, Math.min(ROWS - 1, Math.floor(v * ROWS))) }; }
  function nearestOpen(c, r) { if (open(c, r)) return { c, r }; let best = null, bd = 1e9; for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) if (open(cc, rr)) { const d = (cc - c) ** 2 + (rr - r) ** 2; if (d < bd) { bd = d; best = { c: cc, r: rr }; } } return best; }

  function stepBat(b, dt, targets, speed) {
    if (b.wait > 0) { b.wait -= dt; return; }
    let mv = speed * dt;
    while (mv > 0) {
      if (b.prog <= 0) {   // llegó a una celda: decide
        b.c = b.nc; b.r = b.nr; b.fx = b.c; b.fy = b.r;
        const opts = DIRS.map((d, k) => ({ k, c: b.c + d[0], r: b.r + d[1] })).filter((o) => open(o.c, o.r) && o.k !== (b.d + 2) % 4);
        let pick;
        if (!opts.length) pick = { k: (b.d + 2) % 4, c: b.c - DIRS[b.d][0], r: b.r - DIRS[b.d][1] };
        else {
          const tg = targets(b);
          const score = (o) => { const dd = (o.c - tg.c) ** 2 + (o.r - tg.r) ** 2; return b.fright > 0 ? -dd + Math.random() * 3 : dd + Math.random() * 0.6; };
          opts.sort((x, y) => score(x) - score(y)); pick = opts[0];
        }
        b.d = pick.k; b.nc = pick.c; b.nr = pick.r; b.prog = 1;
      }
      const s = Math.min(mv, b.prog); b.prog -= s; mv -= s;
      b.fx = b.c + (b.nc - b.c) * (1 - b.prog); b.fy = b.r + (b.nr - b.r) * (1 - b.prog);
    }
  }

  /* humans: [{u, v, r, id}] en coordenadas de la arena (0 a 1). Devuelve eventos. */
  G.update = function (dt, humans, A) {
    const ev = []; if (!st) G.init(); st.age = (st.age || 0) + dt;
    st.t -= dt; st.msgT -= dt; st.shake = Math.max(0, st.shake - dt); st.flash = Math.max(0, st.flash - dt * 2);
    bats.forEach((b) => { b.flap += dt * 14; if (b.fright > 0) b.fright -= dt; });
    if (st.power > 0) { st.power -= dt; if (st.power <= 0) { st.combo = 0; ev.push('powerEnd'); } }
    if (st.phase === 'ready') { if (st.t <= 0) { st.phase = 'play'; } return ev; }
    if (st.phase === 'over' || st.phase === 'win') { if (st.t <= 0 && st.phase === 'win') { st.level++; resetDots(); resetBats(); st.phase = 'ready'; st.t = 2.2; say('NIVEL ' + st.level, 2); ev.push('level'); } return ev; }

    // chompers: personas reales o la calabaza demo
    const real = humans.filter((h) => h.in);
    let chompers = real.map((h) => ({ c: h.c, r: h.r, u: h.u, v: h.v, d: h.d, rad: Math.max(0.55, h.rad), real: true }));
    if (!chompers.length) {   // calabaza demo con IA simple: va al caramelo más cercano
      const p = pumpkin; p.mouth += dt * 9;
      let mv = 3.1 * dt;
      while (mv > 0) {
        if (p.prog <= 0) {
          p.c = p.nc; p.r = p.nr; p.fx = p.c; p.fy = p.r;
          let tgt = null, bd = 1e9; dots.forEach((d) => { if (!d.on) return; const dd = Math.abs(d.c - p.c) + Math.abs(d.r - p.r); if (dd < bd) { bd = dd; tgt = d; } });
          const danger = bats.find((b) => b.fright <= 0 && b.wait <= 0 && Math.abs(b.c - p.c) + Math.abs(b.r - p.r) < 3);
          const opts = DIRS.map((d, k) => ({ k, c: p.c + d[0], r: p.r + d[1] })).filter((o) => open(o.c, o.r) && o.k !== (p.d + 2) % 4);
          const o2 = opts.length ? opts : DIRS.map((d, k) => ({ k, c: p.c + d[0], r: p.r + d[1] })).filter((o) => open(o.c, o.r));
          const sc = (o) => { let s = tgt ? (o.c - tgt.c) ** 2 + (o.r - tgt.r) ** 2 : 0; if (danger) s -= 3 * ((o.c - danger.c) ** 2 + (o.r - danger.r) ** 2); return s + Math.random(); };
          o2.sort((x, y) => sc(x) - sc(y)); p.d = o2[0].k; p.nc = o2[0].c; p.nr = o2[0].r; p.prog = 1;
        }
        const s = Math.min(mv, p.prog); p.prog -= s; mv -= s; p.fx = p.c + (p.nc - p.c) * (1 - p.prog); p.fy = p.r + (p.nr - p.r) * (1 - p.prog);
      }
      chompers = [{ c: Math.round(p.fx), r: Math.round(p.fy), u: (p.fx + 0.5) / COLS, v: (p.fy + 0.5) / ROWS, rad: 0.5, real: false, d: p.d }];
    }

    // comer caramelos
    chompers.forEach((ch) => dots.forEach((d) => {
      if (!d.on) return;
      const dx = (d.c + 0.5) / COLS - ch.u, dy = (d.r + 0.5) / ROWS - ch.v;
      if (Math.hypot(dx * COLS, dy * ROWS) < ch.rad + 0.15) {
        d.on = false; st.score += d.p ? 50 : 10; ev.push(d.p ? 'power' : 'chomp');
        if (d.p) { st.power = Math.max(4, 8 - st.level * 0.5); st.combo = 0; bats.forEach((b) => { b.fright = st.power; }); }
      }
    }));
    if (!left()) { resetDots(); resetBats(); say('OTRA RONDA!', 1.6); ev.push('win'); return ev; }

    // murciélagos
    const lvl = st.level, base = 2.7 + lvl * 0.25;
    bats.forEach((b) => {
      const sp = b.fright > 0 ? base * 0.6 : base;
      const tgts = chompers.length ? chompers : [{ c: 6, r: 5 }];
      const tg = () => { let n = tgts[0], bd = 1e9; tgts.forEach((t) => { const d = (t.c - b.c) ** 2 + (t.r - b.r) ** 2; if (d < bd) { bd = d; n = t; } }); return n; };
      stepBat(b, dt, () => {
        const t = tg(), me = Math.round(b.fx), mr = Math.round(b.fy);
        if (b.i === 0) return { c: t.c, r: t.r };                                           // rojo: persigue directo
        if (b.i === 1) { const k = t.d != null ? t.d : 0; return nearestOpen(Math.max(0, Math.min(COLS - 1, t.c + DIRS[k][0] * 3)), Math.max(0, Math.min(ROWS - 1, t.r + DIRS[k][1] * 3))); } // rosa: embosca
        if (b.i === 2) { const a = bats[0]; return nearestOpen(Math.max(0, Math.min(COLS - 1, 2 * t.c - Math.round(a.fx))), Math.max(0, Math.min(ROWS - 1, 2 * t.r - Math.round(a.fy)))); } // cian: flanquea
        return Math.hypot(t.c - me, t.r - mr) > 5 ? { c: t.c, r: t.r } : { c: 1, r: ROWS - 2 };  // naranja: se acobarda de cerca
      }, sp);
    });

    // choques
    chompers.forEach((ch) => bats.forEach((b) => {
      if (b.wait > 0) return;
      if (Math.hypot((b.fx + 0.5) / COLS * COLS - (ch.u * COLS), (b.fy + 0.5) - ch.v * ROWS) > Math.min(1.1, 0.55 + ch.rad * 0.4)) return;
      if (b.fright > 0) { st.combo++; st.score += 100 * Math.pow(2, st.combo); b.fright = 0; b.c = b.nc = b.home[0]; b.r = b.nr = b.home[1]; b.fx = b.c; b.fy = b.r; b.prog = 0; b.wait = 2; ev.push('eatBat'); }
      else if (ch.real) {
        st.shake = 0.6; st.flash = 1; ev.push('scare'); resetBats(); st.phase = 'ready'; st.t = 1.2; say('READY!', 1.2);
      } else { resetBats(); pumpkin.c = pumpkin.nc = 6; pumpkin.r = pumpkin.nr = 7; pumpkin.fx = 6; pumpkin.fy = 7; pumpkin.prog = 0; }
    }));
    return ev;
  };
  G.restart = function () { G.init(); say('READY!', 2); };
  G.cellOf = cellOf; G.nearestOpen = nearestOpen; G.open = open; G.COLS = COLS; G.ROWS = ROWS;

  /* ---------- dibujo ---------- */
  function drawPumpkin(ctx, x, y, r, dir, mouth, glow) {
    ctx.save(); ctx.translate(x, y);
    if (glow) { ctx.shadowColor = '#ff8a00'; ctx.shadowBlur = r * 0.9; }
    const open = 0.12 + Math.abs(Math.sin(mouth)) * 0.62, a = dir * Math.PI / 2;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.05); g.addColorStop(0, '#ffb347'); g.addColorStop(0.6, '#ff7a00'); g.addColorStop(1, '#c84b00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a + open, a - open + Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(120,40,0,.55)'; ctx.lineWidth = Math.max(1, r * 0.07);
    [-0.45, 0, 0.45].forEach((k) => { ctx.beginPath(); ctx.ellipse(0, 0, r * (0.62 + Math.abs(k) * 0.0) * (1 - Math.abs(k) * 0.5), r * 0.98, 0, 0, Math.PI * 2); ctx.stroke(); });
    ctx.fillStyle = '#2a1200'; const ex = Math.cos(a - 1.1) * r * 0.45, ey = Math.sin(a - 1.1) * r * 0.45;   // ojo tallado
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-r * 0.12, r * 0.14); ctx.lineTo(r * 0.16, 0); ctx.lineTo(-r * 0.12, -r * 0.14); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#3d8f2a'; ctx.beginPath(); ctx.roundRect(-r * 0.1, -r * 1.22, r * 0.2, r * 0.3, r * 0.05); ctx.fill();   // tallo
    ctx.restore();
  }
  function drawBat(ctx, x, y, r, col, flap, fright, flick) {
    ctx.save(); ctx.translate(x, y);
    const w = Math.sin(flap) * 0.45;
    const c = fright > 0 ? (flick ? '#ffffff' : '#4a62ff') : col;
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = r * 0.6;
    [-1, 1].forEach((s) => {   // alas con borde festoneado
      ctx.beginPath(); ctx.moveTo(s * r * 0.2, -r * 0.1);
      ctx.quadraticCurveTo(s * r * 0.9, -r * (0.95 + w), s * r * 1.4, -r * (0.25 + w * 0.6));
      ctx.quadraticCurveTo(s * r * 1.15, -r * 0.05, s * r * 1.2, r * 0.35);
      ctx.quadraticCurveTo(s * r * 0.9, r * 0.1, s * r * 0.75, r * 0.45);
      ctx.quadraticCurveTo(s * r * 0.5, r * 0.15, s * r * 0.2, r * 0.5); ctx.closePath(); ctx.fill();
    });
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.42, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.4); ctx.lineTo(-r * 0.22, -r * 0.8); ctx.lineTo(-r * 0.05, -r * 0.5); ctx.moveTo(r * 0.3, -r * 0.4); ctx.lineTo(r * 0.22, -r * 0.8); ctx.lineTo(r * 0.05, -r * 0.5); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = fright > 0 ? '#fff' : '#fff'; ctx.beginPath(); ctx.arc(-r * 0.16, -r * 0.08, r * 0.12, 0, 7); ctx.arc(r * 0.16, -r * 0.08, r * 0.12, 0, 7); ctx.fill();
    ctx.fillStyle = '#16002b'; ctx.beginPath(); ctx.arc(-r * 0.16, -r * 0.06, r * 0.06, 0, 7); ctx.arc(r * 0.16, -r * 0.06, r * 0.06, 0, 7); ctx.fill();
    ctx.restore();
  }

  /* A = {ax, ay, aw} centro y ancho de la arena en pantalla. humans en px de pantalla para halos. */
  G.draw = function (ctx, A, humans, t) {
    if (!st) return;
    const cs = A.aw / COLS, ah = cs * ROWS, x0 = A.ax - A.aw / 2, y0 = A.ay - ah / 2;
    ctx.save();
    const rv = Math.min(1, (st.age || 0) / 1.8), ez = 1 - Math.pow(1 - rv, 3); ctx.globalAlpha = Math.min(1, rv * 1.6); ctx.translate(A.ax, A.ay); ctx.scale(0.55 + 0.45 * ez, 0.55 + 0.45 * ez); ctx.translate(-A.ax, -A.ay);
    if (st.shake > 0) ctx.translate((Math.random() - 0.5) * 14 * st.shake, (Math.random() - 0.5) * 14 * st.shake);
    // piso azul noche y muros: contornos neón violeta huecos (estética arcade neón)
    const bg = ctx.createRadialGradient(A.ax, A.ay, cs, A.ax, A.ay, A.aw * 0.8); bg.addColorStop(0, 'rgba(10,3,38,.96)'); bg.addColorStop(1, 'rgba(2,0,14,.97)');
    ctx.fillStyle = bg; ctx.fillRect(x0 - cs * 0.2, y0 - cs * 0.2, A.aw + cs * 0.4, ah + cs * 0.4);
    const W = (c, r) => r >= 0 && r < ROWS && c >= 0 && c < COLS && MAP[r][c] === '#', ins = 0.3 * cs;
    const segs = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (W(c, r)) {
      const x = x0 + c * cs, y = y0 + r * cs, n = W(c, r - 1), e = W(c + 1, r), so = W(c, r + 1), w = W(c - 1, r);
      const ext = (along, diag) => (along ? (diag ? ins : 0) - ins * 0 : -ins);   // desplazamiento del extremo respecto al borde de la celda (hacia afuera)
      if (!n) { const l = w ? (W(c - 1, r - 1) ? -ins : 0) : ins, rr = e ? (W(c + 1, r - 1) ? ins : 0) : -ins; segs.push([x + l, y + ins, x + cs - rr * -1 - 0, y + ins]); segs[segs.length - 1][0] = x + l; segs[segs.length - 1][2] = x + cs + rr; }
      if (!so) { const l = w ? (W(c - 1, r + 1) ? -ins : 0) : ins, rr = e ? (W(c + 1, r + 1) ? ins : 0) : -ins; segs.push([x + l, y + cs - ins, x + cs + rr, y + cs - ins]); }
      if (!w) { const t = n ? (W(c - 1, r - 1) ? -ins : 0) : ins, bb = so ? (W(c - 1, r + 1) ? ins : 0) : -ins; segs.push([x + ins, y + t, x + ins, y + cs + bb]); }
      if (!e) { const t = n ? (W(c + 1, r - 1) ? -ins : 0) : ins, bb = so ? (W(c + 1, r + 1) ? ins : 0) : -ins; segs.push([x + cs - ins, y + t, x + cs - ins, y + cs + bb]); }
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const trace = () => { ctx.beginPath(); segs.forEach((q) => { ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); }); ctx.stroke(); };
    ctx.shadowColor = '#8a3dff'; ctx.shadowBlur = cs * 0.55; ctx.strokeStyle = '#7b34ff'; ctx.lineWidth = Math.max(2, cs * 0.14); trace();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#d6b4ff'; ctx.lineWidth = Math.max(1, cs * 0.05); trace();
    // dulces cian y pastillas de poder brillantes
    dots.forEach((d) => {
      if (!d.on) return; const x = x0 + (d.c + 0.5) * cs, y = y0 + (d.r + 0.5) * cs;
      if (d.p) {
        const k = 0.85 + Math.sin(t * 6) * 0.15, R = cs * 0.34 * k;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R * 2.6); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(200,170,255,.9)'); g.addColorStop(0.6, 'rgba(120,60,255,.35)'); g.addColorStop(1, 'rgba(120,60,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.6, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(1, cs * 0.04); ctx.beginPath(); for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + t; ctx.moveTo(x + Math.cos(an) * R * 1.1, y + Math.sin(an) * R * 1.1); ctx.lineTo(x + Math.cos(an) * R * 1.9, y + Math.sin(an) * R * 1.9); } ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
      } else { ctx.shadowColor = '#2fe0e8'; ctx.shadowBlur = cs * 0.2; ctx.fillStyle = '#35e6ee'; ctx.beginPath(); ctx.arc(x, y, Math.max(1.8, cs * 0.075), 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
    });
    // calabaza demo
    if (!humans.some((h) => h.in)) drawPumpkin(ctx, x0 + (pumpkin.fx + 0.5) * cs, y0 + (pumpkin.fy + 0.5) * cs, cs * 0.42, pumpkin.d, pumpkin.mouth, true);
    // murciélagos
    bats.forEach((b) => drawBat(ctx, x0 + (b.fx + 0.5) * cs, y0 + (b.fy + 0.5) * cs + Math.sin(b.flap * 0.5) * cs * 0.05, cs * 0.4, BAT_COL[b.i], b.flap, b.fright, b.fright > 0 && b.fright < 2 && Math.floor(t * 8) % 2 === 0));
    ctx.restore();
    // halos de las personas disfrazadas
    humans.forEach((h) => {
      ctx.save(); ctx.translate(h.x, h.y); const R = Math.max(30, h.r), k = 1 + Math.sin(t * 6) * 0.06;
      ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 4; ctx.shadowColor = '#ffb300'; ctx.shadowBlur = 18; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.05 * k, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
      drawPumpkin(ctx, 0, -R * 1.05 - 26, 18, 0, t * 8, true);
      ctx.restore();
    });
    if (st.flash > 0) { ctx.fillStyle = 'rgba(255,0,60,' + (st.flash * 0.45) + ')'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
  };
  G.drawPumpkin = drawPumpkin;
})();
