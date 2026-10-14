// 主角換成Q版大頭小男孩（黑色西瓜頭、圓臉、張嘴笑）
// 電腦版與手機版共用：在電腦版修改，再用「同步核心.bat」複製到手機版。
(function (root) {
  const LH = root.LH;
  const Spr = LH.Spr;
  // 頭的格子圖：16 寬，第一列是第 -1 列（頭盔頂飾用），下巴在第 15 列
  // H 頭髮 h 頭髮反光 S 皮膚 s 皮膚陰影 E 眼睛 W 眼睛亮點 B 臉紅 M 嘴巴 T 牙齒 R 舌頭
  const FACE = [
    '................',
    '....HHHHHHHH....',
    '..HHHhhhHHHHHH..',
    '.HHHhhHHHHhhHHH.',
    '.HHHHHHHHHHHHHH.',
    'HHHHHHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHH',
    'HHSHHSHHHSHHSSHH',
    'HSSSSSSSSSSSSSSH',
    'SSSEESSSSSSEESSS',
    'SSSEWSSSSSSEWSSs',
    'sSBSSSSSSSSSSBSs',
    '.SSSSSMMMMSSSSS.',
    '.sSSSSMTTMSSSSs.',
    '..sSSSMRRMSSSs..',
    '...sSSSSSSSSs...',
    '....ssssssss....',
  ];
  // 帽子、頭盔、兜帽都蓋在頭上，臉一定露出來（a 主色 b 亮色 c 暗色 t 稀有度飾邊 g 金色）
  const HAT = {
    light: [
      '..............t.',
      '....aaaaaaaa..t.',
      '..aabbbaaaaaaa..',
      '.aabbaaaaaaaaat.',
      '.aaaaaaaaaaaaat.',
      'cccccccccccccccc',
    ],
    heavy: [
      '.......tt.......',
      '....aaaaaaaa....',
      '..aabbbaaaaaaa..',
      '.aabbaaaaaaaaaa.',
      '.aaaaaaaaaaaaaa.',
      'aaaaaaaggaaaaaaa',
      'cccccccccccccccc',
      'cc............cc',
      'cc............cc',
      'cc............cc',
      'cc............cc',
      '.c............c.',
    ],
    cloth: [
      '...aaaaaaaaaa...',
      '..aaaaaaaaaaaa..',
      '.aabbbaaaaaaaaa.',
      'aabbaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaa',
      'tttttttttttttttt',
      'a..............a',
      'a..............a',
      'a..............a',
      'a..............a',
      'a..............a',
      'a..............a',
      'aa............aa',
      '.a............a.',
    ],
  };
  const PAL = { H: '#2c2432', h: '#5c5070', S: '#f0c8a0', s: '#d39f78', E: '#1a1216', W: '#ffffff', B: '#f2968a', M: '#6e1e28', T: '#faf6ea', R: '#d25a64' };
  // 格子第 c 欄、第 r 列 → 主角圖上的位置（臉的中心對齊脖子）
  const X0 = 3, Y0 = -6;
  function grid(x, rows, pal) {
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const col = pal[row[c]];
        if (!col) continue;
        x.fillStyle = col;
        x.fillRect(X0 + c, Y0 + r, 1, 1);
      }
    });
  }
  function head(x, o) {
    // 布料只有兩種顏色，沒有暗色就用主色代替
    const pal = o.col ? { a: o.col[0], b: o.col[1], c: o.col[2] || o.col[0], t: o.trim, g: '#ffe08a' } : null;
    // 兜帽：先在頭的兩側畫出往後披的布
    if (o.cls === 'cloth' && pal) {
      x.fillStyle = pal.a;
      x.fillRect(X0 - 1, Y0 + 2, 1, 12); x.fillRect(X0 + 16, Y0 + 2, 1, 12);
    }
    grid(x, FACE, PAL);
    if (pal && HAT[o.cls]) grid(x, HAT[o.cls], pal);
  }
  Spr.HERO.top = 7;
  Spr.HERO.head = head;
})(typeof window !== 'undefined' ? window : globalThis);
