// 遊戲內容資料：稀有度、部位、裝備底材、詞綴、技能、特殊能力、怪物、頭目、星盤。
(function (root) {
  const LH = root.LH;
  const D = (LH.D = {});

  D.ELEM = { phys: '物理', fire: '火焰', cold: '冰霜', light: '雷電' };
  D.ELEM_COLOR = { phys: '#e8e0d0', fire: '#ff7a2e', cold: '#7fd8ff', light: '#ffe85c' };
  D.ATTR = { str: '力量', dex: '敏捷', int: '智慧' };

  D.RARITY = [
    { name: '普通', color: '#c8c4bc', affix: [1, 1], skillP: 0.1, specP: 0.03, sell: 1, power: 1.0 },
    { name: '精良', color: '#62d26f', affix: [1, 2], skillP: 0.18, specP: 0.08, sell: 1.7, power: 1.08 },
    { name: '稀有', color: '#4ea8ff', affix: [2, 3], skillP: 0.28, specP: 0.15, sell: 3, power: 1.17 },
    { name: '史詩', color: '#b876ff', affix: [3, 3], skillP: 0.4, specP: 0.25, sell: 5.5, power: 1.27 },
    { name: '傳說', color: '#ff9b30', affix: [3, 4], skillP: 0.6, specP: 0.5, sell: 10, power: 1.38, guarantee: true },
    { name: '神話', color: '#ff4f6e', affix: [4, 4], skillP: 0.7, specP: 0.6, sell: 18, power: 1.52, guarantee: true },
  ];

  D.SLOTS = ['weapon', 'head', 'body', 'hands', 'feet', 'ring', 'offhand', 'amulet'];
  D.SLOT_NAME = {
    weapon: '主武器', head: '頭部', body: '身體', hands: '手部',
    feet: '腳部', ring: '戒指', offhand: '副手', amulet: '飾品',
  };

  // 背包形狀：X 為占用格。稀有度不改變大小。
  D.BASES = {
    knife: { slot: 'weapon', name: '小刀', hand: 1, kind: 'melee', dmg: [3, 5], aspd: 1.6, range: 1, shape: ['X', 'X'], aff: 'str', starter: true },
    dagger: { slot: 'weapon', name: '匕首', hand: 1, kind: 'melee', dmg: [3, 6], aspd: 1.6, range: 1, shape: ['X', 'X'], aff: 'dex' },
    sword: { slot: 'weapon', name: '長劍', hand: 1, kind: 'melee', dmg: [5, 9], aspd: 1.25, range: 1, shape: ['X', 'X', 'X'], aff: 'str' },
    hammer: { slot: 'weapon', name: '戰鎚', hand: 2, kind: 'melee', dmg: [11, 19], aspd: 0.85, range: 1, shape: ['XXX', '.X.', '.X.'], aff: 'str' },
    bow: { slot: 'weapon', name: '長弓', hand: 2, kind: 'bow', dmg: [6, 11], aspd: 1.05, range: 6, shape: ['X.', 'XX', 'XX', 'X.'], aff: 'dex' },
    staff: { slot: 'weapon', name: '法杖', hand: 2, kind: 'staff', dmg: [5, 9], aspd: 1.0, range: 5, shape: ['X', 'X', 'X', 'X'], aff: 'int' },
    helm: { slot: 'head', name: '礦工盔', cls: 'heavy', armor: 8, shape: ['XX', 'XX'] },
    cap: { slot: 'head', name: '皮帽', cls: 'light', armor: 5, dodge: 8, shape: ['XX', 'XX'], aff: 'dex' },
    hood: { slot: 'head', name: '晶紋兜帽', cls: 'cloth', armor: 4, mp: 10, shape: ['XX', 'XX'], aff: 'int' },
    mail: { slot: 'body', name: '鍊甲', cls: 'heavy', armor: 18, hp: 10, shape: ['X.X', 'XXX', '.X.'], aff: 'str' },
    robe: { slot: 'body', name: '暗紋法袍', cls: 'cloth', armor: 8, mp: 15, shape: ['X.X', 'XXX', '.X.'], aff: 'int' },
    leather: { slot: 'body', name: '皮甲', cls: 'light', armor: 12, dodge: 15, shape: ['X.X', 'XXX', '.X.'], aff: 'dex' },
    gauntlets: { slot: 'hands', name: '鐵護手', cls: 'heavy', armor: 8, shape: ['XX', 'X.'], aff: 'str' },
    gloves: { slot: 'hands', name: '皮手套', cls: 'light', armor: 5, shape: ['XX', 'X.'] },
    wraps: { slot: 'hands', name: '布手套', cls: 'cloth', armor: 3, mp: 8, shape: ['XX', 'X.'], aff: 'int' },
    greaves: { slot: 'feet', name: '鐵靴', cls: 'heavy', armor: 8, move: 1, shape: ['X.', 'XX'], aff: 'str' },
    boots: { slot: 'feet', name: '皮靴', cls: 'light', armor: 5, move: 3, shape: ['X.', 'XX'] },
    slippers: { slot: 'feet', name: '布鞋', cls: 'cloth', armor: 3, mp: 6, move: 3, shape: ['X.', 'XX'], aff: 'int' },
    ring: { slot: 'ring', name: '戒指', shape: ['X'] },
    shield: { slot: 'offhand', name: '圓盾', armor: 10, block: 15, shape: ['XX', 'XX'], aff: 'str' },
    orb: { slot: 'offhand', name: '晶球法器', mp: 15, spellDmg: 8, shape: ['X', 'X'], aff: 'int' },
    quiver: { slot: 'offhand', name: '箭袋', rangedDmg: 10, shape: ['X', 'X', 'X'], aff: 'dex' },
    amulet: { slot: 'amulet', name: '護符', shape: ['X', 'X'] },
  };
  // 盔甲分類：頭、身、手、腳四件都同一類時有套裝加成
  D.ARMOR_CLS = {
    heavy: { name: '重甲', color: '#c9d1db', set: '護甲 +15%' },
    light: { name: '輕甲', color: '#d9a46a', set: '閃避 +10%、移動速度 +5%' },
    cloth: { name: '布甲', color: '#c49cff', set: '最大法力 +15%、冷卻縮減 +5%' },
  };
  D.ARMOR_SLOTS = ['head', 'body', 'hands', 'feet'];
  D.BASE_BY_SLOT = {};
  for (const [id, b] of Object.entries(D.BASES)) {
    if (b.starter) continue;
    (D.BASE_BY_SLOT[b.slot] = D.BASE_BY_SLOT[b.slot] || []).push(id);
  }

  // 詞綴：base 為一級時的範圍；pct 為百分比數值（隨等級成長較慢）
  D.AFFIX = {
    str: { name: '力量', base: [2, 4], per: 0.35, aff: 'str' },
    dex: { name: '敏捷', base: [2, 4], per: 0.35, aff: 'dex' },
    int: { name: '智慧', base: [2, 4], per: 0.35, aff: 'int' },
    hp: { name: '最大生命', base: [8, 15], per: 2.4, aff: 'str' },
    mp: { name: '最大法力', base: [6, 11], per: 1.4, aff: 'int' },
    armor: { name: '護甲', base: [6, 11], per: 2.2, aff: 'str' },
    dodge: { name: '閃避', base: [7, 12], per: 2.2, aff: 'dex' },
    block: { name: '格擋率', base: [3, 6], pct: true, aff: 'str' },
    resFire: { name: '火焰抗性', base: [6, 12], pct: true },
    resCold: { name: '冰霜抗性', base: [6, 12], pct: true },
    resLight: { name: '雷電抗性', base: [6, 12], pct: true },
    resAll: { name: '全元素抗性', base: [3, 6], pct: true },
    mpRegen: { name: '法力回復/秒', base: [0.3, 0.6], per: 0.04, dec: 1, aff: 'int' },
    hpRegen: { name: '生命回復/秒', base: [0.4, 0.9], per: 0.1, dec: 1, aff: 'str' },
    aspd: { name: '攻擊速度', base: [4, 9], pct: true, aff: 'dex' },
    physDmg: { name: '物理傷害', base: [8, 15], pct: true, aff: 'str' },
    fireDmg: { name: '火焰傷害', base: [8, 15], pct: true, aff: 'int' },
    coldDmg: { name: '冰霜傷害', base: [8, 15], pct: true, aff: 'int' },
    lightDmg: { name: '雷電傷害', base: [8, 15], pct: true, aff: 'int' },
    spellDmg: { name: '法術傷害', base: [6, 12], pct: true, aff: 'int' },
    skillDmg: { name: '技能傷害', base: [5, 10], pct: true },
    cdr: { name: '冷卻縮減', base: [3, 7], pct: true, aff: 'dex' },
    manaOnHit: { name: '普攻回魔', base: [0.5, 1.1], per: 0.03, dec: 1, aff: 'dex' },
    manaCost: { name: '技能耗魔減少', base: [3, 7], pct: true, aff: 'int' },
    moveSpd: { name: '移動速度', base: [4, 8], pct: true, slots: ['feet'] },
  };

  // 技能：shape 類型 line（直線）、self（自身方形）、area（射程內方形）、single（單體）、buff（自身增益）
  D.SKILLS = {
    thrust: { name: '突刺', attr: 'str', elem: 'phys', shape: { t: 'line', len: 2 }, mana: 3, cd: 1.4, coef: 1.5, cat: 'line',
      desc: '近身直線 1×2，朝能刺中最多敵人的方向刺出。' },
    cleave: { name: '劈岩斬', attr: 'str', elem: 'phys', shape: { t: 'line', len: 4 }, mana: 9, cd: 4, coef: 2.0, interrupt: true, cat: 'line',
      desc: '前方直線 1×4，打斷一般敵人的蓄力；對準敵人最多的直線。' },
    whirl: { name: '旋斬', attr: 'str', elem: 'phys', shape: { t: 'self', n: 3 }, mana: 14, cd: 5, coef: 1.8, cat: 'aoe',
      desc: '以自己為中心 3×3 迴旋，清除近身包圍。' },
    breaker: { name: '破勢擊', attr: 'str', elem: 'phys', shape: { t: 'single', range: 1 }, mana: 8, cd: 6, coef: 3.0, interrupt: true, aim: 'bossCharge', cat: 'single',
      desc: '近身單體重擊。頭目蓄力時優先打頭目，可打斷或削弱招式。' },
    aimed: { name: '精準箭', attr: 'dex', elem: 'phys', shape: { t: 'single', range: 6, los: true }, mana: 6, cd: 2.5, coef: 2.6, aim: 'lowestHp', cat: 'single',
      desc: '最遠 6 格的單體射擊，優先射線暢通且生命最低的敵人；被肉盾擋住時打不到後排。' },
    pierce: { name: '貫穿箭', attr: 'dex', elem: 'phys', shape: { t: 'line', len: 6 }, mana: 10, cd: 4, coef: 1.8, cat: 'line',
      desc: '最遠 6 格的直線穿透箭，選能穿過最多敵人的方向。' },
    fan: { name: '扇射', attr: 'dex', elem: 'phys', shape: { t: 'area', n: 2, range: 6 }, mana: 10, cd: 4.5, coef: 1.7, cat: 'aoe',
      desc: '射程 6 內的 2×2 箭雨，落在敵人最密集處。' },
    bolt: { name: '雷束', attr: 'int', elem: 'light', shape: { t: 'line', len: 4 }, mana: 11, cd: 3.5, coef: 2.0, shock: true, cat: 'line',
      desc: '直線 1×4 雷擊並造成感電，選敵人最密集的直線。' },
    firewell: { name: '火井', attr: 'int', elem: 'fire', shape: { t: 'area', n: 2, range: 5 }, mana: 12, cd: 6, coef: 0.75, zone: 3, burn: true, cat: 'aoe',
      desc: '射程 5 內 2×2 的火焰區域，3 秒內持續灼燒並點燃敵人。' },
    frost: { name: '寒潮', attr: 'int', elem: 'cold', shape: { t: 'self', n: 3 }, mana: 13, cd: 7, coef: 1.3, slow: true, cat: 'aoe',
      desc: '以自己為中心 3×3 的冰潮，造成冰傷並減速。' },
    manabolt: { name: '魔力針', attr: 'int', elem: 'light', shape: { t: 'single', range: 6, los: true }, mana: 5, cd: 2, coef: 1.6, restore: 6, aim: 'caster', cat: 'single',
      desc: '遠程單體法術，命中後回復 6 點法力；優先射線暢通的施法怪。' },
    stoneskin: { name: '石膚', attr: 'str', elem: 'phys', shape: { t: 'buff' }, mana: 10, cd: 14, cat: 'def',
      desc: '6 秒內護甲提高 60%、格擋率 +15%。頭目蓄力時優先使用。' },
    heal: { name: '治療脈動', attr: 'int', elem: 'phys', shape: { t: 'buff' }, mana: 16, cd: 18, cat: 'def',
      desc: '5 秒內逐漸回復 30% 生命。冷卻較長，不能取代紅水。' },
    static: { name: '靜電護幕', attr: 'int', elem: 'light', shape: { t: 'buff' }, mana: 14, cd: 15, cat: 'def',
      desc: '8 秒內吸收最多 25% 生命的傷害，並每秒電擊身旁敵人。' },
    // 礦坑頭目專屬
    rift: { name: '裂晶', attr: 'str', elem: 'phys', shape: { t: 'line', len: 5 }, mana: 12, cd: 5, coef: 2.4, armorPierce: 0.5, boss: true, cat: 'line',
      desc: '【礦坑專屬】黑晶沿直線 1×5 迸裂，無視目標一半護甲。' },
    quake: { name: '震地', attr: 'str', elem: 'phys', shape: { t: 'self', n: 3 }, mana: 15, cd: 8, coef: 2.0, stun: 1, boss: true, cat: 'aoe',
      desc: '【礦坑專屬】以自己為中心 3×3 震地，暈眩一般敵人 1 秒。' },
    // 骨沼專屬
    boneSpear: { name: '骨矛', attr: 'dex', elem: 'phys', shape: { t: 'line', len: 5 }, mana: 11, cd: 4.5, coef: 2.2, slow: true, boss: true, cat: 'line',
      desc: '【骨沼專屬】沿直線 1×5 刺出骨矛，命中的敵人減速。' },
    plague: { name: '瘟疫雲', attr: 'int', elem: 'cold', shape: { t: 'area', n: 3, range: 5 }, mana: 14, cd: 7, coef: 0.55, zone: 4, slowZone: true, boss: true, cat: 'aoe',
      desc: '【骨沼專屬】射程 5 內 3×3 的瘟疫雲，4 秒內持續冰傷並讓其中的敵人減速。' },
    // 工坊專屬
    meteor: { name: '隕火', attr: 'int', elem: 'fire', shape: { t: 'area', n: 3, range: 6 }, mana: 16, cd: 8, coef: 2.6, burn: true, boss: true, cat: 'aoe',
      desc: '【工坊專屬】射程 6 內 3×3 落下隕火，造成大量火傷並點燃敵人。' },
    moltenCleave: { name: '熔鐵斬', attr: 'str', elem: 'fire', shape: { t: 'line', len: 4 }, mana: 11, cd: 4.5, coef: 2.3, burn: true, boss: true, cat: 'line',
      desc: '【工坊專屬】揮出熔紅的斬擊，直線 1×4 火焰傷害並點燃敵人。' },
    // 觀測所專屬
    starBolt: { name: '星落', attr: 'int', elem: 'light', shape: { t: 'area', n: 3, range: 6 }, mana: 15, cd: 7, coef: 2.3, shock: true, boss: true, cat: 'aoe',
      desc: '【觀測所專屬】射程 6 內 3×3 落下星光，造成雷電傷害並感電。' },
    iceComet: { name: '冰隕箭', attr: 'dex', elem: 'cold', shape: { t: 'line', len: 6 }, mana: 11, cd: 4.5, coef: 2.1, slow: true, boss: true, cat: 'line',
      desc: '【觀測所專屬】射出穿透的冰隕，直線 1×6 冰霜傷害並減速。' },
  };
  D.SKILL_POOL = { str: [], dex: [], int: [] };
  for (const [id, s] of Object.entries(D.SKILLS)) if (!s.boss) D.SKILL_POOL[s.attr].push(id);
  D.BOSS_SKILLS = ['rift', 'quake'];

  // 特殊能力：v 為一級數值範圍，cd 為內部冷卻
  D.SPECIALS = {
    blueLight: { name: '藍水導流', v: [30, 50], fmt: (v) => `喝藍水後，下一次雷系技能耗魔減少 ${v}%` },
    redArmor: { name: '紅水鐵膚', v: [25, 45], fmt: (v) => `喝紅水後 5 秒內護甲 +${v}%` },
    dodgeMana: { name: '閃身回魔', v: [3, 6], cd: 1, fmt: (v) => `成功閃避後回復 ${v} 點法力（1 秒冷卻）` },
    blockShield: { name: '格擋護盾', v: [8, 14], cd: 3, fmt: (v) => `成功格擋後得到 ${v}% 生命的護盾，持續 4 秒（3 秒冷卻）` },
    killPhys: { name: '殺意', v: [15, 30], fmt: (v) => `擊殺敵人後，下一次物理技能傷害 +${v}%` },
    multiRefund: { name: '群擊回流', v: [20, 40], fmt: (v) => `一招擊中至少 3 隻敵人時，返還 ${v}% 法力消耗` },
    burnCold: { name: '冰火交織', v: [40, 70], fmt: (v) => `冰系技能命中燃燒中的敵人時，減速時間延長 ${v}%` },
    lowRes: { name: '絕境抗性', v: [15, 25], cd: 20, fmt: (v) => `生命低於 35% 時，5 秒內全抗性 +${v}%（20 秒最多一次）` },
    chargeCd: { name: '見招拆招', v: [30, 50], fmt: (v) => `頭目蓄力時施放防禦技能並承受該招後，返還該技能 ${v}% 冷卻` },
    elemChain: { name: '元素交替', v: [10, 18], fmt: (v) => `連續使用不同元素的技能時，下一招 +${v}% 傷害（不累加）` },
    // 礦坑頭目專屬效果
    armorReflect: { name: '礦甲反震', v: [6, 10], boss: true, fmt: (v) => `被近戰擊中時，反震 ${v} 點傷害（隨裝備等級成長）` },
    blueThunder: { name: '晶雷導引', v: [12, 20], boss: true, fmt: (v) => `喝藍水時，落雷擊中附近最多 3 名敵人，各 ${v} 點雷傷` },
    killShards: { name: '碎晶飛散', v: [8, 14], boss: true, fmt: (v) => `擊殺敵人時碎晶飛散，對相鄰敵人造成 ${v} 點物理傷害` },
    armorPierce: { name: '破甲晶刃', v: [30, 45], boss: true, fmt: (v) => `攻擊與技能無視敵人 ${v}% 護甲` },
    // 骨沼頭目專屬效果
    lifeLeech: { name: '屍血汲取', v: [3, 5], boss: true, fmt: (v) => `普通攻擊造成傷害的 ${v}% 回復為生命` },
    killHeal: { name: '亡者餽贈', v: [4, 7], boss: true, fmt: (v) => `擊殺敵人時回復 ${v} 點生命（隨裝備等級成長）` },
    bogWalker: { name: '涉沼者', v: [8, 14], boss: true, fmt: (v) => `沼澤與減速效果對你減半，移動速度 +${v}%` },
    chillBane: { name: '寒骨', v: [15, 25], boss: true, fmt: (v) => `對減速中的敵人傷害 +${v}%` },
    // 工坊頭目專屬效果
    lavaWalker: { name: '熔岩行者', v: [40, 60], boss: true, fmt: (v) => `熔岩與火池對你的傷害減少 ${v}%` },
    fireLeech: { name: '焰血', v: [2, 4], boss: true, fmt: (v) => `造成火焰傷害的 ${v}% 回復為生命` },
    forgeHeart: { name: '爐心', v: [12, 20], boss: true, fmt: (v) => `火焰抗性 +${v}%，火焰抗性上限提高到 80%` },
    // 觀測所頭目專屬效果
    starShield: { name: '星盾', v: [50, 80], boss: true, fmt: (v) => `每 8 秒，下一次受到的攻擊傷害減少 ${v}%` },
    starGuide: { name: '星辰導引', v: [8, 14], boss: true, fmt: (v) => `技能冷卻 −${v}%` },
    cometEcho: { name: '隕星回響', v: [15, 25], boss: true, fmt: (v) => `攻擊技能命中時有 ${v}% 機率追加一顆小隕石（該技能 40% 的火焰傷害）` },
  };
  D.SPECIAL_POOL = Object.keys(D.SPECIALS).filter((k) => !D.SPECIALS[k].boss);
  D.BOSS_SPECIALS = Object.keys(D.SPECIALS).filter((k) => D.SPECIALS[k].boss);
  D.SPECIAL_SCALES = { armorReflect: 1, blueThunder: 1, killShards: 1, killHeal: 1 }; // 平值隨等級成長

  // ---------- 傳奇寶物：固定名稱、固定特效，數值隨掉落等級成長 ----------
  // aff：固定的屬性種類（數值依裝備等級以神話品質擲出）；skill：固定技能；where：只在某章節掉落
  D.UNIQ_COLOR = '#e6c068';
  D.UNIQUES = {
    skullbreaker: { name: '碎顱者', base: 'hammer', aff: ['physDmg', 'str', 'hp'], skill: 'cleave', fx: '近戰普通攻擊有 25% 機率引發地震：震暈身旁敵人 1 秒，並造成 50% 傷害' },
    twinFang: { name: '雙生毒牙', base: 'dagger', aff: ['aspd', 'dex', 'physDmg'], skill: 'thrust', fx: '近戰普通攻擊連刺兩下，每下 60% 傷害' },
    frostheart: { name: '霜心法杖', base: 'staff', elem: 'cold', aff: ['coldDmg', 'int', 'mp'], skill: 'frost', fx: '所有攻擊技能都變成冰霜傷害，而且命中時全部附帶減速' },
    thunderBow: { name: '雷鳴長弓', base: 'bow', aff: ['lightDmg', 'dex', 'aspd'], skill: 'pierce', fx: '遠程普通攻擊有 20% 機率落雷，劈中目標附近最多 3 隻敵人（70% 雷電傷害）' },
    emberKing: { name: '燼王之劍', base: 'sword', aff: ['fireDmg', 'str', 'physDmg'], skill: 'whirl', fx: '擊殺敵人時屍體爆炸，燒傷身旁的其他敵人（威力隨裝備等級成長）' },
    starEater: { name: '吞星者', base: 'staff', elem: 'fire', aff: ['spellDmg', 'int', 'mpRegen'], skill: 'firewell', fx: '法術傷害 +40%，但每次施放技能扣 2% 生命' },
    unyielding: { name: '不屈鐵壁', base: 'mail', aff: ['hp', 'armor', 'resAll'], fx: '生命低於 30% 時，接下來 3 秒受到的傷害減半（30 秒最多一次）' },
    shadowstep: { name: '影步長靴', base: 'boots', aff: ['dodge', 'moveSpd', 'dex'], fx: '閃避成功後，下一個技能不耗魔' },
    lavaHeart: { name: '熔岩之心', base: 'gauntlets', aff: ['resFire', 'armor', 'hp'], fx: '踩到熔岩、火池不會受傷，反而回復生命' },
    sageHood: { name: '賢者兜帽', base: 'hood', aff: ['int', 'mpRegen', 'spellDmg'], fx: '技能冷卻 −20%（可以超過冷卻上限），但最大生命 −15%' },
    soulGrip: { name: '吸魂手套', base: 'wraps', aff: ['mp', 'int', 'manaCost'], fx: '每擊殺一隻敵人回復 3% 最大法力' },
    madCrown: { name: '狂人之冠', base: 'cap', aff: ['aspd', 'physDmg', 'dex'], fx: '生命越低傷害越高：每少 1% 生命，傷害 +0.5%（最多 +50%）' },
    twinRing: { name: '雙子之戒', base: 'ring', aff: ['skillDmg', 'cdr'], fx: '施放技能後有 20% 機率立刻重置這個技能的冷卻' },
    greedRing: { name: '貪婪之戒', base: 'ring', aff: ['hp', 'resAll'], fx: '出征中賣出裝備的金幣 +40%、小怪掉寶率 +15%，但你受到的傷害 +15%' },
    overseerRing: { name: '礦主之戒', base: 'ring', aff: ['physDmg', 'hp'], fx: '精英怪對你的傷害 −25%，擊殺精英怪時回滿法力' },
    mirrorShield: { name: '鏡面圓盾', base: 'shield', aff: ['armor', 'block', 'hp'], fx: '格擋時，把這次攻擊的全部傷害反彈給攻擊者' },
    prism: { name: '元素稜鏡', base: 'orb', aff: ['fireDmg', 'coldDmg', 'lightDmg'], fx: '輪流施放不同元素的技能，每次全抗性 +5%，最多疊 4 層（6 秒）' },
    endlessQuiver: { name: '無盡箭袋', base: 'quiver', aff: ['aspd', 'dex', 'manaOnHit'], fx: '遠程普通攻擊有 30% 機率多射一支箭（優先射另一個敵人）' },
    vampFang: { name: '吸血鬼之牙', base: 'amulet', aff: ['str', 'hp', 'hpRegen'], fx: '造成的所有傷害有 2% 回復為生命' },
    starfall: { name: '星隕護符', base: 'amulet', aff: ['int', 'spellDmg', 'mp'], where: 'observatory', fx: '每 10 秒從天上砸下一顆隕石，打在敵人最多的地方（火焰傷害，隨裝備等級成長）' },
  };

  // ---------- 怪物 ----------
  // onHitSlow：命中時讓角色減速；deathPool：死亡時留下毒沼；healAllies：命中時治療附近同伴；native：不受沼澤減速
  D.MONSTERS = {
    pickman: { name: '鎬工', hp: 18, dmg: 2, aspd: 1.0, speed: 3.2, armor: 0, range: 1, windup: 0.25, xp: 5, elem: 'phys' },
    beast: { name: '礦甲獸', hp: 32, dmg: 4, aspd: 0.6, speed: 1.6, armor: 25, range: 1, windup: 0.8, xp: 9, elem: 'phys', heavy: true },
    crossbow: { name: '碎石弩手', hp: 26, dmg: 5, aspd: 0.55, speed: 2.4, armor: 5, range: 5, keep: 4, windup: 0.6, xp: 8, elem: 'phys', ranged: true },
    priest: { name: '晶塵祭師', hp: 30, dmg: 5, aspd: 0.45, speed: 2.2, armor: 0, range: 5, keep: 4, windup: 0.7, xp: 10, elem: 'light', ranged: true, caster: true, drain: 6 },
    crawler: { name: '屍爬者', hp: 20, dmg: 2.2, aspd: 1.1, speed: 3.4, armor: 0, range: 1, windup: 0.25, xp: 6, elem: 'phys', native: true, onHitSlow: { p: 0.15, t: 1.5 } },
    bloater: { name: '腐沼巨口', hp: 40, dmg: 4, aspd: 0.55, speed: 1.4, armor: 15, range: 1, windup: 0.8, xp: 10, elem: 'phys', heavy: true, native: true, deathPool: { mul: 0.7, t: 4 } },
    bonearcher: { name: '骨弓手', hp: 24, dmg: 4.5, aspd: 0.6, speed: 2.4, armor: 5, range: 5, keep: 4, windup: 0.6, xp: 8, elem: 'phys', ranged: true, native: true, onHitSlow: { p: 0.2, t: 2 } },
    imp: { name: '火焰小鬼', hp: 16, dmg: 2.4, aspd: 1.2, speed: 3.8, armor: 0, range: 1, windup: 0.22, xp: 5, elem: 'fire', native: true },
    smith: { name: '熔爐鐵匠', hp: 42, dmg: 5, aspd: 0.55, speed: 1.6, armor: 35, range: 1, windup: 0.8, xp: 10, elem: 'fire', heavy: true, native: true },
    gunner: { name: '噴火砲手', hp: 26, dmg: 4.6, aspd: 0.55, speed: 2.2, armor: 10, range: 5, keep: 4, windup: 0.7, xp: 9, elem: 'fire', ranged: true, native: true },
    slag: { name: '熔渣怪', hp: 34, dmg: 3.5, aspd: 0.7, speed: 2.0, armor: 20, range: 1, windup: 0.5, xp: 9, elem: 'phys', native: true, deathPool: { mul: 0.8, t: 3, elem: 'fire' } },
    moth: { name: '星塵飛蛾', hp: 14, dmg: 2.1, aspd: 1.3, speed: 4.2, armor: 0, range: 1, windup: 0.2, xp: 5, elem: 'light', native: true },
    monk: { name: '觀星僧', hp: 26, dmg: 4.8, aspd: 0.5, speed: 2.2, armor: 5, range: 5, keep: 4, windup: 0.7, xp: 10, elem: 'cold', ranged: true, caster: true, native: true, onHitSlow: { p: 0.25, t: 1.5 } },
    ironGolem: { name: '隕鐵傀儡', hp: 52, dmg: 5.2, aspd: 0.5, speed: 1.3, armor: 45, range: 1, windup: 0.8, xp: 12, elem: 'phys', heavy: true, native: true },
    voidEye: { name: '虛空之眼', hp: 24, dmg: 4.4, aspd: 0.55, speed: 2.4, armor: 0, range: 5, keep: 4, windup: 0.6, xp: 9, elem: 'light', ranged: true, caster: true, native: true, drain: 8 },
    witch: { name: '吸魂巫', hp: 28, dmg: 4.5, aspd: 0.5, speed: 2.2, armor: 0, range: 5, keep: 4, windup: 0.7, xp: 10, elem: 'cold', ranged: true, caster: true, native: true, healAllies: 0.8 },
  };

  // ---------- 頭目 ----------
  D.BOSSES = {
    overseer: { name: '監工', hp: 1.0, armor: 20, speed: 1.6, dmg: 1.0, moves: ['charge', 'summon', 'stomp'], tell: '敲地蓄力，沿直線猛衝並召來鎬工' },
    golem: { name: '黑晶巨像', hp: 1.35, armor: 90, speed: 1.0, dmg: 1.2, moves: ['smash', 'smash', 'shardRing'], tell: '慢速大範圍重擊，擊後露出弱點' },
    parasite: { name: '晶脈寄生者', hp: 0.9, armor: 10, speed: 1.3, dmg: 0.9, ranged: true, moves: ['drain', 'bolts', 'shardRain'], tell: '晶光閃爍後釋放削魔脈衝' },
    mother: { name: '掘地母獸', hp: 1.15, armor: 30, speed: 1.2, dmg: 1.0, moves: ['brood', 'sweep', 'burrow'], tell: '持續產下幼獸並預告近身掃擊' },
    boneLord: { name: '腐骨領主', hp: 1.0, armor: 30, speed: 1.5, dmg: 1.0, moves: ['boneSpikes', 'raiseDead', 'stomp'], tell: '從地底掀起骨矛，喚醒屍爬者' },
    toad: { name: '沼澤巨蟾', hp: 1.25, armor: 20, speed: 1.2, dmg: 1.1, moves: ['leap', 'tongue', 'poisonRain'], tell: '躍起壓地，吐出毒雨' },
    banshee: { name: '吸魂女妖', hp: 0.9, armor: 5, speed: 1.4, dmg: 0.9, ranged: true, moves: ['wail', 'soulBolts', 'lifeDrain'], tell: '尖嘯讓人寸步難行，並吸取生命' },
    forgemaster: { name: '鍛爐大師', hp: 1.1, armor: 40, speed: 1.4, dmg: 1.1, moves: ['hammerLine', 'anvilRain', 'stomp'], tell: '巨鎚掀起熔岩，鐵砧從天而降' },
    slagWyrm: { name: '熔渣巨蠕', hp: 1.2, armor: 25, speed: 1.3, dmg: 1.0, moves: ['burrow', 'magmaRing', 'emberSpit'], tell: '鑽入熔岩突襲，噴出一圈熔渣' },
    ironColossus: { name: '鐵衛巨像', hp: 1.45, armor: 80, speed: 0.9, dmg: 1.2, moves: ['smash', 'furnaceBlast', 'summonImps'], tell: '胸口熔爐蓄熱後噴發，召來火焰小鬼' },
    starPriest: { name: '星語大祭司', hp: 0.95, armor: 10, speed: 1.3, dmg: 0.95, ranged: true, moves: ['constellation', 'starBolts', 'iceNova'], tell: '在地上畫出星座連線，連線處會爆炸' },
    meteorBeast: { name: '隕星巨獸', hp: 1.35, armor: 50, speed: 1.2, dmg: 1.15, moves: ['starCharge', 'meteorRain', 'smash'], tell: '呼喚隕石雨，並沿直線衝撞' },
    fallenAngel: { name: '墮星天使', hp: 1.05, armor: 20, speed: 1.5, dmg: 1.05, moves: ['gravity', 'starRing', 'frostLances'], tell: '把你吸到身邊再放冰晶新星（可以打斷），遠處則有星環' },
    corpseGolem: { name: '屍堆巨像', hp: 1.4, armor: 60, speed: 0.9, dmg: 1.2, moves: ['smash', 'corpseBlast', 'raiseDead'], tell: '重擊後屍堆爆裂成毒沼' },
  };
  // 招式資料：area 決定預告範圍形狀；其餘欄位是命中後的效果
  //   dash 沿直線衝刺｜line 從頭目射出直線｜around 以頭目為中心方形｜atHero 角色腳下方形｜ring 環形｜rain 多處落下｜none 無範圍
  D.BOSS_MOVES = {
    charge: { name: '猛衝', tele: 1.4, minDiff: 0, interruptible: true, area: 'dash', len: 7, dmg: 3, summon: ['pickman', 2] },
    summon: { name: '召喚鎬工', tele: 0.9, minDiff: 0, area: 'none', summon: ['pickman', 2] },
    stomp: { name: '震地鞭擊', tele: 1.2, minDiff: 1, interruptible: true, area: 'around', n: 5, dmg: 2 },
    smash: { name: '重擊', tele: 1.8, minDiff: 0, area: 'atHero', n: 3, nBig: 4, dmg: 3.5, weak: 3 },
    shardRing: { name: '晶刺環', tele: 1.3, minDiff: 1, area: 'ring', r0: 2, r1: 3.5, dmg: 2.2 },
    drain: { name: '削魔脈衝', tele: 1.5, minDiff: 0, interruptible: true, area: 'around', n: 10, dmg: 1.2, elem: 'light', mpDrain: 0.4, color: 'purple' },
    bolts: { name: '晶彈齊射', tele: 0.8, minDiff: 0, area: 'none', bolts: 3, dmg: 0.8, elem: 'light' },
    shardRain: { name: '晶雨', tele: 1.4, minDiff: 1, area: 'rain', count: 3, n: 2, dmg: 2 },
    brood: { name: '產卵', tele: 1.0, minDiff: 0, area: 'none', summon: ['pickman', 2, 3], brood: true },
    sweep: { name: '掃擊', tele: 1.5, minDiff: 0, interruptible: true, area: 'around', n: 6, dmg: 2.6 },
    burrow: { name: '鑽地突襲', tele: 1.6, minDiff: 1, area: 'atHero', n: 3, nBig: 4, dmg: 3, leap: true, hide: true },
    boneSpikes: { name: '骨矛突刺', tele: 1.4, minDiff: 0, interruptible: true, area: 'line', len: 8, width: 2, dmg: 2.0, slow: { p: 0.35, t: 2.5 }, color: 'green' },
    raiseDead: { name: '喚醒屍群', tele: 1.0, minDiff: 0, area: 'none', summon: ['crawler', 2, 3] },
    leap: { name: '躍擊', tele: 1.6, minDiff: 0, area: 'atHero', n: 3, nBig: 4, dmg: 2.8, leap: true, hide: true, color: 'green' },
    tongue: { name: '長舌鞭', tele: 1.0, minDiff: 0, interruptible: true, area: 'line', len: 7, width: 1, dmg: 1.6, slow: { p: 0.5, t: 2 }, color: 'green' },
    poisonRain: { name: '毒雨', tele: 1.4, minDiff: 1, area: 'rain', count: 4, n: 2, dmg: 1.2, pool: { mul: 0.5, t: 4 }, color: 'green' },
    wail: { name: '淒厲尖嘯', tele: 1.4, minDiff: 0, interruptible: true, area: 'around', n: 9, dmg: 1.0, elem: 'cold', slow: { p: 0.4, t: 3 }, color: 'teal' },
    soulBolts: { name: '魂彈', tele: 0.8, minDiff: 0, area: 'none', bolts: 4, dmg: 0.7, elem: 'cold' },
    lifeDrain: { name: '吸取生命', tele: 1.5, minDiff: 1, interruptible: true, area: 'around', n: 6, dmg: 1.5, elem: 'cold', heal: 0.08, color: 'teal' },
    hammerLine: { name: '熔岩鎚擊', tele: 1.4, minDiff: 0, interruptible: true, area: 'line', len: 7, width: 3, dmg: 2.2, elem: 'fire', pool: { mul: 0.5, t: 3, elem: 'fire' }, color: 'orange' },
    anvilRain: { name: '鐵砧落下', tele: 1.4, minDiff: 0, area: 'rain', count: 4, n: 2, dmg: 2.0, color: 'orange' },
    magmaRing: { name: '熔渣環', tele: 1.3, minDiff: 0, area: 'ring', r0: 1.5, r1: 3.5, dmg: 2.0, elem: 'fire', pool: { mul: 0.45, t: 3, elem: 'fire' }, color: 'orange' },
    emberSpit: { name: '熔渣噴吐', tele: 0.8, minDiff: 0, area: 'none', bolts: 4, dmg: 0.75, elem: 'fire' },
    furnaceBlast: { name: '熔爐噴發', tele: 1.6, minDiff: 0, interruptible: true, area: 'around', n: 7, dmg: 2.0, elem: 'fire', color: 'orange' },
    summonImps: { name: '召喚小鬼', tele: 0.9, minDiff: 0, area: 'none', summon: ['imp', 2, 3] },
    constellation: { name: '星座連線', tele: 1.6, minDiff: 0, area: 'lines', count: 3, len: 9, dmg: 2.2, elem: 'light', color: 'star' },
    starBolts: { name: '星彈', tele: 0.8, minDiff: 0, area: 'none', bolts: 4, dmg: 0.75, elem: 'light' },
    iceNova: { name: '冰晶新星', tele: 1.3, minDiff: 0, interruptible: true, area: 'around', n: 7, dmg: 1.9, elem: 'cold', slow: { p: 0.35, t: 2.5 }, color: 'teal' },
    meteorRain: { name: '隕石雨', tele: 1.5, minDiff: 0, area: 'rain', count: 5, n: 2, dmg: 2.0, elem: 'light', color: 'star' },
    starCharge: { name: '隕星衝撞', tele: 1.4, minDiff: 0, interruptible: true, area: 'dash', len: 7, dmg: 3, color: 'star' },
    gravity: { name: '引力場', tele: 1.2, minDiff: 0, area: 'none', pull: true, dmg: 0.8, elem: 'cold', next: 'iceNova' },
    starRing: { name: '星環', tele: 1.2, minDiff: 0, area: 'ring', r0: 2.5, r1: 4.5, dmg: 2.3, elem: 'cold', color: 'star' },
    frostLances: { name: '冰隕槍', tele: 0.8, minDiff: 0, area: 'none', bolts: 3, dmg: 0.9, elem: 'cold' },
    corpseBlast: { name: '屍堆爆裂', tele: 1.4, minDiff: 0, area: 'ring', r0: 1.5, r1: 3.5, dmg: 2.2, pool: { mul: 0.45, t: 4 }, color: 'green' },
  };
  D.TELE_COLOR = { red: '#ff3214', purple: '#b45aff', green: '#5adc32', teal: '#3cd2dc', orange: '#ff8a1e', star: '#8fb4ff' };

  // resPen：此難度扣你多少抗性；elite：每一波出現精英怪的機率；eliteAff：精英怪帶幾個詞綴
  D.DIFF = [
    { name: '普通', bossMinRarity: 1, rarityBoost: 0, resPen: 0, elite: 0.05, eliteAff: 1 },
    { name: '困難', bossMinRarity: 2, rarityBoost: 0.6, resPen: 15, elite: 0.09, eliteAff: 1 },
    { name: '惡夢', bossMinRarity: 3, rarityBoost: 1.2, resPen: 30, elite: 0.13, eliteAff: 2 },
  ];
  D.MAX_DIFF = 2 + 60; // 深淵 60 階
  // 難度 3 以上是深淵 1、2、3……每階怪物等級 +3
  D.diff = (d) => {
    if (d <= 2) return D.DIFF[Math.max(0, d)];
    const k = d - 2;
    return {
      name: `深淵 ${k}`, abyss: k, bossMinRarity: 3, rarityBoost: Math.min(2.6, 1.2 + 0.1 * k),
      resPen: Math.min(80, 30 + 5 * k), elite: Math.min(0.35, 0.13 + 0.02 * k), eliteAff: k >= 6 ? 3 : 2,
    };
  };
  D.baseLevel = (dg, d) => dg.lvl[Math.min(2, d)] + Math.max(0, d - 2) * 3;
  D.mixFor = (dg, d) => dg.mix[Math.min(2, d)];

  // ---------- 深淵規則：每趟隨機抽，規則越兇獎勵越多 ----------
  // loot：掉寶加成%（掉落機率、稀有度、傳奇寶物機率）；xp：經驗加成%
  D.ABYSS_MODS = {
    frenzy: { name: '狂暴', desc: '怪物移動與攻擊速度 +25%', loot: 25, xp: 15 },
    tough: { name: '堅韌', desc: '怪物生命 +40%', loot: 20, xp: 15 },
    eliteNest: { name: '精英巢穴', desc: '精英怪出現率加倍', loot: 20, xp: 10 },
    drought: { name: '枯竭', desc: '你的法力自然回復 −50%', loot: 20, xp: 10 },
    storm: { name: '元素風暴', desc: '一般怪物的攻擊都帶隨機元素（火、冰、雷）', loot: 15, xp: 10 },
    curse: { name: '詛咒', desc: '你的元素抗性再 −15%', loot: 25, xp: 15 },
    fireRain: { name: '火雨', desc: '你身邊每隔幾秒會冒出一片火池', loot: 20, xp: 10 },
    weakPots: { name: '藥效不彰', desc: '紅水、藍水的效果 −40%', loot: 20, xp: 10 },
    swarm: { name: '蜂群', desc: '每波怪物數量 +50%', loot: 25, xp: 20 },
    ironclad: { name: '鐵甲', desc: '怪物護甲加倍', loot: 15, xp: 10 },
    bloodthirst: { name: '嗜血', desc: '怪物打中你會回復自己的生命', loot: 15, xp: 10 },
    hasty: { name: '急躁頭目', desc: '頭目大招的預告時間縮短 30%', loot: 15, xp: 10 },
  };
  // 深淵 1～3：1 條；4～9：2 條；10 以上：3 條
  D.abyssModCount = (d) => (d < 3 ? 0 : d - 2 <= 3 ? 1 : d - 2 <= 9 ? 2 : 3);

  // ---------- 精英怪詞綴 ----------
  D.ELITE = {
    fire: { name: '烈焰', color: '#ff7a2e', elem: 'fire', desc: '攻擊帶火焰，死後留下火池' },
    cold: { name: '冰封', color: '#7fd8ff', elem: 'cold', desc: '攻擊帶冰霜，打中你會減速' },
    light: { name: '雷殛', color: '#ffe85c', elem: 'light', desc: '攻擊帶雷電，打中你會燒掉法力' },
    vamp: { name: '吸血', color: '#e0405e', desc: '打中你會回復自己的生命' },
    fast: { name: '迅捷', color: '#9aff8a', desc: '移動與攻擊都更快' },
    armored: { name: '鐵壁', color: '#c9d1db', desc: '護甲加倍，受到的傷害減少' },
    split: { name: '分裂', color: '#c49cff', desc: '死後分裂成兩隻小的' },
  };
  D.ELITE_ELEMS = ['fire', 'cold', 'light'];

  // ---------- 章節 ----------
  D.DUNGEON = {
    mine: {
      name: '黑晶礦坑', floors: 5, lvl: [1, 8, 16], theme: 'mine', rarityBonus: 0, swamp: 0,
      desc: '廢棄的黑晶礦脈。礦工早已變成別的東西。',
      mix: [
        [['pickman', 7], ['beast', 3]],
        [['pickman', 6], ['beast', 3], ['crossbow', 3]],
        [['pickman', 5], ['beast', 3], ['crossbow', 3], ['priest', 3]],
      ],
      bosses: ['overseer', 'golem', 'parasite', 'mother'],
      pool: { skills: ['rift', 'quake'], specials: ['armorReflect', 'blueThunder', 'killShards', 'armorPierce'] },
    },
    bog: {
      name: '骨沼墓渠', floors: 6, lvl: [6, 14, 22], theme: 'bog', rarityBonus: 0.25, swamp: 0.16,
      desc: '沉在屍水裡的古墓水道。沼澤會拖住你的腳步，死者不肯安息。',
      mix: [
        [['crawler', 6], ['bloater', 3], ['bonearcher', 2]],
        [['crawler', 6], ['bloater', 3], ['bonearcher', 3], ['witch', 2]],
        [['crawler', 5], ['bloater', 3], ['bonearcher', 3], ['witch', 3]],
      ],
      bosses: ['boneLord', 'toad', 'banshee', 'corpseGolem'],
      pool: { skills: ['boneSpear', 'plague'], specials: ['lifeLeech', 'killHeal', 'bogWalker', 'chillBane'] },
    },
    forge: {
      name: '熔鐵工坊', floors: 6, lvl: [12, 20, 28], theme: 'forge', rarityBonus: 0.4, swamp: 0, lava: 0.07,
      desc: '被遺棄的鍛造廠，熔爐仍在燃燒。腳下的熔岩會灼傷你，這裡的敵人大多帶著火焰。',
      mix: [
        [['imp', 6], ['slag', 3], ['smith', 2]],
        [['imp', 5], ['slag', 3], ['smith', 3], ['gunner', 2]],
        [['imp', 5], ['slag', 3], ['smith', 3], ['gunner', 3]],
      ],
      bosses: ['forgemaster', 'slagWyrm', 'ironColossus'],
      pool: { skills: ['meteor', 'moltenCleave'], specials: ['lavaWalker', 'fireLeech', 'forgeHeart'] },
    },
    observatory: {
      name: '星隕觀測所', floors: 7, lvl: [18, 26, 34], theme: 'observatory', rarityBonus: 0.55, swamp: 0, starfall: true, starlight: 0.025,
      desc: '崩塌的古代天文台。星隕不時落下，敵人多帶雷電與冰霜；站在星光裡回魔特別快。',
      mix: [
        [['moth', 6], ['ironGolem', 2], ['monk', 2]],
        [['moth', 5], ['ironGolem', 3], ['monk', 3], ['voidEye', 2]],
        [['moth', 5], ['ironGolem', 3], ['monk', 3], ['voidEye', 3]],
      ],
      bosses: ['starPriest', 'meteorBeast', 'fallenAngel'],
      pool: { skills: ['starBolt', 'iceComet'], specials: ['starShield', 'starGuide', 'cometEcho'] },
    },
  };
  D.DUNGEONS = [
    { id: 'mine', open: true },
    { id: 'bog', open: true },
    { id: 'forge', open: true },
    { id: 'observatory', open: true },
  ].map((d) => (D.DUNGEON[d.id] ? Object.assign({}, d, D.DUNGEON[d.id]) : d));
  D.DUNGEON_ORDER = ['mine', 'bog', 'forge', 'observatory'];
  // 舊程式相容
  D.MOB_MIX = D.DUNGEON.mine.mix;
  D.BOSS_SKILLS = D.DUNGEON.mine.pool.skills;
  D.BOSS_SPECIALS = D.DUNGEON.mine.pool.specials;

  // ---------- 經濟與節奏 ----------
  D.ECON = {
    potionPrice: 15,
    potionCarryMax: 10,
    packCosts: [150, 500, 1500], // 5→6→7→8
    stashBase: 30, stashStep: 10, stashMax: 100,
    stashCost: (n) => Math.round(100 * Math.pow(1.5, n)),
    starCost: (n) => Math.round(30 * Math.pow(1.045, n) + 4 * n),
    refundFee: (n) => Math.min(200, Math.round(10 * Math.pow(1.5, n))),
    respecCost: (lvl) => 20 + lvl * 5,
    waveInterval: 8,
    killTarget: (wave) => 12 + (wave - 1) * 3,
    xpToNext: (lvl) => Math.round(50 * Math.pow(lvl, 1.6)),
    // 比怪物高 5 級以上，每多 1 級經驗少 20%，最少 10%
    xpGap: (gap) => (gap <= 5 ? 1 : Math.max(0.1, 1 - 0.2 * (gap - 5))),
    // 技能耗魔隨技能來源裝備的等級上升
    manaIlvl: 0.035,
    // 傳奇寶物：每次掉落時改成傳奇寶物的機率（頭目最高、精英次之、小怪很低），難度越高越容易
    modRerollCost: (d, lvl) => Math.round(30 + 20 * Math.max(1, d - 2) + lvl * 3),
    uniqChance: (kind, d) => ({ boss: 0.03, elite: 0.008, mob: 0.002 }[kind] || 0) * (d <= 2 ? 1 + 0.3 * Math.max(0, d) : Math.min(3, 1.6 + 0.05 * (d - 2))),
    pointsPerLevel: 3,
    plusCap: [3, 4, 6, 8, 10, 12],
    plusMul: 0.08,
    enhanceCost: (it) => Math.round((20 + it.ilvl * 4) * Math.sqrt(D.RARITY[it.rarity].sell) * Math.pow(1.45, it.plus || 0)),
    rerollCost: (it, full) => Math.round((10 + it.ilvl * 2) * Math.sqrt(D.RARITY[it.rarity].sell) * Math.pow(1.3, it.rerolls || 0) * (full ? 2.5 : 1)),
  };

  // ---------- 星盤：中央、三大區、三個混合區，共 18 個星座 ----------
  // 每個星座：6 顆小星 → 中星（主題加成）→ 大星（改變玩法）。集滿一整個星座再得到中星一半的加成。
  D.STAR_KEYS = {
    bulwark: { name: '不動如山', desc: '護甲 +30%、格擋率 +10%，但移動速度 -10%。', tags: ['防禦'] },
    berserk: { name: '狂戰之魂', desc: '生命低於 50% 時，攻擊速度與所有傷害 +25%。', tags: ['物理', '速度'] },
    strLine: { name: '裂地之勢', desc: '力量系直線技能長度 +1（上限 6 格），該技能耗魔 +15%、冷卻 +10%。', tags: ['物理'] },
    dual2h: { name: '巨械雙持', desc: '副手可裝備雙手武器。第二把只計入 40% 基礎傷害，但完整提供技能與特殊能力。', excl: 'dual1h', tags: ['物理'] },
    dual1h: { name: '雙刃', desc: '副手可裝備單手武器。兩把交替出手，各自使用自己的攻擊數值。', excl: 'dual2h', tags: ['物理', '速度'] },
    piercer: { name: '穿雲', desc: '敏捷系直線技能長度 +1；單體遠程技能可穿過肉盾命中後排。該類技能耗魔 +15%。', tags: ['遠程'] },
    nimble: { name: '靈巧施法', desc: '所有技能冷卻 -15%、耗魔 -10%。', tags: ['速度', '法力'] },
    phantom: { name: '殘影', desc: '閃避率上限從 50% 提高到 60%；成功閃避後，下一次普通攻擊傷害加倍。', tags: ['防禦', '物理'] },
    arcaneSpread: { name: '奧術擴張', desc: '方形範圍技能邊長 +1（2×2→3×3、3×3→4×4，上限 16 格），耗魔 +30%、冷卻 +15%。', excl: 'steadyFlow', tags: ['元素'] },
    steadyFlow: { name: '穩流', desc: '技能傷害 -20%，但法力回復 +60%、技能耗魔 -15%。', excl: 'arcaneSpread', tags: ['法力'] },
    thunderLoop: { name: '雷霆迴路', desc: '雷電傷害 +20%；感電持續時間 +50%。', tags: ['雷電'] },
    frostfire: { name: '冰火同源', desc: '火焰技能命中時讓敵人減速 15%；冰霜技能命中時點燃敵人一層。', tags: ['火焰', '冰霜'] },
    bladeDance: { name: '劍舞', desc: '每第 4 次普通攻擊，額外橫掃身旁所有敵人（60% 傷害）。', tags: ['物理'] },
    lifeSteal: { name: '嗜血', desc: '普通攻擊造成傷害的 4% 回復為生命。', tags: ['防禦'] },
    elemArrows: { name: '元素箭矢', desc: '遠程普通攻擊額外造成 25% 雷電傷害，並有 30% 機率感電。', tags: ['遠程', '雷電'] },
    manaCircuit: { name: '秘法迴路', desc: '普通攻擊的回魔效果變為 3 倍。', tags: ['法力'] },
    brawnMagic: { name: '蠻力化法', desc: '力量帶來的傷害加成與物理傷害% 的一半「轉換」為法術傷害；被轉換的部分不再加到物理。', tags: ['元素'] },
    spellShield: { name: '法術護殼', desc: '施放攻擊技能時，得到等於法力消耗 1.5 倍的護盾（3 秒，上限 20% 生命）。', tags: ['防禦', '法力'] },
  };
  D.STAR_TAGS = ['物理', '火焰', '冰霜', '雷電', '元素', '遠程', '防禦', '速度', '法力'];
  const TAG_OF = {
    str: '物理', physDmg: '物理', fireDmg: '火焰', coldDmg: '冰霜', lightDmg: '雷電', elemDmg: '元素', spellDmg: '元素', int: '元素', skillDmg: '元素',
    rangedDmg: '遠程', dex: '遠程', armor: '防禦', armorPct: '防禦', block: '防禦', resAll: '防禦', hp: '防禦', hpPct: '防禦', hpRegen: '防禦', dodge: '防禦',
    aspd: '速度', moveSpd: '速度', cdr: '速度', mp: '法力', mpPct: '法力', mpRegen: '法力', manaOnHit: '法力', manaCost: '法力',
  };

  function buildStars() {
    const nodes = {};
    const consts = [];
    const add = (id, x, y, eff, extra) => (nodes[id] = Object.assign({ id, x, y, eff, links: [] }, extra || {}));
    const link = (a, b) => { nodes[a].links.push(b); nodes[b].links.push(a); };
    const pol = (r, deg) => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];

    // 中央：起點與六方向的門
    add('C0', 0, 0, {}, { start: true, kind: 'start' });
    const REG = {
      S: { ang: 150, gate: { str: 3 }, trunk: [{ str: 4 }, { hp: 20 }, { str: 5 }], color: '#ff8a5a', name: '力量' },
      D: { ang: 30, gate: { dex: 3 }, trunk: [{ dex: 4 }, { dodge: 15 }, { dex: 5 }], color: '#6fe08a', name: '敏捷' },
      I: { ang: 270, gate: { int: 3 }, trunk: [{ int: 4 }, { mp: 15 }, { int: 5 }], color: '#6ab0ff', name: '智慧' },
      SD: { ang: 90, gate: { hp: 15 }, trunk: [{ str: 3, dex: 3 }, { aspd: 5 }], color: '#f0c060', name: '鬥士', hybrid: true },
      DI: { ang: 330, gate: { mp: 12 }, trunk: [{ dex: 3, int: 3 }, { cdr: 3 }], color: '#7fe0d0', name: '遊俠術士', hybrid: true },
      IS: { ang: 210, gate: { resAll: 3 }, trunk: [{ int: 3, str: 3 }, { skillDmg: 5 }], color: '#c890ff', name: '戰鬥法師', hybrid: true },
    };
    const CONST = {
      S: [
        { id: 'S1', name: '鐵壁', small: [{ armor: 12 }, { block: 2 }, { hp: 18 }], notable: { name: '堅岩之心', armorPct: 20, block: 5 }, key: 'bulwark' },
        { id: 'S2', name: '狂戰', small: [{ aspd: 3 }, { physDmg: 5 }, { hp: 15 }], notable: { name: '血怒', physDmg: 12, aspd: 6 }, key: 'berserk' },
        { id: 'S3', name: '裂地', small: [{ physDmg: 5 }, { skillDmg: 4 }, { cdr: 2 }], notable: { name: '斷層', physDmg: 10, cdr: 4, skillDmg: 6 }, key: 'strLine' },
        { id: 'S4', name: '巨械', small: [{ physDmg: 6 }, { hpPct: 3 }, { str: 3 }], notable: { name: '千鈞', hpPct: 8, physDmg: 10 }, key: 'dual2h' },
      ],
      D: [
        { id: 'D1', name: '雙刃', small: [{ aspd: 3 }, { dodge: 12 }, { physDmg: 4 }], notable: { name: '迴旋舞', aspd: 10, dodge: 25 }, key: 'dual1h' },
        { id: 'D2', name: '鷹眼', small: [{ rangedDmg: 6 }, { dex: 3 }, { skillDmg: 3 }], notable: { name: '穿楊', rangedDmg: 15, skillDmg: 6 }, key: 'piercer' },
        { id: 'D3', name: '疾風', small: [{ moveSpd: 3 }, { cdr: 2 }, { aspd: 3 }], notable: { name: '乘風', moveSpd: 8, cdr: 6 }, key: 'nimble' },
        { id: 'D4', name: '幻影', small: [{ dodge: 14 }, { moveSpd: 2 }, { dex: 3 }], notable: { name: '霧行', dodge: 40, moveSpd: 4 }, key: 'phantom' },
      ],
      I: [
        { id: 'I1', name: '奧術', small: [{ spellDmg: 5 }, { mp: 10 }, { int: 3 }], notable: { name: '秘紋', spellDmg: 12, mp: 25 }, key: 'arcaneSpread' },
        { id: 'I2', name: '靜流', small: [{ mpRegen: 0.3 }, { mp: 12 }, { manaCost: 2 }], notable: { name: '深泉', mpRegen: 1, mpPct: 12 }, key: 'steadyFlow' },
        { id: 'I3', name: '雷霆', small: [{ lightDmg: 6 }, { int: 3 }, { cdr: 2 }], notable: { name: '雷心', lightDmg: 18 }, key: 'thunderLoop' },
        { id: 'I4', name: '冰火', small: [{ fireDmg: 6 }, { coldDmg: 6 }, { elemDmg: 3 }], notable: { name: '雙極', fireDmg: 12, coldDmg: 12 }, key: 'frostfire' },
      ],
      SD: [
        { id: 'SD1', name: '劍舞', small: [{ aspd: 3 }, { physDmg: 4 }, { dodge: 10 }], notable: { name: '刃風', aspd: 8, physDmg: 8 }, key: 'bladeDance' },
        { id: 'SD2', name: '嗜血', small: [{ hpRegen: 0.4 }, { hp: 15 }, { physDmg: 4 }], notable: { name: '血契', hpRegen: 1.5, hpPct: 6 }, key: 'lifeSteal' },
      ],
      DI: [
        { id: 'DI1', name: '元素箭', small: [{ rangedDmg: 5 }, { elemDmg: 4 }, { lightDmg: 4 }], notable: { name: '流星', rangedDmg: 10, elemDmg: 10 }, key: 'elemArrows' },
        { id: 'DI2', name: '秘法迴路', small: [{ manaOnHit: 0.3 }, { mpRegen: 0.25 }, { aspd: 2 }], notable: { name: '共鳴', manaOnHit: 1, mpRegen: 0.5 }, key: 'manaCircuit' },
      ],
      IS: [
        { id: 'IS1', name: '力化', small: [{ str: 3 }, { spellDmg: 4 }, { int: 3 }], notable: { name: '力法同源', str: 8, spellDmg: 8 }, key: 'brawnMagic' },
        { id: 'IS2', name: '晶殼', small: [{ mp: 12 }, { resAll: 3 }, { armor: 10 }], notable: { name: '晶殼', mp: 30, resAll: 6 }, key: 'spellShield' },
      ],
    };
    // 星座形狀（u：往外，v：側向），連線依 edges
    const SHAPES = [
      { p: [[0, 0], [1, 0.45], [2, 0], [3, -0.45], [4, 0], [5, 0.45]], n: [6, 0], k: [7.1, 0], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 'n']] },
      { p: [[0, 0], [1, 0.8], [2, 1.1], [1, -0.8], [2, -1.1], [3, 0]], n: [4, 0], k: [5.1, 0], e: [[0, 1], [1, 2], [2, 5], [0, 3], [3, 4], [4, 5], [5, 'n']] },
      { p: [[0, 0], [0.9, 0.6], [1.9, 0.9], [2.9, 0.6], [3.6, -0.2], [2.9, -0.9]], n: [4.6, 0.4], k: [5.7, 0.9], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 'n']] },
      { p: [[0, 0], [1, -0.3], [2, 0.2], [2.6, 1], [3, -0.6], [4, -0.2]], n: [5, 0.3], k: [6, -0.1], e: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 'n']] },
    ];
    const SP = 0.78;
    let shapeIdx = 0;
    for (const [rk, R] of Object.entries(REG)) {
      const [gx, gy] = pol(1.5, R.ang);
      add('C_' + rk, gx, gy, R.gate, { kind: 'small', region: rk });
      link('C0', 'C_' + rk);
      let prev = 'C_' + rk;
      R.trunk.forEach((e, i) => {
        const [tx, ty] = pol(2.5 + i * 1.0, R.ang);
        const id = `${rk}t${i + 1}`;
        add(id, tx, ty, e, { kind: 'small', region: rk });
        link(prev, id);
        prev = id;
      });
      const hub = prev;
      const list = CONST[rk];
      const spread = R.hybrid ? [-11, 11] : [-31, -10, 10, 31];
      const r0 = R.hybrid ? 5.4 : 5.9;
      list.forEach((c, ci) => {
        const ang = R.ang + spread[ci];
        const [ex, ey] = pol(r0, ang);
        const dir = [Math.cos((ang * Math.PI) / 180), Math.sin((ang * Math.PI) / 180)];
        const perp = [-dir[1], dir[0]];
        const sh = SHAPES[shapeIdx++ % SHAPES.length];
        const P = ([u, v]) => [ex + (u * dir[0] + v * perp[0]) * SP, ey + (u * dir[1] + v * perp[1]) * SP];
        const ids = [];
        sh.p.forEach((pt, i) => {
          const id = `${c.id}_${i + 1}`;
          const [x, y] = P(pt);
          add(id, x, y, Object.assign({}, c.small[i % c.small.length]), { kind: 'small', region: rk, cst: c.id });
          ids.push(id);
        });
        const nEff = Object.assign({}, c.notable);
        delete nEff.name;
        const [nx, ny] = P(sh.n);
        add(c.id + '_n', nx, ny, nEff, { kind: 'notable', region: rk, cst: c.id, name: c.notable.name });
        const [kx, ky] = P(sh.k);
        add(c.id + '_k', kx, ky, { key: c.key }, { kind: 'key', region: rk, cst: c.id });
        for (const [a, b] of sh.e) link(ids[a], b === 'n' ? c.id + '_n' : ids[b]);
        link(c.id + '_n', c.id + '_k');
        link(hub, ids[0]);
        const done = {};
        for (const [k, v] of Object.entries(nEff)) done[k] = Math.round(v * 5) / 10;
        consts.push({ id: c.id, name: c.name, region: rk, nodes: [...ids, c.id + '_n', c.id + '_k'], done, label: P([sh.n[0] * 0.5, sh.n[1] + 1.6]) });
      });
    }
    // 相鄰區域的門之間也相連，讓跨區配裝不用繞回中央
    const ring = ['S', 'SD', 'D', 'DI', 'I', 'IS'];
    for (let i = 0; i < ring.length; i++) link('C_' + ring[i], 'C_' + ring[(i + 1) % ring.length]);
    for (const n of Object.values(nodes)) {
      const tags = new Set();
      for (const k of Object.keys(n.eff)) if (TAG_OF[k]) tags.add(TAG_OF[k]);
      if (n.eff.key) for (const t of D.STAR_KEYS[n.eff.key].tags) tags.add(t);
      n.tags = [...tags];
    }
    D.CONSTELLATIONS = consts;
    D.REGIONS = REG;
    return nodes;
  }
  D.STAR_KEYS_LIST = Object.keys(D.STAR_KEYS);
  D.STARS = buildStars();
  D.STAT_NAME = Object.assign({}, Object.fromEntries(Object.entries(D.AFFIX).map(([k, v]) => [k, v.name])), {
    hpPct: '最大生命%', elemDmg: '元素傷害', rangedDmg: '遠程傷害', armorPct: '護甲%', mpPct: '最大法力%',
  });
})(typeof window !== 'undefined' ? window : globalThis);
