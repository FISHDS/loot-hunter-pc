// 角色數值：三圍 + 裝備 + 星盤 → 戰鬥用數值；技能整合；裝備比較評分。
(function (root) {
  const LH = root.LH;
  const { U, D } = LH;

  const RES_CAP = 75, BLOCK_CAP = 50, CDR_CAP = 40, MANACOST_CAP = 45;

  function activeKeys(stars) {
    const keys = new Set();
    for (const id of stars.owned) {
      if (!D.STARS[id]) continue;
      const k = D.STARS[id].eff.key;
      if (!k) continue;
      const ex = D.STAR_KEYS[k].excl;
      if (ex && stars.owned.some((o) => D.STARS[o] && D.STARS[o].eff.key === ex)) {
        if (stars.choice && stars.choice[k] === false) continue;
        if (!(stars.choice && stars.choice[k])) {
          // 互斥且尚未選擇：以先購買者為準
          const firstK = stars.owned.find((o) => D.STARS[o] && [k, ex].includes(D.STARS[o].eff.key));
          if (D.STARS[firstK].eff.key !== k) continue;
        }
      }
      keys.add(k);
    }
    return keys;
  }

  function skillPower(it) {
    return 15 * Math.pow(1.12, it.ilvl - 1) * D.RARITY[it.rarity].power * (1 + 0.06 * (it.plus || 0));
  }

  // state: { hero:{level, attrs}, gear:{slot:item}, stars:{owned, choice} }
  function compute(state, gearOverride) {
    const gear = gearOverride || state.gear;
    const keys = activeKeys(state.stars);
    const s = {
      level: state.hero.level,
      str: state.hero.attrs.str, dex: state.hero.attrs.dex, int: state.hero.attrs.int,
      hp: 0, mp: 0, hpPct: 0, armor: 0, dodge: 0, block: 0, resFire: 0, resCold: 0, resLight: 0, resAll: 0,
      mpRegen: 0, hpRegen: 0, aspd: 0, physDmg: 0, fireDmg: 0, coldDmg: 0, lightDmg: 0, elemDmg: 0,
      spellDmg: 0, skillDmg: 0, rangedDmg: 0, cdr: 0, manaOnHit: 0, manaCost: 0, moveSpd: 0, armorPct: 0, mpPct: 0,
    };
    const add = (k, v) => { if (k in s) s[k] += v; };
    const owned = new Set(state.stars.owned);
    for (const id of state.stars.owned) {
      if (!D.STARS[id]) continue;
      const e = D.STARS[id].eff;
      for (const [k, v] of Object.entries(e)) if (k !== 'key') add(k, v);
    }
    // 集滿整個星座的額外獎勵
    s.doneConsts = [];
    for (const c of D.CONSTELLATIONS || []) {
      if (!c.nodes.every((n) => owned.has(n))) continue;
      s.doneConsts.push(c.id);
      for (const [k, v] of Object.entries(c.done)) add(k, v);
    }
    if (keys.has('bulwark')) { s.armorPct += 30; s.block += 10; s.moveSpd -= 10; }
    const items = D.SLOTS.map((sl) => gear[sl]).filter(Boolean);
    for (const it of items) {
      for (const k of ['armor', 'hp', 'mp', 'dodge', 'block', 'moveSpd', 'spellDmg', 'rangedDmg']) if (it[k]) add(k, it[k]);
      for (const a of it.affixes) add(a.k, a.v);
    }
    // 盔甲套裝：四件同一類
    const clsCount = {};
    for (const sl of D.ARMOR_SLOTS) {
      const it = gear[sl];
      const c = it && D.BASES[it.base] && D.BASES[it.base].cls;
      if (c) clsCount[c] = (clsCount[c] || 0) + 1;
    }
    s.armorCls = clsCount;
    s.armorSet = Object.keys(clsCount).find((c) => clsCount[c] >= 4) || null;
    if (s.armorSet === 'heavy') s.armorPct += 15;
    if (s.armorSet === 'light') s.moveSpd += 5;
    if (s.armorSet === 'cloth') { s.mpPct += 15; s.cdr += 5; }
    // 傳奇寶物
    s.uq = {};
    s.uqPow = {};
    for (const it of items) if (it.uniq) { s.uq[it.uniq] = true; s.uqPow[it.uniq] = Math.max(s.uqPow[it.uniq] || 0, skillPower(it)); }
    if (s.uq.starEater) s.spellDmg += 40;
    if (s.uq.sageHood) s.hpPct -= 15;
    // 三圍效果
    const lv = s.level;
    s.maxHp = Math.round((90 + lv * 8 + s.str * 2 + s.hp) * (1 + s.hpPct / 100));
    s.maxMp = Math.round((40 + lv * 3 + s.int * 3 + s.mp) * (1 + s.mpPct / 100));
    s.armor = s.armor * (1 + s.armorPct / 100);
    s.mpRegen = 1.8 + s.int * 0.04 + s.mpRegen;
    s.dodge += s.dex * 2;
    if (s.armorSet === 'light') s.dodge *= 1.1;
    s.aspdMul = 1 + (s.aspd + s.dex * 0.5) / 100;
    s.res = {
      phys: 0,
      fire: Math.min(RES_CAP, s.resFire + s.resAll),
      cold: Math.min(RES_CAP, s.resCold + s.resAll),
      light: Math.min(RES_CAP, s.resLight + s.resAll),
    };
    s.block = Math.min(BLOCK_CAP, s.block);
    s.cdrF = Math.min(CDR_CAP, s.cdr + (keys.has('nimble') ? 15 : 0)) / 100 + (s.uq.sageHood ? 0.2 : 0);
    s.manaCostF = Math.min(MANACOST_CAP, s.manaCost + (keys.has('nimble') ? 10 : 0) + (keys.has('steadyFlow') ? 15 : 0)) / 100;
    if (keys.has('steadyFlow')) s.mpRegen *= 1.6;
    s.move = 3.4 * (1 + s.moveSpd / 100);
    s.attrBonus = { str: s.str * 2.5, dex: s.dex * 2.5, int: s.int * 2.5 };
    if (keys.has('brawnMagic')) {
      const conv = 0.5 * (s.physDmg + s.attrBonus.str);
      s.physDmg *= 0.5;
      s.attrBonus.str *= 0.5;
      s.spellDmg += conv;
    }
    if (keys.has('thunderLoop')) s.lightDmg += 20;
    s.keys = [...keys];
    // 傳奇寶物的火焰觸發效果（燼王之劍爆炸、星隕護符隕石）吃火焰與法術加成
    s.fireMul = 1 + (s.attrBonus.int + s.fireDmg + s.elemDmg + s.spellDmg) / 100;

    // 武器：普通攻擊
    const main = gear.weapon || null;
    const off = gear.offhand && gear.offhand.slot === 'weapon' ? gear.offhand : null;
    const weap = (it) => {
      const b = D.BASES[it.base];
      const elem = it.elem || 'phys';
      const attr = b.kind === 'melee' ? 'str' : b.kind === 'bow' ? 'dex' : 'int';
      let addPct = s.attrBonus[attr] + (elem === 'phys' ? s.physDmg : s[elem + 'Dmg'] + s.elemDmg);
      if (b.kind === 'bow') addPct += s.rangedDmg;
      if (b.kind === 'staff') addPct += s.spellDmg;
      return { id: it.id, base: it.base, kind: b.kind, hand: b.hand, elem, range: b.range, dmg: it.dmg.slice(), aspd: it.aspd, mul: 1 + addPct / 100 };
    };
    s.weapons = [];
    if (main) s.weapons.push(weap(main));
    else s.weapons.push({ id: 'fist', base: 'fist', kind: 'melee', hand: 1, elem: 'phys', range: 1, dmg: [1, 2], aspd: 1.2, mul: 1 + s.attrBonus.str / 100 });
    s.extraBase = 0;
    if (off && main) {
      const ob = D.BASES[off.base], mb = D.BASES[main.base];
      if (keys.has('dual1h') && ob.hand === 1 && mb.hand === 1) s.weapons.push(weap(off));
      else if (keys.has('dual2h') && ob.hand === 2 && mb.hand === 2) s.extraBase = 0.4 * ((off.dmg[0] + off.dmg[1]) / 2);
    }

    // 特殊能力：同名最多兩件，第二件半效
    const spec = {};
    const specLists = {};
    for (const it of items) if (it.special) (specLists[it.special.k] = specLists[it.special.k] || []).push(it.special.v);
    for (const [k, vs] of Object.entries(specLists)) {
      vs.sort((a, b) => b - a);
      spec[k] = vs[0] + (vs[1] ? vs[1] * 0.5 : 0);
    }
    s.spec = spec;
    if (spec.forgeHeart) s.res.fire = Math.min(80, s.res.fire + spec.forgeHeart);
    if (spec.armorPierce) spec.armorPierce = Math.min(60, spec.armorPierce);
    if (spec.starGuide) s.cdrF = Math.min(0.6, s.cdrF + spec.starGuide / 100);

    // 技能：依部位順序，同名只出現一次；最強一件為基礎，第二件小幅補強（上限 10%），第三件無效
    const groups = {};
    const order = [];
    D.SLOTS.forEach((sl) => {
      const it = gear[sl];
      if (!it || !it.skill) return;
      if (!groups[it.skill]) { groups[it.skill] = []; order.push({ id: it.skill, slot: sl }); }
      groups[it.skill].push(it);
    });
    s.skills = order.map(({ id, slot }) => {
      const list = groups[id].slice().sort((a, b) => skillPower(b) - skillPower(a));
      const sk = D.SKILLS[id];
      let power = skillPower(list[0]);
      if (list[1]) power *= 1 + Math.min(0.1, 0.1 * (skillPower(list[1]) / skillPower(list[0])));
      let shape = Object.assign({}, sk.shape);
      let manaMul = 1, cdMul = 1;
      if (shape.t === 'line') {
        if (keys.has('strLine') && sk.attr === 'str') { shape.len++; manaMul += 0.15; cdMul += 0.1; }
        if (keys.has('piercer') && sk.attr === 'dex') { shape.len++; manaMul += 0.15; }
        shape.len = Math.min(6, shape.len);
      }
      if (shape.t === 'single' && keys.has('piercer') && sk.attr === 'dex') { shape.los = false; manaMul += 0.15; }
      if ((shape.t === 'area' || shape.t === 'self') && keys.has('arcaneSpread')) {
        shape.n = Math.min(4, shape.n + 1);
        manaMul += 0.3; cdMul += 0.15;
      }
      const elem = s.uq.frostheart && sk.coef ? 'cold' : sk.elem;
      let addPct = s.attrBonus[sk.attr] + s.skillDmg;
      addPct += elem === 'phys' ? s.physDmg : s[elem + 'Dmg'] + s.elemDmg;
      if (sk.attr === 'int' || elem !== 'phys') addPct += s.spellDmg;
      if (sk.attr === 'dex') addPct += s.rangedDmg;
      let mul = 1 + addPct / 100;
      if (keys.has('steadyFlow')) mul *= 0.8;
      // 越高等的技能裝備越耗魔
      const ilvlF = 1 + D.ECON.manaIlvl * (list[0].ilvl - 1);
      return {
        id, slot, name: sk.name, cat: sk.cat, attr: sk.attr, elem, shape,
        dmg: sk.coef ? power * sk.coef * mul : 0,
        power, mul,
        mana: Math.max(1, Math.round(sk.mana * manaMul * ilvlF * (1 - s.manaCostF))),
        restore: sk.restore ? Math.round(sk.restore * ilvlF) : 0,
        cd: Math.max(0.5, sk.cd * cdMul * (1 - s.cdrF)),
        dup: list.length,
      };
    });
    return s;
  }

  // 三項估算：打單一強敵、清怪群、生存
  function evaluate(cs) {
    const L = Math.max(1, cs.level);
    let basic = 0;
    for (const w of cs.weapons) basic += ((w.dmg[0] + w.dmg[1]) / 2 + cs.extraBase) * w.mul * w.aspd * cs.aspdMul;
    basic /= cs.weapons.length;
    const budget0 = cs.mpRegen + cs.manaOnHit * cs.aspdMul * cs.weapons[0].aspd + 0.8;
    const dpsWith = (targetsFn) => {
      const sk = cs.skills.filter((k) => k.dmg > 0).map((k) => {
        const zone = D.SKILLS[k.id].zone || 1;
        const per = k.dmg * zone * targetsFn(k);
        return { per, rate: 1 / k.cd, mana: k.mana };
      }).sort((a, b) => b.per / b.mana - a.per / a.mana);
      let budget = budget0, total = 0;
      for (const k of sk) {
        const need = k.rate * k.mana;
        const f = Math.min(1, budget / need);
        total += k.per * k.rate * f;
        budget -= need * f;
        if (budget <= 0) break;
      }
      return total;
    };
    const single = basic + dpsWith(() => 1);
    const clear = basic * 1.1 + dpsWith((k) => {
      if (k.shape.t === 'line') return Math.min(3, 1 + k.shape.len * 0.4);
      if (k.shape.t === 'self' || k.shape.t === 'area') return 1 + k.shape.n * k.shape.n * 0.3;
      return 1;
    });
    const armorRed = Math.min(0.75, cs.armor / (cs.armor + 40 + 14 * L));
    const dodgeC = Math.min(0.5, cs.dodge / (cs.dodge + 60 + 12 * L));
    const blockF = 1 - (cs.block / 100) * 0.65;
    const resAvg = (cs.res.fire + cs.res.cold + cs.res.light) / 300;
    const mit = 0.7 * (1 - armorRed) + 0.3 * (1 - resAvg);
    let surv = cs.maxHp / (mit * (1 - dodgeC) * blockF) + cs.hpRegen * 25;
    for (const k of cs.skills) if (k.cat === 'def') surv *= 1.12;
    return { single, clear, surv };
  }

  function score(ev, ref) {
    return ev.single / ref.single + ev.clear / ref.clear + ev.surv / ref.surv;
  }

  // 是否能放在指定部位（處理雙持規則）
  function canEquip(state, item, slot) {
    const keys = activeKeys(state.stars);
    const b = D.BASES[item.base];
    if (slot === item.slot && slot !== 'offhand' && slot !== 'weapon') return { ok: true };
    if (slot === 'weapon') {
      if (item.slot !== 'weapon') return { ok: false, reason: '只能放武器' };
      const off = state.gear.offhand;
      if (off && off.slot === 'weapon') {
        const ob = D.BASES[off.base];
        if (b.hand !== ob.hand) return { ok: false, reason: '雙持時兩把必須同為單手或同為雙手', swapOff: true };
      }
      return { ok: true };
    }
    if (slot === 'offhand') {
      if (item.slot === 'offhand') {
        return { ok: true };
      }
      if (item.slot !== 'weapon') return { ok: false, reason: '副手只能放盾、法器、箭袋或武器' };
      const main = state.gear.weapon;
      if (!main) return { ok: false, reason: '先裝備主武器' };
      const mb = D.BASES[main.base];
      if (b.hand === 1 && mb.hand === 1) return keys.has('dual1h') ? { ok: true } : { ok: false, reason: '需要敏捷區大星點「雙刃」' };
      if (b.hand === 2 && mb.hand === 2) return keys.has('dual2h') ? { ok: true } : { ok: false, reason: '需要力量區大星點「巨械雙持」' };
      return { ok: false, reason: '不能雙手武器搭單手武器' };
    }
    return { ok: false, reason: '部位不符' };
  }

  function equipSlotsFor(state, item) {
    if (item.slot === 'weapon') {
      const s = ['weapon'];
      if (canEquip(state, item, 'offhand').ok) s.push('offhand');
      return s;
    }
    return [item.slot];
  }

  // 估算把某件裝備穿上（最佳部位）後的三項數值
  function previewWith(state, item) {
    let best = null;
    for (const slot of equipSlotsFor(state, item)) {
      const g = Object.assign({}, state.gear, { [slot]: item });
      if (slot === 'weapon' && g.offhand && g.offhand.slot === 'weapon' && D.BASES[g.offhand.base].hand !== D.BASES[item.base].hand) g.offhand = null;
      const ev = evaluate(compute(state, g));
      const cur = evaluate(compute(state));
      const sc = score(ev, cur);
      if (!best || sc > best.sc) best = { slot, ev, cur, sc };
    }
    return best;
  }

  LH.Char = { compute, evaluate, score, canEquip, previewWith, activeKeys, skillPower, equipSlotsFor };
})(typeof window !== 'undefined' ? window : globalThis);
