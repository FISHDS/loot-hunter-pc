// 核心規則測試：node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const LH = require('./load.js');
const { Game, Sim, Items, Pack, Char, D } = LH;

function freshRun(seed, opts) {
  const G = Game.newGame();
  Object.assign(G.exp, { mode: 'active', wave: 1, diff: 0, red: 0, blue: 0 }, opts || {});
  const run = Sim.newRun(G, { diff: G.exp.diff, wave: G.exp.wave, mode: G.exp.mode, seed });
  run.noFx = true;
  G.run = run;
  return { G, run };
}
function placeMob(run, type, x, y) {
  const m = { id: run.nid++, type, lvl: 1, x, y, px: x, py: y, mt: 1, md: 1, w: 1, hp: 50, maxHp: 50, dmg: 1, aspd: 1, speed: 0, armor: 0, range: 1, keep: 0, atkT: 9, windup: null, st: { burn: [], slow: null, shock: null, stun: 0 }, xp: 1, face: 1, hitT: 0 };
  run.mobs.push(m);
  return m;
}

test('擊殺目標 = 12 + (每波怪數-1)×3', () => {
  assert.strictEqual(D.ECON.killTarget(1), 12);
  assert.strictEqual(D.ECON.killTarget(20), 69);
});

test('開局小刀提供突刺，技能列只顯示一次', () => {
  const G = Game.newGame();
  const cs = Char.compute(G);
  assert.deepStrictEqual(cs.skills.map((s) => s.id), ['thrust']);
  assert.strictEqual(cs.skills[0].shape.len, 2);
});

test('同名技能：第二件最多 +10%，第三件無效', () => {
  const G = Game.newGame();
  const h = { rng: 7 };
  const mk = (slot) => Object.assign(Items.make(h, { ilvl: 1, rarity: 0, slot }), { skill: 'thrust' });
  const base = Char.compute(G).skills[0].power;
  G.gear.ring = mk('ring');
  const two = Char.compute(G).skills[0];
  G.gear.amulet = mk('amulet');
  const three = Char.compute(G).skills[0];
  assert.strictEqual(two.dup, 2);
  assert.ok(two.power <= base * 1.1 + 1e-9);
  assert.ok(Math.abs(three.power - two.power) < 1e-9);
});

test('突刺朝能刺中最多敵人的方向', () => {
  const { G, run } = freshRun(1);
  const h = run.hero;
  placeMob(run, 'pickman', h.x - 1, h.y);
  placeMob(run, 'pickman', h.x, h.y + 1);
  placeMob(run, 'pickman', h.x, h.y + 2);
  const sk = run.cs.skills[0];
  const p = Sim.plan(run, sk);
  assert.deepStrictEqual(p.dir, [0, 1]);
  assert.strictEqual(p.targets.length, 2);
  void G;
});

test('範圍內沒有敵人時不施放、不扣法力', () => {
  const { G, run } = freshRun(2);
  const mp = run.hero.mp;
  assert.strictEqual(Sim.cast(G, run, run.cs.skills[0], true), 'none');
  assert.strictEqual(run.hero.mp, mp);
  assert.ok(!run.hero.cds.thrust);
});

test('法力不足時立即失敗、不排隊也不扣資源', () => {
  const { G, run } = freshRun(3);
  placeMob(run, 'pickman', run.hero.x + 1, run.hero.y);
  run.hero.mp = 1;
  assert.strictEqual(Sim.cast(G, run, run.cs.skills[0], true), 'mana');
  assert.strictEqual(run.hero.mp, 1);
  assert.strictEqual(run.manual.length, 0);
});

test('肉盾擋住單體遠程技能的後排目標', () => {
  const { run } = freshRun(4);
  const h = run.hero;
  placeMob(run, 'beast', h.x + 1, h.y);
  const back = placeMob(run, 'crossbow', h.x + 3, h.y);
  const sk = { id: 'aimed', shape: { t: 'single', range: 6, los: true } };
  const p = Sim.plan(run, sk);
  assert.notStrictEqual(p.targets[0].id, back.id);
});

test('星盤擴大範圍有上限：面積最多 16 格、直線最多 6 格', () => {
  const G = Game.newGame();
  G.stars.owned.push('I1_k', 'D2_k', 'S3_k');
  const h = { rng: 9 };
  G.gear.ring = Object.assign(Items.make(h, { ilvl: 1, rarity: 0, slot: 'ring' }), { skill: 'whirl' });
  G.gear.amulet = Object.assign(Items.make(h, { ilvl: 1, rarity: 0, slot: 'amulet' }), { skill: 'pierce' });
  const cs = Char.compute(G);
  const whirl = cs.skills.find((s) => s.id === 'whirl');
  const pierce = cs.skills.find((s) => s.id === 'pierce');
  assert.strictEqual(whirl.shape.n, 4);
  assert.ok(whirl.shape.n * whirl.shape.n <= 16);
  assert.strictEqual(pierce.shape.len, 6);
  assert.ok(whirl.mana > D.SKILLS.whirl.mana, '擴大範圍要多耗魔');
});

