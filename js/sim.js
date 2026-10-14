// 地城模擬：純規則、不碰畫面。所有狀態都是可存檔的普通物件。
(function (root) {
  const LH = root.LH;
  const { U, D, Map: M, Items, Pack } = LH;

  const DT = 0.05;
  const MAX_MOBS = 60;
  // 節奏係數：怪物較耐打但單下較輕，拉長每層戰鬥又不提高致死率
  const MOB_HP_MUL = 2.0, MOB_DMG_MUL = 0.45, BOSS_HP_MUL = 2.0, BOSS_DMG_MUL = 0.65;

  // ---------- 建立 ----------
  function newRun(G, opts) {
    const cs = LH.Char.compute(G);
    const run = {
      v: 2, dungeon: opts.dungeon || 'mine', diff: opts.diff, wave: opts.wave, mode: opts.mode,
      autoCast: true, retreatAfter: false,
      floor: 1, floors: D.DUNGEON[opts.dungeon || 'mine'].floors, phase: 'fight', hazards: [],
      rng: (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0,
      cs,
      rules: U.clone(G.autocast.rules),
      thr: { red: G.autocast.red, blue: G.autocast.blue, retreatHp: G.autocast.retreatHp },
      hero: null, mobs: [], zones: [], kills: 0, killTarget: 0, waveT: 0,
      pending: [], pack: Pack.create(G.packSize),
      t: 0, total: 0, xp: 0, goldSold: 0, sold: [], autoSold: [],
      floorLog: [], dmgLog: [], nid: 1, drops: 0, bossId: null, startLevel: G.hero.level,
      potionsUsed: { red: 0, blue: 0 }, potionsStart: { red: 0, blue: 0 },
      fx: [], msgs: [], manual: [],
      codexSeen: Object.keys(G.codex || {}),
      mods: (opts.mods || []).slice(),
    };
    // 深淵規則的獎勵
    run.modLoot = run.mods.reduce((a, k) => a + ((D.ABYSS_MODS[k] && D.ABYSS_MODS[k].loot) || 0), 0);
    run.modXp = run.mods.reduce((a, k) => a + ((D.ABYSS_MODS[k] && D.ABYSS_MODS[k].xp) || 0), 0);
    // 藥水放進背包，每瓶一格
    for (const kind of ['red', 'blue']) {
      const n = opts[kind] || 0;
      for (let i = 0; i < n; i++) Pack.autoPlace(run.pack, Items.potion(run, kind));
      run.potionsStart[kind] = Pack.count(run.pack, kind);
    }
    setupFloor(run);
    run.hero.hp = cs.maxHp;
    run.hero.mp = cs.maxMp;
    return run;
  }

  function mapOf(run) {
    if (!run._map || run._mapFloor !== run.floor) {
      Object.defineProperty(run, '_map', { value: M.generate(run.dungeon, run.floor), writable: true, enumerable: false, configurable: true });
      Object.defineProperty(run, '_mapFloor', { value: run.floor, writable: true, enumerable: false, configurable: true });
    }
    return run._map;
  }

  function dungeonOf(run) {
    return D.DUNGEON[run.dungeon] || D.DUNGEON.mine;
  }
  function mobLevel(run) {
    return D.baseLevel(dungeonOf(run), run.diff) + run.floor - 1;
  }

  function setupFloor(run) {
    const map = mapOf(run);
    const prev = run.hero;
    run.hero = {
      x: map.start[0], y: map.start[1], px: map.start[0], py: map.start[1], mt: 1, md: 1, face: 1,
      hp: prev ? prev.hp : 0, mp: prev ? prev.mp : 0,
      atkT: 0, wi: 0, cds: prev ? prev.cds : {}, gcd: 0,
      buffs: {}, hot: [], absorb: 0, absorbT: 0, potT: { red: 0, blue: 0 }, specCd: {},
      lastElem: null, nextPhys: 0, nextLightDisc: 0, chargeDef: null, zapT: 0, lowMpT: 0,
    };
    run.mobs = [];
    run.zones = [];
    run.hazards = [];
    run.omens = [];
    run.omenT = null;
    run.kills = 0;
    run.drops = 0;
    run.t = 0;
    run.waveT = 0.6;
    run.phase = 'fight';
    run.bossId = null;
    run.killTarget = run.floor < run.floors ? D.ECON.killTarget(run.wave) : 0;
    run.floorLog.push({ floor: run.floor, events: [], kills: 0, drops: [] });
    run.seen = new Array(map.w * map.h).fill(0);
    run.seenN = 0;
    run.patrol = null;
    reveal(run);
    if (run.floor === run.floors) spawnBoss(run);
  }

  // 探索：角色周圍視線可及的格子記為已探索（地圖與小地圖會亮起來）
  const SIGHT = 7;
  function reveal(run) {
    const map = mapOf(run), h = run.hero;
    if (!run.seen || run.seen.length !== map.w * map.h) run.seen = new Array(map.w * map.h).fill(0);
    let n = 0;
    for (let y = h.y - SIGHT; y <= h.y + SIGHT; y++)
      for (let x = h.x - SIGHT; x <= h.x + SIGHT; x++) {
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
        const i = y * map.w + x;
        if (run.seen[i] || (x - h.x) ** 2 + (y - h.y) ** 2 > SIGHT * SIGHT) continue;
        let ok = true;
        for (const [lx, ly] of M.lineCells(h.x, h.y, x, y)) if (!M.walkable(map, lx, ly)) { ok = false; break; }
        if (ok) { run.seen[i] = 1; n++; }
      }
    run.seenN = (run.seenN || 0) + n;
  }

  // ---------- 佔位與距離 ----------
  function cellsOf(m) {
    if (m.w === 1) return [[m.x, m.y]];
    const out = [];
    for (let dy = 0; dy < m.w; dy++) for (let dx = 0; dx < m.w; dx++) out.push([m.x + dx, m.y + dy]);
    return out;
  }

  function buildOcc(run) {
    const map = mapOf(run);
    const occ = new Int32Array(map.w * map.h).fill(0);
    for (const m of run.mobs) for (const [x, y] of cellsOf(m)) occ[y * map.w + x] = m.id;
    occ[run.hero.y * map.w + run.hero.x] = -1;
    run._occ = occ;
    return occ;
  }

  function mobAt(run, x, y) {
    const map = mapOf(run);
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
    const id = run._occ[y * map.w + x];
    return id > 0 ? run.mobs.find((m) => m.id === id) : null;
  }

  function distToHero(run, m) {
    let best = 1e9;
    for (const [x, y] of cellsOf(m)) best = Math.min(best, U.cheb(x, y, run.hero.x, run.hero.y));
    return best;
  }
  function nearestCell(run, m) {
    let best = null, bd = 1e9;
    for (const c of cellsOf(m)) {
      const d = U.dist(c[0], c[1], run.hero.x, run.hero.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // 射線：牆擋；blockMobs 時其他怪物也擋（肉盾）
  function clearLine(run, ax, ay, bx, by, ignoreId, blockMobs) {
    const map = mapOf(run);
    for (const [x, y] of M.lineCells(ax, ay, bx, by)) {
      if (!M.walkable(map, x, y)) return false;
      if (blockMobs) {
        const id = run._occ[y * map.w + x];
        if (id > 0 && id !== ignoreId) return false;
      }
    }
    return true;
  }

  // ---------- 特效與訊息 ----------
  function fx(run, e) {
    if (run.noFx) return;
    run.fx.push(e);
    if (run.fx.length > 400) run.fx.splice(0, 100);
  }
  // extra：附加資訊（例如 { skill, why } 讓畫面在技能按鈕上提示，而不是跳字條）
  function msg(run, text, kind, extra) {
    if (run.noFx) return;
    run.msgs.push(Object.assign({ text, kind: kind || 'info' }, extra));
  }
  function logEvent(run, text) {
    const f = run.floorLog[run.floorLog.length - 1];
    if (f && f.events.length < 40) f.events.push(`${U.fmtTime(run.t)}｜${text}`);
  }

  // ---------- 出怪 ----------
  function hasMod(run, k) {
    return !!(run.mods && run.mods.includes(k));
  }
  // 深淵規則對怪物的影響（一般怪、精英、頭目、召喚物都套用）
  function applyMods(run, m) {
    if (!run.mods || !run.mods.length) return m;
    if (hasMod(run, 'frenzy')) { m.speed *= 1.25; m.aspd *= 1.25; }
    if (hasMod(run, 'tough')) { m.hp = m.maxHp = Math.round(m.maxHp * 1.4); }
    if (hasMod(run, 'ironclad')) m.armor = m.armor * 2 + 10;
    if (hasMod(run, 'storm') && !m.boss && !m.elem) m.elem = U.pick(run, ['fire', 'cold', 'light']);
    return m;
  }

  function makeMob(run, type, x, y, lvl, extra) {
    const def = D.MONSTERS[type];
    const hpMul = Math.pow(1.17, lvl - 1) * MOB_HP_MUL, dmgMul = Math.pow(1.12, lvl - 1) * MOB_DMG_MUL;
    return applyMods(run, Object.assign({
      id: run.nid++, type, lvl, x, y, px: x, py: y, mt: 1, md: 1, w: 1,
      hp: Math.round(def.hp * hpMul), maxHp: Math.round(def.hp * hpMul),
      dmg: def.dmg * dmgMul, aspd: def.aspd, speed: def.speed, armor: Math.round(def.armor * (1 + 0.12 * (lvl - 1))),
      range: def.range, keep: def.keep || 0, atkT: U.rand(run) * 0.8, windup: null,
      st: { burn: [], slow: null, shock: null, stun: 0 },
      xp: def.xp * (1 + 0.15 * (lvl - 1)), face: 1, hitT: 0,
    }, extra || {}));
  }

  function freeAt(run, x, y, w) {
    const map = mapOf(run);
    for (let dy = 0; dy < w; dy++)
      for (let dx = 0; dx < w; dx++) {
        if (!M.walkable(map, x + dx, y + dy)) return false;
        if (run._occ[(y + dy) * map.w + x + dx] !== 0) return false;
      }
    return true;
  }

  function spawnWave(run) {
    const map = mapOf(run);
    buildOcc(run);
    const lvl = mobLevel(run);
    // 從黑暗中、離角色有一段路程的地方成群出現，再循路追向角色
    const h = run.hero;
    const field = run._heroField || M.distField(map, [[h.x, h.y]]);
    const pick = (lo, hi) => {
      const out = [];
      for (let y = 1; y < map.h - 1; y++)
        for (let x = 1; x < map.w - 1; x++) {
          const v = field[y * map.w + x];
          if (v >= lo && v <= hi && U.dist(x, y, h.x, h.y) >= 8 && freeAt(run, x, y, 1)) out.push([x, y]);
        }
      return out;
    };
    let pool = pick(11, 22);
    if (pool.length < run.wave) pool = pick(7, 1e8);
    if (!pool.length) return;
    const anchor = U.pick(run, pool);
    const cands = pool.sort((a, b) => U.dist(a[0], a[1], anchor[0], anchor[1]) - U.dist(b[0], b[1], anchor[0], anchor[1]));
    let n = Math.min(hasMod(run, 'swarm') ? Math.ceil(run.wave * 1.5) : run.wave, MAX_MOBS - run.mobs.length);
    // 普通難度第 1 層是新手的第一場仗，不出精英怪
    const eliteAt = !(run.diff === 0 && run.floor === 1) && U.chance(run, D.diff(run.diff).elite * (hasMod(run, 'eliteNest') ? 2 : 1)) ? 0 : -1;
    for (let i = 0; i < n && i < cands.length; i++) {
      const type = U.weighted(run, D.mixFor(dungeonOf(run), run.diff));
      const [x, y] = cands[i];
      const m = makeMob(run, type, x, y, lvl);
      if (i === eliteAt) makeElite(run, m);
      run.mobs.push(m);
      run._occ[y * map.w + x] = m.id;
      fx(run, { k: 'spawn', x, y });
    }
  }

  // 精英怪：血量、傷害提高，帶 1～3 個詞綴（元素最多一種），必掉稀有以上
  function makeElite(run, m) {
    const want = D.diff(run.diff).eliteAff;
    const keys = Object.keys(D.ELITE);
    const affs = [];
    // 熔鐵工坊的精英怪偏好火焰
    if (run.dungeon === 'forge' && U.chance(run, 0.5)) affs.push('fire');
    if (run.dungeon === 'observatory' && U.chance(run, 0.5)) affs.push(U.pick(run, ['light', 'cold']));
    while (affs.length < want) {
      const k = U.pick(run, keys);
      if (affs.includes(k)) continue;
      if (D.ELITE_ELEMS.includes(k) && affs.some((a) => D.ELITE_ELEMS.includes(a))) continue;
      affs.push(k);
    }
    m.elite = affs;
    m.eName = affs.map((a) => D.ELITE[a].name).join('・') + ' ' + D.MONSTERS[m.type].name;
    m.hp = m.maxHp = Math.round(m.maxHp * 3.2 * (affs.includes('armored') ? 1.3 : 1));
    m.dmg *= 1.35;
    m.xp *= 4;
    for (const a of affs) if (D.ELITE[a].elem) m.elem = D.ELITE[a].elem;
    if (affs.includes('fast')) { m.speed *= 1.5; m.aspd *= 1.35; }
    if (affs.includes('armored')) { m.armor = m.armor * 2 + 20; m.dr = 0.25; }
    logEvent(run, `精英怪出現：${m.eName}`);
    msg(run, `精英怪「${m.eName}」出現！`, 'warn');
  }

  function spawnBoss(run) {
    const map = mapOf(run);
    buildOcc(run);
    const bossType = U.pick(run, dungeonOf(run).bosses);
    const def = D.BOSSES[bossType];
    const lvl = mobLevel(run);
    const field = M.distField(map, [[run.hero.x, run.hero.y]]);
    let spot = null, bd = 1e9;
    for (let y = 1; y < map.h - 2; y++)
      for (let x = 1; x < map.w - 2; x++) {
        if (!freeAt(run, x, y, 2)) continue;
        const v = Math.min(field[y * map.w + x], field[y * map.w + x + 1], field[(y + 1) * map.w + x], field[(y + 1) * map.w + x + 1]);
        const score = Math.abs(v - 16);
        if (v < 1e8 && score < bd) { bd = score; spot = [x, y]; }
      }
    spot = spot || [map.start[0] + 3, map.start[1]];
    const hp = Math.round(270 * Math.pow(1.17, lvl - 1) * def.hp * BOSS_HP_MUL);
    const boss = makeMob(run, 'pickman', spot[0], spot[1], lvl, {
      type: 'boss', boss: bossType, w: 2, hp, maxHp: hp,
      dmg: 7 * Math.pow(1.12, lvl - 1) * def.dmg * BOSS_DMG_MUL, aspd: 0.7, speed: def.speed,
      armor: Math.round(def.armor * (1 + 0.12 * (lvl - 1))), range: def.ranged ? 5 : 1,
      xp: 120 * (1 + 0.15 * (lvl - 1)), moveT: 4, cur: null, weak: 0, intImmune: 0, hidden: false,
    });
    run.mobs.push(boss);
    run.bossId = boss.id;
    logEvent(run, `頭目出現：${def.name}`);
    msg(run, `頭目「${def.name}」— ${def.tell}`, 'boss');
    fx(run, { k: 'bossIntro', id: boss.id, name: def.name });
  }

  // ---------- 主迴圈 ----------
  function step(G, run, dt) {
    // dt 為遊戲內秒數，切成固定小步
    run._acc = (run._acc || 0) + dt;
    let n = 0;
    while (run._acc >= DT && n < 4000) {
      run._acc -= DT;
      tick(G, run, DT);
      n++;
      if (run.phase !== 'fight') { run._acc = 0; break; }
    }
  }

  function tick(G, run, dt) {
    if (run.phase !== 'fight') return;
    run.t += dt;
    run.total += dt;
    const map = mapOf(run);
    buildOcc(run);
    const heroField = M.distField(map, [[run.hero.x, run.hero.y]]);
    run._heroField = heroField;

    if (run.floor < run.floors && run.kills < run.killTarget) {
      run.waveT -= dt;
      // 場上清空時下一波提早到來：打得快的配裝與熟練施法能真正縮短通關時間
      if (run.mobs.length === 0 && run.waveT > 1.2) run.waveT = 1.2;
      if (run.waveT <= 0) {
        spawnWave(run);
        run.waveT = D.ECON.waveInterval;
      }
    }

    updateHero(G, run, dt);
    if (run.phase !== 'fight') return;
    for (const m of run.mobs.slice()) {
      if (m.hp <= 0) continue;
      updateMob(G, run, m, dt, heroField);
      if (run.phase !== 'fight') return;
    }
    updateZones(G, run, dt);
    updateHazards(G, run, dt);
    if (run.phase !== 'fight') return;
    updateOmens(G, run, dt);
    if (run.phase !== 'fight') return;
    run.mobs = run.mobs.filter((m) => m.hp > 0);
    // 傷害紀錄只留最近 12 秒
    while (run.dmgLog.length && run.dmgLog[0].t < run.total - 12) run.dmgLog.shift();

    // 清層判定
    if (run.floor < run.floors) {
      if (run.kills >= run.killTarget && run.mobs.length === 0) floorCleared(G, run);
    } else if (!run.mobs.some((m) => m.boss)) {
      floorCleared(G, run);
    }
  }

  // ---------- 英雄 ----------
  function updateHero(G, run, dt) {
    const h = run.hero, cs = run.cs;
    // 計時器
    h.gcd -= dt;
    h.atkT -= dt;
    for (const k in h.cds) { h.cds[k] -= dt; if (h.cds[k] <= 0) delete h.cds[k]; }
    for (const k in h.buffs) { h.buffs[k].t -= dt; if (h.buffs[k].t <= 0) delete h.buffs[k]; }
    for (const k in h.specCd) { h.specCd[k] -= dt; if (h.specCd[k] <= 0) delete h.specCd[k]; }
    h.potT.red -= dt; h.potT.blue -= dt;
    if (h.slow) { h.slow.t -= dt; if (h.slow.t <= 0) h.slow = null; }
    if (h.absorbT > 0) { h.absorbT -= dt; if (h.absorbT <= 0) h.absorb = 0; }
    // 回復
    const smap = mapOf(run);
    const onStar = !!(smap.star && smap.star[h.y * smap.w + h.x]);
    h.mp = Math.min(cs.maxMp, h.mp + cs.mpRegen * (hasMod(run, 'drought') ? 0.5 : 1) * (onStar ? 3 : 1) * dt);
    // 火雨：每隔幾秒在角色附近冒出一片火池
    if (hasMod(run, 'fireRain')) {
      run.rainT = (run.rainT == null ? 4 : run.rainT) - dt;
      if (run.rainT <= 0) {
        run.rainT = 5 + U.rand(run) * 2;
        const map0 = mapOf(run);
        for (let tries = 0; tries < 12; tries++) {
          const fx0 = h.x + U.randInt(run, -4, 4), fy0 = h.y + U.randInt(run, -4, 4);
          if (U.cheb(fx0, fy0, h.x, h.y) < 2 || !M.walkable(map0, fx0, fy0)) continue;
          const cells = squareCells(fx0, fy0, 3).filter(([x, y]) => M.walkable(map0, x, y));
          addHazard(run, cells, 4 * Math.pow(1.12, mobLevel(run) - 1) * MOB_DMG_MUL, 4, 'fire');
          break;
        }
      }
    }
    if (cs.hpRegen) h.hp = Math.min(cs.maxHp, h.hp + cs.hpRegen * dt);
    for (const o of h.hot) {
      const amt = Math.min(o.t, dt) * o.rate;
      if (o.kind === 'mp') h.mp = Math.min(cs.maxMp, h.mp + amt);
      else h.hp = Math.min(cs.maxHp, h.hp + amt);
      o.t -= dt;
    }
    h.hot = h.hot.filter((o) => o.t > 0);
    if (h.mp < cs.maxMp * 0.1) h.lowMpT += dt;
    // 熔岩：每 0.5 秒灼傷一次（不能閃避或格擋）
    const lmap = mapOf(run);
    if (lmap.lava && lmap.lava[h.y * lmap.w + h.x]) {
      h.lavaT = (h.lavaT || 0) - dt;
      if (h.lavaT <= 0) {
        h.lavaT = 0.5;
        const L = mobLevel(run);
        const red = cs.spec.lavaWalker ? 1 - cs.spec.lavaWalker / 100 : 1;
        const amt = 4.5 * Math.pow(1.12, L - 1) * MOB_DMG_MUL;
        if (uqOf(run).lavaHeart) { healHero(run, amt * 0.5); fx(run, { k: 'mobHeal', x: h.x, y: h.y }); }
        else hurtHero(G, run, amt * red, 'fire', { name: '熔岩', hazard: true });
        if (run.phase !== 'fight') return;
      }
    }
    // 靜電護幕電擊
    if (h.buffs.static) {
      h.zapT -= dt;
      if (h.zapT <= 0) {
        h.zapT = 1;
        buildOcc(run);
        for (const m of run.mobs) if (m.hp > 0 && distToHero(run, m) <= 1) hurtMob(G, run, m, h.buffs.static.zap, 'light', { trigger: true });
      }
    }

    // 星隕護符：每 10 秒砸一顆隕石在敵人最多的地方
    if (uqOf(run).starfall) {
      h.starT = (h.starT == null ? 3 : h.starT) - dt;
      if (h.starT <= 0) {
        const p = plan(run, { id: 'starfall', shape: { t: 'area', n: 3, range: 7 } });
        if (p) {
          h.starT = 10;
          fx(run, { k: 'skill', id: 'meteor', cells: p.cells, from: [h.x, h.y], targets: p.targets.map((m) => nearestCell(run, m)), uq: true });
          const dmg = (cs.uqPow.starfall || 15) * 2.4 * (cs.fireMul || 1);
          for (const m of p.targets) hurtMob(G, run, m, dmg, 'fire', { trigger: true });
          if (run.phase !== 'fight') return;
        } else h.starT = 1;
      }
    }

    usePotions(G, run);

    // 施法：手動優先，可越過共用冷卻
    while (run.manual.length) {
      const id = run.manual.shift();
      const sk = cs.skills.find((s) => s.id === id);
      if (sk) {
        const r = cast(G, run, sk, true);
        if (r !== 'ok') msg(run, { none: `${sk.name}：範圍內沒有可用敵人`, mana: `${sk.name}：法力不足`, cd: `${sk.name}：冷卻中` }[r], 'warn', { skill: sk.id, why: r });
        if (r === 'mana') G.hints && (G.hints.mana = true);
      }
    }
    if ((run.autoCast || run.mode === 'idle') && h.gcd <= 0) autoCast(G, run);
    if (run.phase !== 'fight') return;

    // 移動中
    if (h.mt < 1) {
      h.mt = Math.min(1, h.mt + (dt * cs.move * (h.slow ? 1 - h.slow.p : 1)) / h.md);
      return;
    }
    buildOcc(run);
    const map = mapOf(run);
    if (run.omens && run.omens.length && dodgeOmen(run, map)) return;
    const w = cs.weapons[h.wi % cs.weapons.length];
    // 找射程內目標
    let target = null, td = 1e9;
    for (const m of run.mobs) {
      if (m.hp <= 0 || m.hidden) continue;
      const d = distToHero(run, m);
      if (d > w.range) continue;
      if (w.range > 1) {
        const c = nearestCell(run, m);
        if (!clearLine(run, h.x, h.y, c[0], c[1], m.id, true)) continue;
      }
      const dd = d + m.hp / 1000;
      if (dd < td) { td = dd; target = m; }
    }
    if (target) {
      const c = nearestCell(run, target);
      if (c[0] !== h.x) h.face = c[0] > h.x ? 1 : -1;
      if (h.atkT <= 0) {
        basicAttack(G, run, target, w);
        h.atkT = 1 / (w.aspd * cs.aspdMul * (berserkOn(run) ? 1.25 : 1));
        h.wi++;
      }
      return;
    }
    // 附近有怪就迎戰；沒有就往沒去過的地方探索；全部探索完就在洞室間巡邏
    const live = run.mobs.filter((m) => m.hp > 0 && !m.hidden);
    const field = run._heroField;
    const srcs = [];
    for (const m of live) {
      let v = 1e9;
      for (const [x, y] of cellsOf(m)) v = Math.min(v, field[y * map.w + x]);
      if (v <= 14) for (const c of cellsOf(m)) srcs.push(c);
    }
    // 觀測所：沒有敵人又缺魔時，走到附近的星光裡回魔
    if (srcs.length) h.resting = false;
    else if (map.star) {
      const want = h.mp < cs.maxMp * (h.resting ? 0.9 : 0.45);
      if (!want) h.resting = false;
      else if (map.star[h.y * map.w + h.x]) { h.resting = true; return; }
      else for (let i = 0; i < map.w * map.h; i++) if (map.star[i] && field[i] <= 14) srcs.push([i % map.w, (i / map.w) | 0]);
    }
    if (!srcs.length) {
      const seen = run.seen, W = map.w;
      for (let y = 1; y < map.h - 1; y++)
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          if (seen[i] || map.t[i]) continue;
          if (seen[i - 1] || seen[i + 1] || seen[i - W] || seen[i + W]) srcs.push([x, y]);
        }
    }
    if (!srcs.length) {
      if (!run.patrol || U.cheb(h.x, h.y, run.patrol[0], run.patrol[1]) <= 1) run.patrol = U.pick(run, map.rooms || [map.start]);
      srcs.push(run.patrol);
    }
    const goal = M.distField(map, srcs, map.lavaCost);
    const cur = goal[h.y * map.w + h.x];
    let best = null, bv = cur;
    for (const [dx, dy] of U.DIRS8) {
      const nx = h.x + dx, ny = h.y + dy;
      if (!M.walkable(map, nx, ny)) continue;
      if (dx && dy && (!M.walkable(map, h.x + dx, h.y) || !M.walkable(map, h.x, h.y + dy))) continue;
      if (run._occ[ny * map.w + nx] > 0) continue;
      if (inOmen(run, nx, ny)) continue;
      const v = goal[ny * map.w + nx];
      if (v < bv - 1e-6) { bv = v; best = [dx, dy]; }
    }
    if (best) {
      h.px = h.x; h.py = h.y;
      h.x += best[0]; h.y += best[1];
      h.md = best[0] && best[1] ? 1.4 : 1;
      if (map.slow && map.slow[h.y * map.w + h.x]) h.md *= cs.spec.bogWalker ? 1.25 : 1.6;
      h.mt = 0;
      if (best[0]) h.face = best[0];
      reveal(run);
    }
  }

  // ---------- 星落（觀測所的環境危險） ----------
  function inOmen(run, x, y) {
    if (!run.omens || !run.omens.length) return false;
    for (const o of run.omens) for (const c of o.cells) if (c[0] === x && c[1] === y) return true;
    return false;
  }
  // 找最近的安全格子（最多走 4 步），往那個方向走一步
  function dodgeOmen(run, map) {
    const h = run.hero;
    if (!inOmen(run, h.x, h.y)) return false;
    const W = map.w;
    const start = h.y * W + h.x;
    const first = new Map([[start, null]]);
    const dist = new Map([[start, 0]]);
    const q = [start];
    let best = null;
    for (let head = 0; head < q.length && !best; head++) {
      const c = q[head], x0 = c % W, y0 = (c / W) | 0;
      if (dist.get(c) >= 4) continue;
      for (const [dx, dy] of U.DIRS8) {
        const nx = x0 + dx, ny = y0 + dy, n = ny * W + nx;
        if (dist.has(n) || !M.walkable(map, nx, ny) || run._occ[n] > 0) continue;
        if (dx && dy && (!M.walkable(map, x0 + dx, y0) || !M.walkable(map, x0, y0 + dy))) continue;
        dist.set(n, dist.get(c) + 1);
        first.set(n, first.get(c) || [dx, dy]);
        if (!inOmen(run, nx, ny)) { best = first.get(n); break; }
        q.push(n);
      }
    }
    if (!best) return false;
    h.px = h.x; h.py = h.y;
    h.x += best[0]; h.y += best[1];
    h.md = best[0] && best[1] ? 1.4 : 1;
    h.mt = 0;
    if (best[0]) h.face = best[0];
    reveal(run);
    return true;
  }
  function updateOmens(G, run, dt) {
    if (!dungeonOf(run).starfall) return;
    if (!run.omens) run.omens = [];
    const h = run.hero;
    run.omenT = (run.omenT == null ? 4 : run.omenT) - dt;
    if (run.omenT <= 0) {
      run.omenT = 5.5 + U.rand(run) * 2.5 - Math.min(2, Math.max(0, run.diff) * 0.5);
      const map = mapOf(run);
      const cx0 = h.x + U.randInt(run, -1, 1), cy0 = h.y + U.randInt(run, -1, 1);
      const cells = squareCells(cx0, cy0, 3).filter(([x, y]) => M.walkable(map, x, y));
      if (cells.length) { run.omens.push({ cells, t: 1.6, total: 1.6, cx: cx0, cy: cy0 }); fx(run, { k: 'omen' }); }
    }
    for (const o of run.omens) {
      o.t -= dt;
      if (o.t > 0 || o.done) continue;
      o.done = true;
      fx(run, { k: 'omenHit', x: o.cx, y: o.cy, cells: o.cells });
      const dmg = 10 * Math.pow(1.12, mobLevel(run) - 1) * MOB_DMG_MUL;
      if (o.cells.some(([x, y]) => x === h.x && y === h.y)) hurtHero(G, run, dmg, 'light', { name: '星落', hazard: true });
      if (run.phase !== 'fight') return;
      // 星落也會砸到怪物（頭目除外）
      buildOcc(run);
      const hit = new Set();
      for (const [x, y] of o.cells) {
        const m = mobAt(run, x, y);
        if (m && !m.boss && !hit.has(m.id)) { hit.add(m.id); hurtMob(G, run, m, m.maxHp * 0.15, 'light', { trigger: true }); }
      }
    }
    run.omens = run.omens.filter((o) => !o.done);
  }

  function hasKey(run, k) {
    return run.cs.keys.includes(k);
  }
  function berserkOn(run) {
    return hasKey(run, 'berserk') && run.hero.hp < run.cs.maxHp * 0.5;
  }
  function slowHero(run, p, t) {
    const h = run.hero;
    if (run.cs.spec.bogWalker) p *= 0.5;
    if (!h.slow || h.slow.p <= p) h.slow = { p, t };
    else h.slow.t = Math.max(h.slow.t, t);
  }
  function healHero(run, v) {
    const h = run.hero;
    h.hp = Math.min(run.cs.maxHp, h.hp + v);
  }

  function basicAttack(G, run, m, w) {
    const h = run.hero, cs = run.cs;
    let dmg = (U.randRange(run, w.dmg[0], w.dmg[1]) + cs.extraBase) * w.mul;
    if (berserkOn(run)) dmg *= 1.25;
    if (h.phantom) { dmg *= 2; h.phantom = false; }
    const c = nearestCell(run, m);
    fx(run, { k: w.range > 1 ? 'shot' : 'swing', from: [h.x, h.y], to: c, elem: w.elem, kind: w.kind });
    const uq = uqOf(run);
    const hits = uq.twinFang && w.range <= 1 ? 2 : 1;
    let dealt = 0;
    for (let i = 0; i < hits && m.hp > 0; i++) dealt += hurtMob(G, run, m, dmg * (hits > 1 ? 0.6 : 1), w.elem, { basic: true, melee: w.range <= 1 }) || 0;
    const leech = (hasKey(run, 'lifeSteal') ? 4 : 0) + (cs.spec.lifeLeech || 0);
    if (leech && dealt) healHero(run, (dealt * leech) / 100);
    if (w.range > 1 && hasKey(run, 'elemArrows') && m.hp > 0) {
      hurtMob(G, run, m, dmg * 0.25, 'light', { trigger: true });
      if (m.hp > 0 && U.chance(run, 0.3)) applyShock(run, m, cs);
    }
    h.atkN = (h.atkN || 0) + 1;
    if (hasKey(run, 'bladeDance') && h.atkN % 4 === 0) {
      buildOcc(run);
      fx(run, { k: 'skill', id: 'whirl', cells: [], from: [h.x, h.y], targets: [] });
      for (const n of run.mobs) if (n !== m && n.hp > 0 && distToHero(run, n) <= 1) hurtMob(G, run, n, dmg * 0.6, w.elem, { trigger: true });
    }
    if (uq.skullbreaker && w.range <= 1 && U.chance(run, 0.25)) {
      buildOcc(run);
      fx(run, { k: 'skill', id: 'quake', cells: squareCells(h.x, h.y, 3), from: [h.x, h.y], targets: [], uq: true });
      for (const n of run.mobs.slice()) {
        if (n.hp <= 0 || distToHero(run, n) > 1) continue;
        hurtMob(G, run, n, dmg * 0.5, 'phys', { trigger: true });
        if (n.hp > 0) { n.st.stun = Math.max(n.st.stun, n.boss ? 0.5 : 1); if (!n.boss) n.windup = null; }
      }
    }
    if (w.range > 1 && uq.thunderBow && U.chance(run, 0.2)) {
      const near = run.mobs.filter((n) => n.hp > 0 && !n.hidden && U.cheb(n.x, n.y, m.x, m.y) <= 3).slice(0, 3);
      for (const n of near) { fx(run, { k: 'thunder', at: nearestCell(run, n) }); hurtMob(G, run, n, dmg * 0.7, 'light', { trigger: true }); }
    }
    if (w.range > 1 && uq.endlessQuiver && U.chance(run, 0.3)) {
      const other = run.mobs.find((n) => n !== m && n.hp > 0 && !n.hidden && distToHero(run, n) <= w.range) || (m.hp > 0 ? m : null);
      if (other) {
        fx(run, { k: 'shot', from: [h.x, h.y], to: nearestCell(run, other), elem: w.elem, kind: w.kind });
        hurtMob(G, run, other, dmg, w.elem, { basic: true });
      }
    }
    const manaMul = hasKey(run, 'manaCircuit') ? 3 : 1;
    h.mp = Math.min(cs.maxMp, h.mp + ((cs.manaOnHit || 0) + 0.5) * manaMul); // 普通攻擊固定回一點魔
  }

  function usePotions(G, run) {
    const h = run.hero, cs = run.cs;
    const drink = (kind) => {
      const p = run.pack.items.find((q) => q.it.potion === kind);
      if (!p) return false;
      Pack.remove(run.pack, p.it.id);
      run.potionsUsed[kind]++;
      if (kind === 'red') {
        h.hot.push({ kind: 'hp', rate: (cs.maxHp * 0.45 * (hasMod(run, 'weakPots') ? 0.6 : 1)) / 4, t: 4 });
        h.potT.red = 5;
        if (cs.spec.redArmor) h.buffs.redArmor = { t: 5, v: cs.spec.redArmor };
      } else {
        h.hot.push({ kind: 'mp', rate: (cs.maxMp * 0.5 * (hasMod(run, 'weakPots') ? 0.6 : 1)) / 3, t: 3 });
        h.potT.blue = 5;
        if (cs.spec.blueLight) h.nextLightDisc = cs.spec.blueLight;
        if (cs.spec.blueThunder) {
          buildOcc(run);
          const near = run.mobs.filter((m) => m.hp > 0 && distToHero(run, m) <= 5).slice(0, 3);
          for (const m of near) {
            fx(run, { k: 'thunder', at: nearestCell(run, m) });
            hurtMob(G, run, m, cs.spec.blueThunder, 'light', { trigger: true });
          }
        }
      }
      fx(run, { k: 'potion', kind });
      return true;
    };
    if (h.potT.red <= 0 && h.hp < cs.maxHp * run.thr.red) {
      if (!drink('red') && !run._warnedRed) { run._warnedRed = true; msg(run, '紅水用完了', 'warn'); }
    }
    if (h.potT.blue <= 0 && h.mp < cs.maxMp * run.thr.blue) drink('blue');
  }

  // ---------- 技能 ----------
  function plan(run, sk) {
    buildOcc(run);
    const h = run.hero;
    const map = mapOf(run);
    const shape = sk.shape;
    const uniq = (cells) => {
      const set = new Set(), out = [];
      for (const [x, y] of cells) {
        const m = mobAt(run, x, y);
        if (m && !m.hidden && !set.has(m.id)) { set.add(m.id); out.push(m); }
      }
      return out;
    };
    if (shape.t === 'buff') return { cells: [], targets: [], self: true };
    if (shape.t === 'line') {
      let best = null;
      for (const [dx, dy] of U.DIRS8) {
        const cells = [];
        for (let k = 1; k <= shape.len; k++) {
          const x = h.x + dx * k, y = h.y + dy * k;
          if (!M.walkable(map, x, y)) break;
          cells.push([x, y]);
        }
        const t = uniq(cells);
        if (!t.length) continue;
        const near = Math.min(...t.map((m) => distToHero(run, m)));
        if (!best || t.length > best.targets.length || (t.length === best.targets.length && near < best.near))
          best = { cells, targets: t, dir: [dx, dy], near };
      }
      return best;
    }
    if (shape.t === 'self') {
      const n = shape.n;
      let best = null;
      const offs = n === 3 ? [[-1, -1]] : n === 4 ? [[-1, -1], [-2, -1], [-1, -2], [-2, -2]] : [[0, 0], [-1, 0], [0, -1], [-1, -1]];
      for (const [ox, oy] of offs) {
        const cells = [];
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const cx = h.x + ox + x, cy = h.y + oy + y;
          if (M.walkable(map, cx, cy) || mobAt(run, cx, cy)) cells.push([cx, cy]);
        }
        const t = uniq(cells);
        if (t.length && (!best || t.length > best.targets.length)) best = { cells, targets: t };
      }
      return best;
    }
    if (shape.t === 'area') {
      const n = shape.n;
      let best = null;
      for (const m of run.mobs) {
        if (m.hp <= 0 || m.hidden || distToHero(run, m) > shape.range) continue;
        for (const [mx, my] of cellsOf(m)) {
          for (let oy = 0; oy < n; oy++) for (let ox = 0; ox < n; ox++) {
            const ax = mx - ox, ay = my - oy;
            const cells = [];
            for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells.push([ax + x, ay + y]);
            const t = uniq(cells);
            const d = U.dist(ax + n / 2, ay + n / 2, h.x, h.y);
            if (!best || t.length > best.targets.length || (t.length === best.targets.length && d < best.d)) best = { cells, targets: t, d };
          }
        }
      }
      return best && best.targets.length ? best : null;
    }
    if (shape.t === 'single') {
      const cands = [];
      for (const m of run.mobs) {
        if (m.hp <= 0 || m.hidden) continue;
        const d = distToHero(run, m);
        if (d > shape.range) continue;
        if (shape.range > 1) {
          const c = nearestCell(run, m);
          if (!clearLine(run, h.x, h.y, c[0], c[1], m.id, shape.los)) continue;
        }
        cands.push({ m, d });
      }
      if (!cands.length) return null;
      const aim = D.SKILLS[sk.id].aim;
      let pick;
      if (aim === 'bossCharge') pick = cands.find((c) => c.m.boss && c.m.cur) || null;
      if (!pick && aim === 'lowestHp') pick = cands.slice().sort((a, b) => a.m.hp - b.m.hp)[0];
      if (!pick && aim === 'caster') pick = cands.find((c) => D.MONSTERS[c.m.type] && D.MONSTERS[c.m.type].caster) || cands.find((c) => c.m.boss === 'parasite');
      if (!pick) pick = cands.sort((a, b) => a.d - b.d)[0];
      return { cells: cellsOf(pick.m), targets: [pick.m] };
    }
    return null;
  }

  function manaCost(run, sk) {
    let c = sk.mana;
    if (sk.elem === 'light' && run.hero.nextLightDisc) c = Math.round(c * (1 - run.hero.nextLightDisc / 100));
    if (run.hero.freeCast) c = 0;
    return Math.max(0, c);
  }

  function cast(G, run, sk, manual) {
    const h = run.hero, cs = run.cs;
    if (h.cds[sk.id] > 0) return 'cd';
    const p = plan(run, sk);
    if (!p) return 'none';
    const cost = manaCost(run, sk);
    if (h.mp < cost) return 'mana';
    h.mp -= cost;
    if (sk.elem === 'light' && h.nextLightDisc) h.nextLightDisc = 0;
    h.freeCast = false;
    h.cds[sk.id] = sk.cd;
    const uq = uqOf(run);
    if (uq.starEater) h.hp = Math.max(1, h.hp - cs.maxHp * 0.02);
    if (uq.twinRing && U.chance(run, 0.2)) { delete h.cds[sk.id]; fx(run, { k: 'twin', x: h.x, y: h.y }); }
    h.gcd = 0.3;
    const def = D.SKILLS[sk.id];
    fx(run, { k: 'skill', id: sk.id, cells: p.cells, dir: p.dir, from: [h.x, h.y], targets: p.targets.map((m) => nearestCell(run, m)), manual });
    if (p.dir && p.dir[0]) h.face = p.dir[0];
    run._casts = (run._casts || 0) + 1;
    if (manual) run._manualCasts = (run._manualCasts || 0) + 1;

    if (p.self) {
      if (sk.id === 'stoneskin') h.buffs.stone = { t: 6 };
      if (sk.id === 'heal') h.hot.push({ kind: 'hp', rate: (cs.maxHp * 0.3) / 5, t: 5 });
      if (sk.id === 'static') {
        h.absorb = Math.round(cs.maxHp * 0.25);
        h.absorbT = 8;
        h.buffs.static = { t: 8, zap: sk.power * 0.4 };
        h.zapT = 0.2;
      }
      const boss = run.mobs.find((m) => m.boss && m.cur);
      if (boss && cs.spec.chargeCd) h.chargeDef = { id: sk.id, boss: boss.id };
      return 'ok';
    }

    let mul = U.randRange(run, 0.92, 1.08);
    if (berserkOn(run)) mul *= 1.25;
    if (hasKey(run, 'spellShield')) {
      h.absorb = Math.min(cs.maxHp * 0.2, h.absorb + cost * 1.5);
      h.absorbT = Math.max(h.absorbT, 3);
    }
    if (sk.elem === 'phys' && h.nextPhys) { mul *= 1 + h.nextPhys / 100; h.nextPhys = 0; }
    if (cs.spec.elemChain && h.lastElem && h.lastElem !== sk.elem) mul *= 1 + cs.spec.elemChain / 100;
    if (uq.prism && sk.elem !== 'phys' && h.lastElem && h.lastElem !== sk.elem) h.buffs.prism = { t: 6, n: Math.min(4, ((h.buffs.prism && h.buffs.prism.n) || 0) + 1) };
    h.lastElem = sk.elem;
    const chill = def.slow || (uq.frostheart && sk.elem === 'cold');

    if (def.zone) {
      run.zones.push({ cells: p.cells, dps: sk.dmg * mul, t: def.zone, tick: 0, elem: sk.elem, burn: def.burn && sk.elem === 'fire', slow: def.slowZone || chill });
    } else {
      for (const m of p.targets) {
        hurtMob(G, run, m, sk.dmg * mul, sk.elem, { skill: sk.id, interrupt: def.interrupt, pierce: def.armorPierce });
        if (m.hp <= 0) continue;
        if (def.shock) applyShock(run, m, cs);
        // 隕火、熔鐵斬：命中時點燃
        if (def.burn && sk.elem === 'fire' && m.st.burn.length < 3) m.st.burn.push({ dps: sk.dmg * mul * 0.12, t: 3 });
        if (chill) {
          let dur = 3;
          if (cs.spec.burnCold && m.st.burn.length) dur *= 1 + cs.spec.burnCold / 100;
          if (m.boss) dur /= 2;
          m.st.slow = { p: 0.3, t: dur };
        }
        if (def.stun) {
          m.st.stun = Math.max(m.st.stun, m.boss ? def.stun / 2 : def.stun);
          if (!m.boss) m.windup = null;
        }
      }
    }
    if (cs.spec.cometEcho && !def.zone && p.targets.length && U.chance(run, cs.spec.cometEcho / 100)) {
      const t = p.targets.find((m) => m.hp > 0);
      if (t) { const tc = nearestCell(run, t); fx(run, { k: 'explode', x: tc[0], y: tc[1] }); hurtMob(G, run, t, sk.dmg * mul * 0.4, 'fire', { trigger: true }); }
    }
    if (def.restore) h.mp = Math.min(cs.maxMp, h.mp + (sk.restore || def.restore));
    if (cs.spec.multiRefund && p.targets.length >= 3) h.mp = Math.min(cs.maxMp, h.mp + (cost * cs.spec.multiRefund) / 100);
    return 'ok';
  }

  function applyShock(run, m, cs) {
    const dur = (m.boss ? 1.5 : 3) * (cs.keys.includes('thunderLoop') ? 1.5 : 1);
    const p = Math.min(0.2, (m.st.shock ? m.st.shock.p : 0) + 0.1);
    m.st.shock = { p, t: dur };
  }

  function condOk(run, rule, sk, p) {
    const h = run.hero, cs = run.cs;
    for (const c of rule.cond) {
      if (c.k === 'avail') continue;
      if (c.k === 'enemies') {
        let n;
        if (sk.shape.t === 'buff') n = run.mobs.filter((m) => m.hp > 0 && distToHero(run, m) <= 2).length;
        else n = p ? p.targets.length : 0;
        if (n < c.n) return false;
      }
      if (c.k === 'hpBelow' && h.hp / cs.maxHp * 100 >= c.p) return false;
      if (c.k === 'mpAbove' && h.mp / cs.maxMp * 100 <= c.p) return false;
      if (c.k === 'bossCharge' && !run.mobs.some((m) => m.boss && m.cur && m.cur.danger)) return false;
      if (c.k === 'bossFight' && !run.mobs.some((m) => m.boss)) return false;
    }
    return true;
  }

  function autoCast(G, run) {
    const h = run.hero, cs = run.cs;
    for (const rule of run.rules) {
      if (!rule.on) continue;
      const sk = cs.skills.find((s) => s.id === rule.id);
      if (!sk || h.cds[sk.id] > 0) continue;
      const p = sk.shape.t === 'buff' ? { self: true, targets: [] } : plan(run, sk);
      if (!p) continue;
      if (sk.shape.t === 'buff' && !run.mobs.some((m) => m.hp > 0)) continue;
      if (!condOk(run, rule, sk, p)) continue;
      if (h.mp < manaCost(run, sk)) { run._mpStarved = (run._mpStarved || 0) + 1; return; } // 高優先招等魔，不讓低優先招搶
      const r = cast(G, run, sk, false);
      if (r === 'ok') return;
    }
  }

  // ---------- 傷害 ----------
  function hurtMob(G, run, m, amount, elem, o) {
    o = o || {};
    if (m.hp <= 0) return 0;
    const cs = run.cs;
    let dmg = amount;
    if (elem === 'phys') {
      const pierce = Math.min(0.8, (o.pierce || 0) + (cs.spec.armorPierce || 0) / 100);
      const a = m.armor * (1 - pierce);
      dmg *= 1 - a / (a + 100);
    }
    if (m.st.shock) dmg *= 1 + m.st.shock.p;
    if (m.boss && m.weak > 0) dmg *= 1.5;
    if (cs.spec.chillBane && m.st.slow) dmg *= 1 + cs.spec.chillBane / 100;
    if (m.dr) dmg *= 1 - m.dr;
    const uq = uqOf(run);
    if (uq.madCrown) dmg *= 1 + Math.min(0.5, 0.5 * Math.max(0, 1 - run.hero.hp / cs.maxHp));
    dmg = Math.max(1, dmg);
    if (elem === 'fire' && cs.spec.fireLeech) healHero(run, (Math.min(dmg, m.hp) * cs.spec.fireLeech) / 100);
    if (uq.vampFang) healHero(run, Math.min(dmg, m.hp) * 0.02);
    m.hp -= dmg;
    m.hitT = 0.15;
    const c = nearestCell(run, m);
    fx(run, { k: 'dmg', x: c[0], y: c[1], v: Math.round(dmg), elem, big: !o.basic && !o.trigger, id: m.id });
    if (o.skill && m.hp > 0 && hasKey(run, 'frostfire')) {
      if (elem === 'fire' && !(m.st.slow && m.st.slow.p > 0.15)) m.st.slow = { p: 0.15, t: m.boss ? 0.5 : 1 };
      if (elem === 'cold' && m.st.burn.length < 3) m.st.burn.push({ dps: amount * 0.15, t: 3 });
    }
    // 打斷
    if (o.interrupt && m.hp > 0) {
      if (m.boss && m.cur) {
        const mv = D.BOSS_MOVES[m.cur.move];
        if (mv.interruptible && m.intImmune <= 0) {
          logEvent(run, `打斷了頭目的「${mv.name}」`);
          msg(run, `破招！打斷「${mv.name}」`, 'good');
          fx(run, { k: 'interrupt', x: c[0], y: c[1] });
          m.cur = null;
          m.intImmune = 6;
          m.moveT = 2.5;
        } else if (!m.cur.weakened) {
          m.cur.weakened = true;
          fx(run, { k: 'interrupt', x: c[0], y: c[1], weak: true });
          msg(run, `削弱了「${mv.name}」`, 'good');
        }
      } else if (!m.boss && m.windup) {
        m.windup = null;
        fx(run, { k: 'interrupt', x: c[0], y: c[1] });
      }
    }
    if (m.hp <= 0) killMob(G, run, m, o);
    return dmg;
  }

  function killMob(G, run, m, o) {
    const cs = run.cs;
    const c = cellsOf(m)[0];
    fx(run, { k: 'death', x: c[0], y: c[1], type: m.boss || m.type, w: m.w });
    if (!m.summon) run.kills++;
    run.floorLog[run.floorLog.length - 1].kills++;
    const xpMul = D.ECON.xpGap(G.hero.level - m.lvl);
    run.xpMul = xpMul;
    const xp = m.xp * (1 + 0.02 * (run.wave - 1)) * xpMul * (1 + (run.modXp || 0) / 100);
    LH.Game.addXp(G, run, xp);
    if (cs.spec.killPhys) run.hero.nextPhys = cs.spec.killPhys;
    if (cs.spec.killHeal) healHero(run, cs.spec.killHeal);
    const uq = uqOf(run);
    if (uq.soulGrip) run.hero.mp = Math.min(cs.maxMp, run.hero.mp + cs.maxMp * 0.03);
    if (uq.overseerRing && m.elite) run.hero.mp = cs.maxMp;
    if (uq.emberKing && !(o && o.trigger) && !m.boss) {
      buildOcc(run);
      fx(run, { k: 'explode', x: c[0], y: c[1] });
      const dmg = (cs.uqPow.emberKing || 15) * 1.0 * (cs.fireMul || 1);
      for (const n of run.mobs.slice()) if (n !== m && n.hp > 0 && U.cheb(n.x, n.y, m.x, m.y) <= 1) hurtMob(G, run, n, dmg, 'fire', { trigger: true });
    }
    const mdef = D.MONSTERS[m.type];
    if (!m.boss && mdef && mdef.deathPool) {
      const cells = [];
      for (let y = m.y - 1; y <= m.y + 1; y++) for (let x = m.x - 1; x <= m.x + 1; x++) if (M.walkable(mapOf(run), x, y)) cells.push([x, y]);
      addHazard(run, cells, m.dmg * mdef.deathPool.mul, mdef.deathPool.t, mdef.deathPool.elem);
    }
    if (cs.spec.killShards && !o.trigger) {
      buildOcc(run);
      for (const n of run.mobs) {
        if (n === m || n.hp <= 0) continue;
        let adj = false;
        for (const [x, y] of cellsOf(n)) for (const [mx, my] of cellsOf(m)) if (U.cheb(x, y, mx, my) <= 1) adj = true;
        if (adj) hurtMob(G, run, n, cs.spec.killShards, 'phys', { trigger: true });
      }
      fx(run, { k: 'shards', x: c[0], y: c[1] });
    }
    if (m.boss) {
      // 頭目死亡：召喚物一併消散
      for (const n of run.mobs) if (n.summon) { n.hp = 0; fx(run, { k: 'death', x: n.x, y: n.y, type: n.type, w: 1 }); }
      bossDrops(G, run, m);
      logEvent(run, `擊敗頭目 ${D.BOSSES[m.boss].name}`);
      return;
    }
    if (m.elite) {
      if (m.elite.includes('fire')) {
        const cells = [];
        for (let y = m.y - 1; y <= m.y + 1; y++) for (let x = m.x - 1; x <= m.x + 1; x++) if (M.walkable(mapOf(run), x, y)) cells.push([x, y]);
        addHazard(run, cells, m.dmg * 0.6, 3, 'fire');
      }
      if (m.elite.includes('split')) {
        buildOcc(run);
        let made = 0;
        for (const [dx, dy] of U.DIRS8) {
          if (made >= 2) break;
          const x = m.x + dx, y = m.y + dy;
          if (!freeAt(run, x, y, 1)) continue;
          const c = makeMob(run, m.type, x, y, m.lvl, { summon: true, splitChild: true });
          c.hp = c.maxHp = Math.round(m.maxHp * 0.3);
          c.dmg = m.dmg * 0.6;
          run.mobs.push(c);
          run._occ[y * mapOf(run).w + x] = c.id;
          fx(run, { k: 'spawn', x, y });
          made++;
        }
      }
      // 精英怪：必掉一件稀有以上，再有一半機會多一件
      const lb = lootBonus(run);
      addDrop(G, run, lootItem(run, 'elite', m.lvl, () => Items.make(run, { ilvl: m.lvl, rarity: Items.rollRarity(run, run.floor + 1, run.diff, 2, lb) })), m.x, m.y);
      if (U.chance(run, 0.5)) addDrop(G, run, Items.make(run, { ilvl: m.lvl, rarity: Items.rollRarity(run, run.floor, run.diff, 0, lb) }), m.x, m.y);
      logEvent(run, `擊敗精英怪 ${m.eName}`);
      return;
    }
    if (m.summon) return;
    rollDrop(G, run, m);
  }

  function uqOf(run) {
    return run.cs.uq || NO_UQ;
  }
  const NO_UQ = {};

  function dropChance(run) {
    const expected = [1.2, 0.8, 0.9, 1.0, 0, 0, 0][run.floor - 1];
    return (expected / run.killTarget) * (uqOf(run).greedRing ? 1.15 : 1) * (1 + (run.modLoot || 0) / 100);
  }

  function lootBonus(run) {
    return dungeonOf(run).rarityBonus + (run.modLoot || 0) / 200;
  }
  // 每一次掉落都有一點機會改成傳奇寶物
  function lootItem(run, kind, ilvl, mk) {
    if (U.chance(run, D.ECON.uniqChance(kind, run.diff) * (1 + (run.modLoot || 0) / 100))) return Items.makeUnique(run, Items.rollUnique(run, run.dungeon, run.codexSeen), ilvl);
    return mk();
  }

  function addDrop(G, run, it, x, y) {
    it.rev = false;
    run.pending.push(it);
    run.drops++;
    run.floorLog[run.floorLog.length - 1].drops.push(it.rarity);
    if (it.uniq) {
      // 圖鑑：第一次打到的會特別標示
      const cx = G ? (G.codex = G.codex || {}) : {};
      const isNew = !cx[it.uniq];
      cx[it.uniq] = { n: ((cx[it.uniq] && cx[it.uniq].n) || 0) + 1, first: (cx[it.uniq] && cx[it.uniq].first) || Date.now() };
      if (!run.codexSeen) run.codexSeen = [];
      if (!run.codexSeen.includes(it.uniq)) run.codexSeen.push(it.uniq);
      run.uniqFound = (run.uniqFound || 0) + 1;
      fx(run, { k: 'drop', x, y, r: it.rarity, uq: it.name, isNew });
      msg(run, `傳奇寶物「${it.name}」掉落！${isNew ? '（圖鑑新發現）' : ''}`, 'uniq');
      logEvent(run, `傳奇寶物掉落：${it.name}`);
      return;
    }
    fx(run, { k: 'drop', x, y, r: it.rarity });
    if (it.rarity >= 4) msg(run, `${D.RARITY[it.rarity].name}裝備掉落！`, 'loot' + it.rarity);
  }

  function rollDrop(G, run, m) {
    const lvl = m.lvl;
    let drop = U.chance(run, dropChance(run));
    if (!drop && run.floor === 1 && run.drops === 0 && run.kills >= run.killTarget) drop = true; // 第一層保底
    if (!drop) return;
    const r = Items.rollRarity(run, run.floor, run.diff, 0, lootBonus(run));
    addDrop(G, run, lootItem(run, 'mob', lvl, () => Items.make(run, { ilvl: lvl, rarity: r })), m.x, m.y);
  }

  function bossDrops(G, run, m) {
    const minR = D.diff(run.diff).bossMinRarity;
    const dg = dungeonOf(run);
    const r1 = Items.rollRarity(run, run.floor + 1, run.diff, minR, lootBonus(run));
    addDrop(G, run, lootItem(run, 'boss', m.lvl + 1, () => Items.make(run, { ilvl: m.lvl + 1, rarity: r1, bossPool: U.chance(run, 0.2), pool: dg.pool })), m.x, m.y);
    if (U.chance(run, 0.25)) {
      const r2 = Items.rollRarity(run, run.floor + 1, run.diff, minR, lootBonus(run));
      addDrop(G, run, Items.make(run, { ilvl: m.lvl + 1, rarity: r2, bossPool: true, pool: dg.pool }), m.x + 1, m.y + 1);
    }
  }

  // 英雄受傷；src: { name, ranged, boss, move }
  function hurtHero(G, run, amount, elem, src) {
    const h = run.hero, cs = run.cs;
    if (run.phase !== 'fight') return 0;
    const L = mobLevel(run);
    const canAvoid = !src.move && !src.hazard;
    if (canAvoid) {
      const dodgeC = Math.min(hasKey(run, 'phantom') ? 0.6 : 0.5, cs.dodge / (cs.dodge + 60 + 12 * L));
      if (U.chance(run, dodgeC)) {
        fx(run, { k: 'miss', x: h.x, y: h.y });
        if (hasKey(run, 'phantom')) h.phantom = true;
        if (uqOf(run).shadowstep) h.freeCast = true;
        if (cs.spec.dodgeMana && !h.specCd.dodgeMana) { h.mp = Math.min(cs.maxMp, h.mp + cs.spec.dodgeMana); h.specCd.dodgeMana = 1; }
        return 0;
      }
    }
    let dmg = amount;
    const blockC = (cs.block + (h.buffs.stone ? 15 : 0)) / 100;
    if (canAvoid && blockC > 0 && U.chance(run, Math.min(0.6, blockC))) {
      dmg *= 0.35;
      fx(run, { k: 'block', x: h.x, y: h.y });
      if (cs.spec.blockShield && !h.specCd.blockShield) {
        h.absorb += Math.round((cs.maxHp * cs.spec.blockShield) / 100);
        h.absorbT = Math.max(h.absorbT, 4);
        h.specCd.blockShield = 3;
      }
      if (uqOf(run).mirrorShield && src.mob && src.mob.hp > 0) hurtMob(G, run, src.mob, amount, 'phys', { trigger: true });
      if (run.phase !== 'fight') return 0;
    }
    if (elem === 'phys') {
      let armor = cs.armor;
      if (h.buffs.stone) armor = armor * 1.6 + 10;
      if (h.buffs.redArmor) armor *= 1 + h.buffs.redArmor.v / 100;
      dmg *= 1 - Math.min(0.75, armor / (armor + 40 + 14 * L));
    } else {
      const cap = elem === 'fire' && cs.spec.forgeHeart ? 80 : 75;
      const res = U.clamp(cs.res[elem] - D.diff(run.diff).resPen - (hasMod(run, 'curse') ? 15 : 0) + (h.buffs.lowRes ? h.buffs.lowRes.v : 0) + (h.buffs.prism ? h.buffs.prism.n * 5 : 0), -60, cap);
      dmg *= 1 - res / 100;
    }
    if (cs.spec.starShield && !src.hazard && !h.specCd.starShield) {
      dmg *= 1 - cs.spec.starShield / 100;
      h.specCd.starShield = 8;
      fx(run, { k: 'block', x: h.x, y: h.y });
    }
    const uq = uqOf(run);
    if (uq.greedRing) dmg *= 1.15;
    if (uq.overseerRing && src.elite) dmg *= 0.75;
    if (h.buffs.unyield) dmg *= 0.5;
    if (h.absorb > 0) {
      const a = Math.min(h.absorb, dmg);
      h.absorb -= a;
      dmg -= a;
    }
    h.hp -= dmg;
    run.dmgLog.push({ t: run.total, amt: dmg, name: src.name, ranged: !!src.ranged, boss: !!src.boss, move: src.move || null, hazard: !!src.hazard });
    fx(run, { k: 'hurt', x: h.x, y: h.y, v: Math.round(dmg), elem });
    if (uq.unyielding && h.hp > 0 && h.hp < cs.maxHp * 0.3 && !h.specCd.unyield) {
      h.buffs.unyield = { t: 3 };
      h.specCd.unyield = 30;
      fx(run, { k: 'unyield', x: h.x, y: h.y });
      msg(run, '不屈鐵壁：3 秒內受到的傷害減半', 'good');
    }
    if (cs.spec.lowRes && h.hp < cs.maxHp * 0.35 && h.hp > 0 && !h.specCd.lowRes) {
      h.buffs.lowRes = { t: 5, v: cs.spec.lowRes };
      h.specCd.lowRes = 20;
    }
    if (h.chargeDef && src.move) {
      const k = h.chargeDef.id;
      if (h.cds[k]) h.cds[k] *= 1 - cs.spec.chargeCd / 100;
      h.chargeDef = null;
    }
    if (h.hp <= 0) {
      h.hp = 0;
      heroDied(G, run);
    }
    return dmg;
  }

  function heroDied(G, run) {
    run.phase = 'dead';
    run.deathCause = analyzeDeath(run);
    logEvent(run, `倒下：${run.deathCause.main}`);
    fx(run, { k: 'heroDeath', x: run.hero.x, y: run.hero.y });
  }

  function analyzeDeath(run) {
    const log = run.dmgLog;
    const total = log.reduce((a, b) => a + b.amt, 0) || 1;
    const ranged = log.filter((e) => e.ranged).reduce((a, b) => a + b.amt, 0);
    const moves = {};
    for (const e of log) if (e.move) moves[e.move] = (moves[e.move] || 0) + e.amt;
    const topMove = Object.entries(moves).sort((a, b) => b[1] - a[1])[0];
    const alive = run.mobs.filter((m) => m.hp > 0).length;
    const notes = [];
    let main;
    const redLeft = Pack.count(run.pack, 'red');
    const pool = log.filter((e) => e.hazard).reduce((a, b) => a + b.amt, 0);
    if (topMove && topMove[1] / total > 0.35) main = `頭目招式「${D.BOSS_MOVES[topMove[0]].name}」`;
    else if (pool / total > 0.35) {
      // 依造成最多傷害的地形說明
      const by = {};
      for (const e of log) if (e.hazard) by[e.name] = (by[e.name] || 0) + e.amt;
      const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0][0];
      main = top === '星落' ? '被星落砸中' : top === '熔岩' || top === '火池' ? '站在熔岩或火池裡' : '站在毒沼裡';
    }
    else if (ranged / total > 0.5) main = '遠程集火';
    else if (alive >= 6) main = `敵人累積（場上 ${alive} 隻）`;
    else main = '近身圍攻';
    if (redLeft === 0) notes.push(run.potionsStart.red ? '紅水耗盡' : '沒有攜帶紅水');
    if (run.hero.lowMpT > 15 && run.cs.skills.length > 1) notes.push('長時間缺魔');
    if (alive >= 6 && !main.startsWith('敵人')) notes.push(`場上累積 ${alive} 隻`);
    return { main, notes };
  }

  // ---------- 怪物 ----------
  function updateMob(G, run, m, dt, field) {
    const h = run.hero;
    m.hitT = Math.max(0, m.hitT - dt);
    // 狀態
    if (m.st.burn.length) {
      let d = 0;
      for (const b of m.st.burn) { d += b.dps * Math.min(dt, b.t); b.t -= dt; }
      m.st.burn = m.st.burn.filter((b) => b.t > 0);
      m._burnAcc = (m._burnAcc || 0) + d;
      if (m._burnAcc >= 3 || !m.st.burn.length) {
        const v = m._burnAcc;
        m._burnAcc = 0;
        if (v > 0) {
          m.hp -= v;
          fx(run, { k: 'dmg', x: m.x, y: m.y, v: Math.round(v), elem: 'fire', dot: true, id: m.id });
          if (m.hp <= 0) { killMob(G, run, m, { trigger: true }); return; }
        }
      }
    }
    if (m.st.slow) { m.st.slow.t -= dt; if (m.st.slow.t <= 0) m.st.slow = null; }
    if (m.st.shock) { m.st.shock.t -= dt; if (m.st.shock.t <= 0) m.st.shock = null; }
    if (m.boss) { m.weak = Math.max(0, m.weak - dt); m.intImmune = Math.max(0, m.intImmune - dt); }
    m.atkT -= dt;
    if (m.st.stun > 0) { m.st.stun -= dt; return; }
    const spd = m.speed * (m.st.slow ? 1 - m.st.slow.p : 1);
    if (m.mt < 1) {
      m.mt = Math.min(1, m.mt + (dt * spd) / m.md);
      return;
    }
    if (m.boss) return updateBoss(G, run, m, dt, field);

    const def = D.MONSTERS[m.type];
    const d = distToHero(run, m);
    if (m.windup) {
      m.windup.t -= dt;
      if (m.windup.t <= 0) {
        m.windup = null;
        const inRange = d <= m.range && (m.range === 1 || clearLine(run, m.x, m.y, h.x, h.y, 0, false));
        if (inRange) {
          if (m.range > 1) fx(run, { k: 'mobShot', from: [m.x, m.y], to: [h.x, h.y], type: m.type, id: m.id });
          else fx(run, { k: 'mobHit', x: m.x, y: m.y, to: [h.x, h.y], id: m.id });
          const dealt = hurtHero(G, run, m.dmg * U.randRange(run, 0.85, 1.15), m.elem || def.elem, { name: m.eName || def.name, ranged: m.range > 1, mob: m, elite: !!m.elite });
          if (def.drain && run.phase === 'fight') h.mp = Math.max(0, h.mp - def.drain);
          if (m.elite && dealt > 0 && run.phase === 'fight') {
            if (m.elite.includes('cold')) slowHero(run, 0.3, 2);
            if (m.elite.includes('light')) h.mp = Math.max(0, h.mp - run.cs.maxMp * 0.06);
            if (m.elite.includes('vamp')) m.hp = Math.min(m.maxHp, m.hp + dealt * 1.5);
          }
          if (hasMod(run, 'bloodthirst') && dealt > 0) m.hp = Math.min(m.maxHp, m.hp + dealt);
          if (def.onHitSlow && run.phase === 'fight') slowHero(run, def.onHitSlow.p, def.onHitSlow.t);
          if (def.healAllies) {
            const ally = run.mobs.filter((o) => o !== m && o.hp > 0 && o.hp < o.maxHp && U.cheb(o.x, o.y, m.x, m.y) <= 4).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (ally) { ally.hp = Math.min(ally.maxHp, ally.hp + m.dmg * def.healAllies); fx(run, { k: 'mobHeal', x: ally.x, y: ally.y }); }
          }
          if (m.range === 1 && run.cs.spec.armorReflect) hurtMob(G, run, m, run.cs.spec.armorReflect, 'phys', { trigger: true });
        }
      }
      return;
    }
    const inRange = d <= m.range && (m.range === 1 || clearLine(run, m.x, m.y, h.x, h.y, 0, false));
    if (inRange) {
      if (h.x !== m.x) m.face = h.x > m.x ? 1 : -1;
      if (m.atkT <= 0) {
        m.windup = { t: def.windup, total: def.windup };
        m.atkT = 1 / m.aspd + def.windup;
      }
      return;
    }
    stepMob(run, m, field);
  }

  function stepMob(run, m, field) {
    const map = mapOf(run);
    buildOcc(run);
    const valAt = (x, y) => {
      let v = 1e9;
      for (let dy = 0; dy < m.w; dy++) for (let dx = 0; dx < m.w; dx++) v = Math.min(v, field[(y + dy) * map.w + x + dx]);
      return v;
    };
    const cur = valAt(m.x, m.y);
    let best = null, bv = cur;
    for (const [dx, dy] of U.DIRS8) {
      const nx = m.x + dx, ny = m.y + dy;
      let ok = true;
      for (let yy = 0; yy < m.w && ok; yy++)
        for (let xx = 0; xx < m.w && ok; xx++) {
          const cx = nx + xx, cy = ny + yy;
          if (!M.walkable(map, cx, cy)) ok = false;
          else {
            const o = run._occ[cy * map.w + cx];
            if (o !== 0 && o !== m.id) ok = false;
          }
        }
      if (!ok) continue;
      if (m.w === 1 && dx && dy && (!M.walkable(map, m.x + dx, m.y) || !M.walkable(map, m.x, m.y + dy))) continue;
      const v = valAt(nx, ny);
      if (v < bv - 1e-6) { bv = v; best = [dx, dy]; }
    }
    if (best) {
      m.px = m.x; m.py = m.y;
      m.x += best[0]; m.y += best[1];
      m.md = best[0] && best[1] ? 1.4 : 1;
      const md = D.MONSTERS[m.type];
      if (map.slow && !m.boss && !(md && md.native) && map.slow[m.y * map.w + m.x]) m.md *= 1.6;
      m.mt = 0;
      if (best[0]) m.face = best[0];
      buildOcc(run);
    }
  }

  // ---------- 頭目 ----------
  function bossCenter(m) {
    return [m.x + 0.5, m.y + 0.5];
  }

  function squareCells(cx, cy, n) {
    const out = [];
    const o = Math.floor((n - 1) / 2);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out.push([cx - o + x, cy - o + y]);
    return out;
  }

  // 依招式資料算出預告範圍
  function moveCells(run, m, mv, data) {
    const h = run.hero;
    const map = mapOf(run);
    const big = run.diff >= 2;
    const [cx, cy] = bossCenter(m);
    // 主要方向：角色明顯偏向某一軸時走直線，否則走斜線
    const ddx = h.x - cx, ddy = h.y - cy;
    const dir = [Math.abs(ddx) >= Math.abs(ddy) * 0.5 ? Math.sign(ddx) : 0, Math.abs(ddy) >= Math.abs(ddx) * 0.5 ? Math.sign(ddy) : 0];
    if (!dir[0] && !dir[1]) dir[0] = 1;
    data.dir = dir;
    let cells = [];
    if (mv.area === 'dash') {
      for (let s = 1; s <= mv.len; s++)
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) cells.push([m.x + a + dir[0] * s, m.y + b + dir[1] * s]);
    } else if (mv.area === 'line') {
      const w = mv.width || 1;
      const ox = dir[0] > 0 ? m.x + 1 : m.x, oy = dir[1] > 0 ? m.y + 1 : m.y;
      for (let k = 0; k < w; k++) {
        const offX = dir[0] === 0 ? k : 0, offY = dir[0] !== 0 && dir[1] === 0 ? k : 0;
        for (let s = 1; s <= mv.len; s++) {
          const x = ox + dir[0] * s + offX, y = oy + dir[1] * s + offY;
          if (!M.walkable(map, x, y)) break;
          cells.push([x, y]);
        }
      }
    } else if (mv.area === 'around') {
      const o = (mv.n - 2) / 2;
      const x0 = Math.floor(m.x - o), y0 = Math.floor(m.y - o);
      for (let y = y0; y < y0 + mv.n; y++) for (let x = x0; x < x0 + mv.n; x++) cells.push([x, y]);
    } else if (mv.area === 'atHero') {
      cells = squareCells(h.x, h.y, big ? mv.nBig || mv.n : mv.n);
    } else if (mv.area === 'ring') {
      const R = Math.ceil(mv.r1);
      for (let y = m.y - R; y <= m.y + 1 + R; y++)
        for (let x = m.x - R; x <= m.x + 1 + R; x++) {
          const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
          if (d >= mv.r0 && d <= mv.r1) cells.push([x, y]);
        }
    } else if (mv.area === 'lines') {
      // 星座連線：幾條穿過角色附近的長直線
      const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
      for (let i = 0; i < mv.count; i++) {
        const [dx, dy] = U.pick(run, dirs);
        const px = h.x + U.randInt(run, -2, 2), py = h.y + U.randInt(run, -2, 2);
        const half = Math.floor(mv.len / 2);
        for (let s = -half; s <= half; s++) cells.push([px + dx * s, py + dy * s]);
      }
    } else if (mv.area === 'rain') {
      const spots = [[h.x, h.y]];
      for (let i = 1; i < mv.count; i++) spots.push([h.x + U.randInt(run, -3, 3), h.y + U.randInt(run, -3, 3)]);
      for (const [sx, sy] of spots) cells.push(...squareCells(sx, sy, mv.n));
    }
    const seen = new Set();
    return cells.filter(([x, y]) => {
      const key = y * map.w + x;
      if (seen.has(key) || !M.walkable(map, x, y)) return false;
      seen.add(key);
      return true;
    });
  }

  function startMove(run, m) {
    const def = D.BOSSES[m.boss];
    const moves = def.moves.filter((k) => D.BOSS_MOVES[k].minDiff <= run.diff);
    const k = m.nextMove || U.pick(run, moves);
    m.nextMove = null;
    const mv = D.BOSS_MOVES[k];
    const data = {};
    const cells = moveCells(run, m, mv, data);
    const tele = mv.tele * (hasMod(run, 'hasty') ? 0.7 : 1);
    m.cur = { move: k, t: tele, total: tele, cells, data, danger: cells.length > 0 && !!mv.dmg };
    if (mv.hide) m.hidden = true;
    fx(run, { k: 'tele', id: m.id, move: k });
    logEvent(run, `頭目預告「${mv.name}」`);
  }

  function heroIn(run, cells) {
    return cells.some(([x, y]) => x === run.hero.x && y === run.hero.y);
  }

  function execMove(G, run, m) {
    const k = m.cur.move;
    const mv = D.BOSS_MOVES[k];
    const weak = m.cur.weakened ? 0.5 : 1;
    const src = { name: D.BOSSES[m.boss].name, boss: true, move: k };
    const map = mapOf(run);
    buildOcc(run);
    const cells = m.cur.cells;
    if (cells.length) fx(run, { k: 'bossMove', move: k, cells, id: m.id });
    const hit = cells.length > 0 && heroIn(run, cells);
    if (hit && mv.mpDrain) run.hero.mp *= 1 - mv.mpDrain * weak;
    if (hit && mv.dmg) hurtHero(G, run, m.dmg * mv.dmg * weak, mv.elem || 'phys', src);
    if (run.phase !== 'fight') return;
    if (hit && mv.slow) slowHero(run, mv.slow.p * weak, mv.slow.t);
    if (hit && mv.heal) {
      m.hp = Math.min(m.maxHp, m.hp + m.maxHp * mv.heal * weak);
      fx(run, { k: 'mobHeal', x: m.x, y: m.y, big: true });
      msg(run, `${D.BOSSES[m.boss].name}吸取了你的生命！`, 'warn');
    }
    if (mv.area === 'dash') {
      // 沿線衝到盡頭
      const [dx, dy] = m.cur.data.dir;
      for (let s = 0; s < mv.len; s++) {
        const nx = m.x + dx, ny = m.y + dy;
        let ok = true;
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          const x = nx + a, y = ny + b;
          if (!M.walkable(map, x, y)) ok = false;
          const o = run._occ[y * map.w + x];
          if (o && o !== m.id) ok = false;
        }
        if (!ok) break;
        m.x = nx; m.y = ny; m.px = nx; m.py = ny;
      }
      buildOcc(run);
    }
    if (mv.leap) {
      // 從預告區落下／浮出
      const [hx, hy] = cells.length ? cells[0] : [m.x, m.y];
      let placed = false;
      for (let r = 0; r < 6 && !placed; r++)
        for (let y = hy - r; y <= hy + r && !placed; y++)
          for (let x = hx - r; x <= hx + r && !placed; x++) {
            run._occ.fill(0);
            for (const o of run.mobs) if (o !== m) for (const [ccx, ccy] of cellsOf(o)) run._occ[ccy * map.w + ccx] = o.id;
            run._occ[run.hero.y * map.w + run.hero.x] = -1;
            if (freeAt(run, x, y, 2)) { m.x = x; m.y = y; m.px = x; m.py = y; placed = true; }
          }
      buildOcc(run);
    }
    m.hidden = false;
    if (mv.pull) {
      // 引力場：把角色拉到頭目身邊，接著放冰晶新星
      const hh = run.hero;
      let spot = null, bd = 1e9;
      for (let y = m.y - 1; y <= m.y + 2; y++)
        for (let x = m.x - 1; x <= m.x + 2; x++) {
          if (x >= m.x && x <= m.x + 1 && y >= m.y && y <= m.y + 1) continue;
          if (!M.walkable(map, x, y) || (run._occ[y * map.w + x] > 0)) continue;
          const d = U.dist(x, y, hh.x, hh.y);
          if (d < bd) { bd = d; spot = [x, y]; }
        }
      if (spot) {
        fx(run, { k: 'pull', from: [hh.x, hh.y], to: spot });
        hh.x = spot[0]; hh.y = spot[1]; hh.px = spot[0]; hh.py = spot[1]; hh.mt = 1;
        buildOcc(run);
      }
      hurtHero(G, run, m.dmg * mv.dmg * weak, mv.elem || 'cold', src);
      if (run.phase !== 'fight') return;
      if (mv.next) m.nextMove = mv.next;
    }
    if (mv.weak) {
      m.weak = mv.weak;
      msg(run, `${D.BOSSES[m.boss].name}露出弱點！`, 'good');
    }
    if (mv.bolts) {
      for (let i = 0; i < mv.bolts; i++) {
        if (clearLine(run, m.x, m.y, run.hero.x, run.hero.y, 0, false)) {
          fx(run, { k: 'mobShot', from: [m.x, m.y], to: [run.hero.x, run.hero.y], type: mv.elem === 'cold' ? 'witch' : 'parasite' });
          hurtHero(G, run, m.dmg * mv.dmg * weak, mv.elem || 'light', { name: src.name, boss: true, ranged: true });
          if (run.phase !== 'fight') return;
        }
      }
    }
    if (mv.summon) summon(run, m, mv.summon[0], run.diff >= 1 && mv.summon[2] ? mv.summon[2] : mv.summon[1], mv.brood);
    if (mv.pool && cells.length) addHazard(run, cells, m.dmg * mv.pool.mul, mv.pool.t, mv.pool.elem);
    if (run.hero.chargeDef && run.hero.chargeDef.boss === m.id && run.phase === 'fight') run.hero.chargeDef = null;
    logEvent(run, `頭目施放「${mv.name}」${weak < 1 ? '（已削弱）' : ''}`);
  }

  function summon(run, m, type, n, brood) {
    const alive = run.mobs.filter((o) => o.summon && o.hp > 0).length;
    n = Math.min(n, 4 - alive);
    if (n <= 0) return;
    const map = mapOf(run);
    buildOcc(run);
    let made = 0;
    for (let r = 1; r < 5 && made < n; r++)
      for (let y = m.y - r; y <= m.y + 1 + r && made < n; y++)
        for (let x = m.x - r; x <= m.x + 1 + r && made < n; x++) {
          if (!freeAt(run, x, y, 1)) continue;
          const mob = makeMob(run, type, x, y, Math.max(1, m.lvl - 1), { summon: true, brood: !!brood });
          if (brood) { mob.hp = mob.maxHp = Math.round(mob.maxHp * 0.7); mob.speed = 3.6; }
          run.mobs.push(mob);
          run._occ[y * map.w + x] = mob.id;
          fx(run, { k: 'spawn', x, y });
          made++;
        }
  }

  function updateBoss(G, run, m, dt, field) {
    const h = run.hero;
    if (m.cur) {
      m.cur.t -= dt;
      if (m.cur.t <= 0) {
        execMove(G, run, m);
        m.cur = null;
        m.moveT = m.nextMove ? 0.5 : [6.5, 5.5, 4.5][Math.min(2, run.diff)] + U.rand(run) * 2;
      }
      return;
    }
    m.moveT -= dt;
    if (m.moveT <= 0) { startMove(run, m); return; }
    const d = distToHero(run, m);
    const def = D.BOSSES[m.boss];
    const reach = def.ranged ? 5 : 1;
    const can = d <= reach && (reach === 1 || clearLine(run, m.x, m.y, h.x, h.y, 0, false));
    if (m.windup) {
      m.windup.t -= dt;
      if (m.windup.t <= 0) {
        m.windup = null;
        if (can) {
          fx(run, def.ranged ? { k: 'mobShot', from: [m.x, m.y], to: [h.x, h.y], type: 'parasite', id: m.id } : { k: 'mobHit', x: m.x, y: m.y, to: [h.x, h.y], boss: true, id: m.id });
          hurtHero(G, run, m.dmg * U.randRange(run, 0.85, 1.15), def.ranged ? 'light' : 'phys', { name: def.name, boss: true, ranged: def.ranged, mob: m });
          if (!def.ranged && run.cs.spec.armorReflect) hurtMob(G, run, m, run.cs.spec.armorReflect, 'phys', { trigger: true });
        }
      }
      return;
    }
    if (can) {
      if (h.x !== m.x) m.face = h.x > m.x ? 1 : -1;
      if (m.atkT <= 0) { m.windup = { t: 0.45, total: 0.45 }; m.atkT = 1 / m.aspd + 0.45; }
      return;
    }
    stepMob(run, m, field);
  }

  // ---------- 區域 ----------
  function updateZones(G, run, dt) {
    for (const z of run.zones) {
      z.t -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.5;
        buildOcc(run);
        const seen = new Set();
        for (const [x, y] of z.cells) {
          const m = mobAt(run, x, y);
          if (!m || seen.has(m.id) || m.hp <= 0) continue;
          seen.add(m.id);
          hurtMob(G, run, m, z.dps * 0.5, z.elem, { skill: 'zone' });
          if (z.slow && m.hp > 0) m.st.slow = { p: 0.3, t: m.boss ? 0.6 : 1.2 };
          if (z.burn && m.hp > 0 && m.st.burn.length < 3) m.st.burn.push({ dps: z.dps * 0.15, t: 3 });
          else if (z.burn && m.hp > 0) m.st.burn.sort((a, b) => a.t - b.t)[0].t = 3;
        }
      }
    }
    run.zones = run.zones.filter((z) => z.t > 0);
  }

  // 敵方留下的毒沼：角色站在裡面會持續受傷（不能閃避或格擋）
  function addHazard(run, cells, dps, t, elem) {
    if (!run.hazards) run.hazards = [];
    run.hazards.push({ cells, dps, t, tick: 0.3, elem: elem || 'cold' });
    if (run.hazards.length > 30) run.hazards.shift();
  }
  function updateHazards(G, run, dt) {
    if (!run.hazards || !run.hazards.length) return;
    const h = run.hero;
    for (const z of run.hazards) {
      z.t -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.5;
        if (z.cells.some(([x, y]) => x === h.x && y === h.y)) {
          const fire = z.elem === 'fire';
          const red = fire && run.cs.spec.lavaWalker ? 1 - run.cs.spec.lavaWalker / 100 : 1;
          if (fire && uqOf(run).lavaHeart) healHero(run, z.dps * 0.25);
          else hurtHero(G, run, z.dps * 0.5 * red, z.elem || 'cold', { name: fire ? '火池' : '毒沼', hazard: true });
        }
        if (run.phase !== 'fight') return;
      }
    }
    run.hazards = run.hazards.filter((z) => z.t > 0);
  }

  // ---------- 清層 ----------
  function floorCleared(G, run) {
    const h = run.hero, cs = run.cs;
    run.phase = 'cleared';
    h.hp = Math.min(cs.maxHp, h.hp + cs.maxHp * 0.15);
    h.mp = Math.min(cs.maxMp, h.mp + cs.maxMp * 0.15);
    h.hot = [];
    for (const it of run.pending) it.rev = true;
    logEvent(run, `清層，取得 ${run.pending.length} 件裝備`);
    // 系統先擺放
    const still = [];
    for (const it of run.pending) if (!Pack.autoPlace(run.pack, it)) still.push(it);
    run.pending = still;
    if (run.mode === 'idle') idleFloorDecision(G, run);
    else run.awaitLoot = true;
  }

  // 掛機整理：稀有度優先，同稀有度看目前配裝評分
  function idleRepack(G, run) {
    const all = run.pack.items.map((p) => p.it).concat(run.pending);
    const pri = (it) => {
      if (it.potion) return 100;
      if (it.uniq) return 99;
      return it.rarity * 10 + Math.min(9, (it._score || 0));
    };
    for (const it of all) if (!it.potion && it._score == null) it._score = LH.Game.itemScore(G, it);
    const dropped = Pack.repack(run.pack, all, pri);
    run.pending = dropped;
  }

  function sellItem(G, run, it, auto) {
    const v = Math.round(Items.sellValue(it) * (uqOf(run).greedRing ? 1.4 : 1));
    G.gold += v;
    run.goldSold += v;
    run.sold.push({ name: it.name, rarity: it.rarity, gold: v, auto: !!auto, floor: run.floor });
    logEvent(run, `${auto ? '自動' : ''}出售 ${it.name}（+${v} 金）`);
    return v;
  }

  function sellPending(G, run, auto) {
    for (const it of run.pending) {
      if (it.potion) continue;
      if (auto && it.uniq && G) {
        G.stash.push(it);
        logEvent(run, `背包放不下，傳奇寶物「${it.name}」直接寄回營地`);
        continue;
      }
      sellItem(G, run, it, auto);
    }
    run.pending = [];
  }

  function idleFloorDecision(G, run) {
    idleRepack(G, run);
    sellPending(G, run, true);
    if (run.floor >= run.floors) return endRun(G, run, 'victory');
    const redLeft = Pack.count(run.pack, 'red');
    if (run.retreatAfter) return endRun(G, run, 'retreat');
    if (run.hero.hp < run.cs.maxHp * run.thr.retreatHp && redLeft === 0) {
      logEvent(run, '生命偏低且紅水用完，撤退');
      return endRun(G, run, 'retreat');
    }
    nextFloor(G, run);
  }

  function nextFloor(G, run) {
    sellPending(G, run, true);
    run.awaitLoot = false;
    run.floor++;
    setupFloor(run);
  }

  function endRun(G, run, how) {
    if (how !== 'death') sellPending(G, run, true);
    run.awaitLoot = false;
    run.phase = 'ended';
    run.how = how;
  }

  LH.Sim = {
    DT, newRun, step, tick, plan, cast, setupFloor, mapOf, cellsOf, buildOcc,
    hurtHero, hurtMob, reveal, hasMod, idleRepack, dungeonOf, addHazard, makeElite, sellItem, sellPending, nextFloor, endRun, idleFloorDecision, distToHero, mobLevel, analyzeDeath,
  };
})(typeof window !== 'undefined' ? window : globalThis);
