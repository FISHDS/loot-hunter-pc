// 共用工具：亂數、數學、命名空間。瀏覽器與 Node 測試共用。
(function (root) {
  const LH = (root.LH = root.LH || {});

  // 可存檔的亂數：狀態只是一個整數，存進存檔就能接續，避免重開遊戲重抽掉落。
  function rngNext(holder) {
    let t = (holder.rng = (holder.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function makeRng(seed) {
    const holder = { rng: seed >>> 0 };
    return {
      holder,
      next: () => rngNext(holder),
    };
  }

  const U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (h) => rngNext(h),
    randInt: (h, a, b) => a + Math.floor(rngNext(h) * (b - a + 1)),
    randRange: (h, a, b) => a + rngNext(h) * (b - a),
    chance: (h, p) => rngNext(h) < p,
    pick: (h, arr) => arr[Math.floor(rngNext(h) * arr.length)],
    weighted(h, entries) {
      // entries: [[value, weight], ...]
      let total = 0;
      for (const e of entries) total += e[1];
      let r = rngNext(h) * total;
      for (const e of entries) {
        r -= e[1];
        if (r < 0) return e[0];
      }
      return entries[entries.length - 1][0];
    },
    shuffle(h, arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rngNext(h) * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    cheb: (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by)),
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    hashStr(s) {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    },
    fmt(n) {
      if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
      if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
      return String(Math.round(n));
    },
    fmtTime(sec) {
      sec = Math.max(0, Math.floor(sec));
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      if (h) return `${h} 小時 ${m} 分`;
      if (m) return `${m} 分 ${s} 秒`;
      return `${s} 秒`;
    },
    clone: (o) => JSON.parse(JSON.stringify(o)),
  };

  // 八方向，順序固定（影響技能選方向的平手處理）
  U.DIRS8 = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  LH.U = U;
  LH.makeRng = makeRng;
})(typeof window !== 'undefined' ? window : globalThis);