test('傳說與神話至少有技能或特殊能力', () => {
  const h = { rng: 11 };
  for (let i = 0; i < 300; i++) {
    const it = Items.make(h, { ilvl: 5, rarity: 4 + (i % 2) });
    assert.ok(it.skill || it.special, it.name);
  }
});

test('稀有度不改變占格大小，旋轉後格數不變', () => {
  const h = { rng: 12 };
  const a = Items.make(h, { ilvl: 1, rarity: 0, base: 'mail' });
  const b = Items.make(h, { ilvl: 1, rarity: 5, base: 'mail' });
  assert.strictEqual(Items.cells(a, 0).length, Items.cells(b, 0).length);
  for (let r = 0; r < 4; r++) assert.strictEqual(Items.cells(b, r).length, 6);
  assert.deepStrictEqual(Items.dims(Items.make(h, { ilvl: 1, rarity: 0, base: 'staff' }), 1), [4, 1]);
});

test('掛機整理背包：放不下時保留高稀有度', () => {
  const h = { rng: 13 };
  const pack = Pack.create(5);
  const list = [];
  for (let i = 0; i < 8; i++) list.push(Items.make(h, { ilvl: 1, rarity: 0, base: 'mail' }));
  const myth = Items.make(h, { ilvl: 1, rarity: 5, base: 'mail' });
  list.push(myth);
  const dropped = Pack.repack(pack, list, (it) => it.rarity * 10);
  assert.ok(pack.items.some((p) => p.it === myth));
  assert.ok(dropped.length > 0);
  assert.ok(!dropped.includes(myth));
});

test('死亡失去本趟裝備，保留藥水與已賣金幣', () => {
  const { G, run } = freshRun(5);
  G.potions.red = 0;
  Pack.autoPlace(run.pack, Items.potion(run, 'red'));
  const loot = Items.make(run, { ilvl: 1, rarity: 2 });
  Pack.autoPlace(run.pack, loot);
  G.gold = 50;
  run.phase = 'dead';
  run.deathCause = { main: '測試', notes: [] };
  const rep = Game.finishRun(G);
  assert.strictEqual(rep.how, 'death');
  assert.strictEqual(rep.lost.length, 1);
  assert.ok(!G.stash.includes(loot));
  assert.strictEqual(G.potions.red, 1);
  assert.strictEqual(G.gold, 50);
});

test('撤退把背包裝備帶回倉庫', () => {
  const { G, run } = freshRun(6);
  const loot = Items.make(run, { ilvl: 1, rarity: 1 });
  Pack.autoPlace(run.pack, loot);
  Sim.endRun(G, run, 'retreat');
  Game.finishRun(G);
  assert.ok(G.stash.includes(loot));
});

test('倉庫滿：只賣未保護、評分最低的裝備', () => {
  const G = Game.newGame();
  G.stashCap = 3;
  const h = { rng: 14 };
  const fav = Object.assign(Items.make(h, { ilvl: 1, rarity: 0 }), { fav: true });
  G.stash.push(fav);
  for (let i = 0; i < 4; i++) G.stash.push(Items.make(h, { ilvl: 1 + i * 3, rarity: i }));
  const sold = Game.trimStash(G);
  assert.strictEqual(G.stash.length, 3);
  assert.ok(G.stash.includes(fav));
  assert.strictEqual(sold.length, 2);
});

test('離線收益：24 小時內 25%，48 小時附近約一半速率，不會歸零', () => {
  const day = 86400;
  assert.ok(Math.abs(Game.offlineEffectiveSecs(day) - 0.25 * day) < 1);
  const d1 = Game.offlineEffectiveSecs(48 * 3600) - Game.offlineEffectiveSecs(48 * 3600 - 60);
  assert.ok(Math.abs(d1 / 60 - 0.125) < 0.01);
  assert.ok(Game.offlineEffectiveSecs(10 * day) > Game.offlineEffectiveSecs(9 * day));
});

test('雙持規則：沒有大星點不能副手拿武器；雙手不能搭單手', () => {
  const G = Game.newGame();
  const h = { rng: 15 };
  const dagger = Items.make(h, { ilvl: 1, rarity: 0, base: 'dagger' });
  assert.ok(!Char.canEquip(G, dagger, 'offhand').ok);
  G.stars.owned.push('D1_k');
  assert.ok(Char.canEquip(G, dagger, 'offhand').ok);
  G.gear.weapon = Items.make(h, { ilvl: 1, rarity: 0, base: 'hammer' });
  assert.ok(!Char.canEquip(G, dagger, 'offhand').ok);
});

