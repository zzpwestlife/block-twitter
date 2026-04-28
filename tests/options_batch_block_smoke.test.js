// 简单的“冒烟测试”：确保批量 true-block 所需的 manifest 权限存在。
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

console.log('OK: options batch true-block smoke test passed');
