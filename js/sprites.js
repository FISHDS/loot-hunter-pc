// 像素美術：手繪字串精靈 + 程序繪製（低解析度向量 → 二值化透明 → 自動描邊）。
(function (root) {
  const LH = root.LH;

  const PAL = {
    k: '#0d0b10', d: '#2a2433', g: '#4b4358', G: '#6f6680',
    m: '#8d95a1', M: '#d9e1ea', w: '#8a5a32', W: '#5a3a20', l: '#7a4e2c', L: '#4e311b',
    o: '#d9a441', O: '#ffe08a', r: '#c23a3a', R: '#ff6a5a', b: '#3a6ad0', B: '#7fb0ff',
    c: '#7fe7ff', C: '#2f9fd0', p: '#b46cff', P: '#6b2fb3', s: '#e8e2d0', y: '#d9a77a', Y: '#9c6c4c',
    e: '#ffe9a8', H: '#7a2433', h: '#3a1420', v: '#3b2f6b', V: '#5a4aa0', a: '#3d4250', A: '#626a7e',
    f: '#6b3a3a', n: '#9aa07a', N: '#6b6f52', E: '#ff5a3c', t: '#2b2030', u: '#4a3a52',
  };

  function build(rows, pal) {
    pal = Object.assign({}, PAL, pal || {});
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const ch = rows[j][i];
        if (!ch || ch === '.' || !pal[ch]) continue;
        x.fillStyle = pal[ch];
        x.fillRect(i, j, 1, 1);
      }
    return c;
  }

  // 低解析度向量繪圖 → 透明度二值化 → 加 1px 黑框
  function proc(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    draw(x, w, h);
    const img = x.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) d[i + 3] = d[i + 3] > 110 ? 255 : 0;
    const out = x.createImageData(w, h);
    const o = out.data;
    for (let y = 0; y < h; y++)
      for (let xx = 0; xx < w; xx++) {
        const i = (y * w + xx) * 4;
        if (d[i + 3]) { o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = 255; continue; }
        let edge = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = xx + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && d[(ny * w + nx) * 4 + 3]) edge = true;
        }
        if (edge) { o[i] = 13; o[i + 1] = 11; o[i + 2] = 16; o[i + 3] = 255; }
      }
    x.clearRect(0, 0, w, h);
    x.putImageData(out, 0, 0);
    return c;
  }

  function silhouette(src, color) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ---------- 角色與怪物（16×16） ----------
  const ART = {
    hero: [
      '......kkkk......',
      '.....kHHHHk.....',
      '....kHHHHHHk....',
      '...kHHhhhhHHk...',
      '...kHhhhhhhHk...',
      '...kHhehhehHk...',
      '...kHhhhhhhHk...',
      '....kHhhhhHk....',
      '...kuHHHHHHuk...',
      '..kutuwwwwutuk..',
      '..kutwwoowwtuk..',
      '..kyuuttttuuyk..',
      '...kkuuttuukk...',
      '....kuuk.kuuk...',
      '....kLLk.kLLk...',
      '....kkkk.kkkk...',
    ],
    pickman: [
      '................',
      '.......kkkk.....',
      '......kmmmmk....',
      '.....kmmOmmmk...',
      '....kkkkkkkkk...',
      '.....knNnnNk....',
      '.....knPnnnk.mk.',
      '......knnnk.kmmk',
      '.....klllllkwkk.',
      '....kllpllllwk..',
      '....knlllllk....',
      '....knklLlk.....',
      '.....klLklLk....',
      '.....kLk.kLk....',
      '.....kkk.kkk....',
      '................',
    ],
    beast: [
      '................',
      '......kk..kk....',
      '.....kpk.kpPk...',
      '....kkPkkkPkk...',
      '...kaaAAAAAaak..',
      '..kaAAaaaaaAAak.',
      '.kaAaacAAcaaAak.',
      '.kaaAAaaaaAAaakk',
      'kaaaaaaaaaaaEaak',
      'kfaaaaaaaaaaaafk',
      'kffaaaaaaaaaaffk',
      '.kffffkkkkfffk..',
      '.kfkfk....kfkfk.',
      '.kkkkk....kkkkk.',
      '................',
      '................',
    ],
    crossbow: [
      '................',
      '......kkkk......',
      '.....kLLLLk.....',
      '....kLLyyLLk....',
      '....kLyEyELk....',
      '.....kyyyyk.....',
      '....krrrrrrk....',
      '...kllllllkwwk..',
      '..kylllllkwmmmk.',
      '..kyklllllkwwk..',
      '...kklllllk.....',
      '....klLkLlk.....',
      '....klk.klk.....',
      '....kLk.kLk.....',
      '....kkk.kkk.....',
      '................',
    ],
    priest: [
      '.............kc.',
      '............kcck',
      '......kkkk..kCk.',
      '.....kVVVVk..wk.',
      '....kVvvvvVk.wk.',
      '....kVvcvcvk.wk.',
      '....kVvvvvVkkwk.',
      '.....kVVVVkVVwk.',
      '....kvVVVVVVkwk.',
      '...kvvVcVVVvkwk.',
      '...kvvVVVVVvk.k.',
      '...kvvvVVVvvk...',
      '..kvvvvvvvvvvk..',
      '..kvvvvvvvvvvk..',
      '..kkkkkkkkkkkk..',
      '................',
    ],
  };

  // 骨沼怪物（各自的調色盤）
  const ART_PAL = {
    crawler: { z: '#7d8f6a', Z: '#4f5e42', r: '#4a3a2e', e: '#ffe9a8' },
    bloater: { g: '#4c6a3a', G: '#6f8f4a', w: '#e8e2d0', r: '#7a1f2a', e: '#ffe85c' },
    bonearcher: { s: '#e0d8c0', S: '#a89f86', w: '#7a5a32', e: '#5cff8a' },
    witch: { q: '#2f5a5a', Q: '#4f8f8a', c: '#9ffff0' },
  };
  Object.assign(ART, {
    crawler: [
      '................',
      '................',
      '................',
      '.....kkkk.......',
      '....kzzzzk......',
      '...kzZezZek.....',
      '...kzzzzzzk.....',
      '....kZzzZkkkkk..',
      '...kzrrrrrrzzzk.',
      '..kzrrrrrrrrzZk.',
      '..kZkrrrrrrrkk..',
      '.kzk.krrrrk.kzk.',
      'kzk..kzzzk...kzk',
      'kk...kZkZk....kk',
      '.....kk.kk......',
      '................',
    ],
    bloater: [
      '................',
      '.....kkkkkk.....',
      '...kkgGGGGgkk...',
      '..kgGGGGGGGGgk..',
      '.kgGGeGGGGeGGgk.',
      '.kgGGGGGGGGGGgk.',
      'kgGGkkkkkkkkGGgk',
      'kgGkwkwkwkwkkGgk',
      'kgGkkrrrrrrkkGgk',
      'kgGGkkkkkkkkGGgk',
      '.kgGGGGGGGGGGgk.',
      '.kgGgGGgGGgGGgk.',
      '..kggGGGGGGggk..',
      '...kkgkkkkgkk...',
      '....kgk..kgk....',
      '....kkk..kkk....',
    ],
    bonearcher: [
      '................',
      '......kkkk......',
      '.....kssssk.....',
      '.....kekesk.....',
      '.....kssssk..kk.',
      '......kSSk..kwk.',
      '.....kkssk.kw.k.',
      '....kskssksk..k.',
      '....ks.SS.ksk.k.',
      '....ks.ss..kw.k.',
      '.....kssssk.kwk.',
      '.....ks..sk..kk.',
      '.....kS..Sk.....',
      '.....ks..sk.....',
      '....kkk..kkk....',
      '................',
    ],
    witch: [
      '................',
      '......kkkk......',
      '.....kqqqqk.....',
      '....kqQQQQqk....',
      '....kqQccQqk....',
      '....kqQQQQqk....',
      '.....kqQQqk.....',
      '....kqqQQqqk....',
      '...kqqqQQqqqk...',
      '..kqqqQQQQqqqk..',
      '..kqqQQQQQQqqk..',
      '...kqQqQQqQqk...',
      '....kQ.kk.Qk....',
      '.....k....k.....',
      '................',
      '................',
    ],
  });

  // ---------- 物品圖示（16×16） ----------
  const ICON = {
    knife: [
      '................', '................', '................', '..........kk....',
      '.........kMMk...', '........kMmk....', '.......kMmk.....', '...kk.kMmk......',
      '...kokkmk.......', '....kook........', '....kwok........', '...kwwkok.......',
      '..kwwk.kk.......', '..kWk...........', '...k............', '................'],
    dagger: [
      '................', '...........kk...', '..........kMMk..', '.........kMMk...',
      '........kMmk....', '.......kMmk.....', '......kMmk......', '..kk.kMmk.......',
      '..kokkmk........', '...kook.........', '...kwok.........', '..kwwkok........',
      '.kwwk.kk........', '.kWk............', '..k.............', '................'],
    sword: [
      '.............kk.', '............kMMk', '...........kMMk.', '..........kMmk..',
      '.........kMmk...', '........kMmk....', '.......kMmk.....', '......kMmk......',
      '..kk.kMmk.......', '..kokkmk........', '...kook.........', '...kwok.........',
      '..kwwkok........', '.kwwk.kk........', '.kok............', '..k.............'],
    hammer: [
      '................', '..kkkkkkkkkk....', '..kMMMMMMMMk....', '..kMmmmmmmmk....',
      '..kmmmmmmmmk....', '..kkkkwwkkkk....', '.....kwwk.......', '.....kwWk.......',
      '.....kwWk.......', '.....kwWk.......', '.....kook.......', '.....kwWk.......',
      '.....kwWk.......', '.....kWWk.......', '......kk........', '................'],
    bow: [
      '................', '......kkk.......', '.....kwWks......', '....kwk..s......',
      '...kwk...s......', '...kwk...s......', '..kwk....s......', '..kok....s......',
      '..kok....s......', '..kwk....s......', '...kwk...s......', '...kwk...s......',
      '....kwk..s......', '.....kwWks......', '......kkk.......', '................'],
    staff: [
      '..........kkk...', '.........kcBck..', '.........kccBk..', '..........kkwk..',
      '..........kwk...', '.........kwk....', '........kwk.....', '.......kwk......',
      '......kwk.......', '.....kwk........', '....kwk.........', '...kwk..........',
      '..kWk...........', '.kWk............', '.kk.............', '................'],
    helm: [
      '................', '................', '.....kkkkkk.....', '....kmMMMMmk....',
      '...kmMoOOoMmk...', '...kmmMooMmmk...', '..kmmmmmmmmmmk..', '..kmmmmmmmmmmk..',
      '..kmkkkkkkkkmk..', '..kmk......kmk..', '..kmk......kmk..', '..kkk......kkk..',
      '................', '................', '................', '................'],
    hood: [
      '................', '.....kkkkkk.....', '....kPPPPPPk....', '...kPPppppPPk...',
      '..kPPpPPPPpPPk..', '..kPpPkkkkPpPk..', '..kPpk.cc.kpPk..', '..kPpk....kpPk..',
      '..kPPpk..kpPPk..', '...kPPpkkpPPk...', '....kPPPPPPk....', '....kPk..kPk....',
      '.....k....k.....', '................', '................', '................'],
    mail: [
      '................', '..kkk......kkk..', '.kmMmk....kmMmk.', '.kmmmkkkkkkmmmk.',
      '.kmMmMmMmMmMmmk.', '.kmmmmmmmmmmmmk.', '..kmMmMmMmMmMk..', '..kmmmmmmmmmmk..',
      '..kmMmMmMmMmMk..', '..kkkkooookkkk..', '...kmmmmmmmmk...', '...kmMmMmMmMk...',
      '...kmmmmmmmmk...', '....kkkkkkkk....', '................', '................'],
    robe: [
      '................', '..kkk......kkk..', '.kPVPk....kPVPk.', '.kPPPkkkkkkPPPk.',
      '.kPVPoPPPPoPVPk.', '.kPPPoPPPPoPPPk.', '..kPPoPcPPoPPk..', '..kPPoPPPPoPPk..',
      '..kPPoPPPPoPPk..', '..kkkkooookkkk..', '...kPPPPPPPPk...', '...kPVPPPPVPk...',
      '...kPPPPPPPPk...', '....kkkkkkkk....', '................', '................'],
    leather: [
      '................', '..kkk......kkk..', '.klLlk....klLlk.', '.klllkkkkkkllllk',
      '.klLllllllllLlk.', '.klllLllllLlllk.', '..kllllllllllk..', '..klLllllllLlk..',
      '..kllllllllllk..', '..kkkkooookkkk..', '...kllllllllk...', '...klLllllLlk...',
      '...kllllllllk...', '....kkkkkkkk....', '................', '................'],
    gloves: [
      '................', '....kkkk........', '...kllLlk.......', '..kllkllkkk.....',
      '..klklklkllk....', '..klklklklLk....', '..kllllllllk....', '..kllllllllkkk..',
      '..klllllllkllk..', '...kllllllllk...', '...kooooooook...', '...kLLLLLLLLk...',
      '...kLLLLLLLLk...', '....kkkkkkkk....', '................', '................'],
    boots: [
      '................', '....kkkkkk......', '....kllllk......', '....kllLlk......',
      '....kllllk......', '....kooook......', '....kllllk......', '....kllllk......',
      '....kllllkkk....', '....klllllllkk..', '...klllllllllk..', '...kLLLLLLLLLk..',
      '...kkkkkkkkkkk..', '................', '................', '................'],
    ring: [
      '................', '................', '................', '......kkkk......',
      '.....kpPPpk.....', '......kppk......', '.....kokkok.....', '....kok..kok....',
      '....kok..kok....', '....kok..kok....', '.....kokkok.....', '......kkkk......',
      '................', '................', '................', '................'],
    amulet: [
      '..kk........kk..', '...ks......sk...', '....ks....sk....', '.....ks..sk.....',
      '......kook......', '.....kocOok.....', '....kocccOok....', '....kocccook....',
      '.....kocook.....', '......kook......', '.......kk.......', '................',
      '................', '................', '................', '................'],
    shield: [
      '................', '...kkkkkkkkkk...', '..kmMMMMMMMMmk..', '..kMwwwwwwwwMk..',
      '..kMwwwooowwMk..', '..kMwwoOOOowMk..', '..kMwwoOOOowMk..', '..kMwwwooowwMk..',
      '...kMwwwwwwMk...', '...kMwwwwwwMk...', '....kMwwwwMk....', '.....kMwwMk.....',
      '......kMMk......', '.......kk.......', '................', '................'],
    orb: [
      '................', '.....kkkkkk.....', '....kcBBBBck....', '...kcBccccBck...',
      '...kBcsccccBk...', '...kBccccccBk...', '...kBccccccBk...', '....kBccccBk....',
      '.....kkkkkk.....', '....kooooook....', '....kOoooooOk...', '.....kkkkkk.....',
      '................', '................', '................', '................'],
    quiver: [
      '..k.k.k.........', '.kMkMkMk........', '..kskskk........', '..kskskk........',
      '.kllllllk.......', '.klLllLlk.......', '.kllllllk.......', '.klLllLlk.......',
      '.kllllllk.......', '.koooooook......', '.kllllllk.......', '.kllllllk.......',
      '..kkkkkk........', '................', '................', '................'],
    potion_red: [
      '................', '......kkkk......', '......kwwk......', '.......kk.......',
      '......kGGk......', '.....kGrrGk.....', '....kGrrrrGk....', '....krRrrrrk....',
      '....krRrrrrk....', '....krrrrrrk....', '.....krrrrk.....', '......kkkk......',
      '................', '................', '................', '................'],
    potion_blue: [
      '................', '......kkkk......', '......kwwk......', '.......kk.......',
      '......kGGk......', '.....kGbbGk.....', '....kGbbbbGk....', '....kbBbbbbk....',
      '....kbBbbbbk....', '....kbbbbbbk....', '.....kbbbbk.....', '......kkkk......',
      '................', '................', '................', '................'],
  };

  // ---------- 頭目（32×32 程序繪製） ----------
  const BOSS_DRAW = {
    starPriest(x) {
      x.strokeStyle = '#9ab8ff'; x.lineWidth = 1; x.beginPath(); x.arc(16, 8, 7, 0, 7); x.stroke();
      x.fillStyle = '#26326a'; x.beginPath(); x.moveTo(6, 31); x.lineTo(10, 12); x.lineTo(22, 12); x.lineTo(26, 31); x.fill();
      x.fillStyle = '#34448a'; x.beginPath(); x.moveTo(11, 31); x.lineTo(14, 14); x.lineTo(18, 14); x.lineTo(21, 31); x.fill();
      x.fillStyle = '#e6c068'; x.beginPath(); x.moveTo(16, 15); x.lineTo(17, 19); x.lineTo(21, 20); x.lineTo(17, 21); x.lineTo(16, 25); x.lineTo(15, 21); x.lineTo(11, 20); x.lineTo(15, 19); x.fill();
      x.fillStyle = '#26326a'; x.fillRect(4, 14, 6, 3); x.fillRect(22, 14, 6, 3);
      x.fillStyle = '#1e2a5a'; x.beginPath(); x.arc(16, 9, 4.5, 0, 7); x.fill();
      x.fillStyle = '#0a0c1a'; x.fillRect(13, 8, 6, 4);
      x.fillStyle = '#bff0ff'; x.fillRect(14, 9, 1, 1); x.fillRect(17, 9, 1, 1);
      x.fillStyle = '#fff6d0'; for (const [a, b] of [[3, 4], [8, 1], [24, 2], [29, 6]]) x.fillRect(a, b, 1, 1);
      x.fillStyle = '#bff0ff'; x.beginPath(); x.arc(4, 12, 2, 0, 7); x.fill(); x.beginPath(); x.arc(28, 12, 2, 0, 7); x.fill();
    },
    meteorBeast(x) {
      x.fillStyle = '#2e3240'; x.fillRect(4, 22, 5, 8); x.fillRect(23, 22, 5, 8); x.fillRect(11, 24, 4, 6); x.fillRect(18, 24, 4, 6);
      x.fillStyle = '#4a4e60'; x.beginPath(); x.ellipse(16, 18, 13, 9, 0, 0, 7); x.fill();
      x.fillStyle = '#5a5e72'; x.beginPath(); x.ellipse(14, 15, 9, 5, 0, 0, 7); x.fill();
      x.strokeStyle = '#7fb4ff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(8, 18); x.lineTo(12, 21); x.lineTo(16, 19); x.lineTo(21, 22); x.moveTo(18, 13); x.lineTo(22, 16); x.stroke();
      x.fillStyle = '#bff0ff'; x.beginPath(); x.arc(16, 19, 2.5, 0, 7); x.fill();
      x.fillStyle = '#3d4250'; x.beginPath(); x.arc(27, 13, 5, 0, 7); x.fill();
      x.fillStyle = '#c9d1db'; x.beginPath(); x.moveTo(26, 9); x.lineTo(23, 2); x.lineTo(28, 8); x.fill(); x.beginPath(); x.moveTo(29, 9); x.lineTo(31, 3); x.lineTo(31, 10); x.fill();
      x.fillStyle = '#7fd8ff'; x.fillRect(28, 12, 2, 2);
    },
    fallenAngel(x) {
      x.fillStyle = '#1e1a3a'; x.beginPath(); x.moveTo(14, 12); x.lineTo(1, 4); x.lineTo(3, 14); x.lineTo(0, 20); x.lineTo(13, 18); x.fill();
      x.beginPath(); x.moveTo(18, 12); x.lineTo(31, 4); x.lineTo(29, 14); x.lineTo(32, 20); x.lineTo(19, 18); x.fill();
      x.fillStyle = '#3a3a7a'; x.beginPath(); x.moveTo(14, 13); x.lineTo(4, 8); x.lineTo(6, 15); x.lineTo(13, 16); x.fill(); x.beginPath(); x.moveTo(18, 13); x.lineTo(28, 8); x.lineTo(26, 15); x.lineTo(19, 16); x.fill();
      x.fillStyle = '#d8dcf0'; x.beginPath(); x.moveTo(12, 30); x.lineTo(13, 13); x.lineTo(19, 13); x.lineTo(20, 30); x.fill();
      x.fillStyle = '#a8b0d8'; x.fillRect(15, 14, 2, 16);
      x.fillStyle = '#e8e0d0'; x.beginPath(); x.arc(16, 9, 3.5, 0, 7); x.fill();
      x.fillStyle = '#5a8aff'; x.fillRect(14, 9, 1, 1); x.fillRect(17, 9, 1, 1);
      x.strokeStyle = '#e6c068'; x.lineWidth = 1; x.beginPath(); x.arc(16, 4, 4, 0.4, 2.6); x.stroke(); x.beginPath(); x.arc(16, 4, 4, 3.4, 5.4); x.stroke();
    },
    golem(x) {
      x.fillStyle = '#1b1625';
      x.beginPath(); x.moveTo(6, 30); x.lineTo(9, 12); x.lineTo(23, 12); x.lineTo(26, 30); x.fill();
      x.fillStyle = '#2b2238';
      x.beginPath(); x.moveTo(10, 14); x.lineTo(16, 10); x.lineTo(22, 14); x.lineTo(20, 26); x.lineTo(12, 26); x.fill();
      x.fillStyle = '#1b1625';
      x.fillRect(11, 4, 10, 9);
      x.fillStyle = '#6b2fb3';
      x.beginPath(); x.moveTo(5, 13); x.lineTo(2, 4); x.lineTo(9, 11); x.fill();
      x.beginPath(); x.moveTo(27, 13); x.lineTo(30, 3); x.lineTo(23, 11); x.fill();
      x.fillStyle = '#b46cff';
      x.beginPath(); x.moveTo(4, 12); x.lineTo(3, 6); x.lineTo(7, 11); x.fill();
      x.beginPath(); x.moveTo(28, 12); x.lineTo(29, 6); x.lineTo(25, 11); x.fill();
      x.fillStyle = '#2b2238';
      x.fillRect(3, 14, 5, 12); x.fillRect(24, 14, 5, 12);
      x.fillStyle = '#7fe7ff';
      x.fillRect(14, 16, 4, 4);
      x.fillStyle = '#e8fbff'; x.fillRect(15, 17, 2, 2);
      x.fillStyle = '#ff5a3c'; x.fillRect(13, 7, 2, 2); x.fillRect(17, 7, 2, 2);
      x.fillStyle = '#4b3a62'; x.fillRect(9, 26, 5, 5); x.fillRect(18, 26, 5, 5);
    },
    overseer(x) {
      x.fillStyle = '#5b3a22';
      x.fillRect(9, 13, 14, 13);
      x.fillStyle = '#b07a5a';
      x.fillRect(4, 13, 5, 11); x.fillRect(23, 13, 5, 11);
      x.fillStyle = '#7a4f39'; x.fillRect(4, 20, 5, 4); x.fillRect(23, 20, 5, 4);
      x.fillStyle = '#7d838c';
      x.beginPath(); x.arc(16, 9, 7, Math.PI, 0); x.fill();
      x.fillRect(9, 9, 14, 5);
      x.fillStyle = '#c3c9d1'; x.fillRect(11, 4, 4, 2);
      x.fillStyle = '#ff3b3b'; x.fillRect(12, 10, 3, 1); x.fillRect(17, 10, 3, 1);
      x.fillStyle = '#7d838c'; x.fillRect(3, 11, 7, 4); x.fillRect(22, 11, 7, 4);
      x.fillStyle = '#d4a03c'; x.fillRect(9, 20, 14, 2);
      x.fillStyle = '#3a2414'; x.fillRect(10, 26, 5, 5); x.fillRect(17, 26, 5, 5);
      x.strokeStyle = '#9aa0a8'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(28, 22); x.quadraticCurveTo(31, 27, 26, 30); x.stroke();
    },
    parasite(x) {
      x.strokeStyle = '#6b2fb3'; x.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        x.beginPath(); x.moveTo(16, 18);
        x.quadraticCurveTo(16 + Math.cos(a + 0.6) * 10, 18 + Math.sin(a + 0.6) * 9, 16 + Math.cos(a) * 14, 18 + Math.sin(a) * 12);
        x.stroke();
      }
      x.fillStyle = '#3b2156';
      x.beginPath(); x.ellipse(16, 18, 10, 8, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#b46cff';
      const sh = [[10, 12, 8, 2], [16, 10, 16, 1], [22, 12, 25, 3], [13, 13, 11, 5]];
      for (const [a, b, c, d] of sh) { x.beginPath(); x.moveTo(a - 2, b + 3); x.lineTo(c, d); x.lineTo(a + 2, b + 3); x.fill(); }
      x.fillStyle = '#e9d3ff';
      x.beginPath(); x.ellipse(16, 18, 5, 4, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ff3b6b';
      x.beginPath(); x.ellipse(16, 18, 2.2, 3.2, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#7fe7ff'; x.fillRect(9, 21, 2, 2); x.fillRect(22, 20, 2, 2);
    },
    mother(x) {
      x.fillStyle = '#4a2a2e';
      for (let i = 0; i < 4; i++) { x.fillRect(5 + i * 6, 23, 2, 7); }
      x.fillStyle = '#6b3a3a';
      x.beginPath(); x.ellipse(16, 18, 14, 9, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#8a4e4a';
      x.beginPath(); x.ellipse(15, 16, 10, 5, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#b46cff';
      for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(6 + i * 5, 12); x.lineTo(8 + i * 5, 3 + (i % 2) * 3); x.lineTo(10 + i * 5, 12); x.fill(); }
      x.fillStyle = '#1a0d10';
      x.beginPath(); x.ellipse(26, 20, 5, 4, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#e8e2d0';
      for (let i = 0; i < 4; i++) x.fillRect(23 + i * 2, 17 + (i % 2), 1, 2);
      x.fillStyle = '#ffe85c'; x.fillRect(21, 14, 2, 2); x.fillRect(25, 13, 2, 2);
    },
  };

  Object.assign(BOSS_DRAW, {
    boneLord(x) {
      x.fillStyle = '#d8cfb4';
      for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(5 + i * 2, 13); x.lineTo(2 + i * 2, 2 + i); x.lineTo(7 + i * 2, 12); x.fill(); }
      for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(27 - i * 2, 13); x.lineTo(30 - i * 2, 2 + i); x.lineTo(25 - i * 2, 12); x.fill(); }
      x.fillStyle = '#3a4a3a'; x.fillRect(9, 13, 14, 15);
      x.fillStyle = '#e8e0c8';
      for (let i = 0; i < 4; i++) x.fillRect(10, 15 + i * 3, 12, 1);
      x.fillRect(15, 14, 2, 13);
      x.beginPath(); x.ellipse(16, 8, 6, 6, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#d9a441'; x.fillRect(10, 1, 12, 3); x.fillRect(10, 0, 2, 2); x.fillRect(15, 0, 2, 2); x.fillRect(20, 0, 2, 2);
      x.fillStyle = '#1a1418'; x.fillRect(12, 7, 3, 3); x.fillRect(17, 7, 3, 3); x.fillRect(14, 11, 4, 1);
      x.fillStyle = '#5cff8a'; x.fillRect(13, 8, 1, 1); x.fillRect(18, 8, 1, 1);
      x.fillStyle = '#4a5a3a'; x.fillRect(10, 27, 4, 5); x.fillRect(18, 27, 4, 5);
    },
    toad(x) {
      x.fillStyle = '#2f4a26';
      x.beginPath(); x.ellipse(16, 20, 15, 10, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#9aa860';
      x.beginPath(); x.ellipse(16, 24, 9, 5, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#3f6230';
      x.beginPath(); x.arc(9, 11, 5, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.arc(23, 11, 5, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ffe85c'; x.fillRect(7, 9, 4, 4); x.fillRect(21, 9, 4, 4);
      x.fillStyle = '#1a1418'; x.fillRect(8, 10, 2, 3); x.fillRect(22, 10, 2, 3);
      x.fillStyle = '#5a7a3a';
      for (const [a, b] of [[6, 18], [11, 15], [21, 16], [26, 19], [14, 19], [19, 13]]) x.fillRect(a, b, 2, 2);
      x.fillStyle = '#7a1f2a'; x.fillRect(8, 21, 16, 1);
      x.fillStyle = '#2f4a26'; x.fillRect(2, 26, 6, 4); x.fillRect(24, 26, 6, 4);
    },
    banshee(x) {
      x.fillStyle = '#2a4a4a';
      x.beginPath(); x.moveTo(6, 12); x.quadraticCurveTo(16, 2, 26, 12); x.lineTo(28, 30); x.lineTo(22, 25); x.lineTo(16, 31); x.lineTo(10, 25); x.lineTo(4, 30); x.fill();
      x.fillStyle = '#7fbfb8';
      x.beginPath(); x.moveTo(9, 14); x.quadraticCurveTo(16, 8, 23, 14); x.lineTo(23, 26); x.lineTo(16, 29); x.lineTo(9, 26); x.fill();
      x.fillStyle = '#1a2a2e';
      x.beginPath(); x.moveTo(7, 8); x.quadraticCurveTo(16, -2, 25, 8); x.lineTo(26, 22); x.lineTo(22, 12); x.lineTo(10, 12); x.lineTo(6, 22); x.fill();
      x.fillStyle = '#e8f4f0'; x.beginPath(); x.ellipse(16, 13, 5, 6, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#9ffff0'; x.fillRect(13, 11, 2, 3); x.fillRect(17, 11, 2, 3);
      x.fillStyle = '#1a1418'; x.beginPath(); x.ellipse(16, 17, 2, 2.5, 0, 0, Math.PI * 2); x.fill();
    },
    corpseGolem(x) {
      x.fillStyle = '#4a4238';
      x.beginPath(); x.ellipse(16, 20, 14, 11, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#6a5e4c';
      for (const [a, b, r] of [[10, 14, 6], [21, 13, 6], [16, 21, 7], [8, 23, 5], [24, 23, 5]]) { x.beginPath(); x.arc(a, b, r, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#8a7a62';
      for (const [a, b] of [[9, 12], [20, 11], [15, 19]]) { x.beginPath(); x.arc(a, b, 2.5, 0, Math.PI * 2); x.fill(); }
      x.strokeStyle = '#8a7a62'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(4, 14); x.lineTo(0, 8); x.moveTo(28, 14); x.lineTo(31, 6); x.moveTo(12, 6); x.lineTo(10, 0); x.stroke();
      x.fillStyle = '#5cdc3a';
      for (const [a, b] of [[12, 27], [19, 28], [25, 17], [6, 18]]) x.fillRect(a, b, 3, 2);
      x.fillStyle = '#ff5a3c'; x.fillRect(13, 16, 2, 2); x.fillRect(18, 16, 2, 2);
    },
  });

  // ---------- 地圖磚 ----------
  function noise(i, j, s) {
    const n = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }
  const THEME = {
    mine: { floor: ['#2a2430', '#28222d', '#2c2533', '#262029'], hi: '#352d3d', lo: '#1d1822', crack: '#1e1924', wall: '#141018', w1: '#1f1925', w2: '#2a2233', wd: '#0c0910',
      face: '#3a3142', faceTop: '#4a3f55', faceLine: '#2c2533', faceLow: '#231d29', faceDot: '#56495f' },
    bog: { floor: ['#1f2a22', '#1d271f', '#222d24', '#1b241d'], hi: '#2a3a2c', lo: '#141c16', crack: '#161f18', wall: '#0e1410', w1: '#17201a', w2: '#1f2b22', wd: '#080c09',
      face: '#2c3a2e', faceTop: '#3d5236', faceLine: '#223024', faceLow: '#1a241b', faceDot: '#5a7a3a' },
    forge: { floor: ['#2a2320', '#28211e', '#2c2522', '#251f1c'], hi: '#3a2e28', lo: '#1c1614', crack: '#1e1714', wall: '#120d0c', w1: '#1f1613', w2: '#2c201b', wd: '#0a0606',
      face: '#3c2c26', faceTop: '#5a4034', faceLine: '#2a1d18', faceLow: '#22171a', faceDot: '#ff7a2e' },
    observatory: { floor: ['#23263a', '#212437', '#25293e', '#1f2234'], hi: '#30354f', lo: '#181a28', crack: '#1a1c2c', wall: '#0e0f1a', w1: '#181a2a', w2: '#23263c', wd: '#08080f',
      face: '#2e3350', faceTop: '#41486e', faceLine: '#20233a', faceLow: '#191b2c', faceDot: '#9ab8ff' },
  };
  function floorTile(v, th) {
    const P = THEME[th || 'mine'];
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const x = c.getContext('2d');
    const base = P.floor[v];
    x.fillStyle = base;
    x.fillRect(0, 0, 16, 16);
    for (let j = 0; j < 16; j++)
      for (let i = 0; i < 16; i++) {
        const n = noise(i, j, v);
        if (n > 0.9) { x.fillStyle = P.hi; x.fillRect(i, j, 1, 1); }
        else if (n < 0.07) { x.fillStyle = P.lo; x.fillRect(i, j, 1, 1); }
      }
    // 石板縫
    x.fillStyle = P.crack;
    if (v % 2 === 0) { x.fillRect(0, 7, 9, 1); x.fillRect(8, 0, 1, 7); x.fillRect(4, 8, 1, 8); }
    else { x.fillRect(5, 0, 1, 10); x.fillRect(5, 10, 11, 1); x.fillRect(12, 10, 1, 6); }
    return c;
  }
  function wallTile(v, th) {
    const P = THEME[th || 'mine'];
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = P.wall;
    x.fillRect(0, 0, 16, 16);
    for (let j = 0; j < 16; j++)
      for (let i = 0; i < 16; i++) {
        const n = noise(i + 31, j + 17, v);
        if (n > 0.82) { x.fillStyle = P.w1; x.fillRect(i, j, 1, 1); }
        if (n < 0.04) { x.fillStyle = P.w2; x.fillRect(i, j, 1, 1); }
      }
    // 岩塊：左上亮、右下暗，讓岩頂有起伏
    for (let k = 0; k < 3; k++) {
      const sx = 2 + Math.floor(noise(k, v, 21) * 12), sy = 2 + Math.floor(noise(k, v, 22) * 12), r = 2 + Math.floor(noise(k, v, 23) * 3);
      for (let j = -r; j <= r; j++)
        for (let i = -r; i <= r; i++) {
          if (i * i + j * j > r * r + 1) continue;
          const px = sx + i, py = sy + j;
          if (px < 0 || py < 0 || px > 15 || py > 15) continue;
          x.fillStyle = i + j < -r * 0.7 ? P.w2 : i + j > r * 0.7 ? P.wd : P.w1;
          x.fillRect(px, py, 1, 1);
        }
    }
    return c;
  }
  function tint(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  // 牆面朝下的立面（只在下方為地面時畫）
  function wallFace(v, th) {
    const P = THEME[th || 'mine'];
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = P.faceLine;
    x.fillRect(0, 0, 16, 16);
    // 一層層疊起的岩塊：上緣受光、下緣與右側是縫隙陰影
    let y = 3, row = 0;
    while (y < 16) {
      const hgt = 4 + (noise(row, v, 31) > 0.5 ? 1 : 0);
      let xx = -Math.floor(noise(row, v, 32) * 5);
      let k = 0;
      while (xx < 16) {
        const w = 4 + Math.floor(noise(k + 20, row + v * 7, 33) * 5);
        const f = 0.88 + noise(k, row + v * 5, 34) * 0.24 - row * 0.07;
        x.fillStyle = tint(P.face, f);
        x.fillRect(xx, y, w - 1, hgt - 1);
        x.fillStyle = tint(P.face, f + 0.22);
        x.fillRect(xx, y, w - 1, 1);
        x.fillStyle = tint(P.face, f - 0.18);
        x.fillRect(xx, y + hgt - 2, w - 1, 1);
        xx += w; k++;
      }
      y += hgt; row++;
    }
    // 上緣的岩唇
    x.fillStyle = P.faceTop;
    x.fillRect(0, 0, 16, 3);
    for (let i = 0; i < 16; i++) if (noise(i, v, 3) > 0.6) { x.fillStyle = P.faceDot; x.fillRect(i, 1 + Math.floor(noise(i, v, 5) * 2), 1, 1); }
    x.fillStyle = P.faceLine;
    for (let i = 0; i < 16; i++) if (noise(i, v, 6) > 0.5) x.fillRect(i, 3, 1, 1);
    // 越往下越暗
    x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, 11, 16, 5);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 14, 16, 2);
    if (th === 'bog') for (let i = 0; i < 16; i++) if (noise(i, v, 9) > 0.55) { x.fillStyle = '#4a6a3a'; x.fillRect(i, 3, 1, 1 + Math.floor(noise(i, v, 4) * 5)); }
    return c;
  }
  // 屍水沼澤：半透明的混濁水面
  function swampTile(v) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(40,74,40,0.85)';
    x.fillRect(0, 0, 16, 16);
    for (let j = 0; j < 16; j++)
      for (let i = 0; i < 16; i++) {
        const n = noise(i + 7, j + 3, v + 11);
        if (n > 0.88) { x.fillStyle = 'rgba(110,150,80,0.6)'; x.fillRect(i, j, 1, 1); }
        else if (n < 0.08) { x.fillStyle = 'rgba(15,30,18,0.7)'; x.fillRect(i, j, 1, 1); }
      }
    x.fillStyle = 'rgba(150,190,110,0.35)';
    x.fillRect(2 + v * 3, 4 + v, 5, 1);
    x.fillRect(8 - v, 11 - v, 4, 1);
    return c;
  }
  // 磷火：骨沼的光源
  function wisp(v) {
    const cols = [['#7dff8a', '#2f9a46', '#eaffea'], ['#7fe7e0', '#2f8a8a', '#e6fffd'], ['#d8ff7a', '#7a9a2f', '#fbffe6']][v];
    return proc(16, 16, (x) => {
      x.fillStyle = '#d8cfb4';
      x.beginPath(); x.ellipse(8, 13, 4, 2.5, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1a1418'; x.fillRect(6, 12, 1, 1); x.fillRect(9, 12, 1, 1);
      x.fillStyle = cols[1];
      x.beginPath(); x.moveTo(5, 11); x.quadraticCurveTo(6, 3, 8, 1); x.quadraticCurveTo(10, 4, 11, 11); x.fill();
      x.fillStyle = cols[0];
      x.beginPath(); x.moveTo(6.5, 11); x.quadraticCurveTo(7, 6, 8, 4); x.quadraticCurveTo(9.5, 7, 9.5, 11); x.fill();
      x.fillStyle = cols[2]; x.fillRect(8, 8, 1, 2);
    });
  }
  function crystal(v) {
    const cols = [['#7fe7ff', '#2f9fd0', '#e6fdff'], ['#b46cff', '#6b2fb3', '#f0dcff'], ['#5cffb0', '#1f9a66', '#e0fff1']][v];
    return proc(16, 16, (x) => {
      const shard = (bx, h, w, lean) => {
        x.fillStyle = cols[1];
        x.beginPath(); x.moveTo(bx - w, 15); x.lineTo(bx + lean, 15 - h); x.lineTo(bx + w, 15); x.fill();
        x.fillStyle = cols[0];
        x.beginPath(); x.moveTo(bx - w + 1, 15); x.lineTo(bx + lean, 15 - h); x.lineTo(bx, 15); x.fill();
      };
      shard(6, 11, 3, -1); shard(10, 13, 3, 1); shard(3, 6, 2, -1); shard(13, 7, 2, 1);
      x.fillStyle = cols[2]; x.fillRect(9, 5, 1, 2);
    });
  }
  function rubble(v) {
    return proc(16, 16, (x) => {
      x.fillStyle = '#4b4358';
      x.beginPath(); x.ellipse(5 + v, 11, 3, 2, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#6f6680';
      x.beginPath(); x.ellipse(10, 12 - v, 2.5, 2, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#3a3142'; x.fillRect(12, 8 + v, 2, 2);
    });
  }
  function bones() {
    return proc(16, 16, (x) => {
      x.strokeStyle = '#cfc6b0'; x.lineWidth = 1.3;
      x.beginPath(); x.moveTo(3, 12); x.lineTo(11, 8); x.moveTo(5, 8); x.lineTo(10, 13); x.stroke();
      x.fillStyle = '#e8e2d0'; x.beginPath(); x.arc(12, 11, 2.2, 0, 7); x.fill();
      x.fillStyle = '#1a1418'; x.fillRect(11, 10, 1, 1); x.fillRect(13, 10, 1, 1);
    });
  }
  function campfire(frame) {
    return proc(16, 16, (x) => {
      x.fillStyle = '#5a3a20'; x.fillRect(3, 12, 10, 2); x.fillRect(5, 11, 6, 1);
      const f = frame % 3;
      x.fillStyle = '#ff6a2a';
      x.beginPath(); x.moveTo(4, 12); x.quadraticCurveTo(5 + f, 3, 8, 2 + f); x.quadraticCurveTo(11 - f, 5, 12, 12); x.fill();
      x.fillStyle = '#ffd36b';
      x.beginPath(); x.moveTo(6, 12); x.quadraticCurveTo(7, 7 + f, 8, 6); x.quadraticCurveTo(10, 8, 10, 12); x.fill();
    });
  }

  // ---------- 地圖小物件（礦坑／骨沼／營地） ----------
  const PROP = {
    telescope(x) {
      x.strokeStyle = '#6a4426'; x.lineWidth = 1; x.beginPath(); x.moveTo(8, 9); x.lineTo(4, 15); x.moveTo(8, 9); x.lineTo(12, 15); x.moveTo(8, 9); x.lineTo(8, 15); x.stroke();
      x.save(); x.translate(8, 8); x.rotate(-0.6);
      x.fillStyle = '#c9a040'; x.fillRect(-6, -1.5, 12, 3); x.fillStyle = '#e6c068'; x.fillRect(-6, -1.5, 12, 1); x.fillStyle = '#9ab8ff'; x.fillRect(5, -1.5, 1, 3);
      x.restore();
    },
    orrery(x) {
      x.fillStyle = '#4b4358'; x.fillRect(6, 13, 4, 3); x.fillRect(7, 8, 2, 5);
      x.strokeStyle = '#c9a040'; x.lineWidth = 1; x.beginPath(); x.ellipse(8, 7, 6, 2.5, 0, 0, 7); x.stroke(); x.beginPath(); x.ellipse(8, 7, 3.5, 5, 0.3, 0, 7); x.stroke();
      x.fillStyle = '#ffd36b'; x.beginPath(); x.arc(8, 7, 1.6, 0, 7); x.fill();
      x.fillStyle = '#7fb4ff'; x.fillRect(13, 6, 2, 2); x.fillStyle = '#ff9a6a'; x.fillRect(4, 9, 2, 2);
    },
    crystalBall(x) {
      x.fillStyle = '#4b4358'; x.beginPath(); x.moveTo(4, 15); x.lineTo(12, 15); x.lineTo(10, 11); x.lineTo(6, 11); x.fill();
      x.fillStyle = '#5a8aff'; x.beginPath(); x.arc(8, 7, 4.5, 0, 7); x.fill();
      x.fillStyle = '#bff0ff'; x.beginPath(); x.arc(7, 6, 2.5, 0, 7); x.fill();
      x.fillStyle = '#ffffff'; x.fillRect(6, 4, 1, 1);
    },
    starchart(x) {
      x.fillStyle = '#1a2246'; x.fillRect(2, 1, 12, 11);
      x.fillStyle = '#c9a040'; x.fillRect(2, 1, 12, 1); x.fillRect(2, 11, 12, 1);
      x.strokeStyle = 'rgba(160,190,255,0.8)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(4, 9); x.lineTo(7, 4); x.lineTo(10, 7); x.lineTo(12, 3); x.stroke();
      x.fillStyle = '#fff6d0'; for (const [a, b] of [[4, 9], [7, 4], [10, 7], [12, 3], [5, 3]]) x.fillRect(a - 0.5, b - 0.5, 1.5, 1.5);
    },
    pillar(x) {
      x.fillStyle = '#4a4e66'; x.fillRect(4, 13, 8, 3); x.fillStyle = '#6a6e86'; x.fillRect(5, 4, 6, 9);
      x.fillStyle = '#8a8ea6'; x.fillRect(5, 4, 1, 9); x.fillStyle = '#3a3e56'; x.fillRect(10, 4, 1, 9);
      x.fillStyle = '#6a6e86'; x.beginPath(); x.moveTo(5, 4); x.lineTo(7, 2); x.lineTo(9, 4); x.lineTo(11, 3); x.lineTo(11, 4); x.fill();
    },
    lantern(x) {
      x.fillStyle = '#3a3142'; x.fillRect(7, 0, 2, 3);
      x.fillStyle = '#2a2433'; x.fillRect(5, 3, 6, 2); x.fillRect(5, 11, 6, 2); x.fillRect(7, 13, 2, 1);
      x.fillStyle = '#ffcf6a'; x.fillRect(5, 5, 6, 6);
      x.fillStyle = '#fff3c0'; x.fillRect(7, 6, 2, 4);
      x.fillStyle = '#2a2433'; x.fillRect(5, 5, 1, 6); x.fillRect(10, 5, 1, 6);
    },
    support(x) {
      x.fillStyle = '#6a4426'; x.fillRect(1, 2, 3, 14); x.fillRect(12, 2, 3, 14);
      x.fillStyle = '#8a5a32'; x.fillRect(0, 0, 16, 4);
      x.fillStyle = '#a8743e'; x.fillRect(0, 0, 16, 1); x.fillRect(1, 4, 1, 12); x.fillRect(12, 4, 1, 12);
      x.fillStyle = '#4e311b'; x.fillRect(4, 4, 2, 1); x.fillRect(10, 4, 2, 1); x.fillRect(2, 9, 1, 1); x.fillRect(13, 12, 1, 1);
    },
    cart(x) {
      x.fillStyle = '#2a2433'; x.beginPath(); x.arc(4.5, 13, 2.3, 0, 7); x.arc(11.5, 13, 2.3, 0, 7); x.fill();
      x.fillStyle = '#626a7e'; x.beginPath(); x.moveTo(1, 6); x.lineTo(15, 6); x.lineTo(13.5, 12); x.lineTo(2.5, 12); x.fill();
      x.fillStyle = '#8d95a1'; x.fillRect(1, 6, 14, 1); x.fillStyle = '#3d4250'; x.fillRect(3, 9, 10, 1);
      x.fillStyle = '#3b2f6b'; x.beginPath(); x.moveTo(3, 6); x.lineTo(6, 2); x.lineTo(9, 4); x.lineTo(11, 1); x.lineTo(13, 6); x.fill();
      x.fillStyle = '#b46cff'; x.fillRect(6, 3, 1, 2); x.fillRect(11, 2, 1, 2);
      x.fillStyle = '#7fe7ff'; x.fillRect(9, 4, 1, 1);
      x.fillStyle = '#8d95a1'; x.fillRect(4, 13, 1, 1); x.fillRect(11, 13, 1, 1);
    },
    crate(x) {
      x.fillStyle = '#7a4e2c'; x.fillRect(2, 4, 12, 11);
      x.fillStyle = '#9a6838'; x.fillRect(2, 4, 12, 2);
      x.fillStyle = '#4e311b'; x.fillRect(2, 9, 12, 1); x.fillRect(2, 4, 1, 11); x.fillRect(13, 4, 1, 11);
      x.strokeStyle = '#5a3a20'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(3, 14); x.lineTo(13, 6); x.stroke();
    },
    barrel(x) {
      x.fillStyle = '#7a4e2c'; x.beginPath(); x.ellipse(8, 9.5, 5, 6, 0, 0, 7); x.fill();
      x.fillStyle = '#9a6838'; x.fillRect(5, 5, 2, 9);
      x.fillStyle = '#4b4358'; x.fillRect(3, 6, 10, 1); x.fillRect(3, 12, 10, 1);
      x.fillStyle = '#5a3a20'; x.beginPath(); x.ellipse(8, 4.5, 4, 1.6, 0, 0, 7); x.fill();
    },
    pick(x) {
      x.strokeStyle = '#8a5a32'; x.lineWidth = 1.8; x.beginPath(); x.moveTo(4, 15); x.lineTo(10.5, 3); x.stroke();
      x.strokeStyle = '#8d95a1'; x.lineWidth = 2; x.beginPath(); x.moveTo(4, 3); x.quadraticCurveTo(10, 0, 15, 5); x.stroke();
      x.fillStyle = '#d9e1ea'; x.fillRect(7, 1, 2, 1);
    },
    ore(x) {
      x.fillStyle = '#2a2433'; x.beginPath(); x.moveTo(1, 15); x.lineTo(4, 9); x.lineTo(7, 11); x.lineTo(10, 7); x.lineTo(15, 15); x.fill();
      x.fillStyle = '#3b2f6b'; x.beginPath(); x.moveTo(5, 15); x.lineTo(8, 10); x.lineTo(11, 15); x.fill();
      x.fillStyle = '#b46cff'; x.fillRect(9, 9, 1, 2); x.fillRect(4, 11, 1, 1);
      x.fillStyle = '#e6d0ff'; x.fillRect(8, 11, 1, 1);
    },
    grave0(x) {
      x.fillStyle = '#5a5e66'; x.beginPath(); x.moveTo(4, 15); x.lineTo(4, 7); x.arc(8, 7, 4, Math.PI, 0); x.lineTo(12, 15); x.fill();
      x.fillStyle = '#7a7f88'; x.fillRect(5, 6, 1, 8);
      x.fillStyle = '#3d4250'; x.fillRect(6, 8, 4, 1); x.fillRect(7, 6, 2, 5);
      x.fillStyle = '#4a6a3a'; x.fillRect(4, 13, 3, 2); x.fillRect(10, 12, 2, 3);
    },
    grave1(x) {
      x.save(); x.translate(8, 9); x.rotate(0.18);
      x.fillStyle = '#6a4426'; x.fillRect(-1, -8, 3, 15); x.fillRect(-5, -5, 11, 3);
      x.fillStyle = '#8a5a32'; x.fillRect(-1, -8, 1, 15);
      x.restore();
      x.fillStyle = '#3a3020'; x.beginPath(); x.ellipse(8, 15, 5, 1.5, 0, 0, 7); x.fill();
    },
    grave2(x) {
      x.fillStyle = '#4f535b'; x.beginPath(); x.moveTo(3, 15); x.lineTo(3, 7); x.lineTo(7, 5); x.lineTo(9, 8); x.lineTo(13, 6); x.lineTo(13, 15); x.fill();
      x.fillStyle = '#6a6f78'; x.fillRect(4, 8, 1, 6);
      x.fillStyle = '#33363d'; x.fillRect(6, 10, 5, 1); x.fillRect(6, 12, 4, 1);
      x.fillStyle = '#4a6a3a'; x.fillRect(3, 14, 4, 1); x.fillRect(11, 13, 2, 2);
    },
    coffin(x) {
      x.fillStyle = '#5a3a20'; x.beginPath(); x.moveTo(5, 1); x.lineTo(11, 1); x.lineTo(13, 5); x.lineTo(11, 15); x.lineTo(5, 15); x.lineTo(3, 5); x.fill();
      x.fillStyle = '#1a1018'; x.beginPath(); x.moveTo(6, 3); x.lineTo(10, 3); x.lineTo(11.5, 5.5); x.lineTo(10, 13); x.lineTo(6, 13); x.lineTo(4.5, 5.5); x.fill();
      x.fillStyle = '#e8e2d0'; x.beginPath(); x.arc(8, 6, 1.9, 0, 7); x.fill();
      x.fillStyle = '#1a1018'; x.fillRect(7, 6, 1, 1); x.fillRect(9, 6, 1, 1);
      x.fillStyle = '#cfc6b0'; x.fillRect(8, 8, 1, 4); x.fillRect(6, 9, 4, 1);
    },
    roots(x) {
      x.strokeStyle = '#4a3a26'; x.lineWidth = 1.5; x.beginPath();
      x.moveTo(4, 2); x.quadraticCurveTo(2, 7, 4, 12); x.lineTo(3, 14);
      x.moveTo(8, 2); x.quadraticCurveTo(11, 7, 9, 15);
      x.moveTo(12, 2); x.quadraticCurveTo(14, 5, 12, 9); x.stroke();
      x.fillStyle = '#4a6a3a';
      x.beginPath(); x.ellipse(8, 2, 6, 2, 0, 0, 7); x.fill();
      x.fillStyle = '#6a8a4a'; x.fillRect(5, 1, 3, 1); x.fillRect(10, 4, 1, 3); x.fillRect(4, 8, 1, 2);
    },
    bonepile(x) {
      x.strokeStyle = '#cfc6b0'; x.lineWidth = 1.5; x.beginPath();
      x.moveTo(1, 14); x.lineTo(9, 11); x.moveTo(6, 15); x.lineTo(14, 12); x.moveTo(3, 10); x.lineTo(8, 15); x.stroke();
      x.fillStyle = '#e8e2d0'; x.beginPath(); x.arc(5, 10, 2.6, 0, 7); x.arc(11, 9, 2.4, 0, 7); x.fill();
      x.fillStyle = '#1a1418'; x.fillRect(4, 10, 1, 1); x.fillRect(6, 10, 1, 1); x.fillRect(10, 9, 1, 1); x.fillRect(12, 9, 1, 1);
    },
    mushroom(x) {
      x.fillStyle = '#d8cfb4'; x.fillRect(4, 10, 2, 5); x.fillRect(10, 8, 2, 7); x.fillRect(7, 12, 1, 3);
      x.fillStyle = '#2fb0a0';
      x.beginPath(); x.ellipse(5, 10.5, 3.5, 2.4, 0, Math.PI, 0); x.fill();
      x.beginPath(); x.ellipse(11, 8.5, 4, 2.8, 0, Math.PI, 0); x.fill();
      x.beginPath(); x.ellipse(7.5, 12.5, 2.2, 1.6, 0, Math.PI, 0); x.fill();
      x.fillStyle = '#9affef'; x.fillRect(10, 6, 2, 1); x.fillRect(4, 8, 1, 1);
    },
    reeds(x) {
      x.strokeStyle = '#3e5a2a'; x.lineWidth = 1.4; x.beginPath();
      for (const [bx, h, l] of [[4, 9, -1], [6, 12, 0], [8, 8, 1], [10, 11, 1], [12, 7, 2]]) { x.moveTo(bx, 15); x.quadraticCurveTo(bx, 15 - h / 2, bx + l, 15 - h); }
      x.stroke();
      x.fillStyle = '#6a4426'; x.fillRect(5, 3, 2, 3); x.fillRect(10, 4, 1, 3);
    },
    stump(x) {
      x.fillStyle = '#4a3a26'; x.beginPath(); x.moveTo(2, 15); x.lineTo(4, 12); x.lineTo(4, 4); x.lineTo(6, 6); x.lineTo(7, 2); x.lineTo(9, 5); x.lineTo(12, 3); x.lineTo(12, 12); x.lineTo(14, 15); x.fill();
      x.fillStyle = '#6a5236'; x.fillRect(5, 6, 1, 8);
      x.fillStyle = '#2e2418'; x.fillRect(9, 8, 1, 5);
      x.fillStyle = '#4a6a3a'; x.fillRect(4, 12, 3, 2);
    },
    tent(x) {
      x.fillStyle = '#5a2e2c'; x.beginPath(); x.moveTo(2, 30); x.lineTo(16, 6); x.lineTo(30, 30); x.fill();
      x.fillStyle = '#8a4a46'; x.beginPath(); x.moveTo(2, 30); x.lineTo(16, 6); x.lineTo(15, 30); x.fill();
      x.fillStyle = '#a85e52'; x.beginPath(); x.moveTo(3, 30); x.lineTo(16, 7); x.lineTo(7, 30); x.fill();
      x.fillStyle = '#1a1018'; x.beginPath(); x.moveTo(11, 30); x.lineTo(16, 15); x.lineTo(21, 30); x.fill();
      x.fillStyle = '#6e3836'; x.beginPath(); x.moveTo(16, 15); x.lineTo(21, 30); x.lineTo(26, 30); x.fill();
      x.fillStyle = '#4a2624'; x.fillRect(5, 22, 6, 1); x.fillRect(22, 22, 5, 1); x.fillRect(8, 16, 4, 1);
      x.fillStyle = '#7a4e2c'; x.fillRect(15, 1, 2, 7);
      x.fillStyle = '#e6b955'; x.beginPath(); x.moveTo(17, 1); x.lineTo(24, 3); x.lineTo(17, 5); x.fill();
      x.fillStyle = '#ffd36b'; x.fillRect(14, 28, 4, 2);
    },
    chest(x) {
      x.fillStyle = '#7a4e2c'; x.fillRect(2, 7, 12, 8);
      x.fillStyle = '#9a6838'; x.beginPath(); x.moveTo(2, 8); x.quadraticCurveTo(8, 2, 14, 8); x.fill();
      x.fillStyle = '#d9a441'; x.fillRect(2, 8, 12, 1); x.fillRect(4, 4, 1, 11); x.fillRect(11, 4, 1, 11); x.fillRect(7, 9, 2, 3);
      x.fillStyle = '#fff3b0'; x.fillRect(7, 9, 1, 1);
    },
    anvil(x) {
      x.fillStyle = '#4b4358'; x.beginPath(); x.moveTo(1, 6); x.lineTo(15, 6); x.lineTo(13, 9); x.lineTo(10, 9); x.lineTo(11, 13); x.lineTo(5, 13); x.lineTo(6, 9); x.lineTo(3, 9); x.fill();
      x.fillStyle = '#6f6680'; x.fillRect(2, 6, 13, 1);
      x.fillStyle = '#3a3142'; x.fillRect(4, 13, 8, 2);
    },
  };

  // ---------- 熔鐵工坊的怪物（16×16 程序繪製） ----------
  const MON_PROC = {
    // ---------- 星隕觀測所 ----------
    moth(x) {
      x.fillStyle = '#5a6ac0'; x.beginPath(); x.ellipse(5, 7, 4, 5, -0.5, 0, 7); x.fill(); x.beginPath(); x.ellipse(11, 7, 4, 5, 0.5, 0, 7); x.fill();
      x.fillStyle = '#a8c0ff'; x.beginPath(); x.ellipse(5, 6, 2.2, 3, -0.5, 0, 7); x.fill(); x.beginPath(); x.ellipse(11, 6, 2.2, 3, 0.5, 0, 7); x.fill();
      x.fillStyle = '#ffffff'; x.fillRect(4, 5, 1, 1); x.fillRect(11, 5, 1, 1);
      x.fillStyle = '#2a2440'; x.fillRect(7, 4, 2, 9);
      x.fillStyle = '#ffe85c'; x.fillRect(7, 4, 1, 1); x.fillRect(8, 4, 1, 1);
      x.fillStyle = '#7a8ae0'; x.fillRect(6, 1, 1, 3); x.fillRect(9, 1, 1, 3);
    },
    monk(x) {
      x.fillStyle = '#2a3a7a'; x.beginPath(); x.moveTo(3, 15); x.lineTo(5, 6); x.lineTo(10, 6); x.lineTo(12, 15); x.fill();
      x.fillStyle = '#1e2a5a'; x.beginPath(); x.arc(7.5, 5, 3.5, 0, 7); x.fill();
      x.fillStyle = '#0a0c1a'; x.fillRect(6, 4, 3, 3);
      x.fillStyle = '#9ad8ff'; x.fillRect(6, 5, 1, 1); x.fillRect(8, 5, 1, 1);
      x.fillStyle = '#e6c068'; x.fillRect(7, 9, 1, 1); x.fillRect(6, 10, 1, 1); x.fillRect(8, 10, 1, 1); x.fillRect(7, 11, 1, 1); x.fillStyle = '#fff6d0'; x.fillRect(7, 10, 1, 1);
      x.fillStyle = '#6a4426'; x.fillRect(13, 3, 1, 12);
      x.fillStyle = '#bff0ff'; x.beginPath(); x.arc(13.5, 2.5, 2, 0, 7); x.fill();
    },
    ironGolem(x) {
      x.fillStyle = '#3d4250'; x.fillRect(1, 6, 4, 6); x.fillRect(11, 6, 4, 6);
      x.fillStyle = '#5a5e70'; x.fillRect(4, 4, 8, 9);
      x.fillStyle = '#6f7486'; x.fillRect(5, 1, 6, 4);
      x.fillStyle = '#7fb4ff'; x.fillRect(6, 2, 1, 1); x.fillRect(9, 2, 1, 1);
      x.strokeStyle = '#7fb4ff'; x.lineWidth = 1; x.beginPath(); x.moveTo(6, 6); x.lineTo(8, 9); x.lineTo(7, 12); x.moveTo(10, 7); x.lineTo(9, 10); x.stroke();
      x.fillStyle = '#2e3240'; x.fillRect(5, 13, 2, 3); x.fillRect(9, 13, 2, 3);
      x.fillStyle = '#8d95a8'; x.fillRect(4, 4, 8, 1);
    },
    voidEye(x) {
      x.fillStyle = '#3a1e5a'; for (const dx of [4, 7, 10]) x.fillRect(dx, 11, 1, 4);
      x.fillStyle = '#4a2a7a'; x.beginPath(); x.arc(8, 7, 5.5, 0, 7); x.fill();
      x.fillStyle = '#e8e0ff'; x.beginPath(); x.ellipse(8, 7, 3.6, 2.6, 0, 0, 7); x.fill();
      x.fillStyle = '#b46cff'; x.beginPath(); x.arc(8, 7, 1.8, 0, 7); x.fill();
      x.fillStyle = '#0a0612'; x.fillRect(7.5, 6, 1, 2);
      x.fillStyle = '#9a7aff'; x.fillRect(4, 2, 1, 1); x.fillRect(12, 3, 1, 1);
    },
    imp(x) {
      x.fillStyle = '#ffb347'; x.beginPath(); x.moveTo(4, 9); x.quadraticCurveTo(3, 3, 6, 1); x.quadraticCurveTo(6, 5, 8, 6); x.fill();
      x.fillStyle = '#c2410c'; x.beginPath(); x.ellipse(8, 11, 4, 3.5, 0, 0, 7); x.fill();
      x.fillStyle = '#e05a1a'; x.beginPath(); x.arc(9, 6.5, 3.4, 0, 7); x.fill();
      x.fillStyle = '#3a1a0e'; x.beginPath(); x.moveTo(6.5, 4); x.lineTo(6, 1.5); x.lineTo(8, 3.5); x.fill(); x.beginPath(); x.moveTo(10.5, 3.5); x.lineTo(12, 1.5); x.lineTo(12, 4.5); x.fill();
      x.fillStyle = '#ffe85c'; x.fillRect(8, 6, 1, 1); x.fillRect(11, 6, 1, 1);
      x.fillStyle = '#7a2a0e'; x.fillRect(6, 13, 2, 2); x.fillRect(9, 13, 2, 2); x.fillRect(12, 9, 2, 1);
    },
    smith(x) {
      x.fillStyle = '#6a4426'; x.fillRect(12, 3, 2, 9);
      x.fillStyle = '#626a7e'; x.fillRect(10, 1, 6, 4);
      x.fillStyle = '#ff8a1e'; x.fillRect(10, 4, 6, 1);
      x.fillStyle = '#8a5a3a'; x.fillRect(3, 7, 10, 6);
      x.fillStyle = '#5a3a20'; x.fillRect(4, 8, 7, 6);
      x.fillStyle = '#4b4358'; x.beginPath(); x.arc(7, 5, 3.5, Math.PI, 0); x.fill(); x.fillRect(3.5, 5, 7, 2);
      x.fillStyle = '#ff7a2e'; x.fillRect(5, 6, 4, 1);
      x.fillStyle = '#3a2a24'; x.fillRect(4, 14, 3, 2); x.fillRect(8, 14, 3, 2);
    },
    gunner(x) {
      x.fillStyle = '#4b3a30'; x.fillRect(4, 6, 7, 7);
      x.fillStyle = '#2a2433'; x.beginPath(); x.arc(7, 4.5, 3, 0, 7); x.fill();
      x.fillStyle = '#ffb347'; x.fillRect(6, 4, 3, 1);
      x.fillStyle = '#626a7e'; x.fillRect(6, 8, 9, 3);
      x.fillStyle = '#8d95a1'; x.fillRect(6, 8, 9, 1);
      x.fillStyle = '#ff8a1e'; x.fillRect(14, 8, 2, 3);
      x.fillStyle = '#5a3a20'; x.fillRect(1, 5, 3, 7);
      x.fillStyle = '#3a2a24'; x.fillRect(5, 13, 2, 3); x.fillRect(9, 13, 2, 3);
    },
    slag(x) {
      x.fillStyle = '#3a2a24'; x.beginPath(); x.ellipse(8, 10, 6.5, 5.5, 0, 0, 7); x.fill();
      x.fillStyle = '#4e3a30'; x.beginPath(); x.ellipse(7, 8, 4, 3, 0, 0, 7); x.fill();
      x.strokeStyle = '#ff7a2e'; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(3, 11); x.lineTo(6, 12); x.lineTo(8, 14); x.moveTo(10, 6); x.lineTo(12, 9); x.lineTo(14, 10); x.stroke();
      x.fillStyle = '#ffd36b'; x.fillRect(6, 9, 2, 1); x.fillRect(10, 9, 2, 1);
    },
  };

  // 工坊頭目（32×32）
  Object.assign(BOSS_DRAW, {
    forgemaster(x) {
      x.fillStyle = '#6a4426'; x.fillRect(23, 4, 3, 22);
      x.fillStyle = '#4b4358'; x.fillRect(19, 1, 11, 7);
      x.fillStyle = '#ff8a1e'; x.fillRect(19, 6, 11, 2);
      x.fillStyle = '#3a3142'; x.beginPath(); x.moveTo(5, 30); x.lineTo(7, 12); x.lineTo(22, 12); x.lineTo(24, 30); x.fill();
      x.fillStyle = '#5a5e66'; x.fillRect(4, 11, 7, 6); x.fillRect(18, 11, 7, 6);
      x.fillStyle = '#ff7a2e'; x.beginPath(); x.arc(14.5, 19, 4, 0, 7); x.fill();
      x.fillStyle = '#ffd36b'; x.beginPath(); x.arc(14.5, 19, 2, 0, 7); x.fill();
      x.fillStyle = '#4b4358'; x.beginPath(); x.arc(14.5, 8, 5, 0, 7); x.fill();
      x.fillStyle = '#2a2433'; x.beginPath(); x.moveTo(9, 6); x.lineTo(6, 1); x.lineTo(11, 4); x.fill(); x.beginPath(); x.moveTo(20, 6); x.lineTo(23, 1); x.lineTo(18, 4); x.fill();
      x.fillStyle = '#ff5a1e'; x.fillRect(12, 8, 2, 1); x.fillRect(16, 8, 2, 1);
    },
    slagWyrm(x) {
      const seg = [[6, 26, 5], [11, 22, 5.5], [16, 19, 6], [21, 15, 6], [24, 10, 6.5]];
      for (const [a, b, r] of seg) { x.fillStyle = '#4a2a1a'; x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
      x.strokeStyle = '#ff7a2e'; x.lineWidth = 1.5;
      for (const [a, b, r] of seg.slice(0, 4)) { x.beginPath(); x.arc(a, b, r - 1.5, 0.3, 2.2); x.stroke(); }
      x.fillStyle = '#5e3a24'; x.beginPath(); x.moveTo(20, 6); x.lineTo(31, 4); x.lineTo(30, 12); x.lineTo(22, 14); x.fill();
      x.fillStyle = '#ffd36b'; x.fillRect(25, 6, 2, 2);
      x.fillStyle = '#ff8a1e'; x.beginPath(); x.moveTo(26, 10); x.lineTo(31, 9); x.lineTo(29, 12); x.fill();
      x.fillStyle = '#e8e2d0'; x.fillRect(27, 9, 1, 2); x.fillRect(29, 9, 1, 2);
    },
    ironColossus(x) {
      x.fillStyle = '#4b4f58'; x.fillRect(2, 10, 7, 14); x.fillRect(23, 10, 7, 14);
      x.fillStyle = '#5a5e66'; x.fillRect(7, 8, 18, 18);
      x.fillStyle = '#3d4250'; x.fillRect(9, 26, 5, 5); x.fillRect(18, 26, 5, 5);
      x.fillStyle = '#2a2433'; x.fillRect(10, 13, 12, 9);
      x.fillStyle = '#ff7a2e'; for (let i = 0; i < 4; i++) x.fillRect(11, 14 + i * 2, 10, 1);
      x.fillStyle = '#ffd36b'; x.fillRect(13, 16, 6, 3);
      x.fillStyle = '#6f7480'; x.fillRect(12, 2, 8, 7);
      x.fillStyle = '#ff5a1e'; x.fillRect(13, 5, 2, 1); x.fillRect(17, 5, 2, 1);
      x.fillStyle = '#8d95a1'; x.fillRect(7, 8, 18, 1); x.fillRect(2, 10, 7, 1); x.fillRect(23, 10, 7, 1);
    },
  });

  // 熔岩噴口：工坊的光源
  function ember(v) {
    const hot = [['#ff7a2e', '#ffd36b'], ['#ff5a1e', '#ffb347'], ['#ffa63a', '#fff0b0']][v];
    return proc(16, 16, (x) => {
      x.fillStyle = '#3a2a24'; x.beginPath(); x.moveTo(2, 15); x.lineTo(6, 6); x.lineTo(10, 6); x.lineTo(14, 15); x.fill();
      x.fillStyle = '#4e3a30'; x.beginPath(); x.moveTo(4, 15); x.lineTo(7, 7); x.lineTo(8, 15); x.fill();
      x.fillStyle = hot[0]; x.beginPath(); x.ellipse(8, 6.5, 2.5, 1.4, 0, 0, 7); x.fill();
      x.fillStyle = hot[1]; x.fillRect(7, 5, 2, 1); x.fillRect(8, 2, 1, 2); x.fillRect(6, 3, 1, 1);
    });
  }
  Object.assign(PROP, {
    chains(x) {
      x.fillStyle = '#3a3142'; x.fillRect(2, 0, 12, 2);
      x.fillStyle = '#626a7e';
      for (let y = 2; y < 13; y += 3) { x.fillRect(4, y, 2, 2); x.fillRect(10, y + 1, 2, 2); }
      x.fillStyle = '#8d95a1'; x.fillRect(3, 13, 4, 1); x.fillRect(4, 14, 1, 1); x.fillRect(9, 14, 4, 1);
    },
    brazier(x) {
      x.fillStyle = '#3a3142'; x.fillRect(4, 13, 2, 3); x.fillRect(10, 13, 2, 3);
      x.fillStyle = '#4b4358'; x.beginPath(); x.moveTo(2, 9); x.lineTo(14, 9); x.lineTo(11, 13); x.lineTo(5, 13); x.fill();
      x.fillStyle = '#ff7a2e'; x.beginPath(); x.moveTo(4, 9); x.quadraticCurveTo(6, 2, 8, 1); x.quadraticCurveTo(10, 4, 12, 9); x.fill();
      x.fillStyle = '#ffd36b'; x.beginPath(); x.moveTo(6, 9); x.quadraticCurveTo(7, 5, 8, 4); x.quadraticCurveTo(10, 6, 10, 9); x.fill();
    },
    cog(x) {
      x.fillStyle = '#5a5e66';
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.fillRect(8 + Math.cos(a) * 6 - 1.5, 9 + Math.sin(a) * 6 - 1.5, 3, 3); }
      x.beginPath(); x.arc(8, 9, 5, 0, 7); x.fill();
      x.fillStyle = '#2a2433'; x.beginPath(); x.arc(8, 9, 2, 0, 7); x.fill();
      x.fillStyle = '#8d95a1'; x.fillRect(5, 5, 3, 1);
    },
    bucket(x) {
      x.fillStyle = '#4b4358'; x.beginPath(); x.moveTo(3, 7); x.lineTo(13, 7); x.lineTo(12, 15); x.lineTo(4, 15); x.fill();
      x.fillStyle = '#ff7a2e'; x.fillRect(4, 7, 8, 2);
      x.fillStyle = '#ffd36b'; x.fillRect(6, 7, 3, 1);
      x.fillStyle = '#626a7e'; x.fillRect(3, 10, 10, 1);
      x.strokeStyle = '#626a7e'; x.lineWidth = 1.2; x.beginPath(); x.arc(8, 7, 5, Math.PI, 0); x.stroke();
    },
  });

  // ---------- 立體光影：左上受光、右下背光 ----------
  function isDark(d, i) {
    return d[i + 3] && d[i] + d[i + 1] + d[i + 2] < 70;
  }
  function shade(src) {
    const w = src.width, h = src.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    const img = x.getImageData(0, 0, w, h);
    const d = img.data;
    const s = new Uint8ClampedArray(d);
    const edge = (xx, yy) => xx < 0 || yy < 0 || xx >= w || yy >= h || !s[(yy * w + xx) * 4 + 3] || isDark(s, (yy * w + xx) * 4);
    for (let y = 0; y < h; y++)
      for (let xx = 0; xx < w; xx++) {
        const i = (y * w + xx) * 4;
        if (!s[i + 3] || isDark(s, i)) continue;
        const lit = edge(xx, y - 1) || edge(xx - 1, y);
        const dim = edge(xx, y + 1) || edge(xx + 1, y);
        if (lit && !dim) for (let k = 0; k < 3; k++) d[i + k] = s[i + k] + (255 - s[i + k]) * 0.22;
        else if (dim && !lit) for (let k = 0; k < 3; k++) d[i + k] = s[i + k] * 0.72;
      }
    x.putImageData(img, 0, 0);
    return c;
  }

  // ---------- 動畫影格：從一張圖拆出上半身與腿部，做出呼吸、走路、攻擊、受傷 ----------
  const fcache = {};
  function remap(src, fn) {
    const w = src.width, h = src.height;
    const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const img = x.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++)
      for (let xx = 0; xx < w; xx++) {
        const [sx, sy] = fn(xx, y);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const si = (sy * w + sx) * 4, di = (y * w + xx) * 4;
        for (let k = 0; k < 4; k++) d[di + k] = sd[si + k];
      }
    x.putImageData(img, 0, 0);
    return c;
  }
  function frames(name) {
    if (fcache[name]) return fcache[name];
    const base = get(name);
    const w = base.width, h = base.height;
    const legY = Math.round(h * 0.78);
    const u = Math.max(1, Math.floor(w / 16)); // 頭目為 2 倍大小
    // 腿部左右分界：腿部像素的平均 x
    const bd = base.getContext('2d').getImageData(0, 0, w, h).data;
    let sum = 0, n = 0;
    for (let y = legY; y < h; y++) for (let xx = 0; xx < w; xx++) if (bd[(y * w + xx) * 4 + 3]) { sum += xx; n++; }
    const mid = n ? sum / n : w / 2;
    const up = (y) => y < legY;
    const breathe = (xx, y) => (up(y) ? [xx, y - u] : [xx, y]);
    const f = {
      idle: [base, remap(base, breathe)],
      walk: [
        remap(base, (xx, y) => (!up(y) && xx < mid ? [xx, y + u] : [xx, y])),
        remap(base, breathe),
        remap(base, (xx, y) => (!up(y) && xx >= mid ? [xx, y + u] : [xx, y])),
        remap(base, breathe),
      ],
      atk: [
        remap(base, (xx, y) => (up(y) ? [xx + u, y + (y < legY / 2 ? u : 0)] : [xx, y])),
        remap(base, (xx, y) => (up(y) ? [xx - 2 * u, y] : [xx, y])),
      ],
      hurt: remap(base, (xx, y) => (up(y) ? [xx + u, y + u] : [xx, y])),
    };
    for (const k of ['idle', 'walk', 'atk']) f[k] = f[k].map(shade);
    f.hurt = shade(f.hurt);
    // 死亡碎裂用的像素清單
    const pd = f.idle[0].getContext('2d').getImageData(0, 0, w, h).data;
    f.pixels = [];
    for (let y = 0; y < h; y += Math.max(1, u)) for (let xx = 0; xx < w; xx += Math.max(1, u)) {
      const i = (y * w + xx) * 4;
      if (pd[i + 3] && !isDark(pd, i)) f.pixels.push([xx, y, `rgb(${pd[i]},${pd[i + 1]},${pd[i + 2]})`]);
    }
    fcache[name] = f;
    return f;
  }
  function flashFrame(frame, color) {
    if (!frame._flash) frame._flash = {};
    if (!frame._flash[color]) frame._flash[color] = silhouette(frame, color);
    return frame._flash[color];
  }

  // ---------- 技能圖示（24×24 程序繪製） ----------
  const SKILL_ICON = {
    thrust(x) {
      x.fillStyle = '#d9e1ea'; x.beginPath(); x.moveTo(4, 20); x.lineTo(18, 6); x.lineTo(21, 3); x.lineTo(18, 9); x.lineTo(6, 22); x.fill();
      x.fillStyle = '#d9a441'; x.fillRect(5, 16, 4, 4);
      x.fillStyle = '#fff'; x.fillRect(12, 4, 6, 1); x.fillRect(15, 7, 5, 1);
    },
    cleave(x) {
      x.fillStyle = '#8a5a32'; x.fillRect(3, 6, 3, 16);
      x.fillStyle = '#c8ccd4'; x.beginPath(); x.moveTo(5, 4); x.quadraticCurveTo(22, 4, 20, 16); x.lineTo(6, 12); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(7, 6); x.quadraticCurveTo(18, 6, 18, 13); x.lineTo(16, 12); x.quadraticCurveTo(16, 8, 7, 8); x.fill();
    },
    whirl(x) {
      x.strokeStyle = '#e8ecf2'; x.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; x.beginPath(); x.arc(12, 12, 8, a, a + 1.4); x.stroke(); }
      x.fillStyle = '#d9a441'; x.beginPath(); x.arc(12, 12, 3, 0, 7); x.fill();
    },
    breaker(x) {
      x.fillStyle = '#ffe08a';
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.beginPath(); x.moveTo(12, 12); x.lineTo(12 + Math.cos(a) * 11, 12 + Math.sin(a) * 11); x.lineTo(12 + Math.cos(a + 0.3) * 5, 12 + Math.sin(a + 0.3) * 5); x.fill(); }
      x.fillStyle = '#8d95a1'; x.fillRect(7, 8, 10, 7);
      x.fillStyle = '#8a5a32'; x.fillRect(11, 15, 3, 7);
    },
    aimed(x) {
      x.strokeStyle = '#ff6a5a'; x.lineWidth = 2;
      x.beginPath(); x.arc(15, 9, 6, 0, 7); x.stroke(); x.beginPath(); x.arc(15, 9, 2, 0, 7); x.stroke();
      x.strokeStyle = '#e8e2d0'; x.beginPath(); x.moveTo(2, 22); x.lineTo(14, 10); x.stroke();
      x.fillStyle = '#c8ccd4'; x.beginPath(); x.moveTo(15, 9); x.lineTo(10, 11); x.lineTo(13, 14); x.fill();
    },
    pierce(x) {
      x.fillStyle = '#7fb0ff'; for (const [a, b] of [[7, 17], [12, 12], [17, 7]]) { x.beginPath(); x.arc(a, b, 3, 0, 7); x.fill(); }
      x.strokeStyle = '#fff3c4'; x.lineWidth = 2; x.beginPath(); x.moveTo(1, 23); x.lineTo(21, 3); x.stroke();
      x.fillStyle = '#fff3c4'; x.beginPath(); x.moveTo(23, 1); x.lineTo(16, 4); x.lineTo(20, 8); x.fill();
    },
    fan(x) {
      x.strokeStyle = '#e8e2d0'; x.lineWidth = 2;
      for (const dx of [-6, 0, 6]) { x.beginPath(); x.moveTo(12 + dx * 0.4, 2); x.lineTo(12 + dx, 18); x.stroke(); x.fillStyle = '#c8ccd4'; x.beginPath(); x.moveTo(12 + dx, 22); x.lineTo(9 + dx, 16); x.lineTo(15 + dx, 16); x.fill(); }
    },
    bolt(x) {
      x.fillStyle = '#ffe85c'; x.beginPath(); x.moveTo(14, 1); x.lineTo(5, 13); x.lineTo(11, 13); x.lineTo(8, 23); x.lineTo(19, 9); x.lineTo(13, 9); x.lineTo(17, 1); x.fill();
      x.fillStyle = '#fffbe0'; x.fillRect(11, 5, 2, 4);
    },
    firewell(x) {
      x.fillStyle = '#c23a1a'; x.beginPath(); x.moveTo(4, 22); x.quadraticCurveTo(2, 10, 9, 3); x.quadraticCurveTo(10, 10, 13, 8); x.quadraticCurveTo(16, 2, 15, 1); x.quadraticCurveTo(23, 10, 20, 22); x.fill();
      x.fillStyle = '#ff9a2e'; x.beginPath(); x.moveTo(7, 22); x.quadraticCurveTo(6, 14, 11, 9); x.quadraticCurveTo(12, 14, 15, 12); x.quadraticCurveTo(19, 16, 17, 22); x.fill();
      x.fillStyle = '#ffe85c'; x.beginPath(); x.ellipse(12, 19, 3, 3, 0, 0, 7); x.fill();
    },
    frost(x) {
      x.strokeStyle = '#bff0ff'; x.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; x.beginPath(); x.moveTo(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10); x.lineTo(12 - Math.cos(a) * 10, 12 - Math.sin(a) * 10); x.stroke(); }
      x.fillStyle = '#7fd8ff'; x.beginPath(); x.arc(12, 12, 3, 0, 7); x.fill();
      x.fillStyle = '#e6fdff'; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; x.fillRect(12 + Math.cos(a) * 7 - 1, 12 + Math.sin(a) * 7 - 1, 2, 2); }
    },
    manabolt(x) {
      x.fillStyle = '#c7a0ff'; x.beginPath(); x.moveTo(12, 1); x.lineTo(14, 10); x.lineTo(23, 12); x.lineTo(14, 14); x.lineTo(12, 23); x.lineTo(10, 14); x.lineTo(1, 12); x.lineTo(10, 10); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(12, 12, 2.5, 0, 7); x.fill();
    },
    stoneskin(x) {
      x.fillStyle = '#7a6a5a'; x.beginPath(); x.moveTo(12, 2); x.lineTo(21, 6); x.lineTo(19, 17); x.lineTo(12, 22); x.lineTo(5, 17); x.lineTo(3, 6); x.fill();
      x.fillStyle = '#a89880'; x.beginPath(); x.moveTo(12, 5); x.lineTo(18, 8); x.lineTo(12, 13); x.lineTo(6, 8); x.fill();
      x.strokeStyle = '#3a3028'; x.lineWidth = 1; x.beginPath(); x.moveTo(12, 13); x.lineTo(10, 18); x.moveTo(12, 13); x.lineTo(16, 16); x.stroke();
    },
    heal(x) {
      x.fillStyle = '#3aa85a'; x.fillRect(9, 3, 6, 18); x.fillRect(3, 9, 18, 6);
      x.fillStyle = '#9dffb0'; x.fillRect(10, 4, 3, 16); x.fillRect(4, 10, 16, 3);
    },
    static(x) {
      x.strokeStyle = '#7fd8ff'; x.lineWidth = 2; x.beginPath(); x.arc(12, 12, 9, 0, 7); x.stroke();
      x.fillStyle = '#2f6fb0'; x.beginPath(); x.arc(12, 12, 6, 0, 7); x.fill();
      x.strokeStyle = '#ffe85c'; x.lineWidth = 2; x.beginPath(); x.moveTo(13, 5); x.lineTo(9, 12); x.lineTo(14, 12); x.lineTo(10, 19); x.stroke();
    },
    rift(x) {
      x.fillStyle = '#6b2fb3'; for (const [a, h] of [[5, 12], [11, 20], [17, 15]]) { x.beginPath(); x.moveTo(a - 3, 23); x.lineTo(a + 1, 23 - h); x.lineTo(a + 4, 23); x.fill(); }
      x.fillStyle = '#e9d3ff'; for (const [a, h] of [[5, 12], [11, 20], [17, 15]]) { x.beginPath(); x.moveTo(a, 23); x.lineTo(a + 1, 23 - h); x.lineTo(a + 2, 23); x.fill(); }
    },
    quake(x) {
      x.fillStyle = '#6a5a48'; x.fillRect(1, 15, 22, 8);
      x.strokeStyle = '#1a1418'; x.lineWidth = 2; x.beginPath(); x.moveTo(12, 15); x.lineTo(9, 19); x.lineTo(12, 23); x.moveTo(12, 15); x.lineTo(17, 20); x.stroke();
      x.strokeStyle = '#ffe08a'; x.lineWidth = 2; for (const a of [-2.4, -1.57, -0.7]) { x.beginPath(); x.moveTo(12 + Math.cos(a) * 4, 12 + Math.sin(a) * 4); x.lineTo(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10); x.stroke(); }
    },
    boneSpear(x) {
      x.fillStyle = '#e0d8c0'; x.beginPath(); x.moveTo(3, 21); x.lineTo(17, 7); x.lineTo(19, 9); x.lineTo(5, 23); x.fill();
      x.beginPath(); x.moveTo(23, 1); x.lineTo(15, 5); x.lineTo(19, 9); x.fill();
      x.fillStyle = '#e0d8c0'; x.beginPath(); x.arc(4, 21, 3, 0, 7); x.fill();
    },
    starBolt(x) {
      const star = (r1, r2) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? r2 : r1; x.lineTo(12 + Math.cos(a) * r, 11 + Math.sin(a) * r); } x.fill(); };
      x.fillStyle = '#5a8aff'; star(10, 4);
      x.fillStyle = '#fff6a0'; star(6, 2);
      x.strokeStyle = '#ffe85c'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(12, 17); x.lineTo(9, 20); x.lineTo(13, 20); x.lineTo(10, 23); x.stroke();
    },
    iceComet(x) {
      x.fillStyle = 'rgba(127,216,255,0.5)'; x.beginPath(); x.moveTo(2, 22); x.lineTo(14, 8); x.lineTo(17, 11); x.fill();
      x.fillStyle = '#bff0ff'; x.beginPath(); x.moveTo(13, 5); x.lineTo(22, 2); x.lineTo(19, 11); x.lineTo(14, 13); x.lineTo(11, 10); x.fill();
      x.fillStyle = '#ffffff'; x.fillRect(16, 5, 2, 2);
    },
    meteor(x) {
      x.fillStyle = '#ff7a2e'; x.beginPath(); x.moveTo(2, 2); x.lineTo(14, 10); x.lineTo(10, 14); x.fill();
      x.fillStyle = '#ffd36b'; x.beginPath(); x.moveTo(5, 4); x.lineTo(14, 11); x.lineTo(11, 13); x.fill();
      x.fillStyle = '#4a2a1a'; x.beginPath(); x.arc(15, 15, 6, 0, 7); x.fill();
      x.fillStyle = '#ff5a1e'; x.fillRect(12, 13, 3, 2); x.fillRect(16, 16, 2, 3);
      x.fillStyle = '#ffd36b'; x.fillRect(13, 12, 2, 1);
    },
    moltenCleave(x) {
      x.fillStyle = '#5a3a20'; x.fillRect(3, 17, 4, 5);
      x.fillStyle = '#ff7a2e'; x.beginPath(); x.moveTo(5, 18); x.quadraticCurveTo(6, 4, 21, 3); x.quadraticCurveTo(12, 9, 9, 19); x.fill();
      x.fillStyle = '#ffd36b'; x.beginPath(); x.moveTo(7, 15); x.quadraticCurveTo(9, 7, 18, 5); x.quadraticCurveTo(12, 9, 9, 15); x.fill();
      x.fillStyle = '#d9a441'; x.fillRect(2, 15, 8, 2);
    },
    plague(x) {
      x.fillStyle = '#4a8a3a'; for (const [a, b, r] of [[8, 14, 6], [15, 12, 7], [12, 7, 5]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
      x.fillStyle = '#e0d8c0'; x.beginPath(); x.arc(12, 13, 4, 0, 7); x.fill(); x.fillRect(10, 16, 4, 3);
      x.fillStyle = '#1a1418'; x.fillRect(10, 12, 2, 2); x.fillRect(13, 12, 2, 2);
    },
  };
  const skillUrl = {};
  function skillIconURL(id, scale) {
    scale = scale || 2;
    const k = id + '@' + scale;
    if (skillUrl[k]) return skillUrl[k];
    const draw = SKILL_ICON[id];
    if (!draw) return '';
    const src = shade(proc(24, 24, draw));
    const c = document.createElement('canvas');
    c.width = 24 * scale; c.height = 24 * scale;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    return (skillUrl[k] = c.toDataURL());
  }

  // 柔光粒子（預先畫好，粒子大量時也很省）
  const glowCache = {};
  function glow(color, r) {
    if (color[0] === '#') { const n = parseInt(color.slice(1), 16); color = `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`; }
    const k = color + r;
    if (glowCache[k]) return glowCache[k];
    const c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color.replace(/rgb\(([^)]+)\)/, 'rgba($1,0.6)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, r * 2, r * 2);
    return (glowCache[k] = c);
  }

  // ---------- 新裝備的圖示 ----------
  const ICON_PROC = {
    cap(x) {
      x.fillStyle = '#7a4e2c'; x.beginPath(); x.ellipse(8, 9, 5.5, 4.5, 0, Math.PI, 0); x.fill();
      x.fillRect(2.5, 9, 11, 2);
      x.fillStyle = '#5a3a20'; x.fillRect(1, 10, 14, 2);
      x.fillStyle = '#9a6838'; x.fillRect(5, 5, 4, 1);
      x.fillStyle = '#ff6a5a'; x.fillRect(12, 3, 1, 5); x.fillRect(13, 2, 1, 3);
    },
    gauntlets(x) {
      x.fillStyle = '#8d95a1'; x.fillRect(3, 3, 7, 7); x.fillRect(4, 10, 9, 4);
      x.fillStyle = '#d9e1ea'; x.fillRect(3, 3, 7, 1); x.fillRect(4, 10, 9, 1);
      x.fillStyle = '#626a7e'; x.fillRect(3, 7, 7, 1); x.fillRect(7, 12, 1, 2); x.fillRect(10, 12, 1, 2);
      x.fillStyle = '#d9a441'; x.fillRect(5, 5, 3, 1);
    },
    wraps(x) {
      x.fillStyle = '#d8cfb4'; x.fillRect(4, 3, 6, 8); x.fillRect(5, 11, 7, 3);
      x.fillStyle = '#a89880'; for (let i = 0; i < 4; i++) x.fillRect(4, 4 + i * 2, 6, 1);
      x.fillStyle = '#7a62c8'; x.fillRect(4, 10, 6, 1);
    },
    greaves(x) {
      x.fillStyle = '#8d95a1'; x.fillRect(4, 2, 6, 10); x.fillRect(4, 11, 10, 3);
      x.fillStyle = '#d9e1ea'; x.fillRect(4, 2, 6, 1); x.fillRect(5, 6, 4, 1);
      x.fillStyle = '#626a7e'; x.fillRect(4, 13, 10, 1); x.fillRect(9, 3, 1, 8);
    },
    slippers(x) {
      x.fillStyle = '#5a4aa0'; x.beginPath(); x.ellipse(7, 11, 6, 3, 0, 0, 7); x.fill();
      x.fillStyle = '#3b2f6b'; x.fillRect(3, 9, 5, 2);
      x.fillStyle = '#e6b955'; x.fillRect(12, 10, 1, 1);
    },
  };

  // ---------- 紙娃娃：依穿戴的裝備組出英雄外觀（22×26） ----------
  const RAR_TRIM = ['#bdb8ae', '#62d26f', '#4ea8ff', '#b876ff', '#ffb347', '#ff4f6e'];
  const METAL = [
    ['#8d95a1', '#d9e1ea', '#626a7e'], ['#8d95a1', '#d9e1ea', '#626a7e'], ['#8da0b8', '#e0ecff', '#5a6a86'],
    ['#9a8db8', '#ece0ff', '#5e5486'], ['#c9a24a', '#ffe08a', '#8a6a2a'], ['#5a2434', '#ff5a78', '#2a1018'],
  ];
  const LEATHER = [
    ['#8a5a32', '#a8743e', '#5a3a20'], ['#8a5a32', '#a8743e', '#5a3a20'], ['#6e4a2e', '#946a44', '#44291a'],
    ['#5e3a3a', '#86545a', '#3a2024'], ['#3a2a2a', '#5a4040', '#1e1414'], ['#4a1a20', '#7a2a34', '#2a0c10'],
  ];
  const CLOTH = [
    ['#5a4a3a', '#76644e'], ['#3a5a3a', '#527a50'], ['#2a4a7a', '#4068a8'],
    ['#3b2f6b', '#5a4aa0'], ['#7a4a10', '#a86a20'], ['#6a1020', '#9a2030'],
  ];
  const SKIN = '#d9a77a', HAIR = '#5a3a20';

  function lookOf(gear) {
    const L = {};
    for (const sl of ['head', 'body', 'hands', 'feet', 'offhand', 'weapon']) {
      const it = gear && gear[sl];
      if (it) L[sl] = { b: it.base, r: it.rarity, p: it.plus || 0, u: !!it.uniq };
    }
    return L;
  }
  function lookKey(L) {
    return ['head', 'body', 'hands', 'feet', 'offhand'].map((s) => (L[s] ? L[s].b + L[s].r : '-')).join('|');
  }
  function clsOf(part) {
    const b = part && LH.D.BASES[part.b];
    return b ? b.cls : null;
  }

  function drawDoll(x, L) {
    const r = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px + 1, py + 1, w, h); };
    const body = L.body, bc = clsOf(body), br = body ? body.r : 0;
    const off = L.offhand && L.offhand.b;
    // 傳說以上的身體裝備多一件披風
    if (body && br >= 4) {
      const cape = br >= 5 ? ['#7a1424', '#ff4f6e'] : ['#8a3e12', '#ffb347'];
      r(5, 11, 10, 11, cape[0]); r(4, 20, 12, 2, cape[0]);
      r(4, 21, 2, 1, cape[1]); r(8, 21, 2, 1, cape[1]); r(12, 21, 2, 1, cape[1]);
    }
    if (off === 'quiver') {
      r(1, 6, 3, 9, '#7a4e2c'); r(1, 6, 3, 1, '#4e311b'); r(1, 10, 3, 1, RAR_TRIM[L.offhand.r]);
      r(1, 3, 1, 3, '#e8e2d0'); r(2, 4, 1, 2, '#ff6a5a'); r(3, 3, 1, 3, '#e8e2d0');
    }
    // 腿與鞋
    r(7, 18, 3, 4, '#3d3446'); r(10, 18, 3, 4, '#3d3446');
    const ft = clsOf(L.feet), fr = L.feet ? L.feet.r : 0, ftr = RAR_TRIM[fr];
    if (ft === 'heavy') {
      const M = METAL[fr];
      r(6, 19, 4, 5, M[0]); r(10, 19, 4, 5, M[0]); r(6, 19, 4, 1, M[1]); r(10, 19, 4, 1, M[1]);
      r(7, 20, 2, 1, ftr); r(11, 20, 2, 1, ftr); r(6, 23, 4, 1, M[2]); r(10, 23, 4, 1, M[2]);
    } else if (ft === 'light') {
      const C = LEATHER[fr];
      r(6, 20, 4, 4, C[0]); r(10, 20, 4, 4, C[0]); r(6, 20, 4, 1, C[1]); r(10, 20, 4, 1, C[1]);
      r(6, 23, 4, 1, C[2]); r(10, 23, 4, 1, C[2]); r(8, 21, 1, 1, ftr); r(12, 21, 1, 1, ftr);
    } else if (ft === 'cloth') {
      const C = CLOTH[fr];
      r(6, 22, 4, 2, C[0]); r(10, 22, 4, 2, C[0]); r(6, 22, 4, 1, C[1]); r(10, 22, 4, 1, C[1]);
      r(9, 23, 1, 1, ftr); r(13, 23, 1, 1, ftr);
    } else { r(6, 22, 4, 2, '#2a2030'); r(10, 22, 4, 2, '#2a2030'); }
    // 身體底層（布衣；HERO.shirt／HERO.dots 可以換成自己的衣服）
    const sh = HERO.shirt || '#6b5a4a';
    r(6, 11, 8, 7, sh); r(4, 11, 2, 6, sh); r(14, 11, 2, 6, sh);
    if (HERO.dots) for (const [dx, dy, dc] of HERO.dots) r(dx, dy, 1, 1, dc);
    r(4, 17, 2, 1, SKIN); r(14, 17, 2, 1, SKIN); r(6, 17, 8, 1, '#4e311b');
    // 身體裝備
    const trim = RAR_TRIM[br];
    if (bc === 'heavy') {
      const M = METAL[br];
      r(5, 11, 10, 7, M[0]); r(5, 11, 10, 1, M[1]); r(6, 13, 8, 1, M[2]); r(9, 12, 2, 5, M[1]);
      r(4, 13, 2, 4, M[2]); r(14, 13, 2, 4, M[2]);
      r(3, 10, 4, 3, M[0]); r(13, 10, 4, 3, M[0]); r(3, 10, 4, 1, M[1]); r(13, 10, 4, 1, M[1]);
      r(4, 11, 1, 1, trim); r(15, 11, 1, 1, trim); r(9, 14, 2, 2, trim);
      r(6, 17, 8, 2, M[2]); r(8, 17, 1, 2, '#2a2433'); r(11, 17, 1, 2, '#2a2433'); r(9, 17, 2, 1, '#d9a441');
    } else if (bc === 'light') {
      const C = LEATHER[br];
      r(6, 11, 8, 6, C[0]); r(6, 11, 8, 1, C[1]);
      for (let i = 0; i < 6; i++) r(7 + i, 11 + i, 1, 1, C[2]);
      r(4, 11, 2, 2, C[2]); r(14, 11, 2, 2, C[2]);
      r(12, 12, 1, 1, trim); r(7, 15, 1, 1, trim); r(10, 13, 1, 1, trim);
      r(6, 17, 8, 1, '#2a1a10'); r(11, 17, 2, 2, C[2]); r(8, 17, 1, 1, '#d9a441');
    } else if (bc === 'cloth') {
      const C = CLOTH[br];
      r(6, 11, 8, 7, C[0]); r(5, 18, 10, 4, C[0]); r(5, 21, 10, 1, trim);
      r(3, 11, 3, 6, C[0]); r(14, 11, 3, 6, C[0]); r(3, 16, 3, 1, trim); r(14, 16, 3, 1, trim);
      r(8, 11, 4, 1, C[1]); r(10, 12, 1, 9, C[1]); r(6, 17, 8, 1, '#d9a441');
    }
    // 手部
    const hc = clsOf(L.hands), hr = L.hands ? L.hands.r : 0, htr = RAR_TRIM[hr];
    if (hc === 'heavy') {
      const M = METAL[hr];
      r(3, 15, 3, 3, M[0]); r(14, 15, 3, 3, M[0]); r(3, 15, 3, 1, M[1]); r(14, 15, 3, 1, M[1]);
      r(4, 17, 1, 1, htr); r(15, 17, 1, 1, htr);
    } else if (hc === 'light') {
      const C = LEATHER[hr];
      r(4, 16, 2, 2, C[0]); r(14, 16, 2, 2, C[0]); r(4, 16, 2, 1, C[2]); r(14, 16, 2, 1, C[2]);
      r(5, 17, 1, 1, htr); r(15, 17, 1, 1, htr);
    } else if (hc === 'cloth') {
      r(4, 16, 2, 2, '#d8cfb4'); r(14, 16, 2, 2, '#d8cfb4'); r(4, 17, 2, 1, '#a89880'); r(14, 17, 2, 1, '#a89880');
      r(4, 16, 2, 1, htr); r(14, 16, 2, 1, htr);
    }
    // 頭（可以用 HERO.head 換成自己的頭，見 kid.js）
    r(9, 10, 2, 1, SKIN);
    const hd = clsOf(L.head), hdr = L.head ? L.head.r : 0, hdt = RAR_TRIM[hdr];
    if (HERO.head) {
      const hc = hd === 'cloth' && bc === 'cloth' ? CLOTH[br] : hd === 'cloth' ? CLOTH[hdr] : hd === 'heavy' ? METAL[hdr] : hd === 'light' ? LEATHER[hdr] : null;
      HERO.head(x, { cls: hd, col: hc, trim: hdt, skin: SKIN });
    } else if (hd === 'cloth') {
      const C = bc === 'cloth' ? CLOTH[br] : CLOTH[hdr];
      r(5, 2, 10, 9, C[0]); r(8, 1, 4, 1, C[0]); r(9, 0, 2, 1, C[0]);
      r(7, 4, 6, 6, '#1a1420'); r(8, 6, 1, 1, hdt === RAR_TRIM[0] ? '#b46cff' : hdt); r(11, 6, 1, 1, hdt === RAR_TRIM[0] ? '#b46cff' : hdt);
      r(6, 3, 1, 6, C[1]); r(5, 10, 10, 1, hdt);
    } else {
      r(7, 4, 6, 6, SKIN); r(7, 3, 6, 2, HAIR); r(6, 4, 1, 4, HAIR); r(13, 4, 1, 3, HAIR);
      r(8, 6, 1, 1, '#2a1a14'); r(11, 6, 1, 1, '#2a1a14'); r(9, 8, 2, 1, '#b07a58');
      if (hd === 'heavy') {
        const M = METAL[hdr];
        r(6, 2, 8, 6, M[0]); r(6, 2, 8, 1, M[1]); r(7, 6, 6, 1, '#1a1418');
        r(8, 6, 1, 1, '#ffe9a8'); r(11, 6, 1, 1, '#ffe9a8');
        r(6, 7, 2, 3, M[2]); r(12, 7, 2, 3, M[2]); r(9, 0, 2, 2, hdt); r(9, 3, 2, 2, '#ffe08a');
      } else if (hd === 'light') {
        const C = LEATHER[hdr];
        r(6, 2, 8, 3, C[0]); r(6, 2, 8, 1, C[1]); r(5, 4, 10, 1, C[2]);
        r(13, 0, 1, 3, hdt); r(14, 1, 1, 2, hdt);
      }
    }
    // 副手（身前）
    if (off === 'shield') {
      const sr = L.offhand.r, M = METAL[sr];
      x.fillStyle = M[2]; x.beginPath(); x.arc(4, 15, 4.3, 0, 7); x.fill();
      x.fillStyle = sr >= 4 ? M[0] : '#7a4e2c'; x.beginPath(); x.arc(4, 15, 3.3, 0, 7); x.fill();
      r(2, 13, 2, 2, M[1]); r(2, 13, 1, 1, RAR_TRIM[sr]);
      x.fillStyle = RAR_TRIM[sr]; x.fillRect(3, 14, 2, 2);
    } else if (off === 'orb') {
      x.fillStyle = '#2f9fd0'; x.beginPath(); x.arc(2.5, 13.5, 2.2, 0, 7); x.fill();
      r(0, 11, 2, 2, '#7fe7ff'); r(0, 11, 1, 1, '#ffffff');
    }
  }
  // 主角圖的大小：電腦版 22×26；top＝頭頂多留的高度（手機版的大頭用）；head＝換頭的畫法
  const HERO = { w: 22, h: 26, top: 0, head: null, shirt: null, dots: null };
  const dollCache = {};
  function heroImg(L) {
    const k = lookKey(L);
    if (!dollCache[k]) dollCache[k] = shade(proc(HERO.w, HERO.h + HERO.top, (x) => { x.translate(0, HERO.top); drawDoll(x, L); }));
    return dollCache[k];
  }
  function heroFrames(L) {
    const name = 'hero#' + lookKey(L);
    if (!cache[name]) cache[name] = heroImg(L);
    return frames(name);
  }
  function heroURL(L, scale) {
    const k = 'hero#' + lookKey(L) + '@' + scale;
    if (urlCache[k]) return urlCache[k];
    const src = heroImg(L);
    const c = document.createElement('canvas');
    c.width = src.width * scale; c.height = src.height * scale;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    return (urlCache[k] = c.toDataURL());
  }

  const cache = {};
  function get(name) {
    if (cache[name]) return cache[name];
    let c;
    if (ART[name]) c = build(ART[name], ART_PAL[name]);
    else if (MON_PROC[name]) c = proc(16, 16, MON_PROC[name]);
    else if (/^(bog|forge|observatory)_/.test(name)) {
      const th = name.slice(0, name.indexOf('_')), r = name.slice(th.length + 1);
      if (r.startsWith('floor')) c = floorTile(+r.slice(5), th);
      else if (r.startsWith('wallface')) c = wallFace(+r.slice(8), th);
      else if (r.startsWith('wall')) c = wallTile(+r.slice(4), th);
    } else if (name.startsWith('ember')) c = ember(+name.slice(5)); else if (name.startsWith('swamp')) c = swampTile(+name.slice(5));
    else if (name.startsWith('wisp')) c = wisp(+name.slice(4));
    else if (name.startsWith('prop_')) { const k = name.slice(5), n = k === 'tent' ? 32 : 16; c = shade(proc(n, n, PROP[k])); }
    else if (name.startsWith('boss_')) {
      const k = name.slice(5);
      c = proc(32, 32, BOSS_DRAW[k]);
    } else if (name.startsWith('icon_uq_')) c = goldify(get('icon_' + name.slice(8)));
    else if (name.startsWith('icon_')) { const k = name.slice(5); c = ICON[k] ? build(ICON[k]) : shade(proc(16, 16, ICON_PROC[k])); }
    else if (name.startsWith('floor')) c = floorTile(+name.slice(5));
    else if (name.startsWith('wallface')) c = wallFace(+name.slice(8));
    else if (name.startsWith('wall')) c = wallTile(+name.slice(4));
    else if (name.startsWith('crystal')) c = crystal(+name.slice(7));
    else if (name.startsWith('rubble')) c = rubble(+name.slice(6));
    else if (name === 'bones') c = bones();
    else if (name.startsWith('fire')) c = campfire(+name.slice(4));
    cache[name] = c;
    return c;
  }
  function flash(name, color) {
    const key = name + '#' + color;
    if (!cache[key]) cache[key] = silhouette(get(name), color);
    return cache[key];
  }

  // 物品圖示 dataURL（放大 3 倍給 DOM 用）
  const urlCache = {};
  function iconKey(it) {
    if (it.potion) return 'potion_' + it.potion;
    if (it.uniq) return 'uq_' + it.base;
    if (it.base === 'staff') return 'staff';
    return it.base;
  }
  // 傳奇寶物：金色描邊、淡淡的金光與一顆星芒
  function goldify(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const x = c.getContext('2d');
    const s = silhouette(src, '#e6c068');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) x.drawImage(s, dx, dy);
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(255,214,120,0.2)';
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#fff6d0';
    x.fillRect(c.width - 4, 1, 1, 3); x.fillRect(c.width - 5, 2, 3, 1);
    return c;
  }
  function iconURL(it, scale) {
    scale = scale || 3;
    const k = iconKey(it) + '@' + scale;
    if (urlCache[k]) return urlCache[k];
    const src = get('icon_' + iconKey(it));
    const c = document.createElement('canvas');
    c.width = src.width * scale; c.height = src.height * scale;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    return (urlCache[k] = c.toDataURL());
  }
  function spriteURL(name, scale) {
    const k = name + '@' + scale;
    if (urlCache[k]) return urlCache[k];
    const src = get(name);
    const c = document.createElement('canvas');
    c.width = src.width * scale; c.height = src.height * scale;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    return (urlCache[k] = c.toDataURL());
  }

  // 標題徽章：交叉雙劍＋黑晶
  function emblemURL(scale) {
    const k = 'emblem@' + scale;
    if (urlCache[k]) return urlCache[k];
    const src = shade(proc(44, 44, (x) => {
      const sword = (flip) => {
        x.save(); x.translate(22, 23); x.rotate(flip ? -Math.PI / 4 : Math.PI / 4);
        x.fillStyle = '#c8ccd4'; x.beginPath(); x.moveTo(-2, 8); x.lineTo(-2, -16); x.lineTo(0, -20); x.lineTo(2, -16); x.lineTo(2, 8); x.fill();
        x.fillStyle = '#ffffff'; x.fillRect(-1, -15, 1, 22);
        x.fillStyle = '#d9a441'; x.fillRect(-6, 8, 12, 3);
        x.fillStyle = '#7a4e2c'; x.fillRect(-1.5, 11, 3, 7);
        x.fillStyle = '#ffd36b'; x.beginPath(); x.arc(0, 19.5, 2, 0, 7); x.fill();
        x.restore();
      };
      sword(false); sword(true);
      x.fillStyle = '#3b2f6b'; x.beginPath(); x.moveTo(22, 5); x.lineTo(31, 18); x.lineTo(27, 34); x.lineTo(17, 34); x.lineTo(13, 18); x.closePath(); x.fill();
      x.fillStyle = '#6b2fb3'; x.beginPath(); x.moveTo(22, 5); x.lineTo(31, 18); x.lineTo(27, 34); x.lineTo(22, 34); x.closePath(); x.fill();
      x.fillStyle = '#b46cff'; x.beginPath(); x.moveTo(22, 5); x.lineTo(16, 18); x.lineTo(22, 30); x.closePath(); x.fill();
      x.fillStyle = '#f0dcff'; x.fillRect(19, 14, 2, 5); x.fillRect(20, 12, 1, 2);
    }));
    const c = document.createElement('canvas');
    c.width = src.width * scale; c.height = src.height * scale;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    return (urlCache[k] = c.toDataURL());
  }

  LH.Spr = { get, flash, iconURL, spriteURL, PAL, frames, flashFrame, skillIconURL, glow, shade, emblemURL, lookOf, heroFrames, heroURL, heroImg, HERO };
})(typeof window !== 'undefined' ? window : globalThis);