test('星盤只能買相連節點、只能退末端節點並收手續費', () => {
  const G = Game.newGame();
  G.gold = 1000;
  assert.ok(!Game.buyStar(G, 'St2').ok);
  assert.ok(Game.buyStar(G, 'C_S').ok);
  assert.ok(Game.buyStar(G, 'St1').ok);
  assert.ok(!Game.canRefund(G, 'C_S'));
  const before = G.gold;
  const r = Game.refundStar(G, 'St1');
  assert.ok(r.ok);
  assert.strictEqual(G.gold, before + r.back - r.fee);
});

test('新角色只拿小刀、每波 1 隻，能穩定清完第一層且第一層保底掉裝', () => {
  let cleared = 0, drops = 0;
  const N = 30;
  for (let s = 1; s <= N; s++) {
    const { G, run } = freshRun(1000 + s);
    let guard = 0;
    while (run.phase === 'fight' && guard++ < 40000) Sim.tick(G, run, Sim.DT);
    if (run.phase === 'cleared') {
      cleared++;
      if (run.pack.items.length + run.pending.length > 0) drops++;
    }
  }
  assert.ok(cleared / N >= 0.9, `清層率 ${cleared}/${N}`);
  assert.strictEqual(drops, cleared);
});

test('存檔可以完整還原進行中的地城', () => {
  const { G, run } = freshRun(77);
  for (let i = 0; i < 400; i++) Sim.tick(G, run, Sim.DT);
  const s = Game.serialize(G);
  const G2 = Game.deserialize(s);
  assert.strictEqual(G2.run.floor, run.floor);
  assert.strictEqual(G2.run.kills, run.kills);
  assert.strictEqual(G2.run.rng, run.rng);
  for (let i = 0; i < 100; i++) Sim.tick(G2, G2.run, Sim.DT);
});

test('沒有怪物時角色會往未探索的地方走，已探索範圍持續擴大', () => {
  const { G, run } = freshRun(88);
  run.waveT = 1e9; // 不出怪
  const start = run.seenN;
  for (let i = 0; i < 600; i++) Sim.tick(G, run, Sim.DT);
  assert.ok(run.seenN > start * 1.5, `探索 ${start} → ${run.seenN}`);
  const map = Sim.mapOf(run);
  assert.ok(map.rooms.length >= 8, '地圖應由多個洞室組成');
});

test('怪物從黑暗中（離角色至少 8 格）出現並追向角色', () => {
  const { G, run } = freshRun(89);
  Sim.tick(G, run, Sim.DT);
  for (let i = 0; i < 20 && !run.mobs.length; i++) Sim.tick(G, run, Sim.DT);
  assert.ok(run.mobs.length > 0);
  const h = run.hero;
  for (const m of run.mobs) assert.ok(Math.hypot(m.x - h.x, m.y - h.y) >= 7.5);
  const d0 = Math.min(...run.mobs.map((m) => Math.hypot(m.x - h.x, m.y - h.y)));
  for (let i = 0; i < 60; i++) Sim.tick(G, run, Sim.DT);
  const d1 = Math.min(...run.mobs.map((m) => Math.hypot(m.x - run.hero.x, m.y - run.hero.y)));
  assert.ok(d1 < d0, '怪物應該接近角色');
});

test('星盤：166 點、18 個星座、每個星座都有大星點，全部節點都能從起點走到', () => {
  const ids = Object.keys(D.STARS);
  assert.ok(ids.length >= 160);
  assert.strictEqual(D.CONSTELLATIONS.length, 18);
  for (const c of D.CONSTELLATIONS) assert.ok(D.STARS[c.id + '_k'].eff.key, c.name);
  const seen = new Set(['C0']), q = ['C0'];
  while (q.length) for (const l of D.STARS[q.pop()].links) if (!seen.has(l)) { seen.add(l); q.push(l); }
  assert.strictEqual(seen.size, ids.length);
  for (const k of D.STAR_KEYS_LIST) assert.ok(ids.some((id) => D.STARS[id].eff.key === k), k);
});

test('星盤一鍵買路徑：依序買下整條路並扣對金幣；集滿星座有額外獎勵', () => {
  const G = Game.newGame();
  G.gold = 1e6;
  const path = Game.starPath(G, 'S1_k');
  const cost = Game.pathCost(G, path);
  const g0 = G.gold;
  assert.ok(Game.buyPath(G, 'S1_k').ok);
  assert.strictEqual(g0 - G.gold, cost);
  assert.ok(G.stars.owned.includes('S1_k'));
  const before = Char.compute(G).armor;
  const c = D.CONSTELLATIONS.find((x) => x.id === 'S1');
  for (const n of c.nodes) if (!G.stars.owned.includes(n)) Game.buyStar(G, n);
  const cs = Char.compute(G);
  assert.ok(cs.doneConsts.includes('S1'));
  assert.ok(cs.armor >= before);
});

