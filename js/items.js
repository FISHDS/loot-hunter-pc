// 裝備產生、形狀、售價與文字說明。
(function (root) {
  const LH = root.LH;
  const { U, D } = LH;

  const PREFIX = {
    str: ['蠻岩', '裂骨', '鐵脊', '碎顱', '礦鎚', '血砂'],
    dex: ['疾影', '鷹眼', '迅風', '暗刃', '游隙', '燕尾'],
    int: ['晶語', '冥火', '霜紋', '雷吟', '幽脈', '星塵'],
  };
  const EPITHET = ['黑晶君王', '深淵礦主', '無光之母', '最後的監工', '碎星', '永夜', '沉默礦脈', '螢晶女巫'];

  function newId(h) {
    return 'i' + Math.floor(U.rand(h) * 2 ** 40).toString(36) + Math.floor(U.rand(h) * 1e6).toString(36);
  }

  function rollRarity(h, floor, diff, minRarity, bonus) {
    const floorF = [0, 0.1, 0.45, 0.8, 1.1, 1.3, 1.5][Math.min(6, floor - 1)];
    const f = floorF + D.diff(diff).rarityBoost + (bonus || 0);
    const base = [60, 28, 10, 3, 0.5, 0.05];
    const entries = base.map((w, i) => [i, w * Math.pow(1 + f * 0.6, i)]).filter((e) => e[0] >= (minRarity || 0));
    return U.weighted(h, entries);
  }

  function rollAffixValue(h, key, ilvl, rarity) {
    const a = D.AFFIX[key];
    const power = D.RARITY[rarity].power;
    let v = U.randRange(h, a.base[0], a.base[1]) * power;
    if (a.pct) v *= 1 + 0.025 * (ilvl - 1);
    else v += (a.per || 0) * (ilvl - 1) * power;
    return a.dec ? Math.round(v * 10) / 10 : Math.max(1, Math.round(v));
  }

  function affixPool(slot, aff) {
    const out = [];
    for (const [k, a] of Object.entries(D.AFFIX)) {
      if (a.slots && !a.slots.includes(slot)) continue;
      if (k === 'block' && !['offhand', 'body', 'head'].includes(slot)) continue;
      let w = a.aff ? (a.aff === aff ? 3 : 1) : 1.6;
      if (slot === 'weapon' && /Dmg$|aspd|manaOnHit/.test(k)) w *= 1.8;
      if (['head', 'body', 'hands', 'feet'].includes(slot) && /^(hp|armor|dodge|res)/.test(k)) w *= 1.6;
      out.push([k, w]);
    }
    return out;
  }

  function pickSkill(h, aff) {
    if (U.chance(h, 0.7)) return U.pick(h, D.SKILL_POOL[aff]);
    return U.pick(h, D.SKILL_POOL[U.pick(h, ['str', 'dex', 'int'])]);
  }

  function rollSpecialValue(h, key, ilvl, rarity) {
    const s = D.SPECIALS[key];
    let v = U.randRange(h, s.v[0], s.v[1]) * (0.9 + 0.1 * D.RARITY[rarity].power);
    if (D.SPECIAL_SCALES[key]) v *= 1 + 0.15 * (ilvl - 1);
    else if (key === 'dodgeMana') v *= 1 + 0.05 * (ilvl - 1);
    return Math.round(v);
  }

  // opts: { ilvl, rarity, slot, base, bossPool, skill }
  function make(h, opts) {
    const ilvl = Math.max(1, opts.ilvl || 1);
    const rarity = opts.rarity ?? 0;
    const slot = opts.slot || U.weighted(h, [['weapon', 2.2], ['head', 1], ['body', 1], ['hands', 1], ['feet', 1], ['ring', 0.9], ['offhand', 1.1], ['amulet', 0.9]]);
    const baseId = opts.base || U.pick(h, D.BASE_BY_SLOT[slot]);
    const b = D.BASES[baseId];
    const aff = b.aff || U.pick(h, ['str', 'dex', 'int']);
    const lv = ilvl - 1;
    const rp = Math.sqrt(D.RARITY[rarity].power);
    const it = { id: newId(h), base: baseId, slot: b.slot, rarity, ilvl, aff, affixes: [], skill: null, special: null, fav: false };
    if (b.dmg) {
      const m = (1 + 0.13 * lv) * rp;
      it.dmg = [Math.max(1, Math.round(b.dmg[0] * m)), Math.max(2, Math.round(b.dmg[1] * m))];
      it.aspd = b.aspd;
      if (b.kind === 'staff') it.elem = U.pick(h, ['fire', 'cold', 'light']);
    }
    if (b.armor) it.armor = Math.round(b.armor * (1 + 0.16 * lv) * rp);
    if (b.hp) it.hp = Math.round(b.hp * (1 + 0.15 * lv));
    if (b.mp) it.mp = Math.round(b.mp * (1 + 0.1 * lv));
    if (b.dodge) it.dodge = Math.round(b.dodge * (1 + 0.15 * lv));
    if (b.block) it.block = b.block;
    if (b.move) it.moveSpd = b.move;
    if (b.spellDmg) it.spellDmg = Math.round(b.spellDmg * (1 + 0.03 * lv));
    if (b.rangedDmg) it.rangedDmg = Math.round(b.rangedDmg * (1 + 0.03 * lv));

    if (!b.starter) {
      const R = D.RARITY[rarity];
      const count = U.randInt(h, R.affix[0], R.affix[1]);
      const pool = affixPool(b.slot, aff);
      for (let i = 0; i < count && pool.length; i++) {
        const k = U.weighted(h, pool);
        pool.splice(pool.findIndex((e) => e[0] === k), 1);
        it.affixes.push({ k, v: rollAffixValue(h, k, ilvl, rarity) });
      }
      let hasSkill = U.chance(h, R.skillP);
      let hasSpec = U.chance(h, R.specP * (b.slot === 'amulet' ? 1.5 : 1));
      if (R.guarantee && !hasSkill && !hasSpec) {
        if (U.chance(h, 0.55)) hasSkill = true;
        else hasSpec = true;
      }
      if (opts.bossPool) {
        // 頭目專屬池：保證帶一個該章節的專屬效果，可出現在任何部位
        const pool = opts.pool || { skills: D.BOSS_SKILLS, specials: D.BOSS_SPECIALS };
        if (U.chance(h, 0.5)) { it.skill = U.pick(h, pool.skills); hasSkill = false; }
        else { const k = U.pick(h, pool.specials); it.special = { k, v: rollSpecialValue(h, k, ilvl, rarity) }; hasSpec = false; }
        it.exclusive = true;
      }
      if (hasSkill && !it.skill) it.skill = opts.skill || pickSkill(h, aff);
      if (hasSpec && !it.special) {
        const k = U.pick(h, D.SPECIAL_POOL);
        it.special = { k, v: rollSpecialValue(h, k, ilvl, rarity) };
      }
    } else {
      it.skill = 'thrust';
    }
    it.name = makeName(h, it, b, aff);
    return it;
  }

  // 傳奇寶物：底材、屬性種類、技能都固定，數值依裝備等級以神話品質擲出
  function makeUnique(h, id, ilvl) {
    const u = D.UNIQUES[id];
    const it = make(h, { ilvl, rarity: 5, base: u.base });
    it.affixes = u.aff.map((k) => ({ k, v: rollAffixValue(h, k, it.ilvl, 5) }));
    it.skill = u.skill || null;
    it.special = null;
    delete it.exclusive;
    if (u.elem) it.elem = u.elem;
    it.uniq = id;
    it.name = u.name;
    return it;
  }
  // 挑一件傳奇寶物：限定章節的只在該章節掉；圖鑑還沒收集到的比較容易出現
  function rollUnique(h, dungeon, seen) {
    const pool = Object.keys(D.UNIQUES).filter((k) => !D.UNIQUES[k].where || D.UNIQUES[k].where === dungeon)
      .map((k) => [k, seen && seen.includes(k) ? 1 : 3]);
    return U.weighted(h, pool);
  }

  function makeName(h, it, b, aff) {
    if (b.starter) return '舊小刀';
    if (it.rarity >= 4) return `${U.pick(h, EPITHET)}・${b.name}`;
    if (it.rarity >= 2) return `${U.pick(h, PREFIX[aff])}${b.name}`;
    if (it.rarity === 1) return `精製${b.name}`;
    return b.name;
  }

  function starterKnife() {
    const h = { rng: 12345 };
    const it = make(h, { ilvl: 1, rarity: 0, base: 'knife' });
    it.id = 'starter-knife';
    return it;
  }

  function potion(h, kind) {
    return { id: newId(h), potion: kind, shape: ['X'], name: kind === 'red' ? '紅水' : '藍水' };
  }

  function baseShape(it) {
    return it.potion ? ['X'] : D.BASES[it.base].shape;
  }

  // 依旋轉回傳占用格座標（左上為原點）
  function cells(it, rot) {
    const shape = baseShape(it);
    const out = [];
    const h = shape.length, w = shape[0].length;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (shape[y][x] !== 'X') continue;
        let cx = x, cy = y;
        for (let r = 0; r < (rot || 0) % 4; r++) {
          const nx = (r % 2 === 0 ? h : w) - 1 - cy;
          cy = cx;
          cx = nx;
        }
        out.push([cx, cy]);
      }
    return out;
  }
  function dims(it, rot) {
    const c = cells(it, rot);
    let w = 0, h = 0;
    for (const [x, y] of c) { w = Math.max(w, x + 1); h = Math.max(h, y + 1); }
    return [w, h];
  }

  function sellValue(it) {
    if (it.potion) return 0;
    return Math.round((13 + it.ilvl * 2) * D.RARITY[it.rarity].sell * (1 + 0.1 * (it.plus || 0)));
  }

  // ---------- 工坊：強化與重骰 ----------
  // 第一次改造時記下原始數值，之後都從原始數值乘上強化倍率，避免四捨五入誤差累積
  function snapshot(it) {
    if (it.orig) return;
    it.orig = { dmg: it.dmg ? it.dmg.slice() : null, armor: it.armor, hp: it.hp, mp: it.mp, dodge: it.dodge, aff: it.affixes.map((a) => a.v) };
  }
  function applyPlus(it) {
    snapshot(it);
    const m = 1 + D.ECON.plusMul * (it.plus || 0);
    const o = it.orig;
    if (o.dmg) it.dmg = [Math.max(1, Math.round(o.dmg[0] * m)), Math.max(2, Math.round(o.dmg[1] * m))];
    for (const k of ['armor', 'hp', 'mp', 'dodge']) if (o[k]) it[k] = Math.round(o[k] * m);
    it.affixes.forEach((a, i) => {
      const A = D.AFFIX[a.k];
      const v = o.aff[i] * m;
      a.v = A.dec ? Math.round(v * 10) / 10 : Math.max(1, Math.round(v));
    });
  }
  function plusCap(it) {
    return D.ECON.plusCap[it.rarity];
  }
  function enhance(it) {
    if (it.potion || (it.plus || 0) >= plusCap(it)) return false;
    it.plus = (it.plus || 0) + 1;
    applyPlus(it);
    return true;
  }
  // full：連屬性種類一起重抽；否則只重抽數值
  function reroll(h, it, idx, full) {
    snapshot(it);
    const a = it.affixes[idx];
    if (!a) return null;
    let key = a.k;
    if (full) {
      const taken = new Set(it.affixes.map((x) => x.k));
      const pool = affixPool(it.slot, it.aff).filter((e) => !taken.has(e[0]));
      if (pool.length) key = U.weighted(h, pool);
    }
    const before = { k: a.k, v: a.v };
    it.affixes[idx] = { k: key, v: 0 };
    it.orig.aff[idx] = rollAffixValue(h, key, it.ilvl, it.rarity);
    it.rerolls = (it.rerolls || 0) + 1;
    applyPlus(it);
    return { before, after: { k: key, v: it.affixes[idx].v } };
  }
  function affixRange(it, k) {
    const A = D.AFFIX[k];
    const power = D.RARITY[it.rarity].power;
    const m = 1 + D.ECON.plusMul * (it.plus || 0);
    const f = (b) => {
      let v = b * power;
      if (A.pct) v *= 1 + 0.025 * (it.ilvl - 1);
      else v += (A.per || 0) * (it.ilvl - 1) * power;
      v *= m;
      return A.dec ? Math.round(v * 10) / 10 : Math.max(1, Math.round(v));
    };
    return [f(A.base[0]), f(A.base[1])];
  }
  function displayName(it) {
    return it.plus ? `${it.name} +${it.plus}` : it.name;
  }

  function fmtVal(k, v) {
    const a = D.AFFIX[k];
    const pct = a ? a.pct : /Pct|Dmg$/.test(k);
    return `+${v}${pct ? '%' : ''}`;
  }

  // 給畫面用的文字資訊
  function baseLines(it) {
    const b = D.BASES[it.base];
    const out = [];
    if (it.dmg) {
      const kind = { melee: '近戰', bow: '遠程弓', staff: '法杖' }[b.kind];
      const el = it.elem ? D.ELEM[it.elem] : '物理';
      out.push(`${b.hand === 2 ? '雙手' : '單手'}${kind}｜${el}傷害 ${it.dmg[0]}–${it.dmg[1]}｜每秒 ${it.aspd} 下${b.range > 1 ? `｜射程 ${b.range}` : ''}`);
    }
    if (it.armor) out.push(`護甲 ${it.armor}`);
    if (it.block) out.push(`格擋率 ${it.block}%`);
    if (it.hp) out.push(`最大生命 +${it.hp}`);
    if (it.mp) out.push(`最大法力 +${it.mp}`);
    if (it.dodge) out.push(`閃避 +${it.dodge}`);
    if (it.moveSpd) out.push(`移動速度 +${it.moveSpd}%`);
    if (it.spellDmg) out.push(`法術傷害 +${it.spellDmg}%`);
    if (it.rangedDmg) out.push(`遠程傷害 +${it.rangedDmg}%`);
    return out;
  }
  function affixLines(it) {
    return it.affixes.map((a) => `${D.AFFIX[a.k].name} ${fmtVal(a.k, a.v)}`);
  }

  LH.Items = { make, makeUnique, rollUnique, rollRarity, starterKnife, potion, cells, dims, sellValue, baseLines, affixLines, newId, baseShape, enhance, reroll, plusCap, applyPlus, affixRange, displayName, fmtVal };
})(typeof window !== 'undefined' ? window : globalThis);
