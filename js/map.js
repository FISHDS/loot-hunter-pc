// 地圖產生（同主題同層固定）與尋路距離場。
(function (root) {
  const LH = root.LH;
  const { U } = LH;

  const W = 64, H = 40;

  // 0 地面、1 岩壁。由多個洞室與蜿蜒坑道組成，角色從中央洞室出發往四周探索。
  function generate(dungeon, floor) {
    const h = { rng: U.hashStr(dungeon + ':' + floor) };
    const t = new Array(W * H).fill(1);
    const set = (x, y, v) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) t[y * W + x] = v; };

    // 洞室
    const rooms = [{ x: W >> 1, y: H >> 1, rx: 6, ry: 4, center: true }];
    for (let tries = 0; tries < 600 && rooms.length < 12; tries++) {
      const rx = U.randInt(h, 3, 6), ry = U.randInt(h, 2, 4);
      const x = U.randInt(h, rx + 2, W - rx - 3), y = U.randInt(h, ry + 2, H - ry - 3);
      if (rooms.some((r) => Math.abs(r.x - x) < r.rx + rx + 4 && Math.abs(r.y - y) < r.ry + ry + 3)) continue;
      rooms.push({ x, y, rx, ry });
    }
    for (const r of rooms) {
      for (let y = r.y - r.ry - 1; y <= r.y + r.ry + 1; y++)
        for (let x = r.x - r.rx - 1; x <= r.x + r.rx + 1; x++) {
          const d = ((x - r.x) / r.rx) ** 2 + ((y - r.y) / r.ry) ** 2;
          if (d < 1 + (U.rand(h) - 0.5) * 0.4) set(x, y, 0);
        }
    }
    // 坑道：最小生成樹＋幾條環路，用帶偏向的醉漢走法挖出彎曲通道
    const dig = (a, b) => {
      let x = a.x, y = a.y;
      for (let n = 0; n < 400 && (x !== b.x || y !== b.y); n++) {
        if (U.rand(h) < 0.68) {
          if (Math.abs(b.x - x) > Math.abs(b.y - y) ? U.rand(h) < 0.8 : U.rand(h) < 0.2) x += Math.sign(b.x - x);
          else y += Math.sign(b.y - y);
        } else {
          const [dx, dy] = U.pick(h, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
          x = U.clamp(x + dx, 2, W - 3); y = U.clamp(y + dy, 2, H - 3);
        }
        set(x, y, 0); set(x + 1, y, 0); set(x, y + 1, 0);
        if (U.rand(h) < 0.25) set(x + 1, y + 1, 0);
      }
    };
    const linked = [0];
    const rest = rooms.map((_, i) => i).slice(1);
    while (rest.length) {
      let best = null;
      for (const a of linked) for (const b of rest) {
        const d = U.dist(rooms[a].x, rooms[a].y, rooms[b].x, rooms[b].y);
        if (!best || d < best.d) best = { a, b, d };
      }
      dig(rooms[best.a], rooms[best.b]);
      linked.push(best.b);
      rest.splice(rest.indexOf(best.b), 1);
    }
    for (let i = 0; i < 3; i++) {
      const a = U.pick(h, rooms), b = U.pick(h, rooms);
      if (a !== b && U.dist(a.x, a.y, b.x, b.y) < 30) dig(a, b);
    }
    // 修飾：去掉孤立小石、填掉被包圍的小坑
    const n0 = t.slice();
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        let c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) c += n0[(y + dy) * W + x + dx];
        if (n0[y * W + x] && c <= 2) t[y * W + x] = 0;
        if (!n0[y * W + x] && c >= 7) t[y * W + x] = 1;
      }
    // 大洞室裡的岩柱，提供掩護與卡位
    for (const r of rooms) {
      if (r.center || r.rx < 5) continue;
      const k = U.randInt(h, 1, 2);
      for (let i = 0; i < k; i++) {
        const px = r.x + U.randInt(h, -r.rx + 2, r.rx - 2), py = r.y + U.randInt(h, -r.ry + 1, r.ry - 1);
        set(px, py, 1);
        if (U.rand(h) < 0.5) set(px + 1, py, 1);
      }
    }
    const start = [rooms[0].x, rooms[0].y];
    for (let y = start[1] - 2; y <= start[1] + 2; y++) for (let x = start[0] - 3; x <= start[0] + 3; x++) set(x, y, 0);
    // 只保留和中央相連的區域
    const seen = new Uint8Array(W * H);
    const q = [start[1] * W + start[0]];
    seen[q[0]] = 1;
    while (q.length) {
      const c = q.pop();
      const x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        const ni = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ni] || t[ni]) continue;
        seen[ni] = 1;
        q.push(ni);
      }
    }
    for (let i = 0; i < W * H; i++) if (!seen[i]) t[i] = 1;

    // 裝飾：黑晶（光源）、碎石、骨頭
    const deco = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (t[i] === 1) {
          const nearFloor = !t[i + 1] || !t[i - 1] || !t[i + W] || !t[i - W];
          if (nearFloor && U.rand(h) < 0.035) deco.push({ x, y, k: 'crystal', v: U.randInt(h, 0, 2) });
        } else if (U.rand(h) < 0.02) deco.push({ x, y, k: 'rubble', v: U.randInt(h, 0, 2) });
        else if (U.rand(h) < 0.008) deco.push({ x, y, k: 'bones', v: 0 });
      }
    const shade = new Array(W * H);
    for (let i = 0; i < W * H; i++) shade[i] = Math.floor(U.rand(h) * 4);
    // 沼澤：一塊塊會拖慢腳步的屍水
    const dg = LH.D && LH.D.DUNGEON[dungeon];
    let slow = null;
    if (dg && dg.swamp) {
      slow = new Array(W * H).fill(0);
      const floors = [];
      for (let i = 0; i < W * H; i++) if (!t[i]) floors.push(i);
      const target = Math.floor(floors.length * dg.swamp);
      let made = 0;
      for (let tries = 0; tries < 200 && made < target; tries++) {
        let c = U.pick(h, floors);
        const cx = c % W, cy = (c / W) | 0;
        if (U.dist(cx, cy, start[0], start[1]) < 4) continue;
        const size = U.randInt(h, 6, 14);
        for (let k = 0; k < size; k++) {
          if (!t[c] && !slow[c]) { slow[c] = 1; made++; }
          const [dx, dy] = U.pick(h, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
          const n = c + dx + dy * W;
          if (n > 0 && n < W * H && !t[n]) c = n;
        }
      }
    }
    // 熔岩：踩上去會被灼傷，角色會盡量繞開
    let lava = null, lavaCost = null;
    if (dg && dg.lava) {
      lava = new Array(W * H).fill(0);
      lavaCost = new Uint8Array(W * H);
      const floors = [];
      for (let i = 0; i < W * H; i++) if (!t[i]) floors.push(i);
      const target = Math.floor(floors.length * dg.lava);
      let made = 0;
      for (let tries = 0; tries < 200 && made < target; tries++) {
        let c = U.pick(h, floors);
        const cx = c % W, cy = (c / W) | 0;
        if (U.dist(cx, cy, start[0], start[1]) < 5) continue;
        const size = U.randInt(h, 5, 11);
        for (let k = 0; k < size; k++) {
          const x0 = c % W, y0 = (c / W) | 0;
          if (!t[c] && !lava[c] && U.dist(x0, y0, start[0], start[1]) >= 4) { lava[c] = 1; lavaCost[c] = 6; made++; }
          const [dx, dy] = U.pick(h, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
          const n = c + dx + dy * W;
          if (n > 0 && n < W * H && !t[n]) c = n;
        }
      }
    }
    // 星光：站在裡面法力回得特別快（對角色有利的地形）
    let star = null;
    if (dg && dg.starlight) {
      star = new Array(W * H).fill(0);
      const floors = [];
      for (let i = 0; i < W * H; i++) if (!t[i] && !(lava && lava[i])) floors.push(i);
      const target = Math.floor(floors.length * dg.starlight);
      let made = 0;
      for (let tries = 0; tries < 200 && made < target; tries++) {
        let c = U.pick(h, floors);
        const cx = c % W, cy = (c / W) | 0;
        if (U.dist(cx, cy, start[0], start[1]) < 5) continue;
        const size = U.randInt(h, 3, 6);
        for (let k = 0; k < size; k++) {
          if (!t[c] && !star[c]) { star[c] = 1; made++; }
          const [dx, dy] = U.pick(h, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
          const n = c + dx + dy * W;
          if (n > 0 && n < W * H && !t[n]) c = n;
        }
      }
    }
    return { w: W, h: H, t, deco, spawns: [], shade, start, rooms: rooms.map((r) => [r.x, r.y]), slow, lava, lavaCost, star, theme: dg ? dg.theme : 'mine' };
  }

  function walkable(map, x, y) {
    return x >= 0 && y >= 0 && x < map.w && y < map.h && map.t[y * map.w + x] === 0;
  }

  // 以目標為源點的距離場（八方向、不切牆角）
  // cost：額外的每格成本（例如熔岩），讓角色選擇繞路
  function distField(map, sources, cost) {
    const N = map.w * map.h;
    const d = new Float32Array(N).fill(1e9);
    const q = [];
    for (const [x, y] of sources) {
      const i = y * map.w + x;
      d[i] = 0;
      q.push(i);
    }
    // 對稱權重的簡易 Dijkstra：直線 1，斜線 1.4；格子少，用排序佇列足夠
    let head = 0;
    const W = map.w;
    while (head < q.length) {
      const c = q[head++];
      const x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of U.DIRS8) {
        const nx = x + dx, ny = y + dy;
        if (!walkable(map, nx, ny)) continue;
        if (dx && dy && (!walkable(map, x + dx, y) || !walkable(map, x, y + dy))) continue;
        const ni = ny * W + nx;
        const nd = d[c] + (dx && dy ? 1.4 : 1) + (cost ? cost[ni] : 0);
        if (nd < d[ni] - 1e-6) {
          d[ni] = nd;
          q.push(ni);
        }
      }
    }
    return d;
  }

  // 視線：從 a 到 b 的格線（不含端點）
  function lineCells(ax, ay, bx, by) {
    const out = [];
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let i = 1; i < n; i++) {
      out.push([Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n)]);
    }
    return out;
  }

  LH.Map = { generate, walkable, distField, lineCells, W, H };
})(typeof window !== 'undefined' ? window : globalThis);