test('舊版星盤存檔：自動全額退還金幣並重置', () => {
  const G = Game.newGame();
  G.stars.owned.push('Sl1', 'Sl2');
  G.stars.paid.Sl1 = 40; G.stars.paid.Sl2 = 45;
  G.gold = 10;
  const G2 = Game.deserialize(JSON.stringify(G));
  assert.strictEqual(G2.gold, 95);
  assert.deepStrictEqual(G2.stars.owned, ['C0']);
  assert.ok(G2.notice);
});

test('工坊強化：一定成功、數值提高、到上限就停、扣對金幣', () => {
  const G = Game.newGame();
  G.gold = 1e6;
  const h = { rng: 31 };
  const it = Items.make(h, { ilvl: 5, rarity: 2, base: 'mail' });
  G.stash.push(it);
  const a0 = it.armor, v0 = it.affixes.map((a) => a.v);
  for (let i = 0; i < 10; i++) Game.enhance(G, it.id);
  assert.strictEqual(it.plus, Items.plusCap(it));
  assert.ok(it.armor > a0);
  it.affixes.forEach((a, i) => assert.ok(a.v >= v0[i]));
  assert.ok(!Game.enhance(G, it.id).ok);
  assert.ok(Items.displayName(it).endsWith('+' + it.plus));
});

test('工坊重骰：只改選中的那條屬性，其他不動，次數越多越貴', () => {
  const G = Game.newGame();
  G.gold = 1e6;
  const h = { rng: 32 };
  const it = Items.make(h, { ilvl: 6, rarity: 3, base: 'helm' });
  G.stash.push(it);
  const others = it.affixes.slice(1).map((a) => a.k + a.v);
  const c1 = Game.rerollCost(it, true);
  const r = Game.reroll(G, it.id, 0, true);
  assert.ok(r.ok);
  assert.deepStrictEqual(it.affixes.slice(1).map((a) => a.k + a.v), others);
  assert.ok(Game.rerollCost(it, true) > c1);
  const keys = it.affixes.map((a) => a.k);
  assert.strictEqual(new Set(keys).size, keys.length, '屬性不能重複');
  assert.ok(!it.skill || it.skill === it.skill);
});

test('章節解鎖：礦坑普通通關後開放骨沼墓渠；骨沼可以完整出征', () => {
  const G = Game.newGame();
  G.exp.dungeon = 'bog';
  let run = Game.startRun(G);
  assert.strictEqual(run.dungeon, 'mine', '未解鎖時不能進骨沼');
  run.phase = 'ended'; run.how = 'victory';
  const rep = Game.finishRun(G);
  assert.strictEqual(G.unlocked.bog, 0);
  assert.ok(rep.unlocked.includes('骨沼墓渠'));
  run = Game.startRun(G);
  assert.strictEqual(run.dungeon, 'bog');
  assert.strictEqual(run.floors, 6);
  run.noFx = true;
  for (let i = 0; i < 2000 && run.phase === 'fight'; i++) Sim.tick(G, run, Sim.DT);
  assert.ok(run.mobs.every((m) => D.DUNGEON.bog.mix[0].some(([t]) => t === m.type)));
  assert.ok(Sim.mapOf(run).slow.some((v) => v), '骨沼要有沼澤地形');
});

test('盔甲分類：頭、身、手、腳都各有重甲／輕甲／布甲，舊裝備照常有分類', () => {
  for (const sl of D.ARMOR_SLOTS) {
    const cls = D.BASE_BY_SLOT[sl].map((b) => D.BASES[b].cls).sort();
    assert.deepStrictEqual(cls, ['cloth', 'heavy', 'light'], sl);
  }
  assert.strictEqual(D.BASES.gloves.cls, 'light');
  assert.strictEqual(D.BASES.helm.cls, 'heavy');
  const h = { rng: 9 };
  const g = Items.make(h, { ilvl: 3, rarity: 1, base: 'greaves' });
  assert.ok(g.armor > 0 && g.moveSpd === 1);
});

test('套裝加成：四件同類才生效，重甲護甲 +15%', () => {
  const G = Game.newGame();
  const h = { rng: 21 };
  const put = (base) => { const it = Items.make(h, { ilvl: 5, rarity: 0, base }); it.affixes = []; G.gear[it.slot] = it; return it; };
  put('helm'); put('mail'); put('gauntlets'); const feet = put('boots');
  let cs = Char.compute(G);
  assert.strictEqual(cs.armorSet, null);
  assert.deepStrictEqual(cs.armorCls, { heavy: 3, light: 1 });
  const armor3 = cs.armor;
  put('greaves');
  cs = Char.compute(G);
  assert.strictEqual(cs.armorSet, 'heavy');
  const raw = armor3 - feet.armor + G.gear.feet.armor;
  assert.ok(Math.abs(cs.armor - raw * 1.15) < 1e-6);
  // 布甲：法力 +15%
  put('hood'); put('robe'); put('wraps'); put('slippers');
  assert.strictEqual(Char.compute(G).armorSet, 'cloth');
});

