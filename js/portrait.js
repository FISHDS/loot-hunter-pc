// 標題畫面的主角特寫：Q版大頭小男孩扛著劍、站在營火旁（像素手繪，不含照片）
// 電腦版與手機版共用：在電腦版修改，再用「同步核心.bat」複製到手機版。
(function (root) {
  const LH = root.LH;
  // 頭：26 寬、29 高
  // H 頭髮 h 頭髮反光 S 皮膚 s 皮膚陰影 k 耳朵內側 b 眉毛 E 眼睛 W 眼睛亮點 N 鼻子 B 臉紅 M 嘴巴 T 牙齒 R 舌頭 L 下唇
  const HEAD = [
    '.........HHHHHHHH.........',
    '......HHHHHHHHHHHHHH......',
    '....HHHHHHhhHHHHHHHHHH....',
    '...HHHHHhhHHHHHHhhHHHHH...',
    '..HHHHHHHHHHHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHHHHHHHHHH..',
    '.HHHHHHHHHHHHHHHHHHHHHHHH.',
    '.HHHHHHSHHHHHHHHHSSHHHHHH.',
    '.HHHHSSSSHHHSHHSSSSSHHHHH.',
    '.HHHSSSSSSSSSSSSSSSSSSHHH.',
    '.HHSSSSSSSSSSSSSSSSSSSSHH.',
    '.HHSSSSSSSSSSSSSSSSSSSSHH.',
    '.HSSSSSSSSSSSSSSSSSSSSSSH.',
    '.HSSSbbbbSSSSSSSSbbbbSSSH.',
    'sHSSSSSSSSSSSSSSSSSSSSSSHs',
    'skSSSSSSSSSSSSSSSSSSSSSSks',
    'skSSSEEEEESSSSSSEEEEESSSks',
    'skSSSsEWEsSSSSSSsEWEsSSSks',
    'sSSSSSssSSSSSSSSSSssSSSSSs',
    '.SSBBBSSSSSSNSSSSSSBBBSSS.',
    '.SSBBBSSSSSNNNSSSSSBBBSSS.',
    '.SSSSSSSSSSSSSSSSSSSSSSSS.',
    '.SSSSSSSMMMMMMMMMSSSSSSSS.',
    '.sSSSSSSMTTTTTTTMSSSSSSSs.',
    '..SSSSSSSMMRRRMMSSSSSSSS..',
    '..sSSSSSSSLLLLLSSSSSSSs...',
    '...sSSSSSSSSSSSSSSSSSs....',
    '.....ssSSSSSSSSSSSss......',
    '.......ssssssssssss.......',
  ];
  // 眨眼時，眼睛那兩列換成這兩列
  const BLINK = [
    'skSSSSSSSSSSSSSSSSSSSSSSks',
    'skSSSEEEEESSSSSSEEEEESSSks',
  ];
  const PAL = {
    H: '#2a2230', h: '#544a60', S: '#f4d4ba', s: '#deb498', k: '#c49278', b: '#68504a',
    E: '#1e161a', W: '#f6f2ec', N: '#d6a288', B: '#f4baaa', M: '#601e24', T: '#faf6e8', R: '#c84a56', L: '#d66c70',
  };
  const SHIRT = '#eeeae2', SHIRT2 = '#cfcac0', PANTS = '#3a4468', PANTS2 = '#2a3150', SKIN = PAL.S, SKIN2 = PAL.s;
  const DOTS = [[11, 33, '#e05050'], [15, 31, '#e8c040'], [24, 33, '#4896dc'], [19, 36, '#e05050'], [13, 39, '#4896dc'], [27, 38, '#e8c040'], [22, 42, '#e05050'], [16, 45, '#e8c040'], [26, 46, '#4896dc'], [11, 47, '#e8c040']];
  const W = 40, H = 57;

  // 畫一個 40×57 點的主角（每點 1 單位），blink：是否眨眼，breathe：呼吸起伏（0 或 1）
  function figure(x, blink, breathe) {
    const r = (px, py, w, h, c) => { x.fillStyle = c; x.fillRect(px, py, w, h); };
    const by = breathe; // 上半身隨呼吸上下 1 點
    // 劍（畫在頭和身體後面）：劍柄握在胸前，劍身從右肩往左上斜靠
    const hx = 12, hy = 40 - by;
    for (let t = 0; t <= 34; t++) {
      const px = Math.round(hx - t * 0.5), py = hy - 4 - t;
      const tip = t > 31 ? 1 : 0;
      r(px - 1, py, tip ? 2 : 3, 1, '#8d95a1');
      r(px, py, tip ? 1 : 2, 1, t > 29 ? '#ffffff' : '#dfe6ee');
    }
    // 身體：短褲、上衣、手
    r(10, 50, 9, 7, PANTS); r(21, 50, 9, 7, PANTS); r(10, 50, 20, 2, PANTS); r(19, 52, 2, 5, PANTS2); r(26, 50, 4, 7, PANTS2);
    r(9, 30 - by, 22, 21, SHIRT); r(27, 30 - by, 4, 21, SHIRT2); r(9, 49 - by, 22, 2, SHIRT2);
    r(5, 31 - by, 5, 6, SHIRT); r(30, 31 - by, 5, 6, SHIRT2); // 短袖
    for (const [dx, dy, c] of DOTS) r(dx, dy - by, 1, 1, c);
    r(17, 28 - by, 6, 3, SKIN); r(18, 31 - by, 4, 1, SKIN2); // 脖子
    // 左手（畫面右邊）垂下
    r(31, 37 - by, 3, 10, SKIN); r(33, 37 - by, 1, 10, SKIN2); r(30, 46 - by, 4, 3, SKIN);
    // 右手（畫面左邊）彎到胸前握劍
    r(5, 37 - by, 4, 4, SKIN); r(6, 40 - by, 6, 3, SKIN); r(5, 40 - by, 1, 3, SKIN2);
    // 劍柄與護手
    r(hx - 5, hy - 5, 11, 2, '#d9a441'); r(hx - 5, hy - 5, 11, 1, '#ffe08a'); r(hx - 6, hy - 5, 1, 2, '#ffe08a'); r(hx + 6, hy - 5, 1, 2, '#ffe08a');
    r(hx - 1, hy - 2, 2, 6, '#6a4224'); r(hx - 1, hy + 4, 2, 2, '#d9a441');
    r(hx - 2, hy - 1, 4, 3, SKIN); r(hx - 2, hy + 1, 4, 1, SKIN2); // 握劍的拳頭
    // 頭
    const rows = blink ? HEAD.slice(0, 16).concat(BLINK, HEAD.slice(18)) : HEAD;
    rows.forEach((row, ry) => {
      for (let c = 0; c < row.length; c++) {
        const col = PAL[row[c]];
        if (col) r(7 + c, ry - by, 1, 1, col);
      }
    });
  }

  // 輪廓：在每個實心點旁邊描一圈深色外框
  const cache = {};
  function sprite(blink, breathe) {
    const k = (blink ? 1 : 0) + ':' + breathe;
    if (cache[k]) return cache[k];
    const c = document.createElement('canvas');
    c.width = W + 2; c.height = H + 2;
    const x = c.getContext('2d');
    x.translate(1, 1);
    figure(x, blink, breathe);
    const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
    const solid = (i) => d[i + 3] > 0;
    const out = x.createImageData(c.width, c.height), o = out.data;
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
      const i = (y * c.width + xx) * 4;
      if (solid(i)) { o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = 255; continue; }
      let edge = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = xx + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < c.width && Y < c.height && solid((Y * c.width + X) * 4)) edge = true;
      }
      if (edge) { o[i] = 14; o[i + 1] = 10; o[i + 2] = 18; o[i + 3] = 255; }
    }
    // 輪廓光：右邊被營火照亮（暖色）、頭頂一點冷光，深色頭髮在暗背景裡才看得出形狀
    const solidO = (X, Y) => X >= 0 && Y >= 0 && X < c.width && Y < c.height && o[(Y * c.width + X) * 4 + 3] && !(o[(Y * c.width + X) * 4] === 14 && o[(Y * c.width + X) * 4 + 2] === 18);
    const rim = [];
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
      if (!solidO(xx, y)) continue;
      if (!solidO(xx + 1, y)) rim.push([xx, y, [255, 170, 90], 0.45]);
      else if (!solidO(xx, y - 1)) rim.push([xx, y, [190, 170, 255], 0.3]);
    }
    for (const [xx, y, col, a] of rim) {
      const i = (y * c.width + xx) * 4;
      for (let q = 0; q < 3; q++) o[i + q] = Math.round(o[i + q] * (1 - a) + col[q] * a);
    }
    x.putImageData(out, 0, 0);
    return (cache[k] = c);
  }

  // 在 (cx, footY) 畫主角特寫加營火：cx＝主角中心、footY＝腳底、s＝每點放大倍數、t＝秒數
  const sparks = [];
  function draw(x, cx, footY, s, t, dt) {
    s = Math.max(1, Math.round(s));
    const blink = (t % 4.2) < 0.14;
    const breathe = Math.floor(t * 0.8) % 2;
    const fl = 1 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04;
    const fx = cx + 34 * s, fy = footY - 6 * s; // 營火在主角右邊
    // 火光：照亮地面和主角
    x.save();
    x.globalCompositeOperation = 'lighter';
    const g = x.createRadialGradient(fx, fy, 2, fx, fy, 70 * s * fl);
    g.addColorStop(0, 'rgba(255,150,60,0.42)'); g.addColorStop(0.5, 'rgba(255,110,40,0.12)'); g.addColorStop(1, 'rgba(255,90,30,0)');
    x.fillStyle = g; x.fillRect(fx - 72 * s, fy - 72 * s, 144 * s, 144 * s);
    x.restore();
    // 影子
    x.fillStyle = 'rgba(0,0,0,0.45)';
    x.beginPath(); x.ellipse(cx, footY, 17 * s, 3 * s, 0, 0, 7); x.fill();
    // 主角
    const img = sprite(blink, breathe);
    x.imageSmoothingEnabled = false;
    x.drawImage(img, Math.round(cx - (W / 2 + 1) * s), Math.round(footY - (H + 1) * s), img.width * s, img.height * s);
    // 營火：木柴與火焰
    const fire = LH.Spr && LH.Spr.get ? LH.Spr.get('fire' + (Math.floor(t * 8) % 3)) : null;
    x.fillStyle = 'rgba(0,0,0,0.45)';
    x.beginPath(); x.ellipse(fx, footY, 10 * s, 2.5 * s, 0, 0, 7); x.fill();
    if (fire) x.drawImage(fire, Math.round(fx - 8 * s * 1.8), Math.round(footY - 15 * s * 1.8), Math.round(16 * s * 1.8), Math.round(16 * s * 1.8));
    // 火星往上飄
    if (dt && Math.random() < dt * 8) sparks.push({ x: fx + (Math.random() - 0.5) * 6 * s, y: footY - 10 * s, vy: -(12 + Math.random() * 16) * s, vx: (Math.random() - 0.5) * 4 * s, t: 0 });
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.t += dt || 0; p.y += p.vy * (dt || 0); p.x += p.vx * (dt || 0) + Math.sin(p.t * 6) * 0.3;
      if (p.t > 1.2) { sparks.splice(i, 1); continue; }
      x.fillStyle = `rgba(255,${Math.round(200 - p.t * 100)},90,${1 - p.t / 1.2})`;
      x.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, s), Math.max(1, s));
    }
  }

  LH.Portrait = { draw, sprite, W, H };
})(typeof window !== 'undefined' ? window : globalThis);
