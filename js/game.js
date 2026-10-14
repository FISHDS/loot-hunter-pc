// 遊戲狀態：營地操作、出征生命週期、掛機循環、存檔與離線收益。
(function (root) {
  const LH = root.LH;
  const { U, D, Items, Pack, Char, Sim } = LH;

  const SAVE_KEY = 'lhcc_save_v1';

  function newGame() {
    const G = {
      version: 1, created: Date.now(), lastSave: Date.now(),
      hero: { level: 1, xp: 0, attrs: { str: 5, dex: 5, int: 5 }, unspent: 0 },
      gold: 0,
      gear: { weapon: Items.starterKnife() },
      stash: [], stashCap: D.ECON.stashBase, stashBuys: 0, packSize: 5,
      stars: { owned: ['C0'], paid: { C0: 0 }, choice: {}, refunds: 0 },
      autocast: { rules: [], red: 0.4, blue: 0.25, retreatHp: 0.4 },
      exp: { dungeon: 'mine', diff: 0, wave: 1, mode: 'active', speed: 1, red: 0, blue: 0, autoBuy: true },
      potions: { red: 0, blue: 0 },
      unlocked: { mine: 0, bog: -1, forge: -1, observatory: -1 },
      records: [], recent: [],
      idle: { cur: null, streak: 0, stopped: false, summary: null },
      loadouts: [null, null, null],
      hints: {}, stats: { runs: 0, wins: 0, deaths: 0, best: -1, kills: 0 },
      run: null, offline: null, rng: (Date.now() & 0x7fffffff) >>> 0,
      settings: { sound: true, sfxVol: 3, musicVol: 2, zoom: 1.5 },
      codex: {},
    };
    syncRules(G);
    return G;
  }

  // ---------- 經驗與等級 ----------
  function addXp(G, run, xp) {
    G.hero.xp += xp;
    if (run) run.xp += xp;
    while (G.hero.xp >= D.ECON.xpToNext(G.hero.level)) {
      G.hero.xp -= D.ECON.xpToNext(G.hero.level);
      G.hero.level++;
      G.hero.unspent += D.ECON.pointsPerLevel;
      if (run) {
        run.levelUps = (run.levelUps || 0) + 1;
        if (!run.noFx) {
          run.msgs.push({ text: `升到 ${G.hero.level} 級！回營地可分配 3 點三圍`, kind: 'level' });
          run.fx.push({ k: 'levelup' });
        }
      }
    }
  }

  // ---------- 自動施法規則 ----------
  function defaultRulesFor(sk) {
    const c = D.SKILLS[sk].cat;
    if (c === 'def') return [{ id: sk, on: true, cond: [{ k: 'bossCharge' }] }, { id: sk, on: true, cond: [{ k: 'hpBelow', p: 50 }] }];
    if (c === 'aoe' || c === 'line') {
      const n = sk === 'thrust' ? 2 : 3;
      return [{ id: sk, on: true, cond: [{ k: 'enemies', n }] }, { id: sk, on: true, cond: [{ k: 'bossFight' }] }];
    }
    return [{ id: sk, on: true, cond: [{ k: 'bossFight' }] }, { id: sk, on: true, cond: [{ k: 'mpAbove', p: 85 }] }];
  }

  function equippedSkillIds(G) {
    return Char.compute(G).skills.map((s) => s.id);
  }

  function defaultRules(G) {
    const ids = equippedSkillIds(G);
    const rules = [];
    const order = { def: 0, aoe: 1, line: 1, single: 2 };
    const sorted = ids.slice().sort((a, b) => order[D.SKILLS[a].cat] - order[D.SKILLS[b].cat]);
    // 先保命，再範圍清群，最後單體；頭目戰規則排在後面
    for (const id of sorted) rules.push(defaultRulesFor(id)[0]);
    for (const id of sorted) { const r = defaultRulesFor(id)[1]; if (r) rules.push(r); }
    return rules;
  }

  function syncRules(G) {
    const ids = equippedSkillIds(G);
    for (const id of ids) {
      if (!G.autocast.rules.some((r) => r.id === id)) G.autocast.rules.push(...defaultRulesFor(id));
    }
  }

  // ---------- 裝備 ----------
  function findItem(G, id) {
    const s = G.stash.find((i) => i.id === id);
    if (s) return { it: s, where: 'stash' };
    for (const sl of D.SLOTS) if (G.gear[sl] && G.gear[sl].id === id) return { it: G.gear[sl], where: sl };
    return null;
  }

  function equip(G, id, slot) {
    const f = findItem(G, id);
    if (!f || f.where !== 'stash') return { ok: false, reason: '找不到物品' };
    const it = f.it;
    slot = slot || Char.equipSlotsFor(G, it)[0];
    const chk = Char.canEquip(G, it, slot);
    if (!chk.ok && !chk.swapOff) return chk;
    G.stash = G.stash.filter((i) => i.id !== id);
    if (G.gear[slot]) G.stash.push(G.gear[slot]);
    G.gear[slot] = it;
    if (slot === 'weapon') validateOffhand(G);
    syncRules(G);
    return { ok: true };
  }

  function unequip(G, slot) {
    const it = G.gear[slot];
    if (!it) return;
    G.stash.push(it);
    G.gear[slot] = null;
    if (slot === 'weapon') validateOffhand(G);
  }

  function validateOffhand(G) {
    const off = G.gear.offhand;
    if (!off || off.slot !== 'weapon') return;
    G.gear.offhand = null;
    if (Char.canEquip(G, off, 'offhand').ok) G.gear.offhand = off;
    else G.stash.push(off);
  }

  function isProtected(G, it) {
    if (it.fav) return true;
    for (const L of G.loadouts) if (L && Object.values(L.gear).includes(it.id)) return true;
    return false;
  }

  function sellStash(G, id) {
    const it = G.stash.find((i) => i.id === id);
    if (!it || it.fav) return 0;
    G.stash = G.stash.filter((i) => i.id !== id);
    for (const L of G.loadouts) if (L) for (const k in L.gear) if (L.gear[k] === id) delete L.gear[k];
    const v = Items.sellValue(it);
    G.gold += v;
    return v;
  }

  function itemScore(G, it) {
    const p = Char.previewWith(G, it);
    if (!p) return 0;
    return Math.max(0, Math.min(9, (p.sc - 2.4) * 10));
  }

  // 倉庫滿：賣掉目前配裝評分最低的未保護裝備
  function trimStash(G) {
    const sold = [];
    while (G.stash.length > G.stashCap) {
      const cands = G.stash.filter((it) => !isProtected(G, it) && !it.uniq); // 傳奇寶物不會被自動賣掉
      if (!cands.length) break;
      let worst = null, ws = 1e9;
      for (const it of cands) {
        const p = Char.previewWith(G, it);
        const s = (p ? p.sc : 0) + it.rarity * 0.01;
        if (s < ws) { ws = s; worst = it; }
      }
      const v = Items.sellValue(worst);
      G.stash = G.stash.filter((i) => i !== worst);
      G.gold += v;
      sold.push({ name: worst.name, rarity: worst.rarity, gold: v });
    }
    return sold;
  }

  // ---------- 配裝方案 ----------
  function saveLoadout(G, idx, name) {
    const gear = {};
    for (const sl of D.SLOTS) if (G.gear[sl]) gear[sl] = G.gear[sl].id;
    G.loadouts[idx] = { name: name || `配裝 ${idx + 1}`, gear, rules: U.clone(G.autocast.rules), thr: { red: G.autocast.red, blue: G.autocast.blue } };
  }
  function loadLoadout(G, idx) {
    const L = G.loadouts[idx];
    if (!L) return { ok: false };
    const missing = [];
    for (const sl of D.SLOTS) if (G.gear[sl]) unequip(G, sl);
    for (const sl of ['weapon', ...D.SLOTS.filter((s) => s !== 'weapon')]) {
      const id = L.gear[sl];
      if (!id) continue;
      const f = findItem(G, id);
      if (!f) { missing.push(sl); continue; }
      const r = equip(G, id, sl);
      if (!r.ok) missing.push(sl);
    }
    G.autocast.rules = U.clone(L.rules);
    if (L.thr) { G.autocast.red = L.thr.red; G.autocast.blue = L.thr.blue; }
    syncRules(G);
    return { ok: true, missing };
  }

  // ---------- 三圍與星盤 ----------
  function allocate(G, attr) {
    if (G.hero.unspent <= 0) return false;
    G.hero.attrs[attr]++;
    G.hero.unspent--;
    return true;
  }
  function respec(G) {
    const cost = D.ECON.respecCost(G.hero.level);
    if (G.gold < cost) return false;
    const spent = G.hero.attrs.str + G.hero.attrs.dex + G.hero.attrs.int - 15;
    if (spent <= 0) return false;
    G.gold -= cost;
    G.hero.attrs = { str: 5, dex: 5, int: 5 };
    G.hero.unspent += spent;
    return true;
  }
  function starCost(G) {
    return D.ECON.starCost(G.stars.owned.length - 1);
  }
  function canBuyStar(G, id) {
    if (G.stars.owned.includes(id)) return false;
    return D.STARS[id].links.some((l) => G.stars.owned.includes(l));
  }
  function buyStar(G, id) {
    if (!canBuyStar(G, id)) return { ok: false, reason: '需要先買相連的節點' };
    const c = starCost(G);
    if (G.gold < c) return { ok: false, reason: '金幣不足' };
    G.gold -= c;
    G.stars.owned.push(id);
    G.stars.paid[id] = c;
    const k = D.STARS[id].eff.key;
    if (k) {
      const ex = D.STAR_KEYS[k].excl;
      if (ex && G.stars.owned.some((o) => D.STARS[o].eff.key === ex)) { G.stars.choice[k] = false; G.stars.choice[ex] = true; }
    }
    syncRules(G);
    return { ok: true };
  }
  // 從已購節點到目標的最短路徑（只含尚未購買的節點，依購買順序）
  function starPath(G, id) {
    if (!D.STARS[id] || G.stars.owned.includes(id)) return [];
    const owned = new Set(G.stars.owned);
    const prev = { [id]: null };
    const q = [id];
    let found = null;
    while (q.length && !found) {
      const c = q.shift();
      for (const l of D.STARS[c].links) {
        if (owned.has(l)) { found = c; break; }
        if (!(l in prev)) { prev[l] = c; q.push(l); }
      }
    }
    if (!found) return [];
    const path = [];
    for (let c = found; c; c = prev[c]) path.push(c);
    return path;
  }
  function pathCost(G, path) {
    let total = 0;
    for (let i = 0; i < path.length; i++) total += D.ECON.starCost(G.stars.owned.length - 1 + i);
    return total;
  }
  function buyPath(G, id) {
    const path = starPath(G, id);
    if (!path.length) return { ok: false, reason: '沒有可以購買的路徑' };
    const cost = pathCost(G, path);
    if (G.gold < cost) return { ok: false, reason: '金幣不足' };
    for (const n of path) buyStar(G, n);
    return { ok: true, n: path.length, cost };
  }

  // 只能退回末端節點（退掉後其他已買節點仍和起點相連）
  function canRefund(G, id) {
    if (id === 'C0' || !G.stars.owned.includes(id)) return false;
    const rest = G.stars.owned.filter((o) => o !== id);
    const seen = new Set(['C0']);
    const q = ['C0'];
    while (q.length) {
      const c = q.pop();
      for (const l of D.STARS[c].links) if (rest.includes(l) && !seen.has(l)) { seen.add(l); q.push(l); }
    }
    return seen.size === rest.length;
  }
  function refundFee(G) {
    return D.ECON.refundFee(G.stars.refunds);
  }
  function refundStar(G, id) {
    if (!canRefund(G, id)) return { ok: false, reason: '只能退回末端節點' };
    const fee = refundFee(G);
    const back = G.stars.paid[id] || 0;
    if (G.gold + back < fee) return { ok: false, reason: '金幣不足以支付退點費' };
    G.gold += back - fee;
    G.stars.owned = G.stars.owned.filter((o) => o !== id);
    delete G.stars.paid[id];
    G.stars.refunds++;
    validateOffhand(G);
    return { ok: true, back, fee };
  }
  function toggleKey(G, key) {
    const ex = D.STAR_KEYS[key].excl;
    G.stars.choice[key] = true;
    if (ex) G.stars.choice[ex] = false;
    validateOffhand(G);
  }

  // ---------- 工坊：強化與重骰（一定成功，只花金幣） ----------
  function enhanceCost(it) {
    return D.ECON.enhanceCost(it);
  }
  function enhance(G, id) {
    const f = findItem(G, id);
    if (!f) return { ok: false, reason: '找不到裝備' };
    const it = f.it;
    if ((it.plus || 0) >= Items.plusCap(it)) return { ok: false, reason: '已達強化上限' };
    const c = enhanceCost(it);
    if (G.gold < c) return { ok: false, reason: '金幣不足' };
    G.gold -= c;
    Items.enhance(it);
    G.stats.gold_spent = (G.stats.gold_spent || 0) + c;
    return { ok: true, cost: c, plus: it.plus };
  }
  function rerollCost(it, full) {
    return D.ECON.rerollCost(it, full);
  }
  function reroll(G, id, idx, full) {
    const f = findItem(G, id);
    if (!f) return { ok: false, reason: '找不到裝備' };
    const it = f.it;
    if (!it.affixes[idx]) return { ok: false, reason: '沒有這條屬性' };
    const c = rerollCost(it, full);
    if (G.gold < c) return { ok: false, reason: '金幣不足' };
    G.gold -= c;
    const h = { rng: G.rng };
    const r = Items.reroll(h, it, idx, full);
    G.rng = h.rng;
    return Object.assign({ ok: true, cost: c }, r);
  }

  // ---------- 深淵規則 ----------
  function rollMods(G, n) {
    const h = { rng: G.rng };
    const keys = Object.keys(D.ABYSS_MODS);
    const out = [];
    while (out.length < n && out.length < keys.length) {
      const k = U.pick(h, keys);
      if (!out.includes(k)) out.push(k);
    }
    G.rng = h.rng;
    return out;
  }
  // 目前選的章節與深淵階級要用的規則；換了章節或階級就重新抽
  function abyssMods(G, dungeon, diff) {
    dungeon = dungeon || G.exp.dungeon;
    if (diff == null) diff = Math.min(G.exp.diff, G.unlocked[dungeon] ?? 0);
    const n = D.abyssModCount(diff);
    if (!n) return null;
    const m = G.exp.mods;
    if (!m || m.dungeon !== dungeon || m.diff !== diff || !Array.isArray(m.list) || m.list.length !== n) {
      G.exp.mods = { dungeon, diff, list: rollMods(G, n) };
    }
    const list = G.exp.mods.list;
    return {
      list,
      loot: list.reduce((a, k) => a + D.ABYSS_MODS[k].loot, 0),
      xp: list.reduce((a, k) => a + D.ABYSS_MODS[k].xp, 0),
      cost: D.ECON.modRerollCost(diff, G.hero.level),
    };
  }
  function rerollMods(G) {
    const cur = abyssMods(G);
    if (!cur) return { ok: false, reason: '只有深淵才有規則' };
    if (G.gold < cur.cost) return { ok: false, reason: '金幣不足' };
    G.gold -= cur.cost;
    G.exp.mods.list = rollMods(G, cur.list.length);
    return { ok: true, cost: cur.cost };
  }

  // ---------- 擴充 ----------
  function packCost(G) {
    return G.packSize >= 8 ? null : D.ECON.packCosts[G.packSize - 5];
  }
  function buyPack(G) {
    const c = packCost(G);
    if (c == null || G.gold < c) return false;
    G.gold -= c;
    G.packSize++;
    return true;
  }
  function stashCost(G) {
    return G.stashCap >= D.ECON.stashMax ? null : D.ECON.stashCost(G.stashBuys);
  }
  function buyStash(G) {
    const c = stashCost(G);
    if (c == null || G.gold < c) return false;
    G.gold -= c;
    G.stashCap += D.ECON.stashStep;
    G.stashBuys++;
    return true;
  }
  function buyPotion(G, kind, n) {
    const c = D.ECON.potionPrice * (n || 1);
    if (G.gold < c) return false;
    G.gold -= c;
    G.potions[kind] += n || 1;
    return true;
  }

  // ---------- 出征 ----------
  function startRun(G, opts) {
    opts = opts || {};
    const e = G.exp;
    const dungeon = D.DUNGEON[e.dungeon] && (G.unlocked[e.dungeon] ?? -1) >= 0 ? e.dungeon : 'mine';
    const diff = Math.min(e.diff, G.unlocked[dungeon]);
    let wave = e.wave;
    if (e.mode === 'idle') {
      if (G.idle.cur == null || G.idle.cur > e.wave || opts.fresh) G.idle.cur = e.wave;
      wave = G.idle.cur;
      if (opts.fresh) { G.idle.streak = 0; G.idle.stopped = false; }
    }
    const carry = {};
    for (const k of ['red', 'blue']) {
      const want = Math.min(D.ECON.potionCarryMax, e[k]);
      if (e.autoBuy && G.potions[k] < want) {
        const n = Math.min(want - G.potions[k], Math.floor(G.gold / D.ECON.potionPrice));
        if (n > 0) buyPotion(G, k, n);
      }
      carry[k] = Math.min(want, G.potions[k]);
      G.potions[k] -= carry[k];
    }
    const h = { rng: G.rng };
    U.rand(h);
    G.rng = h.rng;
    const mods = abyssMods(G, dungeon, diff);
    const run = Sim.newRun(G, { dungeon, diff, wave, mode: e.mode, red: carry.red, blue: carry.blue, seed: h.rng, mods: mods ? mods.list : [] });
    if (mods) G.exp.mods = null; // 下一趟重新抽
    run.speed = e.speed;
    run.real = 0;
    // 背包放不下的藥水退回營地
    for (const k of ['red', 'blue']) G.potions[k] += carry[k] - Pack.count(run.pack, k);
    G.run = run;
    G.stats.runs++;
    return run;
  }

  // 每個畫面影格呼叫；realDt 為真實秒數
  function update(G, realDt) {
    const run = G.run;
    if (!run) return;
    let remain = Math.min(realDt, 3600);
    while (remain > 1e-6 && G.run === run) {
      if (run.phase === 'fight') {
        const chunk = Math.min(remain, 0.25);
        let speed = run.speed || 1;
        const boss = run.mobs.find((m) => m.boss && m.cur && m.cur.danger);
        if (boss && run.mode === 'active' && speed > 1) speed = Math.max(1, Math.min(speed, boss.cur.total / 0.8)); // 頭目大招預告保留實際反應時間
        run.slowmo = speed < (run.speed || 1);
        Sim.step(G, run, chunk * speed);
        run.real += chunk;
        remain -= chunk;
      } else if (run.phase === 'cleared') {
        if (run.mode === 'idle') Sim.idleFloorDecision(G, run);
        else return; // 等玩家整理背包
      } else if (run.phase === 'dead' || run.phase === 'ended') {
        finishRun(G);
        return;
      } else return;
    }
  }

  function setMode(G, mode) {
    G.exp.mode = mode;
    const run = G.run;
    if (!run) return;
    run.mode = mode;
    if (mode === 'idle') {
      if (G.idle.cur == null || G.idle.cur > G.exp.wave) G.idle.cur = run.wave;
    }
  }

  function finishRun(G) {
    const run = G.run;
    const how = run.phase === 'dead' ? 'death' : run.how;
    const brought = [], lost = [];
    for (const p of run.pack.items) {
      if (p.it.potion) { G.potions[p.it.potion]++; continue; }
      delete p.it._score;
      p.it.rev = true;
      if (how === 'death') lost.push(p.it);
      else { G.stash.push(p.it); brought.push(p.it); }
    }
    if (how === 'death') for (const it of run.pending) lost.push(it);
    const autoSoldStash = trimStash(G);
    let unlocked = null;
    if (how === 'victory') {
      G.stats.wins++;
      const dg = run.dungeon || 'mine';
      const parts = [];
      if (run.diff >= (G.unlocked[dg] ?? 0) && run.diff < D.MAX_DIFF) {
        G.unlocked[dg] = run.diff + 1;
        parts.push(`${D.DUNGEON[dg].name}・${D.diff(run.diff + 1).name}`);
      }
      const next = D.DUNGEON_ORDER[D.DUNGEON_ORDER.indexOf(dg) + 1];
      if (next && run.diff === 0 && (G.unlocked[next] ?? -1) < 0) {
        G.unlocked[next] = 0;
        parts.push(`新章節「${D.DUNGEON[next].name}」・普通`);
      }
      unlocked = parts.length ? parts.join('、') : null;
    }
    if (how === 'death') G.stats.deaths++;
    const report = {
      id: 'r' + Date.now() + Math.floor(Math.random() * 1000), when: Date.now(), how, dungeon: run.dungeon || 'mine', diff: run.diff, wave: run.wave, mode: run.mode,
      floor: run.floor, floors: run.floors, secs: run.total, real: run.real, xp: Math.round(run.xp), levelUps: run.levelUps || 0,
      gold: run.goldSold, sold: run.sold, brought: brought.map(slim), lost: lost.map(slim), stashSold: autoSoldStash,
      cause: run.deathCause || null, floorLog: run.floorLog, unlocked, mods: run.mods && run.mods.length ? run.mods.slice() : undefined,
      potionsUsed: run.potionsUsed,
    };
    for (const it of brought) G.stats.best = Math.max(G.stats.best, it.rarity);
    G.records.unshift(report);
    if (G.records.length > 40) G.records.length = 40;
    if (how !== 'death' && run.real > 20) {
      G.recent.unshift({ real: run.real, xp: run.xp, gold: run.goldSold + brought.reduce((a, it) => a + Items.sellValue(it), 0) * 0.6 });
      if (G.recent.length > 5) G.recent.length = 5;
    }
    G.run = null;
    G.lastReport = report;

    // 掛機循環
    if (run.mode === 'idle') {
      const I = G.idle;
      const S = (I.summary = I.summary || { since: Date.now(), runs: 0, wins: 0, deaths: 0, xp: 0, gold: 0, items: [0, 0, 0, 0, 0, 0], causes: {}, reports: [] });
      S.runs++;
      S.xp += report.xp;
      S.gold += report.gold;
      for (const it of brought) S.items[it.rarity]++;
      S.reports.unshift(report.id);
      if (how === 'death') {
        S.deaths++;
        const c = report.cause ? report.cause.main : '未知';
        S.causes[c] = (S.causes[c] || 0) + 1;
        I.streak = 0;
        if (I.cur <= 1) {
          I.stopped = true;
          report.idleNote = '每波 1 隻仍然倒下，掛機已停止。建議調整配裝、藥水或掛機規則。';
        } else {
          I.cur--;
          report.idleNote = `掛機倒下，下一趟每波怪數降為 ${I.cur}`;
        }
        // 自動挑戰深淵：倒下就退回前一階
        if (G.exp.push && run.diff >= 3 && G.exp.diff === run.diff) {
          G.exp.diff = run.diff - 1;
          I.pushStreak = 0;
          report.idleNote = `深淵挑戰失敗，退回${D.diff(G.exp.diff).name}`;
          I.stopped = false;
          I.cur = Math.min(G.exp.wave, I.cur + 1);
        }
      } else {
        if (how === 'victory') S.wins++;
        I.streak++;
        // 自動挑戰深淵：在目前最高一階連勝 2 趟就往上一階
        if (G.exp.push && how === 'victory' && run.diff >= 2 && G.exp.diff === run.diff && (G.unlocked[report.dungeon] ?? 0) > run.diff) {
          I.pushStreak = (I.pushStreak || 0) + 1;
          if (I.pushStreak >= 2) {
            G.exp.diff = run.diff + 1;
            I.pushStreak = 0;
            report.idleNote = `自動挑戰：下一趟前往${D.diff(G.exp.diff).name}`;
          }
        }
        if (I.streak >= 3 && I.cur < G.exp.wave) {
          I.cur++;
          I.streak = 0;
          report.idleNote = `連續成功，每波怪數回升到 ${I.cur}`;
        }
      }
      G.idleNext = I.stopped ? null : 2.5; // 秒後自動出發
    }
    return report;
  }

  // ---------- 樓層整理（主動模式） ----------
  function lootFind(run, id) {
    const p = run.pack.items.find((q) => q.it.id === id);
    if (p) return { it: p.it, where: 'pack', p };
    const it = run.pending.find((q) => q.id === id);
    return it ? { it, where: 'pending' } : null;
  }
  function lootSell(G, id) {
    const run = G.run;
    const f = lootFind(run, id);
    if (!f || f.it.potion) return 0;
    if (f.where === 'pack') Pack.remove(run.pack, id);
    else run.pending = run.pending.filter((i) => i.id !== id);
    return Sim.sellItem(G, run, f.it, false);
  }
  function lootDiscard(G, id) {
    const run = G.run;
    const f = lootFind(run, id);
    if (!f || !f.it.potion) return false;
    Pack.remove(run.pack, id);
    return true;
  }
  function lootPlace(G, id, x, y, rot) {
    const run = G.run;
    const f = lootFind(run, id);
    if (!f) return false;
    if (f.where === 'pack') return Pack.move(run.pack, id, x, y, rot);
    if (!Pack.fits(run.pack, f.it, x, y, rot)) return false;
    run.pending = run.pending.filter((i) => i.id !== id);
    run.pack.items.push({ it: f.it, x, y, rot });
    return true;
  }
  function lootUnplace(G, id) {
    const run = G.run;
    const p = run.pack.items.find((q) => q.it.id === id);
    if (!p || p.it.potion) return false;
    Pack.remove(run.pack, id);
    run.pending.push(p.it);
    return true;
  }
  function lootAutoArrange(G) {
    Sim.idleRepack(G, G.run);
  }
  function lootContinue(G) {
    const run = G.run;
    if (run.floor >= run.floors) return lootRetreat(G, 'victory');
    if (run.retreatAfter) return lootRetreat(G);
    Sim.nextFloor(G, run);
  }
  function lootRetreat(G, how) {
    Sim.endRun(G, G.run, how || (G.run.floor >= G.run.floors ? 'victory' : 'retreat'));
    return finishRun(G);
  }

  function slim(it) {
    return { name: it.name, rarity: it.rarity, base: it.base, ilvl: it.ilvl, uniq: it.uniq || undefined };
  }

  // ---------- 存檔 ----------
  const DROP_KEYS = new Set(['fx', 'msgs', 'manual', '_occ', '_heroField', '_map', '_mapFloor', '_score']);
  function serialize(G) {
    G.lastSave = Date.now();
    return JSON.stringify(G, (k, v) => (DROP_KEYS.has(k) ? undefined : v));
  }
  function deserialize(str) {
    const G = JSON.parse(str);
    if (G.run) {
      G.run.fx = [];
      G.run.msgs = [];
      G.run.manual = [];
      // 舊版小地圖的存檔：重新進入同一層的新地圖（保留生命、法力、背包與本趟紀錄）
      const map = Sim.mapOf(G.run);
      if (!G.run.seen || G.run.seen.length !== map.w * map.h) {
        const ph = G.run.phase;
        Sim.setupFloor(G.run);
        if (ph === 'cleared') G.run.phase = 'cleared';
      }
    }
    // 舊存檔補欄位
    const fresh = newGame();
    for (const k of Object.keys(fresh)) if (G[k] === undefined) G[k] = fresh[k];
    // 第三章：骨沼普通通關過的存檔直接開放熔鐵工坊
    if (G.unlocked.forge === undefined) G.unlocked.forge = (G.unlocked.bog ?? -1) >= 1 ? 0 : -1;
    // 第四章：熔鐵工坊普通通關過的存檔直接開放星隕觀測所
    if (G.unlocked.observatory === undefined) G.unlocked.observatory = (G.unlocked.forge ?? -1) >= 1 ? 0 : -1;
    // 深淵：已經打贏過惡夢的章節直接開放深淵 1
    for (const dg of D.DUNGEON_ORDER) {
      if (G.unlocked[dg] === 2 && (G.records || []).some((r) => (r.dungeon || 'mine') === dg && r.diff === 2 && r.how === 'victory')) G.unlocked[dg] = 3;
    }
    if (G.settings.sfxVol === undefined) G.settings.sfxVol = G.settings.sound === false ? 0 : 3;
    if (G.settings.musicVol === undefined) G.settings.musicVol = 2;
    if (G.unlocked.bog === undefined) G.unlocked.bog = G.unlocked.mine >= 1 ? 0 : -1;
    // 星盤改版：舊星點不存在時，全額退還買星點花的金幣
    if (G.stars.owned.some((id) => !D.STARS[id])) {
      const back = Object.values(G.stars.paid || {}).reduce((a, b) => a + (b || 0), 0);
      G.gold += back;
      G.stars = { owned: ['C0'], paid: { C0: 0 }, choice: {}, refunds: 0 };
      G.notice = `星盤已全面改版（擴大為 166 點、18 個星座）。之前買星點花的 ${back} 金已全額退還，請重新規劃。`;
    }
    return G;
  }
  function storage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* 無法使用 */ }
    return null;
  }
  function save(G) {
    const s = storage();
    if (!s) return false;
    try {
      s.setItem(SAVE_KEY, serialize(G));
      return true;
    } catch (e) {
      return false;
    }
  }
  function load() {
    const s = storage();
    if (!s) return null;
    try {
      const raw = s.getItem(SAVE_KEY);
      return raw ? deserialize(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function wipe() {
    const s = storage();
    if (s) s.removeItem(SAVE_KEY);
  }

  // ---------- 離線收益 ----------
  function offlineEffectiveSecs(T) {
    const day = 86400;
    const first = 0.25 * Math.min(T, day);
    if (T <= day) return first;
    const k = day / Math.LN2;
    return first + 0.25 * k * (1 - Math.pow(2, -(T - day) / day));
  }
  function applyOffline(G, now) {
    const T = (now - G.lastSave) / 1000;
    if (T < 120) return null;
    if (!G.recent.length) {
      G.offline = { secs: T, xp: 0, gold: 0, none: true };
      return G.offline;
    }
    const real = G.recent.reduce((a, r) => a + r.real, 0);
    const xpRate = G.recent.reduce((a, r) => a + r.xp, 0) / real;
    const goldRate = G.recent.reduce((a, r) => a + r.gold, 0) / real;
    const eff = offlineEffectiveSecs(T);
    const xp = Math.round(xpRate * eff), gold = Math.round(goldRate * eff);
    const lv0 = G.hero.level;
    addXp(G, null, xp);
    G.gold += gold;
    G.offline = { secs: T, xp, gold, levels: G.hero.level - lv0, pct: (eff / T) * 100 };
    return G.offline;
  }

  LH.Game = {
    SAVE_KEY, newGame, addXp, defaultRules, syncRules, equip, unequip, sellStash, itemScore, trimStash, isProtected, findItem,
    saveLoadout, loadLoadout, allocate, respec, starCost, canBuyStar, buyStar, canRefund, refundFee, refundStar, toggleKey,
    starPath, pathCost, buyPath, enhanceCost, enhance, rerollCost, reroll, abyssMods, rerollMods,
    packCost, buyPack, stashCost, buyStash, buyPotion, startRun, update, setMode, finishRun,
    lootSell, lootDiscard, lootPlace, lootUnplace, lootAutoArrange, lootContinue, lootRetreat, lootFind,
    serialize, deserialize, save, load, wipe, applyOffline, offlineEffectiveSecs, equippedSkillIds,
  };
})(typeof window !== 'undefined' ? window : globalThis);