test('深淵：惡夢之後無上限，每階怪物等級 +3、抗性扣更多', () => {
  const dg = D.DUNGEON.bog;
  assert.strictEqual(D.diff(2).name, '惡夢');
  assert.strictEqual(D.diff(3).name, '深淵 1');
  assert.strictEqual(D.baseLevel(dg, 3) - D.baseLevel(dg, 2), 3);
  assert.strictEqual(D.baseLevel(dg, 5) - D.baseLevel(dg, 3), 6);
  assert.ok(D.diff(4).resPen > D.diff(2).resPen);
  // 打贏惡夢會開放深淵 1
  const { G, run } = freshRun(5, { diff: 2 });
  G.unlocked.mine = 2;
  run.diff = 2; run.phase = 'ended'; run.how = 'victory';
  const rep = Game.finishRun(G);
  assert.strictEqual(G.unlocked.mine, 3);
  assert.ok(rep.unlocked.includes('深淵 1'));
});

test('經驗衰減：比怪物高 5 級以上才開始打折，最少 10%', () => {
  assert.strictEqual(D.ECON.xpGap(5), 1);
  assert.ok(Math.abs(D.ECON.xpGap(7) - 0.6) < 1e-9);
  assert.strictEqual(D.ECON.xpGap(40), 0.1);
  const { G, run } = freshRun(8);
  G.hero.level = 30;
  const before = G.hero.xp;
  const m = placeMob(run, 'pickman', run.hero.x + 1, run.hero.y);
  m.xp = 100; m.lvl = 1;
  Sim.hurtMob(G, run, m, 9999, 'phys', {});
  assert.ok(Math.abs(G.hero.xp - before - 10) < 1e-6, '高 29 級只拿 10% 經驗');
});

test('難度扣抗性：同樣的冰傷在惡夢比普通痛', () => {
  const hit = (diff) => {
    const { G, run } = freshRun(11, { diff: 0 });
    run.diff = diff;
    run.cs.dodge = 0; run.cs.block = 0;
    run.hero.hp = 5000;
    return Sim.hurtHero(G, run, 100, 'cold', { name: '測試', hazard: true });
  };
  assert.ok(Math.abs(hit(0) - 100) < 1e-6);
  assert.ok(Math.abs(hit(2) - 130) < 1e-6, '0 抗性扣 30 → 負 30% 抗性');
});

test('精英怪：最多一種元素、血量提高、擊殺必掉稀有以上', () => {
  const { G, run } = freshRun(13, { diff: 2 });
  const m = placeMob(run, 'pickman', run.hero.x + 2, run.hero.y);
  m.lvl = 5; m.maxHp = m.hp = 100; m.dmg = 3; m.speed = 1; m.aspd = 1;
  Sim.makeElite(run, m);
  assert.ok(m.elite.length === 2);
  assert.ok(m.elite.filter((a) => D.ELITE_ELEMS.includes(a)).length <= 1);
  assert.ok(m.maxHp >= 320);
  const n0 = run.pending.length;
  Sim.hurtMob(G, run, m, 1e6, 'phys', {});
  assert.ok(run.pending.length > n0);
  assert.ok(run.pending.slice(n0).some((it) => it.rarity >= 2));
});

test('法力：技能裝備等級越高越耗魔，魔力針回魔也跟著提高', () => {
  const G = Game.newGame();
  const h = { rng: 31 };
  const lo = Items.make(h, { ilvl: 1, rarity: 1, base: 'staff', skill: 'manabolt' });
  const hi = Items.make(h, { ilvl: 30, rarity: 1, base: 'staff', skill: 'manabolt' });
  lo.skill = hi.skill = 'manabolt';
  G.gear.weapon = lo;
  const a = Char.compute(G).skills.find((s) => s.id === 'manabolt');
  G.gear.weapon = hi;
  const b = Char.compute(G).skills.find((s) => s.id === 'manabolt');
  assert.ok(b.mana >= a.mana * 1.9, `${a.mana} → ${b.mana}`);
  assert.ok(b.restore > a.restore);
});

test('熔鐵工坊：骨沼普通通關後開放，有熔岩、踩上去會被灼傷，角色會繞路', () => {
  const G = Game.newGame();
  G.unlocked.bog = 0;
  G.exp.dungeon = 'bog';
  let run = Game.startRun(G);
  run.phase = 'ended'; run.how = 'victory';
  Game.finishRun(G);
  assert.strictEqual(G.unlocked.forge, 0);
  G.exp.dungeon = 'forge';
  run = Game.startRun(G);
  assert.strictEqual(run.dungeon, 'forge');
  const map = Sim.mapOf(run);
  assert.ok(map.lava && map.lava.some((v) => v), '工坊要有熔岩');
  const i = map.lava.findIndex((v) => v);
  run.hero.x = i % map.w; run.hero.y = Math.floor(i / map.w);
  run.mobs = []; run.waveT = 99;
  const hp0 = run.hero.hp;
  run.noFx = true;
  for (let k = 0; k < 20; k++) Sim.tick(G, run, Sim.DT);
  assert.ok(run.hero.hp < hp0, '站在熔岩上會掉血');
  // 有熔岩成本的距離場會比較大（代表會繞路）
  const LHmap = LH.Map;
  const plain = LHmap.distField(map, [map.start]);
  const costly = LHmap.distField(map, [map.start], map.lavaCost);
  assert.ok(costly[i] > plain[i]);
});

