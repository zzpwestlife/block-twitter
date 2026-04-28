// 简单的“冒烟测试”：
// 1) 确保批量 true-block 所需的 manifest 权限存在；
// 2) 确保 options.html 含有批量操作 UI 的关键元素（Task2）。
// 运行方式：node tests/options_batch_block_smoke.test.js

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')
);

assert.ok(Array.isArray(manifest.permissions), 'manifest.permissions missing');
assert.ok(
  manifest.permissions.includes('tabs'),
  'manifest.permissions 缺少 tabs（批量屏蔽需要）'
);

const optionsHtml = fs.readFileSync(
  path.join(root, 'src/options/options.html'),
  'utf8'
);
assert.match(optionsHtml, /id="batchTrueBlockBtn"/, '缺少 batchTrueBlockBtn');
assert.match(optionsHtml, /id="batchSelectAllHiddenBtn"/, '缺少 batchSelectAllHiddenBtn');
assert.match(optionsHtml, /id="batchSelectedHiddenCount"/, '缺少 batchSelectedHiddenCount');
assert.match(optionsHtml, /id="batchCancelTrueBlockBtn"/, '缺少 batchCancelTrueBlockBtn');
assert.match(optionsHtml, /id="batchTrueBlockProgress"/, '缺少 batchTrueBlockProgress');

console.log('OK: options batch true-block smoke test passed');
