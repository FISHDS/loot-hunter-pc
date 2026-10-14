// 合成音效：不需任何音檔，全部即時合成。
(function (root) {
  const LH = root.LH;
  let ctx = null, master = null, enabled = true, vol = 0.35;
  const last = {};

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = vol;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, dur, type, vol, slide, delay) {
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filt, q, delay) {
    const t0 = ctx.currentTime + (delay || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filt || 1200;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0);
  }

  const SOUNDS = {
    swing: () => noise(0.08, 0.12, 2500, 2),
    stab: () => noise(0.05, 0.1, 4200, 3),
    swingHeavy: () => noise(0.18, 0.14, 700, 1.2),
    smash: () => { tone(85, 0.25, 'sine', 0.3, 0.5); noise(0.2, 0.25, 380, 0.8); },
    bow: () => { noise(0.06, 0.12, 3000, 3); tone(500, 0.05, 'triangle', 0.05, 0.5); },
    zap: () => tone(900, 0.08, 'sawtooth', 0.05, 0.4),
    hit: (o) => {
      if (o && o.elem === 'fire') noise(0.15, 0.2, 600, 0.8);
      else if (o && o.elem === 'cold') tone(1400, 0.12, 'triangle', 0.08, 0.7);
      else if (o && o.elem === 'light') noise(0.1, 0.18, 4000, 4);
      else noise(0.07, 0.22, 900, 1.5);
    },
    hurt: () => { tone(160, 0.12, 'square', 0.12, 0.5); },
    block: () => tone(1800, 0.06, 'square', 0.06, 0.8),
    die: () => { noise(0.18, 0.18, 500, 0.7); tone(220, 0.15, 'triangle', 0.08, 0.4); },
    bossDie: () => { noise(1.2, 0.4, 300, 0.5); tone(110, 1.0, 'sawtooth', 0.15, 0.3); for (let i = 0; i < 5; i++) tone(440 * Math.pow(1.25, i), 0.3, 'triangle', 0.08, 1, 0.4 + i * 0.1); },
    heroDie: () => { tone(330, 0.5, 'triangle', 0.15, 0.4); tone(247, 0.8, 'triangle', 0.12, 0.4, 0.3); },
    drop: (o) => {
      const r = (o && o.r) || 0;
      const base = [520, 620, 700, 820, 880, 990][r];
      tone(base, 0.18, 'triangle', 0.08 + r * 0.02);
      if (r >= 2) tone(base * 1.5, 0.25, 'triangle', 0.07, 1, 0.08);
      if (r >= 4) { tone(base * 2, 0.5, 'sine', 0.1, 1, 0.16); tone(base * 2.5, 0.7, 'sine', 0.08, 1, 0.26); }
      if (r >= 5) for (let i = 0; i < 6; i++) tone(base * (1 + i * 0.25), 0.3, 'sine', 0.05, 1, 0.35 + i * 0.07);
    },
    uniq: () => {
      tone(98, 1.4, 'triangle', 0.16, 0.6);
      noise(0.7, 0.12, 2600, 1.5);
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 1.3, 'sine', 0.085, 1, 0.05 + i * 0.07));
      [1568, 2093, 2637].forEach((f, i) => tone(f, 0.7, 'sine', 0.05, 1, 0.55 + i * 0.12));
    },
    omen: () => { tone(2400, 1.3, 'sine', 0.035, 0.35); },
    explode: () => { noise(0.35, 0.28, 420, 0.7); tone(95, 0.3, 'sine', 0.18, 0.5); },
    potion: () => { for (let i = 0; i < 3; i++) tone(300 + i * 140, 0.08, 'sine', 0.06, 1.4, i * 0.05); },
    tele: () => { tone(70, 0.9, 'sawtooth', 0.12, 1.6); noise(0.8, 0.12, 200, 0.6); },
    slam: () => { noise(0.4, 0.4, 180, 0.6); tone(60, 0.4, 'sine', 0.3, 0.5); },
    interrupt: () => { tone(1200, 0.08, 'square', 0.1); tone(1600, 0.12, 'square', 0.08, 1, 0.06); },
    level: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, 1, i * 0.09)); },
    bossIntro: () => { tone(55, 1.4, 'sawtooth', 0.2, 1.2); tone(82, 1.4, 'sawtooth', 0.12, 1.1, 0.1); noise(1.2, 0.2, 150, 0.5); },
    click: () => tone(700, 0.04, 'square', 0.04),
    buy: () => { tone(880, 0.06, 'square', 0.05); tone(1320, 0.1, 'square', 0.05, 1, 0.05); },
    sell: () => { tone(1200, 0.05, 'triangle', 0.06); tone(1600, 0.08, 'triangle', 0.06, 1, 0.04); },
    error: () => tone(140, 0.15, 'square', 0.08),
    clear: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.3, 'triangle', 0.09, 1, i * 0.1)); },
    victory: () => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, 1, i * 0.12)); },
  };
  const SKILL_SOUND = {
    thrust: () => noise(0.1, 0.2, 2000, 2),
    cleave: () => { noise(0.2, 0.3, 700, 1); tone(140, 0.2, 'sawtooth', 0.1, 0.5); },
    whirl: () => { noise(0.3, 0.25, 1500, 1); },
    breaker: () => { noise(0.25, 0.4, 300, 0.7); tone(90, 0.25, 'square', 0.15, 0.5); },
    aimed: () => { noise(0.08, 0.15, 3500, 3); tone(1200, 0.1, 'sine', 0.06, 0.6); },
    pierce: () => { noise(0.18, 0.18, 2800, 2); },
    fan: () => { for (let i = 0; i < 4; i++) noise(0.05, 0.1, 3000, 3, i * 0.04); },
    bolt: () => { noise(0.25, 0.3, 5000, 1); tone(80, 0.2, 'sawtooth', 0.12, 2); },
    firewell: () => { noise(0.5, 0.3, 500, 0.6); },
    frost: () => { for (let i = 0; i < 4; i++) tone(1800 + i * 300, 0.25, 'sine', 0.05, 0.9, i * 0.03); },
    manabolt: () => tone(1100, 0.15, 'sine', 0.08, 1.8),
    stoneskin: () => { noise(0.3, 0.25, 250, 0.8); },
    heal: () => { [660, 880, 1100].forEach((f, i) => tone(f, 0.3, 'sine', 0.06, 1, i * 0.06)); },
    static: () => { noise(0.3, 0.15, 4500, 2); tone(220, 0.3, 'sawtooth', 0.05, 1.5); },
    rift: () => { for (let i = 0; i < 5; i++) tone(900 + i * 120, 0.1, 'triangle', 0.06, 0.8, i * 0.04); noise(0.2, 0.2, 800, 1); },
    quake: () => { noise(0.6, 0.45, 120, 0.6); tone(50, 0.5, 'sine', 0.3, 0.6); },
    meteor: () => { tone(900, 0.4, 'sawtooth', 0.05, 0.15); noise(0.5, 0.4, 300, 0.7, 0.25); tone(60, 0.4, 'sine', 0.3, 0.5, 0.25); },
    moltenCleave: () => { noise(0.2, 0.25, 900, 1); tone(300, 0.2, 'sawtooth', 0.06, 0.5); },
    starBolt: () => { [1320, 1760, 2200].forEach((f, i) => tone(f, 0.3, 'sine', 0.05, 0.7, i * 0.04)); noise(0.3, 0.25, 4200, 1.5, 0.08); },
    iceComet: () => { noise(0.2, 0.2, 3200, 2); tone(1500, 0.25, 'triangle', 0.06, 0.6); },
  };

  function play(name, opts) {
    if (!enabled) return;
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (document.hidden) return;
    const now = performance.now();
    const gap = name === 'hit' || name === 'swing' || name === 'stab' || name === 'hurt' ? 45 : 25;
    if (last[name] && now - last[name] < gap) return;
    last[name] = now;
    try {
      if (name.startsWith('skill_')) { const f = SKILL_SOUND[name.slice(6)]; if (f) f(); }
      else if (SOUNDS[name]) SOUNDS[name](opts);
    } catch (e) { /* 忽略音效錯誤 */ }
  }

  LH.Sfx = {
    play,
    unlock: () => { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    set enabled(v) { enabled = v; },
    ctx: () => ensure(),
    // 音量：0 關、1 小、2 中、3 大
    setLevel(v) { enabled = v > 0; vol = [0, 0.12, 0.23, 0.35][v]; if (master) master.gain.value = vol; },
    get enabled() { return enabled; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