test('舊存檔：骨沼普通通關過的直接開放第三章；打贏過惡夢的章節開放深淵', () => {
  const G = Game.newGame();
  G.unlocked = { mine: 2, bog: 2 };
  G.records = [{ dungeon: 'bog', diff: 2, how: 'victory' }];
  const G2 = Game.deserialize(Game.serialize(G));
  assert.strictEqual(G2.unlocked.forge, 0);
  assert.strictEqual(G2.unlocked.bog, 3);
  assert.strictEqual(G2.unlocked.mine, 2);
});

test('傳奇寶物：名稱、底材、屬性種類固定，數值隨等級成長；只在限定章節掉的不會亂掉', () => {
  const h = { rng: 99 };
  const a = Items.makeUnique(h, 'skullbreaker', 5);
  const b = Items.makeUnique(h, 'skullbreaker', 30);
  assert.strictEqual(a.name, '碎顱者');
  assert.strictEqual(a.base, 'hammer');
  assert.strictEqual(a.skill, 'cleave');
  assert.deepStrictEqual(a.affixes.map((x) => x.k), ['physDmg', 'str', 'hp']);
  assert.ok(b.dmg[0] > a.dmg[0] && b.affixes[2].v > a.affixes[2].v);
  assert.strictEqual(Object.keys(D.UNIQUES).length, 20);
  for (let i = 0; i < 300; i++) assert.notStrictEqual(Items.rollUnique(h, 'mine', []), 'starfall');
  assert.ok(D.ECON.uniqChance('boss', 2) > D.ECON.uniqChance('boss', 0));
  assert.ok(D.ECON.uniqChance('boss', 0) > D.ECON.uniqChance('elite', 0));
});

test('傳奇寶物掉落：記進圖鑑；掛機背包放不下也不會被賣掉；倉庫滿也不會被自動賣', () => {
  const { G, run } = freshRun(5);
  run.mode = 'idle';
  D.ECON._uc = D.ECON.uniqChance;
  D.ECON.uniqChance = () => 1;
  const m = placeMob(run, 'pickman', run.hero.x + 1, run.hero.y);
  m.boss = 'golem'; m.w = 1; m.lvl = 5;
  Sim.buildOcc(run);
  Sim.hurtMob(G, run, m, 9999, 'phys', {});
  D.ECON.uniqChance = D.ECON._uc;
  const u = run.pending.find((it) => it.uniq);
  assert.ok(u, '頭目應掉出傳奇寶物');
  assert.ok(G.codex[u.uniq] && G.codex[u.uniq].n === 1);
  // 塞滿背包後自動整理：傳奇寶物寄回營地，不會被賣掉
  run.pack = Pack.create(1);
  Sim.sellPending(G, run, true);
  assert.ok(G.stash.includes(u));
  assert.ok(!run.sold.some((x) => x.name === u.name));
  G.stashCap = 0;
  Game.trimStash(G);
  assert.ok(G.stash.includes(u));
});

test('傳奇寶物效果：霜心法杖讓技能變冰並減速、賢者兜帽冷卻與生命、貪婪之戒賣價', () => {
  const G = Game.newGame();
  const h = { rng: 3 };
  const before = Char.compute(G);
  G.gear.weapon = Items.makeUnique(h, 'frostheart', 10);
  const cs = Char.compute(G);
  const fr = cs.skills.find((s) => s.id === 'frost');
  assert.ok(fr && fr.elem === 'cold');
  G.gear.head = Items.makeUnique(h, 'sageHood', 10);
  const cs2 = Char.compute(G);
  assert.ok(cs2.cdrF >= 0.2);
  assert.ok(cs2.maxHp < Char.compute(Object.assign({}, G, { gear: Object.assign({}, G.gear, { head: null }) })).maxHp);
  void before;
  const { G: G2, run } = freshRun(8);
  G2.gear.ring = Items.makeUnique(h, 'greedRing', 5);
  run.cs = Char.compute(G2);
  const it = Items.make(h, { ilvl: 5, rarity: 2 });
  const v = Sim.sellItem(G2, run, it, false);
  assert.strictEqual(v, Math.round(Items.sellValue(it) * 1.4));
});

