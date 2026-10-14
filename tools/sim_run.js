// 無畫面快速模擬：讓角色用掛機規則連續出征，觀察節奏與平衡。
// 用法：node tools/sim_run.js [趟數] [每波怪數] [難度0-2]
const LH = require('../tests/load.js');
const { Game, D, Items } = LH;

const runs = +(process.argv[2] || 8);
const wave = +(process.argv[3] || 1);
const diff = +(process.argv[4] || 0);
const G = Game.newGame();
G.exp.mode = 'idle';
G.exp.wave = wave;
G.exp.diff = diff;
G.exp.red = 3; G.exp.blue = 2;
if (diff) G.unlocked.mine = diff;

function autoCamp(G) {
  // 簡單營地策略：分配點數到主屬性、穿上評分較高的裝備、買星點
  while (G.hero.unspent > 0) Game.allocate(G, 'str');
  for (let pass = 0; pass < 2; pass++)
    for (const it of G.stash.slice()) {
      const p = LH.Char.previewWith(G, it);
      if (p && p.sc > 3.02) Game.equip(G, it.id, p.slot);
    }
  for (const it of G.stash.slice()) {
    const p = LH.Char.previewWith(G, it);
    if (p && p.sc < 2.97) Game.sellStash(G, it.id);
  }
  for (let i = 0; i < 3; i++) {
    const c = Game.starCost(G);
    if (G.gold < c + 60) break;
    const cand = Object.keys(D.STARS).filter((id) => Game.canBuyStar(G, id));
    const pref = cand.find((id) => id.startsWith('S') || id === 'C1' || id === 'C4') || cand[0];
    Game.buyStar(G, pref);
  }
  if (Game.packCost(G) && G.gold > Game.packCost(G) + 100) Game.buyPack(G);
}

let t0 = Date.now();
for (let i = 0; i < runs; i++) {
  autoCamp(G);
  G.idle.cur = null;
  const run = Game.startRun(G, { fresh: true });
  run.noFx = true;
  let guard = 0;
  while (G.run && guard++ < 200000) Game.update(G, 0.25);
  const r = G.lastReport;
  const items = r.brought.map((b) => D.RARITY[b.rarity].name).join('/');
  console.log(
    `#${i + 1} ${r.how.padEnd(7)} 樓層 ${r.floor}/${r.floors} ${(r.secs / 60).toFixed(1)}分 Lv${G.hero.level} xp+${r.xp} 金+${r.gold} 帶回[${items}] ${r.cause ? '死因:' + r.cause.main + ' ' + r.cause.notes.join(',') : ''}`
  );
}
console.log(`金幣 ${G.gold}｜倉庫 ${G.stash.length}｜星點 ${G.stars.owned.length - 1}｜模擬耗時 ${Date.now() - t0}ms`);
console.log('裝備：', Object.entries(G.gear).filter(([, v]) => v).map(([k, v]) => `${D.SLOT_NAME[k]}:${v.name}(${D.RARITY[v.rarity].name} L${v.ilvl}${v.skill ? ' 技:' + D.SKILLS[v.skill].name : ''})`).join('  '));
