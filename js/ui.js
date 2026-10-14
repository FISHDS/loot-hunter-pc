// 介面：營地分頁、地城操作列、樓層整理背包（拖曳）、報告與提示。
(function (root) {
  const LH = root.LH;
  const { U, D, Items, Char, Game, Pack, Spr, Sim } = LH;

  const $ = (id) => document.getElementById(id);
  // 傷害數字顯示：全部 → 只看技能 → 關閉
  const DMG_NAME = { all: '全部', big: '只看技能', off: '關閉' };
  const DMG_NEXT = { all: 'big', big: 'off', off: 'all' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const UI = {
    G: null, screen: 'title', tab: 'expedition', sel: null, gearFilter: 'all', gearSort: 'rarity', starSel: null,
    recOpen: new Set(), lootSel: null, drag: null, onSave: null, lastReportShown: null,
    pick: new Set(), pickMode: false, starZoom: 1, starPan: [0, 0],
  };

  // ---------- 共用片段 ----------
  function sfx(n, o) { LH.Sfx && LH.Sfx.play(n, o); }
  function save() { UI.onSave && UI.onSave(); }

  function shapeText(shape) {
    if (shape.t === 'line') return `直線 1×${shape.len}`;
    if (shape.t === 'self') return `以自己為中心 ${shape.n}×${shape.n}`;
    if (shape.t === 'area') return `射程 ${shape.range} 內 ${shape.n}×${shape.n}`;
    if (shape.t === 'single') return shape.range <= 1 ? '近身單體' : `射程 ${shape.range} 單體${shape.los === false ? '（可穿過肉盾）' : ''}`;
    return '自身增益';
  }

  function skillIcon(id, opts) {
    opts = opts || {};
    if (!id) return `<div class="si empty"></div>`;
    const s = D.SKILLS[id];
    const cls = ['si', 'e-' + s.elem];
    if (s.cat === 'def') cls.push('def');
    if (s.boss) cls.push('boss-sk');
    return `<div class="${cls.join(' ')}" ${opts.attrs || ''} title="${s.name}"><img class="sico" src="${Spr.skillIconURL(id, 2)}" alt="${s.name}">${opts.inner || ''}</div>`;
  }

  function itemCard(it, extra) {
    const up = extra && extra.includes('chk-up') && !it.potion && isUpgrade(it);
    const picked = extra && extra.includes('chk-up') && UI.pick.has(it.id);
    return `<div class="item r${it.potion ? 0 : it.rarity} ${it.uniq ? 'uq' : ''} ${extra || ''} ${up ? 'up' : ''} ${picked ? 'picked' : ''} ${UI.sel === it.id || UI.lootSel === it.id ? 'sel' : ''}" data-item="${it.id}">
      <img src="${Spr.iconURL(it)}">${it.potion ? '' : `<span class="il">L${it.ilvl}</span>`}${it.plus ? `<span class="plus">+${it.plus}</span>` : ''}
      ${it.fav ? '<span class="fav">★</span>' : ''}${it.skill ? '<span class="sk"></span>' : ''}${it.special ? '<span class="sp"></span>' : ''}</div>`;
  }

  const upCache = new Map();
  function isUpgrade(it) {
    if (upCache.has(it.id)) return upCache.get(it.id);
    const p = Char.previewWith(UI.G, it);
    const v = !!(p && p.sc > 3.03);
    upCache.set(it.id, v);
    return v;
  }

  function pct(a, b) {
    if (!b) return '<span class="same">—</span>';
    const d = ((a - b) / b) * 100;
    if (Math.abs(d) < 0.5) return '<span class="same">±0%</span>';
    return d > 0 ? `<span class="up">▲${d.toFixed(0)}%</span>` : `<span class="down">▼${(-d).toFixed(0)}%</span>`;
  }

  function itemTip(it, opts) {
    opts = opts || {};
    if (it.potion) {
      return `<div class="tip"><div class="tip-name">${it.potion === 'red' ? '<span style="color:#ff6a5a">紅水</span>' : '<span style="color:#7fb0ff">藍水</span>'}</div>
        <div class="tip-sec tip-base">${it.potion === 'red' ? '4 秒內回復 45% 生命' : '3 秒內回復 50% 法力'}，依營地門檻自動飲用。占背包一格，可以丟棄騰出空間（不退金幣）。</div></div>`;
    }
    if (it.rev === false) {
      return `<div class="tip"><div class="tip-name ${it.uniq ? 'cu' : 'c' + it.rarity}">${it.uniq ? '傳奇寶物' : D.RARITY[it.rarity].name}・？？？</div><div class="tip-sub">清完這一層後才能看到完整能力</div></div>`;
    }
    const R = D.RARITY[it.rarity];
    const b = D.BASES[it.base];
    let h = `<div class="tip"><div class="tip-name ${it.uniq ? 'cu' : 'c' + it.rarity}">${esc(Items.displayName(it))}</div>
      <div class="tip-sub">${it.uniq ? '<span class="cu">傳奇寶物</span>・' : R.name}${D.SLOT_NAME[it.slot]}・${b.name}${b.cls ? `・<span style="color:${D.ARMOR_CLS[b.cls].color}">${D.ARMOR_CLS[b.cls].name}</span>` : ''}｜裝備等級 ${it.ilvl}${it.exclusive ? '｜<span style="color:#b46cff">頭目專屬</span>' : ''}</div>`;
    const bl = Items.baseLines(it);
    if (bl.length) h += `<div class="tip-sec tip-base">${bl.join('<br>')}</div>`;
    const al = Items.affixLines(it);
    if (al.length) h += `<div class="tip-sec tip-aff">${al.join('<br>')}</div>`;
    if (it.uniq && D.UNIQUES[it.uniq]) h += `<div class="tip-sec tip-uq"><b>傳奇特效</b><br>${D.UNIQUES[it.uniq].fx}</div>`;
    if (it.skill) {
      const s = D.SKILLS[it.skill];
      h += `<div class="tip-sec tip-skill"><div class="sk-name">技能：${s.name}</div>
        <div class="sk-meta">${D.ATTR[s.attr]}・${D.ELEM[s.elem]}｜${shapeText(s.shape)}｜法力 ${s.mana}｜冷卻 ${s.cd} 秒</div>
        <div>${s.desc}</div><div class="sk-meta">威力 ${Math.round(Char.skillPower(it) * (s.coef || 0))}（隨裝備等級提高）</div></div>`;
    }
    if (it.special) {
      const sp = D.SPECIALS[it.special.k];
      h += `<div class="tip-sec tip-spec"><b>特殊能力：${sp.name}</b><br>${sp.fmt(it.special.v)}</div>`;
    }
    if (opts.compare !== false && !opts.equipped) {
      const p = Char.previewWith(UI.G, it);
      if (p) {
        const cur = UI.G.gear[p.slot];
        h += `<div class="tip-sec"><div class="sk-meta" style="color:var(--muted);font-size:12px">換上後（${D.SLOT_NAME[p.slot]}${cur ? `，取代 ${esc(cur.name)}` : '，目前空著'}）的估算變化：</div>
          <div class="tip-cmp"><div><small>打單一強敵</small>${pct(p.ev.single, p.cur.single)}</div><div><small>清怪群</small>${pct(p.ev.clear, p.cur.clear)}</div><div><small>生存</small>${pct(p.ev.surv, p.cur.surv)}</div></div>
          ${it.special ? '<div class="sk-meta" style="font-size:11px;color:var(--dim);margin-top:3px">條件式特殊能力不完全算進分數，請看文字判斷。</div>' : ''}</div>`;
      }
    }
    if (opts.equipped) h += `<div class="tip-sec sk-meta" style="color:var(--gold)">目前穿戴中</div>`;
    h += `<div class="tip-sell">售價 ${Items.sellValue(it)} 金</div></div>`;
    return h;
  }

  function findAnyItem(id) {
    const G = UI.G;
    const f = Game.findItem(G, id);
    if (f) return { it: f.it, where: f.where };
    if (G.run) {
      const l = Game.lootFind(G.run, id);
      if (l) return { it: l.it, where: 'loot' };
    }
    return null;
  }

  // ---------- 浮動說明 ----------
  function initTips() {
    const tip = $('tip');
    document.addEventListener('mousemove', (e) => {
      if (UI.drag) { tip.style.display = 'none'; return; }
      const el = e.target.closest && e.target.closest('[data-item],[data-tipskill],[data-tipstar]');
      if (!el) { tip.style.display = 'none'; return; }
      let html = '', r = '';
      if (el.dataset.item) {
        const f = findAnyItem(el.dataset.item);
        if (!f) { tip.style.display = 'none'; return; }
        html = itemTip(f.it, { equipped: D.SLOTS.includes(f.where) });
        r = f.it.potion ? '' : f.it.uniq ? 'ru' : 'r' + f.it.rarity;
      } else if (el.dataset.tipskill) {
        html = skillTip(el.dataset.tipskill);
      } else if (el.dataset.tipstar) {
        html = starTip(el.dataset.tipstar);
      }
      tip.className = 'tip-float ' + r;
      tip.innerHTML = html;
      tip.style.display = 'block';
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let x = e.clientX + 18, y = e.clientY + 14;
      if (x + w > innerWidth - 8) x = e.clientX - w - 18;
      if (y + h > innerHeight - 8) y = innerHeight - h - 8;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    });
  }

  function skillTip(id) {
    const G = UI.G;
    const cs = G.run ? G.run.cs : Char.compute(G);
    const sk = cs.skills.find((s) => s.id === id);
    const s = D.SKILLS[id];
    if (!sk) return '';
    return `<div class="tip"><div class="tip-name" style="color:${D.ELEM_COLOR[s.elem]}">${s.name}</div>
      <div class="tip-sub">${D.ATTR[s.attr]}・${D.ELEM[s.elem]}｜來自${D.SLOT_NAME[sk.slot]}${sk.dup > 1 ? `（${sk.dup} 件同名，第二件小幅加強）` : ''}</div>
      <div class="tip-sec">${s.desc}</div>
      <div class="tip-sec sk-meta">${shapeText(sk.shape)}｜法力 ${sk.mana}｜冷卻 ${sk.cd.toFixed(1)} 秒${sk.dmg ? `｜傷害約 ${Math.round(sk.dmg)}` : ''}</div></div>`;
  }

  // ---------- 提示訊息 ----------
  function toast(text, kind) {
    const box = $('toasts');
    if (!box || UI.screen !== 'dungeon') return;
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.textContent = text;
    box.appendChild(d);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => d.remove(), 2900);
  }
  function toastAny(text) {
    if (UI.screen === 'dungeon') return toast(text, 'warn');
    alert(text);
  }
  function hint(key, text) {
    const G = UI.G;
    if (G.hints[key]) return;
    G.hints[key] = true;
    toast('提示：' + text, 'hint');
  }

  // ---------- 畫面切換 ----------
  function show(name) {
    UI.screen = name;
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === name);
    if (name === 'camp') renderCamp();
    if (name === 'dungeon') { buildHud(); fitStage(); }
    $('tip').style.display = 'none';
  }

  const ZOOMS = [1, 1.2, 1.5, 2];
  function setZoom(z) {
    LH.Render.setZoom(z);
    if (UI.G) UI.G.settings.zoom = z;
  }
  function fitStage() {
    const wrap = document.querySelector('.stage-wrap');
    const st = $('stage');
    if (!wrap || !st) return;
    const ar = LH.Render.W / LH.Render.H;
    let w = wrap.clientWidth - 20, h = wrap.clientHeight - 12;
    if (w / h > ar) w = h * ar; else h = w / ar;
    st.style.width = Math.floor(w) + 'px';
    st.style.height = Math.floor(h) + 'px';
  }

  // ---------- 營地 ----------
  function renderTop() {
    const G = UI.G;
    $('t-gold').textContent = U.fmt(G.gold);
    $('t-level').textContent = G.hero.level;
    const need = D.ECON.xpToNext(G.hero.level);
    $('t-xp').style.width = (G.hero.xp / need) * 100 + '%';
    $('t-xptext').textContent = `${Math.floor(G.hero.xp)} / ${need}`;
    const VN = ['關', '小', '中', '大'];
    $('btn-sound').textContent = '音效：' + VN[G.settings.sfxVol];
    $('btn-music').textContent = '音樂：' + VN[G.settings.musicVol];
    $('btn-dmgnum').textContent = '數字：' + DMG_NAME[G.settings.dmgNum || 'all'];
    const tabs = $('tabs');
    tabs.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.tab === UI.tab);
      const old = b.querySelector('.badge');
      if (old) old.remove();
      if (b.dataset.tab === 'stars' && G.hero.unspent > 0) b.insertAdjacentHTML('beforeend', `<span class="badge">${G.hero.unspent}</span>`);
    });
  }

  function renderHeroSummary() {
    const G = UI.G;
    const cs = Char.compute(G);
    const ev = Char.evaluate(cs);
    $('hero-summary').innerHTML = `<div class="panel hs-card">
      <div class="hs-name">獵寶者 <small style="color:var(--muted);font-size:13px">Lv.${G.hero.level}</small></div>
      <div class="hs-line">力量／敏捷／智慧<b>${G.hero.attrs.str}／${G.hero.attrs.dex}／${G.hero.attrs.int}</b></div>
      <div class="hs-line">生命<b>${cs.maxHp}</b></div>
      <div class="hs-line">法力<b>${cs.maxMp}（每秒 +${cs.mpRegen.toFixed(1)}）</b></div>
      <div class="hs-line">技能<b>${cs.skills.map((s) => s.name).join('、') || '無'}</b></div>
      <div class="hs-line">盔甲<b>${cs.armorSet ? `<span style="color:${D.ARMOR_CLS[cs.armorSet].color}">${D.ARMOR_CLS[cs.armorSet].name}套裝</span>` : Object.entries(cs.armorCls).map(([k, n]) => D.ARMOR_CLS[k].name + n).join('・') || '無'}</b></div>
      <div class="hs-line">藥水庫存<b><span style="color:#ff6a5a">紅 ${G.potions.red}</span>　<span style="color:#7fb0ff">藍 ${G.potions.blue}</span></b></div>
      <div class="est3"><div><small>單體</small><b>${Math.round(ev.single)}</b></div><div><small>清群</small><b>${Math.round(ev.clear)}</b></div><div><small>生存</small><b>${Math.round(ev.surv)}</b></div></div>
      ${G.hero.unspent > 0 ? `<span class="pts-badge" data-act="tab" data-v="stars">有 ${G.hero.unspent} 點三圍可以分配</span>` : ''}
    </div>`;
  }

  function renderCamp() {
    renderTop();
    renderHeroSummary();
    const body = $('tab-body');
    const st = body.scrollTop;
    body.innerHTML = TABS[UI.tab]();
    body.scrollTop = st;
    if (UI.tab === 'stars') drawStarmap();
  }

  // 風險估計：角色估算戰力 vs 怪物壓力
  function riskLevel(G, wave, diff, dungeon) {
    const cs = Char.compute(G);
    const ev = Char.evaluate(cs);
    const hero = Math.sqrt(((ev.single + ev.clear) / 2) * ev.surv);
    const L = D.baseLevel(D.DUNGEON[dungeon] || D.DUNGEON.mine, Math.max(0, diff)) + 2;
    const threat = Math.pow(wave, 0.8) * Math.pow(1.17 * 1.12, L - 1) * 20;
    const r = hero / threat;
    const k = r >= 2 ? 0 : r >= 1.3 ? 1 : r >= 0.9 ? 2 : r >= 0.6 ? 3 : 4;
    return { k, label: ['安全', '穩健', '有風險', '危險', '極度危險'][k] };
  }

  const TABS = {};
  TABS.expedition = () => {
    const G = UI.G, e = G.exp;
    const un = (id) => (G.unlocked[id] ?? -1);
    if (un(e.dungeon) < 0) e.dungeon = 'mine';
    const maxD = un(e.dungeon);
    const curD = Math.min(e.diff, maxD);
    const dInfo = D.diff(curD);
    const risk = riskLevel(G, e.wave, curD, e.dungeon);
    const gapTop = G.hero.level - (D.baseLevel(D.DUNGEON[e.dungeon], curD) + D.DUNGEON[e.dungeon].floors - 1);
    const xpWarn = D.ECON.xpGap(gapTop) < 1 ? `<br><span style="color:#ffb070">你比這裡最深層的怪物高 ${gapTop} 級，經驗只剩 ${Math.round(D.ECON.xpGap(gapTop) * 100)}%。往更高難度挑戰吧。</span>` : '';
    const last = G.records[0];
    const cards = D.DUNGEONS.map((d, i) => {
      const open = d.open && un(d.id) >= 0;
      const prev = D.DUNGEONS[i - 1];
      const lockTxt = !d.open ? '製作中' : `通關「${prev ? prev.name : ''}」普通後開放`;
      return `<div class="dcard theme-${d.id} ${open ? (e.dungeon === d.id ? 'on' : '') : 'lock'}" ${open ? `data-act="dungeon" data-v="${d.id}"` : ''}>
      <div class="dbg"></div><div class="dname">${d.name}</div><div class="ddesc">${open ? d.desc : lockTxt}</div>
      <div class="dfl">${d.floors} 層${open && d.lvl ? `・Lv ${d.lvl[0]}～${d.lvl[2] + d.floors - 1}${un(d.id) >= 3 ? `・深淵 ${un(d.id) - 2}` : ''}` : ''}</div></div>`;
    }).join('');
    const pot = (k) => {
      const want = Math.min(D.ECON.potionCarryMax, e[k]);
      return `<div class="pot-row"><img class="pot-ico" src="${Spr.iconURL({ potion: k }, 2)}">
        <div>${k === 'red' ? '紅水' : '藍水'}<br><small style="color:var(--muted)">庫存 ${G.potions[k]}</small></div>
        <div class="stepper"><span style="color:var(--muted);font-size:12px">每趟帶</span><button class="btn small" data-act="carry" data-k="${k}" data-v="-1">−</button><b>${want}</b><button class="btn small" data-act="carry" data-k="${k}" data-v="1">＋</button></div>
        <div><button class="btn small" data-act="buyPot" data-k="${k}" data-n="1" ${G.gold < 15 ? 'disabled' : ''}>買 1（15 金）</button>
        <button class="btn small" data-act="buyPot" data-k="${k}" data-n="5" ${G.gold < 75 ? 'disabled' : ''}>買 5</button></div></div>`;
    };
    const I = G.idle;
    const idleCard = e.mode === 'idle' ? `<div class="idle-card">掛機循環：成功一趟後自動再出發。倒下時每波怪數自動降 1；連續成功 3 趟會往上限回升 1。
      ${I.cur != null ? `<br>目前每波 <b>${I.cur}</b> 隻（上限 ${e.wave}），連續成功 <b>${I.streak}</b>/3` : ''}
      ${I.stopped ? '<br><span style="color:#ff9a8a">上次掛機在每波 1 隻仍倒下而停止，請調整配裝或藥水後再出發。</span>' : ''}</div>` : '';
    let lastHtml = '還沒有出征紀錄。第一趟建議每波 1 隻，清完第一層後就可以考慮撤退，把裝備安全帶回來。';
    if (last) {
      lastHtml = `上一趟：<b class="rec-how ${last.how}">${{ victory: '勝利', retreat: '撤退', death: '倒下' }[last.how]}</b>，到達第 ${last.floor} 層，帶回 ${last.brought.length} 件、賣得 ${last.gold} 金、經驗 +${last.xp}`;
      if (last.cause) lastHtml += `<br><span style="color:#ff9a8a">倒下原因：${last.cause.main}${last.cause.notes.length ? '（' + last.cause.notes.join('、') + '）' : ''}</span>`;
    }
    return `<div class="dungeon-row">${cards}</div>
    <div class="exp-grid">
      <div class="panel"><h3>出征設定</h3><div class="pbody">
        <div class="field"><label>難度（${D.DUNGEON[e.dungeon].name}）</label><div class="seg">${D.DIFF.map((d, i) => `<button data-act="diff" data-v="${i}" class="${Math.min(e.diff, maxD) === i ? 'on' : ''}" ${i > maxD ? 'disabled title="通關前一難度後解鎖"' : ''}>${d.name}${i > maxD ? ' 🔒' : ''}</button>`).join('')}
          <button data-act="diff" data-v="${Math.max(3, Math.min(e.diff, maxD))}" class="abyss ${curD >= 3 ? 'on' : ''}" ${maxD < 3 ? 'disabled title="通關惡夢後解鎖"' : ''}>深淵${maxD < 3 ? ' 🔒' : ''}</button></div>
          ${curD >= 3 ? modsBox(G) : ''}
          ${curD >= 3 ? `<div class="abyss-row"><button class="btn small" data-act="abyss" data-v="-1" ${curD <= 3 ? 'disabled' : ''}>−</button><b>深淵 ${curD - 2}</b><button class="btn small" data-act="abyss" data-v="1" ${curD >= maxD ? 'disabled' : ''}>＋</button><span class="note">已開放到深淵 ${maxD - 2}</span></div>` : ''}
          <div class="note" style="margin-top:6px">怪物等級 ${D.baseLevel(D.DUNGEON[e.dungeon], curD)}～${D.baseLevel(D.DUNGEON[e.dungeon], curD) + D.DUNGEON[e.dungeon].floors - 1}，共 ${D.DUNGEON[e.dungeon].floors} 層。${dInfo.resPen ? `<br>此難度你的<b style="color:#ff9a6a">元素抗性 −${dInfo.resPen}%</b>（抗性可以扣到負的，負抗性會多吃傷害）。` : ''}精英怪出現率 ${Math.round(dInfo.elite * 100)}%／波。${xpWarn}</div>
          ${maxD >= 2 ? `<label class="check" style="margin-top:6px"><input type="checkbox" id="push-chk" ${e.push ? 'checked' : ''}> 掛機時自動挑戰更高的深淵（連勝 2 趟往上一階，倒下退回一階）</label>` : ''}</div>
        <div class="field"><label>每波怪數（地城中不能改）</label>
          <div class="wave-row"><input type="range" min="1" max="20" value="${e.wave}" id="wave-range"><span class="wave-num" id="wave-num">${e.wave}</span><span class="risk k${risk.k}" id="wave-risk">${risk.label}</span></div>
          <div class="note" style="margin-top:6px">每 8 秒來一波，上一波沒打完也會來。怪越多，打得完的配裝每小時收益越高；同一趟掉的裝備件數大致相同。</div></div>
        <div class="field"><label>模式（地城中也可以切換）</label><div class="seg"><button data-act="expmode" data-v="active" class="${e.mode === 'active' ? 'on' : ''}">主動</button><button data-act="expmode" data-v="idle" class="${e.mode === 'idle' ? 'on' : ''}">掛機</button></div>
          <div class="note" style="margin-top:6px">${e.mode === 'active' ? '主動：每層清完會停下讓你整理背包，你也可以親手點技能抓時機。' : '掛機：自動整理背包、依血量決定撤退，成功後自動再出發。'}</div></div>
        <div class="field"><label>遊戲速度</label><div class="seg">${[1, 2, 3, 4].map((s) => `<button data-act="expspeed" data-v="${s}" class="${e.speed === s ? 'on' : ''}">${s}×</button>`).join('')}</div></div>
      </div></div>
      <div class="panel"><h3>藥水與背包<small>背包 ${G.packSize}×${G.packSize}，每瓶藥水占一格</small></h3><div class="pbody">
        ${pot('red')}${pot('blue')}
        <label class="check" style="margin-top:10px"><input type="checkbox" id="autobuy" ${e.autoBuy ? 'checked' : ''}> 出發時庫存不足就自動用金幣補到攜帶數量</label>
        <div class="note" style="margin-top:10px">紅水在生命低於 ${Math.round(G.autocast.red * 100)}% 時自動喝，藍水在法力低於 ${Math.round(G.autocast.blue * 100)}% 時自動喝（可在「掛機設定」修改）。沒喝完的會帶回營地。</div>
        <div class="lastrun" style="margin-top:12px">${lastHtml}</div>
        ${idleCard}
      </div></div>
    </div>
    <div class="go-row"><div class="note">死亡只會失去「這一趟還沒賣掉的裝備」。出發前的裝備、經驗、已經賣掉換到的金幣都會保留。</div>
      <button class="btn gold big" data-act="go">出 征</button></div>`;
  };

  // 深淵規則卡
  function modsBox(G) {
    const M = Game.abyssMods(G);
    if (!M) return '';
    return `<div class="mods-box"><div class="mods-head">本趟深淵規則</div>
      ${M.list.map((k) => `<div class="mod-row"><b>⚠ ${D.ABYSS_MODS[k].name}</b>：${D.ABYSS_MODS[k].desc}</div>`).join('')}
      <div class="mods-foot"><span class="mods-rew">獎勵：掉寶 <b>+${M.loot}%</b>　經驗 <b>+${M.xp}%</b></span>
        <button class="btn small" data-act="rerollMods" ${G.gold < M.cost ? 'disabled' : ''}>重抽規則・${M.cost} 金</button></div></div>`;
  }

  // ---------- 裝備與倉庫 ----------
  const DOLL = {
    head: [6, 0], body: [6, 84], hands: [6, 168], feet: [6, 252], weapon: [202, 0], offhand: [202, 84], amulet: [202, 168], ring: [202, 252],
  };
  // 盔甲類別與套裝狀態（一行文字）
  function armorSetText(cs) {
    const parts = Object.entries(D.ARMOR_CLS).filter(([k]) => cs.armorCls[k]).map(([k, c]) => `<span style="color:${c.color}">${c.name} ${cs.armorCls[k]}</span>`);
    if (!parts.length) return '<span style="color:var(--dim)">尚未穿戴盔甲</span>';
    const set = cs.armorSet ? `<div class="set-on">套裝：${D.ARMOR_CLS[cs.armorSet].name}・${D.ARMOR_CLS[cs.armorSet].set}</div>` : '<div class="set-off">頭、身、手、腳同一類可得套裝加成</div>';
    return parts.join('・') + set;
  }
  TABS.gear = () => {
    const G = UI.G;
    upCache.clear();
    const doll = D.SLOTS.map((sl) => {
      const it = G.gear[sl];
      const [l, t] = DOLL[sl];
      return `<div class="slot" style="left:${l}px;top:${t}px">${it ? itemCard(it) : ''}<span class="lbl">${D.SLOT_NAME[sl]}</span></div>`;
    }).join('');
    const filters = [['all', '全部'], ['uniq', '傳奇寶物'], ['weapon', '武器'], ['armor', '防具'], ['heavy', '重甲'], ['light', '輕甲'], ['cloth', '布甲'], ['jewel', '飾品戒指'], ['offhand', '副手'], ['skill', '有技能']];
    let list = G.stash.slice();
    const f = UI.gearFilter;
    if (f === 'uniq') list = list.filter((i) => i.uniq);
    if (f === 'weapon') list = list.filter((i) => i.slot === 'weapon');
    if (f === 'armor') list = list.filter((i) => ['head', 'body', 'hands', 'feet'].includes(i.slot));
    if (D.ARMOR_CLS[f]) list = list.filter((i) => D.BASES[i.base].cls === f);
    if (f === 'jewel') list = list.filter((i) => ['ring', 'amulet'].includes(i.slot));
    if (f === 'offhand') list = list.filter((i) => i.slot === 'offhand');
    if (f === 'skill') list = list.filter((i) => i.skill || i.special);
    if (UI.gearSort === 'rarity') list.sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl);
    if (UI.gearSort === 'ilvl') list.sort((a, b) => b.ilvl - a.ilvl || b.rarity - a.rarity);
    if (UI.gearSort === 'slot') list.sort((a, b) => D.SLOTS.indexOf(a.slot) - D.SLOTS.indexOf(b.slot) || b.rarity - a.rarity);
    const sc = Game.stashCost(G), pc = Game.packCost(G);
    const loadouts = G.loadouts.map((L, i) => `<div class="lo-row"><span>${L ? esc(L.name) : `配裝 ${i + 1}（空）`}</span>
      <button class="btn small" data-act="loSave" data-i="${i}">儲存目前</button><button class="btn small" data-act="loLoad" data-i="${i}" ${L ? '' : 'disabled'}>套用</button></div>`).join('');
    let detail = '<div class="note" style="padding:20px">點選一件裝備查看完整能力與比較。<br><br>綠色 ▲ 代表依目前配裝估算會變強。<br>★ 收藏的裝備不會被自動出售。</div>';
    const sel = UI.sel && Game.findItem(G, UI.sel);
    if (sel) {
      const it = sel.it;
      const equipped = sel.where !== 'stash';
      let acts = '';
      if (equipped) acts += `<button class="btn" data-act="unequip" data-slot="${sel.where}">卸下</button>`;
      else {
        const slots = it.slot === 'weapon' ? ['weapon', 'offhand'] : [it.slot];
        for (const s of slots) {
          const chk = Char.canEquip(G, it, s);
          acts += `<button class="btn gold" data-act="equip" data-id="${it.id}" data-slot="${s}" ${chk.ok || chk.swapOff ? '' : `disabled title="${esc(chk.reason)}"`}>穿到${D.SLOT_NAME[s]}</button>`;
        }
        acts += `<button class="btn" data-act="fav" data-id="${it.id}">${it.fav ? '取消收藏' : '★ 收藏'}</button>`;
        acts += `<button class="btn red" data-act="sell" data-id="${it.id}" ${it.fav ? 'disabled' : ''}>出售 +${Items.sellValue(it)}</button>`;
      }
      const reason = !equipped && it.slot === 'weapon' ? Char.canEquip(G, it, 'offhand') : null;
      detail = itemTip(it, { equipped }) + `<div class="detail-actions">${acts}</div>` + (reason && !reason.ok ? `<div class="note" style="margin-top:6px">副手：${reason.reason}</div>` : '');
    }
    for (const id of [...UI.pick]) if (!G.stash.some((i) => i.id === id)) UI.pick.delete(id);
    const picked = G.stash.filter((i) => UI.pick.has(i.id));
    const pickGold = picked.reduce((a, i) => a + Items.sellValue(i), 0);
    UI.stashView = list.map((i) => i.id);
    const bulk = `<div class="bulk"><span>批量出售</span>
      <button class="chip ${UI.pickMode ? 'on' : ''}" data-act="pickMode" title="開啟後點裝備就是勾選／取消勾選（也可以按住 Ctrl 點選）">${UI.pickMode ? '✓ 勾選模式中' : '逐件勾選'}</button>
      <button class="chip" data-act="pickRar" data-v="0">勾普通</button><button class="chip" data-act="pickRar" data-v="1">勾精良以下</button><button class="chip" data-act="pickRar" data-v="2">勾稀有以下</button>
      <button class="chip" data-act="pickNoUp" title="勾選所有依目前配裝不會變強的裝備">勾非升級</button><button class="chip" data-act="pickAll">勾目前顯示</button>
      <button class="chip" data-act="pickClear" ${picked.length ? '' : 'disabled'}>清除</button>
      <button class="btn small red" data-act="sellPicked" ${picked.length ? '' : 'disabled'}>出售勾選 ${picked.length} 件（+${pickGold} 金）</button></div>`;
    return `<div class="gear-grid">
      <div class="panel"><h3>穿戴中</h3><div class="pbody"><div class="doll"><div class="hero-stage"><img class="hero-big" src="${Spr.heroURL(Spr.lookOf(G.gear), 5)}"></div><div class="doll-set">${armorSetText(Char.compute(G))}</div>${doll}</div>
        <div class="loadouts"><div style="color:var(--gold);font-family:var(--serif)">配裝方案</div>${loadouts}
        <div class="note">方案會記住裝備與掛機規則；方案裡的裝備不會被自動出售。</div></div></div></div>
      <div class="panel" style="display:flex;flex-direction:column;min-height:0"><h3>營地倉庫<small>${G.stash.length} / ${G.stashCap}</small></h3><div class="pbody" style="flex:1;overflow:auto">
        <div class="stash-head">${filters.map(([k, n]) => `<button class="chip ${UI.gearFilter === k ? 'on' : ''}" data-act="filter" data-v="${k}">${n}</button>`).join('')}
          <span style="flex:1"></span>
          <select id="gear-sort" class="chip"><option value="rarity" ${UI.gearSort === 'rarity' ? 'selected' : ''}>依稀有度</option><option value="ilvl" ${UI.gearSort === 'ilvl' ? 'selected' : ''}>依等級</option><option value="slot" ${UI.gearSort === 'slot' ? 'selected' : ''}>依部位</option></select></div>
        ${bulk}
        <div class="stash">${list.map((it) => itemCard(it, 'chk-up')).join('') || '<div class="note">倉庫是空的。出征把裝備帶回來吧。</div>'}</div>
      </div>
      <div class="modal-foot" style="flex-wrap:wrap">
        <button class="btn small" data-act="buyStash" ${sc == null || G.gold < sc ? 'disabled' : ''}>倉庫 +10 格（${sc == null ? '已達上限' : sc + ' 金'}）</button>
        <button class="btn small" data-act="buyPack" ${pc == null || G.gold < pc ? 'disabled' : ''}>背包擴到 ${G.packSize + 1}×${G.packSize + 1}（${pc == null ? '已達上限' : pc + ' 金'}）</button>
        <span class="spacer"></span>
        <span class="note">★ 收藏與配裝方案裡的裝備不會被勾選出售</span>
      </div></div>
      <div class="panel"><h3>物品詳情</h3><div class="pbody">${detail}</div></div>
    </div>`;
  };

  // ---------- 角色與星盤 ----------
  const GLYPH = { 物理: '⚔', 火焰: '火', 冰霜: '冰', 雷電: '雷', 元素: '◈', 遠程: '➶', 防禦: '◆', 速度: '»', 法力: '◇' };
  function effText(e) {
    return Object.entries(e).filter(([k]) => k !== 'key').map(([k, v]) => {
      const nm = D.STAT_NAME[k] || D.ATTR[k] || k;
      const isPct = (D.AFFIX[k] && D.AFFIX[k].pct) || /Pct|Dmg$/.test(k);
      return `${nm} +${v}${isPct ? '%' : ''}`;
    }).join('、');
  }
  function starName(id) {
    const n = D.STARS[id];
    if (n.start) return '起點';
    if (n.eff.key) return D.STAR_KEYS[n.eff.key].name;
    if (n.kind === 'notable') return n.name;
    return effText(n.eff);
  }
  function constOf(id) {
    const n = D.STARS[id];
    return n && n.cst ? D.CONSTELLATIONS.find((c) => c.id === n.cst) : null;
  }
  function starTip(id) {
    const n = D.STARS[id];
    const G = UI.G;
    const owned = G.stars.owned.includes(id);
    const c = constOf(id);
    let h = `<div class="tip"><div class="tip-name" style="color:${n.kind === 'key' ? 'var(--gold2)' : n.kind === 'notable' ? '#ffd0a0' : 'var(--text)'}">${starName(id)}</div>`;
    h += `<div class="tip-sub">${n.kind === 'key' ? '大星點（改變玩法）' : n.kind === 'notable' ? '中星（主題加成）' : '小星'}${c ? `・${c.name}星座` : ''}</div>`;
    if (n.eff.key) h += `<div class="tip-sec">${D.STAR_KEYS[n.eff.key].desc}</div>`;
    else if (n.kind === 'notable') h += `<div class="tip-sec">${effText(n.eff)}</div>`;
    if (owned) h += `<div class="tip-sec sk-meta">已購買</div>`;
    else {
      const path = Game.starPath(G, id);
      h += `<div class="tip-sec sk-meta">${path.length === 1 ? `購買：${Game.starCost(G)} 金` : `整條路徑 ${path.length} 點，共 ${Game.pathCost(G, path)} 金`}</div>`;
    }
    return h + '</div>';
  }
  TABS.stars = () => {
    const G = UI.G;
    const cs = Char.compute(G);
    const ev = Char.evaluate(cs);
    const d0 = D.DUNGEON[G.exp.dungeon] || D.DUNGEON.mine;
    const curD = Math.max(0, Math.min(G.exp.diff, G.unlocked[G.exp.dungeon] ?? 0));
    const L = D.baseLevel(d0, curD) + 2;
    const pen = D.diff(curD).resPen;
    const attr = (k, desc) => `<div class="attr-row"><div>${D.ATTR[k]}<small>${desc}</small></div><b>${G.hero.attrs[k]}</b>
      <button class="btn small gold" data-act="alloc" data-k="${k}" ${G.hero.unspent ? '' : 'disabled'}>＋</button></div>`;
    const armorRed = Math.min(75, (cs.armor / (cs.armor + 40 + 14 * L)) * 100);
    const dodgeC = Math.min(cs.keys.includes('phantom') ? 60 : 50, (cs.dodge / (cs.dodge + 60 + 12 * L)) * 100);
    const line = (a, b) => `<div class="hs-line">${a}<b>${b}</b></div>`;
    let info = '<div class="note">點星盤上的星點查看效果。遠處的星點也能點，會顯示要經過的路線，可以整條一起買。</div>';
    const sid = UI.starSel;
    if (sid && D.STARS[sid]) {
      const n = D.STARS[sid];
      const owned = G.stars.owned.includes(sid);
      const c = constOf(sid);
      let acts = '';
      if (!owned) {
        const path = Game.starPath(G, sid);
        const cost = Game.pathCost(G, path);
        if (path.length === 1) acts = `<button class="btn gold" data-act="buyStar" data-id="${sid}" ${G.gold >= cost ? '' : 'disabled'}>購買（${cost} 金）</button>`;
        else if (path.length > 1) acts = `<button class="btn gold" data-act="buyPath" data-id="${sid}" ${G.gold >= cost ? '' : 'disabled'}>買下整條路徑（${path.length} 點，共 ${cost} 金）</button>`;
      } else if (sid !== 'C0') acts = `<button class="btn" data-act="refundStar" data-id="${sid}" ${Game.canRefund(G, sid) ? '' : 'disabled title="只能退回末端節點"'}>退回（返還 ${G.stars.paid[sid] || 0}，手續費 ${Game.refundFee(G)}）</button>`;
      const k = n.eff.key;
      if (k && owned && D.STAR_KEYS[k].excl && G.stars.owned.some((o) => D.STARS[o] && D.STARS[o].eff.key === D.STAR_KEYS[k].excl)) {
        const active = Char.activeKeys(G.stars).has(k);
        acts += active ? ' <span style="color:var(--green)">目前啟用中</span>' : ` <button class="btn" data-act="toggleKey" data-k="${k}">改為啟用這個</button>`;
      }
      let cinfo = '';
      if (c) {
        const have = c.nodes.filter((x) => G.stars.owned.includes(x)).length;
        cinfo = `<div class="cinfo">「${c.name}」星座 ${have}/${c.nodes.length}${have === c.nodes.length ? '・<b style="color:var(--gold2)">已集滿</b>' : ''}<br><small>集滿獎勵：${effText(c.done)}</small></div>`;
      }
      info = `<div class="sn">${starName(sid)}</div>
        <div class="note" style="margin:2px 0 6px">${n.kind === 'key' ? '大星點（改變玩法）' : n.kind === 'notable' ? '中星（主題加成）' : '小星'}</div>
        ${k ? `<div style="margin:4px 0">${D.STAR_KEYS[k].desc}${D.STAR_KEYS[k].excl ? `<br><span style="color:#ffb08a">與「${D.STAR_KEYS[D.STAR_KEYS[k].excl].name}」互斥：兩個都買到時同時只能啟用一個。</span>` : ''}</div>` : n.kind === 'notable' ? `<div>${effText(n.eff)}</div>` : ''}
        ${cinfo}<div class="detail-actions">${acts}</div>`;
    }
    const tags = D.STAR_TAGS.map((t) => `<button class="chip ${UI.starTag === t ? 'on' : ''}" data-act="starTag" data-v="${t}">${GLYPH[t]} ${t}</button>`).join('');
    return `<div class="stars-grid">
      <div style="display:flex;flex-direction:column;gap:12px;min-height:0">
        <div class="panel"><h3>三圍<small>未分配 ${G.hero.unspent} 點</small></h3><div class="pbody">
          ${attr('str', '近戰普攻・力量技能・生命')}${attr('dex', '弓箭普攻・敏捷技能・閃避・攻速')}${attr('int', '法杖普攻・智慧技能・法力與回魔')}
          <div class="detail-actions"><button class="btn small" data-act="respec">重配三圍（${D.ECON.respecCost(G.hero.level)} 金）</button></div></div></div>
        <div class="panel star-panel"><h3>星點<small>已購 ${G.stars.owned.length - 1}／${Object.keys(D.STARS).length - 1}・星座 ${cs.doneConsts.length}/18</small></h3><div class="pbody"><div class="note" style="margin-bottom:6px">下一點 <b style="color:var(--gold2)">${Game.starCost(G)}</b> 金・退點手續費 ${Game.refundFee(G)} 金</div>${info}</div></div>
        <div class="panel" style="flex:1;overflow:auto;min-height:160px"><h3>目前數值</h3><div class="pbody stat-list">
          ${line('生命', cs.maxHp)}${line('法力', `${cs.maxMp}（每秒 +${cs.mpRegen.toFixed(1)}）`)}
          ${line('護甲', `${Math.round(cs.armor)}（約減傷 ${armorRed.toFixed(0)}%）`)}${line('閃避', `${Math.round(cs.dodge)}（約 ${dodgeC.toFixed(0)}%）`)}
          ${line('格擋率', cs.block + '%')}${line('抗性 火／冰／雷', `${cs.res.fire}／${cs.res.cold}／${cs.res.light}%${pen ? `<br><small style="color:#ff9a6a">目前難度扣 ${pen}% → 實際 ${cs.res.fire - pen}／${cs.res.cold - pen}／${cs.res.light - pen}%</small>` : ''}`)}
          ${line('攻擊速度', '×' + cs.aspdMul.toFixed(2))}${line('移動速度', cs.move.toFixed(1))}${line('冷卻縮減', Math.round(cs.cdrF * 100) + '%')}${line('耗魔減少', Math.round(cs.manaCostF * 100) + '%')}
          ${line('盔甲套裝', cs.armorSet ? `${D.ARMOR_CLS[cs.armorSet].name}：${D.ARMOR_CLS[cs.armorSet].set}` : '未成套（四件同類才有）')}
          ${line('啟用大星點', cs.keys.map((k) => D.STAR_KEYS[k].name).join('、') || '無')}
          <div class="est3"><div><small>打單一強敵</small><b>${Math.round(ev.single)}</b></div><div><small>清怪群</small><b>${Math.round(ev.clear)}</b></div><div><small>生存</small><b>${Math.round(ev.surv)}</b></div></div>
        </div></div>
      </div>
      <div class="starwrap panel">
        <div class="star-bar"><b>星盤</b><span class="tagrow">主題：${tags}<button class="chip" data-act="starTag" data-v="">全部</button></span>
          <span class="spacer"></span><span class="note">滾輪縮放・拖曳移動</span>
          <button class="btn small" data-act="starZoom" data-v="1.25">＋</button><button class="btn small" data-act="starZoom" data-v="0.8">－</button><button class="btn small" data-act="starZoom" data-v="0">重置</button></div>
        <div class="starmap" id="starmap"><svg id="star-svg"></svg></div></div>
    </div>`;
  };

  function drawStarmap() {
    const G = UI.G;
    const svg = $('star-svg');
    if (!svg) return;
    const box = $('starmap');
    const W = box.clientWidth, H = box.clientHeight;
    const R0 = 12.2;
    const fit = Math.min((W - 30) / (R0 * 2), (H - 30) / (R0 * 2));
    const sc = fit * UI.starZoom;
    const ccx = 0, ccy = 0;
    const ox = W / 2 + UI.starPan[0], oy = H / 2 + UI.starPan[1];
    UI.starGeo = { W, H, sc, ccx, ccy };
    const P = (n) => [ox + n.x * sc, oy + n.y * sc];
    const owned = new Set(G.stars.owned);
    const keys = Char.activeKeys(G.stars);
    const cs = Char.compute(G);
    const done = new Set(cs.doneConsts);
    const regCol = (n) => (D.REGIONS[n.region] ? D.REGIONS[n.region].color : '#e6b955');
    const path = UI.starSel && !owned.has(UI.starSel) ? new Set(Game.starPath(G, UI.starSel)) : new Set();
    const tag = UI.starTag;
    let h = `<defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="glow2"><feGaussianBlur stdDeviation="6"/></filter>`;
    for (const [rk, R] of Object.entries(D.REGIONS)) h += `<radialGradient id="neb_${rk}"><stop offset="0" stop-color="${R.color}" stop-opacity="${R.hybrid ? 0.13 : 0.2}"/><stop offset="1" stop-color="${R.color}" stop-opacity="0"/></radialGradient>`;
    h += '</defs>';
    for (let i = 0; i < 110; i++) {
      const x = (Math.sin(i * 91.3) * 0.5 + 0.5) * W, y = (Math.cos(i * 47.7) * 0.5 + 0.5) * H;
      h += `<circle cx="${x}" cy="${y}" r="${(i % 3) * 0.4 + 0.4}" fill="#fff" opacity="${0.12 + (i % 5) * 0.07}"/>`;
    }
    // 各區星雲與名稱
    for (const [rk, R] of Object.entries(D.REGIONS)) {
      const a = (R.ang * Math.PI) / 180;
      const rr = R.hybrid ? 7.5 : 8;
      h += `<circle cx="${ox + Math.cos(a) * rr * sc}" cy="${oy + Math.sin(a) * rr * sc}" r="${(R.hybrid ? 4.5 : 6.5) * sc}" fill="url(#neb_${rk})"/>`;
      h += `<text x="${ox + Math.cos(a) * 11.6 * sc}" y="${oy + Math.sin(a) * 11.6 * sc}" fill="${R.color}" opacity=".75" font-size="${Math.max(12, sc * 0.55)}" text-anchor="middle" dominant-baseline="middle" font-family="Noto Serif TC, serif" font-weight="900">${R.name}</text>`;
    }
    // 連線
    const drawn = new Set();
    for (const [id, n] of Object.entries(D.STARS)) {
      for (const l of n.links) {
        const k = id < l ? id + '-' + l : l + '-' + id;
        if (drawn.has(k)) continue;
        drawn.add(k);
        const [x1, y1] = P(n), [x2, y2] = P(D.STARS[l]);
        const both = owned.has(id) && owned.has(l);
        const onPath = (path.has(id) || owned.has(id)) && (path.has(l) || owned.has(l)) && (path.has(id) || path.has(l));
        const col = both ? '#e6b955' : onPath ? '#ffdf8a' : owned.has(id) || owned.has(l) ? '#7a6436' : '#2a2238';
        h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${both ? 2.6 : onPath ? 2.2 : 1.6}" ${onPath && !both ? 'stroke-dasharray="5 4"' : ''} ${both ? 'filter="url(#glow)"' : ''}/>`;
      }
    }
    // 星座名稱
    for (const c of D.CONSTELLATIONS) {
      const [lx, ly] = [ox + c.label[0] * sc, oy + c.label[1] * sc];
      const full = done.has(c.id);
      h += `<text x="${lx}" y="${ly}" fill="${full ? '#ffdf8a' : D.REGIONS[c.region].color}" opacity="${full ? 0.95 : 0.45}" font-size="${Math.max(10, sc * 0.36)}" text-anchor="middle" font-family="Noto Serif TC, serif" ${full ? 'filter="url(#glow)"' : ''}>${c.name}${full ? ' ★' : ''}</text>`;
    }
    // 星點
    for (const [id, n] of Object.entries(D.STARS)) {
      const [x, y] = P(n);
      const has = owned.has(id);
      const can = !has && Game.canBuyStar(G, id);
      const c = regCol(n);
      const sel = UI.starSel === id;
      const dim = tag && !n.tags.includes(tag) && !n.start;
      const lit = tag && n.tags.includes(tag);
      const r = n.start ? Math.max(9, sc * 0.4) : n.kind === 'key' ? Math.max(10, sc * 0.4) : n.kind === 'notable' ? Math.max(7, sc * 0.28) : Math.max(4.5, sc * 0.17);
      const fill = has ? (n.kind === 'key' && !keys.has(n.eff.key) ? '#4a4050' : c) : '#120d18';
      const stroke = has ? '#fff' : can || path.has(id) ? c : c;
      const so = has || can || path.has(id) ? 1 : 0.4;
      const op = dim ? 0.25 : 1;
      if (lit) h += `<circle cx="${x}" cy="${y}" r="${r + 7}" fill="${c}" opacity=".35" filter="url(#glow2)"/>`;
      const common = `class="node" data-act="star" data-id="${id}" data-tipstar="${id}" opacity="${op}" fill="${fill}" stroke="${stroke}" stroke-opacity="${so}" stroke-width="${sel ? 3 : n.kind === 'small' ? 1.5 : 2}" ${has ? 'filter="url(#glow)"' : ''}`;
      const anim = can ? '<animate attributeName="stroke-opacity" values="1;.25;1" dur="1.4s" repeatCount="indefinite"/>' : '';
      if (n.kind === 'key') {
        const pts = [];
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.5 : r * 1.15; pts.push(`${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`); }
        h += `<polygon ${common} points="${pts.join(' ')}">${anim}</polygon>`;
      } else if (n.kind === 'notable') {
        h += `<rect ${common} x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" transform="rotate(45 ${x} ${y})">${anim}</rect>`;
      } else {
        h += `<circle ${common} cx="${x}" cy="${y}" r="${r}">${anim}</circle>`;
      }
      if (n.kind === 'small' && r >= 8 && n.tags[0]) h += `<text x="${x}" y="${y + 1}" font-size="${r * 1.05}" text-anchor="middle" dominant-baseline="middle" fill="${has ? '#1a1004' : c}" opacity="${op}" pointer-events="none">${GLYPH[n.tags[0]]}</text>`;
      if (sel) h += `<circle cx="${x}" cy="${y}" r="${r + 6}" fill="none" stroke="#ffdf8a" stroke-dasharray="3 3"><animateTransform attributeName="transform" type="rotate" from="0 ${x} ${y}" to="360 ${x} ${y}" dur="6s" repeatCount="indefinite"/></circle>`;
      if (UI.justBought && UI.justBought.has(id)) h += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff3c4" stroke-width="3"><animate attributeName="r" from="${r}" to="${r + 26}" dur=".7s" fill="freeze"/><animate attributeName="opacity" from="1" to="0" dur=".7s" fill="freeze"/></circle>`;
    }
    UI.justBought = null;
    svg.innerHTML = h;
  }

  // ---------- 工坊 ----------
  TABS.forge = () => {
    const G = UI.G;
    const list = D.SLOTS.map((sl) => G.gear[sl]).filter(Boolean).concat(G.stash.slice().sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl));
    const sel = UI.wsSel && Game.findItem(G, UI.wsSel);
    let center = '<div class="note" style="padding:20px">從左邊選一件裝備。<br><br>・<b>強化</b>：一定成功，提高基礎數值與所有屬性，越高級越貴。上限依稀有度：普通 +3、精良 +4、稀有 +6、史詩 +8、傳說 +10、神話 +12。<br>・<b>重骰</b>：挑一條屬性重新抽，其他條不動。可以只重抽數值，或換成另一種屬性。同一件重骰越多次越貴。<br>・技能和特殊能力不能重骰，要靠刷。</div>';
    let right = '';
    if (sel) {
      const it = sel.it;
      const cap = Items.plusCap(it);
      const plus = it.plus || 0;
      center = itemTip(it, { equipped: sel.where !== 'stash' });
      // 強化預覽
      let enh = '';
      if (plus >= cap) enh = `<div class="note">已達強化上限 +${cap}。</div>`;
      else {
        const nx = JSON.parse(JSON.stringify(it));
        Items.enhance(nx);
        const cur = Items.baseLines(it).concat(Items.affixLines(it));
        const nxt = Items.baseLines(nx).concat(Items.affixLines(nx));
        const cost = Game.enhanceCost(it);
        enh = `<div class="ws-cmp">${cur.map((l, i) => `<div><span>${l}</span><span class="up">→ ${nxt[i].replace(/^[^+\d]*/, '')}</span></div>`).join('')}</div>
          ${it.skill ? `<div class="note">技能威力也會提高約 6%。</div>` : ''}
          <div class="detail-actions"><button class="btn gold" data-act="wsEnhance" data-id="${it.id}" ${G.gold >= cost ? '' : 'disabled'}>強化到 +${plus + 1}（${cost} 金）</button></div>`;
      }
      const bar = Array.from({ length: cap }, (_, i) => `<i class="${i < plus ? 'on' : ''}"></i>`).join('');
      // 重骰
      const rer = it.affixes.length ? it.affixes.map((a, i) => {
        const [lo, hi] = Items.affixRange(it, a.k);
        const fv = (v) => Items.fmtVal(a.k, v);
        return `<div class="ws-aff ${UI.wsFlash === it.id + ':' + i ? 'flash' : ''}"><div><b>${D.AFFIX[a.k].name} ${fv(a.v)}</b><br><small>重抽數值範圍 ${fv(lo)}～${fv(hi)}</small></div>
          <div><button class="btn small" data-act="wsReroll" data-id="${it.id}" data-i="${i}" data-full="0" ${G.gold >= Game.rerollCost(it, false) ? '' : 'disabled'}>重抽數值（${Game.rerollCost(it, false)}）</button>
          <button class="btn small" data-act="wsReroll" data-id="${it.id}" data-i="${i}" data-full="1" ${G.gold >= Game.rerollCost(it, true) ? '' : 'disabled'}>換一種屬性（${Game.rerollCost(it, true)}）</button></div></div>`;
      }).join('') : '<div class="note">這件裝備沒有可以重骰的屬性。</div>';
      right = `<div class="panel"><h3>強化<small>+${plus} / +${cap}</small></h3><div class="pbody"><div class="plusbar">${bar}</div>${enh}</div></div>
        <div class="panel" style="margin-top:12px"><h3>屬性重骰<small>已重骰 ${it.rerolls || 0} 次</small></h3><div class="pbody">${UI.wsMsg ? `<div class="ws-msg">${UI.wsMsg}</div>` : ''}${rer}</div></div>`;
    }
    return `<div class="ws-grid">
      <div class="panel" style="display:flex;flex-direction:column;min-height:0"><h3>選擇裝備<small>穿戴中的排在最前面</small></h3><div class="pbody" style="flex:1;overflow:auto">
        <div class="stash">${list.map((it) => itemCard(it, D.SLOTS.some((s) => G.gear[s] === it) ? 'worn' : '').replace('class="item', `data-ws="${it.id}" class="item`)).join('')}</div></div></div>
      <div class="panel"><h3>裝備</h3><div class="pbody">${center}</div></div>
      <div>${right}</div>
    </div>`;
  };

  // ---------- 掛機設定 ----------
  const COND = [
    ['avail', '技能可用就施放'], ['enemies', '可命中的敵人至少'], ['hpBelow', '生命低於'], ['mpAbove', '法力高於'], ['bossCharge', '頭目正在蓄力'], ['bossFight', '目前是頭目戰'],
  ];
  function condEditor(ri, ci, c) {
    const opts = (ci === 1 ? [['none', '（無第二條件）']] : []).concat(COND);
    const k = c ? c.k : 'none';
    let param = '';
    if (k === 'enemies') param = `<input type="number" min="1" max="12" value="${c.n}" data-rule="${ri}" data-c="${ci}" data-f="n"> 隻`;
    if (k === 'hpBelow' || k === 'mpAbove') param = `<input type="number" min="5" max="95" step="5" value="${c.p}" data-rule="${ri}" data-c="${ci}" data-f="p"> %`;
    return `<select data-rule="${ri}" data-c="${ci}" data-f="k">${opts.map(([v, n]) => `<option value="${v}" ${v === k ? 'selected' : ''}>${n}</option>`).join('')}</select>${param}`;
  }
  TABS.auto = () => {
    const G = UI.G;
    const ids = Game.equippedSkillIds(G);
    const rules = G.autocast.rules;
    let n = 0;
    const rows = rules.map((r, i) => {
      if (!ids.includes(r.id)) return '';
      n++;
      const s = D.SKILLS[r.id];
      return `<div class="rule ${r.on ? '' : 'off'}"><div class="pri">${n}</div>
        <div class="skchip">${skillIcon(r.id)}<span>${s.name}<br><small style="color:var(--muted)">法力 ${s.mana}</small></span></div>
        <div class="conds"><label class="check"><input type="checkbox" data-act="ruleOn" data-i="${i}" ${r.on ? 'checked' : ''}>啟用</label>
          ${condEditor(i, 0, r.cond[0])} <span>而且</span> ${condEditor(i, 1, r.cond[1])}</div>
        <div><button class="btn small" data-act="ruleUp" data-i="${i}">↑</button><button class="btn small" data-act="ruleDown" data-i="${i}">↓</button><button class="btn small red" data-act="ruleDel" data-i="${i}">✕</button></div></div>`;
    }).join('');
    const thr = (k, label, v) => `<div class="thr"><label>${label}<b id="thr-${k}">${Math.round(v * 100)}%</b></label><input type="range" min="5" max="90" step="5" value="${Math.round(v * 100)}" data-thr="${k}"></div>`;
    return `<div class="auto-grid">
      <div class="panel"><h3>自動施法規則<small>由上往下檢查，先符合的先放</small></h3><div class="pbody">
        ${rows || '<div class="note">目前裝備沒有提供技能。</div>'}
        <div class="detail-actions" style="margin-top:12px">
          <select id="add-rule" class="chip">${ids.map((id) => `<option value="${id}">${D.SKILLS[id].name}</option>`).join('')}</select>
          <button class="btn small" data-act="ruleAdd" ${ids.length ? '' : 'disabled'}>新增規則</button>
          <span class="spacer" style="flex:1"></span>
          <button class="btn small" data-act="ruleReset">恢復預設規則</button></div>
        <div class="note" style="margin-top:10px">普通怪和頭目共用這套規則。若高優先的招式條件成立但法力不夠，會先等它，不讓低優先的招式搶走法力。主動模式下你手動點的技能永遠最優先。<br>
        預設規則：先保命，再用範圍技能打成群的敵人，最後才對單隻普通怪花高耗魔的技能。</div>
      </div></div>
      <div class="panel"><h3>藥水與撤退</h3><div class="pbody">
        ${thr('red', '生命低於多少自動喝紅水', G.autocast.red)}
        ${thr('blue', '法力低於多少自動喝藍水', G.autocast.blue)}
        ${thr('retreatHp', '掛機：清層時生命低於多少、且紅水用完就撤退', G.autocast.retreatHp)}
        <div class="note">掛機不會因為撿到高稀有度裝備就撤退，只看血量和通關狀態。戰鬥中也可以按「本層清完撤退」。</div>
      </div></div></div>`;
  };

  // ---------- 紀錄 ----------
  function namesHtml(list) {
    if (!list || !list.length) return '<span style="color:var(--dim)">無</span>';
    return list.map((i) => `<span class="c${i.rarity}">${esc(i.name)}${i.gold != null ? `（${i.gold} 金）` : ''}</span>`).join('');
  }
  // ---------- 寶物圖鑑 ----------
  TABS.codex = () => {
    const G = UI.G;
    const cx = G.codex || {};
    const ids = Object.keys(D.UNIQUES);
    const got = ids.filter((id) => cx[id]).length;
    const whereTxt = (u) => {
      if (!u.where) return '任何章節的頭目、精英怪都可能掉落（小怪也有極小機會）';
      const dg = D.DUNGEONS.find((d) => d.id === u.where);
      return `只在「${dg ? dg.name : '？？？'}」掉落`;
    };
    const cards = ids.map((id) => {
      const u = D.UNIQUES[id];
      const b = D.BASES[u.base];
      const f = cx[id];
      return `<div class="cx-card ${f ? 'found' : 'unk'}">
        <div class="cx-ico"><img src="${Spr.iconURL({ base: u.base, uniq: id }, 3)}" alt=""></div>
        <div class="cx-txt"><div class="cx-name">${f ? u.name : '？？？'}</div>
          <div class="cx-sub">${D.SLOT_NAME[b.slot]}・${b.name}${b.cls ? `・${D.ARMOR_CLS[b.cls].name}` : ''}${u.skill ? `｜技能 ${D.SKILLS[u.skill].name}` : ''}</div>
          <div class="cx-fx">${f ? u.fx : whereTxt(u)}</div>
          ${f ? `<div class="cx-n">已取得 ${f.n} 次</div>` : ''}</div></div>`;
    }).join('');
    return `<div class="panel"><h3>寶物圖鑑<small>已收集 ${got} / ${ids.length}</small></h3><div class="pbody">
      <div class="cx-prog"><div style="width:${(got / ids.length) * 100}%"></div></div>
      <div class="note" style="margin-bottom:10px">傳奇寶物有固定的名字和特效，數值會跟著掉落時的等級成長。頭目最容易掉、精英怪次之；難度越高越容易出現，圖鑑還沒收集到的也比較容易出現。
        掛機時背包放不下的傳奇寶物會直接寄回營地，倉庫滿了也不會被自動賣掉。</div>
      <div class="cx-grid">${cards}</div></div></div>`;
  };

  TABS.records = () => {
    const G = UI.G;
    const S = G.idle.summary;
    let sum = '';
    if (S) {
      sum = `<div class="panel" style="margin-bottom:12px"><h3>掛機摘要<small>從 ${new Date(S.since).toLocaleString()} 起</small></h3><div class="pbody">
        <div class="rep-stats"><div><small>出征</small><b>${S.runs}</b></div><div><small>通關</small><b>${S.wins}</b></div><div><small>倒下</small><b>${S.deaths}</b></div><div><small>金幣</small><b>${U.fmt(S.gold)}</b></div></div>
        <div class="note">經驗 +${U.fmt(S.xp)}｜帶回裝備：${S.items.map((n, r) => (n ? `<span class="c${r}">${D.RARITY[r].name} ${n}</span>` : '')).filter(Boolean).join('、') || '無'}
        ${Object.keys(S.causes).length ? `<br>倒下原因：${Object.entries(S.causes).map(([c, n]) => `${c} ×${n}`).join('、')}` : ''}</div>
        <div class="detail-actions"><button class="btn small" data-act="clearSummary">清除摘要</button></div></div></div>`;
    }
    const recs = G.records.map((r) => {
      const open = UI.recOpen.has(r.id);
      const how = { victory: '勝利', retreat: '撤退', death: '倒下' }[r.how];
      return `<div class="rec ${open ? 'open' : ''}"><div class="rec-head" data-act="rec" data-id="${r.id}">
        <div class="rec-how ${r.how}">${how}</div>
        <div class="rec-meta">${D.DUNGEON[r.dungeon || 'mine'].name}・${D.diff(r.diff).name}${r.mods ? `（${r.mods.map((k) => (D.ABYSS_MODS[k] || { name: k }).name).join('・')}）` : ''}・每波 ${r.wave} 隻・${r.mode === 'idle' ? '掛機' : '主動'}｜到達第 ${r.floor}/${r.floors} 層｜${U.fmtTime(r.secs)}｜經驗 +${r.xp}｜賣得 ${r.gold} 金｜帶回 ${r.brought.length} 件${r.lost.length ? `｜失去 ${r.lost.length} 件` : ''}</div>
        <div class="rec-meta">${new Date(r.when).toLocaleTimeString()}</div></div>
        <div class="rec-body">${reportBody(r, true)}</div></div>`;
    }).join('');
    return sum + (recs || '<div class="note">還沒有紀錄。</div>');
  };

  function reportBody(r, compact) {
    let h = '';
    if (r.cause) h += `<div class="cause">倒下原因：<b>${r.cause.main}</b>${r.cause.notes.length ? `<div class="note">${r.cause.notes.join('、')}</div>` : ''}<div class="note">${adviceFor(r)}</div></div>`;
    if (r.idleNote) h += `<div class="note" style="color:#ffd38a;margin-bottom:8px">${r.idleNote}</div>`;
    if (r.unlocked) h += `<div class="note" style="color:var(--gold2);margin-bottom:8px">解鎖：${r.unlocked}</div>`;
    h += `<div class="rep-sec"><h4>帶回營地</h4><div class="namelist">${namesHtml(r.brought)}</div></div>`;
    if (r.lost.length) h += `<div class="rep-sec"><h4 style="color:#ff9a8a">失去（本趟未賣出）</h4><div class="namelist">${namesHtml(r.lost)}</div></div>`;
    h += `<div class="rep-sec"><h4>本趟出售（金幣已永久保留）</h4><div class="namelist">${namesHtml(r.sold)}</div></div>`;
    if (r.stashSold && r.stashSold.length) h += `<div class="rep-sec"><h4>倉庫滿，自動出售評分最低的裝備</h4><div class="namelist">${namesHtml(r.stashSold)}</div></div>`;
    h += `<div class="rep-sec"><h4>逐層事件</h4>${r.floorLog.map((f) => `<div><b style="color:var(--text)">第 ${f.floor} 層</b>：擊殺 ${f.kills}，掉落 ${f.drops.length} 件<div class="fl">${f.events.slice(compact ? -8 : -12).map(esc).join('<br>')}</div></div>`).join('')}</div>`;
    return h;
  }

  function adviceFor(r) {
    const c = r.cause.main;
    if (c.includes('遠程')) return '建議：帶能穿透或範圍的技能清後排，或提高護甲、閃避；也可以降低每波怪數。';
    if (c.includes('累積')) return '建議：每波怪數調低一點，或換上範圍技能（旋斬、寒潮、扇射）加快清怪。';
    if (c.includes('頭目')) return '建議：看到地面裂光就準備防禦技能（石膚、靜電護幕），或留法力用破勢擊、劈岩斬打斷。';
    if (r.cause.notes.some((n) => n.includes('紅水'))) return '建議：多帶幾瓶紅水；賣掉多餘的普通裝備就買得起。';
    return '建議：先回營地分配三圍、換上評分較高的裝備，再降低每波怪數試試。';
  }

  // ---------- 彈出視窗 ----------
  function modal(html, cls) {
    const root = $('modal-root');
    root.innerHTML = `<div class="modal-back"><div class="panel modal ${cls || ''}">${html}</div></div>`;
    return root.firstChild;
  }
  function closeModal() { $('modal-root').innerHTML = ''; UI.modalKind = null; }

  function showReport(r) {
    const titles = { victory: '凱旋歸來', retreat: '平安撤退', death: '倒在地城深處' };
    sfx(r.how === 'victory' ? 'victory' : r.how === 'death' ? 'heroDie' : 'clear');
    UI.modalKind = 'report';
    modal(`<div class="modal-head"><h2 class="rec-how ${r.how}" style="color:${r.how === 'death' ? 'var(--red)' : r.how === 'victory' ? 'var(--gold2)' : '#8ec7ff'}">${titles[r.how]}</h2>
      <span class="sub">${D.DUNGEON[r.dungeon || 'mine'].name}・${D.diff(r.diff).name}・每波 ${r.wave} 隻・到達第 ${r.floor}/${r.floors} 層</span></div>
      <div class="modal-body">
        <div class="rep-stats"><div><small>時間</small><b>${U.fmtTime(r.secs)}</b></div><div><small>經驗</small><b>+${r.xp}</b></div><div><small>升級</small><b>${r.levelUps}</b></div><div><small>賣裝金幣</small><b>+${r.gold}</b></div></div>
        ${reportBody(r)}
      </div>
      <div class="modal-foot"><span class="spacer"></span>${UI.G.hero.unspent ? `<button class="btn" data-act="closeTo" data-v="stars">去分配 ${UI.G.hero.unspent} 點三圍</button>` : ''}<button class="btn" data-act="closeTo" data-v="gear">查看倉庫</button><button class="btn gold" data-act="close">回到營地</button></div>`, 'narrow');
  }

  function showOffline(o) {
    if (!o) return;
    UI.modalKind = 'offline';
    modal(`<div class="modal-head"><h2>歡迎回來</h2><span class="sub">離開了 ${U.fmtTime(o.secs)}</span></div>
      <div class="modal-body">${o.none ? '<div class="note">還沒有成功完成過一趟地城，所以這段時間沒有離線收益。成功出征後，關閉遊戲期間會依最近幾趟的成績累積經驗與金幣。</div>'
        : `<div class="rep-stats"><div><small>經驗</small><b>+${U.fmt(o.xp)}</b></div><div><small>金幣</small><b>+${U.fmt(o.gold)}</b></div><div><small>升級</small><b>${o.levels}</b></div><div><small>效率</small><b>${o.pct.toFixed(0)}%</b></div></div>
        <div class="note">依最近幾趟實際成功出征的每小時收益估算。離線期間不會產生裝備；金幣是普通裝備估算的出售所得。超過 24 小時後效率會逐漸降低。</div>`}</div>
      <div class="modal-foot"><span class="spacer"></span><button class="btn gold" data-act="close">好</button></div>`, 'narrow');
  }

  function showNotice(text) {
    UI.modalKind = 'notice';
    modal(`<div class="modal-head"><h2>更新通知</h2></div><div class="modal-body" style="font-size:15px;line-height:1.8">${text}</div>
      <div class="modal-foot"><span class="spacer"></span><button class="btn gold" data-act="close">知道了</button></div>`, 'narrow');
  }

  function showMenu() {
    UI.modalKind = 'menu';
    modal(`<div class="modal-head"><h2>選單</h2></div><div class="modal-body"><div class="menu-list">
      <button class="btn" data-act="close">繼續遊戲</button>
      <button class="btn" data-act="help">玩法說明</button>
      <button class="btn" data-act="exportSave">匯出存檔（複製文字）</button>
      <button class="btn" data-act="importSave">匯入存檔</button>
      <button class="btn red" data-act="wipe">刪除存檔、重新開始</button>
      <div class="note">存檔自動保存在這台電腦的瀏覽器裡。遊戲視窗縮小時仍會繼續戰鬥；完全關閉後，下次打開會依最近成績結算離線收益。</div>
    </div></div>`, 'narrow');
  }

  // ---------- 地城 HUD ----------
  let hudSkills = [];
  function buildHud() {
    const G = UI.G, run = G.run;
    if (!run) return;
    const cs = run.cs;
    hudSkills = D.SLOTS.map((sl) => cs.skills.find((s) => s.slot === sl) || null);
    $('skillbar').innerHTML = hudSkills.map((sk, i) => {
      if (!sk) return `<div class="si empty" title="${D.SLOT_NAME[D.SLOTS[i]]}：沒有技能"></div>`;
      return skillIcon(sk.id, { attrs: `data-cast="${sk.id}" data-tipskill="${sk.id}" id="sk-${i}"`, inner: `<span class="key">${i + 1}</span><span class="mana">${sk.mana}</span><span class="slotn">${D.SLOT_NAME[sk.slot]}</span><div class="cdov"></div><div class="cdtxt"></div>` });
    }).join('');
    $('p-red').previousElementSibling.style.backgroundImage = `url(${Spr.iconURL({ potion: 'red' }, 2)})`;
    $('p-blue').previousElementSibling.style.backgroundImage = `url(${Spr.iconURL({ potion: 'blue' }, 2)})`;
    $('tray-gems').innerHTML = '';
    UI.trayCount = 0;
    $('ov-msg').classList.remove('on');
    LH.Render.R.mapKey = '';
  }

  function updateHud() {
    const G = UI.G, run = G.run;
    if (!run) return;
    const cs = run.cs, h = run.hero;
    $('h-name').textContent = `${D.DUNGEON[run.dungeon || 'mine'].name}・${D.diff(run.diff).name}・每波 ${run.wave} 隻${run.mods && run.mods.length ? '｜' + run.mods.map((k) => D.ABYSS_MODS[k].name).join('・') : ''}`;
    $('h-floor').textContent = run.floor === run.floors ? `第 ${run.floor} / ${run.floors} 層・頭目` : `第 ${run.floor} / ${run.floors} 層`;
    const kp = run.killTarget ? Math.min(1, run.kills / run.killTarget) : 1;
    $('h-kill').style.width = kp * 100 + '%';
    $('h-killtext').textContent = run.killTarget ? (run.kills >= run.killTarget ? `清除剩餘 ${run.mobs.length} 隻` : `擊殺 ${run.kills} / ${run.killTarget}`) : '擊敗頭目';
    $('h-mobs').textContent = `場上 ${run.mobs.filter((m) => m.hp > 0).length} 隻`;
    document.querySelectorAll('#h-mode button').forEach((b) => b.classList.toggle('on', b.dataset.v === run.mode));
    document.querySelectorAll('#h-speed button').forEach((b) => b.classList.toggle('on', +b.dataset.v === run.speed));
    const ab = $('h-auto');
    ab.classList.toggle('on', run.autoCast || run.mode === 'idle');
    ab.textContent = run.mode === 'idle' ? '自動施法：掛機中' : run.autoCast ? '自動施法：開' : '自動施法：暫停';
    ab.disabled = run.mode === 'idle';
    $('h-retreat').classList.toggle('on', run.retreatAfter);
    $('h-retreat').classList.add('warn');
    // 球
    const hp = Math.max(0, h.hp / cs.maxHp), mp = Math.max(0, h.mp / cs.maxMp);
    $('o-hp').style.height = hp * 100 + '%';
    $('o-mp').style.height = mp * 100 + '%';
    $('o-hptext').textContent = `${Math.ceil(h.hp)}`;
    $('o-mptext').textContent = `${Math.floor(h.mp)}`;
    $('o-hp').parentElement.classList.toggle('low', hp < 0.3);
    $('p-red').textContent = Pack.count(run.pack, 'red');
    $('p-blue').textContent = Pack.count(run.pack, 'blue');
    $('h-xp').style.width = (G.hero.xp / D.ECON.xpToNext(G.hero.level)) * 100 + '%';
    hudSkills.forEach((sk, i) => {
      if (!sk) return;
      const el = $('sk-' + i);
      if (!el) return;
      const cd = h.cds[sk.id] || 0;
      el.querySelector('.cdov').style.setProperty('--p', cd > 0 ? (cd / sk.cd) * 100 + '%' : '0%');
      el.querySelector('.cdtxt').textContent = cd > 0.05 ? cd.toFixed(cd < 1 ? 1 : 0) : '';
      el.classList.toggle('nomana', h.mp < sk.mana);
      if (el._cd > 0 && cd <= 0) { el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready'); }
      el._cd = cd;
      el.classList.toggle('paused', !run.autoCast && run.mode === 'active');
    });
    // 頭目
    const boss = run.mobs.find((m) => m.boss);
    const bb = $('h-boss');
    if (boss) {
      bb.classList.add('on');
      bb.querySelector('.bb-name').textContent = D.BOSSES[boss.boss].name;
      bb.querySelector('.bb-bar div').style.width = Math.max(0, boss.hp / boss.maxHp) * 100 + '%';
      const mv = bb.querySelector('.bb-move');
      if (boss.cur) { mv.textContent = `⚠ ${D.BOSS_MOVES[boss.cur.move].name}${boss.cur.weakened ? '（已削弱）' : ''}`; mv.classList.add('warn'); }
      else { mv.textContent = boss.weak > 0 ? '弱點暴露！傷害 +50%' : ''; mv.classList.remove('warn'); }
    } else bb.classList.remove('on');
    // 訊息
    for (const m of run.msgs) toast(m.text, m.kind);
    if (run.msgs.some((m) => m.kind === 'warn' && m.text.includes('法力不足'))) hint('mana', '法力不夠時技能不會排隊。普通攻擊、藍水和裝備效果都能回魔。');
    run.msgs.length = 0;
  }

  function onDrop(r, fx, fy) {
    const stage = $('stage').getBoundingClientRect();
    const tray = $('tray-gems');
    const gem = document.createElement('div');
    const col = r === 'uq' ? D.UNIQ_COLOR : D.RARITY[r].color;
    gem.className = 'flygem';
    gem.style.background = col;
    gem.style.boxShadow = `0 0 ${r === 'uq' ? 18 : 10}px ${col}`;
    gem.style.left = stage.left + fx * stage.width + 'px';
    gem.style.top = stage.top + fy * stage.height + 'px';
    document.body.appendChild(gem);
    const tr = tray.getBoundingClientRect();
    requestAnimationFrame(() => {
      gem.style.left = tr.left + tr.width / 2 - 7 + 'px';
      gem.style.top = tr.top + tray.children.length * 20 + 'px';
    });
    setTimeout(() => {
      gem.remove();
      const g = document.createElement('div');
      g.className = 'gem' + (r === 'uq' ? ' uq' : '');
      g.style.background = col;
      g.style.boxShadow = `0 0 8px ${col}`;
      tray.appendChild(g);
    }, 720);
  }

  // ---------- 樓層整理 ----------
  const CS = 46;
  function openLoot() {
    UI.modalKind = 'loot';
    UI.lootSel = null;
    UI.flipFresh = true; // 第一次打開時好裝備用翻牌的方式出現
    sfx('clear');
    const run = UI.G.run;
    if (run.pending.length) hint('bagfull', '背包放不下的裝備，按「繼續」時會自動賣掉換金幣。');
    if (run.floor === 1 && !UI.G.hints.retreat) hint('retreat', '清完一層就能撤退，把背包裡的裝備安全帶回營地。');
    renderLoot();
  }

  function bagItemHtml(it, rot, cls) {
    const cells = Items.cells(it, rot);
    const [w, h] = Items.dims(it, rot);
    const col = it.potion ? (it.potion === 'red' ? '#a33' : '#336') : it.uniq ? D.UNIQ_COLOR : D.RARITY[it.rarity].color;
    const bg = it.potion ? 'rgba(40,20,30,.9)' : `rgba(${hexRgb(col)},${it.uniq ? '.26' : '.16'})`;
    let s = cells.map(([x, y]) => `<div class="pc" style="left:${x * CS + 2}px;top:${y * CS + 2}px;width:${CS - 4}px;height:${CS - 4}px;border-color:${col};background:${bg}"></div>`).join('');
    const isz = Math.min(w, h) >= 2 ? 64 : 40;
    const [bw, bh] = Items.dims(it, 0);
    const vertical = bh > bw;
    const ang = rot * 90;
    s += `<img src="${Spr.iconURL(it, 4)}" style="width:${isz}px;height:${isz}px;left:${(w * CS - isz) / 2}px;top:${(h * CS - isz) / 2}px;transform:rotate(${vertical ? ang : ang}deg)">`;
    return { html: s, w, h };
  }
  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  function renderLoot() {
    const G = UI.G, run = G.run;
    if (!run) return closeModal();
    const pk = run.pack;
    let cells = '';
    for (let y = 0; y < pk.h; y++) for (let x = 0; x < pk.w; x++) cells += `<div class="cell" style="left:${x * CS}px;top:${y * CS}px;width:${CS}px;height:${CS}px"></div>`;
    // 翻牌：越稀有的越晚翻開
    const flip = {};
    if (UI.flipFresh) {
      const rank = (it) => (it.uniq ? 6 : it.rarity);
      const order = pk.items.map((p) => p.it).concat(run.pending).filter((it) => !it.potion).sort((a, b) => rank(a) - rank(b));
      order.forEach((it, i) => (flip[it.id] = { d: (0.08 + i * 0.11 + (rank(it) >= 4 ? 0.3 : 0)).toFixed(2), r: rank(it) }));
      UI.flipFresh = false;
      const best = order.length ? rank(order[order.length - 1]) : 0;
      if (best >= 4) setTimeout(() => sfx('drop', { r: Math.min(5, best) }), (+flip[order[order.length - 1].id].d + 0.3) * 1000);
    }
    const fl0 = (it) => (flip[it.id] ? ` flip fr${flip[it.id].r}" style="animation-delay:${flip[it.id].d}s` : '');
    const items = pk.items.map((p) => {
      const b = bagItemHtml(p.it, p.rot);
      const fd = flip[p.it.id] ? `animation-delay:${flip[p.it.id].d}s;` : '';
      return `<div class="pitem ${UI.lootSel === p.it.id ? 'sel' : ''} ${flip[p.it.id] ? 'flip fr' + flip[p.it.id].r : ''}" data-loot="${p.it.id}" data-item="${p.it.id}" style="${fd}left:${p.x * CS}px;top:${p.y * CS}px;width:${b.w * CS}px;height:${b.h * CS}px">${b.html}</div>`;
    }).join('');
    const pend = run.pending.map((it) => itemCard(it).replace('class="item', `data-loot="${it.id}" class="item`).replace(/" data-item=/, `${fl0(it)}" data-item=`)).join('');
    const pendGold = run.pending.reduce((a, it) => a + Items.sellValue(it), 0);
    const boss = run.floor >= run.floors;
    let detail = '<div class="note">點一件物品查看詳情；拖曳可以移動，拖曳時按 R 或滑鼠右鍵旋轉。拖到下方金色區域直接出售。</div>';
    if (UI.lootSel) {
      const f = Game.lootFind(run, UI.lootSel);
      if (f) {
        detail = itemTip(f.it) + `<div class="detail-actions">${f.it.potion ? `<button class="btn red" data-act="lootDiscard" data-id="${f.it.id}">丟棄（不退金幣）</button>`
          : `<button class="btn red" data-act="lootSell" data-id="${f.it.id}">出售 +${Items.sellValue(f.it)} 金</button>`}
          ${f.where === 'pack' && !f.it.potion ? `<button class="btn" data-act="lootUnplace" data-id="${f.it.id}">移出背包</button>` : ''}</div>`;
      }
    }
    const nextBtn = boss ? `<button class="btn gold" data-act="lootDone">帶著戰利品返回營地 ▶</button>`
      : run.retreatAfter ? `<button class="btn gold" data-act="lootRetreat">撤退回營地 ▶</button>`
        : `<button class="btn" data-act="lootRetreat">撤退回營地</button><button class="btn gold" data-act="lootNext">繼續第 ${run.floor + 1} 層 ▶</button>`;
    const fl = run.floorLog[run.floorLog.length - 1];
    const html = `<div class="modal-head"><h2>${boss ? '頭目擊倒！' : `第 ${run.floor} 層清除`}</h2>
        <span class="sub">本層擊殺 ${fl.kills}、掉落 ${fl.drops.length} 件｜本趟已賣得 ${run.goldSold} 金｜生命 ${Math.ceil(run.hero.hp)}/${run.cs.maxHp}｜紅水 ${Pack.count(pk, 'red')}・藍水 ${Pack.count(pk, 'blue')}</span></div>
      <div class="modal-body"><div class="loot-grid">
        <div><div style="color:var(--gold);font-family:var(--serif);margin-bottom:6px">待整理（放不進背包）</div>
          <div class="pending" id="pending">${pend || '<div class="note">全部都放進背包了。</div>'}</div>
          <div class="sellzone" id="sellzone">拖到這裡出售</div></div>
        <div><div style="color:var(--gold);font-family:var(--serif);margin-bottom:6px">戰利品背包 ${pk.w}×${pk.h}</div>
          <div class="bag" id="bag" style="width:${pk.w * CS + 4}px;height:${pk.h * CS + 4}px"><div style="position:absolute;left:2px;top:2px">${cells}${items}<div id="bag-pv"></div></div></div></div>
        <div>${detail}</div>
      </div></div>
      <div class="modal-foot"><button class="btn" data-act="lootArrange">自動整理</button>
        <button class="btn" data-act="lootSellPending" ${run.pending.length ? '' : 'disabled'}>出售全部待整理（+${pendGold}）</button>
        <span class="note" style="margin-left:6px">一鍵出售背包＋待整理：</span>
        <button class="btn small" data-act="lootBulk" data-v="0">普通</button><button class="btn small" data-act="lootBulk" data-v="1">精良以下</button><button class="btn small" data-act="lootBulk" data-v="noup" title="保留依目前配裝會變強（▲）的裝備">非升級</button>
        <span class="spacer"></span>${run.pending.length && !boss ? `<span class="warnline">繼續時，待整理的 ${run.pending.length} 件會自動賣出</span>` : ''}${nextBtn}</div>`;
    const root = $('modal-root');
    if (UI.modalKind === 'loot' && root.querySelector('.modal')) root.querySelector('.modal').innerHTML = html;
    else modal(html);
  }

  // 拖曳
  function startDrag(e, id) {
    const run = UI.G.run;
    const f = Game.lootFind(run, id);
    if (!f) return;
    UI.drag = { id, it: f.it, rot: f.where === 'pack' ? f.p.rot : 0, sx: e.clientX, sy: e.clientY, moved: false };
  }
  function ghostRender() {
    const d = UI.drag;
    const g = $('drag-ghost');
    const b = bagItemHtml(d.it, d.rot);
    g.innerHTML = b.html;
    g.style.width = b.w * CS + 'px';
    g.style.height = b.h * CS + 'px';
    d.w = b.w; d.h = b.h;
  }
  function dragMove(e) {
    const d = UI.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
    if (!d.moved) { d.moved = true; ghostRender(); $('drag-ghost').style.display = 'block'; }
    d.lx = e.clientX; d.ly = e.clientY;
    const g = $('drag-ghost');
    g.style.left = e.clientX - (d.w * CS) / 2 + 'px';
    g.style.top = e.clientY - (d.h * CS) / 2 + 'px';
    const pv = $('bag-pv');
    const bag = $('bag');
    if (!bag || !pv) return;
    const r = bag.getBoundingClientRect();
    const sz = $('sellzone'), pd = $('pending');
    sz && sz.classList.toggle('hot', inside(sz, e));
    pd && pd.classList.toggle('hot', inside(pd, e));
    if (inside(bag, e)) {
      const o = dropOrigin(e, r);
      const ok = Pack.fits(UI.G.run.pack, d.it, o[0], o[1], d.rot, d.id);
      pv.innerHTML = Items.cells(d.it, d.rot).map(([x, y]) => `<div class="pv ${ok ? 'ok' : 'bad'}" style="left:${(o[0] + x) * CS}px;top:${(o[1] + y) * CS}px;width:${CS}px;height:${CS}px"></div>`).join('');
    } else pv.innerHTML = '';
  }
  function inside(el, e) {
    const r = el.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  function dropOrigin(e, r, d) {
    d = d || UI.drag;
    const gx = Math.floor((e.clientX - r.left - 2) / CS), gy = Math.floor((e.clientY - r.top - 2) / CS);
    return [gx - Math.floor((d.w - 1) / 2), gy - Math.floor((d.h - 1) / 2)];
  }
  function endDrag(e) {
    const d = UI.drag;
    if (!d) return;
    UI.drag = null;
    $('drag-ghost').style.display = 'none';
    const G = UI.G;
    if (!d.moved) { UI.lootSel = d.id; renderLoot(); return; }
    const bag = $('bag');
    if (bag && inside(bag, e)) {
      const o = dropOrigin(e, bag.getBoundingClientRect(), d);
      if (Game.lootPlace(G, d.id, o[0], o[1], d.rot)) sfx('click'); else sfx('error');
    } else if ($('sellzone') && inside($('sellzone'), e)) {
      if (!d.it.potion) { Game.lootSell(G, d.id); sfx('sell'); }
      else { Game.lootDiscard(G, d.id); }
    } else if ($('pending') && inside($('pending'), e)) {
      Game.lootUnplace(G, d.id);
    }
    UI.lootSel = d.id;
    save();
    renderLoot();
  }

  // ---------- 事件 ----------
  const ACT = {
    tab: (el) => { UI.tab = el.dataset.v; closeModal(); renderCamp(); },
    // 音量依序：大 → 中 → 小 → 關 → 大
    sound: () => { const S = UI.G.settings; S.sfxVol = (S.sfxVol + 3) % 4; S.sound = S.sfxVol > 0; LH.Sfx.setLevel(S.sfxVol); renderTop(); UI.onSave && UI.onSave(); },
    music: () => { const S = UI.G.settings; S.musicVol = (S.musicVol + 3) % 4; LH.Music.setLevel(S.musicVol); renderTop(); UI.onSave && UI.onSave(); },
    dmgNum: () => { const S = UI.G.settings; S.dmgNum = DMG_NEXT[S.dmgNum || 'all']; renderTop(); UI.onSave && UI.onSave(); },
    menu: () => showMenu(),
    help: () => {
      UI.modalKind = 'help';
      modal(`<div class="modal-head"><h2>玩法說明</h2></div><div class="modal-body note" style="font-size:14px;line-height:1.9">
        ・角色在地城裡會<b>自己走、自己打</b>。你負責看準時機點技能（或按數字鍵 1–8）。<br>
        ・技能全部來自<b>身上的裝備</b>；同一招多件只顯示一次。每招會自動挑方向與目標。<br>
        ・怪物排成一直線時放突刺、劈岩斬；被包圍時放旋斬、寒潮。法力不夠時技能不會排隊。<br>
        ・頭目出大招前，地面會亮起<b style="color:#ff6a5a">紅光</b>：留法力打斷，或開石膚、靜電護幕擋下。<br>
        ・清完一層才能看到裝備完整能力。背包是有限的格子：拖曳移動、<b>右鍵或 R 旋轉</b>、拖到金色區出售。<br>
        ・賣裝得到的金幣立刻永久保留；<b>倒下只會失去這一趟還沒賣掉的裝備</b>。<br>
        ・回營地才能換裝、分配三圍、買星盤。星盤上的大星點會改變玩法（雙持、範圍擴大…）。<br>
        ・掛機模式會自動整理背包、依血量撤退，成功後自動再出發；倒下會自動把每波怪數降 1 再試。<br>
        ・遊戲視窗縮小時戰鬥會繼續；完全關閉後，下次開啟會結算離線的經驗與金幣。</div>
        <div class="modal-foot"><span class="spacer"></span><button class="btn gold" data-act="close">知道了</button></div>`, 'narrow');
    },
    close: () => { closeModal(); if (UI.screen === 'camp') renderCamp(); },
    closeTo: (el) => { closeModal(); UI.tab = el.dataset.v; show('camp'); },
    diff: (el) => { UI.G.exp.diff = +el.dataset.v; renderCamp(); },
    rerollMods: () => { const r = Game.rerollMods(UI.G); if (!r.ok) toastAny(r.reason); else sfx('drop', { r: 2 }); renderCamp(); save(); },
    abyss: (el) => { const G = UI.G; G.exp.diff = U.clamp(Math.min(G.exp.diff, G.unlocked[G.exp.dungeon]) + +el.dataset.v, 3, G.unlocked[G.exp.dungeon]); renderCamp(); },
    expmode: (el) => { UI.G.exp.mode = el.dataset.v; renderCamp(); },
    expspeed: (el) => { UI.G.exp.speed = +el.dataset.v; renderCamp(); },
    carry: (el) => { const e = UI.G.exp, k = el.dataset.k; e[k] = U.clamp(e[k] + +el.dataset.v, 0, D.ECON.potionCarryMax); renderCamp(); },
    buyPot: (el) => { if (Game.buyPotion(UI.G, el.dataset.k, +el.dataset.n)) sfx('buy'); else sfx('error'); renderCamp(); },
    go: () => {
      const G = UI.G;
      G.idleNext = null;
      Game.startRun(G, { fresh: true });
      LH.Render.reset();
      show('dungeon');
      save();
    },
    filter: (el) => { UI.gearFilter = el.dataset.v; renderCamp(); },
    equip: (el) => { const r = Game.equip(UI.G, el.dataset.id, el.dataset.slot); if (!r.ok) sfx('error'); else sfx('click'); upCache.clear(); renderCamp(); },
    unequip: (el) => { Game.unequip(UI.G, el.dataset.slot); upCache.clear(); renderCamp(); },
    fav: (el) => { const f = Game.findItem(UI.G, el.dataset.id); if (f) f.it.fav = !f.it.fav; renderCamp(); },
    sell: (el) => { Game.sellStash(UI.G, el.dataset.id); UI.sel = null; sfx('sell'); renderCamp(); },
    pickMode: () => { UI.pickMode = !UI.pickMode; renderCamp(); },
    pickRar: (el) => {
      const G = UI.G;
      UI.pickMode = true;
      for (const it of G.stash) if (it.rarity <= +el.dataset.v && !Game.isProtected(G, it)) UI.pick.add(it.id);
      renderCamp();
    },
    pickNoUp: () => {
      const G = UI.G;
      UI.pickMode = true;
      for (const it of G.stash) if (!Game.isProtected(G, it) && !isUpgrade(it)) UI.pick.add(it.id);
      renderCamp();
    },
    pickAll: () => {
      const G = UI.G;
      UI.pickMode = true;
      for (const id of UI.stashView || []) { const it = G.stash.find((i) => i.id === id); if (it && !Game.isProtected(G, it)) UI.pick.add(id); }
      renderCamp();
    },
    pickClear: () => { UI.pick.clear(); renderCamp(); },
    sellPicked: () => {
      const G = UI.G;
      const list = G.stash.filter((i) => UI.pick.has(i.id) && !Game.isProtected(G, i));
      if (!list.length) return;
      const gold = list.reduce((a, i) => a + Items.sellValue(i), 0);
      const hi = list.filter((i) => i.rarity >= 3).length;
      if (hi && !confirm(`勾選的裝備裡有 ${hi} 件史詩以上，確定一起賣掉嗎？（共 ${list.length} 件，+${gold} 金）`)) return;
      for (const it of list) Game.sellStash(G, it.id);
      UI.pick.clear();
      if (UI.sel && !Game.findItem(G, UI.sel)) UI.sel = null;
      sfx('sell');
      renderCamp();
    },
    starZoom: (el) => {
      const v = +el.dataset.v;
      if (!v) { UI.starZoom = 1; UI.starPan = [0, 0]; } else UI.starZoom = U.clamp(UI.starZoom * v, 0.7, 3.5);
      drawStarmap();
    },
    lootBulk: (el) => {
      const G = UI.G, run = G.run;
      const v = el.dataset.v;
      const all = run.pack.items.map((p) => p.it).concat(run.pending).filter((it) => !it.potion);
      const list = all.filter((it) => (v === 'noup' ? !isUpgrade(it) : it.rarity <= +v));
      if (!list.length) { toastAny('沒有符合條件的裝備'); return; }
      const gold = list.reduce((a, i) => a + Items.sellValue(i), 0);
      const hi = list.filter((i) => i.rarity >= 3).length;
      if (hi && !confirm(`其中有 ${hi} 件史詩以上，確定一起賣掉嗎？（共 ${list.length} 件，+${gold} 金）`)) return;
      for (const it of list) Game.lootSell(G, it.id);
      UI.lootSel = null;
      sfx('sell');
      renderLoot();
    },
    buyStash: () => { if (Game.buyStash(UI.G)) sfx('buy'); renderCamp(); },
    buyPack: () => { if (Game.buyPack(UI.G)) sfx('buy'); renderCamp(); },
    loSave: (el) => { Game.saveLoadout(UI.G, +el.dataset.i); sfx('click'); renderCamp(); },
    loLoad: (el) => { const r = Game.loadLoadout(UI.G, +el.dataset.i); sfx('click'); upCache.clear(); renderCamp(); if (r.missing && r.missing.length) alert(`有 ${r.missing.length} 件裝備已不在倉庫，那些部位維持空著。`); },
    alloc: (el) => { Game.allocate(UI.G, el.dataset.k); sfx('click'); renderCamp(); },
    respec: () => { if (Game.respec(UI.G)) sfx('buy'); else sfx('error'); renderCamp(); },
    star: (el) => { UI.starSel = el.dataset.id; renderCamp(); },
    buyStar: (el) => { const r = Game.buyStar(UI.G, el.dataset.id); sfx(r.ok ? 'buy' : 'error'); if (r.ok) UI.justBought = new Set([el.dataset.id]); renderCamp(); },
    buyPath: (el) => {
      const path = Game.starPath(UI.G, el.dataset.id);
      const r = Game.buyPath(UI.G, el.dataset.id);
      sfx(r.ok ? 'buy' : 'error');
      if (r.ok) UI.justBought = new Set(path);
      renderCamp();
    },
    starTag: (el) => { UI.starTag = el.dataset.v && UI.starTag !== el.dataset.v ? el.dataset.v : null; renderCamp(); },
    dungeon: (el) => { UI.G.exp.dungeon = el.dataset.v; renderCamp(); },
    wsEnhance: (el) => {
      const r = Game.enhance(UI.G, el.dataset.id);
      sfx(r.ok ? 'level' : 'error');
      UI.wsMsg = r.ok ? `強化成功！現在是 +${r.plus}` : r.reason;
      upCache.clear();
      renderCamp();
    },
    wsReroll: (el) => {
      const i = +el.dataset.i;
      const r = Game.reroll(UI.G, el.dataset.id, i, el.dataset.full === '1');
      sfx(r.ok ? 'buy' : 'error');
      if (r.ok) {
        const f = (x) => `${D.AFFIX[x.k].name} ${Items.fmtVal(x.k, x.v)}`;
        UI.wsMsg = `${f(r.before)} → <b>${f(r.after)}</b>`;
        UI.wsFlash = el.dataset.id + ':' + i;
      } else UI.wsMsg = r.reason;
      upCache.clear();
      renderCamp();
    },
    refundStar: (el) => { const r = Game.refundStar(UI.G, el.dataset.id); sfx(r.ok ? 'sell' : 'error'); renderCamp(); },
    toggleKey: (el) => { Game.toggleKey(UI.G, el.dataset.k); renderCamp(); },
    ruleOn: (el) => { const r = UI.G.autocast.rules[+el.dataset.i]; r.on = el.checked; renderCamp(); },
    ruleUp: (el) => moveRule(+el.dataset.i, -1),
    ruleDown: (el) => moveRule(+el.dataset.i, 1),
    ruleDel: (el) => { UI.G.autocast.rules.splice(+el.dataset.i, 1); renderCamp(); },
    ruleAdd: () => { const id = $('add-rule').value; UI.G.autocast.rules.push({ id, on: true, cond: [{ k: 'avail' }] }); renderCamp(); },
    ruleReset: () => { UI.G.autocast.rules = Game.defaultRules(UI.G); renderCamp(); },
    rec: (el) => { const id = el.dataset.id; if (UI.recOpen.has(id)) UI.recOpen.delete(id); else UI.recOpen.add(id); renderCamp(); },
    clearSummary: () => { UI.G.idle.summary = null; renderCamp(); },
    mode: (el) => { Game.setMode(UI.G, el.dataset.v); if (el.dataset.v === 'idle' && UI.modalKind === 'loot') closeModal(); },
    autocast: () => { const r = UI.G.run; if (r) r.autoCast = !r.autoCast; },
    speed: (el) => { const r = UI.G.run; if (r) r.speed = +el.dataset.v; UI.G.exp.speed = +el.dataset.v; },
    retreatAfter: () => { const r = UI.G.run; if (r) { r.retreatAfter = !r.retreatAfter; toast(r.retreatAfter ? '這一層清完就撤退' : '取消撤退', 'good'); } },
    lootSell: (el) => { Game.lootSell(UI.G, el.dataset.id); UI.lootSel = null; sfx('sell'); renderLoot(); },
    lootDiscard: (el) => { Game.lootDiscard(UI.G, el.dataset.id); UI.lootSel = null; renderLoot(); },
    lootUnplace: (el) => { Game.lootUnplace(UI.G, el.dataset.id); renderLoot(); },
    lootArrange: () => { Game.lootAutoArrange(UI.G); sfx('click'); renderLoot(); },
    lootSellPending: () => { const run = UI.G.run; for (const it of run.pending.slice()) Game.lootSell(UI.G, it.id); sfx('sell'); renderLoot(); },
    lootNext: () => { Game.lootContinue(UI.G); closeModal(); LH.Render.reset(); buildHud(); save(); },
    lootRetreat: () => { const r = Game.lootRetreat(UI.G); closeModal(); afterRun(r); save(); },
    lootDone: () => { const r = Game.lootRetreat(UI.G, 'victory'); closeModal(); afterRun(r); save(); },
    stopIdle: () => { UI.G.idleNext = null; closeModal(); show('camp'); if (UI.G.lastReport) showReport(UI.G.lastReport); },
    exportSave: () => {
      const s = Game.serialize(UI.G);
      navigator.clipboard && navigator.clipboard.writeText(s).then(() => alert('存檔已複製到剪貼簿。'), () => prompt('請複製以下存檔文字：', s));
    },
    importSave: () => {
      const s = prompt('貼上存檔文字：');
      if (!s) return;
      try { const G = Game.deserialize(s); UI.replaceGame && UI.replaceGame(G); closeModal(); } catch (e) { alert('存檔格式不正確'); }
    },
    wipe: () => { if (confirm('確定刪除存檔？所有進度都會消失。')) { LH.noSave = true; Game.wipe(); location.reload(); } },
  };

  function moveRule(i, d) {
    const rules = UI.G.autocast.rules;
    const ids = Game.equippedSkillIds(UI.G);
    let j = i + d;
    while (j >= 0 && j < rules.length && !ids.includes(rules[j].id)) j += d;
    if (j < 0 || j >= rules.length) return;
    [rules[i], rules[j]] = [rules[j], rules[i]];
    renderCamp();
  }

  function afterRun(report) {
    if (!report) return;
    UI.lastReportShown = report.id;
    show('camp');
    showReport(report);
  }

  function initEvents() {
    // 地城畫面：滾輪拉近／拉遠
    $('stage').addEventListener('wheel', (e) => {
      e.preventDefault();
      const cur = LH.Render.R.zoom;
      let i = ZOOMS.indexOf(cur);
      if (i < 0) i = 2;
      i = Math.max(0, Math.min(ZOOMS.length - 1, i + (e.deltaY < 0 ? 1 : -1)));
      if (ZOOMS[i] === cur) return;
      setZoom(ZOOMS[i]);
      toast(`畫面大小 ${ZOOMS[i]}×（滾輪調整）`);
    }, { passive: false });
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-ws],[data-act],[data-tab],[data-cast],[data-item]');
      if (!t) return;
      LH.Sfx.unlock();
      if (t.dataset.ws) { UI.wsSel = t.dataset.ws; UI.wsMsg = null; UI.wsFlash = null; renderCamp(); sfx('click'); return; }
      if (t.dataset.tab && !t.dataset.act) { UI.tab = t.dataset.tab; renderCamp(); sfx('click'); return; }
      if (t.dataset.cast) { castManual(t.dataset.cast); return; }
      if (t.dataset.act === 'ruleOn') return; // 由 change 處理
      if (t.dataset.act === 'star' && UI.starDragged) return;
      if (t.dataset.act && ACT[t.dataset.act]) { ACT[t.dataset.act](t, e); save(); return; }
      if (t.dataset.item && UI.screen === 'camp' && !t.dataset.loot) {
        const G = UI.G;
        const inStash = G.stash.some((i) => i.id === t.dataset.item);
        if (inStash && UI.tab === 'gear' && (UI.pickMode || e.ctrlKey || e.metaKey)) {
          const it = G.stash.find((i) => i.id === t.dataset.item);
          if (Game.isProtected(G, it)) { sfx('error'); return; }
          if (UI.pick.has(it.id)) UI.pick.delete(it.id); else UI.pick.add(it.id);
          renderCamp();
          return;
        }
        UI.sel = t.dataset.item;
        if (UI.tab !== 'gear') UI.tab = 'gear';
        renderCamp();
      }
    });
    document.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'autobuy') { UI.G.exp.autoBuy = t.checked; save(); return; }
      if (t.id === 'push-chk') { UI.G.exp.push = t.checked; UI.G.idle.pushStreak = 0; save(); return; }
      if (t.id === 'gear-sort') { UI.gearSort = t.value; renderCamp(); return; }
      if (t.dataset.act === 'ruleOn') { ACT.ruleOn(t); save(); return; }
      if (t.dataset.rule != null) {
        const r = UI.G.autocast.rules[+t.dataset.rule];
        const ci = +t.dataset.c;
        if (t.dataset.f === 'k') {
          const k = t.value;
          if (k === 'none') r.cond.splice(ci, 1);
          else r.cond[ci] = k === 'enemies' ? { k, n: 3 } : k === 'hpBelow' ? { k, p: 50 } : k === 'mpAbove' ? { k, p: 60 } : { k };
          if (!r.cond.length) r.cond = [{ k: 'avail' }];
        } else r.cond[ci][t.dataset.f] = +t.value;
        renderCamp();
        save();
      }
    });
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'wave-range') {
        UI.G.exp.wave = +t.value;
        $('wave-num').textContent = t.value;
        const rk = riskLevel(UI.G, UI.G.exp.wave, Math.min(UI.G.exp.diff, UI.G.unlocked[UI.G.exp.dungeon] ?? 0), UI.G.exp.dungeon);
        const el = $('wave-risk');
        el.className = 'risk k' + rk.k;
        el.textContent = rk.label;
      }
      if (t.dataset.thr) {
        UI.G.autocast[t.dataset.thr] = +t.value / 100;
        $('thr-' + t.dataset.thr).textContent = t.value + '%';
      }
    });
    document.addEventListener('change', (e) => { if (e.target.id === 'wave-range' || e.target.dataset.thr) save(); });
    // 背包拖曳
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const t = e.target.closest('[data-loot]');
      if (!t || UI.modalKind !== 'loot') return;
      e.preventDefault();
      startDrag(e, t.dataset.loot);
    });
    document.addEventListener('pointermove', dragMove);
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('contextmenu', (e) => {
      if (UI.drag) { e.preventDefault(); UI.drag.rot = (UI.drag.rot + 1) % 4; ghostRender(); dragMove({ clientX: UI.drag.lx || e.clientX, clientY: UI.drag.ly || e.clientY }); }
      else if (UI.modalKind === 'loot' && e.target.closest('[data-loot]')) e.preventDefault();
    });
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (UI.drag && (e.key === 'r' || e.key === 'R')) {
        UI.drag.rot = (UI.drag.rot + 1) % 4;
        ghostRender();
        dragMove({ clientX: UI.drag.lx || UI.drag.sx, clientY: UI.drag.ly || UI.drag.sy });
        return;
      }
      if (UI.screen === 'dungeon' && /^[1-8]$/.test(e.key)) {
        const sk = hudSkills[+e.key - 1];
        if (sk) castManual(sk.id);
      }
      if (e.key === 'Escape' && UI.modalKind && UI.modalKind !== 'loot') closeModal();
    });
    document.addEventListener('wheel', (e) => {
      const box = e.target.closest && e.target.closest('#starmap');
      if (!box || !UI.starGeo) return;
      e.preventDefault();
      const r = box.getBoundingClientRect();
      const g = UI.starGeo;
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const px = g.ccx + (sx - g.W / 2 - UI.starPan[0]) / g.sc, py = g.ccy + (sy - g.H / 2 - UI.starPan[1]) / g.sc;
      const nz = U.clamp(UI.starZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.7, 3.5);
      const nsc = (g.sc / UI.starZoom) * nz;
      UI.starZoom = nz;
      UI.starPan = [sx - g.W / 2 - (px - g.ccx) * nsc, sy - g.H / 2 - (py - g.ccy) * nsc];
      drawStarmap();
    }, { passive: false });
    document.addEventListener('pointerdown', (e) => {
      const box = e.target.closest && e.target.closest('#starmap');
      if (!box || e.button !== 0) return;
      UI.starDrag = { x: e.clientX, y: e.clientY, pan: UI.starPan.slice(), moved: false };
      UI.starDragged = false;
    });
    document.addEventListener('pointermove', (e) => {
      const d = UI.starDrag;
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 5) return;
      d.moved = true;
      UI.starPan = [d.pan[0] + dx, d.pan[1] + dy];
      drawStarmap();
    });
    document.addEventListener('pointerup', () => {
      if (UI.starDrag && UI.starDrag.moved) { UI.starDragged = true; setTimeout(() => { UI.starDragged = false; }, 0); }
      UI.starDrag = null;
    });
    window.addEventListener('resize', () => { fitStage(); if (UI.tab === 'stars' && UI.screen === 'camp') drawStarmap(); });
  }

  function castManual(id) {
    const run = UI.G.run;
    if (!run || run.phase !== 'fight') return;
    run.manual.push(id);
    const i = hudSkills.findIndex((s) => s && s.id === id);
    const el = $('sk-' + i);
    if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }

  // ---------- 營地動畫 ----------
  let campT = 0;
