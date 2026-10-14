// 在 Node 中載入遊戲核心（不含畫面）
const path = require('path');
const files = ['core', 'data', 'items', 'character', 'map', 'pack', 'sim', 'game'];
for (const f of files) require(path.join(__dirname, '..', 'js', f + '.js'));
module.exports = globalThis.LH;
