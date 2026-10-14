// 比較「預設掛機規則」與「模擬熟練玩家手動施法」的通關時間（相同配裝、相同怪數、相同亂數種子）
// 用法：node tools/compare_modes.js [每波怪數]
const LH = require('../tests/load.js');
const { Game, Sim, D } = LH;
const wave = +(process.argv[2] || 3);

// 先用掛機養出一個中期角色
const G0 = Game.newGame();
G0.rng = +(process.argv[3] || 4242);
G0.exp.mode = 'idle'; G0.exp.wave = 1; G0.exp.red = 3; G0.exp.blue = 2;
for (let i = 0; i < 18; i++) {
  while (G0.hero.unspent > 0) Game.allocate(G0, 'str');
  for (const it of G0.stash.slice()) { const p = LH.Char.previewWith(G0, it); if (p && p.sc > 3.02) Game.equip(G0, it.id, p.slot); }
  for (const it of G0.stash.slice()) { const p = LH.Char.previewWith(G0, it); if (p && p.sc < 2.97) Game.sellStash(G0, it.id); }
  const run = Game.startRun(G0, { fresh: true }); run.noFx = true;
  while (G0.run) Game.update(G0, 0.25);
}
G0.autocast.rules = Game.defaultRules(G0);
console.log('角色 Lv', G0.hero.level, '技能', LH.Char.compute(G0).skills.map((s) => s.name).join('、'));

// 熟練玩家：技能只要能打到 2 隻以上就放；頭目蓄力時優先打斷或開防禦；法力充足時對單體也出手
function skilled(G, run) {
  const h = run.hero;
  const boss = run.mobs.find((m) => m.boss);
  for (const sk of run.cs.skills) {
    if (h.cds[sk.id] > 0 || h.mp < sk.mana) continue;
    const def = D.SKILLS[sk.id];
    if (sk.shape.t === 'buff') {
      if ((boss && boss.cur && boss.cur.danger) || h.hp < run.cs.maxHp * 0.5) run.manual.push(sk.id);
      continue;
    }
    const p = Sim.plan(run, sk);
    if (!p) continue;
    if (def.interrupt && boss && boss.cur) { run.manual.push(sk.id); continue; }
    if (p.targets.length >= 2 || boss || h.mp > run.cs.maxMp * 0.5) run.manual.push(sk.id);
  }
}

function trial(useSkill, seed) {
  const G = Game.deserialize(Game.serialize(G0));
  G.exp.mode = 'active'; G.exp.wave = wave; G.exp.red = 3; G.exp.blue = 2; G.potions = { red: 9, blue: 9 }; G.gold = 999;
  const run = Game.startRun(G, { fresh: true });
  run.noFx = true; run.rng = seed; run.autoCast = !useSkill;
  let guard = 0;
  while (G.run && guard++ < 200000) {
    if (run.phase === 'fight') { if (useSkill) skilled(G, run); Sim.tick(G, run, Sim.DT); }
    else if (run.phase === 'cleared') { if (run.floor >= run.floors) { Sim.endRun(G, run, 'victory'); } else Sim.nextFloor(G, run); }
    else break;
  }
  return { secs: run.total, how: run.phase === 'dead' ? 'death' : run.how || run.phase, floor: run.floor };
}

let a = [], b = [];
for (let s = 1; s <= 16; s++) { a.push(trial(false, 500 + s)); b.push(trial(true, 500 + s)); }
const avg = (l) => l.filter((r) => r.how === 'victory').reduce((x, r) => x + r.secs, 0) / Math.max(1, l.filter((r) => r.how === 'victory').length);
console.log('預設掛機：', a.map((r) => `${r.how}@${r.floor}`).join(' '), '平均通關', (avg(a) / 60).toFixed(1), '分');
console.log('熟練手動：', b.map((r) => `${r.how}@${r.floor}`).join(' '), '平均通關', (avg(b) / 60).toFixed(1), '分');
console.log('手動快', (((avg(a) - avg(b)) / avg(a)) * 100).toFixed(0) + '%');