// 營地場景：帳篷、寶箱、鐵砧、營火；英雄會在營地裡走動
  const CAMP = { hx: 128, tx: 128, face: 1, wait: 1.5, smoke: [], bg: null };
  function campBg(W, H) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#120b1c'); g.addColorStop(0.6, '#24183a'); g.addColorStop(1, '#1a1220');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // 後方岩壁與鐘乳石
    let s = 7;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    x.fillStyle = '#0d0814';
    x.beginPath(); x.moveTo(0, 0);
    for (let px = 0; px <= W; px += 3) {
      const y = 26 + Math.sin(px * 0.035) * 10 + Math.sin(px * 0.11) * 4;
      x.lineTo(px, y);
      if (r() < 0.12) { const w = 4 + r() * 6; x.lineTo(px + w / 2, y + 10 + r() * 26); x.lineTo(px + w, y); px += w; }
    }
    x.lineTo(W, 0); x.fill();
    x.fillStyle = '#160e22';
    x.beginPath(); x.moveTo(0, H);
    for (let px = 0; px <= W; px += 3) x.lineTo(px, 118 + Math.sin(px * 0.05 + 1) * 6 + Math.sin(px * 0.17) * 3);
    x.lineTo(W, H); x.fill();
    // 地面石板
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < W / 16 + 1; i++) {
        const px = i * 16 - (j % 2) * 8, py = 150 + j * 14;
        x.fillStyle = (i + j) % 3 === 0 ? '#2a1f33' : (i + j) % 3 === 1 ? '#251b2d' : '#2e2238';
        x.fillRect(px, py, 15, 13);
        x.fillStyle = 'rgba(255,255,255,0.04)'; x.fillRect(px, py, 15, 1);
      }
    const fade = x.createLinearGradient(0, 140, 0, 160);
    fade.addColorStop(0, 'rgba(22,14,34,1)'); fade.addColorStop(1, 'rgba(22,14,34,0)');
    x.fillStyle = fade; x.fillRect(0, 140, W, 20);
    return c;
  }
  function drawCamp(dt) {
    const cv = $('camp-cv');
    if (!cv || UI.screen !== 'camp') return;
    campT += dt;
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    const W = cv.width, H = cv.height;
    if (!CAMP.bg) CAMP.bg = campBg(W, H);
    x.drawImage(CAMP.bg, 0, 0);
    const S = LH.Spr;
    // 牆上的黑晶
    const cr = [[22, 96, 1, 26], [258, 88, 0, 28], [214, 104, 2, 20], [62, 110, 0, 18], [150, 30, 1, 16]];
    for (const [cx, cy, v, sz] of cr) {
      const col = ['127,231,255', '180,108,255', '92,255,176'][v];
      const gl = x.createRadialGradient(cx + sz / 2, cy + sz / 2, 0, cx + sz / 2, cy + sz / 2, sz * 1.6);
      gl.addColorStop(0, `rgba(${col},${0.22 + Math.sin(campT * 1.6 + cx) * 0.08})`); gl.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = gl; x.fillRect(cx - sz, cy - sz, sz * 3, sz * 3);
      if (cy < 60) { x.save(); x.translate(cx + sz / 2, cy + sz / 2); x.scale(1, -1); x.drawImage(S.get('crystal' + v), -sz / 2, -sz / 2, sz, sz); x.restore(); }
      else x.drawImage(S.get('crystal' + v), cx, cy, sz, sz);
    }
    // 營地擺設
    const shadow = (cx, w) => { x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.ellipse(cx, 156, w, 3, 0, 0, 7); x.fill(); };
    shadow(38, 30); x.drawImage(S.get('prop_tent'), 6, 94, 64, 64);
    shadow(88, 12); x.drawImage(S.get('prop_chest'), 76, 134, 24, 24);
    shadow(252, 14); x.drawImage(S.get('prop_anvil'), 238, 132, 28, 28);
    shadow(281, 10); x.drawImage(S.get('prop_barrel'), 270, 128, 24, 28);
    x.drawImage(S.get('prop_crate'), 228, 116, 20, 20);
    // 營火與火光
    const fx = 196, fy = 140;
    const fl = 1 + Math.sin(campT * 9) * 0.05 + Math.sin(campT * 23) * 0.03;
    shadow(fx, 14);
    x.drawImage(S.get('fire' + (Math.floor(campT * 8) % 3)), fx - 16, fy - 18, 32, 32);
    // 炊煙
    if (Math.random() < dt * 3) CAMP.smoke.push({ x: fx + (Math.random() - 0.5) * 6, y: fy - 16, t: 0 });
    for (const p of CAMP.smoke) {
      p.t += dt; p.y -= 14 * dt; p.x += Math.sin(p.t * 1.5) * 0.3 + 4 * dt;
      x.fillStyle = `rgba(120,105,140,${0.22 * (1 - p.t / 3.5)})`;
      const rr = 3 + p.t * 4;
      x.beginPath(); x.arc(p.x, p.y, rr, 0, 7); x.fill();
    }
    CAMP.smoke = CAMP.smoke.filter((p) => p.t < 3.5);
    // 英雄：在寶箱、營火、鐵砧之間走動
    if (CAMP.wait > 0) {
      CAMP.wait -= dt;
      if (CAMP.wait <= 0) {
        const spots = [[106, -1], [166, 1], [128, 1], [146, -1]];
        const sp = spots[Math.floor(Math.random() * spots.length)];
        CAMP.tx = sp[0]; CAMP.endFace = sp[1];
      }
    } else {
      const d = CAMP.tx - CAMP.hx;
      if (Math.abs(d) < 1) { CAMP.hx = CAMP.tx; CAMP.face = CAMP.endFace || 1; CAMP.wait = 2.5 + Math.random() * 4; }
      else { CAMP.face = Math.sign(d); CAMP.hx += Math.sign(d) * Math.min(Math.abs(d), 26 * dt); }
    }
    const hf = S.heroFrames(S.lookOf(UI.G.gear));
    const moving = CAMP.wait <= 0;
    const fr = moving ? hf.walk[Math.floor(campT * 8) % 4] : hf.idle[Math.floor(campT * 1.6) % 2];
    shadow(CAMP.hx, 10);
    x.save();
    // 主角腳踩在 y=158；主角可以放大（大頭）
    const HS = (root.LH_VIEW && root.LH_VIEW.hero) || 1, fw = fr.width * 2 * HS, fh = fr.height * 2 * HS;
    x.translate(Math.round(CAMP.hx), 158 - fh);
    if (CAMP.face < 0) x.scale(-1, 1);
    x.drawImage(fr, -fw / 2, 0, fw, fh);
    x.restore();
    const bob = fr === hf.idle[1] || fr === hf.walk[1] || fr === hf.walk[3] ? 2 : 0;
    LH.Render.drawHeld(x, UI.G.gear, Math.round(CAMP.hx) + CAMP.face * 10 * HS, 158 - (15 - bob) * HS, CAMP.face < 0 ? -1 : 1, HS);
    // 火光照亮整個營地
    x.save();
    x.globalCompositeOperation = 'lighter';
    const lg = x.createRadialGradient(fx, fy, 4, fx, fy, 150 * fl);
    lg.addColorStop(0, 'rgba(255,140,50,0.35)'); lg.addColorStop(0.5, 'rgba(255,100,40,0.1)'); lg.addColorStop(1, 'rgba(255,80,30,0)');
    x.fillStyle = lg; x.fillRect(0, 0, W, H);
    x.restore();
    // 火星
    UI.sparks = UI.sparks || [];
    if (Math.random() < dt * 9) UI.sparks.push({ x: fx + (Math.random() - 0.5) * 10, y: fy - 10, vy: -20 - Math.random() * 30, t: 0 });
    for (const s of UI.sparks) { s.t += dt; s.y += s.vy * dt; s.x += Math.sin(s.t * 6) * 0.4; x.fillStyle = `rgba(255,${Math.round(180 - s.t * 100)},80,${1 - s.t})`; x.fillRect(Math.round(s.x), Math.round(s.y), 2, 2); }
    UI.sparks = UI.sparks.filter((s) => s.t < 1);
    // 暗角與標題
    const vg = x.createRadialGradient(W / 2, H * 0.6, H * 0.3, W / 2, H * 0.6, W * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = vg; x.fillRect(0, 0, W, H);
    x.font = '900 15px "Noto Serif TC", serif';
    x.fillStyle = '#000';
    x.fillText('營　地', 13, 23);
    x.fillStyle = '#e6b955';
    x.fillText('營　地', 12, 22);
  }

  // ---------- 標題畫面 ----------
  function titleButtons(hasSave, onContinue, onNew) {
    const box = $('title-btns');
    box.innerHTML = (hasSave ? `<button class="btn gold big" id="tb-cont">繼續冒險</button>` : '') + `<button class="btn ${hasSave ? '' : 'gold big'}" id="tb-new">${hasSave ? '新的冒險（刪除舊存檔）' : '開始冒險'}</button>`;
    if (hasSave) $('tb-cont').onclick = () => { LH.Sfx.unlock(); onContinue(); };
    $('tb-new').onclick = () => {
      LH.Sfx.unlock();
      if (hasSave && !confirm('確定要開新的冒險？舊存檔會被覆蓋。')) return;
      onNew();
    };
  }

  Object.assign(UI, {
    show, renderCamp, updateHud, buildHud, openLoot, renderLoot, showReport, showOffline, closeModal, toast, fitStage,
    drawCamp, titleButtons, afterRun, initEvents, initTips, onDrop, riskLevel, itemTip, showHelp: () => ACT.help(), showNotice,
  });
  LH.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
