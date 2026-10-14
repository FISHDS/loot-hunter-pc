// 戰利品背包：不規則形狀、可旋轉的格子背包。
(function (root) {
  const LH = root.LH;
  const { Items } = LH;

  function create(n) {
    return { w: n, h: n, items: [] };
  }

  function grid(pack, exceptId) {
    const g = new Array(pack.w * pack.h).fill(null);
    for (const p of pack.items) {
      if (p.it.id === exceptId) continue;
      for (const [cx, cy] of Items.cells(p.it, p.rot)) g[(p.y + cy) * pack.w + p.x + cx] = p.it.id;
    }
    return g;
  }

  function fits(pack, it, x, y, rot, exceptId, g) {
    g = g || grid(pack, exceptId);
    for (const [cx, cy] of Items.cells(it, rot)) {
      const gx = x + cx, gy = y + cy;
      if (gx < 0 || gy < 0 || gx >= pack.w || gy >= pack.h) return false;
      if (g[gy * pack.w + gx]) return false;
    }
    return true;
  }

  function find(pack, it, g) {
    g = g || grid(pack);
    for (let y = 0; y < pack.h; y++)
      for (let x = 0; x < pack.w; x++)
        for (let rot = 0; rot < 4; rot++) if (fits(pack, it, x, y, rot, null, g)) return { x, y, rot };
    return null;
  }

  function autoPlace(pack, it) {
    const spot = find(pack, it);
    if (!spot) return false;
    pack.items.push({ it, x: spot.x, y: spot.y, rot: spot.rot });
    return true;
  }

  function remove(pack, id) {
    const i = pack.items.findIndex((p) => p.it.id === id);
    if (i < 0) return null;
    return pack.items.splice(i, 1)[0].it;
  }

  function move(pack, id, x, y, rot) {
    const p = pack.items.find((q) => q.it.id === id);
    if (!p || !fits(pack, p.it, x, y, rot, id)) return false;
    p.x = x; p.y = y; p.rot = rot;
    return true;
  }

  function size(it) {
    return Items.cells(it, 0).length;
  }

  // 重新整理：先試著全部放進去（大件優先）；放不下時依優先序保留，回傳放不下的物品
  function repack(pack, list, priority) {
    const tryOrder = (order) => {
      const p = create(pack.w);
      p.h = pack.h;
      const dropped = [];
      for (const it of order) if (!autoPlace(p, it)) dropped.push(it);
      return { p, dropped };
    };
    const bySize = list.slice().sort((a, b) => size(b) - size(a));
    let r = tryOrder(bySize);
    if (r.dropped.length) {
      const byPri = list.slice().sort((a, b) => priority(b) - priority(a) || size(b) - size(a));
      const r2 = tryOrder(byPri);
      r = r2;
    }
    pack.items = r.p.items;
    return r.dropped;
  }

  function count(pack, kind) {
    return pack.items.filter((p) => p.it.potion === kind).length;
  }

  function freeCells(pack) {
    return grid(pack).filter((c) => !c).length;
  }

  LH.Pack = { create, grid, fits, find, autoPlace, remove, move, repack, count, freeCells };
})(typeof window !== 'undefined' ? window : globalThis);
