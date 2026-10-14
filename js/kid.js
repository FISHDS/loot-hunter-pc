// 主角換成Q版大頭小男孩：短髮、額頭大、細眉、瞇瞇笑眼、張嘴笑露牙、招風耳、白底彩點上衣
// 電腦版與手機版共用：在電腦版修改，再用「同步核心.bat」複製到手機版。
(function (root) {
  const LH = root.LH;
  const Spr = LH.Spr;
  // 頭的格子圖：18 寬，第一列是第 -1 列（頭盔頂飾用），下巴在最後一列
  // H 頭髮 h 頭髮反光 S 皮膚 s 皮膚陰影 k 耳朵內側 b 眉毛 E 眼睛 W 眼睛亮點 N 鼻子 B 臉紅 M 嘴巴 T 牙齒 L 下唇
  const FACE = [
    '..................',
    '......HHHHHH......',
    '....HHHHHHHHHH....',
    '...HHHhHHHHhHHH...',
    '..HHHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
    '.HHHHSHHHHHSSHHHH.',
    '.HHSSSSSHSSSSSSHH.',
    '.HHSSSSSSSSSSSSHH.',
    '.HSSSSSSSSSSSSSSH.',
    '.HSSbbbSSSSbbbSSH.',
    'sHSSSSSSSSSSSSSSHs',
    'kSSSEWESSSSEWESSSk',
    'sSSSsssSSSSsssSSSs',
    '.SBBSSSSNNSSSSBBS.',
    '.SSSSSSSSSSSSSSSS.',
    '.SSSSMMMMMMMSSSSS.',
    '.sSSSMTTTTTMSSSSs.',
    '..SSSsMMMMMsSSSS..',
    '..sSSSSLLLSSSSSs..',
    '...sSSSSSSSSSSs...',
    '.....ssssssss.....',
  ];
  // 帽子、頭盔、兜帽都蓋在頭上，臉一定露出來（a 主色 b 亮色 c 暗色 t 稀有度飾邊 g 金色）
  const HAT = {
    light: [
      '...............t..',
      '......aaaaaa...t..',
      '....aaaaaaaaaa.t..',
      '...aabbbaaaaaaaa..',
      '..aabbaaaaaaaaaaa.',
      '..aaaaaaaaaaaaaaa.',
      'cccccccccccccccccc',
    ],
    heavy: [
      '........tt........',
      '......aaaaaa......',
      '....aaaaaaaaaa....',
      '...aabbbaaaaaaa...',
      '..aabbaaaaaaaaaa..',
      '..aaaaaaaaaaaaaa..',
      '.aaaaaaaggaaaaaaa.',
      '.cccccccccccccccc.',
      '.cc............cc.',
      '.cc............cc.',
      '.cc............cc.',
      'cc..............cc',
      'cc..............cc',
      'cc..............cc',
      '.c..............c.',
    ],
    cloth: [
      '....aaaaaaaaaa....',
      '...aaaaaaaaaaaa...',
      '..aabbbaaaaaaaaa..',
      '.aabbaaaaaaaaaaaa.',
      '.aaaaaaaaaaaaaaaa.',
      'aaaaaaaaaaaaaaaaaa',
      'tttttttttttttttttt',
      'a................a',
      'a................a',
      'a................a',
      'a................a',
      'a................a',
      'a................a',
      'a................a',
      'a................a',
      'a................a',
      'a................a',
      'aa..............aa',
      '.a..............a.',
    ],
  };
  const PAL = {
    H: '#2a2230', h: '#544a60', S: '#f4d4ba', s: '#deb498', k: '#c49278', b: '#68504a',
    E: '#1e161a', W: '#f0ece6', N: '#d6a288', B: '#f4baaa', M: '#601e24', T: '#faf6e8', L: '#d66c70',
  };
  // 格子第 c 欄、第 r 列 → 主角圖上的位置（臉的中心對齊脖子，下巴在第 10 列）
  const X0 = 2, Y0 = 10 - (FACE.length - 1);
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
      x.fillRect(X0 - 1, Y0 + 3, 1, 16); x.fillRect(X0 + 18, Y0 + 3, 1, 16);
    }
    grid(x, FACE, PAL);
    if (pal && HAT[o.cls]) grid(x, HAT[o.cls], pal);
  }
  Spr.HERO.top = 1 - Y0; // 頭頂留出空間（含頭盔頂飾）
  Spr.HERO.head = head;
  // 白底彩色小點的上衣（穿上身體裝備時會被蓋住）
  Spr.HERO.shirt = '#eeeae2';
  Spr.HERO.dots = [[7, 12, '#e05050'], [11, 12, '#e8c040'], [9, 14, '#4896dc'], [12, 15, '#e05050'], [7, 16, '#e8c040'], [4, 13, '#4896dc'], [15, 14, '#e05050'], [10, 16, '#4896dc']];
})(typeof window !== 'undefined' ? window : globalThis);
