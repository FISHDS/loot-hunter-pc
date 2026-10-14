// 背景音樂：全部即時合成，不需要音檔。每個場景一首，換場景時淡入淡出，頭目戰切換戰鬥曲。
(function (root) {
  const LH = root.LH;
  const VOL = [0, 0.09, 0.17, 0.28];
  let ctx = null, out = null, verb = null, noiseBuf = null;
  let level = 2, cur = null, wantId = null, timer = null;
  const fading = [];
  let rs = 12345;
  const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);

  function setup() {
    if (out) return true;
    ctx = LH.Sfx && LH.Sfx.ctx();
    if (!ctx) return false;
    out = ctx.createGain();
    out.gain.value = VOL[level];
    out.connect(ctx.destination);
    // 洞穴殘響：用衰減的雜訊當作空間感
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = ir;
    verb.connect(out);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    timer = setInterval(tick, 60);
    return true;
  }

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // 一個音：振盪器 → （低通）→ 音量包絡 → 這首曲子的匯流
  function note(tr, t, midi, dur, o) {
    o = o || {};
    const osc = ctx.createOscillator();
    osc.type = o.type || 'triangle';
    osc.frequency.setValueAtTime(mtof(midi), t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(mtof(midi + o.glide), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const v = o.vol || 0.08, a = o.att || 0.01, r = o.rel || 0.2;
    const hold = Math.max(a, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + hold + r);
    let node = osc;
    if (o.cut) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = o.cut; f.Q.value = o.q || 0.8;
      osc.connect(f); node = f;
    }
    node.connect(g);
    g.connect(tr.bus);
    osc.start(t);
    osc.stop(t + hold + r + 0.05);
  }
  // 打擊：大鼓、小鼓、鈸、水滴
  function drum(tr, t, kind, vol) {
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g); g.connect(tr.bus); o.start(t); o.stop(t + 0.3);
      return;
    }
    if (kind === 'drip') { note(tr, t, 88 + Math.floor(rnd() * 8), 0.02, { type: 'sine', vol, rel: 0.25, glide: 5 }); return; }
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1700;
    const g = ctx.createGain();
    const d = kind === 'hat' ? 0.045 : 0.16;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(tr.bus);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  }

  // ---------- 曲目 ----------
  // 每首：速度（每分鐘拍數）、和弦進行（每小節一個，第一個音是低音）、殘響量、每一格（十六分音符）要彈什麼
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const TRACKS = {
    title: {
      bpm: 60, wet: 0.55,
      chords: [[38, 50, 53, 57], [34, 46, 50, 53], [36, 48, 52, 55], [33, 45, 48, 52]],
      step(tr, s, t, ch, bar) {
        if (s === 0) {
          note(tr, t, ch[0], 3.6, { type: 'sine', vol: 0.12, att: 0.4, rel: 1.2 });
          for (const m of ch.slice(1)) {
            note(tr, t, m, 3.4, { type: 'sawtooth', vol: 0.016, att: 1.4, rel: 1.6, cut: 900, detune: -7 });
            note(tr, t, m, 3.4, { type: 'sawtooth', vol: 0.016, att: 1.4, rel: 1.6, cut: 900, detune: 7 });
          }
        }
        if (s % 4 === 2 && rnd() < 0.45) note(tr, t, pick([74, 77, 79, 81, 84, 86]), 0.08, { type: 'triangle', vol: 0.045, rel: 1.8 });
      },
    },
    camp: {
      bpm: 84, wet: 0.35,
      chords: [[41, 53, 57, 60], [38, 50, 53, 57], [34, 46, 50, 53], [36, 48, 52, 55]],
      step(tr, s, t, ch, bar) {
        if (s === 0 || s === 8) note(tr, t, ch[0], 1.2, { type: 'sine', vol: 0.11, att: 0.05, rel: 0.6 });
        if (s === 0) for (const m of ch.slice(1)) note(tr, t, m - 12, 2.6, { type: 'triangle', vol: 0.018, att: 0.8, rel: 1.2 });
        if (s % 2 === 0) {
          const arp = [ch[1], ch[2], ch[3], ch[2] + 12, ch[3] + 12, ch[1] + 12, ch[2] + 12, ch[3]];
          note(tr, t, arp[(s / 2) % 8], 0.06, { type: 'triangle', vol: 0.05, rel: 0.45, cut: 2600 });
        }
        if (bar % 2 === 1 && s % 4 === 0 && rnd() < 0.5) note(tr, t, pick([72, 74, 77, 79, 81]), 0.25, { type: 'sine', vol: 0.035, rel: 0.8 });
      },
    },
    mine: {
      bpm: 92, wet: 0.5,
      chords: [[40, 52, 55, 59], [41, 53, 57, 60], [40, 52, 55, 59], [38, 50, 54, 57]],
      step(tr, s, t, ch, bar) {
        if (s % 2 === 0) note(tr, t, ch[0] + (s % 8 === 6 ? 12 : 0), 0.12, { type: 'triangle', vol: 0.1, rel: 0.12, cut: 700 });
        if (s === 0) for (const m of ch.slice(1)) note(tr, t, m, 2.4, { type: 'sawtooth', vol: 0.012, att: 1, rel: 1.4, cut: 520 });
        if (s === 0 || s === 8) drum(tr, t, 'kick', 0.18);
        if (s === 4 || s === 12) drum(tr, t, 'hat', 0.03);
        if (rnd() < 0.08) drum(tr, t, 'drip', 0.04);
        if (bar % 4 === 3 && s % 4 === 0) note(tr, t, ch[1] + 12 + pick([0, 3, 7]), 0.2, { type: 'square', vol: 0.018, rel: 0.4, cut: 1800 });
      },
    },
    bog: {
      bpm: 66, wet: 0.65,
      chords: [[36, 48, 51, 55], [32, 44, 48, 51], [29, 53, 56, 60], [31, 43, 47, 50]],
      step(tr, s, t, ch, bar) {
        if (s === 0) {
          note(tr, t, ch[0], 3.6, { type: 'sawtooth', vol: 0.05, att: 0.6, rel: 1.4, cut: 260 });
          for (const m of ch.slice(1)) {
            note(tr, t, m, 3.2, { type: 'sawtooth', vol: 0.014, att: 1.6, rel: 1.8, cut: 700, detune: -12 });
            note(tr, t, m, 3.2, { type: 'sawtooth', vol: 0.014, att: 1.6, rel: 1.8, cut: 700, detune: 12 });
          }
        }
        // 心跳般的兩下低鼓
        if (s === 0 || s === 2) drum(tr, t, 'kick', s ? 0.09 : 0.14);
        // 遠處的哀鳴
        if (bar % 2 === 1 && s === 8) note(tr, t, pick([72, 75, 78]), 1.8, { type: 'sine', vol: 0.03, att: 0.5, rel: 1.2, glide: -4 });
        if (s % 4 === 2 && rnd() < 0.25) note(tr, t, pick([75, 78, 79, 84]), 0.05, { type: 'triangle', vol: 0.03, rel: 1.4 });
      },
    },
    forge: {
      bpm: 100, wet: 0.4,
      chords: [[38, 50, 53, 57], [38, 50, 53, 56], [34, 46, 50, 53], [36, 48, 51, 55]],
      step(tr, s, t, ch, bar) {
        // 鍛造廠：低音重拍加上鐵鎚敲擊
        if (s % 4 === 0) note(tr, t, ch[0], 0.18, { type: 'sawtooth', vol: 0.08, rel: 0.15, cut: 500, q: 2 });
        if (s % 4 === 2) note(tr, t, ch[0] + 12, 0.08, { type: 'sawtooth', vol: 0.04, rel: 0.1, cut: 700 });
        if (s === 0 || s === 6 || s === 8) drum(tr, t, 'kick', 0.2);
        if (s === 4 || s === 12) {
          note(tr, t, 96, 0.02, { type: 'square', vol: 0.03, rel: 0.25 });
          note(tr, t, 101, 0.02, { type: 'square', vol: 0.02, rel: 0.2 });
          drum(tr, t, 'snare', 0.08);
        }
        if (s === 0) for (const m of ch.slice(1)) note(tr, t, m, 2.2, { type: 'sawtooth', vol: 0.012, att: 0.6, rel: 1, cut: 650 });
        if (bar % 2 === 1 && s >= 8 && s % 2 === 0 && rnd() < 0.6) note(tr, t, ch[1] + 12 + pick([0, 1, 4, 5]), 0.12, { type: 'triangle', vol: 0.03, rel: 0.2 });
      },
    },
    observatory: {
      bpm: 76, wet: 0.65,
      chords: [[41, 53, 57, 60, 64], [38, 50, 53, 57, 62], [36, 48, 52, 55, 59], [43, 55, 59, 62, 66]],
      step(tr, s, t, ch, bar) {
        // 星空：長長的和聲墊、緩慢的鐘聲琶音、偶爾閃過的高音
        if (s === 0) for (const m of ch.slice(1)) note(tr, t, m, 3.4, { type: 'sine', vol: 0.016, att: 1.2, rel: 1.8 });
        if (s === 0 || s === 8) note(tr, t, ch[0], 1.6, { type: 'triangle', vol: 0.045, att: 0.2, rel: 1 });
        if (s % 2 === 0) {
          const arp = [ch[1], ch[2], ch[3], ch[4], ch[3], ch[2], ch[1] + 12, ch[3]];
          note(tr, t, arp[(s / 2) % 8] + 12, 0.1, { type: 'sine', vol: 0.028, rel: 0.9 });
        }
        if (rnd() < 0.12) note(tr, t, pick([84, 88, 91, 96]), 0.04, { type: 'triangle', vol: 0.018, rel: 1.6 });
        if (s === 12 && bar % 2) drum(tr, t, 'kick', 0.05);
      },
    },
    boss: {
      bpm: 138, wet: 0.25,
      chords: [[45, 57, 60, 64], [41, 53, 57, 60], [43, 55, 59, 62], [40, 52, 56, 59]],
      step(tr, s, t, ch, bar) {
        const oct = [0, 0, 12, 0, 0, 12, 0, 7];
        if (s % 2 === 0) note(tr, t, ch[0] - 12 + oct[(s / 2) % 8], 0.1, { type: 'sawtooth', vol: 0.07, rel: 0.08, cut: 950, q: 3 });
        if (s % 4 === 0) drum(tr, t, 'kick', 0.24);
        if (s === 10) drum(tr, t, 'kick', 0.16);
        if (s === 4 || s === 12) drum(tr, t, 'snare', 0.14);
        if (s % 2 === 1) drum(tr, t, 'hat', 0.025);
        if ([0, 3, 6, 8, 11, 14].includes(s)) {
          const lead = [ch[1], ch[2], ch[3], ch[2], ch[3], ch[1] + 12];
          note(tr, t, lead[[0, 3, 6, 8, 11, 14].indexOf(s)] + 12, 0.09, { type: 'square', vol: 0.022, rel: 0.1, cut: 2600 });
        }
        if (s === 0) for (const m of ch.slice(1)) note(tr, t, m, 0.5, { type: 'sawtooth', vol: 0.018, att: 0.02, rel: 0.5, cut: 1600 });
        if (bar % 4 === 3 && s >= 8 && s % 2 === 0) note(tr, t, ch[3] + 12 + (s - 8), 0.08, { type: 'square', vol: 0.02, rel: 0.1, cut: 3000 });
      },
    },
  };

  function makeTrack(id) {
    const def = TRACKS[id];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.6);
    bus.connect(out);
    const send = ctx.createGain();
    send.gain.value = def.wet;
    bus.connect(send);
    send.connect(verb);
    return { id, def, bus, send, step: 0, next: ctx.currentTime + 0.1 };
  }
  function schedule(tr) {
    const dt = 60 / tr.def.bpm / 4;
    while (tr.next < ctx.currentTime + 0.3) {
      const s = tr.step % 16, bar = Math.floor(tr.step / 16);
      const ch = tr.def.chords[bar % tr.def.chords.length];
      try { tr.def.step(tr, s, tr.next, ch, bar); } catch (e) { /* 忽略單一音符錯誤 */ }
      tr.next += dt;
      tr.step++;
    }
  }
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    // 視窗在背景時停止排程，回來再接上，避免音樂卡頓
    if (document.hidden) { if (cur) cur.next = ctx.currentTime + 0.1; return; }
    if (wantId !== (cur && cur.id)) {
      if (cur) fadeOut(cur);
      cur = wantId && level > 0 ? makeTrack(wantId) : null;
    }
    if (cur) schedule(cur);
    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i];
      if (ctx.currentTime < f.end) schedule(f.tr);
      else { f.tr.bus.disconnect(); f.tr.send.disconnect(); fading.splice(i, 1); }
    }
  }
  function fadeOut(tr) {
    const t = ctx.currentTime;
    tr.bus.gain.cancelScheduledValues(t);
    tr.bus.gain.setValueAtTime(Math.max(0.0001, tr.bus.gain.value), t);
    tr.bus.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    fading.push({ tr, end: t + 1.6 });
  }

  LH.Music = {
    // 指定現在該放哪一首（每個畫面每一格呼叫都可以，沒變就不做事）
    want(id) {
      wantId = level > 0 ? id : null;
      if (wantId && !out) setup();
    },
    setLevel(v) {
      level = v;
      if (out) out.gain.setTargetAtTime(VOL[v], ctx.currentTime, 0.2);
      if (!v) wantId = null;
    },
    get level() { return level; },
    get playing() { return cur ? cur.id : null; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