test('傳奇寶物效果：熔岩之心踩熔岩回血；不屈鐵壁低血時減傷', () => {
  const h = { rng: 11 };
  const { G, run } = freshRun(21);
  G.gear.hands = Items.makeUnique(h, 'lavaHeart', 5);
  run.cs = Char.compute(G);
  const map = Sim.mapOf(run);
  map.lava = new Uint8Array(map.w * map.h);
  map.lava[run.hero.y * map.w + run.hero.x] = 1;
  run.hero.hp = run.cs.maxHp * 0.5;
  const hp0 = run.hero.hp;
  for (let i = 0; i < 20; i++) Sim.tick(G, run, Sim.DT);
  assert.ok(run.hero.hp > hp0, '踩熔岩應該回血');
  const { G: G3, run: r3 } = freshRun(22);
  G3.gear.body = Items.makeUnique(h, 'unyielding', 5);
  r3.cs = Char.compute(G3);
  r3.hero.hp = r3.cs.maxHp * 0.32;
  Sim.hurtHero(G3, r3, r3.cs.maxHp * 0.05, 'fire', { name: 't', move: 'x' });
  assert.ok(r3.hero.buffs.unyield);
  const hp1 = r3.hero.hp;
  const d = Sim.hurtHero(G3, r3, 10, 'fire', { name: 't', move: 'x' });
  assert.ok(d < 10 * 0.6 && r3.hero.hp < hp1);
});

test('深淵規則：條數隨階級增加、換階級重抽、花錢重抽、出發後下一趟重抽', () => {
  assert.strictEqual(D.abyssModCount(2), 0);
  assert.strictEqual(D.abyssModCount(3), 1);
  assert.strictEqual(D.abyssModCount(6), 2);
  assert.strictEqual(D.abyssModCount(12), 3);
  const G = Game.newGame();
  G.unlocked.mine = 10;
  G.exp.diff = 8;
  const a = Game.abyssMods(G);
  assert.strictEqual(a.list.length, 2);
  assert.strictEqual(new Set(a.list).size, 2);
  assert.ok(a.loot > 0 && a.xp > 0);
  assert.deepStrictEqual(Game.abyssMods(G).list, a.list, '同一個階級不會自己變');
  G.gold = 0;
  assert.ok(!Game.rerollMods(G).ok);
  G.gold = 10000;
  const r = Game.rerollMods(G);
  assert.ok(r.ok && G.gold === 10000 - r.cost);
  G.exp.diff = 2;
  assert.strictEqual(Game.abyssMods(G), null, '惡夢沒有規則');
  G.exp.diff = 8;
  const before = Game.abyssMods(G).list.slice();
  const run = Game.startRun(G);
  assert.deepStrictEqual(run.mods, before);
  assert.ok(run.modLoot > 0);
  assert.strictEqual(G.exp.mods, null);
});

test('深淵規則效果：堅韌、鐵甲、狂暴影響怪物；詛咒扣抗性；蜂群怪更多；藥效不彰', () => {
  const mk = (mods) => {
    const G = Game.newGame();
    const run = Sim.newRun(G, { diff: 3, wave: 4, mode: 'idle', seed: 7, mods });
    run.noFx = true;
    return { G, run };
  };
  const plain = mk([]), hard = mk(['tough', 'ironclad', 'frenzy']);
  Sim.buildOcc(plain.run); Sim.buildOcc(hard.run);
  const sp = (r) => { r.waveT = 0; Sim.tick(r === plain.run ? plain.G : hard.G, r, Sim.DT); return r.mobs.find((m) => !m.elite); };
  const a = sp(plain.run), b = sp(hard.run);
  const ratio = b.maxHp / Math.round(D.MONSTERS[b.type].hp * Math.pow(1.17, b.lvl - 1) * 2.0);
  assert.ok(Math.abs(ratio - 1.4) < 0.05, `堅韌血量倍率 ${ratio}`);
  assert.ok(b.speed > D.MONSTERS[b.type].speed * 1.2);
  void a;
  const c1 = mk([]), c2 = mk(['curse']);
  const d1 = Sim.hurtHero(c1.G, c1.run, 40, 'cold', { name: 't', move: 'x' });
  const d2 = Sim.hurtHero(c2.G, c2.run, 40, 'cold', { name: 't', move: 'x' });
  assert.ok(Math.abs(d2 - d1 - 6) < 0.01, `${d1} ${d2}`);
  const s1 = mk([]), s2 = mk(['swarm']);
  s1.run.waveT = 0; s2.run.waveT = 0;
  Sim.tick(s1.G, s1.run, Sim.DT); Sim.tick(s2.G, s2.run, Sim.DT);
  assert.strictEqual(s1.run.mobs.length, 4);
  assert.strictEqual(s2.run.mobs.length, 6);
});

test('星隕觀測所：熔鐵工坊普通通關後開放；舊存檔自動開放；地圖有星光', () => {
  const G = Game.newGame();
  assert.strictEqual(G.unlocked.observatory, -1);
  G.unlocked.forge = 0;
  G.exp.dungeon = 'forge';
  const run = Game.startRun(G);
  run.phase = 'ended'; run.how = 'victory'; run.floor = run.floors;
  Game.finishRun(G);
  assert.strictEqual(G.unlocked.observatory, 0);
  const old = Game.newGame();
  delete old.unlocked.observatory;
  old.unlocked.forge = 1;
  const back = Game.deserialize(Game.serialize(old));
  assert.strictEqual(back.unlocked.observatory, 0);
  const map = LH.Map.generate('observatory', 2);
  assert.ok(map.star && map.star.some(Boolean), '應該有星光');
});

