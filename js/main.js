// 啟動與主迴圈：畫面可見時用影格更新；縮小或切到背景時改用計時器繼續戰鬥。
(function () {
  const LH = window.LH;
  const { Game, UI, Render, D } = LH;

  let G = null;
  let last = performance.now();
  let saveT = 0;
  let started = false;

  function persist() {
    if (G && !LH.noSave) Game.save(G);
  }
  UI.onSave = persist;
  UI.replaceGame = (g) => { G = g; UI.G = G; persist(); UI.show('camp'); };

  function begin(game) {
    G = game;
    UI.G = G;
    LH.Sfx.setLevel(G.settings.sfxVol);
    LH.Music.setLevel(G.settings.musicVol);
    Render.setZoom(G.settings.zoom || 1.5);
    started = true;
    if (G.run) {
      UI.show('dungeon');
      if (G.run.phase === 'cleared' && G.run.mode === 'active') UI.openLoot();
    } else UI.show('camp');
    if (G.notice) { UI.showNotice(G.notice); G.notice = null; }
    else if (G.offline) { UI.showOffline(G.offline); G.offline = null; }
    else if (!G.hints.intro && !G.run) { G.hints.intro = true; UI.showHelp(); }
    persist();
  }

  // ---------- 核心更新 ----------
  function step(realDt) {
    if (!G) return;
    const run = G.run;
    if (run) {
      const wasPhase = run.phase;
      Game.update(G, realDt);
      if (G.run && G.run.phase === 'cleared' && G.run.mode === 'active' && UI.modalKind !== 'loot' && UI.screen === 'dungeon') {
        UI.openLoot();
        persist();
      }
      if (!G.run) {
        // 本趟結束
        const rep = G.lastReport;
        persist();
        if (G.idleNext != null && UI.screen === 'dungeon') {
          showIdleOverlay(rep);
        } else if (UI.screen === 'dungeon' && rep && UI.lastReportShown !== rep.id) {
          UI.afterRun(rep);
        }
      }
      void wasPhase;
    }
    // 掛機循環倒數
    if (!G.run && G.idleNext != null) {
      G.idleNext -= realDt;
      if (G.idleNext <= 0) {
        G.idleNext = null;
        Game.startRun(G);
        Render.reset();
        if (UI.screen === 'dungeon') UI.buildHud();
        persist();
      }
    }
    saveT += realDt;
    if (saveT > 5) { saveT = 0; persist(); }
  }

  // 背景音樂：營地、各章節、頭目戰
  function musicFor() {
    if (UI.screen === 'dungeon' && G && G.run) {
      if (G.run.mobs.some((m) => m.boss && m.hp > 0 && !m.dead)) return 'boss';
      return G.run.dungeon || 'mine';
    }
    return 'camp';
  }

  function showIdleOverlay(rep) {
    const ov = document.getElementById('ov-msg');
    const how = { victory: '勝利', retreat: '撤退', death: '倒下' }[rep.how];
    ov.innerHTML = `<div class="big">${how}・帶回 ${rep.brought.length} 件</div>
      <div style="color:var(--muted)">經驗 +${rep.xp}｜賣得 ${rep.gold} 金${rep.idleNote ? '｜' + rep.idleNote : ''}</div>
      <div style="color:var(--muted)">掛機循環：馬上再次出發…</div>
      <button class="btn" data-act="stopIdle">停止掛機，回營地</button>`;
    ov.classList.add('on');
  }

  function frame(now) {
    const real = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.1, real);
    last = now;
    if (started) {
      // 好寶物掉落時戰鬥頓一下（畫面特效照常播放）
      let simReal = real;
      if (Render.R.hitstop > 0) { Render.R.hitstop -= real; simReal = real * 0.05; }
      step(simReal); // 模擬用真實經過時間，影格變慢也不會拖慢戰鬥
      if (UI.screen === 'dungeon' && G.run) {
        Render.draw(G.run, dt);
        UI.updateHud();
        const ov = document.getElementById('ov-msg');
        if (ov.classList.contains('on') && G.run.phase === 'fight') ov.classList.remove('on');
      }
      if (UI.screen === 'camp') UI.drawCamp(dt);
      LH.Music.want(musicFor());
    } else { drawTitle(dt); LH.Music.want('title'); }
    requestAnimationFrame(frame);
  }

  // 背景時影格會停，用計時器補上時間
  // 背景、縮小或畫面被遮住時影格可能停止，計時器發現超過 0.3 秒沒更新就補上
  setInterval(() => {
    LH.Music.want(started ? musicFor() : 'title');
    if (!started) return;
    const now = performance.now();
    if (now - last < 300) return;
    const dt = (now - last) / 1000;
    last = now;
    step(dt);
    if (G && G.run) { G.run.fx.length = 0; G.run.msgs.length = 0; }
  }, 500);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) last = performance.now() - 16;
    persist();
  });
  window.addEventListener('beforeunload', persist);

  // ---------- 標題畫面動畫：多層洞穴視差、光束、霧氣、營火 ----------
  const tcv = document.getElementById('title-cv');
  const tx = tcv.getContext('2d');
  let tt = 0;
  const motes = [];
  const crystals = [];
  const fogs = [];
  let layers = [];
  let mouseX = 0, mouseY = 0;
  let titleLook = {};
  window.addEventListener('mousemove', (e) => { mouseX = e.clientX / innerWidth - 0.5; mouseY = e.clientY / innerHeight - 0.5; });

  // 一層洞穴剪影：上方鐘乳石、下方石筍，寬度為畫面兩倍以便循環捲動
  function caveLayer(W, H, o) {
    const LW = W * 2;
    const c = document.createElement('canvas');
    c.width = LW; c.height = H;
    const x = c.getContext('2d');
    let s = o.seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const edge = (base, dir, spike, len) => {
      x.beginPath();
      x.moveTo(0, dir > 0 ? 0 : H);
      for (let px = 0; px <= LW; px += 3) {
        const y = base + Math.sin((px / LW) * Math.PI * 2 * 3 + o.seed) * base * 0.35 + Math.sin((px / LW) * Math.PI * 2 * 7) * base * 0.15;
        const yy = dir > 0 ? y : H - y;
        x.lineTo(px, yy);
        if (r() < spike && px > 4 && px < LW - 12) {
          const l = len * (0.3 + r()), w = 3 + r() * 6;
          x.lineTo(px + w / 2, yy + dir * l);
          x.lineTo(px + w, yy);
          px += w;
        }
      }
      x.lineTo(LW, dir > 0 ? 0 : H);
      x.closePath();
      x.fill();
    };
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, o.col); g.addColorStop(0.5, o.mid || o.col); g.addColorStop(1, o.col);
    x.fillStyle = g;
    edge(o.top, 1, o.spike, o.len);
    edge(o.bot, -1, o.spike * 0.7, o.len * 0.7);
    return c;
  }

  function sizeTitle() {
    tcv.width = Math.ceil(innerWidth / 3);
    tcv.height = Math.ceil(innerHeight / 3);
    const W = tcv.width, H = tcv.height;
    layers = [
      { c: caveLayer(W, H, { seed: 11, col: '#2a1c44', mid: '#1c1230', top: H * 0.16, bot: H * 0.2, spike: 0.12, len: H * 0.22 }), speed: 2, depth: 4 },
      { c: caveLayer(W, H, { seed: 23, col: '#140c22', top: H * 0.1, bot: H * 0.13, spike: 0.07, len: H * 0.22 }), speed: 5, depth: 9 },
      { c: caveLayer(W, H, { seed: 37, col: '#07040b', top: H * 0.04, bot: H * 0.07, spike: 0.05, len: H * 0.26 }), speed: 9, depth: 16 },
    ];
    crystals.length = 0;
    for (let i = 0; i < 22; i++) {
      const top = i % 2 === 0;
      crystals.push({ x: Math.random() * W * 2, y: top ? 6 + Math.random() * H * 0.1 : H - 8 - Math.random() * H * 0.1, v: i % 3, s: 8 + Math.random() * 9, flip: top, ph: Math.random() * 6, layer: i % 3 === 0 ? 1 : 2 });
    }
    fogs.length = 0;
    for (let i = 0; i < 7; i++) fogs.push({ x: Math.random() * W, y: H * (0.62 + Math.random() * 0.3), r: 40 + Math.random() * 50, v: 2 + Math.random() * 4 });
  }
  sizeTitle();
  window.addEventListener('resize', sizeTitle);

  function drawTitle(dt) {
    tt += dt;
    const W = tcv.width, H = tcv.height;
    tx.imageSmoothingEnabled = false;
    const g = tx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, '#4a2d68'); g.addColorStop(0.45, '#22143a'); g.addColorStop(1, '#0a0612');
    tx.fillStyle = g;
    tx.fillRect(0, 0, W, H);
    // 遠方的光束
    tx.save();
    tx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const bx = W * (0.25 + i * 0.17) + Math.sin(tt * 0.3 + i * 1.7) * 12 - mouseX * 6;
      const a = 0.05 + 0.025 * Math.sin(tt * 0.7 + i * 2);
      const lg = tx.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, `rgba(190,150,255,${a})`); lg.addColorStop(1, 'rgba(190,150,255,0)');
      tx.fillStyle = lg;
      tx.beginPath(); tx.moveTo(bx - 6, 0); tx.lineTo(bx + 8, 0); tx.lineTo(bx + 40, H); tx.lineTo(bx + 2, H); tx.fill();
    }
    tx.restore();
    // 三層洞穴剪影（越近移動越快）
    layers.forEach((L, li) => {
      const LW = L.c.width;
      let off = (tt * L.speed + mouseX * L.depth * 2) % (LW / 2);
      if (off < 0) off += LW / 2;
      const oy = Math.round(mouseY * L.depth * 0.6);
      tx.drawImage(L.c, -Math.round(off), oy);
      tx.drawImage(L.c, -Math.round(off) + LW, oy);
      // 嵌在這一層的黑晶
      for (const c of crystals) {
        if (c.layer !== li) continue;
        let cxp = (c.x - off) % LW;
        if (cxp < -20) cxp += LW;
        if (cxp > W + 20) continue;
        const col = ['127,231,255', '180,108,255', '92,255,176'][c.v];
        const cy2 = c.y + oy;
        const gl = tx.createRadialGradient(cxp, cy2, 0, cxp, cy2, c.s * 2.2);
        gl.addColorStop(0, `rgba(${col},${0.28 + Math.sin(tt * 1.5 + c.ph) * 0.12})`);
        gl.addColorStop(1, `rgba(${col},0)`);
        tx.fillStyle = gl;
        tx.fillRect(cxp - c.s * 2.2, cy2 - c.s * 2.2, c.s * 4.4, c.s * 4.4);
        tx.save();
        tx.translate(Math.round(cxp), Math.round(cy2));
        if (c.flip) tx.scale(1, -1);
        tx.drawImage(LH.Spr.get('crystal' + c.v), -c.s / 2, -c.s / 2, c.s, c.s);
        tx.restore();
      }
    });
    // 地上的霧
    for (const f of fogs) {
      f.x += f.v * dt;
      if (f.x - f.r > W) f.x = -f.r;
      const fg = tx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      fg.addColorStop(0, 'rgba(120,90,170,0.09)'); fg.addColorStop(1, 'rgba(120,90,170,0)');
      tx.fillStyle = fg;
      tx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
    // 飄浮光點
    if (motes.length < 110) motes.push({ x: Math.random() * W, y: H + 4, vy: -4 - Math.random() * 8, vx: (Math.random() - 0.5) * 3, c: Math.random() < 0.5 ? '#b46cff' : '#7fe7ff', t: 0, s: Math.random() < 0.15 ? 2 : 1 });
    for (const m of motes) {
      m.t += dt; m.x += m.vx * dt + Math.sin(m.t * 2) * 0.05; m.y += m.vy * dt;
      tx.globalAlpha = Math.min(1, m.t) * (0.5 + 0.4 * Math.sin(m.t * 3 + m.x));
      tx.fillStyle = m.c;
      tx.fillRect(Math.round(m.x), Math.round(m.y), m.s, m.s);
    }
    tx.globalAlpha = 1;
    for (let i = motes.length - 1; i >= 0; i--) if (motes[i].y < -4) motes.splice(i, 1);
    // 前景：英雄坐在營火旁
    const fx = W * 0.8, fy = H * 0.9;
    const fl = 1 + Math.sin(tt * 9) * 0.06 + Math.sin(tt * 23) * 0.04;
    const lg = tx.createRadialGradient(fx, fy, 2, fx, fy, 80 * fl);
    lg.addColorStop(0, 'rgba(255,150,60,0.42)'); lg.addColorStop(1, 'rgba(255,120,40,0)');
    tx.fillStyle = lg; tx.fillRect(fx - 90, fy - 90, 180, 180);
    tx.fillStyle = 'rgba(0,0,0,0.45)';
    tx.beginPath(); tx.ellipse(fx - 18, fy + 3, 9, 2.5, 0, 0, 7); tx.fill();
    tx.drawImage(LH.Spr.get('fire' + (Math.floor(tt * 8) % 3)), fx - 8, fy - 12, 16, 16);
    const hf = LH.Spr.heroFrames(titleLook);
    tx.drawImage(hf.idle[Math.floor(tt * 1.6) % 2], fx - 32, fy - 23, 22, 26);
    if (Math.random() < dt * 10) motes.push({ x: fx + (Math.random() - 0.5) * 6, y: fy - 8, vy: -14 - Math.random() * 14, vx: (Math.random() - 0.5) * 6, c: Math.random() < 0.5 ? '#ffb347' : '#ffd36b', t: 0.5, s: 1 });
  }

  // ---------- 啟動 ----------
  UI.initEvents();
  UI.initTips();
  Render.init(document.getElementById('cv'));
  Render.R.onDrop = (r, fx, fy) => UI.onDrop(r, fx, fy);

  const saved = Game.load();
  if (saved) Game.applyOffline(saved, Date.now());
  UI.titleButtons(!!saved, () => begin(saved), () => { Game.wipe(); begin(Game.newGame()); });
  document.getElementById('t-emblem').src = LH.Spr.emblemURL(3);
  if (saved) titleLook = LH.Spr.lookOf(saved.gear);
  // 標題畫面：點一下任何地方就開始播放音樂（瀏覽器規定要先有點擊）
  if (saved && saved.settings && saved.settings.musicVol !== undefined) LH.Music.setLevel(saved.settings.musicVol);
  document.getElementById('title').addEventListener('pointerdown', () => LH.Sfx.unlock());
  requestAnimationFrame(frame);
  window.__LH_G = () => G; // 方便除錯
})();
