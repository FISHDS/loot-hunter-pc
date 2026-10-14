// 地城畫面：地圖、角色、技能特效、頭目預告、光影、傷害數字。
(function (root) {
  const LH = root.LH;
  const { D, Spr, Sim } = LH;
  const U2 = LH.U;

  const T = 32;
  const S = 2;
  // 螢幕畫布大小：電腦版 960×576；手機版在載入前設定 LH_VIEW 改成直向
  const VIEW = root.LH_VIEW || {};
  const HS = VIEW.hero || 1; // 主角放大倍數
  const SW = VIEW.w || 30 * T, SH = VIEW.h || 18 * T;
  let W = SW, H = SH; // 鏡頭看到的世界範圍（放大時變小）

  const R = {
    cv: null, ctx: null, light: null, lctx: null,
    mapCache: null, mapKey: '', parts: [], texts: [], fxs: [], beams: [], shake: 0, time: 0,
    onDrop: null, hitstop: 0, banner: null, heroDead: 0, levelT: 0, atk: {}, lastPos: {}, flashT: 0, zoom: 1.5, atkLen: 0.24, labels: [],
  };

  function init(canvas) {
    R.cv = canvas;
    canvas.width = SW; canvas.height = SH;
    R.sctx = canvas.getContext('2d');
    R.wcv = document.createElement('canvas');
    R.light = document.createElement('canvas');
    setZoom(R.zoom);
  }
  // 鏡頭遠近：1 = 原本大小，1.5 = 預設放大
  function setZoom(z) {
    R.zoom = z;
    W = Math.round(SW / z); H = Math.round(SH / z);
    R.wcv.width = W; R.wcv.height = H;
    R.ctx = R.wcv.getContext('2d');
    R.ctx.imageSmoothingEnabled = false;
    R.light.width = W; R.light.height = H;
    R.lctx = R.light.getContext('2d');
    R.vig = null; R.dust = null; R.camX = null;
  }

  function reset() {
    R.parts = []; R.texts = []; R.fxs = []; R.beams = []; R.shake = 0; R.heroDead = 0; R.camX = null;
  }

  const cx = (x) => x * T + T / 2;
  const cy = (y) => y * T + T / 2;
  const ease = (t) => t * t * (3 - 2 * t);

  function entPos(e) {
    const t = ease(Math.min(1, e.mt));
    return [(e.px + (e.x - e.px) * t) * T, (e.py + (e.y - e.py) * t) * T];
  }

  // ---------- 地圖預先繪製 ----------
  // 畫面用的固定亂數與平滑雜訊：只影響裝飾擺放，不影響戰鬥結果
  function smoothNoise(seed) {
    const hs = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return n - Math.floor(n); };
    return (px, py) => {
      const i = Math.floor(px), j = Math.floor(py), fx = px - i, fy = py - j;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = hs(i, j), b = hs(i + 1, j), c = hs(i, j + 1), d = hs(i + 1, j + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }
  function binarize(c) {
    const x = c.getContext('2d');
    const img = x.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
    x.putImageData(img, 0, 0);
  }
  // 牆邊陰影的漸層小圖（只做一次）
  const AO = {};
  function aoStamp(dir) {
    if (AO[dir]) return AO[dir];
    const c = document.createElement('canvas');
    const vert = dir === 'top' || dir === 'bottom';
    const len = { top: 14, bottom: 6, left: 9, right: 9 }[dir], a = { top: 0.55, bottom: 0.3, left: 0.4, right: 0.35 }[dir];
    c.width = vert ? T : len; c.height = vert ? len : T;
    const x = c.getContext('2d');
    const g = dir === 'top' ? x.createLinearGradient(0, 0, 0, len) : dir === 'bottom' ? x.createLinearGradient(0, len, 0, 0)
      : dir === 'left' ? x.createLinearGradient(0, 0, len, 0) : x.createLinearGradient(len, 0, 0, 0);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    return (AO[dir] = c);
  }
  // 沼澤：用圓角色塊畫出泥岸與水面，邊緣自然不方正
  function swampLayer(map, key, cols) {
    key = key || 'slow';
    cols = cols || { rim: '#2b3122', mid: '#1c3222', deep: '#13241a', spot: [0x3a, 0x44, 0x2a], fleck: [0x46, 0x6e, 0x40], line: [0x3c, 0x5e, 0x3a] };
    const k = 16, MW = map.w, MH = map.h;
    const cells = map[key];
    const blob = (r, w, col) => {
      const c = document.createElement('canvas');
      c.width = MW * k; c.height = MH * k;
      const x = c.getContext('2d');
      x.fillStyle = col;
      for (let i = 0; i < MW * MH; i++) {
        if (!cells[i]) continue;
        const a = i % MW, b = (i / MW) | 0, px = a * k + 8, py = b * k + 8;
        x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
        const R1 = a + 1 < MW && cells[i + 1], D1 = cells[i + MW];
        if (R1) x.fillRect(px, py - w / 2, k, w);
        if (D1) x.fillRect(px - w / 2, py, w, k);
        if (R1 && D1 && cells[i + MW + 1]) x.fillRect(px, py, k, k);
      }
      binarize(c);
      return c;
    };
    const mud = blob(10.5, 21, cols.rim);
    const water = blob(7.5, 15, cols.mid);
    const deep = blob(4.5, 9, cols.deep);
    const rimR = parseInt(cols.rim.slice(1, 3), 16);
    const out = document.createElement('canvas');
    out.width = MW * k; out.height = MH * k;
    const o = out.getContext('2d');
    o.drawImage(mud, 0, 0); o.drawImage(water, 0, 0); o.drawImage(deep, 0, 0);
    // 水面斑點與一道道反光
    const img = o.getImageData(0, 0, out.width, out.height);
    const d = img.data;
    for (let py = 0; py < out.height; py++)
      for (let px = 0; px < out.width; px++) {
        const i = (py * out.width + px) * 4;
        if (!d[i + 3]) continue;
        const n = (Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1;
        const put = (c) => { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; };
        if (d[i] === rimR) {
          if (Math.abs(n) > 0.85) put(cols.spot);
        } else if (Math.abs(n) > 0.93) put(cols.fleck);
        else if (py % 5 === 0 && Math.abs(Math.sin((px >> 3) * 2.3 + py * 0.37)) > 0.985) put(cols.line);
      }
    o.putImageData(img, 0, 0);
    return out;
  }

  function buildMap(run) {
    const map = Sim.mapOf(run);
    const bog = map.theme === 'bog';
    const forge = map.theme === 'forge';
    const obs = map.theme === 'observatory';
    const pre = bog ? 'bog_' : forge ? 'forge_' : obs ? 'observatory_' : '';
    const starAt = (i, j) => !!(map.star && !wall(i, j) && map.star[j * MW + i]);
    const MW = map.w, MH = map.h, N = MW * MH;
    const lavaAt = (i, j) => !!(map.lava && !wall(i, j) && map.lava[j * MW + i]);
    const wall = (i, j) => i < 0 || j < 0 || i >= MW || j >= MH || map.t[j * MW + i] === 1;
    const slow = (i, j) => !!(map.slow && !wall(i, j) && map.slow[j * MW + i]);
    const h = { rng: U2.hashStr(run.dungeon + ':' + run.floor + ':art') };
    const rnd = () => U2.rand(h);
    const c = document.createElement('canvas');
    c.width = MW * T; c.height = MH * T;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#0d0a12';
    x.fillRect(0, 0, c.width, c.height);

    // 1. 地面磚＋大範圍明暗（地面不再一片均勻）
    const vn = smoothNoise(h.rng % 997);
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        if (wall(i, j)) continue;
        x.drawImage(Spr.get(pre + 'floor' + map.shade[j * MW + i]), i * T, j * T, T, T);
        for (let b = 0; b < 2; b++)
          for (let a = 0; a < 2; a++) {
            const n = vn((i * 2 + a) / 9, (j * 2 + b) / 9);
            if (n < 0.42) { x.fillStyle = `rgba(0,0,0,${((0.42 - n) * 0.55).toFixed(3)})`; x.fillRect(i * T + a * 16, j * T + b * 16, 16, 16); }
            else if (n > 0.66) { x.fillStyle = bog ? `rgba(80,120,60,${((n - 0.66) * 0.35).toFixed(3)})` : obs ? `rgba(90,110,220,${((n - 0.66) * 0.32).toFixed(3)})` : forge ? `rgba(200,90,30,${((n - 0.66) * 0.3).toFixed(3)})` : `rgba(130,110,160,${((n - 0.66) * 0.3).toFixed(3)})`; x.fillRect(i * T + a * 16, j * T + b * 16, 16, 16); }
          }
      }
    // 2. 地面細節：裂縫、水窪、青苔、小石子
    for (let j = 1; j < MH - 1; j++)
      for (let i = 1; i < MW - 1; i++) {
        if (wall(i, j) || slow(i, j) || lavaAt(i, j) || starAt(i, j)) continue;
        const r = rnd();
        const px = i * T, py = j * T;
        if (obs) {
          // 地上的星塵與刻在石板上的星圖線條
          if (r < 0.08) { x.fillStyle = 'rgba(170,200,255,0.45)'; for (let s = 0; s < 3; s++) x.fillRect(px + Math.round(rnd() * 14) * 2, py + Math.round(rnd() * 14) * 2, 1, 1); }
          else if (r < 0.1) { x.strokeStyle = 'rgba(140,170,255,0.18)'; x.lineWidth = 1; x.beginPath(); x.arc(px + T / 2, py + T / 2, 10, 0, 7); x.stroke(); }
          continue;
        }
        if (r < 0.03) {
          x.fillStyle = 'rgba(8,6,12,0.55)';
          let cx2 = px + 6 + rnd() * 12, cy2 = py + 6 + rnd() * 12;
          for (let s = 0; s < 6; s++) { x.fillRect(Math.round(cx2 / 2) * 2, Math.round(cy2 / 2) * 2, 2, 2); cx2 += 2 + rnd() * 2; cy2 += (rnd() - 0.5) * 6; }
        } else if (r < 0.06 && forge) {
          // 地上的煤灰與火星
          x.fillStyle = 'rgba(10,6,4,0.5)';
          x.fillRect(px + 6, py + 10, 18, 8); x.fillRect(px + 10, py + 8, 10, 12);
          x.fillStyle = '#ff7a2e'; x.fillRect(px + 12, py + 12, 2, 2);
        } else if (r < 0.042 && !bog && !forge) {
          x.fillStyle = 'rgba(14,20,34,0.85)';
          x.fillRect(px + 6, py + 12, 20, 8); x.fillRect(px + 10, py + 10, 12, 12);
          x.fillStyle = 'rgba(90,120,170,0.35)'; x.fillRect(px + 10, py + 12, 8, 2);
        } else if (r < 0.08 && bog) {
          x.fillStyle = 'rgba(70,110,50,0.3)';
          for (let s = 0; s < 5; s++) x.fillRect(px + Math.round(rnd() * 12) * 2, py + Math.round(rnd() * 12) * 2, 4, 2);
        } else if (r < 0.12) {
          x.fillStyle = bog ? '#2e3a2a' : '#3a3142';
          x.fillRect(px + Math.round(rnd() * 13) * 2, py + Math.round(rnd() * 13) * 2, 2, 2);
          x.fillRect(px + Math.round(rnd() * 13) * 2, py + Math.round(rnd() * 13) * 2, 2, 2);
        }
      }
    // 3. 沼澤
    if (map.slow) { x.imageSmoothingEnabled = false; x.drawImage(swampLayer(map), 0, 0, MW * T, MH * T); }
    if (map.star) {
      x.imageSmoothingEnabled = false;
      x.drawImage(swampLayer(map, 'star', { rim: '#1c2a5a', mid: '#2a46a0', deep: '#4a78ee', spot: [0x6a, 0x9a, 0xff], fleck: [0xe8, 0xf0, 0xff], line: [0xa0, 0xc4, 0xff] }), 0, 0, MW * T, MH * T);
    }
    if (map.lava) {
      x.imageSmoothingEnabled = false;
      x.drawImage(swampLayer(map, 'lava', { rim: '#3a1a0e', mid: '#c2410c', deep: '#ff8a1e', spot: [0x5a, 0x2a, 0x14], fleck: [0xff, 0xd3, 0x6b], line: [0xff, 0xb3, 0x47] }), 0, 0, MW * T, MH * T);
    }

    // 4. 礦坑軌道（畫在地上，人可以踩過去）
    const occ = new Uint8Array(N);
    for (const d of map.deco) occ[d.y * MW + d.x] = 1;
    const [sx0, sy0] = map.start;
    const props = [];
    if (!bog && !forge && !obs) {
      const rooms = U2.shuffle(h, map.rooms.slice(1));
      let laid = 0;
      for (const [rx, ry] of rooms) {
        if (laid >= 3) break;
        let a = rx, b = rx;
        while (!wall(a - 1, ry) && rx - a < 9) a--;
        while (!wall(b + 1, ry) && b - rx < 9) b++;
        if (b - a < 5) continue;
        laid++;
        for (let i = a; i <= b; i++) {
          const px = i * T, py = ry * T;
          x.fillStyle = '#3a2414';
          for (let k = 0; k < 4; k++) x.fillRect(px + k * 8 + 2, py + 8, 4, 18);
          x.fillStyle = '#4b505c'; x.fillRect(px, py + 11, T, 2); x.fillRect(px, py + 21, T, 2);
          x.fillStyle = '#aab0ba'; x.fillRect(px, py + 10, T, 1); x.fillRect(px, py + 20, T, 1);
          occ[ry * MW + i] = 1;
        }
        const ci = rnd() < 0.5 ? a + 1 : b - 1;
        if (U2.cheb(ci, ry, sx0, sy0) > 2) props.push({ i: ci, j: ry, n: 'cart', dy: -4 });
      }
    }

    // 5. 牆邊陰影
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        if (wall(i, j)) continue;
        const px = i * T, py = j * T;
        if (wall(i, j - 1)) x.drawImage(aoStamp('top'), px, py);
        if (wall(i, j + 1)) x.drawImage(aoStamp('bottom'), px, py + T - 6);
        if (wall(i - 1, j)) x.drawImage(aoStamp('left'), px, py);
        if (wall(i + 1, j)) x.drawImage(aoStamp('right'), px + T - 9, py);
        for (const [dx, dy] of [[-1, -1], [1, -1]]) {
          if (!wall(i + dx, j + dy) || wall(i + dx, j) || wall(i, j + dy)) continue;
          const gx = px + (dx > 0 ? T : 0), gy = py;
          const g = x.createRadialGradient(gx, gy, 0, gx, gy, 12);
          g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = g; x.fillRect(gx - 12, gy, 24, 12);
        }
      }

    // 6. 岩壁：離地面越遠越暗，靠地面的邊緣有一圈亮邊
    const depth = new Uint8Array(N).fill(9);
    const q = [];
    for (let i = 0; i < N; i++) if (!map.t[i]) { depth[i] = 0; q.push(i); }
    for (let head = 0; head < q.length; head++) {
      const cI = q[head], ci = cI % MW, cj = (cI / MW) | 0;
      if (depth[cI] >= 4) continue;
      for (const [dx, dy] of U2.DIRS8) {
        const ni = ci + dx, nj = cj + dy;
        if (ni < 0 || nj < 0 || ni >= MW || nj >= MH) continue;
        const k2 = nj * MW + ni;
        if (depth[k2] > depth[cI] + 1) { depth[k2] = depth[cI] + 1; q.push(k2); }
      }
    }
    const P = bog ? { rim: 'rgba(110,150,100,0.32)', rimTop: 'rgba(130,170,110,0.45)', side: 'rgba(0,0,0,0.35)' }
      : obs ? { rim: 'rgba(120,150,230,0.3)', rimTop: 'rgba(150,180,255,0.42)', side: 'rgba(0,0,0,0.35)' }
      : { rim: 'rgba(150,125,180,0.3)', rimTop: 'rgba(170,145,200,0.42)', side: 'rgba(0,0,0,0.35)' };
    const DARK = [0, 0, 0.28, 0.48, 0.62];
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        if (!wall(i, j)) continue;
        const idx = j * MW + i, px = i * T, py = j * T;
        const v = map.shade[idx];
        const face = j + 1 < MH && !wall(i, j + 1);
        x.drawImage(Spr.get(pre + (face ? 'wallface' + v : 'wall' + v)), px, py, T, T);
        if (face) {
          if (!wall(i - 1, j)) { x.fillStyle = P.side; x.fillRect(px, py, 3, T); }
          if (!wall(i + 1, j)) { x.fillStyle = P.side; x.fillRect(px + T - 3, py, 3, T); }
          if (!wall(i, j - 1)) { x.fillStyle = P.rimTop; x.fillRect(px, py, T, 2); }
          // 礦脈：立面上偶爾嵌著發光的黑晶
          if (!bog && rnd() < 0.06) {
            x.fillStyle = '#3b2f6b'; x.fillRect(px + 8 + v * 4, py + 12, 6, 4); x.fillRect(px + 12 + v * 4, py + 10, 4, 8);
            x.fillStyle = '#b46cff'; x.fillRect(px + 12 + v * 4, py + 12, 2, 2);
          }
          continue;
        }
        const dd = Math.min(4, depth[idx]);
        if (dd >= 2) { x.fillStyle = `rgba(4,2,8,${DARK[dd]})`; x.fillRect(px, py, T, T); }
        if (!wall(i, j - 1)) { x.fillStyle = P.rimTop; x.fillRect(px, py, T, 2); }
        if (!wall(i - 1, j)) { x.fillStyle = P.rim; x.fillRect(px, py, 2, T); }
        if (!wall(i + 1, j)) { x.fillStyle = P.rim; x.fillRect(px + T - 2, py, 2, T); }
      }

    // 7. 小物件：牆上的燈籠、支架、樹根；靠牆的木箱、礦車、墓碑、棺材；沼澤邊的蘆葦
    const faces = [], against = [], shore = [];
    for (let j = 1; j < MH - 1; j++)
      for (let i = 1; i < MW - 1; i++) {
        const idx = j * MW + i;
        if (wall(i, j)) { if (!wall(i, j + 1)) faces.push([i, j]); continue; }
        if (U2.cheb(i, j, sx0, sy0) < 3 || occ[idx]) continue;
        if (slow(i, j) || lavaAt(i, j) || starAt(i, j)) continue;
        if (wall(i, j - 1)) against.push([i, j]);
        else if (bog && (slow(i + 1, j) || slow(i - 1, j) || slow(i, j + 1) || slow(i, j - 1))) shore.push([i, j]);
      }
    U2.shuffle(h, faces); U2.shuffle(h, against); U2.shuffle(h, shore);
    const lamps = [], glows = [];
    const far = (list, i, j, d) => list.every(([a, b]) => U2.cheb(a, b, i, j) >= d);
    for (const [i, j] of faces) {
      const idx = j * MW + i;
      if (occ[idx]) continue;
      if (forge) { if (rnd() < 0.14) { props.push({ i, j, n: 'chains', dy: 2 }); occ[idx] = 2; } continue; }
      if (obs) { if (rnd() < 0.1) { props.push({ i, j, n: 'starchart', dy: 2 }); occ[idx] = 2; } continue; }
      if (!bog && far(lamps, i, j, 8) && rnd() < 0.6) { lamps.push([i, j]); props.push({ i, j, n: 'lantern', dy: 4 }); occ[idx] = 2; }
      else if (!bog && rnd() < 0.06 && far(lamps, i, j, 2)) { props.push({ i, j, n: 'support', dy: 0 }); occ[idx] = 2; }
      else if (bog && rnd() < 0.2) { props.push({ i, j, n: 'roots', dy: 2 }); occ[idx] = 2; }
    }
    const pool = bog ? [['grave0', 3], ['grave1', 3], ['grave2', 2], ['coffin', 1.2], ['bonepile', 2], ['stump', 1.5], ['mushroom', 2]]
      : forge ? [['anvil', 2.5], ['bucket', 2], ['cog', 2], ['barrel', 1.5], ['crate', 1.5], ['brazier', 2]]
      : obs ? [['telescope', 2], ['orrery', 1.5], ['crystalBall', 2], ['pillar', 2.5], ['crate', 1]]
      : [['crate', 3], ['barrel', 2.5], ['pick', 1.5], ['ore', 2.5]];
    for (const [i, j] of against) {
      const idx = j * MW + i;
      if (occ[idx] || occ[idx - 1] || occ[idx + 1] || rnd() > 0.13) continue;
      let n = U2.weighted(h, pool);
      if ((n === 'mushroom' || n === 'brazier' || n === 'crystalBall') && !far(glows, i, j, 6)) n = forge ? 'cog' : obs ? 'pillar' : 'grave0';
      if (n === 'mushroom' || n === 'brazier' || n === 'crystalBall') glows.push([i, j]);
      props.push({ i, j, n, dy: n === 'coffin' ? 0 : -6, shadow: true });
      occ[idx] = 1;
    }
    for (const [i, j] of shore) {
      const idx = j * MW + i;
      if (occ[idx] || rnd() > 0.3) continue;
      props.push({ i, j, n: 'reeds', dy: -4 });
      occ[idx] = 1;
    }
    // 牆角蜘蛛網
    x.strokeStyle = 'rgba(220,215,235,0.2)';
    x.lineWidth = 1;
    for (const [i, j] of against) {
      if (!wall(i - 1, j) || rnd() > 0.45) continue;
      const px = i * T, py = j * T;
      x.beginPath();
      for (let a = 0; a <= 4; a++) { const an = (a / 4) * Math.PI / 2; x.moveTo(px, py); x.lineTo(px + Math.cos(an) * 18, py + Math.sin(an) * 18); }
      for (const rr of [6, 11, 16]) { x.moveTo(px + rr, py); for (let a = 1; a <= 4; a++) { const an = (a / 4) * Math.PI / 2; x.lineTo(px + Math.cos(an) * rr, py + Math.sin(an) * rr); } }
      x.stroke();
    }
    // 原本的裝飾（黑晶、碎石、骨頭）
    for (const d of map.deco) {
      if (d.k === 'crystal') x.drawImage(Spr.get((bog ? 'wisp' : forge ? 'ember' : 'crystal') + d.v), d.x * T, d.y * T - 6, T, T);
      if (d.k === 'rubble') x.drawImage(Spr.get('rubble' + d.v), d.x * T, d.y * T, T, T);
      if (d.k === 'bones') x.drawImage(Spr.get('bones'), d.x * T, d.y * T, T, T);
    }
    props.sort((a, b) => a.j - b.j);
    for (const p of props) {
      if (p.shadow) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.ellipse(p.i * T + T / 2, p.j * T + T - 6, 11, 4, 0, 0, 7); x.fill(); }
      x.drawImage(Spr.get('prop_' + p.n), p.i * T, p.j * T + p.dy, T, T);
    }

    R.mapCache = c;
    R.fogN = -1;
    R.miniN = -1;
    R.camX = null;
    const lc = bog ? ['120,255,140', '110,230,220', '200,255,120'] : obs ? ['140,180,255', '180,140,255', '200,230,255'] : forge ? ['255,140,50', '255,100,40', '255,180,80'] : ['127,231,255', '180,108,255', '92,255,176'];
    R.lights = map.deco.filter((d) => d.k === 'crystal').map((d) => ({ x: cx(d.x), y: cy(d.y) - 4, col: lc[d.v], ph: rnd() * 6 }));
    for (const [i, j] of lamps) R.lights.push({ x: cx(i), y: j * T + 22, col: '255,176,84', ph: rnd() * 6, r: 100, fl: true });
    for (const [i, j] of glows) R.lights.push({ x: cx(i), y: cy(j) - 6, col: forge ? '255,150,60' : obs ? '130,170,255' : '90,255,215', ph: rnd() * 6, r: forge ? 80 : 64, fl: forge });
    // 星光也會發光
    R.stars = [];
    if (map.star) for (let i = 0; i < N; i++) if (map.star[i]) {
      const a = i % MW, b = (i / MW) | 0;
      R.stars.push([a, b]);
      if ((a + b * 3) % 4 === 0) R.lights.push({ x: cx(a), y: cy(b), col: '120,160,255', ph: rnd() * 6, r: 60 });
    }
    // 熔岩本身也會發光（每隔幾格放一個光源）
    R.lavas = [];
    if (map.lava) for (let i = 0; i < N; i++) if (map.lava[i]) {
      const a = i % MW, b = (i / MW) | 0;
      R.lavas.push([a, b]);
      if ((a + b * 3) % 4 === 0) R.lights.push({ x: cx(a), y: cy(b), col: '255,110,30', ph: rnd() * 6, r: 56 });
    }
    R.swamps = [];
    R.ripples = [];
    if (map.slow) for (let i = 0; i < N; i++) if (map.slow[i]) R.swamps.push([i % MW, (i / MW) | 0]);
  }

  // ---------- 特效事件 ----------
  // 低畫質：粒子減半、不用模糊濾鏡（手機省電）
  function part(o) { if (R.low && Math.random() < 0.5) return; R.parts.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 0.6, t: 0, size: 3, col: '#fff' }, o)); }
  function text(x, y, s, col, big) { R.texts.push({ x, y, s, col, big, t: 0, life: big ? 1.0 : 0.8, vx: (Math.random() - 0.5) * 20 }); }
  // 傷害數字：同一隻怪短時間內連續受傷就合併成一個數字（有技能命中就變大字）；
  // 從頭頂上方冒出，先找沒有被別的數字佔住的位置，不蓋住怪物
  const DMG_CAP = 20;
  function dmgText(e, col) {
    const S = LH.UI && LH.UI.G && LH.UI.G.settings;
    const mode = (S && S.dmgNum) || 'all';
    if (mode === 'off' || (mode === 'big' && !e.big)) return;
    const key = e.id != null ? e.id + (e.dot ? 'd' : 'h') : null;
    if (key) {
      // 只合併剛冒出 0.5 秒內的數字；一直被打的怪（例如頭目）每 0.5 秒換一個新數字飄走
      const old = R.texts.find((q) => q.key === key && R.time - q.born < (e.dot ? 0.9 : 0.5));
      if (old) {
        old.v += e.v; old.s = String(old.v);
        if (e.big && !old.big) { old.big = true; old.col = col; old.life = 1.0; }
        else if (!old.big) old.col = col;
        old.t = Math.min(old.t, 0.12);
        return;
      }
    }
    const X = cx(e.x), Y = cy(e.y);
    const dmgs = R.texts.filter((q) => q.v != null);
    if (dmgs.length >= DMG_CAP) {
      // 太多了：踢掉最小的一個；新的比它還小就乾脆不顯示
      let lo = null;
      for (const q of dmgs) if (!q.big && (!lo || q.v < lo.v)) lo = q;
      if (!lo || lo.v > e.v) return;
      R.texts.splice(R.texts.indexOf(lo), 1);
    }
    R.dmgSide = -(R.dmgSide || 1);
    const ox = e.dot ? 12 : R.dmgSide * (4 + Math.random() * 4);
    // 往上找空位：跟畫面上其他數字太近就再往上一層（最多 4 層）
    let y = Y - 26;
    const hw = e.big ? 20 : 13;
    for (let k = 0; k < 4; k++) {
      const hit = dmgs.some((q) => q.cy != null && Math.abs(q.cx - (X + ox)) < hw + (q.big ? 20 : 13) && Math.abs(q.cy - y) < (e.big || q.big ? 16 : 11));
      if (!hit) break;
      y -= e.big ? 16 : 12;
    }
    R.texts.push({
      x: X + ox, y, s: String(e.v), v: e.v, col, big: e.big, dot: e.dot, key, born: R.time,
      t: 0, life: e.dot ? 0.75 : e.big ? 1.0 : 0.75, vx: ox * 0.6,
    });
  }
  function burst(x, y, col, n, spd, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random());
      part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 120, col, life: life * (0.6 + Math.random() * 0.6), size: 2 + Math.random() * 3 });
    }
  }

  // 主角頭頂上方（從格子中心往上算）：主角受傷、閃避、格擋的字從這裡冒出，不蓋住臉
  function heroHead() { return (Spr.HERO.h + Spr.HERO.top) * 2 * HS - T / 2 + 4; }

  function consume(run) {
    const sfx = LH.Sfx;
    for (const e of run.fx) {
      switch (e.k) {
        case 'dmg': {
          const col = e.dot ? '#ff9a4a' : D.ELEM_COLOR[e.elem];
          dmgText(e, col);
          if (!e.dot) hitSpark(cx(e.x), cy(e.y), col, e.big);
          if (e.big) sfx && sfx.play('hit', { elem: e.elem });
          break;
        }
        case 'hurt':
          text(cx(e.x), cy(e.y) - heroHead(), '-' + e.v, '#ff4a4a', e.v > 12);
          burst(cx(e.x), cy(e.y), '#c0202a', 5, 70, 0.4);
          R.hurtFlash = 0.25;
          if (e.v > 15) R.shake = Math.max(R.shake, 4);
          sfx && sfx.play('hurt');
          break;
        case 'miss': text(cx(e.x), cy(e.y) - heroHead(), '閃避', '#e8e8f0'); break;
        case 'block': text(cx(e.x), cy(e.y) - heroHead(), '格擋', '#c9d1db'); sfx && sfx.play('block'); break;
        case 'swing': {
          const wb = heroWeapon(run).base;
          const heavy = wb === 'hammer', stab = wb === 'knife' || wb === 'dagger';
          R.atkLen = heavy ? 0.36 : stab ? 0.2 : 0.24;
          R.atk.hero = R.atkLen;
          R.hamHit = false;
          const ang = Math.atan2(e.to[1] - e.from[1], e.to[0] - e.from[0]);
          if (stab) R.fxs.push({ k: 'crescent', x: cx(e.from[0]), y: cy(e.from[1]), ang, r: T * 0.65, t: 0, life: 0.1, col: '#ffffff', w: 0.28 });
          else if (!heavy) R.fxs.push({ k: 'crescent', x: cx(e.from[0]), y: cy(e.from[1]), ang, r: T * 1.05, t: 0, life: 0.17, col: '#ffffff', w: 0.55 });
          sfx && sfx.play(heavy ? 'swingHeavy' : stab ? 'stab' : 'swing');
          break;
        }
        case 'shot':
          R.atkLen = 0.24;
          R.atk.hero = 0.24;
          R.fxs.push({ k: 'proj', from: e.from, to: e.to, t: 0, life: 0.14, col: e.kind === 'staff' ? D.ELEM_COLOR[e.elem] : '#e8e0d0', orb: e.kind === 'staff' });
          sfx && sfx.play(e.kind === 'staff' ? 'zap' : 'bow');
          break;
        case 'mobShot':
          if (e.id) R.atk[e.id] = 0.24;
          R.fxs.push({ k: 'proj', from: e.from, to: e.to, t: 0, life: 0.2, col: e.type === 'crossbow' ? '#b9a88a' : '#c77dff', orb: e.type !== 'crossbow' });
          break;
        case 'mobHit':
          if (e.id) R.atk[e.id] = 0.24;
          R.fxs.push({ k: 'claw', x: cx(e.to[0]), y: cy(e.to[1]), t: 0, life: 0.2, boss: e.boss });
          break;
        case 'skill': skillFx(e); sfx && sfx.play('skill_' + e.id); break;
        case 'interrupt':
          text(cx(e.x), cy(e.y) - 34, e.weak ? '削弱！' : '打斷！', '#ffe85c', true);
          burst(cx(e.x), cy(e.y), '#ffe85c', 14, 160, 0.5);
          sfx && sfx.play('interrupt');
          break;
        case 'death':
          shatter(e);
          if (e.w > 1) {
            R.shake = 16;
            R.flashT = 0.5;
            R.fxs.push({ k: 'shock', x: cx(e.x) + T / 2, y: cy(e.y) + T / 2, t: 0, life: 0.9, r: T * 7, col: '#ffffff' });
            sfx && sfx.play('bossDie');
          } else sfx && sfx.play('die');
          break;
        case 'drop': {
          // 好東西要有排場：史詩以上光柱變粗變久，傳說以上畫面頓一下，傳奇寶物再加上金色大字
          const uq = !!e.uq;
          const col = uq ? D.UNIQ_COLOR : D.RARITY[e.r].color;
          const bx = cx(e.x), by = cy(e.y);
          R.beams.push({ x: bx, y: by, col, r: uq ? 7 : e.r, t: 0, life: uq ? 6 : e.r >= 4 ? 3.6 : e.r >= 3 ? 2.6 : 1.4 + e.r * 0.35, uq });
          burst(bx, by, col, uq ? 60 : 8 + e.r * 6, uq ? 320 : 120 + e.r * 30, uq ? 1.4 : 0.9);
          if (uq) {
            R.banner = { s: e.uq, isNew: !!e.isNew, t: 0, life: 3.6 };
            R.hitstop = 0.5;
            R.flashT = Math.max(R.flashT, 0.35);
            R.shake = Math.max(R.shake, 10);
            R.fxs.push({ k: 'shock', x: bx, y: by, t: 0, life: 1.0, r: T * 7, col: '#ffe08a' });
            sfx && sfx.play('uniq');
          } else {
            if (e.r >= 4) {
              R.hitstop = Math.max(R.hitstop, 0.18);
              R.shake = Math.max(R.shake, 5);
              R.fxs.push({ k: 'shock', x: bx, y: by, t: 0, life: 0.7, r: T * 4, col });
            }
            sfx && sfx.play('drop', { r: e.r });
          }
          if (R.onDrop) R.onDrop(uq ? 'uq' : e.r, (bx - (R.camX || 0)) / W, (by - (R.camY || 0)) / H);
          break;
        }
        case 'explode':
          burst(cx(e.x), cy(e.y), '#ff7a2e', 18, 200, 0.5);
          R.fxs.push({ k: 'shock', x: cx(e.x), y: cy(e.y), t: 0, life: 0.4, r: T * 1.6, col: '#ffb347' });
          sfx && sfx.play('explode');
          break;
        case 'omen': sfx && sfx.play('omen'); break;
        case 'omenHit':
          for (const [ox2, oy2] of e.cells) burst(cx(ox2), cy(oy2), '#bfd4ff', 3, 140, 0.5);
          R.fxs.push({ k: 'cells', cells: e.cells, col: '#8fb4ff', t: 0, life: 0.35, strong: true });
          R.fxs.push({ k: 'shock', x: cx(e.x), y: cy(e.y), t: 0, life: 0.5, r: T * 2.2, col: '#dfe8ff' });
          R.shake = Math.max(R.shake, 7);
          sfx && sfx.play('slam');
          break;
        case 'pull': {
          const [fx1, fy1] = e.from, [tx1, ty1] = e.to;
          for (let i = 0; i < 14; i++) { const k = i / 14; part({ k: 'glow', x: cx(fx1) + (cx(tx1) - cx(fx1)) * k, y: cy(fy1) + (cy(ty1) - cy(fy1)) * k, col: '#9ab8ff', life: 0.5, size: 5, still: true }); }
          R.shake = Math.max(R.shake, 6);
          text(cx(tx1), cy(ty1) - 40, '被吸過去了！', '#bfd4ff', true);
          break;
        }
        case 'twin': text(cx(e.x), cy(e.y) - 40, '冷卻重置！', D.UNIQ_COLOR, true); break;
        case 'unyield':
          text(cx(e.x), cy(e.y) - 40, '不屈！', '#e8eef7', true);
          burst(cx(e.x), cy(e.y), '#c9d1db', 16, 140, 0.6);
          break;
        case 'spawn': burst(cx(e.x), cy(e.y), '#3a2a44', 6, 50, 0.6); break;
        case 'potion':
          for (let i = 0; i < 10; i++) part({ hero: true, ox: (Math.random() - 0.5) * 24, oy: 0, vy: -40 - Math.random() * 30, col: e.kind === 'red' ? '#ff5a5a' : '#6aa8ff', life: 0.8, size: 3 });
          sfx && sfx.play('potion');
          break;
        case 'tele': R.shake = Math.max(R.shake, 3); sfx && sfx.play('tele'); break;
        case 'bossMove': bossMoveFx(e); break;
        case 'thunder': R.fxs.push({ k: 'thunder', x: cx(e.at[0]), y: cy(e.at[1]), t: 0, life: 0.3 }); sfx && sfx.play('skill_bolt'); break;
        case 'shards': burst(cx(e.x), cy(e.y), '#b46cff', 12, 180, 0.4); break;
        case 'mobHeal':
          for (let i = 0; i < (e.big ? 16 : 6); i++) part({ x: cx(e.x) + (Math.random() - 0.5) * (e.big ? 50 : 20), y: cy(e.y), vy: -40 - Math.random() * 30, col: '#6aff8a', life: 0.8, size: 3 });
          break;
        case 'levelup': R.levelT = 1.6; sfx && sfx.play('level'); break;
        case 'heroDeath': R.heroDead = 0.01; R.shake = 12; sfx && sfx.play('heroDie'); break;
        case 'bossIntro': R.shake = 8; sfx && sfx.play('bossIntro'); break;
      }
    }
    run.fx.length = 0;
  }

  function skillFx(e) {
    const col = D.ELEM_COLOR[D.SKILLS[e.id].elem];
    const s = D.SKILLS[e.id];
    const from = e.from;
    const fx0 = cx(from[0]), fy0 = cy(from[1]);
    if (e.cells.length) R.fxs.push({ k: 'cells', cells: e.cells, col, t: 0, life: 0.35 });
    R.atkLen = 0.26;
    R.atk.hero = 0.26;
    R.hamHit = false;
    if (s.shape.t === 'line') {
      const last = e.cells[e.cells.length - 1] || from;
      const ang = Math.atan2(last[1] - from[1], last[0] - from[0]);
      const len = Math.hypot(last[0] - from[0], last[1] - from[1]) * T;
      if (e.id === 'bolt') {
        R.fxs.push({ k: 'lightning', from, to: last, t: 0, life: 0.32, col: '#fff6a0', seed: Math.random() * 1000 });
        for (const [x, y] of e.cells) glowP(cx(x), cy(y), '#ffe85c', 22, 0.35);
      } else if (e.id === 'pierce') {
        R.fxs.push({ k: 'beam', from, to: last, t: 0, life: 0.3, col: '#fff3c4', w: 7 });
        for (const [x, y] of e.cells) for (let i = 0; i < 3; i++) part({ k: 'streak', x: cx(x), y: cy(y), vx: Math.cos(ang) * 260 + (Math.random() - 0.5) * 60, vy: Math.sin(ang) * 260 + (Math.random() - 0.5) * 60, col: '#fff3c4', life: 0.25, size: 2 });
      } else if (e.id === 'rift' || e.id === 'boneSpear') {
        const bone = e.id === 'boneSpear';
        e.cells.forEach(([x, y], i) => R.fxs.push({ k: 'spike', x: cx(x), y: cy(y), t: -i * 0.035, life: 0.55, bone }));
        for (const [x, y] of e.cells) glowP(cx(x), cy(y), bone ? '#e0d8c0' : '#b46cff', 18, 0.4);
      } else {
        // 斬擊：彎月刀光加兩道殘影
        const big = e.id === 'cleave';
        for (let i = 0; i < 3; i++) R.fxs.push({ k: 'crescent', x: fx0, y: fy0, ang, r: Math.max(T * 1.1, len * 0.68), t: -i * 0.035, life: 0.22, col: i ? col : '#ffffff', w: big ? 0.9 : 0.6, fade: i * 0.3 });
        for (const [x, y] of e.cells) for (let i = 0; i < 3; i++) part({ k: 'streak', x: cx(x), y: cy(y), vx: Math.cos(ang) * 200 + (Math.random() - 0.5) * 120, vy: Math.sin(ang) * 200 + (Math.random() - 0.5) * 120, col: '#ffffff', life: 0.2, size: 2 });
      }
    } else if (s.shape.t === 'self') {
      R.fxs.push({ k: 'ring', x: fx0, y: fy0, t: 0, life: 0.4, col, r: T * (s.shape.n || 3) * 0.6 });
      if (e.id === 'whirl') for (let i = 0; i < 3; i++) R.fxs.push({ k: 'spin', x: fx0, y: fy0, t: -i * 0.03, life: 0.34, r: T * (1.15 - i * 0.12), a0: i * 2.1 });
      if (e.id === 'frost') {
        for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 160; part({ k: 'shard', x: fx0, y: fy0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col: Math.random() < 0.5 ? '#bff0ff' : '#7fd8ff', life: 0.5, size: 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 20 }); }
        glowP(fx0, fy0, '#7fd8ff', 70, 0.5);
      }
      if (e.id === 'quake') {
        R.shake = 9;
        for (let i = 0; i < 7; i++) R.fxs.push({ k: 'crack', x: fx0, y: fy0 + 10, ang: (i / 7) * Math.PI * 2 + Math.random() * 0.4, len: T * (1.3 + Math.random()), t: 0, life: 0.8 });
        for (let i = 0; i < 18; i++) part({ x: fx0 + (Math.random() - 0.5) * 80, y: fy0 + 12, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 80, g: 220, col: '#6a5a48', life: 0.7, size: 3 });
      }
    } else if (s.shape.t === 'area') {
      if (e.id === 'fan') {
        for (const [x, y] of e.cells) for (let i = 0; i < 2; i++) R.fxs.push({ k: 'rain', x: cx(x) + (Math.random() - 0.5) * 20, y: cy(y), t: -Math.random() * 0.15, life: 0.3 });
      } else if (e.id === 'firewell') {
        for (const [x, y] of e.cells) { glowP(cx(x), cy(y), '#ff7a2e', 30, 0.5); for (let i = 0; i < 5; i++) part({ k: 'glow', x: cx(x) + (Math.random() - 0.5) * 24, y: cy(y), vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 90, col: Math.random() < 0.5 ? '#ff9a2e' : '#ffd36b', life: 0.6, size: 6 }); }
      } else if (e.id === 'plague') {
        for (const [x, y] of e.cells) for (let i = 0; i < 2; i++) part({ k: 'glow', x: cx(x) + (Math.random() - 0.5) * 24, y: cy(y), vx: (Math.random() - 0.5) * 30, vy: -20, col: '#7adc5a', life: 0.9, size: 10 });
      }
    } else if (s.shape.t === 'single') {
      const to = e.targets[0];
      if (!to) return;
      if (e.id === 'breaker') {
        R.fxs.push({ k: 'impact', x: cx(to[0]), y: cy(to[1]), t: 0, life: 0.35 });
        R.fxs.push({ k: 'shock', x: cx(to[0]), y: cy(to[1]), t: 0, life: 0.4, r: T * 2, col: '#ffe8b0' });
        for (let i = 0; i < 12; i++) part({ x: cx(to[0]), y: cy(to[1]), vx: (Math.random() - 0.5) * 220, vy: -80 - Math.random() * 120, g: 360, col: '#a89880', life: 0.6, size: 3 });
        R.shake = 6;
      } else R.fxs.push({ k: 'proj', from, to, t: 0, life: 0.18, col: e.id === 'manabolt' ? '#c7a0ff' : '#fff3c4', orb: e.id === 'manabolt', trail: true });
    } else {
      R.fxs.push({ k: 'aura', id: e.id, t: 0, life: 0.6 });
      if (e.id === 'heal') for (let i = 0; i < 10; i++) part({ hero: true, k: 'cross', ox: (Math.random() - 0.5) * 36, oy: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30, col: '#7dff9a', life: 1.0, size: 3 });
      else for (let i = 0; i < 14; i++) part({ hero: true, k: e.id === 'static' ? 'glow' : 'sq', ox: (Math.random() - 0.5) * 30, oy: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 40, col: e.id === 'stoneskin' ? '#c9a27a' : '#7fd8ff', life: 0.9, size: e.id === 'static' ? 6 : 3 });
    }
  }

  function hitSpark(x0, y0, col, big) {
    const n = big ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 160;
      part({ k: 'streak', x: x0, y: y0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col, life: 0.18 + Math.random() * 0.1, size: 2 });
    }
    glowP(x0, y0, col, big ? 22 : 12, 0.18);
  }
  function glowP(x0, y0, col, size, life) {
    part({ k: 'glow', x: x0, y: y0, col, life, size, still: true });
  }
  // 死亡：角色圖碎成像素四散
  function shatter(e) {
    const name = e.w > 1 ? 'boss_' + e.type : e.type;
    let f;
    try { f = Spr.frames(name); } catch (err) { f = null; }
    const bx = e.x * T, by = e.y * T;
    const size = (e.w || 1) * T;
    if (f) {
      const scale = size / f.idle[0].width;
      for (const [px, py, col] of f.pixels) {
        const wx = bx + px * scale, wy = by + py * scale;
        const dx = wx - (bx + size / 2), dy = wy - (by + size / 2);
        const d = Math.hypot(dx, dy) || 1;
        const v = 40 + Math.random() * (e.w > 1 ? 220 : 120);
        part({ x: wx, y: wy, vx: (dx / d) * v, vy: (dy / d) * v - 70, g: 260, col, life: 0.5 + Math.random() * 0.6, size: scale });
      }
    }
    glowP(bx + size / 2, by + size / 2, e.w > 1 ? '#ffffff' : '#b46cff', e.w > 1 ? 90 : 26, 0.35);
  }

  function bossMoveFx(e) {
    const red = D.TELE_COLOR[D.BOSS_MOVES[e.move].color || 'red'];
    for (const [x, y] of e.cells) if (Math.random() < 0.6) burst(cx(x), cy(y), red, 2, 110, 0.5);
    R.fxs.push({ k: 'cells', cells: e.cells, col: red, t: 0, life: 0.3, strong: true });
    R.shake = Math.max(R.shake, e.move === 'smash' || e.move === 'burrow' ? 14 : 8);
    LH.Sfx && LH.Sfx.play('slam');
  }

  // ---------- 繪製 ----------
  function draw(run, dt) {
    const x = R.ctx;
    R.time += dt;
    const key = run.dungeon + run.floor;
    if (R.mapKey !== key || !R.mapCache) { buildMap(run); R.mapKey = key; reset(); }
    consume(run);
    for (const k in R.atk) { R.atk[k] -= dt; if (R.atk[k] <= 0) delete R.atk[k]; }
    camera(run, dt);
    const ox = Math.round(R.camX), oy = Math.round(R.camY);

    x.fillStyle = '#050308';
    x.fillRect(0, 0, W, H);
    x.save();
    if (R.shake > 0) {
      x.translate((Math.random() - 0.5) * R.shake, (Math.random() - 0.5) * R.shake);
      R.shake = Math.max(0, R.shake - dt * 40);
    }
    x.translate(-ox, -oy);
    x.drawImage(R.mapCache, ox, oy, W, H, ox, oy, W, H);

    // 持續區域（火井）
    for (const z of run.zones) {
      const plague = !!z.slow;
      for (const [zx, zy] of z.cells) {
        const g = x.createRadialGradient(cx(zx), cy(zy), 2, cx(zx), cy(zy), 26);
        g.addColorStop(0, plague ? 'rgba(110,220,80,0.45)' : 'rgba(255,140,40,0.55)');
        g.addColorStop(1, plague ? 'rgba(40,120,30,0)' : 'rgba(255,60,0,0)');
        x.fillStyle = g;
        x.fillRect(zx * T - 10, zy * T - 10, T + 20, T + 20);
        if (!plague) {
          // 火舌
          for (let i = 0; i < 3; i++) {
            const fx2 = zx * T + 6 + i * 10, h2 = 8 + Math.sin(R.time * 14 + zx * 3 + i * 2) * 4 + i % 2 * 3;
            x.fillStyle = 'rgba(255,120,40,0.85)';
            x.beginPath(); x.moveTo(fx2 - 4, zy * T + 26); x.quadraticCurveTo(fx2, zy * T + 26 - h2 * 2, fx2 + 4, zy * T + 26); x.fill();
            x.fillStyle = 'rgba(255,220,120,0.9)';
            x.beginPath(); x.moveTo(fx2 - 2, zy * T + 26); x.quadraticCurveTo(fx2, zy * T + 26 - h2, fx2 + 2, zy * T + 26); x.fill();
          }
        }
        if (Math.random() < dt * 10) part({ k: 'glow', x: cx(zx) + (Math.random() - 0.5) * 26, y: cy(zy) + 6, vy: plague ? -15 : -60, vx: (Math.random() - 0.5) * 20, col: plague ? '#7adc5a' : Math.random() < 0.5 ? '#ff7a2e' : '#ffd36b', life: plague ? 0.9 : 0.5, size: plague ? 9 : 4 });
      }
    }

    // 毒沼：冒泡的綠色區域
    for (const z of run.hazards || []) {
      const a = Math.min(1, z.t) * 0.55;
      const fire = z.elem === 'fire';
      for (const [zx, zy] of z.cells) {
        const g = x.createRadialGradient(cx(zx), cy(zy), 2, cx(zx), cy(zy), 24);
        g.addColorStop(0, fire ? `rgba(255,110,30,${a})` : `rgba(90,220,60,${a})`);
        g.addColorStop(1, fire ? 'rgba(160,40,10,0)' : 'rgba(40,120,30,0)');
        x.fillStyle = g;
        x.fillRect(zx * T - 8, zy * T - 8, T + 16, T + 16);
        if (Math.random() < dt * 3) part({ x: cx(zx) + (Math.random() - 0.5) * 24, y: cy(zy) + 6, vy: fire ? -40 : -18, col: fire ? '#ffb347' : '#9aff6a', life: 0.6, size: 2 });
      }
    }
    if (R.swamps && R.swamps.length) {
      const RP = R.ripples || (R.ripples = []);
      if (Math.random() < dt * 14) {
        const [sx, sy] = R.swamps[Math.floor(Math.random() * R.swamps.length)];
        if (sx * T > ox - T && sx * T < ox + W && sy * T > oy - T && sy * T < oy + H) RP.push({ x: sx * T + 8 + Math.random() * 16, y: sy * T + 8 + Math.random() * 16, t: 0 });
      }
      x.lineWidth = 1;
      for (const r of RP) {
        r.t += dt;
        const k = r.t / 1.4;
        x.strokeStyle = `rgba(170,210,140,${(0.4 * (1 - k)).toFixed(3)})`;
        x.beginPath(); x.ellipse(r.x, r.y, 2 + k * 12, 1 + k * 5, 0, 0, 7); x.stroke();
      }
      R.ripples = RP.filter((r) => r.t < 1.4);
    }
    if (R.lavas && R.lavas.length) {
      x.save();
      x.globalCompositeOperation = 'lighter';
      for (const [lx, ly] of R.lavas) {
        if (lx * T < ox - T || lx * T > ox + W || ly * T < oy - T || ly * T > oy + H) continue;
        const a = 0.1 + 0.08 * Math.sin(R.time * 2.2 + lx * 0.9 + ly * 1.3);
        x.fillStyle = `rgba(255,120,30,${a.toFixed(3)})`;
        x.fillRect(lx * T + 2, ly * T + 2, T - 4, T - 4);
        if (Math.random() < dt * 0.8) part({ k: 'glow', x: cx(lx) + (Math.random() - 0.5) * 20, y: cy(ly), vy: -40 - Math.random() * 30, vx: (Math.random() - 0.5) * 10, col: Math.random() < 0.5 ? '#ff7a2e' : '#ffd36b', life: 0.8, size: 3 });
      }
      x.restore();
    }
    if (R.stars && R.stars.length) {
      x.save();
      x.globalCompositeOperation = 'lighter';
      for (const [sx, sy] of R.stars) {
        if (sx * T < ox - T || sx * T > ox + W || sy * T < oy - T * 3 || sy * T > oy + H) continue;
        const a = 0.07 + 0.05 * Math.sin(R.time * 1.6 + sx * 0.7 + sy * 1.1);
        const g = x.createLinearGradient(0, sy * T - 70, 0, sy * T + T);
        g.addColorStop(0, 'rgba(140,180,255,0)');
        g.addColorStop(1, `rgba(140,180,255,${a.toFixed(3)})`);
        x.fillStyle = g;
        x.fillRect(sx * T + 4, sy * T - 70, T - 8, 70 + T);
        if (Math.random() < dt * 0.6) part({ k: 'glow', x: cx(sx) + (Math.random() - 0.5) * 22, y: cy(sy) + 6, vy: -30 - Math.random() * 30, col: Math.random() < 0.5 ? '#bfd4ff' : '#ffffff', life: 1.1, size: 3 });
      }
      x.restore();
    }
    if (run.omens && run.omens.length) {
      // 星落預告：發光的圓與往中心收的光環，最後一刻劃下一道流星
      x.save();
      x.globalCompositeOperation = 'lighter';
      for (const o of run.omens) {
        const p = Math.min(1, 1 - o.t / o.total);
        const pulse = 0.5 + 0.5 * Math.sin(R.time * (8 + p * 18));
        for (const [tx, ty] of o.cells) {
          const g = x.createRadialGradient(cx(tx), cy(ty), 1, cx(tx), cy(ty), 22);
          g.addColorStop(0, `rgba(143,180,255,${(0.18 + p * 0.35 + pulse * 0.1).toFixed(3)})`);
          g.addColorStop(1, 'rgba(143,180,255,0)');
          x.fillStyle = g;
          x.fillRect(tx * T - 6, ty * T - 6, T + 12, T + 12);
        }
        const ccx = cx(o.cx), ccy = cy(o.cy);
        x.strokeStyle = `rgba(200,220,255,${(0.35 + p * 0.5).toFixed(3)})`;
        x.lineWidth = 2;
        x.beginPath(); x.arc(ccx, ccy, T * 1.6 * (1 - p) + T * 0.4, 0, Math.PI * 2); x.stroke();
        if (o.t < 0.4) {
          const k = 1 - o.t / 0.4;
          const sx = ccx - 160 * (1 - k), sy = ccy - 260 * (1 - k);
          const lg = x.createLinearGradient(sx - 60, sy - 100, sx, sy);
          lg.addColorStop(0, 'rgba(160,190,255,0)'); lg.addColorStop(1, 'rgba(255,255,255,0.95)');
          x.strokeStyle = lg; x.lineWidth = 5;
          x.beginPath(); x.moveTo(sx - 60, sy - 100); x.lineTo(sx, sy); x.stroke();
          x.fillStyle = '#ffffff'; x.beginPath(); x.arc(sx, sy, 5, 0, 7); x.fill();
        }
      }
      x.restore();
    }
    if (R.swamps && R.swamps.length && Math.random() < dt * 12) {
      const [sx, sy] = R.swamps[Math.floor(Math.random() * R.swamps.length)];
      if (sx * T > ox - T && sx * T < ox + W && sy * T > oy - T && sy * T < oy + H) part({ x: sx * T + 8 + Math.random() * 16, y: sy * T + 12 + Math.random() * 12, vy: -10, col: '#8ac06a', life: 0.7, size: 2 });
    }

    // 頭目預告：地面裂光（不畫格線）
    for (const m of run.mobs) {
      if (!m.boss || !m.cur || !m.cur.cells.length) continue;
      const p = 1 - m.cur.t / m.cur.total;
      const mvd = D.BOSS_MOVES[m.cur.move];
      const tcol = D.TELE_COLOR[mvd.color || 'red'];
      const purple = !!mvd.color;
      const pulse = 0.35 + 0.25 * Math.sin(R.time * (10 + p * 20));
      // 先把範圍畫成實心，再模糊成一整片發光地面，避免出現格線
      const tc = R.teleCv || (R.teleCv = document.createElement('canvas'));
      tc.width = W; tc.height = H;
      const t2 = tc.getContext('2d');
      t2.fillStyle = tcol;
      for (const [tx, ty] of m.cur.cells) t2.fillRect(tx * T - ox, ty * T - oy, T, T);
      x.save();
      x.globalCompositeOperation = 'lighter';
      if (!R.low) x.filter = 'blur(7px)';
      x.globalAlpha = Math.min(1, (0.38 + p * 0.5) * (0.75 + pulse));
      x.drawImage(tc, ox, oy);
      x.filter = 'none';
      // 收縮光環：越接近出招越往中心收
      x.globalAlpha = 0.12 + p * 0.38;
      if (!R.low) x.filter = 'blur(2px)';
      x.drawImage(tc, ox, oy);
      x.filter = 'none';
      x.globalAlpha = 1;
      // 裂紋
      x.strokeStyle = purple ? hexA(tcol, 0.3 + p * 0.6) : `rgba(255,190,120,${0.3 + p * 0.6})`;
      x.lineWidth = 2;
      x.beginPath();
      const cells = m.cur.cells;
      for (let i = 0; i < cells.length; i += 3) {
        const [tx, ty] = cells[i];
        const sx = cx(tx) + Math.sin(i * 12.9) * 10, sy = cy(ty) + Math.cos(i * 7.3) * 10;
        x.moveTo(sx, sy);
        x.lineTo(sx + Math.sin(i * 3.1) * 14 * p, sy + Math.cos(i * 5.7) * 14 * p);
      }
      x.stroke();
      x.restore();
    }

    // 短暫特效（地面層）
    for (const f of R.fxs) if (f.k === 'cells' && f.t >= 0) {
      const a = (1 - f.t / f.life) * (f.strong ? 0.8 : 0.45);
      x.save();
      x.globalCompositeOperation = 'lighter';
      for (const [tx, ty] of f.cells) {
        const g = x.createRadialGradient(cx(tx), cy(ty), 1, cx(tx), cy(ty), 22);
        g.addColorStop(0, hexA(f.col, a));
        g.addColorStop(1, hexA(f.col, 0));
        x.fillStyle = g;
        x.fillRect(tx * T - 6, ty * T - 6, T + 12, T + 12);
      }
      x.restore();
    }

    // 角色排序繪製
    const ents = [];
    const h = run.hero;
    if (run.phase !== 'dead' || R.heroDead < 1.2) ents.push({ e: h, hero: true });
    for (const m of run.mobs) {
      if (m.hp <= 0 || m.hidden) continue;
      const [mx, my] = entPos(m);
      if (mx < ox - 80 || my < oy - 80 || mx > ox + W + 16 || my > oy + H + 16) continue;
      ents.push({ e: m });
    }
    ents.sort((a, b) => entPos(a.e)[1] + (a.e.w || 1) * T - (entPos(b.e)[1] + (b.e.w || 1) * T));
    for (const o of ents) drawEnt(x, run, o.e, o.hero, dt);

    // 鑽地中的頭目：地面隆起
    for (const m of run.mobs) if (m.hidden && m.cur) {
      const [tx, ty] = m.cur.cells[Math.floor(m.cur.cells.length / 2)] || [m.x, m.y];
      burst(cx(tx), cy(ty), '#4a3a30', 1, 60, 0.5);
    }

    drawFx(x, dt);
    drawParts(x, run, dt);
    drawLight(x, run, dt, ox, oy);
    drawFog(x, run);
    drawEyes(x, run, ox, oy);
    drawBeams(x, dt);
    x.restore();
    // 以下為螢幕座標
    drawDust(x, dt);
    if (R.hurtFlash > 0) {
      R.hurtFlash -= dt;
      const g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, 'rgba(160,0,0,0)');
      g.addColorStop(1, `rgba(160,0,0,${R.hurtFlash * 1.2})`);
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
    }
    if (run.slowmo) {
      x.fillStyle = 'rgba(80,0,0,0.12)';
      x.fillRect(0, 0, W, H);
    }
    if (R.flashT > 0) {
      R.flashT -= dt;
      x.fillStyle = `rgba(255,250,235,${Math.max(0, R.flashT) * 1.2})`;
      x.fillRect(0, 0, W, H);
    }
    // 放大貼到螢幕，再畫清晰的文字
    const sc = R.sctx;
    sc.imageSmoothingEnabled = false;
    sc.drawImage(R.wcv, 0, 0, SW, SH);
    sc.save();
    sc.setTransform(R.zoom, 0, 0, R.zoom, -ox * R.zoom, -oy * R.zoom);
    drawTexts(sc, dt);
    if (R.levelT > 0) {
      R.levelT -= dt;
      const [hx, hy] = entPos(h);
      const a = Math.min(1, R.levelT);
      sc.strokeStyle = `rgba(255,220,110,${a})`;
      sc.lineWidth = 3;
      sc.beginPath(); sc.ellipse(hx + T / 2, hy + T / 2 + 8, 30 + (1.6 - R.levelT) * 30, 12 + (1.6 - R.levelT) * 10, 0, 0, Math.PI * 2); sc.stroke();
      sc.font = '900 18px "Silkscreen", monospace';
      sc.textAlign = 'center';
      sc.fillStyle = `rgba(255,226,122,${a})`;
      sc.fillText('LEVEL UP', hx + T / 2, hy - 44 - (1.6 - R.levelT) * 20);
    }
    // 精英怪名字
    sc.font = '700 9px "Noto Sans TC", sans-serif';
    sc.textAlign = 'center';
    sc.lineWidth = 3;
    sc.strokeStyle = 'rgba(0,0,0,0.85)';
    for (const l of R.labels) { sc.strokeText(l.s, l.x, l.y); sc.fillStyle = l.col; sc.fillText(l.s, l.x, l.y); }
    R.labels = [];
    sc.restore();
    if (R.banner) drawBanner(sc, dt);
    if (run.phase === 'dead') R.heroDead += dt;
    R.miniT = (R.miniT || 0) - dt;
    if (R.miniT <= 0) { R.miniT = 0.15; drawMini(run); }
  }

  // 鏡頭跟著角色，角色保持在畫面中央（到地圖邊緣時停住）
  function camera(run, dt) {
    const map = Sim.mapOf(run);
    const [hx, hy] = entPos(run.hero);
    const tx = Math.max(0, Math.min(map.w * T - W, hx + T / 2 - W / 2));
    const ty = Math.max(0, Math.min(map.h * T - H, hy + T / 2 - H / 2));
    if (R.camX == null) { R.camX = tx; R.camY = ty; return; }
    const k = Math.min(1, dt * 6);
    R.camX += (tx - R.camX) * k;
    R.camY += (ty - R.camY) * k;
  }

  // 未探索區域：全黑，邊緣柔和
  function drawFog(x, run) {
    const map = Sim.mapOf(run);
    if (!R.fogCv) R.fogCv = document.createElement('canvas');
    const f = R.fogCv;
    if (R.fogN !== run.seenN || f.width !== map.w) {
      R.fogN = run.seenN;
      f.width = map.w; f.height = map.h;
      const fx2 = f.getContext('2d');
      const img = fx2.createImageData(map.w, map.h);
      for (let i = 0; i < map.w * map.h; i++) {
        img.data[i * 4] = 5; img.data[i * 4 + 1] = 3; img.data[i * 4 + 2] = 8;
        img.data[i * 4 + 3] = run.seen && run.seen[i] ? 0 : 255;
      }
      fx2.putImageData(img, 0, 0);
    }
    x.save();
    x.imageSmoothingEnabled = true;
    x.drawImage(f, -T / 2, -T / 2, map.w * T + T, map.h * T + T);
    x.restore();
  }

  // 黑暗中怪物的紅眼：看得到有東西逼近，卻看不清全貌
  function drawEyes(x, run, ox, oy) {
    const [hx, hy] = entPos(run.hero);
    const blink = 0.75 + 0.25 * Math.sin(R.time * 3);
    for (const m of run.mobs) {
      if (m.hp <= 0 || m.hidden) continue;
      const [mx, my] = entPos(m);
      if (mx < ox - 40 || my < oy - 40 || mx > ox + W || my > oy + H) continue;
      const d = Math.hypot(mx - hx, my - hy);
      if (d < 210) continue;
      const size = (m.w || 1) * T;
      const a = Math.min(1, (d - 210) / 80) * blink;
      const ex = mx + size * 0.5 + (m.face < 0 ? -3 : 3), ey = my + size * 0.32;
      x.save();
      x.globalCompositeOperation = 'lighter';
      const g = x.createRadialGradient(ex, ey, 0, ex, ey, 10 * (m.w || 1));
      g.addColorStop(0, `rgba(255,40,30,${0.35 * a})`);
      g.addColorStop(1, 'rgba(255,40,30,0)');
      x.fillStyle = g;
      x.fillRect(ex - 14, ey - 14, 28, 28);
      x.restore();
      x.fillStyle = `rgba(255,70,50,${a})`;
      const s2 = m.w > 1 ? 3 : 2;
      x.fillRect(Math.round(ex - 4), Math.round(ey), s2, s2);
      x.fillRect(Math.round(ex + 2), Math.round(ey), s2, s2);
    }
  }

  // 小地圖：已探索範圍、角色位置、附近怪物
  function drawMini(run) {
    const cv = R.mini || (R.mini = document.getElementById('minimap'));
    if (!cv) return;
    const map = Sim.mapOf(run);
    const k = 3;
    if (cv.width !== map.w * k) { cv.width = map.w * k; cv.height = map.h * k; }
    const x = cv.getContext('2d');
    if (!R.miniBase) R.miniBase = document.createElement('canvas');
    const b = R.miniBase;
    if (R.miniN !== run.seenN || b.width !== cv.width) {
      R.miniN = run.seenN;
      b.width = cv.width; b.height = cv.height;
      const bx = b.getContext('2d');
      for (let j = 0; j < map.h; j++)
        for (let i = 0; i < map.w; i++) {
          const idx = j * map.w + i;
          if (map.t[idx]) {
            const near = run.seen[idx - 1] || run.seen[idx + 1] || run.seen[idx - map.w] || run.seen[idx + map.w];
            if (near) { bx.fillStyle = '#3a2f48'; bx.fillRect(i * k, j * k, k, k); }
          } else if (run.seen[idx]) { bx.fillStyle = map.lava && map.lava[idx] ? '#d0581a' : map.star && map.star[idx] ? '#7fa8ff' : '#7a6a8c'; bx.fillRect(i * k, j * k, k, k); }
        }
      for (const d of map.deco) if (d.k === 'crystal' && run.seen[(d.y + 1) * map.w + d.x]) {
        bx.fillStyle = ['#7fe7ff', '#b46cff', '#5cffb0'][d.v];
        bx.fillRect(d.x * k, d.y * k, k, k);
      }
    }
    x.clearRect(0, 0, cv.width, cv.height);
    x.drawImage(b, 0, 0);
    const h = run.hero;
    for (const m of run.mobs) {
      if (m.hp <= 0 || m.hidden) continue;
      if (U2.cheb(m.x, m.y, h.x, h.y) > 12 && !m.boss) continue;
      x.fillStyle = m.boss ? '#ff3a3a' : '#ff6a5a';
      const s2 = m.boss ? 6 : 3;
      x.fillRect(m.x * k, m.y * k, s2, s2);
    }
    x.fillStyle = Math.sin(R.time * 8) > 0 ? '#ffdf8a' : '#ffffff';
    x.fillRect(h.x * k - 1, h.y * k - 1, k + 2, k + 2);
    x.strokeStyle = 'rgba(255,255,255,0.35)';
    x.strokeRect((R.camX / T) * k + 0.5, (R.camY / T) * k + 0.5, (W / T) * k, (H / T) * k);
  }


  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a)})`;
  }

  // 武器像素畫法：沿角度一格一格點出來，揮砍時整把轉動
  const WEAPON = {
    fist: null,
    knife: { seg: [[2, '#5a3a20'], [4, '#d9e1ea']], stab: true },
    dagger: { seg: [[2, '#5a3a20'], [1, '#d9a441', 1], [6, '#e8eef4'], [1, '#ffffff']], stab: true },
    sword: { seg: [[3, '#5a3a20'], [1, '#d9a441', 2], [10, '#eef3f8'], [1, '#ffffff']] },
    hammer: { seg: [[10, '#7a5030'], [4, '#8d95a1', 3]], heavy: true },
    staff: { seg: [[14, '#8a5a32']], orb: true },
    bow: { bow: true },
  };
  function pix(x, px, py, col, s) {
    x.fillStyle = col;
    x.fillRect(Math.round(px - s / 2), Math.round(py - s / 2), s, s);
  }
  // 英雄目前拿的武器（雙持時取剛出手的那一把）
  function heroWeapon(run) {
    const ws = run.cs.weapons;
    return ws[(run.hero.wi + ws.length - 1) % ws.length] || ws[0];
  }
  // 雙持時沒在出手的那一把
  function backWeapon(run, look) {
    const G = LH.UI && LH.UI.G;
    const gear = G ? G.gear : {};
    const ws = run.cs.weapons;
    if (ws.length > 1) {
      const cur = heroWeapon(run);
      const w = ws.find((q) => q !== cur);
      if (!w) return null;
      const it = gear.weapon && gear.weapon.id === w.id ? gear.weapon : gear.offhand;
      return { w, atk: 0, wr: it ? it.rarity : 0, u: !!(it && it.uniq) };
    }
    const off = look && look.offhand;
    const b = off && D.BASES[off.b];
    if (b && b.slot === 'weapon') return { w: { base: off.b, kind: b.kind, elem: (gear.offhand && gear.offhand.elem) || 'phys' }, atk: 0, wr: off.r, u: !!off.u };
    return null;
  }
  // 營地：英雄手上拿著目前的武器（雙持時另一把在身後）
  function drawHeld(x, gear, hx, hy, face, sc) {
    if (!gear) return;
    sc = sc || 1;
    const look = Spr.lookOf(gear);
    const mk = (it) => ({ base: it.base, kind: D.BASES[it.base].kind, elem: it.elem || 'phys' });
    const off = gear.offhand && gear.offhand.slot === 'weapon' ? gear.offhand : null;
    if (off) drawWeapon(x, null, hx - face * 14 * sc, hy - 2 * sc, face, look, { w: mk(off), atk: 0, wr: off.rarity, u: !!off.uniq }, sc);
    if (gear.weapon) drawWeapon(x, null, hx, hy, face, look, { w: mk(gear.weapon), atk: 0, wr: gear.weapon.rarity, u: !!gear.weapon.uniq }, sc);
  }
  function heroLook() {
    const G = LH.UI && LH.UI.G;
    return Spr.lookOf(G ? G.gear : null);
  }
  // 傳說、神話武器的刀身換色
  const BLADE_TINT = {
    4: { '#d9e1ea': '#ffe08a', '#e8eef4': '#ffe9a8', '#eef3f8': '#fff0b8', '#8d95a1': '#d9a441', '#ffffff': '#fffbe0' },
    5: { '#d9e1ea': '#ff9ab0', '#e8eef4': '#ffb0c0', '#eef3f8': '#ffc0cc', '#8d95a1': '#c23a5a', '#ffffff': '#ffe0e8' },
  };
  // 強化到 +5 以上：腳下浮出一圈光
  function heroAura(x, look, fx, fy) {
    let top = 0;
    for (const k in look) top = Math.max(top, look[k].p || 0);
    if (top < 5) return;
    const a = Math.min(0.45, 0.12 + (top - 5) * 0.04) * (0.8 + 0.2 * Math.sin(R.time * 3));
    x.save();
    x.globalCompositeOperation = 'lighter';
    const g = x.createRadialGradient(fx, fy - 4, 2, fx, fy - 4, 30);
    g.addColorStop(0, `rgba(255,210,110,${a})`);
    g.addColorStop(1, 'rgba(255,180,80,0)');
    x.fillStyle = g;
    x.fillRect(fx - 32, fy - 30, 64, 40);
    x.restore();
  }

  // o：指定要畫哪一把（營地、副手用），{ w, atk, wr, u }；sc：放大倍數（手機版的主角比較大）
  function drawWeapon(x, run, hx, hy, face, look, o, sc) {
    if (!sc || sc === 1) return weaponAt(x, run, hx, hy, face, look, o, (px, py) => [px, py]);
    x.save(); x.translate(hx, hy); x.scale(sc, sc);
    weaponAt(x, run, 0, 0, face, look, o, (px, py) => [hx + px * sc, hy + py * sc]);
    x.restore();
  }
  // wp：把武器座標換回地圖座標（揚塵、震波這些特效用）
  function weaponAt(x, run, hx, hy, face, look, o, wp) {
    const w = (o && o.w) || heroWeapon(run);
    const def = WEAPON[w.base] || (w.kind === 'bow' ? WEAPON.bow : w.kind === 'staff' ? WEAPON.staff : WEAPON.sword);
    if (!def) return;
    const wr = o && o.wr != null ? o.wr : look && look.weapon ? look.weapon.r : 0;
    const uq = o ? !!o.u : !!(look && look.weapon && look.weapon.u);
    const tint = uq ? BLADE_TINT[4] : BLADE_TINT[Math.min(5, wr)] || null;
    const len = R.atkLen || 0.24;
    const atk = o && o.atk != null ? o.atk : R.atk.hero || 0;
    const p = atk > 0 ? Math.min(1, 1 - atk / len) : 0;
    const P = 2;
    if (def.bow) {
      // 弓：直立在身前，射擊時拉弦；沒射的時候搭著一支箭
      const pull = atk > 0 ? Math.sin(p * Math.PI) * 6 : 1;
      const wood = wr >= 5 ? '#c23a5a' : wr >= 4 ? '#d9a441' : '#8a5a32';
      for (let i = -8; i <= 8; i++) pix(x, hx + face * (Math.cos((i / 8) * 1.2) * 8 - 3), hy + i * P, '#0d0b10', 4);
      for (let i = -8; i <= 8; i++) pix(x, hx + face * (Math.cos((i / 8) * 1.2) * 8 - 3), hy + i * P, wood, 2);
      x.strokeStyle = '#e8e2d0'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(hx - face * 1, hy - 16); x.lineTo(hx - face * pull, hy); x.lineTo(hx - face * 1, hy + 16); x.stroke();
      if (atk <= 0 || p < 0.5) {
        const ax = hx - face * pull;
        x.strokeStyle = '#d8cfb4'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(ax, hy); x.lineTo(ax + face * 18, hy); x.stroke();
        pix(x, ax + face * 18, hy, '#d9e1ea', 3);
        pix(x, ax + face * 1, hy - 1, '#ff6a5a', 2);
      }
      return;
    }
    let a, ext = 0;
    if (atk <= 0) {
      a = def.heavy ? -1.3 + Math.sin(R.time * 2) * 0.03 : def.stab ? -0.55 : -1.05 + Math.sin(R.time * 2) * 0.05;
    } else if (def.stab) {
      // 匕首：快速連刺兩下
      a = -0.12;
      ext = Math.abs(Math.sin(p * Math.PI * 2)) * 10;
    } else if (def.heavy) {
      // 戰鎚：先往後舉過頭，再重重砸下
      if (p < 0.45) a = -1.3 - (p / 0.45) * 1.5;
      else a = -2.8 + Math.min(1, (p - 0.45) / 0.18) * 3.4;
    } else if (def.orb) {
      // 法杖：高舉施法
      a = -1.05 - Math.sin(p * Math.PI) * 0.6;
    } else {
      // 長劍：大弧度橫掃
      a = -2.5 + 3.1 * (1 - Math.pow(1 - p, 3));
    }
    const dx = Math.cos(a) * face, dy = Math.sin(a);
    hx += dx * ext; hy += dy * ext;
    const nx = -dy, ny = dx * face; // 垂直方向
    const pts = [];
    let d = 0;
    for (const [n, col0, wide] of def.seg) {
      const col = (tint && tint[col0]) || col0;
      for (let i = 0; i < n; i++, d++) {
        pts.push([hx + dx * d * P, hy + dy * d * P, col]);
        if (wide) for (let k = 1; k <= wide; k++) { pts.push([hx + dx * d * P + nx * k * P, hy + dy * d * P + ny * k * P * face, col]); pts.push([hx + dx * d * P - nx * k * P, hy + dy * d * P - ny * k * P * face, col]); }
      }
    }
    const tipX = hx + dx * d * P, tipY = hy + dy * d * P;
    // 揮擊殘影（畫在武器後面）
    if (atk > 0 && !def.orb) {
      x.save(); x.globalCompositeOperation = 'lighter';
      const L = d * P;
      if (def.stab && ext > 4) {
        x.strokeStyle = `rgba(255,255,255,${0.5 * (ext / 10)})`; x.lineWidth = 2;
        for (const o of [-4, 0, 4]) { x.beginPath(); x.moveTo(tipX - dx * 16 + nx * o, tipY - dy * 16 + ny * o * face); x.lineTo(tipX + nx * o, tipY + ny * o * face); x.stroke(); }
      } else if (def.heavy && p > 0.45 && p < 0.75) {
        x.strokeStyle = `rgba(255,230,180,${0.6 * (1 - (p - 0.45) / 0.3)})`; x.lineWidth = 6;
        x.beginPath();
        for (let k = 0; k <= 6; k++) { const aa = a - k * 0.22; x.lineTo(hx + Math.cos(aa) * face * L, hy + Math.sin(aa) * L); }
        x.stroke();
      } else if (!def.stab && !def.heavy && p < 0.8) {
        x.strokeStyle = `rgba(255,255,255,${0.55 * (1 - p)})`; x.lineWidth = 4;
        x.beginPath();
        for (let k = 0; k <= 7; k++) { const aa = a - k * 0.2; x.lineTo(hx + Math.cos(aa) * face * L, hy + Math.sin(aa) * L); }
        x.stroke();
      }
      x.restore();
    }
    for (const [px, py] of pts) pix(x, px, py, '#0d0b10', 4);
    for (const [px, py, col] of pts) pix(x, px, py, col, 2);
    // 戰鎚砸到地面：揚塵、震波、畫面小震
    if (def.heavy && atk > 0 && p >= 0.63 && !R.hamHit) {
      R.hamHit = true;
      const [gx, gy] = wp(tipX, tipY);
      burst(gx, gy, '#8a7a6a', 12, 110, 0.55);
      R.fxs.push({ k: 'shock', x: gx, y: gy + 4, t: 0, life: 0.35, r: T * 1.7, col: '#ffe8b0' });
      R.shake = Math.max(R.shake, 5);
      LH.Sfx && LH.Sfx.play('smash');
    }
    if (def.orb) {
      const col = D.ELEM_COLOR[w.elem] || '#7fe7ff';
      const gr = Math.round(12 + (atk > 0 ? Math.sin(p * Math.PI) * 12 : Math.sin(R.time * 3) * 2));
      x.save(); x.globalCompositeOperation = 'lighter';
      x.drawImage(Spr.glow(col, gr), tipX - gr, tipY - gr);
      x.restore();
      pix(x, tipX, tipY, '#0d0b10', 8); pix(x, tipX, tipY, col, 6); pix(x, tipX - 1, tipY - 1, '#ffffff', 2);
      if (atk > 0 && Math.random() < 0.5) { const [gx, gy] = wp(tipX, tipY); part({ k: 'glow', x: gx + (Math.random() - 0.5) * 10, y: gy + (Math.random() - 0.5) * 10, vy: -30, col, life: 0.35, size: 4 }); }
    }
    // 傳說以上的武器尖端閃光
    if (wr >= 4 && !def.orb) {
      x.save(); x.globalCompositeOperation = 'lighter';
      x.globalAlpha = 0.6 + 0.4 * Math.sin(R.time * 4);
      x.drawImage(Spr.glow(wr >= 5 ? '#ff4f6e' : '#ffcf6a', 7), tipX - 7, tipY - 7);
      x.restore();
    }
  }

  function drawEnt(x, run, e, hero, dt) {
    let [px, py] = entPos(e);
    const w = e.w || 1;
    const size = w * T;
    const key = hero ? 'hero' : e.id;
    // 腳步揚塵
    const lp = R.lastPos[key];
    if (lp && (lp[0] !== e.x || lp[1] !== e.y)) {
      for (let i = 0; i < (w > 1 ? 4 : 2); i++) part({ x: px + size / 2 + (Math.random() - 0.5) * size * 0.5, y: py + size - 4, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 15, col: 'rgba(150,135,165,0.55)', life: 0.45, size: w > 1 ? 4 : 3 });
    }
    R.lastPos[key] = [e.x, e.y];
    // 陰影
    x.fillStyle = 'rgba(0,0,0,0.45)';
    x.beginPath(); x.ellipse(px + size / 2, py + size - 3, size * 0.36, size * 0.13, 0, 0, Math.PI * 2); x.fill();
    const name = hero ? 'hero' : e.boss ? 'boss_' + e.boss : e.type;
    const look = hero ? heroLook() : null;
    const fr = hero ? Spr.heroFrames(look) : Spr.frames(name);
    const moving = e.mt < 1;
    const atk = R.atk[key] || 0;
    let img;
    if (hero && run.phase === 'dead') img = fr.hurt;
    else if (e.hitT > 0.07) img = fr.hurt;
    else if (atk > 0) img = fr.atk[atk > 0.12 ? 1 : 0];
    else if (!hero && (e.windup || (e.boss && e.cur))) img = fr.atk[0];
    else if (moving) img = fr.walk[Math.floor(R.time * 9 + (e.id || 0) * 0.7) % 4];
    else img = fr.idle[Math.floor(R.time * 1.7 + (e.id || 0) * 0.37) % 2];
    let ox = 0, oy = 0;
    if (!hero && e.windup) {
      const p = 1 - e.windup.t / e.windup.total;
      ox = -e.face * p * 3;
      if (D.MONSTERS[e.type] && (D.MONSTERS[e.type].heavy || D.MONSTERS[e.type].ranged)) {
        x.strokeStyle = `rgba(255,220,90,${0.4 + p * 0.6})`;
        x.lineWidth = 2;
        x.beginPath(); x.arc(px + size / 2, py - 6, 4 + p * 3, 0, Math.PI * 2); x.stroke();
      }
    }
    if (e.boss && e.cur) {
      const p = 1 - e.cur.t / e.cur.total;
      ox = (Math.random() - 0.5) * p * 4;
      oy -= p * 6;
      const g = x.createRadialGradient(px + size / 2, py + size / 2, 4, px + size / 2, py + size / 2, size);
      g.addColorStop(0, hexA(D.TELE_COLOR[D.BOSS_MOVES[e.cur.move].color || 'red'], 0.42));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(px - size / 2, py - size / 2, size * 2, size * 2);
    }
    if (hero && run.phase === 'dead') {
      x.globalAlpha = Math.max(0, 1 - R.heroDead);
      oy += R.heroDead * 10;
    }
    if (e.elite) {
      const col = D.ELITE[e.elite[0]].color;
      x.save();
      x.globalCompositeOperation = 'lighter';
      x.drawImage(Spr.glow(col, 22), px + size / 2 - 22, py + size / 2 - 22);
      x.restore();
      x.strokeStyle = hexA(col, 0.55 + 0.25 * Math.sin(R.time * 5));
      x.lineWidth = 2;
      x.beginPath(); x.ellipse(px + size / 2, py + size - 3, size * 0.5, size * 0.18, 0, 0, Math.PI * 2); x.stroke();
      R.labels.push({ x: px + size / 2, y: py - 12, s: e.eName, col });
    }
    // 英雄的圖比一格大（電腦版寬 22、高 26 個像素點，每點畫 2×2），腳踩在格子底部；手機版可以再放大 HS 倍
    const dw = hero ? img.width * 2 * HS : size, dh = hero ? img.height * 2 * HS : size;
    const dx = Math.round(px + ox + (size - dw) / 2), dy = Math.round(py + oy + (hero ? size - dh - 1 : 0));
    const ccx = dx + dw / 2, ccy = dy + dh * 0.6;
    if (hero && run.phase !== 'dead') heroAura(x, look, ccx, dy + dh);
    // 雙持：另一把武器拿在身後的手上（畫在身體後面）
    if (hero && run.phase !== 'dead') {
      const back = backWeapon(run, look);
      if (back) {
        const f = e.face < 0 ? -1 : 1;
        const hx2 = ccx + f * (10 - 14) * HS;
        drawWeapon(x, run, hx2, dy + dh - 17 * HS, f, look, back, HS);
      }
    }
    x.save();
    if (e.face < 0) { x.translate(dx + dw, dy); x.scale(-1, 1); } else x.translate(dx, dy);
    x.drawImage(img, 0, 0, dw, dh);
    if (e.hitT > 0) x.drawImage(Spr.flashFrame(img, '#ffffff'), 0, 0, dw, dh);
    if (e.st && e.st.slow) { x.globalAlpha = 0.35; x.drawImage(Spr.flashFrame(img, '#7fd8ff'), 0, 0, dw, dh); }
    if (e.st && e.st.burn && e.st.burn.length) { x.globalAlpha = 0.18 + Math.sin(R.time * 20) * 0.08; x.drawImage(Spr.flashFrame(img, '#ff7a2e'), 0, 0, dw, dh); }
    x.restore();
    x.globalAlpha = 1;
    // 英雄：手上的武器與增益光環
    if (hero) {
      if (run.phase !== 'dead') {
        const bob = img === fr.idle[1] || img === fr.walk[1] || img === fr.walk[3] ? 2 : 0;
        const f = e.face < 0 ? -1 : 1;
        drawWeapon(x, run, ccx + f * 10 * HS, dy + dh - (15 - bob) * HS, f, look, null, HS);
        if (look.offhand && look.offhand.b === 'orb') {
          const qx = ccx - f * 16 * HS, qy = dy + dh - 24 * HS + Math.sin(R.time * 3) * 2;
          x.save(); x.globalCompositeOperation = 'lighter';
          x.drawImage(Spr.glow('#7fe7ff', 12), qx - 12, qy - 12);
          x.restore();
        }
      }
      if (e.slow) { x.fillStyle = `rgba(90,160,70,${0.35 + e.slow.p})`; x.beginPath(); x.ellipse(px + size / 2, py + size - 3, size * 0.42, size * 0.15, 0, 0, Math.PI * 2); x.fill(); }
      if (e.buffs.stone) {
        for (let i = 0; i < 4; i++) {
          const a = R.time * 3 + (i / 4) * Math.PI * 2;
          const sx = ccx + Math.cos(a) * size * 0.65, sy = ccy + Math.sin(a) * size * 0.3;
          pix(x, sx, sy, '#3a3028', 7); pix(x, sx, sy, '#a89880', 5); pix(x, sx - 1, sy - 1, '#d8c8b0', 2);
        }
      }
      if (e.absorb > 0) {
        x.strokeStyle = `rgba(127,216,255,${0.5 + 0.3 * Math.sin(R.time * 8)})`;
        x.lineWidth = 2;
        x.beginPath(); x.ellipse(ccx, ccy - 4, size * 0.75, size * 0.9, 0, 0, Math.PI * 2); x.stroke();
        if (Math.random() < 0.2) R.fxs.push({ k: 'zig', from: [e.x, e.y], to: [e.x + (Math.random() - 0.5) * 2, e.y + (Math.random() - 0.5) * 2], t: 0, life: 0.1, col: '#bfe8ff', small: true });
      }
    }
    // 狀態
    if (e.st) {
      if (e.st.burn.length && Math.random() < dt * 14) part({ k: 'glow', x: px + Math.random() * size, y: py + size * 0.6, vy: -50, col: '#ff7a2e', life: 0.45, size: 5 });
      if (e.st.shock && Math.random() < dt * 10) R.fxs.push({ k: 'zig', from: [e.x, e.y], to: [e.x + (Math.random() - 0.5), e.y - 0.5], t: 0, life: 0.08, col: '#ffe85c', small: true });
      if (e.st.stun > 0) {
        x.fillStyle = '#ffe85c';
        for (let i = 0; i < 3; i++) { const a = R.time * 6 + i * 2.1; x.fillRect(px + size / 2 + Math.cos(a) * 10 - 1, py - 4 + Math.sin(a) * 3, 3, 3); }
      }
    }
    // 血條
    if (!hero && (e.hp < e.maxHp || e.elite) && !e.boss) {
      const bw = size - 8;
      x.fillStyle = e.elite ? '#d9a441' : 'rgba(0,0,0,0.7)'; x.fillRect(px + 3, py - 6, bw + 2, 5);
      x.fillStyle = '#5a1418'; x.fillRect(px + 4, py - 5, bw, 3);
      x.fillStyle = '#e04a4a'; x.fillRect(px + 4, py - 5, bw * Math.max(0, e.hp / e.maxHp), 3);
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(px + 4, py - 5, bw * Math.max(0, e.hp / e.maxHp), 1);
    }
  }

  function line(from, to) {
    return [cx(from[0]), cy(from[1]), cx(to[0]), cy(to[1])];
  }

  function drawFx(x, dt) {
    for (const f of R.fxs) {
      f.t += dt;
      if (f.t < 0) continue;
      const p = f.t / f.life;
      const a = 1 - p;
      x.save();
      switch (f.k) {
        case 'crescent': {
          // 彎月刀光：外弧與內弧之間填滿
          const span = 1.9, a0 = f.ang - span / 2 + p * 0.5;
          x.globalCompositeOperation = 'lighter';
          x.fillStyle = hexA(f.col, (1 - p) * (1 - (f.fade || 0)) * 0.9);
          x.beginPath();
          x.arc(f.x, f.y, f.r, a0, a0 + span);
          x.arc(f.x + Math.cos(f.ang) * f.r * 0.28 * f.w, f.y + Math.sin(f.ang) * f.r * 0.28 * f.w, f.r * 0.82, a0 + span, a0, true);
          x.fill();
          break;
        }
        case 'spin': {
          x.globalCompositeOperation = 'lighter';
          const a0 = (f.a0 || 0) + p * Math.PI * 2.4;
          x.fillStyle = `rgba(255,255,255,${0.75 * a})`;
          x.beginPath(); x.arc(f.x, f.y, f.r, a0, a0 + 2.2); x.arc(f.x, f.y, f.r * 0.8, a0 + 2.2, a0, true); x.fill();
          x.fillStyle = `rgba(220,230,255,${0.5 * a})`;
          x.beginPath(); x.arc(f.x, f.y, f.r, a0 + Math.PI, a0 + Math.PI + 1.6); x.arc(f.x, f.y, f.r * 0.84, a0 + Math.PI + 1.6, a0 + Math.PI, true); x.fill();
          break;
        }
        case 'lightning': {
          const [x1, y1, x2, y2] = line(f.from, f.to);
          x.globalCompositeOperation = 'lighter';
          const flick = Math.random() < 0.7 ? 1 : 0.4;
          const seg = (ax, ay, bx, by, n, wdt, alpha) => {
            const pts = [[ax, ay]];
            for (let i = 1; i < n; i++) {
              const t = i / n;
              const off = (Math.random() - 0.5) * 22 * Math.sin(t * Math.PI);
              const nx2 = -(by - ay), ny2 = bx - ax, l = Math.hypot(nx2, ny2) || 1;
              pts.push([ax + (bx - ax) * t + (nx2 / l) * off, ay + (by - ay) * t + (ny2 / l) * off]);
            }
            pts.push([bx, by]);
            x.strokeStyle = `rgba(255,240,140,${alpha * 0.35})`; x.lineWidth = wdt * 3.5;
            x.beginPath(); pts.forEach(([u, v], i) => (i ? x.lineTo(u, v) : x.moveTo(u, v))); x.stroke();
            x.strokeStyle = `rgba(255,255,230,${alpha})`; x.lineWidth = wdt;
            x.beginPath(); pts.forEach(([u, v], i) => (i ? x.lineTo(u, v) : x.moveTo(u, v))); x.stroke();
            return pts;
          };
          const main = seg(x1, y1, x2, y2, 9, 3, a * flick);
          for (let b = 0; b < 3; b++) {
            const [u, v] = main[2 + b * 2] || main[1];
            const ang = Math.atan2(y2 - y1, x2 - x1) + (Math.random() - 0.5) * 1.8;
            seg(u, v, u + Math.cos(ang) * 40, v + Math.sin(ang) * 40, 4, 1.5, a * flick * 0.8);
          }
          break;
        }
        case 'beam': {
          const [x1, y1, x2, y2] = line(f.from, f.to);
          x.globalCompositeOperation = 'lighter';
          x.lineCap = 'round';
          x.strokeStyle = hexA(f.col, a * 0.3); x.lineWidth = f.w * 3 * a + 2;
          x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
          x.strokeStyle = hexA('#ffffff', a); x.lineWidth = Math.max(1, f.w * a);
          x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
          break;
        }
        case 'shock': {
          x.globalCompositeOperation = 'lighter';
          x.strokeStyle = hexA(f.col, a * 0.8);
          x.lineWidth = 6 * a + 1;
          x.beginPath(); x.ellipse(f.x, f.y, f.r * p, f.r * p * 0.6, 0, 0, Math.PI * 2); x.stroke();
          break;
        }
        case 'crack': {
          x.strokeStyle = `rgba(20,14,18,${a})`; x.lineWidth = 3;
          x.beginPath(); x.moveTo(f.x, f.y);
          const L = f.len * Math.min(1, p * 4);
          for (let i = 1; i <= 4; i++) x.lineTo(f.x + Math.cos(f.ang + Math.sin(i * 7 + f.ang) * 0.3) * L * (i / 4), f.y + Math.sin(f.ang + Math.sin(i * 7 + f.ang) * 0.3) * L * (i / 4) * 0.6);
          x.stroke();
          x.strokeStyle = `rgba(255,200,120,${a * 0.6})`; x.lineWidth = 1; x.stroke();
          break;
        }
        case 'swing': {
          const [x1, y1, x2, y2] = line(f.from, f.to);
          const ang = Math.atan2(y2 - y1, x2 - x1);
          x.strokeStyle = `rgba(255,255,255,${a * 0.9})`;
          x.lineWidth = 3;
          x.beginPath(); x.arc(x1, y1, T * 0.7, ang - 1 + p * 0.6, ang + 0.4 + p * 0.6); x.stroke();
          break;
        }
        case 'proj': {
          const [x1, y1, x2, y2] = line(f.from, f.to);
          const px = x1 + (x2 - x1) * Math.min(1, p * 1.3), py = y1 + (y2 - y1) * Math.min(1, p * 1.3) - 6;
          if (f.trail && Math.random() < 0.8) part({ k: 'glow', x: px, y: py, col: f.col, life: 0.25, size: 6, still: true });
          if (f.orb) {
            x.globalCompositeOperation = 'lighter';
            const g = x.createRadialGradient(px, py, 1, px, py, 10);
            g.addColorStop(0, f.col); g.addColorStop(1, 'rgba(0,0,0,0)');
            x.fillStyle = g; x.fillRect(px - 10, py - 10, 20, 20);
          } else {
            const ang = Math.atan2(y2 - y1, x2 - x1);
            x.strokeStyle = f.col; x.lineWidth = 2;
            x.beginPath(); x.moveTo(px - Math.cos(ang) * 12, py - Math.sin(ang) * 12); x.lineTo(px, py); x.stroke();
          }
          break;
        }
        case 'streak': {
          const [x1, y1, x2, y2] = line(f.from, f.to);
          x.globalCompositeOperation = 'lighter';
          x.strokeStyle = hexA(f.col, a);
          x.lineCap = 'round';
          x.lineWidth = f.w * a + 1;
          x.beginPath(); x.moveTo(x1, y1); x.lineTo(x1 + (x2 - x1) * Math.min(1, p * 3), y1 + (y2 - y1) * Math.min(1, p * 3)); x.stroke();
          break;
        }
        case 'zig': {
          const [x1, y1, x2, y2] = line(f.from, f.to);
          x.globalCompositeOperation = 'lighter';
          x.strokeStyle = hexA(f.col, a);
          x.lineWidth = f.small ? 1.5 : 3;
          x.beginPath(); x.moveTo(x1, y1);
          const n = f.small ? 3 : 8;
          for (let i = 1; i <= n; i++) {
            const t = i / n;
            x.lineTo(x1 + (x2 - x1) * t + (i < n ? (Math.random() - 0.5) * 16 : 0), y1 + (y2 - y1) * t + (i < n ? (Math.random() - 0.5) * 16 : 0));
          }
          x.stroke();
          break;
        }
        case 'ring': {
          x.globalCompositeOperation = 'lighter';
          x.strokeStyle = hexA(f.col, a);
          x.lineWidth = 4 * a + 1;
          x.beginPath(); x.ellipse(f.x, f.y + 6, f.r * (0.4 + p), f.r * (0.4 + p) * 0.6, 0, 0, Math.PI * 2); x.stroke();
          break;
        }
        case 'whirl': {
          x.strokeStyle = `rgba(255,255,255,${a})`;
          x.lineWidth = 4;
          x.beginPath(); x.arc(f.x, f.y, T * 1.3, p * 12, p * 12 + 2.5); x.stroke();
          x.beginPath(); x.arc(f.x, f.y, T * 1.1, p * 12 + 3.1, p * 12 + 5); x.stroke();
          break;
        }
        case 'impact': {
          x.globalCompositeOperation = 'lighter';
          x.strokeStyle = `rgba(255,240,200,${a})`;
          x.lineWidth = 3;
          for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            x.beginPath(); x.moveTo(f.x + Math.cos(ang) * 6, f.y + Math.sin(ang) * 6); x.lineTo(f.x + Math.cos(ang) * (10 + p * 26), f.y + Math.sin(ang) * (10 + p * 26)); x.stroke();
          }
          break;
        }
        case 'rain': {
          const yy = f.y - 60 + p * 60;
          x.strokeStyle = `rgba(255,243,196,${a})`;
          x.lineWidth = 2;
          x.beginPath(); x.moveTo(f.x - 4, yy - 14); x.lineTo(f.x, yy); x.stroke();
          break;
        }
        case 'spike': {
          const hgt = Math.sin(Math.min(1, p * 2) * Math.PI) * 26;
          x.fillStyle = f.bone ? '#a89f86' : '#b46cff';
          x.beginPath(); x.moveTo(f.x - 7, f.y + 10); x.lineTo(f.x, f.y + 10 - hgt); x.lineTo(f.x + 7, f.y + 10); x.fill();
          x.fillStyle = f.bone ? '#f4eedc' : '#e9d3ff';
          x.beginPath(); x.moveTo(f.x - 2, f.y + 10); x.lineTo(f.x, f.y + 10 - hgt * 0.9); x.lineTo(f.x + 3, f.y + 10); x.fill();
          break;
        }
        case 'claw': {
          x.strokeStyle = f.boss ? `rgba(255,80,60,${a})` : `rgba(255,140,120,${a})`;
          x.lineWidth = f.boss ? 4 : 2;
          for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(f.x - 10 + i * 6, f.y - 10); x.lineTo(f.x + 6 + i * 6, f.y + 10); x.stroke(); }
          break;
        }
        case 'thunder': {
          x.globalCompositeOperation = 'lighter';
          x.strokeStyle = `rgba(255,240,140,${a})`;
          x.lineWidth = 3;
          x.beginPath(); x.moveTo(f.x + 8, f.y - 200);
          for (let i = 1; i <= 8; i++) x.lineTo(f.x + (Math.random() - 0.5) * 18, f.y - 200 + i * 25);
          x.stroke();
          break;
        }
      }
      x.restore();
    }
    R.fxs = R.fxs.filter((f) => f.t < f.life);
  }

  function drawParts(x, run, dt) {
    const [hx, hy] = entPos(run.hero);
    for (const p of R.parts) {
      p.t += dt;
      if (p.hero) { p.oy += p.vy * dt; p.x = hx + T / 2 + p.ox; p.y = hy + T / 2 + p.oy; }
      else if (!p.still) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; }
      const a = Math.max(0, 1 - p.t / p.life);
      if (p.k === 'glow') {
        x.save();
        x.globalCompositeOperation = 'lighter';
        x.globalAlpha = a;
        const r = Math.max(2, Math.round(p.size * (p.still ? 1 + (1 - a) * 0.6 : 1)));
        x.drawImage(Spr.glow(p.col, r), p.x - r, p.y - r);
        x.restore();
        continue;
      }
      x.globalAlpha = a;
      x.fillStyle = p.col;
      if (p.k === 'streak') {
        x.strokeStyle = p.col; x.lineWidth = p.size;
        x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); x.stroke();
      } else if (p.k === 'shard') {
        p.rot += (p.vr || 0) * dt;
        x.save(); x.translate(p.x, p.y); x.rotate(p.rot);
        x.beginPath(); x.moveTo(0, -p.size); x.lineTo(p.size * 0.5, 0); x.lineTo(0, p.size); x.lineTo(-p.size * 0.5, 0); x.fill();
        x.restore();
      } else if (p.k === 'cross') {
        x.fillRect(Math.round(p.x - 1), Math.round(p.y - 4), 3, 9); x.fillRect(Math.round(p.x - 4), Math.round(p.y - 1), 9, 3);
      } else x.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    x.globalAlpha = 1;
    R.parts = R.parts.filter((p) => p.t < p.life);
    if (R.parts.length > 1400) R.parts.splice(0, R.parts.length - 1400);
  }

  // 光源閃爍：燈籠跳動得快，黑晶慢慢呼吸
  function lightFl(c) {
    return c.fl ? Math.sin(R.time * 9 + c.ph) * 0.05 + Math.sin(R.time * 23 + c.ph) * 0.03 : Math.sin(R.time * 2 + c.ph) * 0.1;
  }
  function drawLight(x, run, dt, ox, oy) {
    const l = R.lctx;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, W, H);
    l.fillStyle = 'rgba(6,3,12,0.74)';
    l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-out';
    const hole = (px, py, r, a) => {
      px -= ox; py -= oy;
      if (px < -r || py < -r || px > W + r || py > H + r) return;
      const g = l.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(0.55, `rgba(0,0,0,${a * 0.75})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.fillRect(px - r, py - r, r * 2, r * 2);
    };
    const [hx, hy] = entPos(run.hero);
    const flick = 1 + Math.sin(R.time * 11) * 0.02 + Math.sin(R.time * 23) * 0.015;
    hole(hx + T / 2, hy + T / 2, 300 * flick, 1);
    for (const c of R.lights) hole(c.x, c.y, (c.r || 80) * (1 + lightFl(c)), 0.75);
    for (const z of run.zones) for (const [zx, zy] of z.cells) hole(cx(zx), cy(zy), 70, 0.6);
    for (const z of run.hazards || []) for (let i = 0; i < z.cells.length; i += 3) hole(cx(z.cells[i][0]), cy(z.cells[i][1]), 50, 0.4);
    for (const b of R.beams) hole(b.x, b.y, 90, 0.8);
    for (const m of run.mobs) {
      if (m.boss) { const [mx, my] = entPos(m); hole(mx + T, my + T, m.cur ? 160 : 110, 0.7); }
      if (m.boss && m.cur) for (let i = 0; i < m.cur.cells.length; i += 2) hole(cx(m.cur.cells[i][0]), cy(m.cur.cells[i][1]), 50, 0.7);
      if (m.type === 'priest') { const [mx, my] = entPos(m); hole(mx + T / 2, my + T / 2, 50, 0.5); }
    }
    for (const f of R.fxs) if ((f.k === 'cells' || f.k === 'ring') && f.t >= 0) {
      if (f.cells) for (let i = 0; i < f.cells.length; i += 2) hole(cx(f.cells[i][0]), cy(f.cells[i][1]), 60, 0.6 * (1 - f.t / f.life));
      else hole(f.x, f.y, 120, 0.7 * (1 - f.t / f.life));
    }
    x.drawImage(R.light, ox, oy);
    // 彩色光暈
    x.save();
    x.globalCompositeOperation = 'lighter';
    for (const c of R.lights) {
      if (c.x < ox - 50 || c.y < oy - 50 || c.x > ox + W + 50 || c.y > oy + H + 50) continue;
      const g = x.createRadialGradient(c.x, c.y, 0, c.x, c.y, 46);
      g.addColorStop(0, `rgba(${c.col},${0.2 + lightFl(c) * 0.5})`);
      g.addColorStop(1, `rgba(${c.col},0)`);
      x.fillStyle = g;
      x.fillRect(c.x - 46, c.y - 46, 92, 92);
    }
    const g = x.createRadialGradient(hx + T / 2, hy + T / 2, 0, hx + T / 2, hy + T / 2, 180);
    g.addColorStop(0, `rgba(255,150,70,${0.1 * flick})`);
    g.addColorStop(1, 'rgba(255,150,70,0)');
    x.fillStyle = g;
    x.fillRect(hx - 180, hy - 180, 400, 400);
    x.restore();
  }

  // 飄浮的礦塵與畫面四角暗角
  function drawDust(x, dt) {
    const D2 = R.dust || (R.dust = []);
    while (D2.length < 60) D2.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 5, ph: Math.random() * 6, s: Math.random() < 0.2 ? 2 : 1 });
    x.save();
    x.globalCompositeOperation = 'lighter';
    for (const p of D2) {
      p.x += (p.vx + Math.sin(R.time + p.ph) * 3) * dt;
      p.y += p.vy * dt;
      if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
      x.fillStyle = `rgba(210,190,255,${0.12 + 0.1 * Math.sin(R.time * 2 + p.ph)})`;
      x.fillRect(p.x, p.y, p.s, p.s);
    }
    x.restore();
    if (!R.vig) {
      R.vig = document.createElement('canvas');
      R.vig.width = W; R.vig.height = H;
      const v = R.vig.getContext('2d');
      const g = v.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      v.fillStyle = g;
      v.fillRect(0, 0, W, H);
    }
    x.drawImage(R.vig, 0, 0);
  }

  function drawBeams(x, dt) {
    x.save();
    x.globalCompositeOperation = 'lighter';
    for (const b of R.beams) {
      b.t += dt;
      const p = b.t / b.life;
      const a = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      const hgt = 90 + b.r * 30;
      const w = 6 + b.r * 2;
      const g = x.createLinearGradient(0, b.y - hgt, 0, b.y);
      g.addColorStop(0, hexA(b.col, 0));
      g.addColorStop(1, hexA(b.col, a * 0.85));
      x.fillStyle = g;
      x.fillRect(b.x - w / 2, b.y - hgt, w, hgt);
      x.fillStyle = hexA('#ffffff', a * 0.6);
      x.fillRect(b.x - 1, b.y - hgt * 0.8, 2, hgt * 0.8);
      const r = x.createRadialGradient(b.x, b.y, 0, b.x, b.y, 22 + b.r * 4);
      r.addColorStop(0, hexA(b.col, a * 0.8));
      r.addColorStop(1, hexA(b.col, 0));
      x.fillStyle = r;
      x.fillRect(b.x - 40, b.y - 40, 80, 80);
      if (b.r >= 4 && Math.random() < 0.5) part({ x: b.x + (Math.random() - 0.5) * 30, y: b.y - Math.random() * hgt, vy: -20, col: b.col, life: 0.6, size: 2 });
      if (b.uq) {
        // 傳奇寶物：外圈慢慢旋轉的光環與往上飄的金粉
        x.strokeStyle = hexA('#fff2c0', a * 0.7);
        x.lineWidth = 2;
        const rr = 16 + Math.sin(b.t * 4) * 4;
        x.beginPath(); x.ellipse(b.x, b.y, rr * 1.6, rr * 0.6, 0, 0, Math.PI * 2); x.stroke();
        x.fillStyle = hexA('#ffffff', a * 0.5);
        x.fillRect(b.x - 3, b.y - hgt, 6, hgt);
        if (Math.random() < 0.8) part({ x: b.x + (Math.random() - 0.5) * 40, y: b.y - Math.random() * 20, vy: -60 - Math.random() * 60, col: Math.random() < 0.5 ? '#ffe08a' : '#fff6d0', life: 1.1, size: 2 });
      }
    }
    x.restore();
    R.beams = R.beams.filter((b) => b.t < b.life);
  }

  // 傳奇寶物掉落時畫面中央的大字
  function drawBanner(x, dt) {
    const b = R.banner;
    b.t += dt;
    if (b.t > b.life) { R.banner = null; return; }
    const a = b.t < 0.25 ? b.t / 0.25 : b.t > b.life - 0.7 ? Math.max(0, (b.life - b.t) / 0.7) : 1;
    const s = 1 + 0.6 * Math.max(0, 1 - b.t / 0.22);
    x.save();
    x.globalAlpha = a;
    x.translate(SW / 2, SH * 0.27);
    x.scale(s, s);
    const g = x.createLinearGradient(-340, 0, 340, 0);
    g.addColorStop(0, 'rgba(20,12,0,0)'); g.addColorStop(0.5, 'rgba(24,14,2,0.82)'); g.addColorStop(1, 'rgba(20,12,0,0)');
    x.fillStyle = g;
    x.fillRect(-340, -44, 680, b.isNew ? 100 : 86);
    const lg = x.createLinearGradient(-300, 0, 300, 0);
    lg.addColorStop(0, 'rgba(230,192,104,0)'); lg.addColorStop(0.5, 'rgba(255,226,150,0.95)'); lg.addColorStop(1, 'rgba(230,192,104,0)');
    x.fillStyle = lg;
    x.fillRect(-300, -44, 600, 2);
    x.fillRect(-300, b.isNew ? 54 : 40, 600, 2);
    x.textAlign = 'center';
    x.font = '700 14px "Noto Serif TC", serif';
    x.fillStyle = '#f3dc9a';
    x.fillText('✦ 傳奇寶物 ✦', 0, -20);
    x.font = '900 34px "Noto Serif TC", serif';
    x.shadowColor = '#ffcf6a';
    x.shadowBlur = 18 + Math.sin(b.t * 6) * 6;
    x.lineWidth = 5;
    x.strokeStyle = 'rgba(40,20,0,0.9)';
    x.strokeText(b.s, 0, 20);
    x.fillStyle = '#ffe6a0';
    x.fillText(b.s, 0, 20);
    x.shadowBlur = 0;
    if (b.isNew) {
      x.font = '700 13px "Noto Sans TC", sans-serif';
      x.fillStyle = '#9aff8a';
      x.fillText('圖鑑新發現！', 0, 44);
    }
    x.restore();
  }

  function drawTexts(x, dt) {
    x.textAlign = 'center';
    x.lineJoin = 'round';
    for (const t of R.texts) {
      t.t += dt;
      const p = t.t / t.life;
      // 先彈起再落下（back-out）
      const k = Math.min(1, t.t / 0.18);
      const pop = t.big ? 1 + 0.6 * Math.sin(k * Math.PI) * (1 - k * 0.5) : 1 + 0.25 * Math.sin(k * Math.PI);
      // 傷害數字：普通的小字、技能的大字、燒傷的更小更淡
      const base = t.v == null ? (t.big ? 21 : 14) : t.dot ? 9 : t.big ? 17 : 11;
      const fs = Math.round(base * pop);
      x.font = `900 ${fs}px "Silkscreen", "Noto Sans TC", monospace`;
      x.globalAlpha = Math.max(0, 1 - Math.pow(Math.max(0, p - 0.35) / 0.65, 2)) * (t.dot ? 0.7 : 1);
      const yy = t.y - (1 - Math.pow(1 - Math.min(1, p * 1.6), 3)) * (t.v == null ? 30 : 20);
      const xx = t.x + t.vx * p;
      t.cx = xx; t.cy = yy;
      x.lineWidth = t.v == null ? (t.big ? 5 : 4) : t.big ? 4 : 3;
      x.strokeStyle = 'rgba(0,0,0,0.9)';
      x.strokeText(t.s, xx, yy);
      x.fillStyle = t.col;
      x.fillText(t.s, xx, yy);
      if (t.big) { x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillText(t.s, xx, yy - 1); }
    }
    x.globalAlpha = 1;
    R.texts = R.texts.filter((t) => t.t < t.life);
    if (R.texts.length > 120) R.texts.splice(0, R.texts.length - 120);
  }

  LH.Render = { init, draw, reset, setZoom, drawHeld, R, W: SW, H: SH, T };
})(typeof window !== 'undefined' ? window : globalThis);