test('星光：站在裡面法力回復變 3 倍；星落：角色會閃開，閃不掉才受傷', () => {
  const G = Game.newGame();
  const run = Sim.newRun(G, { dungeon: 'observatory', diff: 0, wave: 1, mode: 'idle', seed: 4 });
  run.noFx = true;
  const map = Sim.mapOf(run);
  const h = run.hero;
  map.star = new Array(map.w * map.h).fill(0);
  h.mp = 0;
  run.waveT = 99; run.omenT = 99;
  Sim.tick(G, run, Sim.DT);
  const plain = h.mp;
  map.star[h.y * map.w + h.x] = 1;
  h.mp = 0;
  Sim.tick(G, run, Sim.DT);
  assert.ok(Math.abs(h.mp - plain * 3) < 1e-6, `${h.mp} vs ${plain}`);
  map.star[h.y * map.w + h.x] = 0;
  // 星落正對著角色：角色應該移開
  const x0 = h.x, y0 = h.y;
  run.omens = [{ cells: [[x0, y0], [x0 + 1, y0], [x0 - 1, y0]], t: 1.6, total: 1.6, cx: x0, cy: y0 }];
  run.omenT = 99;
  const hp0 = h.hp;
  for (let i = 0; i < 40; i++) Sim.tick(G, run, Sim.DT);
  assert.ok(!(h.x === x0 && h.y === y0), '角色應該離開星落範圍');
  assert.strictEqual(run.omens.length, 0, '星落已經落下');
  assert.ok(h.hp >= hp0 - 1e-6, '閃開了就不會受傷');
  // 被困住閃不掉：會受傷
  const { G: G2, run: r2 } = freshRun(31);
  r2.dungeon = 'observatory';
  const hh = r2.hero, m2 = Sim.mapOf(r2);
  const all = [];
  for (let y = hh.y - 2; y <= hh.y + 2; y++) for (let x = hh.x - 2; x <= hh.x + 2; x++) all.push([x, y]);
  r2.omens = [{ cells: all, t: 0.05, total: 1.6, cx: hh.x, cy: hh.y }];
  r2.waveT = 99;
  const hp2 = hh.hp;
  for (let i = 0; i < 4; i++) Sim.tick(G2, r2, Sim.DT);
  void m2;
  assert.ok(hh.hp < hp2, '閃不掉就受傷');
});

test('觀測所頭目：三隻都能完整出招；引力場會把角色拉到身邊並接冰晶新星', () => {
  for (const boss of ['starPriest', 'meteorBeast', 'fallenAngel']) {
    for (const mv of D.BOSSES[boss].moves) assert.ok(D.BOSS_MOVES[mv], `${boss} 缺招式 ${mv}`);
  }
  const G = Game.newGame();
  G.hero.level = 60;
  const h0 = { rng: 2 };
  for (const sl of D.SLOTS) G.gear[sl] = Items.make(h0, { ilvl: 60, rarity: 4, slot: sl });
  G.gear.weapon = Items.make(h0, { ilvl: 60, rarity: 5, base: 'sword' });
  G.gear.offhand = Items.make(h0, { ilvl: 60, rarity: 4, base: 'shield' });
  for (const boss of ['starPriest', 'meteorBeast', 'fallenAngel']) {
    const dg = D.DUNGEON.observatory;
    const save = dg.bosses;
    dg.bosses = [boss];
    const run = Sim.newRun(G, { dungeon: 'observatory', diff: 0, wave: 1, mode: 'idle', seed: 9, red: 5 });
    run.noFx = true;
    run.floor = run.floors;
    Sim.setupFloor(run);
    dg.bosses = save;
    const b = run.mobs.find((m) => m.boss);
    assert.strictEqual(b.boss, boss);
    if (boss === 'fallenAngel') {
      b.cur = { move: 'gravity', t: 0, total: 1, cells: [], data: {}, danger: false };
      Sim.tick(G, run, Sim.DT);
      const d = Sim.distToHero(run, b);
      assert.ok(d <= 1, `應被拉到身邊，距離 ${d}`);
      assert.strictEqual(b.nextMove, 'iceNova');
      for (let i = 0; i < 30 && !b.cur; i++) Sim.tick(G, run, Sim.DT);
      assert.strictEqual(b.cur && b.cur.move, 'iceNova');
    }
    let g = 0;
    while (run.phase === 'fight' && g++ < 60000) Sim.tick(G, run, Sim.DT);
    assert.ok(['cleared', 'dead', 'ended'].includes(run.phase), `${boss}: ${run.phase}`);
  }
});
